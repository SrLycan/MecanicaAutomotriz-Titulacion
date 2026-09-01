/**
 * SS SWAP - Controlador de Administración de Usuarios y Perfil de Cuenta
 *
 * Gestiona el ciclo de vida de usuarios (administradores, técnicos,
 * recepcionistas y clientes):
 * - Altas, edición, suspensión/bloqueo y gestión de credenciales.
 * - Perfil personal (actualización de datos de contacto, contraseña y foto).
 * - Sincronización bidireccional de datos con la tabla 'clientes' ante
 *   modificaciones de perfil.
 */
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const fs     = require('fs');
const path   = require('path');
const pool   = require('../config/db');

const ROLES_VALIDOS   = ['administrador','tecnico','recepcionista','cliente'];
const ESTADOS_VALIDOS = ['activo','suspendido','bloqueado'];

// ─────────────────────────────────────────────────────────────
// LISTAR USUARIOS
// GET /api/users   (admin)
// query: q (busqueda), rol, estado
// ─────────────────────────────────────────────────────────────
const listarUsuarios = async (req, res) => {
    const { q, rol, estado, page, limit } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (q) {
        params.push(`%${q}%`);
        where += ` AND (nombre ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }
    if (rol && ROLES_VALIDOS.includes(rol)) {
        params.push(rol);
        where += ` AND rol = $${params.length}`;
    }
    if (estado && ESTADOS_VALIDOS.includes(estado)) {
        params.push(estado);
        where += ` AND estado = $${params.length}`;
    }

    const countQuery = `SELECT COUNT(*) AS total FROM usuarios ${where}`;
    let dataQuery = `
        SELECT id, nombre, email, rol, telefono, cedula, activo, estado,
               created_at, updated_at
        FROM usuarios
        ${where}
        ORDER BY created_at DESC
    `;

    const statsQuery = `
        SELECT
            COUNT(*)                                       AS total,
            COUNT(*) FILTER (WHERE rol = 'administrador')  AS admins,
            COUNT(*) FILTER (WHERE estado = 'suspendido')  AS suspendidos,
            COUNT(*) FILTER (WHERE estado = 'bloqueado')   AS bloqueados
        FROM usuarios
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
                usuarios: rows,
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum) || 1,
                stats: {
                    total:       parseInt(st.total, 10) || 0,
                    admins:      parseInt(st.admins, 10) || 0,
                    suspendidos: parseInt(st.suspendidos, 10) || 0,
                    bloqueados:  parseInt(st.bloqueados, 10) || 0,
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
            usuarios: rows,
            total,
            page: 1,
            limit: total,
            totalPages: 1,
            stats: {
                total:       parseInt(st.total, 10) || 0,
                admins:      parseInt(st.admins, 10) || 0,
                suspendidos: parseInt(st.suspendidos, 10) || 0,
                bloqueados:  parseInt(st.bloqueados, 10) || 0,
            },
        });
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
// ACTUALIZAR USUARIO (nombre, email, telefono, cedula)
// PUT /api/users/:id   (admin)
// ─────────────────────────────────────────────────────────────
const actualizarUsuario = async (req, res) => {
    const { id } = req.params;
    const { nombre, email, telefono, cedula } = req.body;

    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio.' });

    if (Number(id) === Number(req.usuario.id))
        return res.status(400).json({ error: 'No puedes editar tu propia cuenta desde aqui. Usa el perfil.' });

    try {
        // Verificar si el email ya está en uso por otro usuario
        if (email) {
            const { rows: existe } = await pool.query(
                'SELECT id FROM usuarios WHERE email = $1 AND id != $2',
                [email.toLowerCase().trim(), id]
            );
            if (existe.length > 0)
                return res.status(409).json({ error: 'Ya existe otro usuario con ese email.' });
        }

        const { rows } = await pool.query(
            `UPDATE usuarios SET
                nombre = COALESCE($1, nombre),
                email = COALESCE($2, email),
                telefono = $3,
                cedula = $4
             WHERE id = $5
             RETURNING id, nombre, email, rol, telefono, cedula, activo, estado, created_at`,
            [nombre.trim(), email ? email.toLowerCase().trim() : null, telefono || null, cedula || null, id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
        return res.json({ usuario: rows[0] });
    } catch (err) {
        console.error('Error actualizarUsuario:', err);
        return res.status(500).json({ error: 'Error al actualizar usuario.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CAMBIAR CONTRASEÑA
// PUT /api/users/:id/password   (admin)
// ─────────────────────────────────────────────────────────────
const cambiarPassword = async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6)
        return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres.' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const { rows } = await pool.query(
            `UPDATE usuarios SET password = $1 WHERE id = $2
             RETURNING id, nombre, email, rol`,
            [hash, id]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
        return res.json({ ok: true, mensaje: 'Contrasena actualizada correctamente.' });
    } catch (err) {
        console.error('Error cambiarPassword:', err);
        return res.status(500).json({ error: 'Error al cambiar contrasena.' });
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

// ─────────────────────────────────────────────────────────────
// PERFIL PROPIO (cualquier usuario autenticado: cliente o staff)
// ─────────────────────────────────────────────────────────────

/** Genera y firma un nuevo JWT con los datos actualizados del usuario. */
function reemitirToken(usuarioRow) {
    const payload = { id: usuarioRow.id, nombre: usuarioRow.nombre, email: usuarioRow.email, rol: usuarioRow.rol };
    const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    return { token, usuario: payload };
}

const PERFIL_CAMPOS = 'id, nombre, email, rol, telefono, cedula, foto_url, estado, created_at';

// GET /api/users/me
const obtenerMiPerfil = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT ${PERFIL_CAMPOS} FROM usuarios WHERE id = $1`,
            [req.usuario.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });
        return res.json({ usuario: rows[0] });
    } catch (err) {
        console.error('Error obtenerMiPerfil:', err);
        return res.status(500).json({ error: 'Error al obtener tu perfil.' });
    }
};

// PUT /api/users/me   body: { nombre, email, telefono?, cedula? }
const actualizarMiPerfil = async (req, res) => {
    const { nombre, email, telefono, cedula } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' });
    if (!email?.trim())  return res.status(400).json({ error: 'El correo es obligatorio.' });

    const emailNuevo  = email.toLowerCase().trim();
    const emailActual = (req.usuario.email || '').toLowerCase().trim();
    const cedulaLimpia = cedula?.trim() || null;

    try {
        const { rows: existeEmail } = await pool.query(
            'SELECT id FROM usuarios WHERE email = $1 AND id != $2', [emailNuevo, req.usuario.id]
        );
        if (existeEmail.length > 0) return res.status(409).json({ error: 'Ya existe otro usuario con ese correo.' });

        // clientes.cedula tiene restriccion UNIQUE: se valida antes de escribir para
        // no dejar "usuarios" actualizado mientras la sincronizacion con "clientes" falla.
        if (cedulaLimpia) {
            const { rows: existeCedula } = await pool.query(
                'SELECT id FROM clientes WHERE cedula = $1 AND LOWER(email) != $2', [cedulaLimpia, emailActual]
            );
            if (existeCedula.length > 0) return res.status(409).json({ error: 'Ya existe otro cliente registrado con esa cedula.' });
        }

        const client = await pool.connect();
        let usuarioActualizado;
        try {
            await client.query('BEGIN');
            const { rows } = await client.query(
                `UPDATE usuarios SET nombre = $1, email = $2, telefono = $3, cedula = $4
                 WHERE id = $5 RETURNING ${PERFIL_CAMPOS}`,
                [nombre.trim(), emailNuevo, telefono || null, cedulaLimpia, req.usuario.id]
            );
            if (!rows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Usuario no encontrado.' }); }
            usuarioActualizado = rows[0];

            // Mantiene sincronizado el registro en "clientes" (vinculo usado por ordenes, citas y tienda)
            await client.query(
                `UPDATE clientes SET nombre = $1, telefono = $2, cedula = $3, email = $4 WHERE LOWER(email) = $5`,
                [nombre.trim(), telefono || null, cedulaLimpia, emailNuevo, emailActual]
            );
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        const { token, usuario } = reemitirToken(usuarioActualizado);
        return res.json({ usuario: usuarioActualizado, token, sesion: usuario });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Ese correo o cedula ya esta en uso por otro registro.' });
        console.error('Error actualizarMiPerfil:', err);
        return res.status(500).json({ error: 'Error al actualizar tu perfil.' });
    }
};

// PUT /api/users/me/password   body: { password_actual, password_nueva }
// Nota: los errores de validacion usan 400, nunca 401 — un 401 en una peticion
// autenticada dispara el flujo de "sesion expirada" en el frontend, y equivocar
// la contrasena actual no es lo mismo que perder la sesion.
const cambiarMiPassword = async (req, res) => {
    const { password_actual, password_nueva } = req.body;
    if (!password_actual || !password_nueva)
        return res.status(400).json({ error: 'Ingresa tu contrasena actual y la nueva.' });
    if (password_nueva.length < 6)
        return res.status(400).json({ error: 'La nueva contrasena debe tener al menos 6 caracteres.' });

    try {
        const { rows } = await pool.query('SELECT password FROM usuarios WHERE id = $1', [req.usuario.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });

        const ok = await bcrypt.compare(password_actual, rows[0].password);
        if (!ok) return res.status(400).json({ error: 'Tu contrasena actual no es correcta.' });

        const hash = await bcrypt.hash(password_nueva, 10);
        await pool.query('UPDATE usuarios SET password = $1 WHERE id = $2', [hash, req.usuario.id]);
        return res.json({ ok: true, mensaje: 'Contrasena actualizada correctamente.' });
    } catch (err) {
        console.error('Error cambiarMiPassword:', err);
        return res.status(500).json({ error: 'Error al cambiar tu contrasena.' });
    }
};

// POST /api/users/me/foto   (multipart, campo "foto" — requiere middleware subirFotoPerfil)
const subirMiFoto = async (req, res) => {
    try {
        const fotoUrl = `/uploads/perfiles/${req.file.filename}`;
        const { rows: anteriorRows } = await pool.query('SELECT foto_url FROM usuarios WHERE id = $1', [req.usuario.id]);

        const { rows } = await pool.query(
            `UPDATE usuarios SET foto_url = $1 WHERE id = $2 RETURNING ${PERFIL_CAMPOS}`,
            [fotoUrl, req.usuario.id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });

        // Best-effort: elimina la foto anterior del disco si era una foto local previa
        const anteriorUrl = anteriorRows[0]?.foto_url;
        if (anteriorUrl && anteriorUrl.startsWith('/uploads/perfiles/')) {
            const rutaAnterior = path.join(__dirname, '..', '..', 'uploads', 'perfiles', path.basename(anteriorUrl));
            fs.unlink(rutaAnterior, () => {});
        }

        const { token, usuario } = reemitirToken(rows[0]);
        return res.json({ usuario: rows[0], token, sesion: usuario });
    } catch (err) {
        console.error('Error subirMiFoto:', err);
        return res.status(500).json({ error: 'Error al guardar la foto de perfil.' });
    }
};

module.exports = {
    listarUsuarios, cambiarRol, cambiarEstado, eliminarUsuario, crearUsuario, actualizarUsuario, cambiarPassword,
    obtenerMiPerfil, actualizarMiPerfil, cambiarMiPassword, subirMiFoto,
};
