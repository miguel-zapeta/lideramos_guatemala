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


function formatoMoneda(monto, moneda) {

    const n = Number(monto);

    const simbolos = {
        GTQ: "Q",
        USD: "$",
        EUR: "€",
        CAD: "C$",
        MXN: "MX$"
    };

    const simbolo = simbolos[moneda] || "";

    return `${simbolo} ${n.toFixed(2)}`.trim();
}


function renderReporte(data) {

    const p = data.proyecto || {};
    const tc = Number(data.tipo_cambio);

    const patro = data.patrocinadores || {};

    const nombres = patro.nombres || "—";

    const moneda = patro.moneda || "";


    document.getElementById("reporteTitulo").textContent =
        p.nombre || "—";

    document.getElementById("repTipoCambio").textContent =
        `Tipo de cambio aplicado: ${Number.isFinite(tc) ? tc : "—"}`;

    document.getElementById("repSubvencionDonante").textContent =
        formatoMoneda(p.subvencion, moneda);

    document.getElementById("repSubvencionNacional").textContent =
        formatoMonto(p.subvencion_nacional);

    document.getElementById("repFechaTc").textContent =
        fechaCorta(data.fecha_tipo_cambio) || "—";

    document.getElementById("repTc").textContent =
        Number.isFinite(tc) ? tc : "—";

    document.getElementById("repFuenteTc").textContent =
        data.fuente_tipo_cambio || "—";


    document.getElementById("thSolLocal").textContent =
        `Solicitado ${nombres} (local)`;

    document.getElementById("thSolMoneda").textContent =
        `Solicitado ${nombres} (${moneda || "moneda"})`;

    document.getElementById("thEjecMoneda").textContent =
        `Ejecutado (${moneda || "moneda"})`;


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
                    <td>${formatoMoneda(categoria.sol_usd, moneda)}</td>
                    <td>${formatoMonto(categoria.ejec_nacional)}</td>
                    <td>${formatoMoneda(categoria.ejec_usd, moneda)}</td>
                </tr>`;
        }


        const s = rubro.subtotal;

        html += `
            <tr>
                <td>Subtotal</td>
                <td></td>
                <td></td>
                <td><strong>${formatoMonto(s.sol_local)}</strong></td>
                <td><strong>${formatoMoneda(s.sol_usd, moneda)}</strong></td>
                <td><strong>${formatoMonto(s.ejec_nacional)}</strong></td>
                <td><strong>${formatoMoneda(s.ejec_usd, moneda)}</strong></td>
            </tr>`;
    }


    const t = data.totales || {};

    html += `
        <tr>
            <td><strong>Total general</strong></td>
            <td></td>
            <td></td>
            <td><strong>${formatoMonto(t.sol_local)}</strong></td>
            <td><strong>${formatoMoneda(t.sol_usd, moneda)}</strong></td>
            <td><strong>${formatoMonto(t.ejec_nacional)}</strong></td>
            <td><strong>${formatoMoneda(t.ejec_usd, moneda)}</strong></td>
        </tr>`;


    tbody.innerHTML = html;
}


async function generarReporte(event) {

    event.preventDefault();


    const idProyecto =
        document.getElementById("proyecto").value;


    if (!idProyecto) {

        mostrarMensaje("Selecciona un proyecto.", true);

        return;
    }


    // El tipo de cambio se toma de la información del
    // patrocinador dentro del proyecto.
    const params =
        new URLSearchParams({
            id_proyecto: idProyecto
        });


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

    const patro = ultimoReporte.patrocinadores || {};

    const nombres = patro.nombres || "—";

    const moneda = patro.moneda || "";


    const tabla = [
        [p.nombre || "Reporte comparativo"],
        ["Subvención en moneda del donante", formatoMoneda(p.subvencion, moneda)],
        ["Subvención en moneda nacional", formatoMonto(p.subvencion_nacional)],
        ["Fecha tipo de cambio", fechaCorta(ultimoReporte.fecha_tipo_cambio) || "—"],
        ["Tipo de cambio", Number.isFinite(tc) ? tc : "—"],
        ["Fuente tipo de cambio", ultimoReporte.fuente_tipo_cambio || "—"],
        [],
        [
            "Categoría gasto",
            "Costo por unidad (local)",
            "N.º unidades",
            `Solicitado ${nombres} (local)`,
            `Solicitado ${nombres} (${moneda || "moneda"})`,
            "Ejecutado (nacional)",
            `Ejecutado (${moneda || "moneda"})`
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
