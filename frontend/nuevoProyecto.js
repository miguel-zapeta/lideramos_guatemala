/*
=========================================
NUEVO / VER / EDITAR PROYECTO
Crear: POST /api/proyectos (estado inicial: planeado)
Ver: ?id=X&modo=ver (solo lectura + botón Editar)
Editar: ?id=X -> PUT /api/proyectos/:id
Un proyecto finalizado ya no se puede editar.
=========================================
*/

let editId = null;
let modoVer = false;
let estadoActual = "planeado";
let permisosSesion = [];
let gastosEsperados = [];
let gastoEditId = null;
let gastosListenersOk = false;


const CAMPOS = [
    "nombre",
    "fecha_inicio",
    "fecha_finalizacion",
    "subvencion",
    "fecha_tipo_cambio",
    "tipo_cambio",
    "fuente_tipo_cambio",
    "total_gastos_ejecutados",
    "monto_total_solicitado_rise_up",
    "monto_total_subvencion",
    "diferencia_entre_solicitado_y_subvencion"
];

const CAMPOS_NUMERO = [
    "subvencion",
    "tipo_cambio",
    "total_gastos_ejecutados",
    "monto_total_solicitado_rise_up",
    "monto_total_subvencion",
    "diferencia_entre_solicitado_y_subvencion"
];

const CAMPOS_FECHA = [
    "fecha_inicio",
    "fecha_finalizacion",
    "fecha_tipo_cambio"
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


function setSoloLectura(soloLectura) {

    for (const id of [...CAMPOS, "estado"]) {

        const input = document.getElementById(id);

        if (input) input.disabled = soloLectura;
    }

    document.getElementById("submitButton").style.display =
        soloLectura ? "none" : "";

    document.getElementById("editButton").style.display =
        soloLectura ? "" : "none";
}


function fechaCorta(fecha) {

    if (!fecha) return "";

    return String(fecha).slice(0, 10);
}


async function cargarProyecto(id) {

    try {

        const response =
            await fetch(
                `/api/proyectos/${id}`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        if (response.status === 401) {

            window.location.replace("/login.html");

            return false;
        }


        if (response.status === 403) {

            mostrarMensaje(
                "No tienes permiso para ver proyectos.",
                true
            );

            return false;
        }


        if (response.status === 404) {

            mostrarMensaje(
                "Proyecto no encontrado.",
                true
            );

            return false;
        }


        if (!response.ok) {
            throw new Error("carga");
        }


        const data =
            await response.json();

        const p = data.proyecto;


        for (const campo of CAMPOS) {

            const input = document.getElementById(campo);

            if (!input) continue;

            let valor = p[campo];

            if (CAMPOS_FECHA.includes(campo)) {
                valor = fechaCorta(valor);
            }

            input.value =
                valor === null || valor === undefined ? "" : valor;
        }


        estadoActual = p.estado || "planeado";

        document.getElementById("estado").value = estadoActual;
        document.getElementById("estadoGroup").style.display = "";


        return true;


    } catch (error) {

        console.error(
            "Error cargando proyecto:",
            error
        );

        mostrarMensaje(
            "No se pudo cargar la información del proyecto.",
            true
        );

        return false;
    }
}


function leerNumero(id) {

    const raw =
        document.getElementById(id).value.trim();

    if (raw === "") {
        return 0;
    }

    const n = Number(raw);

    if (!Number.isFinite(n) || n < 0) {
        return false;
    }

    return n;
}


function leerFecha(id) {

    const raw =
        document.getElementById(id).value;

    if (raw === "") {
        return null;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return false;
    }

    return raw;
}


async function guardarProyecto(event) {

    event.preventDefault();

    const nombre =
        document.getElementById("nombre").value.trim();


    if (!nombre) {

        mostrarMensaje("El nombre es obligatorio.", true);

        return;
    }


    const body = { nombre };


    for (const id of CAMPOS_FECHA) {

        const valor = leerFecha(id);

        if (valor === false) {

            mostrarMensaje(
                "Las fechas deben tener formato válido.",
                true
            );

            return;
        }

        body[id] = valor;
    }


    const inicio = body.fecha_inicio;
    const fin = body.fecha_finalizacion;

    if (inicio && fin && fin < inicio) {

        mostrarMensaje(
            "La fecha de finalización no puede ser anterior al inicio.",
            true
        );

        return;
    }


    for (const id of CAMPOS_NUMERO) {

        const valor = leerNumero(id);

        if (valor === false) {

            mostrarMensaje(
                `El campo ${id} debe ser un número mayor o igual a 0.`,
                true
            );

            return;
        }

        body[id] = valor;
    }


    const fuente =
        document.getElementById("fuente_tipo_cambio").value.trim();

    body.fuente_tipo_cambio = fuente === "" ? null : fuente;


    if (editId !== null) {

        body.estado = document.getElementById("estado").value;
    }


    const url =
        editId === null ? "/api/proyectos" : `/api/proyectos/${editId}`;

    const method =
        editId === null ? "POST" : "PUT";


    try {

        const response =
            await fetch(
                url,
                {
                    method,

                    headers: {
                        "Content-Type": "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify(body)
                }
            );

        const data =
            await response.json().catch(() => ({}));


        if (response.status === 401) {

            window.location.replace("/login.html");

            return;
        }


        if (!response.ok) {

            throw new Error(
                data.message ||
                (editId === null
                    ? "No se pudo crear el proyecto."
                    : "No se pudo guardar los cambios.")
            );
        }


        mostrarMensaje(
            editId === null
                ? "Proyecto creado correctamente."
                : "Cambios guardados correctamente.",
            false
        );

        setTimeout(() => {

            window.location.href = "proyectos.html";

        }, 800);


    } catch (error) {

        console.error(error);

        mostrarMensaje(error.message, true);
    }
}


async function init() {

    const sesion =
        await verificarSesion();

    if (!sesion) return;


    const nameEl = document.getElementById("currentUserName");
    const roleEl = document.getElementById("currentUserRole");

    if (nameEl && sesion.usuario) {
        nameEl.textContent =
            `${sesion.usuario.nombre || ""} ${sesion.usuario.apellido || ""}`.trim();
    }

    if (roleEl && sesion.usuario) {
        roleEl.textContent = sesion.usuario.rol;
    }


    const params =
        new URLSearchParams(window.location.search);

    const idParam = params.get("id");
    const modoParam = params.get("modo");


    if (idParam !== null && idParam !== "") {

        const id = Number(idParam);

        if (!Number.isInteger(id)) {

            mostrarMensaje("ID de proyecto inválido.", true);

            return;
        }


        modoVer = modoParam === "ver";

        const permisos = sesion.permisos || [];

        if (
            modoVer &&
            !permisos.includes("proyectos.ver")
        ) {

            mostrarMensaje(
                "No tienes permiso para ver proyectos.",
                true
            );

            return;
        }


        if (
            !modoVer &&
            !permisos.includes("proyectos.editar")
        ) {

            mostrarMensaje(
                "No tienes permiso para editar proyectos.",
                true
            );

            return;
        }


        editId = id;

        document.getElementById("formTitle").textContent =
            modoVer ? "Detalle del proyecto" : "Editar proyecto";

        document.getElementById("formSubtitle").textContent =
            modoVer
                ? "Información del proyecto (solo lectura)."
                : "Modifica la información y guarda los cambios.";

        document.getElementById("submitButton").textContent =
            "✓ Guardar cambios";


        const ok = await cargarProyecto(id);

        if (!ok) return;


        const puedeGestionar =
            permisos.includes("finanzas.editar") &&
            estadoActual !== "finalizado";

        initGastosEsperados(puedeGestionar);


        if (estadoActual === "finalizado") {

            mostrarMensaje(
                "Este proyecto está finalizado y ya no se puede editar.",
                true
            );

            setSoloLectura(true);

            document.getElementById("editButton").style.display = "none";

            return;
        }


        setSoloLectura(modoVer);

        document
            .getElementById("editButton")
            .addEventListener("click", () => {

                modoVer = false;

                document.getElementById("formTitle").textContent =
                    "Editar proyecto";

                document.getElementById("formSubtitle").textContent =
                    "Modifica la información y guarda los cambios.";

                document.getElementById("submitButton").textContent =
                    "✓ Guardar cambios";

                setSoloLectura(false);

                initGastosEsperados(
                    permisos.includes("finanzas.editar")
                );
            });
    }


    document
        .getElementById("proyectoForm")
        .addEventListener("submit", guardarProyecto);


    const logoutButton =
        document.querySelector(".logout");

    if (logoutButton) {

        logoutButton.addEventListener("click", (e) => {

            e.preventDefault();

            cerrarSesion();
        });
    }
}

/*
=========================================
GASTOS ESPERADOS DEL PROYECTO
=========================================
*/

function puedeGestionarGastos() {

    return (
        document.getElementById("agregarGastoButton").style.display !== "none"
    );
}


function mostrarMensajeGasto(texto, esError) {

    const el =
        document.getElementById("gastoEsperadoMessage");

    if (!el) return;

    el.textContent = texto;
    el.style.color = esError ? "#d23c78" : "green";
}


async function cargarCategoriasGe() {

    const select =
        document.getElementById("ge_categoria");

    try {

        const response =
            await fetch(
                "/api/categorias-gasto",
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!response.ok) {
            throw new Error("categorias");
        }

        const data =
            await response.json();

        const lista = (data.categorias || []).filter((c) => c.estado);

        select.innerHTML =
            `<option value="">Seleccione una categoría</option>` +
            lista.map((c) =>
                `<option value="${c.id_categoria}">${c.nombre} (${c.rubro || "Sin rubro"})</option>`
            ).join("");

    } catch (error) {

        console.error(
            "Error cargando categorías:",
            error
        );

        select.innerHTML =
            `<option value="">No se pudieron cargar las categorías</option>`;
    }
}


async function cargarGastosEsperados() {

    const tbody =
        document.getElementById("gastosEsperadosTbody");

    try {

        const response =
            await fetch(
                `/api/gastos-esperados?id_proyecto=${editId}`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );


        if (response.status === 401) {

            window.location.replace(
                "/login.html"
            );

            return;
        }


        if (!response.ok) {
            throw new Error("carga");
        }


        const data =
            await response.json();

        gastosEsperados =
            data.gastos_esperados || [];


        renderGastosEsperados();


    } catch (error) {

        console.error(
            "Error cargando gastos esperados:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="7">Error al cargar gastos esperados.</td></tr>`;
    }
}


function renderGastosEsperados() {

    const tbody =
        document.getElementById("gastosEsperadosTbody");

    const gestionar = puedeGestionarGastos();


    if (gastosEsperados.length === 0) {

        tbody.innerHTML =
            `<tr><td colspan="7">Sin gastos esperados registrados.</td></tr>`;

        return;
    }


    tbody.innerHTML = gastosEsperados.map((g) => {

        const estadoClass = g.estado ? "active" : "inactive";
        const estadoTexto = g.estado ? "Activo" : "Inactivo";

        return `
            <tr>
                <td>${g.categoria || "—"}</td>
                <td>Q ${Number(g.costo_por_unidad_moneda_local).toFixed(2)}</td>
                <td>${g.numero_de_unidades}</td>
                <td>Q ${Number(g.monto_solicitado_rise_up_moneda_local).toFixed(2)}</td>
                <td>$ ${Number(g.monto_solicitado_rise_up_usd).toFixed(2)}</td>
                <td><span class="status ${estadoClass}">${estadoTexto}</span></td>
                <td>
                    <div class="actions">
                        ${gestionar ? `
                        <button class="action edit" title="Editar" data-ge-editar="${g.id_gasto_esperado}">
                            ✏️
                        </button>
                        <button
                            class="action ${g.estado ? "delete" : "edit"}"
                            title="${g.estado ? "Desactivar" : "Activar"}"
                            data-ge-id="${g.id_gasto_esperado}"
                            data-ge-estado="${!g.estado}"
                        >
                            ${g.estado ? "🗑️" : "✓"}
                        </button>` : "—"}
                    </div>
                </td>
            </tr>`;
    }).join("");


    tbody.querySelectorAll("button[data-ge-editar]").forEach((btn) => {

        btn.addEventListener("click", () => {

            mostrarSubformGasto(Number(btn.dataset.geEditar));
        });
    });


    tbody.querySelectorAll("button[data-ge-id]").forEach((btn) => {

        btn.addEventListener("click", () => {

            cambiarEstadoGasto(
                Number(btn.dataset.geId),
                btn.dataset.geEstado === "true"
            );
        });
    });
}


function mostrarSubformGasto(id) {

    gastoEditId = id || null;

    const form =
        document.getElementById("gastoEsperadoForm");

    form.style.display = "";

    mostrarMensajeGasto("", false);


    if (id) {

        const g = gastosEsperados.find(
            (x) => x.id_gasto_esperado === id
        );

        if (!g) return;

        document.getElementById("ge_categoria").value = g.id_categoria;
        document.getElementById("ge_costo").value = g.costo_por_unidad_moneda_local;
        document.getElementById("ge_unidades").value = g.numero_de_unidades;
        document.getElementById("ge_local").value = g.monto_solicitado_rise_up_moneda_local;
        document.getElementById("ge_usd").value = g.monto_solicitado_rise_up_usd;

    } else {

        for (const campo of [
            "ge_categoria",
            "ge_costo",
            "ge_unidades",
            "ge_local",
            "ge_usd"
        ]) {
            document.getElementById(campo).value = "";
        }
    }
}


function leerMontoGasto(id) {

    const raw =
        document.getElementById(id).value.trim();

    if (raw === "") {
        return 0;
    }

    const n = Number(raw);

    if (!Number.isFinite(n) || n < 0) {
        return false;
    }

    return n;
}


async function guardarGastoEsperado() {

    const id_categoria =
        Number(document.getElementById("ge_categoria").value);


    if (!Number.isInteger(id_categoria)) {

        mostrarMensajeGasto("La categoría es obligatoria.", true);

        return;
    }


    const body = {
        id_proyecto: editId,
        id_categoria
    };


    for (const campo of [
        "ge_costo",
        "ge_unidades",
        "ge_local",
        "ge_usd"
    ]) {

        const valor = leerMontoGasto(campo);

        if (valor === false) {

            mostrarMensajeGasto(
                "Los montos deben ser números mayores o iguales a 0.",
                true
            );

            return;
        }

        body[{
            "ge_costo": "costo_por_unidad_moneda_local",
            "ge_unidades": "numero_de_unidades",
            "ge_local": "monto_solicitado_rise_up_moneda_local",
            "ge_usd": "monto_solicitado_rise_up_usd"
        }[campo]] = valor;
    }


    const url =
        gastoEditId === null
            ? "/api/gastos-esperados"
            : `/api/gastos-esperados/${gastoEditId}`;

    const method =
        gastoEditId === null ? "POST" : "PUT";


    try {

        const response =
            await fetch(
                url,
                {
                    method,

                    headers: {
                        "Content-Type": "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify(body)
                }
            );

        const data =
            await response.json().catch(() => ({}));


        if (response.status === 401) {

            window.location.replace("/login.html");

            return;
        }


        if (!response.ok) {

            throw new Error(
                data.message || "No se pudo guardar el gasto esperado."
            );
        }


        document.getElementById("gastoEsperadoForm").style.display = "none";

        const eraNuevo = gastoEditId === null;

        gastoEditId = null;

        mostrarMensajeGasto(
            eraNuevo
                ? "Gasto esperado registrado."
                : "Gasto esperado actualizado.",
            false
        );

        await cargarGastosEsperados();


    } catch (error) {

        console.error(error);

        mostrarMensajeGasto(error.message, true);
    }
}


async function cambiarEstadoGasto(id, estado) {

    try {

        const response =
            await fetch(
                `/api/gastos-esperados/${id}/estado`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({ estado })
                }
            );


        if (!response.ok) {

            const data =
                await response.json().catch(() => ({}));

            throw new Error(
                data.message || "No se pudo actualizar el estado."
            );
        }


        await cargarGastosEsperados();


    } catch (error) {

        console.error(error);

        alert(error.message);
    }
}


function initGastosEsperados(gestionar) {

    document.getElementById("gastosEsperadosSection").style.display = "";

    document.getElementById("agregarGastoButton").style.display =
        gestionar ? "" : "none";

    document.getElementById("exportProyectoButton").style.display = "";


    if (!gastosListenersOk) {

        gastosListenersOk = true;

        document
            .getElementById("agregarGastoButton")
            .addEventListener("click", () => mostrarSubformGasto(null));

        document
            .getElementById("cancelarGastoButton")
            .addEventListener("click", () => {

                document.getElementById("gastoEsperadoForm").style.display = "none";

                gastoEditId = null;
            });

        document
            .getElementById("guardarGastoButton")
            .addEventListener("click", guardarGastoEsperado);

        document
            .getElementById("exportProyectoButton")
            .addEventListener("click", exportarProyecto);
    }


    cargarCategoriasGe();
    cargarGastosEsperados();
}


/*
=========================================
EXPORTAR PROYECTO (una sola hoja)
=========================================
*/

function fechaCortaExport(fecha) {

    if (!fecha) return "";

    return String(fecha).slice(0, 10);
}


async function exportarProyecto() {

    if (typeof XLSX === "undefined") {

        alert("No se pudo cargar la librería de Excel.");

        return;
    }

    try {

        const response =
            await fetch(
                `/api/proyectos/${editId}`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!response.ok) {
            throw new Error("No se pudo obtener el proyecto.");
        }

        const data =
            await response.json();

        const p = data.proyecto;


        const tabla = [
            ["PROYECTO"],
            ["Campo", "Valor"],
            ["ID", p.id_proyecto],
            ["Nombre", p.nombre],
            ["Fecha de inicio", fechaCortaExport(p.fecha_inicio)],
            ["Fecha de finalización", fechaCortaExport(p.fecha_finalizacion)],
            ["Estado", p.estado],
            ["Subvención", p.subvencion],
            ["Fecha tipo de cambio", fechaCortaExport(p.fecha_tipo_cambio)],
            ["Tipo de cambio", p.tipo_cambio],
            ["Fuente tipo de cambio", p.fuente_tipo_cambio],
            ["Gastos ejecutados", p.total_gastos_ejecutados],
            ["Solicitado Rise Up", p.monto_total_solicitado_rise_up],
            ["Subvención total", p.monto_total_subvencion],
            ["Diferencia", p.diferencia_entre_solicitado_y_subvencion],
            [],
            ["GASTOS ESPERADOS"],
            ["ID", "Categoría", "Costo/u local", "N.º unidades", "Solicitado local", "Solicitado USD", "Estado"]
        ];


        const respGe =
            await fetch(
                `/api/gastos-esperados?id_proyecto=${editId}`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!respGe.ok) {
            throw new Error("No se pudieron obtener los gastos esperados.");
        }

        const dataGe =
            await respGe.json();

        const esperados = dataGe.gastos_esperados || [];

        if (esperados.length === 0) {

            tabla.push(["Sin gastos esperados registrados"]);

        } else {

            for (const g of esperados) {

                tabla.push([
                    g.id_gasto_esperado,
                    g.categoria,
                    g.costo_por_unidad_moneda_local,
                    g.numero_de_unidades,
                    g.monto_solicitado_rise_up_moneda_local,
                    g.monto_solicitado_rise_up_usd,
                    g.estado ? "Activo" : "Inactivo"
                ]);
            }
        }


        const hoja =
            XLSX.utils.aoa_to_sheet(tabla);

        hoja["!cols"] = [
            { wch: 24 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
            { wch: 18 }, { wch: 16 }, { wch: 12 }
        ];

        const libro = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(libro, hoja, "Proyecto");

        XLSX.writeFile(libro, `proyecto_${editId}.xlsx`);


    } catch (error) {

        console.error(error);

        alert(error.message);
    }
}


init();
