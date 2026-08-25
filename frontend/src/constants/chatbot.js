/**
 * SS SWAP - Constantes del Chatbot SWAPBot
 * Datos puros del menú de opciones, saludos y límites del widget.
 */
// Datos puros del menu de SWAPBot. La logica de que hace cada opcion
// (pedir datos, revisar sesion, navegar) vive en el componente; aqui solo
// van etiquetas y textos, igual que en constants/ordenes.js.

export const SWAPBOT_OPCIONES = [
    { id: 'precios',  label: 'Precios y servicios' },
    { id: 'horarios', label: 'Horarios y ubicación' },
    { id: 'estado',   label: 'Estado de mi vehículo' },
    { id: 'cita',     label: 'Agendar una cita' },
    { id: 'ia',       label: 'Otra pregunta' },
];

export const SWAPBOT_SALUDO =
    'Hola, soy SWAPBot, el asistente virtual de SSWAP. Elige una opción o escríbeme tu pregunta.';

// Cuando el visitante es un cliente logueado, se lo saluda por su nombre en
// vez del saludo generico (antes salia igual para todos, como si nunca
// reconociera que ya habia una sesion iniciada).
export const swapbotSaludo = (nombre) => nombre
    ? `Hola ${nombre}, soy SWAPBot, el asistente virtual de SSWAP. Elige una opción o escríbeme tu pregunta.`
    : SWAPBOT_SALUDO;

export const SWAPBOT_MAX_CHARS = 500;
