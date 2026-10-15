const pool =
    require("../config/database");

const {
    leerPaginacion,
    construirBusqueda,
    metaPaginacion
} = require("../utils/paginacion");


const COLUMNAS = `
    id_actividad,
    id_proyecto,
    nombre,
    tema,
    fecha,
    numero_asistentes,
    responsable,
    realizado_por,
    ninos,
    ninas,
    adolescentes_h,
    adolescentes_m,
    adultos,
    eje,
    resumen_evento,
    enlace_en_redes,
    lugar,
    grupo_beneficiado,
    temas_centrales,
    duracion,
    objetivos,
    resultados,
    aportes_del_evento,
    comentario,
    materiales,
    alimentos,
    url_foto,
    estado
`;


function validarEntero(valor, obligatorio) {

    if (
        valor === undefined ||
        valor === null ||
        valor === ""
    ) {
        return obligatorio ? false : null;
    }

    const n = Number(valor);

    if (!Number.isInteger(n) || n < 0) {
        return false;
    }

    return n;
}


function validarFecha(valor, obligatoria) {

    if (
        valor === undefined ||
        valor === null ||
        valor === ""
    ) {
        return obligatoria ? false : null;
    }

    if (typeof valor !== "string") {
        return false;
    }

    const fecha = valor.slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return false;
    }

    const d = new Date(fecha + "T00:00:00");

    if (Number.isNaN(d.getTime())) {
        return false;
    }

    return fecha;
}


function texto(valor) {

    return valor === undefined || valor === null || String(valor).trim() === ""
        ? null
        : String(valor).trim();
}


function extraerCampos(body) {

    const {
        id_proyecto,
        nombre,
        tema,
        fecha,
        numero_asistentes,
        responsable,
        realizado_por,
        ninos,
        ninas,
        adolescentes_h,
        adolescentes_m,
        adultos,
        eje,
        resumen_evento,
        enlace_en_redes,
        lugar,
        grupo_beneficiado,
        temas_centrales,
        duracion,
        objetivos,
        resultados,
        aportes_del_evento,
        comentario,
        materiales,
        alimentos,
        url_foto
    } = body;


    const proyectoNum = validarEntero(id_proyecto, true);

    if (proyectoNum === false) {
        return { error: "El proyecto es obligatorio y debe ser un ID válido." };
    }

    if (!nombre || String(nombre).trim() === "") {
        return { error: "El nombre es obligatorio." };
    }

    if (!tema || String(tema).trim() === "") {
        return { error: "El tema es obligatorio." };
    }

    const fechaVal = validarFecha(fecha, true);

    if (fechaVal === false) {
        return { error: "La fecha es obligatoria (formato AAAA-MM-DD)." };
    }

    const asistentes = validarEntero(numero_asistentes, true);

    if (asistentes === false) {
        return { error: "El número de asistentes es obligatorio (entero mayor o igual a 0)." };
    }

    if (!responsable || String(responsable).trim() === "") {
        return { error: "El responsable es obligatorio." };
    }

    if (!realizado_por || String(realizado_por).trim() === "") {
        return { error: "El campo realizado por es obligatorio." };
    }

    if (!eje || String(eje).trim() === "") {
        return { error: "El eje es obligatorio." };
    }


    const conteos = {
        ninos: validarEntero(ninos, false),
        ninas: validarEntero(ninas, false),
        adolescentes_h: validarEntero(adolescentes_h, false),
        adolescentes_m: validarEntero(adolescentes_m, false),
        adultos: validarEntero(adultos, false)
    };

    for (const [campo, valor] of Object.entries(conteos)) {

        if (valor === false) {
            return { error: `El campo ${campo} debe ser un entero mayor o igual a 0.` };
        }
    }


    return {
        valores: [
            proyectoNum,
            String(nombre).trim(),
            String(tema).trim(),
            fechaVal,
            asistentes,
            String(responsable).trim(),
            String(realizado_por).trim(),
            conteos.ninos,
            conteos.ninas,
            conteos.adolescentes_h,
            conteos.adolescentes_m,
            conteos.adultos,
            String(eje).trim(),
            texto(resumen_evento),
            texto(enlace_en_redes),
            texto(lugar),
            texto(grupo_beneficiado),
            texto(temas_centrales),
            texto(duracion),
            texto(objetivos),
            texto(resultados),
            texto(aportes_del_evento),
            texto(comentario),
            texto(materiales),
            texto(alimentos),
            texto(url_foto)
        ]
    };
}


async function proyectoFinalizado(idProyecto) {

    const result =
        await pool.query(
            `
            SELECT estado
            FROM proyecto
            WHERE id_proyecto = $1
            LIMIT 1
            `,
            [idProyecto]
        );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0].estado === "finalizado";
}


const MAPA_BUSQUEDA_ACTIVIDADES = {
    nombre: ["a.nombre"],
    tema: ["a.tema"],
    fecha: ["TO_CHAR(a.fecha, 'YYYY-MM-DD')"],
    realizado: ["a.realizado_por"],
    eje: ["a.eje"],
    estado: [
        "CASE WHEN a.estado THEN 'activo' ELSE 'inactivo' END"
    ],
    todos: [
        "a.nombre",
        "a.tema",
        "TO_CHAR(a.fecha, 'YYYY-MM-DD')",
        "a.realizado_por",
        "a.eje",
        "CASE WHEN a.estado THEN 'activo' ELSE 'inactivo' END"
    ]
};


async function listarActividades(
    req,
    res
) {

    try {

        const paginacion = leerPaginacion(req);

        if (paginacion.error) {

            return res.status(400).json({
                message:
                    paginacion.error
            });

        }


        const exportar =
            req.query.exportar === "1";

        const verInactivos =
            req.query.ver_inactivos === "1";


        const filtros = [];

        const paramsBase = [];


        if (!verInactivos) {
            filtros.push("a.estado = TRUE");
        }


        const { sql: filtroBusqueda, params: paramsBusqueda } =
            construirBusqueda({
                buscar: req.query.buscar,
                campo: req.query.campo,
                mapa: MAPA_BUSQUEDA_ACTIVIDADES,
                inicioParam: 1
            });

        if (filtroBusqueda) {
            filtros.push(filtroBusqueda);
            paramsBase.push(...paramsBusqueda);
        }


        const where =
            filtros.length > 0
                ? `WHERE ${filtros.join(" AND ")}`
                : "";


        const totalResult =
            await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COUNT(*) FILTER (WHERE a.estado = TRUE)::INTEGER AS activos
                FROM actividad a
                ${where}
                `,
                paramsBase
            );


        const total = totalResult.rows[0].total;

        const activos = totalResult.rows[0].activos;


        const limiteDatos =
            paramsBase.length + 1;

        const offsetDatos =
            paramsBase.length + 2;

        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS}
                FROM actividad a
                ${where}
                ORDER BY a.id_actividad DESC

                ${exportar ? "" : `LIMIT $${limiteDatos} OFFSET $${offsetDatos}`}
                `,
                exportar
                    ? paramsBase
                    : [
                        ...paramsBase,
                        paginacion.limite,
                        paginacion.offset
                    ]
            );


        return res.json({
            actividades:
                result.rows,

            ...metaPaginacion(
                total,
                exportar ? 1 : paginacion.pagina,
                exportar ? total : paginacion.limite
            ),

            resumen: {
                total,
                activos,
                inactivos: total - activos
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener actividades."
        });

    }
}


async function obtenerActividad(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de actividad inválido."
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS}
                FROM actividad
                WHERE id_actividad = $1
                LIMIT 1
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Actividad no encontrada."
            });

        }


        return res.json({
            actividad:
                result.rows[0]
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener actividad."
        });

    }
}


async function crearActividad(
    req,
    res
) {

    try {

        const { error, valores } = extraerCampos(req.body);

        if (error) {

            return res.status(400).json({
                message: error
            });

        }


        const finalizado = await proyectoFinalizado(valores[0]);

        if (finalizado === null) {

            return res.status(400).json({
                message:
                    "El proyecto indicado no existe."
            });

        }

        if (finalizado) {

            return res.status(403).json({
                message:
                    "El proyecto está finalizado y ya no se puede modificar."
            });

        }


        let result;

        try {

            result =
                await pool.query(
                    `
                    INSERT INTO actividad (
                        id_proyecto,
                        nombre,
                        tema,
                        fecha,
                        numero_asistentes,
                        responsable,
                        realizado_por,
                        ninos,
                        ninas,
                        adolescentes_h,
                        adolescentes_m,
                        adultos,
                        eje,
                        resumen_evento,
                        enlace_en_redes,
                        lugar,
                        grupo_beneficiado,
                        temas_centrales,
                        duracion,
                        objetivos,
                        resultados,
                        aportes_del_evento,
                        comentario,
                        materiales,
                        alimentos,
                        url_foto
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                        $21, $22, $23, $24, $25, $26
                    )
                    RETURNING
                        ${COLUMNAS}
                    `,
                    valores
                );

        } catch (dbError) {

            if (dbError.code === "23503") {

                return res.status(400).json({
                    message:
                        "El proyecto indicado no existe."
                });

            }

            throw dbError;
        }


        return res.status(201).json({

            message:
                "Actividad creada correctamente.",

            actividad:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al crear actividad."
        });

    }
}


async function editarActividad(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de actividad inválido."
            });

        }


        const { error, valores } = extraerCampos(req.body);

        if (error) {

            return res.status(400).json({
                message: error
            });

        }


        const finalizado = await proyectoFinalizado(valores[0]);

        if (finalizado === null) {

            return res.status(400).json({
                message:
                    "El proyecto indicado no existe."
            });

        }

        if (finalizado) {

            return res.status(403).json({
                message:
                    "El proyecto está finalizado y ya no se puede modificar."
            });

        }


        let result;

        try {

            result =
                await pool.query(
                    `
                    UPDATE actividad
                    SET
                        id_proyecto = $1,
                        nombre = $2,
                        tema = $3,
                        fecha = $4,
                        numero_asistentes = $5,
                        responsable = $6,
                        realizado_por = $7,
                        ninos = $8,
                        ninas = $9,
                        adolescentes_h = $10,
                        adolescentes_m = $11,
                        adultos = $12,
                        eje = $13,
                        resumen_evento = $14,
                        enlace_en_redes = $15,
                        lugar = $16,
                        grupo_beneficiado = $17,
                        temas_centrales = $18,
                        duracion = $19,
                        objetivos = $20,
                        resultados = $21,
                        aportes_del_evento = $22,
                        comentario = $23,
                        materiales = $24,
                        alimentos = $25,
                        url_foto = $26
                    WHERE id_actividad = $27
                    RETURNING
                        ${COLUMNAS}
                    `,
                    [...valores, id]
                );

        } catch (dbError) {

            if (dbError.code === "23503") {

                return res.status(400).json({
                    message:
                        "El proyecto indicado no existe."
                });

            }

            throw dbError;
        }


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Actividad no encontrada."
            });

        }


        return res.json({

            message:
                "Actividad actualizada correctamente.",

            actividad:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al actualizar actividad."
        });

    }
}


async function cambiarEstado(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);

        const {
            estado
        } = req.body;


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de actividad inválido."
            });

        }


        if (
            typeof estado !==
            "boolean"
        ) {

            return res.status(400).json({
                message:
                    "El estado debe ser booleano."
            });

        }


        const actual =
            await pool.query(
                `
                SELECT id_proyecto
                FROM actividad
                WHERE id_actividad = $1
                LIMIT 1
                `,
                [id]
            );


        if (actual.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Actividad no encontrada."
            });

        }


        if (await proyectoFinalizado(actual.rows[0].id_proyecto)) {

            return res.status(403).json({
                message:
                    "El proyecto está finalizado y ya no se puede modificar."
            });

        }


        const result =
            await pool.query(
                `
                UPDATE actividad
                SET estado = $1
                WHERE id_actividad = $2
                RETURNING
                    id_actividad,
                    estado
                `,
                [
                    estado,
                    id
                ]
            );


        return res.json({

            message:
                "Estado actualizado correctamente.",

            actividad:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al actualizar estado."
        });

    }
}


module.exports = {
    listarActividades,
    obtenerActividad,
    crearActividad,
    editarActividad,
    cambiarEstado
};
