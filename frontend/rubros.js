let usuarioActual = null;
let permisosActuales = [];
let todosLosRubros = [];
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
CARGAR RUBROS DESDE LA API
=========================================
*/

async function cargarRubros() {

    const tbody =
        document.getElementById("rubrosTbody");

    const paginationInfo =
        document.getElementById("paginationInfo");

    try {

        const response =
            await fetch(
                "/api/rubros",
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
                `<tr><td colspan="5">No tienes permiso para ver rubros.</td></tr>`;

            paginationInfo.textContent =
                "Sin acceso.";

            return;
        }


        if (!response.ok) {

            throw new Error(
                "No fue posible cargar los rubros."
            );
        }


        const data =
            await response.json();

        todosLosRubros =
            data.rubros || [];


        renderRubros(todosLosRubros);


    } catch (error) {

        console.error(
            "Error cargando rubros:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="5">Error al cargar rubros.</td></tr>`;

        paginationInfo.textContent =
            "Error al cargar.";
    }
}


function inicialesDe(rubro) {

    const nombre =
        (rubro.nombre || "").trim();

    const partes = nombre.split(/\s+/);

    const iniciales =
        ((partes[0] || "").charAt(0) + (partes[1] || "").charAt(0)).toUpperCase();

    return iniciales || "?";
}


function puedeEditar() {

    return permisosActuales.includes("finanzas.editar");
}


function renderRubros(rubros) {

    const tbody =
        document.getElementById("rubrosTbody");

    const paginationInfo =
        document.getElementById("paginationInfo");


    const total = rubros.length;

    const activos =
        rubros.filter((r) => r.estado).length;


    document.getElementById("statTotal").textContent = total;
    document.getElementById("statActivos").textContent = activos;
    document.getElementById("statInactivos").textContent = total - activos;

    paginationInfo.textContent =
        `Mostrando ${total} rubro(s).`;


    ultimosResultados = rubros;


    if (total === 0) {

        tbody.innerHTML =
            `<tr><td colspan="5">No hay rubros registrados.</td></tr>`;

        return;
    }


    const editar = puedeEditar();

    tbody.innerHTML = rubros.map((rubro, index) => {

        const iniciales = inicialesDe(rubro);
        const avatarClass = AVATAR_CLASSES[index % AVATAR_CLASSES.length];
        const estadoClass = rubro.estado ? "active" : "inactive";
        const estadoTexto = rubro.estado ? "Activo" : "Inactivo";

        return `
            <tr>
                <td>
                    <div class="user">
                        <div class="user-avatar ${avatarClass}">${iniciales}</div>
                        <div>
                            <strong>${rubro.nombre}</strong>
                            <span>ID: ${rubro.id_rubro}</span>
                        </div>
                    </div>
                </td>
                <td>${rubro.nombre}</td>
                <td>${rubro.descripcion || "—"}</td>
                <td><span class="status ${estadoClass}">${estadoTexto}</span></td>
                <td>
                    <div class="actions">
                        <button class="action edit" title="Editar rubro" data-id="${rubro.id_rubro}" ${editar ? "" : "disabled"}>
                            ✏️
                        </button>
                        <button
                            class="action ${rubro.estado ? "delete" : "edit"}"
                            title="${rubro.estado ? "Desactivar" : "Activar"} rubro"
                            data-id="${rubro.id_rubro}"
                            data-estado="${!rubro.estado}"
                            ${editar ? "" : "disabled"}
                        >
                            ${rubro.estado ? "🗑️" : "✓"}
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
                `nuevoRubro.html?id=${btn.dataset.id}`;
        });
    });
}


/*
=========================================
CAMBIAR ESTADO (PATCH /api/rubros/:id/estado)
=========================================
*/

async function cambiarEstado(id, estado) {

    try {

        const response =
            await fetch(
                `/api/rubros/${id}/estado`,
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


        await cargarRubros();


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


    const filas = ultimosResultados.map((r) => ({
        "ID": r.id_rubro,
        "Nombre": r.nombre,
        "Descripción": r.descripcion,
        "Estado": r.estado ? "Activo" : "Inactivo"
    }));


    const hoja =
        XLSX.utils.json_to_sheet(filas);

    hoja["!cols"] = [
        { wch: 8 }, { wch: 30 }, { wch: 50 }, { wch: 10 }
    ];

    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Rubros");

    XLSX.writeFile(libro, "rubros.xlsx");
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

function valorCampo(rubro, campo) {

    switch (campo) {

        case "nombre":
            return rubro.nombre || "";

        case "descripcion":
            return rubro.descripcion || "";

        case "estado":
            return rubro.estado ? "activo" : "inactivo";

        default:
            return [
                rubro.nombre,
                rubro.descripcion,
                rubro.estado ? "activo" : "inactivo"
            ].filter(Boolean).join(" ");
    }
}


function aplicarFiltro() {

    const q =
        searchInput.value.trim().toLowerCase();

    const campo =
        searchField ? searchField.value : "todos";

    if (!q) {

        renderRubros(todosLosRubros);

        return;
    }

    renderRubros(
        todosLosRubros.filter((r) =>
            valorCampo(r, campo).toLowerCase().includes(q)
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


    await cargarRubros();
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
