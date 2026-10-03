/*
=========================================
MENÚ POR PERMISOS
Oculta las opciones del sidebar a las que
el usuario no tiene permiso de ver.
Se auto-ejecuta al cargar la página.
Mapa: data-modulo -> "<modulo>.ver"
=========================================
*/

async function aplicarPermisosMenu(permisos) {

    const items =
        document.querySelectorAll(".menu-item[data-modulo]");

    for (const item of items) {

        const modulo =
            item.getAttribute("data-modulo");

        if (!permisos.includes(`${modulo}.ver`)) {
            item.style.display = "none";
        }
    }
}


async function initMenu() {

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
            return;
        }

        const data =
            await response.json();

        aplicarPermisosMenu(data.permisos || []);

    } catch (error) {

        console.error(
            "Error cargando menú:",
            error
        );
    }
}


if (document.readyState === "loading") {

    document.addEventListener(
        "DOMContentLoaded",
        initMenu
    );

} else {

    initMenu();
}
