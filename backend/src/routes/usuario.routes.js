const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    listarUsuarios,
    obtenerUsuario,
    crearUsuario,
    editarUsuario,
    cambiarEstado
} = require(
    "../controllers/usuario.controller"
);


const router =
    express.Router();


router.get(
    "/",
    authenticate,

    requirePermission(
        "usuarios.ver"
    ),

    listarUsuarios
);


router.get(
    "/:id",
    authenticate,

    requirePermission(
        "usuarios.ver"
    ),

    obtenerUsuario
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "usuarios.crear"
    ),

    crearUsuario
);


router.put(
    "/:id",
    authenticate,

    requirePermission(
        "usuarios.editar"
    ),

    editarUsuario
);


router.patch(
    "/:id/estado",
    authenticate,

    requirePermission(
        "usuarios.editar"
    ),

    cambiarEstado
);


module.exports = router;