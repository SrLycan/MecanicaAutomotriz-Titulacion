/**
 * Pruebas unitarias de loginThrottle.middleware.js.
 *
 * Por que este archivo y no otro: la logica es 100% en memoria (sin
 * Postgres, sin Mongo, sin red), asi que se puede probar de verdad sin
 * mockear nada de infraestructura — es el caso ideal para una prueba
 * UNITARIA (a diferencia de un controller como auth.controller.js, que
 * habla con la base de datos y necesitaria mocks o una prueba de
 * integracion, no unitaria).
 *
 * jest.resetModules() + require() de nuevo en cada test: el archivo real
 * guarda su estado en dos Map() a nivel de modulo, que persisten mientras
 * el proceso viva. Sin resetear el modulo entre pruebas, los contadores de
 * una prueba se mezclarian con los de la siguiente.
 */

// Helper: arma un req/res falsos, como los que espera un middleware de Express.
function mockReqRes(email, ip = '127.0.0.1') {
    const req = { body: { email }, ip };
    const res = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
    const next = jest.fn();
    return { req, res, next };
}

describe('loginThrottle — bloqueo por cuenta (5 intentos -> 5 minutos)', () => {
    let throttle;

    beforeEach(() => {
        jest.resetModules();
        jest.useFakeTimers();
        throttle = require('../loginThrottle.middleware');
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('deja pasar mientras no se supere el limite de intentos', () => {
        const email = 'cliente1@test.com';
        for (let i = 0; i < 4; i++) {
            const { req, res, next } = mockReqRes(email);
            throttle.verificarBloqueo(req, res, next);
            expect(next).toHaveBeenCalledTimes(1);
            throttle.registrarIntento(email, false); // 4 fallos, todavia no bloquea
        }

        const { req, res, next } = mockReqRes(email);
        throttle.verificarBloqueo(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBeNull();
    });

    test('al quinto intento fallido, el sexto request queda bloqueado con 429', () => {
        const email = 'cliente2@test.com';
        for (let i = 0; i < 5; i++) {
            throttle.registrarIntento(email, false);
        }

        const { req, res, next } = throttle_call(email);
        expect(res.statusCode).toBe(429);
        expect(res.body.error).toMatch(/demasiados intentos fallidos/i);
        expect(next).not.toHaveBeenCalled();

        function throttle_call(email) {
            const r = mockReqRes(email);
            throttle.verificarBloqueo(r.req, r.res, r.next);
            return r;
        }
    });

    test('un login exitoso limpia el contador (no arrastra fallos previos)', () => {
        const email = 'cliente3@test.com';
        throttle.registrarIntento(email, false);
        throttle.registrarIntento(email, false);
        throttle.registrarIntento(email, false);
        throttle.registrarIntento(email, true); // exito: se resetea

        // 4 fallos mas despues del reset no deberian bloquear (van 4, no 5)
        for (let i = 0; i < 4; i++) throttle.registrarIntento(email, false);

        const { req, res, next } = mockReqRes(email);
        throttle.verificarBloqueo(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBeNull();
    });

    test('el bloqueo se libera solo despues de 5 minutos', () => {
        const email = 'cliente4@test.com';
        for (let i = 0; i < 5; i++) throttle.registrarIntento(email, false);

        // Justo despues de bloquear: sigue bloqueado
        let r = mockReqRes(email);
        throttle.verificarBloqueo(r.req, r.res, r.next);
        expect(r.res.statusCode).toBe(429);

        // Avanzamos el reloj 4:59 -> todavia deberia estar bloqueado
        jest.advanceTimersByTime(4 * 60 * 1000 + 59 * 1000);
        r = mockReqRes(email);
        throttle.verificarBloqueo(r.req, r.res, r.next);
        expect(r.res.statusCode).toBe(429);

        // Avanzamos 2 segundos mas (total > 5:00) -> ya deberia dejar pasar
        jest.advanceTimersByTime(2000);
        r = mockReqRes(email);
        throttle.verificarBloqueo(r.req, r.res, r.next);
        expect(r.next).toHaveBeenCalledTimes(1);
        expect(r.res.statusCode).toBeNull();
    });

    test('el email se normaliza (mayusculas/espacios no crean cuentas distintas)', () => {
        for (let i = 0; i < 5; i++) throttle.registrarIntento('  Cliente5@Test.com  ', false);

        const { req, res } = mockReqRes('cliente5@test.com'); // mismo email, sin espacios ni mayusculas
        throttle.verificarBloqueo(req, res, jest.fn());
        expect(res.statusCode).toBe(429);
    });
});

describe('loginThrottle — limite general por IP', () => {
    let throttle;

    beforeEach(() => {
        jest.resetModules();
        throttle = require('../loginThrottle.middleware');
    });

    test('permite hasta el limite y bloquea a partir de ahi, sin importar el email', () => {
        const ip = '200.1.2.3';
        for (let i = 0; i < 20; i++) {
            throttle.registrarIntentoIp({ ip });
        }

        const { req, res, next } = mockReqRes(`usuario-${Date.now()}@test.com`, ip);
        throttle.verificarBloqueo(req, res, next);
        expect(res.statusCode).toBe(429);
        expect(next).not.toHaveBeenCalled();
    });
});
