const jwt = require("jsonwebtoken");

const pool =
    require("../config/database");


// Primera página disponible según los permisos del rol.
// Orden de preferencia del panel.
const PAGINAS_POR_PERMISO = [
    ["usuarios.ver", "/usuarios.html"],
    ["voluntarios.ver", "/voluntarios.html"],
    ["finanzas.ver", "/finanzas.html"],
    ["proyectos.ver", "/proyectos.html"],
    ["actividades.ver", "/actividades.html"]
];


function requirePagePermission(
    permisoRequerido
) {

    return async (req, res, next) => {

        const token = req.cookies.access_token;

        if (!token) {
            return res.redirect("/login.html");
        }

        let decoded;

        try {

            decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );

        } catch (error) {

            return res.redirect("/login.html");
        }


        try {

            const result =
                await pool.query(
                    `
                    SELECT p.nombre
                    FROM rol_permiso rp

                    INNER JOIN permiso p
                        ON p.id_permiso = rp.id_permiso

                    INNER JOIN rol r
                        ON r.id_rol = rp.id_rol

                    WHERE r.id_rol = $1
                    AND p.estado = TRUE
                    AND r.estado = TRUE
                    `,
                    [decoded.id_rol]
                );

            const permisos = result.rows.map(
                (row) => row.nombre
            );

            req.user = decoded;


            if (permisos.includes(permisoRequerido)) {
                return next();
            }


            for (const [permiso, pagina] of PAGINAS_POR_PERMISO) {

                if (permisos.includes(permiso)) {
                    return res.redirect(pagina);
                }
            }


            return res.redirect("/login.html");

        } catch (error) {

            console.error(error);

            return res.redirect("/login.html");
        }
    };
}


module.exports =
    requirePagePermission;
