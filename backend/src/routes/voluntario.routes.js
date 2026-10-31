const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    listarOpciones,
    listarVoluntarios,
    obtenerVoluntario,
    listarDocumentos,
    obtenerDocumentoContenido,
    crearVoluntario,
    editarVoluntario,
    eliminarVoluntario,
    cambiarEstado,
    subirAdjuntosMiddleware
} = require(
    "../controllers/voluntario.controller"
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


router.get(
    "/:id/documentos",
    authenticate,

    requirePermission(
        "voluntarios.ver"
    ),

    listarDocumentos
);


router.get(
    "/:id/documentos/:idArchivo",
    authenticate,

    requirePermission(
        "voluntarios.ver"
    ),

    obtenerDocumentoContenido
);


router.post(
    "/",
    authenticate,

    requirePermission(
        "voluntarios.crear"
    ),

    subirAdjuntosMiddleware,

    crearVoluntario
);


router.put(
    "/:id",
    authenticate,

    requirePermission(
        "voluntarios.editar"
    ),

    subirAdjuntosMiddleware,

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


router.patch(
    "/:id/estado",
    authenticate,

    requirePermission(
        "voluntarios.editar"
    ),

    cambiarEstado
);


module.exports = router;
