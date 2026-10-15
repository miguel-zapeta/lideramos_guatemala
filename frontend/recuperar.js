const recoverPasswordForm =
    document.getElementById("recoverPasswordForm");

const recoverUserForm =
    document.getElementById("recoverUserForm");

const recoverMessage =
    document.getElementById("recoverMessage");


function mostrarMensaje(texto, esError) {

    recoverMessage.textContent = texto;

    recoverMessage.style.color =
        esError ? "#d23c78" : "#2d7a3d";

}


recoverPasswordForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const user =
            document
                .getElementById("recoverUser")
                .value
                .trim();


        if (!user) {
            mostrarMensaje("El usuario es obligatorio.", true);
            return;
        }


        mostrarMensaje("", false);


        try {

            const response =
                await fetch(
                    "/api/auth/recuperar-password",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({ user })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "No fue posible procesar la solicitud."
                );

            }


            mostrarMensaje(data.message, false);

        } catch (error) {

            mostrarMensaje(error.message, true);

        }

    }
);


recoverUserForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const correo =
            document
                .getElementById("recoverEmail")
                .value
                .trim();


        if (!correo) {
            mostrarMensaje("El correo es obligatorio.", true);
            return;
        }


        mostrarMensaje("", false);


        try {

            const response =
                await fetch(
                    "/api/auth/recuperar-usuario",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({ correo })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "No fue posible procesar la solicitud."
                );

            }


            mostrarMensaje(data.message, false);

        } catch (error) {

            mostrarMensaje(error.message, true);

        }

    }
);
