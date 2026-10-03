const pool =
    require("../config/database");


async function listarRoles(
    req,
    res
) {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    id_rol,
                    nombre
                FROM rol
                WHERE estado = TRUE
                ORDER BY nombre
                `
            );


        return res.json({
            roles:
                result.rows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener roles."
        });

    }
}


module.exports = {
    listarRoles
};
