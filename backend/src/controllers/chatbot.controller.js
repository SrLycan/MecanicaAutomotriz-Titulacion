/**
 * SS SWAP - Controlador del Chatbot de Asistencia Virtual (SWAPBot)
 *
 * Expone el endpoint de consulta libre para SWAPBot, validando tamaño de
 * mensaje, consumo de cuota diaria de Gemini y delegando al servicio de IA.
 * Cada turno conversacional se persiste en MongoDB Atlas asociado a una
 * sesión, lo que permite al cliente revisar su historial y al administrador
 * auditar qué consulta la gente.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { hayCuotaDisponible, registrarConsumo, estadoCuota } = require('../services/geminiQuota.service');
const { responderConIA }                                     = require('../services/chatbot.service');
const { registrarTurno, listarConversaciones }                = require('../services/chatbotConversacion.service');

const MAX_CHARS_MENSAJE = 500;

/**
 * POST /api/chatbot/mensaje
 *
 * Publico (sin JWT): tanto visitantes como clientes logueados pueden usar
 * el fallback de IA de SWAPBot. IMPORTANTE — este endpoint solo deberia
 * llamarse cuando el arbol de opciones predefinidas del widget (precios,
 * horarios, estado de la orden) no resolvio la consulta del cliente; esas
 * opciones se resuelven en el frontend contra endpoints que ya existian
 * (/servicios, /sucursales/public, /panel/mi-actividad) y no pasan por
 * aqui, precisamente para no gastar tokens de Gemini en algo que no lo
 * necesita.
 *
 * Cada turno (mensaje del usuario + respuesta del bot) se persiste en
 * MongoDB Atlas (chatbotConversacion.service) asociado a un sesion_id que
 * el frontend genera y reutiliza mientras el visitante navega el sitio.
 * Si el visitante esta logueado como cliente, se envia su email para
 * vincular la conversacion a su cliente_id (permite mostrarla luego en su
 * panel). El guardado en Mongo es best-effort: si falla, no se rompe la
 * respuesta al usuario.
 */
// sesion_id solo puede ser un texto simple (UUID o similar). Antes se usaba tal
// cual en el filtro de MongoDB: un objeto como {"$ne": null} coincidia con la
// conversacion de OTRA persona y permitia escribir en ella (inyeccion NoSQL).
const SESION_VALIDA = /^[A-Za-z0-9-]{8,80}$/;

// El cliente se identifica por su SESION (token), nunca por un correo que
// manda el navegador: antes cualquiera podia enviar el correo de otro
// cliente y meter mensajes en el historial de su panel.
function emailDeSesion(req) {
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    if (!m) return '';
    try {
        const p = jwt.verify(m[1], process.env.JWT_SECRET);
        return p && p.rol === 'cliente' && typeof p.email === 'string' ? p.email : '';
    } catch (_) { return ''; }
}

const responderMensaje = async (req, res) => {
    const mensaje       = (typeof req.body?.mensaje === 'string' ? req.body.mensaje : '').trim();
    const sesionId       = typeof req.body?.sesion_id === 'string' && SESION_VALIDA.test(req.body.sesion_id)
        ? req.body.sesion_id : crypto.randomUUID();
    const emailCliente   = emailDeSesion(req);

    if (!mensaje) {
        return res.status(400).json({ error: 'El mensaje no puede estar vacio.' });
    }
    if (mensaje.length > MAX_CHARS_MENSAJE) {
        return res.status(400).json({ error: `El mensaje es muy largo (maximo ${MAX_CHARS_MENSAJE} caracteres).` });
    }

    if (!(await hayCuotaDisponible())) {
        return res.status(429).json({
            error: 'SWAPBot alcanzo su limite de consultas con IA por hoy. Intenta de nuevo mañana o contacta directamente al taller.',
            agotado: true,
            sesion_id: sesionId,
        });
    }

    const historial = Array.isArray(req.body?.historial) ? req.body.historial : [];

    try {
        const respuesta = await responderConIA(mensaje, historial);
        await registrarConsumo();

        // Resolver cliente_id/nombre si el visitante esta logueado (best-effort, no bloquea la respuesta)
        let clienteId = null;
        let clienteNombre = null;
        if (emailCliente) {
            try {
                const { rows } = await pool.query('SELECT id, nombre FROM clientes WHERE LOWER(email) = LOWER($1) ORDER BY id LIMIT 1', [emailCliente]);
                clienteId = rows[0]?.id ?? null;
                clienteNombre = rows[0]?.nombre ?? null;
            } catch (_) { /* no critico para responder el chat */ }
        }

        registrarTurno({
            sesionId,
            clienteId,
            clienteNombre,
            canal: emailCliente ? 'panel_cliente' : 'publico',
            ip: req.ip,
            mensajeUsuario: mensaje,
            mensajeBot: respuesta,
        }); // fire-and-forget: no se espera ni rompe la respuesta si Mongo falla

        return res.json({ respuesta, cuota: await estadoCuota(), sesion_id: sesionId });
    } catch (err) {
        console.error('Error en responderMensaje (Gemini):', err.message);
        return res.status(502).json({
            error: 'SWAPBot no pudo conectarse con el servicio de IA. Intenta de nuevo en un momento.',
            sesion_id: sesionId,
        });
    }
};

/**
 * GET /api/chatbot/conversaciones
 * Solo administrador. Listado paginado de todas las conversaciones
 * guardadas en MongoDB Atlas, para revisar que esta preguntando la gente
 * y donde el chatbot no esta resolviendo bien.
 */
const listarConversacionesAdmin = async (req, res) => {
    const pagina    = parseInt(req.query.pagina, 10) || 1;
    const porPagina = Math.min(parseInt(req.query.porPagina, 10) || 20, 100);
    const resultado = await listarConversaciones({ pagina, porPagina });
    return res.json(resultado);
};

module.exports = { responderMensaje, listarConversacionesAdmin };
