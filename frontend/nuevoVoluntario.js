/*
=========================================
NUEVO / VER / EDITAR VOLUNTARIO
Crear: POST /api/voluntarios {nombres, apellidos, edad?, municipio?, centro_educativo?, jornada?}
Ver: ?id=X&modo=ver (solo lectura + botón Editar)
Editar: ?id=X -> PUT /api/voluntarios/:id
=========================================
*/

let permisosActuales = [];
let editId = null;
let modoVer = false;


const CAMPOS = [
    "nombres",
    "apellidos",
    "edad",
    "dpi",
    "municipio",
    "telefono",
    "centro_educativo",
    "jornada",
    "encargado",
    "telefono_encargado",
    "dpi_del_encargado",
    "carta_compromiso",
    "carta_medios_comunicacion",
    "dpi18",
    "certificado_nacimiento",
    "dpi_encargado",
    "biografia"
];

const CAMPOS_OTRO = [
    "dpi18",
    "dpi_encargado",
    "certificado_nacimiento",
    "carta_compromiso",
    "carta_medios_comunicacion"
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

    for (const id of CAMPOS_OTRO) {

        const otro = document.getElementById(`${id}_otro`);

        if (otro) otro.disabled = soloLectura;
    }

    document.getElementById("submitButton").style.display =
        soloLectura ? "none" : "";

    document.getElementById("editButton").style.display =
        soloLectura ? "" : "none";
}


function actualizarOtro(id) {

    const select = document.getElementById(id);
    const otro = document.getElementById(`${id}_otro`);

    if (!select || !otro) return;

    otro.style.display =
        select.value === "otro" ? "" : "none";

    if (select.value !== "otro") {
        otro.value = "";
    }
}


function leerDocumento(id) {

    const select = document.getElementById(id);

    if (select.value === "otro") {

        const texto =
            document.getElementById(`${id}_otro`).value.trim();

        return texto === "" ? null : texto;
    }

    return select.value === "" ? null : select.value;
}


function fijarDocumento(id, valor) {

    const select = document.getElementById(id);
    const otro = document.getElementById(`${id}_otro`);

    const opciones = Array.from(select.options).map((o) => o.value);

    if (valor !== null && valor !== undefined && valor !== "" && !opciones.includes(valor)) {

        select.value = "otro";
        otro.value = valor;
        otro.style.display = "";

    } else {

        select.value = valor || "";
        otro.value = "";
        otro.style.display = "none";
    }
}


function mostrarProyectos(proyectos) {

    const section =
        document.getElementById("proyectosSection");

    const info =
        document.getElementById("proyectosInfo");

    section.style.display = "";

    if (!proyectos || proyectos.length === 0) {

        info.textContent =
            "Este voluntario aún no está asignado a ningún proyecto.";

    } else {

        info.textContent =
            `Asignado a ${proyectos.length} proyecto(s): ` +
            proyectos.map((id) => `Proyecto #${id}`).join(", ");
    }
}


async function cargarVoluntario(id) {

    try {

        const response =
            await fetch(
                `/api/voluntarios/${id}`,
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
                "No tienes permiso para ver voluntarios.",
                true
            );

            return false;
        }


        if (response.status === 404) {

            mostrarMensaje(
                "Voluntario no encontrado.",
                true
            );

            return false;
        }


        if (!response.ok) {
            throw new Error("carga");
        }


        const data =
            await response.json();

        const v = data.voluntario;


        for (const id of CAMPOS) {

            if (CAMPOS_OTRO.includes(id)) {

                fijarDocumento(id, v[id]);

                continue;
            }

            const input = document.getElementById(id);

            if (!input) continue;

            const valor = v[id];

            input.value =
                valor === null || valor === undefined ? "" : valor;
        }

        mostrarProyectos(v.proyectos);


        return true;


    } catch (error) {

        console.error(
            "Error cargando voluntario:",
            error
        );

        mostrarMensaje(
            "No se pudo cargar la información del voluntario.",
            true
        );

        return false;
    }
}


function leerEnteroOpcional(id) {

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


function leerEdad() {

    const n = leerEnteroOpcional("edad");

    if (n === false || (n !== null && n < 0)) {
        return false;
    }

    return n;
}


async function guardarVoluntario(event) {

    event.preventDefault();

    const nombres =
        document.getElementById("nombres").value.trim();

    const apellidos =
        document.getElementById("apellidos").value.trim();


    if (!nombres || !apellidos) {

        mostrarMensaje("Nombre y apellido son obligatorios.", true);

        return;
    }


    const edad = leerEdad();

    if (edad === false) {

        mostrarMensaje(
            "La edad debe ser un número entero mayor o igual a 0.",
            true
        );

        return;
    }


    const enteros = {};

    for (const id of ["dpi", "telefono", "telefono_encargado", "dpi_del_encargado"]) {

        const valor = leerEnteroOpcional(id);

        if (valor === false) {

            mostrarMensaje(
                `El campo ${id} debe ser un número entero.`,
                true
            );

            return;
        }

        enteros[id] = valor;
    }


    const texto = (id) => {

        const valor =
            document.getElementById(id).value.trim();

        return valor === "" ? null : valor;
    };


    const body = {
        nombres,
        apellidos,
        edad,
        dpi: enteros.dpi,
        municipio: texto("municipio"),
        telefono: enteros.telefono,
        centro_educativo: texto("centro_educativo"),
        jornada: texto("jornada"),
        encargado: texto("encargado"),
        telefono_encargado: enteros.telefono_encargado,
        dpi_del_encargado: enteros.dpi_del_encargado,
        carta_compromiso: leerDocumento("carta_compromiso"),
        carta_medios_comunicacion: leerDocumento("carta_medios_comunicacion"),
        dpi18: leerDocumento("dpi18"),
        certificado_nacimiento: leerDocumento("certificado_nacimiento"),
        dpi_encargado: leerDocumento("dpi_encargado"),
        biografia: texto("biografia")
    };

    const url =
        editId === null ? "/api/voluntarios" : `/api/voluntarios/${editId}`;

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
                    ? "No se pudo registrar el voluntario."
                    : "No se pudo guardar los cambios.")
            );
        }


        mostrarMensaje(
            editId === null
                ? "Voluntario registrado correctamente."
                : "Cambios guardados correctamente.",
            false
        );

        setTimeout(() => {

            window.location.href = "voluntarios.html";

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
    const modoParam = params.get("modo");


    if (idParam !== null && idParam !== "") {

        const id = Number(idParam);

        if (!Number.isInteger(id)) {

            mostrarMensaje("ID de voluntario inválido.", true);

            return;
        }


        modoVer = modoParam === "ver";


        if (
            modoVer &&
            !permisosActuales.includes("voluntarios.ver")
        ) {

            mostrarMensaje(
                "No tienes permiso para ver voluntarios.",
                true
            );

            return;
        }


        if (
            !modoVer &&
            !permisosActuales.includes("voluntarios.editar")
        ) {

            mostrarMensaje(
                "No tienes permiso para editar voluntarios.",
                true
            );

            return;
        }


        editId = id;

        document.getElementById("formTitle").textContent =
            modoVer ? "Detalle del voluntario" : "Editar voluntario";

        document.getElementById("formSubtitle").textContent =
            modoVer
                ? "Información del voluntario (solo lectura)."
                : "Modifica la información y guarda los cambios.";

        document.getElementById("submitButton").textContent =
            "✓ Guardar cambios";


        const ok = await cargarVoluntario(id);

        if (!ok) return;


        setSoloLectura(modoVer);

        document
            .getElementById("editButton")
            .addEventListener("click", () => {

                modoVer = false;

                document.getElementById("formTitle").textContent =
                    "Editar voluntario";

                document.getElementById("formSubtitle").textContent =
                    "Modifica la información y guarda los cambios.";

                document.getElementById("submitButton").textContent =
                    "✓ Guardar cambios";

                setSoloLectura(false);
            });
    }


    for (const id of CAMPOS_OTRO) {

        const select = document.getElementById(id);

        if (select) {

            select.addEventListener("change", () => actualizarOtro(id));
        }
    }


    document
        .getElementById("volunteerForm")
        .addEventListener("submit", guardarVoluntario);


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
