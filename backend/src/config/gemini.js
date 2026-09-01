/**
 * SS SWAP - Configuración del Cliente de Google Gemini
 * Centraliza la creación del cliente de IA generativa usado por el chatbot,
 * con instanciación perezosa y modelo configurable por variable de entorno.
 */
const { GoogleGenAI } = require('@google/genai');

// Modelo por defecto: gemini-3.1-flash-lite es (a esta fecha) el modelo GA
// mas economico de Google, pensado justo para trafico de alto volumen y bajo
// costo como el de un chatbot de atencion al cliente, y sigue disponible en
// el plan gratuito. OJO: Google retira/reemplaza modelos con bastante
// frecuencia — si este deja de funcionar (error 404 "no longer available"),
// solo hay que cambiar GEMINI_MODEL en el .env, revisando el modelo vigente
// en https://ai.google.dev/gemini-api/docs/models — no hace falta tocar el
// codigo.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite';

let cliente = null;

/**
 * Devuelve el cliente de Gemini (singleton perezoso).
 * No se instancia al arrancar el servidor para no romper el `npm run dev`
 * si todavia no se configuro GEMINI_API_KEY en el .env; el error solo
 * aparece si de verdad se intenta usar el chatbot.
 */
const obtenerClienteGemini = () => {
    if (cliente) return cliente;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY no esta configurada en el .env');
    }

    cliente = new GoogleGenAI({ apiKey });
    return cliente;
};

module.exports = { obtenerClienteGemini, GEMINI_MODEL };