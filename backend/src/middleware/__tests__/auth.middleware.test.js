/**
 * SS SWAP - Pruebas Unitarias del Middleware de Autenticación (auth.middleware)
 * Verifica las piezas del control de acceso:
 *
 *   - verificarToken: valida el Bearer token, relee la cuenta en la BD
 *                     (estado, token_version, permisos) y adjunta req.usuario.
 *   - verificarRol:   restringe la ruta a los roles indicados.
 *   - soloStaff:      atajo que agrupa a todo el personal interno.
 *   - requierePermiso / requiereAlguno / soloSuperadmin: permisos individuales.
 *
 * Los tokens se firman AQUI con un secreto de prueba y la BD se simula con
 * un mock de config/db (cada prueba decide que fila "devuelve" la cuenta),
 * asi que no hace falta PostgreSQL. El reloj falso permite probar la
 * expiracion del token sin esperar a que expire de verdad.
 */

const jwt = require('jsonwebtoken');

// BD simulada: mockFila = lo que devuelve "SELECT ... FROM usuarios WHERE id".
let mockFila = null;
const mockQuery = jest.fn(async (sql) => {
    if (/FROM usuarios u WHERE u\.id/.test(sql)) return { rows: mockFila ? [mockFila] : [] };
    return { rows: [] }; // INSERT de auditoria, etc.
});
jest.mock('../../config/db', () => ({ query: (...a) => mockQuery(...a) }));

// Secreto de prueba: debe coincidir entre firma y verificacion, tal como
// JWT_SECRET lo hace entre auth.controller.js y auth.middleware.js en real.
const SECRETO = 'secreto-de-prueba-para-tests';

// Usuario tipico como lo emite el login del backend (payload del JWT).
const USUARIO_BASE = { id: 7, nombre: 'Ana Perez', email: 'ana@test.com', rol: 'cliente' };
// Fila de la BD correspondiente (cuenta activa, sin sesiones revocadas).
const FILA_BASE = { ...USUARIO_BASE, activo: true, estado: 'activo', token_version: 0, permisos: [] };

beforeAll(() => {
    // El middleware lee process.env.JWT_SECRET en cada verificacion.
    process.env.JWT_SECRET = SECRETO;
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

beforeEach(() => {
    mockFila = { ...FILA_BASE };
    mockQuery.mockClear();
});

// ── Helper: peticion/respuesta falsas ───────────────────────────────────────
function mockReqRes(headers = {}) {
    const req = { headers, method: 'GET', originalUrl: '/api/prueba' };
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
describe('verificarToken — validación del Bearer token y de la cuenta', () => {
    let verificarToken;

    beforeEach(() => {
        jest.useFakeTimers(); // controla Date.now() para el caso "expirado"
        jest.resetModules();
        verificarToken = require('../auth.middleware').verificarToken;
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('sin header Authorization responde 401 y no llama next', async () => {
        const { req, res, next } = mockReqRes();

        await verificarToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/token de acceso requerido/i);
        expect(next).not.toHaveBeenCalled();
    });

    test('un header que no empieza con "Bearer " tambien responde 401', async () => {
        // Formato incorrecto (falta el prefijo): se corta antes de intentar
        // decodificar nada, sin importar lo que traiga el resto del header.
        const { req, res, next } = mockReqRes({ authorization: 'TokenCualquiera' });

        await verificarToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('un token firmado con otro secreto responde 401 "invalido"', async () => {
        // Simula un token falsificado o firmado por otro sistema: la firma
        // no coincide con JWT_SECRET, asi que jwt.verify() lo rechaza.
        const tokenAjeno = jwt.sign(USUARIO_BASE, 'otro-secreto-distinto');
        const { req, res, next } = mockReqRes({ authorization: `Bearer ${tokenAjeno}` });

        await verificarToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body.error).toMatch(/invalido/i);
        expect(next).not.toHaveBeenCalled();
    });

    test('un token expirado responde 401 pidiendo iniciar sesion de nuevo', async () => {
        // Token VALIDO al momento de firmarse; avanzamos el reloj 3 horas
        // (mas alla del tiempo de vida tipico) para forzar la expiracion.
        const token = jwt.sign(USUARIO_BASE, SECRETO, { expiresIn: '1h' });
        jest.advanceTimersByTime(3 * 60 * 60 * 1000);

        const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });

        await verificarToken(req, res, next);

        expect(res.statusCode).toBe(401);
        // Mensaje distinto al de token invalido: el frontend lo usa para
        // distinguir "sesion expirada" de "token manipulado".
        expect(res.body.error).toMatch(/expirado/i);
        expect(next).not.toHaveBeenCalled();
    });

    test('un token valido deja pasar y adjunta req.usuario con los datos ACTUALES de la BD', async () => {
        const token = jwt.sign(USUARIO_BASE, SECRETO, { expiresIn: '1h' });
        // El nombre cambio en la BD despues de emitir el token: manda la BD.
        mockFila = { ...FILA_BASE, nombre: 'Ana P. Actualizada' };
        const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });

        await verificarToken(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBeNull();
        expect(req.usuario).toMatchObject({
            id: USUARIO_BASE.id,
            email: USUARIO_BASE.email,
            rol: USUARIO_BASE.rol,
            nombre: 'Ana P. Actualizada',
        });
    });

    test('el rol se toma de la BD: un token que dice "superadministrador" no da acceso extra', async () => {
        // Token firmado con un rol inflado (p. ej. emitido antes de un cambio de rol).
        const token = jwt.sign({ ...USUARIO_BASE, rol: 'superadministrador' }, SECRETO, { expiresIn: '1h' });
        mockFila = { ...FILA_BASE, rol: 'interno', permisos: ['inventario_colisiones:ver'] };
        const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });

        await verificarToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.usuario.rol).toBe('interno');
        expect(req.usuario.permisos).toEqual(['inventario_colisiones:ver']);
    });

    test('una cuenta desactivada no puede seguir usando una sesion valida (401)', async () => {
        const token = jwt.sign(USUARIO_BASE, SECRETO, { expiresIn: '1h' });
        mockFila = { ...FILA_BASE, activo: false, estado: 'suspendido' };
        const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });

        await verificarToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body.codigo).toBe('CUENTA_INACTIVA');
        expect(next).not.toHaveBeenCalled();
    });

    test('si token_version cambio (sesiones revocadas) el token viejo ya no sirve', async () => {
        const token = jwt.sign({ ...USUARIO_BASE, tv: 0 }, SECRETO, { expiresIn: '1h' });
        mockFila = { ...FILA_BASE, token_version: 1 };
        const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });

        await verificarToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(res.body.codigo).toBe('SESION_REVOCADA');
        expect(next).not.toHaveBeenCalled();
    });

    test('una cuenta eliminada responde 401', async () => {
        const token = jwt.sign(USUARIO_BASE, SECRETO, { expiresIn: '1h' });
        mockFila = null;
        const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });

        await verificarToken(req, res, next);

        expect(res.statusCode).toBe(401);
        expect(next).not.toHaveBeenCalled();
    });

    test('un cliente nunca recibe permisos del panel aunque existan filas', async () => {
        const token = jwt.sign(USUARIO_BASE, SECRETO, { expiresIn: '1h' });
        mockFila = { ...FILA_BASE, rol: 'cliente', permisos: ['clientes:ver'] };
        const { req, res, next } = mockReqRes({ authorization: `Bearer ${token}` });

        await verificarToken(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.usuario.permisos).toEqual([]);
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

    test.each(['superadministrador', 'administrador', 'tecnico', 'recepcionista', 'interno'])(
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

// ── Capa 4: permisos individuales ───────────────────────────────────────────
describe('requierePermiso / requiereAlguno / soloSuperadmin', () => {
    let auth;

    beforeEach(() => {
        jest.resetModules();
        auth = require('../auth.middleware');
    });

    const conUsuario = (usuario) => { const x = mockReqRes(); x.req.usuario = usuario; return x; };

    test('el superadministrador pasa cualquier permiso sin tener filas', () => {
        const { req, res, next } = conUsuario({ id: 1, rol: 'superadministrador', permisos: [] });
        auth.requierePermiso('finanzas', 'eliminar')(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('un usuario con el permiso exacto pasa; con otra accion del mismo modulo no', () => {
        const usuario = { id: 5, rol: 'interno', permisos: ['clientes:ver'] };
        let x = conUsuario(usuario);
        auth.requierePermiso('clientes', 'ver')(x.req, x.res, x.next);
        expect(x.next).toHaveBeenCalled();

        x = conUsuario(usuario);
        auth.requierePermiso('clientes', 'eliminar')(x.req, x.res, x.next);
        expect(x.res.statusCode).toBe(403);
        expect(x.res.body.codigo).toBe('SIN_PERMISO');
        expect(x.next).not.toHaveBeenCalled();
    });

    test('un administrador comun sin la fila del permiso queda bloqueado (el rol ya no basta)', () => {
        const { req, res, next } = conUsuario({ id: 3, rol: 'administrador', permisos: ['clientes:ver'] });
        auth.requierePermiso('finanzas', 'ver')(req, res, next);
        expect(res.statusCode).toBe(403);
    });

    test('un cliente con permisos inyectados nunca pasa (solo el personal tiene permisos)', () => {
        const { req, res, next } = conUsuario({ id: 9, rol: 'cliente', permisos: ['clientes:ver'] });
        auth.requierePermiso('clientes', 'ver')(req, res, next);
        expect(res.statusCode).toBe(403);
    });

    test('requiereAlguno deja pasar con cualquiera de los permisos indicados', () => {
        const { req, res, next } = conUsuario({ id: 5, rol: 'interno', permisos: ['proformas_colisiones:crear'] });
        auth.requiereAlguno(['proformas_mecanica', 'crear'], ['proformas_colisiones', 'crear'])(req, res, next);
        expect(next).toHaveBeenCalled();
    });

    test('el acceso denegado queda en la auditoria', () => {
        const { req, res, next } = conUsuario({ id: 5, rol: 'interno', email: 'x@x.test', permisos: [] });
        auth.requierePermiso('usuarios', 'ver')(req, res, next);
        const insercion = mockQuery.mock.calls.find(([sql]) => /INSERT INTO auditoria_seguridad/.test(sql));
        expect(insercion).toBeTruthy();
        expect(insercion[1]).toContain('acceso.denegado');
        expect(insercion[1]).toContain('denegado');
    });

    test('soloSuperadmin rechaza a un administrador aunque tenga todos los permisos', () => {
        const { req, res, next } = conUsuario({ id: 3, rol: 'administrador', permisos: ['usuarios:ver', 'usuarios:editar'] });
        auth.soloSuperadmin(req, res, next);
        expect(res.statusCode).toBe(403);
        expect(next).not.toHaveBeenCalled();
    });

    test('permisoPorMetodo traduce el verbo HTTP a la accion', () => {
        const usuario = { id: 5, rol: 'interno', permisos: ['proveedores:ver'] };
        let x = conUsuario(usuario);
        auth.permisoPorMetodo('proveedores')(x.req, x.res, x.next); // GET
        expect(x.next).toHaveBeenCalled();

        x = conUsuario(usuario);
        x.req.method = 'DELETE';
        auth.permisoPorMetodo('proveedores')(x.req, x.res, x.next);
        expect(x.res.statusCode).toBe(403);
    });
});
