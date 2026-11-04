const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    subirReciboMiddleware,
    listarGastos,
    obtenerGasto,
    obtenerGastoRecibo,
    crearGasto,
    editarGasto,
    cambiarEstado
} = require(
    "../controllers/gasto.controller"
);


const router =
    express.Router();


router.get(
    "/",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    listarGastos
);


router.get(
    "/:id/recibo",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    obtenerGastoRecibo
);


router.get(
    "/:id",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    obtenerGasto
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "finanzas.crear"
    ),

    subirReciboMiddleware,

    crearGasto
);


router.put(
    "/:id",
    authenticate,

    requirePermission(
        "finanzas.editar"
    ),

    subirReciboMiddleware,

    editarGasto
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
