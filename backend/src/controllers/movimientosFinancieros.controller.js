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
const { registrarAccionBitacora } = require('../services/ordenesHistorial.service');

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
        SELECT m.*, p.nombre_comercial AS proveedor_nombre, u.nombre AS usuario_nombre
        FROM movimientos_financieros_proveedor m
        LEFT JOIN proveedores p ON p.id = m.proveedor_id
        LEFT JOIN usuarios    u ON u.id = m.usuario_id
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

    try {
        const { rows: provRows } = await pool.query('SELECT id FROM proveedores WHERE id = $1', [proveedor_id]);
        if (!provRows[0]) return res.status(404).json({ error: 'Proveedor no encontrado.' });

        if (compra_id) {
            const { rows: compraRows } = await pool.query('SELECT id FROM compras_proveedor WHERE id = $1 AND proveedor_id = $2', [compra_id, proveedor_id]);
            if (!compraRows[0]) return res.status(404).json({ error: 'La compra indicada no pertenece a este proveedor.' });
        }

        const { rows } = await pool.query(
            `INSERT INTO movimientos_financieros_proveedor
                (proveedor_id, tipo, compra_id, descripcion, monto, metodo_pago, referencia, estado, usuario_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmado',$8)
             RETURNING *`,
            [proveedor_id, tipo, compra_id || null, descripcion || null, parseFloat(monto),
             metodo_pago || null, referencia || null, usuario_id]
        );
        const movimiento = rows[0];

        registrarAccionBitacora({
            entidad_tipo: 'movimiento_financiero', entidad_id: movimiento.id, accion: tipo,
            usuario_id, usuario_nombre: req.usuario.nombre,
            detalle: `Se registro un ${tipo} de $${movimiento.monto} para el proveedor.`,
        });

        return res.status(201).json({ movimiento });
    } catch (err) {
        console.error('Error registrarMovimiento (financiero):', err);
        return res.status(500).json({ error: 'Error al registrar el movimiento.' });
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
        const { rows: actualRows } = await pool.query('SELECT tipo FROM movimientos_financieros_proveedor WHERE id = $1', [id]);
        if (!actualRows[0]) return res.status(404).json({ error: 'Movimiento no encontrado.' });
        if (!['pago', 'abono', 'ajuste'].includes(actualRows[0].tipo)) {
            return res.status(409).json({ error: 'Este movimiento se genero automaticamente y no se puede anular desde aqui.' });
        }

        const { rows } = await pool.query(
            'UPDATE movimientos_financieros_proveedor SET estado = $1 WHERE id = $2 RETURNING *',
            [estado, id]
        );
        return res.json({ movimiento: rows[0] });
    } catch (err) {
        console.error('Error cambiarEstadoMovimiento:', err);
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

        const totalComprado = parseFloat(compradoRows[0].total);
        const totalPagado   = parseFloat(pagadoRows[0].total);

        return res.json({
            periodo: periodo || 'todo',
            total_comprado: totalComprado,
            total_pagado: totalPagado,
            total_pendiente: Math.max(0, Math.round((totalComprado - totalPagado) * 100) / 100),
            total_gastos: parseFloat(gastosRows[0].total),
            numero_compras: parseInt(compradoRows[0].cantidad, 10),
            numero_gastos: parseInt(gastosRows[0].cantidad, 10),
            proveedores_activos: parseInt(proveedoresRows[0].total, 10),
        });
    } catch (err) {
        console.error('Error resumenFinanciero:', err);
        return res.status(500).json({ error: 'Error al calcular el resumen financiero.' });
    }
};

module.exports = { listarMovimientos, registrarMovimiento, cambiarEstadoMovimiento, resumenFinanciero };
