const pool =
    require("../config/database");


async function generarReporteMensual(
    req,
    res
) {

    try {

        const idProyecto =
            Number(req.query.id_proyecto);

        const mes = req.query.mes;


        if (!Number.isInteger(idProyecto)) {

            return res.status(400).json({
                message:
                    "El proyecto es obligatorio y debe ser un ID válido."
            });
        }


        if (
            typeof mes !== "string" ||
            !/^\d{4}-\d{2}$/.test(mes)
        ) {

            return res.status(400).json({
                message:
                    "El mes es obligatorio con formato AAAA-MM."
            });
        }


        const mesNumero = Number(mes.slice(5, 7));

        if (mesNumero < 1 || mesNumero > 12) {

            return res.status(400).json({
                message:
                    "El mes debe estar entre 01 y 12."
            });
        }


        const primerDia = `${mes}-01`;


        const proyecto =
            await pool.query(
                `
                SELECT
                    id_proyecto,
                    nombre,
                    fecha_inicio,
                    fecha_finalizacion,
                    ente_patrocinador,
                    asociacion_gestora
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
                SELECT
                    r.id_rubro,
                    r.nombre AS rubro,
                    c.id_categoria,
                    c.nombre AS categoria,
                    COALESCE(SUM(g.monto), 0) AS subtotal
                FROM categoria_gasto c
                INNER JOIN rubro r
                    ON r.id_rubro = c.id_rubro
                LEFT JOIN gasto g
                    ON g.id_categoria = c.id_categoria
                    AND g.id_proyecto = $1
                    AND g.estado = TRUE
                    AND g.fecha >= $2::date
                    AND g.fecha < ($2::date + INTERVAL '1 month')
                WHERE c.id_categoria IN (
                    SELECT DISTINCT g2.id_categoria
                    FROM gasto g2
                    WHERE g2.id_proyecto = $1
                    AND g2.estado = TRUE
                )
                GROUP BY
                    r.id_rubro,
                    r.nombre,
                    c.id_categoria,
                    c.nombre
                ORDER BY
                    r.nombre,
                    c.nombre
                `,
                [
                    idProyecto,
                    primerDia
                ]
            );


        const rubrosMap = new Map();

        let totalGeneral = 0;


        for (const row of detalle.rows) {

            const subtotal = Number(row.subtotal);

            if (!rubrosMap.has(row.id_rubro)) {

                rubrosMap.set(row.id_rubro, {
                    id_rubro:
                        row.id_rubro,
                    nombre:
                        row.rubro,
                    total:
                        0,
                    categorias:
                        []
                });

            }

            const rubro =
                rubrosMap.get(row.id_rubro);

            rubro.total += subtotal;

            rubro.categorias.push({
                id_categoria:
                    row.id_categoria,
                nombre:
                    row.categoria,
                subtotal
            });

            totalGeneral += subtotal;
        }


        const rubros =
            Array.from(rubrosMap.values()).map(
                (rubro) => ({

                    id_rubro:
                        rubro.id_rubro,

                    nombre:
                        rubro.nombre,

                    total:
                        Number(rubro.total.toFixed(2)),

                    categorias:
                        rubro.categorias
                })
            );


        return res.json({

            proyecto:
                proyecto.rows[0],

            mes,

            rubros,

            total_general:
                Number(totalGeneral.toFixed(2))

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al generar el reporte mensual."
        });

    }
}


const MAX_MESES = 24;


function esMesValido(valor) {

    return (
        typeof valor === "string" &&
        /^\d{4}-\d{2}$/.test(valor) &&
        Number(valor.slice(5, 7)) >= 1 &&
        Number(valor.slice(5, 7)) <= 12
    );
}


function mesSiguiente(mes) {

    let anio = Number(mes.slice(0, 4));
    let numero = Number(mes.slice(5, 7)) + 1;

    if (numero > 12) {
        numero = 1;
        anio += 1;
    }

    return `${anio}-${String(numero).padStart(2, "0")}`;
}


function mesesEnRango(inicio, fin) {

    const meses = [];

    let actual = inicio;

    while (
        actual <= fin &&
        meses.length < MAX_MESES
    ) {
        meses.push(actual);
        actual = mesSiguiente(actual);
    }

    return meses;
}


async function generarReporteAcumulativo(
    req,
    res
) {

    try {

        const idProyecto =
            Number(req.query.id_proyecto);

        const inicio =
            req.query.inicio;

        const fin =
            req.query.fin;


        if (!Number.isInteger(idProyecto)) {

            return res.status(400).json({
                message:
                    "El proyecto es obligatorio y debe ser un ID válido."
            });
        }


        if (
            !esMesValido(inicio) ||
            !esMesValido(fin)
        ) {

            return res.status(400).json({
                message:
                    "El periodo es obligatorio: inicio y fin con formato AAAA-MM."
            });
        }


        const cantidadMeses =
            (Number(fin.slice(0, 4)) - Number(inicio.slice(0, 4))) * 12 +
            (Number(fin.slice(5, 7)) - Number(inicio.slice(5, 7))) + 1;


        if (cantidadMeses < 1) {

            return res.status(400).json({
                message:
                    "El mes de fin no puede ser anterior al mes de inicio."
            });
        }


        if (cantidadMeses > MAX_MESES) {

            return res.status(400).json({
                message:
                    `El periodo no puede exceder ${MAX_MESES} meses.`
            });
        }


        const meses =
            mesesEnRango(inicio, fin);


        const primerDia =
            `${inicio}-01`;

        const finExclusivo =
            `${mesSiguiente(fin)}-01`;


        const proyecto =
            await pool.query(
                `
                SELECT
                    id_proyecto,
                    nombre,
                    fecha_inicio,
                    fecha_finalizacion,
                    ente_patrocinador,
                    asociacion_gestora,
                    COALESCE((
                        SELECT SUM(pp.subvencion_moneda_nacional)
                        FROM proyecto_patrocinador pp
                        WHERE pp.id_proyecto = proyecto.id_proyecto
                            AND pp.estado = TRUE
                    ), 0) AS subvencion_local
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
                SELECT
                    r.id_rubro,
                    r.nombre AS rubro,
                    c.id_categoria,
                    c.nombre AS categoria,
                    TO_CHAR(g.fecha, 'YYYY-MM') AS mes,
                    COALESCE(SUM(g.monto), 0) AS subtotal
                FROM categoria_gasto c
                INNER JOIN rubro r
                    ON r.id_rubro = c.id_rubro
                LEFT JOIN gasto g
                    ON g.id_categoria = c.id_categoria
                    AND g.id_proyecto = $1
                    AND g.estado = TRUE
                    AND g.fecha >= $2::date
                    AND g.fecha < $3::date
                WHERE c.id_categoria IN (
                    SELECT DISTINCT g2.id_categoria
                    FROM gasto g2
                    WHERE g2.id_proyecto = $1
                    AND g2.estado = TRUE
                )
                GROUP BY
                    r.id_rubro,
                    r.nombre,
                    c.id_categoria,
                    c.nombre,
                    TO_CHAR(g.fecha, 'YYYY-MM')
                ORDER BY
                    r.nombre,
                    c.nombre
                `,
                [
                    idProyecto,
                    primerDia,
                    finExclusivo
                ]
            );


        const rubrosMap = new Map();

        const totalesMes = {};

        for (const mes of meses) {
            totalesMes[mes] = 0;
        }

        let totalGeneral = 0;


        for (const row of detalle.rows) {

            if (!rubrosMap.has(row.id_rubro)) {

                rubrosMap.set(row.id_rubro, {
                    id_rubro:
                        row.id_rubro,
                    nombre:
                        row.rubro,
                    total:
                        0,
                    categorias:
                        []
                });
            }

            const rubro =
                rubrosMap.get(row.id_rubro);


            let categoria =
                rubro.categorias.find(
                    (c) => c.id_categoria === row.id_categoria
                );

            if (!categoria) {

                categoria = {
                    id_categoria:
                        row.id_categoria,
                    nombre:
                        row.categoria,
                    meses: {},
                    total:
                        0
                };

                rubro.categorias.push(categoria);
            }


            // Fila sin mes = categoría del proyecto sin gastos en el periodo.
            if (!row.mes) {
                continue;
            }


            const subtotal = Number(row.subtotal);

            categoria.meses[row.mes] =
                (categoria.meses[row.mes] || 0) + subtotal;

            categoria.total += subtotal;

            rubro.total += subtotal;

            totalesMes[row.mes] =
                (totalesMes[row.mes] || 0) + subtotal;

            totalGeneral += subtotal;
        }


        const rubros =
            Array.from(rubrosMap.values()).map((rubro) => {

                for (const categoria of rubro.categorias) {

                    for (const mes of meses) {

                        if (
                            categoria.meses[mes] === undefined
                        ) {
                            categoria.meses[mes] = 0;
                        }
                    }

                    categoria.total = Number(categoria.total.toFixed(2));
                }

                return {
                    id_rubro:
                        rubro.id_rubro,
                    nombre:
                        rubro.nombre,
                    total:
                        Number(rubro.total.toFixed(2)),
                    categorias:
                        rubro.categorias
                };
            });


        const totales_mes = {};

        for (const mes of meses) {
            totales_mes[mes] =
                Number((totalesMes[mes] || 0).toFixed(2));
        }


        const subvencionLocal =
            Number(proyecto.rows[0].subvencion_local || 0);


        return res.json({

            proyecto:
                proyecto.rows[0],

            meses,

            rubros,

            totales_mes,

            total_general:
                Number(totalGeneral.toFixed(2)),

            subvencion_local:
                subvencionLocal,

            saldo:
                Number((subvencionLocal - totalGeneral).toFixed(2))

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al generar el reporte acumulativo."
        });

    }
}


module.exports = {
    generarReporteMensual,
    generarReporteAcumulativo
};
