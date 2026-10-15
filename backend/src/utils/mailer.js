const nodemailer = require("nodemailer");


let transporter = null;


function getTransporter() {

    if (transporter) {
        return transporter;
    }

    const {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_SECURE,
        SMTP_USER,
        SMTP_PASS
    } = process.env;


    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        return null;
    }


    transporter = nodemailer.createTransport({
        host: SMTP_HOST,

        port: Number(SMTP_PORT),

        secure: SMTP_SECURE === "true",

        connectionTimeout: 10000,

        greetingTimeout: 10000,

        socketTimeout: 10000,

        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });

    return transporter;

}


async function sendMail({ to, subject, text, html }) {

    const tx = getTransporter();

    if (!tx) {
        throw new Error("Servicio de correo no configurado.");
    }

    await tx.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html
    });

}


module.exports = {
    sendMail,
    getTransporter
};
