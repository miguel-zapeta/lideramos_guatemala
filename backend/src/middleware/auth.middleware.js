const jwt = require("jsonwebtoken");

function authenticate(req, res, next) {

    const token = req.cookies.access_token;

    if (!token) {

        return res.status(401).json({
            message: "No autenticado."
        });

    }

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {

        return res.status(401).json({
            message: "Sesión inválida o expirada."
        });

    }
}

module.exports = authenticate;
