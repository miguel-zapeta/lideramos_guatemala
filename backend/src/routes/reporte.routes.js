const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    generarReporteMensual
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

    generarReporteMensual
);


module.exports = router;
