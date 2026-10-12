/**
 * SS SWAP - Envío del comprobante (XML autorizado + RIDE) por correo
 *
 * Configuración por variables de entorno (sin secretos en el código):
 *   SMTP_HOST, SMTP_PORT (465 = TLS directo, 587 = STARTTLS), SMTP_USER,
 *   SMTP_PASS, SMTP_FROM ("SS SWAP <facturacion@dominio.com>").
 *
 * nodemailer se carga SOLO si hay SMTP configurado. Un error al enviar el
 * correo se registra en el comprobante (correo_estado = 'error') pero NUNCA
 * cambia su estado tributario: una factura autorizada sigue autorizada.
 */
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

const configurado = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);

let transporte = null;
function obtenerTransporte() {
    if (transporte) return transporte;
    // eslint-disable-next-line global-require
    const nodemailer = require('nodemailer');
    const puerto = Number(process.env.SMTP_PORT) || 587;
    transporte = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: puerto,
        secure: puerto === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        // Sin acceso a archivos ni URL al armar el mensaje (adjuntos solo en memoria).
        disableFileAccess: true,
        disableUrlAccess: true,
    });
    return transporte;
}

/** Lista de correos válidos (máx. 5) a partir de un texto "a@x.com, b@y.com". */
function destinatarios(texto) {
    return [...new Set(String(texto || '').split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(s => EMAIL_RE.test(s) && s.length <= 254))].slice(0, 5);
}

/**
 * @returns {Promise<{enviado:boolean, motivo?:string, para?:string[]}>}
 */
async function enviarComprobante({ para, asunto, texto, adjuntos }) {
    if (!configurado()) return { enviado: false, motivo: 'El correo no está configurado en el servidor (SMTP_HOST / SMTP_FROM).' };
    const lista = destinatarios(para);
    if (!lista.length) return { enviado: false, motivo: 'El cliente no tiene un correo válido.' };
    try {
        await obtenerTransporte().sendMail({
            from: process.env.SMTP_FROM,
            to: lista.join(', '),
            subject: String(asunto).replace(/[\r\n]+/g, ' ').slice(0, 200),
            text: texto,
            attachments: adjuntos.map(a => ({ filename: a.nombre, content: a.contenido, contentType: a.tipo })),
        });
        return { enviado: true, para: lista };
    } catch (err) {
        // Mensaje breve, sin credenciales (nodemailer no las incluye en err.message).
        return { enviado: false, motivo: `No se pudo enviar el correo: ${String(err.message).slice(0, 200)}` };
    }
}

module.exports = { enviarComprobante, destinatarios, configurado };
