/*
=========================================
NUEVA / EDITAR CATEGORÍA
Crear: POST /api/categorias-gasto {nombre, descripcion?}
Editar (?id=): PUT /api/categorias-gasto/:id {nombre, descripcion?}
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


async function cargarRubros() {

    const select =
        document.getElementById("id_rubro");

    try {

        const response =
            await fetch(
                "/api/rubros/opciones",
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (!response.ok) {
            throw new Error("rubros");
        }

        const data =
            await response.json();

        const rubros = (data.rubros || []).filter((r) => r.estado);

        select.innerHTML =
            `<option value="">Seleccione un rubro</option>` +
            rubros.map((r) =>
                `<option value="${r.id_rubro}">${escapeHtml(r.nombre)}</option>`
            ).join("");

    } catch (error) {

        console.error(
            "Error cargando rubros:",
            error
        );

        select.innerHTML =
            `<option value="">No se pudieron cargar los rubros</option>`;
    }
}


async function cargarCategoria(id) {

    try {

        const response =
            await fetch(
                `/api/categorias-gasto/${id}`,
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
                "No tienes permiso para ver categorías.",
                true
            );

            return false;
        }


        if (response.status === 404) {

            mostrarMensaje(
                "Categoría no encontrada.",
                true
            );

            return false;
        }


        if (!response.ok) {
            throw new Error("carga");
        }


        const data =
            await response.json();

        const categoria = data.categoria;


        document.getElementById("nombre").value = categoria.nombre || "";
        document.getElementById("descripcion").value = categoria.descripcion || "";


        // El rubro de la categoría puede estar inactivo:
        // se agrega la opción para mostrarlo.
        if (categoria.id_rubro) {

            const select = document.getElementById("id_rubro");

            const existe = Array.from(select.options).some(
                (o) => o.value === String(categoria.id_rubro)
            );

            if (!existe) {

                const opt = document.createElement("option");

                opt.value = categoria.id_rubro;
                opt.textContent = categoria.rubro || `Rubro #${categoria.id_rubro}`;

                select.appendChild(opt);
            }

            select.value = String(categoria.id_rubro);
        }


        return true;


    } catch (error) {

        console.error(
            "Error cargando categoría:",
            error
        );

        mostrarMensaje(
            "No se pudo cargar la información de la categoría.",
            true
        );

        return false;
    }
}


async function guardarCategoria(event) {

    event.preventDefault();

    const nombre =
        document.getElementById("nombre").value.trim();

    const descripcion =
        document.getElementById("descripcion").value.trim();

    const id_rubro =
        Number(document.getElementById("id_rubro").value);


    if (!Number.isInteger(id_rubro)) {

        mostrarMensaje("El rubro es obligatorio.", true);

        return;
    }


    if (!nombre) {

        mostrarMensaje("El nombre es obligatorio.", true);

        return;
    }


    const body = {
        id_rubro,
        nombre,
        descripcion: descripcion === "" ? null : descripcion
    };

    const url =
        editId === null ? "/api/categorias-gasto" : `/api/categorias-gasto/${editId}`;

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
                    ? "No se pudo crear la categoría."
                    : "No se pudo guardar los cambios.")
            );
        }


        mostrarMensaje(
            editId === null
                ? "Categoría creada correctamente."
                : "Cambios guardados correctamente.",
            false
        );

        setTimeout(() => {

            const origen =
                new URLSearchParams(window.location.search).get("origen");

            window.location.href =
                editId === null && origen === "nuevoGasto"
                    ? "nuevoGasto.html"
                    : "categorias-gasto.html";

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


    await cargarRubros();


    const params =
        new URLSearchParams(window.location.search);

    const idParam = params.get("id");

    const origenParam = params.get("origen");


    if (origenParam === "nuevoGasto") {

        const volver =
            document.querySelector("a.cancel-button");

        if (volver) volver.href = "nuevoGasto.html";
    }


    if (idParam !== null && idParam !== "") {

        const id = Number(idParam);

        if (!Number.isInteger(id)) {

            mostrarMensaje("ID de categoría inválido.", true);

            return;
        }


        const permisos = sesion.permisos || [];

        if (!permisos.includes("finanzas.editar")) {

            mostrarMensaje(
                "No tienes permiso para editar categorías.",
                true
            );

            return;
        }


        editId = id;

        document.getElementById("formTitle").textContent =
            "Editar categoría";

        document.getElementById("submitButton").textContent =
            "✓ Guardar cambios";


        const ok = await cargarCategoria(id);

        if (!ok) return;
    }


    document
        .getElementById("categoriaForm")
        .addEventListener("submit", guardarCategoria);


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
