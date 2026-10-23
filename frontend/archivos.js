let usuarioActual = null;
let permisosActuales = [];
let archivosActuales = [];

let paginaActual = 1;

const LIMITE_PAGINA = 20;

const LIMITE_BYTES = 10 * 1024 * 1024;

let debounceBusqueda = null;

let vistaActual = "lista";

let imagenesVisor = [];

let indiceVisor = 0;

let metaPaginacionActual = {
    total: 0,
    pagina: 1,
    limite: 20,
    totalPaginas: 1
};

let resumenActual = {
    total: 0,
    imagenes: 0,
    otros: 0
};


const EXTENSIONES_PERMITIDAS = new Set([
    "jpg", "jpeg", "png", "gif", "webp",
    "pdf",
    "doc", "docx",
    "xls", "xlsx",
    "csv", "txt",
    "zip"
]);


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

    return permisosActuales.includes("reportes.crear");
}


function puedeEliminar() {

    return permisosActuales.includes("reportes.eliminar");
}


function esImagen(archivo) {

    return String(archivo.tipo_mime || "")
        .startsWith("image/");
}


function formatoFechaHora(fecha) {

    if (!fecha) return "—";

    return String(fecha)
        .slice(0, 16)
        .replace("T", " ");
}


function formatoTamano(bytes) {

    if (bytes === null || bytes === undefined) {
        return "—";
    }

    const n = Number(bytes);

    if (!Number.isFinite(n)) return "—";

    if (n < 1024) return `${n} B`;

    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;

    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}


/*
========================================
CARGAR OPCIONES (PROYECTOS Y ACTIVIDADES)
========================================
*/

async function cargarOpciones() {

    try {

        const response =
            await fetch(
                "/api/proyectos/opciones",
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (response.ok) {

            const data =
                await response.json();

            rellenarSelect(
                "subidaProyecto",
                (data.proyectos || []).map((p) => ({
                    valor: p.id_proyecto,
                    texto: p.nombre
                })),
                "Sin proyecto"
            );

            rellenarSelect(
                "filtroProyecto",
                (data.proyectos || []).map((p) => ({
                    valor: p.id_proyecto,
                    texto: p.nombre
                })),
                "Todos los proyectos"
            );
        }

    } catch (error) {

        console.error(
            "Error cargando proyectos:",
            error
        );
    }


    try {

        const response =
            await fetch(
                "/api/actividades/opciones",
                {
                    method: "GET",
                    credentials: "include"
                }
            );

        if (response.ok) {

            const data =
                await response.json();

            rellenarSelect(
                "subidaActividad",
                (data.actividades || []).map((a) => ({
                    valor: a.id_actividad,
                    texto: a.nombre
                })),
                "Sin actividad"
            );

            rellenarSelect(
                "filtroActividad",
                (data.actividades || []).map((a) => ({
                    valor: a.id_actividad,
                    texto: a.nombre
                })),
                "Todas las actividades"
            );
        }

    } catch (error) {

        console.error(
            "Error cargando actividades:",
            error
        );
    }
}


function rellenarSelect(id, opciones, textoVacio) {

    const select =
        document.getElementById(id);

    if (!select) return;

    select.innerHTML =
        `<option value="">${escapeHtml(textoVacio)}</option>` +
        opciones.map(
            (o) =>
                `<option value="${o.valor}">${escapeHtml(o.texto)}</option>`
        ).join("");
}


/*
========================================
CARGAR ARCHIVOS DESDE LA API
========================================
*/

async function cargarArchivos() {

    const tbody =
        document.getElementById("archivosTbody");

    const paginationInfo =
        document.getElementById("paginationInfo");

    try {

        const buscar =
            document.getElementById("searchInput")?.value.trim() || "";

        const campo =
            document.getElementById("searchField")?.value || "todos";

        const tipo =
            document.getElementById("filtroTipo")?.value || "";

        const idProyecto =
            document.getElementById("filtroProyecto")?.value || "";

        const idActividad =
            document.getElementById("filtroActividad")?.value || "";


        const params =
            new URLSearchParams({
                pagina: String(paginaActual),
                limite: String(LIMITE_PAGINA)
            });

        if (buscar) {
            params.set("buscar", buscar);
            params.set("campo", campo);
        }

        if (tipo) {
            params.set("tipo", tipo);
        }

        if (idProyecto) {
            params.set("id_proyecto", idProyecto);
        }

        if (idActividad) {
            params.set("id_actividad", idActividad);
        }


        const response =
            await fetch(
                `/api/archivos?${params.toString()}`,
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
                `<tr><td colspan="7">No tienes permiso para ver archivos.</td></tr>`;

            paginationInfo.textContent =
                "Sin acceso.";

            return;
        }


        if (!response.ok) {

            throw new Error(
                "No fue posible cargar los archivos."
            );
        }


        const data =
            await response.json();

        archivosActuales =
            data.archivos || [];

        metaPaginacionActual = {
            total: data.total || 0,
            pagina: data.pagina || 1,
            limite: data.limite || LIMITE_PAGINA,
            totalPaginas: data.totalPaginas || 1
        };

        resumenActual =
            data.resumen || {
                total: metaPaginacionActual.total,
                imagenes: 0,
                otros: 0
            };


        renderArchivos();


    } catch (error) {

        console.error(
            "Error cargando archivos:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="7">Error al cargar archivos.</td></tr>`;

        paginationInfo.textContent =
            "Error al cargar.";
    }
}


/*
========================================
RENDER
========================================
*/

function renderArchivos() {

    renderLista();

    renderGaleria();

    renderPaginacionSection();
}


function renderPaginacionSection() {

    const paginationInfo =
        document.getElementById("paginationInfo");

    const total = metaPaginacionActual.total;


    document.getElementById("statTotal").textContent =
        resumenActual.total ?? total;

    document.getElementById("statImagenes").textContent =
        resumenActual.imagenes ?? 0;

    document.getElementById("statOtros").textContent =
        resumenActual.otros ?? 0;


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
            desde + archivosActuales.length - 1;

        paginationInfo.textContent =
            `Mostrando ${desde}–${hasta} de ${total}.`;

        renderPaginacion({
            contenedorId: "paginationButtons",
            pagina: metaPaginacionActual.pagina,
            totalPaginas: metaPaginacionActual.totalPaginas,
            onCambiar: (nuevaPagina) => {
                paginaActual = nuevaPagina;
                cargarArchivos();
            }
        });

    }
}


function iconoExtension(archivo) {

    const ext =
        String(archivo.extension_ || "").toLowerCase();

    if (ext === "pdf") return "📕";
    if (ext === "zip") return "🗜️";
    if (ext === "csv" || ext === "txt") return "📄";
    if (ext.startsWith("xls")) return "📊";
    if (ext.startsWith("doc")) return "📝";

    return "📄";
}


function celdaArchivo(a) {

    if (esImagen(a)) {

        return `
            <div class="file-cell">
                <img
                    class="file-thumb"
                    src="/api/archivos/${a.id_archivo}/contenido"
                    alt="${escapeHtml(a.nombre_archivo)}"
                    loading="lazy"
                >
                <div>
                    <strong>${escapeHtml(a.nombre_archivo)}</strong>
                    <span class="file-desc">${escapeHtml(a.descripcion || "")}</span>
                </div>
            </div>`;
    }


    return `
        <div class="file-cell">
            <div class="file-icon-thumb">${iconoExtension(a)}</div>
            <div>
                <strong>${escapeHtml(a.nombre_archivo)}</strong>
                <span class="file-desc">${escapeHtml(a.descripcion || "")}</span>
            </div>
        </div>`;
}


function celdaTamano(a) {

    const original =
        formatoTamano(a.tamano_bytes);


    if (a.comprimido && a.tamano_comprimido) {

        const ahorro =
            Math.max(
                0,
                Math.round(
                    (1 - a.tamano_comprimido / a.tamano_bytes) * 100
                )
            );

        return `
            ${original}
            <span class="badge-comprimido">gzip</span>
            <span class="size-ahorro">En BD: ${formatoTamano(a.tamano_comprimido)} (−${ahorro}%)</span>`;
    }


    return original;
}


function renderLista() {

    const tbody =
        document.getElementById("archivosTbody");


    if (archivosActuales.length === 0) {

        tbody.innerHTML =
            `<tr><td colspan="7">No hay archivos registrados.</td></tr>`;

        return;
    }


    const eliminar = puedeEliminar();


    tbody.innerHTML = archivosActuales.map((a) => {

        return `
            <tr>
                <td>${celdaArchivo(a)}</td>
                <td>${celdaTamano(a)}</td>
                <td>${escapeHtml(a.nombre_proyecto) || "—"}</td>
                <td>${escapeHtml(a.nombre_actividad) || "—"}</td>
                <td>${escapeHtml(a.subido_por) || "—"}</td>
                <td>${formatoFechaHora(a.fecha_subida)}</td>
                <td>
                    <div class="actions">
                        <button class="action edit" title="Ver" data-ver="${a.id_archivo}">
                            👁️
                        </button>
                        <button class="action edit" title="Descargar" data-descargar="${a.id_archivo}">
                            ⬇️
                        </button>
                        <button
                            class="action delete"
                            title="Eliminar archivo"
                            data-eliminar="${a.id_archivo}"
                            ${eliminar ? "" : "disabled"}
                        >
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join("");


    tbody.querySelectorAll("button[data-ver]").forEach((btn) => {

        btn.addEventListener("click", () => {

            const id = Number(btn.dataset.ver);

            const indice =
                imagenesVisor.findIndex(
                    (a) => a.id_archivo === id
                );

            if (indice >= 0) {
                abrirVisor(indice);
            } else {
                window.open(
                    `/api/archivos/${id}/contenido`,
                    "_blank"
                );
            }
        });
    });


    tbody.querySelectorAll("button[data-descargar]").forEach((btn) => {

        btn.addEventListener("click", () => {

            descargarArchivo(Number(btn.dataset.descargar));
        });
    });


    tbody.querySelectorAll("button[data-eliminar]").forEach((btn) => {

        btn.addEventListener("click", () => {

            eliminarArchivo(Number(btn.dataset.eliminar));
        });
    });
}


function renderGaleria() {

    const contenedor =
        document.getElementById("vistaGaleria");


    imagenesVisor =
        archivosActuales.filter(esImagen);


    if (imagenesVisor.length === 0) {

        contenedor.innerHTML =
            `<div class="gallery-empty">No hay imágenes en esta página.</div>`;

        return;
    }


    contenedor.innerHTML = imagenesVisor.map((a, i) => {

        return `
            <div class="gallery-card" data-indice="${i}">
                <img
                    src="/api/archivos/${a.id_archivo}/contenido"
                    alt="${escapeHtml(a.nombre_archivo)}"
                    loading="lazy"
                >
                <div class="gallery-info">
                    <strong title="${escapeHtml(a.nombre_archivo)}">${escapeHtml(a.nombre_archivo)}</strong>
                    <span>${formatoTamano(a.tamano_bytes)}</span>
                </div>
            </div>`;
    }).join("");


    contenedor.querySelectorAll(".gallery-card").forEach((card) => {

        card.addEventListener("click", () => {

            abrirVisor(Number(card.dataset.indice));
        });
    });
}


/*
========================================
VISOR (LIGHTBOX)
========================================
*/

function abrirVisor(indice) {

    if (imagenesVisor.length === 0) return;

    indiceVisor =
        Math.max(0, Math.min(indice, imagenesVisor.length - 1));

    actualizarVisor();

    document.getElementById("lightbox").style.display = "flex";
}


function actualizarVisor() {

    const archivo =
        imagenesVisor[indiceVisor];

    if (!archivo) return;

    document.getElementById("lightboxImg").src =
        `/api/archivos/${archivo.id_archivo}/contenido`;

    document.getElementById("lightboxNombre").textContent =
        `${archivo.nombre_archivo} (${formatoTamano(archivo.tamano_bytes)})`;

    document.getElementById("lightboxDescargar").href =
        `/api/archivos/${archivo.id_archivo}/contenido`;

    document.getElementById("lightboxDescargar").setAttribute(
        "download",
        archivo.nombre_archivo
    );

    document.getElementById("lightboxPrev").style.display =
        imagenesVisor.length > 1 ? "" : "none";

    document.getElementById("lightboxNext").style.display =
        imagenesVisor.length > 1 ? "" : "none";
}


function cerrarVisor() {

    document.getElementById("lightbox").style.display = "none";

    document.getElementById("lightboxImg").src = "";
}


function moverVisor(paso) {

    if (imagenesVisor.length === 0) return;

    indiceVisor =
        (indiceVisor + paso + imagenesVisor.length) %
        imagenesVisor.length;

    actualizarVisor();
}


document.getElementById("lightboxClose")
    ?.addEventListener("click", cerrarVisor);

document.getElementById("lightboxPrev")
    ?.addEventListener("click", () => moverVisor(-1));

document.getElementById("lightboxNext")
    ?.addEventListener("click", () => moverVisor(1));

document.getElementById("lightbox")
    ?.addEventListener("click", (event) => {

        if (event.target.id === "lightbox") {
            cerrarVisor();
        }
    });

document.addEventListener("keydown", (event) => {

    const visible =
        document.getElementById("lightbox")?.style.display === "flex";

    if (!visible) return;

    if (event.key === "Escape") cerrarVisor();
    if (event.key === "ArrowLeft") moverVisor(-1);
    if (event.key === "ArrowRight") moverVisor(1);
});


/*
========================================
DESCARGAR Y ELIMINAR
========================================
*/

function descargarArchivo(id) {

    const enlace =
        document.createElement("a");

    enlace.href =
        `/api/archivos/${id}/contenido`;

    enlace.download = "";

    document.body.appendChild(enlace);

    enlace.click();

    enlace.remove();
}


async function eliminarArchivo(id) {

    const archivo =
        archivosActuales.find((a) => a.id_archivo === id);

    const nombre =
        archivo ? archivo.nombre_archivo : "el archivo";


    if (!confirm(`¿Deseas eliminar "${nombre}"?`)) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/archivos/${id}`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );


        if (!response.ok) {

            const data =
                await response.json().catch(() => ({}));

            throw new Error(
                data.message || "No se pudo eliminar el archivo."
            );
        }


        if (
            archivosActuales.length === 1 &&
            metaPaginacionActual.pagina > 1
        ) {
            paginaActual = metaPaginacionActual.pagina - 1;
        }


        await cargarArchivos();


    } catch (error) {

        console.error(
            "Error eliminando archivo:",
            error
        );

        alert(error.message);
    }
}


/*
========================================
SUBIR ARCHIVOS
========================================
*/

function mostrarMensajeSubida(texto, esError) {

    const mensaje =
        document.getElementById("uploadMessage");

    if (!mensaje) return;

    mensaje.textContent = texto;

    mensaje.className =
        `upload-message ${esError ? "error" : "ok"}`;
}


function validarArchivosSeleccionados(archivos) {

    if (archivos.length === 0) {

        mostrarMensajeSubida(
            "Debes seleccionar al menos un archivo.",
            true
        );

        return false;
    }


    if (archivos.length > 10) {

        mostrarMensajeSubida(
            "Puedes subir hasta 10 archivos por vez.",
            true
        );

        return false;
    }


    for (const archivo of archivos) {

        const extension =
            (archivo.name.split(".").pop() || "").toLowerCase();


        if (!EXTENSIONES_PERMITIDAS.has(extension)) {

            mostrarMensajeSubida(
                `Tipo de archivo no permitido: ${archivo.name}.`,
                true
            );

            return false;
        }


        if (archivo.size > LIMITE_BYTES) {

            mostrarMensajeSubida(
                `${archivo.name} supera el tamaño máximo de 10 MB.`,
                true
            );

            return false;
        }


        if (archivo.size === 0) {

            mostrarMensajeSubida(
                `${archivo.name} está vacío.`,
                true
            );

            return false;
        }
    }


    return true;
}


async function subirArchivos() {

    const input =
        document.getElementById("archivoInput");

    const archivos =
        input ? Array.from(input.files || []) : [];


    if (!validarArchivosSeleccionados(archivos)) {
        return;
    }


    const formData =
        new FormData();


    for (const archivo of archivos) {
        formData.append("archivos", archivo);
    }


    const idProyecto =
        document.getElementById("subidaProyecto")?.value || "";

    const idActividad =
        document.getElementById("subidaActividad")?.value || "";

    const descripcion =
        document.getElementById("archivoDescripcion")?.value.trim() || "";


    if (idProyecto) {
        formData.append("id_proyecto", idProyecto);
    }

    if (idActividad) {
        formData.append("id_actividad", idActividad);
    }

    if (descripcion) {
        formData.append("descripcion", descripcion);
    }


    const boton =
        document.getElementById("subirButton");

    boton.disabled = true;

    mostrarMensajeSubida("Subiendo archivos...", false);


    try {

        const response =
            await fetch(
                "/api/archivos",
                {
                    method: "POST",
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
                data.message || "No se pudieron subir los archivos."
            );
        }


        const errores =
            data.errores || [];


        if (errores.length > 0) {

            mostrarMensajeSubida(
                `${data.message} (${errores.length} con error: ${errores.map((e) => e.archivo).join(", ")}).`,
                true
            );

        } else {

            mostrarMensajeSubida(data.message || "Archivos subidos.", false);
        }


        input.value = "";

        const descripcionInput =
            document.getElementById("archivoDescripcion");

        if (descripcionInput) {
            descripcionInput.value = "";
        }

        paginaActual = 1;

        await cargarArchivos();


    } catch (error) {

        console.error(
            "Error subiendo archivos:",
            error
        );

        mostrarMensajeSubida(error.message, true);

    } finally {

        boton.disabled = false;
    }
}


/*
========================================
EXPORTAR A EXCEL
========================================
*/

function exportarExcel() {

    if (typeof XLSX === "undefined") {

        alert("No se pudo cargar la librería de Excel.");

        return;
    }


    const buscar =
        document.getElementById("searchInput")?.value.trim() || "";

    const campo =
        document.getElementById("searchField")?.value || "todos";

    const tipo =
        document.getElementById("filtroTipo")?.value || "";

    const idProyecto =
        document.getElementById("filtroProyecto")?.value || "";

    const idActividad =
        document.getElementById("filtroActividad")?.value || "";


    const params =
        new URLSearchParams({ exportar: "1" });

    if (buscar) {
        params.set("buscar", buscar);
        params.set("campo", campo);
    }

    if (tipo) {
        params.set("tipo", tipo);
    }

    if (idProyecto) {
        params.set("id_proyecto", idProyecto);
    }

    if (idActividad) {
        params.set("id_actividad", idActividad);
    }


    fetch(
        `/api/archivos?${params.toString()}`,
        {
            method: "GET",
            credentials: "include"
        }
    ).then(async (response) => {

        if (!response.ok) {
            throw new Error("No se pudo obtener los datos.");
        }

        const data =
            await response.json();

        const filas = (data.archivos || []).map((a) => ({
            "ID": a.id_archivo,
            "Nombre": a.nombre_archivo,
            "Tipo": a.tipo_mime,
            "Extensión": a.extension_,
            "Tamaño": a.tamano_bytes,
            "Tamaño en BD": a.tamano_comprimido || a.tamano_bytes,
            "Comprimido": a.comprimido ? "Sí" : "No",
            "Descripción": a.descripcion || "",
            "Proyecto": a.nombre_proyecto || "",
            "Actividad": a.nombre_actividad || "",
            "Subido por": a.subido_por || "",
            "Fecha": formatoFechaHora(a.fecha_subida)
        }));


        if (filas.length === 0) {

            alert("No hay resultados para exportar.");

            return;
        }


        const hoja =
            XLSX.utils.json_to_sheet(filas);

        hoja["!cols"] = [
            { wch: 8 }, { wch: 34 }, { wch: 24 }, { wch: 10 },
            { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 30 },
            { wch: 24 }, { wch: 24 }, { wch: 16 }, { wch: 18 }
        ];

        const libro = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(libro, hoja, "Archivos");

        XLSX.writeFile(libro, "archivos.xlsx");

    }).catch((error) => {

        console.error(
            "Error exportando archivos:",
            error
        );

        alert("No se pudo exportar el archivo.");
    });
}


const exportButton =
    document.getElementById("exportButton");

if (exportButton) {

    exportButton.addEventListener("click", exportarExcel);
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
        cargarArchivos();
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


for (const id of [
    "filtroTipo",
    "filtroProyecto",
    "filtroActividad"
]) {

    const elemento =
        document.getElementById(id);

    if (elemento) {

        elemento.addEventListener(
            "change",
            () => {
                paginaActual = 1;
                cargarArchivos();
            }
        );
    }
}


/*
========================================
VISTA LISTA / GALERÍA
========================================
*/

function cambiarVista(vista) {

    vistaActual = vista;

    document.getElementById("vistaLista").style.display =
        vista === "lista" ? "" : "none";

    document.getElementById("vistaGaleria").style.display =
        vista === "galeria" ? "" : "none";


    document.getElementById("btnVistaLista").classList.toggle(
        "current",
        vista === "lista"
    );

    document.getElementById("btnVistaGaleria").classList.toggle(
        "current",
        vista === "galeria"
    );
}


const btnLista =
    document.getElementById("btnVistaLista");

const btnGaleria =
    document.getElementById("btnVistaGaleria");

if (btnLista) {

    btnLista.addEventListener(
        "click",
        () => cambiarVista("lista")
    );
}

if (btnGaleria) {

    btnGaleria.addEventListener(
        "click",
        () => cambiarVista("galeria")
    );
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


    const uploadSection =
        document.getElementById("uploadSection");

    if (uploadSection && !puedeCrear()) {
        uploadSection.style.display = "none";
    }


    await cargarOpciones();

    await cargarArchivos();
}


const subirButton =
    document.getElementById("subirButton");

if (subirButton) {

    subirButton.addEventListener("click", subirArchivos);
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

