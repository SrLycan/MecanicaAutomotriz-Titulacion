/**
 * SS SWAP - Controlador de Historial Financiero de Proveedores
 *
 * `movimientos_financieros_proveedor` se llena automaticamente al crear una
 * compra (tipo='compra'), al registrar un gasto vinculado a un proveedor
 * (tipo='gasto', desde gastosProveedor.controller.js) o al cancelar una
 * compra (tipo='cancelacion'). Este controller expone la consulta de ese
 * historial y el endpoint para registrar pagos/abonos manuales.
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { registrarAccionBitacora } = require('../services/ordenesHistorial.service');
const { saldoProveedoresSql } = require('../services/finanzas.service');

const TIPOS   = ['compra', 'pago', 'abono', 'gasto', 'cancelacion', 'ajuste'];

const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'];

// ─────────────────────────────────────────────────────────────
// LISTAR HISTORIAL
// GET /api/proveedores/movimientos
// Filtros: proveedor_id, tipo, estado, fecha_inicio, fecha_fin, page, limit
// ─────────────────────────────────────────────────────────────
const listarMovimientos = async (req, res) => {
    const { proveedor_id, tipo, estado, fecha_inicio, fecha_fin, page = 1, limit = 20 } = req.query;

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * limitNum;

    let where    = 'WHERE 1=1';
    const params = [];

    if (proveedor_id) { params.push(proveedor_id); where += ` AND m.proveedor_id = $${params.length}`; }
    if (tipo)         { params.push(tipo);          where += ` AND m.tipo = $${params.length}`; }
    if (estado)       { params.push(estado);        where += ` AND m.estado = $${params.length}`; }
    if (fecha_inicio) { params.push(fecha_inicio);  where += ` AND m.created_at::date >= $${params.length}`; }
    if (fecha_fin)    { params.push(fecha_fin);     where += ` AND m.created_at::date <= $${params.length}`; }

    const countQuery = `SELECT COUNT(*) AS total FROM movimientos_financieros_proveedor m ${where}`;
    const dataQuery  = `
        SELECT m.*, p.nombre_comercial AS proveedor_nombre, u.nombre AS usuario_nombre, c.estado AS compra_estado
        FROM movimientos_financieros_proveedor m
        LEFT JOIN proveedores p ON p.id = m.proveedor_id
        LEFT JOIN usuarios    u ON u.id = m.usuario_id
        LEFT JOIN compras_proveedor c ON c.id = m.compra_id
        ${where}
        ORDER BY m.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    try {
        const [{ rows: countRows }, { rows }] = await Promise.all([
            pool.query(countQuery, params),
            pool.query(dataQuery, [...params, limitNum, offset]),
        ]);
        const total = parseInt(countRows[0].total, 10);
        return res.json({ movimientos: rows, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
    } catch (err) {
        console.error('Error listarMovimientos:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener el historial financiero.' });
    }
};

// ─────────────────────────────────────────────────────────────
// REGISTRAR PAGO / ABONO MANUAL
// POST /api/proveedores/movimientos   (admin)
// ─────────────────────────────────────────────────────────────
const registrarMovimiento = async (req, res) => {
    const { proveedor_id, tipo, compra_id, descripcion, monto, metodo_pago, referencia } = req.body;
    const usuario_id = req.usuario.id;

    if (!proveedor_id) return res.status(400).json({ error: 'proveedor_id es requerido.' });
    if (!tipo || !['pago', 'abono', 'ajuste'].includes(tipo)) {
        return res.status(400).json({ error: 'tipo debe ser "pago", "abono" o "ajuste" (los demas se generan automaticamente).' });
    }
    if (!monto || parseFloat(monto) <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });
    if (metodo_pago && !METODOS.includes(metodo_pago)) return res.status(400).json({ error: 'Metodo de pago invalido.' });

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const salir = async (status, error) => { await client.query('ROLLBACK'); return res.status(status).json({ error }); };

        const { rows: provRows } = await client.query('SELECT id FROM proveedores WHERE id = $1', [proveedor_id]);
        if (!provRows[0]) return salir(404, 'Proveedor no encontrado.');

        if (compra_id) {
            // Se bloquea la compra: dos pagos simultaneos no pueden superar el saldo.
            const { rows: compraRows } = await client.query(
                'SELECT id, estado, total FROM compras_proveedor WHERE id = $1 AND proveedor_id = $2 FOR UPDATE', [compra_id, proveedor_id]);
            if (!compraRows[0]) return salir(404, 'La compra indicada no pertenece a este proveedor.');
            if (['pago', 'abono'].includes(tipo)) {
                if (compraRows[0].estado === 'cancelada') return salir(409, 'La compra esta cancelada.');
                const { rows: pg } = await client.query(
                    `SELECT COALESCE(SUM(monto), 0) AS pagado FROM movimientos_financieros_proveedor
                     WHERE compra_id = $1 AND tipo IN ('pago','abono') AND estado = 'confirmado'`, [compra_id]);
                const saldo = Number(compraRows[0].total) - Number(pg[0].pagado);
                if (parseFloat(monto) > saldo + 0.005) {
                    return salir(400, `El monto supera el saldo pendiente de la compra ($${Math.max(saldo, 0).toFixed(2)}).`);
                }
            }
        }

        const { rows } = await client.query(
            `INSERT INTO movimientos_financieros_proveedor
                (proveedor_id, tipo, compra_id, descripcion, monto, metodo_pago, referencia, estado, usuario_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmado',$8)
             RETURNING *`,
            [proveedor_id, tipo, compra_id || null, descripcion || null, parseFloat(monto),
             metodo_pago || null, referencia || null, usuario_id]
        );
        await client.query('COMMIT');
        const movimiento = rows[0];

        registrarAccionBitacora({
            entidad_tipo: 'movimiento_financiero', entidad_id: movimiento.id, accion: tipo,
            usuario_id, usuario_nombre: req.usuario.nombre,
            detalle: `Se registro un ${tipo} de $${movimiento.monto} para el proveedor.`,
        });

        return res.status(201).json({ movimiento });
    } catch (err) {
        await client?.query('ROLLBACK').catch(() => {});
        console.error('Error registrarMovimiento (financiero):', err.message);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al registrar el movimiento.' });
    } finally {
        client?.release();
    }
};

/**
 * PATCH /api/proveedores/movimientos/:id/estado   (admin)
 * Permite anular un movimiento manual (pago/abono/ajuste) registrado por error.
 */
const cambiarEstadoMovimiento = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    if (!estado || !['confirmado', 'anulado'].includes(estado)) {
        return res.status(400).json({ error: 'Estado invalido.' });
    }
    try {
        // Solo los movimientos manuales (pago/abono/ajuste) se pueden anular
        // desde aqui. 'compra', 'gasto' y 'cancelacion' se generan
        // automaticamente y reflejan otra entidad (compras_proveedor /
        // gastos_proveedor); anularlos aqui desincronizaria el resumen
        // financiero sin tocar esa entidad real.
        const { rows: actualRows } = await pool.query(
            `SELECT m.tipo, m.estado, m.monto, m.compra_id, c.estado AS compra_estado, c.total AS compra_total,
                    (SELECT COALESCE(SUM(x.monto), 0) FROM movimientos_financieros_proveedor x
                      WHERE x.compra_id = m.compra_id AND x.tipo IN ('pago','abono') AND x.estado = 'confirmado') AS compra_pagado
             FROM movimientos_financieros_proveedor m
             LEFT JOIN compras_proveedor c ON c.id = m.compra_id
             WHERE m.id = $1`, [id]);
        const actual = actualRows[0];
        if (!actual) return res.status(404).json({ error: 'Movimiento no encontrado.' });
        if (!['pago', 'abono', 'ajuste'].includes(actual.tipo)) {
            return res.status(409).json({ error: 'Este movimiento se genero automaticamente y no se puede anular desde aqui.' });
        }
        if (actual.estado === estado) return res.status(409).json({ error: `El movimiento ya esta ${estado}.` });
        // Volver a confirmar un pago: no sobre una compra cancelada ni por encima del saldo.
        if (estado === 'confirmado' && actual.compra_id && ['pago', 'abono'].includes(actual.tipo)) {
            if (actual.compra_estado === 'cancelada') return res.status(409).json({ error: 'La compra de este pago esta cancelada.' });
            if (Number(actual.compra_pagado) + Number(actual.monto) > Number(actual.compra_total) + 0.005) {
                return res.status(409).json({ error: 'Confirmarlo superaria el total de la compra.' });
            }
        }

        const { rows } = await pool.query(
            'UPDATE movimientos_financieros_proveedor SET estado = $1 WHERE id = $2 RETURNING *',
            [estado, id]
        );
        registrarAccionBitacora({
            entidad_tipo: 'movimiento_financiero', entidad_id: rows[0].id, accion: estado === 'anulado' ? 'anulado' : 'confirmado',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `${actual.tipo} de $${rows[0].monto} ${estado === 'anulado' ? 'anulado' : 'confirmado de nuevo'}${actual.compra_id ? ` (compra #${actual.compra_id})` : ''}.`,
        });
        return res.json({ movimiento: rows[0] });
    } catch (err) {
        console.error('Error cambiarEstadoMovimiento:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al cambiar el estado del movimiento.' });
    }
};

// ─────────────────────────────────────────────────────────────
// RESUMEN FINANCIERO
// GET /api/proveedores/resumen
// Filtros opcionales: periodo=semana|mes|anio, proveedor_id
// ─────────────────────────────────────────────────────────────
const resumenFinanciero = async (req, res) => {
    const { periodo, proveedor_id } = req.query;

    let desde = null;
    if (periodo === 'semana') desde = `NOW() - INTERVAL '7 days'`;
    else if (periodo === 'mes') desde = `NOW() - INTERVAL '30 days'`;
    else if (periodo === 'anio') desde = `NOW() - INTERVAL '365 days'`;

    const filtroProveedor = proveedor_id ? ' AND proveedor_id = $1' : '';
    const paramsProveedor = proveedor_id ? [proveedor_id] : [];

    try {
        const filtroFechaCompras = desde ? ` AND created_at >= ${desde}` : '';
        const { rows: compradoRows } = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) AS total, COUNT(*) AS cantidad
             FROM movimientos_financieros_proveedor
             WHERE tipo = 'compra' AND estado = 'confirmado' ${filtroFechaCompras}${filtroProveedor}`,
            paramsProveedor
        );

        const { rows: pagadoRows } = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) AS total
             FROM movimientos_financieros_proveedor
             WHERE tipo IN ('pago','abono') AND estado = 'confirmado' ${filtroFechaCompras}${filtroProveedor}`,
            paramsProveedor
        );

        const { rows: gastosRows } = await pool.query(
            `SELECT COALESCE(SUM(monto), 0) AS total, COUNT(*) AS cantidad
             FROM gastos_proveedor
             WHERE estado != 'anulado' ${desde ? ` AND created_at >= ${desde}` : ''}${proveedor_id ? ' AND proveedor_id = $1' : ''}`,
            paramsProveedor
        );

        const { rows: proveedoresRows } = await pool.query(
            `SELECT COUNT(*) AS total FROM proveedores WHERE activo = TRUE`
        );

        // Lo que se debe: por proveedor, compras vigentes menos sus pagos (las
        // compras canceladas y sus pagos no cuentan). Ver saldoProveedoresSql.
        const filtroFechaDeuda = desde ? ` AND m.created_at >= ${desde}` : '';
        const { rows: pendienteRows } = await pool.query(
            `SELECT COALESCE(SUM(GREATEST(saldo, 0)), 0) AS total FROM (${saldoProveedoresSql(filtroFechaDeuda + (proveedor_id ? ' AND m.proveedor_id = $1' : ''))}) s`,
            paramsProveedor
        );
        // Pagos que siguen confirmados en compras ya canceladas (datos anteriores
        // a la correccion del Sprint 24): dinero que salio sin compra vigente.
        const { rows: huerfanosRows } = await pool.query(
            `SELECT COALESCE(SUM(m.monto), 0) AS total, COUNT(*)::int AS cantidad
             FROM movimientos_financieros_proveedor m JOIN compras_proveedor c ON c.id = m.compra_id
             WHERE c.estado = 'cancelada' AND m.tipo IN ('pago','abono') AND m.estado = 'confirmado'${proveedor_id ? ' AND m.proveedor_id = $1' : ''}`,
            paramsProveedor
        );

        const totalComprado = parseFloat(compradoRows[0].total);
        const totalPagado   = parseFloat(pagadoRows[0].total);

        return res.json({
            periodo: periodo || 'todo',
            total_comprado: totalComprado,
            total_pagado: totalPagado,
            total_pendiente: Math.round(parseFloat(pendienteRows[0].total) * 100) / 100,
            pagos_en_compras_canceladas: { total: parseFloat(huerfanosRows[0].total), cantidad: huerfanosRows[0].cantidad },
            total_gastos: parseFloat(gastosRows[0].total),
            numero_compras: parseInt(compradoRows[0].cantidad, 10),
            numero_gastos: parseInt(gastosRows[0].cantidad, 10),
            proveedores_activos: parseInt(proveedoresRows[0].total, 10),
        });
    } catch (err) {
        console.error('Error resumenFinanciero:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al calcular el resumen financiero.' });
    }
};

module.exports = { listarMovimientos, registrarMovimiento, cambiarEstadoMovimiento, resumenFinanciero };
