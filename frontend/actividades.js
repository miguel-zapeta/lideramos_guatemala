let usuarioActual = null;
let permisosActuales = [];
let todasLasActividades = [];
let ultimosResultados = [];

let paginaActual = 1;

const LIMITE_PAGINA = 20;

let debounceBusqueda = null;

let metaPaginacionActual = {
    total: 0,
    pagina: 1,
    limite: 20,
    totalPaginas: 1
};

let resumenActual = {
    total: 0,
    activos: 0,
    inactivos: 0
};


const AVATAR_CLASSES = [
    "avatar-pink",
    "avatar-orange",
    "avatar-purple"
];


/*
=========================================
VERIFICAR SESIÓN
=========================================
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
=========================================
CERRAR SESIÓN
=========================================
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


function formatoFecha(fecha) {

    if (!fecha) return "—";

    return String(fecha).slice(0, 10);
}


/*
=========================================
CARGAR ACTIVIDADES DESDE LA API
=========================================
*/

async function cargarActividades() {

    const tbody =
        document.getElementById("actividadesTbody");

    const paginationInfo =
        document.getElementById("paginationInfo");

    try {

        const verInactivos =
            document.getElementById("verInactivos")?.checked;

        const buscar =
            document.getElementById("searchInput")?.value.trim() || "";

        const campo =
            document.getElementById("searchField")?.value || "todos";

        const params =
            new URLSearchParams({
                pagina: String(paginaActual),
                limite: String(LIMITE_PAGINA)
            });

        if (verInactivos) {
            params.set("ver_inactivos", "1");
        }

        if (buscar) {
            params.set("buscar", buscar);
            params.set("campo", campo);
        }

        const response =
            await fetch(
                `/api/actividades?${params.toString()}`,
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
                `<tr><td colspan="8">No tienes permiso para ver actividades.</td></tr>`;

            paginationInfo.textContent =
                "Sin acceso.";

            return;
        }


        if (!response.ok) {

            throw new Error(
                "No fue posible cargar las actividades."
            );
        }


        const data =
            await response.json();

        todasLasActividades =
            data.actividades || [];

        metaPaginacionActual = {
            total: data.total || 0,
            pagina: data.pagina || 1,
            limite: data.limite || LIMITE_PAGINA,
            totalPaginas: data.totalPaginas || 1
        };

        resumenActual =
            data.resumen || {
                total: todasLasActividades.length,
                activos: todasLasActividades.filter((a) => a.estado).length,
                inactivos: 0
            };


        renderActividades(todasLasActividades);


    } catch (error) {

        console.error(
            "Error cargando actividades:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="8">Error al cargar actividades.</td></tr>`;

        paginationInfo.textContent =
            "Error al cargar.";
    }
}


function inicialesDe(a) {

    const nombre =
        (a.nombre || "").trim();

    const partes = nombre.split(/\s+/);

    const iniciales =
        ((partes[0] || "").charAt(0) + (partes[1] || "").charAt(0)).toUpperCase();

    return iniciales || "?";
}


function puedeEditar() {

    return permisosActuales.includes("actividades.editar");
}


function renderActividades(actividades) {

    const tbody =
        document.getElementById("actividadesTbody");

    const paginationInfo =
        document.getElementById("paginationInfo");


    const total = metaPaginacionActual.total;

    const activos = resumenActual.activos;

    const inactivos = resumenActual.inactivos;


    document.getElementById("statTotal").textContent = total;
    document.getElementById("statActivos").textContent = activos;
    document.getElementById("statInactivos").textContent = inactivos;

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
            desde + actividades.length - 1;

        paginationInfo.textContent =
            `Mostrando ${desde}–${hasta} de ${total}.`;

        renderPaginacion({
            contenedorId: "paginationButtons",
            pagina: metaPaginacionActual.pagina,
            totalPaginas: metaPaginacionActual.totalPaginas,
            onCambiar: (nuevaPagina) => {
                paginaActual = nuevaPagina;
                cargarActividades();
            }
        });

    }


    ultimosResultados = actividades;


    if (actividades.length === 0) {

        tbody.innerHTML =
            `<tr><td colspan="8">No hay actividades registradas.</td></tr>`;

        return;
    }


    const editar = puedeEditar();

    tbody.innerHTML = actividades.map((a, index) => {

        const iniciales = inicialesDe(a);
        const avatarClass = AVATAR_CLASSES[index % AVATAR_CLASSES.length];
        const estadoClass = a.estado ? "active" : "inactive";
        const estadoTexto = a.estado ? "Activo" : "Inactivo";

        return `
            <tr>
                <td>
                    <div class="user">
                        <div class="user-avatar ${avatarClass}">${escapeHtml(iniciales)}</div>
                        <div>
                            <strong>${escapeHtml(a.nombre)}</strong>
                            <span>ID: ${a.id_actividad}</span>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(a.nombre)}</td>
                <td>${escapeHtml(a.tema)}</td>
                <td>${escapeHtml(formatoFecha(a.fecha))}</td>
                <td>${escapeHtml(a.realizado_por)}</td>
                <td>${escapeHtml(a.eje)}</td>
                <td><span class="status ${estadoClass}">${estadoTexto}</span></td>
                <td>
                    <div class="actions">
                        <button class="action edit" title="Ver detalles" data-ver="${a.id_actividad}">
                            👁️
                        </button>
                        <button class="action edit" title="Editar actividad" data-editar="${a.id_actividad}" ${editar ? "" : "disabled"}>
                            ✏️
                        </button>
                        <button
                            class="action ${a.estado ? "delete" : "edit"}"
                            title="${a.estado ? "Desactivar" : "Activar"} actividad"
                            data-id="${a.id_actividad}"
                            data-estado="${!a.estado}"
                            ${editar ? "" : "disabled"}
                        >
                            ${a.estado ? "🗑️" : "✓"}
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join("");


    tbody.querySelectorAll("button[data-ver]").forEach((btn) => {

        btn.addEventListener("click", () => {

            window.location.href =
                `crearActividad.html?id=${btn.dataset.ver}&modo=ver`;
        });
    });


    tbody.querySelectorAll("button[data-editar]").forEach((btn) => {

        btn.addEventListener("click", () => {

            window.location.href =
                `crearActividad.html?id=${btn.dataset.editar}`;
        });
    });


    tbody.querySelectorAll("button[data-estado]").forEach((btn) => {

        btn.addEventListener("click", () => {

            cambiarEstado(
                Number(btn.dataset.id),
                btn.dataset.estado === "true"
            );
        });
    });
}


/*
=========================================
CAMBIAR ESTADO (PATCH /api/actividades/:id/estado)
=========================================
*/

async function cambiarEstado(id, estado) {

    try {

        const response =
            await fetch(
                `/api/actividades/${id}/estado`,
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


        await cargarActividades();


    } catch (error) {

        console.error(
            "Error actualizando estado:",
            error
        );

        alert(error.message);
    }
}


/*
=========================================
EXPORTAR A EXCEL
Exporta lo mostrado en la tabla (resultado
del buscador o todo si no hay búsqueda),
siempre con la información completa.
=========================================
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

    const verInactivos =
        document.getElementById("verInactivos")?.checked;

    const params =
        new URLSearchParams({ exportar: "1" });

    if (verInactivos) {
        params.set("ver_inactivos", "1");
    }

    if (buscar) {
        params.set("buscar", buscar);
        params.set("campo", campo);
    }


    fetch(
        `/api/actividades?${params.toString()}`,
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

        const filas = (data.actividades || []).map((a) => ({
        "ID": a.id_actividad,
        "Proyecto": a.id_proyecto,
        "Nombre": a.nombre,
        "Tema": a.tema,
        "Fecha": formatoFecha(a.fecha),
        "Asistentes": a.numero_asistentes,
        "Responsable": a.responsable,
        "Realizado por": a.realizado_por,
        "Niños": a.ninos,
        "Niñas": a.ninas,
        "Adolescentes H": a.adolescentes_h,
        "Adolescentes M": a.adolescentes_m,
        "Adultos": a.adultos,
        "Eje": a.eje,
        "Resumen": a.resumen_evento,
        "Enlace redes": a.enlace_en_redes,
        "Lugar": a.lugar,
        "Grupo beneficiado": a.grupo_beneficiado,
        "Temas centrales": a.temas_centrales,
        "Duración": a.duracion,
        "Objetivos": a.objetivos,
        "Resultados": a.resultados,
        "Aportes": a.aportes_del_evento,
        "Comentario": a.comentario,
        "Materiales": a.materiales,
        "Alimentos": a.alimentos,
        "Estado": a.estado ? "Activo" : "Inactivo"
    }));


        if (filas.length === 0) {

            alert("No hay resultados para exportar.");

            return;
        }


        const hoja =
            XLSX.utils.json_to_sheet(filas);

        const libro = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(libro, hoja, "Actividades");

        XLSX.writeFile(libro, "actividades.xlsx");

    }).catch((error) => {

        console.error(
            "Error exportando actividades:",
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
=========================================
BUSCADOR
=========================================
*/

function aplicarFiltro() {

    clearTimeout(debounceBusqueda);

    debounceBusqueda = setTimeout(() => {
        paginaActual = 1;
        cargarActividades();
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


/*
=========================================
INICIALIZAR PANEL
=========================================
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


    await cargarActividades();
}


/*
=========================================
MOSTRAR INACTIVOS
=========================================
*/

const verInactivosCheckbox =
    document.getElementById("verInactivos");


if (verInactivosCheckbox) {

    verInactivosCheckbox.addEventListener(
        "change",
        () => {
            paginaActual = 1;
            cargarActividades();
        }
    );

}


/*
=========================================
BOTÓN CERRAR SESIÓN
=========================================
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
=========================================
INICIO
=========================================
*/

iniciarPanel();
