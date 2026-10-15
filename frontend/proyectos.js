let usuarioActual = null;
let permisosActuales = [];
let todosLosProyectos = [];
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
    planeados: 0,
    en_proceso: 0,
    finalizados: 0
};


const AVATAR_CLASSES = [
    "avatar-pink",
    "avatar-orange",
    "avatar-purple"
];

const SIGUIENTE_ESTADO = {
    "planeado": "en proceso",
    "en proceso": "finalizado"
};


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
CARGAR PROYECTOS DESDE LA API
=========================================
*/

async function cargarProyectos() {

    const tbody =
        document.getElementById("proyectosTbody");

    const paginationInfo =
        document.getElementById("paginationInfo");

    try {

        const buscar =
            document.getElementById("searchInput")?.value.trim() || "";

        const campo =
            document.getElementById("searchField")?.value || "todos";

        const params =
            new URLSearchParams({
                pagina: String(paginaActual),
                limite: String(LIMITE_PAGINA)
            });

        if (buscar) {
            params.set("buscar", buscar);
            params.set("campo", campo);
        }

        const response =
            await fetch(
                `/api/proyectos?${params.toString()}`,
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
                `<tr><td colspan="5">No tienes permiso para ver proyectos.</td></tr>`;

            paginationInfo.textContent =
                "Sin acceso.";

            return;
        }


        if (!response.ok) {

            throw new Error(
                "No fue posible cargar los proyectos."
            );
        }


        const data =
            await response.json();

        todosLosProyectos =
            data.proyectos || [];

        metaPaginacionActual = {
            total: data.total || 0,
            pagina: data.pagina || 1,
            limite: data.limite || LIMITE_PAGINA,
            totalPaginas: data.totalPaginas || 1
        };

        resumenActual =
            data.resumen || {
                total: todosLosProyectos.length,
                planeados: todosLosProyectos.filter((p) => p.estado === "planeado").length,
                en_proceso: todosLosProyectos.filter((p) => p.estado === "en proceso").length,
                finalizados: todosLosProyectos.filter((p) => p.estado === "finalizado").length
            };


        renderProyectos(todosLosProyectos);


    } catch (error) {

        console.error(
            "Error cargando proyectos:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="5">Error al cargar proyectos.</td></tr>`;

        paginationInfo.textContent =
            "Error al cargar.";
    }
}


function inicialesDe(p) {

    const nombre =
        (p.nombre || "").trim();

    const partes = nombre.split(/\s+/);

    const iniciales =
        ((partes[0] || "").charAt(0) + (partes[1] || "").charAt(0)).toUpperCase();

    return iniciales || "?";
}


function puedeEditar() {

    return permisosActuales.includes("proyectos.editar");
}


function renderProyectos(proyectos) {

    const tbody =
        document.getElementById("proyectosTbody");

    const paginationInfo =
        document.getElementById("paginationInfo");


    const total = metaPaginacionActual.total;


    document.getElementById("statTotal").textContent = total;
    document.getElementById("statPlaneados").textContent =
        resumenActual.planeados;
    document.getElementById("statEnProceso").textContent =
        resumenActual.en_proceso;
    document.getElementById("statFinalizados").textContent =
        resumenActual.finalizados;

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
            desde + proyectos.length - 1;

        paginationInfo.textContent =
            `Mostrando ${desde}–${hasta} de ${total}.`;

        renderPaginacion({
            contenedorId: "paginationButtons",
            pagina: metaPaginacionActual.pagina,
            totalPaginas: metaPaginacionActual.totalPaginas,
            onCambiar: (nuevaPagina) => {
                paginaActual = nuevaPagina;
                cargarProyectos();
            }
        });

    }


    ultimosResultados = proyectos;


    if (proyectos.length === 0) {

        tbody.innerHTML =
            `<tr><td colspan="5">No hay proyectos registrados.</td></tr>`;

        return;
    }


    const editar = puedeEditar();

    tbody.innerHTML = proyectos.map((p, index) => {

        const iniciales = inicialesDe(p);
        const avatarClass = AVATAR_CLASSES[index % AVATAR_CLASSES.length];
        const finalizado = p.estado === "finalizado";
        const siguiente = SIGUIENTE_ESTADO[p.estado];

        return `
            <tr>
                <td>
                    <div class="user">
                        <div class="user-avatar ${avatarClass}">${escapeHtml(iniciales)}</div>
                        <div>
                            <strong>${escapeHtml(p.nombre)}</strong>
                            <span>ID: ${p.id_proyecto} · ${escapeHtml(p.estado)}</span>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(p.nombre)}</td>
                <td>${escapeHtml(formatoFecha(p.fecha_inicio))}</td>
                <td>${escapeHtml(formatoFecha(p.fecha_finalizacion))}</td>
                <td>
                    <div class="actions">
                        <button class="action edit" title="Ver detalles" data-ver="${p.id_proyecto}">
                            👁️
                        </button>
                        <button class="action edit" title="Editar proyecto" data-editar="${p.id_proyecto}" ${editar && !finalizado ? "" : "disabled"}>
                            ✏️
                        </button>
                        ${siguiente ? `
                        <button
                            class="action edit"
                            title="Avanzar a: ${siguiente}"
                            data-avanzar="${p.id_proyecto}"
                            data-siguiente="${siguiente}"
                            ${editar ? "" : "disabled"}
                        >
                            ⏩
                        </button>` : ""}
                    </div>
                </td>
            </tr>`;
    }).join("");


    tbody.querySelectorAll("button[data-ver]").forEach((btn) => {

        btn.addEventListener("click", () => {

            window.location.href =
                `nuevoProyecto.html?id=${btn.dataset.ver}&modo=ver`;
        });
    });


    tbody.querySelectorAll("button[data-editar]").forEach((btn) => {

        btn.addEventListener("click", () => {

            window.location.href =
                `nuevoProyecto.html?id=${btn.dataset.editar}`;
        });
    });


    tbody.querySelectorAll("button[data-avanzar]").forEach((btn) => {

        btn.addEventListener("click", () => {

            avanzarEstado(
                Number(btn.dataset.avanzar),
                btn.dataset.siguiente
            );
        });
    });
}


/*
=========================================
AVANZAR ESTADO (PATCH /api/proyectos/:id/estado)
=========================================
*/

async function avanzarEstado(id, siguiente) {

    const confirmar = confirm(
        `¿Cambiar el estado del proyecto a "${siguiente}"?` +
        (siguiente === "finalizado"
            ? " Después ya no se podrá editar."
            : "")
    );

    if (!confirmar) {
        return;
    }

    try {

        const response =
            await fetch(
                `/api/proyectos/${id}/estado`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({ estado: siguiente })
                }
            );


        if (!response.ok) {

            const data =
                await response.json().catch(() => ({}));

            throw new Error(
                data.message || "No se pudo actualizar el estado."
            );
        }


        await cargarProyectos();


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

    const params =
        new URLSearchParams({ exportar: "1" });

    if (buscar) {
        params.set("buscar", buscar);
        params.set("campo", campo);
    }


    fetch(
        `/api/proyectos?${params.toString()}`,
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

        const filas = (data.proyectos || []).map((p) => ({
        "ID": p.id_proyecto,
        "Nombre": p.nombre,
        "Fecha inicio": formatoFecha(p.fecha_inicio),
        "Fecha finalización": formatoFecha(p.fecha_finalizacion),
        "Estado": p.estado,
        "Subvención": p.subvencion,
        "Fecha tipo cambio": formatoFecha(p.fecha_tipo_cambio),
        "Tipo cambio": p.tipo_cambio,
        "Fuente tipo cambio": p.fuente_tipo_cambio,
        "Gastos ejecutados": p.total_gastos_ejecutados,
        "Solicitado Rise Up": p.monto_total_solicitado_rise_up,
        "Subvención total": p.monto_total_subvencion,
        "Diferencia": p.diferencia_entre_solicitado_y_subvencion
    }));


        if (filas.length === 0) {

            alert("No hay resultados para exportar.");

            return;
        }


        const hoja =
            XLSX.utils.json_to_sheet(filas);

        const libro = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(libro, hoja, "Proyectos");

        XLSX.writeFile(libro, "proyectos.xlsx");

    }).catch((error) => {

        console.error(
            "Error exportando proyectos:",
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
        cargarProyectos();
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


    await cargarProyectos();
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
