const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    listarProyectoPatrocinadores,
    obtenerProyectoPatrocinador,
    obtenerReciboPatrocinio,
    crearProyectoPatrocinador,
    editarProyectoPatrocinador,
    cambiarEstado
} = require(
    "../controllers/proyecto_patrocinador.controller"
);


const router =
    express.Router();


router.get(
    "/",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    listarProyectoPatrocinadores
);


router.get(
    "/:id/recibo",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    obtenerReciboPatrocinio
);


router.get(
    "/:id",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    obtenerProyectoPatrocinador
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "finanzas.crear"
    ),

    crearProyectoPatrocinador
);


router.put(
    "/:id",
    authenticate,

    requirePermission(
        "finanzas.editar"
    ),

    editarProyectoPatrocinador
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
