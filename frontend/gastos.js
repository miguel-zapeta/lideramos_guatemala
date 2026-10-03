let usuarioActual = null;
let permisosActuales = [];
let todosLosGastos = [];
let ultimosResultados = [];


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


function formatoMonto(monto) {

    if (monto === null || monto === undefined || monto === "") {
        return "—";
    }

    return `Q ${Number(monto).toFixed(2)}`;
}


/*
=========================================
CARGAR GASTOS DESDE LA API
=========================================
*/

async function cargarGastos() {

    const tbody =
        document.getElementById("gastosTbody");

    const paginationInfo =
        document.getElementById("paginationInfo");

    try {

        const response =
            await fetch(
                "/api/gastos",
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
                `<tr><td colspan="8">No tienes permiso para ver gastos.</td></tr>`;

            paginationInfo.textContent =
                "Sin acceso.";

            return;
        }


        if (!response.ok) {

            throw new Error(
                "No fue posible cargar los gastos."
            );
        }


        const data =
            await response.json();

        todosLosGastos =
            data.gastos || [];


        renderGastos(todosLosGastos);


    } catch (error) {

        console.error(
            "Error cargando gastos:",
            error
        );

        tbody.innerHTML =
            `<tr><td colspan="8">Error al cargar gastos.</td></tr>`;

        paginationInfo.textContent =
            "Error al cargar.";
    }
}


function puedeEditar() {

    return permisosActuales.includes("finanzas.editar");
}


function renderGastos(gastos) {

    const tbody =
        document.getElementById("gastosTbody");

    const paginationInfo =
        document.getElementById("paginationInfo");


    const total = gastos.length;

    const activos =
        gastos.filter((g) => g.estado).length;


    document.getElementById("statTotal").textContent = total;
    document.getElementById("statActivos").textContent = activos;
    document.getElementById("statInactivos").textContent = total - activos;

    paginationInfo.textContent =
        `Mostrando ${total} gasto(s).`;


    ultimosResultados = gastos;


    if (total === 0) {

        tbody.innerHTML =
            `<tr><td colspan="8">No hay gastos registrados.</td></tr>`;

        return;
    }


    const editar = puedeEditar();

    tbody.innerHTML = gastos.map((g) => {

        const estadoClass = g.estado ? "active" : "inactive";
        const estadoTexto = g.estado ? "Activo" : "Inactivo";

        return `
            <tr>
                <td>
                    <div class="user">
                        <div class="user-avatar avatar-pink">🧾</div>
                        <div>
                            <strong>Gasto #${g.id_gasto}</strong>
                            <span>${g.categoria || ""}</span>
                        </div>
                    </div>
                </td>
                <td>${g.descripcion || "—"}</td>
                <td>${g.categoria || "—"}</td>
                <td>${formatoFecha(g.fecha)}</td>
                <td>${g.razon_denominacion_social || "—"}</td>
                <td>${formatoMonto(g.monto)}</td>
                <td><span class="status ${estadoClass}">${estadoTexto}</span></td>
                <td>
                    <div class="actions">
                        <button class="action edit" title="Ver detalles" data-ver="${g.id_gasto}">
                            👁️
                        </button>
                        <button class="action edit" title="Editar gasto" data-editar="${g.id_gasto}" ${editar ? "" : "disabled"}>
                            ✏️
                        </button>
                        <button
                            class="action ${g.estado ? "delete" : "edit"}"
                            title="${g.estado ? "Desactivar" : "Activar"} gasto"
                            data-id="${g.id_gasto}"
                            data-estado="${!g.estado}"
                            ${editar ? "" : "disabled"}
                        >
                            ${g.estado ? "🗑️" : "✓"}
                        </button>
                    </div>
                </td>
            </tr>`;
    }).join("");


    tbody.querySelectorAll("button[data-ver]").forEach((btn) => {

        btn.addEventListener("click", () => {

            window.location.href =
                `nuevoGasto.html?id=${btn.dataset.ver}&modo=ver`;
        });
    });


    tbody.querySelectorAll("button[data-editar]").forEach((btn) => {

        btn.addEventListener("click", () => {

            window.location.href =
                `nuevoGasto.html?id=${btn.dataset.editar}`;
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
CAMBIAR ESTADO (PATCH /api/gastos/:id/estado)
=========================================
*/

async function cambiarEstado(id, estado) {

    try {

        const response =
            await fetch(
                `/api/gastos/${id}/estado`,
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


        await cargarGastos();


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


    const filas = ultimosResultados.map((g) => ({
        "ID": g.id_gasto,
        "Proyecto": g.id_proyecto,
        "Categoría": g.categoria,
        "Número": g.numero,
        "Fecha": formatoFecha(g.fecha),
        "No. documento": g.numero_documento,
        "Serie": g.serie,
        "Tipo documento": g.tipo_documento,
        "Razón social": g.razon_denominacion_social,
        "Descripción": g.descripcion,
        "Valor base": g.valor_base,
        "IVA": g.iva,
        "Otros impuestos": g.otros_impuestos,
        "Monto": g.monto,
        "Trayecto": g.trayecto,
        "No. comprobante": g.numero_comprobante,
        "Proveedor": g.proveedor,
        "Total valor base": g.total_valor_base,
        "Total del gasto": g.total_del_gasto,
        "Estado": g.estado ? "Activo" : "Inactivo"
    }));


    const hoja =
        XLSX.utils.json_to_sheet(filas);

    hoja["!cols"] = [
        { wch: 8 }, { wch: 10 }, { wch: 22 }, { wch: 10 },
        { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 16 },
        { wch: 28 }, { wch: 30 }, { wch: 12 }, { wch: 12 },
        { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 16 },
        { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 10 }
    ];

    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, "Gastos");

    XLSX.writeFile(libro, "gastos.xlsx");
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

function valorCampo(gasto, campo) {

    switch (campo) {

        case "descripcion":
            return gasto.descripcion || "";

        case "categoria":
            return gasto.categoria || "";

        case "fecha":
            return formatoFecha(gasto.fecha);

        case "razon":
            return gasto.razon_denominacion_social || "";

        case "monto":
            return gasto.monto === null || gasto.monto === undefined
                ? ""
                : String(gasto.monto);

        case "estado":
            return gasto.estado ? "activo" : "inactivo";

        default:
            return [
                gasto.descripcion,
                gasto.categoria,
                formatoFecha(gasto.fecha),
                gasto.razon_denominacion_social,
                gasto.monto,
                gasto.estado ? "activo" : "inactivo"
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

        renderGastos(todosLosGastos);

        return;
    }

    renderGastos(
        todosLosGastos.filter((g) =>
            valorCampo(g, campo).toLowerCase().includes(q)
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


    await cargarGastos();
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
