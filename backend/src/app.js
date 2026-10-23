require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authRoutes =
    require("./routes/auth.routes");

const usuarioRoutes =
    require("./routes/usuario.routes");

const rolRoutes =
    require("./routes/rol.routes");

const voluntarioRoutes =
    require("./routes/voluntario.routes");

const categoriaGastoRoutes =
    require("./routes/categoria_gasto.routes");

const rubroRoutes =
    require("./routes/rubro.routes");

const gastoRoutes =
    require("./routes/gasto.routes");

const proyectoRoutes =
    require("./routes/proyecto.routes");

const gastoEsperadoRoutes =
    require("./routes/gasto_esperado.routes");

const actividadRoutes =
    require("./routes/actividad.routes");

const asistenciaRoutes =
    require("./routes/asistencia.routes");

const reporteRoutes =
    require("./routes/reporte.routes");

const reporteAcumulativoRoutes =
    require("./routes/reporte-acumulativo.routes");

const comparativoRoutes =
    require("./routes/comparativo.routes");

const archivoRoutes =
    require("./routes/archivo.routes");

const requirePagePermission =
    require("./middleware/page-permission.middleware");


const PAGINAS = [
    ["usuarios.html", "usuarios.ver"],
    ["nuevoUsuario.html", "usuarios.ver"],
    ["voluntarios.html", "voluntarios.ver"],
    ["nuevoVoluntario.html", "voluntarios.ver"],
    ["finanzas.html", "finanzas.ver"],
    ["gastos.html", "finanzas.ver"],
    ["nuevoGasto.html", "finanzas.ver"],
    ["categorias-gasto.html", "finanzas.ver"],
    ["nuevaCategoriaGasto.html", "finanzas.ver"],
    ["rubros.html", "finanzas.ver"],
    ["nuevoRubro.html", "finanzas.ver"],
    ["proyectos.html", "proyectos.ver"],
    ["nuevoProyecto.html", "proyectos.ver"],
    ["actividades.html", "actividades.ver"],
    ["crearActividad.html", "actividades.ver"],
    ["reporte-mensual.html", "finanzas.ver"],
    ["reporte-acumulativo.html", "finanzas.ver"],
    ["reporte-comparativo.html", "finanzas.ver"],
    ["archivos.html", "reportes.ver"]
];


const app = express();


/*
=========================================
SEGURIDAD
=========================================
*/

app.use(
    helmet()
);


/*
=========================================
CORS
=========================================
*/

app.use(
    cors({
        origin: process.env.FRONTEND_URL,
        credentials: true
    })
);


/*
=========================================
BODY
=========================================
*/

app.use(
    express.json({
        limit: "10kb"
    })
);

app.use(
    express.urlencoded({
        extended: false,
        limit: "10kb"
    })
);


/*
=========================================
COOKIES
=========================================
*/

app.use(
    cookieParser()
);


/*
=========================================
RATE LIMIT LOGIN
=========================================
*/

const loginLimiter =
    rateLimit({

        windowMs: 15 * 60 * 1000,

        limit: 10,

        standardHeaders: true,

        legacyHeaders: false,

        message: {
            message:
                "Demasiados intentos de inicio de sesión. Intenta nuevamente más tarde."
        }

    });


app.use(
    "/api/auth/login",
    loginLimiter
);


/*
=========================================
API
=========================================
*/

app.use(
    "/api/auth",
    authRoutes
);

app.use(
    "/api/usuarios",
    usuarioRoutes
);

app.use(
    "/api/roles",
    rolRoutes
);

app.use(
    "/api/voluntarios",
    voluntarioRoutes
);

app.use(
    "/api/categorias-gasto",
    categoriaGastoRoutes
);

app.use(
    "/api/rubros",
    rubroRoutes
);

app.use(
    "/api/gastos",
    gastoRoutes
);

app.use(
    "/api/proyectos",
    proyectoRoutes
);

app.use(
    "/api/gastos-esperados",
    gastoEsperadoRoutes
);

app.use(
    "/api/actividades",
    actividadRoutes
);

app.use(
    "/api/asistencias",
    asistenciaRoutes
);


app.use(
    "/api/reportes-mensuales",
    reporteRoutes
);


app.use(
    "/api/reportes-acumulativo",
    reporteAcumulativoRoutes
);


app.use(
    "/api/reportes-comparativo",
    comparativoRoutes
);


app.use(
    "/api/archivos",
    archivoRoutes
);


/*
=========================================
FRONTEND
=========================================
*/

const frontendPath =
    path.join(
        __dirname,
        "../../frontend"
    );


/*
=========================================
INDEX
=========================================
*/

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                frontendPath,
                "index.html"
            )
        );

    }
);


app.get(
    "/login.html",
    (req, res) => {

        res.sendFile(
            path.join(
                frontendPath,
                "login.html"
            )
        );

    }
);


app.get(
    "/recuperar.html",
    (req, res) => {

        res.sendFile(
            path.join(
                frontendPath,
                "recuperar.html"
            )
        );

    }
);


app.get(
    "/restablecer.html",
    (req, res) => {

        res.sendFile(
            path.join(
                frontendPath,
                "restablecer.html"
            )
        );

    }
);


/*
=========================================
PÁGINAS PROTEGIDAS
=========================================
*/

/*
=========================================
PÁGINAS PROTEGIDAS
Sesión + permiso "<modulo>.ver".
Sin permiso redirige a la primera
página disponible del usuario.
=========================================
*/

for (const [pagina, permiso] of PAGINAS) {

    app.get(
        `/${pagina}`,
        requirePagePermission(permiso),
        (req, res) => {

            res.sendFile(
                path.join(
                    frontendPath,
                    pagina
                )
            );

        }
    );
}


/*
=========================================
ARCHIVOS ESTÁTICOS
=========================================
*/

app.use(
    express.static(frontendPath)
);


/*
=========================================
HEALTH CHECK
=========================================
*/

app.get(
    "/api/health",
    (req, res) => {

        res.json({
            status: "ok",
            message:
                "API funcionando correctamente."
        });

    }
);


/*
=========================================
404
=========================================
*/

app.use(
    (req, res) => {

        res.status(404).json({
            message:
                "Ruta no encontrada."
        });

    }
);


/*
=========================================
INICIAR SERVIDOR
=========================================
*/

const PORT =
    process.env.PORT || 3000;

app.listen(
    PORT,
    () => {

        console.log(
            `Servidor ejecutándose en http://localhost:${PORT}`
        );

    }
);
