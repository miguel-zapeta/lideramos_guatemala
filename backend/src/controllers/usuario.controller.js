const pool =
    require("../config/database");

const {
    hashPassword,
    validarPassword
} = require("../utils/password");

const {
    leerPaginacion,
    construirBusqueda,
    metaPaginacion
} = require("../utils/paginacion");


const MAPA_BUSQUEDA_USUARIOS = {
    nombre: ["u.nombre"],
    apellido: ["u.apellido"],
    usuario: ["u.nombre_usuario"],
    correo: ["u.correo"],
    rol: ["r.nombre"],
    estado: [
        "CASE WHEN u.estado THEN 'activo' ELSE 'inactivo' END"
    ],
    todos: [
        "u.nombre",
        "u.apellido",
        "u.nombre_usuario",
        "u.correo",
        "r.nombre",
        "CASE WHEN u.estado THEN 'activo' ELSE 'inactivo' END"
    ]
};


async function listarUsuarios(
    req,
    res
) {

    try {

        const paginacion = leerPaginacion(req);

        if (paginacion.error) {

            return res.status(400).json({
                message:
                    paginacion.error
            });

        }


        const exportar =
            req.query.exportar === "1";


        const { sql: filtroBusqueda, params: paramsBusqueda } =
            construirBusqueda({
                buscar: req.query.buscar,
                campo: req.query.campo,
                mapa: MAPA_BUSQUEDA_USUARIOS,
                inicioParam: 1
            });

        const where =
            filtroBusqueda ? `WHERE ${filtroBusqueda}` : "";


        const totalResult =
            await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COUNT(*) FILTER (WHERE u.estado = TRUE)::INTEGER AS activos
                FROM usuario u
                INNER JOIN rol r
                    ON r.id_rol = u.id_rol
                ${where}
                `,
                paramsBusqueda
            );


        const total = totalResult.rows[0].total;

        const activos = totalResult.rows[0].activos;


        const limiteDatos =
            paramsBusqueda.length + 1;

        const offsetDatos =
            paramsBusqueda.length + 2;

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
                    u.id_rol,
                    r.nombre AS rol

                FROM usuario u

                INNER JOIN rol r
                    ON r.id_rol = u.id_rol

                ${where}

                ORDER BY
                    u.id_usuario DESC

                ${exportar ? "" : `LIMIT $${limiteDatos} OFFSET $${offsetDatos}`}
                `,
                exportar
                    ? paramsBusqueda
                    : [
                        ...paramsBusqueda,
                        paginacion.limite,
                        paginacion.offset
                    ]
            );


        return res.json({
            usuarios:
                result.rows,

            ...metaPaginacion(
                total,
                exportar ? 1 : paginacion.pagina,
                exportar ? total : paginacion.limite
            ),

            resumen: {
                total,
                activos,
                inactivos: total - activos
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener usuarios."
        });

    }
}


async function obtenerUsuario(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de usuario inválido."
            });

        }


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
                    u.id_rol,
                    r.nombre AS rol

                FROM usuario u

                INNER JOIN rol r
                    ON r.id_rol = u.id_rol

                WHERE
                    u.id_usuario = $1

                LIMIT 1
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Usuario no encontrado."
            });

        }


        return res.json({
            usuario:
                result.rows[0]
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener usuario."
        });

    }
}


async function crearUsuario(
    req,
    res
) {

    try {

        const {
            id_rol,
            nombre_usuario,
            nombre,
            apellido,
            password,
            correo
        } = req.body;


        if (
            !id_rol ||
            !nombre_usuario ||
            !nombre ||
            !apellido ||
            !password ||
            !correo
        ) {

            return res.status(400).json({
                message:
                    "Todos los campos son obligatorios."
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


        const rol =
            await pool.query(
                `
                SELECT id_rol
                FROM rol
                WHERE
                    id_rol = $1
                    AND estado = TRUE
                `,
                [id_rol]
            );


        if (rol.rows.length === 0) {

            return res.status(400).json({
                message:
                    "El rol seleccionado no existe."
            });

        }


        const passwordHash =
            await hashPassword(
                password
            );


        const result =
            await pool.query(
                `
                INSERT INTO usuario (
                    id_rol,
                    nombre_usuario,
                    nombre,
                    apellido,
                    contrasena,
                    correo
                )

                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5,
                    $6
                )

                RETURNING
                    id_usuario,
                    id_rol,
                    nombre_usuario,
                    nombre,
                    apellido,
                    correo,
                    estado
                `,
                [
                    id_rol,
                    nombre_usuario,
                    nombre,
                    apellido,
                    passwordHash,
                    correo
                ]
            );


        return res.status(201).json({

            message:
                "Usuario creado correctamente.",

            usuario:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);


        if (
            error.code === "23505"
        ) {

            return res.status(409).json({
                message:
                    "El nombre de usuario o correo ya está registrado."
            });

        }


        return res.status(500).json({
            message:
                "Error al crear usuario."
        });

    }
}


async function editarUsuario(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID inválido."
            });

        }


        const {
            id_rol,
            nombre_usuario,
            nombre,
            apellido,
            correo,
            estado,
            password
        } = req.body;


        let passwordHash = null;

        if (
            password !== undefined &&
            password !== null &&
            password !== ""
        ) {

            const claveValida =
                validarPassword(password);


            if (!claveValida.valida) {

                return res.status(400).json({
                    message:
                        claveValida.message
                });

            }

            passwordHash =
                await hashPassword(
                    password
                );
        }


        const result =
            await pool.query(
                `
                UPDATE usuario

                SET
                    id_rol = $1,
                    nombre_usuario = $2,
                    nombre = $3,
                    apellido = $4,
                    correo = $5,
                    estado = $6,
                    contrasena = COALESCE($7, contrasena)

                WHERE
                    id_usuario = $8

                RETURNING
                    id_usuario,
                    id_rol,
                    nombre_usuario,
                    nombre,
                    apellido,
                    correo,
                    estado
                `,
                [
                    id_rol,
                    nombre_usuario,
                    nombre,
                    apellido,
                    correo,
                    estado,
                    passwordHash,
                    id
                ]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Usuario no encontrado."
            });

        }


        return res.json({

            message:
                "Usuario actualizado correctamente.",

            usuario:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);


        if (
            error.code === "23505"
        ) {

            return res.status(409).json({
                message:
                    "El nombre de usuario o correo ya existe."
            });

        }


        return res.status(500).json({
            message:
                "Error al actualizar usuario."
        });

    }
}


async function cambiarEstado(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);

        const {
            estado
        } = req.body;


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID inválido."
            });

        }


        if (
            typeof estado !==
            "boolean"
        ) {

            return res.status(400).json({
                message:
                    "El estado debe ser booleano."
            });

        }


        const result =
            await pool.query(
                `
                UPDATE usuario

                SET estado = $1

                WHERE id_usuario = $2

                RETURNING
                    id_usuario,
                    estado
                `,
                [
                    estado,
                    id
                ]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Usuario no encontrado."
            });

        }


        return res.json({

            message:
                "Estado actualizado correctamente.",

            usuario:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al actualizar estado."
        });

    }
}


module.exports = {
    listarUsuarios,
    obtenerUsuario,
    crearUsuario,
    editarUsuario,
    cambiarEstado
};