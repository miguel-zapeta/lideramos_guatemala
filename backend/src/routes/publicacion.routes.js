const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    subirImagenMiddleware,
    listarPublicas,
    obtenerImagen,
    listarPublicaciones,
    crearPublicacion,
    editarPublicacion,
    cambiarEstado,
    eliminarPublicacion
} = require(
    "../controllers/publicacion.controller"
);


const router =
    express.Router();


/*
Públicos (sin sesión): páginas landing.
*/

router.get(
    "/publicas",
    listarPublicas
);


router.get(
    "/:id/imagen",
    obtenerImagen
);


/*
Admin (permisos publicaciones.*).
*/

router.get(
    "/",
    authenticate,

    requirePermission(
        "publicaciones.ver"
    ),

    listarPublicaciones
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "publicaciones.crear"
    ),

    subirImagenMiddleware,

    crearPublicacion
);


router.put(
    "/:id",
    authenticate,

    requirePermission(
        "publicaciones.editar"
    ),

    subirImagenMiddleware,

    editarPublicacion
);


router.patch(
    "/:id/estado",
    authenticate,

    requirePermission(
        "publicaciones.editar"
    ),

    cambiarEstado
);


router.delete(
    "/:id",
    authenticate,

    requirePermission(
        "publicaciones.eliminar"
    ),

    eliminarPublicacion
);


module.exports = router;
