/**
 * SS SWAP - Pruebas de INTEGRACION del Sprint 29 (caja completa) con
 * peticiones HTTP reales contra PostgreSQL.
 *
 *   PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest sprint29
 *
 * ¡NUNCA apuntar a produccion! Crea dos empresas "TEST29 ..." y las borra al
 * terminar.
 */
const RUN = process.env.PG_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-integracion-sprint29';

d('Sprint 29 - caja: cajero, declaracion, reporte, PDF/Excel, anular y reabrir (HTTP)', () => {
    let pool, server, base;
    const t = {};
    let ip = 0;

    const api = async (metodo, ruta, { token, body } = {}) => {
        const r = await fetch(`${base}/api${ruta}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.29.${Math.floor(++ip / 250)}.${ip % 250}`,
                ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: body && metodo !== 'GET' ? JSON.stringify(body) : undefined,
        });
        const tipo = r.headers.get('content-type') || '';
        return { status: r.status, tipo, body: tipo.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer()) };
    };
    const login = async (email, password) => api('POST', '/auth/login', { body: { email, password, panel: 'staff' } });
    const q = (sql, params) => require('../config/contexto').sinAislamiento(() => pool.query(sql, params));

    async function limpiar() {
        const c = await pool.connect();
        try {
            await c.query('BEGIN');
            await c.query(`SET LOCAL session_replication_role = replica`); // sin triggers ni FK: solo pruebas
            const { rows } = await c.query(`SELECT id FROM empresas WHERE slug LIKE 'test29-%'`);
            const ids = rows.map(r => r.id);
            if (ids.length) {
                const { TODAS_TABLAS_EMPRESA } = require('../config/multiempresa');
                for (const tabla of TODAS_TABLAS_EMPRESA) await c.query(`DELETE FROM ${tabla} WHERE empresa_id = ANY($1)`, [ids]);
                await c.query(`DELETE FROM accesos_soporte WHERE empresa_id = ANY($1)`, [ids]);
                await c.query(`DELETE FROM empresas WHERE id = ANY($1)`, [ids]);
            }
            await c.query(`DELETE FROM usuario_permisos WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE 'test29-%')`);
            await c.query(`DELETE FROM usuarios WHERE email LIKE 'test29-%'`);
            await c.query('COMMIT');
        } finally { c.release(); }
    }

    /** Pagaré manual de la empresa A (cliente de prueba). */
    const pagare = async (monto, concepto) => {
        const r = await api('POST', '/cuentas-cobrar', { token: t.a, body: { cliente_id: t.cliente, concepto, monto_total: monto } });
        expect(r.status).toBe(201);
        return r.body.id || r.body.cuenta?.id;
    };
    const pagar = async (cuenta, monto, extra = {}) => {
        const r = await api('POST', `/cuentas-cobrar/${cuenta}/pagos`, { token: t.a, body: { monto, metodo_pago: 'efectivo', ...extra } });
        expect(r.status).toBe(201);
    };

    beforeAll(async () => {
        pool = require('../config/db');
        await limpiar();

        const express = require('express');
        const app = express();
        app.set('trust proxy', 1);
        app.use(express.json({ limit: '2mb' }));
        const { contextoPublico, registrarErrores } = require('../middleware/empresa.middleware');
        app.use('/api', registrarErrores, contextoPublico);
        for (const r of ['auth', 'plataforma', 'caja', 'finanzas']) app.use(`/api/${r}`, require(`../routes/${r}.routes`));
        app.use('/api/cuentas-cobrar', require('../routes/cuentasCobrar.routes'));
        await new Promise(ok => { server = app.listen(0, ok); });
        base = `http://127.0.0.1:${server.address().port}`;

        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('Prueba-Segura-2026', 10);
        const c = await pool.connect();
        try {
            await c.query('BEGIN');
            await c.query(`SELECT set_config('ssswap.gestion_superadmin', 'on', true)`);
            await c.query(`INSERT INTO usuarios (nombre, email, password, rol, permisos_inicializados) VALUES ('TEST29 Plataforma', 'test29-plataforma@x.test', $1, 'superadministrador', TRUE)`, [hash]);
            await c.query('COMMIT');
        } finally { c.release(); }
        const plat = (await login('test29-plataforma@x.test', 'Prueba-Segura-2026')).body.token;
        for (const [k, ruc] of [['a', '1790000029001'], ['b', '1790000029002']]) {
            const r = await api('POST', '/plataforma/empresas', { token: plat, body: { nombre: `TEST29 Taller ${k}`, slug: `test29-${k}`, ruc,
                admin: { nombre: `Admin ${k}`, email: `test29-admin-${k}@x.test` } } });
            expect(r.status).toBe(201);
            t[`emp_${k}`] = r.body.empresa.id;
            const l = await login(`test29-admin-${k}@x.test`, r.body.password_temporal);
            t[k] = l.body.token;
            t[`admin_${k}`] = l.body.usuario?.id || l.body.user?.id;
        }
        t.cliente = (await q(`INSERT INTO clientes (nombre, cedula, empresa_id) VALUES ('Cliente TEST29', '1700000029', $1) RETURNING id`, [t.emp_a])).rows[0].id;
    });

    afterAll(async () => {
        if (server) await new Promise(ok => server.close(ok));
        if (pool) { await limpiar(); await pool.end(); }
    });

    test('opciones: el administrador es cajero; el de otra empresa no puede ser cajero', async () => {
        const r = await api('GET', '/caja/opciones', { token: t.a });
        expect(r.status).toBe(200);
        const ids = r.body.cajeros.map(u => u.id);
        expect(ids).toContain(t.admin_a);
        expect(ids).not.toContain(t.admin_b);
        const mal = await api('POST', '/caja/apertura', { token: t.a, body: { monto_apertura: 0.10, cajero_id: t.admin_b } });
        expect(mal.status).toBe(400);
    });

    test('caja completa: ventas, movimientos, anulacion, anticipo y cierre con declaracion', async () => {
        const ab = await api('POST', '/caja/apertura', { token: t.a, body: { monto_apertura: 0.10, cajero_id: t.admin_a, notas_apertura: 'Turno TEST29' } });
        expect(ab.status).toBe(201);
        t.s1 = ab.body.id;
        expect(ab.body.cajero_id).toBe(t.admin_a);

        // Ventas: 20 en efectivo, 4 a crédito, 10 con tarjeta de débito.
        await pagar(await pagare(20, 'Venta efectivo TEST29'), 20);
        t.credito = await pagare(4, 'Venta crédito TEST29');
        await pagar(await pagare(10, 'Venta tarjeta TEST29'), 10, { metodo_pago: 'tarjeta', tarjeta_tipo: 'debito', autorizacion: 'AUT29' });

        // Movimientos manuales: salida 5, entrada 14.05 y una entrada de 1 que se anula.
        expect((await api('POST', '/caja/movimientos', { token: t.a, body: { tipo: 'egreso', concepto: '2 almuerzos', monto: 5 } })).status).toBe(201);
        expect((await api('POST', '/caja/movimientos', { token: t.a, body: { tipo: 'ingreso', concepto: 'Sencillo', monto: 14.05 } })).status).toBe(201);
        const err = await api('POST', '/caja/movimientos', { token: t.a, body: { tipo: 'ingreso', concepto: 'Por error', monto: 1 } });
        expect((await api('POST', `/caja/movimientos/${err.body.id}/anular`, { token: t.a, body: { motivo: '' } })).status).toBe(400);
        const an = await api('POST', `/caja/movimientos/${err.body.id}/anular`, { token: t.a, body: { motivo: 'Registrado por error' } });
        expect(an.status).toBe(200);
        expect(an.body.anulado_at).toBeTruthy();
        expect((await api('POST', `/caja/movimientos/${err.body.id}/anular`, { token: t.a, body: { motivo: 'otra vez' } })).status).toBe(409);
        // Otra empresa no puede anular movimientos ajenos.
        expect((await api('POST', `/caja/movimientos/${err.body.id}/anular`, { token: t.b, body: { motivo: 'ajeno' } })).status).toBe(404);

        // Anticipo de cliente en efectivo (Finanzas) a la caja.
        const act = await api('GET', '/caja/actual', { token: t.a });
        const mov = await api('POST', '/finanzas/movimientos', { token: t.a, body: { tipo: 'ingreso', categoria: 'anticipo_cliente', monto: 3,
            cuenta_dinero_id: act.body.caja.id, metodo_pago: 'efectivo', descripcion: 'Anticipo TEST29' } });
        expect(mov.status).toBe(201);

        // Esperado: 0.10 + 20 + 14.05 + 3 - 5 = 32.15 (la entrada anulada no cuenta).
        const actual = await api('GET', '/caja/actual', { token: t.a });
        expect(actual.body.totales.saldo).toBeCloseTo(32.15, 2);
        expect(actual.body.por_metodo.tarjeta_debito.ingresos).toBeCloseTo(10, 2);

        const pre = await api('GET', `/caja/sesiones/${t.s1}/reporte`, { token: t.a });
        expect(pre.status).toBe(200);
        expect(pre.body.cerrada).toBe(false);
        expect(pre.body.efectivo.esperado).toBeCloseTo(32.15, 2);

        // Cierre: se cuentan 37.05 y se declaran tarjeta 10, cheques 2 y una retención.
        const ci = await api('POST', '/caja/cierre', { token: t.a, body: {
            denominaciones: { '20': 1, '10': 1, '5': 1, '1': 2, '0.05': 1 },
            declaracion: { tarjeta_debito: 10, cheque: 2, retencion_fuente: 0.5 }, notas_cierre: 'Cierre TEST29' } });
        expect(ci.status).toBe(200);
        expect(Number(ci.body.monto_cierre_real)).toBeCloseTo(37.05, 2);
        expect(Number(ci.body.diferencia)).toBeCloseTo(4.90, 2);
        expect(ci.body.ajuste_cierre_id).toBeTruthy();
        expect(ci.body.declaracion_cierre).toMatchObject({ efectivo: 37.05, tarjeta_debito: 10, cheque: 2, retencion_fuente: 0.5 });
        expect((await api('POST', '/caja/cierre', { token: t.a, body: { monto_cierre_real: 1, declaracion: { cheque: -1 } } })).status).toBe(400);
    });

    test('reporte de la caja cerrada: cuadre, formas de pago, ventas, crédito y anticipos', async () => {
        const r = await api('GET', `/caja/sesiones/${t.s1}/reporte`, { token: t.a });
        expect(r.status).toBe(200);
        const rep = r.body;
        expect(rep.cerrada).toBe(true);
        expect(rep.sesion.cajero_nombre).toBe('Admin a');
        expect(rep.efectivo).toMatchObject({ apertura: 0.1, esperado: 32.15, contado: 37.05, diferencia: 4.9 });
        const forma = (k) => rep.formas.find(f => f.codigo === k);
        expect(forma('tarjeta_debito')).toMatchObject({ sistema: 10, declarado: 10, diferencia: 0 });
        expect(forma('cheque')).toMatchObject({ sistema: 0, declarado: 2, diferencia: 2 });
        expect(rep.retenciones.find(x => x.codigo === 'retencion_fuente').declarado).toBe(0.5);

        expect(rep.ventas).toHaveLength(3);
        expect(rep.totales.ventas).toBeCloseTo(34, 2);
        expect(rep.documentos).toEqual([{ tipo: 'PAGARÉ', cantidad: 3, total: 34 }]);
        expect(rep.por_vendedor).toEqual([{ vendedor: 'Admin a', cantidad: 3, total: 34 }]);
        expect(rep.ventas_credito.map(v => v.total)).toEqual([4]);
        expect(rep.anticipos.map(a => a.monto)).toEqual([3]);
        const ing = Object.fromEntries(rep.ingresos_sistema.map(f => [f.forma, f.total]));
        expect(ing).toEqual({ efectivo: 23, tarjeta_debito: 10, credito: 4 });
        expect(rep.movimientos_manuales).toHaveLength(3);
        expect(rep.movimientos_manuales.filter(m => m.anulado_at)).toHaveLength(1);
        expect(rep.totales).toMatchObject({ manuales_ingresos: 14.05, manuales_egresos: 5, por_cobrar: 4 });
        // Apertura escrita a mano y conteo del cierre por billetes y monedas.
        expect(rep.apertura).toMatchObject({ monto: 0.1, forma: 'efectivo', contada: false, conteo: [] });
        expect(rep.conteo_cierre.map(c => [c.valor, c.cantidad])).toEqual([[20, 1], [10, 1], [5, 1], [1, 2], [0.05, 1]]);
        // Por cobrar: la venta a credito; ingresos y egresos de todo el periodo por forma de pago.
        expect(rep.por_cobrar.map(v => v.pendiente)).toEqual([4]);
        expect(rep.totales).toMatchObject({ ingresos_periodo: 47.05, egresos_periodo: 5 });
        const din = Object.fromEntries(rep.resumen_dinero.map(x => [x.forma, [x.ingresos, x.egresos]]));
        expect(din).toEqual({ efectivo: [37.05, 5], tarjeta_debito: [10, 0] });
        expect(rep.movimientos_dinero.every(m => ['ingreso', 'egreso'].includes(m.tipo))).toBe(true);

        // Otra empresa no ve esta caja.
        expect((await api('GET', `/caja/sesiones/${t.s1}/reporte`, { token: t.b })).status).toBe(404);
    });

    test('PDF, Excel y listado con filtros (aislado por empresa)', async () => {
        const pdf = await api('GET', `/caja/sesiones/${t.s1}/pdf?ver=1`, { token: t.a });
        expect(pdf.status).toBe(200);
        expect(pdf.tipo).toContain('application/pdf');
        expect(pdf.body.slice(0, 4).toString()).toBe('%PDF');

        const xls = await api('GET', '/caja/sesiones/excel?estado=cerrada', { token: t.a });
        expect(xls.status).toBe(200);
        expect(xls.body.slice(0, 2).toString()).toBe('PK');

        const l = await api('GET', '/caja/sesiones?q=Admin&estado=cerrada', { token: t.a });
        expect(l.status).toBe(200);
        expect(l.body.total).toBe(1);
        expect(l.body.sesiones[0]).toMatchObject({ id: t.s1, cajero_nombre: 'Admin a', puede_reabrir: true });
        expect((await api('GET', '/caja/sesiones?estado=abierta', { token: t.a })).body.total).toBe(0);
        expect((await api('GET', '/caja/sesiones', { token: t.b })).body.total).toBe(0);
    });

    test('reabrir: anula el ajuste del cierre, guarda el historial y se puede volver a cerrar', async () => {
        expect((await api('POST', `/caja/sesiones/${t.s1}/reabrir`, { token: t.a, body: {} })).status).toBe(400);
        const r = await api('POST', `/caja/sesiones/${t.s1}/reabrir`, { token: t.a, body: { motivo: 'Faltó registrar un cobro' } });
        expect(r.status).toBe(200);
        expect(r.body.estado).toBe('abierta');
        expect(r.body.reaperturas).toHaveLength(1);
        expect(Number(r.body.reaperturas[0].cierre.diferencia)).toBeCloseTo(4.9, 2);
        const aj = await q('SELECT anulado_at FROM movimientos_dinero WHERE id = $1', [r.body.reaperturas[0].cierre.ajuste_anulado_id]);
        expect(aj.rows[0].anulado_at).toBeTruthy();
        // Vuelve a esperar lo que dice el sistema (el sobrante del cierre ya no cuenta).
        expect((await api('GET', '/caja/actual', { token: t.a })).body.totales.saldo).toBeCloseTo(32.15, 2);
        expect((await api('POST', `/caja/sesiones/${t.s1}/reabrir`, { token: t.a, body: { motivo: 'otra vez' } })).status).toBe(409);

        const ci = await api('POST', '/caja/cierre', { token: t.a, body: { monto_cierre_real: 32.15 } });
        expect(ci.status).toBe(200);
        expect(Number(ci.body.diferencia)).toBeCloseTo(0, 2);
    });

    test('segunda caja: recaudación de la deuda anterior y ya no se puede reabrir la primera', async () => {
        const ab = await api('POST', '/caja/apertura', { token: t.a, body: { monto_apertura: 32.15 } });
        expect(ab.status).toBe(201);
        t.s2 = ab.body.id;
        await pagar(t.credito, 4);
        const rep = (await api('GET', `/caja/sesiones/${t.s2}/reporte`, { token: t.a })).body;
        expect(rep.ventas).toHaveLength(0);
        expect(rep.recaudaciones).toHaveLength(1);
        expect(rep.recaudaciones[0]).toMatchObject({ cobrado: 4, forma: 'efectivo', total_documento: 4 });
        expect(rep.efectivo.esperado).toBeCloseTo(36.15, 2);
        // Sin ventas, el credito (por cobrar) igual aparece en $0.00.
        expect(rep.ingresos_sistema.find(f => f.forma === 'credito')).toMatchObject({ total: 0 });

        // Proforma aprobada sin pagare ni pagos: es una venta por cobrar de esta caja.
        const pf = (await q(`INSERT INTO proformas (numero, tipo, cliente_nombre, cliente_id, total, estado, empresa_id, usuario_id)
                              VALUES ('PF-TEST29', 'mecanica', 'Cliente TEST29', $1, 50, 'emitida', $2, $3) RETURNING id`,
                            [t.cliente, t.emp_a, t.admin_a])).rows[0].id;
        await q(`UPDATE proformas SET estado = 'aprobada' WHERE id = $1`, [pf]);
        const rep2 = (await api('GET', `/caja/sesiones/${t.s2}/reporte`, { token: t.a })).body;
        expect(rep2.ventas).toEqual([expect.objectContaining({ tipo: 'PROFORMA', numero: 'Proforma PF-TEST29', total: 50, pendiente: 50 })]);
        expect(rep2.por_cobrar).toHaveLength(1);
        expect(rep2.ingresos_sistema.find(f => f.forma === 'credito')).toMatchObject({ total: 50, cantidad: 1 });
        expect(rep2.ventas_credito.map(v => v.total)).toEqual([50]);
        // Vuelve a "emitida": deja de ser venta.
        await q(`UPDATE proformas SET estado = 'emitida' WHERE id = $1`, [pf]);
        expect((await q('SELECT aprobada_at FROM proformas WHERE id = $1', [pf])).rows[0].aprobada_at).toBeNull();
        expect((await api('GET', `/caja/sesiones/${t.s2}/reporte`, { token: t.a })).body.ventas).toHaveLength(0);

        expect((await api('POST', `/caja/sesiones/${t.s1}/reabrir`, { token: t.a, body: { motivo: 'tarde' } })).status).toBe(409);
        const ci = await api('POST', '/caja/cierre', { token: t.a, body: { monto_cierre_real: 36.15 } });
        expect(ci.status).toBe(200);
        expect((await api('POST', `/caja/sesiones/${t.s1}/reabrir`, { token: t.a, body: { motivo: 'tarde' } })).status).toBe(409);
        const l = await api('GET', '/caja/sesiones', { token: t.a });
        expect(l.body.sesiones.find(s => s.id === t.s2).puede_reabrir).toBe(true);
        expect(l.body.sesiones.find(s => s.id === t.s1).puede_reabrir).toBe(false);
    });
});
