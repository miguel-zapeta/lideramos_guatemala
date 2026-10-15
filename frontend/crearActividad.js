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


/*
=========================================
ASISTENCIA A LA ACTIVIDAD
=========================================
*/

function mostrarMensajeAsistencia(texto, esError) {

    const el =
        document.getElementById("asistenciaMessage");

    if (!el) return;

    el.textContent = texto;
    el.style.color = esError ? "#d23c78" : "green";
}


async function cargarPersonas() {

    const select =
        document.getElementById("asistenciaPersona");

    try {

        const response =
            await fetch(
                "/api/voluntarios",
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
            throw new Error("personas");
        }

        const data =
            await response.json();

        const personas = data.voluntarios || [];

        select.innerHTML =
            `<option value="">Seleccione una persona</option>` +
            personas.map((p) =>
                `<option value="${p.id_persona}">${escapeHtml(p.nombres)} ${escapeHtml(p.apellidos)}</option>`
            ).join("");

    } catch (error) {

        console.error(
            "Error cargando personas:",
            error
        );

        select.innerHTML =
            `<option value="">No se pudieron cargar las personas (requiere permiso de voluntarios)</option>`;
    }
}


async function cargarAsistencia() {

    const tbody =
        document.getElementById("asistenciaTbody");

    const info =
        document.getElementById("asistenciaInfo");

    try {

        const response =
            await fetch(
                `/api/asistencias?id_actividad=${editId}`,
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

        const lista = data.asistencia || [];

        info.textContent =
            lista.length === 0
                ? "Aún no hay personas marcadas en esta actividad."
                : `${lista.length} persona(s) asisten a esta actividad.`;


        if (lista.length === 0) {

            tbody.innerHTML =
                `<tr><td colspan="4">Sin asistencia registrada.</td></tr>`;

            return;
        }


        const gestionar =
            document.getElementById("marcarAsistenciaButton").style.display !== "none";

        tbody.innerHTML = lista.map((p, index) => {

            const iniciales =
                ((p.nombres || "").charAt(0) + (p.apellidos || "").charAt(0)).toUpperCase() || "?";

            return `
                <tr>
                    <td>
                        <div class="user">
                            <div class="user-avatar avatar-pink">${escapeHtml(iniciales)}</div>
                            <div>
                                <strong>${escapeHtml(p.nombres)} ${escapeHtml(p.apellidos)}</strong>
                                <span>ID: ${p.id_persona}</span>
                            </div>
                        </div>
                    </td>
                    <td>${escapeHtml(p.nombres) || "—"}</td>
                    <td>${escapeHtml(p.apellidos) || "—"}</td>
                    <td>
                        <div class="actions">
                            ${gestionar ? `
                            <button class="action delete" title="Quitar asistencia" data-quitar="${p.id_persona}">
                                ✖
                            </button>` : "—"}
                        </div>
                    </td>
                </tr>`;
        }).join("");


        tbody.querySelectorAll("button[data-quitar]").forEach((btn) => {

            btn.addEventListener("click", () => {

                quitarAsistencia(Number(btn.dataset.quitar));
            });
        });


    } catch (error) {

        console.error(
            "Error cargando asistencia:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="4">Error al cargar asistencia.</td></tr>`;
    }
}


async function marcarAsistencia() {

    const idPersona =
        Number(document.getElementById("asistenciaPersona").value);


    if (!Number.isInteger(idPersona)) {

        mostrarMensajeAsistencia("Seleccione una persona.", true);

        return;
    }


    try {

        const response =
            await fetch(
                "/api/asistencias",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({
                        id_actividad: editId,
                        id_persona: idPersona
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
                data.message || "No se pudo registrar la asistencia."
            );
        }


        document.getElementById("asistenciaPersona").value = "";

        mostrarMensajeAsistencia(data.message, false);

        await cargarAsistencia();


    } catch (error) {

        console.error(error);

        mostrarMensajeAsistencia(error.message, true);
    }
}


async function quitarAsistencia(idPersona) {

    try {

        const response =
            await fetch(
                `/api/asistencias/${editId}/${idPersona}`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );


        if (response.status === 401) {

            window.location.replace("/login.html");

            return;
        }


        if (!response.ok) {

            const data =
                await response.json().catch(() => ({}));

            throw new Error(
                data.message || "No se pudo quitar la asistencia."
            );
        }


        await cargarAsistencia();


    } catch (error) {

        console.error(error);

        alert(error.message);
    }
}


function initAsistencia(gestionar) {

    document.getElementById("asistenciaSection").style.display = "";

    document.getElementById("marcarAsistenciaButton").style.display =
        gestionar ? "" : "none";

    document.getElementById("asistenciaPersona").style.display =
        gestionar ? "" : "none";


    if (!asistenciaListenersOk) {

        asistenciaListenersOk = true;

        document
            .getElementById("marcarAsistenciaButton")
            .addEventListener("click", marcarAsistencia);
    }


    cargarPersonas();
    cargarAsistencia();
}


init();
