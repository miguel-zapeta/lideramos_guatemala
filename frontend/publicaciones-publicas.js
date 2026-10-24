/*
========================================
PUBLICACIONES PÚBLICAS
Renderiza el contenido de las páginas
landing (index, quiénes somos, contáctanos)
desde /api/publicaciones/publicas.
No requiere sesión.
========================================
*/

(function () {

    const main =
        document.getElementById("publicacionesMain");

    if (!main) return;


    const pagina =
        main.getAttribute("data-pagina");


    if (!pagina) return;


    const NOMBRES = {
        index: "Inicio",
        quienes: "Quiénes somos",
        contactanos: "Contáctanos"
    };


    function textoAParrafos(texto) {

        const contenedor =
            document.createDocumentFragment();

        const lineas =
            String(texto).split("\n");


        let parrafoActual = [];


        function cerrarParrafo() {

            if (parrafoActual.length === 0) return;

            const p =
                document.createElement("p");

            p.textContent =
                parrafoActual.join("\n");

            contenedor.appendChild(p);

            parrafoActual = [];
        }


        for (const linea of lineas) {

            if (linea.trim() === "") {
                cerrarParrafo();
            } else {
                parrafoActual.push(linea);
            }
        }

        cerrarParrafo();

        return contenedor;
    }


    function crearBloque(pub, esPrimero) {

        const article =
            document.createElement("article");

        article.className =
            esPrimero
                ? "publicacion publicacion-hero"
                : "publicacion";


        if (pub.titulo) {

            const h =
                document.createElement(
                    esPrimero ? "h1" : "h2"
                );

            h.textContent = pub.titulo;

            article.appendChild(h);
        }


        if (pub.contenido) {

            article.appendChild(
                textoAParrafos(pub.contenido)
            );
        }


        if (pub.tiene_imagen) {

            const img =
                document.createElement("img");

            img.src =
                `/api/publicaciones/${pub.id_publicacion}/imagen`;

            img.alt =
                pub.titulo
                    ? `Imagen: ${pub.titulo}`
                    : "Imagen de la publicación";

            img.loading = "lazy";

            article.appendChild(img);
        }


        return article;
    }


    fetch(
        `/api/publicaciones/publicas?pagina=${encodeURIComponent(pagina)}`,
        {
            method: "GET"
        }
    ).then(async (response) => {

        if (!response.ok) {
            throw new Error("No se pudieron cargar las publicaciones.");
        }

        const data =
            await response.json();

        const lista =
            data.publicaciones || [];


        if (lista.length === 0) {

            const vacio =
                document.createElement("p");

            vacio.className = "publicacion-vacia";

            vacio.textContent =
                "Pronto publicaremos contenido en esta página.";

            main.appendChild(vacio);

            return;
        }


        lista.forEach((pub, i) => {

            main.appendChild(
                crearBloque(pub, i === 0)
            );
        });

    }).catch((error) => {

        console.error(
            "Error cargando publicaciones:",
            error
        );
    });

})();
