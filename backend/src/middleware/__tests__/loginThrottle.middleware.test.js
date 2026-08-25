/**
 * SS SWAP - Pruebas Unitarias del Throttle de Login (loginThrottle.middleware)
 * Verifica las dos capas anti fuerza bruta: bloqueo por cuenta (5 fallos ->
 * 5 minutos) y limite general por IP (20 intentos por ventana).
 *
 * Por que este archivo y no otro: la logica es 100% en memoria (sin
 * Postgres, sin Mongo, sin red), asi que se puede probar de verdad sin
 * mockear nada de infraestructura — es el caso ideal para una prueba
 * UNITARIA (a diferencia de un controller como auth.controller.js, que
 * habla con la base de datos y necesitaria mocks o una prueba de
 * integracion, no unitaria).
 *
 * Dos detalles tecnicos importantes para entender el beforeEach:
 *
 *   - jest.resetModules() + require() de nuevo en cada test: el middleware
 *     guarda su estado en dos Map() a nivel de modulo (porCuenta / porIp)
 *     que persisten mientras el proceso viva. Sin resetear el modulo entre
 *     pruebas, los contadores de una prueba se mezclarian con los de la
 *     siguiente y los resultados serian impredecibles.
 *
 *   - jest.useFakeTimers(): el desbloqueo depende de Date.now(); con el
 *     reloj falso podemos "avanzar el tiempo" y probar que el bloqueo se
 *     libera exactamente cuando debe, sin esperar 5 minutos reales.
 */

// ── Helper: peticion/respuesta falsas ───────────────────────────────────────
// Arma un req/res minimos, como los que espera un middleware de Express:
// capturamos statusCode/body en lugar de un res real, y next como espia
// para afirmar si la peticion siguio o fue cortada por el throttle.
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

// Atajo: corre verificarBloqueo con mocks y devuelve los mismos mocks,
// para que cada test pueda afirmar sobre statusCode/next sin repetir codigo.
function llamarVerificarBloqueo(throttle, email, ip) {
    const r = mockReqRes(email, ip);
    throttle.verificarBloqueo(r.req, r.res, r.next);
    return r;
}

// ── Capa 1: bloqueo por cuenta (email) ──────────────────────────────────────
describe('loginThrottle — bloqueo por cuenta (5 intentos -> 5 minutos)', () => {
    let throttle;

    beforeEach(() => {
        // Estado fresco + reloj controlado en CADA prueba (ver header).
        jest.resetModules();
        jest.useFakeTimers();
        throttle = require('../loginThrottle.middleware');
    });

    afterEach(() => {
        // Devuelve el reloj real para no afectar otras suites.
        jest.useRealTimers();
    });

    test('deja pasar mientras no se supere el limite de intentos', () => {
        const email = 'cliente1@test.com';

        // 4 fallos seguidos: bajo el umbral de 5, todos los requests pasan.
        for (let i = 0; i < 4; i++) {
            const { req, res, next } = mockReqRes(email);
            throttle.verificarBloqueo(req, res, next);
            expect(next).toHaveBeenCalledTimes(1);
            throttle.registrarIntento(email, false); // 4 fallos, todavia no bloquea
        }

        // El quinto request TAMBIEN pasa: se bloquea a partir del siguiente.
        const { req, res, next } = mockReqRes(email);
        throttle.verificarBloqueo(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBeNull();
    });

    test('al quinto intento fallido, el sexto request queda bloqueado con 429', () => {
        const email = 'cliente2@test.com';

        // Se alcanza el umbral exacto de fallos (5) para esta cuenta...
        for (let i = 0; i < 5; i++) {
            throttle.registrarIntento(email, false);
        }

        // ...y el request siguiente es rechazado con 429 ANTES de llegar al
        // controller (next nunca se llama: ni bcrypt ni consulta a la BD).
        const { req, res, next } = llamarVerificarBloqueo(throttle, email);
        expect(res.statusCode).toBe(429);
        expect(res.body.error).toMatch(/demasiados intentos fallidos/i);
        expect(next).not.toHaveBeenCalled();
    });

    test('un login exitoso limpia el contador (no arrastra fallos previos)', () => {
        const email = 'cliente3@test.com';

        // El usuario se equivoca 3 veces y luego acierta: el contador se
        // resetea por completo, como si no hubiera fallado nunca.
        throttle.registrarIntento(email, false);
        throttle.registrarIntento(email, false);
        throttle.registrarIntento(email, false);
        throttle.registrarIntento(email, true); // exito: se resetea

        // 4 fallos mas despues del reset no deberian bloquear (van 4, no 5).
        for (let i = 0; i < 4; i++) throttle.registrarIntento(email, false);

        const { req, res, next } = mockReqRes(email);
        throttle.verificarBloqueo(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBeNull();
    });

    test('el bloqueo se libera solo despues de 5 minutos', () => {
        const email = 'cliente4@test.com';
        for (let i = 0; i < 5; i++) throttle.registrarIntento(email, false);

        // Justo despues de bloquear: sigue bloqueado.
        let r = llamarVerificarBloqueo(throttle, email);
        expect(r.res.statusCode).toBe(429);

        // Avanzamos el reloj 4:59 -> todavia deberia estar bloqueado
        // (un segundo antes de cumplir el castigo, el bloqueo sigue vigente).
        jest.advanceTimersByTime(4 * 60 * 1000 + 59 * 1000);
        r = llamarVerificarBloqueo(throttle, email);
        expect(r.res.statusCode).toBe(429);

        // Avanzamos 2 segundos mas (total > 5:00) -> ya deberia dejar pasar:
        // el castigo expiro y la cuenta vuelve a estar disponible.
        jest.advanceTimersByTime(2000);
        r = llamarVerificarBloqueo(throttle, email);
        expect(r.next).toHaveBeenCalledTimes(1);
        expect(r.res.statusCode).toBeNull();
    });

    test('el email se normaliza (mayusculas/espacios no crean cuentas distintas)', () => {
        // Los 5 fallos se registran con el email "sucio" (espacios y
        // mayusculas): si el middleware NO normalizara, un atacante podria
        // saltarse el bloqueo variando el formato del mismo correo.
        for (let i = 0; i < 5; i++) throttle.registrarIntento('  Cliente5@Test.com  ', false);

        // Mismo email ya limpio: debe reconocerlo como la misma cuenta bloqueada.
        const { req, res } = mockReqRes('cliente5@test.com');
        throttle.verificarBloqueo(req, res, jest.fn());
        expect(res.statusCode).toBe(429);
    });
});

// ── Capa 2: limite general por IP ───────────────────────────────────────────
describe('loginThrottle — limite general por IP', () => {
    let throttle;

    beforeEach(() => {
        // Estado fresco del modulo en cada prueba (ver header).
        // Aqui no hacen falta fake timers: esta capa solo cuenta intentos
        // dentro de la ventana, ningun test necesita avanzar el reloj.
        jest.resetModules();
        throttle = require('../loginThrottle.middleware');
    });

    test('permite hasta el limite y bloquea a partir de ahi, sin importar el email', () => {
        // Un atacante prueba muchas cuentas distintas desde la MISMA IP:
        // ninguna cuenta individual llega a sus 5 fallos, pero el tope
        // agregado por IP (20) corta el ataque de diccionario igualmente.
        const ip = '200.1.2.3';
        for (let i = 0; i < 20; i++) {
            throttle.registrarIntentoIp({ ip });
        }

        // El request 21 viene con un email NUEVO (nunca visto), y aun asi
        // recibe 429: el limite es por origen, no por cuenta.
        const { req, res, next } = mockReqRes(`usuario-${Date.now()}@test.com`, ip);
        throttle.verificarBloqueo(req, res, next);
        expect(res.statusCode).toBe(429);
        expect(next).not.toHaveBeenCalled();
    });
});
