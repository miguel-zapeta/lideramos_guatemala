const express = require("express");

const authenticate =
    require("../middleware/auth.middleware");

const {
    listarRoles
} = require(
    "../controllers/rol.controller"
);


const router =
    express.Router();


router.get(
    "/",
    authenticate,
    listarRoles
);


module.exports = router;
