/**
 * SS SWAP - Servicio de Generación de Respuestas con Inteligencia Artificial
 * Integra Google Gemini para responder consultas libres sobre el taller automotriz,
 * utilizando grounding con información viva del negocio y configuración optimizada.
 */
const { obtenerClienteGemini, GEMINI_MODEL } = require('../config/gemini');
const { obtenerContextoTaller }              = require('./chatbotContext.service');

// Cuantos turnos previos de la conversacion se reenvian a Gemini. Se
// mantiene bajo a proposito: el arbol de opciones predefinidas ya resuelve
// la mayoria de consultas sin IA, asi que cuando se llega hasta aqui basta
// con un poco de contexto reciente — no hace falta la sesion completa.
const MAX_HISTORIAL   = 6;
const MAX_CHARS_TEXTO = 500;

const INSTRUCCION_BASE = `Eres SWAPBot, el asistente virtual del taller automotriz SSWAP en Quito, Ecuador.

Reglas que debes seguir siempre:
- Responde en espanol, de forma breve (maximo 3-4 frases) y amable.
- Solo hablas de temas relacionados al taller: servicios, precios, horarios, citas, vehiculos y repuestos.
- Si preguntan algo fuera de ese tema, redirige amablemente hacia como puedes ayudar dentro del taller.
- Usa los datos de "Informacion actual del taller" como fuente principal de precios, servicios y sucursales. Si no tienes el dato exacto que piden, dilo con honestidad y sugiere contactar al taller directamente, sin inventar cifras.
- No des diagnosticos tecnicos definitivos de fallas mecanicas por chat; para eso invita a agendar una revision en el taller.
- Si el cliente quiere agendar, reagendar o pregunta por disponibilidad de horarios, dile que use el boton "Agendar una cita" de este mismo chat para elegir el servicio, la fecha y la hora; menciona el telefono del taller solo como alternativa secundaria, no como primera opcion.

Informacion actual del taller:
`;

/**
 * Convierte el historial recibido del frontend (formato simple
 * {rol, texto}) al formato "contents" que espera la API de Gemini.
 */
const construirContents = (historial, mensaje) => {
    const recientes = (historial || []).slice(-MAX_HISTORIAL);

    const contents = recientes
        .filter(h => h && typeof h.texto === 'string' && h.texto.trim())
        .map(h => ({
            role: h.rol === 'bot' ? 'model' : 'user',
            parts: [{ text: h.texto.trim().slice(0, MAX_CHARS_TEXTO) }],
        }));

    contents.push({ role: 'user', parts: [{ text: mensaje }] });
    return contents;
};

/**
 * Genera la respuesta de SWAPBot para un mensaje de texto libre.
 * Se asume que el llamador (controller) ya verifico la cuota diaria.
 */
const responderConIA = async (mensaje, historial) => {
    const [contexto, ai] = [await obtenerContextoTaller(), obtenerClienteGemini()];

    const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: construirContents(historial, mensaje),
        config: {
            systemInstruction: INSTRUCCION_BASE + contexto,
            temperature: 0.4,
            maxOutputTokens: 400,
            // Los modelos Gemini 3.x "piensan" internamente antes de responder,
            // y ese pensamiento consume del MISMO limite de maxOutputTokens.
            // Para un chatbot de respuestas cortas y ya "aterrizadas" en datos
            // reales no hace falta ese razonamiento extra: lo apagamos para que
            // todo el presupuesto de tokens vaya a la respuesta visible (y de
            // paso, para ahorrar aun mas tokens/costo).
            thinkingConfig: { thinkingLevel: 'MINIMAL' },
        },
    });

    const texto = (response.text || '').trim();
    return texto || 'No pude generar una respuesta en este momento. ¿Puedes reformular tu pregunta?';
};

module.exports = { responderConIA };