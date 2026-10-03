const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    listarCategorias,
    obtenerCategoria,
    crearCategoria,
    editarCategoria,
    cambiarEstadoCategoria
} = require(
    "../controllers/categoria_gasto.controller"
);


const router =
    express.Router();


router.get(
    "/",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    listarCategorias
);


router.get(
    "/:id",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    obtenerCategoria
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "finanzas.crear"
    ),

    crearCategoria
);


router.put(
    "/:id",
    authenticate,

    requirePermission(
        "finanzas.editar"
    ),

    editarCategoria
);


router.patch(
    "/:id/estado",
    authenticate,

    requirePermission(
        "finanzas.editar"
    ),

    cambiarEstadoCategoria
);


module.exports = router;
