const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    generarReporteAcumulativo
} = require(
    "../controllers/reporte.controller"
);


const router =
    express.Router();


router.get(
    "/",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    generarReporteAcumulativo
);


module.exports = router;
