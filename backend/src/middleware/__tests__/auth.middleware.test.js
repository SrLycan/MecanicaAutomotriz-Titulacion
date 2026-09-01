/**
 * SS SWAP - Pruebas Unitarias del Middleware de Autenticación (auth.middleware)
 * Verifica las tres piezas del control de acceso:
 *
 *   - verificarToken: valida el Bearer token y adjunta req.usuario.
 *   - verificarRol:   restringe la ruta a los roles indicados.
 *   - soloStaff:      atajo que agrupa a todo el personal interno.
 *
 * Es unitario porque todo se resuelve en memoria: los tokens se firman
 * AQUI con jsonwebtoken usando un secreto de prueba (no hace falta ni BD
 * ni red), y req/res son mocks al estilo Express, igual que en
 * loginThrottle/chatbotThrottle. El reloj falso permite probar la
 * expiracion del token sin esperar a que expire de verdad.
 */

const jwt = require('jsonwebtoken');

// Secreto de prueba: debe coincidir entre firma y verificacion, tal como
// JWT_SECRET lo hace entre auth.controller.js y auth.middleware.js en real.
const SECRETO = 'secreto-de-prueba-para-tests';

// Usuario tipico como lo emite el login del backend (payload del JWT).
const USUARIO_BASE = { id: 7, nombre: 'Ana Perez', email: 'ana@test.com', rol: 'cliente' };

beforeAll(() => {
    // El middleware lee process.env.JWT_SECRET en cada verificacion.
    process.env.JWT_SECRET = SECRETO;
});

// ── Helper: peticion/respuesta falsas ───────────────────────────────────────
function mockReqRes(headers = {}) {
    const req = { headers };
    const res = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
    };
    const next = jest.fn();
    return { req, res, next };
}

// ── Capa 1: verificarToken ──────────────────────────────────────────────────
describe('verificarToken — validación del Bearer token', () => {
    let verificarToken;

    beforeEach(() => {
        jest.useFakeTimers(); // controla Date.now() para el caso "expirado"
        jest.resetModules();
        verificarToken = require('../auth.middleware').verificarToken;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('sin header Authorization responde 401 y no llama next', () => {
        const { req, res, next } = mockReqRes();

        verificarToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/token de acceso requerido/i);
        expect(next).not.toHaveBeenCalled();
    });

    test('un header que no empieza con "Bearer " tambien responde 401', () => {
        // Formato incorrecto (falta el prefijo): se corta antes de intentar
        // decodificar nada, sin importar lo que traiga el resto del header.
        const { req, res, next } = mockReqRes({ authorization: 'TokenCualquiera' });

        verificarToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('un token firmado con otro secreto responde 401 "invalido"', () => {
        // Simula un token falsificado o firmado por otro sistema: la firma
        // no coincide con JWT_SECRET, asi que jwt.verify() lo rechaza.
        const tokenAjeno = jwt.sign(USUARIO_BASE, 'otro-secreto-distinto');
        const { req, res, next } = mockReqRes({ authorization: `Bearer ${tokenAjeno}` });

        verificarToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/invalido/i);
        expect(next).not.toHaveBeenCalled();
    });

    test('un token expirado responde 401 pidiendo iniciar sesion de nuevo', () => {
        // Token VALIDO al momento de firmarse; avanzamos el reloj 3 horas
        // (mas alla del tiempo de vida tipico) para forzar la expiracion.
        const token = jwt.sign(USUARIO_BASE, SECRETO, { expiresIn: '1h' });
        jest.advanceTimersByTime(3 * 60 * 60 * 1000);

        const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });

        verificarToken(req, res, next);

        expect(res.statusCode).toBe(401);
        // Mensaje distinto al de token invalido: el frontend lo usa para
        // distinguir "sesion expirada" de "token manipulado".
        expect(res.body.error).toMatch(/expirado/i);
        expect(next).not.toHaveBeenCalled();
    });

    test('un token valido deja pasar y adjunta req.usuario con sus datos', () => {
        const token = jwt.sign(USUARIO_BASE, SECRETO, { expiresIn: '1h' });
        const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });

        verificarToken(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBeNull();
        // El payload viaja intacto: los controllers confian en estos campos.
        expect(req.usuario).toMatchObject({
            id: USUARIO_BASE.id,
            email: USUARIO_BASE.email,
            rol: USUARIO_BASE.rol,
        });
    });
});

// ── Capa 2: verificarRol ────────────────────────────────────────────────────
describe('verificarRol — restricción por roles', () => {
    let verificarRol;

    beforeEach(() => {
        jest.resetModules();
        verificarRol = require('../auth.middleware').verificarRol;
    });

    test('sin usuario previo (ruta sin verificarToken) responde 401', () => {
        // Orden correcto de middlewares garantiza req.usuario; si alguien
        // usa verificarRol solo, se defiende igual con un 401 claro.
        const { req, res, next } = mockReqRes();

        verificarRol('administrador')(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/no autenticado/i);
        expect(next).not.toHaveBeenCalled();
    });

    test('un rol fuera de la lista responde 403 mencionando los roles permitidos', () => {
        const { req, res, next } = mockReqRes();
        req.usuario = { ...USUARIO_BASE, rol: 'cliente' };

        verificarRol('administrador', 'tecnico')(req, res, next);

        expect(res.statusCode).toBe(403);
        // El mensaje incluye la lista completa: util para depurar permisos.
        expect(res.body.error).toContain('administrador');
        expect(res.body.error).toContain('tecnico');
        expect(next).not.toHaveBeenCalled();
    });

    test('un rol dentro de la lista deja pasar', () => {
        const { req, res, next } = mockReqRes();
        req.usuario = { id: 2, rol: 'tecnico' };

        verificarRol('administrador', 'tecnico')(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBeNull();
    });
});

// ── Capa 3: soloStaff ───────────────────────────────────────────────────────
describe('soloStaff — personal interno del taller', () => {
    let auth;

    beforeEach(() => {
        jest.resetModules();
        auth = require('../auth.middleware');
    });

    test('los clientes NO pasan (excluidos explicitamente)', () => {
        const { req, res, next } = mockReqRes();
        req.usuario = { id: 7, rol: 'cliente' };

        auth.soloStaff(req, res, next);

        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });

    test.each(['administrador', 'tecnico', 'recepcionista'])(
        'el rol "%s" pasa por ser staff',
        (rol) => {
            const { req, res, next } = mockReqRes();
            req.usuario = { id: 2, rol };

            auth.soloStaff(req, res, next);

            expect(next).toHaveBeenCalledTimes(1);
            expect(res.statusCode).toBeNull();
        }
    );
});
