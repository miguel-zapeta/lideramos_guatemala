/*
=========================================
NUEVO / EDITAR PATROCINADOR
Crear: POST /api/patrocinadores
Editar (?id=): PUT /api/patrocinadores/:id
El estado se cambia desde la lista (PATCH).
La fecha de registro es automática (no editable).
=========================================
*/

let editId = null;


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


function actualizarEtiquetaNombre() {

    const tipo =
        document.getElementById("tipo").value;

    const etiqueta =
        document.getElementById("nombreLabel");

    const input =
        document.getElementById("nombre_razon_social");

    if (tipo === "empresa") {

        etiqueta.textContent = "Razón social";

        input.placeholder = "Razón social de la empresa";

    } else {

        etiqueta.textContent = "Nombre";

        input.placeholder = "Nombre completo";

    }
}


async function cargarPatrocinador(id) {

    try {

        const response =
            await fetch(
                `/api/patrocinadores/${id}`,
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
                "No tienes permiso para ver patrocinadores.",
                true
            );

            return false;
        }


        if (response.status === 404) {

            mostrarMensaje(
                "Patrocinador no encontrado.",
                true
            );

            return false;
        }


        if (!response.ok) {
            throw new Error("carga");
        }


        const data =
            await response.json();

        const patrocinador = data.patrocinador;


        document.getElementById("tipo").value =
            patrocinador.tipo || "";

        actualizarEtiquetaNombre();

        document.getElementById("nombre_razon_social").value =
            patrocinador.nombre_razon_social || "";

        document.getElementById("dpi").value =
            patrocinador.dpi === null || patrocinador.dpi === undefined
                ? ""
                : patrocinador.dpi;

        document.getElementById("persona_contacto").value =
            patrocinador.persona_contacto || "";

        document.getElementById("telefono").value =
            patrocinador.telefono === null || patrocinador.telefono === undefined
                ? ""
                : patrocinador.telefono;

        document.getElementById("correo").value =
            patrocinador.correo || "";

        document.getElementById("direccion").value =
            patrocinador.direccion || "";

        document.getElementById("municipio").value =
            patrocinador.municipio || "";

        document.getElementById("pais").value =
            patrocinador.pais || "";

        document.getElementById("observaciones").value =
            patrocinador.observaciones || "";


        if (patrocinador.fecha_registro) {

            const grupoFecha =
                document.getElementById("fechaRegistroGroup");

            grupoFecha.style.display = "";

            document.getElementById("fecha_registro").value =
                patrocinador.fecha_registro;
        }


        return true;


    } catch (error) {

        console.error(
            "Error cargando patrocinador:",
            error
        );

        mostrarMensaje(
            "No se pudo cargar la información del patrocinador.",
            true
        );

        return false;
    }
}


async function guardarPatrocinador(event) {

    event.preventDefault();

    const tipo =
        document.getElementById("tipo").value;

    const nombre_razon_social =
        document.getElementById("nombre_razon_social").value.trim();


    if (!tipo) {

        mostrarMensaje("El tipo es obligatorio.", true);

        return;
    }


    if (!nombre_razon_social) {

        mostrarMensaje("El nombre o razón social es obligatorio.", true);

        return;
    }


    const texto = (id) =>
        document.getElementById(id).value.trim() || null;

    const entero = (id) => {

        const raw =
            document.getElementById(id).value.trim();

        return raw === "" ? null : raw;
    };


    const body = {
        tipo,
        nombre_razon_social,
        dpi: entero("dpi"),
        persona_contacto: texto("persona_contacto"),
        telefono: entero("telefono"),
        correo: texto("correo"),
        direccion: texto("direccion"),
        municipio: texto("municipio"),
        pais: texto("pais"),
        observaciones: texto("observaciones")
    };

    const url =
        editId === null ? "/api/patrocinadores" : `/api/patrocinadores/${editId}`;

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
                    ? "No se pudo crear el patrocinador."
                    : "No se pudo guardar los cambios.")
            );
        }


        mostrarMensaje(
            editId === null
                ? "Patrocinador creado correctamente."
                : "Cambios guardados correctamente.",
            false
        );

        setTimeout(() => {

            window.location.href = "patrocinadores.html";

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


    document
        .getElementById("tipo")
        .addEventListener("change", actualizarEtiquetaNombre);


    const params =
        new URLSearchParams(window.location.search);

    const idParam = params.get("id");


    if (idParam !== null && idParam !== "") {

        const id = Number(idParam);

        if (!Number.isInteger(id)) {

            mostrarMensaje("ID de patrocinador inválido.", true);

            return;
        }


        const permisos = sesion.permisos || [];

        if (!permisos.includes("finanzas.editar")) {

            mostrarMensaje(
                "No tienes permiso para editar patrocinadores.",
                true
            );

            return;
        }


        editId = id;

        document.getElementById("formTitle").textContent =
            "Editar patrocinador";

        document.getElementById("submitButton").textContent =
            "✓ Guardar cambios";


        const ok = await cargarPatrocinador(id);

        if (!ok) return;
    }


    document
        .getElementById("patrocinadorForm")
        .addEventListener("submit", guardarPatrocinador);


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
