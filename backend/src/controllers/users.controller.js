const bcrypt = require('bcryptjs');
const pool   = require('../config/db');

const ROLES_VALIDOS   = ['administrador','tecnico','recepcionista','cliente'];
const ESTADOS_VALIDOS = ['activo','suspendido','bloqueado'];

// ─────────────────────────────────────────────────────────────
// LISTAR USUARIOS
// GET /api/users   (admin)
// query: q (busqueda), rol, estado
// ─────────────────────────────────────────────────────────────
const listarUsuarios = async (req, res) => {
    const { q, rol, estado } = req.query;
    let query = `SELECT id, nombre, email, rol, telefono, cedula, activo, estado,
                        created_at, updated_at
                 FROM usuarios WHERE 1=1`;
    const params = [];

    if (q) {
        params.push(`%${q}%`);
        query += ` AND (nombre ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }
    if (rol && ROLES_VALIDOS.includes(rol)) {
        params.push(rol);
        query += ` AND rol = $${params.length}`;
    }
    if (estado && ESTADOS_VALIDOS.includes(estado)) {
        params.push(estado);
        query += ` AND estado = $${params.length}`;
    }
    query += ' ORDER BY created_at DESC';

    try {
        const { rows } = await pool.query(query, params);
        return res.json({ usuarios: rows, total: rows.length });
    } catch (err) {
        console.error('Error listarUsuarios:', err);
        return res.status(500).json({ error: 'Error al obtener usuarios.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CAMBIAR ROL
// PUT /api/users/:id/rol   (admin)
// body: { rol }
// ─────────────────────────────────────────────────────────────
const cambiarRol = async (req, res) => {
    const { id } = req.params;
    const { rol } = req.body;

    if (!ROLES_VALIDOS.includes(rol))
        return res.status(400).json({ error: `Rol invalido. Permitidos: ${ROLES_VALIDOS.join(', ')}.` });

    if (Number(id) === Number(req.usuario.id))
        return res.status(400).json({ error: 'No puedes cambiar tu propio rol.' });

    try {
        const { rows } = await pool.query(
            `UPDATE usuarios SET rol = $1 WHERE id = $2
             RETURNING id, nombre, email, rol, estado`,
            [rol, id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
        return res.json({ usuario: rows[0] });
    } catch (err) {
        console.error('Error cambiarRol:', err);
        return res.status(500).json({ error: 'Error al cambiar rol.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CAMBIAR ESTADO
// PUT /api/users/:id/estado   (admin)
// body: { estado }   activo / suspendido / bloqueado
// ─────────────────────────────────────────────────────────────
const cambiarEstado = async (req, res) => {
    const { id }     = req.params;
    const { estado } = req.body;

    if (!ESTADOS_VALIDOS.includes(estado))
        return res.status(400).json({ error: `Estado invalido. Permitidos: ${ESTADOS_VALIDOS.join(', ')}.` });

    if (Number(id) === Number(req.usuario.id))
        return res.status(400).json({ error: 'No puedes cambiar tu propio estado.' });

    const activo = estado === 'activo';

    try {
        const { rows } = await pool.query(
            `UPDATE usuarios SET estado = $1, activo = $2 WHERE id = $3
             RETURNING id, nombre, email, rol, activo, estado`,
            [estado, activo, id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
        return res.json({ usuario: rows[0] });
    } catch (err) {
        console.error('Error cambiarEstado:', err);
        return res.status(500).json({ error: 'Error al cambiar estado.' });
    }
};

// ─────────────────────────────────────────────────────────────
// ELIMINAR USUARIO
// DELETE /api/users/:id   (admin)
// Verifica que no tenga movimientos asociados.
// ─────────────────────────────────────────────────────────────
const eliminarUsuario = async (req, res) => {
    const { id } = req.params;

    if (Number(id) === Number(req.usuario.id))
        return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });

    try {
        // Verifica si tiene movimientos asociados
        const { rows: mov } = await pool.query(
            'SELECT COUNT(*)::int AS n FROM movimientos_inventario WHERE usuario_id = $1',
            [id]
        );
        if (mov[0].n > 0) {
            return res.status(409).json({
                error: `Este usuario tiene ${mov[0].n} movimiento(s) registrado(s). Suspende o bloquea su acceso en lugar de eliminar.`
            });
        }

        const { rowCount } = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
        if (rowCount === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
        return res.json({ ok: true });
    } catch (err) {
        console.error('Error eliminarUsuario:', err);
        return res.status(500).json({ error: 'Error al eliminar usuario.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CREAR USUARIO (staff)
// POST /api/users   (admin)
// body: { nombre, email, password, rol, telefono?, cedula? }
// ─────────────────────────────────────────────────────────────
const crearUsuario = async (req, res) => {
    const { nombre, email, password, rol, telefono, cedula } = req.body;
    if (!nombre || !email || !password || !rol)
        return res.status(400).json({ error: 'Nombre, email, contrasena y rol son requeridos.' });
    if (!ROLES_VALIDOS.includes(rol))
        return res.status(400).json({ error: 'Rol invalido.' });
    if (password.length < 6)
        return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres.' });

    try {
        const { rows: existe } = await pool.query(
            'SELECT id FROM usuarios WHERE email = $1', [email.toLowerCase().trim()]
        );
        if (existe.length > 0)
            return res.status(409).json({ error: 'Ya existe un usuario con ese email.' });

        const hash = await bcrypt.hash(password, 10);
        const { rows } = await pool.query(
            `INSERT INTO usuarios (nombre, email, password, rol, telefono, cedula)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, nombre, email, rol, telefono, cedula, activo, estado, created_at`,
            [nombre.trim(), email.toLowerCase().trim(), hash, rol, telefono || null, cedula || null]
        );
        return res.status(201).json({ usuario: rows[0] });
    } catch (err) {
        console.error('Error crearUsuario:', err);
        return res.status(500).json({ error: 'Error al crear usuario.' });
    }
};

module.exports = { listarUsuarios, cambiarRol, cambiarEstado, eliminarUsuario, crearUsuario };
