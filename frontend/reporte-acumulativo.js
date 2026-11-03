/*
=========================================
REPORTE ACUMULATIVO
Consultar: GET /api/reportes-acumulativo?id_proyecto=X&inicio=YYYY-MM&fin=YYYY-MM
Matriz: categorías (por rubro) x meses del periodo.
Muestra el reporte en pantalla y permite exportarlo a Excel.
No se guarda en base de datos (se genera al momento).
=========================================
*/

let ultimoReporte = null;


const MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

const MESES_ABR = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic"
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


function mesCorto(mes) {

    if (typeof mes !== "string" || !/^\d{4}-\d{2}$/.test(mes)) {
        return mes || "—";
    }

    return `${MESES_ABR[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
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
    const meses = data.meses || [];


    document.getElementById("reporteTitulo").textContent =
        p.nombre || "—";

    document.getElementById("repPeriodo").textContent =
        meses.length
            ? `Periodo: ${mesLargo(meses[0])} – ${mesLargo(meses[meses.length - 1])}`
            : "—";

    document.getElementById("repFechaInicio").textContent =
        fechaCorta(p.fecha_inicio) || "—";

    document.getElementById("repFechaFin").textContent =
        fechaCorta(p.fecha_finalizacion) || "—";

    document.getElementById("repEnte").textContent =
        p.ente_patrocinador || "—";

    document.getElementById("repAsociacion").textContent =
        p.asociacion_gestora || "—";


    document.getElementById("reporteHeadRow").innerHTML =
        `<th>Categoría del gasto</th>` +
        meses.map((mes) => `<th>${mesCorto(mes)}</th>`).join("") +
        `<th>Gasto ejecutado por rubro</th>` +
        `<th>Subvención en local</th>` +
        `<th>Saldo</th>`;


    const tbody =
        document.getElementById("reporteTbody");

    const rubros =
        data.rubros || [];

    const totalesMes =
        data.totales_mes || {};

    const numColumnas =
        meses.length + 4;


    if (rubros.length === 0) {

        tbody.innerHTML =
            `<tr><td colspan="${numColumnas}">Este proyecto no tiene gastos registrados en el periodo.</td></tr>`;

        return;
    }


    let html = "";


    for (const rubro of rubros) {

        html += `
            <tr>
                <td><strong>${escapeHtml(rubro.nombre)}</strong></td>
                ${meses.map(() => `<td></td>`).join("")}
                <td><strong>${formatoMonto(rubro.total)}</strong></td>
                <td></td>
                <td></td>
            </tr>`;

        for (const categoria of rubro.categorias) {

            html += `
                <tr>
                    <td style="padding-left: 28px;">${escapeHtml(categoria.nombre)}</td>
                    ${meses.map((mes) => `<td>${formatoMonto(categoria.meses[mes] || 0)}</td>`).join("")}
                    <td></td>
                    <td></td>
                    <td></td>
                </tr>`;
        }
    }


    html += `
        <tr>
            <td><strong>TOTALES</strong></td>
            ${meses.map((mes) => `<td><strong>${formatoMonto(totalesMes[mes] || 0)}</strong></td>`).join("")}
            <td><strong>${formatoMonto(data.total_general)}</strong></td>
            <td><strong>${formatoMonto(data.subvencion_local)}</strong></td>
            <td><strong>${formatoMonto(data.saldo)}</strong></td>
        </tr>`;


    tbody.innerHTML = html;
}


async function generarReporte(event) {

    event.preventDefault();


    const idProyecto =
        document.getElementById("proyecto").value;

    const inicio =
        document.getElementById("inicio").value;

    const fin =
        document.getElementById("fin").value;


    if (!idProyecto) {

        mostrarMensaje("Selecciona un proyecto.", true);

        return;
    }


    if (!inicio || !fin) {

        mostrarMensaje(
            "Selecciona el mes de inicio y el mes de fin.",
            true
        );

        return;
    }


    if (fin < inicio) {

        mostrarMensaje(
            "El mes de fin no puede ser anterior al mes de inicio.",
            true
        );

        return;
    }


    mostrarMensaje("Generando reporte...", false);


    try {

        const response =
            await fetch(
                `/api/reportes-acumulativo?id_proyecto=${encodeURIComponent(idProyecto)}&inicio=${encodeURIComponent(inicio)}&fin=${encodeURIComponent(fin)}`,
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
            "Error generando reporte acumulativo:",
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
    const meses = ultimoReporte.meses || [];
    const totalesMes = ultimoReporte.totales_mes || {};

    const periodoTexto = meses.length
        ? `${mesLargo(meses[0])} – ${mesLargo(meses[meses.length - 1])}`
        : "—";


    const tabla = [
        [p.nombre || "Reporte acumulativo"],
        ["Periodo", periodoTexto],
        ["Fecha de inicio", fechaCorta(p.fecha_inicio) || "—"],
        ["Fecha de finalización", fechaCorta(p.fecha_finalizacion) || "—"],
        ["Ente patrocinador", p.ente_patrocinador || "—"],
        ["Asociación gestora", p.asociacion_gestora || "—"],
        [],
        [
            "Categoría del gasto",
            ...meses.map(mesCorto),
            "Gasto ejecutado por rubro",
            "Subvención en local",
            "Saldo"
        ]
    ];


    for (const rubro of ultimoReporte.rubros || []) {

        const filaRubro = [rubro.nombre];

        for (let i = 0; i < meses.length; i++) {
            filaRubro.push("");
        }

        filaRubro.push(Number(rubro.total), "", "");

        tabla.push(filaRubro);


        for (const categoria of rubro.categorias) {

            const filaCategoria = ["    " + categoria.nombre];

            for (const mes of meses) {
                filaCategoria.push(Number(categoria.meses[mes] || 0));
            }

            filaCategoria.push("", "", "");

            tabla.push(filaCategoria);
        }
    }


    const filaTotales = ["TOTALES"];

    for (const mes of meses) {
        filaTotales.push(Number(totalesMes[mes] || 0));
    }

    filaTotales.push(
        Number(ultimoReporte.total_general),
        Number(ultimoReporte.subvencion_local),
        Number(ultimoReporte.saldo)
    );

    tabla.push([], filaTotales);


    const hoja =
        XLSX.utils.aoa_to_sheet(tabla);

    hoja["!cols"] = [
        { wch: 34 },
        ...meses.map(() => ({ wch: 12 })),
        { wch: 22 },
        { wch: 18 },
        { wch: 16 }
    ];


    const libro =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        libro,
        hoja,
        "Reporte acumulativo"
    );

    XLSX.writeFile(
        libro,
        `reporte_acumulativo_${meses[0] || ""}_${meses[meses.length - 1] || ""}.xlsx`
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
