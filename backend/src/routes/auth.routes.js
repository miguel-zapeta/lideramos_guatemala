const express = require("express");

const {
    login,
    me,
    logout
} = require(
    "../controllers/auth.controller"
);

const authenticate =
    require(
        "../middleware/auth.middleware"
    );


const router =
    express.Router();


router.post(
    "/login",
    login
);


router.get(
    "/me",
    authenticate,
    me
);


router.post(
    "/logout",
    authenticate,
    logout
);


module.exports = router;