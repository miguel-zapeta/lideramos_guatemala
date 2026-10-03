/*
=========================================
NUEVO / EDITAR RUBRO
Crear: POST /api/rubros {nombre, descripcion?}
Editar (?id=): PUT /api/rubros/:id {nombre, descripcion?}
El estado se cambia desde la lista (PATCH).
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


async function cargarRubro(id) {

    try {

        const response =
            await fetch(
                `/api/rubros/${id}`,
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
                "No tienes permiso para ver rubros.",
                true
            );

            return false;
        }


        if (response.status === 404) {

            mostrarMensaje(
                "Rubro no encontrado.",
                true
            );

            return false;
        }


        if (!response.ok) {
            throw new Error("carga");
        }


        const data =
            await response.json();

        const rubro = data.rubro;


        document.getElementById("nombre").value = rubro.nombre || "";
        document.getElementById("descripcion").value = rubro.descripcion || "";


        return true;


    } catch (error) {

        console.error(
            "Error cargando rubro:",
            error
        );

        mostrarMensaje(
            "No se pudo cargar la información del rubro.",
            true
        );

        return false;
    }
}


async function guardarRubro(event) {

    event.preventDefault();

    const nombre =
        document.getElementById("nombre").value.trim();

    const descripcion =
        document.getElementById("descripcion").value.trim();


    if (!nombre) {

        mostrarMensaje("El nombre es obligatorio.", true);

        return;
    }


    const body = {
        nombre,
        descripcion: descripcion === "" ? null : descripcion
    };

    const url =
        editId === null ? "/api/rubros" : `/api/rubros/${editId}`;

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
                    ? "No se pudo crear el rubro."
                    : "No se pudo guardar los cambios.")
            );
        }


        mostrarMensaje(
            editId === null
                ? "Rubro creado correctamente."
                : "Cambios guardados correctamente.",
            false
        );

        setTimeout(() => {

            const origen =
                new URLSearchParams(window.location.search).get("origen");

            window.location.href =
                editId === null && origen === "nuevaCategoriaGasto"
                    ? "nuevaCategoriaGasto.html"
                    : "rubros.html";

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

    const origenParam = params.get("origen");


    if (origenParam === "nuevaCategoriaGasto") {

        const volver =
            document.querySelector("a.cancel-button");

        if (volver) volver.href = "nuevaCategoriaGasto.html";
    }


    if (idParam !== null && idParam !== "") {

        const id = Number(idParam);

        if (!Number.isInteger(id)) {

            mostrarMensaje("ID de rubro inválido.", true);

            return;
        }


        const permisos = sesion.permisos || [];

        if (!permisos.includes("finanzas.editar")) {

            mostrarMensaje(
                "No tienes permiso para editar rubros.",
                true
            );

            return;
        }


        editId = id;

        document.getElementById("formTitle").textContent =
            "Editar rubro";

        document.getElementById("submitButton").textContent =
            "✓ Guardar cambios";


        const ok = await cargarRubro(id);

        if (!ok) return;
    }


    document
        .getElementById("rubroForm")
        .addEventListener("submit", guardarRubro);


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
