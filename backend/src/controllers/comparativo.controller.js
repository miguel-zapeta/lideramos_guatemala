const pool =
    require("../config/database");


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

    if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return false;
    }

    const d = new Date(valor + "T00:00:00");

    if (Number.isNaN(d.getTime())) {
        return false;
    }

    return valor;
}


function validarTexto(valor) {

    if (
        valor === undefined ||
        valor === null ||
        String(valor).trim() === ""
    ) {
        return null;
    }

    return String(valor).trim();
}


async function generarReporteComparativo(
    req,
    res
) {

    try {

        const idProyecto =
            Number(req.query.id_proyecto);

        const tipoCambio =
            Number(req.query.tipo_cambio);

        const fechaTipoCambio =
            validarFecha(req.query.fecha_tipo_cambio);

        const fuenteTipoCambio =
            validarTexto(req.query.fuente_tipo_cambio);


        if (!Number.isInteger(idProyecto)) {

            return res.status(400).json({
                message:
                    "El proyecto es obligatorio y debe ser un ID válido."
            });
        }


        if (
            req.query.tipo_cambio === undefined ||
            req.query.tipo_cambio === null ||
            req.query.tipo_cambio === "" ||
            !Number.isFinite(tipoCambio) ||
            tipoCambio <= 0
        ) {

            return res.status(400).json({
                message:
                    "El tipo de cambio es obligatorio y debe ser mayor a 0."
            });
        }


        if (fechaTipoCambio === false) {

            return res.status(400).json({
                message:
                    "La fecha del tipo de cambio debe tener formato AAAA-MM-DD."
            });
        }


        const proyecto =
            await pool.query(
                `
                SELECT
                    id_proyecto,
                    nombre,
                    subvencion
                FROM proyecto
                WHERE id_proyecto = $1
                LIMIT 1
                `,
                [idProyecto]
            );


        if (proyecto.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Proyecto no encontrado."
            });
        }


        const detalle =
            await pool.query(
                `
                WITH cats AS (

                    SELECT DISTINCT id_categoria
                    FROM gasto_esperado
                    WHERE id_proyecto = $1
                    AND estado = TRUE

                    UNION

                    SELECT DISTINCT id_categoria
                    FROM gasto
                    WHERE id_proyecto = $1
                    AND estado = TRUE

                ),
                plan AS (

                    SELECT
                        ge.id_categoria,
                        SUM(ge.costo_por_unidad_moneda_local)
                            AS costo_unidad,
                        SUM(ge.numero_de_unidades)
                            AS unidades,
                        SUM(ge.monto_solicitado_rise_up_moneda_local)
                            AS sol_local,
                        SUM(ge.monto_solicitado_rise_up_usd)
                            AS sol_usd
                    FROM gasto_esperado ge
                    WHERE ge.id_proyecto = $1
                    AND ge.estado = TRUE
                    GROUP BY ge.id_categoria

                ),
                ejec AS (

                    SELECT
                        g.id_categoria,
                        SUM(g.monto) AS ejec_nacional
                    FROM gasto g
                    WHERE g.id_proyecto = $1
                    AND g.estado = TRUE
                    GROUP BY g.id_categoria

                )
                SELECT
                    r.id_rubro,
                    r.nombre AS rubro,
                    c.id_categoria,
                    c.nombre AS categoria,
                    COALESCE(pl.costo_unidad, 0) AS costo_unidad,
                    COALESCE(pl.unidades, 0) AS unidades,
                    COALESCE(pl.sol_local, 0) AS sol_local,
                    COALESCE(pl.sol_usd, 0) AS sol_usd,
                    COALESCE(ej.ejec_nacional, 0) AS ejec_nacional
                FROM cats
                INNER JOIN categoria_gasto c
                    ON c.id_categoria = cats.id_categoria
                INNER JOIN rubro r
                    ON r.id_rubro = c.id_rubro
                LEFT JOIN plan pl
                    ON pl.id_categoria = cats.id_categoria
                LEFT JOIN ejec ej
                    ON ej.id_categoria = cats.id_categoria
                ORDER BY
                    r.nombre,
                    c.nombre
                `,
                [idProyecto]
            );


        const rubrosMap = new Map();

        const totales = {
            sol_local: 0,
            sol_usd: 0,
            ejec_nacional: 0,
            ejec_usd: 0
        };


        for (const row of detalle.rows) {

            const solLocal = Number(row.sol_local);
            const solUsd = Number(row.sol_usd);
            const ejecNacional = Number(row.ejec_nacional);
            const ejecUsd = Number((ejecNacional / tipoCambio).toFixed(2));


            if (!rubrosMap.has(row.id_rubro)) {

                rubrosMap.set(row.id_rubro, {
                    id_rubro:
                        row.id_rubro,
                    nombre:
                        row.rubro,
                    subtotal: {
                        sol_local: 0,
                        sol_usd: 0,
                        ejec_nacional: 0,
                        ejec_usd: 0
                    },
                    categorias: []
                });
            }

            const rubro =
                rubrosMap.get(row.id_rubro);


            const categoria = {
                id_categoria:
                    row.id_categoria,
                nombre:
                    row.categoria,
                costo_unidad:
                    Number(Number(row.costo_unidad).toFixed(2)),
                unidades:
                    Number(Number(row.unidades).toFixed(2)),
                sol_local:
                    Number(solLocal.toFixed(2)),
                sol_usd:
                    Number(solUsd.toFixed(2)),
                ejec_nacional:
                    Number(ejecNacional.toFixed(2)),
                ejec_usd:
                    ejecUsd
            };

            rubro.categorias.push(categoria);

            rubro.subtotal.sol_local += solLocal;
            rubro.subtotal.sol_usd += solUsd;
            rubro.subtotal.ejec_nacional += ejecNacional;
            rubro.subtotal.ejec_usd += ejecUsd;

            totales.sol_local += solLocal;
            totales.sol_usd += solUsd;
            totales.ejec_nacional += ejecNacional;
            totales.ejec_usd += ejecUsd;
        }


        const rubros =
            Array.from(rubrosMap.values()).map((rubro) => ({

                id_rubro:
                    rubro.id_rubro,

                nombre:
                    rubro.nombre,

                subtotal: {
                    sol_local:
                        Number(rubro.subtotal.sol_local.toFixed(2)),
                    sol_usd:
                        Number(rubro.subtotal.sol_usd.toFixed(2)),
                    ejec_nacional:
                        Number(rubro.subtotal.ejec_nacional.toFixed(2)),
                    ejec_usd:
                        Number(rubro.subtotal.ejec_usd.toFixed(2))
                },

                categorias:
                    rubro.categorias
            }));


        return res.json({

            proyecto:
                proyecto.rows[0],

            tipo_cambio:
                tipoCambio,

            fecha_tipo_cambio:
                fechaTipoCambio,

            fuente_tipo_cambio:
                fuenteTipoCambio,

            rubros,

            totales: {
                sol_local:
                    Number(totales.sol_local.toFixed(2)),
                sol_usd:
                    Number(totales.sol_usd.toFixed(2)),
                ejec_nacional:
                    Number(totales.ejec_nacional.toFixed(2)),
                ejec_usd:
                    Number(totales.ejec_usd.toFixed(2))
            }

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al generar el reporte comparativo."
        });

    }
}


module.exports = {
    generarReporteComparativo
};
