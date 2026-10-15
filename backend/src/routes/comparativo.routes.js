const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const requirePermission =
    require("../middleware/permission.middleware");

const {
    generarReporteComparativo
} = require(
    "../controllers/comparativo.controller"
);


const router =
    express.Router();


router.get(
    "/",
    authenticate,

    requirePermission(
        "finanzas.ver"
    ),

    generarReporteComparativo
);


module.exports = router;
