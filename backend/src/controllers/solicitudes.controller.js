/**
 * SS SWAP - Controlador de Solicitudes de Repuestos (Tienda del Cliente)
 *
 * Permite a los clientes registrados reservar repuestos habilitados para la
 * venta. Las solicitudes actúan como preventa/reserva sin descontar stock
 * físico de inmediato; la salida de stock se registra formalmente mediante
 * el módulo de movimientos cuando el personal despacha la pieza.
 */
const pool = require('../config/db');

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
        const { rows: cliRows } = await pool.query('SELECT id FROM clientes WHERE email = $1', [email]);
        const cliente = cliRows[0];
        if (!cliente)
            return res.status(409).json({ error: 'Tu cuenta aun no esta vinculada a un cliente del taller. Visita una sucursal para completar tu registro.' });

        const { rows: repRows } = await pool.query(
            `SELECT id, nombre, precio_venta, stock_actual FROM repuestos
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
        return res.status(500).json({ error: 'Error al registrar la solicitud.' });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/solicitudes/mias   (cliente)
// ─────────────────────────────────────────────────────────────
const misSolicitudes = async (req, res) => {
    const { email } = req.usuario;
    try {
        const { rows: cliRows } = await pool.query('SELECT id FROM clientes WHERE email = $1', [email]);
        const cliente = cliRows[0];
        if (!cliente) return res.json({ solicitudes: [] });

        const { rows } = await pool.query(
            `SELECT sp.id, sp.cantidad, sp.precio_unitario, sp.estado, sp.notas, sp.created_at,
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
               AND cliente_id = (SELECT id FROM clientes WHERE email = $2)
             RETURNING *`,
            [id, email]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Solicitud no encontrada o ya no se puede cancelar.' });
        return res.json({ solicitud: rows[0] });
    } catch (err) {
        console.error('Error cancelarSolicitud:', err);
        return res.status(500).json({ error: 'Error al cancelar la solicitud.' });
    }
};

module.exports = { crearSolicitud, misSolicitudes, cancelarSolicitud };
