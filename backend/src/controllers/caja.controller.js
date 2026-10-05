/**
 * SS SWAP - Controlador de Caja
 *
 * Maneja la apertura/cierre de caja diaria y los movimientos (ingresos y
 * egresos) registrados durante la sesion abierta. Solo puede existir una
 * sesion 'abierta' a la vez.
 */
const pool = require('../config/db');

/** GET /api/caja/actual — sesion abierta en este momento (o null) con sus movimientos */
const obtenerSesionActual = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT s.*, u.nombre AS usuario_apertura_nombre
             FROM caja_sesiones s
             JOIN usuarios u ON u.id = s.usuario_apertura_id
             WHERE s.estado='abierta' ORDER BY s.fecha_apertura DESC LIMIT 1`
        );
        const sesion = rows[0];
        if (!sesion) return res.json({ sesion: null, movimientos: [], totales: { ingresos: 0, egresos: 0, saldo: 0 } });

        const { rows: movs } = await pool.query(
            `SELECT m.*, u.nombre AS usuario_nombre
             FROM caja_movimientos m JOIN usuarios u ON u.id = m.usuario_id
             WHERE m.caja_sesion_id=$1 ORDER BY m.created_at DESC`,
            [sesion.id]
        );
        const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0);
        const egresos   = movs.filter(m => m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0);

        return res.json({
            sesion, movimientos: movs,
            totales: { ingresos, egresos, saldo: Number(sesion.monto_apertura) + ingresos - egresos },
        });
    } catch (err) {
        console.error('Error obtenerSesionActual:', err);
        return res.status(500).json({ error: 'Error al obtener la sesion de caja.' });
    }
};

/** POST /api/caja/apertura — abre una nueva sesion de caja del dia */
const abrirCaja = async (req, res) => {
    const { monto_apertura = 0, sucursal_id, notas_apertura } = req.body;
    const usuario_id = req.usuario.id;

    try {
        const { rows: abiertas } = await pool.query("SELECT id FROM caja_sesiones WHERE estado='abierta' LIMIT 1");
        if (abiertas[0]) {
            return res.status(409).json({ error: 'Ya existe una caja abierta. Ciérrala antes de abrir una nueva.' });
        }
        if (Number(monto_apertura) < 0) {
            return res.status(400).json({ error: 'El monto de apertura no puede ser negativo.' });
        }

        const { rows } = await pool.query(
            `INSERT INTO caja_sesiones (sucursal_id, usuario_apertura_id, monto_apertura, notas_apertura)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [sucursal_id || null, usuario_id, monto_apertura, notas_apertura?.trim() || null]
        );
        return res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error abrirCaja:', err);
        return res.status(500).json({ error: 'Error al abrir caja.' });
    }
};

/** POST /api/caja/cierre — cierra la sesion abierta con el conteo real */
const cerrarCaja = async (req, res) => {
    const { monto_cierre_real, notas_cierre } = req.body;
    const usuario_id = req.usuario.id;

    if (monto_cierre_real == null || isNaN(monto_cierre_real)) {
        return res.status(400).json({ error: 'monto_cierre_real es obligatorio.' });
    }

    try {
        const { rows: abiertas } = await pool.query("SELECT * FROM caja_sesiones WHERE estado='abierta' LIMIT 1");
        const sesion = abiertas[0];
        if (!sesion) return res.status(404).json({ error: 'No hay ninguna caja abierta.' });

        const { rows: movs } = await pool.query(
            `SELECT tipo, COALESCE(SUM(monto),0) AS total FROM caja_movimientos WHERE caja_sesion_id=$1 GROUP BY tipo`,
            [sesion.id]
        );
        const ingresos = Number(movs.find(m => m.tipo === 'ingreso')?.total || 0);
        const egresos   = Number(movs.find(m => m.tipo === 'egreso')?.total || 0);
        const montoEsperado = Number(sesion.monto_apertura) + ingresos - egresos;
        const diferencia    = Number(monto_cierre_real) - montoEsperado;

        const { rows } = await pool.query(
            `UPDATE caja_sesiones SET estado='cerrada', usuario_cierre_id=$1, monto_cierre_esperado=$2,
             monto_cierre_real=$3, diferencia=$4, notas_cierre=$5, fecha_cierre=NOW()
             WHERE id=$6 RETURNING *`,
            [usuario_id, montoEsperado, monto_cierre_real, diferencia, notas_cierre?.trim() || null, sesion.id]
        );
        return res.json({ ...rows[0], ingresos, egresos });
    } catch (err) {
        console.error('Error cerrarCaja:', err);
        return res.status(500).json({ error: 'Error al cerrar caja.' });
    }
};

/** POST /api/caja/movimientos — registra un ingreso o egreso en la sesion abierta */
const registrarMovimientoCaja = async (req, res) => {
    const { tipo, concepto, monto, metodo_pago = 'efectivo', referencia } = req.body;
    const usuario_id = req.usuario.id;

    if (!['ingreso', 'egreso'].includes(tipo)) {
        return res.status(400).json({ error: "tipo debe ser 'ingreso' o 'egreso'." });
    }
    if (!concepto?.trim()) return res.status(400).json({ error: 'El concepto es obligatorio.' });
    if (!monto || Number(monto) <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });

    try {
        const { rows: abiertas } = await pool.query("SELECT id FROM caja_sesiones WHERE estado='abierta' LIMIT 1");
        const sesion = abiertas[0];
        if (!sesion) return res.status(409).json({ error: 'No hay ninguna caja abierta. Abre caja primero.' });

        const { rows } = await pool.query(
            `INSERT INTO caja_movimientos (caja_sesion_id, usuario_id, tipo, concepto, monto, metodo_pago, referencia)
             VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
            [sesion.id, usuario_id, tipo, concepto.trim(), monto, metodo_pago, referencia?.trim() || null]
        );
        return res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error registrarMovimientoCaja:', err);
        return res.status(500).json({ error: 'Error al registrar el movimiento de caja.' });
    }
};

/**
 * GET /api/caja/historial — sesiones cerradas (resumen dia a dia)
 * Query params: desde, hasta, limit
 */
const listarHistorial = async (req, res) => {
    const { desde, hasta, limit = 60 } = req.query;
    let query = `
        SELECT s.*, ua.nombre AS usuario_apertura_nombre, uc.nombre AS usuario_cierre_nombre
        FROM caja_sesiones s
        JOIN usuarios ua ON ua.id = s.usuario_apertura_id
        LEFT JOIN usuarios uc ON uc.id = s.usuario_cierre_id
        WHERE s.estado='cerrada'
    `;
    const params = [];
    if (desde) { params.push(desde); query += ` AND s.fecha_apertura >= $${params.length}`; }
    if (hasta) { params.push(hasta); query += ` AND s.fecha_apertura <= $${params.length}`; }
    params.push(parseInt(limit) || 60);
    query += ` ORDER BY s.fecha_apertura DESC LIMIT $${params.length}`;

    try {
        const { rows } = await pool.query(query, params);
        return res.json({ sesiones: rows });
    } catch (err) {
        console.error('Error listarHistorial:', err);
        return res.status(500).json({ error: 'Error al obtener el historial de caja.' });
    }
};

module.exports = {
    obtenerSesionActual, abrirCaja, cerrarCaja, registrarMovimientoCaja, listarHistorial,
};
