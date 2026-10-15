const bcrypt = require("bcrypt");

const SALT_ROUNDS = 12;

async function hashPassword(password) {
    return bcrypt.hash(
        password,
        SALT_ROUNDS
    );
}

async function comparePassword(
    password,
    hashedPassword
) {
    return bcrypt.compare(
        password,
        hashedPassword
    );
}


const PASSWORD_MIN_LENGTH = 8;

const PASSWORD_REGEX =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;


function validarPassword(password) {

    if (
        typeof password !== "string" ||
        password.length < PASSWORD_MIN_LENGTH
    ) {

        return {
            valida: false,
            message:
                "La contraseña debe tener al menos 8 caracteres."
        };

    }


    if (!PASSWORD_REGEX.test(password)) {

        return {
            valida: false,
            message:
                "La contraseña debe incluir al menos una mayúscula, una minúscula y un número."
        };

    }


    return { valida: true };

}


module.exports = {
    hashPassword,
    comparePassword,
    validarPassword
};