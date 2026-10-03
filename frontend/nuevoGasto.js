/*
=========================================
NUEVO / VER / EDITAR GASTO
Crear: POST /api/gastos
Ver: ?id=X&modo=ver (solo lectura + botón Editar)
Editar: ?id=X -> PUT /api/gastos/:id
El estado se cambia desde la lista (PATCH).
=========================================
*/

let editId = null;
let modoVer = false;


const CAMPOS = [
    "id_proyecto",
    "id_categoria",
    "numero",
    "fecha",
    "numero_documento",
    "serie",
    "tipo_documento",
    "razon_denominacion_social",
    "descripcion",
    "valor_base",
    "iva",
    "otros_impuestos",
    "monto",
    "trayecto",
    "numero_comprobante",
    "proveedor",
    "total_valor_base",
    "total_del_gasto"
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


async function cargarCategorias() {

    const select =
        document.getElementById("id_categoria");

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
            "Error cargando categorias:",
            error
        );

        select.innerHTML =
            `<option value="">No se pudieron cargar las categorías</option>`;
    }
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
            (p) => p.estado === "en proceso"
        );

        select.innerHTML =
            `<option value="">Seleccione un proyecto</option>` +
            lista.map((p) =>
                `<option value="${p.id_proyecto}">${p.nombre}</option>`
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


async function cargarGasto(id) {

    try {

        const response =
            await fetch(
                `/api/gastos/${id}`,
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
                "No tienes permiso para ver gastos.",
                true
            );

            return false;
        }


        if (response.status === 404) {

            mostrarMensaje(
                "Gasto no encontrado.",
                true
            );

            return false;
        }


        if (!response.ok) {
            throw new Error("carga");
        }


        const data =
            await response.json();

        const g = data.gasto;


        for (const campo of CAMPOS) {

            const input = document.getElementById(campo);

            if (!input) continue;

            let valor = g[campo];

            if (campo === "fecha" && valor) {
                valor = String(valor).slice(0, 10);
            }

            input.value =
                valor === null || valor === undefined ? "" : valor;
        }


        // La categoría del gasto puede estar inactiva:
        // se agrega la opción para mostrarlo.
        if (g.id_categoria) {

            const select = document.getElementById("id_categoria");

            const existe = Array.from(select.options).some(
                (o) => o.value === String(g.id_categoria)
            );

            if (!existe) {

                const opt = document.createElement("option");

                opt.value = g.id_categoria;
                opt.textContent = g.categoria || `Categoría #${g.id_categoria}`;

                select.appendChild(opt);
            }

            select.value = String(g.id_categoria);
        }


        // El proyecto del gasto puede no estar en proceso
        // (no aparece en el dropdown): se agrega para mostrarlo.
        if (g.id_proyecto) {

            const selectProyecto = document.getElementById("id_proyecto");

            const existeProyecto = Array.from(selectProyecto.options).some(
                (o) => o.value === String(g.id_proyecto)
            );

            if (!existeProyecto) {

                const opt = document.createElement("option");

                opt.value = g.id_proyecto;
                opt.textContent = `Proyecto #${g.id_proyecto}`;

                selectProyecto.appendChild(opt);
            }

            selectProyecto.value = String(g.id_proyecto);
        }


        return true;


    } catch (error) {

        console.error(
            "Error cargando gasto:",
            error
        );

        mostrarMensaje(
            "No se pudo cargar la información del gasto.",
            true
        );

        return false;
    }
}


function leerEntero(id) {

    const raw =
        document.getElementById(id).value.trim();

    if (raw === "") {
        return null;
    }

    const n = Number(raw);

    if (!Number.isInteger(n)) {
        return false;
    }

    return n;
}


function leerNumero(id) {

    const raw =
        document.getElementById(id).value.trim();

    if (raw === "") {
        return null;
    }

    const n = Number(raw);

    if (!Number.isFinite(n) || n < 0) {
        return false;
    }

    return n;
}


async function guardarGasto(event) {

    event.preventDefault();

    const texto = (id) => {

        const valor =
            document.getElementById(id).value.trim();

        return valor === "" ? null : valor;
    };


    const id_proyecto = leerEntero("id_proyecto");
    const id_categoria = leerEntero("id_categoria");
    const fecha =
        document.getElementById("fecha").value;
    const serie = texto("serie");
    const monto = leerNumero("monto");
    const numero = leerNumero("numero");
    const numero_documento = leerNumero("numero_documento");


    if (id_proyecto === null || id_proyecto === false) {

        mostrarMensaje("El proyecto es obligatorio.", true);

        return;
    }

    if (id_categoria === null || id_categoria === false) {

        mostrarMensaje("La categoría es obligatoria.", true);

        return;
    }

    if (numero === null || numero === false) {

        mostrarMensaje("El número es obligatorio.", true);

        return;
    }

    if (!fecha) {

        mostrarMensaje("La fecha es obligatoria.", true);

        return;
    }

    if (numero_documento === null || numero_documento === false) {

        mostrarMensaje("El número de documento es obligatorio.", true);

        return;
    }

    if (!serie) {

        mostrarMensaje("La serie es obligatoria.", true);

        return;
    }

    if (monto === null || monto === false) {

        mostrarMensaje("El monto es obligatorio.", true);

        return;
    }


    const body = {
        id_proyecto,
        id_categoria,
        numero,
        fecha,
        numero_documento,
        serie,
        tipo_documento: texto("tipo_documento"),
        razon_denominacion_social: texto("razon_denominacion_social"),
        descripcion: texto("descripcion"),
        trayecto: texto("trayecto"),
        proveedor: texto("proveedor")
    };


    for (const id of [
        "valor_base",
        "iva",
        "otros_impuestos",
        "numero_comprobante",
        "total_valor_base",
        "total_del_gasto"
    ]) {

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


    const url =
        editId === null ? "/api/gastos" : `/api/gastos/${editId}`;

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
                    ? "No se pudo registrar el gasto."
                    : "No se pudo guardar los cambios.")
            );
        }


        mostrarMensaje(
            editId === null
                ? "Gasto registrado correctamente."
                : "Cambios guardados correctamente.",
            false
        );

        setTimeout(() => {

            window.location.href = "gastos.html";

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


    await cargarCategorias();

    await cargarProyectos();


    const params =
        new URLSearchParams(window.location.search);

    const idParam = params.get("id");
    const modoParam = params.get("modo");


    if (idParam !== null && idParam !== "") {

        const id = Number(idParam);

        if (!Number.isInteger(id)) {

            mostrarMensaje("ID de gasto inválido.", true);

            return;
        }


        modoVer = modoParam === "ver";

        const permisos = sesion.permisos || [];

        if (
            modoVer &&
            !permisos.includes("finanzas.ver")
        ) {

            mostrarMensaje(
                "No tienes permiso para ver gastos.",
                true
            );

            return;
        }


        if (
            !modoVer &&
            !permisos.includes("finanzas.editar")
        ) {

            mostrarMensaje(
                "No tienes permiso para editar gastos.",
                true
            );

            return;
        }


        editId = id;

        document.getElementById("formTitle").textContent =
            modoVer ? "Detalle del gasto" : "Editar gasto";

        document.getElementById("formSubtitle").textContent =
            modoVer
                ? "Información del gasto (solo lectura)."
                : "Modifica la información y guarda los cambios.";

        document.getElementById("submitButton").textContent =
            "✓ Guardar cambios";


        const ok = await cargarGasto(id);

        if (!ok) return;


        setSoloLectura(modoVer);

        document
            .getElementById("editButton")
            .addEventListener("click", () => {

                modoVer = false;

                document.getElementById("formTitle").textContent =
                    "Editar gasto";

                document.getElementById("formSubtitle").textContent =
                    "Modifica la información y guarda los cambios.";

                document.getElementById("submitButton").textContent =
                    "✓ Guardar cambios";

                setSoloLectura(false);
            });
    }


    document
        .getElementById("gastoForm")
        .addEventListener("submit", guardarGasto);


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
