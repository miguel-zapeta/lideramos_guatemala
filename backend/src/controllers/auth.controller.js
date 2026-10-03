const jwt = require("jsonwebtoken");

const pool =
    require("../config/database");

const {
    comparePassword
} = require("../utils/password");


function createToken(usuario) {

    return jwt.sign(

        {
            id_usuario:
                usuario.id_usuario,

            id_rol:
                usuario.id_rol,

            rol:
                usuario.rol
        },

        process.env.JWT_SECRET,

        {
            expiresIn:
                process.env.JWT_EXPIRES_IN ||
                "1h"
        }

    );
}


async function login(req, res) {

    try {

        const {
            user,
            password
        } = req.body;


        if (!user || !password) {

            return res.status(400).json({
                message:
                    "Usuario y contraseña son obligatorios."
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    u.id_usuario,
                    u.id_rol,
                    u.nombre_usuario,
                    u.nombre,
                    u.apellido,
                    u.correo,
                    u.contrasena,
                    u.estado,

                    r.nombre AS rol

                FROM usuario u

                INNER JOIN rol r
                    ON r.id_rol = u.id_rol

                WHERE u.nombre_usuario = $1

                LIMIT 1
                `,
                [user]
            );


        if (result.rows.length === 0) {

            return res.status(401).json({
                message:
                    "Usuario o contraseña incorrectos."
            });

        }


        const usuario =
            result.rows[0];


        if (!usuario.estado) {

            return res.status(403).json({
                message:
                    "El usuario está inactivo."
            });

        }


        if (!usuario.rol) {

            return res.status(403).json({
                message:
                    "El usuario no tiene un rol válido."
            });

        }


        const passwordCorrecta =
            await comparePassword(
                password,
                usuario.contrasena
            );


        if (!passwordCorrecta) {

            return res.status(401).json({
                message:
                    "Usuario o contraseña incorrectos."
            });

        }


        const token =
            createToken(usuario);


        res.cookie(
            "access_token",
            token,
            {
                httpOnly: true,

                secure:
                    process.env.NODE_ENV ===
                    "production",

                sameSite: "lax",

                maxAge:
                    60 * 60 * 1000,

                path: "/"
            }
        );


        return res.json({

            message:
                "Inicio de sesión exitoso.",

            usuario: {

                id_usuario:
                    usuario.id_usuario,

                nombre_usuario:
                    usuario.nombre_usuario,

                nombre:
                    usuario.nombre,

                apellido:
                    usuario.apellido,

                correo:
                    usuario.correo,

                rol:
                    usuario.rol

            }

        });

    } catch (error) {

        console.error(
            "Error login:",
            error
        );

        return res.status(500).json({
            message:
                "Error interno del servidor."
        });

    }
}


async function me(req, res) {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    u.id_usuario,
                    u.nombre_usuario,
                    u.nombre,
                    u.apellido,
                    u.correo,
                    u.estado,

                    r.id_rol,
                    r.nombre AS rol

                FROM usuario u

                INNER JOIN rol r
                    ON r.id_rol = u.id_rol

                WHERE
                    u.id_usuario = $1
                    AND u.estado = TRUE
                    AND r.estado = TRUE

                LIMIT 1
                `,
                [req.user.id_usuario]
            );


        if (result.rows.length === 0) {

            return res.status(401).json({
                message:
                    "Usuario no encontrado o inactivo."
            });

        }


        const usuario =
            result.rows[0];


        const permisos =
            await pool.query(
                `
                SELECT
                    p.nombre

                FROM rol_permiso rp

                INNER JOIN permiso p
                    ON p.id_permiso = rp.id_permiso

                WHERE
                    rp.id_rol = $1
                    AND p.estado = TRUE

                ORDER BY p.nombre
                `,
                [usuario.id_rol]
            );


        return res.json({

            usuario,

            permisos:
                permisos.rows.map(
                    permiso =>
                        permiso.nombre
                )

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error interno del servidor."
        });

    }
}


async function logout(req, res) {

    res.clearCookie(
        "access_token",
        {
            httpOnly: true,

            secure:
                process.env.NODE_ENV ===
                "production",

            sameSite: "lax",

            path: "/"
        }
    );


    return res.json({
        message:
            "Sesión cerrada correctamente."
    });

}


module.exports = {
    login,
    me,
    logout
};