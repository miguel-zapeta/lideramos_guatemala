const pool =
    require("../config/database");


const COLUMNAS_LISTA = `
    g.id_gasto,
    g.id_proyecto,
    g.id_categoria,
    c.nombre AS categoria,
    g.numero,
    g.fecha,
    g.numero_documento,
    g.serie,
    g.tipo_documento,
    g.razon_denominacion_social,
    g.descripcion,
    g.valor_base,
    g.iva,
    g.otros_impuestos,
    g.monto,
    g.trayecto,
    g.numero_comprobante,
    g.proveedor,
    g.total_valor_base,
    g.total_del_gasto,
    g.estado
`;


const COLUMNAS_RETURNING = `
    id_gasto,
    id_proyecto,
    id_categoria,
    numero,
    fecha,
    numero_documento,
    serie,
    tipo_documento,
    razon_denominacion_social,
    descripcion,
    valor_base,
    iva,
    otros_impuestos,
    monto,
    trayecto,
    numero_comprobante,
    proveedor,
    total_valor_base,
    total_del_gasto,
    estado
`;


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


function validarNumero(valor) {

    if (
        valor === undefined ||
        valor === null ||
        valor === ""
    ) {
        return null;
    }

    const n = Number(valor);

    if (!Number.isFinite(n) || n < 0) {
        return false;
    }

    return n;
}


function validarFecha(fecha) {

    if (!fecha || typeof fecha !== "string") {
        return false;
    }

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
        id_proyecto,
        id_categoria,
        numero,
        fecha,
        numero_documento,
        serie,
        tipo_documento,
        razon_denominacion_social,
        descripcion,
        valor_base,
        iva,
        otros_impuestos,
        monto,
        trayecto,
        numero_comprobante,
        proveedor,
        total_valor_base,
        total_del_gasto
    } = body;


    const proyectoNum = validarEntero(id_proyecto);
    const categoriaNum = validarEntero(id_categoria);
    const numeroNum = validarNumero(numero);
    const documentoNum = validarNumero(numero_documento);
    const montoNum = validarNumero(monto);


    if (proyectoNum === null || proyectoNum === false) {
        return { error: "El proyecto es obligatorio y debe ser un ID válido." };
    }

    if (categoriaNum === null || categoriaNum === false) {
        return { error: "La categoría es obligatoria y debe ser un ID válido." };
    }

    if (numeroNum === null || numeroNum === false) {
        return { error: "El número debe ser un valor numérico mayor o igual a 0." };
    }

    if (validarFecha(fecha) === false) {
        return { error: "La fecha es obligatoria (formato AAAA-MM-DD)." };
    }

    if (documentoNum === null || documentoNum === false) {
        return { error: "El número de documento debe ser un valor numérico mayor o igual a 0." };
    }

    if (!serie || serie.trim() === "") {
        return { error: "La serie es obligatoria." };
    }

    if (montoNum === null || montoNum === false) {
        return { error: "El monto debe ser un valor numérico mayor o igual a 0." };
    }


    const opcionales = {
        valor_base: validarNumero(valor_base),
        iva: validarNumero(iva),
        otros_impuestos: validarNumero(otros_impuestos),
        numero_comprobante: validarNumero(numero_comprobante),
        total_valor_base: validarNumero(total_valor_base),
        total_del_gasto: validarNumero(total_del_gasto)
    };

    for (const [campo, valor] of Object.entries(opcionales)) {

        if (valor === false) {
            return { error: `El campo ${campo} debe ser un valor numérico mayor o igual a 0.` };
        }
    }


    const texto = (valor) =>
        valor === undefined || valor === null || String(valor).trim() === ""
            ? null
            : String(valor).trim();


    return {
        valores: [
            proyectoNum,
            categoriaNum,
            numeroNum,
            fecha,
            documentoNum,
            serie.trim(),
            texto(tipo_documento),
            texto(razon_denominacion_social),
            texto(descripcion),
            opcionales.valor_base,
            opcionales.iva,
            opcionales.otros_impuestos,
            montoNum,
            texto(trayecto),
            opcionales.numero_comprobante,
            texto(proveedor),
            opcionales.total_valor_base,
            opcionales.total_del_gasto
        ]
    };
}


async function listarGastos(
    req,
    res
) {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS_LISTA}
                FROM gasto g
                INNER JOIN categoria_gasto c
                    ON c.id_categoria = g.id_categoria
                ORDER BY
                    g.id_gasto DESC
                `
            );


        return res.json({
            gastos:
                result.rows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener gastos."
        });

    }
}


async function obtenerGasto(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de gasto inválido."
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS_LISTA}
                FROM gasto g
                INNER JOIN categoria_gasto c
                    ON c.id_categoria = g.id_categoria
                WHERE g.id_gasto = $1
                LIMIT 1
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Gasto no encontrado."
            });

        }


        return res.json({
            gasto:
                result.rows[0]
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener gasto."
        });

    }
}


async function crearGasto(
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


        let result;

        try {

            result =
                await pool.query(
                    `
                    INSERT INTO gasto (
                        id_proyecto,
                        id_categoria,
                        numero,
                        fecha,
                        numero_documento,
                        serie,
                        tipo_documento,
                        razon_denominacion_social,
                        descripcion,
                        valor_base,
                        iva,
                        otros_impuestos,
                        monto,
                        trayecto,
                        numero_comprobante,
                        proveedor,
                        total_valor_base,
                        total_del_gasto
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9,
                        $10, $11, $12, $13, $14, $15, $16, $17, $18
                    )
                    RETURNING
                        ${COLUMNAS_RETURNING}
                    `,
                    valores
                );

        } catch (dbError) {

            if (dbError.code === "23503") {

                return res.status(400).json({
                    message:
                        "El proyecto o el rubro indicado no existe."
                });

            }

            throw dbError;
        }


        return res.status(201).json({

            message:
                "Gasto registrado correctamente.",

            gasto:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al registrar gasto."
        });

    }
}


async function editarGasto(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de gasto inválido."
            });

        }


        const { error, valores } = extraerCampos(req.body);

        if (error) {

            return res.status(400).json({
                message: error
            });

        }


        let result;

        try {

            result =
                await pool.query(
                    `
                    UPDATE gasto
                    SET
                        id_proyecto = $1,
                        id_categoria = $2,
                        numero = $3,
                        fecha = $4,
                        numero_documento = $5,
                        serie = $6,
                        tipo_documento = $7,
                        razon_denominacion_social = $8,
                        descripcion = $9,
                        valor_base = $10,
                        iva = $11,
                        otros_impuestos = $12,
                        monto = $13,
                        trayecto = $14,
                        numero_comprobante = $15,
                        proveedor = $16,
                        total_valor_base = $17,
                        total_del_gasto = $18
                    WHERE id_gasto = $19
                    RETURNING
                        ${COLUMNAS_RETURNING}
                    `,
                    [...valores, id]
                );

        } catch (dbError) {

            if (dbError.code === "23503") {

                return res.status(400).json({
                    message:
                        "El proyecto o el rubro indicado no existe."
                });

            }

            throw dbError;
        }


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Gasto no encontrado."
            });

        }


        return res.json({

            message:
                "Gasto actualizado correctamente.",

            gasto:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al actualizar gasto."
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
                    "ID de gasto inválido."
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


        const result =
            await pool.query(
                `
                UPDATE gasto
                SET estado = $1
                WHERE id_gasto = $2
                RETURNING
                    id_gasto,
                    estado
                `,
                [
                    estado,
                    id
                ]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Gasto no encontrado."
            });

        }


        return res.json({

            message:
                "Estado actualizado correctamente.",

            gasto:
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
    listarGastos,
    obtenerGasto,
    crearGasto,
    editarGasto,
    cambiarEstado
};
