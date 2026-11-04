const zlib = require("zlib");
const PDFDocument = require("pdfkit");

const pool =
    require("../config/database");

const { compactar } =
    require("./archivo.controller");

const {
    leerPaginacion,
    metaPaginacion
} = require("../utils/paginacion");

const {
    actualizarEntePatrocinador
} = require("../utils/totales_proyecto");


const TIPOS_MONEDA = [
    "GTQ",
    "USD",
    "EUR",
    "CAD",
    "MXN"
];

const TIPOS_APORTE = [
    "efectivo",
    "transferencia",
    "cheque"
];


const COLUMNAS = `
    pp.id_proyecto_patrocinador,
    pp.id_proyecto,
    pp.id_patrocinador,
    pa.nombre_razon_social AS donante,
    pp.tipo_moneda,
    pp.tipo_aporte,
    pp.tipo_cambio,
    TO_CHAR(pp.fecha_tipo_cambio, 'YYYY-MM-DD') AS fecha_tipo_cambio,
    pp.fuente_tipo_cambio,
    TO_CHAR(pp.fecha_registro, 'YYYY-MM-DD') AS fecha_registro,
    pp.descripcion,
    pp.subvencion_moneda_donante,
    pp.cantidad_solicitada_moneda_donante,
    pp.subvencion_moneda_nacional,
    pp.diferencia_solicitado_subvencion,
    pp.estado,
    EXISTS (
        SELECT 1
        FROM proyecto_patrocinador_archivo ppa
        WHERE ppa.id_proyecto_patrocinador = pp.id_proyecto_patrocinador
    ) AS tiene_recibo
`;


const FROM_PATROCINADORES = `
    FROM proyecto_patrocinador pp
    INNER JOIN patrocinador pa
        ON pa.id_patrocinador = pp.id_patrocinador
`;


function validarMonto(valor) {

    if (
        valor === undefined ||
        valor === null ||
        valor === ""
    ) {
        return 0;
    }

    const n = Number(valor);

    if (!Number.isFinite(n) || n < 0) {
        return false;
    }

    return n;
}


function validarEntero(valor) {

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


function textoONulo(valor) {

    if (
        valor === undefined ||
        valor === null
    ) {
        return null;
    }

    const texto = String(valor).trim();

    return texto === "" ? null : texto;
}


function validarFecha(valor) {

    if (
        valor === undefined ||
        valor === null ||
        valor === ""
    ) {
        return null;
    }

    const fecha = String(valor).slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return false;
    }

    const d = new Date(fecha + "T00:00:00");

    if (Number.isNaN(d.getTime())) {
        return false;
    }

    return fecha;
}


function extraerCampos(body) {

    const {
        id_proyecto,
        id_patrocinador,
        tipo_moneda,
        tipo_aporte,
        tipo_cambio,
        fecha_tipo_cambio,
        fuente_tipo_cambio,
        descripcion,
        subvencion_moneda_donante,
        cantidad_solicitada_moneda_donante
    } = body;


    const proyectoNum = validarEntero(id_proyecto);
    const patrocinadorNum = validarEntero(id_patrocinador);

    if (proyectoNum === null || proyectoNum === false) {
        return { error: "El proyecto es obligatorio y debe ser un ID vǭlido." };
    }

    if (patrocinadorNum === null || patrocinadorNum === false) {
        return { error: "El donante es obligatorio y debe ser un ID vǭlido." };
    }
    const moneda =
        textoONulo(tipo_moneda);

    if (moneda === null) {

        return {
            error:
                "El tipo de moneda es obligatorio."
        };
    }

    if (!TIPOS_MONEDA.includes(moneda)) {

        return {
            error:
                "El tipo de moneda debe ser GTQ, USD, EUR, CAD o MXN."
        };
    }


    const aporte =
        textoONulo(tipo_aporte);

    if (aporte === null) {

        return {
            error:
                "El tipo de aporte es obligatorio."
        };
    }

    if (!TIPOS_APORTE.includes(aporte)) {

        return {
            error:
                "El tipo de aporte debe ser efectivo, transferencia o cheque."
        };
    }


    const montos = {
        tipo_cambio: validarMonto(tipo_cambio),
        subvencion_moneda_donante:
            validarMonto(subvencion_moneda_donante),
        cantidad_solicitada_moneda_donante:
            validarMonto(cantidad_solicitada_moneda_donante)
    };

    for (const [campo, valor] of Object.entries(montos)) {

        if (valor === false) {
            return { error: `El campo ${campo} debe ser un nǧmero mayor o igual a 0.` };
        }

    }


    if (montos.subvencion_moneda_donante <= 0) {

        return {
            error:
                "La subvención en moneda del donante es obligatoria y debe ser mayor a 0."
        };
    }


    const fechaTc =
        validarFecha(fecha_tipo_cambio);

    if (fechaTc === false) {

        return {
            error:
                "La fecha del tipo de cambio debe tener formato AAAA-MM-DD."
        };
    }


    return {
        valores: [
            proyectoNum,
            patrocinadorNum,
            moneda,
            aporte,
            montos.tipo_cambio,
            fechaTc,
            textoONulo(fuente_tipo_cambio),
            montos.subvencion_moneda_donante,
            montos.cantidad_solicitada_moneda_donante,
            textoONulo(descripcion)
        ]
    };
}


async function datosProyecto(idProyecto) {

    const result =
        await pool.query(
            `
            SELECT estado
            FROM proyecto
            WHERE id_proyecto = $1
            LIMIT 1
            `,
            [idProyecto]
        );

    if (result.rows.length === 0) {
        return null;
    }

    return {
        finalizado:
            result.rows[0].estado === "finalizado"
    };
}


function calcularDerivados(valores) {

    const tipoCambio = valores[4];
    const subvencionDonante = valores[7];
    const solicitadoDonante = valores[8];

    const subvencionNacional =
        Math.round(subvencionDonante * tipoCambio * 100) / 100;

    const diferencia =
        Math.round((solicitadoDonante - subvencionDonante) * 100) / 100;

    return { subvencionNacional, diferencia };
}


/*
RECIBO PDF DEL PATROCINIO EN EFECTIVO
Título "Recepciones variadas" + datos del
patrocinio y firma al pie.
*/

function generarReciboPdf(datos) {

    return new Promise((resolve, reject) => {

        const doc =
            new PDFDocument({
                size: "LETTER",
                margin: 50
            });

        const chunks = [];

        doc.on("data", (chunk) => chunks.push(chunk));

        doc.on("end", () =>
            resolve(Buffer.concat(chunks))
        );

        doc.on("error", reject);


        doc.fontSize(16)
            .font("Helvetica-Bold")
            .text("Recepciones variadas", {
                align: "center"
            });

        doc.moveDown(2);


        const fila = (etiqueta, valor) => {

            doc.fontSize(11)
                .font("Helvetica-Bold")
                .text(`${etiqueta}: `, {
                    continued: true
                });

            doc.font("Helvetica").text(
                valor === null ||
                valor === undefined ||
                valor === ""
                    ? "—"
                    : String(valor)
            );

            doc.moveDown(0.6);
        };


        fila(
            "Nombre del patrocinador",
            datos.nombre
        );

        fila(
            "Fecha de patrocinio",
            datos.fecha
        );

        fila(
            "Ubicación",
            datos.ubicacion
        );

        fila(
            "Descripción",
            datos.descripcion
        );

        fila(
            "Cantidad",
            datos.cantidad
        );


        // Firma dos filas después del último dato.
        doc.moveDown(2);

        doc.fontSize(11)
            .font("Helvetica")
            .text("Firma______________");


        doc.end();
    });
}


async function borrarReciboPatrocinio(idFila) {

    await pool.query(
        `
        DELETE FROM archivo
        WHERE id_archivo IN (
            SELECT id_archivo
            FROM proyecto_patrocinador_archivo
            WHERE id_proyecto_patrocinador = $1
        )
        `,
        [idFila]
    );
}


async function generarYGuardarRecibo(
    idFila,
    idUsuario
) {

    const result =
        await pool.query(
            `
            SELECT
                pp.id_proyecto,
                pp.descripcion,
                pp.subvencion_moneda_nacional,
                TO_CHAR(pp.fecha_registro, 'YYYY-MM-DD') AS fecha_registro,
                pa.nombre_razon_social,
                pa.direccion
            FROM proyecto_patrocinador pp
            INNER JOIN patrocinador pa
                ON pa.id_patrocinador = pp.id_patrocinador
            WHERE pp.id_proyecto_patrocinador = $1
            LIMIT 1
            `,
            [idFila]
        );


    if (result.rows.length === 0) {
        return;
    }


    const d = result.rows[0];


    const buffer =
        await generarReciboPdf({
            nombre: d.nombre_razon_social,
            fecha: d.fecha_registro,
            ubicacion: d.direccion,
            descripcion: d.descripcion,
            cantidad: Number(
                d.subvencion_moneda_nacional
            ).toFixed(2)
        });


    const {
        contenido,
        comprimido,
        tamanoComprimido
    } =
        compactar(buffer);


    const archivo =
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
                `recibo_patrocinio_${idFila}.pdf`,
                "application/pdf",
                "pdf",
                buffer.length,
                contenido,
                `Proyecto ${d.id_proyecto} - recibo patrocinio`,
                idUsuario,
                comprimido,
                tamanoComprimido
            ]
        );


    await pool.query(
        `
        INSERT INTO proyecto_patrocinador_archivo (
            id_proyecto_patrocinador,
            id_archivo
        )
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        `,
        [idFila, archivo.rows[0].id_archivo]
    );
}


async function listarProyectoPatrocinadores(
    req,
    res
) {

    try {

        const idProyecto =
            Number(req.query.id_proyecto);


        if (!Number.isInteger(idProyecto)) {

            return res.status(400).json({
                message:
                    "El parǭmetro id_proyecto es obligatorio y debe ser un ID vǭlido."
            });

        }


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


        const filtroEstado =
            verInactivos ? "" : "AND pp.estado = TRUE";


        const totalResult =
            await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total
                ${FROM_PATROCINADORES}
                WHERE pp.id_proyecto = $1
                ${filtroEstado}
                `,
                [idProyecto]
            );


        const total = totalResult.rows[0].total;


        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS}
                ${FROM_PATROCINADORES}
                WHERE pp.id_proyecto = $1
                ${filtroEstado}
                ORDER BY pp.id_proyecto_patrocinador DESC

                ${exportar ? "" : "LIMIT $2 OFFSET $3"}
                `,
                exportar
                    ? [idProyecto]
                    : [
                        idProyecto,
                        paginacion.limite,
                        paginacion.offset
                    ]
            );


        return res.json({
            proyecto_patrocinadores:
                result.rows,

            ...metaPaginacion(
                total,
                exportar ? 1 : paginacion.pagina,
                exportar ? total : paginacion.limite
            )
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener los donantes del proyecto."
        });

    }
}


async function obtenerProyectoPatrocinador(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de donante invǭlido."
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS}
                ${FROM_PATROCINADORES}
                WHERE pp.id_proyecto_patrocinador = $1
                LIMIT 1
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Donante no encontrado."
            });

        }


        return res.json({
            proyecto_patrocinador:
                result.rows[0]
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener el donante."
        });

    }
}


async function crearProyectoPatrocinador(
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


        const proyecto =
            await datosProyecto(valores[0]);

        if (proyecto === null) {

            return res.status(400).json({
                message:
                    "El proyecto indicado no existe."
            });

        }

        if (proyecto.finalizado) {

            return res.status(403).json({
                message:
                    "El proyecto estǭ finalizado y ya no se puede modificar."
            });

        }


        const { subvencionNacional, diferencia } =
            calcularDerivados(valores);


        let result;

        try {

            result =
                await pool.query(
                    `
                    INSERT INTO proyecto_patrocinador (
                        id_proyecto,
                        id_patrocinador,
                        tipo_moneda,
                        tipo_aporte,
                        tipo_cambio,
                        fecha_tipo_cambio,
                        fuente_tipo_cambio,
                        subvencion_moneda_donante,
                        cantidad_solicitada_moneda_donante,
                        descripcion,
                        subvencion_moneda_nacional,
                        diferencia_solicitado_subvencion
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    RETURNING
                        id_proyecto_patrocinador,
                        id_proyecto,
                        id_patrocinador,
                        tipo_moneda,
                        tipo_aporte,
                        tipo_cambio,
                        TO_CHAR(fecha_tipo_cambio, 'YYYY-MM-DD') AS fecha_tipo_cambio,
                        fuente_tipo_cambio,
                        TO_CHAR(fecha_registro, 'YYYY-MM-DD') AS fecha_registro,
                        descripcion,
                        subvencion_moneda_donante,
                        cantidad_solicitada_moneda_donante,
                        subvencion_moneda_nacional,
                        diferencia_solicitado_subvencion,
                        estado
                    `,
                    [
                        ...valores,
                        subvencionNacional,
                        diferencia
                    ]
                );

        } catch (dbError) {

            if (dbError.code === "23503") {

                return res.status(400).json({
                    message:
                        "El proyecto o el donante indicado no existe."
                });

            }

            throw dbError;
        }


        await actualizarEntePatrocinador(valores[0]);


        // Pago en efectivo: se genera el recibo PDF.
        if (valores[3] === "efectivo") {

            await generarYGuardarRecibo(
                result.rows[0].id_proyecto_patrocinador,
                req.user.id_usuario
            );
        }


        return res.status(201).json({

            message:
                "Donante registrado correctamente.",

            proyecto_patrocinador:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al registrar el donante."
        });

    }
}


async function editarProyectoPatrocinador(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de donante invǭlido."
            });

        }


        const { error, valores } = extraerCampos(req.body);

        if (error) {

            return res.status(400).json({
                message: error
            });

        }


        const proyecto =
            await datosProyecto(valores[0]);

        if (proyecto === null) {

            return res.status(400).json({
                message:
                    "El proyecto indicado no existe."
            });

        }

        if (proyecto.finalizado) {

            return res.status(403).json({
                message:
                    "El proyecto estǭ finalizado y ya no se puede modificar."
            });

        }


        const { subvencionNacional, diferencia } =
            calcularDerivados(valores);


        let result;

        try {

            result =
                await pool.query(
                    `
                    UPDATE proyecto_patrocinador
                    SET
                        id_proyecto = $1,
                        id_patrocinador = $2,
                        tipo_moneda = $3,
                        tipo_aporte = $4,
                        tipo_cambio = $5,
                        fecha_tipo_cambio = $6,
                        fuente_tipo_cambio = $7,
                        subvencion_moneda_donante = $8,
                        cantidad_solicitada_moneda_donante = $9,
                        descripcion = $10,
                        subvencion_moneda_nacional = $11,
                        diferencia_solicitado_subvencion = $12
                    WHERE id_proyecto_patrocinador = $13
                    RETURNING
                        id_proyecto_patrocinador,
                        id_proyecto,
                        id_patrocinador,
                        tipo_moneda,
                        tipo_aporte,
                        tipo_cambio,
                        TO_CHAR(fecha_tipo_cambio, 'YYYY-MM-DD') AS fecha_tipo_cambio,
                        fuente_tipo_cambio,
                        TO_CHAR(fecha_registro, 'YYYY-MM-DD') AS fecha_registro,
                        descripcion,
                        subvencion_moneda_donante,
                        cantidad_solicitada_moneda_donante,
                        subvencion_moneda_nacional,
                        diferencia_solicitado_subvencion,
                        estado
                    `,
                    [
                        ...valores,
                        subvencionNacional,
                        diferencia,
                        id
                    ]
                );

        } catch (dbError) {

            if (dbError.code === "23503") {

                return res.status(400).json({
                    message:
                        "El proyecto o el donante indicado no existe."
                });

            }

            throw dbError;
        }


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Donante no encontrado."
            });

        }


        await actualizarEntePatrocinador(valores[0]);


        // Pago en efectivo: el recibo se regenera con los
        // datos actuales; si deja de ser efectivo se elimina.
        if (valores[3] === "efectivo") {

            await borrarReciboPatrocinio(id);

            await generarYGuardarRecibo(
                id,
                req.user.id_usuario
            );

        } else {

            await borrarReciboPatrocinio(id);
        }


        return res.json({

            message:
                "Donante actualizado correctamente.",

            proyecto_patrocinador:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al actualizar el donante."
        });

    }
}


/*
RECIBO DEL PATROCINIO (GET /api/proyecto-patrocinadores/:id/recibo)
Sirve el PDF generado (inline).
*/

async function obtenerReciboPatrocinio(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de patrocinio inválido."
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
                FROM proyecto_patrocinador_archivo ppa
                INNER JOIN archivo a
                    ON a.id_archivo = ppa.id_archivo
                WHERE ppa.id_proyecto_patrocinador = $1
                LIMIT 1
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "El patrocinio no tiene recibo adjunto."
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
                    "Error descomprimiendo recibo:",
                    error
                );

                return res.status(500).json({
                    message:
                        "No se pudo descomprimir el recibo."
                });
            }
        }


        const nombreAscii =
            String(archivo.nombre_archivo || "recibo.pdf")
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
            `inline; ` +
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
                "Error al obtener el recibo."
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
                    "ID de donante invǭlido."
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


        const actual =
            await pool.query(
                `
                SELECT id_proyecto
                FROM proyecto_patrocinador
                WHERE id_proyecto_patrocinador = $1
                LIMIT 1
                `,
                [id]
            );


        if (actual.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Donante no encontrado."
            });

        }


        const idProyecto =
            actual.rows[0].id_proyecto;


        const proyecto =
            await datosProyecto(idProyecto);

        if (
            proyecto !== null &&
            proyecto.finalizado
        ) {

            return res.status(403).json({
                message:
                    "El proyecto estǭ finalizado y ya no se puede modificar."
            });

        }


        const result =
            await pool.query(
                `
                UPDATE proyecto_patrocinador
                SET estado = $1
                WHERE id_proyecto_patrocinador = $2
                RETURNING
                    id_proyecto_patrocinador,
                    id_proyecto,
                    estado
                `,
                [
                    estado,
                    id
                ]
            );


        const fila = result.rows[0];


        await actualizarEntePatrocinador(idProyecto);


        return res.json({

            message:
                "Estado actualizado correctamente.",

            proyecto_patrocinador: {
                id_proyecto_patrocinador:
                    fila.id_proyecto_patrocinador,
                estado:
                    fila.estado
            }

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
    listarProyectoPatrocinadores,
    obtenerProyectoPatrocinador,
    obtenerReciboPatrocinio,
    crearProyectoPatrocinador,
    editarProyectoPatrocinador,
    cambiarEstado
};
