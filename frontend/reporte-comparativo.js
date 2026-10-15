/*
=========================================
REPORTE COMPARATIVO (planificado vs ejecutado)
Consultar: GET /api/reportes-comparativo
    ?id_proyecto=X&tipo_cambio=Y[&fecha_tipo_cambio=...&fuente_tipo_cambio=...]
Muestra el reporte en pantalla y permite exportarlo a Excel.
No se guarda en base de datos (se genera al momento).
=========================================
*/

let ultimoReporte = null;


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


function formatoUsd(monto) {

    const n = Number(monto);

    if (!Number.isFinite(n)) {
        return "$ 0.00";
    }

    return `$ ${n.toFixed(2)}`;
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


async function precargarTipoCambio(idProyecto) {

    document.getElementById("fecha_tipo_cambio").value = "";
    document.getElementById("tipo_cambio").value = "";
    document.getElementById("fuente_tipo_cambio").value = "";


    if (!idProyecto) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/proyectos/${idProyecto}`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        const p =
            data.proyecto || {};


        if (p.fecha_tipo_cambio) {

            document.getElementById("fecha_tipo_cambio").value =
                fechaCorta(p.fecha_tipo_cambio);
        }


        if (
            p.tipo_cambio !== null &&
            p.tipo_cambio !== undefined &&
            Number(p.tipo_cambio) > 0
        ) {

            document.getElementById("tipo_cambio").value =
                Number(p.tipo_cambio);
        }


        if (p.fuente_tipo_cambio) {

            document.getElementById("fuente_tipo_cambio").value =
                p.fuente_tipo_cambio;
        }

    } catch (error) {

        console.error(
            "Error precargando tipo de cambio:",
            error
        );
    }
}


function renderReporte(data) {

    const p = data.proyecto || {};
    const tc = Number(data.tipo_cambio);


    document.getElementById("reporteTitulo").textContent =
        p.nombre || "—";

    document.getElementById("repTipoCambio").textContent =
        `Tipo de cambio aplicado: ${Number.isFinite(tc) ? tc : "—"}`;

    document.getElementById("repSubvencion").textContent =
        formatoMonto(p.subvencion);

    document.getElementById("repFechaTc").textContent =
        fechaCorta(data.fecha_tipo_cambio) || "—";

    document.getElementById("repTc").textContent =
        Number.isFinite(tc) ? tc : "—";

    document.getElementById("repFuenteTc").textContent =
        data.fuente_tipo_cambio || "—";


    const tbody =
        document.getElementById("reporteTbody");

    const rubros =
        data.rubros || [];


    if (rubros.length === 0) {

        tbody.innerHTML =
            `<tr><td colspan="7">Este proyecto no tiene gastos esperados ni gastos registrados.</td></tr>`;

        return;
    }


    let html = "";


    for (const rubro of rubros) {

        html += `
            <tr>
                <td colspan="7"><strong>${escapeHtml(rubro.nombre)}</strong></td>
            </tr>`;

        for (const categoria of rubro.categorias) {

            html += `
                <tr>
                    <td style="padding-left: 28px;">${escapeHtml(categoria.nombre)}</td>
                    <td>${formatoMonto(categoria.costo_unidad)}</td>
                    <td>${categoria.unidades}</td>
                    <td>${formatoMonto(categoria.sol_local)}</td>
                    <td>${formatoUsd(categoria.sol_usd)}</td>
                    <td>${formatoMonto(categoria.ejec_nacional)}</td>
                    <td>${formatoUsd(categoria.ejec_usd)}</td>
                </tr>`;
        }


        const s = rubro.subtotal;

        html += `
            <tr>
                <td>Subtotal</td>
                <td></td>
                <td></td>
                <td><strong>${formatoMonto(s.sol_local)}</strong></td>
                <td><strong>${formatoUsd(s.sol_usd)}</strong></td>
                <td><strong>${formatoMonto(s.ejec_nacional)}</strong></td>
                <td><strong>${formatoUsd(s.ejec_usd)}</strong></td>
            </tr>`;
    }


    const t = data.totales || {};

    html += `
        <tr>
            <td><strong>Total general</strong></td>
            <td></td>
            <td></td>
            <td><strong>${formatoMonto(t.sol_local)}</strong></td>
            <td><strong>${formatoUsd(t.sol_usd)}</strong></td>
            <td><strong>${formatoMonto(t.ejec_nacional)}</strong></td>
            <td><strong>${formatoUsd(t.ejec_usd)}</strong></td>
        </tr>`;


    tbody.innerHTML = html;
}


async function generarReporte(event) {

    event.preventDefault();


    const idProyecto =
        document.getElementById("proyecto").value;

    const tipoCambioRaw =
        document.getElementById("tipo_cambio").value;

    const fechaTc =
        document.getElementById("fecha_tipo_cambio").value;

    const fuenteTc =
        document.getElementById("fuente_tipo_cambio").value.trim();


    if (!idProyecto) {

        mostrarMensaje("Selecciona un proyecto.", true);

        return;
    }


    const tipoCambio = Number(tipoCambioRaw);

    if (
        tipoCambioRaw === "" ||
        !Number.isFinite(tipoCambio) ||
        tipoCambio <= 0
    ) {

        mostrarMensaje(
            "El tipo de cambio es obligatorio y debe ser mayor a 0.",
            true
        );

        return;
    }


    const params =
        new URLSearchParams({
            id_proyecto: idProyecto,
            tipo_cambio: String(tipoCambio)
        });

    if (fechaTc) {
        params.append("fecha_tipo_cambio", fechaTc);
    }

    if (fuenteTc !== "") {
        params.append("fuente_tipo_cambio", fuenteTc);
    }


    mostrarMensaje("Generando reporte...", false);


    try {

        const response =
            await fetch(
                `/api/reportes-comparativo?${params.toString()}`,
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
            "Error generando reporte comparativo:",
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
    const tc = Number(ultimoReporte.tipo_cambio);


    const tabla = [
        [p.nombre || "Reporte comparativo"],
        ["Subvención", Number(p.subvencion)],
        ["Fecha tipo de cambio", fechaCorta(ultimoReporte.fecha_tipo_cambio) || "—"],
        ["Tipo de cambio", Number.isFinite(tc) ? tc : "—"],
        ["Fuente tipo de cambio", ultimoReporte.fuente_tipo_cambio || "—"],
        [],
        [
            "Categoría gasto",
            "Costo por unidad (local)",
            "N.º unidades",
            "Solicitado Rise Up (local)",
            "Solicitado Rise Up (USD)",
            "Ejecutado (nacional)",
            "Ejecutado (USD)"
        ]
    ];


    for (const rubro of ultimoReporte.rubros || []) {

        tabla.push([rubro.nombre]);

        for (const categoria of rubro.categorias) {

            tabla.push([
                "    " + categoria.nombre,
                Number(categoria.costo_unidad),
                Number(categoria.unidades),
                Number(categoria.sol_local),
                Number(categoria.sol_usd),
                Number(categoria.ejec_nacional),
                Number(categoria.ejec_usd)
            ]);
        }


        const s = rubro.subtotal;

        tabla.push([
            "Subtotal",
            "",
            "",
            Number(s.sol_local),
            Number(s.sol_usd),
            Number(s.ejec_nacional),
            Number(s.ejec_usd)
        ]);
    }


    const t = ultimoReporte.totales || {};

    tabla.push([
        "Total general",
        "",
        "",
        Number(t.sol_local),
        Number(t.sol_usd),
        Number(t.ejec_nacional),
        Number(t.ejec_usd)
    ]);


    const hoja =
        XLSX.utils.aoa_to_sheet(tabla);

    hoja["!cols"] = [
        { wch: 34 }, { wch: 22 }, { wch: 14 }, { wch: 24 },
        { wch: 22 }, { wch: 20 }, { wch: 16 }
    ];


    const libro =
        XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
        libro,
        hoja,
        "Reporte comparativo"
    );

    XLSX.writeFile(
        libro,
        `reporte_comparativo_proyecto_${(p.id_proyecto || "")}.xlsx`
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
        .getElementById("proyecto")
        .addEventListener("change", (e) => {

            precargarTipoCambio(e.target.value);
        });


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
