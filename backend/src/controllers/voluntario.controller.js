const zlib = require("zlib");
const path = require("path");
const multer = require("multer");

const pool =
    require("../config/database");

const { compactar } =
    require("./archivo.controller");

const {
    leerPaginacion,
    construirBusqueda,
    metaPaginacion
} = require("../utils/paginacion");


/*
=========================================
ADJUNTOS DE PERSONA (documentos + foto)
multer en memoria, 10 MB por archivo.
Solo: PDF, imágenes y Word.
=========================================
*/

const LIMITE_ADJUNTO_BYTES = 10 * 1024 * 1024;

const MAX_ADJUNTOS_PETICION = 6;

const CAMPOS_DOCUMENTO = new Set([
    "dpi18",
    "certificado_nacimiento",
    "carta_compromiso",
    "carta_medios_comunicacion",
    "dpi_encargado"
]);

const CAMPOS_ADJUNTO = new Set([
    ...CAMPOS_DOCUMENTO,
    "foto"
]);

const NOMBRE_FOTO = "foto";

const EXTENSIONES_ADJUNTO = new Set([
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "pdf",
    "doc",
    "docx"
]);

const MIME_ADJUNTO = new Set([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/octet-stream"
]);

const subirAdjuntos = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: LIMITE_ADJUNTO_BYTES,
        files: MAX_ADJUNTOS_PETICION
    },

    fileFilter: (req, file, cb) => {

        const extension =
            path.extname(file.originalname || "")
                .replace(".", "")
                .toLowerCase();

        if (!EXTENSIONES_ADJUNTO.has(extension)) {

            const error =
                new Error(
                    `Tipo de archivo no permitido: ${file.originalname}. Solo PDF, imágenes y Word.`
                );

            error.status = 400;

            return cb(error);
        }

        if (
            file.mimetype &&
            !MIME_ADJUNTO.has(file.mimetype)
        ) {

            const error =
                new Error(
                    `Tipo de archivo no permitido: ${file.originalname}. Solo PDF, imágenes y Word.`
                );

            error.status = 400;

            return cb(error);
        }

        cb(null, true);
    }
});


function subirAdjuntosMiddleware(
    req,
    res,
    next
) {

    subirAdjuntos.any()(req, res, (error) => {

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
                        `Un archivo supera el tamaño máximo de ${LIMITE_ADJUNTO_BYTES / (1024 * 1024)} MB.`
                });
            }


            if (error.code === "LIMIT_FILE_COUNT") {

                return res.status(400).json({
                    message:
                        `Puedes adjuntar hasta ${MAX_ADJUNTOS_PETICION} archivos por vez.`
                });
            }


            return res.status(400).json({
                message:
                    error.message ||
                    "Error al procesar los adjuntos."
            });
        }


        console.error(error);

        return res.status(500).json({
            message:
                "Error al procesar los adjuntos."
        });
    });
}


function nombreCampoArchivo(nombre) {

    // Formats aceptados: archivo_<campo> / foto
    return String(nombre || "")
        .replace(/^archivo_/, "");
}


function coleccionAdjuntos(req) {

    // req.files con multer .array() -> lista plana.
    const archivos =
        req.files || [];

    const porCampo = new Map();

    for (const archivo of archivos) {

        const campo =
            nombreCampoArchivo(
                archivo.fieldname
            );

        if (!CAMPOS_ADJUNTO.has(campo)) {
            continue;
        }

        if (!porCampo.has(campo)) {
            porCampo.set(campo, []);
        }

        porCampo.get(campo).push(archivo);
    }

    return porCampo;
}


function banderaReq(req, nombre) {

    const valor = req.body ? req.body[nombre] : null;

    return valor === "1" || valor === 1 ||
        valor === "true" || valor === true;
}


async function borrarAdjuntoCampo(
    idPersona,
    campo
) {

    await pool.query(
        `
        DELETE FROM archivo
        WHERE id_archivo IN (
            SELECT id_archivo
            FROM persona_archivo
            WHERE id_persona = $1
                AND campo = $2
        )
        `,
        [idPersona, campo]
    );
}


async function guardarAdjuntoCampo(
    idPersona,
    campo,
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
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id_archivo
            `,
            [
                archivo.originalname,
                archivo.mimetype ||
                    "application/octet-stream",
                extension,
                archivo.size,
                contenido,
                `Voluntario ${idPersona} - ${campo}`,
                idUsuario,
                comprimido,
                tamanoComprimido
            ]
        );

    const idArchivo =
        resultado.rows[0].id_archivo;

    await pool.query(
        `
        INSERT INTO persona_archivo (
            id_persona,
            id_archivo,
            campo
        )
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
        `,
        [idPersona, idArchivo, campo]
    );

    return idArchivo;
}


async function procesarAdjuntosPersona(
    req,
    idPersona
) {

    const porCampo =
        coleccionAdjuntos(req);

    const resultados = [];

    // Quitar marcados sin archivo nuevo.
    for (const campo of CAMPOS_ADJUNTO) {

        if (!banderaReq(req, `quitar_${campo}`)) {
            continue;
        }

        if (porCampo.has(campo)) {
            continue;
        }

        await borrarAdjuntoCampo(
            idPersona,
            campo
        );

        resultados.push({
            campo,
            accion: "quitado"
        });
    }

    // Reemplazar marcados.
    for (const campo of CAMPOS_ADJUNTO) {

        if (!banderaReq(req, `reemplazar_${campo}`)) {
            continue;
        }

        await borrarAdjuntoCampo(
            idPersona,
            campo
        );

        resultados.push({
            campo,
            accion: "reemplazado"
        });
    }

    // Guardar nuevos.
    for (const [
        campo,
        archivosCampo
    ] of porCampo.entries()) {

        for (const archivo of archivosCampo) {

            if (archivo.size === 0) {

                return {
                    error:
                        "No se puede adjuntar un archivo vacío."
                };
            }


            if (campo !== NOMBRE_FOTO &&
                archivosCampo.length > 1
            ) {

                return {
                    error:
                        `Solo se puede adjuntar un archivo para ${campo}.`
                };
            }


            try {

                const idArchivado =
                    await guardarAdjuntoCampo(
                        idPersona,
                        campo,
                        archivo,
                        req.user.id_usuario
                    );

                resultados.push({
                    campo,
                    accion: "adjuntado",
                    id_archivo: idArchivado
                });

            } catch (errorAdjunto) {

                console.error(
                    "Error guardando adjunto:",
                    errorAdjunto
                );

                return {
                    error:
                        "No se pudo guardar el adjunto."
                };
            }
        }
    }

    return { resultados };
}


/*
=========================================
EDAD AUTOMÁTICA DESDE fecha_nacimiento
=========================================
*/

function edadDesdeFecha(fecha) {

    const [y, m, d] =
        fecha.split("-").map(Number);

    const nacimiento =
        new Date(y, m - 1, d);

    const hoy = new Date();

    let edad =
        hoy.getFullYear() - y;

    const mes =
        hoy.getMonth() - (m - 1);

    if (
        mes < 0 ||
        (mes === 0 && hoy.getDate() < d)
    ) {
        edad--;
    }

    return edad;
}


function validarFechaNacimiento(valor) {

    if (
        valor === undefined ||
        valor === null ||
        String(valor).trim() === ""
    ) {
        return null;
    }

    const texto = String(valor).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
        return false;
    }

    const fecha = new Date(`${texto}T00:00:00`);

    if (Number.isNaN(fecha.getTime())) {
        return false;
    }


    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    if (fecha > hoy) {
        return false;
    }

    return texto;
}


const EDAD_CALCULADA_SQL = `
    CASE
        WHEN p.fecha_nacimiento IS NOT NULL THEN
            EXTRACT(
                YEAR FROM AGE(CURRENT_DATE, p.fecha_nacimiento)
            )::INTEGER
        ELSE p.edad
    END
`;

const COLUMNAS_LISTA = `
    p.id_persona,
    p.nombres,
    p.apellidos,
    ${EDAD_CALCULADA_SQL} AS edad,
    TO_CHAR(p.fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
    p.dpi,
    p.municipio,
    p.telefono,
    p.centro_educativo,
    p.jornada,
    p.encargado,
    p.telefono_encargado,
    p.dpi_del_encargado,
    p.carta_compromiso,
    p.carta_medios_comunicacion,
    p.dpi18,
    p.certificado_nacimiento,
    p.dpi_encargado,
    p.biografia,
    p.estado
`;


const COLUMNAS_RETURNING = `
    id_persona,
    nombres,
    apellidos,
    edad,
    TO_CHAR(fecha_nacimiento, 'YYYY-MM-DD') AS fecha_nacimiento,
    dpi,
    municipio,
    telefono,
    centro_educativo,
    jornada,
    encargado,
    telefono_encargado,
    dpi_del_encargado,
    carta_compromiso,
    carta_medios_comunicacion,
    dpi18,
    certificado_nacimiento,
    dpi_encargado,
    biografia,
    estado
`;


const MAPA_BUSQUEDA_VOLUNTARIOS = {
    nombre: ["p.nombres"],
    apellido: ["p.apellidos"],
    municipio: ["p.municipio"],
    centro: ["p.centro_educativo"],
    jornada: ["p.jornada"],
    edad: [`${EDAD_CALCULADA_SQL}::TEXT`],
    estado: [
        "CASE WHEN p.estado THEN 'activo' ELSE 'inactivo' END"
    ],
    todos: [
        "p.nombres",
        "p.apellidos",
        "p.municipio",
        "p.centro_educativo",
        "p.jornada",
        `${EDAD_CALCULADA_SQL}::TEXT`,
        "CASE WHEN p.estado THEN 'activo' ELSE 'inactivo' END"
    ]
};


async function proyectosDe(idPersona) {

    const result =
        await pool.query(
            `
            SELECT id_proyecto
            FROM proyecto_persona
            WHERE id_persona = $1
            ORDER BY id_proyecto
            `,
            [idPersona]
        );

    return result.rows.map(
        (row) => row.id_proyecto
    );
}


async function documentosDe(idPersona) {

    const result =
        await pool.query(
            `
            SELECT
                pa.campo,
                pa.id_archivo,
                a.nombre_archivo,
                a.tipo_mime,
                a.extension_,
                a.tamano_bytes,
                a.fecha_subida
            FROM persona_archivo pa
            INNER JOIN archivo a
                ON a.id_archivo = pa.id_archivo
            WHERE pa.id_persona = $1
            ORDER BY pa.campo, pa.id_archivo
            `,
            [idPersona]
        );

    return result.rows;
}


async function asignarProyectos(idPersona, idProyectos) {

    await pool.query(
        `
        DELETE FROM proyecto_persona
        WHERE id_persona = $1
        `,
        [idPersona]
    );

    for (const idProyecto of idProyectos) {

        await pool.query(
            `
            INSERT INTO proyecto_persona (
                id_proyecto,
                id_persona
            )
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
            `,
            [idProyecto, idPersona]
        );
    }
}


function validarProyectos(idProyectos) {

    if (idProyectos === undefined) {
        return [];
    }

    if (!Array.isArray(idProyectos)) {
        return null;
    }

    const ids = [];

    for (const id of idProyectos) {

        const n = Number(id);

        if (!Number.isInteger(n)) {
            return null;
        }

        ids.push(n);
    }

    return ids;
}


function validarEnteroOpcional(valor) {

    if (
        valor === undefined ||
        valor === null ||
        valor === ""
    ) {
        return null;
    }

    const n = Number(valor);

    if (!Number.isInteger(n)) {
        return false;
    }

    return n;
}


function validarEdad(edad) {

    const n = validarEnteroOpcional(edad);

    if (n === false || (n !== null && n < 0)) {
        return false;
    }

    return n;
}


function extraerCampos(body) {

    const {
        nombres,
        apellidos,
        edad,
        fecha_nacimiento,
        dpi,
        municipio,
        telefono,
        centro_educativo,
        jornada,
        encargado,
        telefono_encargado,
        dpi_del_encargado,
        carta_compromiso,
        carta_medios_comunicacion,
        dpi18,
        certificado_nacimiento,
        dpi_encargado,
        biografia
    } = body;


    if (!nombres || !apellidos) {
        return { error: "Nombre y apellido son obligatorios." };
    }


    const fechaNacimiento =
        validarFechaNacimiento(fecha_nacimiento);

    if (fechaNacimiento === false) {

        return {
            error:
                "La fecha de nacimiento debe ser una fecha válida (YYYY-MM-DD) y no futura."
        };
    }


    // Edad SIEMPRE derivada de la fecha de nacimiento.
    // Voluntarios antiguos sin fecha conservan la edad almacenada.
    const edadNum =
        fechaNacimiento !== null
            ? edadDesdeFecha(fechaNacimiento)
            : validarEdad(edad);

    if (edadNum === false) {
        return { error: "La edad debe ser un número entero mayor o igual a 0." };
    }


    const enteros = {
        dpi: validarEnteroOpcional(dpi),
        telefono: validarEnteroOpcional(telefono),
        telefono_encargado: validarEnteroOpcional(telefono_encargado),
        dpi_del_encargado: validarEnteroOpcional(dpi_del_encargado)
    };

    for (const [campo, valor] of Object.entries(enteros)) {

        if (valor === false) {
            return { error: `El campo ${campo} debe ser un número entero.` };
        }
    }


    return {
        valores: [
            nombres,
            apellidos,
            edadNum,
            fechaNacimiento,
            enteros.dpi,
            municipio || null,
            enteros.telefono,
            centro_educativo || null,
            jornada || null,
            encargado || null,
            enteros.telefono_encargado,
            enteros.dpi_del_encargado,
            carta_compromiso || null,
            carta_medios_comunicacion || null,
            dpi18 || null,
            certificado_nacimiento || null,
            dpi_encargado || null,
            biografia || null
        ]
    };
}


async function listarOpciones(
    req,
    res
) {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    id_persona,
                    nombres,
                    apellidos
                FROM persona
                WHERE estado = TRUE
                ORDER BY apellidos, nombres
                `
            );


        return res.json({
            voluntarios:
                result.rows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener voluntarios."
        });

    }
}


async function listarVoluntarios(
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

        const verInactivos =
            req.query.ver_inactivos === "1";


        const filtros = [];

        const paramsBase = [];


        if (!verInactivos) {
            filtros.push("p.estado = TRUE");
        }


        const { sql: filtroBusqueda, params: paramsBusqueda } =
            construirBusqueda({
                buscar: req.query.buscar,
                campo: req.query.campo,
                mapa: MAPA_BUSQUEDA_VOLUNTARIOS,
                inicioParam: 1
            });

        if (filtroBusqueda) {
            filtros.push(filtroBusqueda);
            paramsBase.push(...paramsBusqueda);
        }


        const where =
            filtros.length > 0
                ? `WHERE ${filtros.join(" AND ")}`
                : "";


        const totalResult =
            await pool.query(
                `
                SELECT
                    COUNT(DISTINCT p.id_persona)::INTEGER AS total,
                    COUNT(DISTINCT pp.id_persona)::INTEGER AS en_proyectos
                FROM persona p
                LEFT JOIN proyecto_persona pp
                    ON pp.id_persona = p.id_persona
                ${where}
                `,
                paramsBase
            );


        const total = totalResult.rows[0].total;

        const enProyectos = totalResult.rows[0].en_proyectos;


        const limiteDatos =
            paramsBase.length + 1;

        const offsetDatos =
            paramsBase.length + 2;

        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS_LISTA},
                    COUNT(pp.id_proyecto)::INTEGER AS total_proyectos
                FROM persona p
                LEFT JOIN proyecto_persona pp
                    ON pp.id_persona = p.id_persona
                ${where}
                GROUP BY
                    p.id_persona
                ORDER BY
                    p.id_persona DESC

                ${exportar ? "" : `LIMIT $${limiteDatos} OFFSET $${offsetDatos}`}
                `,
                exportar
                    ? paramsBase
                    : [
                        ...paramsBase,
                        paginacion.limite,
                        paginacion.offset
                    ]
            );


        return res.json({
            voluntarios:
                result.rows,

            ...metaPaginacion(
                total,
                exportar ? 1 : paginacion.pagina,
                exportar ? total : paginacion.limite
            ),

            resumen: {
                total,
                en_proyectos: enProyectos,
                sin_asignar: total - enProyectos
            }
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener voluntarios."
        });

    }
}


async function obtenerVoluntario(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de voluntario inválido."
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS_LISTA}
                FROM persona p
                WHERE p.id_persona = $1
                LIMIT 1
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Voluntario no encontrado."
            });

        }


        const voluntario =
            result.rows[0];

        voluntario.proyectos =
            await proyectosDe(id);

        voluntario.documentos =
            await documentosDe(id);

        voluntario.foto =
            voluntario.documentos.find(
                (doc) => doc.campo === NOMBRE_FOTO
            ) || null;


        return res.json({
            voluntario
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener voluntario."
        });

    }
}


/*
========================================
DOCUMENTOS (GET /api/voluntarios/:id/documentos)
========================================
*/

async function listarDocumentos(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de voluntario inválido."
            });

        }


        const existe =
            await pool.query(
                `
                SELECT id_persona
                FROM persona
                WHERE id_persona = $1
                LIMIT 1
                `,
                [id]
            );

        if (existe.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Voluntario no encontrado."
            });

        }


        return res.json({
            documentos:
                await documentosDe(id)
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener los documentos."
        });

    }
}


/*
========================================
CONTENIDO (GET /api/voluntarios/:id/documentos/:idArchivo)
========================================
*/

async function obtenerDocumentoContenido(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);

        const idArchivo =
            Number(req.params.idArchivo);


        if (
            !Number.isInteger(id) ||
            !Number.isInteger(idArchivo)
        ) {

            return res.status(400).json({
                message:
                    "IDs inválidos."
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
                FROM persona_archivo pa
                INNER JOIN archivo a
                    ON a.id_archivo = pa.id_archivo
                WHERE pa.id_persona = $1
                    AND pa.id_archivo = $2
                LIMIT 1
                `,
                [id, idArchivo]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Documento no encontrado para este voluntario."
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
                    "Error descomprimiendo documento:",
                    error
                );

                return res.status(500).json({
                    message:
                        "No se pudo descomprimir el documento."
                });
            }
        }


        const esEnlinea =
            archivo.tipo_mime.startsWith("image/") ||
            archivo.tipo_mime === "application/pdf";


        const nombreAscii =
            String(archivo.nombre_archivo || "documento")
                .replace(/[\r\n"\\]/g, "_");


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
            "private, max-age=300"
        );

        return res.send(buffer);

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener el documento."
        });

    }
}


async function crearVoluntario(
    req,
    res
) {

    try {

        const { error, valores } = extraerCampos(req.body);

        if (error) {

            return res.status(400).json({
                message: error
            });

        }


        const proyectos = validarProyectos(req.body.id_proyectos);

        if (proyectos === null) {

            return res.status(400).json({
                message:
                    "Los proyectos deben ser una lista de IDs válidos."
            });

        }


        const result =
            await pool.query(
                `
                INSERT INTO persona (
                    nombres,
                    apellidos,
                    edad,
                    fecha_nacimiento,
                    dpi,
                    municipio,
                    telefono,
                    centro_educativo,
                    jornada,
                    encargado,
                    telefono_encargado,
                    dpi_del_encargado,
                    carta_compromiso,
                    carta_medios_comunicacion,
                    dpi18,
                    certificado_nacimiento,
                    dpi_encargado,
                    biografia
                )
                VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9,
                    $10, $11, $12, $13, $14, $15, $16, $17, $18
                )
                RETURNING
                    ${COLUMNAS_RETURNING}
                `,
                valores
            );


        const voluntario =
            result.rows[0];

        try {

            await asignarProyectos(
                voluntario.id_persona,
                proyectos
            );

        } catch (error) {

            if (error.code === "23503") {

                return res.status(400).json({
                    message:
                        "Uno de los proyectos indicados no existe."
                });

            }

            throw error;
        }


        const adjuntos =
            await procesarAdjuntosPersona(
                req,
                voluntario.id_persona
            );

        if (adjuntos.error) {

            return res.status(400).json({
                message: adjuntos.error
            });

        }


        voluntario.documentos =
            await documentosDe(voluntario.id_persona);

        voluntario.foto =
            voluntario.documentos.find(
                (doc) => doc.campo === NOMBRE_FOTO
            ) || null;

        voluntario.proyectos = proyectos;


        return res.status(201).json({

            message:
                "Voluntario creado correctamente.",

            voluntario

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al crear voluntario."
        });

    }
}


async function editarVoluntario(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de voluntario inválido."
            });

        }


        const { error, valores } = extraerCampos(req.body);

        if (error) {

            return res.status(400).json({
                message: error
            });

        }


        const proyectos = validarProyectos(req.body.id_proyectos);

        if (proyectos === null) {

            return res.status(400).json({
                message:
                    "Los proyectos deben ser una lista de IDs válidos."
            });

        }


        const result =
            await pool.query(
                `
                UPDATE persona
                SET
                    nombres = $1,
                    apellidos = $2,
                    edad = $3,
                    fecha_nacimiento = $4,
                    dpi = $5,
                    municipio = $6,
                    telefono = $7,
                    centro_educativo = $8,
                    jornada = $9,
                    encargado = $10,
                    telefono_encargado = $11,
                    dpi_del_encargado = $12,
                    carta_compromiso = $13,
                    carta_medios_comunicacion = $14,
                    dpi18 = $15,
                    certificado_nacimiento = $16,
                    dpi_encargado = $17,
                    biografia = $18
                WHERE id_persona = $19
                RETURNING
                    ${COLUMNAS_RETURNING}
                `,
                [...valores, id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Voluntario no encontrado."
            });

        }


        try {

            await asignarProyectos(id, proyectos);

        } catch (error) {

            if (error.code === "23503") {

                return res.status(400).json({
                    message:
                        "Uno de los proyectos indicados no existe."
                });

            }

            throw error;
        }


        const adjuntos =
            await procesarAdjuntosPersona(req, id);

        if (adjuntos.error) {

            return res.status(400).json({
                message: adjuntos.error
            });

        }


        const voluntario =
            result.rows[0];

        voluntario.documentos =
            await documentosDe(id);

        voluntario.foto =
            voluntario.documentos.find(
                (doc) => doc.campo === NOMBRE_FOTO
            ) || null;

        voluntario.proyectos = proyectos;


        return res.json({

            message:
                "Voluntario actualizado correctamente.",

            voluntario

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al actualizar voluntario."
        });

    }
}


async function eliminarVoluntario(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de voluntario inválido."
            });

        }


        const result =
            await pool.query(
                `
                UPDATE persona
                SET estado = FALSE
                WHERE id_persona = $1
                    AND estado = TRUE
                RETURNING id_persona
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Voluntario no encontrado."
            });

        }


        return res.json({
            message:
                "Voluntario desactivado correctamente."
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al desactivar voluntario."
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
                    "ID de voluntario inválido."
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
                UPDATE persona
                SET estado = $1
                WHERE id_persona = $2
                RETURNING
                    id_persona,
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
                    "Voluntario no encontrado."
            });

        }


        return res.json({

            message:
                "Estado actualizado correctamente.",

            voluntario:
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
    subirAdjuntosMiddleware,
    listarOpciones,
    listarVoluntarios,
    obtenerVoluntario,
    listarDocumentos,
    obtenerDocumentoContenido,
    crearVoluntario,
    editarVoluntario,
    eliminarVoluntario,
    cambiarEstado
};
