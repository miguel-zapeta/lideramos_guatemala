/*
========================================
NUEVO / VER / EDITAR VOLUNTARIO
Crear: POST /api/voluntarios (multipart con adjuntos)
Ver: ?id=X&modo=ver (solo lectura + botón Editar)
Editar: ?id=X -> PUT /api/voluntarios/:id
Edad: calculada automáticamente desde fecha_nacimiento.
Adjuntos: documentos por campo + foto, guardados en
tabla archivo vía persona_archivo (no salen en el
módulo Archivos; se ven aquí con voluntarios.ver).
========================================
*/

let permisosActuales = [];
let editId = null;
let modoVer = false;


const CAMPOS = [
    "nombres",
    "apellidos",
    "fecha_nacimiento",
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

const CAMPOS_ADJUNTO = [
    "dpi18",
    "certificado_nacimiento",
    "carta_compromiso",
    "carta_medios_comunicacion",
    "dpi_encargado",
    "foto"
];

const NOMBRES_CAMPO = {
    dpi18: "DPI (mayor de edad)",
    certificado_nacimiento: "Certificado de nacimiento",
    carta_compromiso: "Carta de compromiso",
    carta_medios_comunicacion: "Carta de medios de comunicación",
    dpi_encargado: "DPI del encargado (respaldo)",
    foto: "Fotografía"
};

// campo -> { actual: {id_archivo, nombre_archivo, tipo_mime}|null,
//            seleccionado: File|null, quitar: boolean }
const estadoAdjuntos = {};


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

    const edadInput = document.getElementById("edad");

    if (edadInput) edadInput.readOnly = true;

    for (const campo of CAMPOS_ADJUNTO) {

        const input = document.getElementById(
            campo === "foto" ? "foto" : `archivo_${campo}`
        );

        if (input) input.disabled = soloLectura;
    }

    renderAdjuntos();

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


/*
========================================
EDAD AUTOMÁTICA (desde fecha_nacimiento)
========================================
*/

function calcularEdad(valorFecha) {

    if (!valorFecha) return null;

    const partes = valorFecha.split("-");

    if (partes.length !== 3) return null;

    const [anio, mes, dia] =
        partes.map(Number);

    if (!anio || !mes || !dia) return null;

    const hoy = new Date();

    let edad =
        hoy.getFullYear() - anio;

    const deltaMes =
        hoy.getMonth() - (mes - 1);

    if (
        deltaMes < 0 ||
        (deltaMes === 0 && hoy.getDate() < dia)
    ) {
        edad--;
    }

    return edad >= 0 ? edad : null;
}


function calcularEdadLive() {

    const fechaInput =
        document.getElementById("fecha_nacimiento");

    const edadInput =
        document.getElementById("edad");

    if (!fechaInput || !edadInput) return;

    const edad =
        calcularEdad(fechaInput.value);

    edadInput.value =
        edad === null ? "" : String(edad);
}


/*
========================================
ADJUNTOS (documentos + foto)
========================================
*/

function esImagen(mime) {

    return (
        typeof mime === "string" &&
        mime.startsWith("image/")
    );
}


function initAdjunto(campo, doc) {

    estadoAdjuntos[campo] = {

        actual:
            doc
                ? {
                    id_archivo: doc.id_archivo,
                    nombre_archivo: doc.nombre_archivo,
                    tipo_mime: doc.tipo_mime
                }
                : null,

        seleccionado: null,

        quitar: false
    };
}


function crearNota(texto) {

    const p = document.createElement("p");

    p.className = "doc-adjunto-vacio";

    p.textContent = texto;

    return p;
}


function crearBotonAccion(texto, alHacerClic) {

    const boton =
        document.createElement("button");

    boton.type = "button";

    boton.className = "doc-adjunto-accion";

    boton.textContent = texto;

    boton.addEventListener("click", alHacerClic);

    return boton;
}


function urlDocumento(campo) {

    const doc =
        estadoAdjuntos[campo].actual;

    return `/api/voluntarios/${editId}/documentos/${doc.id_archivo}`;
}


function renderAdjuntos() {

    for (const campo of CAMPOS_ADJUNTO) {

        const contenedor =
            document.getElementById(`adjuntos_${campo}`);

        const estado =
            estadoAdjuntos[campo];

        if (!contenedor || !estado) continue;

        contenedor.innerHTML = "";

        const esFoto =
            campo === "foto";


        // 1) Marcado para quitar (modo edición)

        if (estado.quitar && !modoVer) {

            const fila =
                document.createElement("div");

            fila.className = "doc-adjunto-item";

            const nota =
                crearNota("Se quitará al guardar cambios.");

            fila.appendChild(nota);

            fila.appendChild(
                crearBotonAccion("Deshacer", () => {

                    estado.quitar = false;

                    renderAdjuntos();
                })
            );

            contenedor.appendChild(fila);

            continue;
        }


        // 2) Archivo seleccionado nuevo

        if (estado.seleccionado) {

            if (esFoto && esImagen(estado.seleccionado.type)) {

                const img =
                    document.createElement("img");

                img.src =
                    URL.createObjectURL(estado.seleccionado);

                img.alt =
                    "Vista previa de la fotografía";

                contenedor.appendChild(img);

            } else {

                contenedor.appendChild(
                    crearNota(
                        `Archivo seleccionado: ${estado.seleccionado.name}`
                    )
                );
            }


            if (estado.actual) {

                contenedor.appendChild(
                    crearNota(
                        "Reemplazará al archivo actual al guardar."
                    )
                );
            }

            continue;
        }


        // 3) Adjunto actual (link / preview)

        if (estado.actual) {

            const url =
                urlDocumento(campo);

            if (esFoto && esImagen(estado.actual.tipo_mime)) {

                const img =
                    document.createElement("img");

                img.src = url;

                img.alt =
                    `Fotografía: ${estado.actual.nombre_archivo}`;

                contenedor.appendChild(img);
            }


            const fila =
                document.createElement("div");

            fila.className = "doc-adjunto-item";

            const enlace =
                document.createElement("a");

            enlace.href = url;

            enlace.target = "_blank";

            enlace.rel = "noopener";

            enlace.textContent =
                estado.actual.nombre_archivo;

            fila.appendChild(enlace);


            if (!modoVer) {

                fila.appendChild(
                    crearBotonAccion("Quitar", () => {

                        estado.quitar = true;

                        const input =
                            document.getElementById(
                                esFoto ? "foto" : `archivo_${campo}`
                            );

                        if (input) input.value = "";

                        renderAdjuntos();
                    })
                );
            }


            contenedor.appendChild(fila);

            continue;
        }


        // 4) Sin adjunto

        contenedor.appendChild(
            crearNota("Sin archivo adjunto (opcional).")
        );
    }
}


function conectarAdjuntos() {

    for (const campo of CAMPOS_ADJUNTO) {

        const input =
            document.getElementById(
                campo === "foto" ? "foto" : `archivo_${campo}`
            );

        if (!input) continue;

        input.addEventListener("change", () => {

            const estado =
                estadoAdjuntos[campo];

            if (!estado) return;

            estado.seleccionado =
                input.files && input.files.length > 0
                    ? input.files[0]
                    : null;

            if (estado.seleccionado) {
                estado.quitar = false;
            }

            renderAdjuntos();
        });
    }


    const fechaInput =
        document.getElementById("fecha_nacimiento");

    if (fechaInput) {

        fechaInput.addEventListener(
            "change",
            calcularEdadLive
        );
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

            let valor = v[id];

            if (
                id === "fecha_nacimiento" &&
                valor !== null &&
                valor !== undefined
            ) {
                valor = String(valor).slice(0, 10);
            }

            input.value =
                valor === null || valor === undefined ? "" : valor;
        }


        const edadInput =
            document.getElementById("edad");

        if (edadInput) {

            edadInput.value =
                v.edad === null || v.edad === undefined
                    ? ""
                    : String(v.edad);
        }


        for (const campo of CAMPOS_ADJUNTO) {

            const doc =
                (v.documentos || []).find(
                    (d) => d.campo === campo
                );

            initAdjunto(campo, doc || null);
        }


        renderAdjuntos();

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


    const comoTexto = (valor) =>
        valor === null || valor === undefined
            ? ""
            : String(valor);


    const formData =
        new FormData();

    formData.append("nombres", nombres);
    formData.append("apellidos", apellidos);

    formData.append(
        "fecha_nacimiento",
        document.getElementById("fecha_nacimiento").value.trim()
    );

    formData.append("dpi", comoTexto(enteros.dpi));
    formData.append("municipio", comoTexto(texto("municipio")));
    formData.append("telefono", comoTexto(enteros.telefono));
    formData.append("centro_educativo", comoTexto(texto("centro_educativo")));
    formData.append("jornada", comoTexto(texto("jornada")));
    formData.append("encargado", comoTexto(texto("encargado")));
    formData.append("telefono_encargado", comoTexto(enteros.telefono_encargado));
    formData.append("dpi_del_encargado", comoTexto(enteros.dpi_del_encargado));

    formData.append("carta_compromiso", comoTexto(leerDocumento("carta_compromiso")));
    formData.append("carta_medios_comunicacion", comoTexto(leerDocumento("carta_medios_comunicacion")));
    formData.append("dpi18", comoTexto(leerDocumento("dpi18")));
    formData.append("certificado_nacimiento", comoTexto(leerDocumento("certificado_nacimiento")));
    formData.append("dpi_encargado", comoTexto(leerDocumento("dpi_encargado")));

    formData.append("biografia", comoTexto(texto("biografia")));


    for (const campo of CAMPOS_ADJUNTO) {

        const estado =
            estadoAdjuntos[campo];

        if (!estado) continue;

        if (estado.seleccionado) {

            formData.append(
                campo === "foto" ? "foto" : `archivo_${campo}`,
                estado.seleccionado
            );

            if (estado.actual) {

                formData.append(`reemplazar_${campo}`, "1");
            }

        } else if (estado.quitar) {

            formData.append(`quitar_${campo}`, "1");
        }
    }


    const url =
        editId === null ? "/api/voluntarios" : `/api/voluntarios/${editId}`;

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

                    credentials: "include",

                    body: formData
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

        guardado.error();

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


    conectarAdjuntos();

    calcularEdadLive();


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
