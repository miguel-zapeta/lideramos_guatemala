const pool =
    require("../config/database");

const {
    leerPaginacion,
    construirBusqueda,
    metaPaginacion
} = require("../utils/paginacion");


const COLUMNAS_LISTA = `
    p.id_persona,
    p.nombres,
    p.apellidos,
    p.edad,
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
    edad: ["p.edad::TEXT"],
    estado: [
        "CASE WHEN p.estado THEN 'activo' ELSE 'inactivo' END"
    ],
    todos: [
        "p.nombres",
        "p.apellidos",
        "p.municipio",
        "p.centro_educativo",
        "p.jornada",
        "p.edad::TEXT",
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


    const edadNum = validarEdad(edad);

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
                    $10, $11, $12, $13, $14, $15, $16, $17
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
                    dpi = $4,
                    municipio = $5,
                    telefono = $6,
                    centro_educativo = $7,
                    jornada = $8,
                    encargado = $9,
                    telefono_encargado = $10,
                    dpi_del_encargado = $11,
                    carta_compromiso = $12,
                    carta_medios_comunicacion = $13,
                    dpi18 = $14,
                    certificado_nacimiento = $15,
                    dpi_encargado = $16,
                    biografia = $17
                WHERE id_persona = $18
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


        const voluntario =
            result.rows[0];

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
    listarOpciones,
    listarVoluntarios,
    obtenerVoluntario,
    crearVoluntario,
    editarVoluntario,
    eliminarVoluntario,
    cambiarEstado
};
