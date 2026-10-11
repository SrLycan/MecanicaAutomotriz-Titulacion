/**
 * SS SWAP - Pruebas de INTEGRACION del Sprint 14 contra un PostgreSQL REAL.
 *
 * No usan mocks de base de datos: ejecutan los controllers reales contra una
 * BD de pruebas con schema.sql + migrations.sql aplicados. Por eso solo
 * corren si se define PG_INTEGRATION=1 (en CI normal se saltan).
 *
 *   PG_INTEGRATION=1 DB_HOST=localhost DB_PORT=5432 DB_NAME=ssswap_test \
 *   DB_USER=postgres DB_PASSWORD=... npx jest sprint14
 *
 * ¡NUNCA apuntar a la base de produccion! Cada corrida inserta datos de prueba
 * con prefijo "TEST14-" y los limpia al final.
 *
 * Casos obligatorios cubiertos (ver prompt del Sprint 14):
 *  1. Proforma de mecanica con 3 productos -> resta stock, movimientos,
 *     precio historico en estadisticas.
 *  2. Proforma de colisiones SUV con 3 zonas -> se conservan al reabrir/editar.
 *  3. Proforma de $1.000 convertida a OT -> pagare automatico por el TOTAL
 *     ($1.000; Sprint 20: mecanica sin anticipo obligatorio).
 *  4. Pago por transferencia con datos bancarios persistidos.
 *  5. Pago por cheque con datos persistidos.
 *  6. Reprocesar la misma salida -> NO descuenta de nuevo.
 *  7. Salida mayor al stock -> se bloquea con mensaje claro.
 */
const RUN = process.env.PG_INTEGRATION === '1';
const d = RUN ? describe : describe.skip;

let pool, proformas, inventario, cuentas, estadisticas;

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

d('Sprint 14 - integracion con PostgreSQL', () => {
    let admin, tecnico, cliente, vehiculo, rep = {};

    beforeAll(async () => {
        pool = require('../config/db');
        proformas = require('../controllers/proformas.controller');
        inventario = require('../controllers/inventory.controller');
        cuentas = require('../controllers/cuentasCobrar.controller');
        estadisticas = require('../controllers/estadisticas.controller');

        const u = await pool.query(
            `INSERT INTO usuarios (nombre, email, password, rol) VALUES
               ('TEST14 Admin','test14-admin@x.test','x','administrador'),
               ('Ricardo TEST14','test14-tec@x.test','x','tecnico')
             RETURNING id, nombre, rol`
        );
        // Sprint 21: los permisos los adjunta verificarToken en cada peticion;
        // aqui se llama al controlador directo, asi que se simulan con la plantilla del rol.
        const { PLANTILLAS } = require('../config/permisos');
        admin = { ...u.rows[0], email: 'test14-admin@x.test', permisos: PLANTILLAS.administrador };
        tecnico = { ...u.rows[1], email: 'test14-tec@x.test', permisos: PLANTILLAS.tecnico };
        cliente = (await pool.query(`INSERT INTO clientes (nombre, cedula) VALUES ('Cliente TEST14', 'TEST14-CI') RETURNING *`)).rows[0];
        vehiculo = (await pool.query(`INSERT INTO vehiculos (cliente_id, placa, marca, modelo) VALUES ($1,'TST-1414','Suzuki','Grand Vitara') RETURNING *`, [cliente.id])).rows[0];
        const mk = async (codigo, nombre, area, stock, precio) => (await pool.query(
            `INSERT INTO repuestos (codigo, nombre, area, stock_actual, precio_venta, unidad_medida) VALUES ($1,$2,$3,$4,$5,'unidad') RETURNING *`,
            [codigo, nombre, area, stock, precio])).rows[0];
        rep.filtro = await mk('TEST14-FIL', 'Filtro TEST14', 'mecanica', 10, 8);
        rep.aceite = await mk('TEST14-ACE', 'Aceite TEST14', 'mecanica', 20, 12);
        rep.bujia = await mk('TEST14-BUJ', 'Bujia TEST14', 'mecanica', 8, 5);
        rep.masilla = await mk('TEST14-MAS', 'Masilla TEST14', 'colisiones', 5, 15);
        rep.pintura = await mk('TEST14-PIN', 'Pintura TEST14 (L)', 'colisiones', 3.5, 40);
    });

    afterAll(async () => {
        if (!pool) return;
        const ids = (await pool.query(`SELECT id FROM proformas WHERE cliente_id = $1`, [cliente.id])).rows.map(r => r.id);
        await pool.query(`DELETE FROM pagos_cliente WHERE cuenta_id IN (SELECT id FROM cuentas_cobrar WHERE cliente_id = $1)`, [cliente.id]);
        await pool.query(`DELETE FROM cuentas_cobrar WHERE cliente_id = $1`, [cliente.id]);
        await pool.query(`UPDATE movimientos_inventario SET movimiento_revertido_id = NULL WHERE repuesto_id IN (SELECT id FROM repuestos WHERE codigo LIKE 'TEST14-%')`);
        await pool.query(`DELETE FROM movimientos_inventario WHERE repuesto_id IN (SELECT id FROM repuestos WHERE codigo LIKE 'TEST14-%')`);
        if (ids.length) await pool.query(`DELETE FROM proformas WHERE id = ANY($1::int[])`, [ids]);
        await pool.query(`DELETE FROM ordenes_trabajo WHERE cliente_id = $1`, [cliente.id]);
        await pool.query(`DELETE FROM repuestos WHERE codigo LIKE 'TEST14-%'`);
        await pool.query(`DELETE FROM vehiculos WHERE cliente_id = $1`, [cliente.id]);
        await pool.query(`DELETE FROM clientes WHERE id = $1`, [cliente.id]);
        await pool.query(`DELETE FROM usuarios WHERE email LIKE 'test14-%'`);
        await pool.end();
    });

    const base = (extra = {}) => ({
        tipo: 'mecanica', cliente_id: cliente.id, vehiculo_id: vehiculo.id,
        fecha_emision: new Date().toISOString().slice(0, 10), iva_porcentaje: 0, descuento: 0, anticipo: 0,
        ...extra,
    });
    const stock = async (id) => Number((await pool.query('SELECT stock_actual FROM repuestos WHERE id=$1', [id])).rows[0].stock_actual);

    let proformaMec;
    test('CASO 1: proforma de mecanica con 3 productos -> salida, movimientos y precio historico', async () => {
        const crear = await call(proformas.crearProforma, { usuario: tecnico, body: base({ items: [
            { categoria: 'producto', descripcion: 'Filtro', cantidad: 2, precio_unitario: 9.5, referencia_tipo: 'repuesto', referencia_id: rep.filtro.id },
            { categoria: 'producto', descripcion: 'Aceite', cantidad: 4, precio_unitario: 13, referencia_tipo: 'repuesto', referencia_id: rep.aceite.id },
            { categoria: 'producto', descripcion: 'Bujia', cantidad: 4, precio_unitario: 6, referencia_tipo: 'repuesto', referencia_id: rep.bujia.id },
            { categoria: 'servicio', descripcion: 'Mano de obra cambio de aceite', cantidad: 1, precio_unitario: 25 },
        ] }) });
        expect(crear.statusCode).toBe(201);
        proformaMec = crear.body.proforma;
        expect(Number(proformaMec.total)).toBe(19 + 52 + 24 + 25);

        // En borrador NO se puede descontar
        const temprano = await call(proformas.confirmarUso, { usuario: tecnico, params: { id: proformaMec.id } });
        expect(temprano.statusCode).toBe(409);

        // Al APROBAR se descuenta automaticamente (ya no hace falta confirmar a mano)
        const aprob = await call(proformas.cambiarEstadoProforma, { usuario: tecnico, params: { id: proformaMec.id }, body: { estado: 'aprobada' } });
        expect(aprob.statusCode).toBe(200);
        expect(aprob.body.inventario).toEqual({ accion: 'descontado', productos: 3 });
        expect(aprob.body.proforma.inventario_descontado_at).toBeTruthy();

        expect(await stock(rep.filtro.id)).toBe(8);
        expect(await stock(rep.aceite.id)).toBe(16);
        expect(await stock(rep.bujia.id)).toBe(4);

        const movs = await call(inventario.listarMovimientos, { usuario: tecnico, query: { proforma: proformaMec.numero, page: 1 } });
        expect(movs.body.total).toBe(3);
        const m = movs.body.movimientos.find(x => x.repuesto_id === rep.aceite.id);
        expect(m).toMatchObject({ tipo: 'salida', origen: 'proforma', cantidad: 4, area: 'mecanica', usuario_nombre: 'Ricardo TEST14', proforma_numero: proformaMec.numero, cliente_nombre: 'Cliente TEST14', vehiculo_placa: 'TST-1414' });
        expect(Number(m.precio_unitario)).toBe(13);

        // Cambiar el precio del catalogo NO altera la estadistica historica
        await pool.query('UPDATE repuestos SET precio_venta = 999 WHERE id = $1', [rep.aceite.id]);
        const est = await call(estadisticas.productosMasVendidos, { usuario: admin, query: { periodo: 'semana', limit: 50 } });
        const fila = est.body.productos.find(p => p.id === rep.aceite.id);
        expect(fila.ingresos_estimados).toBe(52);
        const estProf = await call(estadisticas.estadisticasProformas, { usuario: admin, query: { periodo: 'semana', limit: 50 } });
        const usado = estProf.body.productos_utilizados.find(p => p.id === rep.aceite.id);
        expect(usado).toMatchObject({ cantidad: 4, valor: 52 });
    });

    test('CASO 6: reprocesar la misma salida NO descuenta de nuevo (secuencial y en paralelo)', async () => {
        const otra = await call(proformas.confirmarUso, { usuario: tecnico, params: { id: proformaMec.id } });
        expect(otra.statusCode).toBe(409);
        expect(otra.body.error).toMatch(/ya desconto/i);
        expect(await stock(rep.filtro.id)).toBe(8);

        // Nueva proforma: dos aprobaciones simultaneas solo descuentan UNA vez
        const p = (await call(proformas.crearProforma, { usuario: tecnico, body: base({ estado: 'emitida', items: [
            { categoria: 'producto', descripcion: 'Filtro', cantidad: 1, precio_unitario: 9.5, referencia_tipo: 'repuesto', referencia_id: rep.filtro.id },
        ] }) })).body.proforma;
        const [a, b] = await Promise.all([
            call(proformas.cambiarEstadoProforma, { usuario: tecnico, params: { id: p.id }, body: { estado: 'aprobada' } }),
            call(proformas.cambiarEstadoProforma, { usuario: tecnico, params: { id: p.id }, body: { estado: 'aprobada' } }),
        ]);
        expect([a.statusCode, b.statusCode]).toEqual([200, 200]);
        expect(await stock(rep.filtro.id)).toBe(7);
        expect((await call(proformas.confirmarUso, { usuario: tecnico, params: { id: p.id } })).statusCode).toBe(409);

        // Editar o eliminar una proforma que ya desconto queda bloqueado
        const edit = await call(proformas.actualizarProforma, { usuario: tecnico, params: { id: p.id }, body: base({ items: [{ categoria: 'servicio', descripcion: 'x', cantidad: 1, precio_unitario: 1 }] }) });
        expect(edit.statusCode).toBe(409);
        const del = await call(proformas.eliminarProforma, { usuario: admin, params: { id: p.id } });
        expect(del.statusCode).toBe(409);
        // Proteccion a nivel BD (trigger) aunque se salte la API
        await expect(pool.query('DELETE FROM proforma_items WHERE proforma_id = $1', [p.id])).rejects.toThrow(/salida de inventario/);

        // Devolucion (admin): repone stock, marca la salida y permite editar
        const rev = await call(proformas.revertirSalida, { usuario: admin, params: { id: p.id }, body: { motivo: 'Prueba' } });
        expect(rev.statusCode).toBe(200);
        expect(await stock(rep.filtro.id)).toBe(8);
        const dev = await call(inventario.listarMovimientos, { usuario: admin, query: { proforma: p.numero, origen: 'devolucion', page: 1 } });
        expect(dev.body.total).toBe(1);
    });

    test('CASO 7: salida mayor al stock se bloquea con mensaje claro y sin descuentos parciales', async () => {
        const p = (await call(proformas.crearProforma, { usuario: tecnico, body: base({ tipo: 'pintura', estado: 'emitida', items: [
            { categoria: 'insumo', descripcion: 'Masilla', cantidad: 2, precio_unitario: 15, referencia_tipo: 'repuesto', referencia_id: rep.masilla.id },
            { categoria: 'insumo', descripcion: 'Pintura', cantidad: 4.25, precio_unitario: 40, referencia_tipo: 'repuesto', referencia_id: rep.pintura.id },
            { categoria: 'mano_obra', descripcion: 'Enderezado', cantidad: 1, precio_unitario: 100 },
        ] }) })).body.proforma;
        // La aprobacion NO falla por falta de stock: queda pendiente y avisa
        const aprob = await call(proformas.cambiarEstadoProforma, { usuario: tecnico, params: { id: p.id }, body: { estado: 'aprobada' } });
        expect(aprob.statusCode).toBe(200);
        expect(aprob.body.inventario.accion).toBe('pendiente');
        expect(aprob.body.inventario.detalle.join(' ')).toMatch(/Pintura TEST14/);
        expect(aprob.body.proforma.inventario_descontado_at).toBeNull();
        const r = await call(proformas.confirmarUso, { usuario: tecnico, params: { id: p.id } });
        expect(r.statusCode).toBe(409);
        expect(r.body.error).toMatch(/Stock insuficiente/);
        expect(r.body.detalle.join(' ')).toMatch(/Pintura TEST14.*3\.5.*4\.25/);
        expect(await stock(rep.masilla.id)).toBe(5); // nada se desconto
        expect(await stock(rep.pintura.id)).toBe(3.5);

        // Salida manual mayor al stock tambien se bloquea
        const man = await call(inventario.registrarMovimiento, { usuario: tecnico, body: { repuesto_id: rep.pintura.id, tipo: 'salida', cantidad: 10 } });
        expect(man.statusCode).toBe(409);
        // Cantidades decimales en movimientos manuales
        const ok = await call(inventario.registrarMovimiento, { usuario: tecnico, body: { repuesto_id: rep.pintura.id, tipo: 'salida', cantidad: 0.5, motivo: 'retoque' } });
        expect(ok.statusCode).toBe(201);
        expect(ok.body.stock_nuevo).toBe(3);
    });

    test('Rechazar una proforma aprobada devuelve el material al inventario automaticamente', async () => {
        const antes = await stock(rep.bujia.id);
        const p = (await call(proformas.crearProforma, { usuario: tecnico, body: base({ estado: 'emitida', items: [
            { categoria: 'producto', descripcion: 'Bujia', cantidad: 2, precio_unitario: 6, referencia_tipo: 'repuesto', referencia_id: rep.bujia.id },
        ] }) })).body.proforma;
        await call(proformas.cambiarEstadoProforma, { usuario: tecnico, params: { id: p.id }, body: { estado: 'aprobada' } });
        expect(await stock(rep.bujia.id)).toBe(antes - 2);

        const rech = await call(proformas.cambiarEstadoProforma, { usuario: tecnico, params: { id: p.id }, body: { estado: 'rechazada' } });
        expect(rech.statusCode).toBe(200);
        expect(rech.body.inventario).toEqual({ accion: 'devuelto', productos: 1 });
        expect(await stock(rep.bujia.id)).toBe(antes);
        const dev = await call(inventario.listarMovimientos, { usuario: admin, query: { proforma: p.numero, page: 1 } });
        expect(dev.body.movimientos.map(m => m.origen).sort()).toEqual(['devolucion', 'proforma']);
    });

    let proformaSuv;
    test('CASO 2: colisiones SUV con 3 zonas se conservan al reabrir y al editar', async () => {
        const zonas = ['parachoques_delantero', 'puerta_del_izq', 'guardafango_del_izq'];
        const crear = await call(proformas.crearProforma, { usuario: tecnico, body: base({ tipo: 'pintura',
            carroceria_tipo: 'suv', zonas_danadas: zonas, danos_observaciones: 'Golpe frontal izquierdo',
            items: [{ categoria: 'mano_obra', descripcion: 'Enderezado', cantidad: 1, precio_unitario: 200 }] }) });
        expect(crear.statusCode).toBe(201);
        proformaSuv = crear.body.proforma;
        const abierta = await call(proformas.obtenerProforma, { usuario: tecnico, params: { id: proformaSuv.id } });
        expect(abierta.body.proforma.carroceria_tipo).toBe('suv');
        expect(abierta.body.proforma.zonas_danadas).toEqual(zonas);
        expect(abierta.body.proforma.danos_observaciones).toBe('Golpe frontal izquierdo');

        // Editar otro campo sin tocar zonas: siguen exactamente iguales
        const p = abierta.body.proforma;
        const edit = await call(proformas.actualizarProforma, { usuario: tecnico, params: { id: p.id }, body: { ...base({ tipo: 'pintura' }),
            cliente_nombre: p.cliente_nombre, carroceria_tipo: p.carroceria_tipo, carroceria_puertas: p.carroceria_puertas,
            zonas_danadas: p.zonas_danadas, danos_observaciones: p.danos_observaciones, observaciones: 'editada',
            items: p.items.map(i => ({ categoria: i.categoria, descripcion: i.descripcion, cantidad: i.cantidad, precio_unitario: i.precio_unitario })) } });
        expect(edit.statusCode).toBe(200);
        const otra = await call(proformas.obtenerProforma, { usuario: tecnico, params: { id: p.id } });
        expect(otra.body.proforma.zonas_danadas).toEqual(zonas);

        // Zona que no existe para ese vehiculo -> 400
        const mala = await call(proformas.crearProforma, { usuario: tecnico, body: base({ tipo: 'pintura', carroceria_tipo: 'sedan', zonas_danadas: ['balde'],
            items: [{ categoria: 'mano_obra', descripcion: 'x', cantidad: 1, precio_unitario: 1 }] }) });
        expect(mala.statusCode).toBe(400);
    });

    let cuenta;
    test('CASO 3: proforma de mecanica de $1.000 convertida a OT genera pagare por el total, sin anticipo (sin duplicar)', async () => {
        const p = (await call(proformas.crearProforma, { usuario: tecnico, body: base({ estado: 'emitida', items: [
            { categoria: 'servicio', descripcion: 'Reparacion', cantidad: 1, precio_unitario: 1000 },
        ] }) })).body.proforma;
        const conv = await call(proformas.convertirAOrden, { usuario: tecnico, params: { id: p.id } });
        expect(conv.statusCode).toBe(201);
        expect(conv.body.pagare_creado).toBe(true);
        const det = await call(cuentas.obtenerCuenta, { usuario: admin, params: { id: conv.body.pagare.id } });
        cuenta = det.body.cuenta;
        expect(Number(cuenta.monto_base)).toBe(1000);
        expect(cuenta.porcentaje).toBeNull();              // mecanica: sin % de anticipo
        expect(Number(cuenta.anticipo_requerido)).toBe(0);
        expect(Number(cuenta.monto_total)).toBe(1000);     // Sprint 20: el pagare es el 100%
        expect(Number(cuenta.monto_pagado)).toBe(0);
        expect(Number(cuenta.saldo)).toBe(1000);
        expect(cuenta.estado).toBe('pendiente');
        expect(cuenta.orden_numero).toBe(`OT-${String(conv.body.orden.id).padStart(6, '0')}`);
        expect(cuenta.proforma_numero).toBe(p.numero);
        expect(cuenta.vehiculo_placa).toBe('TST-1414');
        expect(cuenta.origen).toBe('automatico');

        // No se duplica aunque se intente generar otra vez por la BD
        await expect(pool.query(
            `INSERT INTO cuentas_cobrar (cliente_id, proforma_id, orden_id, concepto, monto_total, origen, usuario_id) VALUES ($1,$2,$3,'dup',1000,'automatico',$4)`,
            [cliente.id, p.id, conv.body.orden.id, admin.id])).rejects.toThrow(/uq_cuenta_auto/);
        // El monto de un pagare automatico no se edita a mano
        const ed = await call(cuentas.actualizarCuenta, { usuario: admin, params: { id: cuenta.id }, body: { concepto: 'x', monto_total: 500 } });
        expect(ed.statusCode).toBe(409);
    });

    test('CASO 4: pago por transferencia guarda datos bancarios y se recuperan', async () => {
        const falta = await call(cuentas.registrarPago, { usuario: admin, params: { id: cuenta.id }, body: { monto: 100, metodo_pago: 'transferencia', banco: 'Pichincha' } });
        expect(falta.statusCode).toBe(400);
        const r = await call(cuentas.registrarPago, { usuario: admin, params: { id: cuenta.id }, body: {
            monto: 200, metodo_pago: 'transferencia', banco: 'Banco Pichincha', numero_cuenta: '2200112233', tipo_cuenta: 'ahorros',
            titular: 'Cliente TEST14', numero_comprobante: 'TRX-998877', fecha_documento: '2026-10-05', notas: 'Abono 1',
            numero_cheque: 'NO-DEBE-GUARDARSE' } });
        expect(r.statusCode).toBe(201);
        const det = (await call(cuentas.obtenerCuenta, { usuario: admin, params: { id: cuenta.id } })).body.cuenta;
        const pago = det.pagos.find(x => x.metodo_pago === 'transferencia');
        expect(pago).toMatchObject({ banco: 'Banco Pichincha', numero_cuenta: '2200112233', tipo_cuenta: 'ahorros', titular: 'Cliente TEST14', numero_comprobante: 'TRX-998877', fecha_documento: '2026-10-05', notas: 'Abono 1', numero_cheque: null });
        expect(pago.detalle).toMatch(/Comprobante: TRX-998877/);
        expect(Number(det.saldo)).toBe(800);
        expect(Number(det.porcentaje_pagado)).toBe(20);
        expect(det.estado).toBe('parcial');
    });

    test('CASO 5: pago por cheque guarda datos y persisten', async () => {
        const r = await call(cuentas.registrarPago, { usuario: admin, params: { id: cuenta.id }, body: {
            monto: 500, metodo_pago: 'cheque', banco: 'Banco Guayaquil', numero_cheque: '000123', numero_cuenta: '0099887766',
            titular: 'Cliente TEST14', fecha_documento: '2026-10-10', notas: 'Cheque posfechado' } });
        expect(r.statusCode).toBe(201);
        const det = (await call(cuentas.obtenerCuenta, { usuario: admin, params: { id: cuenta.id } })).body.cuenta;
        const pago = det.pagos.find(x => x.metodo_pago === 'cheque');
        expect(pago).toMatchObject({ banco: 'Banco Guayaquil', numero_cheque: '000123', numero_cuenta: '0099887766', titular: 'Cliente TEST14', fecha_documento: '2026-10-10', numero_comprobante: null });
        expect(Number(pago.monto)).toBe(500);
        // Sprint 20: $700 de $1.000 NO es "pagado" (antes lo era: bug del 70%)
        expect(det.estado).toBe('parcial');
        expect(Number(det.saldo)).toBe(300);
        expect(Number(det.porcentaje_pagado)).toBe(70);
    });

    test('Area: el inventario se filtra por Mecanica / Colisiones y los movimientos heredan el area', async () => {
        const col = await call(inventario.listarRepuestos, { usuario: admin, query: { area: 'colisiones', q: 'TEST14', limit: 50 } });
        expect(col.body.repuestos.map(r => r.codigo).sort()).toEqual(['TEST14-MAS', 'TEST14-PIN']);
        expect(typeof col.body.repuestos[0].stock_actual).toBe('number');
        const movCol = await call(inventario.listarMovimientos, { usuario: admin, query: { area: 'colisiones', q: 'TEST14', page: 1 } });
        expect(movCol.body.movimientos.every(m => m.area === 'colisiones')).toBe(true);
    });

    test('PDF y Excel de la proforma de colisiones incluyen el pictograma / zonas', async () => {
        const { generarProformaExcel } = require('../services/proformaExcel.service');
        const prof = (await call(proformas.obtenerProforma, { usuario: admin, params: { id: proformaSuv.id } })).body.proforma;
        // El PDF se genera en un proceso Node aparte (pdfkit expone un build
        // ESM para navegador que algunos runners de Jest eligen por error).
        const { execFileSync } = require('child_process');
        const path = require('path');
        const script = `const {generarProformaPdf}=require(${JSON.stringify(path.join(__dirname, '../services/proformaPdf.service'))});
            const {PassThrough}=require('stream');let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const s=new PassThrough();const ch=[];
            s.on('data',c=>ch.push(c));s.on('end',()=>process.stdout.write(Buffer.concat(ch)));generarProformaPdf(JSON.parse(d),s);});`;
        const pdf = execFileSync(process.execPath, ['-e', script], { input: JSON.stringify(prof) });
        expect(pdf.slice(0, 4).toString()).toBe('%PDF');
        expect(pdf.length).toBeGreaterThan(5000);
        const ExcelJS = require('exceljs');
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(await generarProformaExcel(prof));
        const valores = [];
        wb.getWorksheet('Proforma').eachRow(r => r.eachCell(c => valores.push(typeof c.value === 'object' && c.value ? JSON.stringify(c.value) : String(c.value))));
        const texto = valores.join('|');
        expect(texto).toMatch(/SUV/);
        expect(texto).toMatch(/Puerta delantera izquierda/);
        expect(texto).toMatch(/Golpe frontal izquierdo/);
        expect(texto).toMatch(/"formula":"SUM\(/); // formulas intactas
    });

    // ── Sprint 15 ────────────────────────────────────────────
    test('Sprint 15: anular un pago no lo borra y recalcula el saldo', async () => {
        const antes = (await call(cuentas.obtenerCuenta, { usuario: admin, params: { id: cuenta.id } })).body.cuenta;
        const cheque = antes.pagos.find(p => p.metodo_pago === 'cheque');
        const r = await call(cuentas.eliminarPago, { usuario: admin, params: { id: cuenta.id, pagoId: cheque.id }, body: { motivo: 'Cheque rebotado' } });
        expect(r.statusCode).toBe(200);
        const desp = (await call(cuentas.obtenerCuenta, { usuario: admin, params: { id: cuenta.id } })).body.cuenta;
        const anulado = desp.pagos.find(p => p.id === cheque.id);
        expect(anulado.anulado_at).not.toBeNull();
        expect(anulado.motivo_anulacion).toBe('Cheque rebotado');
        expect(Number(desp.monto_pagado)).toBe(200);
        expect(Number(desp.saldo)).toBe(800);   // Sprint 20: el pagare es por el total ($1.000)
        expect(desp.estado).toBe('parcial');
        // anular dos veces -> 409
        expect((await call(cuentas.eliminarPago, { usuario: admin, params: { id: cuenta.id, pagoId: cheque.id }, body: {} })).statusCode).toBe(409);
        // una cuenta con pagos (aunque esten anulados) no se elimina
        await expect(pool.query('DELETE FROM cuentas_cobrar WHERE id = $1', [cuenta.id])).rejects.toThrow(/foreign key/);
    });

    test('Sprint 15: cliente/vehiculo con historial no se eliminan; OT tiene numero; catalogos', async () => {
        const ordenes = require('../controllers/ordenes.controller');
        const rc = await call(ordenes.eliminarCliente, { usuario: admin, params: { id: cliente.id } });
        expect(rc.statusCode).toBe(409);
        expect(rc.body.error).toMatch(/orden/);
        const rv = await call(ordenes.eliminarVehiculo, { usuario: admin, params: { id: vehiculo.id } });
        expect(rv.statusCode).toBe(409);
        const { rows } = await pool.query('SELECT id, numero FROM ordenes_trabajo WHERE cliente_id = $1 LIMIT 1', [cliente.id]);
        expect(rows[0].numero).toBe(`OT-${String(rows[0].id).padStart(6, '0')}`);
        const cat = await call(require('../controllers/catalogos.controller').obtenerCatalogos, { usuario: admin });
        expect(cat.body.areas_inventario.map(a => a.codigo)).toEqual(expect.arrayContaining(['mecanica', 'colisiones']));
        expect(cat.body.tipos_proforma.find(t => t.codigo === 'pintura').nombre).toBe('Colisiones / Pintura');
        // FK a catalogo: un area inexistente se rechaza en la BD
        await expect(pool.query(`UPDATE repuestos SET area = 'inexistente' WHERE codigo = 'TEST14-FIL'`)).rejects.toThrow(/fk_repuestos_area/);
        // Borrar un repuesto ya no borra en cascada sus movimientos
        await expect(pool.query(`DELETE FROM repuestos WHERE codigo = 'TEST14-FIL'`)).rejects.toThrow(/foreign key/);
    });
});
