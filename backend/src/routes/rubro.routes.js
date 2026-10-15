const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    listarOpciones,
    listarRubros,
    obtenerRubro,
    crearRubro,
    editarRubro,
    cambiarEstado
} = require(
    "../controllers/rubro.controller"
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
        "finanzas.ver"
    ),

    listarRubros
);


router.get(
    "/:id",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    obtenerRubro
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "finanzas.crear"
    ),

    crearRubro
);


router.put(
    "/:id",
    authenticate,

    requirePermission(
        "finanzas.editar"
    ),

    editarRubro
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
