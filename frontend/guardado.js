/*
=========================================
GUARDADO SIN DUPLICADOS
Evita enviar el mismo registro dos veces:
mientras se guarda, el botón queda
deshabilitado y se muestra "Guardando...".

iniciarGuardado({
    boton,        // elemento del botón de guardar
    mostrar,      // función de mensaje de la página
    reactivar     // true: reactivar al terminar
                  // (flujos que siguen en la misma página)
});

Devuelve:
    null  -> ya hay un guardado en curso (hacer return)
    { exito(), error() }
=========================================
*/

function iniciarGuardado(opciones) {

    const {
        boton,
        mostrar,
        reactivar
    } = opciones;


    if (!boton || boton.dataset.guardando === "1") {
        return null;
    }


    const textoOriginal = boton.textContent;

    boton.dataset.guardando = "1";
    boton.disabled = true;
    boton.textContent = "Guardando...";


    if (typeof mostrar === "function") {
        mostrar("Guardando registro...", false);
    }


    function restaurar() {

        boton.dataset.guardando = "";
        boton.disabled = false;
        boton.textContent = textoOriginal;
    }


    return {

        // Éxito: en flujos con redirect el botón queda
        // deshabilitado hasta que la página cambia.
        exito() {

            if (reactivar) {
                restaurar();
            }
        },

        // Error: se puede reintentar.
        error() {
            restaurar();
        }
    };
}
