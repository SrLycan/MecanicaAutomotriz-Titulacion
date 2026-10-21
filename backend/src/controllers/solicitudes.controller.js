/**
 * SS SWAP - Controlador de Solicitudes de Repuestos (Tienda del Cliente)
 *
 * Permite a los clientes registrados reservar repuestos habilitados para la
 * venta. Las solicitudes actúan como preventa/reserva sin descontar stock
 * físico de inmediato; la salida de stock se registra formalmente mediante
 * el módulo de movimientos cuando el personal despacha la pieza.
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');

// ─────────────────────────────────────────────────────────────
// POST /api/solicitudes/productos   (cliente)
// body: { repuesto_id, cantidad, notas? }
// Reserva simbolica de un repuesto en venta. No descuenta stock: el stock se
// ajusta cuando el taller la atiende (usa el flujo existente de movimientos).
// ─────────────────────────────────────────────────────────────
/** Registra una solicitud de producto para el cliente autenticado validando disponibilidad. */
const crearSolicitud = async (req, res) => {
    const { email, id: usuario_id } = req.usuario;
    const { repuesto_id, cantidad, notas } = req.body;

    const cantidadInt = parseInt(cantidad, 10);
    if (!repuesto_id || !cantidadInt || cantidadInt <= 0)
        return res.status(400).json({ error: 'repuesto_id y una cantidad valida son requeridos.' });

    try {
        const { rows: cliRows } = await pool.query('SELECT id FROM clientes WHERE LOWER(email) = LOWER($1) ORDER BY id LIMIT 1', [email]);
        const cliente = cliRows[0];
        if (!cliente)
            return res.status(409).json({ error: 'Tu cuenta aun no esta vinculada a un cliente del taller. Visita una sucursal para completar tu registro.' });

        const { rows: repRows } = await pool.query(
            `SELECT id, nombre, precio_venta, stock_actual::float8 AS stock_actual FROM repuestos
             WHERE id = $1 AND activo = TRUE AND en_venta = TRUE`,
            [repuesto_id]
        );
        const repuesto = repRows[0];
        if (!repuesto) return res.status(404).json({ error: 'Producto no encontrado o ya no esta disponible.' });
        if (repuesto.stock_actual < cantidadInt)
            return res.status(409).json({ error: `Solo quedan ${repuesto.stock_actual} unidad(es) disponibles.` });

        const { rows } = await pool.query(
            `INSERT INTO solicitudes_producto (cliente_id, usuario_id, repuesto_id, cantidad, precio_unitario, notas)
             VALUES ($1,$2,$3,$4,$5,$6)
             RETURNING *`,
            [cliente.id, usuario_id, repuesto_id, cantidadInt, repuesto.precio_venta, notas || null]
        );
        return res.status(201).json({ solicitud: { ...rows[0], repuesto_nombre: repuesto.nombre } });
    } catch (err) {
        console.error('Error crearSolicitud:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al registrar la solicitud.' });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/solicitudes/mias   (cliente)
// ─────────────────────────────────────────────────────────────
const misSolicitudes = async (req, res) => {
    const { email } = req.usuario;
    try {
        const { rows: cliRows } = await pool.query('SELECT id FROM clientes WHERE LOWER(email) = LOWER($1) ORDER BY id LIMIT 1', [email]);
        const cliente = cliRows[0];
        if (!cliente) return res.json({ solicitudes: [] });

        const { rows } = await pool.query(
            `SELECT sp.id, sp.cantidad, sp.precio_unitario, sp.estado, sp.notas, sp.created_at, sp.motivo_cancelacion, sp.atendida_at,
                    r.nombre AS repuesto_nombre, r.codigo AS repuesto_codigo, r.imagen_url, r.unidad_medida
             FROM solicitudes_producto sp
             JOIN repuestos r ON r.id = sp.repuesto_id
             WHERE sp.cliente_id = $1
             ORDER BY sp.created_at DESC`,
            [cliente.id]
        );
        return res.json({ solicitudes: rows });
    } catch (err) {
        console.error('Error misSolicitudes:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener tus solicitudes.' });
    }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/solicitudes/productos/:id/cancelar   (cliente, solo propias)
// ─────────────────────────────────────────────────────────────
const cancelarSolicitud = async (req, res) => {
    const { id } = req.params;
    const { email } = req.usuario;
    try {
        const { rows } = await pool.query(
            `UPDATE solicitudes_producto SET estado = 'cancelada'
             WHERE id = $1 AND estado = 'pendiente'
               AND cliente_id = (SELECT id FROM clientes WHERE LOWER(email) = LOWER($2) ORDER BY id LIMIT 1)
             RETURNING *`,
            [id, email]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Solicitud no encontrada o ya no se puede cancelar.' });
        return res.json({ solicitud: rows[0] });
    } catch (err) {
        console.error('Error cancelarSolicitud:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al cancelar la solicitud.' });
    }
};

// ═════════════════════════════════════════════════════════════
// LADO DEL PERSONAL (Sprint 18): ver y atender los pedidos.
// ═════════════════════════════════════════════════════════════

// GET /api/solicitudes?estado=pendiente&q=&page=&limit=   (staff)
const listarSolicitudes = async (req, res) => {
    const { estado, q, page = 1, limit = 25 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 25));
    const params = [];
    let where = 'WHERE 1=1';
    if (['pendiente', 'atendida', 'cancelada'].includes(estado)) { params.push(estado); where += ` AND sp.estado = $${params.length}`; }
    if (q) { params.push(`%${q}%`); where += ` AND (c.nombre ILIKE $${params.length} OR r.nombre ILIKE $${params.length} OR r.codigo ILIKE $${params.length})`; }
    try {
        const [{ rows: tot }, { rows }, { rows: cont }] = await Promise.all([
            pool.query(`SELECT COUNT(*) AS total FROM solicitudes_producto sp JOIN clientes c ON c.id = sp.cliente_id JOIN repuestos r ON r.id = sp.repuesto_id ${where}`, params),
            pool.query(
                `SELECT sp.*, (sp.cantidad * sp.precio_unitario) AS total,
                        c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email,
                        r.nombre AS repuesto_nombre, r.codigo AS repuesto_codigo, r.unidad_medida,
                        r.stock_actual::float8 AS stock_actual, r.activo AS repuesto_activo,
                        u.nombre AS atendida_por_nombre
                 FROM solicitudes_producto sp
                 JOIN clientes c ON c.id = sp.cliente_id
                 JOIN repuestos r ON r.id = sp.repuesto_id
                 LEFT JOIN usuarios u ON u.id = sp.atendida_por
                 ${where}
                 ORDER BY (sp.estado = 'pendiente') DESC, sp.created_at DESC
                 LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
                [...params, limitNum, (pageNum - 1) * limitNum]),
            pool.query(`SELECT estado, COUNT(*) AS n FROM solicitudes_producto GROUP BY estado`),
        ]);
        const conteo = Object.fromEntries(cont.map(x => [x.estado, Number(x.n)]));
        return res.json({ solicitudes: rows, total: parseInt(tot[0].total, 10), page: pageNum, limit: limitNum, conteo });
    } catch (err) {
        console.error('Error listarSolicitudes:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener los pedidos.' });
    }
};

/**
 * PATCH /api/solicitudes/:id/atender   (staff)
 * body: { cobrado: boolean, metodo_pago?: 'efectivo'|'transferencia'|... }
 * Entrega el pedido: descuenta el stock (movimiento de salida origen 'venta')
 * y, si se cobro, registra el ingreso en Finanzas. Todo en una transaccion.
 */
const atenderSolicitud = async (req, res) => {
    const { id } = req.params;
    const { cobrado = false, metodo_pago = 'efectivo' } = req.body || {};
    const usuarioId = req.usuario.id;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows: sRows } = await client.query(
            `SELECT sp.*, c.nombre AS cliente_nombre FROM solicitudes_producto sp
             JOIN clientes c ON c.id = sp.cliente_id WHERE sp.id = $1 FOR UPDATE OF sp`, [id]);
        const sol = sRows[0];
        if (!sol) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pedido no encontrado.' }); }
        if (sol.estado !== 'pendiente') { await client.query('ROLLBACK'); return res.status(409).json({ error: `Este pedido ya esta ${sol.estado}.` }); }

        const { rows: rRows } = await client.query('SELECT id, nombre, codigo, stock_actual, area, activo FROM repuestos WHERE id = $1 FOR UPDATE', [sol.repuesto_id]);
        const rep = rRows[0];
        const stockAnterior = Number(rep.stock_actual);
        if (!rep.activo) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'El producto ya no esta activo en el inventario.' }); }
        if (stockAnterior < sol.cantidad) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `Stock insuficiente: hay ${stockAnterior} de ${rep.nombre} y el pedido es de ${sol.cantidad}.` });
        }
        const stockNuevo = Math.round((stockAnterior - sol.cantidad) * 100) / 100;
        await client.query('UPDATE repuestos SET stock_actual = $1 WHERE id = $2', [stockNuevo, rep.id]);
        const { rows: mov } = await client.query(
            `INSERT INTO movimientos_inventario (repuesto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia, origen, area, precio_unitario)
             VALUES ($1,$2,'salida',$3,$4,$5,$6,$7,'venta',$8,$9) RETURNING id`,
            [rep.id, usuarioId, sol.cantidad, stockAnterior, stockNuevo, `Venta a ${sol.cliente_nombre} (pedido de la tienda)`, `PEDIDO-${sol.id}`, rep.area, sol.precio_unitario]
        );

        let cobroId = null;
        if (cobrado) {
            const total = Math.round(Number(sol.cantidad) * Number(sol.precio_unitario) * 100) / 100;
            if (total > 0) {
                const { rows: cob } = await client.query(
                    `INSERT INTO movimientos_dinero (tipo, categoria, monto, cuenta_dinero_id, metodo_pago, descripcion, referencia, usuario_id)
                     VALUES ('ingreso', 'venta_repuestos', $1, cuenta_dinero_por_metodo($2), $2, $3, $4, $5) RETURNING id`,
                    [total, metodo_pago, `Venta: ${sol.cantidad} x ${rep.nombre} a ${sol.cliente_nombre}`, `PEDIDO-${sol.id}`, usuarioId]
                );
                cobroId = cob[0].id;
            }
        }

        const { rows } = await client.query(
            `UPDATE solicitudes_producto SET estado = 'atendida', atendida_por = $1, atendida_at = NOW(), movimiento_id = $2, cobro_id = $3
             WHERE id = $4 RETURNING *`,
            [usuarioId, mov[0].id, cobroId, id]
        );
        await client.query('COMMIT');
        return res.json({ solicitud: rows[0], stock_nuevo: stockNuevo, cobrado: Boolean(cobroId) });
    } catch (err) {
        await client?.query('ROLLBACK').catch(() => {});
        console.error('Error atenderSolicitud:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al atender el pedido.' });
    } finally { client?.release(); }
};

// PATCH /api/solicitudes/:id/cancelar   (staff) body: { motivo }
const cancelarSolicitudStaff = async (req, res) => {
    const motivo = req.body?.motivo?.trim();
    if (!motivo) return res.status(400).json({ error: 'Indica el motivo de la cancelacion (el cliente lo vera).' });
    try {
        const { rows } = await pool.query(
            `UPDATE solicitudes_producto SET estado = 'cancelada', motivo_cancelacion = $1, atendida_por = $2, atendida_at = NOW()
             WHERE id = $3 AND estado = 'pendiente' RETURNING *`,
            [motivo.slice(0, 255), req.usuario.id, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado o ya no esta pendiente.' });
        return res.json({ solicitud: rows[0] });
    } catch (err) {
        console.error('Error cancelarSolicitudStaff:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al cancelar el pedido.' });
    }
};

module.exports = {
    crearSolicitud, misSolicitudes, cancelarSolicitud,
    listarSolicitudes, atenderSolicitud, cancelarSolicitudStaff,
};
