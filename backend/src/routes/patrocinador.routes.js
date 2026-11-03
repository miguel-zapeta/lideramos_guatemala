const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    listarOpciones,
    listarPatrocinadores,
    obtenerPatrocinador,
    crearPatrocinador,
    editarPatrocinador,
    cambiarEstado
} = require(
    "../controllers/patrocinador.controller"
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

    listarPatrocinadores
);


router.get(
    "/:id",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    obtenerPatrocinador
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "finanzas.crear"
    ),

    crearPatrocinador
);


router.put(
    "/:id",
    authenticate,

    requirePermission(
        "finanzas.editar"
    ),

    editarPatrocinador
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
