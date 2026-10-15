/*
=========================================
REPORTE MENSUAL
Consultar: GET /api/reportes-mensuales?id_proyecto=X&mes=YYYY-MM
Muestra el reporte en pantalla y permite exportarlo a Excel.
No se guarda en base de datos (se genera al momento).
=========================================
*/

let ultimoReporte = null;


const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];


async function verificarSesion() {

    try {

        const response =
            await fetch(
                "/api/auth/me",
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!response.ok) {

            window.location.replace("/login.html");

            return null;
        }

        return await response.json();

    } catch (error) {

        console.error(error);

        window.location.replace("/login.html");

        return null;
    }
}


async function cerrarSesion() {

    try {

        await fetch(
            "/api/auth/logout",
            {
                method: "POST",
                credentials: "include"
            }
        );

    } finally {

        window.location.replace("/login.html");
    }
}


function mostrarMensaje(texto, esError) {

    const el =
        document.getElementById("formMessage");

    if (!el) {

        if (esError) alert(texto);

        return;
    }

    el.textContent = texto;
    el.style.color = esError ? "#d23c78" : "green";
}


function escapeHtml(valor) {

    if (valor === null || valor === undefined) {
        return "";
    }

    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}


function fechaCorta(fecha) {

    if (!fecha) return "";

    return String(fecha).slice(0, 10);
}


function formatoMonto(monto) {

    const n = Number(monto);

    if (!Number.isFinite(n)) {
        return "Q 0.00";
    }

    return `Q ${n.toFixed(2)}`;
}


function mesLargo(mes) {

    if (typeof mes !== "string" || !/^\d{4}-\d{2}$/.test(mes)) {
        return "—";
    }

    const anio = mes.slice(0, 4);
    const indice = Number(mes.slice(5, 7)) - 1;

    return `${MESES[indice] || "—"} de ${anio}`;
}


async function cargarProyectos() {

    const select =
        document.getElementById("proyecto");

    try {

        const response =
            await fetch(
                "/api/proyectos/opciones",
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!response.ok) {
            throw new Error("proyectos");
        }

        const data =
            await response.json();

        const lista =
            data.proyectos || [];

        select.innerHTML =
            `<option value="">Seleccione un proyecto</option>` +
            lista.map((p) =>
                `<option value="${p.id_proyecto}">${escapeHtml(p.nombre)}</option>`
            ).join("");

    } catch (error) {

        console.error(
            "Error cargando proyectos:",
            error
        );

        select.innerHTML =
            `<option value="">No se pudieron cargar los proyectos</option>`;
    }
}


function renderReporte(data) {

    const p = data.proyecto || {};


    document.getElementById("reporteTitulo").textContent =
        p.nombre || "—";

    document.getElementById("repMesLargo").textContent =
        `Reporte de ${mesLargo(data.mes)}`;

    document.getElementById("repFechaInicio").textContent =
        fechaCorta(p.fecha_inicio) || "—";

    document.getElementById("repFechaFin").textContent =
        fechaCorta(p.fecha_finalizacion) || "—";

    document.getElementById("repEnte").textContent =
        p.ente_patrocinador || "—";

    document.getElementById("repAsociacion").textContent =
        p.asociacion_gestora || "—";


    const tbody =
        document.getElementById("reporteTbody");

    const rubros =
        data.rubros || [];


    if (rubros.length === 0) {

        tbody.innerHTML =
            `<tr><td colspan="3">Este proyecto no tiene gastos registrados para este mes.</td></tr>`;

        return;
    }


    let html = "";


    for (const rubro of rubros) {

        html += `
            <tr>
                <td><strong>${escapeHtml(rubro.nombre)}</strong></td>
                <td></td>
                <td><strong>${formatoMonto(rubro.total)}</strong></td>
            </tr>`;

        for (const categoria of rubro.categorias) {

            html += `
                <tr>
                    <td style="padding-left: 28px;">${escapeHtml(categoria.nombre)}</td>
                    <td>${formatoMonto(categoria.subtotal)}</td>
                    <td></td>
                </tr>`;
        }
    }


    html += `
        <tr>
            <td><strong>Total general</strong></td>
            <td></td>
            <td><strong>${formatoMonto(data.total_general)}</strong></td>
        </tr>`;


    tbody.innerHTML = html;
}


async function generarReporte(event) {

    event.preventDefault();


    const idProyecto =
        document.getElementById("proyecto").value;

    const mes =
        document.getElementById("mes").value;


    if (!idProyecto) {

        mostrarMensaje("Selecciona un proyecto.", true);

        return;
    }


    if (!mes) {

        mostrarMensaje("Selecciona un mes.", true);

        return;
    }


    mostrarMensaje("Generando reporte...", false);


    try {

        const response =
            await fetch(
                `/api/reportes-mensuales?id_proyecto=${encodeURIComponent(idProyecto)}&mes=${encodeURIComponent(mes)}`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        if (response.status === 401) {

            window.location.replace("/login.html");

            return;
        }


        const data =
            await response.json().catch(() => ({}));


        if (response.status === 403) {

            mostrarMensaje(
                data.message ||
                    "No tienes permiso para generar reportes.",
                true
            );

            return;
        }


        if (!response.ok) {

            throw new Error(
                data.message ||
                    "No se pudo generar el reporte."
            );
        }


        ultimoReporte = data;

        renderReporte(data);

        document.getElementById("reporteMensaje").textContent = "";
        document.getElementById("reporteSection").style.display = "";


    } catch (error) {

        console.error(
            "Error generando reporte:",
            error
        );

        mostrarMensaje(error.message, true);
    }
}


function exportarExcel() {

    if (typeof XLSX === "undefined") {

        alert("No se pudo cargar la librería de Excel.");

        return;
    }


    if (!ultimoReporte) {

        alert("Primero genera un reporte.");

        return;
    }


    const p = ultimoReporte.proyecto || {};
    const mesTxt = ultimoReporte.mes || "";


    const tabla = [
        [p.nombre || "Reporte mensual"],
        ["Mes", mesLargo(mesTxt)],
        ["Fecha de inicio", fechaCorta(p.fecha_inicio) || "—"],
        ["Fecha de finalización", fechaCorta(p.fecha_finalizacion) || "—"],
        ["Ente patrocinador", p.ente_patrocinador || "—"],
        ["Asociación gestora", p.asociacion_gestora || "—"],
        [],
        ["Categoría gasto", "Subtotal", "Total"]
    ];


    for (const rubro of ultimoReporte.rubros || []) {

        tabla.push([rubro.nombre, "", Number(rubro.total)]);

        for (const categoria of rubro.categorias) {

            tabla.push([
                "    " + categoria.nombre,
                Number(categoria.subtotal),
                ""
            ]);
        }
    }


    tabla.push([], ["Total general", "", Number(ultimoReporte.total_general)]);


    const hoja =
        XLSX.utils.aoa_to_sheet(tabla);

    hoja["!cols"] = [
        { wch: 34 }, { wch: 16 }, { wch: 16 }
    ];


    const libro =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        libro,
        hoja,
        "Reporte mensual"
    );

    XLSX.writeFile(
        libro,
        `reporte_mensual_${mesTxt}.xlsx`
    );
}


async function init() {

    const sesion =
        await verificarSesion();

    if (!sesion) return;


    const nameEl = document.getElementById("currentUserName");
    const roleEl = document.getElementById("currentUserRole");
    const avatarEl = document.getElementById("currentUserAvatar");


    if (nameEl && sesion.usuario) {

        nameEl.textContent =
            `${sesion.usuario.nombre || ""} ${sesion.usuario.apellido || ""}`.trim();
    }

    if (roleEl && sesion.usuario) {

        roleEl.textContent = sesion.usuario.rol;
    }

    if (avatarEl && sesion.usuario) {

        const ini =
            ((sesion.usuario.nombre || "").charAt(0) +
             (sesion.usuario.apellido || "").charAt(0)).toUpperCase();

        avatarEl.textContent = ini || "?";
    }


    await cargarProyectos();


    document
        .getElementById("reporteForm")
        .addEventListener("submit", generarReporte);


    document
        .getElementById("exportButton")
        .addEventListener("click", exportarExcel);


    const logoutButton =
        document.querySelector(".logout");

    if (logoutButton) {

        logoutButton.addEventListener("click", (e) => {

            e.preventDefault();

            cerrarSesion();
        });
    }
}


init();
