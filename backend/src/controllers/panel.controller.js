const pool = require('../config/db');

/**
 * GET /api/panel/mi-actividad
 * Devuelve órdenes, movimientos de inventario relacionados y repuestos en venta
 * del cliente autenticado. Vincula usuario → cliente por email.
 */
const miActividad = async (req, res) => {
    const { id: usuario_id, email } = req.usuario;

    try {
        // 1. Buscar el cliente vinculado al email del usuario
        const { rows: clienteRows } = await pool.query(
            'SELECT id FROM clientes WHERE email = $1 LIMIT 1',
            [email]
        );
        const cliente = clienteRows[0] || null;

        let ordenes     = [];
        let vehiculos   = [];

        if (cliente) {
            // 2. Órdenes de trabajo del cliente
            const { rows: ordenRows } = await pool.query(
                `SELECT o.id, o.estado, o.estado_progreso, o.descripcion, o.diagnostico,
                        o.kilometraje, o.fecha_ingreso, o.fecha_salida,
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
                    r.stock_actual, r.unidad_medida, r.imagen_url,
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
        return res.status(500).json({ error: 'Error al obtener actividad.' });
    }
};

module.exports = { miActividad };
