const zlib = require("zlib");
const path = require("path");
const multer = require("multer");

const pool =
    require("../config/database");

const {
    leerPaginacion,
    construirBusqueda,
    metaPaginacion
} = require("../utils/paginacion");

const {
    compactar
} = require("./archivo.controller");


const PAGINAS_PUBLICAS = new Set([
    "index",
    "quienes",
    "contactanos"
]);


const LIMITE_BYTES = 10 * 1024 * 1024;


const EXTENSIONES_IMAGEN = new Set([
    "jpg", "jpeg", "png", "gif", "webp"
]);


const MIME_IMAGEN = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp"
]);


const MAPA_BUSQUEDA_PUBLICACIONES = {
    titulo: ["p.titulo"],
    contenido: ["p.contenido"],
    todos: [
        "p.titulo",
        "p.contenido"
    ]
};


/*
=========================================
SUBIDA DE IMAGEN (multer, solo imágenes, 10 MB)
=========================================
*/

const subirImagen = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: LIMITE_BYTES,
        files: 1
    },

    fileFilter: (req, file, cb) => {

        const extension =
            path.extname(file.originalname || "")
                .replace(".", "")
                .toLowerCase();


        if (!EXTENSIONES_IMAGEN.has(extension)) {

            const error =
                new Error(
                    `Tipo de imagen no permitido: ${file.originalname}.`
                );

            error.status = 400;

            return cb(error);
        }


        if (
            file.mimetype &&
            !MIME_IMAGEN.has(file.mimetype)
        ) {

            const error =
                new Error(
                    `Tipo de imagen no permitido: ${file.originalname}.`
                );

            error.status = 400;

            return cb(error);
        }


        cb(null, true);
    }
});


function subirImagenMiddleware(
    req,
    res,
    next
) {

    subirImagen.single("imagen")(req, res, (error) => {

        if (!error) {
            return next();
        }


        if (error.status === 400) {

            return res.status(400).json({
                message: error.message
            });
        }


        if (error instanceof multer.MulterError) {

            if (error.code === "LIMIT_FILE_SIZE") {

                return res.status(400).json({
                    message:
                        `La imagen supera el tamaño máximo de ${LIMITE_BYTES / (1024 * 1024)} MB.`
                });
            }


            return res.status(400).json({
                message:
                    error.message ||
                    "Error al procesar la imagen."
            });
        }


        console.error(error);

        return res.status(500).json({
            message:
                "Error al procesar la imagen."
        });
    });
}


/*
=========================================
VALIDACIONES COMUNES
=========================================
*/

function leerPagina(body) {

    const pagina =
        body.pagina !== undefined
            ? String(body.pagina).trim()
            : "";


    if (!PAGINAS_PUBLICAS.has(pagina)) {

        return {
            error:
                "La página debe ser index, quienes o contactanos."
        };
    }


    return { pagina };
}


function leerTitulo(body) {

    const titulo =
        body.titulo !== undefined &&
        String(body.titulo).trim() !== ""
            ? String(body.titulo).trim()
            : null;


    if (
        titulo &&
        titulo.length > 255
    ) {

        return {
            error:
                "El título no puede superar los 255 caracteres."
        };
    }


    return { titulo };
}


function leerContenido(body) {

    const contenido =
        body.contenido !== undefined &&
        String(body.contenido).trim() !== ""
            ? String(body.contenido).trim()
            : null;


    return { contenido };
}


function leerOrden(body) {

    const ordenRaw =
        body.orden !== undefined &&
        String(body.orden).trim() !== ""
            ? body.orden
            : 0;

    const orden =
        Number(ordenRaw);


    if (
        !Number.isInteger(orden) ||
        orden < 0
    ) {

        return {
            error:
                "El orden debe ser un número entero mayor o igual a 0."
        };
    }


    return { orden };
}


async function guardarImagenComoArchivo(
    archivo,
    idUsuario
) {

    const extension =
        path.extname(archivo.originalname || "")
            .replace(".", "")
            .toLowerCase();


    const {
        contenido,
        comprimido,
        tamanoComprimido
    } =
        compactar(archivo.buffer);


    const resultado =
        await pool.query(
            `
            INSERT INTO archivo (
                nombre_archivo,
                tipo_mime,
                extension_,
                tamano_bytes,
                contenido,
                descripcion,
                id_usuario,
                comprimido,
                tamano_comprimido
            )
            VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8)
            RETURNING id_archivo
            `,
            [
                archivo.originalname,
                archivo.mimetype || "image/jpeg",
                extension,
                archivo.size,
                contenido,
                idUsuario,
                comprimido,
                tamanoComprimido
            ]
        );


    return resultado.rows[0].id_archivo;
}


/*
=========================================
CONSULTA PÚBLICA (GET /api/publicaciones/publicas)
=========================================
*/

async function listarPublicas(
    req,
    res
) {

    try {

        const pagina =
            req.query.pagina !== undefined
                ? String(req.query.pagina).trim()
                : "";


        if (!PAGINAS_PUBLICAS.has(pagina)) {

            return res.status(400).json({
                message:
                    "La página debe ser index, quienes o contactanos."
            });
        }


        const result =
            await pool.query(
                `
                SELECT
                    p.id_publicacion,
                    p.pagina,
                    p.titulo,
                    p.contenido,
                    p.orden,
                    (p.id_archivo IS NOT NULL) AS tiene_imagen
                FROM publicacion p
                WHERE p.pagina = $1
                AND p.estado = TRUE
                ORDER BY p.orden, p.id_publicacion
                `,
                [pagina]
            );


        return res.json({
            publicaciones:
                result.rows
        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener publicaciones."
        });

    }
}


/*
=========================================
IMAGEN PÚBLICA (GET /api/publicaciones/:id/imagen)
=========================================
*/

async function obtenerImagen(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de publicación inválido."
            });
        }


        const result =
            await pool.query(
                `
                SELECT
                    a.nombre_archivo,
                    a.tipo_mime,
                    a.contenido,
                    a.comprimido
                FROM publicacion p
                INNER JOIN archivo a
                    ON a.id_archivo = p.id_archivo
                WHERE p.id_publicacion = $1
                LIMIT 1
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Imagen no encontrada."
            });
        }


        const archivo =
            result.rows[0];

        let buffer =
            archivo.contenido;


        if (archivo.comprimido) {

            try {

                buffer =
                    zlib.gunzipSync(buffer);

            } catch (error) {

                console.error(
                    "Error descomprimiendo imagen:",
                    error
                );

                return res.status(500).json({
                    message:
                        "No se pudo descomprimir la imagen."
                });
            }
        }


        res.setHeader(
            "Content-Type",
            archivo.tipo_mime
        );

        res.setHeader(
            "Content-Length",
            buffer.length
        );

        res.setHeader(
            "Content-Disposition",
            "inline"
        );

        res.setHeader(
            "Cache-Control",
            "private, max-age=3600"
        );


        return res.send(buffer);


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener la imagen."
        });

    }
}


/*
=========================================
LISTAR (admin, GET /api/publicaciones)
=========================================
*/

async function listarPublicaciones(
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


        const filtros = [];

        const params = [];


        const paginaFiltro =
            req.query.filtro_pagina !== undefined &&
            String(req.query.filtro_pagina).trim() !== ""
                ? String(req.query.filtro_pagina).trim()
                : null;


        if (paginaFiltro !== null) {

            if (!PAGINAS_PUBLICAS.has(paginaFiltro)) {

                return res.status(400).json({
                    message:
                        "La página debe ser index, quienes o contactanos."
                });
            }

            filtros.push("p.pagina = $" + (params.length + 1));

            params.push(paginaFiltro);
        }


        const { sql: filtroBusqueda, params: paramsBusqueda } =
            construirBusqueda({
                buscar: req.query.buscar,
                campo: req.query.campo,
                mapa: MAPA_BUSQUEDA_PUBLICACIONES,
                inicioParam: params.length + 1
            });


        if (filtroBusqueda) {
            filtros.push(filtroBusqueda);
            params.push(...paramsBusqueda);
        }


        const where =
            filtros.length > 0
                ? `WHERE ${filtros.join(" AND ")}`
                : "";


        const totalResult =
            await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COUNT(*) FILTER (WHERE estado = TRUE)::INTEGER AS activas
                FROM publicacion p
                ${where}
                `,
                params
            );


        const total = totalResult.rows[0].total;
        const activas = totalResult.rows[0].activas;


        const result =
            await pool.query(
                `
                SELECT
                    p.id_publicacion,
                    p.pagina,
                    p.titulo,
                    p.contenido,
                    p.orden,
                    p.estado,
                    p.fecha_creacion,
                    p.id_archivo,
                    p.id_usuario,
                    u.nombre_usuario AS creado_por,
                    a.tipo_mime AS imagen_mime,
                    a.tamano_bytes AS imagen_tamano
                FROM publicacion p
                LEFT JOIN usuario u
                    ON u.id_usuario = p.id_usuario
                LEFT JOIN archivo a
                    ON a.id_archivo = p.id_archivo
                ${where}
                ORDER BY p.pagina, p.orden, p.id_publicacion
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
                `,
                [
                    ...params,
                    paginacion.limite,
                    paginacion.offset
                ]
            );


        return res.json({
            publicaciones:
                result.rows,

            ...metaPaginacion(
                total,
                paginacion.pagina,
                paginacion.limite
            ),

            resumen: {
                total,
                activas,
                ocultas: total - activas
            }
        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener publicaciones."
        });

    }
}


/*
=========================================
CREAR (POST /api/publicaciones)
=========================================
*/

async function crearPublicacion(
    req,
    res
) {

    try {

        const lecturaPagina =
            leerPagina(req.body);

        if (lecturaPagina.error) {

            return res.status(400).json({
                message:
                    lecturaPagina.error
            });
        }


        const lecturaTitulo =
            leerTitulo(req.body);

        if (lecturaTitulo.error) {

            return res.status(400).json({
                message:
                    lecturaTitulo.error
            });
        }


        const lecturaContenido =
            leerContenido(req.body);

        const lecturaOrden =
            leerOrden(req.body);

        if (lecturaOrden.error) {

            return res.status(400).json({
                message:
                    lecturaOrden.error
            });
        }


        const imagen = req.file;


        if (
            !lecturaContenido.contenido &&
            !imagen
        ) {

            return res.status(400).json({
                message:
                    "Debes indicar un texto o adjuntar una imagen."
            });
        }


        let idArchivo = null;


        if (imagen) {

            if (imagen.size === 0) {

                return res.status(400).json({
                    message:
                        "La imagen está vacía."
                });
            }


            idArchivo =
                await guardarImagenComoArchivo(
                    imagen,
                    req.user.id_usuario
                );
        }


        const resultado =
            await pool.query(
                `
                INSERT INTO publicacion (
                    pagina,
                    titulo,
                    contenido,
                    id_archivo,
                    orden,
                    id_usuario
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING
                    id_publicacion,
                    pagina,
                    titulo,
                    contenido,
                    orden,
                    estado,
                    fecha_creacion,
                    id_archivo
                `,
                [
                    lecturaPagina.pagina,
                    lecturaTitulo.titulo,
                    lecturaContenido.contenido,
                    idArchivo,
                    lecturaOrden.orden,
                    req.user.id_usuario
                ]
            );


        const publicacion =
            resultado.rows[0];


        return res.status(201).json({

            message:
                "Publicación creada correctamente.",

            publicacion
        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al crear la publicación."
        });

    }
}


/*
=========================================
EDITAR (PUT /api/publicaciones/:id)
=========================================
*/

async function editarPublicacion(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de publicación inválido."
            });
        }


        const existente =
            await pool.query(
                `
                SELECT
                    id_publicacion,
                    id_archivo
                FROM publicacion
                WHERE id_publicacion = $1
                LIMIT 1
                `,
                [id]
            );


        if (existente.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Publicación no encontrada."
            });
        }


        const idArchivoAnterior =
            existente.rows[0].id_archivo;


        const lecturaPagina =
            leerPagina(req.body);

        if (lecturaPagina.error) {

            return res.status(400).json({
                message:
                    lecturaPagina.error
            });
        }


        const lecturaTitulo =
            leerTitulo(req.body);

        if (lecturaTitulo.error) {

            return res.status(400).json({
                message:
                    lecturaTitulo.error
            });
        }


        const lecturaContenido =
            leerContenido(req.body);

        const lecturaOrden =
            leerOrden(req.body);

        if (lecturaOrden.error) {

            return res.status(400).json({
                message:
                    lecturaOrden.error
            });
        }


        const quitarImagen =
            req.body.quitar_imagen === "1";


        const imagen = req.file;


        const tendraImagen =
            imagen
                ? true
                : (!quitarImagen && idArchivoAnterior !== null);


        if (
            !lecturaContenido.contenido &&
            !tendraImagen
        ) {

            return res.status(400).json({
                message:
                    "La publicación debe conservar un texto o una imagen."
            });
        }


        let idArchivoFinal = idArchivoAnterior;


        if (imagen) {

            idArchivoFinal =
                await guardarImagenComoArchivo(
                    imagen,
                    req.user.id_usuario
                );

        } else if (quitarImagen) {

            idArchivoFinal = null;
        }


        const resultado =
            await pool.query(
                `
                UPDATE publicacion
                SET
                    pagina = $1,
                    titulo = $2,
                    contenido = $3,
                    id_archivo = $4,
                    orden = $5
                WHERE id_publicacion = $6
                RETURNING
                    id_publicacion,
                    pagina,
                    titulo,
                    contenido,
                    orden,
                    estado,
                    fecha_creacion,
                    id_archivo
                `,
                [
                    lecturaPagina.pagina,
                    lecturaTitulo.titulo,
                    lecturaContenido.contenido,
                    idArchivoFinal,
                    lecturaOrden.orden,
                    id
                ]
            );


        if (
            idArchivoAnterior &&
            idArchivoAnterior !== idArchivoFinal
        ) {

            await pool.query(
                `
                DELETE FROM archivo
                WHERE id_archivo = $1
                `,
                [idArchivoAnterior]
            );
        }


        return res.json({

            message:
                "Publicación actualizada correctamente.",

            publicacion:
                resultado.rows[0]
        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al actualizar la publicación."
        });

    }
}


/*
=========================================
CAMBIAR ESTADO (PATCH /api/publicaciones/:id/estado)
=========================================
*/

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
                    "ID de publicación inválido."
            });
        }


        if (typeof estado !== "boolean") {

            return res.status(400).json({
                message:
                    "El estado debe ser booleano."
            });
        }


        const result =
            await pool.query(
                `
                UPDATE publicacion
                SET estado = $1
                WHERE id_publicacion = $2
                RETURNING
                    id_publicacion,
                    estado
                `,
                [estado, id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Publicación no encontrada."
            });
        }


        return res.json({

            message:
                "Estado actualizado correctamente.",

            publicacion:
                result.rows[0]

        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al actualizar el estado."
        });

    }
}


/*
=========================================
ELIMINAR (DELETE /api/publicaciones/:id)
=========================================
*/

async function eliminarPublicacion(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de publicación inválido."
            });
        }


        const result =
            await pool.query(
                `
                DELETE FROM publicacion
                WHERE id_publicacion = $1
                RETURNING id_archivo
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Publicación no encontrada."
            });
        }


        const idArchivo =
            result.rows[0].id_archivo;


        if (idArchivo) {

            await pool.query(
                `
                DELETE FROM archivo
                WHERE id_archivo = $1
                `,
                [idArchivo]
            );
        }


        return res.json({
            message:
                "Publicación eliminada correctamente."
        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al eliminar la publicación."
        });

    }
}


module.exports = {
    subirImagenMiddleware,
    listarPublicas,
    obtenerImagen,
    listarPublicaciones,
    crearPublicacion,
    editarPublicacion,
    cambiarEstado,
    eliminarPublicacion
};
