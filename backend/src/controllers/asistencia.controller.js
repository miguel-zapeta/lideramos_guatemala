const pool =
    require("../config/database");


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
                `,
                [idActividad]
            );


        return res.json({
            asistencia:
                result.rows
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
    quitarAsistencia
};
