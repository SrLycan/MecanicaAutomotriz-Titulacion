/**
 * SS SWAP - Controlador de Finanzas del taller
 *
 * Responde "¿cuanto dinero tiene el taller y por que?":
 *  - Resumen: dinero disponible por cuenta, ingresos/egresos del periodo,
 *    por cobrar, por pagar, nomina pendiente, inventario y patrimonio.
 *  - Flujo: cada entrada/salida real de dinero (vista v_flujo_dinero).
 *  - Cuentas de dinero (caja, banco...) y transferencias entre ellas.
 *  - Otros ingresos/egresos (arriendo, luz, aporte del dueño...).
 *  - Nomina: perfil salarial de empleados y pagos.
 *
 * Nada se borra: movimientos y pagos se ANULAN con motivo.
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { redondear2 } = require('../utils/numeros');
const { registrarAccionBitacora } = require('../services/ordenesHistorial.service');
const { saldosCuentas, inicioDeMes } = require('../services/finanzas.service');

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
// Todo el personal interno puede estar en nomina (incluye superadministrador e interno).
const ROLES_EMPLEADO = require('../config/permisos').ROLES_STAFF;
const TIPOS_PAGO_EMPLEADO = ['sueldo', 'anticipo', 'bono', 'comision', 'horas_extra', 'liquidacion', 'otro'];
// Tipos que cuentan para cubrir el sueldo del mes (un bono es adicional).
const TIPOS_CUBREN_SUELDO = ['sueldo', 'anticipo'];

const fechaValida = (f) => typeof f === 'string' && FECHA_RE.test(f) && !Number.isNaN(Date.parse(f));
const num = (v) => Number(v) || 0;

function responderError(res, err, contexto, mensaje) {
    console.error(`Error ${contexto}:`, err);
    const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
    return res.status(500).json({ error: mensaje });
}

function bitacora(req, datos) {
    registrarAccionBitacora({ usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre, ...datos });
}

/** Rango [desde, hasta] del query; por defecto el mes en curso. */
function rangoFechas(query) {
    const desde = fechaValida(query.desde) ? query.desde : null;
    const hasta = fechaValida(query.hasta) ? query.hasta : null;
    return { desde, hasta };
}

// ─────────────────────────────────────────────────────────────
// CATALOGOS
// GET /api/finanzas/categorias
// ─────────────────────────────────────────────────────────────
const listarCategorias = async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM cat_categorias_dinero ORDER BY orden, nombre');
        return res.json({ categorias: rows });
    } catch (err) { return responderError(res, err, 'listarCategorias', 'Error al obtener las categorias.'); }
};

// ─────────────────────────────────────────────────────────────
// RESUMEN GENERAL
// GET /api/finanzas/resumen?desde=&hasta=   (por defecto: mes actual)
// ─────────────────────────────────────────────────────────────
const resumen = async (req, res) => {
    const { desde, hasta } = rangoFechas(req.query);
    // Periodo por defecto: desde el 1ro del mes actual hasta hoy.
    const pDesde = desde ? '$1::date' : "date_trunc('month', CURRENT_DATE)::date";
    const pHasta = hasta ? (desde ? '$2::date' : '$1::date') : 'CURRENT_DATE';
    const pParams = [desde, hasta].filter(Boolean);

    try {
        const [cuentas, periodo, categorias, serie, porCobrar, porPagar, gastosPend, nomina, inventario, ultimos] = await Promise.all([
            saldosCuentas(pool),
            pool.query(
                `SELECT ${pDesde} AS desde, ${pHasta} AS hasta,
                        COALESCE(SUM(monto) FILTER (WHERE tipo = 'ingreso'), 0) AS ingresos,
                        COALESCE(SUM(monto) FILTER (WHERE tipo = 'egreso'), 0)  AS egresos,
                        COUNT(*) AS movimientos
                 FROM v_flujo_dinero
                 WHERE categoria <> 'transferencia' AND fecha BETWEEN ${pDesde} AND ${pHasta}`, pParams),
            pool.query(
                `SELECT f.tipo, f.categoria, COALESCE(c.nombre, f.categoria) AS nombre, COALESCE(c.color, '#64748b') AS color,
                        SUM(f.monto) AS total, COUNT(*) AS cantidad
                 FROM v_flujo_dinero f LEFT JOIN cat_categorias_dinero c ON c.codigo = f.categoria
                 WHERE f.categoria <> 'transferencia' AND f.fecha BETWEEN ${pDesde} AND ${pHasta}
                 GROUP BY f.tipo, f.categoria, c.nombre, c.color
                 ORDER BY total DESC`, pParams),
            pool.query(
                `SELECT TO_CHAR(m.mes, 'YYYY-MM') AS mes,
                        COALESCE(SUM(f.monto) FILTER (WHERE f.tipo = 'ingreso'), 0) AS ingresos,
                        COALESCE(SUM(f.monto) FILTER (WHERE f.tipo = 'egreso'), 0)  AS egresos
                 FROM generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
                                      date_trunc('month', CURRENT_DATE), INTERVAL '1 month') AS m(mes)
                 LEFT JOIN v_flujo_dinero f ON date_trunc('month', f.fecha) = m.mes AND f.categoria <> 'transferencia'
                 GROUP BY m.mes ORDER BY m.mes`),
            pool.query(
                `SELECT COALESCE(SUM(monto_total - monto_pagado), 0) AS total, COUNT(*) AS cuentas,
                        COUNT(DISTINCT cliente_id) AS clientes,
                        COALESCE(SUM(monto_total - monto_pagado) FILTER (WHERE estado = 'vencido'
                            OR (fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURRENT_DATE)), 0) AS vencido
                 FROM cuentas_cobrar WHERE estado IN ('pendiente','parcial','vencido')`),
            // Deuda con proveedores: compras confirmadas - canceladas - pagos/abonos.
            pool.query(
                `SELECT COALESCE(SUM(GREATEST(saldo, 0)), 0) AS total, COUNT(*) FILTER (WHERE saldo > 0.004) AS proveedores
                 FROM (SELECT proveedor_id,
                              SUM(CASE WHEN tipo = 'compra' THEN monto
                                       WHEN tipo IN ('pago','abono','cancelacion') THEN -monto ELSE 0 END) AS saldo
                       FROM movimientos_financieros_proveedor WHERE estado = 'confirmado'
                       GROUP BY proveedor_id) s`),
            pool.query(`SELECT COALESCE(SUM(monto), 0) AS total, COUNT(*) AS cantidad FROM gastos_proveedor WHERE estado = 'pendiente'`),
            pool.query(
                `SELECT COALESCE(SUM(ep.sueldo_base), 0) AS sueldos,
                        COALESCE(SUM(LEAST(ep.sueldo_base, COALESCE(pg.pagado, 0))), 0) AS cubierto,
                        COUNT(*) AS empleados
                 FROM empleados_perfil ep
                 JOIN usuarios u ON u.id = ep.usuario_id AND u.activo
                 LEFT JOIN (SELECT usuario_id, SUM(monto_neto) AS pagado FROM pagos_empleados
                            WHERE anulado_at IS NULL AND tipo = ANY($1)
                              AND periodo = date_trunc('month', CURRENT_DATE)::date
                            GROUP BY usuario_id) pg ON pg.usuario_id = ep.usuario_id
                 WHERE ep.en_nomina`, [TIPOS_CUBREN_SUELDO]),
            pool.query(
                `SELECT COALESCE(SUM(stock_actual * precio_compra), 0) AS costo,
                        COALESCE(SUM(stock_actual * precio_venta), 0) AS venta
                 FROM repuestos WHERE activo`),
            pool.query(
                `SELECT f.*, COALESCE(c.nombre, f.categoria) AS categoria_nombre, COALESCE(c.color, '#64748b') AS color,
                        cd.nombre AS cuenta_nombre
                 FROM v_flujo_dinero f
                 LEFT JOIN cat_categorias_dinero c ON c.codigo = f.categoria
                 LEFT JOIN cuentas_dinero cd ON cd.id = f.cuenta_dinero_id
                 ORDER BY f.fecha DESC, f.momento DESC LIMIT 8`),
        ]);

        const disponible = redondear2(cuentas.filter(c => c.activa).reduce((s, c) => s + c.saldo, 0));
        const p = periodo.rows[0];
        const ingresos = num(p.ingresos), egresos = num(p.egresos);
        const nom = nomina.rows[0];
        const nominaPendiente = redondear2(num(nom.sueldos) - num(nom.cubierto));
        const cobrar = num(porCobrar.rows[0].total);
        const pagarProv = num(porPagar.rows[0].total);
        const pagarGastos = num(gastosPend.rows[0].total);
        const invCosto = num(inventario.rows[0].costo);

        return res.json({
            disponible,
            cuentas,
            periodo: {
                desde: p.desde, hasta: p.hasta,
                ingresos, egresos, resultado: redondear2(ingresos - egresos),
                movimientos: Number(p.movimientos),
            },
            categorias: categorias.rows.map(c => ({ ...c, total: num(c.total), cantidad: Number(c.cantidad) })),
            serie: serie.rows.map(s => ({ mes: s.mes, ingresos: num(s.ingresos), egresos: num(s.egresos), resultado: redondear2(num(s.ingresos) - num(s.egresos)) })),
            por_cobrar: { total: cobrar, vencido: num(porCobrar.rows[0].vencido), cuentas: Number(porCobrar.rows[0].cuentas), clientes: Number(porCobrar.rows[0].clientes) },
            por_pagar: {
                proveedores: pagarProv, proveedores_con_deuda: Number(porPagar.rows[0].proveedores),
                gastos_pendientes: pagarGastos, gastos_cantidad: Number(gastosPend.rows[0].cantidad),
                total: redondear2(pagarProv + pagarGastos),
            },
            nomina: { sueldos_mes: num(nom.sueldos), pagado_mes: num(nom.cubierto), pendiente_mes: nominaPendiente, empleados: Number(nom.empleados) },
            inventario: { costo: invCosto, venta: num(inventario.rows[0].venta) },
            // Lo que el taller "vale" hoy en dinero: lo que tiene + lo que le deben
            // + mercaderia (a costo) - lo que debe.
            patrimonio: redondear2(disponible + cobrar + invCosto - pagarProv - pagarGastos - nominaPendiente),
            ultimos: ultimos.rows,
        });
    } catch (err) { return responderError(res, err, 'resumenFinanzas', 'Error al calcular el resumen financiero.'); }
};

// ─────────────────────────────────────────────────────────────
// FLUJO DE DINERO (todas las entradas/salidas)
// GET /api/finanzas/flujo?desde&hasta&tipo&categoria&cuenta_id&origen&q&page&limit
// ─────────────────────────────────────────────────────────────
const listarFlujo = async (req, res) => {
    const { tipo, categoria, cuenta_id, origen, q, page = 1, limit = 25 } = req.query;
    const { desde, hasta } = rangoFechas(req.query);
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 25));

    const params = [];
    let where = 'WHERE 1=1';
    const add = (cond, val) => { params.push(val); where += ` AND ${cond.replace('?', `$${params.length}`)}`; };
    if (desde) add('f.fecha >= ?', desde);
    if (hasta) add('f.fecha <= ?', hasta);
    if (tipo === 'ingreso' || tipo === 'egreso') add('f.tipo = ?', tipo);
    if (categoria) add('f.categoria = ?', categoria);
    if (cuenta_id) add('f.cuenta_dinero_id = ?', parseInt(cuenta_id) || 0);
    if (origen) add('f.origen = ?', origen);
    if (q) add("(f.descripcion ILIKE ? OR f.tercero ILIKE $X OR f.referencia ILIKE $X)".replace(/\$X/g, `$${params.length + 1}`), `%${q}%`);

    const base = `FROM v_flujo_dinero f
                  LEFT JOIN cat_categorias_dinero c ON c.codigo = f.categoria
                  LEFT JOIN cuentas_dinero cd ON cd.id = f.cuenta_dinero_id
                  ${where}`;
    try {
        const [{ rows: tot }, { rows }] = await Promise.all([
            pool.query(`SELECT COUNT(*) AS total,
                               COALESCE(SUM(f.monto) FILTER (WHERE f.tipo = 'ingreso' AND f.categoria <> 'transferencia'), 0) AS ingresos,
                               COALESCE(SUM(f.monto) FILTER (WHERE f.tipo = 'egreso'  AND f.categoria <> 'transferencia'), 0) AS egresos
                        ${base}`, params),
            pool.query(`SELECT f.*, COALESCE(c.nombre, f.categoria) AS categoria_nombre, COALESCE(c.color, '#64748b') AS color,
                               cd.nombre AS cuenta_nombre
                        ${base}
                        ORDER BY f.fecha DESC, f.momento DESC, f.origen_id DESC
                        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limitNum, (pageNum - 1) * limitNum]),
        ]);
        const total = parseInt(tot[0].total, 10);
        return res.json({
            movimientos: rows, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum),
            totales: { ingresos: num(tot[0].ingresos), egresos: num(tot[0].egresos), neto: redondear2(num(tot[0].ingresos) - num(tot[0].egresos)) },
        });
    } catch (err) { return responderError(res, err, 'listarFlujo', 'Error al obtener los movimientos de dinero.'); }
};

// ─────────────────────────────────────────────────────────────
// CUENTAS DE DINERO
// ─────────────────────────────────────────────────────────────
const TIPOS_CUENTA = ['caja', 'banco', 'otro'];

const listarCuentas = async (_req, res) => {
    try {
        const cuentas = await saldosCuentas(pool);
        return res.json({ cuentas, disponible: redondear2(cuentas.filter(c => c.activa).reduce((s, c) => s + c.saldo, 0)) });
    } catch (err) { return responderError(res, err, 'listarCuentas', 'Error al obtener las cuentas.'); }
};

function validarCuenta(body) {
    const { nombre, tipo, saldo_inicial, fecha_saldo_inicial } = body;
    if (!nombre || !String(nombre).trim()) return 'El nombre es obligatorio.';
    if (!TIPOS_CUENTA.includes(tipo)) return 'Tipo de cuenta invalido.';
    if (saldo_inicial !== undefined && saldo_inicial !== '' && Number.isNaN(Number(saldo_inicial))) return 'El saldo inicial no es valido.';
    if (fecha_saldo_inicial && !fechaValida(fecha_saldo_inicial)) return 'La fecha del saldo inicial no es valida.';
    return null;
}

const crearCuenta = async (req, res) => {
    const error = validarCuenta(req.body);
    if (error) return res.status(400).json({ error });
    const { nombre, tipo, banco, numero_cuenta, saldo_inicial, fecha_saldo_inicial, predeterminada, notas } = req.body;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        if (predeterminada) await client.query('UPDATE cuentas_dinero SET predeterminada = FALSE WHERE tipo = $1 AND predeterminada', [tipo]);
        const { rows } = await client.query(
            `INSERT INTO cuentas_dinero (nombre, tipo, banco, numero_cuenta, saldo_inicial, fecha_saldo_inicial, predeterminada, notas)
             VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7,$8) RETURNING *`,
            [nombre.trim(), tipo, banco?.trim() || null, numero_cuenta?.trim() || null, redondear2(saldo_inicial || 0),
             fecha_saldo_inicial || null, Boolean(predeterminada), notas?.trim() || null]
        );
        await client.query('COMMIT');
        bitacora(req, { entidad_tipo: 'cuenta_dinero', entidad_id: rows[0].id, accion: 'creada', detalle: `Cuenta de dinero "${rows[0].nombre}" creada.` });
        return res.status(201).json({ cuenta: rows[0] });
    } catch (err) {
        await client?.query('ROLLBACK').catch(() => {});
        return responderError(res, err, 'crearCuentaDinero', 'Error al crear la cuenta.');
    } finally { client?.release(); }
};

const actualizarCuenta = async (req, res) => {
    const error = validarCuenta(req.body);
    if (error) return res.status(400).json({ error });
    const { id } = req.params;
    const { nombre, tipo, banco, numero_cuenta, saldo_inicial, fecha_saldo_inicial, predeterminada, activa, notas } = req.body;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows: act } = await client.query('SELECT * FROM cuentas_dinero WHERE id = $1 FOR UPDATE', [id]);
        if (!act[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Cuenta no encontrada.' }); }
        if (act[0].predeterminada && (activa === false || predeterminada === false || tipo !== act[0].tipo)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Esta es la cuenta predeterminada de su tipo. Marca otra como predeterminada antes de desactivarla o cambiarla.' });
        }
        if (predeterminada) await client.query('UPDATE cuentas_dinero SET predeterminada = FALSE WHERE tipo = $1 AND predeterminada AND id <> $2', [tipo, id]);
        const { rows } = await client.query(
            `UPDATE cuentas_dinero SET nombre=$1, tipo=$2, banco=$3, numero_cuenta=$4, saldo_inicial=$5,
                    fecha_saldo_inicial=COALESCE($6::date, fecha_saldo_inicial), predeterminada=$7, activa=$8, notas=$9
             WHERE id=$10 RETURNING *`,
            [nombre.trim(), tipo, banco?.trim() || null, numero_cuenta?.trim() || null, redondear2(saldo_inicial || 0),
             fecha_saldo_inicial || null, Boolean(predeterminada) || act[0].predeterminada, activa !== false, notas?.trim() || null, id]
        );
        await client.query('COMMIT');
        bitacora(req, { entidad_tipo: 'cuenta_dinero', entidad_id: id, accion: 'actualizada', detalle: `Cuenta de dinero "${rows[0].nombre}" actualizada.` });
        return res.json({ cuenta: rows[0] });
    } catch (err) {
        await client?.query('ROLLBACK').catch(() => {});
        return responderError(res, err, 'actualizarCuentaDinero', 'Error al actualizar la cuenta.');
    } finally { client?.release(); }
};

// ─────────────────────────────────────────────────────────────
// OTROS INGRESOS / EGRESOS
// POST /api/finanzas/movimientos
// ─────────────────────────────────────────────────────────────
const crearMovimiento = async (req, res) => {
    const { tipo, categoria, monto, fecha, cuenta_dinero_id, metodo_pago = 'efectivo', descripcion, referencia } = req.body;
    if (!['ingreso', 'egreso'].includes(tipo)) return res.status(400).json({ error: 'El tipo debe ser ingreso o egreso.' });
    if (!(num(monto) > 0)) return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });
    if (!descripcion || !String(descripcion).trim()) return res.status(400).json({ error: 'La descripcion es obligatoria.' });
    if (fecha && !fechaValida(fecha)) return res.status(400).json({ error: 'La fecha no es valida.' });
    if (!cuenta_dinero_id) return res.status(400).json({ error: 'Selecciona la cuenta de dinero.' });

    try {
        const { rows: cat } = await pool.query('SELECT * FROM cat_categorias_dinero WHERE codigo = $1', [categoria]);
        if (!cat[0]) return res.status(400).json({ error: 'Categoria invalida.' });
        if (!cat[0].manual) return res.status(400).json({ error: `"${cat[0].nombre}" la registra el sistema automaticamente; usa su modulo correspondiente.` });
        if (cat[0].tipo !== 'ambos' && cat[0].tipo !== tipo) return res.status(400).json({ error: `La categoria "${cat[0].nombre}" es de ${cat[0].tipo}s.` });
        const { rows: cta } = await pool.query('SELECT activa FROM cuentas_dinero WHERE id = $1', [cuenta_dinero_id]);
        if (!cta[0]) return res.status(400).json({ error: 'La cuenta seleccionada no existe.' });
        if (!cta[0].activa) return res.status(400).json({ error: 'La cuenta seleccionada esta inactiva.' });

        const { rows } = await pool.query(
            `INSERT INTO movimientos_dinero (tipo, categoria, monto, fecha, cuenta_dinero_id, metodo_pago, descripcion, referencia, usuario_id)
             VALUES ($1,$2,$3,COALESCE($4::date, CURRENT_DATE),$5,$6,$7,$8,$9) RETURNING *`,
            [tipo, categoria, redondear2(monto), fecha || null, cuenta_dinero_id, metodo_pago, descripcion.trim(), referencia?.trim() || null, req.usuario.id]
        );
        bitacora(req, { entidad_tipo: 'movimiento_dinero', entidad_id: rows[0].id, accion: tipo,
            detalle: `${tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} de $${rows[0].monto} (${cat[0].nombre}): ${rows[0].descripcion}.` });
        return res.status(201).json({ movimiento: rows[0] });
    } catch (err) { return responderError(res, err, 'crearMovimientoDinero', 'Error al registrar el movimiento.'); }
};

// POST /api/finanzas/transferencias  — mueve dinero entre cuentas (no es ingreso ni gasto)
const crearTransferencia = async (req, res) => {
    const { origen_id, destino_id, monto, fecha, descripcion, referencia } = req.body;
    if (!origen_id || !destino_id) return res.status(400).json({ error: 'Selecciona la cuenta de origen y la de destino.' });
    if (String(origen_id) === String(destino_id)) return res.status(400).json({ error: 'La cuenta de origen y destino deben ser distintas.' });
    if (!(num(monto) > 0)) return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });
    if (fecha && !fechaValida(fecha)) return res.status(400).json({ error: 'La fecha no es valida.' });

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows: ctas } = await client.query('SELECT * FROM cuentas_dinero WHERE id = ANY($1::int[]) FOR UPDATE', [[origen_id, destino_id]]);
        const origen = ctas.find(c => String(c.id) === String(origen_id));
        const destino = ctas.find(c => String(c.id) === String(destino_id));
        if (!origen || !destino) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Cuenta no encontrada.' }); }
        if (!origen.activa || !destino.activa) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ambas cuentas deben estar activas.' }); }
        const [saldoOrigen] = await saldosCuentas(client, { cuentaId: origen.id });
        if (saldoOrigen.saldo + 0.005 < num(monto)) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `Saldo insuficiente en "${origen.nombre}" (disponible $${saldoOrigen.saldo.toFixed(2)}).` });
        }
        const metodo = origen.tipo === 'caja' || destino.tipo === 'caja' ? 'efectivo' : 'transferencia';
        const texto = descripcion?.trim() || `Transferencia ${origen.nombre} → ${destino.nombre}`;
        const { rows } = await client.query(
            `INSERT INTO movimientos_dinero (tipo, categoria, monto, fecha, cuenta_dinero_id, metodo_pago, descripcion, referencia, transferencia_id, usuario_id)
             SELECT t.tipo, 'transferencia', $1, COALESCE($2::date, CURRENT_DATE), t.cuenta, $3, $4, $5, x.uid, $6
             FROM (VALUES ('egreso', $7::int), ('ingreso', $8::int)) AS t(tipo, cuenta), (SELECT gen_random_uuid() AS uid) x
             RETURNING *`,
            [redondear2(monto), fecha || null, metodo, texto, referencia?.trim() || null, req.usuario.id, origen.id, destino.id]
        );
        await client.query('COMMIT');
        bitacora(req, { entidad_tipo: 'movimiento_dinero', entidad_id: rows[0].id, accion: 'transferencia',
            detalle: `Transferencia de $${redondear2(monto)} de "${origen.nombre}" a "${destino.nombre}".` });
        return res.status(201).json({ movimientos: rows });
    } catch (err) {
        await client?.query('ROLLBACK').catch(() => {});
        return responderError(res, err, 'crearTransferencia', 'Error al registrar la transferencia.');
    } finally { client?.release(); }
};

// POST /api/finanzas/movimientos/:id/anular  { motivo }  (una transferencia se anula completa)
const anularMovimiento = async (req, res) => {
    const { id } = req.params;
    const motivo = req.body?.motivo?.trim();
    if (!motivo) return res.status(400).json({ error: 'Indica el motivo de la anulacion.' });
    try {
        const { rows: act } = await pool.query('SELECT * FROM movimientos_dinero WHERE id = $1', [id]);
        const mov = act[0];
        if (!mov) return res.status(404).json({ error: 'Movimiento no encontrado.' });
        if (mov.anulado_at) return res.status(409).json({ error: 'El movimiento ya estaba anulado.' });
        if (mov.categoria === 'ajuste_caja') return res.status(409).json({ error: 'Los ajustes de caja se generan al abrir/cerrar caja y no se anulan.' });

        const { rows } = await pool.query(
            `UPDATE movimientos_dinero SET anulado_at = NOW(), anulado_por = $1, motivo_anulacion = $2
             WHERE anulado_at IS NULL AND (id = $3 OR (transferencia_id IS NOT NULL AND transferencia_id = $4))
             RETURNING *`,
            [req.usuario.id, motivo, id, mov.transferencia_id]
        );
        bitacora(req, { entidad_tipo: 'movimiento_dinero', entidad_id: id, accion: 'anulado', detalle: `Movimiento de $${mov.monto} anulado: ${motivo}.` });
        return res.json({ movimientos: rows });
    } catch (err) { return responderError(res, err, 'anularMovimientoDinero', 'Error al anular el movimiento.'); }
};

// ─────────────────────────────────────────────────────────────
// NOMINA
// GET /api/finanzas/empleados?periodo=YYYY-MM
// ─────────────────────────────────────────────────────────────
const listarEmpleados = async (req, res) => {
    const periodo = inicioDeMes(req.query.periodo) || null;
    try {
        const { rows } = await pool.query(
            `WITH per AS (SELECT COALESCE($1::date, date_trunc('month', CURRENT_DATE)::date) AS mes)
             SELECT u.id, u.nombre, u.email, u.rol, u.telefono, u.cedula, u.activo, u.estado,
                    ep.cargo, COALESCE(ep.sueldo_base, 0) AS sueldo_base, ep.frecuencia_pago, ep.fecha_ingreso,
                    ep.banco, ep.numero_cuenta, ep.tipo_cuenta, COALESCE(ep.en_nomina, FALSE) AS en_nomina, ep.notas,
                    (ep.usuario_id IS NOT NULL) AS tiene_perfil,
                    (SELECT mes FROM per) AS periodo,
                    COALESCE(SUM(pe.monto_neto) FILTER (WHERE pe.tipo = ANY($2)), 0) AS pagado_sueldo,
                    COALESCE(SUM(pe.monto_neto), 0) AS pagado_total,
                    COUNT(pe.id) AS pagos
             FROM usuarios u
             LEFT JOIN empleados_perfil ep ON ep.usuario_id = u.id
             LEFT JOIN pagos_empleados pe ON pe.usuario_id = u.id AND pe.anulado_at IS NULL AND pe.periodo = (SELECT mes FROM per)
             WHERE u.rol = ANY($3)
             GROUP BY u.id, ep.usuario_id
             ORDER BY COALESCE(ep.en_nomina, FALSE) DESC, u.activo DESC, u.nombre`,
            [periodo, TIPOS_CUBREN_SUELDO, ROLES_EMPLEADO]
        );
        const empleados = rows.map(e => {
            const sueldo = num(e.sueldo_base), pagado = num(e.pagado_sueldo);
            return { ...e, sueldo_base: sueldo, pagado_sueldo: pagado, pagado_total: num(e.pagado_total), pagos: Number(e.pagos),
                     pendiente: e.en_nomina ? redondear2(Math.max(0, sueldo - pagado)) : 0 };
        });
        const enNomina = empleados.filter(e => e.en_nomina && e.activo);
        return res.json({
            periodo: rows[0]?.periodo || periodo,
            empleados,
            totales: {
                sueldos: redondear2(enNomina.reduce((s, e) => s + e.sueldo_base, 0)),
                pagado: redondear2(empleados.reduce((s, e) => s + e.pagado_total, 0)),
                pendiente: redondear2(enNomina.reduce((s, e) => s + e.pendiente, 0)),
            },
        });
    } catch (err) { return responderError(res, err, 'listarEmpleados', 'Error al obtener los empleados.'); }
};

// PUT /api/finanzas/empleados/:usuarioId  — crea o actualiza el perfil salarial
const guardarPerfilEmpleado = async (req, res) => {
    const { usuarioId } = req.params;
    const { cargo, sueldo_base, frecuencia_pago = 'mensual', fecha_ingreso, banco, numero_cuenta, tipo_cuenta, en_nomina = true, notas } = req.body;
    if (sueldo_base === undefined || sueldo_base === '' || Number.isNaN(Number(sueldo_base)) || Number(sueldo_base) < 0)
        return res.status(400).json({ error: 'El sueldo mensual debe ser un numero mayor o igual a cero.' });
    if (!['mensual', 'quincenal', 'semanal'].includes(frecuencia_pago)) return res.status(400).json({ error: 'Frecuencia de pago invalida.' });
    if (fecha_ingreso && !fechaValida(fecha_ingreso)) return res.status(400).json({ error: 'La fecha de ingreso no es valida.' });
    try {
        const { rows: u } = await pool.query('SELECT id, nombre, rol FROM usuarios WHERE id = $1', [usuarioId]);
        if (!u[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
        if (!ROLES_EMPLEADO.includes(u[0].rol)) return res.status(400).json({ error: 'Solo el personal del taller puede estar en nomina.' });
        const { rows } = await pool.query(
            `INSERT INTO empleados_perfil (usuario_id, cargo, sueldo_base, frecuencia_pago, fecha_ingreso, banco, numero_cuenta, tipo_cuenta, en_nomina, notas)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             ON CONFLICT (usuario_id) DO UPDATE SET cargo=EXCLUDED.cargo, sueldo_base=EXCLUDED.sueldo_base,
                 frecuencia_pago=EXCLUDED.frecuencia_pago, fecha_ingreso=EXCLUDED.fecha_ingreso, banco=EXCLUDED.banco,
                 numero_cuenta=EXCLUDED.numero_cuenta, tipo_cuenta=EXCLUDED.tipo_cuenta, en_nomina=EXCLUDED.en_nomina, notas=EXCLUDED.notas
             RETURNING *`,
            [usuarioId, cargo?.trim() || null, redondear2(sueldo_base), frecuencia_pago, fecha_ingreso || null,
             banco?.trim() || null, numero_cuenta?.trim() || null, tipo_cuenta || null, en_nomina !== false, notas?.trim() || null]
        );
        bitacora(req, { entidad_tipo: 'empleado', entidad_id: usuarioId, accion: 'perfil_actualizado',
            detalle: `Datos de nomina de ${u[0].nombre} actualizados (sueldo $${rows[0].sueldo_base}).` });
        return res.json({ perfil: rows[0] });
    } catch (err) { return responderError(res, err, 'guardarPerfilEmpleado', 'Error al guardar los datos del empleado.'); }
};

// GET /api/finanzas/pagos-empleados?usuario_id&periodo=YYYY-MM&anulados=true&page&limit
const listarPagosEmpleados = async (req, res) => {
    const { usuario_id, anulados, page = 1, limit = 25 } = req.query;
    const periodo = inicioDeMes(req.query.periodo);
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit) || 25));
    const params = [];
    let where = 'WHERE 1=1';
    if (usuario_id) { params.push(usuario_id); where += ` AND pe.usuario_id = $${params.length}`; }
    if (periodo) { params.push(periodo); where += ` AND pe.periodo = $${params.length}`; }
    if (anulados !== 'true') where += ' AND pe.anulado_at IS NULL';
    try {
        const [{ rows: tot }, { rows }] = await Promise.all([
            pool.query(`SELECT COUNT(*) AS total, COALESCE(SUM(monto_neto) FILTER (WHERE anulado_at IS NULL), 0) AS suma FROM pagos_empleados pe ${where}`, params),
            pool.query(
                `SELECT pe.*, u.nombre AS empleado_nombre, u.rol AS empleado_rol, cd.nombre AS cuenta_nombre,
                        r.nombre AS registrado_por_nombre, a.nombre AS anulado_por_nombre
                 FROM pagos_empleados pe
                 JOIN usuarios u ON u.id = pe.usuario_id
                 JOIN cuentas_dinero cd ON cd.id = pe.cuenta_dinero_id
                 JOIN usuarios r ON r.id = pe.registrado_por
                 LEFT JOIN usuarios a ON a.id = pe.anulado_por
                 ${where}
                 ORDER BY pe.fecha DESC, pe.id DESC
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limitNum, (pageNum - 1) * limitNum]),
        ]);
        return res.json({ pagos: rows, total: parseInt(tot[0].total, 10), suma: num(tot[0].suma), page: pageNum, limit: limitNum });
    } catch (err) { return responderError(res, err, 'listarPagosEmpleados', 'Error al obtener los pagos a empleados.'); }
};

// POST /api/finanzas/pagos-empleados
const crearPagoEmpleado = async (req, res) => {
    const { usuario_id, tipo = 'sueldo', monto_bruto, descuentos = 0, fecha, cuenta_dinero_id, metodo_pago = 'transferencia', referencia, notas } = req.body;
    // 'sv-SE' da la fecha LOCAL en formato YYYY-MM-DD (toISOString usa UTC y a fin de mes cambiaria de periodo).
    const periodo = inicioDeMes(req.body.periodo || fecha || new Date().toLocaleDateString('sv-SE'));
    if (!usuario_id) return res.status(400).json({ error: 'Selecciona el empleado.' });
    if (!TIPOS_PAGO_EMPLEADO.includes(tipo)) return res.status(400).json({ error: 'Tipo de pago invalido.' });
    if (!periodo) return res.status(400).json({ error: 'El periodo (mes) no es valido.' });
    if (!(num(monto_bruto) > 0)) return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });
    if (num(descuentos) < 0 || num(descuentos) >= num(monto_bruto)) return res.status(400).json({ error: 'Los descuentos deben ser menores al monto.' });
    if (fecha && !fechaValida(fecha)) return res.status(400).json({ error: 'La fecha no es valida.' });

    try {
        const { rows: u } = await pool.query('SELECT id, nombre, rol FROM usuarios WHERE id = $1', [usuario_id]);
        if (!u[0]) return res.status(404).json({ error: 'Empleado no encontrado.' });
        if (!ROLES_EMPLEADO.includes(u[0].rol)) return res.status(400).json({ error: 'Solo se pueden registrar pagos al personal del taller.' });

        // Si no se elige cuenta, el efectivo sale de la caja y lo demas del banco.
        let cuentaId = cuenta_dinero_id;
        if (!cuentaId) {
            const { rows } = await pool.query('SELECT cuenta_dinero_por_metodo($1) AS id', [metodo_pago]);
            cuentaId = rows[0].id;
        }
        const { rows: cta } = await pool.query('SELECT activa FROM cuentas_dinero WHERE id = $1', [cuentaId]);
        if (!cta[0]?.activa) return res.status(400).json({ error: 'Selecciona una cuenta de dinero activa.' });

        const { rows } = await pool.query(
            `INSERT INTO pagos_empleados (usuario_id, tipo, periodo, monto_bruto, descuentos, fecha, cuenta_dinero_id, metodo_pago, referencia, notas, registrado_por)
             VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7,$8,$9,$10,$11) RETURNING *`,
            [usuario_id, tipo, periodo, redondear2(monto_bruto), redondear2(descuentos), fecha || null, cuentaId, metodo_pago,
             referencia?.trim() || null, notas?.trim() || null, req.usuario.id]
        );
        bitacora(req, { entidad_tipo: 'pago_empleado', entidad_id: rows[0].id, accion: 'registrado',
            detalle: `Pago (${tipo}) de $${rows[0].monto_neto} a ${u[0].nombre} — periodo ${periodo.slice(0, 7)}.` });
        return res.status(201).json({ pago: rows[0] });
    } catch (err) { return responderError(res, err, 'crearPagoEmpleado', 'Error al registrar el pago.'); }
};

// POST /api/finanzas/pagos-empleados/:id/anular  { motivo }
const anularPagoEmpleado = async (req, res) => {
    const { id } = req.params;
    const motivo = req.body?.motivo?.trim();
    if (!motivo) return res.status(400).json({ error: 'Indica el motivo de la anulacion.' });
    try {
        const { rows } = await pool.query(
            `UPDATE pagos_empleados SET anulado_at = NOW(), anulado_por = $1, motivo_anulacion = $2
             WHERE id = $3 AND anulado_at IS NULL RETURNING *`,
            [req.usuario.id, motivo, id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Pago no encontrado o ya anulado.' });
        bitacora(req, { entidad_tipo: 'pago_empleado', entidad_id: id, accion: 'anulado', detalle: `Pago de $${rows[0].monto_neto} anulado: ${motivo}.` });
        return res.json({ pago: rows[0] });
    } catch (err) { return responderError(res, err, 'anularPagoEmpleado', 'Error al anular el pago.'); }
};

module.exports = {
    listarCategorias, resumen, listarFlujo,
    listarCuentas, crearCuenta, actualizarCuenta,
    crearMovimiento, crearTransferencia, anularMovimiento,
    listarEmpleados, guardarPerfilEmpleado, listarPagosEmpleados, crearPagoEmpleado, anularPagoEmpleado,
};
