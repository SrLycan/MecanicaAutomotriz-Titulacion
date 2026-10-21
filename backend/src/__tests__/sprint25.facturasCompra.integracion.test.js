/**
 * SS SWAP - Pruebas de INTEGRACION del Sprint 25 (facturas de compra que
 * alimentan el inventario) con peticiones HTTP reales contra PostgreSQL.
 *
 *   PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest sprint25
 *
 * ¡NUNCA apuntar a produccion! Crea dos empresas "TEST25 ..." y las borra al
 * terminar. El SRI se reemplaza por un servidor SOAP LOCAL (test-utils/
 * sriLocal.js) con el mismo formato de respuesta: el codigo de produccion
 * (soap.js, lector de XML, servicio) se ejecuta completo sin enviar nada al SRI.
 * Las facturas de los "proveedores" se generan con el mismo constructor XML
 * y la misma firma XAdES que usa la facturacion propia (validos con el XSD).
 *
 * Cubre los 20 escenarios pedidos (numerados en cada prueba).
 */
const RUN = process.env.PG_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-integracion-sprint25';

const RUC_A = '1790000025001';
const RUC_PROV = '0990000025001';
const RUC_PROV2 = '0990000025002';

d('Sprint 25 - facturas de compra e inventario (HTTP)', () => {
    let pool, server, base, sri;
    const t = {};
    let ip = 0;
    let secuencial = 100;

    const api = async (metodo, ruta, { token, body, headers = {} } = {}) => {
        const r = await fetch(`${base}/api${ruta}`, {
            method: metodo,
            headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.25.${Math.floor(++ip / 250)}.${ip % 250}`,
                ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
            body: body && metodo !== 'GET' ? JSON.stringify(body) : undefined,
        });
        const tipo = r.headers.get('content-type') || '';
        return { status: r.status, body: tipo.includes('json') ? await r.json() : await r.text() };
    };
    const login = async (email, password) => api('POST', '/auth/login', { body: { email, password, panel: 'staff' } });
    const q = (sql, params) => require('../config/contexto').sinAislamiento(() => pool.query(sql, params));

    /** Factura electronica firmada de un proveedor (real: XSD 1.1.0 + XAdES-BES). */
    function facturaProveedor({ ruc = RUC_PROV, comprador = RUC_A, lineas, ambiente = 2 }) {
        const { construirXml } = require('../sri/xml');
        const { calcularComprobante } = require('../sri/calculos');
        const { generarClaveAcceso } = require('../sri/claveAcceso');
        const { firmarComprobante } = require('../sri/firma');
        const { certificadoPrueba } = require('../test-utils/certificadoPrueba');
        const sec = ++secuencial;
        const calc = calcularComprobante(lineas.map(l => ({ iva_codigo: '4', ...l })), {});
        const c = {
            codDoc: '01', ambiente,
            claveAcceso: generarClaveAcceso({ fechaEmision: '2026-10-10', codDoc: '01', ruc, ambiente, establecimiento: '001', puntoEmision: '002', secuencial: sec, codigo: '25252525' }),
            establecimiento: '001', puntoEmision: '002', secuencial: String(sec).padStart(9, '0'), fechaEmision: '2026-10-10',
            emisor: { razonSocial: 'DISTRIBUIDORA TEST25 S.A.', ruc, dirMatriz: 'Guayaquil', dirEstablecimiento: 'Guayaquil', obligadoContabilidad: true, regimen: 'general' },
            comprador: { tipoIdentificacion: '04', razonSocial: 'TEST25 TALLER ANDES', identificacion: comprador, direccion: 'Quito' },
            ...calc, pagos: [{ formaPago: '20', total: calc.importeTotal }],
        };
        const { p12, clave } = certificadoPrueba({ ruc });
        return { clave: c.claveAcceso, xml: firmarComprobante(construirXml(c), p12, clave), total: calc.importeTotal };
    }
    const stock = async (id) => Number((await q('SELECT stock_actual FROM repuestos WHERE id = $1', [id])).rows[0].stock_actual);
    const movs = async (empresa) => Number((await q('SELECT COUNT(*) FROM movimientos_inventario WHERE empresa_id = $1', [empresa])).rows[0].count);

    async function limpiar() {
        const c = await pool.connect();
        try {
            await c.query('BEGIN');
            await c.query(`SET LOCAL session_replication_role = replica`); // sin triggers ni FK: solo pruebas
            const { rows } = await c.query(`SELECT id FROM empresas WHERE slug LIKE 'test25-%'`);
            const ids = rows.map(r => r.id);
            if (ids.length) {
                const { TODAS_TABLAS_EMPRESA } = require('../config/multiempresa');
                for (const tabla of TODAS_TABLAS_EMPRESA) await c.query(`DELETE FROM ${tabla} WHERE empresa_id = ANY($1)`, [ids]);
                await c.query(`DELETE FROM accesos_soporte WHERE empresa_id = ANY($1)`, [ids]);
                await c.query(`DELETE FROM empresas WHERE id = ANY($1)`, [ids]);
            }
            await c.query(`DELETE FROM usuario_permisos WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE 'test25-%')`);
            await c.query(`DELETE FROM usuarios WHERE email LIKE 'test25-%'`);
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
        // Huella de los datos que NO son de estas pruebas (escenario 19).
        t.huella = (await q(`SELECT md5(string_agg(to_jsonb(m)::text, '' ORDER BY id)) AS h FROM movimientos_inventario m`)).rows[0].h;
        t.huellaRep = (await q(`SELECT md5(string_agg(to_jsonb(r)::text, '' ORDER BY id)) AS h FROM repuestos r`)).rows[0].h;

        const express = require('express');
        const app = express();
        app.set('trust proxy', 1);
        app.use(express.json({ limit: '10mb' }));
        const { contextoPublico, registrarErrores } = require('../middleware/empresa.middleware');
        app.use('/api', registrarErrores, contextoPublico);
        for (const r of ['auth', 'ordenes', 'proveedores', 'proformas', 'plataforma', 'empresa', 'inventory'])
            app.use(`/api/${r}`, require(`../routes/${r}.routes`));
        await new Promise(ok => { server = app.listen(0, ok); });
        base = `http://127.0.0.1:${server.address().port}`;

        const bcrypt = require('bcryptjs');
        const PASS = 'Prueba-Segura-2026';
        const hash = await bcrypt.hash(PASS, 10);
        const c = await pool.connect();
        try {
            await c.query('BEGIN');
            await c.query(`SELECT set_config('ssswap.gestion_superadmin', 'on', true)`);
            await c.query(`INSERT INTO usuarios (nombre, email, password, rol, permisos_inicializados) VALUES ('TEST25 Plataforma', 'test25-plataforma@x.test', $1, 'superadministrador', TRUE)`, [hash]);
            await c.query('COMMIT');
        } finally { c.release(); }
        const plat = (await login('test25-plataforma@x.test', PASS)).body.token;
        for (const [k, nombre, ruc] of [['a', 'TEST25 Taller Andes', RUC_A], ['b', 'TEST25 Taller Brisa', '1790000025002']]) {
            const r = await api('POST', '/plataforma/empresas', { token: plat, body: { nombre, slug: `test25-${k}`, ruc,
                admin: { nombre: `Admin ${nombre}`, email: `test25-admin-${k}@x.test` } } });
            expect(r.status).toBe(201);
            t[`emp_${k}`] = r.body.empresa.id;
            const l = await login(`test25-admin-${k}@x.test`, r.body.password_temporal);
            t[k] = l.body.token;
        }
        // Usuarios limitados de A: solo ver proveedores; y comprar sin poder mover inventario.
        const { PLANTILLAS } = require('../config/permisos');
        for (const [email, permisos] of [['test25-lector@x.test', ['proveedores:ver']],
            ['test25-compras@x.test', ['proveedores:ver', 'proveedores:crear', 'inventario_mecanica:ver']],
            ['test25-admin2@x.test', PLANTILLAS.administrador]]) {
            const { rows } = await q(`INSERT INTO usuarios (nombre, email, password, rol, empresa_id, permisos_inicializados)
                VALUES ($1, $2, $3, 'administrador', $4, TRUE) RETURNING id`, [email, email, hash, t.emp_a]);
            for (const p of permisos) {
                const [modulo, accion] = p.split(':');
                await q('INSERT INTO usuario_permisos (usuario_id, modulo, accion, empresa_id) VALUES ($1,$2,$3,$4)', [rows[0].id, modulo, accion, t.emp_a]);
            }
            t[email.split('@')[0].replace('test25-', '')] = (await login(email, PASS)).body.token;
        }

        // Inventario inicial de A: un filtro (Mecánica) con el código del proveedor y una categoría de Colisiones.
        const rep = await api('POST', '/inventory/repuestos', { token: t.a, body: { nombre: 'Filtro de aceite TEST25', area: 'mecanica', stock_actual: 10,
            precio_compra: 3, precio_venta: 8, codigo_proveedor: 'BOSCH-0451' } });
        expect(rep.status).toBe(201);
        t.filtro = rep.body.id;
        const rep2 = await api('POST', '/inventory/repuestos', { token: t.a, body: { nombre: 'Bujía TEST25', area: 'mecanica', stock_actual: 4, precio_venta: 5 } });
        t.bujia = rep2.body.id;
        const cat = await api('POST', '/inventory/categorias', { token: t.a, body: { nombre: 'Pinturas TEST25', area: 'colisiones' } });
        expect(cat.status).toBe(201);
        t.catPintura = (cat.body.categoria || cat.body).id;
    });

    afterAll(async () => {
        if (server) await new Promise(ok => server.close(ok));
        if (sri) await sri.cerrar();
        if (pool) { await limpiar(); await pool.end(); }
    });

    describe('Consulta (no toca el inventario)', () => {
        test('1 + 11: factura autorizada: trae cabecera y articulos; consultar de nuevo no duplica ni mueve stock', async () => {
            const f = facturaProveedor({ lineas: [
                { codigo: 'BOSCH-0451', descripcion: 'Filtro aceite Bosch', cantidad: 6, precio_unitario: 3.5 },
                { codigo: 'PPG-2K-1L', descripcion: 'Pintura 2K blanco 1 litro', cantidad: 2.5, precio_unitario: 22, descuento: 1 },
            ] });
            sri.registrar(f.clave, { estado: 'AUTORIZADO', xml: f.xml });
            t.f1 = f;
            const antes = { filtro: await stock(t.filtro), movs: await movs(t.emp_a) };
            const r = await api('POST', '/proveedores/facturas-compra/consultar', { token: t.a, body: { clave_acceso: f.clave } });
            expect(r.status).toBe(201);
            const fa = r.body.factura;
            expect(fa).toMatchObject({ estado: 'pendiente_confirmacion', estado_sri: 'AUTORIZADO', origen_datos: 'sri', emisor_ruc: RUC_PROV,
                numero: `001-002-${String(secuencial).padStart(9, '0')}`, comprador_identificacion: RUC_A, anulacion_verificada: true });
            expect(Number(fa.importe_total)).toBeCloseTo(f.total, 2);
            expect(fa.detalles).toHaveLength(2);
            expect(fa.detalles[0]).toMatchObject({ codigo_principal: 'BOSCH-0451', descripcion: 'Filtro aceite Bosch' });
            expect(Number(fa.detalles[1].cantidad)).toBe(2.5);
            // Sugerencia por CODIGO (nunca solo por nombre): el filtro existente.
            expect(fa.sugerencias[fa.detalles[0].id].sugerido.id).toBe(t.filtro);
            t.fc1 = fa.id;
            t.det1 = fa.detalles.map(x => x.id);

            const r2 = await api('POST', '/proveedores/facturas-compra/consultar', { token: t.a, body: { clave_acceso: f.clave } });
            expect(r2.status).toBe(200);
            expect(r2.body.existente).toBe(true);
            expect(r2.body.factura.id).toBe(t.fc1);
            expect(Number((await q('SELECT COUNT(*) FROM facturas_compra WHERE clave_acceso = $1', [f.clave])).rows[0].count)).toBe(1);
            expect(await stock(t.filtro)).toBe(antes.filtro);
            expect(await movs(t.emp_a)).toBe(antes.movs);
        });

        test('2: clave de acceso incorrecta (longitud o digito verificador)', async () => {
            for (const clave of ['123', t.f1.clave.slice(0, 48) + String((Number(t.f1.clave[48]) + 1) % 10), 'x'.repeat(49)]) {
                const r = await api('POST', '/proveedores/facturas-compra/consultar', { token: t.a, body: { clave_acceso: clave } });
                expect(r.status).toBe(400);
                expect(r.body.codigo).toBe('CLAVE_INVALIDA');
            }
        });

        test('3: comprobante NO AUTORIZADO: se informa y no se guarda', async () => {
            const f = facturaProveedor({ lineas: [{ descripcion: 'X', cantidad: 1, precio_unitario: 1 }] });
            sri.registrar(f.clave, { estado: 'NO AUTORIZADO' });
            const r = await api('POST', '/proveedores/facturas-compra/consultar', { token: t.a, body: { clave_acceso: f.clave } });
            expect(r.status).toBe(409);
            expect(r.body.codigo).toBe('NO_AUTORIZADA');
            expect(Number((await q('SELECT COUNT(*) FROM facturas_compra WHERE clave_acceso = $1', [f.clave])).rows[0].count)).toBe(0);
            // Inexistente en el SRI.
            const n = facturaProveedor({ lineas: [{ descripcion: 'Y', cantidad: 1, precio_unitario: 1 }] });
            expect((await api('POST', '/proveedores/facturas-compra/consultar', { token: t.a, body: { clave_acceso: n.clave } })).body.codigo).toBe('NO_ENCONTRADA');
        });

        test('4: comprobante ANULADO: queda como no registrable y no se puede confirmar', async () => {
            const f = facturaProveedor({ lineas: [{ codigo: 'Z1', descripcion: 'Anulado', cantidad: 1, precio_unitario: 9 }] });
            sri.registrar(f.clave, { estado: 'AUTORIZADO', xml: f.xml, anulado: true });
            const r = await api('POST', '/proveedores/facturas-compra/consultar', { token: t.a, body: { clave_acceso: f.clave } });
            expect(r.status).toBe(201);
            expect(r.body.factura).toMatchObject({ estado_sri: 'ANULADO', estado: 'no_registrable', registrable: false });
            const c = await api('POST', `/proveedores/facturas-compra/${r.body.factura.id}/confirmar`, { token: t.a, body: {
                crear_proveedor: true, forma_pago: 'credito', lineas: [{ detalle_id: r.body.factura.detalles[0].id, accion: 'omitir' }] } });
            expect(c.status).toBe(409);
            expect(c.body.codigo).toBe('NO_REGISTRABLE');
        });

        test('5: SRI no disponible: la consulta lo informa; el XML cargado queda SIN VERIFICAR y exige aceptar la advertencia', async () => {
            const f = facturaProveedor({ ruc: RUC_PROV2, lineas: [{ codigo: 'LIJ-400', descripcion: 'Lija al agua 400', cantidad: 20, precio_unitario: 0.8 }] });
            t.f5 = f;
            sri.caido = true;
            try {
                const r = await api('POST', '/proveedores/facturas-compra/consultar', { token: t.a, body: { clave_acceso: f.clave } });
                expect(r.status).toBe(503);
                expect(r.body.codigo).toBe('SRI_NO_DISPONIBLE');
                const x = await api('POST', '/proveedores/facturas-compra/xml', { token: t.a, body: { xml: f.xml } });
                expect(x.status).toBe(201);
                expect(x.body.factura).toMatchObject({ estado_sri: 'SIN_VERIFICAR', origen_datos: 'xml', firma_valida: true, estado: 'pendiente_confirmacion' });
                expect(x.body.factura.advertencias.map(a => a.codigo)).toContain('SIN_VERIFICAR');
                t.fc5 = x.body.factura;
            } finally { sri.caido = false; }
            const sinAceptar = await api('POST', `/proveedores/facturas-compra/${t.fc5.id}/confirmar`, { token: t.a, body: {
                crear_proveedor: true, forma_pago: 'credito', lineas: [{ detalle_id: t.fc5.detalles[0].id, accion: 'nuevo', area: 'colisiones' }] } });
            expect(sinAceptar.status).toBe(409);
            expect(sinAceptar.body.codigo).toBe('ADVERTENCIAS');
        });

        test('6: XML valido cargado con el SRI disponible: se verifica y se usa el XML oficial', async () => {
            const f = facturaProveedor({ lineas: [{ codigo: 'NGK-BKR6', descripcion: 'Bujía NGK', cantidad: 8, precio_unitario: 2.75 }] });
            sri.registrar(f.clave, { estado: 'AUTORIZADO', xml: f.xml });
            // Archivo tal como lo entregan muchos proveedores: la respuesta de autorizacion que envuelve la factura.
            const envuelto = `<?xml version="1.0" encoding="UTF-8"?><autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${f.clave}</numeroAutorizacion>`
                + `<fechaAutorizacion>2026-10-10T10:20:30-05:00</fechaAutorizacion><comprobante><![CDATA[${f.xml}]]></comprobante></autorizacion>`;
            const r = await api('POST', '/proveedores/facturas-compra/xml', { token: t.a, body: { xml: envuelto } });
            expect(r.status).toBe(201);
            expect(r.body.factura).toMatchObject({ estado_sri: 'AUTORIZADO', origen_datos: 'sri', estado: 'pendiente_confirmacion' });
            t.fc6 = r.body.factura;
        });

        test('7: XML invalido o malicioso se rechaza sin guardar nada', async () => {
            const antes = Number((await q('SELECT COUNT(*) FROM facturas_compra WHERE empresa_id = $1', [t.emp_a])).rows[0].count);
            const xxe = `<?xml version="1.0"?><!DOCTYPE f [<!ENTITY x SYSTEM "file:///etc/passwd">]><factura>&x;</factura>`;
            const casos = [
                [xxe, 'XML_PELIGROSO'],
                ['<factura><infoTributaria>', 'XML_INVALIDO'],
                ['<html><body>hola</body></html>', 'NO_ES_FACTURA'],
                [t.f1.xml.replace(/<secuencial>\d+<\/secuencial>/, '<secuencial>000000999</secuencial>'), 'XML_INCOHERENTE'],
                ['<a>' + 'x'.repeat(2 * 1024 * 1024) + '</a>', 'XML_GRANDE'],
            ];
            for (const [xml, codigo] of casos) {
                const r = await api('POST', '/proveedores/facturas-compra/xml', { token: t.a, body: { xml } });
                expect({ codigo, status: r.status, recibido: r.body.codigo }).toEqual({ codigo, status: 400, recibido: codigo });
            }
            // XML alterado (montos) con el SRI disponible: manda el XML oficial y se marca la firma.
            const f = facturaProveedor({ lineas: [{ codigo: 'ACE-5W30', descripcion: 'Aceite 5W30', cantidad: 4, precio_unitario: 9 }] });
            sri.registrar(f.clave, { estado: 'AUTORIZADO', xml: f.xml });
            const alterado = f.xml.replace(/<importeTotal>[^<]+<\/importeTotal>/, '<importeTotal>1.00</importeTotal>');
            const r = await api('POST', '/proveedores/facturas-compra/xml', { token: t.a, body: { xml: alterado } });
            expect(r.status).toBe(201);
            expect(Number(r.body.factura.importe_total)).toBeCloseTo(f.total, 2);
            expect(r.body.factura.firma_valida).toBe(false);
            await api('DELETE', `/proveedores/facturas-compra/${r.body.factura.id}`, { token: t.a });
            expect(Number((await q('SELECT COUNT(*) FROM facturas_compra WHERE empresa_id = $1', [t.emp_a])).rows[0].count)).toBe(antes);
        });
    });

    describe('Confirmacion (unica entrada al inventario)', () => {
        test('15: sin permisos no se consulta ni se confirma', async () => {
            expect((await api('POST', '/proveedores/facturas-compra/consultar', { token: t.lector, body: { clave_acceso: t.f1.clave } })).status).toBe(403);
            expect((await api('GET', '/proveedores/facturas-compra', { token: t.lector })).status).toBe(200);
            const r = await api('POST', `/proveedores/facturas-compra/${t.fc1}/confirmar`, { token: t.compras, body: {
                crear_proveedor: true, forma_pago: 'credito', lineas: t.det1.map(id => ({ detalle_id: id, accion: 'omitir' })) } });
            expect(r.status).toBe(403);
        });

        test('14: un error a mitad del registro no deja nada a medias', async () => {
            await q('UPDATE repuestos SET activo = FALSE WHERE id = $1', [t.bujia]);
            const antes = { filtro: await stock(t.filtro), movs: await movs(t.emp_a),
                compras: Number((await q('SELECT COUNT(*) FROM compras_proveedor WHERE empresa_id = $1', [t.emp_a])).rows[0].count),
                provs: Number((await q('SELECT COUNT(*) FROM proveedores WHERE empresa_id = $1', [t.emp_a])).rows[0].count) };
            const r = await api('POST', `/proveedores/facturas-compra/${t.fc1}/confirmar`, { token: t.a, body: {
                crear_proveedor: true, forma_pago: 'credito', lineas: [
                    { detalle_id: t.det1[0], accion: 'existente', repuesto_id: t.filtro },     // se procesa primero (bloqueo por id)
                    { detalle_id: t.det1[1], accion: 'existente', repuesto_id: t.bujia },      // inactivo: falla
                ] } });
            expect(r.status).toBe(409);
            expect(await stock(t.filtro)).toBe(antes.filtro);
            expect(await movs(t.emp_a)).toBe(antes.movs);
            expect(Number((await q('SELECT COUNT(*) FROM compras_proveedor WHERE empresa_id = $1', [t.emp_a])).rows[0].count)).toBe(antes.compras);
            expect(Number((await q('SELECT COUNT(*) FROM proveedores WHERE empresa_id = $1', [t.emp_a])).rows[0].count)).toBe(antes.provs);
            const f = (await api('GET', `/proveedores/facturas-compra/${t.fc1}`, { token: t.a })).body.factura;
            expect(f.estado).toBe('pendiente_confirmacion');
            expect(f.ultimo_error).toMatch(/inactivo/);
            await q('UPDATE repuestos SET activo = TRUE WHERE id = $1', [t.bujia]);
        });

        test('8 + 9 + 10 + 13: dos usuarios confirman a la vez: una sola compra; existente + nuevo en ambos inventarios', async () => {
            const cuerpo = { crear_proveedor: true, forma_pago: 'credito', lineas: [
                { detalle_id: t.det1[0], accion: 'existente', repuesto_id: t.filtro, area: 'mecanica' },
                { detalle_id: t.det1[1], accion: 'nuevo', area: 'colisiones', nuevo: { nombre: 'Pintura 2K blanco', categoria_id: t.catPintura, precio_venta: 35, stock_minimo: 1, unidad_medida: 'litro' } },
            ] };
            const antes = { filtro: await stock(t.filtro), movs: await movs(t.emp_a) };
            const rs = await Promise.all([
                api('POST', `/proveedores/facturas-compra/${t.fc1}/confirmar`, { token: t.a, body: cuerpo }),
                api('POST', `/proveedores/facturas-compra/${t.fc1}/confirmar`, { token: t.admin2, body: cuerpo }),
            ]);
            expect(rs.map(r => r.status).sort()).toEqual([200, 409]);
            const ok = rs.find(r => r.status === 200).body;
            expect(rs.find(r => r.status === 409).body.codigo).toBe('YA_REGISTRADA');
            expect(await movs(t.emp_a)).toBe(antes.movs + 2);
            expect(await stock(t.filtro)).toBe(antes.filtro + 6);
            const lineas = ok.resultado.lineas;
            const nuevo = lineas.find(l => l.creado);
            expect(nuevo.codigo).toMatch(/^COL-\d{6}$/);   // generador de codigos interno existente
            const { rows: rep } = await q('SELECT area, stock_actual, codigo_proveedor, precio_compra, categoria_id FROM repuestos WHERE id = $1', [nuevo.repuesto_id]);
            expect(rep[0]).toMatchObject({ area: 'colisiones', codigo_proveedor: 'PPG-2K-1L', categoria_id: t.catPintura });
            expect(Number(rep[0].stock_actual)).toBe(2.5);
            expect(Number(rep[0].precio_compra)).toBeCloseTo(21.6, 2);   // (2.5 x 22 - 1) / 2.5, sin IVA
            // Movimientos con su area, la factura, la compra y el costo.
            const { rows: mv } = await q(`SELECT repuesto_id, area, origen, tipo, cantidad, stock_anterior, stock_nuevo, referencia, compra_id, factura_compra_id, precio_unitario
                FROM movimientos_inventario WHERE factura_compra_id = $1 ORDER BY id`, [t.fc1]);
            expect(mv).toHaveLength(2);
            expect(mv.find(m => m.repuesto_id === t.filtro)).toMatchObject({ area: 'mecanica', origen: 'compra', tipo: 'entrada', compra_id: ok.resultado.compra_id });
            expect(mv.find(m => m.repuesto_id === nuevo.repuesto_id)).toMatchObject({ area: 'colisiones', referencia: `FC-${ok.factura.numero}` });
            // Codigo del proveedor -> codigo interno (sin reemplazar el interno del filtro).
            const { rows: map } = await q('SELECT repuesto_id, codigo FROM repuestos_codigos_proveedor WHERE proveedor_id = $1 ORDER BY codigo', [ok.resultado.proveedor_id]);
            expect(map).toEqual([{ repuesto_id: t.filtro, codigo: 'BOSCH-0451' }, { repuesto_id: nuevo.repuesto_id, codigo: 'PPG-2K-1L' }]);
            expect((await q('SELECT codigo FROM repuestos WHERE id = $1', [t.filtro])).rows[0].codigo).toMatch(/^MEC-/);
            // La compra queda en Proveedores › Compras con su deuda (credito 15 dias).
            const compra = await api('GET', `/proveedores/compras/${ok.resultado.compra_id}`, { token: t.a });
            expect(compra.body.compra).toMatchObject({ estado: 'recibida', forma_pago: 'credito' });
            expect(Number(compra.body.compra.saldo)).toBeCloseTo(t.f1.total, 2);
            t.compra1 = ok.resultado.compra_id;
            t.pintura = nuevo.repuesto_id;
            t.prov1 = ok.resultado.proveedor_id;
        });

        test('12: registrar otra vez la misma factura (o reintentar) no vuelve a sumar', async () => {
            const antes = { filtro: await stock(t.filtro), movs: await movs(t.emp_a) };
            const r = await api('POST', `/proveedores/facturas-compra/${t.fc1}/confirmar`, { token: t.a, body: {
                crear_proveedor: true, forma_pago: 'credito', lineas: t.det1.map(id => ({ detalle_id: id, accion: 'omitir' })) } });
            expect(r.status).toBe(409);
            expect(r.body.codigo).toBe('YA_REGISTRADA');
            // Cargar su XML otra vez, o consultarla, devuelve la registrada sin cambios.
            expect((await api('POST', '/proveedores/facturas-compra/xml', { token: t.a, body: { xml: t.f1.xml } })).body.factura.estado).toBe('registrada');
            expect((await api('POST', '/proveedores/facturas-compra/consultar', { token: t.a, body: { clave_acceso: t.f1.clave, reconsultar: true } })).body.existente).toBe(true);
            // La base impide borrarla o alterarla.
            await expect(q('DELETE FROM facturas_compra WHERE id = $1', [t.fc1])).rejects.toThrow(/no se puede borrar/);
            await expect(q('UPDATE facturas_compra SET importe_total = 1 WHERE id = $1', [t.fc1])).rejects.toThrow(/no se puede modificar/);
            await expect(q('UPDATE facturas_compra_detalles SET cantidad = 99 WHERE factura_id = $1', [t.fc1])).rejects.toThrow(/no se pueden modificar/);
            // Y una segunda entrada para el mismo articulo es imposible (indice unico).
            await expect(q(`INSERT INTO movimientos_inventario (repuesto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, origen, area, empresa_id, factura_compra_detalle_id)
                VALUES ($1,(SELECT id FROM usuarios WHERE email = 'test25-admin-a@x.test'),'entrada',1,0,1,'compra','mecanica',$2,$3)`, [t.filtro, t.emp_a, t.det1[0]])).rejects.toThrow(/uq_movimientos_factura_detalle/);
            expect(await stock(t.filtro)).toBe(antes.filtro);
            expect(await movs(t.emp_a)).toBe(antes.movs);
        });

        test('5 (cont.): con la advertencia aceptada, la factura sin verificar se registra (al contado) y crea el proveedor', async () => {
            const r = await api('POST', `/proveedores/facturas-compra/${t.fc5.id}/confirmar`, { token: t.a, body: {
                crear_proveedor: true, forma_pago: 'contado', metodo_pago: 'transferencia', aceptar_advertencias: true,
                lineas: [{ detalle_id: t.fc5.detalles[0].id, accion: 'nuevo', area: 'colisiones', nuevo: { categoria_id: t.catPintura } }] } });
            expect(r.status).toBe(200);
            expect(r.body.factura).toMatchObject({ estado: 'registrada', estado_sri: 'SIN_VERIFICAR', proveedor_ruc: RUC_PROV2 });
            expect(Number(r.body.factura.saldo)).toBe(0);
            expect(r.body.factura.pagos.map(p => p.tipo)).toEqual(['compra', 'pago']);
        });

        test('8 (cont.): una compra posterior del mismo proveedor reconoce el codigo y suma al mismo producto', async () => {
            const f = facturaProveedor({ lineas: [{ codigo: 'PPG-2K-1L', descripcion: 'Pintura 2K blanco 1L (nueva descripcion)', cantidad: 1, precio_unitario: 23 }] });
            sri.registrar(f.clave, { estado: 'AUTORIZADO', xml: f.xml });
            const r = await api('POST', '/proveedores/facturas-compra/consultar', { token: t.a, body: { clave_acceso: f.clave } });
            const det = r.body.factura.detalles[0];
            expect(r.body.factura.sugerencias[det.id]).toMatchObject({ motivo: 'codigo_proveedor_registrado', sugerido: { id: t.pintura } });
            // Intentar crearlo como nuevo se bloquea (ya existe con ese codigo de este proveedor).
            const dup = await api('POST', `/proveedores/facturas-compra/${r.body.factura.id}/confirmar`, { token: t.a, body: {
                proveedor_id: t.prov1, forma_pago: 'credito', lineas: [{ detalle_id: det.id, accion: 'nuevo', area: 'colisiones' }] } });
            expect(dup.status).toBe(409);
            expect(dup.body.codigo).toBe('PRODUCTO_EXISTE');
            const antes = await stock(t.pintura);
            const ok = await api('POST', `/proveedores/facturas-compra/${r.body.factura.id}/confirmar`, { token: t.a, body: {
                proveedor_id: t.prov1, forma_pago: 'credito', lineas: [{ detalle_id: det.id, accion: 'existente', repuesto_id: t.pintura }] } });
            expect(ok.status).toBe(200);
            expect(await stock(t.pintura)).toBe(antes + 1);
            // Un proveedor con otro RUC no puede usarse para esta factura.
            const g = facturaProveedor({ lineas: [{ descripcion: 'Otro', cantidad: 1, precio_unitario: 1 }] });
            sri.registrar(g.clave, { estado: 'AUTORIZADO', xml: g.xml });
            const fg = (await api('POST', '/proveedores/facturas-compra/consultar', { token: t.a, body: { clave_acceso: g.clave } })).body.factura;
            const otroProv = (await q('SELECT id FROM proveedores WHERE empresa_id = $1 AND ruc = $2', [t.emp_a, RUC_PROV2])).rows[0].id;
            const mal = await api('POST', `/proveedores/facturas-compra/${fg.id}/confirmar`, { token: t.a, body: {
                proveedor_id: otroProv, forma_pago: 'credito', lineas: [{ detalle_id: fg.detalles[0].id, accion: 'omitir' }] } });
            expect(mal.body.codigo).toBe('PROVEEDOR_DISTINTO');
        });
    });

    describe('Historial, otras empresas y modulos existentes', () => {
        test('17: el historial del producto muestra la entrada por compra con su factura', async () => {
            const h = await api('GET', `/inventory/movimientos?repuesto_id=${t.filtro}`, { token: t.a });
            expect(h.status).toBe(200);
            const lista = h.body.movimientos || h.body;
            const compra = lista.find(m => m.origen === 'compra');
            expect(compra).toMatchObject({ tipo: 'entrada', referencia: expect.stringMatching(/^FC-001-002-/) });
            expect(Number(compra.stock_anterior) + 6).toBe(Number(compra.stock_nuevo));
            const det = (await api('GET', `/proveedores/facturas-compra/${t.fc1}`, { token: t.a })).body.factura.detalles;
            expect(det.every(x => x.movimiento_id)).toBe(true);
            const lst = await api('GET', `/proveedores/facturas-compra?q=${t.f1.clave.slice(10, 23)}&estado=registrada`, { token: t.a });
            expect(lst.body.facturas.map(x => x.id)).toContain(t.fc1);
            // PDF legible con el número y el emisor (el contenido va comprimido; el título está en los metadatos).
            const r = await fetch(`${base}/api/proveedores/facturas-compra/${t.fc1}/pdf`, { headers: { Authorization: `Bearer ${t.a}` } });
            expect(r.status).toBe(200);
            expect(r.headers.get('content-type')).toMatch(/pdf/);
            expect(r.headers.get('content-disposition')).toMatch(/attachment; filename="Factura-compra-001-002-/);
            const bytes = Buffer.from(await r.arrayBuffer());
            expect(bytes.slice(0, 5).toString()).toBe('%PDF-');
            expect(bytes.toString('latin1')).toMatch(/DISTRIBUIDORA TEST25/);
            const ver = await fetch(`${base}/api/proveedores/facturas-compra/${t.fc1}/pdf?ver=1`, { headers: { Authorization: `Bearer ${t.a}` } });
            expect(ver.headers.get('content-disposition')).toMatch(/^inline/);
            const xml = await api('GET', `/proveedores/facturas-compra/${t.fc1}/xml`, { token: t.a });
            expect(xml.status).toBe(200);
            expect(xml.body).toContain(t.f1.clave);
        });

        test('16: otra empresa no ve, no descarga ni confirma las facturas de A; la misma clave es independiente en su empresa', async () => {
            expect((await api('GET', `/proveedores/facturas-compra/${t.fc1}`, { token: t.b })).status).toBe(404);
            expect((await api('GET', `/proveedores/facturas-compra/${t.fc1}/xml`, { token: t.b })).status).toBe(404);
            expect((await api('GET', `/proveedores/facturas-compra/${t.fc1}/pdf`, { token: t.b })).status).toBe(404);
            expect((await api('POST', `/proveedores/facturas-compra/${t.fc6.id}/confirmar`, { token: t.b, body: {
                crear_proveedor: true, forma_pago: 'credito', lineas: [{ detalle_id: t.fc6.detalles[0].id, accion: 'omitir' }] } })).status).toBe(404);
            expect((await api('DELETE', `/proveedores/facturas-compra/${t.fc6.id}`, { token: t.b })).status).toBe(409);
            expect((await api('GET', '/proveedores/facturas-compra', { token: t.b })).body.facturas).toEqual([]);
            // B consulta la misma clave: es SU registro (la factura no es de B: se le advierte el comprador distinto).
            await api('PUT', '/empresa', { token: t.b, body: { ruc: '1790000025002' } });
            const r = await api('POST', '/proveedores/facturas-compra/consultar', { token: t.b, body: { clave_acceso: t.f1.clave } });
            expect(r.status).toBe(201);
            expect(r.body.factura.id).not.toBe(t.fc1);
            expect(r.body.factura.advertencias.map(a => a.codigo)).toContain('COMPRADOR_DISTINTO');
            // Un producto de A no se puede usar desde B.
            const c = await api('POST', `/proveedores/facturas-compra/${r.body.factura.id}/confirmar`, { token: t.b, body: {
                crear_proveedor: true, forma_pago: 'credito', aceptar_advertencias: true,
                lineas: r.body.factura.detalles.map(x => ({ detalle_id: x.id, accion: 'existente', repuesto_id: t.filtro })) } });
            expect(c.status).toBe(409);
            expect(await stock(t.filtro)).toBeGreaterThan(0);
        });

        test('18: lo comprado se usa en una proforma y sale del inventario con las reglas actuales', async () => {
            const cli = await api('POST', '/ordenes/clientes', { token: t.a, body: { nombre: 'TEST25 Cliente', cedula: '0102030405', telefono: '0990000025' } });
            const veh = await api('POST', '/ordenes/vehiculos', { token: t.a, body: { cliente_id: (cli.body.cliente || cli.body).id, placa: 'TST-2501', marca: 'Kia', modelo: 'Rio' } });
            const p = await api('POST', '/proformas', { token: t.a, body: {
                tipo: 'pintura', cliente_id: (cli.body.cliente || cli.body).id, vehiculo_id: (veh.body.vehiculo || veh.body).id,
                fecha_emision: new Date().toISOString().slice(0, 10), iva_porcentaje: 15, descuento: 0, anticipo: 0, estado: 'emitida',
                items: [{ categoria: 'insumo', descripcion: 'Pintura 2K', cantidad: 1.5, precio_unitario: 35, referencia_tipo: 'repuesto', referencia_id: t.pintura }] } });
            expect(p.status).toBe(201);
            const antes = await stock(t.pintura);
            const ap = await api('PATCH', `/proformas/${p.body.proforma.id}/estado`, { token: t.a, body: { estado: 'aprobada' } });
            expect(ap.status).toBe(200);
            expect(await stock(t.pintura)).toBe(Math.round((antes - 1.5) * 100) / 100);
            const { rows } = await q(`SELECT origen, tipo FROM movimientos_inventario WHERE repuesto_id = $1 ORDER BY id`, [t.pintura]);
            expect(rows.map(r => `${r.origen}:${r.tipo}`)).toEqual(['compra:entrada', 'compra:entrada', 'proforma:salida']);
        });

        test('19: los datos que no son de estas pruebas siguen identicos', async () => {
            const h = (await q(`SELECT md5(string_agg(to_jsonb(m)::text, '' ORDER BY id)) AS h FROM movimientos_inventario m
                WHERE empresa_id NOT IN (SELECT id FROM empresas WHERE slug LIKE 'test25-%')`)).rows[0].h;
            const hr = (await q(`SELECT md5(string_agg(to_jsonb(r)::text, '' ORDER BY id)) AS h FROM repuestos r
                WHERE empresa_id NOT IN (SELECT id FROM empresas WHERE slug LIKE 'test25-%')`)).rows[0].h;
            expect(h).toBe(t.huella);
            expect(hr).toBe(t.huellaRep);
        });

        test('reportes: la compra cuenta una sola vez como deuda con proveedores', async () => {
            const r = await api('GET', `/proveedores/resumen?proveedor_id=${t.prov1}`, { token: t.a });
            const total = Number((await q(`SELECT COALESCE(SUM(total),0) AS t FROM compras_proveedor WHERE proveedor_id = $1`, [t.prov1])).rows[0].t);
            expect(r.body.total_comprado).toBeCloseTo(total, 2);
            expect(r.body.total_pendiente).toBeCloseTo(total, 2);
        });
    });
});
