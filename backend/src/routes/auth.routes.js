const express = require("express");

const rateLimit = require("express-rate-limit");

const {
    login,
    me,
    logout,
    solicitarRecuperacionPassword,
    solicitarRecuperacionUsuario,
    restablecerPassword
} = require(
    "../controllers/auth.controller"
);

const authenticate =
    require(
        "../middleware/auth.middleware"
    );


const router =
    express.Router();


const recoveryLimiter =
    rateLimit({

        windowMs: 15 * 60 * 1000,

        limit: 5,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            message:
                "Demasiados intentos. Intenta nuevamente más tarde."
        }

    });


router.post(
    "/login",
    login
);


router.post(
    "/recuperar-password",
    recoveryLimiter,
    solicitarRecuperacionPassword
);


router.post(
    "/recuperar-usuario",
    recoveryLimiter,
    solicitarRecuperacionUsuario
);


router.post(
    "/restablecer-password",
    recoveryLimiter,
    restablecerPassword
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