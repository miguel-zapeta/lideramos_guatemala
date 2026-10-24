let usuarioActual = null;
let permisosActuales = [];
let publicacionesActuales = [];

let paginaActual = 1;

const LIMITE_PAGINA = 20;

let debounceBusqueda = null;

let editIdActual = null;

let metaPaginacionActual = {
    total: 0,
    pagina: 1,
    limite: 20,
    totalPaginas: 1
};

let resumenActual = {
    total: 0,
    activas: 0,
    ocultas: 0
};


const NOMBRES_PAGINA = {
    index: "Inicio",
    quienes: "Quiénes somos",
    contactanos: "Contáctanos"
};


/*
========================================
VERIFICAR SESIÓN
========================================
*/

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

            window.location.replace(
                "/login.html"
            );

            return null;

        }


        const data =
            await response.json();


        usuarioActual =
            data.usuario;

        permisosActuales =
            data.permisos || [];


        return data;


    } catch (error) {

        console.error(
            "Error verificando sesión:",
            error
        );


        window.location.replace(
            "/login.html"
        );


        return null;
    }
}


/*
========================================
CERRAR SESIÓN
========================================
*/

async function cerrarSesion() {

    try {

        await fetch(
            "/api/auth/logout",
            {
                method: "POST",
                credentials: "include"
            }
        );

    } catch (error) {

        console.error(
            "Error cerrando sesión:",
            error
        );

    } finally {

        window.location.replace(
            "/login.html"
        );

    }
}


function puedeCrear() {

    return permisosActuales.includes("publicaciones.crear");
}


function puedeEditar() {

    return permisosActuales.includes("publicaciones.editar");
}


function puedeEliminar() {

    return permisosActuales.includes("publicaciones.eliminar");
}


function formatoFechaHora(fecha) {

    if (!fecha) return "—";

    return String(fecha)
        .slice(0, 16)
        .replace("T", " ");
}


function recortar(texto, max) {

    if (!texto) return "";

    const t = String(texto);

    return t.length > max
        ? t.slice(0, max) + "…"
        : t;
}


/*
========================================
CARGAR PUBLICACIONES DESDE LA API
========================================
*/

async function cargarPublicaciones() {

    const tbody =
        document.getElementById("publicacionesTbody");

    const paginationInfo =
        document.getElementById("paginationInfo");

    try {

        const buscar =
            document.getElementById("searchInput")?.value.trim() || "";

        const campo =
            document.getElementById("searchField")?.value || "todos";

        const filtroPagina =
            document.getElementById("filtroPagina")?.value || "";


        const params =
            new URLSearchParams({
                pagina: String(paginaActual),
                limite: String(LIMITE_PAGINA)
            });

        if (buscar) {
            params.set("buscar", buscar);
            params.set("campo", campo);
        }

        if (filtroPagina) {
            params.set("filtro_pagina", filtroPagina);
        }


        const response =
            await fetch(
                `/api/publicaciones?${params.toString()}`,
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


        if (response.status === 403) {

            tbody.innerHTML =
                `<tr><td colspan="6">No tienes permiso para ver publicaciones.</td></tr>`;

            paginationInfo.textContent =
                "Sin acceso.";

            return;
        }


        if (!response.ok) {

            throw new Error(
                "No fue posible cargar las publicaciones."
            );
        }


        const data =
            await response.json();

        publicacionesActuales =
            data.publicaciones || [];

        metaPaginacionActual = {
            total: data.total || 0,
            pagina: data.pagina || 1,
            limite: data.limite || LIMITE_PAGINA,
            totalPaginas: data.totalPaginas || 1
        };

        resumenActual =
            data.resumen || {
                total: metaPaginacionActual.total,
                activas: 0,
                ocultas: 0
            };


        renderPublicaciones();


    } catch (error) {

        console.error(
            "Error cargando publicaciones:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="6">Error al cargar publicaciones.</td></tr>`;

        paginationInfo.textContent =
            "Error al cargar.";
    }
}


/*
========================================
RENDER
========================================
*/

function renderPublicaciones() {

    const tbody =
        document.getElementById("publicacionesTbody");

    const paginationInfo =
        document.getElementById("paginationInfo");

    const total = metaPaginacionActual.total;


    document.getElementById("statTotal").textContent =
        resumenActual.total ?? total;

    document.getElementById("statActivas").textContent =
        resumenActual.activas ?? 0;

    document.getElementById("statOcultas").textContent =
        resumenActual.ocultas ?? 0;


    if (total === 0) {

        paginationInfo.textContent =
            "Sin resultados.";

        renderPaginacion({
            contenedorId: "paginationButtons",
            pagina: 1,
            totalPaginas: 1,
            onCambiar: () => {}
        });

    } else {

        const desde =
            (metaPaginacionActual.pagina - 1) *
                metaPaginacionActual.limite + 1;

        const hasta =
            desde + publicacionesActuales.length - 1;

        paginationInfo.textContent =
            `Mostrando ${desde}–${hasta} de ${total}.`;

        renderPaginacion({
            contenedorId: "paginationButtons",
            pagina: metaPaginacionActual.pagina,
            totalPaginas: metaPaginacionActual.totalPaginas,
            onCambiar: (nuevaPagina) => {
                paginaActual = nuevaPagina;
                cargarPublicaciones();
            }
        });

    }


    if (publicacionesActuales.length === 0) {

        tbody.innerHTML =
            `<tr><td colspan="6">No hay publicaciones registradas.</td></tr>`;

        return;
    }


    const editar = puedeEditar();
    const eliminar = puedeEliminar();


    tbody.innerHTML = publicacionesActuales.map((p) => {

        const nombrePagina =
            NOMBRES_PAGINA[p.pagina] || p.pagina;

        const preview =
            recortar(p.contenido, 80) || "(solo imagen)";


        const miniatura = p.id_archivo
            ? `<img
                    class="pub-thumb"
                    src="/api/publicaciones/${p.id_publicacion}/imagen"
                    alt=""
                    loading="lazy"
                >`
            : `<div class="pub-icon-thumb">📰</div>`;


        const estadoClass = p.estado ? "active" : "inactive";
        const estadoTexto = p.estado ? "Visible" : "Oculta";


        return `
            <tr>
                <td>
                    <span class="badge-pagina badge-${p.pagina}">${escapeHtml(nombrePagina)}</span>
                </td>
                <td>
                    <div class="pub-cell">
                        ${miniatura}
                        <div>
                            ${p.titulo ? `<span class="pub-titulo">${escapeHtml(p.titulo)}</span>` : ""}
                            <span class="pub-preview">${escapeHtml(preview)}</span>
                        </div>
                    </div>
                </td>
                <td>${p.orden}</td>
                <td><span class="status ${estadoClass}">${estadoTexto}</span></td>
                <td>${formatoFechaHora(p.fecha_creacion)}</td>
                <td>
                    <div class="actions">
                        <button class="action edit" title="Editar" data-editar="${p.id_publicacion}" ${editar ? "" : "disabled"}>
                            ✏️
                        </button>
                        <button
                            class="action edit"
                            title="${p.estado ? "Ocultar" : "Mostrar"}"
                            data-estado-id="${p.id_publicacion}"
                            data-estado-nuevo="${!p.estado}"
                            ${editar ? "" : "disabled"}
                        >
                            ${p.estado ? "🙈" : "👁️"}
                        </button>
                        <button
                            class="action delete"
                            title="Eliminar"
                            data-eliminar="${p.id_publicacion}"
                            ${eliminar ? "" : "disabled"}
                        >
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join("");


    tbody.querySelectorAll("button[data-editar]").forEach((btn) => {

        btn.addEventListener("click", () => {

            cargarEnFormulario(Number(btn.dataset.editar));
        });
    });


    tbody.querySelectorAll("button[data-estado-id]").forEach((btn) => {

        btn.addEventListener("click", () => {

            cambiarEstado(
                Number(btn.dataset.estadoId),
                btn.dataset.estadoNuevo === "true"
            );
        });
    });


    tbody.querySelectorAll("button[data-eliminar]").forEach((btn) => {

        btn.addEventListener("click", () => {

            eliminarPublicacion(Number(btn.dataset.eliminar));
        });
    });
}


/*
========================================
FORMULARIO: CREAR / EDITAR
========================================
*/

function mostrarMensajeFormulario(texto, esError) {

    const mensaje =
        document.getElementById("formMessage");

    if (!mensaje) return;

    mensaje.textContent = texto;

    mensaje.className =
        `upload-message ${esError ? "error" : "ok"}`;
}


function resetFormulario() {

    editIdActual = null;

    document.getElementById("formTitulo").textContent =
        "Nueva publicación";

    document.getElementById("pubPagina").value = "index";
    document.getElementById("pubOrden").value = "0";
    document.getElementById("pubTitulo").value = "";
    document.getElementById("pubContenido").value = "";
    document.getElementById("pubImagen").value = "";
    document.getElementById("pubQuitarImagen").checked = false;

    document.getElementById("imagenPreview").style.display = "none";
    document.getElementById("imagenPreviewImg").src = "";
    document.getElementById("quitarImagenLabel").style.display = "none";

    document.getElementById("cancelarButton").style.display = "none";

    mostrarMensajeFormulario("", false);

    document.getElementById("formSection").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


function cargarEnFormulario(id) {

    const pub =
        publicacionesActuales.find((p) => p.id_publicacion === id);

    if (!pub) return;

    editIdActual = id;

    document.getElementById("formTitulo").textContent =
        `Editar publicación #${id}`;

    document.getElementById("pubPagina").value = pub.pagina;
    document.getElementById("pubOrden").value = pub.orden ?? 0;
    document.getElementById("pubTitulo").value = pub.titulo || "";
    document.getElementById("pubContenido").value = pub.contenido || "";
    document.getElementById("pubImagen").value = "";
    document.getElementById("pubQuitarImagen").checked = false;

    const preview =
        document.getElementById("imagenPreview");

    const previewImg =
        document.getElementById("imagenPreviewImg");

    const quitarLabel =
        document.getElementById("quitarImagenLabel");

    if (pub.id_archivo) {

        previewImg.src =
            `/api/publicaciones/${pub.id_publicacion}/imagen`;

        preview.style.display = "";

        quitarLabel.style.display = "";

    } else {

        preview.style.display = "none";

        quitarLabel.style.display = "none";
    }

    document.getElementById("cancelarButton").style.display = "";

    mostrarMensajeFormulario("", false);

    document.getElementById("formSection").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}


function seleccionarArchivoImagen() {

    const input =
        document.getElementById("pubImagen");

    const preview =
        document.getElementById("imagenPreview");

    const previewImg =
        document.getElementById("imagenPreviewImg");

    const archivo =
        input.files && input.files[0];

    if (!archivo) {
        return;
    }

    const extension =
        (archivo.name.split(".").pop() || "").toLowerCase();

    const permitidas = ["jpg", "jpeg", "png", "gif", "webp"];

    if (!permitidas.includes(extension)) {

        input.value = "";

        mostrarMensajeFormulario(
            `Tipo de imagen no permitido: ${archivo.name}.`,
            true
        );

        return;
    }

    if (archivo.size > 10 * 1024 * 1024) {

        input.value = "";

        mostrarMensajeFormulario(
            `La imagen supera el tamaño máximo de 10 MB.`,
            true
        );

        return;
    }

    previewImg.src =
        URL.createObjectURL(archivo);

    preview.style.display = "";

    document.getElementById("quitarImagenLabel").style.display = "none";
    document.getElementById("pubQuitarImagen").checked = false;
}


async function guardarPublicacion() {

    const pagina =
        document.getElementById("pubPagina").value;

    const titulo =
        document.getElementById("pubTitulo").value.trim();

    const contenido =
        document.getElementById("pubContenido").value.trim();

    const orden =
        document.getElementById("pubOrden").value.trim() || "0";

    const inputImagen =
        document.getElementById("pubImagen");

    const archivo =
        inputImagen.files && inputImagen.files[0];

    const quitarImagen =
        document.getElementById("pubQuitarImagen").checked;


    if (!Number.isInteger(Number(orden)) || Number(orden) < 0) {

        mostrarMensajeFormulario(
            "El orden debe ser un número mayor o igual a 0.",
            true
        );

        return;
    }


    const pubActual =
        editIdActual !== null
            ? publicacionesActuales.find((p) => p.id_publicacion === editIdActual)
            : null;


    const tendraImagen =
        archivo
            ? true
            : (editIdActual !== null
                ? (!!pubActual?.id_archivo && !quitarImagen)
                : false);


    if (!contenido && !tendraImagen) {

        mostrarMensajeFormulario(
            "Debes indicar un texto o adjuntar una imagen.",
            true
        );

        return;
    }


    const formData =
        new FormData();

    formData.append("pagina", pagina);
    formData.append("titulo", titulo);
    formData.append("contenido", contenido);
    formData.append("orden", orden);

    if (archivo) {
        formData.append("imagen", archivo);
    }

    if (quitarImagen && !archivo) {
        formData.append("quitar_imagen", "1");
    }


    const url =
        editIdActual === null
            ? "/api/publicaciones"
            : `/api/publicaciones/${editIdActual}`;

    const method =
        editIdActual === null ? "POST" : "PUT";


    const boton =
        document.getElementById("guardarButton");

    boton.disabled = true;

    mostrarMensajeFormulario("Guardando...", false);


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
                data.message || "No se pudo guardar la publicación."
            );
        }


        mostrarMensajeFormulario(
            data.message || "Publicación guardada.",
            false
        );

        resetFormulario();

        await cargarPublicaciones();


    } catch (error) {

        console.error(
            "Error guardando publicación:",
            error
        );

        mostrarMensajeFormulario(error.message, true);

    } finally {

        boton.disabled = false;
    }
}


/*
========================================
ESTADO Y ELIMINAR
========================================
*/

async function cambiarEstado(id, estado) {

    try {

        const response =
            await fetch(
                `/api/publicaciones/${id}/estado`,
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


        await cargarPublicaciones();


    } catch (error) {

        console.error(
            "Error actualizando estado:",
            error
        );

        alert(error.message);
    }
}


async function eliminarPublicacion(id) {

    const pub =
        publicacionesActuales.find((p) => p.id_publicacion === id);

    const etiqueta =
        pub && pub.titulo
            ? `"${pub.titulo}"`
            : `#${id}`;


    if (!confirm(`¿Deseas eliminar la publicación ${etiqueta}?`)) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/publicaciones/${id}`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );


        if (!response.ok) {

            const data =
                await response.json().catch(() => ({}));

            throw new Error(
                data.message || "No se pudo eliminar la publicación."
            );
        }


        if (editIdActual === id) {
            resetFormulario();
        }


        if (
            publicacionesActuales.length === 1 &&
            metaPaginacionActual.pagina > 1
        ) {
            paginaActual = metaPaginacionActual.pagina - 1;
        }


        await cargarPublicaciones();


    } catch (error) {

        console.error(
            "Error eliminando publicación:",
            error
        );

        alert(error.message);
    }
}


/*
========================================
BUSCADOR Y FILTROS
========================================
*/

function aplicarFiltro() {

    clearTimeout(debounceBusqueda);

    debounceBusqueda = setTimeout(() => {
        paginaActual = 1;
        cargarPublicaciones();
    }, 300);
}


const searchInput =
    document.getElementById("searchInput");

const searchField =
    document.getElementById("searchField");

if (searchInput) {

    searchInput.addEventListener("input", aplicarFiltro);
}

if (searchField) {

    searchField.addEventListener("change", aplicarFiltro);
}


const filtroPagina =
    document.getElementById("filtroPagina");

if (filtroPagina) {

    filtroPagina.addEventListener(
        "change",
        () => {
            paginaActual = 1;
            cargarPublicaciones();
        }
    );
}


/*
========================================
BOTONES DEL FORMULARIO
========================================
*/

const guardarButton =
    document.getElementById("guardarButton");

if (guardarButton) {

    guardarButton.addEventListener("click", guardarPublicacion);
}


const cancelarButton =
    document.getElementById("cancelarButton");

if (cancelarButton) {

    cancelarButton.addEventListener("click", resetFormulario);
}


const pubImagenInput =
    document.getElementById("pubImagen");

if (pubImagenInput) {

    pubImagenInput.addEventListener("change", seleccionarArchivoImagen);
}


/*
========================================
INICIALIZAR PANEL
========================================
*/

async function iniciarPanel() {

    const sesion =
        await verificarSesion();


    if (!sesion) {
        return;
    }


    const nameEl =
        document.getElementById("currentUserName");

    const roleEl =
        document.getElementById("currentUserRole");

    const avatarEl =
        document.getElementById("currentUserAvatar");


    if (nameEl && usuarioActual) {

        nameEl.textContent =
            `${usuarioActual.nombre || ""} ${usuarioActual.apellido || ""}`.trim();
    }

    if (roleEl && usuarioActual) {
        roleEl.textContent = usuarioActual.rol;
    }

    if (avatarEl && usuarioActual) {

        const ini =
            ((usuarioActual.nombre || "").charAt(0) +
             (usuarioActual.apellido || "").charAt(0)).toUpperCase();

        avatarEl.textContent = ini || "?";
    }


    const formSection =
        document.getElementById("formSection");

    if (formSection && !puedeCrear()) {
        formSection.style.display = "none";
    }


    await cargarPublicaciones();
}


/*
========================================
BOTÓN CERRAR SESIÓN
========================================
*/

const logoutButton =
    document.querySelector(".logout");


if (logoutButton) {

    logoutButton.addEventListener(
        "click",
        (event) => {

            event.preventDefault();

            cerrarSesion();

        }
    );

}


/*
========================================
INICIO
========================================
*/

iniciarPanel();
