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
const responderMensaje = async (req, res) => {
    const mensaje       = (req.body?.mensaje || '').toString().trim();
    const sesionId       = req.body?.sesion_id || crypto.randomUUID();
    const emailCliente   = (req.body?.email || '').toString().trim();

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
                const { rows } = await pool.query('SELECT id, nombre FROM clientes WHERE email = $1 LIMIT 1', [emailCliente]);
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
