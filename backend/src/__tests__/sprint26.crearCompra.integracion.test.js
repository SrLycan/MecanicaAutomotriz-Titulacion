/**
 * SS SWAP - Pruebas de INTEGRACION del Sprint 26 ("Crear compra" con datos
 * del comprobante) con peticiones HTTP reales contra PostgreSQL.
 *
 *   PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest sprint26
 *
 * ¡NUNCA apuntar a produccion! Crea dos empresas "TEST26 ..." y las borra al
 * terminar. El SRI se reemplaza por el servidor SOAP local de pruebas.
 */
const RUN = process.env.PG_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-integracion-sprint26';

const RUC_A = '1790000026001';
const RUC_PROV = '0990000026001';

d('Sprint 26 - crear compra con documento, tipo de registro y sustento (HTTP)', () => {
    let pool, server, base, sri;
    const t = {};
    let ip = 0;
    let secuencial = 500;

    const api = async (metodo, ruta, { token, body, headers = {} } = {}) => {
        const r = await fetch(`${base}/api${ruta}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.26.${Math.floor(++ip / 250)}.${ip % 250}`,
                ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
            body: body && metodo !== 'GET' ? JSON.stringify(body) : undefined,
        });
        const tipo = r.headers.get('content-type') || '';
        return { status: r.status, body: tipo.includes('json') ? await r.json() : await r.text() };
    };
    const login = async (email, password) => api('POST', '/auth/login', { body: { email, password, panel: 'staff' } });
    const q = (sql, params) => require('../config/contexto').sinAislamiento(() => pool.query(sql, params));
    const stock = async (id) => Number((await q('SELECT stock_actual FROM repuestos WHERE id = $1', [id])).rows[0].stock_actual);

    function facturaProveedor({ lineas }) {
        const { construirXml } = require('../sri/xml');
        const { calcularComprobante } = require('../sri/calculos');
        const { generarClaveAcceso } = require('../sri/claveAcceso');
        const { firmarComprobante } = require('../sri/firma');
        const { certificadoPrueba } = require('../test-utils/certificadoPrueba');
        const sec = ++secuencial;
        const calc = calcularComprobante(lineas.map(l => ({ iva_codigo: '4', ...l })), {});
        const c = {
            codDoc: '01', ambiente: 2,
            claveAcceso: generarClaveAcceso({ fechaEmision: '2026-10-10', codDoc: '01', ruc: RUC_PROV, ambiente: 2, establecimiento: '001', puntoEmision: '002', secuencial: sec, codigo: '26262626' }),
            establecimiento: '001', puntoEmision: '002', secuencial: String(sec).padStart(9, '0'), fechaEmision: '2026-10-10',
            emisor: { razonSocial: 'DISTRIBUIDORA TEST26 S.A.', ruc: RUC_PROV, dirMatriz: 'Quito', dirEstablecimiento: 'Quito', obligadoContabilidad: true, regimen: 'general' },
            comprador: { tipoIdentificacion: '04', razonSocial: 'TEST26 TALLER', identificacion: RUC_A, direccion: 'Quito' },
            ...calc, pagos: [{ formaPago: '20', total: calc.importeTotal }],
        };
        const { p12, clave } = certificadoPrueba({ ruc: RUC_PROV });
        return { clave: c.claveAcceso, xml: firmarComprobante(construirXml(c), p12, clave), total: calc.importeTotal, numero: `001-002-${String(sec).padStart(9, '0')}` };
    }

    async function limpiar() {
        const c = await pool.connect();
        try {
            await c.query('BEGIN');
            await c.query(`SET LOCAL session_replication_role = replica`); // sin triggers ni FK: solo pruebas
            const { rows } = await c.query(`SELECT id FROM empresas WHERE slug LIKE 'test26-%'`);
            const ids = rows.map(r => r.id);
            if (ids.length) {
                const { TODAS_TABLAS_EMPRESA } = require('../config/multiempresa');
                for (const tabla of TODAS_TABLAS_EMPRESA) await c.query(`DELETE FROM ${tabla} WHERE empresa_id = ANY($1)`, [ids]);
                await c.query(`DELETE FROM accesos_soporte WHERE empresa_id = ANY($1)`, [ids]);
                await c.query(`DELETE FROM empresas WHERE id = ANY($1)`, [ids]);
            }
            await c.query(`DELETE FROM usuario_permisos WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE 'test26-%')`);
            await c.query(`DELETE FROM usuarios WHERE email LIKE 'test26-%'`);
            await c.query('COMMIT');
        } finally { c.release(); }
    }

    beforeAll(async () => {
        sri = await require('../test-utils/sriLocal').iniciarSriLocal();
        process.env.SRI_WS_PRODUCCION = sri.url;
        process.env.SRI_WS_PRUEBAS = sri.url;
        process.env.SRI_TIMEOUT_MS = '3000';
        pool = require('../config/db');
        await limpiar();

        const express = require('express');
        const app = express();
        app.set('trust proxy', 1);
        app.use(express.json({ limit: '10mb' }));
        const { contextoPublico, registrarErrores } = require('../middleware/empresa.middleware');
        app.use('/api', registrarErrores, contextoPublico);
        for (const r of ['auth', 'proveedores', 'plataforma', 'inventory']) app.use(`/api/${r}`, require(`../routes/${r}.routes`));
        await new Promise(ok => { server = app.listen(0, ok); });
        base = `http://127.0.0.1:${server.address().port}`;

        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('Prueba-Segura-2026', 10);
        const c = await pool.connect();
        try {
            await c.query('BEGIN');
            await c.query(`SELECT set_config('ssswap.gestion_superadmin', 'on', true)`);
            await c.query(`INSERT INTO usuarios (nombre, email, password, rol, permisos_inicializados) VALUES ('TEST26 Plataforma', 'test26-plataforma@x.test', $1, 'superadministrador', TRUE)`, [hash]);
            await c.query('COMMIT');
        } finally { c.release(); }
        const plat = (await login('test26-plataforma@x.test', 'Prueba-Segura-2026')).body.token;
        for (const [k, ruc] of [['a', RUC_A], ['b', '1790000026002']]) {
            const r = await api('POST', '/plataforma/empresas', { token: plat, body: { nombre: `TEST26 Taller ${k}`, slug: `test26-${k}`, ruc,
                admin: { nombre: `Admin ${k}`, email: `test26-admin-${k}@x.test` } } });
            expect(r.status).toBe(201);
            t[`emp_${k}`] = r.body.empresa.id;
            t[k] = (await login(`test26-admin-${k}@x.test`, r.body.password_temporal)).body.token;
        }
        const prov = await api('POST', '/proveedores/proveedores', { token: t.a, body: { nombre_comercial: 'Distribuidora TEST26', ruc: RUC_PROV } });
        expect(prov.status).toBe(201);
        t.prov = prov.body.proveedor.id;
        const rep = await api('POST', '/inventory/repuestos', { token: t.a, body: { nombre: 'Bujía TEST26', area: 'mecanica', stock_actual: 4, precio_compra: 2, precio_venta: 5 } });
        expect(rep.status).toBe(201);
        t.bujia = rep.body.id;
    });

    afterAll(async () => {
        if (server) await new Promise(ok => server.close(ok));
        if (sri) await sri.cerrar();
        if (pool) { await limpiar(); await pool.end(); }
    });

    test('nota de venta: se registra recibida, suma al inventario, IVA 0% y guarda documento y sustento', async () => {
        const r = await api('POST', '/proveedores/compras', { token: t.a, body: {
            proveedor_id: t.prov, tipo_documento: 'nota_venta', numero_documento: '1-1-456', fecha_solicitud: '2026-10-11',
            forma_pago: 'credito', fecha_vencimiento: '2026-11-30', area: 'mecanica', tipo_registro: 'inventario',
            items: [{ repuesto_id: t.bujia, descripcion: 'Bujías', cantidad: 3, precio_unitario: 2.5 }] } });
        expect(r.status).toBe(201);
        const c = r.body.compra;
        expect(c).toMatchObject({ estado: 'recibida', tipo_documento: 'nota_venta', numero_documento: '001-001-000000456', area: 'mecanica', sustento_tributario: '06', forma_pago: 'credito' });
        expect(Number(c.total)).toBeCloseTo(7.5, 2);   // nota de venta: sin IVA por defecto
        expect(await stock(t.bujia)).toBe(7);
        t.nv = c.id;
        const det = await api('GET', `/proveedores/compras/${c.id}`, { token: t.a });
        expect(det.body.compra.totales).toMatchObject({ subtotal_iva: 0, subtotal_0: 7.5, total: 7.5 });
        expect(String(det.body.compra.fecha_vencimiento).slice(0, 10)).toBe('2026-11-30');
        expect(det.body.compra.items[0]).toMatchObject({ repuesto_codigo: expect.any(String) });
        // El costo de compra del producto queda actualizado con el último costo.
        expect(Number((await q('SELECT precio_compra FROM repuestos WHERE id = $1', [t.bujia])).rows[0].precio_compra)).toBeCloseTo(2.5, 2);
    });

    test('mismo documento del mismo proveedor: "Ya existe un registro" (409) y el stock no cambia', async () => {
        const ver = await api('GET', `/proveedores/compras/documento?proveedor_id=${t.prov}&tipo_documento=nota_venta&numero_documento=001-001-456`, { token: t.a });
        expect(ver.body).toMatchObject({ existe: true, compra_id: t.nv, numero_documento: '001-001-000000456' });
        const r = await api('POST', '/proveedores/compras', { token: t.a, body: {
            proveedor_id: t.prov, tipo_documento: 'nota_venta', numero_documento: '001-001-000000456',
            items: [{ repuesto_id: t.bujia, descripcion: 'Bujías', cantidad: 3, precio_unitario: 2.5 }] } });
        expect(r.status).toBe(409);
        expect(r.body).toMatchObject({ codigo: 'DOCUMENTO_DUPLICADO', compra_id: t.nv });
        expect(await stock(t.bujia)).toBe(7);
        // Otra empresa no ve ese documento.
        const b = await api('GET', `/proveedores/compras/documento?proveedor_id=${t.prov}&tipo_documento=nota_venta&numero_documento=001-001-456`, { token: t.b });
        expect(b.body.existe).toBe(false);
        expect((await api('GET', `/proveedores/compras/${t.nv}`, { token: t.b })).status).toBe(404);
    });

    test('orden de compra: queda pendiente sin tocar stock y suma al marcarla recibida', async () => {
        const r = await api('POST', '/proveedores/compras', { token: t.a, body: {
            proveedor_id: t.prov, forma_pago: 'credito', items: [{ repuesto_id: t.bujia, descripcion: 'Bujías pedido', cantidad: 2, precio_unitario: 2 }] } });
        expect(r.status).toBe(201);
        expect(r.body.compra).toMatchObject({ estado: 'pendiente', tipo_documento: 'orden', numero_documento: null });
        expect(Number(r.body.compra.total)).toBeCloseTo(4.6, 2);  // 15% por defecto
        expect(await stock(t.bujia)).toBe(7);
        // Como en el panel: al recibir se indican las cantidades que llegaron.
        const rec = await api('PATCH', `/proveedores/compras/${r.body.compra.id}/estado`, { token: t.a, body: { estado: 'recibida',
            cantidades_recibidas: r.body.compra.items.map(i => ({ item_id: i.id, cantidad_recibida: 2 })) } });
        expect(rec.status).toBe(200);
        expect(await stock(t.bujia)).toBe(9);
    });

    test('compra registrada como gasto: no suma al inventario aunque el item tenga producto', async () => {
        const r = await api('POST', '/proveedores/compras', { token: t.a, body: {
            proveedor_id: t.prov, tipo_documento: 'otro', numero_documento: '002-001-77', tipo_registro: 'gasto', forma_pago: 'contado', metodo_pago: 'efectivo',
            items: [{ repuesto_id: t.bujia, descripcion: 'Consumo interno', cantidad: 5, precio_unitario: 1 }] } });
        expect(r.status).toBe(201);
        expect(r.body.compra).toMatchObject({ estado: 'recibida', tipo_registro: 'gasto', sustento_tributario: '01' });
        expect(r.body.stock_actualizado).toEqual([]);
        expect(await stock(t.bujia)).toBe(9);
    });

    test('validaciones: número, sustento, vencimiento anterior a la emisión e inventario inválidos', async () => {
        const baseC = { proveedor_id: t.prov, items: [{ descripcion: 'X', cantidad: 1, precio_unitario: 1 }] };
        const casos = [
            { tipo_documento: 'nota_venta' },                                            // falta número
            { tipo_documento: 'nota_venta', numero_documento: '1-2' },                   // incompleto
            { tipo_documento: 'nota_venta', numero_documento: '1-1-0' },                 // secuencial 0
            { tipo_documento: 'nota_venta', numero_documento: '1-1-9', sustento_tributario: '99' },
            { forma_pago: 'credito', fecha_solicitud: '2026-10-10', fecha_vencimiento: '2026-10-01' },
            { area: 'no-existe' },
            { tipo_registro: 'raro' },
        ];
        for (const extra of casos) {
            const r = await api('POST', '/proveedores/compras', { token: t.a, body: { ...baseC, ...extra } });
            expect([r.status, extra]).toEqual([400, extra]);
        }
    });

    test('factura del SRI: guarda documento, vencimiento, tipo de registro, sustento e IVA por artículo; no se repite a mano', async () => {
        const f = facturaProveedor({ lineas: [
            { codigo: 'B-1', descripcion: 'Bujía iridio', cantidad: 2, precio_unitario: 10 },
            { codigo: 'MAN', descripcion: 'Manual impreso', cantidad: 1, precio_unitario: 4, iva_codigo: '0' },
        ] });
        sri.registrar(f.clave, { estado: 'AUTORIZADO', xml: f.xml });
        const c = await api('POST', '/proveedores/facturas-compra/consultar', { token: t.a, body: { clave_acceso: f.clave } });
        expect(c.status).toBe(201);
        const fa = c.body.factura;
        const antes = await stock(t.bujia);
        // Vencimiento anterior a la emisión: rechazado.
        const malo = await api('POST', `/proveedores/facturas-compra/${fa.id}/confirmar`, { token: t.a, body: {
            proveedor_id: t.prov, forma_pago: 'credito', fecha_vencimiento: '2026-10-01', aceptar_advertencias: true,
            lineas: fa.detalles.map(x => ({ detalle_id: x.id, accion: 'omitir' })) } });
        expect(malo.status).toBe(400);
        const ok = await api('POST', `/proveedores/facturas-compra/${fa.id}/confirmar`, { token: t.a, body: {
            proveedor_id: t.prov, forma_pago: 'credito', fecha_vencimiento: '2026-12-15', area: 'mecanica', tipo_registro: 'inventario', sustento_tributario: '07',
            aceptar_advertencias: true,
            lineas: [{ detalle_id: fa.detalles[0].id, accion: 'existente', repuesto_id: t.bujia }, { detalle_id: fa.detalles[1].id, accion: 'omitir' }] } });
        expect(ok.status).toBe(200);
        expect(await stock(t.bujia)).toBe(antes + 2);
        const compraId = ok.body.resultado.compra_id;
        const det = (await api('GET', `/proveedores/compras/${compraId}`, { token: t.a })).body.compra;
        expect(det).toMatchObject({ tipo_documento: 'factura', numero_documento: f.numero, area: 'mecanica', tipo_registro: 'inventario', sustento_tributario: '07' });
        expect(String(det.fecha_vencimiento).slice(0, 10)).toBe('2026-12-15');
        expect(det.factura).toMatchObject({ id: fa.id, clave_acceso: f.clave });
        expect(det.items.map(i => Number(i.iva_porcentaje)).sort()).toEqual([0, 15]);
        expect(det.totales).toMatchObject({ subtotal_iva: 20, subtotal_0: 4 });
        // La misma factura ingresada a mano (por número) no vuelve a registrarse.
        const mano = await api('POST', '/proveedores/compras', { token: t.a, body: {
            proveedor_id: t.prov, tipo_documento: 'factura', numero_documento: f.numero, items: [{ repuesto_id: t.bujia, descripcion: 'Bujía', cantidad: 2, precio_unitario: 10 }] } });
        expect(mano.status).toBe(409);
        expect(mano.body.codigo).toBe('DOCUMENTO_DUPLICADO');
        expect(await stock(t.bujia)).toBe(antes + 2);
    });

    test('lista: resumen (valor y cantidad sin canceladas), búsqueda por número y filtro por inventario', async () => {
        const todas = await api('GET', '/proveedores/compras?limit=100', { token: t.a });
        expect(todas.status).toBe(200);
        const validas = todas.body.compras.filter(c => c.estado !== 'cancelada');
        expect(todas.body.resumen.cantidad).toBe(validas.length);
        expect(todas.body.resumen.valor).toBeCloseTo(validas.reduce((s, c) => s + Number(c.total), 0), 2);
        const porNumero = await api('GET', '/proveedores/compras?q=000000456', { token: t.a });
        expect(porNumero.body.compras.map(c => c.id)).toEqual([t.nv]);
        const porArea = await api('GET', '/proveedores/compras?area=colisiones', { token: t.a });
        expect(porArea.body.total).toBe(0);
        const desde = await api('GET', '/proveedores/compras?desde=2099-01-01', { token: t.a });
        expect(desde.body).toMatchObject({ total: 0, resumen: { valor: 0, cantidad: 0 } });
        // B no ve las compras de A.
        expect((await api('GET', '/proveedores/compras', { token: t.b })).body.total).toBe(0);
        // Catálogo de sustentos.
        const cat = await api('GET', '/proveedores/compras/catalogos', { token: t.a });
        expect(cat.body.sustentos).toHaveLength(16);
    });

    test('editar sustento y notas sin tocar montos ni inventario', async () => {
        const antes = await stock(t.bujia);
        const r = await api('PUT', `/proveedores/compras/${t.nv}`, { token: t.a, body: { sustento_tributario: '07', notas: 'Revisado' } });
        expect(r.status).toBe(200);
        expect(r.body.compra).toMatchObject({ sustento_tributario: '07', notas: 'Revisado' });
        expect((await api('PUT', `/proveedores/compras/${t.nv}`, { token: t.a, body: { sustento_tributario: '42' } })).status).toBe(400);
        expect(await stock(t.bujia)).toBe(antes);
    });
});
