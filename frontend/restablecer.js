const resetForm =
    document.getElementById("resetForm");

const resetMessage =
    document.getElementById("resetMessage");


const params =
    new URLSearchParams(window.location.search);

const token = params.get("token");


if (!token) {

    resetMessage.textContent =
        "Falta el token de recuperación. Solicita un nuevo enlace.";

    resetMessage.style.color = "#d23c78";

}


resetForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();


        const password =
            document
                .getElementById("newPassword")
                .value;

        const confirm =
            document
                .getElementById("confirmPassword")
                .value;


        if (password.length < 8) {

            resetMessage.textContent =
                "La contraseña debe tener al menos 8 caracteres.";

            resetMessage.style.color = "#d23c78";

            return;

        }


        if (password !== confirm) {

            resetMessage.textContent =
                "Las contraseñas no coinciden.";

            resetMessage.style.color = "#d23c78";

            return;

        }


        resetMessage.textContent = "";
        resetMessage.style.color = "";


        try {

            const response =
                await fetch(
                    "/api/auth/restablecer-password",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            token,
                            password
                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "No fue posible restablecer la contraseña."
                );

            }


            resetMessage.textContent =
                `${data.message} Ya puedes iniciar sesión.`;

            resetMessage.style.color = "#2d7a3d";

            resetForm.reset();

        } catch (error) {

            resetMessage.textContent =
                error.message;

            resetMessage.style.color =
                "#d23c78";

        }

    }
);
