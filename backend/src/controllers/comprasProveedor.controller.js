/**
 * SS SWAP - Controlador de Compras / Ordenes a Proveedores
 *
 * IMPORTANTE (Fase 1): este controlador SOLO maneja el ciclo de vida de la
 * compra (crear, listar, cambiar estado) y sus items. Todavia NO actualiza
 * el inventario ni la bitacora al marcar una compra como "recibida" — esa
 * integracion se hace en la Fase 3, reutilizando la transaccion con
 * `FOR UPDATE` que ya usa inventory.controller.js (registrarMovimiento),
 * para no duplicar esa logica de concurrencia.
 */
const pool = require('../config/db');
const { registrarAccionBitacora } = require('../services/ordenesHistorial.service');

const ESTADOS = ['pendiente', 'solicitada', 'en_proceso', 'recibida', 'cancelada'];

/** Recalcula subtotal/iva/total de una compra a partir de sus items (IVA 15% Ecuador). */
const IVA_TASA = 0.15;

async function recalcularTotales(client, compraId) {
    const { rows } = await client.query(
        'SELECT COALESCE(SUM(subtotal), 0) AS subtotal FROM compras_proveedor_items WHERE compra_id = $1',
        [compraId]
    );
    const subtotal = parseFloat(rows[0].subtotal);
    const iva   = Math.round(subtotal * IVA_TASA * 100) / 100;
    const total = Math.round((subtotal + iva) * 100) / 100;
    await client.query(
        'UPDATE compras_proveedor SET subtotal=$1, iva=$2, total=$3 WHERE id=$4',
        [subtotal, iva, total, compraId]
    );
    return { subtotal, iva, total };
}

// ─────────────────────────────────────────────────────────────
// LISTAR
// GET /api/proveedores/compras
// Filtros: proveedor_id, estado, fecha_inicio, fecha_fin, page, limit
// ─────────────────────────────────────────────────────────────
const listarCompras = async (req, res) => {
    const { proveedor_id, estado, fecha_inicio, fecha_fin, page = 1, limit = 20 } = req.query;

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * limitNum;

    let where    = 'WHERE 1=1';
    const params = [];

    if (proveedor_id) { params.push(proveedor_id); where += ` AND c.proveedor_id = $${params.length}`; }
    if (estado)       { params.push(estado);        where += ` AND c.estado = $${params.length}`; }
    if (fecha_inicio) { params.push(fecha_inicio);  where += ` AND c.fecha_solicitud >= $${params.length}`; }
    if (fecha_fin)    { params.push(fecha_fin);     where += ` AND c.fecha_solicitud <= $${params.length}`; }

    const countQuery = `SELECT COUNT(*) AS total FROM compras_proveedor c ${where}`;
    const dataQuery  = `
        SELECT c.*, p.nombre_comercial AS proveedor_nombre, u.nombre AS usuario_nombre,
               (SELECT COUNT(*) FROM compras_proveedor_items i WHERE i.compra_id = c.id) AS total_items
        FROM compras_proveedor c
        LEFT JOIN proveedores p ON p.id = c.proveedor_id
        LEFT JOIN usuarios    u ON u.id = c.usuario_id
        ${where}
        ORDER BY c.fecha_solicitud DESC, c.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    try {
        const [{ rows: countRows }, { rows }] = await Promise.all([
            pool.query(countQuery, params),
            pool.query(dataQuery, [...params, limitNum, offset]),
        ]);
        const total = parseInt(countRows[0].total, 10);
        return res.json({ compras: rows, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
    } catch (err) {
        console.error('Error listarCompras:', err);
        return res.status(500).json({ error: 'Error al obtener compras.' });
    }
};

// ─────────────────────────────────────────────────────────────
// OBTENER UNA (con items)
// GET /api/proveedores/compras/:id
// ─────────────────────────────────────────────────────────────
const obtenerCompra = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            `SELECT c.*, p.nombre_comercial AS proveedor_nombre, u.nombre AS usuario_nombre
             FROM compras_proveedor c
             LEFT JOIN proveedores p ON p.id = c.proveedor_id
             LEFT JOIN usuarios    u ON u.id = c.usuario_id
             WHERE c.id = $1`,
            [id]
        );
        const compra = rows[0];
        if (!compra) return res.status(404).json({ error: 'Compra no encontrada.' });

        const { rows: items } = await pool.query(
            `SELECT i.*, r.nombre AS repuesto_nombre_actual, r.codigo AS repuesto_codigo
             FROM compras_proveedor_items i
             LEFT JOIN repuestos r ON r.id = i.repuesto_id
             WHERE i.compra_id = $1 ORDER BY i.id ASC`,
            [id]
        );

        return res.json({ compra: { ...compra, items } });
    } catch (err) {
        console.error('Error obtenerCompra:', err);
        return res.status(500).json({ error: 'Error al obtener la compra.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CREAR (con items)
// POST /api/proveedores/compras   (admin)
// body: { proveedor_id, fecha_solicitud, notas, items: [{repuesto_id?, descripcion, cantidad, precio_unitario}] }
// ─────────────────────────────────────────────────────────────
const crearCompra = async (req, res) => {
    const { proveedor_id, fecha_solicitud, notas, items } = req.body;
    const usuario_id = req.usuario.id;

    if (!proveedor_id) return res.status(400).json({ error: 'proveedor_id es requerido.' });
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'La compra debe incluir al menos un item.' });
    }
    for (const it of items) {
        if (!it.descripcion || !it.descripcion.trim()) return res.status(400).json({ error: 'Cada item requiere una descripcion.' });
        if (!it.cantidad || parseInt(it.cantidad) <= 0)  return res.status(400).json({ error: 'La cantidad de cada item debe ser mayor a cero.' });
        if (it.precio_unitario === undefined || parseFloat(it.precio_unitario) < 0) {
            return res.status(400).json({ error: 'El precio unitario de cada item es invalido.' });
        }
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: provRows } = await client.query('SELECT id FROM proveedores WHERE id = $1 AND activo = TRUE', [proveedor_id]);
        if (!provRows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Proveedor no encontrado o inactivo.' });
        }

        const repuestoIds = [...new Set(items.map(it => it.repuesto_id).filter(Boolean))];
        if (repuestoIds.length) {
            const { rows: repRows } = await client.query('SELECT id FROM repuestos WHERE id = ANY($1::int[])', [repuestoIds]);
            const encontrados = new Set(repRows.map(r => r.id));
            const faltantes = repuestoIds.filter(id => !encontrados.has(Number(id)));
            if (faltantes.length) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Repuesto(s) no encontrado(s): ${faltantes.join(', ')}.` });
            }
        }

        const { rows: compraRows } = await client.query(
            `INSERT INTO compras_proveedor (proveedor_id, usuario_id, fecha_solicitud, notas)
             VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4)
             RETURNING *`,
            [proveedor_id, usuario_id, fecha_solicitud || null, notas || null]
        );
        const compra = compraRows[0];

        for (const it of items) {
            const cantidad  = parseInt(it.cantidad);
            const precio    = parseFloat(it.precio_unitario);
            const subtotal  = Math.round(cantidad * precio * 100) / 100;
            await client.query(
                `INSERT INTO compras_proveedor_items (compra_id, repuesto_id, descripcion, cantidad, precio_unitario, subtotal)
                 VALUES ($1,$2,$3,$4,$5,$6)`,
                [compra.id, it.repuesto_id || null, it.descripcion.trim(), cantidad, precio, subtotal]
            );
        }

        const totales = await recalcularTotales(client, compra.id);

        // Registro inicial en el historial financiero del proveedor.
        await client.query(
            `INSERT INTO movimientos_financieros_proveedor
                (proveedor_id, tipo, compra_id, descripcion, monto, estado, usuario_id)
             VALUES ($1,'compra',$2,$3,$4,'confirmado',$5)`,
            [proveedor_id, compra.id, `Orden de compra #${compra.id}`, totales.total, usuario_id]
        );

        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'compra', entidad_id: compra.id, accion: 'creada',
            usuario_id, usuario_nombre: req.usuario.nombre,
            detalle: `Compra #${compra.id} a proveedor por $${totales.total} creada.`,
        });

        const { rows: items_final } = await pool.query('SELECT * FROM compras_proveedor_items WHERE compra_id = $1 ORDER BY id ASC', [compra.id]);
        return res.status(201).json({ compra: { ...compra, ...totales, items: items_final } });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error crearCompra:', err);
        return res.status(500).json({ error: 'Error al registrar la compra.' });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR DATOS GENERALES (no items; solo si sigue pendiente/solicitada)
// PUT /api/proveedores/compras/:id   (admin)
// ─────────────────────────────────────────────────────────────
const actualizarCompra = async (req, res) => {
    const { id } = req.params;
    const { fecha_solicitud, notas } = req.body;

    try {
        const { rows: actualRows } = await pool.query('SELECT estado FROM compras_proveedor WHERE id = $1', [id]);
        if (!actualRows[0]) return res.status(404).json({ error: 'Compra no encontrada.' });
        if (!['pendiente', 'solicitada'].includes(actualRows[0].estado)) {
            return res.status(409).json({ error: 'Solo se pueden editar compras pendientes o solicitadas.' });
        }

        const { rows } = await pool.query(
            `UPDATE compras_proveedor SET fecha_solicitud = COALESCE($1, fecha_solicitud), notas = $2
             WHERE id = $3 RETURNING *`,
            [fecha_solicitud || null, notas || null, id]
        );
        return res.json({ compra: rows[0] });
    } catch (err) {
        console.error('Error actualizarCompra:', err);
        return res.status(500).json({ error: 'Error al actualizar la compra.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CAMBIAR ESTADO
// PATCH /api/proveedores/compras/:id/estado   (admin)
// body: { estado, cantidades_recibidas?: [{item_id, cantidad_recibida}] }
//
// Fase 3: al marcar la compra como 'recibida', por cada item CON
// repuesto_id vinculado y cantidad_recibida > 0 se actualiza el stock real
// (`repuestos.stock_actual`) y se inserta el movimiento correspondiente en
// `movimientos_inventario` (tipo 'entrada') — reutilizando EXACTAMENTE el
// mismo patron de bloqueo de fila ('SELECT ... FOR UPDATE') que ya usa
// inventory.controller.js -> registrarMovimiento, dentro de la MISMA
// transaccion que cambia el estado de la compra. Items sin repuesto_id
// (herramientas, insumos fuera de catalogo) no tocan el inventario, tal
// como se documento en la migracion de la Fase 1.
// ─────────────────────────────────────────────────────────────
const cambiarEstadoCompra = async (req, res) => {
    const { id } = req.params;
    const { estado, cantidades_recibidas } = req.body;
    const usuario_id = req.usuario.id;

    if (!estado || !ESTADOS.includes(estado)) {
        return res.status(400).json({ error: `Estado invalido. Valores permitidos: ${ESTADOS.join(', ')}.` });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: compraRows } = await client.query('SELECT * FROM compras_proveedor WHERE id = $1 FOR UPDATE', [id]);
        const compra = compraRows[0];
        if (!compra) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Compra no encontrada.' });
        }
        if (compra.estado === 'recibida' || compra.estado === 'cancelada') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `La compra ya esta en estado "${compra.estado}" y no se puede modificar.` });
        }

        if (Array.isArray(cantidades_recibidas)) {
            for (const c of cantidades_recibidas) {
                // La cantidad recibida nunca puede superar la cantidad pedida del item
                // (el frontend ya limita esto con max=, pero se re-valida en servidor).
                await client.query(
                    `UPDATE compras_proveedor_items
                     SET cantidad_recibida = LEAST(GREATEST($1, 0), cantidad)
                     WHERE id = $2 AND compra_id = $3`,
                    [parseInt(c.cantidad_recibida) || 0, c.item_id, id]
                );
            }
        }

        const fechaRecepcion = estado === 'recibida' ? new Date().toISOString().slice(0, 10) : compra.fecha_recepcion;
        const { rows } = await client.query(
            'UPDATE compras_proveedor SET estado = $1, fecha_recepcion = $2 WHERE id = $3 RETURNING *',
            [estado, fechaRecepcion, id]
        );

        const stockActualizado = [];
        if (estado === 'recibida') {
            const { rows: items } = await client.query(
                'SELECT * FROM compras_proveedor_items WHERE compra_id = $1 AND repuesto_id IS NOT NULL AND cantidad_recibida > 0',
                [id]
            );
            for (const item of items) {
                // Mismo bloqueo de fila que inventory.controller.js -> registrarMovimiento
                const { rows: repRows } = await client.query(
                    'SELECT id, nombre, stock_actual, area FROM repuestos WHERE id=$1 AND activo=TRUE FOR UPDATE',
                    [item.repuesto_id]
                );
                const repuesto = repRows[0];
                if (!repuesto) {
                    // El repuesto pudo haberse desactivado despues de crear la compra.
                    // No se aborta toda la recepcion por esto: se omite ese item y se
                    // deja constancia en la respuesta para que el admin lo revise.
                    stockActualizado.push({ item_id: item.id, repuesto_id: item.repuesto_id, omitido: true, razon: 'Repuesto no encontrado o inactivo.' });
                    continue;
                }

                // Desde el Sprint 14 el stock es NUMERIC (pg lo devuelve como string).
                const stockAnterior = Number(repuesto.stock_actual);
                const stockNuevo    = Math.round((stockAnterior + Number(item.cantidad_recibida)) * 100) / 100;

                await client.query('UPDATE repuestos SET stock_actual=$1 WHERE id=$2', [stockNuevo, item.repuesto_id]);

                await client.query(
                    `INSERT INTO movimientos_inventario
                        (repuesto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia, origen, area, compra_id, precio_unitario)
                     VALUES ($1,$2,'entrada',$3,$4,$5,$6,$7,'compra',$8,$9,$10)`,
                    [item.repuesto_id, usuario_id, item.cantidad_recibida, stockAnterior, stockNuevo,
                     'Recepcion de compra a proveedor', `COMPRA-${compra.id}`, repuesto.area, compra.id, Number(item.precio_unitario)]
                );

                stockActualizado.push({ item_id: item.id, repuesto_id: item.repuesto_id, repuesto_nombre: repuesto.nombre, cantidad: item.cantidad_recibida, stock_anterior: stockAnterior, stock_nuevo: stockNuevo });
            }
        }

        if (estado === 'cancelada') {
            // Anula el movimiento 'compra' original (generado en crearCompra) para
            // que resumenFinanciero (total_comprado) deje de contarlo, y agrega el
            // registro de cancelacion como entrada separada del historial.
            await client.query(
                `UPDATE movimientos_financieros_proveedor SET estado = 'anulado'
                 WHERE compra_id = $1 AND tipo = 'compra'`,
                [compra.id]
            );
            await client.query(
                `INSERT INTO movimientos_financieros_proveedor
                    (proveedor_id, tipo, compra_id, descripcion, monto, estado, usuario_id)
                 VALUES ($1,'cancelacion',$2,$3,$4,'confirmado',$5)`,
                [compra.proveedor_id, compra.id, `Compra #${compra.id} cancelada`, compra.total, usuario_id]
            );
        }

        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'compra', entidad_id: compra.id, accion: `estado_${estado}`,
            usuario_id, usuario_nombre: req.usuario.nombre,
            detalle: estado === 'recibida'
                ? `Compra #${compra.id} recibida. ${stockActualizado.filter(s => !s.omitido).length} item(s) sumados al inventario.`
                : `Compra #${compra.id} cambio de estado a "${estado}".`,
        });

        return res.json({ compra: rows[0], stock_actualizado: stockActualizado });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error cambiarEstadoCompra:', err);
        return res.status(500).json({ error: 'Error al cambiar el estado de la compra.' });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────
// CANCELAR / ELIMINAR (solo si sigue pendiente)
// DELETE /api/proveedores/compras/:id   (admin)
// ─────────────────────────────────────────────────────────────
const eliminarCompra = async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: compraRows } = await client.query('SELECT estado FROM compras_proveedor WHERE id = $1', [id]);
        if (!compraRows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Compra no encontrada.' });
        }
        if (compraRows[0].estado !== 'pendiente') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Solo se pueden eliminar compras en estado pendiente. Usa el cambio de estado a "cancelada" en su lugar.' });
        }
        // Limpia el movimiento 'compra' que crearCompra genero, para que no
        // siga contando en total_comprado del resumen financiero.
        await client.query('DELETE FROM movimientos_financieros_proveedor WHERE compra_id = $1', [id]);
        await client.query('DELETE FROM compras_proveedor WHERE id = $1', [id]);
        await client.query('COMMIT');
        return res.json({ mensaje: 'Compra eliminada correctamente.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error eliminarCompra:', err);
        return res.status(500).json({ error: 'Error al eliminar la compra.' });
    } finally {
        client.release();
    }
};

module.exports = {
    listarCompras, obtenerCompra, crearCompra, actualizarCompra, cambiarEstadoCompra, eliminarCompra,
};
