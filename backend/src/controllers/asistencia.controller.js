const pool =
    require("../config/database");

const {
    leerPaginacion,
    metaPaginacion
} = require("../utils/paginacion");


async function proyectoFinalizadoPorActividad(idActividad) {

    const result =
        await pool.query(
            `
            SELECT pr.estado
            FROM actividad a
            INNER JOIN proyecto pr
                ON pr.id_proyecto = a.id_proyecto
            WHERE a.id_actividad = $1
            LIMIT 1
            `,
            [idActividad]
        );

    if (result.rows.length === 0) {
        return null;
    }

    return result.rows[0].estado === "finalizado";
}


async function listarAsistencia(
    req,
    res
) {

    try {

        const idActividad =
            Number(req.query.id_actividad);


        if (!Number.isInteger(idActividad)) {

            return res.status(400).json({
                message:
                    "El parámetro id_actividad es obligatorio y debe ser un ID válido."
            });

        }


        const paginacion = leerPaginacion(req);

        if (paginacion.error) {

            return res.status(400).json({
                message:
                    paginacion.error
            });

        }


        // ?todos=1 devuelve el conjunto completo (sin LIMIT),
        // para el checklist de asistencia.
        const todos =
            req.query.todos === "1";


        const totalResult =
            await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total
                FROM asistencia a
                INNER JOIN persona p
                    ON p.id_persona = a.id_persona
                WHERE a.id_actividad = $1
                `,
                [idActividad]
            );


        const total = totalResult.rows[0].total;


        const result =
            await pool.query(
                `
                SELECT
                    a.id_persona,
                    p.nombres,
                    p.apellidos
                FROM asistencia a
                INNER JOIN persona p
                    ON p.id_persona = a.id_persona
                WHERE a.id_actividad = $1
                ORDER BY p.apellidos, p.nombres

                ${todos ? "" : "LIMIT $2 OFFSET $3"}
                `,
                todos
                    ? [idActividad]
                    : [
                        idActividad,
                        paginacion.limite,
                        paginacion.offset
                    ]
            );


        return res.json({
            asistencia:
                result.rows,

            ...metaPaginacion(
                total,
                todos ? 1 : paginacion.pagina,
                todos ? Math.max(total, 1) : paginacion.limite
            )
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener asistencia."
        });

    }
}


async function marcarAsistencia(
    req,
    res
) {

    try {

        const idActividad = Number(req.body.id_actividad);
        const idPersona = Number(req.body.id_persona);


        if (!Number.isInteger(idActividad) || !Number.isInteger(idPersona)) {

            return res.status(400).json({
                message:
                    "id_actividad e id_persona son obligatorios y deben ser IDs válidos."
            });

        }


        const finalizado = await proyectoFinalizadoPorActividad(idActividad);

        if (finalizado === null) {

            return res.status(400).json({
                message:
                    "La actividad indicada no existe."
            });

        }

        if (finalizado) {

            return res.status(403).json({
                message:
                    "El proyecto está finalizado y ya no se puede modificar."
            });

        }


        try {

            const result =
                await pool.query(
                    `
                    INSERT INTO asistencia (
                        id_actividad,
                        id_persona
                    )
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                    RETURNING
                        id_actividad,
                        id_persona
                    `,
                    [idActividad, idPersona]
                );


            if (result.rows.length === 0) {

                return res.json({
                    message:
                        "La persona ya estaba marcada como asistente."
                });

            }


            return res.status(201).json({

                message:
                    "Asistencia registrada correctamente.",

                asistencia:
                    result.rows[0]

            });

        } catch (dbError) {

            if (dbError.code === "23503") {

                return res.status(400).json({
                    message:
                        "La actividad o la persona indicada no existe."
                });

            }

            throw dbError;
        }

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al registrar asistencia."
        });

    }
}


/*
REEMPLAZAR ASISTENCIA (PUT /api/asistencias/:id_actividad)
Guarda el conjunto completo de asistentes marcados:
inserta los que faltan y elimina los que ya no están.
*/

async function reemplazarAsistencia(
    req,
    res
) {

    try {

        const idActividad =
            Number(req.params.id_actividad);

        const idPersonas =
            req.body.id_personas;


        if (!Number.isInteger(idActividad)) {

            return res.status(400).json({
                message:
                    "ID de actividad inválido."
            });

        }


        if (!Array.isArray(idPersonas)) {

            return res.status(400).json({
                message:
                    "id_personas debe ser una lista de IDs válidos."
            });

        }


        const personas = [];

        for (const valor of idPersonas) {

            const n = Number(valor);

            if (!Number.isInteger(n)) {

                return res.status(400).json({
                    message:
                        "id_personas debe ser una lista de IDs válidos."
                });
            }

            personas.push(n);
        }


        const unicos =
            [...new Set(personas)];


        const finalizado =
            await proyectoFinalizadoPorActividad(idActividad);

        if (finalizado === null) {

            return res.status(400).json({
                message:
                    "La actividad indicada no existe."
            });

        }

        if (finalizado) {

            return res.status(403).json({
                message:
                    "El proyecto está finalizado y ya no se puede modificar."
            });

        }


        // Se elimina lo que ya no está marcado...
        await pool.query(
            `
            DELETE FROM asistencia
            WHERE id_actividad = $1
                AND NOT (id_persona = ANY($2::int[]))
            `,
            [idActividad, unicos]
        );


        // ...y se agregan las marcas nuevas.
        if (unicos.length > 0) {

            try {

                await pool.query(
                    `
                    INSERT INTO asistencia (id_actividad, id_persona)
                    SELECT $1, unnest($2::int[])
                    ON CONFLICT DO NOTHING
                    `,
                    [idActividad, unicos]
                );

            } catch (dbError) {

                if (dbError.code === "23503") {

                    return res.status(400).json({
                        message:
                            "La actividad o la persona indicada no existe."
                    });
                }

                throw dbError;
            }
        }


        return res.json({

            message:
                "Asistencia guardada correctamente.",

            total:
                unicos.length

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al guardar la asistencia."
        });

    }
}


async function quitarAsistencia(
    req,
    res
) {

    try {

        const idActividad =
            Number(req.params.id_actividad);

        const idPersona =
            Number(req.params.id_persona);


        if (!Number.isInteger(idActividad) || !Number.isInteger(idPersona)) {

            return res.status(400).json({
                message:
                    "IDs de actividad y persona inválidos."
            });

        }


        const finalizado = await proyectoFinalizadoPorActividad(idActividad);

        if (finalizado === null) {

            return res.status(404).json({
                message:
                    "Asistencia no encontrada."
            });

        }

        if (finalizado) {

            return res.status(403).json({
                message:
                    "El proyecto está finalizado y ya no se puede modificar."
            });

        }


        const result =
            await pool.query(
                `
                DELETE FROM asistencia
                WHERE id_actividad = $1
                AND id_persona = $2
                RETURNING
                    id_actividad,
                    id_persona
                `,
                [idActividad, idPersona]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Asistencia no encontrada."
            });

        }


        return res.json({
            message:
                "Asistencia eliminada correctamente."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al eliminar asistencia."
        });

    }
}


module.exports = {
    listarAsistencia,
    marcarAsistencia,
    reemplazarAsistencia,
    quitarAsistencia
};
