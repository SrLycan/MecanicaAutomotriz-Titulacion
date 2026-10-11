/**
 * SS SWAP - Pruebas de INTEGRACION del Sprint 20 contra un PostgreSQL REAL.
 * (pagares al 100%, anticipo por tipo de trabajo, alertas, codigos de
 * inventario y PDF). Igual que sprint14: solo corren con PG_INTEGRATION=1.
 *
 *   PG_INTEGRATION=1 DB_NAME=ssswap_test npx jest sprint20
 *
 * ¡NUNCA apuntar a produccion! Usa datos con prefijo "TEST20" y los borra.
 *
 *  A. Mecanica sin anticipo          D. Colisiones con anticipo 70%
 *  B. Mecanica con pago parcial      E. Pagare vencido / pagado no vencido
 *  C. Mecanica pagada por completo   F. Inventario: referencia interna + proveedor
 *  G. PDF de mecanica y colisiones (nombre, codigos, totales, varias paginas)
 *  + correccion de pagares antiguos del 70% (migracion), duplicados y
 *    bloqueo del estado manual.
 */
const RUN = process.env.PG_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

function mockRes() {
    const res = { statusCode: 200, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
}
async function call(fn, { params = {}, body = {}, query = {}, usuario }) {
    const res = mockRes();
    await fn({ params, body, query, usuario }, res);
    return res;
}

/** Genera el PDF en un proceso aparte (como sprint14) y devuelve su texto extraido + paginas. */
function pdfDe(proforma) {
    const { execFileSync } = require('child_process');
    const path = require('path');
    const script = `const {generarProformaPdf}=require(${JSON.stringify(path.join(__dirname, '../services/proformaPdf.service'))});
        const {PassThrough}=require('stream');let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const s=new PassThrough();const ch=[];
        s.on('data',c=>ch.push(c));s.on('end',()=>process.stdout.write(Buffer.concat(ch)));generarProformaPdf(JSON.parse(d),s);});`;
    return execFileSync(process.execPath, ['-e', script], { input: JSON.stringify(proforma) });
}

d('Sprint 20 - pagares, anticipos, alertas, codigos y PDF', () => {
    let pool, proformas, cuentas, inventario, exportar;
    let admin, cliente, vehiculo;

    beforeAll(async () => {
        pool = require('../config/db');
        proformas = require('../controllers/proformas.controller');
        cuentas = require('../controllers/cuentasCobrar.controller');
        inventario = require('../controllers/inventory.controller');
        exportar = require('../controllers/proformasExport.controller');
        admin = (await pool.query(`INSERT INTO usuarios (nombre, email, password, rol) VALUES ('TEST20 Admin','test20-admin@x.test','x','administrador') RETURNING id, nombre, rol`)).rows[0];
        admin.permisos = require('../config/permisos').PLANTILLAS.administrador; // Sprint 21
        cliente = (await pool.query(`INSERT INTO clientes (nombre, cedula, telefono, email) VALUES ('Cliente TEST20 Peña', 'TEST20-CI', '0999000000', 'test20@x.test') RETURNING *`)).rows[0];
        // Datos del vehiculo con caracteres que antes salian ilegibles en el PDF:
        // tilde "descompuesta" (NFD), comillas tipograficas y un ancho cero.
        vehiculo = (await pool.query(`INSERT INTO vehiculos (cliente_id, placa, marca, modelo, color, anio) VALUES ($1,'TST-2020','FIAT','Uno “Way” Pequeño​','Azul Océano',2019) RETURNING *`, [cliente.id])).rows[0];
    });

    afterAll(async () => {
        if (!pool) return;
        await pool.query(`DELETE FROM pagos_cliente WHERE cuenta_id IN (SELECT id FROM cuentas_cobrar WHERE cliente_id = $1)`, [cliente.id]);
        await pool.query(`DELETE FROM cuentas_cobrar WHERE cliente_id = $1`, [cliente.id]);
        await pool.query(`UPDATE movimientos_inventario SET movimiento_revertido_id = NULL WHERE repuesto_id IN (SELECT id FROM repuestos WHERE nombre LIKE 'TEST20%')`);
        await pool.query(`DELETE FROM movimientos_inventario WHERE repuesto_id IN (SELECT id FROM repuestos WHERE nombre LIKE 'TEST20%')`);
        await pool.query(`DELETE FROM proformas WHERE cliente_id = $1`, [cliente.id]);
        await pool.query(`DELETE FROM ordenes_trabajo WHERE cliente_id = $1`, [cliente.id]);
        await pool.query(`DELETE FROM repuestos WHERE nombre LIKE 'TEST20%'`);
        await pool.query(`DELETE FROM vehiculos WHERE cliente_id = $1`, [cliente.id]);
        await pool.query(`DELETE FROM clientes WHERE id = $1`, [cliente.id]);
        await pool.query(`DELETE FROM usuarios WHERE id = $1`, [admin.id]);
        await pool.end();
    });

    const base = (extra = {}) => ({
        tipo: 'mecanica', cliente_id: cliente.id, vehiculo_id: vehiculo.id,
        fecha_emision: new Date().toISOString().slice(0, 10), iva_porcentaje: 0, descuento: 0, anticipo: 0, ...extra,
    });
    const detalle = async (id) => (await call(cuentas.obtenerCuenta, { usuario: admin, params: { id } })).body.cuenta;
    const pagar = (id, monto, extra = {}) => call(cuentas.registrarPago, { usuario: admin, params: { id }, body: { monto, metodo_pago: 'efectivo', ...extra } });
    /** Crea una proforma de un tipo/total y la convierte en OT (genera el pagare). */
    async function proformaConPagare(tipo, total, extra = {}) {
        const cat = tipo === 'pintura' ? 'mano_obra' : 'servicio';
        const p = (await call(proformas.crearProforma, { usuario: admin, body: base({ tipo, estado: 'emitida', ...extra,
            items: [{ categoria: cat, descripcion: `Trabajo TEST20 ${tipo}`, cantidad: 1, precio_unitario: total }] }) })).body.proforma;
        const conv = await call(proformas.convertirAOrden, { usuario: admin, params: { id: p.id } });
        expect(conv.statusCode).toBe(201);
        expect(conv.body.pagare_creado).toBe(true);
        return { proforma: p, cuentaId: conv.body.pagare.id };
    }

    let casoMec;
    test('Caso A: mecanica sin anticipo -> total $500, pagado $0, pendiente $500, 0%, pendiente', async () => {
        casoMec = await proformaConPagare('mecanica', 500);
        expect(Number(casoMec.proforma.anticipo)).toBe(0);
        expect(Number(casoMec.proforma.saldo)).toBe(500);       // el anticipo no se descuenta como si estuviera pagado
        const c = await detalle(casoMec.cuentaId);
        expect(c).toMatchObject({ total: 500, pagado: 0, saldo: 500, porcentaje_pagado: 0, anticipo_requerido: 0, estado: 'pendiente' });
        expect(Number(c.monto_total)).toBe(500);
    });

    test('Caso B: mecanica con pago parcial de $200 -> pagado $200, pendiente $300, 40%, parcial', async () => {
        const r = await pagar(casoMec.cuentaId, 200);
        expect(r.statusCode).toBe(201);
        expect(r.body.cuenta).toMatchObject({ pagado: 200, saldo: 300, porcentaje_pagado: 40, estado: 'parcial' });
        const c = await detalle(casoMec.cuentaId);
        expect(c).toMatchObject({ pagado: 200, saldo: 300, porcentaje_pagado: 40, porcentaje_pendiente: 60, estado: 'parcial' });
        expect(c.fecha_pago_completo).toBeNull();
    });

    test('Validaciones: no supera el saldo, detecta duplicados y el estado no se fuerza a mano', async () => {
        expect((await pagar(casoMec.cuentaId, 300.01)).statusCode).toBe(409);
        // Mismo pago repetido enseguida (doble clic) -> se pide confirmacion
        const dup = await pagar(casoMec.cuentaId, 200);
        expect(dup.statusCode).toBe(409);
        expect(dup.body.posible_duplicado).toBe(true);
        // Mismo comprobante de transferencia dos veces -> bloqueado
        const trx = { metodo_pago: 'transferencia', banco: 'Banco TEST20', numero_cuenta: '123', titular: 'X', numero_comprobante: 'TRX-TEST20-1', fecha_documento: '2026-10-08' };
        expect((await pagar(casoMec.cuentaId, 10, trx)).statusCode).toBe(201);
        expect((await pagar(casoMec.cuentaId, 11, trx)).statusCode).toBe(409);
        // El estado "pagado" ya no se elige a mano
        const forzar = await call(cuentas.cambiarEstadoCuenta, { usuario: admin, params: { id: casoMec.cuentaId }, body: { estado: 'pagado' } });
        expect(forzar.statusCode).toBe(400);
        expect((await detalle(casoMec.cuentaId)).estado).toBe('parcial');
    });

    test('Caso C: mecanica pagada por completo -> pagado $500, pendiente $0, 100%, pagado, con fecha de pago completo', async () => {
        const r = await pagar(casoMec.cuentaId, 290);
        expect(r.statusCode).toBe(201);
        const c = await detalle(casoMec.cuentaId);
        expect(c).toMatchObject({ pagado: 500, saldo: 0, porcentaje_pagado: 100, porcentaje_pendiente: 0, estado: 'pagado' });
        expect(c.fecha_pago_completo).not.toBeNull();
        expect(c.pagos.filter(p => !p.anulado_at)).toHaveLength(3);   // historial completo, nada sobrescrito
        expect((await pagar(casoMec.cuentaId, 1)).statusCode).toBe(409);
        // Anular un pago reabre la deuda (y quita la fecha de pago completo)
        const ultimo = c.pagos.find(p => Number(p.monto) === 290);
        await call(cuentas.eliminarPago, { usuario: admin, params: { id: casoMec.cuentaId, pagoId: ultimo.id }, body: { motivo: 'prueba' } });
        const reab = await detalle(casoMec.cuentaId);
        expect(reab).toMatchObject({ pagado: 210, saldo: 290, estado: 'parcial' });
        expect(reab.fecha_pago_completo).toBeNull();
        expect(reab.pagos).toHaveLength(3);                       // 200 + 10 + 290 (anulado, sigue visible)
        expect(reab.pagos.filter(p => p.anulado_at)).toHaveLength(1);
        await pagar(casoMec.cuentaId, 290, { notas: 'pago final' });
        expect((await detalle(casoMec.cuentaId)).estado).toBe('pagado');
    });

    let casoCol;
    test('Caso D: colisiones $3.000 -> anticipo requerido $2.100, saldo restante $900, sin marcar nada como pagado', async () => {
        casoCol = await proformaConPagare('pintura', 3000, { anticipo: 5 });   // el anticipo manual se ignora en colisiones
        expect(Number(casoCol.proforma.anticipo)).toBe(2100);
        const c = await detalle(casoCol.cuentaId);
        expect(c).toMatchObject({ total: 3000, pagado: 0, saldo: 3000, anticipo_requerido: 2100, saldo_despues_anticipo: 900, anticipo_cubierto: false, estado: 'pendiente' });
        expect(Number(c.porcentaje)).toBe(70);
        expect(Number(c.monto_total)).toBe(3000);          // el pagare es el 100%, no el 70%

        const ant = await pagar(casoCol.cuentaId, 2100, { notas: 'anticipo 70%' });
        expect(ant.body.cuenta).toMatchObject({ pagado: 2100, saldo: 900, porcentaje_pagado: 70, estado: 'parcial', anticipo_cubierto: true });
        expect(ant.body.cuenta.estado).not.toBe('pagado');   // bug corregido

        const fin = await pagar(casoCol.cuentaId, 900, { notas: 'saldo 30%' });
        expect(fin.body.cuenta).toMatchObject({ pagado: 3000, saldo: 0, porcentaje_pagado: 100, estado: 'pagado' });
    });

    test('Caso E: pagare vencido con saldo aparece en alertas con dias de retraso; uno pagado no', async () => {
        const v = await proformaConPagare('mecanica', 400);
        await pool.query(`UPDATE cuentas_cobrar SET fecha = CURRENT_DATE - 20, fecha_vencimiento = CURRENT_DATE - 5 WHERE id = $1`, [v.cuentaId]);
        await pagar(v.cuentaId, 100);
        // El pagado (casoMec) tambien con fecha pasada: no debe salir vencido
        await pool.query(`UPDATE cuentas_cobrar SET fecha = CURRENT_DATE - 20, fecha_vencimiento = CURRENT_DATE - 5 WHERE id = $1`, [casoMec.cuentaId]);

        const c = await detalle(v.cuentaId);
        expect(c).toMatchObject({ estado: 'vencido', dias_retraso: 5, saldo: 300, pagado: 100 });
        const al = (await call(cuentas.alertasVencimiento, { usuario: admin })).body;
        const mia = al.alertas.find(a => a.id === v.cuentaId);
        expect(mia).toMatchObject({ tipo_alerta: 'vencido', dias_retraso: 5, saldo: 300, cliente_nombre: cliente.nombre });
        expect(al.alertas.find(a => a.id === casoMec.cuentaId)).toBeUndefined();
        expect((await detalle(casoMec.cuentaId)).estado).toBe('pagado');
        // Filtro por estado efectivo y resumen
        const lista = await call(cuentas.listarCuentas, { usuario: admin, query: { estado: 'vencido', cliente_id: cliente.id } });
        expect(lista.body.cuentas.map(x => x.id)).toEqual([v.cuentaId]);
        // Al pagar el saldo deja de estar vencido
        await pagar(v.cuentaId, 300);
        const pagada = await detalle(v.cuentaId);
        expect(pagada).toMatchObject({ estado: 'pagado', dias_retraso: 0 });
        expect((await call(cuentas.alertasVencimiento, { usuario: admin })).body.alertas.find(a => a.id === v.cuentaId)).toBeUndefined();
    });

    test('Correccion de pagares antiguos del 70% (bloque 20.2 de la migracion)', async () => {
        // Simula un pagare creado con la regla vieja: monto_total = 70% y ya "pagado".
        const p = (await call(proformas.crearProforma, { usuario: admin, body: base({ tipo: 'pintura', items: [{ categoria: 'mano_obra', descripcion: 'Viejo TEST20', cantidad: 1, precio_unitario: 1000 }] }) })).body.proforma;
        const vieja = (await pool.query(
            `INSERT INTO cuentas_cobrar (cliente_id, proforma_id, concepto, monto_total, monto_base, porcentaje, monto_pagado, estado, origen, usuario_id)
             VALUES ($1,$2,'Pagaré 70% — sin OT / X',700,1000,70,0,'pendiente','automatico',$3) RETURNING id`, [cliente.id, p.id, admin.id])).rows[0];
        await pool.query(`INSERT INTO pagos_cliente (cuenta_id, monto, metodo_pago, usuario_id) VALUES ($1, 700, 'efectivo', $2)`, [vieja.id, admin.id]);
        await pool.query(`UPDATE cuentas_cobrar SET monto_pagado = 700, estado = 'pagado' WHERE id = $1`, [vieja.id]);

        const fs = require('fs');
        const path = require('path');
        const sql = fs.readFileSync(path.join(__dirname, '../config/migrations.sql'), 'utf8');
        const bloque = sql.slice(sql.indexOf('-- Sprint 20:'));
        await pool.query(bloque);
        await pool.query(bloque);   // idempotente: una segunda corrida no cambia nada

        const c = await detalle(vieja.id);
        expect(c).toMatchObject({ total: 1000, pagado: 700, saldo: 300, anticipo_requerido: 700, estado: 'parcial' });
        expect(Number(c.monto_total)).toBe(1000);
        expect(c.concepto).toMatch(/Pagaré colisiones \(anticipo 70%\)/);
        expect(c.pagos).toHaveLength(1);   // el pago registrado no se toca
    });

    let refCreada;
    test('Caso F: inventario genera la referencia interna y conserva el codigo de proveedor', async () => {
        const r1 = await call(inventario.crearRepuesto, { usuario: admin, body: {
            codigo: 'INTENTO-MANUAL', codigo_proveedor: ' 90915-YZZE1 ', nombre: 'TEST20 Filtro de aceite', area: 'mecanica', precio_venta: 10, stock_actual: 5 } });
        expect(r1.statusCode).toBe(201);
        expect(r1.body.codigo).toMatch(/^MEC-\d{6}$/);
        expect(r1.body.codigo).not.toBe('INTENTO-MANUAL');
        expect(r1.body.codigo_proveedor).toBe('90915-YZZE1');
        const r2 = await call(inventario.crearRepuesto, { usuario: admin, body: { nombre: 'TEST20 Masilla', area: 'colisiones', precio_venta: 8 } });
        expect(r2.body.codigo).toMatch(/^COL-\d{6}$/);
        expect(r2.body.codigo).not.toBe(r1.body.codigo);
        refCreada = r1.body;

        // Editar no cambia la referencia interna (aunque se envie otra) y si el codigo de proveedor
        const ed = await call(inventario.actualizarRepuesto, { usuario: admin, params: { id: r1.body.id }, body: {
            codigo: 'OTRO', nombre: 'TEST20 Filtro de aceite', codigo_proveedor: 'OEM-123', precio_venta: 11, stock_minimo: 2 } });
        expect(ed.body.codigo).toBe(r1.body.codigo);
        expect(ed.body.codigo_proveedor).toBe('OEM-123');
        // Editar sin enviar codigo_proveedor lo conserva
        const ed2 = await call(inventario.actualizarRepuesto, { usuario: admin, params: { id: r1.body.id }, body: { nombre: 'TEST20 Filtro de aceite', precio_venta: 11 } });
        expect(ed2.body.codigo_proveedor).toBe('OEM-123');
        // Busqueda por ambos codigos
        const porProv = await call(inventario.listarRepuestos, { usuario: admin, query: { q: 'OEM-123' } });
        expect(porProv.body.repuestos.map(r => r.id)).toContain(r1.body.id);
        const porRef = await call(inventario.listarRepuestos, { usuario: admin, query: { q: r1.body.codigo } });
        expect(porRef.body.repuestos.map(r => r.id)).toContain(r1.body.id);
    });

    test('Caso G: PDF de mecanica y colisiones (nombre, codigos, totales, codificacion, varias paginas)', async () => {
        const pymupdf = (buf) => {
            const { execFileSync } = require('child_process');
            const out = execFileSync('python', ['-c',
                'import sys,json,pymupdf;d=pymupdf.open(stream=sys.stdin.buffer.read(),filetype="pdf");print(json.dumps({"paginas":len(d),"texto":"\\n".join(p.get_text() for p in d)}))'],
                { input: buf });
            return JSON.parse(out.toString());
        };
        // Mecanica con un producto de inventario (codigo interno) y muchas lineas -> varias paginas
        const items = [{ categoria: 'producto', descripcion: 'Filtro de aceite', cantidad: 1, precio_unitario: 11, referencia_tipo: 'repuesto', referencia_id: refCreada.id }];
        for (let i = 1; i <= 45; i++) items.push({ categoria: 'servicio', descripcion: `Servicio TEST20 número ${i} con una descripción larga para comprobar el ajuste de línea en la tabla`, cantidad: 1, precio_unitario: 10 });
        const pm = (await call(proformas.crearProforma, { usuario: admin, body: base({ items }) })).body.proforma;
        const resMec = mockRes();
        const chunks = [];
        const { Writable } = require('stream');
        await new Promise((ok) => {
            const ws = new Writable({ write(c, _e, cb) { chunks.push(c); cb(); } });
            ws.on('finish', ok);
            Object.assign(ws, { setHeader() {}, status: resMec.status, json: resMec.json, headersSent: false });
            exportar.descargarPdf({ params: { id: pm.id } }, ws);
        });
        const mec = pymupdf(Buffer.concat(chunks));
        expect(mec.paginas).toBeGreaterThan(1);
        expect(mec.texto).toContain('SS Swap - SSarango Sosa Intercambio Inteligente');
        expect(mec.texto).not.toContain('Mecánica Automotriz');
        expect(mec.texto).toContain(refCreada.codigo);           // referencia interna
        expect(mec.texto).not.toContain('OEM-123');              // nunca el codigo del proveedor
        expect(mec.texto).toContain('Uno “Way” Pequeño');        // codificacion correcta (NFD -> NFC)
        expect(mec.texto).toContain('Azul Océano');
        expect(mec.texto).toContain('Peña');
        expect(mec.texto).toContain(`Página 1 de ${mec.paginas}`);
        expect(mec.texto).toContain('$461.00');                  // 11 + 45 x 10
        expect(mec.texto).not.toMatch(/Anticipo requerido \(70%\)/);

        // Colisiones convertida y con anticipo pagado: muestra 70% requerido y lo pagado real
        const profCol = (await call(proformas.obtenerProforma, { usuario: admin, params: { id: casoCol.proforma.id } })).body.proforma;
        const col = pymupdf(pdfDe({ ...profCol, pagare: { monto_pagado: 3000 } }));
        expect(col.texto).toContain('Anticipo requerido (70%)');
        expect(col.texto).toContain('$2,100.00');
        expect(col.texto).toContain('Saldo restante (30%)');
        expect(col.texto).toContain('$900.00');
        expect(col.texto).toContain('PROFORMA — COLISIONES');
        expect(col.paginas).toBe(1);
    });
});
