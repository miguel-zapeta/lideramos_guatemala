const pool =
    require("../config/database");

const {
    leerPaginacion,
    construirBusqueda,
    metaPaginacion
} = require("../utils/paginacion");


const ESTADOS_VALIDOS = [
    "planeado",
    "en proceso",
    "finalizado"
];


const COLUMNAS = `
    id_proyecto,
    nombre,
    fecha_inicio,
    fecha_finalizacion,
    estado,
    total_gastos_ejecutados,
    gestora_del_proyecto,
    ente_patrocinador,
    asociacion_gestora
`;


/*
Totales financieros calculados como suma de las
filas activas de proyecto_patrocinador. Se devuelven
con los nombres de siempre para que reportes y
Excel sigan funcionando.
*/

const SUMAS_PATROCINADORES = `
    COALESCE((
        SELECT SUM(pp.subvencion_moneda_donante)
        FROM proyecto_patrocinador pp
        WHERE pp.id_proyecto = p.id_proyecto
            AND pp.estado = TRUE
    ), 0) AS subvencion,

    COALESCE((
        SELECT SUM(pp.cantidad_solicitada_moneda_donante)
        FROM proyecto_patrocinador pp
        WHERE pp.id_proyecto = p.id_proyecto
            AND pp.estado = TRUE
    ), 0) AS monto_total_solicitado_rise_up,

    COALESCE((
        SELECT SUM(pp.subvencion_moneda_nacional)
        FROM proyecto_patrocinador pp
        WHERE pp.id_proyecto = p.id_proyecto
            AND pp.estado = TRUE
    ), 0) AS monto_total_subvencion,

    COALESCE((
        SELECT SUM(pp.diferencia_solicitado_subvencion)
        FROM proyecto_patrocinador pp
        WHERE pp.id_proyecto = p.id_proyecto
            AND pp.estado = TRUE
    ), 0) AS diferencia_entre_solicitado_y_subvencion
`;


function validarNumero(valor) {

    if (
        valor === undefined ||
        valor === null ||
        valor === ""
    ) {
        return 0;
    }

    const n = Number(valor);

    if (!Number.isFinite(n) || n < 0) {
        return false;
    }

    return n;
}


function validarFecha(valor) {

    if (
        valor === undefined ||
        valor === null ||
        valor === ""
    ) {
        return null;
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


function extraerCampos(body) {

    const {
        nombre,
        fecha_inicio,
        fecha_finalizacion,
        gestora_del_proyecto,
        asociacion_gestora
    } = body;


    if (!nombre || String(nombre).trim() === "") {
        return { error: "El nombre es obligatorio." };
    }


    const inicio = validarFecha(fecha_inicio);
    const fin = validarFecha(fecha_finalizacion);

    if (inicio === false || fin === false) {
        return { error: "Las fechas deben tener formato AAAA-MM-DD." };
    }

    if (inicio && fin && fin < inicio) {
        return { error: "La fecha de finalización no puede ser anterior al inicio." };
    }


    const texto = (valor) =>
        valor === undefined || valor === null || String(valor).trim() === ""
            ? null
            : String(valor).trim();


    return {
        valores: [
            String(nombre).trim(),
            inicio,
            fin,
            texto(gestora_del_proyecto),
            texto(asociacion_gestora)
        ]
    };
}


async function listarOpciones(
    req,
    res
) {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    id_proyecto,
                    nombre,
                    estado
                FROM proyecto
                ORDER BY nombre
                `
            );


        return res.json({
            proyectos:
                result.rows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener proyectos."
        });

    }
}


const MAPA_BUSQUEDA_PROYECTOS = {
    nombre: ["p.nombre"],
    inicio: ["TO_CHAR(p.fecha_inicio, 'YYYY-MM-DD')"],
    fin: ["TO_CHAR(p.fecha_finalizacion, 'YYYY-MM-DD')"],
    estado: ["p.estado"],
    todos: [
        "p.nombre",
        "TO_CHAR(p.fecha_inicio, 'YYYY-MM-DD')",
        "TO_CHAR(p.fecha_finalizacion, 'YYYY-MM-DD')",
        "p.estado"
    ]
};


async function listarProyectos(
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


        const { sql: filtroBusqueda, params: paramsBusqueda } =
            construirBusqueda({
                buscar: req.query.buscar,
                campo: req.query.campo,
                mapa: MAPA_BUSQUEDA_PROYECTOS,
                inicioParam: 1
            });

        const where =
            filtroBusqueda ? `WHERE ${filtroBusqueda}` : "";


        const totalResult =
            await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COUNT(*) FILTER (WHERE p.estado = 'planeado')::INTEGER AS planeados,
                    COUNT(*) FILTER (WHERE p.estado = 'en proceso')::INTEGER AS en_proceso,
                    COUNT(*) FILTER (WHERE p.estado = 'finalizado')::INTEGER AS finalizados
                FROM proyecto p
                ${where}
                `,
                paramsBusqueda
            );


        const total = totalResult.rows[0].total;


        const limiteDatos =
            paramsBusqueda.length + 1;

        const offsetDatos =
            paramsBusqueda.length + 2;

        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS},
                    ${SUMAS_PATROCINADORES}
                FROM proyecto p
                ${where}
                ORDER BY p.id_proyecto DESC

                ${exportar ? "" : `LIMIT $${limiteDatos} OFFSET $${offsetDatos}`}
                `,
                exportar
                    ? paramsBusqueda
                    : [
                        ...paramsBusqueda,
                        paginacion.limite,
                        paginacion.offset
                    ]
            );


        return res.json({
            proyectos:
                result.rows,

            ...metaPaginacion(
                total,
                exportar ? 1 : paginacion.pagina,
                exportar ? total : paginacion.limite
            ),

            resumen: {
                total,
                planeados: totalResult.rows[0].planeados,
                en_proceso: totalResult.rows[0].en_proceso,
                finalizados: totalResult.rows[0].finalizados
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener proyectos."
        });

    }
}


async function obtenerProyecto(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de proyecto inválido."
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS},
                    ${SUMAS_PATROCINADORES}
                FROM proyecto p
                WHERE p.id_proyecto = $1
                LIMIT 1
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Proyecto no encontrado."
            });

        }


        return res.json({
            proyecto:
                result.rows[0]
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener proyecto."
        });

    }
}


async function crearProyecto(
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


        const result =
            await pool.query(
                `
                INSERT INTO proyecto (
                    nombre,
                    fecha_inicio,
                    fecha_finalizacion,
                    gestora_del_proyecto,
                    asociacion_gestora
                )
                VALUES (
                    $1, $2, $3, $4, $5
                )
                RETURNING
                    ${COLUMNAS}
                `,
                valores
            );


        return res.status(201).json({

            message:
                "Proyecto creado correctamente.",

            proyecto:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al crear proyecto."
        });

    }
}


async function editarProyecto(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de proyecto inválido."
            });

        }


        const actual =
            await pool.query(
                `
                SELECT estado
                FROM proyecto
                WHERE id_proyecto = $1
                LIMIT 1
                `,
                [id]
            );


        if (actual.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Proyecto no encontrado."
            });

        }


        if (actual.rows[0].estado === "finalizado") {

            return res.status(403).json({
                message:
                    "El proyecto está finalizado y ya no se puede editar."
            });

        }


        const { error, valores } = extraerCampos(req.body);

        if (error) {

            return res.status(400).json({
                message: error
            });

        }


        const nuevoEstado = req.body.estado;

        if (
            nuevoEstado !== undefined &&
            !ESTADOS_VALIDOS.includes(nuevoEstado)
        ) {

            return res.status(400).json({
                message:
                    "Estado inválido. Use: planeado, en proceso o finalizado."
            });

        }


        const result =
            await pool.query(
                `
                UPDATE proyecto
                SET
                    nombre = $1,
                    fecha_inicio = $2,
                    fecha_finalizacion = $3,
                    gestora_del_proyecto = $4,
                    asociacion_gestora = $5,
                    estado = COALESCE($6, estado)
                WHERE id_proyecto = $7
                RETURNING
                    ${COLUMNAS}
                `,
                [...valores, nuevoEstado || null, id]
            );


        return res.json({

            message:
                "Proyecto actualizado correctamente.",

            proyecto:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al actualizar proyecto."
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
                    "ID de proyecto inválido."
            });

        }


        if (!ESTADOS_VALIDOS.includes(estado)) {

            return res.status(400).json({
                message:
                    "Estado inválido. Use: planeado, en proceso o finalizado."
            });

        }


        const actual =
            await pool.query(
                `
                SELECT estado
                FROM proyecto
                WHERE id_proyecto = $1
                LIMIT 1
                `,
                [id]
            );


        if (actual.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Proyecto no encontrado."
            });

        }


        if (actual.rows[0].estado === "finalizado") {

            return res.status(403).json({
                message:
                    "El proyecto está finalizado y ya no se puede modificar."
            });

        }


        const result =
            await pool.query(
                `
                UPDATE proyecto
                SET estado = $1
                WHERE id_proyecto = $2
                RETURNING
                    id_proyecto,
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

            proyecto:
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
    listarOpciones,
    listarProyectos,
    obtenerProyecto,
    crearProyecto,
    editarProyecto,
    cambiarEstado
};
