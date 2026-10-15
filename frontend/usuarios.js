let usuarioActual = null;
let permisosActuales = [];
let todosLosUsuarios = [];
let ultimosResultados = [];


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

        const response =
            await fetch(
                "/api/usuarios",
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


    const total = usuarios.length;

    const activos =
        usuarios.filter((u) => u.estado).length;


    document.getElementById("statTotal").textContent = total;
    document.getElementById("statActivos").textContent = activos;
    document.getElementById("statInactivos").textContent = total - activos;

    paginationInfo.textContent =
        `Mostrando ${total} usuario(s).`;


    ultimosResultados = usuarios;


    if (total === 0) {

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


    if (ultimosResultados.length === 0) {

        alert("No hay resultados para exportar.");

        return;
    }


    const filas = ultimosResultados.map((u) => ({
        "ID": u.id_usuario,
        "Usuario": u.nombre_usuario,
        "Nombre": u.nombre,
        "Apellido": u.apellido,
        "Correo": u.correo,
        "Rol": u.rol,
        "Estado": u.estado ? "Activo" : "Inactivo"
    }));


    const hoja =
        XLSX.utils.json_to_sheet(filas);

    hoja["!cols"] = [
        { wch: 8 }, { wch: 18 }, { wch: 18 }, { wch: 18 },
        { wch: 30 }, { wch: 16 }, { wch: 10 }
    ];

    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Usuarios");

    XLSX.writeFile(libro, "usuarios.xlsx");
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

function valorCampo(usuario, campo) {

    switch (campo) {

        case "nombre":
            return usuario.nombre || "";

        case "apellido":
            return usuario.apellido || "";

        case "usuario":
            return usuario.nombre_usuario || "";

        case "correo":
            return usuario.correo || "";

        case "rol":
            return usuario.rol || "";

        case "estado":
            return usuario.estado ? "activo" : "inactivo";

        default:
            return [
                usuario.nombre,
                usuario.apellido,
                usuario.nombre_usuario,
                usuario.correo,
                usuario.rol,
                usuario.estado ? "activo" : "inactivo"
            ].filter(Boolean).join(" ");
    }
}


function aplicarFiltro() {

    const q =
        searchInput.value.trim().toLowerCase();

    const campo =
        searchField ? searchField.value : "todos";

    if (!q) {

        renderUsuarios(todosLosUsuarios);

        return;
    }

    renderUsuarios(
        todosLosUsuarios.filter((u) =>
            valorCampo(u, campo).toLowerCase().includes(q)
        )
    );
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
