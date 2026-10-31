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


const LIMITE_BYTES = 10 * 1024 * 1024;

const MAX_ARCHIVOS_PETICION = 10;


const EXTENSIONES_PERMITIDAS = new Set([
    "jpg", "jpeg", "png", "gif", "webp",
    "pdf",
    "doc", "docx",
    "xls", "xlsx",
    "csv", "txt",
    "zip"
]);


const MIME_PERMITIDOS = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "text/plain",
    "application/zip",
    "application/x-zip-compressed",
    "application/octet-stream"
]);


const MAPA_BUSQUEDA_ARCHIVOS = {
    nombre: ["a.nombre_archivo"],
    descripcion: ["a.descripcion"],
    todos: [
        "a.nombre_archivo",
        "a.descripcion"
    ]
};


/*
=========================================
SUBIDA (multer en memoria, 10 MB, 10 archivos)
=========================================
*/

const subirArchivos = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: LIMITE_BYTES,
        files: MAX_ARCHIVOS_PETICION
    },

    fileFilter: (req, file, cb) => {

        const extension =
            path.extname(file.originalname || "")
                .replace(".", "")
                .toLowerCase();


        if (!EXTENSIONES_PERMITIDAS.has(extension)) {

            const error =
                new Error(
                    `Tipo de archivo no permitido: ${file.originalname}.`
                );

            error.status = 400;

            return cb(error);
        }


        if (
            file.mimetype &&
            !MIME_PERMITIDOS.has(file.mimetype)
        ) {

            const error =
                new Error(
                    `Tipo de archivo no permitido: ${file.originalname}.`
                );

            error.status = 400;

            return cb(error);
        }


        cb(null, true);
    }
});


function subirArchivosMiddleware(
    req,
    res,
    next
) {

    subirArchivos.array(
        "archivos",
        MAX_ARCHIVOS_PETICION
    )(req, res, (error) => {

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
                        `Un archivo supera el tamaño máximo de ${LIMITE_BYTES / (1024 * 1024)} MB.`
                });
            }


            if (error.code === "LIMIT_FILE_COUNT") {

                return res.status(400).json({
                    message:
                        `Puedes subir hasta ${MAX_ARCHIVOS_PETICION} archivos por vez.`
                });
            }


            return res.status(400).json({
                message:
                    error.message ||
                    "Error al procesar los archivos."
            });
        }


        console.error(error);

        return res.status(500).json({
            message:
                "Error al procesar los archivos."
        });
    });
}


/*
=========================================
COMPACTACIÓN
gzip nativo; solo se guarda comprimido
si el resultado es más pequeño.
=========================================
*/

function compactar(buffer) {

    try {

        const comprimido =
            zlib.gzipSync(buffer, { level: 6 });


        if (comprimido.length < buffer.length) {

            return {
                contenido: comprimido,
                comprimido: true,
                tamanoComprimido: comprimido.length
            };
        }

    } catch (error) {

        console.error(
            "Error compactando archivo:",
            error
        );
    }


    return {
        contenido: buffer,
        comprimido: false,
        tamanoComprimido: null
    };
}


async function existeProyecto(id) {

    const result =
        await pool.query(
            `
            SELECT id_proyecto
            FROM proyecto
            WHERE id_proyecto = $1
            LIMIT 1
            `,
            [id]
        );

    return result.rows.length > 0;
}


async function existeActividad(id) {

    const result =
        await pool.query(
            `
            SELECT id_actividad
            FROM actividad
            WHERE id_actividad = $1
            LIMIT 1
            `,
            [id]
        );

    return result.rows.length > 0;
}


/*
=========================================
SUBIR ARCHIVOS (POST /api/archivos)
=========================================
*/

async function guardarArchivos(
    req,
    res
) {

    try {

        const archivos =
            req.files || [];


        if (archivos.length === 0) {

            return res.status(400).json({
                message:
                    "Debes adjuntar al menos un archivo."
            });
        }


        const {
            id_proyecto,
            id_actividad,
            descripcion
        } = req.body;


        const idProyecto =
            id_proyecto !== undefined &&
            id_proyecto !== null &&
            String(id_proyecto).trim() !== ""
                ? Number(id_proyecto)
                : null;

        const idActividad =
            id_actividad !== undefined &&
            id_actividad !== null &&
            String(id_actividad).trim() !== ""
                ? Number(id_actividad)
                : null;


        if (
            idProyecto !== null &&
            !Number.isInteger(idProyecto)
        ) {

            return res.status(400).json({
                message:
                    "El proyecto indicado es inválido."
            });
        }


        if (
            idActividad !== null &&
            !Number.isInteger(idActividad)
        ) {

            return res.status(400).json({
                message:
                    "La actividad indicada es inválida."
            });
        }


        if (
            idProyecto !== null &&
            !(await existeProyecto(idProyecto))
        ) {

            return res.status(400).json({
                message:
                    "El proyecto indicado no existe."
            });
        }


        if (
            idActividad !== null &&
            !(await existeActividad(idActividad))
        ) {

            return res.status(400).json({
                message:
                    "La actividad indicada no existe."
            });
        }


        const descripcionLimpia =
            descripcion &&
            String(descripcion).trim() !== ""
                ? String(descripcion).trim()
                : null;


        if (
            descripcionLimpia &&
            descripcionLimpia.length > 255
        ) {

            return res.status(400).json({
                message:
                    "La descripción no puede superar los 255 caracteres."
            });
        }


        const subidos = [];
        const errores = [];


        for (const archivo of archivos) {

            try {

                const extension =
                    path.extname(archivo.originalname || "")
                        .replace(".", "")
                        .toLowerCase();


                if (archivo.size === 0) {

                    errores.push({
                        archivo: archivo.originalname,
                        error: "El archivo está vacío."
                    });

                    continue;
                }


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
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                        RETURNING
                            id_archivo,
                            nombre_archivo,
                            tipo_mime,
                            extension_,
                            tamano_bytes,
                            tamano_comprimido,
                            comprimido,
                            descripcion,
                            fecha_subida,
                            id_usuario
                        `,
                        [
                            archivo.originalname,
                            archivo.mimetype ||
                                "application/octet-stream",
                            extension,
                            archivo.size,
                            contenido,
                            descripcionLimpia,
                            req.user.id_usuario,
                            comprimido,
                            tamanoComprimido
                        ]
                    );


                const fila = resultado.rows[0];


                if (idProyecto !== null) {

                    await pool.query(
                        `
                        INSERT INTO proyecto_archivo (
                            id_proyecto,
                            id_archivo
                        )
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                        `,
                        [idProyecto, fila.id_archivo]
                    );
                }


                if (idActividad !== null) {

                    await pool.query(
                        `
                        INSERT INTO actividad_archivo (
                            id_actividad,
                            id_archivo
                        )
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                        `,
                        [idActividad, fila.id_archivo]
                    );
                }


                subidos.push(fila);

            } catch (errorArchivo) {

                console.error(
                    `Error guardando ${archivo.originalname}:`,
                    errorArchivo
                );

                errores.push({
                    archivo: archivo.originalname,
                    error:
                        "No se pudo guardar el archivo."
                });
            }
        }


        if (subidos.length === 0) {

            return res.status(500).json({
                message:
                    "Ningún archivo pudo guardarse.",
                errores
            });
        }


        return res.status(201).json({

            message:
                `Se guardaron ${subidos.length} archivo(s).`,

            archivos: subidos,

            errores
        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al subir los archivos."
        });

    }
}


/*
=========================================
LISTAR (GET /api/archivos)
=========================================
*/

async function listarArchivos(
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


        const {
            sql: filtroBusqueda,
            params: paramsBusqueda
        } =
            construirBusqueda({
                buscar: req.query.buscar,
                campo: req.query.campo,
                mapa: MAPA_BUSQUEDA_ARCHIVOS,
                inicioParam: 1
            });


        const condiciones = [];

        const params = [...paramsBusqueda];

        if (filtroBusqueda) {
            condiciones.push(filtroBusqueda);
        }


        const idProyectoFiltro =
            req.query.id_proyecto !== undefined &&
            String(req.query.id_proyecto).trim() !== ""
                ? Number(req.query.id_proyecto)
                : null;

        const idActividadFiltro =
            req.query.id_actividad !== undefined &&
            String(req.query.id_actividad).trim() !== ""
                ? Number(req.query.id_actividad)
                : null;


        if (
            idProyectoFiltro !== null &&
            !Number.isInteger(idProyectoFiltro)
        ) {

            return res.status(400).json({
                message:
                    "El parámetro id_proyecto es inválido."
            });
        }


        if (
            idActividadFiltro !== null &&
            !Number.isInteger(idActividadFiltro)
        ) {

            return res.status(400).json({
                message:
                    "El parámetro id_actividad es inválido."
            });
        }


        if (idProyectoFiltro !== null) {

            params.push(idProyectoFiltro);

            condiciones.push(
                `EXISTS (
                    SELECT 1
                    FROM proyecto_archivo pa
                    WHERE pa.id_archivo = a.id_archivo
                    AND pa.id_proyecto = $${params.length}
                )`
            );
        }


        if (idActividadFiltro !== null) {

            params.push(idActividadFiltro);

            condiciones.push(
                `EXISTS (
                    SELECT 1
                    FROM actividad_archivo aa
                    WHERE aa.id_archivo = a.id_archivo
                    AND aa.id_actividad = $${params.length}
                )`
            );
        }


        const tipo =
            req.query.tipo === "imagen" ||
            req.query.tipo === "archivo"
                ? req.query.tipo
                : null;


        if (tipo === "imagen") {
            condiciones.push(`a.tipo_mime LIKE 'image/%'`);
        }


        if (tipo === "archivo") {
            condiciones.push(`a.tipo_mime NOT LIKE 'image/%'`);
        }


        // Archivos de voluntarios (persona_archivo):
        // no se muestran en el módulo Archivos,
        // solo al ver la información del voluntario.
        condiciones.push(
            `NOT EXISTS (
                SELECT 1
                FROM persona_archivo pa
                WHERE pa.id_archivo = a.id_archivo
            )`
        );


        const where =
            condiciones.length > 0
                ? `WHERE ${condiciones.join(" AND ")}`
                : "";


        const totalResult =
            await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COUNT(*) FILTER (
                        WHERE a.tipo_mime LIKE 'image/%'
                    )::INTEGER AS imagenes
                FROM archivo a
                ${where}
                `,
                params
            );


        const total = totalResult.rows[0].total;
        const imagenes = totalResult.rows[0].imagenes;


        const result =
            await pool.query(
                `
                SELECT
                    a.id_archivo,
                    a.nombre_archivo,
                    a.tipo_mime,
                    a.extension_,
                    a.tamano_bytes,
                    a.tamano_comprimido,
                    a.comprimido,
                    a.descripcion,
                    a.fecha_subida,
                    a.id_usuario,
                    u.nombre_usuario AS subido_por,
                    (
                        SELECT pa.id_proyecto
                        FROM proyecto_archivo pa
                        WHERE pa.id_archivo = a.id_archivo
                        ORDER BY pa.id_proyecto
                        LIMIT 1
                    ) AS id_proyecto,
                    (
                        SELECT p.nombre
                        FROM proyecto_archivo pa
                        INNER JOIN proyecto p
                            ON p.id_proyecto = pa.id_proyecto
                        WHERE pa.id_archivo = a.id_archivo
                        ORDER BY pa.id_proyecto
                        LIMIT 1
                    ) AS nombre_proyecto,
                    (
                        SELECT aa.id_actividad
                        FROM actividad_archivo aa
                        WHERE aa.id_archivo = a.id_archivo
                        ORDER BY aa.id_actividad
                        LIMIT 1
                    ) AS id_actividad,
                    (
                        SELECT ac.nombre
                        FROM actividad_archivo aa
                        INNER JOIN actividad ac
                            ON ac.id_actividad = aa.id_actividad
                        WHERE aa.id_archivo = a.id_archivo
                        ORDER BY aa.id_actividad
                        LIMIT 1
                    ) AS nombre_actividad
                FROM archivo a
                LEFT JOIN usuario u
                    ON u.id_usuario = a.id_usuario
                ${where}
                ORDER BY a.fecha_subida DESC, a.id_archivo DESC

                ${exportar ? "" : `LIMIT $${params.length + 1} OFFSET $${params.length + 2}`}
                `,
                exportar
                    ? params
                    : [
                        ...params,
                        paginacion.limite,
                        paginacion.offset
                    ]
            );


        return res.json({
            archivos:
                result.rows,

            ...metaPaginacion(
                total,
                exportar ? 1 : paginacion.pagina,
                exportar ? total : paginacion.limite
            ),

            resumen: {
                total,
                imagenes,
                otros: total - imagenes
            }
        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener archivos."
        });

    }
}


/*
=========================================
CONTENIDO (GET /api/archivos/:id/contenido)
=========================================
*/

function nombreSeguroParaCabecera(nombre) {

    return String(nombre || "archivo")
        .replace(/[\r\n"\\]/g, "_");
}


async function obtenerContenido(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de archivo inválido."
            });
        }


        const result =
            await pool.query(
                `
                SELECT
                    nombre_archivo,
                    tipo_mime,
                    contenido,
                    comprimido
                FROM archivo
                WHERE id_archivo = $1
                LIMIT 1
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Archivo no encontrado."
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
                    "Error descomprimiendo archivo:",
                    error
                );

                return res.status(500).json({
                    message:
                        "No se pudo descomprimir el archivo."
                });
            }
        }


        const esEnlinea =
            archivo.tipo_mime.startsWith("image/") ||
            archivo.tipo_mime === "application/pdf";


        const nombreAscii =
            nombreSeguroParaCabecera(
                archivo.nombre_archivo
            );


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
            `${esEnlinea ? "inline" : "attachment"}; ` +
            `filename="${nombreAscii}"; ` +
            `filename*=UTF-8''${encodeURIComponent(archivo.nombre_archivo)}`
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
                "Error al obtener el archivo."
        });

    }
}


/*
=========================================
ELIMINAR (DELETE /api/archivos/:id)
=========================================
*/

async function eliminarArchivo(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de archivo inválido."
            });
        }


        const vinculoPersona =
            await pool.query(
                `
                SELECT 1
                FROM persona_archivo
                WHERE id_archivo = $1
                LIMIT 1
                `,
                [id]
            );

        if (vinculoPersona.rows.length > 0) {

            return res.status(403).json({
                message:
                    "El archivo pertenece a un voluntario."
            });
        }


        const result =
            await pool.query(
                `
                DELETE FROM archivo
                WHERE id_archivo = $1
                RETURNING id_archivo
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Archivo no encontrado."
            });
        }


        return res.json({
            message:
                "Archivo eliminado correctamente."
        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al eliminar el archivo."
        });

    }
}


module.exports = {
    compactar,
    subirArchivosMiddleware,
    guardarArchivos,
    listarArchivos,
    obtenerContenido,
    eliminarArchivo
};
