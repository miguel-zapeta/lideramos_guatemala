const crypto = require("crypto");

const jwt = require("jsonwebtoken");

const pool =
    require("../config/database");

const {
    comparePassword,
    hashPassword,
    validarPassword
} = require("../utils/password");

const {
    sendMail
} = require("../utils/mailer");


const RESET_TOKEN_MINUTES = 15;


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
    logout,
    solicitarRecuperacionPassword,
    solicitarRecuperacionUsuario,
    restablecerPassword
};


function hashToken(token) {

    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

}


function baseUrl() {

    return (
        process.env.FRONTEND_URL ||
        "http://localhost:3000"
    );

}


async function solicitarRecuperacionPassword(req, res) {

    try {

        const { user } = req.body;


        if (!user || typeof user !== "string") {

            return res.status(400).json({
                message:
                    "El usuario es obligatorio."
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    id_usuario,
                    nombre_usuario,
                    correo
                FROM usuario
                WHERE nombre_usuario = $1
                    AND estado = TRUE
                LIMIT 1
                `,
                [user.trim()]
            );


        /*
        Respuesta genérica siempre
        para no revelar si el
        usuario existe.
        */

        if (result.rows.length === 0) {

            return res.json({
                message:
                    "Si el usuario existe, se envió un correo con instrucciones."
            });

        }


        const usuario =
            result.rows[0];


        const token =
            crypto.randomBytes(32).toString("hex");

        const tokenHash =
            hashToken(token);

        const expiraEn =
            new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);


        await pool.query(
            `
            INSERT INTO password_reset_token
                (id_usuario, token_hash, expira_en)
            VALUES ($1, $2, $3)
            `,
            [usuario.id_usuario, tokenHash, expiraEn]
        );


        const enlace =
            `${baseUrl()}/restablecer.html?token=${token}`;


        try {

            await sendMail({
                to: usuario.correo,
                subject: "Restablece tu contraseña — Lideramos",
                text:
                    `Hola ${usuario.nombre_usuario}.\n\n` +
                    `Solicitaste restablecer tu contraseña. Usa este enlace (válido por 15 minutos):\n` +
                    `${enlace}\n\n` +
                    `Si no fuiste tú, ignora este correo.`,
                html:
                    `<p>Hola <strong>${usuario.nombre_usuario}</strong>.</p>` +
                    `<p>Solicitaste restablecer tu contraseña. Haz clic en el enlace (válido por 15 minutos):</p>` +
                    `<p><a href="${enlace}">Restablecer contraseña</a></p>` +
                    `<p>Si no fuiste tú, ignora este correo.</p>`
            });

        } catch (error) {

            console.error(
                "Error enviando correo de recuperación:",
                error
            );

            if (
                error.message ===
                "Servicio de correo no configurado."
            ) {

                return res.status(500).json({
                    message:
                        "Servicio de correo no configurado. Contacta al administrador."
                });

            }

            return res.status(502).json({
                message:
                    "No se pudo enviar el correo. Intenta más tarde."
            });

        }


        return res.json({
            message:
                "Si el usuario existe, se envió un correo con instrucciones."
        });

    } catch (error) {

        console.error(
            "Error recuperar-password:",
            error
        );

        return res.status(500).json({
            message:
                "Error interno del servidor."
        });

    }

}


async function solicitarRecuperacionUsuario(req, res) {

    try {

        const { correo } = req.body;


        if (!correo || typeof correo !== "string") {

            return res.status(400).json({
                message:
                    "El correo es obligatorio."
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    nombre_usuario,
                    correo
                FROM usuario
                WHERE LOWER(correo) = LOWER($1)
                    AND estado = TRUE
                LIMIT 1
                `,
                [correo.trim()]
            );


        if (result.rows.length === 0) {

            try {

                await sendMail({
                    to: correo.trim(),
                    subject: "Recuperación de usuario — Lideramos",
                    text:
                        "No existe un usuario asociado a este correo.\n\n" +
                        "Si crees que es un error, contacta al administrador.",
                    html:
                        "<p>No existe un usuario asociado a este correo.</p>" +
                        "<p>Si crees que es un error, contacta al administrador.</p>"
                });

            } catch (error) {

                console.error(
                    "Error enviando correo de usuario inexistente:",
                    error
                );

            }


            return res.json({
                message:
                    "Si el correo existe, se envió la información."
            });

        }


        const usuario =
            result.rows[0];


        try {

            await sendMail({
                to: usuario.correo,
                subject: "Tu usuario — Lideramos",
                text:
                    `Tu nombre de usuario es: ${usuario.nombre_usuario}\n\n` +
                    `Úsalo para iniciar sesión.`,
                html:
                    `<p>Tu nombre de usuario es: <strong>${usuario.nombre_usuario}</strong></p>` +
                    `<p>Úsalo para iniciar sesión.</p>`
            });

        } catch (error) {

            console.error(
                "Error enviando correo de recuperación de usuario:",
                error
            );

            if (
                error.message ===
                "Servicio de correo no configurado."
            ) {

                return res.status(500).json({
                    message:
                        "Servicio de correo no configurado. Contacta al administrador."
                });

            }

            return res.status(502).json({
                message:
                    "No se pudo enviar el correo. Intenta más tarde."
            });

        }


        return res.json({
            message:
                "Si el correo existe, se envió la información."
        });

    } catch (error) {

        console.error(
            "Error recuperar-usuario:",
            error
        );

        return res.status(500).json({
            message:
                "Error interno del servidor."
        });

    }

}


async function restablecerPassword(req, res) {

    try {

        const { token, password } = req.body;


        if (!token || typeof token !== "string") {

            return res.status(400).json({
                message:
                    "El token es obligatorio."
            });

        }


        if (!password || typeof password !== "string") {

            return res.status(400).json({
                message:
                    "La contraseña es obligatoria."
            });

        }


        const claveValida =
            validarPassword(password);


        if (!claveValida.valida) {

            return res.status(400).json({
                message:
                    claveValida.message
            });

        }


        const tokenHash =
            hashToken(token);


        const result =
            await pool.query(
                `
                SELECT
                    id_token,
                    id_usuario,
                    expira_en,
                    usado
                FROM password_reset_token
                WHERE token_hash = $1
                LIMIT 1
                `,
                [tokenHash]
            );


        if (result.rows.length === 0) {

            return res.status(400).json({
                message:
                    "El enlace es inválido o expiró."
            });

        }


        const registro =
            result.rows[0];


        if (registro.usado || new Date(registro.expira_en) < new Date()) {

            return res.status(400).json({
                message:
                    "El enlace es inválido o expiró."
            });

        }


        const nuevaHash =
            await hashPassword(password);


        await pool.query(
            `
            UPDATE usuario
            SET contrasena = $1
            WHERE id_usuario = $2
                AND estado = TRUE
            `,
            [nuevaHash, registro.id_usuario]
        );


        await pool.query(
            `
            UPDATE password_reset_token
            SET usado = TRUE
            WHERE id_usuario = $1
            `,
            [registro.id_usuario]
        );


        return res.json({
            message:
                "Contraseña restablecida correctamente."
        });

    } catch (error) {

        console.error(
            "Error restablecer-password:",
            error
        );

        return res.status(500).json({
            message:
                "Error interno del servidor."
        });

    }

}