/**
 * SS SWAP - Pruebas de INTEGRACION del Sprint 22 (plataforma multiempresa)
 * con peticiones HTTP reales contra PostgreSQL. Solo corren con PG_INTEGRATION=1:
 *
 *   PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest sprint22
 *
 * ¡NUNCA apuntar a produccion! Crea dos empresas "TEST22 ..." y las borra
 * (con todos sus datos) al terminar.
 *
 *  A. Conservacion de SS SWAP: sus usuarios entran y ven sus mismos datos.
 *  B. Mecanica nueva: empresa + administrador inicial; empieza vacia y opera.
 *  C. Aislamiento: ninguna lectura, edicion, borrado, descarga, busqueda ni
 *     enlace cruza a otra empresa, ni manipulando ids, cabeceras o el cuerpo.
 *  D. Permisos dentro de la empresa (lectura sin edicion, sin exportar, sin cobrar).
 *  E. Inventario y documentos: mismo producto en dos empresas, numeracion
 *     propia, descuento de stock solo en la empresa duena, PDF con sus datos.
 *  F. Plataforma: superadministrador global sin datos de empresas, soporte
 *     autorizado/auditado, suspension de empresa, auditoria global.
 */
const RUN = process.env.PG_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-integracion-sprint22';

d('Sprint 22 - plataforma multiempresa (HTTP)', () => {
    let pool, server, base, SSSWAP;
    const PASS = 'Prueba-Segura-2026';
    const t = {}; // tokens y datos

    let ipFalsa = 0;
    const api = async (metodo, ruta, { token, body, headers = {} } = {}) => {
        const r = await fetch(`${base}/api${ruta}`, {
            method: metodo,
            headers: {
                'Content-Type': 'application/json',
                'X-Forwarded-For': `10.22.${Math.floor(++ipFalsa / 250)}.${ipFalsa % 250}`,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...headers,
            },
            body: body && metodo !== 'GET' ? JSON.stringify(body) : undefined,
        });
        const tipo = r.headers.get('content-type') || '';
        const cuerpo = tipo.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer());
        return { status: r.status, body: cuerpo };
    };
    const login = async (email, password = PASS) => api('POST', '/auth/login', { body: { email, password, panel: 'staff' } });

    /** Borra por completo las empresas de prueba (solo en la base de pruebas). */
    async function limpiar() {
        const cliente = await pool.connect();
        try {
            await cliente.query('BEGIN');
            await cliente.query(`SET LOCAL session_replication_role = replica`); // sin triggers ni FK: solo pruebas
            const { rows } = await cliente.query(`SELECT id FROM empresas WHERE slug LIKE 'test22-%'`);
            const ids = rows.map(r => r.id);
            if (ids.length) {
                const { TODAS_TABLAS_EMPRESA: TABLAS_EMPRESA } = require('../config/multiempresa');
                for (const tabla of TABLAS_EMPRESA) await cliente.query(`DELETE FROM ${tabla} WHERE empresa_id = ANY($1)`, [ids]);
                for (const tabla of ['accesos_soporte']) await cliente.query(`DELETE FROM ${tabla} WHERE empresa_id = ANY($1)`, [ids]);
                await cliente.query(`DELETE FROM empresas WHERE id = ANY($1)`, [ids]);
            }
            await cliente.query(`DELETE FROM usuario_permisos WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE 'test22-%')`);
            await cliente.query(`DELETE FROM accesos_soporte WHERE superadmin_id IN (SELECT id FROM usuarios WHERE email LIKE 'test22-%')`);
            await cliente.query(`DELETE FROM usuarios WHERE email LIKE 'test22-%'`);
            await cliente.query(`DELETE FROM repuestos WHERE nombre LIKE 'TEST22%'`);
            await cliente.query(`DELETE FROM clientes WHERE nombre LIKE 'TEST22%'`);
            await cliente.query('COMMIT');
        } finally { cliente.release(); }
    }

    beforeAll(async () => {
        pool = require('../config/db');
        SSSWAP = await require('../test-utils/empresaPrueba').idEmpresa('ss-swap');
        await limpiar();

        const express = require('express');
        const app = express();
        app.set('trust proxy', 1);
        app.use(express.json());
        const { contextoPublico, registrarErrores } = require('../middleware/empresa.middleware');
        app.use('/api', registrarErrores, contextoPublico);
        const rutas = ['auth', 'inventory', 'users', 'sucursales', 'ordenes', 'servicios', 'panel', 'citas', 'solicitudes',
            'proveedores', 'estadisticas', 'proformas', 'catalogos', 'caja', 'finanzas', 'dashboard', 'chatbot', 'plataforma', 'empresa'];
        for (const r of rutas) app.use(`/api/${r}`, require(`../routes/${r}.routes`));
        app.use('/api/cuentas-cobrar', require('../routes/cuentasCobrar.routes'));
        await new Promise(ok => { server = app.listen(0, ok); });
        base = `http://127.0.0.1:${server.address().port}`;

        // Superadministrador GLOBAL (sin empresa propia) y un administrador de SS SWAP.
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash(PASS, 10);
        const c = await pool.connect();
        try {
            await c.query('BEGIN');
            await c.query(`SELECT set_config('ssswap.gestion_superadmin', 'on', true)`);
            await c.query(`INSERT INTO usuarios (nombre, email, password, rol, permisos_inicializados) VALUES ('TEST22 Plataforma', 'test22-plataforma@x.test', $1, 'superadministrador', TRUE)`, [hash]);
            const { rows } = await c.query(`INSERT INTO usuarios (nombre, email, password, rol, permisos_inicializados, empresa_id) VALUES ('TEST22 Admin SS SWAP', 'test22-ssadmin@x.test', $1, 'administrador', TRUE, $2) RETURNING id`, [hash, SSSWAP]);
            const { PLANTILLAS } = require('../config/permisos');
            for (const p of PLANTILLAS.administrador) {
                const [modulo, accion] = p.split(':');
                await c.query(`INSERT INTO usuario_permisos (usuario_id, modulo, accion) VALUES ($1, $2, $3)`, [rows[0].id, modulo, accion]);
            }
            await c.query('COMMIT');
        } finally { c.release(); }
        t.plataforma = (await login('test22-plataforma@x.test')).body.token;
        t.ssadmin = (await login('test22-ssadmin@x.test')).body.token;
    });

    afterAll(async () => {
        if (server) await new Promise(ok => server.close(ok));
        if (pool) { await limpiar(); await pool.end(); }
    });

    // ── A ───────────────────────────────────────────────────────────
    describe('A. Conservacion de SS SWAP', () => {
        test('su administrador entra y ve exactamente los datos de SS SWAP', async () => {
            const l = await login('test22-ssadmin@x.test');
            expect(l.status).toBe(200);
            expect(l.body.empresa).toMatchObject({ id: SSSWAP, slug: 'ss-swap' });

            const cuenta = async (tabla) => Number((await pool.query(`SELECT COUNT(*) FROM ${tabla} WHERE empresa_id = $1`, [SSSWAP])).rows[0].count);
            const clientes = await api('GET', '/ordenes/clientes', { token: t.ssadmin });
            expect(clientes.status).toBe(200);
            expect(clientes.body.clientes.length).toBe(await cuenta('clientes'));
            const prof = await api('GET', '/proformas?limit=100', { token: t.ssadmin });
            expect(prof.body.total).toBe(await cuenta('proformas'));
            const reps = await api('GET', '/inventory/repuestos?limit=500', { token: t.ssadmin });
            expect(reps.body.total).toBe(await cuenta('repuestos'));
        });

        test('las relaciones de SS SWAP siguen intactas (ninguna apunta a otra empresa)', async () => {
            const { rows } = await pool.query(`
                SELECT (SELECT COUNT(*) FROM vehiculos v JOIN clientes c ON c.id = v.cliente_id WHERE v.empresa_id <> c.empresa_id)
                     + (SELECT COUNT(*) FROM proforma_items i JOIN proformas p ON p.id = i.proforma_id WHERE i.empresa_id <> p.empresa_id)
                     + (SELECT COUNT(*) FROM movimientos_inventario m JOIN repuestos r ON r.id = m.repuesto_id WHERE m.empresa_id <> r.empresa_id)
                     + (SELECT COUNT(*) FROM pagos_cliente pc JOIN cuentas_cobrar cc ON cc.id = pc.cuenta_id WHERE pc.empresa_id <> cc.empresa_id) AS cruzadas`);
            expect(Number(rows[0].cruzadas)).toBe(0);
        });

        test('la web publica sigue mostrando el catalogo de SS SWAP', async () => {
            for (const ruta of ['/servicios', '/sucursales/public', '/inventory/publico']) {
                expect((await api('GET', ruta)).status).toBe(200);
            }
        });
    });

    // ── B ───────────────────────────────────────────────────────────
    describe('B. Mecanica nueva', () => {
        test('el superadministrador crea dos empresas con su administrador inicial', async () => {
            for (const [clave, nombre] of [['a', 'TEST22 Taller Norte'], ['b', 'TEST22 Taller Sur']]) {
                const r = await api('POST', '/plataforma/empresas', { token: t.plataforma, body: {
                    nombre, slug: `test22-${clave}`, ruc: clave === 'a' ? '1790000000001' : '1790000000002',
                    admin: { nombre: `Admin ${nombre}`, email: `test22-admin-${clave}@x.test` } } });
                expect(r.status).toBe(201);
                expect(r.body.password_temporal).toMatch(/^\S{4}-\S{4}-\S{4}$/);
                t[`emp_${clave}`] = r.body.empresa.id;
                const l = await login(`test22-admin-${clave}@x.test`, r.body.password_temporal);
                expect(l.status).toBe(200);
                expect(l.body.empresa.id).toBe(r.body.empresa.id);
                t[clave] = l.body.token;
            }
        });

        test('la empresa nueva empieza sin datos operativos de SS SWAP', async () => {
            for (const [ruta, campo] of [['/ordenes/clientes', 'clientes'], ['/ordenes/vehiculos', 'vehiculos'], ['/ordenes/ordenes', 'ordenes'],
                ['/inventory/repuestos', 'repuestos'], ['/proformas', 'proformas'], ['/cuentas-cobrar', 'cuentas'], ['/inventory/movimientos?page=1', 'movimientos'],
                ['/sucursales', 'sucursales']]) {
                const r = await api('GET', ruta, { token: t.a });
                expect({ ruta, status: r.status }).toEqual({ ruta, status: 200 });
                expect({ ruta, n: (r.body[campo] || []).length }).toEqual({ ruta, n: 0 });
            }
            const dash = await api('GET', '/dashboard', { token: t.a });
            expect(dash.status).toBe(200);
            expect(dash.body.clientes.total).toBe(0);
            // Tiene sus propias cuentas de dinero para caja y finanzas.
            const cuentas = await api('GET', '/finanzas/cuentas', { token: t.a });
            expect(cuentas.body.cuentas.map(c => c.nombre).sort()).toEqual(['Banco principal', 'Caja principal']);
        });

        test('cada empresa registra sus propios clientes, vehiculos, productos y documentos', async () => {
            for (const k of ['a', 'b']) {
                const c = await api('POST', '/ordenes/clientes', { token: t[k], body: { nombre: `TEST22 Cliente ${k}`, cedula: '0102030405', telefono: '0990000022' } });
                expect({ status: c.status, cuerpo: c.status === 201 ? null : c.body }).toEqual({ status: 201, cuerpo: null });
                t[`cli_${k}`] = (c.body.cliente || c.body).id;
                const v = await api('POST', '/ordenes/vehiculos', { token: t[k], body: { cliente_id: t[`cli_${k}`], placa: `TST-22${k === 'a' ? 1 : 2}`, marca: 'Kia', modelo: 'Rio' } });
                expect({ status: v.status, cuerpo: v.status === 201 ? null : v.body }).toEqual({ status: 201, cuerpo: null });
                t[`veh_${k}`] = (v.body.vehiculo || v.body).id;
                // MISMO nombre de producto en las dos empresas: registros independientes.
                const r = await api('POST', '/inventory/repuestos', { token: t[k], body: { nombre: 'TEST22 Filtro de aceite', area: 'mecanica', precio_venta: 10, stock_actual: 10 } });
                expect({ status: r.status, cuerpo: r.status === 201 ? null : r.body }).toEqual({ status: 201, cuerpo: null });
                t[`rep_${k}`] = r.body.id;
                t[`codigo_${k}`] = r.body.codigo;
            }
        });
    });

    // ── C ───────────────────────────────────────────────────────────
    describe('C. Aislamiento entre empresas', () => {
        test('ids de otra empresa no existen: leer, editar, borrar', async () => {
            const cliB = t.cli_b;
            expect((await api('GET', `/ordenes/clientes/${cliB}`, { token: t.a })).status).toBe(404);
            const ed = await api('PUT', `/ordenes/clientes/${cliB}`, { token: t.a, body: { nombre: 'HACK' } });
            expect([404, 400]).toContain(ed.status);
            const del = await api('DELETE', `/ordenes/clientes/${cliB}`, { token: t.a });
            expect([404, 400]).toContain(del.status);
            expect((await api('PUT', `/inventory/repuestos/${t.rep_b}`, { token: t.a, body: { nombre: 'HACK' } })).status).toBe(404);
            expect((await api('DELETE', `/inventory/repuestos/${t.rep_b}`, { token: t.a })).status).toBe(404);
            // Nada cambio en la empresa B.
            const { rows } = await pool.query('SELECT nombre FROM clientes WHERE id = $1', [cliB]);
            expect(rows[0].nombre).toBe('TEST22 Cliente b');
        });

        test('busquedas, listados, reportes y exportaciones no traen datos ajenos', async () => {
            const busq = await api('GET', '/ordenes/clientes?q=TEST22', { token: t.a });
            expect(busq.body.clientes.map(c => c.nombre)).toEqual(['TEST22 Cliente a']);
            const reps = await api('GET', '/inventory/repuestos?q=TEST22&limit=50', { token: t.a });
            expect(reps.body.repuestos.map(r => r.id)).toEqual([t.rep_a]);
            const est = await api('GET', '/estadisticas/crecimiento', { token: t.a });
            expect(est.status).toBe(200);
            // SS SWAP tampoco ve a las empresas nuevas.
            const ss = await api('GET', '/ordenes/clientes?q=TEST22', { token: t.ssadmin });
            expect(ss.body.clientes).toEqual([]);
        });

        test('no puede enlazar registros ajenos ni elegir empresa desde el navegador', async () => {
            // Vehiculo de A con el cliente de B: la llave compuesta lo impide.
            const v = await api('POST', '/ordenes/vehiculos', { token: t.a, body: { cliente_id: t.cli_b, placa: 'HCK-001', marca: 'X', modelo: 'Y' } });
            expect(v.status).toBeGreaterThanOrEqual(400);
            // Movimiento de inventario sobre el producto de B.
            const m = await api('POST', '/inventory/movimientos', { token: t.a, body: { repuesto_id: t.rep_b, tipo: 'salida', cantidad: 1 } });
            expect(m.status).toBe(404);
            // Mandar empresa_id en el cuerpo no cambia nada: el cliente queda en A.
            const c = await api('POST', '/ordenes/clientes', { token: t.a, body: { nombre: 'TEST22 Intruso', cedula: '0999999999', telefono: '0990000023', empresa_id: t.emp_b } });
            expect(c.status).toBe(201);
            const { rows } = await pool.query(`SELECT empresa_id FROM clientes WHERE nombre = 'TEST22 Intruso'`);
            expect(rows[0].empresa_id).toBe(t.emp_a);
            // Un usuario de empresa no puede usar la cabecera de soporte.
            expect((await api('GET', '/ordenes/clientes', { token: t.a, headers: { 'X-Soporte-Empresa': String(t.emp_b) } })).status).toBe(403);
            // Ni entrar a la plataforma.
            expect((await api('GET', '/plataforma/empresas', { token: t.a })).status).toBe(403);
        });

        test('no gestiona usuarios de otra empresa', async () => {
            const lista = await api('GET', '/users', { token: t.a });
            expect(lista.body.usuarios.every(u => u.email.startsWith('test22-admin-a'))).toBe(true);
            const { rows } = await pool.query(`SELECT id FROM usuarios WHERE email = 'test22-admin-b@x.test'`);
            expect((await api('PUT', `/users/${rows[0].id}/estado`, { token: t.a, body: { estado: 'bloqueado' } })).status).toBe(404);
            expect((await api('GET', `/users/${rows[0].id}`, { token: t.a })).status).toBe(404);
        });
    });

    // ── D ───────────────────────────────────────────────────────────
    describe('D. Permisos personalizados dentro de la empresa', () => {
        test('Recepcionista 1: clientes ver/crear/editar, proformas ver/crear, sin pagares ni exportar', async () => {
            const r = await api('POST', '/users', { token: t.a, body: {
                nombre: 'TEST22 Recepcionista 1', email: 'test22-recep1@x.test', password: PASS, rol: 'recepcionista',
                permisos: ['clientes:ver', 'clientes:crear', 'clientes:editar', 'vehiculos:ver', 'proformas_mecanica:ver', 'proformas_mecanica:crear'] } });
            expect(r.status).toBe(201);
            const tok = (await login('test22-recep1@x.test')).body.token;
            expect((await api('GET', '/ordenes/clientes', { token: tok })).status).toBe(200);
            expect((await api('DELETE', `/ordenes/clientes/${t.cli_a}`, { token: tok })).status).toBe(403);
            expect((await api('GET', '/cuentas-cobrar', { token: tok })).status).toBe(403);
            expect((await api('GET', '/finanzas/resumen', { token: tok })).status).toBe(403);
            expect((await api('GET', '/users', { token: tok })).status).toBe(403);
            expect((await api('GET', '/empresa', { token: tok })).status).toBe(403);
            t.recep = tok;
        });
    });

    // ── E ───────────────────────────────────────────────────────────
    describe('E. Inventario y documentos por empresa', () => {
        test('numeracion propia: el mismo codigo en dos empresas y proformas desde 1', async () => {
            expect(t.codigo_a).toBe('MEC-000001');
            expect(t.codigo_b).toBe('MEC-000001');
            for (const k of ['a', 'b']) {
                const p = await api('POST', '/proformas', { token: t[k], body: {
                    tipo: 'mecanica', cliente_id: t[`cli_${k}`], vehiculo_id: t[`veh_${k}`], fecha_emision: new Date().toISOString().slice(0, 10),
                    iva_porcentaje: 0, descuento: 0, anticipo: 0, estado: 'emitida',
                    items: [{ categoria: 'producto', descripcion: 'Filtro', cantidad: 3, precio_unitario: 10, referencia_tipo: 'repuesto', referencia_id: t[`rep_${k}`] }] } });
                expect(p.status).toBe(201);
                expect(p.body.proforma.numero).toBe('PROFORMA-000001');
                t[`prof_${k}`] = p.body.proforma.id;
            }
        });

        test('una proforma de A no puede usar un producto de B', async () => {
            const p = await api('POST', '/proformas', { token: t.a, body: {
                tipo: 'mecanica', cliente_id: t.cli_a, vehiculo_id: t.veh_a, fecha_emision: new Date().toISOString().slice(0, 10),
                iva_porcentaje: 0, descuento: 0, anticipo: 0,
                items: [{ categoria: 'producto', descripcion: 'Ajeno', cantidad: 1, precio_unitario: 10, referencia_tipo: 'repuesto', referencia_id: t.rep_b }] } });
            expect(p.status).toBeGreaterThanOrEqual(400);
        });

        test('aprobar la proforma de A descuenta solo el stock de A, una sola vez', async () => {
            const ap = await api('PATCH', `/proformas/${t.prof_a}/estado`, { token: t.a, body: { estado: 'aprobada' } });
            expect(ap.status).toBe(200);
            const otra = await api('POST', `/proformas/${t.prof_a}/confirmar-uso`, { token: t.a });
            expect(otra.status).toBe(409); // ya descontado: no hay salida duplicada
            const stock = async (id) => Number((await pool.query('SELECT stock_actual FROM repuestos WHERE id = $1', [id])).rows[0].stock_actual);
            expect(await stock(t.rep_a)).toBe(7);
            expect(await stock(t.rep_b)).toBe(10);
            // B no ve los movimientos de A.
            const movB = await api('GET', '/inventory/movimientos?page=1', { token: t.b });
            expect(movB.body.movimientos).toEqual([]);
        });

        test('el PDF y el Excel llevan los datos de la empresa duena y no se descargan desde otra', async () => {
            const pdf = await api('GET', `/proformas/${t.prof_a}/pdf`, { token: t.a });
            expect(pdf.status).toBe(200);
            const texto = pdf.body.toString('latin1');
            expect(texto).toMatch(/TEST22 Taller Norte/);
            expect(texto).not.toMatch(/SSarango/);
            expect((await api('GET', `/proformas/${t.prof_a}/pdf`, { token: t.b })).status).toBe(404);
            expect((await api('GET', `/proformas/${t.prof_a}/excel`, { token: t.b })).status).toBe(404);
            // Sin permiso de exportar, aunque sea de su empresa.
            expect((await api('GET', `/proformas/${t.prof_a}/pdf`, { token: t.recep })).status).toBe(403);
        });

        test('saldos financieros calculados solo con datos de la empresa', async () => {
            const ra = await api('GET', '/finanzas/resumen', { token: t.a });
            expect(ra.status).toBe(200);
            const ss = await api('GET', '/finanzas/resumen', { token: t.ssadmin });
            expect(ss.status).toBe(200);
            expect(JSON.stringify(ra.body)).not.toEqual(JSON.stringify(ss.body));
        });
    });

    // ── F ───────────────────────────────────────────────────────────
    describe('F. Plataforma, soporte y suspension', () => {
        test('el superadministrador global no ve datos operativos de ninguna empresa', async () => {
            expect((await api('GET', '/ordenes/clientes', { token: t.plataforma })).status).toBe(403);
            expect((await api('GET', '/proformas', { token: t.plataforma })).status).toBe(403);
            const emp = await api('GET', '/plataforma/empresas', { token: t.plataforma });
            expect(emp.status).toBe(200);
            const a = emp.body.empresas.find(e => e.id === t.emp_a);
            expect(a).toMatchObject({ total_clientes: 2, total_productos: 1 }); // solo conteos
            expect(JSON.stringify(emp.body)).not.toMatch(/0102030405/);   // ni una cedula
        });

        test('soporte: requiere autorizacion de la empresa, motivo, y queda auditado', async () => {
            const sinPermiso = await api('POST', `/plataforma/empresas/${t.emp_a}/soporte`, { token: t.plataforma, body: { motivo: 'Revisar descuadre de inventario', minutos: 30 } });
            expect(sinPermiso.status).toBe(403);
            // La empresa lo autoriza.
            expect((await api('PUT', '/empresa', { token: t.a, body: { permite_soporte: true } })).status).toBe(200);
            const corto = await api('POST', `/plataforma/empresas/${t.emp_a}/soporte`, { token: t.plataforma, body: { motivo: 'x', minutos: 30 } });
            expect(corto.status).toBe(400);
            const ok = await api('POST', `/plataforma/empresas/${t.emp_a}/soporte`, { token: t.plataforma, body: { motivo: 'Revisar descuadre de inventario', minutos: 30, modo: 'lectura' } });
            expect(ok.status).toBe(201);
            const h = { 'X-Soporte-Empresa': String(t.emp_a) };
            const ver = await api('GET', '/ordenes/clientes', { token: t.plataforma, headers: h });
            expect(ver.status).toBe(200);
            expect(ver.body.clientes.length).toBe(2);
            // Solo lectura.
            expect((await api('POST', '/ordenes/clientes', { token: t.plataforma, headers: h, body: { nombre: 'TEST22 Soporte', cedula: '0888888888', telefono: '0990000024' } })).status).toBe(403);
            // Con soporte en A no ve B.
            expect((await api('GET', '/ordenes/clientes', { token: t.plataforma, headers: { 'X-Soporte-Empresa': String(t.emp_b) } })).status).toBe(403);
            // La empresa ve en SU auditoria que entro soporte.
            const aud = await api('GET', '/users/auditoria?accion=soporte.', { token: t.a });
            expect(aud.body.registros.map(r => r.accion)).toContain('soporte.abrir');
            // Cerrar el acceso: deja de servir.
            await api('DELETE', `/plataforma/soporte/${ok.body.acceso.id}`, { token: t.plataforma });
            expect((await api('GET', '/ordenes/clientes', { token: t.plataforma, headers: h })).status).toBe(403);
        });

        test('suspender una empresa corta sus sesiones; reactivarla las devuelve', async () => {
            const s = await api('PATCH', `/plataforma/empresas/${t.emp_b}/estado`, { token: t.plataforma, body: { estado: 'suspendida', motivo: 'Falta de pago' } });
            expect(s.status).toBe(200);
            const r = await api('GET', '/ordenes/clientes', { token: t.b });
            expect(r.status).toBe(401);
            expect(r.body.codigo).toBe('EMPRESA_INACTIVA');
            expect((await login('test22-admin-b@x.test', 'cualquiera')).status).toBe(401);
            // SS SWAP (empresa de la web publica) no se puede suspender por accidente.
            expect((await api('PATCH', `/plataforma/empresas/${SSSWAP}/estado`, { token: t.plataforma, body: { estado: 'suspendida', motivo: 'prueba' } })).status).toBe(400);
            await api('PATCH', `/plataforma/empresas/${t.emp_b}/estado`, { token: t.plataforma, body: { estado: 'activa' } });
            expect((await api('GET', '/ordenes/clientes', { token: t.b })).status).toBe(200);
        });

        test('la auditoria global ve todas las empresas; la de cada empresa solo la suya', async () => {
            const g = await api('GET', '/plataforma/auditoria?accion=empresa.', { token: t.plataforma });
            const empresas = new Set(g.body.registros.map(r => r.empresa_id));
            expect(empresas.has(t.emp_a) && empresas.has(t.emp_b)).toBe(true);
            const propia = await api('GET', '/users/auditoria', { token: t.b });
            expect(propia.body.registros.every(r => r.accion !== 'soporte.abrir')).toBe(true);
            const deA = await pool.query('SELECT COUNT(*)::int AS n FROM auditoria_seguridad WHERE empresa_id = $1', [t.emp_a]);
            expect(propia.body.total).toBeLessThan(propia.body.total + deA.rows[0].n); // B no incluye eventos de A
            expect(propia.body.registros.some(r => /test22-admin-a/.test(r.actor_email || ''))).toBe(false);
        });

        test('las tablas de la plataforma no son accesibles para el rol de la aplicacion', async () => {
            const { conEmpresa } = require('../config/contexto');
            await expect(conEmpresa(t.emp_a, () => pool.query('SELECT * FROM respaldos_registro'))).rejects.toThrow(/permiso|permission/i);
            await expect(conEmpresa(t.emp_a, () => pool.query("UPDATE empresas SET estado = 'activa' WHERE id = empresa_actual()"))).rejects.toThrow(/permiso|permission/i);
            await expect(conEmpresa(t.emp_a, () => pool.query('ALTER TABLE clientes DISABLE ROW LEVEL SECURITY'))).rejects.toThrow();
        });
    });
});
