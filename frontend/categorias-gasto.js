let usuarioActual = null;
let permisosActuales = [];
let todasLasCategorias = [];
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
CARGAR CATEGORÍAS DESDE LA API
=========================================
*/

async function cargarCategorias() {

    const tbody =
        document.getElementById("categoriasTbody");

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
                `/api/categorias-gasto?${params.toString()}`,
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
                `<tr><td colspan="6">No tienes permiso para ver categorías.</td></tr>`;

            paginationInfo.textContent =
                "Sin acceso.";

            return;
        }


        if (!response.ok) {

            throw new Error(
                "No fue posible cargar las categorias."
            );
        }


        const data =
            await response.json();

        todasLasCategorias =
            data.categorias || [];

        metaPaginacionActual = {
            total: data.total || 0,
            pagina: data.pagina || 1,
            limite: data.limite || LIMITE_PAGINA,
            totalPaginas: data.totalPaginas || 1
        };

        resumenActual =
            data.resumen || {
                total: todasLasCategorias.length,
                activos: todasLasCategorias.filter((r) => r.estado).length,
                inactivos: 0
            };


        renderCategorias(todasLasCategorias);


    } catch (error) {

        console.error(
            "Error cargando categorías:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="6">Error al cargar categorías.</td></tr>`;

        paginationInfo.textContent =
            "Error al cargar.";
    }
}


function inicialesDe(categoria) {

    const nombre =
        (categoria.nombre || "").trim();

    const partes = nombre.split(/\s+/);

    const iniciales =
        ((partes[0] || "").charAt(0) + (partes[1] || "").charAt(0)).toUpperCase();

    return iniciales || "?";
}


function puedeEditar() {

    return permisosActuales.includes("finanzas.editar");
}


function renderCategorias(categorias) {

    const tbody =
        document.getElementById("categoriasTbody");

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
            desde + categorias.length - 1;

        paginationInfo.textContent =
            `Mostrando ${desde}–${hasta} de ${total}.`;

        renderPaginacion({
            contenedorId: "paginationButtons",
            pagina: metaPaginacionActual.pagina,
            totalPaginas: metaPaginacionActual.totalPaginas,
            onCambiar: (nuevaPagina) => {
                paginaActual = nuevaPagina;
                cargarCategorias();
            }
        });

    }


    ultimosResultados = categorias;


    if (categorias.length === 0) {

        tbody.innerHTML =
            `<tr><td colspan="6">No hay categorías registradas.</td></tr>`;

        return;
    }


    const editar = puedeEditar();

    tbody.innerHTML = categorias.map((categoria, index) => {

        const iniciales = inicialesDe(categoria);
        const avatarClass = AVATAR_CLASSES[index % AVATAR_CLASSES.length];
        const estadoClass = categoria.estado ? "active" : "inactive";
        const estadoTexto = categoria.estado ? "Activo" : "Inactivo";

        return `
            <tr>
                <td>
                    <div class="user">
                        <div class="user-avatar ${avatarClass}">${escapeHtml(iniciales)}</div>
                        <div>
                            <strong>${escapeHtml(categoria.nombre)}</strong>
                            <span>ID: ${categoria.id_categoria}</span>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(categoria.nombre)}</td>
                <td>${escapeHtml(categoria.descripcion) || "—"}</td>
                <td>${escapeHtml(categoria.rubro) || "—"}</td>
                <td><span class="status ${estadoClass}">${estadoTexto}</span></td>
                <td>
                    <div class="actions">
                        <button class="action edit" title="Editar categoría" data-id="${categoria.id_categoria}" ${editar ? "" : "disabled"}>
                            ✏️
                        </button>
                        <button
                            class="action ${categoria.estado ? "delete" : "edit"}"
                            title="${categoria.estado ? "Desactivar" : "Activar"} categoría"
                            data-id="${categoria.id_categoria}"
                            data-estado="${!categoria.estado}"
                            ${editar ? "" : "disabled"}
                        >
                            ${categoria.estado ? "🗑️" : "✓"}
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
                `nuevaCategoriaGasto.html?id=${btn.dataset.id}`;
        });
    });
}


/*
=========================================
CAMBIAR ESTADO (PATCH /api/categorias-gasto/:id/estado)
=========================================
*/

async function cambiarEstado(id, estado) {

    try {

        const response =
            await fetch(
                `/api/categorias-gasto/${id}/estado`,
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


        await cargarCategorias();


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
        `/api/categorias-gasto?${params.toString()}`,
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

        const filas = (data.categorias || []).map((r) => ({
        "ID": r.id_categoria,
        "Nombre": r.nombre,
        "Descripción": r.descripcion,
        "Rubro": r.rubro,
        "Estado": r.estado ? "Activo" : "Inactivo"
    }));


        if (filas.length === 0) {

            alert("No hay resultados para exportar.");

            return;
        }


        const hoja =
            XLSX.utils.json_to_sheet(filas);

        hoja["!cols"] = [
            { wch: 8 }, { wch: 30 }, { wch: 50 }, { wch: 24 }, { wch: 10 }
        ];

        const libro = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(libro, hoja, "Categorías");

        XLSX.writeFile(libro, "categorias.xlsx");

    }).catch((error) => {

        console.error(
            "Error exportando categorías:",
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
        cargarCategorias();
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


    await cargarCategorias();
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
