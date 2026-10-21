/**
 * SS SWAP - Pruebas de INTEGRACION del Sprint 23 (facturación SRI + documentos legales)
 * con peticiones HTTP reales contra PostgreSQL. Solo corren con PG_INTEGRATION=1:
 *
 *   PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest sprint23
 *
 * ¡NUNCA apuntar a producción! Crea dos empresas "TEST23 ..." y las borra al terminar.
 *
 * Los servicios web del SRI se SIMULAN (jest.spyOn sobre src/sri/soap): estas
 * pruebas verifican el flujo, los estados, la numeración y el aislamiento; la
 * comunicación real con el ambiente de pruebas del SRI se prueba aparte
 * (docs: "Guía del ambiente de pruebas"). El XML, la validación XSD y la
 * firma SÍ son reales (certificado .p12 desechable generado en memoria).
 *
 *  F1. Configuración: faltantes, RUC, punto de emisión, certificado cifrado (nunca devuelto).
 *  F2. Factura desde proforma: propuesta, borrador, sin doble factura, totales del servidor.
 *  F3. Emisión autorizada: número, clave, XSD, firma, RIDE/XML, inmutabilidad, inventario y pagos intactos.
 *  F4. Resultados inciertos, devueltas y reintentos: misma clave, sin secuenciales nuevos.
 *  F5. Concurrencia de secuenciales.
 *  F6. Nota de crédito y anulación.
 *  F7. Aislamiento entre empresas y permisos.
 *  F8. Producción solo con prueba autorizada y confirmación expresa.
 *  L1-L6. Documentos legales: versiones inmutables, aceptación en el registro, re-aceptación,
 *          evidencia de solo inserción, constancias, contratación de la empresa.
 */
const RUN = process.env.PG_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

process.env.JWT_SECRET = process.env.JWT_SECRET || 'secreto-integracion-sprint23';
process.env.SRI_CERT_KEY = process.env.SRI_CERT_KEY || 'clave-de-custodia-solo-para-pruebas-0123456789';
process.env.SRI_TAREA_AUTOMATICA = 'false';

d('Sprint 23 - facturacion electronica y documentos legales (HTTP)', () => {
    let pool, server, base, SSSWAP, soap;
    const PASS = 'Prueba-Segura-2026';
    const t = {};

    let ipFalsa = 0;
    const api = async (metodo, ruta, { token, body, headers = {}, form } = {}) => {
        const r = await fetch(`${base}/api${ruta}`, {
            method: metodo,
            headers: {
                ...(form ? {} : { 'Content-Type': 'application/json' }),
                'X-Forwarded-For': `10.23.${Math.floor(++ipFalsa / 250)}.${ipFalsa % 250}`,
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...headers,
            },
            body: form || (body && metodo !== 'GET' ? JSON.stringify(body) : undefined),
        });
        const tipo = r.headers.get('content-type') || '';
        const cuerpo = tipo.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer());
        return { status: r.status, body: cuerpo, tipo };
    };
    const login = async (email, password = PASS) => api('POST', '/auth/login', { body: { email, password, panel: 'staff' } });

    async function limpiar() {
        const cliente = await pool.connect();
        try {
            await cliente.query('BEGIN');
            await cliente.query('SET LOCAL session_replication_role = replica'); // sin triggers ni FK: solo pruebas
            const { rows } = await cliente.query(`SELECT id FROM empresas WHERE slug LIKE 'test23-%'`);
            const ids = rows.map(r => r.id);
            // Documentos de prueba creados en SS SWAP (empresa pública) y en la plataforma.
            await cliente.query(`DELETE FROM aceptaciones_legales WHERE documento_id IN (SELECT id FROM documentos_legales WHERE titulo LIKE 'TEST23%')`);
            await cliente.query(`DELETE FROM notificaciones_legales WHERE version_id IN (SELECT v.id FROM documento_legal_versiones v JOIN documentos_legales d ON d.id = v.documento_id WHERE d.titulo LIKE 'TEST23%')`);
            await cliente.query(`DELETE FROM documento_legal_versiones WHERE documento_id IN (SELECT id FROM documentos_legales WHERE titulo LIKE 'TEST23%')`);
            await cliente.query(`DELETE FROM documentos_legales WHERE titulo LIKE 'TEST23%'`);
            if (ids.length) {
                const { TODAS_TABLAS_EMPRESA } = require('../config/multiempresa');
                await cliente.query('DELETE FROM documento_legal_versiones WHERE empresa_id = ANY($1)', [ids]);
                await cliente.query('DELETE FROM documentos_legales WHERE empresa_id = ANY($1)', [ids]);
                for (const tabla of TODAS_TABLAS_EMPRESA) await cliente.query(`DELETE FROM ${tabla} WHERE empresa_id = ANY($1)`, [ids]);
                await cliente.query('DELETE FROM empresas WHERE id = ANY($1)', [ids]);
            }
            await cliente.query(`DELETE FROM aceptaciones_legales WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE 'test23-%')`);
            await cliente.query(`DELETE FROM usuario_permisos WHERE usuario_id IN (SELECT id FROM usuarios WHERE email LIKE 'test23-%')`);
            await cliente.query(`DELETE FROM usuarios WHERE email LIKE 'test23-%'`);
            await cliente.query(`DELETE FROM clientes WHERE email LIKE 'test23-%'`);
            await cliente.query('COMMIT');
        } finally { cliente.release(); }
    }

    // Respuestas simuladas del SRI.
    const recibida = () => ({ ok: true, estado: 'RECIBIDA', mensajes: [], crudo: '<RECIBIDA/>' });
    const autorizado = (clave) => ({ ok: true, numeroComprobantes: 1, estado: 'AUTORIZADO', autorizacion: {
        estado: 'AUTORIZADO', numeroAutorizacion: clave, fechaAutorizacion: new Date().toISOString(), ambiente: 'PRUEBAS',
        comprobante: '<factura/>', mensajes: [{ identificador: '60', mensaje: 'ESTE PROCESO FUE REALIZADO EN EL AMBIENTE DE PRUEBAS', tipo: 'ADVERTENCIA' }] } });
    const sinRegistro = () => ({ ok: true, numeroComprobantes: 0, estado: null, autorizacion: null });
    const claveDe = (xml) => xml.match(/<claveAcceso>(\d{49})<\/claveAcceso>/)[1];

    beforeAll(async () => {
        pool = require('../config/db');
        soap = require('../sri/soap');
        SSSWAP = await require('../test-utils/empresaPrueba').idEmpresa('ss-swap');
        await limpiar();

        const express = require('express');
        const app = express();
        app.set('trust proxy', 1);
        app.use(express.json());
        const { contextoPublico, registrarErrores } = require('../middleware/empresa.middleware');
        app.use('/api', registrarErrores, contextoPublico);
        for (const r of ['auth', 'ordenes', 'proformas', 'plataforma', 'empresa', 'facturacion', 'legal', 'inventory', 'users']) {
            app.use(`/api/${r}`, require(`../routes/${r}.routes`));
        }
        app.use('/api/cuentas-cobrar', require('../routes/cuentasCobrar.routes'));
        await new Promise(ok => { server = app.listen(0, ok); });
        base = `http://127.0.0.1:${server.address().port}`;

        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash(PASS, 10);
        const c = await pool.connect();
        try {
            await c.query('BEGIN');
            await c.query(`SELECT set_config('ssswap.gestion_superadmin', 'on', true)`);
            await c.query(`INSERT INTO usuarios (nombre, email, password, rol, permisos_inicializados) VALUES ('TEST23 Plataforma', 'test23-plataforma@x.test', $1, 'superadministrador', TRUE)`, [hash]);
            const { rows } = await c.query(`INSERT INTO usuarios (nombre, email, password, rol, permisos_inicializados, empresa_id) VALUES ('TEST23 Admin SS', 'test23-ssadmin@x.test', $1, 'administrador', TRUE, $2) RETURNING id`, [hash, SSSWAP]);
            for (const p of require('../config/permisos').PLANTILLAS.administrador) {
                const [modulo, accion] = p.split(':');
                await c.query('INSERT INTO usuario_permisos (usuario_id, modulo, accion, empresa_id) VALUES ($1,$2,$3,$4)', [rows[0].id, modulo, accion, SSSWAP]);
            }
            await c.query('COMMIT');
        } finally { c.release(); }
        t.plataforma = (await login('test23-plataforma@x.test')).body.token;
        t.ssadmin = (await login('test23-ssadmin@x.test')).body.token;

        for (const [k, nombre] of [['a', 'TEST23 Taller Uno'], ['b', 'TEST23 Taller Dos']]) {
            const r = await api('POST', '/plataforma/empresas', { token: t.plataforma, body: {
                nombre, slug: `test23-${k}`, admin: { nombre: `Admin ${nombre}`, email: `test23-admin-${k}@x.test` } } });
            expect(r.status).toBe(201);
            t[`emp_${k}`] = r.body.empresa.id;
            t[k] = (await login(`test23-admin-${k}@x.test`, r.body.password_temporal)).body.token;
        }
        // Cliente, vehículo, producto con stock y proforma APROBADA en la empresa A.
        const cli = await api('POST', '/ordenes/clientes', { token: t.a, body: { nombre: 'TEST23 Juan Pérez', cedula: '1710034065', telefono: '0990000023', email: 'test23-juan@x.test', direccion: 'Quito' } });
        t.cli = (cli.body.cliente || cli.body).id;
        const veh = await api('POST', '/ordenes/vehiculos', { token: t.a, body: { cliente_id: t.cli, placa: 'PBA-2323', marca: 'Kia', modelo: 'Rio' } });
        t.veh = (veh.body.vehiculo || veh.body).id;
        const rep = await api('POST', '/inventory/repuestos', { token: t.a, body: { nombre: 'TEST23 Pastillas', area: 'mecanica', precio_venta: 18.5, stock_actual: 20 } });
        t.rep = (rep.body.repuesto || rep.body).id;
        t.nuevaProforma = async (precio = 40, token = t.a) => {
            const p = await api('POST', '/proformas', { token, body: {
                tipo: 'mecanica', cliente_id: t.cli, vehiculo_id: t.veh, fecha_emision: new Date().toISOString().slice(0, 10),
                iva_porcentaje: 15, descuento: 2, anticipo: 0, estado: 'emitida',
                items: [
                    { categoria: 'servicio', descripcion: 'Cambio de pastillas & mano de obra', cantidad: 1, precio_unitario: precio },
                    { categoria: 'producto', descripcion: 'Pastillas', cantidad: 2, precio_unitario: 18.5, referencia_tipo: 'repuesto', referencia_id: t.rep },
                ] } });
            expect(p.status).toBe(201);
            const ap = await api('PATCH', `/proformas/${p.body.proforma.id}/estado`, { token, body: { estado: 'aprobada' } });
            expect(ap.status).toBe(200);
            return p.body.proforma;
        };
    });

    afterAll(async () => {
        jest.restoreAllMocks();
        if (server) await new Promise(ok => server.close(ok));
        if (pool) { await limpiar(); await pool.end(); }
    });

    // ── F1 ──────────────────────────────────────────────────────────
    describe('F1. Configuración tributaria', () => {
        test('sin configuración, la emisión no está lista y lo dice', async () => {
            const r = await api('GET', '/facturacion/catalogos', { token: t.a });
            expect(r.status).toBe(200);
            expect(r.body.faltantes.length).toBeGreaterThan(0);
            expect(r.body.tarifas_iva.map(x => x.codigo)).toEqual(expect.arrayContaining(['0', '4', '5']));
        });

        test('valida el RUC y guarda los datos del emisor', async () => {
            expect((await api('PUT', '/facturacion/config', { token: t.a, body: { ruc: '123' } })).status).toBe(400);
            const r = await api('PUT', '/facturacion/config', { token: t.a, body: {
                ruc: '1790000000001', razon_social: 'TEST23 EMISOR S.A.', nombre_comercial: 'Taller Uno', dir_matriz: 'Av. Amazonas N1-23, Quito',
                regimen: 'general', obligado_contabilidad: true, iva_codigo_defecto: '4' } });
            expect(r.status).toBe(200);
            expect(r.body.config.ruc).toBe('1790000000001');
            const p = await api('POST', '/facturacion/config/puntos', { token: t.a, body: { establecimiento: '001', punto_emision: '001', direccion: 'Av. Amazonas N1-23, Quito' } });
            expect(p.status).toBe(201);
            t.punto = p.body.punto.id;
            expect((await api('POST', '/facturacion/config/puntos', { token: t.a, body: { establecimiento: '000', punto_emision: '001', direccion: 'X calle' } })).status).toBe(400);
        });

        test('el certificado se guarda cifrado y NUNCA vuelve por la API', async () => {
            const { certificadoPrueba } = require('../test-utils/certificadoPrueba');
            const { p12, clave } = certificadoPrueba();
            const malo = new FormData();
            malo.append('certificado', new Blob([p12]), 'firma.p12');
            malo.append('clave', 'clave-equivocada');
            expect((await api('POST', '/facturacion/config/certificado', { token: t.a, form: malo })).status).toBe(400);

            const form = new FormData();
            form.append('certificado', new Blob([p12]), 'firma.p12');
            form.append('clave', clave);
            const r = await api('POST', '/facturacion/config/certificado', { token: t.a, form });
            expect(r.status).toBe(200);
            expect(r.body.certificado.titular).toContain('PRUEBAS');
            const { rows } = await pool.query('SELECT certificado_cifrado FROM sri_configuracion WHERE empresa_id = $1', [t.emp_a]);
            expect(rows[0].certificado_cifrado.includes(p12.subarray(0, 32))).toBe(false); // no está en claro
            const cfg = await api('GET', '/facturacion/config', { token: t.a });
            const texto = JSON.stringify(cfg.body);
            expect(texto).not.toContain('certificado_cifrado');
            expect(texto).not.toContain('certificado_clave');
            expect(texto).not.toContain(clave);
            expect(cfg.body.faltantes).toEqual([]);
            const { rows: aud } = await pool.query(`SELECT detalle::text AS d FROM auditoria_seguridad WHERE accion = 'facturacion.certificado_cargar' AND empresa_id = $1`, [t.emp_a]);
            expect(aud.length).toBe(1);
            expect(aud[0].d).not.toContain(clave);
        });
    });

    // ── F2 ──────────────────────────────────────────────────────────
    describe('F2. Factura desde una proforma', () => {
        test('propuesta con los ítems aprobados y el comprador del cliente', async () => {
            t.prof1 = await t.nuevaProforma(40);
            const r = await api('GET', `/facturacion/propuesta?proforma_id=${t.prof1.id}`, { token: t.a });
            expect(r.status).toBe(200);
            expect(r.body.lineas).toHaveLength(2);
            expect(r.body.lineas.every(l => l.iva_codigo === '4')).toBe(true);
            expect(r.body.comprador).toMatchObject({ tipo_identificacion: '05', identificacion: '1710034065' });
            expect(r.body.descuento_global).toBe(2);
            t.propuesta = r.body;
        });

        test('crea el borrador; los totales los calcula el servidor; no se factura dos veces', async () => {
            const body = { ...t.propuesta, proforma_id: t.prof1.id, punto_emision_id: t.punto, comprador: t.propuesta.comprador,
                importe_total: 0.01 /* ignorado */ };
            const r = await api('POST', '/facturacion', { token: t.a, body, headers: { 'Idempotency-Key': 'test23-idem-0001' } });
            expect(r.status).toBe(201);
            // 40 + 37 - 2 = 75 ; IVA 15 % = 11.25 ; total 86.25 (igual a la proforma)
            expect(Number(r.body.total_sin_impuestos)).toBe(75);
            expect(Number(r.body.total_iva)).toBe(11.25);
            expect(Number(r.body.importe_total)).toBe(Number(t.prof1.total));
            expect(r.body.estado).toBe('borrador');
            expect(r.body.secuencial).toBeNull();
            t.f1 = r.body.id;
            // Repetir con la misma clave de idempotencia devuelve el mismo borrador.
            const otra = await api('POST', '/facturacion', { token: t.a, body, headers: { 'Idempotency-Key': 'test23-idem-0001' } });
            expect(otra.body.id).toBe(t.f1);
            const doble = await api('POST', '/facturacion', { token: t.a, body });
            expect(doble.status).toBe(409);
        });

        test('consumidor final no se admite por encima de USD 50', async () => {
            const prof = await t.nuevaProforma(60);
            const r = await api('POST', '/facturacion', { token: t.a, body: { ...t.propuesta, proforma_id: prof.id, punto_emision_id: t.punto,
                lineas: t.propuesta.lineas.map(l => ({ ...l, proforma_item_id: null })),
                comprador: { tipo_identificacion: '07', identificacion: '9999999999999' } } });
            expect(r.status).toBe(400);
            expect(r.body.error).toMatch(/50/);
        });
    });

    // ── F3 ──────────────────────────────────────────────────────────
    describe('F3. Emisión autorizada', () => {
        test('exige confirmar los datos del comprador', async () => {
            const r = await api('POST', `/facturacion/${t.f1}/emitir`, { token: t.a, body: {} });
            expect(r.status).toBe(400);
            expect(r.body.codigo).toBe('CONFIRMAR_COMPRADOR');
        });

        test('emite: número 001-001-000000001, XML válido y firmado, AUTORIZADO; no toca inventario ni pagos', async () => {
            const stockAntes = Number((await pool.query('SELECT stock_actual FROM repuestos WHERE id = $1', [t.rep])).rows[0].stock_actual);
            const pagosAntes = Number((await pool.query('SELECT COUNT(*) FROM pagos_cliente WHERE empresa_id = $1', [t.emp_a])).rows[0].count);
            let xmlEnviado;
            jest.spyOn(soap, 'recepcion').mockImplementationOnce(async (xml) => { xmlEnviado = xml; return recibida(); });
            jest.spyOn(soap, 'autorizacion').mockImplementationOnce(async (clave) => autorizado(clave));
            const r = await api('POST', `/facturacion/${t.f1}/emitir`, { token: t.a, body: { confirmar_comprador: true } });
            expect(r.status).toBe(200);
            expect(r.body.estado).toBe('autorizado');
            expect(r.body.numero).toBe('001-001-000000001');
            expect(require('../sri/claveAcceso').claveValida(r.body.clave_acceso)).toBe(true);
            expect(claveDe(xmlEnviado)).toBe(r.body.clave_acceso);
            expect((await require('../sri/validadorXsd').validarXsd(xmlEnviado, '01')).valido).toBe(true);
            expect(require('../sri/firma').verificarFirma(xmlEnviado).valida).toBe(true);
            expect(r.body.eventos.map(e => e.tipo)).toEqual(expect.arrayContaining(['borrador_creado', 'firmado', 'recibida', 'autorizado']));
            expect(Number((await pool.query('SELECT stock_actual FROM repuestos WHERE id = $1', [t.rep])).rows[0].stock_actual)).toBe(stockAntes);
            expect(Number((await pool.query('SELECT COUNT(*) FROM pagos_cliente WHERE empresa_id = $1', [t.emp_a])).rows[0].count)).toBe(pagosAntes);
            // El cliente queda con la identificación confirmada.
            const { rows } = await pool.query('SELECT tipo_identificacion, identificacion_confirmada_at FROM clientes WHERE id = $1', [t.cli]);
            expect(rows[0].tipo_identificacion).toBe('05');
            expect(rows[0].identificacion_confirmada_at).not.toBeNull();
        });

        test('descarga RIDE (PDF) y XML autorizado', async () => {
            const pdf = await api('GET', `/facturacion/${t.f1}/ride`, { token: t.a });
            expect(pdf.status).toBe(200);
            expect(pdf.body.subarray(0, 4).toString()).toBe('%PDF');
            const xml = await api('GET', `/facturacion/${t.f1}/xml`, { token: t.a });
            expect(xml.status).toBe(200);
            expect(xml.body.toString()).toContain('<estado>AUTORIZADO</estado>');
        });

        test('un comprobante autorizado no se puede editar, borrar ni re-emitir', async () => {
            expect((await api('PUT', `/facturacion/${t.f1}`, { token: t.a, body: t.propuesta })).status).toBe(409);
            expect((await api('POST', `/facturacion/${t.f1}/emitir`, { token: t.a, body: { confirmar_comprador: true } })).status).toBe(409);
            const { conEmpresa } = require('../config/contexto');
            await expect(conEmpresa(t.emp_a, () => pool.query('UPDATE comprobantes_electronicos SET importe_total = 1 WHERE id = $1', [t.f1]))).rejects.toThrow(/no se puede modificar/);
            await expect(conEmpresa(t.emp_a, () => pool.query('DELETE FROM comprobantes_electronicos WHERE id = $1', [t.f1]))).rejects.toThrow(/no se puede borrar/);
            await expect(conEmpresa(t.emp_a, () => pool.query('UPDATE comprobante_detalles SET cantidad = 9 WHERE comprobante_id = $1', [t.f1]))).rejects.toThrow(/no se pueden modificar/);
            await expect(conEmpresa(t.emp_a, () => pool.query('DELETE FROM comprobante_eventos WHERE comprobante_id = $1', [t.f1]))).rejects.toThrow();
        });
    });

    // ── F4 ──────────────────────────────────────────────────────────
    describe('F4. Respuestas inciertas, devueltas y reintentos', () => {
        test('sin respuesta del SRI: queda pendiente; al reintentar consulta primero y reenvía la MISMA clave', async () => {
            const prof = await t.nuevaProforma(30);
            const prop = (await api('GET', `/facturacion/propuesta?proforma_id=${prof.id}`, { token: t.a })).body;
            const b = await api('POST', '/facturacion', { token: t.a, body: { ...prop, proforma_id: prof.id, punto_emision_id: t.punto } });
            t.f2 = b.body.id;
            jest.spyOn(soap, 'recepcion').mockResolvedValueOnce({ ok: false, incierto: true, error: 'El SRI no respondió a tiempo.' });
            const r = await api('POST', `/facturacion/${t.f2}/emitir`, { token: t.a, body: { confirmar_comprador: true } });
            expect(r.body).toMatchObject({ estado: 'pendiente_reintento' });
            expect(r.body.numero).toBe('001-001-000000002');
            const clave = r.body.clave_acceso;

            const envios = [];
            const consultas = jest.spyOn(soap, 'autorizacion');
            consultas.mockClear(); // el espía acumula llamadas de pruebas anteriores
            consultas
                .mockResolvedValueOnce(sinRegistro())              // ¿lo tiene el SRI? no
                .mockImplementationOnce(async (c) => autorizado(c)); // tras reenviar: autorizado
            jest.spyOn(soap, 'recepcion').mockImplementationOnce(async (xml) => {
                envios.push(claveDe(xml));
                return { ok: true, estado: 'DEVUELTA', mensajes: [{ identificador: '43', mensaje: 'CLAVE ACCESO REGISTRADA', tipo: 'ERROR' }] };
            });
            const p = await api('POST', `/facturacion/${t.f2}/procesar`, { token: t.a });
            expect(p.body.estado).toBe('autorizado');
            expect(envios).toEqual([clave]);
            expect(consultas).toHaveBeenCalledTimes(2);
            expect(p.body.numero).toBe('001-001-000000002'); // ningún secuencial nuevo
        });

        test('DEVUELTA por un error de datos: se corrige y se reenvía con la misma clave y secuencial', async () => {
            const prof = await t.nuevaProforma(25);
            const prop = (await api('GET', `/facturacion/propuesta?proforma_id=${prof.id}`, { token: t.a })).body;
            const b = await api('POST', '/facturacion', { token: t.a, body: { ...prop, proforma_id: prof.id, punto_emision_id: t.punto } });
            t.f3 = b.body.id;
            jest.spyOn(soap, 'recepcion').mockResolvedValueOnce({ ok: true, estado: 'DEVUELTA',
                mensajes: [{ identificador: '35', mensaje: 'ARCHIVO NO CUMPLE ESTRUCTURA XML', informacionAdicional: 'detalle', tipo: 'ERROR' }] });
            const r = await api('POST', `/facturacion/${t.f3}/emitir`, { token: t.a, body: { confirmar_comprador: true } });
            expect(r.body.estado).toBe('devuelta');
            const { clave_acceso: clave, numero } = r.body;
            // Corregir (la dirección del comprador) y reenviar.
            const ed = await api('PUT', `/facturacion/${t.f3}`, { token: t.a, body: { ...prop, comprador: { ...prop.comprador, direccion: 'Av. Corregida 123' } } });
            expect(ed.status).toBe(200);
            jest.spyOn(soap, 'recepcion').mockResolvedValueOnce(recibida());
            jest.spyOn(soap, 'autorizacion').mockImplementationOnce(async (c) => autorizado(c));
            const r2 = await api('POST', `/facturacion/${t.f3}/emitir`, { token: t.a, body: { confirmar_comprador: true } });
            expect(r2.body.estado).toBe('autorizado');
            expect(r2.body.clave_acceso).toBe(clave);
            expect(r2.body.numero).toBe(numero);
            expect(r2.body.comprador_direccion).toBe('Av. Corregida 123');
        });

        test('error 70 (en procesamiento) no es un rechazo: se consulta', async () => {
            const prof = await t.nuevaProforma(20);
            const prop = (await api('GET', `/facturacion/propuesta?proforma_id=${prof.id}`, { token: t.a })).body;
            const b = await api('POST', '/facturacion', { token: t.a, body: { ...prop, proforma_id: prof.id, punto_emision_id: t.punto } });
            jest.spyOn(soap, 'recepcion').mockResolvedValueOnce({ ok: true, estado: 'DEVUELTA', mensajes: [{ identificador: '70', mensaje: 'CLAVE DE ACCESO EN PROCESAMIENTO', tipo: 'ERROR' }] });
            jest.spyOn(soap, 'autorizacion').mockResolvedValueOnce(sinRegistro());
            const r = await api('POST', `/facturacion/${b.body.id}/emitir`, { token: t.a, body: { confirmar_comprador: true } });
            expect(r.body.estado).toBe('en_procesamiento');
        });
    });

    // ── F5 ──────────────────────────────────────────────────────────
    describe('F5. Concurrencia de la numeración', () => {
        test('emisiones simultáneas obtienen números distintos y consecutivos', async () => {
            const ids = [];
            for (let i = 0; i < 3; i++) {
                const prof = await t.nuevaProforma(10 + i);
                const prop = (await api('GET', `/facturacion/propuesta?proforma_id=${prof.id}`, { token: t.a })).body;
                ids.push((await api('POST', '/facturacion', { token: t.a, body: { ...prop, proforma_id: prof.id, punto_emision_id: t.punto } })).body.id);
            }
            jest.spyOn(soap, 'recepcion').mockResolvedValue({ ok: false, incierto: true, error: 'simulado' });
            const rs = await Promise.all(ids.map(id => api('POST', `/facturacion/${id}/emitir`, { token: t.a, body: { confirmar_comprador: true } })));
            soap.recepcion.mockRestore();
            const nums = rs.map(r => r.body.secuencial).sort();
            expect(new Set(nums).size).toBe(3);
            const n = nums.map(Number);
            expect(n[2] - n[0]).toBe(2);
        });
    });

    // ── F6 ──────────────────────────────────────────────────────────
    describe('F6. Nota de crédito y anulación', () => {
        test('NC sobre factura autorizada, sin superar lo facturado', async () => {
            const excesiva = await api('POST', '/facturacion/notas-credito', { token: t.a, body: { factura_id: t.f1, motivo: 'Devolución',
                lineas: [{ descripcion: 'Devolución', cantidad: 1, precio_unitario: 999, iva_codigo: '4' }] } });
            expect(excesiva.status).toBe(400);
            const r = await api('POST', '/facturacion/notas-credito', { token: t.a, body: { factura_id: t.f1, motivo: 'Devolución de pastillas',
                lineas: [{ codigo: 'REP', descripcion: 'Pastillas devueltas', cantidad: 1, precio_unitario: 18.5, iva_codigo: '4' }] } });
            expect(r.status).toBe(201);
            expect(r.body.cod_doc).toBe('04');
            let xmlNc;
            jest.spyOn(soap, 'recepcion').mockImplementationOnce(async (xml) => { xmlNc = xml; return recibida(); });
            jest.spyOn(soap, 'autorizacion').mockImplementationOnce(async (c) => autorizado(c));
            const e = await api('POST', `/facturacion/${r.body.id}/emitir`, { token: t.a, body: { confirmar_comprador: true } });
            expect(e.body.estado).toBe('autorizado');
            expect(e.body.numero).toBe('001-001-000000001'); // numeración propia de notas de crédito
            expect(xmlNc).toContain('<numDocModificado>001-001-000000001</numDocModificado>');
            expect((await require('../sri/validadorXsd').validarXsd(xmlNc, '04')).valido).toBe(true);
        });

        test('anulación: se registra y SOLO se marca anulada cuando el SRI lo confirma', async () => {
            const r = await api('POST', `/facturacion/${t.f2}/anulacion`, { token: t.a, body: { motivo: 'Error en el valor facturado al cliente' } });
            expect(r.body.estado).toBe('anulacion_solicitada');
            jest.spyOn(soap, 'consultaEstado').mockResolvedValueOnce({ ok: true, estadoAutorizacion: 'AUTORIZADO', mensajes: [] });
            expect((await api('POST', `/facturacion/${t.f2}/procesar`, { token: t.a })).body.estado).toBe('anulacion_solicitada');
            jest.spyOn(soap, 'consultaEstado').mockResolvedValueOnce({ ok: true, estadoAutorizacion: 'ANULADO', mensajes: [] });
            const fin = await api('POST', `/facturacion/${t.f2}/procesar`, { token: t.a });
            expect(fin.body.estado).toBe('anulado');
        });
    });

    // ── F7 ──────────────────────────────────────────────────────────
    describe('F7. Aislamiento y permisos', () => {
        test('otra empresa no ve, no descarga ni modifica comprobantes ajenos', async () => {
            for (const [m, ruta] of [['GET', `/facturacion/${t.f1}`], ['GET', `/facturacion/${t.f1}/xml`], ['GET', `/facturacion/${t.f1}/ride`],
                ['POST', `/facturacion/${t.f1}/procesar`], ['POST', `/facturacion/${t.f1}/anulacion`]]) {
                const r = await api(m, ruta, { token: t.b, body: { motivo: 'intento de acceso cruzado' } });
                expect({ ruta, status: r.status }).toEqual({ ruta, status: 404 });
            }
            const lista = await api('GET', '/facturacion', { token: t.b });
            expect(lista.body.comprobantes).toEqual([]);
            const cfg = await api('GET', '/facturacion/config', { token: t.b });
            expect(cfg.body.config).toBeNull();
            // B no puede facturar una proforma de A ni usar su punto de emisión.
            const r = await api('POST', '/facturacion', { token: t.b, body: { ...t.propuesta, proforma_id: t.prof1.id, punto_emision_id: t.punto } });
            expect([400, 404, 409]).toContain(r.status);
        });

        test('sin el permiso "emitir" no se envía nada al SRI', async () => {
            const bcrypt = require('bcryptjs');
            const { rows } = await pool.query(
                `INSERT INTO usuarios (nombre, email, password, rol, permisos_inicializados, empresa_id) VALUES ('TEST23 Recepcion', 'test23-recep@x.test', $1, 'recepcionista', TRUE, $2) RETURNING id`,
                [await bcrypt.hash(PASS, 10), t.emp_a]);
            for (const p of require('../config/permisos').PLANTILLAS.recepcionista) {
                const [modulo, accion] = p.split(':');
                await pool.query('INSERT INTO usuario_permisos (usuario_id, modulo, accion, empresa_id) VALUES ($1,$2,$3,$4)', [rows[0].id, modulo, accion, t.emp_a]);
            }
            const tok = (await login('test23-recep@x.test')).body.token;
            const prof = await t.nuevaProforma(15);
            const prop = (await api('GET', `/facturacion/propuesta?proforma_id=${prof.id}`, { token: tok })).body;
            const b = await api('POST', '/facturacion', { token: tok, body: { ...prop, proforma_id: prof.id, punto_emision_id: t.punto } });
            expect(b.status).toBe(201); // prepara el borrador
            const e = await api('POST', `/facturacion/${b.body.id}/emitir`, { token: tok, body: { confirmar_comprador: true } });
            expect(e.status).toBe(403);
            expect((await api('PUT', '/facturacion/config', { token: tok, body: { razon_social: 'X' } })).status).toBe(403);
            expect((await api('POST', '/facturacion/notas-credito', { token: tok, body: { factura_id: t.f1, motivo: 'xxxxx' } })).status).toBe(403);
        });
    });

    // ── F8 ──────────────────────────────────────────────────────────
    describe('F8. Ambiente de producción', () => {
        test('exige confirmación expresa y el permiso de aprobación', async () => {
            expect((await api('POST', '/facturacion/config/produccion', { token: t.a, body: {} })).status).toBe(400);
            const tokB = t.b;
            await api('PUT', '/facturacion/config', { token: tokB, body: { ruc: '1790000000002', razon_social: 'TEST23 DOS', dir_matriz: 'Quito centro' } });
            const sinPruebas = await api('POST', '/facturacion/config/produccion', { token: tokB, body: { confirmacion: 'ACTIVAR PRODUCCION', confirmo_habilitacion_sri: true } });
            expect(sinPruebas.status).toBe(409); // configuración incompleta / sin pruebas autorizadas
            const ok = await api('POST', '/facturacion/config/produccion', { token: t.a, body: { confirmacion: 'ACTIVAR PRODUCCION', confirmo_habilitacion_sri: true } });
            expect(ok.status).toBe(200);
            expect(Number(ok.body.config.ambiente)).toBe(2);
            expect(ok.body.config.produccion_habilitada_at).toBeTruthy();
            // Volver a pruebas para no dejar la empresa de prueba en producción.
            expect((await api('POST', '/facturacion/config/pruebas', { token: t.a })).status).toBe(200);
        });
    });

    // ── Legal ───────────────────────────────────────────────────────
    describe('L. Documentos legales y aceptaciones', () => {
        test('L1. versión publicada inmutable; el hash lo fija la base de datos', async () => {
            const doc = await api('POST', '/legal/documentos', { token: t.ssadmin, body: { tipo: 'terminos', titulo: 'TEST23 Términos del taller' } });
            expect(doc.status).toBe(201);
            t.docTerm = doc.body.documento.id;
            const texto = 'TÉRMINOS DE PRUEBA. '.repeat(10);
            const v = await api('POST', `/legal/documentos/${t.docTerm}/versiones`, { token: t.ssadmin, body: { contenido: texto } });
            expect(v.status).toBe(201);
            const sinConfirmar = await api('POST', `/legal/versiones/${v.body.version.id}/publicar`, { token: t.ssadmin, body: {} });
            expect(sinConfirmar.status).toBe(400);
            const pub = await api('POST', `/legal/versiones/${v.body.version.id}/publicar`, { token: t.ssadmin, body: { confirmacion: true } });
            expect(pub.status).toBe(200);
            const esperado = require('crypto').createHash('sha256').update(texto.trim(), 'utf8').digest('hex');
            expect(pub.body.version.hash_contenido).toBe(esperado);
            expect(pub.body.version.cambio_material).toBe(true); // la primera siempre es material
            t.v1 = pub.body.version.id;
            expect((await api('PUT', `/legal/versiones/${t.v1}`, { token: t.ssadmin, body: { contenido: 'otro texto '.repeat(10) } })).status).toBe(409);
            expect((await api('DELETE', `/legal/versiones/${t.v1}`, { token: t.ssadmin })).status).toBe(409);
            const { conEmpresa } = require('../config/contexto');
            await expect(conEmpresa(SSSWAP, () => pool.query('UPDATE documento_legal_versiones SET contenido = $1 WHERE id = $2', ['x'.repeat(60), t.v1]))).rejects.toThrow(/no se puede modificar/);
        });

        test('L2. registro de cliente: sin aceptar no se crea la cuenta; aceptando queda la evidencia', async () => {
            const pub = await api('GET', '/legal/publico/vigentes');
            const term = pub.body.documentos.find(x => x.documento_id === t.docTerm);
            expect(term).toBeTruthy();
            const datos = { nombre: 'TEST23 Cliente Portal', email: 'test23-portal@x.test', password: 'ClaveSegura-2026', cedula: '0102030405' };
            const sin = await api('POST', '/auth/register', { body: datos });
            expect(sin.status).toBe(400);
            expect((await pool.query(`SELECT COUNT(*) FROM usuarios WHERE email = 'test23-portal@x.test'`)).rows[0].count).toBe('0');
            const obligatorios = pub.body.documentos.filter(x => x.obligatorio).map(x => x.version_id);
            const con = await api('POST', '/auth/register', { body: { ...datos, aceptaciones: obligatorios } });
            expect(con.status).toBe(201);
            t.portal = con.body.token;
            const { rows } = await pool.query(
                `SELECT a.hash_contenido, a.contexto, a.ip, v.hash_contenido AS hv FROM aceptaciones_legales a JOIN documento_legal_versiones v ON v.id = a.version_id
                 JOIN usuarios u ON u.id = a.usuario_id WHERE u.email = 'test23-portal@x.test' AND a.version_id = $1`, [t.v1]);
            expect(rows).toHaveLength(1);
            expect(rows[0].hash_contenido).toBe(rows[0].hv);
            expect(rows[0].contexto).toBe('registro_cliente');
            expect(rows[0].ip).toBeTruthy();
        });

        test('L3. nueva versión material: queda pendiente; aceptar no altera la aceptación anterior', async () => {
            const v2 = await api('POST', `/legal/documentos/${t.docTerm}/versiones`, { token: t.ssadmin, body: { contenido: 'TÉRMINOS V2 CON CAMBIO MATERIAL. '.repeat(5), cambio_material: true, resumen_cambios: 'Nuevo plazo' } });
            const pub = await api('POST', `/legal/versiones/${v2.body.version.id}/publicar`, { token: t.ssadmin, body: { confirmacion: true, cambio_material: true } });
            expect(pub.status).toBe(200);
            expect(pub.body.notificados).toBeGreaterThanOrEqual(1);
            const pend = await api('GET', '/legal/pendientes', { token: t.portal });
            expect(pend.body.documentos.map(x => x.version_id)).toContain(pub.body.version.id);
            const ac = await api('POST', '/legal/aceptar', { token: t.portal, body: { version_ids: [pub.body.version.id], acepto: true } });
            expect(ac.status).toBe(201);
            t.transaccion = ac.body.transaccion_id;
            expect((await api('GET', '/legal/pendientes', { token: t.portal })).body.documentos.map(x => x.documento_id)).not.toContain(t.docTerm);
            const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM aceptaciones_legales WHERE version_id = $1`, [t.v1]);
            expect(rows[0].n).toBeGreaterThanOrEqual(1); // la de la versión 1 sigue ahí
            // Aceptar una versión que ya no es la vigente falla.
            expect((await api('POST', '/legal/aceptar', { token: t.portal, body: { version_ids: [t.v1], acepto: true } })).status).toBe(409);
        });

        test('L4. la evidencia es de solo inserción, incluso para la aplicación', async () => {
            const { conEmpresa } = require('../config/contexto');
            await expect(conEmpresa(SSSWAP, () => pool.query('UPDATE aceptaciones_legales SET ip = NULL WHERE version_id = $1', [t.v1]))).rejects.toThrow();
            await expect(conEmpresa(SSSWAP, () => pool.query('DELETE FROM aceptaciones_legales WHERE version_id = $1', [t.v1]))).rejects.toThrow();
        });

        test('L5. constancia PDF: el titular la descarga; otra empresa no', async () => {
            const r = await api('GET', `/legal/constancias/${t.transaccion}`, { token: t.portal });
            expect(r.status).toBe(200);
            expect(r.body.subarray(0, 4).toString()).toBe('%PDF');
            expect((await api('GET', `/legal/constancias/${t.transaccion}`, { token: t.a })).status).toBe(404);
            // Sin permiso legal no se publican documentos.
            expect((await api('POST', `/legal/documentos`, { token: t.portal, body: { tipo: 'privacidad' } })).status).toBe(403);
            // A no ve los documentos ni las aceptaciones de SS SWAP.
            const docsA = await api('GET', '/legal/documentos', { token: t.a });
            expect(docsA.body.documentos.find(x => x.id === t.docTerm)).toBeUndefined();
            expect((await api('GET', `/legal/aceptaciones?documento_id=${t.docTerm}`, { token: t.a })).body.aceptaciones).toEqual([]);
        });

        test('L6. contratación: la empresa no la completa sin aceptar los documentos de la plataforma', async () => {
            const doc = await api('POST', '/legal/documentos?ambito=plataforma', { token: t.plataforma, body: { ambito: 'plataforma', tipo: 'condiciones_empresariales', titulo: 'TEST23 Condiciones SaaS' } });
            expect(doc.status).toBe(201);
            const v = await api('POST', `/legal/documentos/${doc.body.documento.id}/versiones?ambito=plataforma`, { token: t.plataforma, body: { ambito: 'plataforma', contenido: 'CONDICIONES DEL SERVICIO SaaS DE PRUEBA. '.repeat(4) } });
            expect(v.status).toBe(201);
            const pub = await api('POST', `/legal/versiones/${v.body.version.id}/publicar?ambito=plataforma`, { token: t.plataforma, body: { ambito: 'plataforma', confirmacion: true } });
            expect(pub.status).toBe(200);
            // Una empresa no puede crear documentos de la plataforma.
            expect((await api('POST', '/legal/documentos?ambito=plataforma', { token: t.a, body: { ambito: 'plataforma', tipo: 'terminos' } })).status).toBe(403);

            const k = await api('POST', '/legal/plataforma/contratos', { token: t.plataforma, body: { empresa_id: t.emp_a, plan: 'Plan Taller', alcance: 'Uso del sistema de gestión y facturación electrónica para un taller.', precio: 30, periodicidad: 'mensual' } });
            expect(k.status).toBe(201);
            const info = await api('GET', '/legal/contratacion', { token: t.a });
            expect(info.body.contratos.find(x => x.id === k.body.contrato.id).estado).toBe('pendiente_aceptacion');
            const versiones = info.body.documentos.filter(x => x.obligatorio).map(x => x.version_id);
            expect(versiones).toContain(pub.body.version.id);
            const sinDocs = await api('POST', '/legal/aceptar', { token: t.a, body: { contrato_id: k.body.contrato.id, version_ids: [], acepto: true } });
            expect(sinDocs.status).toBe(400);
            const ok = await api('POST', '/legal/aceptar', { token: t.a, body: { contrato_id: k.body.contrato.id, version_ids: versiones, acepto: true } });
            expect(ok.status).toBe(201);
            const { rows } = await pool.query('SELECT estado, transaccion_aceptacion FROM contratos_empresa WHERE id = $1', [k.body.contrato.id]);
            expect(rows[0].estado).toBe('vigente');
            expect(rows[0].transaccion_aceptacion).toBe(ok.body.transaccion_id);
            await expect(pool.query('UPDATE contratos_empresa SET precio = 1 WHERE id = $1', [k.body.contrato.id])).rejects.toThrow(/no se pueden cambiar/);
            // B no ve el contrato de A.
            expect((await api('GET', '/legal/contratacion', { token: t.b })).body.contratos).toEqual([]);
        });
    });
});
