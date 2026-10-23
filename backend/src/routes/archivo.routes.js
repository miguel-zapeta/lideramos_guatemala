const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    subirArchivosMiddleware,
    guardarArchivos,
    listarArchivos,
    obtenerContenido,
    eliminarArchivo
} = require(
    "../controllers/archivo.controller"
);


const router =
    express.Router();


router.get(
    "/",
    authenticate,

    requirePermission(
        "reportes.ver"
    ),

    listarArchivos
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "reportes.crear"
    ),

    subirArchivosMiddleware,

    guardarArchivos
);


router.get(
    "/:id/contenido",
    authenticate,

    requirePermission(
        "reportes.ver"
    ),

    obtenerContenido
);


router.delete(
    "/:id",
    authenticate,

    requirePermission(
        "reportes.eliminar"
    ),

    eliminarArchivo
);


module.exports = router;
