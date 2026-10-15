const LIMITE_DEFECTO = 20;

const LIMITE_MAXIMO = 200;


function leerPaginacion(req) {

    const paginaRaw =
        req.query.pagina === undefined
            ? "1"
            : req.query.pagina;

    const limiteRaw =
        req.query.limite === undefined
            ? String(LIMITE_DEFECTO)
            : req.query.limite;


    const pagina = Number(paginaRaw);
    const limite = Number(limiteRaw);


    if (
        !Number.isInteger(pagina) ||
        pagina < 1
    ) {

        return {
            error:
                "El parámetro pagina debe ser un entero mayor o igual a 1."
        };

    }


    if (
        !Number.isInteger(limite) ||
        limite < 1 ||
        limite > LIMITE_MAXIMO
    ) {

        return {
            error:
                `El parámetro limite debe ser un entero entre 1 y ${LIMITE_MAXIMO}.`
        };

    }


    return {
        pagina,
        limite,
        offset: (pagina - 1) * limite
    };

}


function escapeLike(texto) {

    return texto.replace(
        /[\\%_]/g,
        (c) => `\\${c}`
    );

}


/*
Construye un fragmento de búsqueda ILIKE.

mapa: { campo: ["expr SQL", ...], todos: [...] }.
El nombre de la columna sale SIEMPRE del mapa
(nunca del input), así no hay inyección SQL.
Los valores van parametrizados ($n).

Devuelve { sql, params }.
*/

function construirBusqueda({
    buscar,
    campo,
    mapa,
    inicioParam
}) {

    if (
        !buscar ||
        typeof buscar !== "string" ||
        !buscar.trim()
    ) {

        return { sql: "", params: [] };

    }


    const expresiones =
        Object.prototype.hasOwnProperty.call(mapa, campo)
            ? mapa[campo]
            : mapa.todos;


    if (
        !Array.isArray(expresiones) ||
        expresiones.length === 0
    ) {

        return { sql: "", params: [] };

    }


    const patron =
        `%${escapeLike(buscar.trim())}%`;

    const condiciones =
        expresiones.map(
            (expr, i) =>
                `${expr} ILIKE $${inicioParam + i} ESCAPE '\\'`
        );


    return {
        sql: `(${condiciones.join(" OR ")})`,
        params: expresiones.map(() => patron)
    };

}


function metaPaginacion(total, pagina, limite) {

    return {
        total,
        pagina,
        limite,
        totalPaginas:
            Math.max(1, Math.ceil(total / Math.max(1, limite)))
    };

}


module.exports = {
    LIMITE_DEFECTO,
    LIMITE_MAXIMO,
    leerPaginacion,
    construirBusqueda,
    metaPaginacion
};
