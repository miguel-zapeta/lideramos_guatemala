const pool =
    require("../config/database");

const {
    leerPaginacion,
    construirBusqueda,
    metaPaginacion
} = require("../utils/paginacion");


const MAPA_BUSQUEDA_RUBROS = {
    nombre: ["nombre"],
    descripcion: ["descripcion"],
    estado: [
        "CASE WHEN estado THEN 'activo' ELSE 'inactivo' END"
    ],
    todos: [
        "nombre",
        "descripcion",
        "CASE WHEN estado THEN 'activo' ELSE 'inactivo' END"
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
                    id_rubro,
                    nombre,
                    estado
                FROM rubro
                WHERE estado = TRUE
                ORDER BY nombre
                `
            );


        return res.json({
            rubros:
                result.rows
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener rubros."
        });

    }
}


async function listarRubros(
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
                mapa: MAPA_BUSQUEDA_RUBROS,
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
                FROM rubro
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
                    id_rubro,
                    nombre,
                    descripcion,
                    estado
                FROM rubro
                ${where}
                ORDER BY id_rubro DESC

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
            rubros:
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
                "Error al obtener rubros."
        });

    }
}


async function obtenerRubro(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de rubro inválido."
            });

        }


        const result =
            await pool.query(
                `
                SELECT
                    id_rubro,
                    nombre,
                    descripcion,
                    estado
                FROM rubro
                WHERE id_rubro = $1
                LIMIT 1
                `,
                [id]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Rubro no encontrado."
            });

        }


        return res.json({
            rubro:
                result.rows[0]
        });

    } catch (error) {

        console.error(error);

        return res.status(500).json({
            message:
                "Error al obtener rubro."
        });

    }
}


async function crearRubro(
    req,
    res
) {

    try {

        const {
            nombre,
            descripcion
        } = req.body;


        if (!nombre || !nombre.trim()) {

            return res.status(400).json({
                message:
                    "El nombre es obligatorio."
            });

        }


        const result =
            await pool.query(
                `
                INSERT INTO rubro (
                    nombre,
                    descripcion
                )
                VALUES ($1, $2)
                RETURNING
                    id_rubro,
                    nombre,
                    descripcion,
                    estado
                `,
                [
                    nombre.trim(),
                    descripcion && descripcion.trim() !== ""
                        ? descripcion.trim()
                        : null
                ]
            );


        return res.status(201).json({

            message:
                "Rubro creado correctamente.",

            rubro:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);


        if (
            error.code === "23505"
        ) {

            return res.status(409).json({
                message:
                    "Ya existe un rubro con ese nombre."
            });

        }


        return res.status(500).json({
            message:
                "Error al crear rubro."
        });

    }
}


async function editarRubro(
    req,
    res
) {

    try {

        const id =
            Number(req.params.id);


        if (!Number.isInteger(id)) {

            return res.status(400).json({
                message:
                    "ID de rubro inválido."
            });

        }


        const {
            nombre,
            descripcion
        } = req.body;


        if (!nombre || !nombre.trim()) {

            return res.status(400).json({
                message:
                    "El nombre es obligatorio."
            });

        }


        const result =
            await pool.query(
                `
                UPDATE rubro
                SET
                    nombre = $1,
                    descripcion = $2
                WHERE id_rubro = $3
                RETURNING
                    id_rubro,
                    nombre,
                    descripcion,
                    estado
                `,
                [
                    nombre.trim(),
                    descripcion && descripcion.trim() !== ""
                        ? descripcion.trim()
                        : null,
                    id
                ]
            );


        if (result.rows.length === 0) {

            return res.status(404).json({
                message:
                    "Rubro no encontrado."
            });

        }


        return res.json({

            message:
                "Rubro actualizado correctamente.",

            rubro:
                result.rows[0]

        });

    } catch (error) {

        console.error(error);


        if (
            error.code === "23505"
        ) {

            return res.status(409).json({
                message:
                    "Ya existe un rubro con ese nombre."
            });

        }


        return res.status(500).json({
            message:
                "Error al actualizar rubro."
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
                    "ID de rubro inválido."
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
                UPDATE rubro
                SET estado = $1
                WHERE id_rubro = $2
                RETURNING
                    id_rubro,
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
                    "Rubro no encontrado."
            });

        }


        return res.json({

            message:
                "Estado actualizado correctamente.",

            rubro:
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
    listarRubros,
    obtenerRubro,
    crearRubro,
    editarRubro,
    cambiarEstado
};
