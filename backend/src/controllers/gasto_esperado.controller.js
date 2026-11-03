const pool =
    require("../config/database");

const {
    leerPaginacion,
    metaPaginacion
} = require("../utils/paginacion");


const COLUMNAS = `
    ge.id_gasto_esperado,
    ge.id_proyecto,
    ge.id_categoria,
    c.nombre AS categoria,
    ge.costo_por_unidad_moneda_local,
    ge.numero_de_unidades,
    ge.monto_solicitado_rise_up_moneda_local,
    ge.monto_solicitado_rise_up_usd,
    ge.estado
`;


function validarMonto(valor) {

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


function validarEntero(valor) {

    if (
        valor === undefined ||
        valor === null ||
        valor === ""
    ) {
        return null;
    }

    const n = Number(valor);

    if (!Number.isInteger(n)) {
        return false;
    }

    return n;
}


function extraerCampos(body) {

    const {
        id_proyecto,
        id_categoria,
        costo_por_unidad_moneda_local,
        numero_de_unidades,
        monto_solicitado_rise_up_moneda_local,
        monto_solicitado_rise_up_usd
    } = body;


    const proyectoNum = validarEntero(id_proyecto);
    const categoriaNum = validarEntero(id_categoria);

    if (proyectoNum === null || proyectoNum === false) {
        return { error: "El proyecto es obligatorio y debe ser un ID válido." };
    }

    if (categoriaNum === null || categoriaNum === false) {
        return { error: "La categoría es obligatoria y debe ser un ID válido." };
    }


    const montos = {
        costo_por_unidad_moneda_local:
            validarMonto(costo_por_unidad_moneda_local),
        numero_de_unidades: validarMonto(numero_de_unidades),
        monto_solicitado_rise_up_moneda_local:
            validarMonto(monto_solicitado_rise_up_moneda_local),
        monto_solicitado_rise_up_usd:
            validarMonto(monto_solicitado_rise_up_usd)
    };

    for (const [campo, valor] of Object.entries(montos)) {

        if (valor === false) {
            return { error: `El campo ${campo} debe ser un número mayor o igual a 0.` };
        }
    }


    return {
        valores: [
            proyectoNum,
            categoriaNum,
            montos.costo_por_unidad_moneda_local,
            montos.numero_de_unidades,
            montos.monto_solicitado_rise_up_moneda_local,
            montos.monto_solicitado_rise_up_usd
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


/*
Solicitado en moneda del donante = solicitado local /
tipo de cambio del donante principal (primera fila
activa de proyecto_patrocinador). Si no hay tipo de
cambio, se guarda 0.
*/

async function calcularSolicitadoMonedaDonante(
    idProyecto,
    montoLocal
) {

    const result =
        await pool.query(
            `
            SELECT tipo_cambio
            FROM proyecto_patrocinador
            WHERE id_proyecto = $1
                AND estado = TRUE
            ORDER BY id_proyecto_patrocinador
            LIMIT 1
            `,
            [idProyecto]
        );


    const tc =
        result.rows.length > 0
            ? Number(result.rows[0].tipo_cambio)
            : 0;


    if (!(tc > 0)) {
        return 0;
    }


    return Math.round((montoLocal / tc) * 100) / 100;
}


async function listarGastosEsperados(
    req,
    res
) {

    try {

        const idProyecto =
            Number(req.query.id_proyecto);


        if (!Number.isInteger(idProyecto)) {

            return res.status(400).json({
                message:
                    "El parámetro id_proyecto es obligatorio y debe ser un ID válido."
            });

        }


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


        const filtroEstado =
            verInactivos ? "" : "AND ge.estado = TRUE";


        const totalResult =
            await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total
                FROM gasto_esperado ge
                INNER JOIN categoria_gasto c
                    ON c.id_categoria = ge.id_categoria
                WHERE ge.id_proyecto = $1
                ${filtroEstado}
                `,
                [idProyecto]
            );


        const total = totalResult.rows[0].total;


        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS}
                FROM gasto_esperado ge
                INNER JOIN categoria_gasto c
                    ON c.id_categoria = ge.id_categoria
                WHERE ge.id_proyecto = $1
                ${filtroEstado}
                ORDER BY ge.id_gasto_esperado DESC

                ${exportar ? "" : "LIMIT $2 OFFSET $3"}
                `,
                exportar
                    ? [idProyecto]
                    : [
                        idProyecto,
                        paginacion.limite,
                        paginacion.offset
                    ]
            );


        return res.json({
            gastos_esperados:
                result.rows,

            ...metaPaginacion(
                total,
                exportar ? 1 : paginacion.pagina,
                exportar ? total : paginacion.limite
            )
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener gastos esperados."
        });

    }
}


async function obtenerGastoEsperado(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de gasto esperado inválido."
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS}
                FROM gasto_esperado ge
                INNER JOIN categoria_gasto c
                    ON c.id_categoria = ge.id_categoria
                WHERE ge.id_gasto_esperado = $1
                LIMIT 1
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Gasto esperado no encontrado."
            });

        }


        return res.json({
            gasto_esperado:
                result.rows[0]
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener gasto esperado."
        });

    }
}


async function crearGastoEsperado(
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


        // El solicitado en moneda del donante siempre se
        // recalcula con el tipo de cambio del donante.
        valores[5] =
            await calcularSolicitadoMonedaDonante(
                valores[0],
                valores[4]
            );


        let result;

        try {

            result =
                await pool.query(
                    `
                    INSERT INTO gasto_esperado (
                        id_proyecto,
                        id_categoria,
                        costo_por_unidad_moneda_local,
                        numero_de_unidades,
                        monto_solicitado_rise_up_moneda_local,
                        monto_solicitado_rise_up_usd
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING
                        id_gasto_esperado,
                        id_proyecto,
                        id_categoria,
                        costo_por_unidad_moneda_local,
                        numero_de_unidades,
                        monto_solicitado_rise_up_moneda_local,
                        monto_solicitado_rise_up_usd,
                        estado
                    `,
                    valores
                );

        } catch (dbError) {

            if (dbError.code === "23503") {

                return res.status(400).json({
                    message:
                        "El proyecto o la categoría indicada no existe."
                });

            }

            throw dbError;
        }


        return res.status(201).json({

            message:
                "Gasto esperado registrado correctamente.",

            gasto_esperado:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al registrar gasto esperado."
        });

    }
}


async function editarGastoEsperado(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de gasto esperado inválido."
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


        // El solicitado en moneda del donante siempre se
        // recalcula con el tipo de cambio del donante.
        valores[5] =
            await calcularSolicitadoMonedaDonante(
                valores[0],
                valores[4]
            );


        let result;

        try {

            result =
                await pool.query(
                    `
                    UPDATE gasto_esperado
                    SET
                        id_proyecto = $1,
                        id_categoria = $2,
                        costo_por_unidad_moneda_local = $3,
                        numero_de_unidades = $4,
                        monto_solicitado_rise_up_moneda_local = $5,
                        monto_solicitado_rise_up_usd = $6
                    WHERE id_gasto_esperado = $7
                    RETURNING
                        id_gasto_esperado,
                        id_proyecto,
                        id_categoria,
                        costo_por_unidad_moneda_local,
                        numero_de_unidades,
                        monto_solicitado_rise_up_moneda_local,
                        monto_solicitado_rise_up_usd,
                        estado
                    `,
                    [...valores, id]
                );

        } catch (dbError) {

            if (dbError.code === "23503") {

                return res.status(400).json({
                    message:
                        "El proyecto o la categoría indicada no existe."
                });

            }

            throw dbError;
        }


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Gasto esperado no encontrado."
            });

        }


        return res.json({

            message:
                "Gasto esperado actualizado correctamente.",

            gasto_esperado:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al actualizar gasto esperado."
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
                    "ID de gasto esperado inválido."
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
                FROM gasto_esperado
                WHERE id_gasto_esperado = $1
                LIMIT 1
                `,
                [id]
            );


        if (actual.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Gasto esperado no encontrado."
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
                UPDATE gasto_esperado
                SET estado = $1
                WHERE id_gasto_esperado = $2
                RETURNING
                    id_gasto_esperado,
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

            gasto_esperado:
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
    listarGastosEsperados,
    obtenerGastoEsperado,
    crearGastoEsperado,
    editarGastoEsperado,
    cambiarEstado
};
