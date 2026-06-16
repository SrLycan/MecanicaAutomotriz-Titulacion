const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const pool   = require('../config/db');

/* ── LOGIN ─────────────────────────────────────────────────── */
const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
        return res.status(400).json({ error: 'Email y contrasena son requeridos.' });

    try {
        const { rows } = await pool.query(
            `SELECT id, nombre, email, password, rol, activo, estado
             FROM usuarios WHERE email = $1`,
            [email.toLowerCase().trim()]
        );
        const usuario = rows[0];
        if (!usuario) return res.status(401).json({ error: 'Credenciales invalidas.' });

        const ok = await bcrypt.compare(password, usuario.password);
        if (!ok) return res.status(401).json({ error: 'Credenciales invalidas.' });

        if (usuario.estado === 'bloqueado')
            return res.status(403).json({ error: 'Tu cuenta esta bloqueada. Contacta al administrador.' });
        if (usuario.estado === 'suspendido')
            return res.status(403).json({ error: 'Tu cuenta esta suspendida temporalmente.' });
        if (!usuario.activo)
            return res.status(403).json({ error: 'Tu cuenta esta inactiva.' });

        const payload = { id: usuario.id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol };
        const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

        return res.json({ token, usuario: payload });
    } catch (err) {
        console.error('Error en login:', err);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

/* ── REGISTRO CLIENTE ───────────────────────────────────────── */
const register = async (req, res) => {
    const { nombre, email, password, telefono, cedula } = req.body;

    if (!nombre || !email || !password)
        return res.status(400).json({ error: 'Nombre, email y contrasena son requeridos.' });

    if (password.length < 6)
        return res.status(400).json({ error: 'La contrasena debe tener al menos 6 caracteres.' });

    try {
        const { rows: existe } = await pool.query(
            'SELECT id FROM usuarios WHERE email = $1', [email.toLowerCase().trim()]
        );
        if (existe.length > 0)
            return res.status(409).json({ error: 'Ya existe una cuenta con ese email.' });

        const hash = await bcrypt.hash(password, 10);
        const emailNorm = email.toLowerCase().trim();
        const { rows } = await pool.query(
            `INSERT INTO usuarios (nombre, email, password, rol, telefono, cedula)
             VALUES ($1, $2, $3, 'cliente', $4, $5)
             RETURNING id, nombre, email, rol`,
            [nombre.trim(), emailNorm, hash, telefono || null, cedula || null]
        );

        const { rows: cliExiste } = await pool.query(
            'SELECT id FROM clientes WHERE LOWER(email) = $1', [emailNorm]
        );
        if (cliExiste.length === 0) {
            await pool.query(
                `INSERT INTO clientes (nombre, email, telefono, cedula)
                 VALUES ($1, $2, $3, $4)`,
                [nombre.trim(), emailNorm, telefono || null, cedula || null]
            );
        }

        const payload = { id: rows[0].id, nombre: rows[0].nombre, email: rows[0].email, rol: rows[0].rol };
        const token   = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

        return res.status(201).json({ token, usuario: payload });
    } catch (err) {
        console.error('Error en register:', err);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

/* ── ME ─────────────────────────────────────────────────────── */
const me = (req, res) => res.json({ usuario: req.usuario });

module.exports = { login, register, me };
