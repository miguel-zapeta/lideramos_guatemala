let usuarioActual = null;
let permisosActuales = [];
let todosLosUsuarios = [];
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
CARGAR USUARIOS DESDE LA API
=========================================
*/

async function cargarUsuarios() {

    const tbody =
        document.getElementById("usersTbody");

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
                `/api/usuarios?${params.toString()}`,
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
                `<tr><td colspan="8">No tienes permiso para ver usuarios.</td></tr>`;

            paginationInfo.textContent =
                "Sin acceso.";

            return;
        }


        if (!response.ok) {

            throw new Error(
                "No fue posible cargar los usuarios."
            );
        }


        const data =
            await response.json();

        todosLosUsuarios =
            data.usuarios || [];

        metaPaginacionActual = {
            total: data.total || 0,
            pagina: data.pagina || 1,
            limite: data.limite || LIMITE_PAGINA,
            totalPaginas: data.totalPaginas || 1
        };

        resumenActual =
            data.resumen || {
                total: todosLosUsuarios.length,
                activos: todosLosUsuarios.filter((u) => u.estado).length,
                inactivos: 0
            };


        renderUsuarios(todosLosUsuarios);


    } catch (error) {

        console.error(
            "Error cargando usuarios:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="8">Error al cargar usuarios.</td></tr>`;

        paginationInfo.textContent =
            "Error al cargar.";
    }
}


function inicialesDe(usuario) {

    const nombre =
        (usuario.nombre || "").trim();

    const apellido =
        (usuario.apellido || "").trim();

    const iniciales =
        (nombre.charAt(0) + apellido.charAt(0)).toUpperCase();

    return iniciales || "?";
}


function nombreCompleto(usuario) {

    return `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim()
        || usuario.nombre_usuario;
}


function puedeEditar() {

    return permisosActuales.includes("usuarios.editar");
}


function renderUsuarios(usuarios) {

    const tbody =
        document.getElementById("usersTbody");

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
            desde + usuarios.length - 1;

        paginationInfo.textContent =
            `Mostrando ${desde}–${hasta} de ${total}.`;

        renderPaginacion({
            contenedorId: "paginationButtons",
            pagina: metaPaginacionActual.pagina,
            totalPaginas: metaPaginacionActual.totalPaginas,
            onCambiar: (nuevaPagina) => {
                paginaActual = nuevaPagina;
                cargarUsuarios();
            }
        });

    }


    ultimosResultados = usuarios;


    if (usuarios.length === 0) {

        tbody.innerHTML =
            `<tr><td colspan="8">No hay usuarios registrados.</td></tr>`;

        return;
    }


    const editar = puedeEditar();

    tbody.innerHTML = usuarios.map((usuario, index) => {

        const iniciales = inicialesDe(usuario);
        const avatarClass = AVATAR_CLASSES[index % AVATAR_CLASSES.length];
        const estadoClass = usuario.estado ? "active" : "inactive";
        const estadoTexto = usuario.estado ? "Activo" : "Inactivo";

        return `
            <tr>
                <td>
                    <div class="user">
                        <div class="user-avatar ${avatarClass}">${escapeHtml(iniciales)}</div>
                        <div>
                            <strong>${escapeHtml(nombreCompleto(usuario))}</strong>
                            <span>ID: ${usuario.id_usuario}</span>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(usuario.nombre) || "—"}</td>
                <td>${escapeHtml(usuario.apellido) || "—"}</td>
                <td>${escapeHtml(usuario.nombre_usuario)}</td>
                <td>${escapeHtml(usuario.correo)}</td>
                <td>${escapeHtml(usuario.rol)}</td>
                <td><span class="status ${estadoClass}">${estadoTexto}</span></td>
                <td>
                    <div class="actions">
                        <button class="action edit" title="Editar usuario" data-id="${usuario.id_usuario}" ${editar ? "" : "disabled"}>
                            ✏️
                        </button>
                        <button
                            class="action ${usuario.estado ? "delete" : "edit"}"
                            title="${usuario.estado ? "Desactivar" : "Activar"} usuario"
                            data-id="${usuario.id_usuario}"
                            data-estado="${!usuario.estado}"
                            ${editar ? "" : "disabled"}
                        >
                            ${usuario.estado ? "🗑️" : "✓"}
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
                `nuevoUsuario.html?id=${btn.dataset.id}`;
        });
    });
}


/*
=========================================
CAMBIAR ESTADO (PATCH /api/usuarios/:id/estado)
=========================================
*/

async function cambiarEstado(id, estado) {

    try {

        const response =
            await fetch(
                `/api/usuarios/${id}/estado`,
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


        await cargarUsuarios();


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
        `/api/usuarios?${params.toString()}`,
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

        const filas = (data.usuarios || []).map((u) => ({
        "ID": u.id_usuario,
        "Usuario": u.nombre_usuario,
        "Nombre": u.nombre,
        "Apellido": u.apellido,
        "Correo": u.correo,
        "Rol": u.rol,
        "Estado": u.estado ? "Activo" : "Inactivo"
    }));


        if (filas.length === 0) {

            alert("No hay resultados para exportar.");

            return;
        }


        const hoja =
            XLSX.utils.json_to_sheet(filas);

        hoja["!cols"] = [
            { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
            { wch: 30 }, { wch: 16 }, { wch: 10 }
        ];

        const libro = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(libro, hoja, "Usuarios");

        XLSX.writeFile(libro, "usuarios.xlsx");

    }).catch((error) => {

        console.error(
            "Error exportando usuarios:",
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
        cargarUsuarios();
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


    if (nameEl) {
        nameEl.textContent = nombreCompleto(usuarioActual);
    }

    if (roleEl) {
        roleEl.textContent = usuarioActual.rol;
    }

    if (avatarEl) {
        avatarEl.textContent = inicialesDe(usuarioActual);
    }


    await cargarUsuarios();
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
