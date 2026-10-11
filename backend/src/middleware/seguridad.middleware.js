/**
 * SS SWAP - Protecciones generales del servidor
 *
 * 1. protegerControladoresAsync(): Express 4 no captura los errores de los
 *    controladores async. Un error fuera del try/catch (p. ej. un campo que
 *    llega como lista en vez de texto) dejaba una promesa rechazada sin
 *    manejar y Node CERRABA el proceso: una sola peticion anonima tumbaba
 *    todo el sistema. Con esto el error va al manejador global (500) y el
 *    servidor sigue funcionando.
 * 2. cabecerasSeguridad: cabeceras HTTP que endurecen el navegador (sin
 *    dependencias nuevas; equivalente a lo basico de helmet).
 */
const Layer = require('express/lib/router/layer');

function protegerControladoresAsync() {
    if (Layer.prototype.__ssswapAsync) return;
    const original = Layer.prototype.handle_request;
    Layer.prototype.handle_request = function handle(req, res, next) {
        const fn = this.handle;
        if (fn.length > 3) return original.call(this, req, res, next);
        try {
            const r = fn(req, res, next);
            if (r && typeof r.catch === 'function') r.catch(err => next(err || new Error('Error en controlador')));
        } catch (err) {
            next(err);
        }
    };
    Layer.prototype.__ssswapAsync = true;
}

const cabecerasSeguridad = (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    // La API solo devuelve JSON/archivos: nada de lo que sirve debe ejecutar scripts.
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; frame-ancestors 'none'");
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    res.removeHeader('X-Powered-By');
    next();
};

/**
 * Limitador simple por IP en memoria (misma idea que loginThrottle).
 * Para endpoints publicos que crean datos (registro de clientes).
 */
function limitarPorIp({ ventanaMs, maximo, mensaje }) {
    const registros = new Map();
    return (req, res, next) => {
        const ahora = Date.now();
        const ip = req.ip || 'desconocida';
        let r = registros.get(ip);
        if (!r || ahora - r.inicio > ventanaMs) { r = { inicio: ahora, conteo: 0 }; registros.set(ip, r); }
        r.conteo += 1;
        if (registros.size > 10000) {
            for (const [k, v] of registros) if (ahora - v.inicio > ventanaMs) registros.delete(k);
        }
        if (r.conteo > maximo) return res.status(429).json({ error: mensaje });
        next();
    };
}

module.exports = { protegerControladoresAsync, cabecerasSeguridad, limitarPorIp };
