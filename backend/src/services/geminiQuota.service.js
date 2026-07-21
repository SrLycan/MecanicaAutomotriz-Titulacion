/**
 * Control de cuota diaria para el consumo de la API gratuita de Gemini.
 *
 * Vive en memoria del proceso (se reinicia si el servidor se reinicia).
 * Es intencional: por ahora el sistema no depende de Mongo para nada
 * critico, y esto es solo un contador de seguridad. Cuando se integre
 * MongoDB para logs del chatbot, este contador puede leerse/escribirse
 * ahi mismo para que persista entre reinicios y entre instancias del
 * servidor — de momento no hace falta esa complejidad.
 */

const LIMITE_DIARIO = parseInt(process.env.GEMINI_DAILY_QUOTA, 10) || 1000;

let contador = { fecha: null, usados: 0 };

const fechaHoy = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

const resetSiCambioDeDia = () => {
    const hoy = fechaHoy();
    if (contador.fecha !== hoy) contador = { fecha: hoy, usados: 0 };
};

/** true si todavia hay margen para llamar a Gemini hoy */
const hayCuotaDisponible = () => {
    resetSiCambioDeDia();
    return contador.usados < LIMITE_DIARIO;
};

/** Se llama SOLO despues de una llamada exitosa a Gemini */
const registrarConsumo = () => {
    resetSiCambioDeDia();
    contador.usados += 1;
};

const estadoCuota = () => {
    resetSiCambioDeDia();
    return {
        usados: contador.usados,
        limite: LIMITE_DIARIO,
        disponibles: Math.max(0, LIMITE_DIARIO - contador.usados),
    };
};

module.exports = { hayCuotaDisponible, registrarConsumo, estadoCuota };
