/**
 * SS SWAP - Controlador de Gastos de Proveedores
 *
 * Registra gastos operativos del taller vinculados (opcionalmente) a un
 * proveedor: compra de repuestos, materiales, insumos, herramientas,
 * servicios contratados u otros. Cada gasto "pagado" o "anulado" genera
 * ademas una entrada en el historial financiero del proveedor (si aplica),
 * para que el resumen financiero por proveedor sea consistente.
 */
const pool = require('../config/db');
const { registrarAccionBitacora } = require('../services/ordenesHistorial.service');

const CATEGORIAS = ['repuestos', 'materiales', 'insumos', 'herramientas', 'servicios', 'otros'];
const METODOS    = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'];
const ESTADOS    = ['pendiente', 'pagado', 'anulado'];

// ─────────────────────────────────────────────────────────────
// LISTAR
// GET /api/proveedores/gastos
// Filtros: proveedor_id, categoria, estado, fecha_inicio, fecha_fin, q, page, limit
// ─────────────────────────────────────────────────────────────
const listarGastos = async (req, res) => {
    const { proveedor_id, categoria, estado, fecha_inicio, fecha_fin, q, page = 1, limit = 20 } = req.query;

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * limitNum;

    let where    = 'WHERE 1=1';
    const params = [];

    if (proveedor_id) { params.push(proveedor_id); where += ` AND g.proveedor_id = $${params.length}`; }
    if (categoria)    { params.push(categoria);     where += ` AND g.categoria = $${params.length}`; }
    if (estado)       { params.push(estado);        where += ` AND g.estado = $${params.length}`; }
    if (fecha_inicio) { params.push(fecha_inicio);  where += ` AND g.fecha >= $${params.length}`; }
    if (fecha_fin)    { params.push(fecha_fin);     where += ` AND g.fecha <= $${params.length}`; }
    if (q) {
        params.push(`%${q}%`);
        where += ` AND (g.descripcion ILIKE $${params.length} OR g.numero_comprobante ILIKE $${params.length})`;
    }

    const countQuery = `SELECT COUNT(*) AS total FROM gastos_proveedor g ${where}`;
    const dataQuery  = `
        SELECT g.*, p.nombre_comercial AS proveedor_nombre, u.nombre AS usuario_nombre
        FROM gastos_proveedor g
        LEFT JOIN proveedores p ON p.id = g.proveedor_id
        LEFT JOIN usuarios    u ON u.id = g.usuario_id
        ${where}
        ORDER BY g.fecha DESC, g.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    try {
        const [{ rows: countRows }, { rows }] = await Promise.all([
            pool.query(countQuery, params),
            pool.query(dataQuery, [...params, limitNum, offset]),
        ]);
        const total = parseInt(countRows[0].total, 10);
        return res.json({ gastos: rows, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
    } catch (err) {
        console.error('Error listarGastos:', err);
        return res.status(500).json({ error: 'Error al obtener gastos.' });
    }
};

// ─────────────────────────────────────────────────────────────
// OBTENER UNO
// GET /api/proveedores/gastos/:id
// ─────────────────────────────────────────────────────────────
const obtenerGasto = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            `SELECT g.*, p.nombre_comercial AS proveedor_nombre, u.nombre AS usuario_nombre
             FROM gastos_proveedor g
             LEFT JOIN proveedores p ON p.id = g.proveedor_id
             LEFT JOIN usuarios    u ON u.id = g.usuario_id
             WHERE g.id = $1`,
            [id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Gasto no encontrado.' });
        return res.json({ gasto: rows[0] });
    } catch (err) {
        console.error('Error obtenerGasto:', err);
        return res.status(500).json({ error: 'Error al obtener el gasto.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CREAR
// POST /api/proveedores/gastos   (admin)
// ─────────────────────────────────────────────────────────────
const crearGasto = async (req, res) => {
    const {
        proveedor_id, categoria, descripcion, monto, fecha,
        metodo_pago, estado, numero_comprobante, observaciones,
    } = req.body;
    const usuario_id = req.usuario.id;

    if (!descripcion || !descripcion.trim()) return res.status(400).json({ error: 'La descripcion es requerida.' });
    if (!monto || parseFloat(monto) <= 0)     return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });
    if (categoria && !CATEGORIAS.includes(categoria)) return res.status(400).json({ error: 'Categoria invalida.' });
    if (metodo_pago && !METODOS.includes(metodo_pago)) return res.status(400).json({ error: 'Metodo de pago invalido.' });
    if (estado && !ESTADOS.includes(estado))  return res.status(400).json({ error: 'Estado invalido.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (proveedor_id) {
            const { rows: provRows } = await client.query('SELECT id FROM proveedores WHERE id = $1', [proveedor_id]);
            if (!provRows[0]) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Proveedor no encontrado.' });
            }
        }

        const { rows } = await client.query(
            `INSERT INTO gastos_proveedor
                (proveedor_id, usuario_id, categoria, descripcion, monto, fecha, metodo_pago, estado, numero_comprobante, observaciones)
             VALUES ($1,$2,$3,$4,$5,COALESCE($6, CURRENT_DATE),$7,$8,$9,$10)
             RETURNING *`,
            [proveedor_id || null, usuario_id, categoria || 'otros', descripcion.trim(), parseFloat(monto),
             fecha || null, metodo_pago || 'efectivo', estado || 'pagado', numero_comprobante || null, observaciones || null]
        );
        const gasto = rows[0];

        // Si esta vinculado a un proveedor, se refleja en su historial financiero.
        if (gasto.proveedor_id) {
            await client.query(
                `INSERT INTO movimientos_financieros_proveedor
                    (proveedor_id, tipo, gasto_id, descripcion, monto, metodo_pago, estado, usuario_id)
                 VALUES ($1,'gasto',$2,$3,$4,$5,$6,$7)`,
                [gasto.proveedor_id, gasto.id, gasto.descripcion, gasto.monto, gasto.metodo_pago,
                 gasto.estado === 'anulado' ? 'anulado' : 'confirmado', usuario_id]
            );
        }

        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'gasto', entidad_id: gasto.id, accion: 'registrado',
            usuario_id, usuario_nombre: req.usuario.nombre,
            detalle: `Gasto "${gasto.descripcion}" por $${gasto.monto} registrado.`,
        });

        return res.status(201).json({ gasto });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error crearGasto:', err);
        return res.status(500).json({ error: 'Error al registrar el gasto.' });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR
// PUT /api/proveedores/gastos/:id   (admin)
// ─────────────────────────────────────────────────────────────
const actualizarGasto = async (req, res) => {
    const { id } = req.params;
    const {
        proveedor_id, categoria, descripcion, monto, fecha,
        metodo_pago, estado, numero_comprobante, observaciones,
    } = req.body;

    if (!descripcion || !descripcion.trim()) return res.status(400).json({ error: 'La descripcion es requerida.' });
    if (!monto || parseFloat(monto) <= 0)     return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });
    if (categoria && !CATEGORIAS.includes(categoria)) return res.status(400).json({ error: 'Categoria invalida.' });
    if (metodo_pago && !METODOS.includes(metodo_pago)) return res.status(400).json({ error: 'Metodo de pago invalido.' });
    if (estado && !ESTADOS.includes(estado))  return res.status(400).json({ error: 'Estado invalido.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (proveedor_id) {
            const { rows: provRows } = await client.query('SELECT id FROM proveedores WHERE id = $1', [proveedor_id]);
            if (!provRows[0]) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Proveedor no encontrado.' });
            }
        }

        const { rows } = await client.query(
            `UPDATE gastos_proveedor SET
                proveedor_id=$1, categoria=$2, descripcion=$3, monto=$4, fecha=$5,
                metodo_pago=$6, estado=$7, numero_comprobante=$8, observaciones=$9
             WHERE id=$10 RETURNING *`,
            [proveedor_id || null, categoria || 'otros', descripcion.trim(), parseFloat(monto), fecha || null,
             metodo_pago || 'efectivo', estado || 'pagado', numero_comprobante || null, observaciones || null, id]
        );
        const gasto = rows[0];
        if (!gasto) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Gasto no encontrado.' });
        }

        // Mantiene sincronizado el movimiento financiero generado en crearGasto
        // (si existe) con los datos editados, para que el resumen financiero
        // del proveedor (total_gastos) nunca quede desactualizado.
        const { rows: movRows } = await client.query(
            'SELECT id FROM movimientos_financieros_proveedor WHERE gasto_id = $1 AND tipo = $2',
            [gasto.id, 'gasto']
        );
        const movExistente = movRows[0];

        if (gasto.proveedor_id) {
            const estadoMov = gasto.estado === 'anulado' ? 'anulado' : 'confirmado';
            if (movExistente) {
                await client.query(
                    `UPDATE movimientos_financieros_proveedor
                     SET proveedor_id=$1, descripcion=$2, monto=$3, metodo_pago=$4, estado=$5
                     WHERE id=$6`,
                    [gasto.proveedor_id, gasto.descripcion, gasto.monto, gasto.metodo_pago, estadoMov, movExistente.id]
                );
            } else {
                await client.query(
                    `INSERT INTO movimientos_financieros_proveedor
                        (proveedor_id, tipo, gasto_id, descripcion, monto, metodo_pago, estado, usuario_id)
                     VALUES ($1,'gasto',$2,$3,$4,$5,$6,$7)`,
                    [gasto.proveedor_id, gasto.id, gasto.descripcion, gasto.monto, gasto.metodo_pago, estadoMov, req.usuario.id]
                );
            }
        } else if (movExistente) {
            // Se quito el proveedor del gasto: el movimiento ya no aplica a ningun proveedor.
            await client.query('DELETE FROM movimientos_financieros_proveedor WHERE id = $1', [movExistente.id]);
        }

        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'gasto', entidad_id: gasto.id, accion: 'actualizado',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Gasto "${gasto.descripcion}" actualizado.`,
        });

        return res.json({ gasto });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error actualizarGasto:', err);
        return res.status(500).json({ error: 'Error al actualizar el gasto.' });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────
// ELIMINAR (solo si esta pendiente; si ya esta pagado se debe anular)
// DELETE /api/proveedores/gastos/:id   (admin)
// ─────────────────────────────────────────────────────────────
const eliminarGasto = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: gastoRows } = await client.query('SELECT estado FROM gastos_proveedor WHERE id = $1', [id]);
        if (!gastoRows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Gasto no encontrado.' });
        }
        if (gastoRows[0].estado === 'pagado') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'No se puede eliminar un gasto pagado. Anulalo en su lugar.' });
        }
        // Limpia el movimiento financiero que crearGasto haya generado, para no
        // dejar una entrada huerfana (sin gasto real detras) en el historial.
        await client.query('DELETE FROM movimientos_financieros_proveedor WHERE gasto_id = $1', [id]);
        await client.query('DELETE FROM gastos_proveedor WHERE id = $1', [id]);
        await client.query('COMMIT');
        return res.json({ mensaje: 'Gasto eliminado correctamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error eliminarGasto:', err);
        return res.status(500).json({ error: 'Error al eliminar el gasto.' });
    } finally {
        client.release();
    }
};

module.exports = { listarGastos, obtenerGasto, crearGasto, actualizarGasto, eliminarGasto };
