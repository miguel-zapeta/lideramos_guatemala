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

let donantes = [];
let donanteEditId = null;
let donantesListenersOk = false;
let donantePrincipal = null;

let paginaGastosActual = 1;
let paginaDonantesActual = 1;

const LIMITE_PAGINA = 20;

let metaGastosActual = {
    total: 0,
    pagina: 1,
    limite: 20,
    totalPaginas: 1
};

let metaDonantesActual = {
    total: 0,
    pagina: 1,
    limite: 20,
    totalPaginas: 1
};


const CAMPOS = [
    "nombre",
    "fecha_inicio",
    "fecha_finalizacion",
    "gestora_del_proyecto",
    "asociacion_gestora"
];

const CAMPOS_NUMERO = [];

const CAMPOS_FECHA = [
    "fecha_inicio",
    "fecha_finalizacion"
];

const CAMPOS_TEXTO = [
    "gestora_del_proyecto",
    "asociacion_gestora"
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


    for (const id of CAMPOS_TEXTO) {

        const texto =
            document.getElementById(id).value.trim();

        body[id] = texto === "" ? null : texto;
    }


    if (editId !== null) {

        body.estado = document.getElementById("estado").value;
    }


    const url =
        editId === null ? "/api/proyectos" : `/api/proyectos/${editId}`;

    const method =
        editId === null ? "POST" : "PUT";


    const guardado = iniciarGuardado({
        boton: document.getElementById("submitButton"),
        mostrar: mostrarMensaje
    });

    if (!guardado) return;


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

        guardado.error();

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
        initDonantes(puedeGestionar);


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

                initDonantes(
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
                "/api/categorias-gasto/opciones",
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
                `<option value="${c.id_categoria}">${escapeHtml(c.nombre)} (${escapeHtml(c.rubro) || "Sin rubro"})</option>`
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


async function cargarDonantesOpciones() {

    const select =
        document.getElementById("dp_donante");

    try {

        const response =
            await fetch(
                "/api/patrocinadores/opciones",
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!response.ok) {
            throw new Error("patrocinadores");
        }

        const data =
            await response.json();

        const lista = data.patrocinadores || [];

        select.innerHTML =
            `<option value="">Seleccione un patrocinador</option>` +
            lista.map((p) =>
                `<option value="${p.id_patrocinador}">${escapeHtml(p.nombre_razon_social)}</option>`
            ).join("");

    } catch (error) {

        console.error(
            "Error cargando patrocinadores:",
            error
        );

        select.innerHTML =
            `<option value="">No se pudieron cargar los patrocinadores</option>`;
    }
}


async function cargarGastosEsperados() {

    const tbody =
        document.getElementById("gastosEsperadosTbody");

    try {

        const verInactivos =
            document.getElementById("verInactivosGE")?.checked;

        const params =
            new URLSearchParams({
                id_proyecto: String(editId),
                pagina: String(paginaGastosActual),
                limite: String(LIMITE_PAGINA)
            });

        if (verInactivos) {
            params.set("ver_inactivos", "1");
        }

        const url =
            `/api/gastos-esperados?${params.toString()}`;

        const response =
            await fetch(
                url,
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

        metaGastosActual = {
            total: data.total || 0,
            pagina: data.pagina || 1,
            limite: data.limite || LIMITE_PAGINA,
            totalPaginas: data.totalPaginas || 1
        };


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


    const total = metaGastosActual.total;


    renderPaginacion({
        contenedorId: "gastosEsperadosPagination",
        pagina: metaGastosActual.pagina,
        totalPaginas: metaGastosActual.totalPaginas,
        onCambiar: (nuevaPagina) => {
            paginaGastosActual = nuevaPagina;
            cargarGastosEsperados();
        }
    });


    if (gastosEsperados.length === 0) {

        if (metaGastosActual.total > 0 && metaGastosActual.pagina > 1) {
            paginaGastosActual = metaGastosActual.pagina - 1;
            cargarGastosEsperados();
            return;
        }

        tbody.innerHTML =
            `<tr><td colspan="7">Sin gastos esperados registrados.</td></tr>`;

        return;
    }


    tbody.innerHTML = gastosEsperados.map((g) => {

        const estadoClass = g.estado ? "active" : "inactive";
        const estadoTexto = g.estado ? "Activo" : "Inactivo";

        return `
            <tr>
                <td>${escapeHtml(g.categoria) || "—"}</td>
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

        if (!g) {

            cargarGastoEsperadoPorId(id);

            return;
        }

        rellenarSubformGasto(g);

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


function rellenarSubformGasto(g) {

    document.getElementById("ge_categoria").value = g.id_categoria;
    document.getElementById("ge_costo").value = g.costo_por_unidad_moneda_local;
    document.getElementById("ge_unidades").value = g.numero_de_unidades;
    document.getElementById("ge_local").value = g.monto_solicitado_rise_up_moneda_local;

    // El solicitado en moneda del donante siempre se
    // recalcula con el tipo de cambio del donante.
    autoRellenarSolicitadoMoneda();
}


async function cargarGastoEsperadoPorId(id) {

    try {

        const response =
            await fetch(
                `/api/gastos-esperados/${id}`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (response.status === 401) {

            window.location.replace("/login.html");

            return;
        }

        if (!response.ok) {
            throw new Error("carga");
        }

        const data =
            await response.json();

        if (data.gasto_esperado) {
            rellenarSubformGasto(data.gasto_esperado);
        }

    } catch (error) {

        console.error(
            "Error cargando gasto esperado:",
            error
        );

        mostrarMensajeGasto(
            "No se pudo cargar el gasto esperado.",
            true
        );
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


function autoRellenarSolicitadoLocal() {

    const costoRaw =
        document.getElementById("ge_costo").value.trim();

    const unidadesRaw =
        document.getElementById("ge_unidades").value.trim();


    // Solo calcular cuando ambos tengan contenido válido.
    if (costoRaw === "" || unidadesRaw === "") {
        return;
    }


    const costo = leerMontoGasto("ge_costo");
    const unidades = leerMontoGasto("ge_unidades");

    if (costo === false || unidades === false) {
        return;
    }


    document.getElementById("ge_local").value =
        (costo * unidades).toFixed(2);

    autoRellenarSolicitadoMoneda();
}


/*
Solicitado en moneda del donante = solicitado local /
tipo de cambio del donante principal (primera fila
activa de los patrocinadores del proyecto).
*/

async function obtenerDonantePrincipal() {

    try {

        const response =
            await fetch(
                `/api/proyecto-patrocinadores?id_proyecto=${editId}&exportar=1`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!response.ok) {
            throw new Error("donantes");
        }

        const data =
            await response.json();

        const filas = (data.proyecto_patrocinadores || [])
            .slice()
            .sort((a, b) =>
                a.id_proyecto_patrocinador - b.id_proyecto_patrocinador
            );

        donantePrincipal = filas[0] || null;

    } catch (error) {

        console.error(
            "Error cargando donante principal:",
            error
        );

        donantePrincipal = null;
    }


    actualizarEtiquetasMonedaDonante();
    autoRellenarSolicitadoMoneda();
}


function monedaDonante() {

    return (donantePrincipal && donantePrincipal.tipo_moneda) || "";
}


function actualizarEtiquetasMonedaDonante() {

    const moneda = monedaDonante();

    const texto = moneda
        ? `Solicitado ${moneda}`
        : "Solicitado (moneda del donante)";

    const th =
        document.getElementById("thGeSolicitadoMoneda");

    if (th) th.textContent = texto;

    const etiqueta =
        document.getElementById("geUsdLabel");

    if (etiqueta) etiqueta.textContent = texto;
}


function autoRellenarSolicitadoMoneda() {

    const local = leerMontoGasto("ge_local");

    const tc =
        donantePrincipal
            ? Number(donantePrincipal.tipo_cambio)
            : 0;


    if (local === false || !(tc > 0)) {

        document.getElementById("ge_usd").value = "";

        return;
    }


    document.getElementById("ge_usd").value =
        (local / tc).toFixed(2);
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


    const guardado = iniciarGuardado({
        boton: document.getElementById("guardarGastoButton"),
        mostrar: mostrarMensajeGasto,
        reactivar: true
    });

    if (!guardado) return;


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

        if (eraNuevo) {
            paginaGastosActual = 1;
        }

        await cargarGastosEsperados();

        guardado.exito();


    } catch (error) {

        guardado.error();

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

        document
            .getElementById("ge_costo")
            .addEventListener("input", autoRellenarSolicitadoLocal);

        document
            .getElementById("ge_unidades")
            .addEventListener("input", autoRellenarSolicitadoLocal);

        document
            .getElementById("ge_local")
            .addEventListener("input", autoRellenarSolicitadoMoneda);
    }


    cargarCategoriasGe();
    cargarGastosEsperados();
    obtenerDonantePrincipal();


    const verInactivosGE =
        document.getElementById("verInactivosGE");


    if (verInactivosGE) {

        verInactivosGE.addEventListener(
            "change",
            () => {
                paginaGastosActual = 1;
                cargarGastosEsperados();
            }
        );

    }
}


/*
=========================================
PATROCINADORES DEL PROYECTO
=========================================
*/

function puedeGestionarDonantes() {

    return (
        document.getElementById("agregarDonanteButton").style.display !== "none"
    );
}


function mostrarMensajeDonante(texto, esError) {

    const el =
        document.getElementById("donanteMessage");

    if (!el) return;

    el.textContent = texto;
    el.style.color = esError ? "#d23c78" : "green";
}


async function cargarDonantes() {

    const tbody =
        document.getElementById("donantesTbody");

    try {

        const verInactivos =
            document.getElementById("verInactivosDP")?.checked;

        const params =
            new URLSearchParams({
                id_proyecto: String(editId),
                pagina: String(paginaDonantesActual),
                limite: String(LIMITE_PAGINA)
            });

        if (verInactivos) {
            params.set("ver_inactivos", "1");
        }

        const response =
            await fetch(
                `/api/proyecto-patrocinadores?${params.toString()}`,
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

        donantes =
            data.proyecto_patrocinadores || [];

        metaDonantesActual = {
            total: data.total || 0,
            pagina: data.pagina || 1,
            limite: data.limite || LIMITE_PAGINA,
            totalPaginas: data.totalPaginas || 1
        };


        renderDonantes();


    } catch (error) {

        console.error(
            "Error cargando donantes:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="12">Error al cargar patrocinadores.</td></tr>`;
    }
}


function renderDonantes() {

    const tbody =
        document.getElementById("donantesTbody");

    const gestionar = puedeGestionarDonantes();


    renderPaginacion({
        contenedorId: "donantesPagination",
        pagina: metaDonantesActual.pagina,
        totalPaginas: metaDonantesActual.totalPaginas,
        onCambiar: (nuevaPagina) => {
            paginaDonantesActual = nuevaPagina;
            cargarDonantes();
        }
    });


    if (donantes.length === 0) {

        if (metaDonantesActual.total > 0 && metaDonantesActual.pagina > 1) {
            paginaDonantesActual = metaDonantesActual.pagina - 1;
            cargarDonantes();
            return;
        }

        tbody.innerHTML =
            `<tr><td colspan="12">Sin patrocinadores registrados.</td></tr>`;

        return;
    }


    tbody.innerHTML = donantes.map((d) => {

        const estadoClass = d.estado ? "active" : "inactive";
        const estadoTexto = d.estado ? "Activo" : "Inactivo";

        return `
            <tr>
                <td>${escapeHtml(d.donante) || "—"}</td>
                <td>${escapeHtml(d.tipo_moneda) || "—"}</td>
                <td>${escapeHtml(d.tipo_aporte) || "—"}</td>
                <td>${d.tipo_cambio ?? "—"}</td>
                <td>${escapeHtml(d.fecha_tipo_cambio) || "—"}</td>
                <td>${escapeHtml(d.fuente_tipo_cambio) || "—"}</td>
                <td>${Number(d.subvencion_moneda_donante).toFixed(2)}</td>
                <td>${Number(d.cantidad_solicitada_moneda_donante).toFixed(2)}</td>
                <td>${Number(d.subvencion_moneda_nacional).toFixed(2)}</td>
                <td>${Number(d.diferencia_solicitado_subvencion).toFixed(2)}</td>
                <td><span class="status ${estadoClass}">${estadoTexto}</span></td>
                <td>
                    <div class="actions">
                        ${d.tipo_aporte === "efectivo" && d.tiene_recibo ? `
                        <button
                            class="action edit"
                            title="Ver recibo (PDF)"
                            data-dp-recibo="${d.id_proyecto_patrocinador}"
                        >
                            🧾
                        </button>` : ""}
                        ${gestionar ? `
                        <button class="action edit" title="Editar" data-dp-editar="${d.id_proyecto_patrocinador}">
                            ✏️
                        </button>
                        <button
                            class="action ${d.estado ? "delete" : "edit"}"
                            title="${d.estado ? "Desactivar" : "Activar"}"
                            data-dp-id="${d.id_proyecto_patrocinador}"
                            data-dp-estado="${!d.estado}"
                        >
                            ${d.estado ? "🗑️" : "✓"}
                        </button>` : ""}
                    </div>
                </td>
            </tr>`;
    }).join("");


    tbody.querySelectorAll("button[data-dp-editar]").forEach((btn) => {

        btn.addEventListener("click", () => {

            mostrarSubformDonante(Number(btn.dataset.dpEditar));
        });
    });


    tbody.querySelectorAll("button[data-dp-id]").forEach((btn) => {

        btn.addEventListener("click", () => {

            cambiarEstadoDonante(
                Number(btn.dataset.dpId),
                btn.dataset.dpEstado === "true"
            );
        });
    });


    tbody.querySelectorAll("button[data-dp-recibo]").forEach((btn) => {

        btn.addEventListener("click", () => {

            window.open(
                `/api/proyecto-patrocinadores/${btn.dataset.dpRecibo}/recibo`,
                "_blank"
            );
        });
    });
}


function mostrarSubformDonante(id) {

    donanteEditId = id || null;

    const form =
        document.getElementById("donanteForm");

    form.style.display = "";

    mostrarMensajeDonante("", false);


    if (id) {

        const d = donantes.find(
            (x) => x.id_proyecto_patrocinador === id
        );

        if (!d) {

            cargarDonantePorId(id);

            return;
        }

        rellenarSubformDonante(d);

    } else {

        for (const campo of [
            "dp_donante",
            "dp_moneda",
            "dp_aporte",
            "dp_tipo_cambio",
            "dp_fecha_tipo_cambio",
            "dp_fuente_tipo_cambio",
            "dp_subvencion",
            "dp_solicitado",
            "dp_subvencion_nacional",
            "dp_diferencia",
            "dp_descripcion",
            "dp_fecha_registro"
        ]) {
            document.getElementById(campo).value = "";
        }

        document.getElementById("dpFechaRegistroGroup").style.display =
            "none";
    }
}


function rellenarSubformDonante(d) {

    const select =
        document.getElementById("dp_donante");

    // Si el patrocinador está inactivo no viene en
    // /opciones; se añade para poder verlo al editar.
    const valor = String(d.id_patrocinador);

    const existe =
        Array.from(select.options).some((o) => o.value === valor);

    if (!existe) {

        const opcion =
            document.createElement("option");

        opcion.value = valor;
        opcion.textContent =
            `${d.donante || "Patrocinador"} (inactivo)`;

        select.appendChild(opcion);
    }

    select.value = valor;

    document.getElementById("dp_moneda").value = d.tipo_moneda || "";
    document.getElementById("dp_aporte").value = d.tipo_aporte || "";
    document.getElementById("dp_tipo_cambio").value =
        d.tipo_cambio === null || d.tipo_cambio === undefined ? "" : d.tipo_cambio;
    document.getElementById("dp_fecha_tipo_cambio").value =
        d.fecha_tipo_cambio || "";
    document.getElementById("dp_fuente_tipo_cambio").value =
        d.fuente_tipo_cambio || "";
    document.getElementById("dp_descripcion").value =
        d.descripcion || "";
    document.getElementById("dp_subvencion").value = d.subvencion_moneda_donante;
    document.getElementById("dp_solicitado").value = d.cantidad_solicitada_moneda_donante;


    const grupoFecha =
        document.getElementById("dpFechaRegistroGroup");

    if (d.fecha_registro) {

        grupoFecha.style.display = "";

        document.getElementById("dp_fecha_registro").value =
            d.fecha_registro;

    } else {

        grupoFecha.style.display = "none";
    }


    autoRellenarDonante();
}


async function cargarDonantePorId(id) {

    try {

        const response =
            await fetch(
                `/api/proyecto-patrocinadores/${id}`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (response.status === 401) {

            window.location.replace("/login.html");

            return;
        }

        if (!response.ok) {
            throw new Error("carga");
        }

        const data =
            await response.json();

        if (data.proyecto_patrocinador) {
            rellenarSubformDonante(data.proyecto_patrocinador);
        }

    } catch (error) {

        console.error(
            "Error cargando donante:",
            error
        );

        mostrarMensajeDonante(
            "No se pudo cargar el patrocinador.",
            true
        );
    }
}


function leerMontoDonante(id) {

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


function autoRellenarDonante() {

    const subvencion = leerMontoDonante("dp_subvencion");
    const solicitado = leerMontoDonante("dp_solicitado");

    const tipoCambio =
        Number(document.getElementById("dp_tipo_cambio").value) || 0;


    if (subvencion !== false && solicitado !== false) {

        document.getElementById("dp_subvencion_nacional").value =
            (subvencion * tipoCambio).toFixed(2);

        document.getElementById("dp_diferencia").value =
            (solicitado - subvencion).toFixed(2);
    }
}


async function guardarDonante() {

    const id_patrocinador =
        Number(document.getElementById("dp_donante").value);


    if (!Number.isInteger(id_patrocinador)) {

        mostrarMensajeDonante("El patrocinador es obligatorio.", true);

        return;
    }


    const body = {
        id_proyecto: editId,
        id_patrocinador
    };


    body.tipo_moneda =
        document.getElementById("dp_moneda").value || null;

    if (!body.tipo_moneda) {

        mostrarMensajeDonante("El tipo de moneda es obligatorio.", true);

        return;
    }

    body.tipo_aporte =
        document.getElementById("dp_aporte").value || null;

    if (!body.tipo_aporte) {

        mostrarMensajeDonante("El tipo de aporte es obligatorio.", true);

        return;
    }

    body.tipo_cambio =
        leerMontoDonante("dp_tipo_cambio");

    if (body.tipo_cambio === false) {

        mostrarMensajeDonante(
            "El tipo de cambio debe ser un número mayor o igual a 0.",
            true
        );

        return;
    }

    body.fecha_tipo_cambio =
        document.getElementById("dp_fecha_tipo_cambio").value || null;

    body.fuente_tipo_cambio =
        document.getElementById("dp_fuente_tipo_cambio").value.trim() || null;

    body.descripcion =
        document.getElementById("dp_descripcion").value.trim() || null;


    for (const campo of [
        "dp_subvencion",
        "dp_solicitado"
    ]) {

        const valor = leerMontoDonante(campo);

        if (valor === false) {

            mostrarMensajeDonante(
                "Los montos deben ser números mayores o iguales a 0.",
                true
            );

            return;
        }

        if (campo === "dp_subvencion" && valor <= 0) {

            mostrarMensajeDonante(
                "La subvención en moneda del donante es obligatoria y debe ser mayor a 0.",
                true
            );

            return;
        }

        body[{
            "dp_subvencion": "subvencion_moneda_donante",
            "dp_solicitado": "cantidad_solicitada_moneda_donante"
        }[campo]] = valor;
    }


    const url =
        donanteEditId === null
            ? "/api/proyecto-patrocinadores"
            : `/api/proyecto-patrocinadores/${donanteEditId}`;

    const method =
        donanteEditId === null ? "POST" : "PUT";


    const guardado = iniciarGuardado({
        boton: document.getElementById("guardarDonanteButton"),
        mostrar: mostrarMensajeDonante,
        reactivar: true
    });

    if (!guardado) return;


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
                data.message || "No se pudo guardar el patrocinador."
            );
        }


        document.getElementById("donanteForm").style.display = "none";

        const eraNuevo = donanteEditId === null;

        donanteEditId = null;

        mostrarMensajeDonante(
            eraNuevo
                ? "Patrocinador registrado."
                : "Patrocinador actualizado.",
            false
        );

        if (eraNuevo) {
            paginaDonantesActual = 1;
        }

        await cargarDonantes();
        await obtenerDonantePrincipal();

        guardado.exito();


    } catch (error) {

        guardado.error();

        console.error(error);

        mostrarMensajeDonante(error.message, true);
    }
}


async function cambiarEstadoDonante(id, estado) {

    try {

        const response =
            await fetch(
                `/api/proyecto-patrocinadores/${id}/estado`,
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


        await cargarDonantes();
        await obtenerDonantePrincipal();


    } catch (error) {

        console.error(error);

        alert(error.message);
    }
}


function initDonantes(gestionar) {

    document.getElementById("donantesSection").style.display = "";

    document.getElementById("agregarDonanteButton").style.display =
        gestionar ? "" : "none";


    if (!donantesListenersOk) {

        donantesListenersOk = true;

        document
            .getElementById("agregarDonanteButton")
            .addEventListener("click", () => mostrarSubformDonante(null));

        document
            .getElementById("cancelarDonanteButton")
            .addEventListener("click", () => {

                document.getElementById("donanteForm").style.display = "none";

                donanteEditId = null;
            });

        document
            .getElementById("guardarDonanteButton")
            .addEventListener("click", guardarDonante);

        document
            .getElementById("dp_subvencion")
            .addEventListener("input", autoRellenarDonante);

        document
            .getElementById("dp_solicitado")
            .addEventListener("input", autoRellenarDonante);

        document
            .getElementById("dp_tipo_cambio")
            .addEventListener("input", autoRellenarDonante);
    }


    cargarDonantesOpciones();
    cargarDonantes();


    const verInactivosDP =
        document.getElementById("verInactivosDP");


    if (verInactivosDP) {

        verInactivosDP.addEventListener(
            "change",
            () => {
                paginaDonantesActual = 1;
                cargarDonantes();
            }
        );

    }
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
            ["Subvención en moneda del donante (total)", p.subvencion],
            ["Gastos ejecutados", p.total_gastos_ejecutados],
            ["Cantidad solicitada en moneda del donante (total)", p.monto_total_solicitado_rise_up],
            ["Subvención en moneda nacional (total)", p.monto_total_subvencion],
            ["Diferencia solicitado/subvención (total)", p.diferencia_entre_solicitado_y_subvencion],
            ["Gestora del proyecto", p.gestora_del_proyecto],
            ["Patrocinadores", p.ente_patrocinador],
            ["Asociación gestora", p.asociacion_gestora],
            []
        ];


        const verInactivosExportDp =
            document.getElementById("verInactivosDP")?.checked;

        const paramsDp =
            new URLSearchParams({
                id_proyecto: String(editId),
                exportar: "1"
            });

        if (verInactivosExportDp) {
            paramsDp.set("ver_inactivos", "1");
        }

        const respDp =
            await fetch(
                `/api/proyecto-patrocinadores?${paramsDp.toString()}`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!respDp.ok) {
            throw new Error("No se pudieron obtener los patrocinadores.");
        }

        const dataDp =
            await respDp.json();

        const donantesExport = dataDp.proyecto_patrocinadores || [];

        tabla.push(["PATROCINADORES"]);
        tabla.push([
            "ID", "Patrocinador", "Tipo de moneda", "Tipo de aporte",
            "Tipo de cambio", "Fecha TC", "Fuente TC",
            "Fecha de registro", "Descripción",
            "Subvención moneda donante", "Solicitado moneda donante",
            "Subvención moneda nacional", "Diferencia", "Estado"
        ]);

        if (donantesExport.length === 0) {

            tabla.push(["Sin patrocinadores registrados"]);

        } else {

            for (const d of donantesExport) {

                tabla.push([
                    d.id_proyecto_patrocinador,
                    d.donante,
                    d.tipo_moneda,
                    d.tipo_aporte,
                    d.tipo_cambio,
                    d.fecha_tipo_cambio,
                    d.fuente_tipo_cambio,
                    d.fecha_registro,
                    d.descripcion,
                    d.subvencion_moneda_donante,
                    d.cantidad_solicitada_moneda_donante,
                    d.subvencion_moneda_nacional,
                    d.diferencia_solicitado_subvencion,
                    d.estado ? "Activo" : "Inactivo"
                ]);
            }
        }


        tabla.push([]);
        tabla.push(["GASTOS ESPERADOS"]);
        tabla.push([
            "ID", "Categoría", "Costo/u local", "N.º unidades", "Solicitado local",
            `Solicitado ${monedaDonante() || "(moneda del donante)"}`, "Estado"
        ]);


        const verInactivosExport =
            document.getElementById("verInactivosGE")?.checked;

        const paramsGe =
            new URLSearchParams({
                id_proyecto: String(editId),
                exportar: "1"
            });

        if (verInactivosExport) {
            paramsGe.set("ver_inactivos", "1");
        }

        const respGe =
            await fetch(
                `/api/gastos-esperados?${paramsGe.toString()}`,
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
            { wch: 8 }, { wch: 28 }, { wch: 12 }, { wch: 12 },
            { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 22 },
            { wch: 22 }, { wch: 22 }, { wch: 14 }, { wch: 10 }
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
