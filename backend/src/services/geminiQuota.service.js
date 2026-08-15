/**
 * Control de cuota diaria para el consumo de la API gratuita de Gemini.
 *
 * Persiste en MongoDB Atlas (coleccion chatbot_cuota_diaria) para que el
 * contador sobreviva a reinicios del servidor y se comparta entre
 * instancias si el backend llega a escalar horizontalmente.
 *
 * Si Mongo no esta disponible en un momento dado, cae a un contador en
 * memoria del proceso como red de seguridad — el chat con Gemini nunca
 * debe romperse por un problema de persistencia del contador.
 */
const { getMongoDb } = require('../config/mongo');

const LIMITE_DIARIO = parseInt(process.env.GEMINI_DAILY_QUOTA, 10) || 1000;
const CACHE_MS = 5000; // evita una consulta a Mongo por cada mensaje del chat

let memoriaFallback = { fecha: null, usados: 0 };
let cache = { fecha: null, usados: 0, expira: 0 };

const fechaHoy = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

const leerContadorHoy = async () => {
    const hoy = fechaHoy();
    if (cache.fecha === hoy && Date.now() < cache.expira) return cache.usados;

    const db = getMongoDb();
    if (!db) {
        if (memoriaFallback.fecha !== hoy) memoriaFallback = { fecha: hoy, usados: 0 };
        return memoriaFallback.usados;
    }

    try {
        const doc = await db.collection('chatbot_cuota_diaria').findOne({ _id: hoy });
        const usados = doc?.usados || 0;
        cache = { fecha: hoy, usados, expira: Date.now() + CACHE_MS };
        return usados;
    } catch (err) {
        console.error('[geminiQuota] Error leyendo cuota de Mongo, usando fallback en memoria:', err.message);
        if (memoriaFallback.fecha !== hoy) memoriaFallback = { fecha: hoy, usados: 0 };
        return memoriaFallback.usados;
    }
};

/** true si todavia hay margen para llamar a Gemini hoy */
const hayCuotaDisponible = async () => (await leerContadorHoy()) < LIMITE_DIARIO;

/** Se llama SOLO despues de una llamada exitosa a Gemini */
const registrarConsumo = async () => {
    const hoy = fechaHoy();
    const db = getMongoDb();

    if (!db) {
        if (memoriaFallback.fecha !== hoy) memoriaFallback = { fecha: hoy, usados: 0 };
        memoriaFallback.usados += 1;
        return;
    }

    try {
        await db.collection('chatbot_cuota_diaria').updateOne(
            { _id: hoy },
            { $inc: { usados: 1 }, $set: { limite: LIMITE_DIARIO, actualizado_en: new Date() } },
            { upsert: true }
        );
        cache = { fecha: null, usados: 0, expira: 0 }; // invalidar cache tras escribir
    } catch (err) {
        console.error('[geminiQuota] Error registrando consumo en Mongo:', err.message);
        if (memoriaFallback.fecha !== hoy) memoriaFallback = { fecha: hoy, usados: 0 };
        memoriaFallback.usados += 1;
    }
};

const estadoCuota = async () => {
    const usados = await leerContadorHoy();
    return { usados, limite: LIMITE_DIARIO, disponibles: Math.max(0, LIMITE_DIARIO - usados) };
};

module.exports = { hayCuotaDisponible, registrarConsumo, estadoCuota };
