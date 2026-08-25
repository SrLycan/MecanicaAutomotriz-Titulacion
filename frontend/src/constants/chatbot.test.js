/**
 * SS SWAP - Pruebas de las Constantes de SWAPBot (constants/chatbot)
 * Verifica los datos puros del menú del asistente virtual: opciones únicas,
 * saludos personalizados y límites coherentes. La lógica de qué hace cada
 * opción vive en SwapBot.jsx; aqui solo se garantiza que los DATOS estén sanos.
 */

import { SWAPBOT_OPCIONES, SWAPBOT_SALUDO, swapbotSaludo, SWAPBOT_MAX_CHARS } from './chatbot';

describe('constants/chatbot — menú y saludos de SWAPBot', () => {
    test('el menú tiene opciones con id unico y etiqueta legible', () => {
        expect(SWAPBOT_OPCIONES.length).toBeGreaterThan(0);

        const ids = SWAPBOT_OPCIONES.map((o) => o.id);
        expect(new Set(ids).size).toBe(ids.length); // ids repetidos romperian el switch del widget

        for (const o of SWAPBOT_OPCIONES) {
            // Jest 27 no soporta mensaje como 2do arg de expect.
            if (!o.label) throw new Error(`opcion ${o.id} sin label`);
            expect(o.label).toBeTruthy();
        }
    });

    test('"ia" es la única opción que consume cuota de Gemini', () => {
        // Contrato clave del ahorro de cuota: precios/horarios/estado/cita
        // se resuelven contra endpoints gratuitos; SOLO 'ia' llama a Gemini.
        expect(SWAPBOT_OPCIONES.some((o) => o.id === 'ia')).toBe(true);
        expect(SWAPBOT_OPCIONES.filter((o) => o.id === 'ia')).toHaveLength(1);
    });

    test('swapbotSaludo saluda por su nombre a un cliente logueado', () => {
        const saludo = swapbotSaludo('Ana');
        expect(saludo).toContain('Ana');
        // El saludo personalizado reemplaza al generico, no lo concatena.
        expect(saludo).not.toBe(SWAPBOT_SALUDO);
    });

    test('sin nombre (visitante anonimo) usa el saludo genérico', () => {
        expect(swapbotSaludo()).toBe(SWAPBOT_SALUDO);
        expect(swapbotSaludo('')).toBe(SWAPBOT_SALUDO);
    });

    test('el limite de caracteres es razonable para proteger la cuota', () => {
        // Un tope ausente o gigante dejaria mensajes enormes que gastan
        // tokens de Gemini innecesariamente; uno en cero impediria escribir.
        expect(SWAPBOT_MAX_CHARS).toBeGreaterThan(0);
        expect(SWAPBOT_MAX_CHARS).toBeLessThanOrEqual(1000);
    });
});
