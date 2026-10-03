const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    listarGastosEsperados,
    obtenerGastoEsperado,
    crearGastoEsperado,
    editarGastoEsperado,
    cambiarEstado
} = require(
    "../controllers/gasto_esperado.controller"
);


const router =
    express.Router();


router.get(
    "/",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    listarGastosEsperados
);


router.get(
    "/:id",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    obtenerGastoEsperado
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "finanzas.crear"
    ),

    crearGastoEsperado
);


router.put(
    "/:id",
    authenticate,

    requirePermission(
        "finanzas.editar"
    ),

    editarGastoEsperado
);


router.patch(
    "/:id/estado",
    authenticate,

    requirePermission(
        "finanzas.editar"
    ),

    cambiarEstado
);


module.exports = router;
