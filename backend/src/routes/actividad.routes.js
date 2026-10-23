const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    listarOpciones,
    listarActividades,
    obtenerActividad,
    crearActividad,
    editarActividad,
    cambiarEstado
} = require(
    "../controllers/actividad.controller"
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
        "actividades.ver"
    ),

    listarActividades
);


router.get(
    "/:id",
    authenticate,

    requirePermission(
        "actividades.ver"
    ),

    obtenerActividad
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "actividades.crear"
    ),

    crearActividad
);


router.put(
    "/:id",
    authenticate,

    requirePermission(
        "actividades.editar"
    ),

    editarActividad
);


router.patch(
    "/:id/estado",
    authenticate,

    requirePermission(
        "actividades.editar"
    ),

    cambiarEstado
);


module.exports = router;
