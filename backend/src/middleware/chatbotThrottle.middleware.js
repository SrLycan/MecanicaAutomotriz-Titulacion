/**
 * Limite simple por IP para el fallback de IA de SWAPBot.
 *
 * No sustituye el limite diario global (ver geminiQuota.service.js): es una
 * segunda capa para que una sola persona escribiendo muy rapido no le
 * consuma a todo el resto de clientes la cuota gratuita del dia.
 *
 * Implementacion en memoria — a la escala de un solo taller esto sobra;
 * si el trafico creciera mucho, esto se moveria a Redis o similar.
 */

const VENTANA_MS = 5 * 60 * 1000; // 5 minutos
const MAX_POR_IP = 8;             // mensajes de IA permitidos por IP en la ventana

const registros = new Map(); // ip -> { inicio, conteo }

const limitarPorIp = (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress || 'desconocida';
    const ahora = Date.now();
    const registro = registros.get(ip);

    if (!registro || ahora - registro.inicio > VENTANA_MS) {
        registros.set(ip, { inicio: ahora, conteo: 1 });
        return next();
    }

    if (registro.conteo >= MAX_POR_IP) {
        return res.status(429).json({
            error: 'Demasiadas consultas seguidas. Espera unos minutos antes de volver a preguntarle a SWAPBot.',
        });
    }

    registro.conteo += 1;
    return next();
};

module.exports = { limitarPorIp };
