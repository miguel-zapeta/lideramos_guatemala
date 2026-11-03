const pool =
    require("../config/database");

const {
    leerPaginacion,
    construirBusqueda,
    metaPaginacion
} = require("../utils/paginacion");


const COLUMNAS_LISTA = `
    g.id_gasto,
    g.id_proyecto,
    g.id_categoria,
    c.nombre AS categoria,
    r.nombre AS rubro,
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


const MAPA_BUSQUEDA_GASTOS = {
    proyecto: ["pr.nombre", "pr.id_proyecto::TEXT"],
    numero: ["g.numero::TEXT"],
    descripcion: ["g.descripcion"],
    categoria: ["c.nombre"],
    fecha: ["TO_CHAR(g.fecha, 'YYYY-MM-DD')"],
    serie: ["g.serie"],
    numero_documento: ["g.numero_documento::TEXT"],
    tipo_documento: ["g.tipo_documento"],
    numero_comprobante: ["g.numero_comprobante::TEXT"],
    razon: ["g.razon_denominacion_social"],
    monto: ["g.monto::TEXT"],
    estado: [
        "CASE WHEN g.estado THEN 'activo' ELSE 'inactivo' END"
    ],
    todos: [
        "pr.nombre",
        "pr.id_proyecto::TEXT",
        "g.numero::TEXT",
        "g.descripcion",
        "c.nombre",
        "TO_CHAR(g.fecha, 'YYYY-MM-DD')",
        "g.serie",
        "g.numero_documento::TEXT",
        "g.tipo_documento",
        "g.numero_comprobante::TEXT",
        "g.razon_denominacion_social",
        "g.monto::TEXT",
        "CASE WHEN g.estado THEN 'activo' ELSE 'inactivo' END"
    ]
};


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
        proveedor
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
        numero_comprobante: validarNumero(numero_comprobante)
    };

    for (const [campo, valor] of Object.entries(opcionales)) {

        if (valor === false) {
            return { error: `El campo ${campo} debe ser un valor numérico mayor o igual a 0.` };
        }
    }


    // Total del gasto siempre calculado: valor base + IVA + otros.
    const totalDelGasto =
        Math.round(
            ((opcionales.valor_base || 0) +
                (opcionales.iva || 0) +
                (opcionales.otros_impuestos || 0)) * 100
        ) / 100;


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
            totalDelGasto
        ]
    };
}


async function listarGastos(
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
            filtros.push("g.estado = TRUE");
        }


        const { sql: filtroBusqueda, params: paramsBusqueda } =
            construirBusqueda({
                buscar: req.query.buscar,
                campo: req.query.campo,
                mapa: MAPA_BUSQUEDA_GASTOS,
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
                    COUNT(*) FILTER (WHERE g.estado = TRUE)::INTEGER AS activos
                FROM gasto g
                INNER JOIN categoria_gasto c
                    ON c.id_categoria = g.id_categoria
                INNER JOIN rubro r
                    ON r.id_rubro = c.id_rubro
                INNER JOIN proyecto pr
                    ON pr.id_proyecto = g.id_proyecto
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
                    ${COLUMNAS_LISTA}
                FROM gasto g
                INNER JOIN categoria_gasto c
                    ON c.id_categoria = g.id_categoria
                INNER JOIN rubro r
                    ON r.id_rubro = c.id_rubro
                INNER JOIN proyecto pr
                    ON pr.id_proyecto = g.id_proyecto
                ${where}
                ORDER BY
                    g.id_gasto DESC

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
            gastos:
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
                INNER JOIN rubro r
                    ON r.id_rubro = c.id_rubro
                INNER JOIN proyecto pr
                    ON pr.id_proyecto = g.id_proyecto
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
                        total_del_gasto
                    )
                    VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9,
                        $10, $11, $12, $13, $14, $15, $16, $17
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
                        total_del_gasto = $17
                    WHERE id_gasto = $18
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
