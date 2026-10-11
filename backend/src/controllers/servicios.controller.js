/**
 * SS SWAP - Controlador del Catálogo de Tipos de Servicio
 *
 * Permite la administración de servicios del taller automotriz (precios base,
 * duración estimada, activación e imágenes) y su consulta pública para
 * agendamiento y grounding del chatbot.
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');

/** GET /api/servicios — Lista tipos de servicio con filtros opcionales por estado y búsqueda por nombre */
const listarServicios = async (req, res) => {
    const { q, activo = 'true' } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (activo === 'true')  where += ' AND activo = TRUE';
    if (activo === 'false') where += ' AND activo = FALSE';
    if (q) {
        params.push(`%${q}%`);
        where += ` AND (nombre ILIKE $${params.length} OR descripcion ILIKE $${params.length})`;
    }

    try {
        const { rows } = await pool.query(
            `SELECT * FROM tipos_servicio ${where} ORDER BY nombre ASC`,
            params
        );
        return res.json({ servicios: rows });
    } catch (err) {
        console.error('Error listarServicios:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener servicios.' });
    }
};

/** GET /api/servicios/:id */
const obtenerServicio = async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM tipos_servicio WHERE id=$1', [req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Servicio no encontrado.' });
        return res.json(rows[0]);
    } catch (err) {
        return res.status(500).json({ error: 'Error al obtener servicio.' });
    }
};

/** POST /api/servicios — solo admin */
const crearServicio = async (req, res) => {
    const { nombre, descripcion, precio_base = 0, duracion_estimada_min, activo = true, imagen_url } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });

    try {
        const { rows } = await pool.query(
            `INSERT INTO tipos_servicio (nombre, descripcion, precio_base, duracion_estimada_min, activo, imagen_url)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [nombre.trim(), descripcion?.trim() || null, precio_base, duracion_estimada_min || null, activo, imagen_url?.trim() || null]
        );
        return res.status(201).json(rows[0]);
    } catch (err) {
        console.error('Error crearServicio:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al crear servicio.' });
    }
};

/** PUT /api/servicios/:id — solo admin */
const actualizarServicio = async (req, res) => {
    const { nombre, descripcion, precio_base, duracion_estimada_min, activo, imagen_url } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });

    try {
        const { rows } = await pool.query(
            `UPDATE tipos_servicio SET nombre=$1, descripcion=$2, precio_base=$3,
             duracion_estimada_min=$4, activo=$5, imagen_url=$6 WHERE id=$7 RETURNING *`,
            [nombre.trim(), descripcion?.trim() || null, precio_base, duracion_estimada_min || null, activo, imagen_url?.trim() || null, req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Servicio no encontrado.' });
        return res.json(rows[0]);
    } catch (err) {
        console.error('Error actualizarServicio:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al actualizar servicio.' });
    }
};

/** DELETE /api/servicios/:id — soft delete */
const eliminarServicio = async (req, res) => {
    try {
        const { rows } = await pool.query(
            'UPDATE tipos_servicio SET activo=FALSE WHERE id=$1 RETURNING id',
            [req.params.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Servicio no encontrado.' });
        return res.json({ ok: true });
    } catch (err) {
        return res.status(500).json({ error: 'Error al eliminar servicio.' });
    }
};

module.exports = { listarServicios, obtenerServicio, crearServicio, actualizarServicio, eliminarServicio };
