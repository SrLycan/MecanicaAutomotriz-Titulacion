/**
 * Proteccion anti fuerza bruta para POST /auth/login.
 *
 * Dos capas, ambas en memoria (mismo enfoque que chatbotThrottle.middleware.js
 * y geminiQuota.service.js — a la escala de un solo taller esto sobra; si el
 * trafico creciera mucho, esto se moveria a Redis o similar):
 *
 *   1. Por cuenta (email): 5 intentos fallidos seguidos -> bloqueada 5 minutos.
 *      Protege una cuenta puntual de que le adivinen la contrasena.
 *   2. Por IP: tope mas amplio de intentos en la misma ventana, para frenar a
 *      quien prueba muchas cuentas distintas desde el mismo origen.
 *
 * verificarBloqueo corre ANTES del controlador (corta temprano, sin gastar
 * bcrypt ni consulta a la BD). registrarIntento/registrarIntentoIp los llama
 * el controlador para actualizar los contadores segun el resultado real.
 */

const MAX_INTENTOS_CUENTA = 5;
const BLOQUEO_CUENTA_MS   = 5 * 60 * 1000;  // 5 minutos

const VENTANA_IP_MS    = 5 * 60 * 1000;     // 5 minutos
const MAX_INTENTOS_IP  = 20;                // intentos totales por IP en la ventana

const porCuenta = new Map(); // emailNormalizado -> { intentos, bloqueadoHasta }
const porIp     = new Map(); // ip -> { inicio, conteo }

const normalizarEmail = (email) => String(email || '').toLowerCase().trim();
const obtenerIp       = (req) => req.ip || req.connection?.remoteAddress || 'desconocida';

const verificarBloqueo = (req, res, next) => {
    const ahora = Date.now();
    const ip = obtenerIp(req);

    const regIp = porIp.get(ip);
    if (regIp && ahora - regIp.inicio <= VENTANA_IP_MS && regIp.conteo >= MAX_INTENTOS_IP) {
        return res.status(429).json({ error: 'Demasiados intentos de inicio de sesion. Espera unos minutos antes de volver a intentar.' });
    }

    const email = normalizarEmail(req.body?.email);
    if (email) {
        const cuenta = porCuenta.get(email);
        if (cuenta?.bloqueadoHasta && ahora < cuenta.bloqueadoHasta) {
            const minutos = Math.max(1, Math.ceil((cuenta.bloqueadoHasta - ahora) / 60000));
            return res.status(429).json({
                error: `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`,
            });
        }
    }

    next();
};

// El controlador llama esto tras verificar credenciales (exitoso = true/false).
const registrarIntento = (email, exitoso) => {
    const emailNorm = normalizarEmail(email);
    if (!emailNorm) return;

    if (exitoso) {
        porCuenta.delete(emailNorm);
        return;
    }

    const actual = porCuenta.get(emailNorm) || { intentos: 0, bloqueadoHasta: null };
    actual.intentos += 1;

    if (actual.intentos >= MAX_INTENTOS_CUENTA) {
        actual.bloqueadoHasta = Date.now() + BLOQUEO_CUENTA_MS;
        actual.intentos = 0; // el bloqueo activo ya protege la cuenta; se reinicia el conteo
    }

    porCuenta.set(emailNorm, actual);
};

// El controlador llama esto una vez por request (exito o fallo), para el limite por IP.
const registrarIntentoIp = (req) => {
    const ip = obtenerIp(req);
    const ahora = Date.now();
    const reg = porIp.get(ip);

    if (!reg || ahora - reg.inicio > VENTANA_IP_MS) {
        porIp.set(ip, { inicio: ahora, conteo: 1 });
    } else {
        reg.conteo += 1;
    }
};

module.exports = { verificarBloqueo, registrarIntento, registrarIntentoIp };
