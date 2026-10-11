/**
 * SS SWAP - Controlador de Proveedores
 *
 * Administra la informacion base de proveedores del taller (repuestos,
 * insumos, servicios contratados) y sus contactos. Los contactos NO son
 * usuarios del sistema (no inician sesion): es informacion de referencia,
 * por lo que viven en su propia tabla en vez de reutilizar `usuarios`.
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { registrarAccionBitacora } = require('../services/ordenesHistorial.service');

// ─────────────────────────────────────────────────────────────
// PROVEEDORES - CRUD
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/proveedores/proveedores
 * Filtros: q (nombre/ruc), categoria, activo, page, limit
 */
const listarProveedores = async (req, res) => {
    const { q, categoria, activo, page = 1, limit = 20 } = req.query;

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * limitNum;

    let where    = 'WHERE 1=1';
    const params = [];

    if (q) {
        params.push(`%${q}%`);
        where += ` AND (p.nombre_comercial ILIKE $${params.length} OR p.razon_social ILIKE $${params.length} OR p.ruc ILIKE $${params.length})`;
    }
    if (categoria) {
        params.push(categoria);
        where += ` AND p.categoria = $${params.length}`;
    }
    if (activo === 'true' || activo === 'false') {
        params.push(activo === 'true');
        where += ` AND p.activo = $${params.length}`;
    }

    const countQuery = `SELECT COUNT(*) AS total FROM proveedores p ${where}`;
    const dataQuery  = `
        SELECT p.*,
               (SELECT COUNT(*) FROM compras_proveedor cp WHERE cp.proveedor_id = p.id) AS total_compras
        FROM proveedores p
        ${where}
        ORDER BY p.nombre_comercial ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    try {
        const [{ rows: countRows }, { rows }] = await Promise.all([
            pool.query(countQuery, params),
            pool.query(dataQuery, [...params, limitNum, offset]),
        ]);
        const total = parseInt(countRows[0].total, 10);
        return res.json({
            proveedores: rows,
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        });
    } catch (err) {
        console.error('Error listarProveedores:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener proveedores.' });
    }
};

/**
 * GET /api/proveedores/proveedores/:id
 * Incluye sus contactos.
 */
const obtenerProveedor = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('SELECT * FROM proveedores WHERE id = $1', [id]);
        const proveedor = rows[0];
        if (!proveedor) return res.status(404).json({ error: 'Proveedor no encontrado.' });

        const { rows: contactos } = await pool.query(
            'SELECT * FROM proveedores_contactos WHERE proveedor_id = $1 ORDER BY es_principal DESC, nombre ASC',
            [id]
        );

        return res.json({ proveedor: { ...proveedor, contactos } });
    } catch (err) {
        console.error('Error obtenerProveedor:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener el proveedor.' });
    }
};

/**
 * POST /api/proveedores/proveedores   (admin)
 */
const crearProveedor = async (req, res) => {
    const { nombre_comercial, razon_social, ruc, direccion, telefono, email, categoria, notas, activo } = req.body;
    if (!nombre_comercial || !nombre_comercial.trim()) {
        return res.status(400).json({ error: 'El nombre comercial es requerido.' });
    }

    try {
        const { rows } = await pool.query(
            `INSERT INTO proveedores (nombre_comercial, razon_social, ruc, direccion, telefono, email, categoria, notas, activo)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
             RETURNING *`,
            [nombre_comercial.trim(), razon_social || null, ruc || null, direccion || null,
             telefono || null, email || null, categoria || null, notas || null, activo !== false]
        );
        const proveedor = rows[0];

        registrarAccionBitacora({
            entidad_tipo: 'proveedor', entidad_id: proveedor.id, accion: 'creado',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Proveedor "${proveedor.nombre_comercial}" creado.`,
        });

        return res.status(201).json({ proveedor });
    } catch (err) {
        console.error('Error crearProveedor:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al crear el proveedor.' });
    }
};

/**
 * PUT /api/proveedores/proveedores/:id   (admin)
 */
const actualizarProveedor = async (req, res) => {
    const { id } = req.params;
    const { nombre_comercial, razon_social, ruc, direccion, telefono, email, categoria, notas, activo } = req.body;
    if (!nombre_comercial || !nombre_comercial.trim()) {
        return res.status(400).json({ error: 'El nombre comercial es requerido.' });
    }

    try {
        const { rows } = await pool.query(
            `UPDATE proveedores SET
                nombre_comercial=$1, razon_social=$2, ruc=$3, direccion=$4,
                telefono=$5, email=$6, categoria=$7, notas=$8, activo=$9
             WHERE id=$10 RETURNING *`,
            [nombre_comercial.trim(), razon_social || null, ruc || null, direccion || null,
             telefono || null, email || null, categoria || null, notas || null,
             activo !== false, id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado.' });

        registrarAccionBitacora({
            entidad_tipo: 'proveedor', entidad_id: rows[0].id, accion: 'actualizado',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Proveedor "${rows[0].nombre_comercial}" actualizado.`,
        });

        return res.json({ proveedor: rows[0] });
    } catch (err) {
        console.error('Error actualizarProveedor:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al actualizar el proveedor.' });
    }
};

/**
 * DELETE /api/proveedores/proveedores/:id   (admin)
 * Baja logica (activo = FALSE): un proveedor puede tener compras/gastos
 * historicos referenciandolo, por lo que no se elimina fisicamente.
 */
const eliminarProveedor = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            'UPDATE proveedores SET activo = FALSE WHERE id = $1 RETURNING id',
            [id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Proveedor no encontrado.' });
        return res.json({ mensaje: 'Proveedor desactivado correctamente.' });
    } catch (err) {
        console.error('Error eliminarProveedor:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al desactivar el proveedor.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CONTACTOS DE PROVEEDOR - CRUD
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/proveedores/contactos?proveedor_id=
 */
const listarContactos = async (req, res) => {
    const { proveedor_id } = req.query;
    if (!proveedor_id) return res.status(400).json({ error: 'proveedor_id es requerido.' });

    try {
        const { rows } = await pool.query(
            'SELECT * FROM proveedores_contactos WHERE proveedor_id = $1 ORDER BY es_principal DESC, nombre ASC',
            [proveedor_id]
        );
        return res.json({ contactos: rows, total: rows.length });
    } catch (err) {
        console.error('Error listarContactos:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener contactos.' });
    }
};

/**
 * POST /api/proveedores/contactos   (admin)
 */
const crearContacto = async (req, res) => {
    const { proveedor_id, nombre, cargo, telefono, email, es_principal, activo } = req.body;
    if (!proveedor_id || !nombre || !nombre.trim()) {
        return res.status(400).json({ error: 'proveedor_id y nombre son requeridos.' });
    }

    try {
        const { rows: provRows } = await pool.query('SELECT id FROM proveedores WHERE id = $1', [proveedor_id]);
        if (!provRows[0]) return res.status(404).json({ error: 'Proveedor no encontrado.' });

        if (es_principal) {
            await pool.query(
                'UPDATE proveedores_contactos SET es_principal = FALSE WHERE proveedor_id = $1',
                [proveedor_id]
            );
        }

        const { rows } = await pool.query(
            `INSERT INTO proveedores_contactos (proveedor_id, nombre, cargo, telefono, email, es_principal, activo)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             RETURNING *`,
            [proveedor_id, nombre.trim(), cargo || null, telefono || null, email || null,
             Boolean(es_principal), activo !== false]
        );
        return res.status(201).json({ contacto: rows[0] });
    } catch (err) {
        console.error('Error crearContacto:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al crear el contacto.' });
    }
};

/**
 * PUT /api/proveedores/contactos/:id   (admin)
 */
const actualizarContacto = async (req, res) => {
    const { id } = req.params;
    const { nombre, cargo, telefono, email, es_principal } = req.body;
    if (!nombre || !nombre.trim()) return res.status(400).json({ error: 'El nombre es requerido.' });

    try {
        const { rows: actualRows } = await pool.query('SELECT proveedor_id FROM proveedores_contactos WHERE id = $1', [id]);
        if (!actualRows[0]) return res.status(404).json({ error: 'Contacto no encontrado.' });

        if (es_principal) {
            await pool.query(
                'UPDATE proveedores_contactos SET es_principal = FALSE WHERE proveedor_id = $1 AND id != $2',
                [actualRows[0].proveedor_id, id]
            );
        }

        const { rows } = await pool.query(
            `UPDATE proveedores_contactos SET nombre=$1, cargo=$2, telefono=$3, email=$4, es_principal=$5
             WHERE id=$6 RETURNING *`,
            [nombre.trim(), cargo || null, telefono || null, email || null, Boolean(es_principal), id]
        );
        return res.json({ contacto: rows[0] });
    } catch (err) {
        console.error('Error actualizarContacto:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al actualizar el contacto.' });
    }
};

/**
 * PATCH /api/proveedores/contactos/:id/estado   (admin)
 */
const cambiarEstadoContacto = async (req, res) => {
    const { id } = req.params;
    const { activo } = req.body;
    try {
        const { rows } = await pool.query(
            'UPDATE proveedores_contactos SET activo = $1 WHERE id = $2 RETURNING *',
            [Boolean(activo), id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Contacto no encontrado.' });
        return res.json({ contacto: rows[0] });
    } catch (err) {
        console.error('Error cambiarEstadoContacto:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al cambiar el estado del contacto.' });
    }
};

/**
 * DELETE /api/proveedores/contactos/:id   (admin)
 */
const eliminarContacto = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query('DELETE FROM proveedores_contactos WHERE id = $1 RETURNING id', [id]);
        if (!rows[0]) return res.status(404).json({ error: 'Contacto no encontrado.' });
        return res.json({ mensaje: 'Contacto eliminado correctamente.' });
    } catch (err) {
        console.error('Error eliminarContacto:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al eliminar el contacto.' });
    }
};

module.exports = {
    listarProveedores, obtenerProveedor, crearProveedor, actualizarProveedor, eliminarProveedor,
    listarContactos, crearContacto, actualizarContacto, cambiarEstadoContacto, eliminarContacto,
};
