/*
=========================================
NUEVA / VER / EDITAR ACTIVIDAD
Crear: POST /api/actividades
Ver: ?id=X&modo=ver (solo lectura + botón Editar)
Editar: ?id=X -> PUT /api/actividades/:id
El estado se cambia desde la lista (PATCH).
=========================================
*/

let editId = null;
let modoVer = false;


const CAMPOS = [
    "id_proyecto",
    "nombre",
    "tema",
    "fecha",
    "numero_asistentes",
    "responsable",
    "realizado_por",
    "ninos",
    "ninas",
    "adolescentes_h",
    "adolescentes_m",
    "adultos",
    "eje",
    "resumen_evento",
    "enlace_en_redes",
    "lugar",
    "grupo_beneficiado",
    "temas_centrales",
    "duracion",
    "objetivos",
    "resultados",
    "aportes_del_evento",
    "comentario",
    "materiales",
    "alimentos"
];

const CAMPOS_ENTEROS = [
    "id_proyecto",
    "numero_asistentes",
    "ninos",
    "ninas",
    "adolescentes_h",
    "adolescentes_m",
    "adultos"
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

    for (const id of CAMPOS) {

        const input = document.getElementById(id);

        if (input) input.disabled = soloLectura;
    }

    document.getElementById("submitButton").style.display =
        soloLectura ? "none" : "";

    document.getElementById("editButton").style.display =
        soloLectura ? "" : "none";
}


async function cargarProyectos() {

    const select =
        document.getElementById("id_proyecto");

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

        const lista = (data.proyectos || []).filter(
            (p) => p.estado === "planeado" || p.estado === "en proceso"
        );

        select.innerHTML =
            `<option value="">Seleccione un proyecto</option>` +
            lista.map((p) =>
                `<option value="${p.id_proyecto}">${escapeHtml(p.nombre)} (${escapeHtml(p.estado)})</option>`
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


async function cargarActividad(id) {

    try {

        const response =
            await fetch(
                `/api/actividades/${id}`,
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
                "No tienes permiso para ver actividades.",
                true
            );

            return false;
        }


        if (response.status === 404) {

            mostrarMensaje(
                "Actividad no encontrada.",
                true
            );

            return false;
        }


        if (!response.ok) {
            throw new Error("carga");
        }


        const data =
            await response.json();

        const a = data.actividad;


        for (const campo of CAMPOS) {

            const input = document.getElementById(campo);

            if (!input) continue;

            let valor = a[campo];

            if (campo === "fecha" && valor) {
                valor = String(valor).slice(0, 10);
            }

            input.value =
                valor === null || valor === undefined ? "" : valor;
        }


        // El proyecto de la actividad puede estar finalizado
        // (no aparece en el dropdown): se agrega para mostrarlo.
        if (a.id_proyecto) {

            const select = document.getElementById("id_proyecto");

            const existe = Array.from(select.options).some(
                (o) => o.value === String(a.id_proyecto)
            );

            if (!existe) {

                const opt = document.createElement("option");

                opt.value = a.id_proyecto;
                opt.textContent = `Proyecto #${a.id_proyecto} (finalizado)`;

                select.appendChild(opt);
            }

            select.value = String(a.id_proyecto);
        }


        return true;


    } catch (error) {

        console.error(
            "Error cargando actividad:",
            error
        );

        mostrarMensaje(
            "No se pudo cargar la información de la actividad.",
            true
        );

        return false;
    }
}


function leerEntero(id, obligatorio) {

    const raw =
        document.getElementById(id).value.trim();

    if (raw === "") {
        return obligatorio ? false : null;
    }

    const n = Number(raw);

    if (!Number.isInteger(n) || n < 0) {
        return false;
    }

    return n;
}


async function guardarActividad(event) {

    event.preventDefault();

    const texto = (id) => {

        const valor =
            document.getElementById(id).value.trim();

        return valor === "" ? null : valor;
    };


    const id_proyecto = leerEntero("id_proyecto", true);
    const numero_asistentes = leerEntero("numero_asistentes", true);
    const fecha =
        document.getElementById("fecha").value;


    if (id_proyecto === false) {

        mostrarMensaje("El proyecto es obligatorio.", true);

        return;
    }

    for (const [id, etiqueta] of [
        ["nombre", "El nombre"],
        ["tema", "El tema"],
        ["responsable", "El responsable"],
        ["realizado_por", "El campo realizado por"],
        ["eje", "El eje"]
    ]) {

        if (!texto(id)) {

            mostrarMensaje(`${etiqueta} es obligatorio.`, true);

            return;
        }
    }

    if (!fecha) {

        mostrarMensaje("La fecha es obligatoria.", true);

        return;
    }

    if (numero_asistentes === false) {

        mostrarMensaje("El número de asistentes es obligatorio.", true);

        return;
    }


    const body = {
        id_proyecto,
        nombre: texto("nombre"),
        tema: texto("tema"),
        fecha,
        numero_asistentes,
        responsable: texto("responsable"),
        realizado_por: texto("realizado_por"),
        eje: texto("eje"),
        resumen_evento: texto("resumen_evento"),
        enlace_en_redes: texto("enlace_en_redes"),
        lugar: texto("lugar"),
        grupo_beneficiado: texto("grupo_beneficiado"),
        temas_centrales: texto("temas_centrales"),
        duracion: texto("duracion"),
        objetivos: texto("objetivos"),
        resultados: texto("resultados"),
        aportes_del_evento: texto("aportes_del_evento"),
        comentario: texto("comentario"),
        materiales: texto("materiales"),
        alimentos: texto("alimentos")
    };


    for (const id of [
        "ninos",
        "ninas",
        "adolescentes_h",
        "adolescentes_m",
        "adultos"
    ]) {

        const valor = leerEntero(id, false);

        if (valor === false) {

            mostrarMensaje(
                "Los conteos deben ser enteros mayores o iguales a 0.",
                true
            );

            return;
        }

        body[id] = valor;
    }


    const url =
        editId === null ? "/api/actividades" : `/api/actividades/${editId}`;

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
                    ? "No se pudo crear la actividad."
                    : "No se pudo guardar los cambios.")
            );
        }


        mostrarMensaje(
            editId === null
                ? "Actividad creada correctamente."
                : "Cambios guardados correctamente.",
            false
        );

        setTimeout(() => {

            window.location.href = "actividades.html";

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


    await cargarProyectos();


    const params =
        new URLSearchParams(window.location.search);

    const idParam = params.get("id");
    const modoParam = params.get("modo");


    if (idParam !== null && idParam !== "") {

        const id = Number(idParam);

        if (!Number.isInteger(id)) {

            mostrarMensaje("ID de actividad inválido.", true);

            return;
        }


        modoVer = modoParam === "ver";

        const permisos = sesion.permisos || [];

        if (
            modoVer &&
            !permisos.includes("actividades.ver")
        ) {

            mostrarMensaje(
                "No tienes permiso para ver actividades.",
                true
            );

            return;
        }


        if (
            !modoVer &&
            !permisos.includes("actividades.editar")
        ) {

            mostrarMensaje(
                "No tienes permiso para editar actividades.",
                true
            );

            return;
        }


        editId = id;

        document.getElementById("formTitle").textContent =
            modoVer ? "Detalle de la actividad" : "Editar actividad";

        document.getElementById("formSubtitle").textContent =
            modoVer
                ? "Información de la actividad (solo lectura)."
                : "Modifica la información y guarda los cambios.";

        document.getElementById("submitButton").textContent =
            "✓ Guardar cambios";


        const ok = await cargarActividad(id);

        if (!ok) return;


        setSoloLectura(modoVer);

        initAsistencia(
            !modoVer && permisos.includes("actividades.editar")
        );

        document
            .getElementById("editButton")
            .addEventListener("click", () => {

                modoVer = false;

                document.getElementById("formTitle").textContent =
                    "Editar actividad";

                document.getElementById("formSubtitle").textContent =
                    "Modifica la información y guarda los cambios.";

                document.getElementById("submitButton").textContent =
                    "✓ Guardar cambios";

                setSoloLectura(false);

                initAsistencia(
                    permisos.includes("actividades.editar")
                );
            });
    }


    document
        .getElementById("actividadForm")
        .addEventListener("submit", guardarActividad);


    const logoutButton =
        document.querySelector(".logout");

    if (logoutButton) {

        logoutButton.addEventListener("click", (e) => {

            e.preventDefault();

            cerrarSesion();
        });
    }
}

let asistenciaListenersOk = false;

let asistenciaGestionable = false;

let asistenciaPersonas = [];

let asistenciaPendiente = new Set();

let asistenciaInicial = new Set();


/*
=========================================
ASISTENCIA A LA ACTIVIDAD
Checklist de todas las personas activas;
los cambios se guardan con el botón
"Guardar asistencia".
=========================================
*/

function mostrarMensajeAsistencia(texto, esError) {

    const el =
        document.getElementById("asistenciaMessage");

    if (!el) return;

    el.textContent = texto;
    el.style.color = esError ? "#d23c78" : "green";
}


async function cargarPersonasAsistencia() {

    try {

        const response =
            await fetch(
                "/api/voluntarios/opciones",
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!response.ok) {
            throw new Error("personas");
        }

        const data =
            await response.json();

        return (data.voluntarios || []).map((p) => ({
            id_persona: p.id_persona,
            nombres: p.nombres,
            apellidos: p.apellidos,
            activo: true
        }));

    } catch (error) {

        console.error(
            "Error cargando personas:",
            error
        );

        return [];
    }
}


async function cargarMarcadosAsistencia() {

    try {

        const response =
            await fetch(
                `/api/asistencias?id_actividad=${editId}&todos=1`,
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!response.ok) {
            throw new Error("asistencia");
        }

        const data =
            await response.json();

        return data.asistencia || [];

    } catch (error) {

        console.error(
            "Error cargando asistencia:",
            error
        );

        return [];
    }
}


function actualizarContadorAsistencia() {

    const info =
        document.getElementById("asistenciaInfo");

    if (!info) return;

    info.textContent =
        `${asistenciaPendiente.size} de ${asistenciaPersonas.length} ` +
        `personas marcadas como asistentes.`;
}


function renderAsistencia() {

    const contenedor =
        document.getElementById("asistenciaChecklist");


    if (asistenciaPersonas.length === 0) {

        contenedor.innerHTML =
            "<p>No hay personas registradas.</p>";

        actualizarContadorAsistencia();

        return;
    }


    contenedor.innerHTML = asistenciaPersonas.map((p) => {

        const marcada =
            asistenciaPendiente.has(p.id_persona);

        const iniciales =
            ((p.nombres || "").charAt(0) +
                (p.apellidos || "").charAt(0)).toUpperCase() || "?";

        return `
            <label class="asistencia-item">
                <input
                    type="checkbox"
                    data-persona="${p.id_persona}"
                    ${marcada ? "checked" : ""}
                    ${asistenciaGestionable ? "" : "disabled"}
                >
                <div class="user">
                    <div class="user-avatar avatar-pink">${escapeHtml(iniciales)}</div>
                    <div>
                        <strong>${escapeHtml(p.nombres)} ${escapeHtml(p.apellidos)}</strong>
                        <span>ID: ${p.id_persona}${p.activo ? "" : " (inactivo)"}</span>
                    </div>
                </div>
            </label>`;
    }).join("");


    contenedor
        .querySelectorAll("input[data-persona]")
        .forEach((cb) => {

            cb.addEventListener("change", () => {

                const id =
                    Number(cb.dataset.persona);

                if (cb.checked) {
                    asistenciaPendiente.add(id);
                } else {
                    asistenciaPendiente.delete(id);
                }

                actualizarContadorAsistencia();
            });
        });


    actualizarContadorAsistencia();
}


async function recargarAsistencia() {

    const personas =
        await cargarPersonasAsistencia();

    const marcados =
        await cargarMarcadosAsistencia();


    // Personas ya marcadas que están inactivas se muestran
    // como (inactivo) para no perderlas al guardar.
    const idsActivas =
        new Set(personas.map((p) => p.id_persona));

    const inactivas =
        marcados
            .filter((m) => !idsActivas.has(m.id_persona))
            .map((m) => ({
                id_persona: m.id_persona,
                nombres: m.nombres,
                apellidos: m.apellidos,
                activo: false
            }));


    asistenciaPersonas =
        [...personas, ...inactivas];

    asistenciaPendiente =
        new Set(marcados.map((m) => m.id_persona));

    asistenciaInicial =
        new Set(asistenciaPendiente);


    renderAsistencia();
}


async function guardarAsistencia() {

    const iguales =
        asistenciaInicial.size === asistenciaPendiente.size &&
        [...asistenciaPendiente].every(
            (id) => asistenciaInicial.has(id)
        );


    if (iguales) {

        mostrarMensajeAsistencia(
            "No hay cambios que guardar.",
            false
        );

        return;
    }


    const guardado = iniciarGuardado({
        boton: document.getElementById("guardarAsistenciaButton"),
        mostrar: mostrarMensajeAsistencia,
        reactivar: true
    });

    if (!guardado) return;


    try {

        const response =
            await fetch(
                `/api/asistencias/${editId}`,
                {
                    method: "PUT",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        id_personas: [...asistenciaPendiente]
                    })
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
                data.message || "No se pudo guardar la asistencia."
            );
        }


        mostrarMensajeAsistencia(
            data.message || "Asistencia guardada correctamente.",
            false
        );

        await recargarAsistencia();

        guardado.exito();


    } catch (error) {

        guardado.error();

        console.error(error);

        mostrarMensajeAsistencia(error.message, true);
    }
}


function initAsistencia(gestionar) {

    asistenciaGestionable = gestionar;

    document.getElementById("asistenciaSection").style.display = "";

    document.getElementById("guardarAsistenciaButton").style.display =
        gestionar ? "" : "none";


    if (!asistenciaListenersOk) {

        asistenciaListenersOk = true;

        document
            .getElementById("guardarAsistenciaButton")
            .addEventListener("click", guardarAsistencia);
    }


    recargarAsistencia();
}


init();
