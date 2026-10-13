/**
 * SS SWAP - Pruebas de INTEGRACION del Sprint 24 (identidad por empresa y
 * coherencia de proveedores) con peticiones HTTP reales contra PostgreSQL.
 * Solo corren con PG_INTEGRATION=1:
 *
 *   PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest sprint24
 *
 * ¡NUNCA apuntar a produccion! Crea dos empresas "TEST24 ..." y las borra
 * (con todos sus datos y sus archivos de logo) al terminar.
 *
 *  A. Empresas y logos: alta con logo, cambio de logo, validacion de
 *     archivos, edicion de datos, sesion con el logo, sin cruces.
 *  B. Documentos: orden de trabajo y proforma con la identidad de SU
 *     empresa, copia historica al crearlos, usuario creador del servidor.
 *  C. Proveedores: una sola creacion por envio (idempotencia), RUC unico,
 *     edicion sin duplicar, eliminar/desactivar, compras canceladas con
 *     pagos, pagos simultaneos, historial coherente y aislado.
 */
const RUN = process.env.PG_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-integracion-sprint24';

const fs = require('fs');
const path = require('path');

// PNG 1x1 real (firma correcta).
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

d('Sprint 24 - identidad por empresa y proveedores (HTTP)', () => {
    let pool, server, base, DIR_LOGOS;
    const t = {};
    let ip = 0;

    const api = async (metodo, ruta, { token, body, headers = {}, form } = {}) => {
        const r = await fetch(`${base}/api${ruta}`, {
            method: metodo,
            headers: {
                ...(form ? {} : { 'Content-Type': 'application/json' }),
                'X-Forwarded-For': `10.24.${Math.floor(++ip / 250)}.${ip % 250}`,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...headers,
            },
            body: form || (body && metodo !== 'GET' ? JSON.stringify(body) : undefined),
        });
        const tipo = r.headers.get('content-type') || '';
        const cuerpo = tipo.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer());
        return { status: r.status, body: cuerpo, headers: r.headers };
    };
    const login = async (email, password) => api('POST', '/auth/login', { body: { email, password, panel: 'staff' } });
    const formLogo = (buffer, nombre, tipo = 'image/png') => { const f = new FormData(); f.append('logo', new Blob([buffer], { type: tipo }), nombre); return f; };
    const archivosLogo = () => new Set(fs.readdirSync(DIR_LOGOS));
    const sinEmpresa = (sql, params) => require('../config/contexto').sinAislamiento(() => pool.query(sql, params));

    async function limpiar() {
        const cliente = await pool.connect();
        try {
            await cliente.query('BEGIN');
            await cliente.query(`SET LOCAL session_replication_role = replica`); // solo pruebas
            const { rows } = await cliente.query(`SELECT id, logo_archivo FROM empresas WHERE slug LIKE 'test24-%'`);
            const ids = rows.map(r => r.id);
            if (ids.length) {
                const { TODAS_TABLAS_EMPRESA } = require('../config/multiempresa');
                for (const tabla of TODAS_TABLAS_EMPRESA) await cliente.query(`DELETE FROM ${tabla} WHERE empresa_id = ANY($1)`, [ids]);
                await cliente.query(`DELETE FROM accesos_soporte WHERE empresa_id = ANY($1)`, [ids]);
                await cliente.query(`DELETE FROM empresas WHERE id = ANY($1)`, [ids]);
            }
            await cliente.query(`DELETE FROM usuario_permisos WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE 'test24-%')`);
            await cliente.query(`DELETE FROM usuarios WHERE email LIKE 'test24-%'`);
            await cliente.query('COMMIT');
        } finally { cliente.release(); }
        // Logos que subieron estas pruebas.
        for (const f of t.logosCreados || []) fs.rmSync(path.join(DIR_LOGOS, f), { force: true });
    }

    beforeAll(async () => {
        pool = require('../config/db');
        DIR_LOGOS = require('../services/marcaEmpresa').DIR_LOGOS;
        fs.mkdirSync(DIR_LOGOS, { recursive: true });
        t.logosAntes = archivosLogo();
        await limpiar();

        const express = require('express');
        const app = express();
        app.set('trust proxy', 1);
        app.use(express.json());
        const { contextoPublico, registrarErrores } = require('../middleware/empresa.middleware');
        app.use('/api', registrarErrores, contextoPublico);
        for (const r of ['auth', 'ordenes', 'proveedores', 'proformas', 'finanzas', 'plataforma', 'empresa', 'inventory'])
            app.use(`/api/${r}`, require(`../routes/${r}.routes`));
        await new Promise(ok => { server = app.listen(0, ok); });
        base = `http://127.0.0.1:${server.address().port}`;

        const bcrypt = require('bcryptjs');
        const c = await pool.connect();
        try {
            await c.query('BEGIN');
            await c.query(`SELECT set_config('ssswap.gestion_superadmin', 'on', true)`);
            await c.query(`INSERT INTO usuarios (nombre, email, password, rol, permisos_inicializados) VALUES ('TEST24 Plataforma', 'test24-plataforma@x.test', $1, 'superadministrador', TRUE)`,
                [await bcrypt.hash('Prueba-Segura-2026', 10)]);
            await c.query('COMMIT');
        } finally { c.release(); }
        t.plataforma = (await login('test24-plataforma@x.test', 'Prueba-Segura-2026')).body.token;
    });

    afterAll(async () => {
        if (server) await new Promise(ok => server.close(ok));
        if (pool) {
            t.logosCreados = [...archivosLogo()].filter(f => !t.logosAntes.has(f));
            await limpiar();
            await pool.end();
        }
    });

    // ── A ───────────────────────────────────────────────────────────
    describe('A. Empresas y logos', () => {
        test('la plataforma crea dos empresas, cada una con su logo', async () => {
            for (const [k, nombre] of [['a', 'TEST24 Taller Andes'], ['b', 'TEST24 Taller Brisa']]) {
                const r = await api('POST', '/plataforma/empresas', { token: t.plataforma, body: {
                    nombre, slug: `test24-${k}`, razon_social: `${nombre} S.A.`, ruc: k === 'a' ? '1790000024001' : '1790000024002',
                    direccion: `Av. ${k.toUpperCase()} 123`, telefono: '022000024', email: `contacto-${k}@x.test`,
                    admin: { nombre: `Admin ${nombre}`, email: `test24-admin-${k}@x.test` } } });
                expect(r.status).toBe(201);
                expect(r.body.empresa.creada_por).toBeTruthy();
                t[`emp_${k}`] = r.body.empresa.id;
                const l = await login(`test24-admin-${k}@x.test`, r.body.password_temporal);
                expect(l.status).toBe(200);
                t[k] = l.body.token;
                t[`admin_${k}`] = l.body.usuario;
            }
            // Logo de A desde la plataforma; logo de B desde su propia configuracion.
            const la = await api('POST', `/plataforma/empresas/${t.emp_a}/logo`, { token: t.plataforma, form: formLogo(PNG, 'andes.png') });
            expect(la.status).toBe(200);
            expect(la.body.empresa.logo_url).toMatch(/^\/uploads\/logos\/[0-9a-f]{32}\.png$/);
            const lb = await api('POST', '/empresa/logo', { token: t.b, form: formLogo(PNG, 'brisa.png') });
            expect(lb.status).toBe(200);
            expect(lb.body.empresa.logo_url).not.toBe(la.body.empresa.logo_url);
            for (const u of [la.body.empresa.logo_url, lb.body.empresa.logo_url]) {
                expect(fs.existsSync(path.join(DIR_LOGOS, path.basename(u)))).toBe(true);
            }
            t.logo_a1 = la.body.empresa.logo_url;
            t.logo_b = lb.body.empresa.logo_url;
        });

        test('la sesion de cada empresa trae SU logo (el panel lo muestra sin datos fijos)', async () => {
            const ma = await api('GET', '/auth/me', { token: t.a });
            const mb = await api('GET', '/auth/me', { token: t.b });
            expect(ma.body.empresa).toMatchObject({ id: t.emp_a, logo_url: t.logo_a1 });
            expect(mb.body.empresa).toMatchObject({ id: t.emp_b, logo_url: t.logo_b });
        });

        test('archivos invalidos o peligrosos se rechazan y no quedan en disco', async () => {
            const antes = archivosLogo();
            const casos = [
                formLogo(Buffer.from('<?php echo 1; ?>'), 'logo.png'),                        // extension falsa
                formLogo(Buffer.from('<svg onload="alert(1)"/>'), 'logo.svg', 'image/svg+xml'), // SVG
                formLogo(Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]), 'grande.png'),   // > 2 MB
            ];
            for (const form of casos) {
                const r = await api('POST', '/empresa/logo', { token: t.a, form });
                expect(r.status).toBe(400);
                expect(r.body.error).toBeTruthy();
            }
            expect(archivosLogo()).toEqual(antes);
            // El logo de A no cambio.
            expect((await api('GET', '/empresa', { token: t.a })).body.empresa.logo_url).toBe(t.logo_a1);
        });

        test('una empresa no puede cambiar el logo ni los datos de otra', async () => {
            expect((await api('POST', `/plataforma/empresas/${t.emp_b}/logo`, { token: t.a, form: formLogo(PNG, 'x.png') })).status).toBe(403);
            expect((await api('PUT', `/plataforma/empresas/${t.emp_b}`, { token: t.a, body: { nombre: 'Hackeada' } })).status).toBe(403);
            // /empresa siempre es la empresa del usuario autenticado, aunque mande otro id.
            const r = await api('PUT', '/empresa', { token: t.a, body: { id: t.emp_b, nombre_comercial: 'TEST24 Andes Motors' } });
            expect(r.status).toBe(200);
            expect(r.body.empresa.id).toBe(t.emp_a);
            const b = await api('GET', '/empresa', { token: t.b });
            expect(b.body.empresa.nombre_comercial).not.toBe('TEST24 Andes Motors');
            expect(b.body.empresa.logo_url).toBe(t.logo_b);
        });
    });

    // ── B ───────────────────────────────────────────────────────────
    describe('B. Documentos con la identidad de su empresa', () => {
        const crearOrden = async (k, extra = {}) => {
            const o = await api('POST', '/ordenes/ordenes', { token: t[k], body: {
                cliente_id: t[`cli_${k}`], vehiculo_id: t[`veh_${k}`], descripcion: 'Cambio de aceite', kilometraje: 12000,
                usuario_id: 999999, usuario_nombre: 'Nombre falso', ...extra } });
            expect(o.status).toBe(201);
            return (o.body.orden || o.body).id;
        };

        test('cada empresa crea su cliente, vehiculo y orden; el creador lo decide el servidor', async () => {
            for (const k of ['a', 'b']) {
                const c = await api('POST', '/ordenes/clientes', { token: t[k], body: { nombre: `TEST24 Cliente ${k}`, cedula: '0102030405', telefono: '0990000024' } });
                expect(c.status).toBe(201);
                t[`cli_${k}`] = (c.body.cliente || c.body).id;
                const v = await api('POST', '/ordenes/vehiculos', { token: t[k], body: { cliente_id: t[`cli_${k}`], placa: `TST-24${k === 'a' ? 1 : 2}`, marca: 'Kia', modelo: 'Rio' } });
                expect(v.status).toBe(201);
                t[`veh_${k}`] = (v.body.vehiculo || v.body).id;
                t[`ot_${k}`] = await crearOrden(k);
            }
            const { rows } = await sinEmpresa('SELECT id, usuario_id, empresa_id, empresa_datos FROM ordenes_trabajo WHERE id = ANY($1) ORDER BY id', [[t.ot_a, t.ot_b]]);
            expect(rows[0]).toMatchObject({ usuario_id: t.admin_a.id, empresa_id: t.emp_a });
            expect(rows[1]).toMatchObject({ usuario_id: t.admin_b.id, empresa_id: t.emp_b });
            // Copia de la identidad al crear (la hace la base, no el navegador).
            expect(rows[0].empresa_datos).toMatchObject({ nombre: 'TEST24 Taller Andes', nombre_comercial: 'TEST24 Andes Motors', ruc: '1790000024001' });
            expect(rows[0].empresa_datos.logo_archivo).toBe(`upload:${path.basename(t.logo_a1)}`);
            expect(rows[1].empresa_datos).toMatchObject({ nombre: 'TEST24 Taller Brisa', ruc: '1790000024002' });
        });

        test('el PDF de la orden lleva la empresa duena y no se descarga desde otra', async () => {
            const pa = await api('GET', `/ordenes/ordenes/${t.ot_a}/pdf`, { token: t.a });
            expect(pa.status).toBe(200);
            expect(pa.headers.get('content-type')).toMatch(/pdf/);
            const texto = pa.body.toString('latin1');
            expect(texto).toMatch(/TEST24 Andes Motors/);
            expect(texto).not.toMatch(/TEST24 Taller Brisa|SSarango/);
            expect(texto).toMatch(/\/Subtype \/Image/); // el logo va incrustado
            const pb = await api('GET', `/ordenes/ordenes/${t.ot_b}/pdf`, { token: t.b });
            expect(pb.body.toString('latin1')).toMatch(/TEST24 Taller Brisa/);
            expect((await api('GET', `/ordenes/ordenes/${t.ot_a}/pdf`, { token: t.b })).status).toBe(404);
        });

        test('la proforma (PDF y Excel) lleva la identidad de su empresa', async () => {
            const p = await api('POST', '/proformas', { token: t.a, body: {
                tipo: 'mecanica', cliente_id: t.cli_a, vehiculo_id: t.veh_a, fecha_emision: new Date().toISOString().slice(0, 10),
                iva_porcentaje: 15, descuento: 0, anticipo: 0, estado: 'emitida',
                items: [{ categoria: 'servicio', descripcion: 'Revision', cantidad: 1, precio_unitario: 40 }] } });
            expect(p.status).toBe(201);
            t.prof_a = p.body.proforma.id;
            const pdf = await api('GET', `/proformas/${t.prof_a}/pdf`, { token: t.a });
            expect(pdf.status).toBe(200);
            expect(pdf.body.toString('latin1')).toMatch(/TEST24 Andes Motors/);
            const xls = await api('GET', `/proformas/${t.prof_a}/excel`, { token: t.a });
            expect(xls.status).toBe(200);
            const ExcelJS = require('exceljs');
            const wb = new ExcelJS.Workbook();
            await wb.xlsx.load(xls.body);
            const hoja = wb.worksheets[0];
            expect(String(hoja.getCell('A1').value)).toMatch(/TEST24 Andes Motors.*RUC 1790000024001/);
            expect(String(hoja.getCell('A3').value)).toMatch(/Av\. A 123/);
            expect((await api('GET', `/proformas/${t.prof_a}/pdf`, { token: t.b })).status).toBe(404);
        });

        test('cambiar nombre o logo no altera los documentos ya emitidos; los nuevos usan los datos nuevos', async () => {
            expect((await api('PUT', '/empresa', { token: t.a, body: { nombre_comercial: 'TEST24 Andes Renovado' } })).status).toBe(200);
            const nuevo = await api('POST', '/empresa/logo', { token: t.a, form: formLogo(PNG, 'andes-2.png') });
            expect(nuevo.status).toBe(200);
            expect(nuevo.body.empresa.logo_url).not.toBe(t.logo_a1);

            const viejo = (await api('GET', `/ordenes/ordenes/${t.ot_a}/pdf`, { token: t.a })).body.toString('latin1');
            expect(viejo).toMatch(/TEST24 Andes Motors/);
            expect(viejo).not.toMatch(/Andes Renovado/);
            const otNueva = await crearOrden('a');
            const nuevoPdf = (await api('GET', `/ordenes/ordenes/${otNueva}/pdf`, { token: t.a })).body.toString('latin1');
            expect(nuevoPdf).toMatch(/TEST24 Andes Renovado/);
            const { rows } = await sinEmpresa('SELECT empresa_datos FROM ordenes_trabajo WHERE id = $1', [otNueva]);
            expect(rows[0].empresa_datos.logo_archivo).toBe(`upload:${path.basename(nuevo.body.empresa.logo_url)}`);
            // La copia no se puede reescribir.
            await sinEmpresa(`UPDATE ordenes_trabajo SET empresa_datos = '{"nombre":"Otro"}' WHERE id = $1`, [t.ot_a]);
            const { rows: r2 } = await sinEmpresa('SELECT empresa_datos FROM ordenes_trabajo WHERE id = $1', [t.ot_a]);
            expect(r2[0].empresa_datos.nombre_comercial).toBe('TEST24 Andes Motors');
            // Los archivos de logo anteriores se conservan (los usan los documentos emitidos).
            expect(fs.existsSync(path.join(DIR_LOGOS, path.basename(t.logo_a1)))).toBe(true);
        });
    });

    // ── C ───────────────────────────────────────────────────────────
    describe('C. Proveedores, pagos e historial', () => {
        const contar = async (empresa) => Number((await sinEmpresa('SELECT COUNT(*) FROM proveedores WHERE empresa_id = $1', [empresa])).rows[0].count);
        const datosProv = { nombre_comercial: 'TEST24 Repuestos Sierra', ruc: '1790000024999', telefono: '022999999', categoria: 'Repuestos' };

        test('un doble envio del mismo formulario crea UN solo proveedor', async () => {
            const clave = 'prueba24-doble-envio-0001';
            const [r1, r2] = await Promise.all([1, 2].map(() =>
                api('POST', '/proveedores/proveedores', { token: t.a, body: datosProv, headers: { 'Idempotency-Key': clave } })));
            const estados = [r1.status, r2.status].sort();
            expect(estados[0]).toBe(201);
            expect([201, 409]).toContain(estados[1]);
            expect(await contar(t.emp_a)).toBe(1);
            t.prov_a = (r1.status === 201 ? r1 : r2).body.proveedor.id;
            // Reintento despues de terminar: misma respuesta, sin crear otro.
            const r3 = await api('POST', '/proveedores/proveedores', { token: t.a, body: datosProv, headers: { 'Idempotency-Key': clave } });
            expect(r3.status).toBe(201);
            expect(r3.headers.get('idempotent-replay')).toBe('true');
            expect(r3.body.proveedor.id).toBe(t.prov_a);
            expect(await contar(t.emp_a)).toBe(1);
        });

        test('mismo RUC = mismo proveedor; mismo nombre sin RUC pide confirmacion', async () => {
            const r = await api('POST', '/proveedores/proveedores', { token: t.a, body: { ...datosProv, nombre_comercial: 'Otro nombre', ruc: ' 1790000024999 ' } });
            expect(r.status).toBe(409);
            expect(r.body).toMatchObject({ codigo: 'RUC_DUPLICADO', proveedor: { id: t.prov_a } });
            const n = await api('POST', '/proveedores/proveedores', { token: t.a, body: { nombre_comercial: ' test24 repuestos sierra ' } });
            expect(n.status).toBe(409);
            expect(n.body.codigo).toBe('POSIBLE_DUPLICADO');
            const ok = await api('POST', '/proveedores/proveedores', { token: t.a, body: { nombre_comercial: 'TEST24 Repuestos Sierra', confirmar_duplicado: true } });
            expect(ok.status).toBe(201);
            t.prov_a2 = ok.body.proveedor.id;
            // Otra empresa SI puede tener un proveedor con ese RUC (son datos de cada empresa).
            const b = await api('POST', '/proveedores/proveedores', { token: t.b, body: datosProv });
            expect(b.status).toBe(201);
            t.prov_b = b.body.proveedor.id;
            expect(await contar(t.emp_a)).toBe(2);
        });

        test('editar actualiza el mismo registro y no puede robar el RUC de otro', async () => {
            const e = await api('PUT', `/proveedores/proveedores/${t.prov_a}`, { token: t.a, body: { ...datosProv, telefono: '0987654321', email: 'ventas@sierra.test' } });
            expect(e.status).toBe(200);
            expect(e.body.proveedor).toMatchObject({ id: t.prov_a, telefono: '0987654321', email: 'ventas@sierra.test' });
            expect(await contar(t.emp_a)).toBe(2);
            const robo = await api('PUT', `/proveedores/proveedores/${t.prov_a2}`, { token: t.a, body: { nombre_comercial: 'X', ruc: '1790000024999' } });
            expect(robo.status).toBe(409);
            // B no ve ni edita los proveedores de A.
            expect((await api('GET', `/proveedores/proveedores/${t.prov_a}`, { token: t.b })).status).toBe(404);
            expect((await api('PUT', `/proveedores/proveedores/${t.prov_a}`, { token: t.b, body: { nombre_comercial: 'Hack' } })).status).toBe(404);
        });

        test('una compra con pagos no se cancela hasta anular el pago; el resumen queda coherente', async () => {
            const c = await api('POST', '/proveedores/compras', { token: t.a, headers: { 'Idempotency-Key': 'prueba24-compra-contado-1' }, body: {
                proveedor_id: t.prov_a, forma_pago: 'contado', metodo_pago: 'transferencia', items: [{ descripcion: 'Pastillas de freno', cantidad: 1, precio_unitario: 48.4 }] } });
            expect(c.status).toBe(201);
            t.compra_contado = c.body.compra.id;
            const total = Number(c.body.compra.total);
            expect(total).toBeCloseTo(55.66, 2);

            const cancelar = await api('PATCH', `/proveedores/compras/${t.compra_contado}/estado`, { token: t.a, body: { estado: 'cancelada' } });
            expect(cancelar.status).toBe(409);
            expect(cancelar.body.codigo).toBe('COMPRA_CON_PAGOS');

            const movs = await api('GET', `/proveedores/movimientos?proveedor_id=${t.prov_a}`, { token: t.a });
            const pago = movs.body.movimientos.find(m => m.tipo === 'pago' && m.compra_id === t.compra_contado);
            expect((await api('PATCH', `/proveedores/movimientos/${pago.id}/estado`, { token: t.a, body: { estado: 'anulado' } })).status).toBe(200);
            expect((await api('PATCH', `/proveedores/compras/${t.compra_contado}/estado`, { token: t.a, body: { estado: 'cancelada' } })).status).toBe(200);
            // No se puede volver a confirmar un pago de una compra cancelada.
            expect((await api('PATCH', `/proveedores/movimientos/${pago.id}/estado`, { token: t.a, body: { estado: 'confirmado' } })).status).toBe(409);

            const r = await api('GET', `/proveedores/resumen?proveedor_id=${t.prov_a}`, { token: t.a });
            expect(r.body).toMatchObject({ total_comprado: 0, total_pagado: 0, total_pendiente: 0, pagos_en_compras_canceladas: { total: 0, cantidad: 0 } });
        });

        test('dos pagos simultaneos no superan el saldo de una compra a credito', async () => {
            const c = await api('POST', '/proveedores/compras', { token: t.a, body: {
                proveedor_id: t.prov_a, forma_pago: 'credito', items: [{ descripcion: 'Kit embrague', cantidad: 1, precio_unitario: 100 }] } });
            expect(c.status).toBe(201);
            t.compra_credito = c.body.compra.id; // total 115
            const pagar = (n) => api('POST', '/proveedores/movimientos', { token: t.a, headers: { 'Idempotency-Key': `prueba24-pago-simultaneo-${n}` },
                body: { proveedor_id: t.prov_a, compra_id: t.compra_credito, tipo: 'abono', monto: 60, metodo_pago: 'efectivo' } });
            const rs = await Promise.all([pagar(1), pagar(2)]);
            expect(rs.map(r => r.status).sort()).toEqual([201, 400]);

            // La compra cancelada anterior + esta: el pendiente es solo el saldo real (115 - 60).
            const r = await api('GET', `/proveedores/resumen?proveedor_id=${t.prov_a}`, { token: t.a });
            expect(r.body.total_pendiente).toBeCloseTo(55, 2);
            const f = await api('GET', '/finanzas/resumen', { token: t.a });
            expect(f.status).toBe(200);
            expect(f.body.por_pagar.proveedores).toBeCloseTo(55, 2);
            // B no puede pagar la compra de A.
            expect((await api('POST', '/proveedores/movimientos', { token: t.b, body: { proveedor_id: t.prov_a, compra_id: t.compra_credito, tipo: 'pago', monto: 1 } })).status).toBe(404);
        });

        test('consultar el historial no crea proveedores ni movimientos; B no ve el historial de A', async () => {
            const antes = await sinEmpresa(`SELECT (SELECT COUNT(*) FROM proveedores WHERE empresa_id = $1) AS p,
                (SELECT COUNT(*) FROM movimientos_financieros_proveedor WHERE empresa_id = $1) AS m`, [t.emp_a]);
            for (let i = 0; i < 3; i++) {
                expect((await api('GET', '/proveedores/movimientos', { token: t.a })).status).toBe(200);
                expect((await api('GET', '/proveedores/resumen', { token: t.a })).status).toBe(200);
                expect((await api('GET', '/proveedores/proveedores', { token: t.a })).status).toBe(200);
            }
            const despues = await sinEmpresa(`SELECT (SELECT COUNT(*) FROM proveedores WHERE empresa_id = $1) AS p,
                (SELECT COUNT(*) FROM movimientos_financieros_proveedor WHERE empresa_id = $1) AS m`, [t.emp_a]);
            expect(despues.rows[0]).toEqual(antes.rows[0]);
            const hb = await api('GET', '/proveedores/movimientos', { token: t.b });
            expect(hb.body.movimientos).toEqual([]);
            // Los movimientos de A apuntan todos a proveedores de A, por su id.
            const { rows } = await sinEmpresa(`SELECT COUNT(*)::int AS n FROM movimientos_financieros_proveedor m JOIN proveedores p ON p.id = m.proveedor_id
                WHERE m.empresa_id = $1 AND p.empresa_id <> m.empresa_id`, [t.emp_a]);
            expect(rows[0].n).toBe(0);
        });

        test('eliminar: sin historial se borra; con historial se desactiva y el historial se conserva', async () => {
            const sin = await api('DELETE', `/proveedores/proveedores/${t.prov_a2}`, { token: t.a });
            expect(sin.status).toBe(200);
            expect(sin.body.accion).toBe('eliminado');
            expect((await api('GET', `/proveedores/proveedores/${t.prov_a2}`, { token: t.a })).status).toBe(404);

            const con = await api('DELETE', `/proveedores/proveedores/${t.prov_a}`, { token: t.a });
            expect(con.status).toBe(200);
            expect(con.body.accion).toBe('desactivado');
            const p = await api('GET', `/proveedores/proveedores/${t.prov_a}`, { token: t.a });
            expect(p.body.proveedor.activo).toBe(false);
            const movs = await api('GET', `/proveedores/movimientos?proveedor_id=${t.prov_a}`, { token: t.a });
            expect(movs.body.total).toBeGreaterThan(0);
            // B no puede borrar los de A.
            expect((await api('DELETE', `/proveedores/proveedores/${t.prov_a}`, { token: t.b })).status).toBe(404);
        });
    });
});
