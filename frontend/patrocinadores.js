let usuarioActual = null;
let permisosActuales = [];
let todosLosPatrocinadores = [];
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


/*
=========================================
CARGAR PATROCINADORES DESDE LA API
=========================================
*/

async function cargarPatrocinadores() {

    const tbody =
        document.getElementById("patrocinadoresTbody");

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
                `/api/patrocinadores?${params.toString()}`,
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
                `<tr><td colspan="10">No tienes permiso para ver patrocinadores.</td></tr>`;

            paginationInfo.textContent =
                "Sin acceso.";

            return;
        }


        if (!response.ok) {

            throw new Error(
                "No fue posible cargar los patrocinadores."
            );
        }


        const data =
            await response.json();

        todosLosPatrocinadores =
            data.patrocinadores || [];

        metaPaginacionActual = {
            total: data.total || 0,
            pagina: data.pagina || 1,
            limite: data.limite || LIMITE_PAGINA,
            totalPaginas: data.totalPaginas || 1
        };

        resumenActual =
            data.resumen || {
                total: todosLosPatrocinadores.length,
                activos: todosLosPatrocinadores.filter((p) => p.estado).length,
                inactivos: 0
            };


        renderPatrocinadores(todosLosPatrocinadores);


    } catch (error) {

        console.error(
            "Error cargando patrocinadores:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="10">Error al cargar patrocinadores.</td></tr>`;

        paginationInfo.textContent =
            "Error al cargar.";
    }
}


function inicialesDe(patrocinador) {

    const nombre =
        (patrocinador.nombre_razon_social || "").trim();

    const partes = nombre.split(/\s+/);

    const iniciales =
        ((partes[0] || "").charAt(0) + (partes[1] || "").charAt(0)).toUpperCase();

    return iniciales || "?";
}


function puedeEditar() {

    return permisosActuales.includes("finanzas.editar");
}


function oGuion(valor) {

    return valor === null || valor === undefined || valor === ""
        ? "—"
        : escapeHtml(String(valor));
}


function renderPatrocinadores(patrocinadores) {

    const tbody =
        document.getElementById("patrocinadoresTbody");

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
            desde + patrocinadores.length - 1;

        paginationInfo.textContent =
            `Mostrando ${desde}–${hasta} de ${total}.`;

        renderPaginacion({
            contenedorId: "paginationButtons",
            pagina: metaPaginacionActual.pagina,
            totalPaginas: metaPaginacionActual.totalPaginas,
            onCambiar: (nuevaPagina) => {
                paginaActual = nuevaPagina;
                cargarPatrocinadores();
            }
        });

    }


    ultimosResultados = patrocinadores;


    if (patrocinadores.length === 0) {

        tbody.innerHTML =
            `<tr><td colspan="10">No hay patrocinadores registrados.</td></tr>`;

        return;
    }


    const editar = puedeEditar();

    tbody.innerHTML = patrocinadores.map((patrocinador, index) => {

        const iniciales = inicialesDe(patrocinador);
        const avatarClass = AVATAR_CLASSES[index % AVATAR_CLASSES.length];
        const estadoClass = patrocinador.estado ? "active" : "inactive";
        const estadoTexto = patrocinador.estado ? "Activo" : "Inactivo";
        const tipoTexto = patrocinador.tipo === "empresa" ? "Empresa" : "Persona";

        const ubicacion = [
            patrocinador.municipio,
            patrocinador.pais
        ].filter(Boolean).join(" / ");

        return `
            <tr>
                <td>
                    <div class="user">
                        <div class="user-avatar ${avatarClass}">${escapeHtml(iniciales)}</div>
                        <div>
                            <strong>${escapeHtml(patrocinador.nombre_razon_social)}</strong>
                            <span>ID: ${patrocinador.id_patrocinador}</span>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(tipoTexto)}</td>
                <td>${oGuion(patrocinador.dpi)}</td>
                <td>${oGuion(patrocinador.persona_contacto)}</td>
                <td>${oGuion(patrocinador.telefono)}</td>
                <td>${oGuion(patrocinador.correo)}</td>
                <td>${oGuion(ubicacion)}</td>
                <td>${oGuion(patrocinador.fecha_registro)}</td>
                <td><span class="status ${estadoClass}">${estadoTexto}</span></td>
                <td>
                    <div class="actions">
                        <button class="action edit" title="Editar patrocinador" data-id="${patrocinador.id_patrocinador}" ${editar ? "" : "disabled"}>
                            ✏️
                        </button>
                        <button
                            class="action ${patrocinador.estado ? "delete" : "edit"}"
                            title="${patrocinador.estado ? "Desactivar" : "Activar"} patrocinador"
                            data-id="${patrocinador.id_patrocinador}"
                            data-estado="${!patrocinador.estado}"
                            ${editar ? "" : "disabled"}
                        >
                            ${patrocinador.estado ? "🗑️" : "✓"}
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join("");


    tbody.querySelectorAll("button[data-estado]").forEach((btn) => {

        btn.addEventListener("click", () => {

            cambiarEstado(
                Number(btn.dataset.id),
                btn.dataset.estado === "true"
            );
        });
    });


    tbody.querySelectorAll("button.edit[data-id]:not([data-estado])").forEach((btn) => {

        btn.addEventListener("click", () => {

            window.location.href =
                `nuevoPatrocinador.html?id=${btn.dataset.id}`;
        });
    });
}


/*
=========================================
CAMBIAR ESTADO (PATCH /api/patrocinadores/:id/estado)
=========================================
*/

async function cambiarEstado(id, estado) {

    try {

        const response =
            await fetch(
                `/api/patrocinadores/${id}/estado`,
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


        await cargarPatrocinadores();


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
Exporta todo lo filtrado (no solo la
página visible) con la información completa.
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
        `/api/patrocinadores?${params.toString()}`,
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

        const filas = (data.patrocinadores || []).map((p) => ({
        "ID": p.id_patrocinador,
        "Tipo": p.tipo === "empresa" ? "Empresa" : "Persona",
        "Nombre / Razón social": p.nombre_razon_social,
        "DPI": p.dpi,
        "Persona de contacto": p.persona_contacto,
        "Teléfono": p.telefono,
        "Correo": p.correo,
        "Dirección": p.direccion,
        "Municipio": p.municipio,
        "País": p.pais,
        "Fecha de registro": p.fecha_registro,
        "Observaciones": p.observaciones,
        "Estado": p.estado ? "Activo" : "Inactivo"
    }));


        if (filas.length === 0) {

            alert("No hay resultados para exportar.");

            return;
        }


        const hoja =
            XLSX.utils.json_to_sheet(filas);

        hoja["!cols"] = [
            { wch: 8 }, { wch: 10 }, { wch: 35 }, { wch: 15 },
            { wch: 25 }, { wch: 12 }, { wch: 25 }, { wch: 35 },
            { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 40 },
            { wch: 10 }
        ];

        const libro = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(libro, hoja, "Patrocinadores");

        XLSX.writeFile(libro, "patrocinadores.xlsx");

    }).catch((error) => {

        console.error(
            "Error exportando patrocinadores:",
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
BUSCADOR EN SERVIDOR
=========================================
*/

function aplicarFiltro() {

    clearTimeout(debounceBusqueda);

    debounceBusqueda = setTimeout(() => {
        paginaActual = 1;
        cargarPatrocinadores();
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


    await cargarPatrocinadores();
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
