const pool = require("../config/database");

function requirePermission(
    permisoRequerido
) {

    return async (req, res, next) => {

        try {

            if (!req.user) {

                return res.status(401).json({
                    message: "No autenticado."
                });

            }

            const result =
                await pool.query(
                    `
                    SELECT 1
                    FROM rol_permiso rp

                    INNER JOIN permiso p
                        ON p.id_permiso = rp.id_permiso

                    INNER JOIN rol r
                        ON r.id_rol = rp.id_rol

                    INNER JOIN usuario u
                        ON u.id_usuario = $3

                    WHERE r.id_rol = $1
                    AND p.nombre = $2
                    AND p.estado = TRUE
                    AND r.estado = TRUE
                    AND u.estado = TRUE
                    AND u.id_rol = r.id_rol

                    LIMIT 1
                    `,
                    [
                        req.user.id_rol,
                        permisoRequerido,
                        req.user.id_usuario
                    ]
                );

            if (result.rows.length === 0) {

                return res.status(403).json({
                    message:
                        "No tienes permisos para realizar esta acción."
                });

            }

            next();

        } catch (error) {

            console.error(error);

            return res.status(500).json({
                message:
                    "Error verificando permisos."
            });

        }
    };
}

module.exports =
    requirePermission;