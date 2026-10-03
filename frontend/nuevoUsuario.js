/*
=========================================
NUEVO / EDITAR USUARIO
Crear: POST /api/usuarios
{id_rol, nombre_usuario, nombre, apellido, password, correo}
Editar (?id=): PUT /api/usuarios/:id
{id_rol, nombre_usuario, nombre, apellido, correo, estado}
(la contraseña solo se cambia si se escribe una nueva)
=========================================
*/

let permisosActuales = [];
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


async function cargarRoles() {

    const select =
        document.getElementById("rol");

    try {

        const response =
            await fetch(
                "/api/roles",
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!response.ok) {
            throw new Error("roles");
        }

        const data =
            await response.json();

        const roles = data.roles || [];

        select.innerHTML =
            `<option value="">Seleccione un rol</option>` +
            roles.map((r) =>
                `<option value="${r.id_rol}">${r.nombre}</option>`
            ).join("");

    } catch (error) {

        console.error(
            "Error cargando roles:",
            error
        );

        select.innerHTML =
            `<option value="">No se pudieron cargar los roles</option>`;
    }
}


/*
=========================================
CARGAR USUARIO PARA EDITAR
=========================================
*/

async function cargarUsuario(id) {

    try {

        const response =
            await fetch(
                `/api/usuarios/${id}`,
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
                "No tienes permiso para editar usuarios.",
                true
            );

            return false;
        }


        if (response.status === 404) {

            mostrarMensaje(
                "Usuario no encontrado.",
                true
            );

            return false;
        }


        if (!response.ok) {
            throw new Error("carga");
        }


        const data =
            await response.json();

        const u = data.usuario;


        document.getElementById("nombre").value = u.nombre || "";
        document.getElementById("apellido").value = u.apellido || "";
        document.getElementById("correo").value = u.correo || "";
        document.getElementById("usuario").value = u.nombre_usuario || "";
        document.getElementById("rol").value = String(u.id_rol || "");

        document.querySelector(
            `input[name="estado"][value="${u.estado ? "activo" : "inactivo"}"]`
        ).checked = true;


        return true;


    } catch (error) {

        console.error(
            "Error cargando usuario:",
            error
        );

        mostrarMensaje(
            "No se pudo cargar la información del usuario.",
            true
        );

        return false;
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


function leerEstado() {

    const checked =
        document.querySelector('input[name="estado"]:checked');

    return checked && checked.value === "activo";
}


async function guardarUsuario(event) {

    event.preventDefault();

    const nombre =
        document.getElementById("nombre").value.trim();

    const apellido =
        document.getElementById("apellido").value.trim();

    const correo =
        document.getElementById("correo").value.trim();

    const nombre_usuario =
        document.getElementById("usuario").value.trim();

    const id_rol =
        Number(document.getElementById("rol").value);


    if (!nombre || !apellido || !correo || !nombre_usuario || !id_rol) {

        mostrarMensaje("Todos los campos marcados son obligatorios.", true);

        return;
    }


    let url = "/api/usuarios";
    let method = "POST";
    let body = null;

    const password =
        document.getElementById("password").value;

    const confirm =
        document.getElementById("confirm-password").value;


    if (editId === null) {

        if (!password) {

            mostrarMensaje("Todos los campos marcados son obligatorios.", true);

            return;
        }


        if (password.length < 8) {

            mostrarMensaje("La contraseña debe tener al menos 8 caracteres.", true);

            return;
        }


        if (password !== confirm) {

            mostrarMensaje("Las contraseñas no coinciden.", true);

            return;
        }


        body = {
            id_rol,
            nombre_usuario,
            nombre,
            apellido,
            password,
            correo
        };

    } else {

        url = `/api/usuarios/${editId}`;
        method = "PUT";

        body = {
            id_rol,
            nombre_usuario,
            nombre,
            apellido,
            correo,
            estado: leerEstado()
        };


        // Contraseña opcional al editar:
        // vacía = no se cambia.
        if (password !== "" || confirm !== "") {

            if (password.length < 8) {

                mostrarMensaje("La contraseña debe tener al menos 8 caracteres.", true);

                return;
            }

            if (password !== confirm) {

                mostrarMensaje("Las contraseñas no coinciden.", true);

                return;
            }

            body.password = password;
        }
    }


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
                    ? "No se pudo crear el usuario."
                    : "No se pudo guardar los cambios.")
            );
        }


        mostrarMensaje(
            editId === null
                ? "Usuario creado correctamente."
                : "Cambios guardados correctamente.",
            false
        );

        setTimeout(() => {

            window.location.href = "usuarios.html";

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

    permisosActuales =
        sesion.permisos || [];


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

    if (idParam !== null && idParam !== "") {

        const id = Number(idParam);

        if (!Number.isInteger(id)) {

            mostrarMensaje("ID de usuario inválido.", true);

            return;
        }


        if (!permisosActuales.includes("usuarios.editar")) {

            mostrarMensaje(
                "No tienes permiso para editar usuarios.",
                true
            );

            return;
        }


        editId = id;

        document.getElementById("formTitle").textContent =
            "Editar usuario";

        document.getElementById("submitButton").textContent =
            "✓ Guardar cambios";


        // La contraseña es opcional al editar:
        // vacía = no se cambia.
        for (const inputId of ["password", "confirm-password"]) {

            const input = document.getElementById(inputId);

            if (input) {

                input.removeAttribute("required");

                input.placeholder =
                    inputId === "password"
                        ? "Nueva contraseña (opcional)"
                        : "Repite la nueva contraseña";
            }
        }

        const passGroup =
            document.getElementById("password").closest(".form-group");

        const hint =
            passGroup && passGroup.querySelector("small");

        if (hint) {

            hint.textContent =
                "Déjala vacía para no cambiarla. Mínimo 8 caracteres si la cambias.";
        }
    }


    await cargarRoles();


    if (editId !== null) {

        const ok = await cargarUsuario(editId);

        if (!ok) return;
    }


    document
        .getElementById("userForm")
        .addEventListener("submit", guardarUsuario);


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
