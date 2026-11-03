const pool =
    require("../config/database");


/*
Actualiza el ente patrocinador del proyecto con los
nombres de los donantes activos (proyecto_patrocinador).

Los totales financieros ya NO se guardan en proyecto:
se calculan como SUMA de las filas de donantes en las
consultas de reportes y exportaciones.
*/

async function actualizarEntePatrocinador(idProyecto) {

    await pool.query(
        `
        UPDATE proyecto p
        SET ente_patrocinador = tot.donantes
        FROM (
            SELECT
                STRING_AGG(pa.nombre_razon_social, ', '
                    ORDER BY pp.id_proyecto_patrocinador) AS donantes
            FROM proyecto_patrocinador pp
            INNER JOIN patrocinador pa
                ON pa.id_patrocinador = pp.id_patrocinador
            WHERE pp.id_proyecto = $1
                AND pp.estado = TRUE
        ) tot
        WHERE p.id_proyecto = $1
        `,
        [idProyecto]
    );
}


module.exports = {
    actualizarEntePatrocinador
};
