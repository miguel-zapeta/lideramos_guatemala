const jwt = require("jsonwebtoken");

function authenticatePage(req, res, next) {

    const token = req.cookies.access_token;

    if (!token) {
        return res.redirect("/login.html");
    }

    try {

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;

        next();

    } catch (error) {

        return res.redirect("/login.html");

    }
}

module.exports = authenticatePage;
