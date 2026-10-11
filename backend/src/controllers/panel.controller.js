/**
 * SS SWAP - Controlador del Portal / Panel de Clientes
 *
 * Consolida en una sola carga optimizada el perfil del cliente, sus vehículos
 * registrados, el historial de órdenes y el catálogo de repuestos en venta.
 * Expone además los historiales personales del cliente que viven en
 * MongoDB Atlas (progresión de órdenes y conversaciones con SWAPBot).
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { obtenerHistorialPorOrden }   = require('../services/ordenesHistorial.service');
const { obtenerHistorialPorCliente } = require('../services/chatbotConversacion.service');

/**
 * GET /api/panel/mi-actividad
 * Consulta agregada de actividad del cliente autenticado: órdenes, vehículos
 * y repuestos en venta. Vincula usuario → cliente por email.
 */
const miActividad = async (req, res) => {
    const { id: usuario_id, email } = req.usuario;

    try {
        // 1. Buscar el cliente vinculado al email del usuario
        const { rows: clienteRows } = await pool.query(
            'SELECT id FROM clientes WHERE LOWER(email) = LOWER($1) ORDER BY id LIMIT 1',
            [email]
        );
        const cliente = clienteRows[0] || null;

        let ordenes     = [];
        let vehiculos   = [];

        if (cliente) {
            // 2. Órdenes de trabajo del cliente
            const { rows: ordenRows } = await pool.query(
                `SELECT o.id, o.estado, o.estado_progreso, o.descripcion, o.diagnostico,
                        o.kilometraje, o.fecha_ingreso, o.fecha_salida, o.updated_at,
                        v.placa, v.marca, v.modelo, v.anio, v.color,
                        u.nombre AS tecnico_nombre
                 FROM ordenes_trabajo o
                 LEFT JOIN vehiculos  v ON v.id = o.vehiculo_id
                 LEFT JOIN usuarios   u ON u.id = o.tecnico_id
                 WHERE o.cliente_id = $1
                 ORDER BY o.created_at DESC
                 LIMIT 50`,
                [cliente.id]
            );
            ordenes = ordenRows;

            // 3. Vehículos del cliente
            const { rows: vehRows } = await pool.query(
                `SELECT * FROM vehiculos WHERE cliente_id = $1 ORDER BY created_at DESC`,
                [cliente.id]
            );
            vehiculos = vehRows;
        }

        // 4. Repuestos disponibles para venta al público
        const { rows: repuestosVenta } = await pool.query(
            `SELECT r.id, r.codigo, r.nombre, r.descripcion, r.precio_venta,
                    r.stock_actual::float8 AS stock_actual, r.unidad_medida, r.imagen_url,
                    c.nombre AS categoria_nombre
             FROM repuestos r
             LEFT JOIN categorias_repuesto c ON c.id = r.categoria_id
             WHERE r.activo = TRUE AND r.en_venta = TRUE AND r.stock_actual > 0
             ORDER BY r.nombre ASC`
        );

        return res.json({
            cliente,
            ordenes,
            vehiculos,
            repuestosVenta,
        });
    } catch (err) {
        console.error('Error miActividad:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener actividad.' });
    }
};

/**
 * GET /api/panel/ordenes/:id/historial
 * Historial de progreso de UNA orden del cliente autenticado (MongoDB Atlas).
 * Verifica que la orden pertenezca al cliente antes de devolver nada:
 * nunca se expone la bitácora de una orden ajena.
 */
const miHistorialOrden = async (req, res) => {
    const { id } = req.params;
    const { email } = req.usuario;

    try {
        const { rows: clienteRows } = await pool.query('SELECT id FROM clientes WHERE LOWER(email) = LOWER($1) ORDER BY id LIMIT 1', [email]);
        const cliente = clienteRows[0];
        if (!cliente) return res.status(404).json({ error: 'No se encontro un cliente vinculado a esta cuenta.' });

        const { rows: ordenRows } = await pool.query(
            'SELECT id FROM ordenes_trabajo WHERE id = $1 AND cliente_id = $2',
            [id, cliente.id]
        );
        if (!ordenRows[0]) return res.status(404).json({ error: 'Orden no encontrada.' });

        const historial = await obtenerHistorialPorOrden(id);
        return res.json({ historial });
    } catch (err) {
        console.error('Error miHistorialOrden:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener el historial de la orden.' });
    }
};

/**
 * GET /api/panel/chatbot-historial
 * Historial de conversaciones previas del cliente autenticado con SWAPBot
 * (Mongo Atlas). Vincula usuario -> cliente por email, igual que miActividad.
 */
const miHistorialChat = async (req, res) => {
    const { email } = req.usuario;

    try {
        const { rows: clienteRows } = await pool.query('SELECT id FROM clientes WHERE LOWER(email) = LOWER($1) ORDER BY id LIMIT 1', [email]);
        const cliente = clienteRows[0];
        if (!cliente) return res.json({ conversaciones: [] });

        const conversaciones = await obtenerHistorialPorCliente(cliente.id);
        return res.json({ conversaciones });
    } catch (err) {
        console.error('Error miHistorialChat:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener el historial de conversaciones.' });
    }
};

module.exports = { miActividad, miHistorialOrden, miHistorialChat };
