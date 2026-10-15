/*
=========================================
ESCAPE HTML
Evita XSS al interpolar datos de la BD
en innerHTML. Úsalo en cada ${dato} que
venga del servidor o del usuario.
=========================================
*/

function escapeHtml(valor) {

    if (valor === null || valor === undefined) {
        return "";
    }

    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

}
