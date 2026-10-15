const pool =
    require("../config/database");


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
    subvencion,
    fecha_tipo_cambio,
    tipo_cambio,
    fuente_tipo_cambio,
    total_gastos_ejecutados,
    monto_total_solicitado_rise_up,
    monto_total_subvencion,
    diferencia_entre_solicitado_y_subvencion,
    gestora_del_proyecto,
    ente_patrocinador,
    asociacion_gestora
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
        subvencion,
        fecha_tipo_cambio,
        tipo_cambio,
        fuente_tipo_cambio,
        total_gastos_ejecutados,
        monto_total_solicitado_rise_up,
        monto_total_subvencion,
        diferencia_entre_solicitado_y_subvencion,
        gestora_del_proyecto,
        ente_patrocinador,
        asociacion_gestora
    } = body;


    if (!nombre || String(nombre).trim() === "") {
        return { error: "El nombre es obligatorio." };
    }


    const inicio = validarFecha(fecha_inicio);
    const fin = validarFecha(fecha_finalizacion);
    const fechaTc = validarFecha(fecha_tipo_cambio);

    if (inicio === false || fin === false || fechaTc === false) {
        return { error: "Las fechas deben tener formato AAAA-MM-DD." };
    }

    if (inicio && fin && fin < inicio) {
        return { error: "La fecha de finalización no puede ser anterior al inicio." };
    }


    const numericos = {
        subvencion: validarNumero(subvencion),
        tipo_cambio: validarNumero(tipo_cambio),
        total_gastos_ejecutados: validarNumero(total_gastos_ejecutados),
        monto_total_solicitado_rise_up:
            validarNumero(monto_total_solicitado_rise_up),
        monto_total_subvencion: validarNumero(monto_total_subvencion),
        diferencia_entre_solicitado_y_subvencion:
            validarNumero(diferencia_entre_solicitado_y_subvencion)
    };

    for (const [campo, valor] of Object.entries(numericos)) {

        if (valor === false) {
            return { error: `El campo ${campo} debe ser un número mayor o igual a 0.` };
        }
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
            numericos.subvencion,
            fechaTc,
            numericos.tipo_cambio,
            texto(fuente_tipo_cambio),
            numericos.total_gastos_ejecutados,
            numericos.monto_total_solicitado_rise_up,
            numericos.monto_total_subvencion,
            numericos.diferencia_entre_solicitado_y_subvencion,
            texto(gestora_del_proyecto),
            texto(ente_patrocinador),
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


async function listarProyectos(
    req,
    res
) {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS}
                FROM proyecto
                ORDER BY id_proyecto DESC
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
                    ${COLUMNAS}
                FROM proyecto
                WHERE id_proyecto = $1
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
                    subvencion,
                    fecha_tipo_cambio,
                    tipo_cambio,
                    fuente_tipo_cambio,
                    total_gastos_ejecutados,
                    monto_total_solicitado_rise_up,
                    monto_total_subvencion,
                    diferencia_entre_solicitado_y_subvencion,
                    gestora_del_proyecto,
                    ente_patrocinador,
                    asociacion_gestora
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                    $12, $13, $14
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
                    subvencion = $4,
                    fecha_tipo_cambio = $5,
                    tipo_cambio = $6,
                    fuente_tipo_cambio = $7,
                    total_gastos_ejecutados = $8,
                    monto_total_solicitado_rise_up = $9,
                    monto_total_subvencion = $10,
                    diferencia_entre_solicitado_y_subvencion = $11,
                    gestora_del_proyecto = $12,
                    ente_patrocinador = $13,
                    asociacion_gestora = $14,
                    estado = COALESCE($15, estado)
                WHERE id_proyecto = $16
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
