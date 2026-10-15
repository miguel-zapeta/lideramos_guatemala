/*
=========================================
PAGINACIÓN COMPARTIDA
Renderiza « ‹ 1 2 3 … › » dentro de un
contenedor con clase pagination-buttons.
Uso:
    renderPaginacion({
        contenedorId: "paginationButtons",
        pagina: 1,
        totalPaginas: 5,
        onCambiar: (nuevaPagina) => { ... }
    });
=========================================
*/

function renderPaginacion({
    contenedorId,
    pagina,
    totalPaginas,
    onCambiar
}) {

    const contenedor =
        document.getElementById(contenedorId);

    if (!contenedor) {
        return;
    }


    contenedor.innerHTML = "";


    if (!totalPaginas || totalPaginas <= 1) {
        return;
    }


    const actual =
        Math.min(Math.max(1, pagina), totalPaginas);


    function boton(texto, destino, deshabilitado, esActual) {

        const btn =
            document.createElement("button");

        btn.type = "button";
        btn.textContent = texto;

        if (esActual) {
            btn.classList.add("current");
        }

        if (deshabilitado) {
            btn.disabled = true;
        } else {
            btn.addEventListener("click", () => onCambiar(destino));
        }

        contenedor.appendChild(btn);

    }


    boton("«", 1, actual === 1, false);
    boton("‹", actual - 1, actual === 1, false);


    const ventana = 2;

    let inicio = Math.max(1, actual - ventana);
    let fin = Math.min(totalPaginas, actual + ventana);

    while (fin - inicio < ventana * 2 && inicio > 1) {
        inicio -= 1;
    }

    while (fin - inicio < ventana * 2 && fin < totalPaginas) {
        fin += 1;
    }


    for (let p = inicio; p <= fin; p += 1) {
        boton(String(p), p, false, p === actual);
    }


    boton("›", actual + 1, actual === totalPaginas, false);
    boton("»", totalPaginas, actual === totalPaginas, false);

}
