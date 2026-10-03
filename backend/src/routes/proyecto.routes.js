const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    listarOpciones,
    listarProyectos,
    obtenerProyecto,
    crearProyecto,
    editarProyecto,
    cambiarEstado
} = require(
    "../controllers/proyecto.controller"
);


const router =
    express.Router();


router.get(
    "/opciones",
    authenticate,

    listarOpciones
);


router.get(
    "/",
    authenticate,

    requirePermission(
        "proyectos.ver"
    ),

    listarProyectos
);


router.get(
    "/:id",
    authenticate,

    requirePermission(
        "proyectos.ver"
    ),

    obtenerProyecto
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "proyectos.crear"
    ),

    crearProyecto
);


router.put(
    "/:id",
    authenticate,

    requirePermission(
        "proyectos.editar"
    ),

    editarProyecto
);


router.patch(
    "/:id/estado",
    authenticate,

    requirePermission(
        "proyectos.editar"
    ),

    cambiarEstado
);


module.exports = router;
