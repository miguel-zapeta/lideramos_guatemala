const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    listarVoluntarios,
    obtenerVoluntario,
    crearVoluntario,
    editarVoluntario,
    eliminarVoluntario
} = require(
    "../controllers/voluntario.controller"
);


const router =
    express.Router();


router.get(
    "/",
    authenticate,

    requirePermission(
        "voluntarios.ver"
    ),

    listarVoluntarios
);


router.get(
    "/:id",
    authenticate,

    requirePermission(
        "voluntarios.ver"
    ),

    obtenerVoluntario
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "voluntarios.crear"
    ),

    crearVoluntario
);


router.put(
    "/:id",
    authenticate,

    requirePermission(
        "voluntarios.editar"
    ),

    editarVoluntario
);


router.delete(
    "/:id",
    authenticate,

    requirePermission(
        "voluntarios.eliminar"
    ),

    eliminarVoluntario
);


module.exports = router;
