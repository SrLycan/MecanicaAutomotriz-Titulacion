const { hayCuotaDisponible, registrarConsumo, estadoCuota } = require('../services/geminiQuota.service');
const { responderConIA }                                     = require('../services/chatbot.service');

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
 */
const responderMensaje = async (req, res) => {
    const mensaje = (req.body?.mensaje || '').toString().trim();

    if (!mensaje) {
        return res.status(400).json({ error: 'El mensaje no puede estar vacio.' });
    }
    if (mensaje.length > MAX_CHARS_MENSAJE) {
        return res.status(400).json({ error: `El mensaje es muy largo (maximo ${MAX_CHARS_MENSAJE} caracteres).` });
    }

    if (!hayCuotaDisponible()) {
        return res.status(429).json({
            error: 'SWAPBot alcanzo su limite de consultas con IA por hoy. Intenta de nuevo mañana o contacta directamente al taller.',
            agotado: true,
        });
    }

    const historial = Array.isArray(req.body?.historial) ? req.body.historial : [];

    try {
        const respuesta = await responderConIA(mensaje, historial);
        registrarConsumo();
        return res.json({ respuesta, cuota: estadoCuota() });
    } catch (err) {
        console.error('Error en responderMensaje (Gemini):', err.message);
        return res.status(502).json({
            error: 'SWAPBot no pudo conectarse con el servicio de IA. Intenta de nuevo en un momento.',
        });
    }
};

module.exports = { responderMensaje };
