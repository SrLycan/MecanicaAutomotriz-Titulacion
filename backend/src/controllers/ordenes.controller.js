/**
 * SS SWAP - Controlador de Gestión de Órdenes de Trabajo, Clientes y Vehículos
 *
 * Modela el ciclo operativo del taller automotriz:
 * - Registro y vinculación relacional de Clientes y Vehículos.
 * - Ciclo de vida de Órdenes con doble dimensionamiento de estado:
 *   1. 'estado' (Administrativo): pendiente, en_progreso, completado, cancelado.
 *   2. 'estado_progreso' (Técnico/Mecánico): en_revision, deteccion_falla,
 *      en_reparacion, esperando_repuestos, pruebas_finales, listo_entrega.
 * - Control de acceso basado en roles (el técnico solo edita órdenes asignadas).
 * - Trazabilidad y auditoría de cambios persistida en MongoDB Atlas
 *   (ver services/ordenesHistorial.service.js).
 */
const pool = require('../config/db');
const {
    registrarHistorial, obtenerHistorialPorOrden,
    listarHistorialGeneral: listarHistorialGeneralService,
} = require('../services/ordenesHistorial.service');

const ESTADOS_ORDEN = ['pendiente', 'en_progreso', 'completado', 'cancelado'];
const ESTADOS_PROGRESO = [
    'en_revision', 'deteccion_falla', 'en_reparacion',
    'esperando_repuestos', 'pruebas_finales', 'listo_entrega',
];

const validarDatosCliente = ({ nombre, email, telefono, cedula }) => {
    if (!nombre?.trim()) return 'El nombre es obligatorio.';
    if (!cedula?.trim()) return 'La cedula es obligatoria.';
    if (!telefono?.trim() && !email?.trim()) return 'Debe indicar telefono o email.';
    return null;
};

// ═══════════════════════════════════════════════════════════════
// CLIENTES
// ═══════════════════════════════════════════════════════════════

/**
 * Lista clientes con opción de búsqueda por texto (nombre, cédula, teléfono, email)
 * e indica si el cliente posee una cuenta de acceso al portal web vinculada.
 */
const listarClientes = async (req, res) => {
    const { q, page, limit } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (q) {
        params.push(`%${q}%`);
        where += ` AND (c.nombre ILIKE $${params.length} OR c.cedula ILIKE $${params.length} OR c.telefono ILIKE $${params.length} OR c.email ILIKE $${params.length})`;
    }

    const countQuery = `SELECT COUNT(*) AS total FROM clientes c ${where}`;
    let dataQuery = `
        SELECT c.*,
               (u.id IS NOT NULL) AS cuenta_web
        FROM clientes c
        LEFT JOIN usuarios u ON LOWER(u.email) = LOWER(c.email) AND u.rol = 'cliente'
        ${where}
        ORDER BY c.nombre ASC
    `;

    const statsQuery = `
        SELECT
            COUNT(*)                                                               AS total,
            COUNT(*) FILTER (WHERE telefono IS NOT NULL AND TRIM(telefono) <> '')  AS con_telefono,
            COUNT(*) FILTER (WHERE email IS NOT NULL AND TRIM(email) <> '')        AS con_email
        FROM clientes
    `;

    try {
        if (page !== undefined || limit !== undefined) {
            const pageNum  = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
            const offset   = (pageNum - 1) * limitNum;

            dataQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

            const [{ rows: countRows }, { rows }, { rows: statsRows }] = await Promise.all([
                pool.query(countQuery, params),
                pool.query(dataQuery, [...params, limitNum, offset]),
                pool.query(statsQuery),
            ]);

            const total = parseInt(countRows[0].total, 10);
            const st = statsRows[0] || {};
            return res.json({
                clientes: rows,
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum) || 1,
                stats: {
                    total: parseInt(st.total, 10) || 0,
                    conTelefono: parseInt(st.con_telefono, 10) || 0,
                    conEmail: parseInt(st.con_email, 10) || 0,
                },
            });
        }

        const [{ rows: countRows }, { rows }, { rows: statsRows }] = await Promise.all([
            pool.query(countQuery, params),
            pool.query(dataQuery, params),
            pool.query(statsQuery),
        ]);

        const total = parseInt(countRows[0]?.total, 10) || rows.length;
        const st = statsRows[0] || {};
        return res.json({
            clientes: rows,
            total,
            page: 1,
            limit: total,
            totalPages: 1,
            stats: {
                total: parseInt(st.total, 10) || 0,
                conTelefono: parseInt(st.con_telefono, 10) || 0,
                conEmail: parseInt(st.con_email, 10) || 0,
            },
        });
    } catch (err) {
        console.error('Error listarClientes:', err);
        return res.status(500).json({ error: 'Error al obtener clientes.' });
    }
};

/**
 * Obtiene el detalle de un cliente específico junto a sus vehículos registrados
 * y sus órdenes de trabajo.
 */
const obtenerCliente = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM clientes WHERE id = $1', [id]);
        if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado.' });

        let cuenta_web = false;
        if (rows[0].email) {
            const { rows: vinculo } = await pool.query(
                `SELECT u.id FROM usuarios u
                 WHERE LOWER(u.email) = LOWER($1) AND u.rol = 'cliente' LIMIT 1`,
                [rows[0].email]
            );
            cuenta_web = vinculo.length > 0;
        }

        const { rows: vehiculos } = await pool.query(
            'SELECT * FROM vehiculos WHERE cliente_id = $1 ORDER BY created_at DESC', [id]
        );
        const { rows: ordenes } = await pool.query(`
            SELECT o.*, v.placa, v.marca, v.modelo, u.nombre AS usuario_nombre
            FROM ordenes_trabajo o
            LEFT JOIN vehiculos v ON v.id = o.vehiculo_id
            JOIN usuarios u ON u.id = o.usuario_id
            WHERE o.cliente_id = $1
            ORDER BY o.created_at DESC`, [id]
        );

        return res.json({
            cliente: { ...rows[0], cuenta_web },
            vehiculos,
            ordenes,
        });
    } catch (err) {
        console.error('Error obtenerCliente:', err);
        return res.status(500).json({ error: 'Error al obtener cliente.' });
    }
};

/**
 * Registra un nuevo cliente en el taller validando unicidad de cédula.
 */
const crearCliente = async (req, res) => {
    const { nombre, email, telefono, cedula, direccion } = req.body;
    const errVal = validarDatosCliente({ nombre, email, telefono, cedula });
    if (errVal) return res.status(400).json({ error: errVal });
    try {
        if (cedula) {
            const { rows: dup } = await pool.query('SELECT id FROM clientes WHERE cedula = $1', [cedula]);
            if (dup.length > 0) return res.status(409).json({ error: 'Ya existe un cliente con esa cedula.' });
        }
        const { rows } = await pool.query(
            `INSERT INTO clientes (nombre, email, telefono, cedula, direccion)
             VALUES ($1,$2,$3,$4,$5) RETURNING *`,
            [nombre.trim(), email || null, telefono || null, cedula || null, direccion || null]
        );
        return res.status(201).json({ cliente: rows[0] });
    } catch (err) {
        console.error('Error crearCliente:', err);
        return res.status(500).json({ error: 'Error al crear cliente.' });
    }
};

/**
 * Elimina un cliente y sus registros relacionados en cascada.
 */
const eliminarCliente = async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM clientes WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Cliente no encontrado.' });
        return res.json({ ok: true });
    } catch (err) {
        console.error('Error eliminarCliente:', err);
        return res.status(500).json({ error: 'Error al eliminar cliente.' });
    }
};

/**
 * Actualiza los datos de contacto y filiación de un cliente.
 */
const actualizarCliente = async (req, res) => {
    const { id } = req.params;
    const { nombre, email, telefono, cedula, direccion } = req.body;
    const errVal = validarDatosCliente({ nombre, email, telefono, cedula });
    if (errVal) return res.status(400).json({ error: errVal });
    try {
        if (cedula) {
            const { rows: dup } = await pool.query(
                'SELECT id FROM clientes WHERE cedula = $1 AND id != $2', [cedula, id]
            );
            if (dup.length > 0) return res.status(409).json({ error: 'Ya existe otro cliente con esa cedula.' });
        }
        const { rows } = await pool.query(
            `UPDATE clientes SET nombre=$1, email=$2, telefono=$3, cedula=$4, direccion=$5 WHERE id=$6 RETURNING *`,
            [nombre.trim(), email || null, telefono || null, cedula || null, direccion || null, id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado.' });
        return res.json({ cliente: rows[0] });
    } catch (err) {
        console.error('Error actualizarCliente:', err);
        return res.status(500).json({ error: 'Error al actualizar cliente.' });
    }
};

// ═══════════════════════════════════════════════════════════════
// VEHICULOS
// ═══════════════════════════════════════════════════════════════

/**
 * Consulta vehículos registrados, permitiendo filtrar por cliente específico
 * o búsqueda por placa/marca.
 */
const listarVehiculos = async (req, res) => {
    const { cliente_id, q, page, limit } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (cliente_id) {
        params.push(cliente_id);
        where += ` AND v.cliente_id = $${params.length}`;
    }
    if (q) {
        params.push(`%${q}%`);
        where += ` AND (v.placa ILIKE $${params.length} OR v.marca ILIKE $${params.length} OR v.modelo ILIKE $${params.length} OR c.nombre ILIKE $${params.length})`;
    }

    const countQuery = `
        SELECT COUNT(*) AS total
        FROM vehiculos v
        JOIN clientes c ON c.id = v.cliente_id
        ${where}
    `;

    let dataQuery = `
        SELECT v.*, c.nombre AS cliente_nombre
        FROM vehiculos v
        JOIN clientes c ON c.id = v.cliente_id
        ${where}
        ORDER BY v.created_at DESC
    `;

    const statsQuery = `
        SELECT
            COUNT(*)                    AS total_vehiculos,
            COUNT(DISTINCT cliente_id)  AS total_clientes
        FROM vehiculos
    `;

    try {
        if (page !== undefined || limit !== undefined) {
            const pageNum  = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
            const offset   = (pageNum - 1) * limitNum;

            dataQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

            const [{ rows: countRows }, { rows }, { rows: statsRows }] = await Promise.all([
                pool.query(countQuery, params),
                pool.query(dataQuery, [...params, limitNum, offset]),
                pool.query(statsQuery),
            ]);

            const total = parseInt(countRows[0].total, 10);
            const st = statsRows[0] || {};
            return res.json({
                vehiculos: rows,
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum) || 1,
                stats: {
                    totalVehiculos: parseInt(st.total_vehiculos, 10) || 0,
                    totalClientes:  parseInt(st.total_clientes, 10) || 0,
                },
            });
        }

        const [{ rows: countRows }, { rows }, { rows: statsRows }] = await Promise.all([
            pool.query(countQuery, params),
            pool.query(dataQuery, params),
            pool.query(statsQuery),
        ]);

        const total = parseInt(countRows[0]?.total, 10) || rows.length;
        const st = statsRows[0] || {};
        return res.json({
            vehiculos: rows,
            total,
            page: 1,
            limit: total,
            totalPages: 1,
            stats: {
                totalVehiculos: parseInt(st.total_vehiculos, 10) || 0,
                totalClientes:  parseInt(st.total_clientes, 10) || 0,
            },
        });
    } catch (err) {
        console.error('Error listarVehiculos:', err);
        return res.status(500).json({ error: 'Error al obtener vehiculos.' });
    }
};

/**
 * Registra un nuevo vehículo asociado a la ficha de un cliente.
 */
const crearVehiculo = async (req, res) => {
    const { cliente_id, placa, marca, modelo, anio, color, vin } = req.body;
    if (!cliente_id || !placa || !marca) {
        return res.status(400).json({ error: 'cliente_id, placa y marca son obligatorios.' });
    }
    try {
        const { rows } = await pool.query(
            `INSERT INTO vehiculos (cliente_id, placa, marca, modelo, anio, color, vin)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [cliente_id, placa.trim().toUpperCase(), marca.trim(),
             modelo || null, anio || null, color || null, vin || null]
        );
        return res.status(201).json({ vehiculo: rows[0] });
    } catch (err) {
        console.error('Error crearVehiculo:', err);
        return res.status(500).json({ error: 'Error al crear vehiculo.' });
    }
};

/**
 * Actualiza la información técnica de un vehículo existente.
 */
const actualizarVehiculo = async (req, res) => {
    const { id } = req.params;
    const { placa, marca, modelo, anio, color, vin } = req.body;
    try {
        const { rows } = await pool.query(
            `UPDATE vehiculos SET placa=$1, marca=$2, modelo=$3, anio=$4, color=$5, vin=$6
             WHERE id=$7 RETURNING *`,
            [placa?.trim().toUpperCase(), marca?.trim(), modelo || null,
             anio || null, color || null, vin || null, id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Vehiculo no encontrado.' });
        return res.json({ vehiculo: rows[0] });
    } catch (err) {
        console.error('Error actualizarVehiculo:', err);
        return res.status(500).json({ error: 'Error al actualizar vehiculo.' });
    }
};

/**
 * Elimina un vehículo registrado del sistema.
 */
const eliminarVehiculo = async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM vehiculos WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Vehiculo no encontrado.' });
        return res.json({ ok: true });
    } catch (err) {
        console.error('Error eliminarVehiculo:', err);
        return res.status(500).json({ error: 'Error al eliminar vehiculo.' });
    }
};

// ═══════════════════════════════════════════════════════════════
// ORDENES DE TRABAJO
// ═══════════════════════════════════════════════════════════════

/**
 * Lista órdenes de trabajo con filtros por estado administrativo, grupo
 * (activas/anteriores), cliente o búsqueda por texto.
 */
const listarOrdenes = async (req, res) => {
    const { estado, grupo, cliente_id, q, page, limit } = req.query;
    let where = 'WHERE 1=1';
    const params = [];
    if (grupo === 'anteriores') {
        where += ` AND o.estado IN ('completado', 'cancelado')`;
    } else if (estado) {
        params.push(estado);
        where += ` AND o.estado = $${params.length}`;
    }
    if (cliente_id) {
        params.push(cliente_id);
        where += ` AND o.cliente_id = $${params.length}`;
    }
    if (q) {
        params.push(`%${q}%`);
        where += ` AND (c.nombre ILIKE $${params.length} OR v.placa ILIKE $${params.length} OR o.descripcion ILIKE $${params.length})`;
    }

    const countQuery = `
        SELECT COUNT(*) AS total
        FROM ordenes_trabajo o
        JOIN clientes  c ON c.id = o.cliente_id
        LEFT JOIN vehiculos v ON v.id = o.vehiculo_id
        JOIN usuarios  u ON u.id = o.usuario_id
        LEFT JOIN usuarios t ON t.id = o.tecnico_id
        ${where}
    `;

    let dataQuery = `
        SELECT o.*,
               c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
               v.placa, v.marca, v.modelo, v.anio, v.color,
               u.nombre AS usuario_nombre,
               t.nombre AS tecnico_nombre
        FROM ordenes_trabajo o
        JOIN clientes  c ON c.id = o.cliente_id
        LEFT JOIN vehiculos v ON v.id = o.vehiculo_id
        JOIN usuarios  u ON u.id = o.usuario_id
        LEFT JOIN usuarios t ON t.id = o.tecnico_id
        ${where}
        ORDER BY o.created_at DESC
    `;

    try {
        if (page !== undefined || limit !== undefined) {
            const pageNum  = Math.max(1, parseInt(page) || 1);
            const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
            const offset   = (pageNum - 1) * limitNum;

            dataQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

            const [{ rows: countRows }, { rows }] = await Promise.all([
                pool.query(countQuery, params),
                pool.query(dataQuery, [...params, limitNum, offset]),
            ]);

            const total = parseInt(countRows[0].total, 10);
            return res.json({
                ordenes: rows,
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum) || 1,
            });
        }

        const [{ rows: countRows }, { rows }] = await Promise.all([
            pool.query(countQuery, params),
            pool.query(dataQuery, params),
        ]);

        const total = parseInt(countRows[0]?.total, 10) || rows.length;
        return res.json({
            ordenes: rows,
            total,
            page: 1,
            limit: total,
            totalPages: 1,
        });
    } catch (err) {
        console.error('Error listarOrdenes:', err);
        return res.status(500).json({ error: 'Error al obtener ordenes.' });
    }
};

/**
 * Obtiene el detalle completo de una orden de trabajo
 * (cliente, vehículo, técnico asignado y recepción).
 */
const obtenerOrden = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(`
            SELECT o.*,
                   c.nombre AS cliente_nombre, c.email AS cliente_email,
                   c.telefono AS cliente_telefono, c.cedula AS cliente_cedula,
                   c.direccion AS cliente_direccion,
                   v.placa, v.marca, v.modelo, v.anio, v.color, v.vin,
                   u.nombre AS usuario_nombre,
                   t.nombre AS tecnico_nombre
            FROM ordenes_trabajo o
            JOIN clientes  c ON c.id = o.cliente_id
            LEFT JOIN vehiculos v ON v.id = o.vehiculo_id
            JOIN usuarios  u ON u.id = o.usuario_id
            LEFT JOIN usuarios t ON t.id = o.tecnico_id
            WHERE o.id = $1`, [id]);
        if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada.' });
        return res.json(rows[0]);
    } catch (err) {
        console.error('Error obtenerOrden:', err);
        return res.status(500).json({ error: 'Error al obtener orden.' });
    }
};

/**
 * Crea una orden de trabajo y registra la primera entrada en la bitácora de auditoría.
 * Solo administradores y recepcionistas pueden asignar técnico en el momento de creación.
 */
const crearOrden = async (req, res) => {
    const { cliente_id, vehiculo_id, descripcion, diagnostico, kilometraje, tecnico_id } = req.body;
    const usuario_id = req.usuario.id;
    const rol = req.usuario?.rol;

    if (!cliente_id || !descripcion) {
        return res.status(400).json({ error: 'cliente_id y descripcion son obligatorios.' });
    }

    // Solo admin y recepcionista pueden asignar tecnico al crear
    const puedeAsignar = ['administrador', 'recepcionista'].includes(rol);
    const tecnicoFinal = puedeAsignar ? (tecnico_id || null) : null;

    try {
        const { rows } = await pool.query(
            `INSERT INTO ordenes_trabajo (cliente_id, vehiculo_id, usuario_id, descripcion, diagnostico, kilometraje, tecnico_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [cliente_id, vehiculo_id || null, usuario_id, descripcion.trim(),
             diagnostico || null, kilometraje || null, tecnicoFinal]
        );
        registrarHistorial({
            orden_id: rows[0].id,
            estado_nuevo: rows[0].estado,
            usuario_id,
            usuario_nombre: req.usuario?.nombre || null,
            notas: 'Orden creada.',
        }); // fire-and-forget: no bloquea la respuesta si Mongo falla
        return res.status(201).json({ orden: rows[0] });
    } catch (err) {
        console.error('Error crearOrden:', err);
        return res.status(500).json({ error: 'Error al crear orden de trabajo.' });
    }
};

/**
 * Actualiza los datos o el estado de una orden.
 * Aplica reglas de negocio y control de acceso:
 * - Técnicos solo pueden modificar órdenes que tengan asignadas.
 * - Administradores poseen control total.
 * - Recepción no puede cambiar estados técnicos/mecánicos.
 * - Registra cambios de estado y notas en el historial de auditoría (MongoDB).
 */
const actualizarOrden = async (req, res) => {
    const { id } = req.params;
    let {
        estado, descripcion, diagnostico, kilometraje, vehiculo_id,
        fecha_salida, estado_progreso, notas_progreso, tecnico_id,
    } = req.body;
    const rol = req.usuario?.rol;
    const usuarioId = req.usuario?.id;

    if (estado && !ESTADOS_ORDEN.includes(estado)) {
        return res.status(400).json({ error: `Estado invalido. Validos: ${ESTADOS_ORDEN.join(', ')}.` });
    }
    if (estado_progreso && !ESTADOS_PROGRESO.includes(estado_progreso)) {
        return res.status(400).json({ error: `Progreso invalido. Validos: ${ESTADOS_PROGRESO.join(', ')}.` });
    }

    // Obtener la orden actual para validar permisos
    const { rows: ordenRows } = await pool.query('SELECT * FROM ordenes_trabajo WHERE id = $1', [id]);
    if (!ordenRows[0]) return res.status(404).json({ error: 'Orden no encontrada.' });
    const ordenActual = ordenRows[0];

    // IMPORTANTE: 'estado' (pendiente/en_progreso/completado/cancelado) y
    // 'estado_progreso' (en_revision...listo_entrega) son independientes.
    // Aunque el progreso llegue a 'listo_entrega', el estado de la orden NO
    // cambia aqui — solo cambia si el body trae "estado" explicitamente
    // (accion "Marcar entregado" en el frontend). El UPDATE de abajo usa
    // COALESCE precisamente para respetar esto: si "estado" no viene en el
    // body, la columna se queda como estaba, sin importar el progreso.
    const cambiaEstado = estado !== undefined || estado_progreso !== undefined || notas_progreso !== undefined;

    if (cambiaEstado) {
        if (rol === 'administrador') {
            // El admin puede cambiar cualquier estado sin restriccion
        } else if (rol === 'tecnico') {
            // El tecnico solo puede actualizar si es el tecnico asignado
            if (ordenActual.tecnico_id !== usuarioId) {
                return res.status(403).json({ error: 'Solo el tecnico asignado puede actualizar el estado de esta orden.' });
            }
        } else {
            // Recepcionista y otros no pueden cambiar estado
            return res.status(403).json({ error: 'No tienes permiso para cambiar el estado de la orden.' });
        }
    }

    // Solo admin y recepcionista pueden asignar/cambiar el tecnico
    const puedeAsignar = ['administrador', 'recepcionista'].includes(rol);
    const tecnicoFinal = tecnico_id !== undefined
        ? (puedeAsignar ? (tecnico_id || null) : undefined)
        : undefined;

    // Auto-asignar fecha de salida al completar
    if (estado === 'completado' && !fecha_salida) {
        fecha_salida = new Date().toISOString().slice(0, 10);
    }
    // Al iniciar trabajo, asignar progreso inicial si no existe
    if (estado === 'en_progreso' && !estado_progreso) {
        estado_progreso = 'en_revision';
    }

    try {
        const tecnicoParam = tecnicoFinal !== undefined ? tecnicoFinal : ordenActual.tecnico_id;
        const { rows } = await pool.query(
            `UPDATE ordenes_trabajo SET
                estado=COALESCE($1, estado),
                descripcion=COALESCE($2, descripcion),
                diagnostico=COALESCE($3, diagnostico),
                kilometraje=COALESCE($4, kilometraje),
                vehiculo_id=COALESCE($5, vehiculo_id),
                fecha_salida=COALESCE($6, fecha_salida),
                estado_progreso=COALESCE($7, estado_progreso),
                notas_progreso=COALESCE($8, notas_progreso),
                tecnico_id=$9
             WHERE id=$10 RETURNING *`,
            [estado || null, descripcion || null, diagnostico || null,
             kilometraje || null, vehiculo_id || null, fecha_salida || null,
             estado_progreso || null, notas_progreso !== undefined ? notas_progreso : null,
             tecnicoParam, id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada.' });

        if (cambiaEstado) {
            registrarHistorial({
                orden_id: rows[0].id,
                estado_anterior: ordenActual.estado,
                estado_nuevo: rows[0].estado,
                progreso_anterior: ordenActual.estado_progreso,
                progreso_nuevo: rows[0].estado_progreso,
                usuario_id: usuarioId,
                usuario_nombre: req.usuario?.nombre || null,
                notas: notas_progreso !== undefined ? notas_progreso : null,
            }); // fire-and-forget: no bloquea la respuesta si Mongo falla
        }

        return res.json({ orden: rows[0] });
    } catch (err) {
        console.error('Error actualizarOrden:', err);
        return res.status(500).json({ error: 'Error al actualizar orden.' });
    }
};

/**
 * GET /api/ordenes/ordenes/:id/historial
 * Obtiene la secuencia cronológica completa de cambios de estado,
 * progreso y notas de una orden.
 */
const obtenerHistorialOrden = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows: ordenRows } = await pool.query('SELECT id FROM ordenes_trabajo WHERE id = $1', [id]);
        if (!ordenRows[0]) return res.status(404).json({ error: 'Orden no encontrada.' });

        const historial = await obtenerHistorialPorOrden(id);
        return res.json({ historial });
    } catch (err) {
        console.error('Error obtenerHistorialOrden:', err);
        return res.status(500).json({ error: 'Error al obtener el historial de la orden.' });
    }
};

/**
 * GET /api/ordenes/historial/general  (solo administrador)
 * Bitácora paginada de cambios de TODAS las órdenes (MongoDB Atlas).
 */
const listarHistorialGeneral = async (req, res) => {
    const pagina    = parseInt(req.query.pagina, 10) || 1;
    const porPagina = Math.min(parseInt(req.query.porPagina, 10) || 20, 100);
    const resultado = await listarHistorialGeneralService({ pagina, porPagina });
    return res.json(resultado);
};

/**
 * Elimina una orden de trabajo del sistema.
 */
const eliminarOrden = async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM ordenes_trabajo WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Orden no encontrada.' });
        return res.json({ ok: true });
    } catch (err) {
        console.error('Error eliminarOrden:', err);
        return res.status(500).json({ error: 'Error al eliminar orden.' });
    }
};

module.exports = {
    listarClientes, obtenerCliente, crearCliente, actualizarCliente, eliminarCliente,
    listarVehiculos, crearVehiculo, actualizarVehiculo, eliminarVehiculo,
    listarOrdenes, obtenerOrden, crearOrden, actualizarOrden, eliminarOrden,
    obtenerHistorialOrden, listarHistorialGeneral,
};
