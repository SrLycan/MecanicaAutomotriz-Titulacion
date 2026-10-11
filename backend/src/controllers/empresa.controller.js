/**
 * SS SWAP - Configuración de la propia empresa (/api/empresa)
 *
 * Datos comerciales que aparecen en proformas, PDF y Excel, y la
 * autorización para que el superadministrador pueda entrar en modo soporte.
 * La consulta corre aislada: cada empresa solo puede leer y modificar SU
 * fila (Row Level Security). El estado y el identificador (slug) los
 * administra únicamente la plataforma.
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { registrarAuditoria } = require('../services/auditoria.service');

const CAMPOS = { nombre: 120, nombre_comercial: 160, razon_social: 160, ruc: 20, direccion: 255, telefono: 30, email: 150 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLUMNAS = 'id, slug, nombre, nombre_comercial, razon_social, ruc, direccion, telefono, email, estado, permite_soporte, logo_archivo';

// GET /api/empresa
const obtener = async (_req, res) => {
    try {
        const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM empresas WHERE id = empresa_actual()`);
        if (!rows[0]) return res.status(404).json({ error: 'Empresa no encontrada.' });
        return res.json({ empresa: rows[0] });
    } catch (err) {
        console.error('Error obtener empresa:', err.message);
        return res.status(500).json({ error: 'Error al obtener los datos de la empresa.' });
    }
};

// PUT /api/empresa   body: { nombre?, nombre_comercial?, razon_social?, ruc?, direccion?, telefono?, email?, permite_soporte? }
const actualizar = async (req, res) => {
    const body = req.body || {};
    const datos = {};
    for (const [c, max] of Object.entries(CAMPOS)) {
        if (body[c] === undefined) continue;
        const v = body[c] === null ? null : String(body[c]).trim();
        if (v && v.length > max) return res.status(400).json({ error: `El campo ${c} es demasiado largo.` });
        datos[c] = v || null;
    }
    if ('nombre' in datos && !datos.nombre) return res.status(400).json({ error: 'El nombre de la empresa es obligatorio.' });
    if (datos.email && !EMAIL_RE.test(datos.email)) return res.status(400).json({ error: 'El correo no es valido.' });
    if (body.permite_soporte !== undefined) datos.permite_soporte = Boolean(body.permite_soporte);
    const campos = Object.keys(datos);
    if (!campos.length) return res.status(400).json({ error: 'No hay datos para actualizar.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: antes } = await client.query(`SELECT ${COLUMNAS} FROM empresas WHERE id = empresa_actual() FOR UPDATE`);
        if (!antes[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Empresa no encontrada.' }); }
        const sets = campos.map((c, i) => `${c} = $${i + 1}`).join(', ');
        const { rows } = await client.query(
            `UPDATE empresas SET ${sets} WHERE id = empresa_actual() RETURNING ${COLUMNAS}`, campos.map(c => datos[c]));
        const cambios = Object.fromEntries(campos.filter(c => antes[0][c] !== rows[0][c])
            .map(c => [c, { antes: antes[0][c], despues: rows[0][c] }]));
        if (Object.keys(cambios).length) {
            await registrarAuditoria({ req, accion: 'empresa.configurar', recursoTipo: 'empresa', recursoId: rows[0].id,
                detalle: { cambios } }, client, true);
        }
        await client.query('COMMIT');
        return res.json({ empresa: rows[0] });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error actualizar empresa:', err.message);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al guardar los datos de la empresa.' });
    } finally {
        client.release();
    }
};

module.exports = { obtener, actualizar };
