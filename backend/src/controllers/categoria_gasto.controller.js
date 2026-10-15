const pool =
    require("../config/database");

const {
    leerPaginacion,
    construirBusqueda,
    metaPaginacion
} = require("../utils/paginacion");


const COLUMNAS = `
    c.id_categoria,
    c.id_rubro,
    r.nombre AS rubro,
    c.nombre,
    c.descripcion,
    c.estado
`;


function validarRubro(idRubro) {

    if (
        idRubro === undefined ||
        idRubro === null ||
        idRubro === ""
    ) {
        return null;
    }

    const n = Number(idRubro);

    if (!Number.isInteger(n)) {
        return false;
    }

    return n;
}


const MAPA_BUSQUEDA_CATEGORIAS = {
    nombre: ["c.nombre"],
    descripcion: ["c.descripcion"],
    rubro: ["r.nombre"],
    estado: [
        "CASE WHEN c.estado THEN 'activo' ELSE 'inactivo' END"
    ],
    todos: [
        "c.nombre",
        "c.descripcion",
        "r.nombre",
        "CASE WHEN c.estado THEN 'activo' ELSE 'inactivo' END"
    ]
};


async function listarOpciones(
    req,
    res
) {

    try {

        const result =
            await pool.query(
                `
                SELECT
                    c.id_categoria,
                    c.id_rubro,
                    c.nombre,
                    c.estado,
                    r.nombre AS rubro
                FROM categoria_gasto c
                INNER JOIN rubro r
                    ON r.id_rubro = c.id_rubro
                WHERE c.estado = TRUE
                ORDER BY c.nombre
                `
            );


        return res.json({
            categorias:
                result.rows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener categorías."
        });

    }
}


async function listarCategorias(
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
                mapa: MAPA_BUSQUEDA_CATEGORIAS,
                inicioParam: 1
            });

        const where =
            filtroBusqueda ? `WHERE ${filtroBusqueda}` : "";


        const totalResult =
            await pool.query(
                `
                SELECT
                    COUNT(*)::INTEGER AS total,
                    COUNT(*) FILTER (WHERE c.estado = TRUE)::INTEGER AS activos
                FROM categoria_gasto c
                INNER JOIN rubro r
                    ON r.id_rubro = c.id_rubro
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
                    ${COLUMNAS}
                FROM categoria_gasto c
                INNER JOIN rubro r
                    ON r.id_rubro = c.id_rubro
                ${where}
                ORDER BY c.id_categoria DESC

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
            categorias:
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
                "Error al obtener categorías."
        });

    }
}


async function obtenerCategoria(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de categoría inválido."
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    ${COLUMNAS}
                FROM categoria_gasto c
                INNER JOIN rubro r
                    ON r.id_rubro = c.id_rubro
                WHERE c.id_categoria = $1
                LIMIT 1
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Categoría no encontrada."
            });

        }


        return res.json({
            categoria:
                result.rows[0]
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener categoría."
        });

    }
}


async function crearCategoria(
    req,
    res
) {

    try {

        const {
            id_rubro,
            nombre,
            descripcion
        } = req.body;


        const rubroNum = validarRubro(id_rubro);

        if (rubroNum === null || rubroNum === false) {

            return res.status(400).json({
                message:
                    "El rubro es obligatorio y debe ser un ID válido."
            });

        }


        if (!nombre || !nombre.trim()) {

            return res.status(400).json({
                message:
                    "El nombre es obligatorio."
            });

        }


        let result;

        try {

            result =
                await pool.query(
                    `
                    INSERT INTO categoria_gasto (
                        id_rubro,
                        nombre,
                        descripcion
                    )
                    VALUES ($1, $2, $3)
                    RETURNING
                        id_categoria,
                        id_rubro,
                        nombre,
                        descripcion,
                        estado
                    `,
                    [
                        rubroNum,
                        nombre.trim(),
                        descripcion && descripcion.trim() !== ""
                            ? descripcion.trim()
                            : null
                    ]
                );

        } catch (dbError) {

            if (dbError.code === "23503") {

                return res.status(400).json({
                    message:
                        "El rubro indicado no existe."
                });

            }

            if (dbError.code === "23505") {

                return res.status(409).json({
                    message:
                        "Ya existe una categoría con ese nombre."
                });

            }

            throw dbError;
        }


        return res.status(201).json({

            message:
                "Categoría creada correctamente.",

            categoria:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al crear categoría."
        });

    }
}


async function editarCategoria(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de categoría inválido."
            });

        }


        const {
            id_rubro,
            nombre,
            descripcion
        } = req.body;


        const rubroNum = validarRubro(id_rubro);

        if (rubroNum === null || rubroNum === false) {

            return res.status(400).json({
                message:
                    "El rubro es obligatorio y debe ser un ID válido."
            });

        }


        if (!nombre || !nombre.trim()) {

            return res.status(400).json({
                message:
                    "El nombre es obligatorio."
            });

        }


        let result;

        try {

            result =
                await pool.query(
                    `
                    UPDATE categoria_gasto
                    SET
                        id_rubro = $1,
                        nombre = $2,
                        descripcion = $3
                    WHERE id_categoria = $4
                    RETURNING
                        id_categoria,
                        id_rubro,
                        nombre,
                        descripcion,
                        estado
                    `,
                    [
                        rubroNum,
                        nombre.trim(),
                        descripcion && descripcion.trim() !== ""
                            ? descripcion.trim()
                            : null,
                        id
                    ]
                );

        } catch (dbError) {

            if (dbError.code === "23503") {

                return res.status(400).json({
                    message:
                        "El rubro indicado no existe."
                });

            }

            if (dbError.code === "23505") {

                return res.status(409).json({
                    message:
                        "Ya existe una categoría con ese nombre."
                });

            }

            throw dbError;
        }


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Categoría no encontrada."
            });

        }


        return res.json({

            message:
                "Categoría actualizada correctamente.",

            categoria:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al actualizar categoría."
        });

    }
}


async function cambiarEstadoCategoria(
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
                    "ID de categoría inválido."
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
                UPDATE categoria_gasto
                SET estado = $1
                WHERE id_categoria = $2
                RETURNING
                    id_categoria,
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
                    "Categoría no encontrada."
            });

        }


        return res.json({

            message:
                "Estado actualizado correctamente.",

            categoria:
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
    listarCategorias,
    obtenerCategoria,
    crearCategoria,
    editarCategoria,
    cambiarEstadoCategoria
};
