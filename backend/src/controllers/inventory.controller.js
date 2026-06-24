const pool = require('../config/db');

// ─────────────────────────────────────────────────────────────
// REPUESTOS - CRUD
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/inventory/repuestos
 * Query params: q (búsqueda), categoria_id, bajo_stock
 */
const listarRepuestos = async (req, res) => {
    const { q, categoria_id, bajo_stock, page = 1, limit = 15 } = req.query;

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 15));
    const offset   = (pageNum - 1) * limitNum;

    let where   = 'WHERE r.activo = TRUE';
    const params = [];

    if (q) {
        params.push(`%${q}%`);
        where += ` AND (r.nombre ILIKE $${params.length} OR r.codigo ILIKE $${params.length})`;
    }
    if (categoria_id) {
        params.push(categoria_id);
        where += ` AND r.categoria_id = $${params.length}`;
    }
    if (bajo_stock === 'true') {
        where += ` AND r.stock_actual <= r.stock_minimo`;
    }

    const countQuery = `SELECT COUNT(*) AS total FROM repuestos r ${where}`;
    const dataQuery  = `
        SELECT r.*, c.nombre AS categoria_nombre
        FROM repuestos r
        LEFT JOIN categorias_repuesto c ON r.categoria_id = c.id
        ${where}
        ORDER BY r.nombre ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    try {
        const [{ rows: countRows }, { rows }] = await Promise.all([
            pool.query(countQuery, params),
            pool.query(dataQuery, [...params, limitNum, offset]),
        ]);
        const total = parseInt(countRows[0].total, 10);
        return res.json({
            repuestos: rows,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        });
    } catch (err) {
        console.error('Error listarRepuestos:', err);
        return res.status(500).json({ error: 'Error al obtener repuestos.' });
    }
};

/**
 * GET /api/inventory/repuestos/:id
 */
const obtenerRepuesto = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            `SELECT r.*, c.nombre AS categoria_nombre
             FROM repuestos r
             LEFT JOIN categorias_repuesto c ON r.categoria_id = c.id
             WHERE r.id = $1 AND r.activo = TRUE`,
            [id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Repuesto no encontrado.' });
        return res.json(rows[0]);
    } catch (err) {
        console.error('Error obtenerRepuesto:', err);
        return res.status(500).json({ error: 'Error al obtener repuesto.' });
    }
};

/**
 * POST /api/inventory/repuestos
 * Roles permitidos: administrador
 */
const crearRepuesto = async (req, res) => {
    const {
        codigo,
        nombre,
        descripcion,
        categoria_id,
        precio_compra,
        precio_venta,
        stock_actual,
        stock_minimo,
        unidad_medida,
        imagen_url,
        en_venta = false,
    } = req.body;

    if (!codigo || !nombre) {
        return res.status(400).json({ error: 'Código y nombre son obligatorios.' });
    }

    try {
        const { rows } = await pool.query(
            `INSERT INTO repuestos
                (codigo, nombre, descripcion, categoria_id, precio_compra, precio_venta, stock_actual, stock_minimo, unidad_medida, imagen_url, en_venta)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             RETURNING *`,
            [
                codigo.trim().toUpperCase(),
                nombre.trim(),
                descripcion || null,
                categoria_id || null,
                precio_compra === '' || precio_compra == null ? 0 : precio_compra,
                precio_venta === '' || precio_venta == null ? 0 : precio_venta,
                stock_actual === '' || stock_actual == null ? 0 : stock_actual,
                stock_minimo === '' || stock_minimo == null ? 5 : stock_minimo,
                unidad_medida || 'unidad',
                imagen_url || null,
                en_venta === true || en_venta === 'true',
            ]
        );
        return res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'El código ya existe.' });
        console.error('Error crearRepuesto:', err);
        return res.status(500).json({ error: 'Error al crear repuesto.' });
    }
};
/**
 * PUT /api/inventory/repuestos/:id
 * Roles permitidos: administrador
 * Nota: el stock NO se modifica directamente aquí; se usa el endpoint de movimientos.
 */
const actualizarRepuesto = async (req, res) => {
    const { id } = req.params;
    const {
        codigo,
        nombre,
        descripcion,
        categoria_id,
        precio_compra,
        precio_venta,
        stock_minimo,
        unidad_medida,
        activo,
        imagen_url,
        en_venta,
    } = req.body;

    if (!nombre) {
        return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }

    try {
        const { rows } = await pool.query(
            `UPDATE repuestos
             SET codigo=COALESCE(NULLIF($1, ''), codigo),
                 nombre=$2,
                 descripcion=$3,
                 categoria_id=$4,
                 precio_compra=$5,
                 precio_venta=$6,
                 stock_minimo=$7,
                 unidad_medida=$8,
                 activo=COALESCE($9, activo),
                 imagen_url=$10,
                 en_venta=COALESCE($11, en_venta)
             WHERE id=$12
             RETURNING *`,
            [
                codigo ? codigo.trim().toUpperCase() : null,
                nombre.trim(),
                descripcion || null,
                categoria_id || null,
                precio_compra === '' || precio_compra == null ? 0 : precio_compra,
                precio_venta === '' || precio_venta == null ? 0 : precio_venta,
                stock_minimo === '' || stock_minimo == null ? 5 : stock_minimo,
                unidad_medida || 'unidad',
                typeof activo === 'boolean' ? activo : null,
                imagen_url || null,
                typeof en_venta === 'boolean' ? en_venta : (en_venta === 'true' ? true : en_venta === 'false' ? false : null),
                id,
            ]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Repuesto no encontrado.' });
        return res.json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'El código ya existe.' });
        console.error('Error actualizarRepuesto:', err);
        return res.status(500).json({ error: 'Error al actualizar repuesto.' });
    }
};
/**
 * DELETE /api/inventory/repuestos/:id
 * Soft delete — solo administrador
 */
const eliminarRepuesto = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Borra primero los movimientos relacionados para evitar errores de llave foranea.
        await client.query(
            'DELETE FROM movimientos_inventario WHERE repuesto_id=$1',
            [id]
        );

        // Ahora borra el repuesto de verdad de la tabla repuestos.
        const { rows, rowCount } = await client.query(
            'DELETE FROM repuestos WHERE id=$1 RETURNING id, nombre',
            [id]
        );

        if (!rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Repuesto no encontrado.' });
        }

        await client.query('COMMIT');
        return res.json({
            mensaje: 'Repuesto eliminado definitivamente de la base de datos.',
            repuesto: rows[0],
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error eliminarRepuesto:', err);
        return res.status(500).json({ error: 'Error al eliminar repuesto.' });
    } finally {
        client.release();
    }
};
// ─────────────────────────────────────────────────────────────
// MOVIMIENTOS DE STOCK
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/inventory/movimientos
 * Body: { repuesto_id, tipo ('entrada'|'salida'), cantidad, motivo, referencia }
 * Actualiza automáticamente stock_actual en repuestos.
 */
const registrarMovimiento = async (req, res) => {
    const { repuesto_id, tipo, cantidad, motivo, referencia } = req.body;
    const usuario_id = req.usuario.id;

    if (!repuesto_id || !tipo || !cantidad) {
        return res.status(400).json({ error: 'repuesto_id, tipo y cantidad son obligatorios.' });
    }
    if (!['entrada', 'salida'].includes(tipo)) {
        return res.status(400).json({ error: 'tipo debe ser "entrada" o "salida".' });
    }
    if (parseInt(cantidad) <= 0) {
        return res.status(400).json({ error: 'La cantidad debe ser mayor a cero.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Bloquea la fila para evitar race conditions
        const { rows } = await client.query(
            'SELECT id, stock_actual FROM repuestos WHERE id=$1 AND activo=TRUE FOR UPDATE',
            [repuesto_id]
        );
        const repuesto = rows[0];
        if (!repuesto) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Repuesto no encontrado.' });
        }

        const stockAnterior = repuesto.stock_actual;
        const cantidadInt   = parseInt(cantidad);
        const stockNuevo    = tipo === 'entrada'
            ? stockAnterior + cantidadInt
            : stockAnterior - cantidadInt;

        if (stockNuevo < 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                error: `Stock insuficiente. Stock actual: ${stockAnterior}. Salida solicitada: ${cantidadInt}.`
            });
        }

        // 1) Actualizar stock
        await client.query(
            'UPDATE repuestos SET stock_actual=$1 WHERE id=$2',
            [stockNuevo, repuesto_id]
        );

        // 2) Registrar movimiento para trazabilidad
        const { rows: movRows } = await client.query(
            `INSERT INTO movimientos_inventario
                (repuesto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
             RETURNING *`,
            [repuesto_id, usuario_id, tipo, cantidadInt, stockAnterior, stockNuevo, motivo, referencia]
        );

        await client.query('COMMIT');

        return res.status(201).json({
            movimiento: movRows[0],
            stock_anterior: stockAnterior,
            stock_nuevo: stockNuevo,
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error registrarMovimiento:', err);
        return res.status(500).json({ error: 'Error al registrar movimiento.' });
    } finally {
        client.release();
    }
};

/**
 * GET /api/inventory/movimientos
 * Query params: repuesto_id, tipo, limit
 */
const listarMovimientos = async (req, res) => {
    const { repuesto_id, tipo, limit = 50 } = req.query;
    let query = `
        SELECT m.*, r.nombre AS repuesto_nombre, r.codigo AS repuesto_codigo,
               u.nombre AS usuario_nombre
        FROM movimientos_inventario m
        JOIN repuestos r ON r.id = m.repuesto_id
        JOIN usuarios  u ON u.id = m.usuario_id
        WHERE 1=1
    `;
    const params = [];
    if (repuesto_id) { params.push(repuesto_id); query += ` AND m.repuesto_id=$${params.length}`; }
    if (tipo)        { params.push(tipo);        query += ` AND m.tipo=$${params.length}`; }
    params.push(parseInt(limit));
    query += ` ORDER BY m.created_at DESC LIMIT $${params.length}`;

    try {
        const { rows } = await pool.query(query, params);
        return res.json({ movimientos: rows });
    } catch (err) {
        console.error('Error listarMovimientos:', err);
        return res.status(500).json({ error: 'Error al obtener movimientos.' });
    }
};

/**
 * GET /api/inventory/categorias
 */
const listarCategorias = async (_req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM categorias_repuesto ORDER BY nombre');
        return res.json({ categorias: rows });
    } catch (err) {
        return res.status(500).json({ error: 'Error al obtener categorías.' });
    }
};

const toggleEnVenta = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            'UPDATE repuestos SET en_venta = NOT en_venta WHERE id = $1 AND activo = TRUE RETURNING id, nombre, en_venta',
            [id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Repuesto no encontrado.' });
        return res.json(rows[0]);
    } catch (err) {
        console.error('Error toggleEnVenta:', err);
        return res.status(500).json({ error: 'Error al cambiar estado de venta.' });
    }
};

module.exports = { listarRepuestos, obtenerRepuesto, crearRepuesto, actualizarRepuesto, eliminarRepuesto, registrarMovimiento, listarMovimientos, listarCategorias, toggleEnVenta };
