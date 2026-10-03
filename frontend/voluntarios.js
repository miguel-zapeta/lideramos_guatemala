let voluntarioActual = null;
let permisosActuales = [];
let todosLosVoluntarios = [];
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


        voluntarioActual =
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
CARGAR VOLUNTARIOS DESDE LA API
=========================================
*/

async function cargarVoluntarios() {

    const tbody =
        document.getElementById("volunteersTbody");

    const paginationInfo =
        document.getElementById("paginationInfo");

    try {

        const response =
            await fetch(
                "/api/voluntarios",
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
                `<tr><td colspan="8">No tienes permiso para ver voluntarios.</td></tr>`;

            paginationInfo.textContent =
                "Sin acceso.";

            return;
        }


        if (!response.ok) {

            throw new Error(
                "No fue posible cargar los voluntarios."
            );
        }


        const data =
            await response.json();

        todosLosVoluntarios =
            data.voluntarios || [];


        renderVoluntarios(todosLosVoluntarios);


    } catch (error) {

        console.error(
            "Error cargando voluntarios:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="8">Error al cargar voluntarios.</td></tr>`;

        paginationInfo.textContent =
            "Error al cargar.";
    }
}


function inicialesDe(v) {

    const nombres =
        (v.nombres || "").trim();

    const apellidos =
        (v.apellidos || "").trim();

    const iniciales =
        (nombres.charAt(0) + apellidos.charAt(0)).toUpperCase();

    return iniciales || "?";
}


function nombreCompleto(v) {

    return `${v.nombres || ""} ${v.apellidos || ""}`.trim();
}


function puedeEditar() {

    return permisosActuales.includes("voluntarios.editar");
}


function puedeEliminar() {

    return permisosActuales.includes("voluntarios.eliminar");
}


/*
=========================================
ELIMINAR VOLUNTARIO (DELETE)
=========================================
*/

async function eliminarVoluntario(id, nombre) {

    const confirmar = confirm(
        `¿Eliminar definitivamente a ${nombre}? Esta acción no se puede deshacer.`
    );

    if (!confirmar) {
        return;
    }

    try {

        const response =
            await fetch(
                `/api/voluntarios/${id}`,
                {
                    method: "DELETE",
                    credentials: "include"
                }
            );


        if (response.status === 401) {

            window.location.replace(
                "/login.html"
            );

            return;
        }


        if (!response.ok) {

            const data =
                await response.json().catch(() => ({}));

            throw new Error(
                data.message || "No se pudo eliminar el voluntario."
            );
        }


        await cargarVoluntarios();


    } catch (error) {

        console.error(
            "Error eliminando voluntario:",
            error
        );

        alert(error.message);
    }
}


function renderVoluntarios(voluntarios) {

    const tbody =
        document.getElementById("volunteersTbody");

    const paginationInfo =
        document.getElementById("paginationInfo");


    const total = voluntarios.length;

    const enProyectos =
        voluntarios.filter((v) => Number(v.total_proyectos) > 0).length;


    document.getElementById("statTotal").textContent = total;
    document.getElementById("statEnProyectos").textContent = enProyectos;
    document.getElementById("statSinAsignar").textContent = total - enProyectos;

    paginationInfo.textContent =
        `Mostrando ${total} voluntario(s).`;


    ultimosResultados = voluntarios;


    if (total === 0) {

        tbody.innerHTML =
            `<tr><td colspan="8">No hay voluntarios registrados.</td></tr>`;

        return;
    }


    const editar = puedeEditar();
    const eliminar = puedeEliminar();

    tbody.innerHTML = voluntarios.map((v, index) => {

        const iniciales = inicialesDe(v);
        const avatarClass = AVATAR_CLASSES[index % AVATAR_CLASSES.length];

        return `
            <tr>
                <td>
                    <div class="user">
                        <div class="user-avatar ${avatarClass}">${iniciales}</div>
                        <div>
                            <strong>${nombreCompleto(v)}</strong>
                            <span>ID: ${v.id_persona}</span>
                        </div>
                    </div>
                </td>
                <td>${v.nombres || "—"}</td>
                <td>${v.apellidos || "—"}</td>
                <td>${v.municipio || "—"}</td>
                <td>${v.centro_educativo || "—"}</td>
                <td>${v.jornada || "—"}</td>
                <td>${v.edad === null || v.edad === undefined ? "—" : v.edad}</td>
                <td>
                    <div class="actions">
                        <button class="action edit" title="Ver detalles" data-ver="${v.id_persona}">
                            👁️
                        </button>
                        <button class="action edit" title="Editar voluntario" data-editar="${v.id_persona}" ${editar ? "" : "disabled"}>
                            ✏️
                        </button>
                        <button class="action delete" title="Eliminar voluntario" data-eliminar="${v.id_persona}" data-nombre="${nombreCompleto(v)}" ${eliminar ? "" : "disabled"}>
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join("");


    tbody.querySelectorAll("button[data-ver]").forEach((btn) => {

        btn.addEventListener("click", () => {

            window.location.href =
                `nuevoVoluntario.html?id=${btn.dataset.ver}&modo=ver`;
        });
    });


    tbody.querySelectorAll("button[data-editar]").forEach((btn) => {

        btn.addEventListener("click", () => {

            window.location.href =
                `nuevoVoluntario.html?id=${btn.dataset.editar}`;
        });
    });


    tbody.querySelectorAll("button[data-eliminar]").forEach((btn) => {

        btn.addEventListener("click", () => {

            eliminarVoluntario(
                Number(btn.dataset.eliminar),
                btn.dataset.nombre
            );
        });
    });
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


    const filas = ultimosResultados.map((v) => ({
        "ID": v.id_persona,
        "Nombres": v.nombres,
        "Apellidos": v.apellidos,
        "Edad": v.edad,
        "DPI": v.dpi,
        "Municipio": v.municipio,
        "Teléfono": v.telefono,
        "Centro educativo": v.centro_educativo,
        "Jornada": v.jornada,
        "Encargado": v.encargado,
        "Teléfono encargado": v.telefono_encargado,
        "DPI del encargado": v.dpi_del_encargado,
        "Carta compromiso": v.carta_compromiso,
        "Carta medios": v.carta_medios_comunicacion,
        "DPI18": v.dpi18,
        "Certificado nacimiento": v.certificado_nacimiento,
        "DPI encargado (respaldo)": v.dpi_encargado,
        "Biografía": v.biografia,
        "Total proyectos": v.total_proyectos
    }));


    const hoja =
        XLSX.utils.json_to_sheet(filas);

    hoja["!cols"] = [
        { wch: 8 }, { wch: 20 }, { wch: 20 }, { wch: 8 },
        { wch: 16 }, { wch: 18 }, { wch: 14 }, { wch: 24 },
        { wch: 14 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
        { wch: 18 }, { wch: 16 }, { wch: 12 }, { wch: 22 },
        { wch: 22 }, { wch: 30 }, { wch: 16 }
    ];

    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Voluntarios");

    XLSX.writeFile(libro, "voluntarios.xlsx");
}


const exportButton =
    document.getElementById("exportButton");

if (exportButton) {

    exportButton.addEventListener("click", exportarExcel);
}


/*
=========================================
BUSCADOR POR PARÁMETRO
=========================================
*/

function valorCampo(v, campo) {

    switch (campo) {

        case "nombre":
            return v.nombres || "";

        case "apellido":
            return v.apellidos || "";

        case "municipio":
            return v.municipio || "";

        case "centro":
            return v.centro_educativo || "";

        case "jornada":
            return v.jornada || "";

        case "edad":
            return v.edad === null || v.edad === undefined
                ? ""
                : String(v.edad);

        default:
            return [
                v.nombres,
                v.apellidos,
                v.municipio,
                v.centro_educativo,
                v.jornada,
                v.edad
            ].filter(
                (x) => x !== null && x !== undefined && x !== ""
            ).join(" ");
    }
}


function aplicarFiltro() {

    const q =
        searchInput.value.trim().toLowerCase();

    const campo =
        searchField ? searchField.value : "todos";

    if (!q) {

        renderVoluntarios(todosLosVoluntarios);

        return;
    }

    renderVoluntarios(
        todosLosVoluntarios.filter((v) =>
            valorCampo(v, campo).toLowerCase().includes(q)
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


    if (nameEl && voluntarioActual) {

        nameEl.textContent =
            `${voluntarioActual.nombre || ""} ${voluntarioActual.apellido || ""}`.trim();
    }

    if (roleEl && voluntarioActual) {
        roleEl.textContent = voluntarioActual.rol;
    }

    if (avatarEl && voluntarioActual) {

        const ini =
            ((voluntarioActual.nombre || "").charAt(0) +
             (voluntarioActual.apellido || "").charAt(0)).toUpperCase();

        avatarEl.textContent = ini || "?";
    }


    await cargarVoluntarios();
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
