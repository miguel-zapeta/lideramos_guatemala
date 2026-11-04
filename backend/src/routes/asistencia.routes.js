const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    listarAsistencia,
    marcarAsistencia,
    reemplazarAsistencia,
    quitarAsistencia
} = require(
    "../controllers/asistencia.controller"
);


const router =
    express.Router();


router.get(
    "/",
    authenticate,

    requirePermission(
        "actividades.ver"
    ),

    listarAsistencia
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "actividades.editar"
    ),

    marcarAsistencia
);


router.put(
    "/:id_actividad",
    authenticate,

    requirePermission(
        "actividades.editar"
    ),

    reemplazarAsistencia
);


router.delete(
    "/:id_actividad/:id_persona",
    authenticate,

    requirePermission(
        "actividades.editar"
    ),

    quitarAsistencia
);


module.exports = router;
