const loginForm =
    document.getElementById("loginForm");

const loginMessage =
    document.getElementById("loginMessage");


loginForm.addEventListener(
    "submit",
    async (event) => {

        event.preventDefault();

        const user =
            document
                .getElementById("user")
                .value
                .trim();

        const password =
            document
                .getElementById("password")
                .value;


        loginMessage.textContent = "";
        loginMessage.style.color = "";


        try {

            const response =
                await fetch(
                    "/api/auth/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        credentials: "include",

                        body: JSON.stringify({
                            user,
                            password
                        })
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.message ||
                    "No fue posible iniciar sesión."
                );

            }


            /*
            Login correcto.

            El JWT está almacenado
            en una cookie HttpOnly.
            */

            window.location.href =
                "/usuarios.html";


        } catch (error) {

            loginMessage.textContent =
                error.message;

            loginMessage.style.color =
                "#d23c78";

        }

    }
);
