/**
 * SS SWAP - Administración de la PLATAFORMA (solo superadministrador)
 *
 * Empresas (mecánicas), su administrador inicial, accesos de soporte,
 * auditoría global, respaldos, migraciones y errores técnicos.
 *
 * Todas las consultas de aquí corren con sinAislamiento() porque trabajan
 * con varias empresas a la vez; por eso NUNCA devuelven datos operativos
 * (clientes, vehículos, documentos, dinero): solo datos de la empresa y
 * conteos agregados. Para ver datos de una empresa el superadministrador
 * abre un acceso de soporte (motivo + tiempo límite + auditoría), y solo si
 * esa empresa lo permite.
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../config/db');
const { sinAislamiento } = require('../config/contexto');
const { errorBD } = require('../utils/erroresBD');
const { registrarAuditoria } = require('../services/auditoria.service');
const { PLANTILLAS } = require('../config/permisos');
const respaldos = require('../services/respaldo.service');
const { guardarLogo } = require('./empresa.controller');
const { urlLogo } = require('../services/marcaEmpresa');
const fs = require('fs');

const SLUG_PUBLICO = (process.env.EMPRESA_PUBLICA || 'ss-swap').trim().toLowerCase();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const idValido = (id) => /^\d+$/.test(String(id)) && Number(id) > 0;
const CAMPOS_EMPRESA = ['nombre', 'nombre_comercial', 'razon_social', 'ruc', 'direccion', 'telefono', 'email'];
const LIMITES = { nombre: 120, nombre_comercial: 160, razon_social: 160, ruc: 20, direccion: 255, telefono: 30, email: 150 };

class ErrorRespuesta extends Error {
    constructor(status, error) { super(error); this.status = status; this.error = error; }
}

function responder(res, err, contexto, mensaje) {
    if (err instanceof ErrorRespuesta) return res.status(err.status).json({ error: err.error });
    console.error(`Error ${contexto}:`, err.message);
    const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
    return res.status(500).json({ error: mensaje });
}

/** Fila de empresa para la API: URL del logo en vez del nombre interno del archivo. */
const empresaApi = ({ logo_archivo, ...e }) => ({ ...e, logo_url: urlLogo(logo_archivo) });

/** Consulta sin aislamiento (la plataforma ve todas las empresas). */
const q = (sql, params) => sinAislamiento(() => pool.query(sql, params));

/** Transacción sin aislamiento. */
async function transaccion(fn) {
    return sinAislamiento(async () => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const r = await fn(client);
            await client.query('COMMIT');
            return r;
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    });
}

function generarPasswordTemporal() {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const s = [...crypto.randomBytes(12)].map(b => alfabeto[b % alfabeto.length]).join('');
    return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/** "Taller Pérez Hnos." -> "taller-perez-hnos" */
function slugDe(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

/** Valida y limpia los datos de una empresa. Devuelve { datos } o { error }. */
function datosEmpresa(body, { requerirNombre }) {
    const datos = {};
    for (const c of CAMPOS_EMPRESA) {
        if (body[c] === undefined) continue;
        const v = body[c] === null ? null : String(body[c]).trim();
        if (v && v.length > LIMITES[c]) return { error: `El campo ${c} es demasiado largo.` };
        datos[c] = v || null;
    }
    if (requerirNombre && !datos.nombre) return { error: 'El nombre de la empresa es obligatorio.' };
    if (datos.nombre === null) return { error: 'El nombre de la empresa es obligatorio.' };
    if (datos.email && !EMAIL_RE.test(datos.email)) return { error: 'El correo de la empresa no es valido.' };
    return { datos };
}

// ─────────────────────────────────────────────────────────────
// RESUMEN
// GET /api/plataforma/resumen
// ─────────────────────────────────────────────────────────────
const resumen = async (_req, res) => {
    try {
        const [{ rows: empresas }, { rows: usuarios }, { rows: errores }, { rows: soporte }] = await Promise.all([
            q(`SELECT estado, COUNT(*)::int AS total FROM empresas GROUP BY estado`),
            q(`SELECT COUNT(*) FILTER (WHERE activo AND estado = 'activo' AND rol <> 'cliente')::int AS personal_activo,
                      COUNT(*) FILTER (WHERE rol = 'cliente')::int AS clientes_portal
               FROM usuarios`),
            q(`SELECT COUNT(*)::int AS total FROM errores_sistema WHERE created_at > NOW() - INTERVAL '24 hours'`),
            q(`SELECT COUNT(*)::int AS total FROM accesos_soporte WHERE finalizado_at IS NULL AND expira > NOW()`),
        ]);
        const ultimo = await respaldos.ultimoRespaldo();
        return res.json({
            empresas: Object.fromEntries(empresas.map(e => [e.estado, e.total])),
            usuarios: usuarios[0],
            errores_24h: errores[0].total,
            soportes_activos: soporte[0].total,
            ultimo_respaldo: ultimo,
        });
    } catch (err) {
        return responder(res, err, 'resumen plataforma', 'Error al cargar el resumen de la plataforma.');
    }
};

// ─────────────────────────────────────────────────────────────
// EMPRESAS
// ─────────────────────────────────────────────────────────────
const SQL_EMPRESA = `
    SELECT e.id, e.slug, e.nombre, e.nombre_comercial, e.razon_social, e.ruc, e.direccion, e.telefono, e.email,
           e.estado, e.permite_soporte, e.created_at, e.updated_at, e.logo_archivo, e.creada_por,
           (SELECT u.nombre FROM usuarios u WHERE u.id = e.creada_por) AS creada_por_nombre,
           (e.slug = $1) AS es_publica,
           (SELECT COUNT(*) FROM usuarios u WHERE u.empresa_id = e.id AND u.rol <> 'cliente' AND u.activo)::int AS personal_activo,
           (SELECT COUNT(*) FROM clientes c WHERE c.empresa_id = e.id)::int AS total_clientes,
           (SELECT COUNT(*) FROM ordenes_trabajo o WHERE o.empresa_id = e.id)::int AS total_ordenes,
           (SELECT COUNT(*) FROM proformas p WHERE p.empresa_id = e.id)::int AS total_proformas,
           (SELECT COUNT(*) FROM repuestos r WHERE r.empresa_id = e.id)::int AS total_productos,
           (SELECT MAX(u.ultimo_acceso) FROM usuarios u WHERE u.empresa_id = e.id) AS ultimo_acceso
    FROM empresas e`;

// GET /api/plataforma/empresas?q=&estado=
const listarEmpresas = async (req, res) => {
    const params = [SLUG_PUBLICO];
    const where = [];
    if (req.query.q && String(req.query.q).trim()) {
        params.push(`%${String(req.query.q).trim().slice(0, 80)}%`);
        where.push(`(e.nombre ILIKE $${params.length} OR e.slug ILIKE $${params.length} OR e.ruc ILIKE $${params.length})`);
    }
    if (['activa', 'suspendida', 'inactiva'].includes(req.query.estado)) {
        params.push(req.query.estado);
        where.push(`e.estado = $${params.length}`);
    }
    try {
        const { rows } = await q(`${SQL_EMPRESA} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY e.id`, params);
        return res.json({ empresas: rows.map(empresaApi), total: rows.length });
    } catch (err) {
        return responder(res, err, 'listarEmpresas', 'Error al listar empresas.');
    }
};

// GET /api/plataforma/empresas/:id
const obtenerEmpresa = async (req, res) => {
    if (!idValido(req.params.id)) return res.status(400).json({ error: 'Identificador invalido.' });
    try {
        const { rows } = await q(`${SQL_EMPRESA} WHERE e.id = $2`, [SLUG_PUBLICO, req.params.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Empresa no encontrada.' });
        // Solo nombre y correo de sus administradores (para restablecer accesos).
        const { rows: admins } = await q(
            `SELECT id, nombre, email, estado, ultimo_acceso FROM usuarios
             WHERE empresa_id = $1 AND rol = 'administrador' ORDER BY id`, [req.params.id]);
        return res.json({ empresa: empresaApi(rows[0]), administradores: admins });
    } catch (err) {
        return responder(res, err, 'obtenerEmpresa', 'Error al obtener la empresa.');
    }
};

/**
 * Crea (o reutiliza) el administrador de una empresa con contraseña temporal.
 * Devuelve { usuario, password_temporal, creado }.
 */
async function crearAdministrador(client, empresaId, { nombre, email }) {
    const emailNorm = String(email || '').toLowerCase().trim();
    if (!EMAIL_RE.test(emailNorm) || emailNorm.length > 150) throw new ErrorRespuesta(400, 'El correo del administrador no es valido.');
    const password = generarPasswordTemporal();
    const hash = await bcrypt.hash(password, 10);

    const { rows: existe } = await client.query('SELECT id, empresa_id, rol FROM usuarios WHERE email = $1 FOR UPDATE', [emailNorm]);
    if (existe[0]) {
        if (existe[0].empresa_id !== empresaId || existe[0].rol !== 'administrador')
            throw new ErrorRespuesta(409, 'Ese correo ya pertenece a otra cuenta de la plataforma.');
        const { rows } = await client.query(
            `UPDATE usuarios SET password = $1, estado = 'activo', activo = TRUE, token_version = token_version + 1
             WHERE id = $2 RETURNING id, nombre, email`, [hash, existe[0].id]);
        return { usuario: rows[0], password_temporal: password, creado: false };
    }
    if (!nombre || !String(nombre).trim()) throw new ErrorRespuesta(400, 'El nombre del administrador es obligatorio.');
    const { rows } = await client.query(
        `INSERT INTO usuarios (nombre, email, password, rol, empresa_id, permisos_inicializados)
         VALUES ($1, $2, $3, 'administrador', $4, TRUE) RETURNING id, nombre, email`,
        [String(nombre).trim().slice(0, 100), emailNorm, hash, empresaId]);
    for (const p of PLANTILLAS.administrador) {
        const [modulo, accion] = p.split(':');
        await client.query(
            `INSERT INTO usuario_permisos (usuario_id, modulo, accion, empresa_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
            [rows[0].id, modulo, accion, empresaId]);
    }
    return { usuario: rows[0], password_temporal: password, creado: true };
}

// POST /api/plataforma/empresas
// body: { nombre, slug?, nombre_comercial?, razon_social?, ruc?, direccion?, telefono?, email?, admin: { nombre, email } }
const crearEmpresa = async (req, res) => {
    const { datos, error } = datosEmpresa(req.body || {}, { requerirNombre: true });
    if (error) return res.status(400).json({ error });
    const slug = slugDe(req.body.slug || datos.nombre);
    if (!slug) return res.status(400).json({ error: 'No se pudo generar un identificador (slug) valido para la empresa.' });
    const admin = req.body.admin || {};

    try {
        const r = await transaccion(async (client) => {
            const { rows: dup } = await client.query('SELECT 1 FROM empresas WHERE slug = $1', [slug]);
            if (dup[0]) throw new ErrorRespuesta(409, `Ya existe una empresa con el identificador "${slug}".`);
            const { rows } = await client.query(
                `INSERT INTO empresas (slug, nombre, nombre_comercial, razon_social, ruc, direccion, telefono, email, estado, permite_soporte, creada_por)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'activa', FALSE, $9) RETURNING id`,
                [slug, datos.nombre, datos.nombre_comercial || datos.nombre, datos.razon_social, datos.ruc, datos.direccion,
                 datos.telefono, datos.email, req.usuario.id]);
            const empresaId = rows[0].id;

            // Configuracion minima para operar (NO se copian datos de otra empresa):
            // las cuentas de dinero predeterminadas que usan caja y finanzas.
            await client.query(
                `INSERT INTO cuentas_dinero (nombre, tipo, predeterminada, notas, empresa_id) VALUES
                 ('Caja principal', 'caja', TRUE, 'Efectivo del taller. Recibe todo lo cobrado/pagado en efectivo.', $1),
                 ('Banco principal', 'banco', TRUE, 'Recibe transferencias, tarjetas y cheques.', $1)`, [empresaId]);

            const administrador = await crearAdministrador(client, empresaId, admin);
            await registrarAuditoria({
                req, accion: 'empresa.crear', recursoTipo: 'empresa', recursoId: empresaId, empresaId,
                detalle: { slug, nombre: datos.nombre, administrador: administrador.usuario.email },
            }, client, true);
            return { empresaId, administrador };
        });
        const { rows } = await q(`${SQL_EMPRESA} WHERE e.id = $2`, [SLUG_PUBLICO, r.empresaId]);
        return res.status(201).json({
            empresa: empresaApi(rows[0]),
            administrador: r.administrador.usuario,
            // Se muestra una sola vez: el superadministrador la entrega en persona.
            password_temporal: r.administrador.password_temporal,
        });
    } catch (err) {
        return responder(res, err, 'crearEmpresa', 'Error al crear la empresa.');
    }
};

// PUT /api/plataforma/empresas/:id   (datos generales; el slug no cambia)
const actualizarEmpresa = async (req, res) => {
    if (!idValido(req.params.id)) return res.status(400).json({ error: 'Identificador invalido.' });
    const { datos, error } = datosEmpresa(req.body || {}, { requerirNombre: false });
    if (error) return res.status(400).json({ error });
    const campos = Object.keys(datos);
    if (!campos.length) return res.status(400).json({ error: 'No hay datos para actualizar.' });
    try {
        const r = await transaccion(async (client) => {
            const { rows: antes } = await client.query('SELECT * FROM empresas WHERE id = $1 FOR UPDATE', [req.params.id]);
            if (!antes[0]) throw new ErrorRespuesta(404, 'Empresa no encontrada.');
            const sets = campos.map((c, i) => `${c} = $${i + 1}`).join(', ');
            await client.query(`UPDATE empresas SET ${sets} WHERE id = $${campos.length + 1}`, [...campos.map(c => datos[c]), req.params.id]);
            const cambios = Object.fromEntries(campos.filter(c => (antes[0][c] || null) !== datos[c]).map(c => [c, { antes: antes[0][c], despues: datos[c] }]));
            if (Object.keys(cambios).length) {
                await registrarAuditoria({ req, accion: 'empresa.editar', recursoTipo: 'empresa', recursoId: req.params.id,
                    empresaId: Number(req.params.id), detalle: { cambios } }, client, true);
            }
        });
        const { rows } = await q(`${SQL_EMPRESA} WHERE e.id = $2`, [SLUG_PUBLICO, req.params.id]);
        return res.json({ empresa: empresaApi(rows[0]), ...r });
    } catch (err) {
        return responder(res, err, 'actualizarEmpresa', 'Error al actualizar la empresa.');
    }
};

// POST /api/plataforma/empresas/:id/logo   (multipart "logo")  ·  DELETE /api/plataforma/empresas/:id/logo
const subirLogoEmpresa = async (req, res) => logoEmpresa(req, res, `upload:${req.file.filename}`);
const quitarLogoEmpresa = async (req, res) => logoEmpresa(req, res, null);

async function logoEmpresa(req, res, valor) {
    const descartar = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
    if (!idValido(req.params.id)) { descartar(); return res.status(400).json({ error: 'Identificador invalido.' }); }
    try {
        const fila = await transaccion(client => guardarLogo(client, { empresaId: Number(req.params.id), valor, req }));
        if (!fila) { descartar(); return res.status(404).json({ error: 'Empresa no encontrada.' }); }
        const { rows } = await q(`${SQL_EMPRESA} WHERE e.id = $2`, [SLUG_PUBLICO, req.params.id]);
        return res.json({ empresa: empresaApi(rows[0]) });
    } catch (err) {
        descartar();
        return responder(res, err, 'logoEmpresa', 'No se pudo guardar el logo de la empresa.');
    }
}

// PATCH /api/plataforma/empresas/:id/estado   body: { estado: activa|suspendida|inactiva, motivo }
// Una empresa no activa deja de poder usar el sistema de inmediato (sus
// sesiones se rechazan en la siguiente peticion). Sus datos se conservan.
const cambiarEstadoEmpresa = async (req, res) => {
    const { estado, motivo } = req.body || {};
    if (!idValido(req.params.id)) return res.status(400).json({ error: 'Identificador invalido.' });
    if (!['activa', 'suspendida', 'inactiva'].includes(estado)) return res.status(400).json({ error: 'Estado invalido.' });
    if (estado !== 'activa' && (!motivo || String(motivo).trim().length < 5))
        return res.status(400).json({ error: 'Indica el motivo de la suspension (minimo 5 caracteres).' });
    try {
        await transaccion(async (client) => {
            const { rows } = await client.query('SELECT id, slug, estado FROM empresas WHERE id = $1 FOR UPDATE', [req.params.id]);
            if (!rows[0]) throw new ErrorRespuesta(404, 'Empresa no encontrada.');
            if (rows[0].slug === SLUG_PUBLICO && estado !== 'activa')
                throw new ErrorRespuesta(400, 'La empresa de la pagina web publica no se puede suspender desde aqui (dejaria de funcionar la web).');
            await client.query('UPDATE empresas SET estado = $1 WHERE id = $2', [estado, req.params.id]);
            if (estado !== 'activa') {
                // Cierra tambien los accesos de soporte abiertos.
                await client.query('UPDATE accesos_soporte SET finalizado_at = NOW() WHERE empresa_id = $1 AND finalizado_at IS NULL', [req.params.id]);
            }
            await registrarAuditoria({
                req, accion: estado === 'activa' ? 'empresa.activar' : 'empresa.suspender', recursoTipo: 'empresa',
                recursoId: req.params.id, empresaId: Number(req.params.id),
                detalle: { antes: rows[0].estado, despues: estado, motivo: motivo ? String(motivo).slice(0, 300) : null },
            }, client, true);
        });
        const { rows } = await q(`${SQL_EMPRESA} WHERE e.id = $2`, [SLUG_PUBLICO, req.params.id]);
        return res.json({ empresa: rows[0] });
    } catch (err) {
        return responder(res, err, 'cambiarEstadoEmpresa', 'Error al cambiar el estado de la empresa.');
    }
};

// POST /api/plataforma/empresas/:id/administrador   body: { nombre?, email }
// Crea un administrador nuevo o restablece el acceso de uno existente de esa empresa.
const administradorEmpresa = async (req, res) => {
    if (!idValido(req.params.id)) return res.status(400).json({ error: 'Identificador invalido.' });
    try {
        const r = await transaccion(async (client) => {
            const { rows } = await client.query('SELECT id FROM empresas WHERE id = $1', [req.params.id]);
            if (!rows[0]) throw new ErrorRespuesta(404, 'Empresa no encontrada.');
            const admin = await crearAdministrador(client, Number(req.params.id), req.body || {});
            await registrarAuditoria({
                req, accion: admin.creado ? 'empresa.crear_administrador' : 'empresa.restablecer_administrador',
                recursoTipo: 'usuario', recursoId: admin.usuario.id, empresaId: Number(req.params.id),
                detalle: { email: admin.usuario.email },
            }, client, true);
            return admin;
        });
        return res.status(r.creado ? 201 : 200).json({ administrador: r.usuario, creado: r.creado, password_temporal: r.password_temporal });
    } catch (err) {
        return responder(res, err, 'administradorEmpresa', 'Error al gestionar el administrador.');
    }
};

// ─────────────────────────────────────────────────────────────
// ACCESOS DE SOPORTE
// ─────────────────────────────────────────────────────────────

// POST /api/plataforma/empresas/:id/soporte   body: { motivo, minutos (15-480), modo: lectura|completo }
const abrirSoporte = async (req, res) => {
    const { motivo, modo = 'lectura' } = req.body || {};
    const minutos = Math.round(Number(req.body?.minutos) || 60);
    if (!idValido(req.params.id)) return res.status(400).json({ error: 'Identificador invalido.' });
    if (!motivo || String(motivo).trim().length < 10) return res.status(400).json({ error: 'Describe el motivo del soporte (minimo 10 caracteres).' });
    if (!['lectura', 'completo'].includes(modo)) return res.status(400).json({ error: 'Modo invalido.' });
    if (minutos < 15 || minutos > 480) return res.status(400).json({ error: 'La duracion debe estar entre 15 minutos y 8 horas.' });
    try {
        const acceso = await transaccion(async (client) => {
            const { rows } = await client.query('SELECT id, estado, permite_soporte FROM empresas WHERE id = $1', [req.params.id]);
            if (!rows[0]) throw new ErrorRespuesta(404, 'Empresa no encontrada.');
            if (!rows[0].permite_soporte)
                throw new ErrorRespuesta(403, 'Esta empresa no autorizo el acceso de soporte. Su administrador debe habilitarlo en Configuracion de la empresa.');
            if (rows[0].estado === 'inactiva') throw new ErrorRespuesta(400, 'La empresa esta inactiva.');
            // Un solo acceso abierto por empresa y superadministrador.
            await client.query(
                `UPDATE accesos_soporte SET finalizado_at = NOW()
                 WHERE superadmin_id = $1 AND empresa_id = $2 AND finalizado_at IS NULL`, [req.usuario.id, req.params.id]);
            const { rows: a } = await client.query(
                `INSERT INTO accesos_soporte (superadmin_id, empresa_id, motivo, modo, expira)
                 VALUES ($1, $2, $3, $4, NOW() + ($5 || ' minutes')::interval)
                 RETURNING id, empresa_id, motivo, modo, inicio, expira`,
                [req.usuario.id, req.params.id, String(motivo).trim().slice(0, 300), modo, String(minutos)]);
            await registrarAuditoria({
                req, accion: 'soporte.abrir', recursoTipo: 'empresa', recursoId: req.params.id, empresaId: Number(req.params.id),
                detalle: { acceso: a[0].id, modo, minutos, motivo: a[0].motivo },
            }, client, true);
            return a[0];
        });
        return res.status(201).json({ acceso });
    } catch (err) {
        return responder(res, err, 'abrirSoporte', 'Error al abrir el acceso de soporte.');
    }
};

// DELETE /api/plataforma/soporte/:id
const cerrarSoporte = async (req, res) => {
    if (!idValido(req.params.id)) return res.status(400).json({ error: 'Identificador invalido.' });
    try {
        const { rows } = await q(
            `UPDATE accesos_soporte SET finalizado_at = NOW()
             WHERE id = $1 AND superadmin_id = $2 AND finalizado_at IS NULL RETURNING id, empresa_id`, [req.params.id, req.usuario.id]);
        if (rows[0]) {
            await sinAislamiento(() => registrarAuditoria({ req, accion: 'soporte.cerrar', recursoTipo: 'empresa',
                recursoId: rows[0].empresa_id, empresaId: rows[0].empresa_id, detalle: { acceso: rows[0].id } }));
        }
        return res.json({ ok: true });
    } catch (err) {
        return responder(res, err, 'cerrarSoporte', 'Error al cerrar el acceso de soporte.');
    }
};

// GET /api/plataforma/soporte
const listarSoporte = async (req, res) => {
    try {
        const { rows } = await q(
            `SELECT a.id, a.empresa_id, e.nombre AS empresa_nombre, a.motivo, a.modo, a.inicio, a.expira, a.finalizado_at,
                    (a.finalizado_at IS NULL AND a.expira > NOW()) AS vigente
             FROM accesos_soporte a JOIN empresas e ON e.id = a.empresa_id
             WHERE a.superadmin_id = $1 ORDER BY a.id DESC LIMIT 50`, [req.usuario.id]);
        return res.json({ accesos: rows });
    } catch (err) {
        return responder(res, err, 'listarSoporte', 'Error al listar los accesos de soporte.');
    }
};

// ─────────────────────────────────────────────────────────────
// AUDITORIA GLOBAL, MIGRACIONES, ERRORES
// ─────────────────────────────────────────────────────────────

// GET /api/plataforma/auditoria?empresa_id=&accion=&resultado=&q=&desde=&hasta=&page=&limit=
const auditoriaGlobal = async (req, res) => {
    const { empresa_id, accion, resultado, desde, hasta } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const where = [];
    const params = [];
    const add = (sql, v) => { params.push(v); where.push(sql.replace('$?', `$${params.length}`)); };
    if (empresa_id === 'global') where.push('a.empresa_id IS NULL');
    else if (empresa_id && idValido(empresa_id)) add('a.empresa_id = $?', Number(empresa_id));
    if (accion && /^[a-z_.]{1,60}$/.test(accion)) {
        if (accion.endsWith('.')) add('a.accion LIKE $?', `${accion}%`); else add('a.accion = $?', accion);
    }
    if (['exito', 'denegado', 'error'].includes(resultado)) add('a.resultado = $?', resultado);
    if (req.query.q && String(req.query.q).trim()) {
        params.push(`%${String(req.query.q).trim().slice(0, 80)}%`);
        where.push(`(a.actor_email ILIKE $${params.length} OR a.detalle::text ILIKE $${params.length})`);
    }
    if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) add('a.created_at >= $?::date', desde);
    if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) add(`a.created_at < ($?::date + INTERVAL '1 day')`, hasta);
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    try {
        const { rows: total } = await q(`SELECT COUNT(*)::int AS n FROM auditoria_seguridad a ${w}`, params);
        const { rows } = await q(
            `SELECT a.id, a.created_at, a.actor_email, a.actor_rol, a.accion, a.recurso_tipo, a.recurso_id, a.resultado,
                    a.detalle, a.ip, a.empresa_id, e.nombre AS empresa_nombre
             FROM auditoria_seguridad a LEFT JOIN empresas e ON e.id = a.empresa_id
             ${w} ORDER BY a.created_at DESC, a.id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
        return res.json({ registros: rows, total: total[0].n, page, limit });
    } catch (err) {
        return responder(res, err, 'auditoriaGlobal', 'Error al obtener la auditoria.');
    }
};

// GET /api/plataforma/migraciones
const listarMigraciones = async (_req, res) => {
    try {
        const { rows } = await q(`SELECT id, version, descripcion, aplicada_at, resultado, detalle FROM migraciones_registro ORDER BY id DESC LIMIT 100`);
        return res.json({ migraciones: rows });
    } catch (err) {
        return responder(res, err, 'listarMigraciones', 'Error al obtener las migraciones.');
    }
};

// GET /api/plataforma/errores
const listarErrores = async (_req, res) => {
    try {
        const { rows } = await q(
            `SELECT x.id, x.created_at, x.metodo, x.ruta, x.estado_http, x.mensaje, x.empresa_id, e.nombre AS empresa_nombre
             FROM errores_sistema x LEFT JOIN empresas e ON e.id = x.empresa_id
             ORDER BY x.created_at DESC LIMIT 200`);
        return res.json({ errores: rows });
    } catch (err) {
        return responder(res, err, 'listarErrores', 'Error al obtener los errores.');
    }
};

// ─────────────────────────────────────────────────────────────
// RESPALDOS
// ─────────────────────────────────────────────────────────────

// GET /api/plataforma/respaldos
const estadoRespaldos = async (_req, res) => {
    try {
        return res.json(await respaldos.estado());
    } catch (err) {
        return responder(res, err, 'estadoRespaldos', 'Error al obtener el estado de los respaldos.');
    }
};

// POST /api/plataforma/respaldos   (respaldo manual)
const respaldoManual = async (req, res) => {
    try {
        const r = await respaldos.realizarRespaldo({ tipo: 'manual', ejecutadoPor: req.usuario.email });
        await sinAislamiento(() => registrarAuditoria({ req, accion: 'respaldo.manual', recursoTipo: 'respaldo',
            recursoId: r.id, resultado: r.resultado === 'exito' ? 'exito' : 'error', detalle: { archivo: r.archivo, motor: r.motor } }));
        return res.status(r.resultado === 'exito' ? 201 : 500).json({ respaldo: r });
    } catch (err) {
        return responder(res, err, 'respaldoManual', 'Error al ejecutar el respaldo.');
    }
};

// POST /api/plataforma/respaldos/prueba   (prueba de restauracion en una base temporal aislada)
const pruebaRestauracion = async (req, res) => {
    try {
        const r = await respaldos.probarRestauracion({ ejecutadoPor: req.usuario.email });
        await sinAislamiento(() => registrarAuditoria({ req, accion: 'respaldo.prueba_restauracion', recursoTipo: 'respaldo',
            recursoId: r.id, resultado: r.resultado === 'exito' ? 'exito' : 'error', detalle: { archivo: r.archivo } }));
        return res.status(r.resultado === 'exito' ? 200 : 500).json({ prueba: r });
    } catch (err) {
        return responder(res, err, 'pruebaRestauracion', 'Error al probar la restauracion.');
    }
};

module.exports = {
    subirLogoEmpresa, quitarLogoEmpresa,
    resumen, listarEmpresas, obtenerEmpresa, crearEmpresa, actualizarEmpresa, cambiarEstadoEmpresa, administradorEmpresa,
    abrirSoporte, cerrarSoporte, listarSoporte, auditoriaGlobal, listarMigraciones, listarErrores,
    estadoRespaldos, respaldoManual, pruebaRestauracion, slugDe,
};
