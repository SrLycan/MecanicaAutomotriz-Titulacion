/**
 * SS SWAP - Pruebas de INTEGRACION del Sprint 21 (superadministrador y
 * permisos personalizados) contra un PostgreSQL REAL y peticiones HTTP
 * reales a los routers de Express (como lo haria Postman o la consola del
 * navegador). Solo corren con PG_INTEGRATION=1:
 *
 *   PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest sprint21
 *
 * ¡NUNCA apuntar a produccion! Crea datos con prefijo "TEST21" y los borra
 * (la auditoria es de solo insercion: sus filas de prueba se quedan, como
 * cualquier registro de auditoria).
 *
 *  A. Superadministrador: todo el panel, crea usuarios, asigna/revoca, auditoria.
 *  B. Usuario sin permisos: inicia sesion pero no obtiene nada del panel.
 *  C. Permisos parciales: solo lo autorizado (modulo + accion + area/tipo).
 *  D. Revocacion: permiso revocado o cuenta desactivada = acceso perdido ya.
 *  E. Separacion web publica / panel: rutas publicas intactas, logins separados.
 *  F. Escalada de privilegios: nadie obtiene superadministrador por la API.
 */
const RUN = process.env.PG_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-integracion-sprint21';

d('Sprint 21 - superadministrador y permisos personalizados (HTTP)', () => {
    let pool, server, base;
    const ids = { usuarios: [], repuestos: [], proformas: [], clientes: [] };
    const PASS = 'Prueba-Segura-2026';
    let tokenSuper;

    // Cada inicio de sesion simula una IP distinta (la app confia en el proxy):
    // asi el limite anti fuerza bruta por IP (20 / 5 min) no interfiere.
    let ipFalsa = 0;
    const api = async (metodo, ruta, { token, body } = {}) => {
        const r = await fetch(`${base}/api${ruta}`, {
            method: metodo,
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': `10.21.${Math.floor(++ipFalsa / 250)}.${ipFalsa % 250}`,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body && metodo !== 'GET' ? JSON.stringify(body) : undefined,
        });
        let json = null;
        try { json = await r.json(); } catch { /* sin cuerpo */ }
        return { status: r.status, body: json };
    };
    const login = async (email, panel = 'staff', password = PASS) => api('POST', '/auth/login', { body: { email, password, panel } });

    /** Crea un usuario de personal desde la API del superadministrador. */
    async function crearUsuario(sufijo, rol, permisos) {
        const r = await api('POST', '/users', {
            token: tokenSuper,
            body: { nombre: `TEST21 ${sufijo}`, email: `test21-${sufijo}@x.test`, password: PASS, rol, permisos },
        });
        expect(r.status).toBe(201);
        ids.usuarios.push(r.body.usuario.id);
        const l = await login(`test21-${sufijo}@x.test`);
        expect(l.status).toBe(200);
        return { id: r.body.usuario.id, token: l.body.token, sesion: l.body };
    }

    beforeAll(async () => {
        pool = require('../config/db');
        // Limpieza de una corrida anterior interrumpida.
        await limpiar();

        const express = require('express');
        const app = express();
        app.set('trust proxy', 1);
        app.use(express.json());
        const rutas = ['auth', 'inventory', 'users', 'sucursales', 'ordenes', 'servicios', 'panel', 'citas', 'solicitudes',
            'proveedores', 'estadisticas', 'proformas', 'catalogos', 'caja', 'finanzas', 'dashboard', 'chatbot'];
        const montaje = { cuentasCobrar: 'cuentas-cobrar' };
        for (const r of rutas) app.use(`/api/${r}`, require(`../routes/${r}.routes`));
        for (const [archivo, url] of Object.entries(montaje)) app.use(`/api/${url}`, require(`../routes/${archivo}.routes`));
        await new Promise(ok => { server = app.listen(0, ok); });
        base = `http://127.0.0.1:${server.address().port}`;

        // El primer superadministrador SOLO se puede crear como lo hace el
        // script de servidor (sesion con ssswap.gestion_superadmin = on).
        const bcrypt = require('bcryptjs');
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`SELECT set_config('ssswap.gestion_superadmin', 'on', true)`);
            const { rows } = await client.query(
                `INSERT INTO usuarios (nombre, email, password, rol, permisos_inicializados)
                 VALUES ('TEST21 Super', 'test21-super@x.test', $1, 'superadministrador', TRUE) RETURNING id`,
                [await bcrypt.hash(PASS, 10)]);
            ids.superId = rows[0].id;
            await client.query('COMMIT');
        } finally { client.release(); }
        tokenSuper = (await login('test21-super@x.test')).body.token;

        // Datos: un repuesto por area, un cliente y una proforma de cada tipo.
        const rep = await pool.query(
            `INSERT INTO repuestos (codigo, nombre, area, stock_actual, stock_minimo) VALUES
               ('TEST21-MEC', 'TEST21 Filtro mecanica', 'mecanica', 10, 1),
               ('TEST21-COL', 'TEST21 Pintura colisiones', 'colisiones', 10, 1) RETURNING id, area`);
        ids.repuestos = rep.rows.map(r => r.id);
        ids.repMec = rep.rows.find(r => r.area === 'mecanica').id;
        ids.repCol = rep.rows.find(r => r.area === 'colisiones').id;
        const cli = await pool.query(`INSERT INTO clientes (nombre, email) VALUES ('TEST21 Cliente', 'test21-cli@x.test') RETURNING id`);
        ids.clientes.push(cli.rows[0].id);
        const pf = await pool.query(
            `INSERT INTO proformas (numero, tipo, usuario_id, cliente_nombre) VALUES
               ('TEST21-PM', 'mecanica', $1, 'TEST21 Cliente'), ('TEST21-PC', 'pintura', $1, 'TEST21 Cliente') RETURNING id, tipo`,
            [ids.superId]);
        ids.proformas = pf.rows.map(r => r.id);
        ids.profMec = pf.rows.find(r => r.tipo === 'mecanica').id;
        ids.profCol = pf.rows.find(r => r.tipo === 'pintura').id;
    });

    async function limpiar() {
        await pool.query(`DELETE FROM movimientos_inventario WHERE repuesto_id IN (SELECT id FROM repuestos WHERE codigo LIKE 'TEST21-%')`);
        await pool.query(`DELETE FROM repuestos WHERE codigo LIKE 'TEST21-%'`);
        await pool.query(`DELETE FROM proformas WHERE numero LIKE 'TEST21-%'`);
        await pool.query(`DELETE FROM clientes WHERE email LIKE 'test21-%'`);
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            await client.query(`SELECT set_config('ssswap.gestion_superadmin', 'on', true)`);
            await client.query(`DELETE FROM usuarios WHERE email LIKE 'test21-%'`);
            await client.query('COMMIT');
        } finally { client.release(); }
    }

    afterAll(async () => {
        if (server) await new Promise(ok => server.close(ok));
        if (pool) { await limpiar(); await pool.end(); }
    });

    // ── A ──────────────────────────────────────────────────────────────
    describe('A. Superadministrador', () => {
        test('accede a todos los modulos del panel', async () => {
            for (const ruta of ['/dashboard', '/finanzas/resumen', '/cuentas-cobrar', '/inventory/movimientos?page=1',
                '/proveedores/proveedores', '/estadisticas/crecimiento', '/caja/actual', '/users', '/users/auditoria', '/users/catalogo-permisos']) {
                const r = await api('GET', ruta, { token: tokenSuper });
                expect({ ruta, status: r.status }).toEqual({ ruta, status: 200 });
            }
        });

        test('el login devuelve permisos "*" y nunca la contrasena', async () => {
            const l = await login('test21-super@x.test');
            expect(l.body.permisos).toEqual(['*']);
            expect(JSON.stringify(l.body)).not.toMatch(/password|\$2[aby]\$/);
        });

        test('crea un usuario con permisos, los cambia y queda en la auditoria', async () => {
            const u = await crearUsuario('a1', 'interno', ['clientes:ver']);
            const cambio = await api('PUT', `/users/${u.id}/permisos`, { token: tokenSuper, body: { permisos: ['clientes:ver', 'vehiculos:ver'] } });
            expect(cambio.status).toBe(200);
            expect(cambio.body.agregados).toEqual(['vehiculos:ver']);

            const det = await api('GET', `/users/${u.id}`, { token: tokenSuper });
            expect(det.body.permisos).toEqual(['clientes:ver', 'vehiculos:ver']);
            expect(det.body.usuario.password).toBeUndefined();
            expect(det.body.historial.map(h => h.accion)).toEqual(expect.arrayContaining(['usuario.crear', 'permisos.actualizar']));

            const aud = await api('GET', `/users/auditoria?usuario_id=${u.id}&accion=permisos.actualizar`, { token: tokenSuper });
            expect(aud.body.registros[0]).toMatchObject({ actor_email: 'test21-super@x.test', resultado: 'exito' });
            expect(aud.body.registros[0].detalle.otorgados).toEqual(['vehiculos:ver']);
        });

        test('crear sin contrasena genera una temporal y sin permisos aplica la plantilla del rol', async () => {
            const r = await api('POST', '/users', { token: tokenSuper, body: { nombre: 'TEST21 Recep', email: 'test21-recep@x.test', rol: 'recepcionista' } });
            expect(r.status).toBe(201);
            ids.usuarios.push(r.body.usuario.id);
            expect(r.body.password_temporal).toMatch(/^\S{4}-\S{4}-\S{4}$/);
            const { PLANTILLAS } = require('../config/permisos');
            expect(r.body.permisos).toEqual([...PLANTILLAS.recepcionista].sort());
            expect((await login('test21-recep@x.test', 'staff', r.body.password_temporal)).status).toBe(200);
        });

        test('rechaza permisos inexistentes o exclusivos del superadministrador', async () => {
            const u = await crearUsuario('a2', 'interno', []);
            for (const p of ['usuarios:ver', 'auditoria:ver', 'finanzas:volar', 'xx']) {
                const r = await api('PUT', `/users/${u.id}/permisos`, { token: tokenSuper, body: { permisos: [p] } });
                expect({ p, status: r.status }).toEqual({ p, status: 400 });
            }
        });
    });

    // ── B ──────────────────────────────────────────────────────────────
    describe('B. Usuario sin permisos', () => {
        let u;
        beforeAll(async () => { u = await crearUsuario('b', 'interno', []); });

        test('puede iniciar sesion (cuenta activa) y recibe una lista de permisos vacia', async () => {
            expect(u.sesion.permisos).toEqual([]);
            const me = await api('GET', '/auth/me', { token: u.token });
            expect(me.status).toBe(200);
            expect(me.body.permisos).toEqual([]);
        });

        test('no obtiene informacion administrativa con peticiones directas', async () => {
            const rutas = ['/dashboard', '/ordenes/clientes', '/ordenes/ordenes', '/inventory/repuestos', '/inventory/movimientos',
                '/proformas', `/proformas/${ids.profMec}`, `/proformas/${ids.profMec}/pdf`, '/cuentas-cobrar', '/finanzas/resumen',
                '/caja/actual', '/proveedores/proveedores', '/estadisticas/crecimiento', '/citas', '/solicitudes', '/sucursales',
                '/chatbot/conversaciones'];
            for (const ruta of rutas) {
                const r = await api('GET', ruta, { token: u.token });
                expect({ ruta, status: r.status }).toEqual({ ruta, status: 403 });
            }
            const crear = await api('POST', '/ordenes/clientes', { token: u.token, body: { nombre: 'X' } });
            expect(crear.status).toBe(403);
        });

        test('no entra a la gestion de usuarios ni a la auditoria', async () => {
            for (const [m, ruta] of [['GET', '/users'], ['GET', '/users/auditoria'], ['POST', '/users'], ['PUT', `/users/${u.id}/permisos`]]) {
                const r = await api(m, ruta, { token: u.token, body: { permisos: ['clientes:ver'] } });
                expect({ ruta, status: r.status }).toEqual({ ruta, status: 403 });
            }
        });

        test('los intentos denegados quedan auditados', async () => {
            const aud = await api('GET', `/users/auditoria?actor_id=${u.id}&resultado=denegado`, { token: tokenSuper });
            expect(aud.body.total).toBeGreaterThan(0);
            expect(aud.body.registros[0].accion).toBe('acceso.denegado');
        });
    });

    // ── C ──────────────────────────────────────────────────────────────
    describe('C. Permisos parciales e independientes', () => {
        test('consulta clientes, crea ordenes y descarga proformas de mecanica, pero nada mas', async () => {
            const u = await crearUsuario('c1', 'interno',
                ['clientes:ver', 'ordenes:crear', 'proformas_mecanica:ver', 'proformas_mecanica:exportar']);
            expect((await api('GET', '/ordenes/clientes', { token: u.token })).status).toBe(200);
            expect((await api('DELETE', `/ordenes/clientes/${ids.clientes[0]}`, { token: u.token })).status).toBe(403);
            expect((await api('GET', '/cuentas-cobrar', { token: u.token })).status).toBe(403);
            expect((await api('GET', '/finanzas/resumen', { token: u.token })).status).toBe(403);
            expect((await api('GET', '/inventory/repuestos', { token: u.token })).status).toBe(403);

            // Proformas: solo las de mecanica.
            const lista = await api('GET', '/proformas?q=TEST21', { token: u.token });
            expect(lista.status).toBe(200);
            expect(lista.body.proformas.map(p => p.numero)).toEqual(['TEST21-PM']);
            expect((await api('GET', `/proformas/${ids.profMec}`, { token: u.token })).status).toBe(200);
            expect((await api('GET', `/proformas/${ids.profCol}`, { token: u.token })).status).toBe(403);
            expect((await api('GET', `/proformas/${ids.profCol}/excel`, { token: u.token })).status).toBe(403);
            expect((await api('DELETE', `/proformas/${ids.profMec}`, { token: u.token })).status).toBe(403);
            // Cambiar el tipo en el cuerpo no salta el control: se usa el tipo real de la BD.
            expect((await api('PATCH', `/proformas/${ids.profCol}/estado`, { token: u.token, body: { estado: 'emitida', tipo: 'mecanica' } })).status).toBe(403);
        });

        test('solo inventario de colisiones: consulta y registra entradas/salidas de esa area', async () => {
            const u = await crearUsuario('c2', 'interno',
                ['inventario_colisiones:ver', 'registros_inventario:ver', 'registros_inventario:crear']);

            const reps = await api('GET', '/inventory/repuestos?q=TEST21&limit=50', { token: u.token });
            expect(reps.status).toBe(200);
            expect(reps.body.repuestos.map(r => r.area)).toEqual(['colisiones']);
            // Pedir otra area por parametro no la muestra.
            const mec = await api('GET', '/inventory/repuestos?q=TEST21&area=mecanica', { token: u.token });
            expect(mec.body.repuestos).toEqual([]);

            const salidaCol = await api('POST', '/inventory/movimientos', { token: u.token, body: { repuesto_id: ids.repCol, tipo: 'salida', cantidad: 1, motivo: 'TEST21' } });
            expect(salidaCol.status).toBe(201);
            const salidaMec = await api('POST', '/inventory/movimientos', { token: u.token, body: { repuesto_id: ids.repMec, tipo: 'salida', cantidad: 1 } });
            expect(salidaMec.status).toBe(403);

            const movs = await api('GET', '/inventory/movimientos?page=1&q=TEST21', { token: u.token });
            expect(movs.status).toBe(200);
            expect(movs.body.movimientos.every(m => m.area === 'colisiones')).toBe(true);

            // No puede editar ni crear productos, ni entrar a otros modulos.
            expect((await api('PUT', `/inventory/repuestos/${ids.repCol}`, { token: u.token, body: { nombre: 'x' } })).status).toBe(403);
            expect((await api('POST', '/inventory/repuestos', { token: u.token, body: { nombre: 'x', area: 'colisiones' } })).status).toBe(403);
            expect((await api('GET', '/ordenes/clientes', { token: u.token })).status).toBe(403);
            expect((await api('GET', '/dashboard', { token: u.token })).status).toBe(403);
        });

        test('el dashboard solo trae las secciones permitidas', async () => {
            const u = await crearUsuario('c3', 'interno', ['dashboard:ver', 'citas:ver']);
            const r = await api('GET', '/dashboard', { token: u.token });
            expect(r.status).toBe(200);
            expect(r.body.citas).toBeDefined();
            for (const k of ['finanzas', 'cartera', 'caja', 'taller', 'inventario', 'proformas']) expect(r.body[k]).toBeUndefined();
        });

        test('un administrador comun sin permiso de finanzas no ve finanzas', async () => {
            const { PLANTILLAS } = require('../config/permisos');
            const u = await crearUsuario('c4', 'administrador', PLANTILLAS.administrador.filter(p => !p.startsWith('finanzas:')));
            expect((await api('GET', '/finanzas/resumen', { token: u.token })).status).toBe(403);
            expect((await api('GET', '/ordenes/clientes', { token: u.token })).status).toBe(200);
            const dash = await api('GET', '/dashboard', { token: u.token });
            expect(dash.body.finanzas).toBeUndefined();
        });
    });

    // ── D ──────────────────────────────────────────────────────────────
    describe('D. Revocacion', () => {
        test('al revocar un permiso se pierde en la siguiente peticion, con el MISMO token', async () => {
            const u = await crearUsuario('d1', 'interno', ['clientes:ver']);
            expect((await api('GET', '/ordenes/clientes', { token: u.token })).status).toBe(200);
            await api('PUT', `/users/${u.id}/permisos`, { token: tokenSuper, body: { permisos: [] } });
            expect((await api('GET', '/ordenes/clientes', { token: u.token })).status).toBe(403);
            const me = await api('GET', '/auth/me', { token: u.token });
            expect(me.body.permisos).toEqual([]);
        });

        test('al desactivar la cuenta su sesion deja de valer y no puede volver a entrar', async () => {
            const u = await crearUsuario('d2', 'interno', ['clientes:ver']);
            const des = await api('PUT', `/users/${u.id}/estado`, { token: tokenSuper, body: { estado: 'suspendido' } });
            expect(des.status).toBe(200);
            const r = await api('GET', '/ordenes/clientes', { token: u.token });
            expect(r.status).toBe(401);
            expect((await login('test21-d2@x.test')).status).toBe(403);

            // Reactivada: necesita iniciar sesion de nuevo (el token viejo sigue revocado).
            await api('PUT', `/users/${u.id}/estado`, { token: tokenSuper, body: { estado: 'activo' } });
            expect((await api('GET', '/ordenes/clientes', { token: u.token })).status).toBe(401);
            const nuevo = await login('test21-d2@x.test');
            expect((await api('GET', '/ordenes/clientes', { token: nuevo.body.token })).status).toBe(200);
        });

        test('restablecer el acceso cierra las sesiones abiertas', async () => {
            const u = await crearUsuario('d3', 'interno', ['clientes:ver']);
            const r = await api('PUT', `/users/${u.id}/password`, { token: tokenSuper, body: {} });
            expect(r.status).toBe(200);
            expect(r.body.password_temporal).toBeTruthy();
            expect((await api('GET', '/ordenes/clientes', { token: u.token })).status).toBe(401);
            expect((await login('test21-d3@x.test', 'staff', r.body.password_temporal)).status).toBe(200);
        });

        test('modificar datos del navegador no devuelve privilegios', async () => {
            const u = await crearUsuario('d4', 'interno', []);
            // Un token alterado (rol/permisos inventados) no pasa la firma.
            const [h, p, s] = u.token.split('.');
            const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
            const falso = [h, Buffer.from(JSON.stringify({ ...payload, rol: 'superadministrador', permisos: ['*'] })).toString('base64url'), s].join('.');
            expect((await api('GET', '/users', { token: falso })).status).toBe(401);
            // Mandar permisos en el cuerpo tampoco sirve.
            expect((await api('POST', '/ordenes/clientes', { token: u.token, body: { nombre: 'x', permisos: ['clientes:crear'] } })).status).toBe(403);
        });
    });

    // ── E ──────────────────────────────────────────────────────────────
    describe('E. Web publica y panel separados', () => {
        test('las rutas publicas siguen funcionando sin sesion', async () => {
            for (const ruta of ['/servicios', '/sucursales/public', '/inventory/publico']) {
                const r = await api('GET', ruta);
                expect({ ruta, status: r.status }).toEqual({ ruta, status: 200 });
            }
        });

        test('el personal no inicia sesion por el portal de clientes y viceversa', async () => {
            await crearUsuario('e1', 'interno', ['clientes:ver']);
            expect((await login('test21-e1@x.test', 'cliente')).status).toBe(403);

            const reg = await api('POST', '/auth/register', { body: { nombre: 'TEST21 Portal', email: 'test21-portal@x.test', password: PASS } });
            expect(reg.status).toBe(201);
            expect(reg.body.usuario.rol).toBe('cliente');
            ids.usuarios.push(reg.body.usuario.id);
            expect((await login('test21-portal@x.test', 'staff')).status).toBe(403);
            // Un cliente con su token no accede al panel.
            expect((await api('GET', '/dashboard', { token: reg.body.token })).status).toBe(403);
            expect((await api('GET', '/ordenes/clientes', { token: reg.body.token })).status).toBe(403);
            // Pero si a su portal.
            expect((await api('GET', '/panel/mi-actividad', { token: reg.body.token })).status).toBe(200);
        });

        test('el registro publico ignora un rol enviado por el navegador', async () => {
            const reg = await api('POST', '/auth/register', { body: { nombre: 'TEST21 Hacker', email: 'test21-hack@x.test', password: PASS, rol: 'superadministrador' } });
            expect(reg.status).toBe(201);
            ids.usuarios.push(reg.body.usuario.id);
            expect(reg.body.usuario.rol).toBe('cliente');
        });
    });

    // ── F ──────────────────────────────────────────────────────────────
    describe('F. Nadie obtiene superadministrador por la API', () => {
        test('el superadministrador no puede asignar ese rol desde el panel', async () => {
            const u = await crearUsuario('f1', 'administrador', []);
            expect((await api('PUT', `/users/${u.id}/rol`, { token: tokenSuper, body: { rol: 'superadministrador' } })).status).toBe(400);
            expect((await api('POST', '/users', { token: tokenSuper, body: { nombre: 'x', email: 'test21-x@x.test', password: PASS, rol: 'superadministrador' } })).status).toBe(400);
        });

        test('un administrador comun no puede tocar usuarios ni darse permisos', async () => {
            const { PLANTILLAS } = require('../config/permisos');
            const adm = await crearUsuario('f2', 'administrador', PLANTILLAS.administrador);
            expect((await api('PUT', `/users/${adm.id}/permisos`, { token: adm.token, body: { permisos: ['finanzas:ver'] } })).status).toBe(403);
            expect((await api('PUT', `/users/${adm.id}/rol`, { token: adm.token, body: { rol: 'administrador' } })).status).toBe(403);
        });

        test('nadie modifica ni desactiva a un superadministrador desde la API', async () => {
            const otro = await pool.connect();
            let otroId;
            try {
                await otro.query('BEGIN');
                await otro.query(`SELECT set_config('ssswap.gestion_superadmin', 'on', true)`);
                otroId = (await otro.query(`INSERT INTO usuarios (nombre, email, password, rol) VALUES ('TEST21 Super2', 'test21-super2@x.test', 'x', 'superadministrador') RETURNING id`)).rows[0].id;
                await otro.query('COMMIT');
            } finally { otro.release(); }
            expect((await api('PUT', `/users/${otroId}/estado`, { token: tokenSuper, body: { estado: 'bloqueado' } })).status).toBe(403);
            expect((await api('PUT', `/users/${otroId}/permisos`, { token: tokenSuper, body: { permisos: [] } })).status).toBe(403);
            expect((await api('DELETE', `/users/${otroId}`, { token: tokenSuper })).status).toBe(403);
            expect((await api('PUT', `/users/${ids.superId}/estado`, { token: tokenSuper, body: { estado: 'bloqueado' } })).status).toBe(400);
        });

        test('la base de datos rechaza promover a superadministrador sin el script', async () => {
            const u = await crearUsuario('f3', 'interno', []);
            await expect(pool.query(`UPDATE usuarios SET rol = 'superadministrador' WHERE id = $1`, [u.id])).rejects.toThrow(/superadministrador/);
            await expect(pool.query(`DELETE FROM auditoria_seguridad WHERE actor_id = $1`, [ids.superId])).rejects.toThrow(/auditoria/);
        });
    });
});
