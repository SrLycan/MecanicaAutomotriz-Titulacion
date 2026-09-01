/**
 * SS SWAP - Pruebas Unitarias del Throttle de SWAPBot (chatbotThrottle.middleware)
 * Verifica el limite por IP del fallback de IA: 8 mensajes cada 5 minutos,
 * para que una sola persona escribiendo rapido no le consuma a todo el
 * resto de clientes la cuota diaria gratuita de Gemini.
 *
 * Mismo enfoque que loginThrottle.middleware.test.js: la logica es 100% en
 * memoria (un Map a nivel de modulo), asi que es una prueba unitaria pura,
 * sin mocks de infraestructura. Por eso cada prueba resetea el modulo con
 * jest.resetModules() + require(): los contadores de una prueba no deben
 * mezclarse con los de la siguiente.
 */

// ── Helper: peticion/respuesta falsas ───────────────────────────────────────
// Arma un req/res minimos como los que espera un middleware de Express.
// La IP va en req.ip (el middleware tambien acepta remoteAddress como plan B).
function mockReqRes(ip = '127.0.0.1') {
    const req = { ip };
    const res = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
    const next = jest.fn();
    return { req, res, next };
}

describe('chatbotThrottle — limite por IP para el fallback de IA', () => {
    let throttle;

    beforeEach(() => {
        // Estado fresco del modulo en cada prueba (los Map viven mientras
        // el proceso viva; sin el reset se arrastrarian los contadores).
        // El reloj falso permite probar la expiracion de la ventana sin
        // esperar 5 minutos reales.
        jest.resetModules();
        jest.useFakeTimers();
        throttle = require('../chatbotThrottle.middleware');
    });

    afterEach(() => {
        // Devuelve el reloj real para no afectar otras suites.
        jest.useRealTimers();
    });

    test('deja pasar hasta 8 mensajes y bloquea el noveno con 429', () => {
        // Los primeros 8 mensajes dentro de la ventana pasan sin problema:
        // next() se llama y no se establece ningun codigo de error.
        for (let i = 0; i < 8; i++) {
            const { req, res, next } = mockReqRes();
            throttle.limitarPorIp(req, res, next);
            expect(next).toHaveBeenCalledTimes(1);
            expect(res.statusCode).toBeNull();
        }

        // El mensaje 9 supera el tope: se rechaza con 429 ANTES de llegar
        // al controller, es decir, sin gastar cuota de Gemini.
        const { req, res, next } = mockReqRes();
        throttle.limitarPorIp(req, res, next);
        expect(res.statusCode).toBe(429);
        expect(res.body.error).toMatch(/demasiadas consultas/i);
        expect(next).not.toHaveBeenCalled();
    });

    test('la ventana se reinicia despues de 5 minutos y vuelve a permitir mensajes', () => {
        const ip = '190.20.30.40';

        // Se agota el tope completo de la ventana actual.
        for (let i = 0; i < 8; i++) throttle.limitarPorIp(mockReqRes(ip).req, mockReqRes(ip).res, jest.fn());

        // Con el tope agotado, el siguiente mensaje esta bloqueado...
        let r = mockReqRes(ip);
        throttle.limitarPorIp(r.req, r.res, r.next);
        expect(r.res.statusCode).toBe(429);

        // ...pero avanzando el reloj mas alla de la ventana (5 min + 1 seg),
        // el registro viejo expira y la IP arranca con el contador en cero.
        jest.advanceTimersByTime(5 * 60 * 1000 + 1000);
        r = mockReqRes(ip);
        throttle.limitarPorIp(r.req, r.res, r.next);
        expect(r.next).toHaveBeenCalledTimes(1);
        expect(r.res.statusCode).toBeNull();
    });

    test('cada IP tiene su propio contador (no se bloquean entre si)', () => {
        const atacante = '10.0.0.666';
        const clienteNormal = '201.111.222.333';

        // Una IP agota su tope por completo...
        for (let i = 0; i < 8; i++) throttle.limitarPorIp(mockReqRes(atacante).req, mockReqRes(atacante).res, jest.fn());
        let r = mockReqRes(atacante);
        throttle.limitarPorIp(r.req, r.res, r.next);
        expect(r.res.statusCode).toBe(429);

        // ...y eso NO afecta a otra IP distinta: sigue chateando normal.
        r = mockReqRes(clienteNormal);
        throttle.limitarPorIp(r.req, r.res, r.next);
        expect(r.next).toHaveBeenCalledTimes(1);
        expect(r.res.statusCode).toBeNull();
    });

    test('una IP sin header identificable cae en "desconocida" y no rompe nada', () => {
        // req sin ip y sin connection.remoteAddress: el middleware usa el
        // valor por defecto 'desconocida' en vez de lanzar una excepcion.
        const req = {};
        const res = mockReqRes().res;
        const next = jest.fn();

        expect(() => throttle.limitarPorIp(req, res, next)).not.toThrow();
        expect(next).toHaveBeenCalledTimes(1);
    });
});
