/**
 * SS SWAP - Controlador de Sucursales y Sedes del Taller
 *
 * Administra las locaciones físicas, horarios de atención y teléfonos de
 * contacto, y mantiene la regla de negocio de tener una única sede marcada
 * como principal.
 */
const pool = require('../config/db');

/** Lista sucursales activas para visualización en páginas públicas y chatbot */
// ─────────────────────────────────────────────────────────────
// LISTAR PUBLICAS (solo activas, sin auth)
// GET /api/sucursales/public
// ─────────────────────────────────────────────────────────────
const listarPublicas = async (_req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, nombre, direccion, ciudad, telefono, email, horario,
                    descripcion, es_principal
             FROM sucursales
             WHERE activa = TRUE
             ORDER BY es_principal DESC, nombre ASC`
        );
        return res.json({ sucursales: rows, total: rows.length });
    } catch (err) {
        console.error('Error listarPublicas:', err);
        return res.status(500).json({ error: 'Error al obtener sucursales.' });
    }
};

// ─────────────────────────────────────────────────────────────
// LISTAR ADMIN (todas, requiere auth)
// GET /api/sucursales
// ─────────────────────────────────────────────────────────────
const listarTodas = async (_req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM sucursales ORDER BY es_principal DESC, nombre ASC`
        );
        return res.json({ sucursales: rows, total: rows.length });
    } catch (err) {
        console.error('Error listarTodas:', err);
        return res.status(500).json({ error: 'Error al obtener sucursales.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CREAR
// POST /api/sucursales   (admin)
// ─────────────────────────────────────────────────────────────
const crear = async (req, res) => {
    const { nombre, direccion, ciudad, telefono, email, horario, descripcion, es_principal, activa } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });

    try {
        // Si la nueva es principal, desactiva las demas principales
        if (es_principal) {
            await pool.query('UPDATE sucursales SET es_principal = FALSE WHERE es_principal = TRUE');
        }
        const { rows } = await pool.query(
            `INSERT INTO sucursales (nombre, direccion, ciudad, telefono, email, horario, descripcion, es_principal, activa)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING *`,
            [nombre.trim(), direccion || null, ciudad || null, telefono || null,
             email || null, horario || null, descripcion || null,
             Boolean(es_principal), activa !== false]
        );
        return res.status(201).json({ sucursal: rows[0] });
    } catch (err) {
        console.error('Error crear sucursal:', err);
        return res.status(500).json({ error: 'Error al crear sucursal.' });
    }
};

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR
// PUT /api/sucursales/:id   (admin)
// ─────────────────────────────────────────────────────────────
const actualizar = async (req, res) => {
    const { id } = req.params;
    const { nombre, direccion, ciudad, telefono, email, horario, descripcion, es_principal, activa } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido.' });

    try {
        if (es_principal) {
            await pool.query('UPDATE sucursales SET es_principal = FALSE WHERE id <> $1', [id]);
        }
        const { rows } = await pool.query(
            `UPDATE sucursales SET
                nombre=$1, direccion=$2, ciudad=$3, telefono=$4, email=$5,
                horario=$6, descripcion=$7, es_principal=$8, activa=$9
             WHERE id=$10 RETURNING *`,
            [nombre.trim(), direccion || null, ciudad || null, telefono || null,
             email || null, horario || null, descripcion || null,
             Boolean(es_principal), activa !== false, id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Sucursal no encontrada.' });
        return res.json({ sucursal: rows[0] });
    } catch (err) {
        console.error('Error actualizar sucursal:', err);
        return res.status(500).json({ error: 'Error al actualizar sucursal.' });
    }
};

// ─────────────────────────────────────────────────────────────
// ELIMINAR
// DELETE /api/sucursales/:id   (admin)
// ─────────────────────────────────────────────────────────────
const eliminar = async (req, res) => {
    const { id } = req.params;
    try {
        const { rowCount } = await pool.query('DELETE FROM sucursales WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Sucursal no encontrada.' });
        return res.json({ ok: true });
    } catch (err) {
        console.error('Error eliminar sucursal:', err);
        return res.status(500).json({ error: 'Error al eliminar sucursal.' });
    }
};

module.exports = { listarPublicas, listarTodas, crear, actualizar, eliminar };
