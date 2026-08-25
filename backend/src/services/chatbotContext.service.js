/**
 * SS SWAP - Servicio de Contexto Dinámico para Chatbot (Grounding)
 * Extrae y formatea en tiempo real servicios, tarifas y sucursales vigentes
 * desde PostgreSQL para inyectarlos en el prompt del modelo de IA.
 */
const pool = require('../config/db');

// 15 minutos: suficiente para que precios/horarios se sientan "al dia" sin
// golpear la base de datos en cada mensaje del chatbot. Ademas mantiene el
// system prompt corto y estable, lo que ahorra tokens de entrada en cada
// llamada a Gemini.
const TTL_MS = 15 * 60 * 1000;

let cache = { texto: null, expira: 0 };

/**
 * Arma un bloque de texto compacto con los servicios activos y las
 * sucursales del taller, para "aterrizar" (grounding) las respuestas de
 * SWAPBot en datos reales en vez de dejar que el modelo invente precios
 * o direcciones.
 */
const obtenerContextoTaller = async () => {
    if (cache.texto && Date.now() < cache.expira) return cache.texto;

    const [{ rows: servicios }, { rows: sucursales }] = await Promise.all([
        pool.query(
            `SELECT nombre, precio_base, duracion_estimada_min
             FROM tipos_servicio
             WHERE activo = TRUE
             ORDER BY nombre ASC
             LIMIT 15`
        ),
        pool.query(
            `SELECT nombre, direccion, ciudad, telefono, horario
             FROM sucursales
             WHERE activa = TRUE
             ORDER BY es_principal DESC
             LIMIT 5`
        ),
    ]);

    const lineasServicios = servicios.map(s => {
        const precio   = `$${Number(s.precio_base).toFixed(2)}`;
        const duracion = s.duracion_estimada_min ? ` (~${s.duracion_estimada_min} min)` : '';
        return `- ${s.nombre}: ${precio}${duracion}`;
    }).join('\n') || 'Por el momento no hay servicios registrados.';

    const lineasSucursales = sucursales.map(s => {
        const direccion = s.direccion ? `${s.direccion}${s.ciudad ? ', ' + s.ciudad : ''}` : 'direccion no registrada';
        const telefono  = s.telefono || 'no registrado';
        const horario   = s.horario || 'no registrado';
        return `- ${s.nombre}: ${direccion}. Telefono: ${telefono}. Horario: ${horario}`;
    }).join('\n') || 'Por el momento no hay sucursales registradas.';

    cache = {
        texto: `SERVICIOS Y PRECIOS ACTUALES:\n${lineasServicios}\n\nSUCURSALES:\n${lineasSucursales}`,
        expira: Date.now() + TTL_MS,
    };

    return cache.texto;
};

module.exports = { obtenerContextoTaller };
