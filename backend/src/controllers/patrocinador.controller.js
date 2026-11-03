const pool =
    require("../config/database");

const {
    leerPaginacion,
    construirBusqueda,
    metaPaginacion
} = require("../utils/paginacion");


const TIPOS_PATROCINADOR = [
    "persona",
    "empresa"
];


const COLUMNAS_PATROCINADOR = `
    id_patrocinador,
    tipo,
    nombre_razon_social,
    dpi,
    persona_contacto,
    telefono,
    correo,
    direccion,
    municipio,
    pais,
    TO_CHAR(fecha_registro, 'YYYY-MM-DD') AS fecha_registro,
    observaciones,
    estado
`;


const MAPA_BUSQUEDA_PATROCINADORES = {
    nombre: ["nombre_razon_social"],
    tipo: ["tipo"],
    contacto: ["persona_contacto"],
    dpi: ["dpi::TEXT"],
    telefono: ["telefono::TEXT"],
    correo: ["correo"],
    municipio: ["municipio"],
    pais: ["pais"],
    estado: [
        "CASE WHEN estado THEN 'activo' ELSE 'inactivo' END"
    ],
    todos: [
        "nombre_razon_social",
        "tipo",
        "persona_contacto",
        "dpi::TEXT",
        "telefono::TEXT",
        "correo",
        "municipio",
        "pais",
        "CASE WHEN estado THEN 'activo' ELSE 'inactivo' END"
    ]
};


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


function extraerCampos(body) {

    const {
        tipo,
        nombre_razon_social,
        dpi,
        persona_contacto,
        telefono,
        correo,
        direccion,
        municipio,
        pais,
        observaciones
    } = body;


    const tipoTexto =
        textoONulo(tipo);

    if (
        !tipoTexto ||
        !TIPOS_PATROCINADOR.includes(tipoTexto)
    ) {

        return {
            error:
                "El tipo debe ser persona o empresa."
        };
    }


    const nombre =
        textoONulo(nombre_razon_social);

    if (!nombre) {

        return {
            error:
                "El nombre o razón social es obligatorio."
        };
    }


    const enteros = {
        dpi: validarEnteroOpcional(dpi),
        telefono: validarEnteroOpcional(telefono)
    };

    for (const [campo, valor] of Object.entries(enteros)) {

        if (valor === false) {

            return {
                error:
                    `El campo ${campo} debe ser un nǧmero entero.`
            };

        }

    }


    return {
        valores: [
            tipoTexto,
            nombre,
            enteros.dpi,
            textoONulo(persona_contacto),
            enteros.telefono,
            textoONulo(correo),
            textoONulo(direccion),
            textoONulo(municipio),
            textoONulo(pais),
            textoONulo(observaciones)
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
                    id_patrocinador,
                    nombre_razon_social
                FROM patrocinador
                WHERE estado = TRUE
                ORDER BY nombre_razon_social
                `
            );


        return res.json({
            patrocinadores:
                result.rows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener patrocinadores."
        });

    }
}


async function listarPatrocinadores(
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
                mapa: MAPA_BUSQUEDA_PATROCINADORES,
                inicioParam: 1
            });

        const where =
            filtroBusqueda ? `WHERE ${filtroBusqueda}` : "";


        const totalResult =
            await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COUNT(*) FILTER (WHERE estado = TRUE)::INTEGER AS activos
                FROM patrocinador
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
                    ${COLUMNAS_PATROCINADOR}
                FROM patrocinador
                ${where}
                ORDER BY id_patrocinador DESC

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
            patrocinadores:
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
                "Error al obtener patrocinadores."
        });

    }
}


async function obtenerPatrocinador(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de patrocinador invǭlido."
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS_PATROCINADOR}
                FROM patrocinador
                WHERE id_patrocinador = $1
                LIMIT 1
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Patrocinador no encontrado."
            });

        }


        return res.json({
            patrocinador:
                result.rows[0]
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener patrocinador."
        });

    }
}


async function crearPatrocinador(
    req,
    res
) {

    try {

        const { error, valores } =
            extraerCampos(req.body);

        if (error) {

            return res.status(400).json({
                message: error
            });

        }


        const result =
            await pool.query(
                `
                INSERT INTO patrocinador (
                    tipo,
                    nombre_razon_social,
                    dpi,
                    persona_contacto,
                    telefono,
                    correo,
                    direccion,
                    municipio,
                    pais,
                    observaciones
                )
                VALUES (
                    $1, $2, $3, $4, $5,
                    $6, $7, $8, $9, $10
                )
                RETURNING
                    ${COLUMNAS_PATROCINADOR}
                `,
                valores
            );


        return res.status(201).json({

            message:
                "Patrocinador creado correctamente.",

            patrocinador:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al crear patrocinador."
        });

    }
}


async function editarPatrocinador(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de patrocinador invǭlido."
            });

        }


        const { error, valores } =
            extraerCampos(req.body);

        if (error) {

            return res.status(400).json({
                message: error
            });

        }


        const result =
            await pool.query(
                `
                UPDATE patrocinador
                SET
                    tipo = $1,
                    nombre_razon_social = $2,
                    dpi = $3,
                    persona_contacto = $4,
                    telefono = $5,
                    correo = $6,
                    direccion = $7,
                    municipio = $8,
                    pais = $9,
                    observaciones = $10
                WHERE id_patrocinador = $11
                RETURNING
                    ${COLUMNAS_PATROCINADOR}
                `,
                [...valores, id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Patrocinador no encontrado."
            });

        }


        return res.json({

            message:
                "Patrocinador actualizado correctamente.",

            patrocinador:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al actualizar patrocinador."
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
                    "ID de patrocinador invǭlido."
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
                UPDATE patrocinador
                SET estado = $1
                WHERE id_patrocinador = $2
                RETURNING
                    id_patrocinador,
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
                    "Patrocinador no encontrado."
            });

        }


        return res.json({

            message:
                "Estado actualizado correctamente.",

            patrocinador:
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
    listarOpciones,
    listarPatrocinadores,
    obtenerPatrocinador,
    crearPatrocinador,
    editarPatrocinador,
    cambiarEstado
};
