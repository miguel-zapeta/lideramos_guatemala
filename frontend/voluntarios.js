let voluntarioActual = null;
let permisosActuales = [];
let todosLosVoluntarios = [];
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
    en_proyectos: 0,
    sin_asignar: 0
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
                `/api/voluntarios?${params.toString()}`,
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
                `<tr><td colspan="9">No tienes permiso para ver voluntarios.</td></tr>`;

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

        metaPaginacionActual = {
            total: data.total || 0,
            pagina: data.pagina || 1,
            limite: data.limite || LIMITE_PAGINA,
            totalPaginas: data.totalPaginas || 1
        };

        resumenActual =
            data.resumen || {
                total: todosLosVoluntarios.length,
                en_proyectos: todosLosVoluntarios.filter((v) => Number(v.total_proyectos) > 0).length,
                sin_asignar: 0
            };


        renderVoluntarios(todosLosVoluntarios);


    } catch (error) {

        console.error(
            "Error cargando voluntarios:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="9">Error al cargar voluntarios.</td></tr>`;

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
DESACTIVAR VOLUNTARIO (DELETE lógico)
=========================================
*/

async function eliminarVoluntario(id, nombre) {

    const confirmar = confirm(
        `¿Desactivar a ${nombre}? Dejará de aparecer en la lista.`
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
                data.message || "No se pudo desactivar el voluntario."
            );
        }


        await cargarVoluntarios();


    } catch (error) {

        console.error(
            "Error desactivando voluntario:",
            error
        );

        alert(error.message);
    }
}


/*
=========================================
CAMBIAR ESTADO (PATCH activar/desactivar)
=========================================
*/

async function cambiarEstado(id, estado) {

    try {

        const response =
            await fetch(
                `/api/voluntarios/${id}/estado`,
                {
                    method: "PATCH",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    credentials: "include",

                    body: JSON.stringify({ estado })
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
                data.message || "No se pudo actualizar el estado."
            );
        }


        await cargarVoluntarios();


    } catch (error) {

        console.error(
            "Error cambiando estado:",
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


    const total = metaPaginacionActual.total;

    const enProyectos = resumenActual.en_proyectos;

    const sinAsignar = resumenActual.sin_asignar;


    document.getElementById("statTotal").textContent = total;
    document.getElementById("statEnProyectos").textContent = enProyectos;
    document.getElementById("statSinAsignar").textContent = sinAsignar;

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
            desde + voluntarios.length - 1;

        paginationInfo.textContent =
            `Mostrando ${desde}–${hasta} de ${total}.`;

        renderPaginacion({
            contenedorId: "paginationButtons",
            pagina: metaPaginacionActual.pagina,
            totalPaginas: metaPaginacionActual.totalPaginas,
            onCambiar: (nuevaPagina) => {
                paginaActual = nuevaPagina;
                cargarVoluntarios();
            }
        });

    }


    ultimosResultados = voluntarios;


    if (voluntarios.length === 0) {

        tbody.innerHTML =
            `<tr><td colspan="9">No hay voluntarios registrados.</td></tr>`;

        return;
    }


    const editar = puedeEditar();
    const eliminar = puedeEliminar();

    tbody.innerHTML = voluntarios.map((v, index) => {

        const iniciales = inicialesDe(v);
        const avatarClass = AVATAR_CLASSES[index % AVATAR_CLASSES.length];
        const estadoClass = v.estado ? "active" : "inactive";
        const estadoTexto = v.estado ? "Activo" : "Inactivo";

        return `
            <tr>
                <td>
                    <div class="user">
                        <div class="user-avatar ${avatarClass}">${escapeHtml(iniciales)}</div>
                        <div>
                            <strong>${escapeHtml(nombreCompleto(v))}</strong>
                            <span>ID: ${v.id_persona}</span>
                        </div>
                    </div>
                </td>
                <td>${escapeHtml(v.nombres) || "—"}</td>
                <td>${escapeHtml(v.apellidos) || "—"}</td>
                <td>${escapeHtml(v.municipio) || "—"}</td>
                <td>${escapeHtml(v.centro_educativo) || "—"}</td>
                <td>${escapeHtml(v.jornada) || "—"}</td>
                <td>${v.edad === null || v.edad === undefined ? "—" : v.edad}</td>
                <td><span class="status ${estadoClass}">${estadoTexto}</span></td>
                <td>
                    <div class="actions">
                        <button class="action edit" title="Ver detalles" data-ver="${v.id_persona}">
                            👁️
                        </button>
                        <button class="action edit" title="Editar voluntario" data-editar="${v.id_persona}" ${editar ? "" : "disabled"}>
                            ✏️
                        </button>
                        ${v.estado ? `
                        <button class="action delete" title="Desactivar voluntario" data-eliminar="${v.id_persona}" data-nombre="${escapeHtml(nombreCompleto(v))}" ${eliminar ? "" : "disabled"}>
                            🗑️
                        </button>` : `
                        <button
                            class="action edit"
                            title="Activar voluntario"
                            data-id="${v.id_persona}"
                            data-estado="true"
                            ${editar ? "" : "disabled"}
                        >
                            ✓
                        </button>`}
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
        `/api/voluntarios?${params.toString()}`,
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

        const filas = (data.voluntarios || []).map((v) => ({
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
        "Estado": v.estado ? "Activo" : "Inactivo",
        "Total proyectos": v.total_proyectos
    }));


        if (filas.length === 0) {

            alert("No hay resultados para exportar.");

            return;
        }


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

    }).catch((error) => {

        console.error(
            "Error exportando voluntarios:",
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
BUSCADOR POR PARÁMETRO
=========================================
*/

function aplicarFiltro() {

    clearTimeout(debounceBusqueda);

    debounceBusqueda = setTimeout(() => {
        paginaActual = 1;
        cargarVoluntarios();
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
            cargarVoluntarios();
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
