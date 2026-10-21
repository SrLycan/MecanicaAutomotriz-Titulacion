/**
 * SS SWAP - Controlador de Usuarios, Permisos y Perfil de Cuenta
 *
 * Gestión de usuarios DE LA EMPRESA (permiso "usuarios", ver users.routes.js):
 * - Cada empresa solo ve y modifica a su propio personal: todas las
 *   consultas corren aisladas por empresa (Row Level Security), así que un
 *   id de otra empresa simplemente "no existe" (404).
 * - Altas, edición, activación/desactivación y restablecimiento de acceso.
 * - Permisos individuales por módulo y acción (config/permisos.js). Quien
 *   gestiona solo puede conceder o quitar los permisos que él mismo tiene
 *   (el superadministrador, todos): nadie se da más poder creando otra cuenta.
 * - Cada cambio queda en auditoria_seguridad, dentro de la misma transacción.
 * - Nadie puede crear, promover, editar ni desactivar a un superadministrador
 *   desde la API (además lo impide un trigger en la BD).
 * - Desactivar, cambiar el rol o restablecer el acceso incrementa
 *   token_version: todas las sesiones abiertas de esa cuenta dejan de valer.
 *
 * Perfil personal (cualquier usuario autenticado): datos de contacto,
 * contraseña y foto, sincronizando la tabla 'clientes'.
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');
const pool   = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { firmarToken } = require('./auth.controller');
const { esSuperadmin } = require('../middleware/auth.middleware');
const { registrarAuditoria } = require('../services/auditoria.service');
const {
    ROL_SUPERADMIN, ROLES_STAFF, ROLES_ASIGNABLES, ROLES_TODOS,
    MODULOS, PLANTILLAS, esAsignable,
} = require('../config/permisos');

const ESTADOS_VALIDOS = ['activo','suspendido','bloqueado'];
const PASSWORD_MIN_LEN = 8;
const PASSWORD_MAX_LEN = 72; // limite real de bcrypt
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Columnas que se pueden devolver (nunca password ni token_version).
const CAMPOS_PUBLICOS = `u.id, u.nombre, u.email, u.rol, u.telefono, u.cedula, u.activo, u.estado,
                         u.created_at, u.updated_at, u.ultimo_acceso`;

const idValido = (id) => /^\d+$/.test(String(id)) && Number(id) > 0;

function responderError(res, err, contexto, mensaje) {
    console.error(`Error ${contexto}:`, err.message);
    const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
    return res.status(500).json({ error: mensaje });
}

/** Lee una cuenta (sin datos sensibles). */
async function buscarUsuario(db, id, bloquear = false) {
    const { rows } = await db.query(
        `SELECT ${CAMPOS_PUBLICOS} FROM usuarios u WHERE u.id = $1${bloquear ? ' FOR UPDATE' : ''}`, [id]);
    return rows[0] || null;
}

/**
 * Reglas comunes antes de modificar una cuenta: que exista, que no sea la
 * propia (para eso está el perfil) y que no sea un superadministrador.
 * Devuelve { usuario } o { status, error }.
 */
async function cuentaModificable(db, req, id) {
    if (!idValido(id)) return { status: 400, error: 'Identificador invalido.' };
    if (Number(id) === Number(req.usuario.id))
        return { status: 400, error: 'No puedes modificar tu propia cuenta desde aqui. Usa tu perfil.' };
    const usuario = await buscarUsuario(db, id, true);
    if (!usuario) return { status: 404, error: 'Usuario no encontrado.' };
    if (usuario.rol === ROL_SUPERADMIN)
        return { status: 403, error: 'Las cuentas de superadministrador solo se gestionan desde el servidor.' };
    return { usuario };
}

/** Valida y normaliza una lista de permisos 'modulo:accion'. */
function normalizarPermisos(lista) {
    if (!Array.isArray(lista)) return { error: 'La lista de permisos no es valida.' };
    const set = new Set();
    for (const p of lista) {
        const [modulo, accion] = String(p).split(':');
        if (!esAsignable(modulo, accion)) return { error: `Permiso no valido: ${String(p).slice(0, 60)}.` };
        set.add(`${modulo}:${accion}`);
    }
    return { permisos: [...set].sort() };
}

/**
 * Limita un conjunto de permisos deseados a lo que el actor puede conceder.
 * Lo que el actor no tiene no lo puede dar ni quitar: se conserva como estaba.
 * Devuelve { permisos, ignorados }.
 */
function limitarAlActor(actor, deseados, actuales = []) {
    if (esSuperadmin(actor)) return { permisos: deseados, ignorados: [] };
    const propios = new Set(actor.permisos || []);
    const conservados = actuales.filter(p => !propios.has(p));
    const concedidos = deseados.filter(p => propios.has(p));
    return {
        permisos: [...new Set([...conservados, ...concedidos])].sort(),
        ignorados: deseados.filter(p => !propios.has(p)),
    };
}

async function permisosDeUsuario(db, id) {
    const { rows } = await db.query(
        `SELECT modulo || ':' || accion AS p FROM usuario_permisos WHERE usuario_id = $1 ORDER BY 1`, [id]);
    return rows.map(r => r.p);
}

/** Reemplaza el conjunto de permisos de la cuenta. Devuelve { agregados, revocados }. */
async function guardarPermisos(db, usuarioId, nuevos, otorgadoPor) {
    const actuales = await permisosDeUsuario(db, usuarioId);
    const agregados = nuevos.filter(p => !actuales.includes(p));
    const revocados = actuales.filter(p => !nuevos.includes(p));
    if (revocados.length) {
        await db.query(
            `DELETE FROM usuario_permisos WHERE usuario_id = $1 AND (modulo || ':' || accion) = ANY($2::text[])`,
            [usuarioId, revocados]);
    }
    for (const p of agregados) {
        const [modulo, accion] = p.split(':');
        await db.query(
            `INSERT INTO usuario_permisos (usuario_id, modulo, accion, otorgado_por) VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`, [usuarioId, modulo, accion, otorgadoPor]);
    }
    await db.query('UPDATE usuarios SET permisos_inicializados = TRUE WHERE id = $1', [usuarioId]);
    return { agregados, revocados };
}

/** Ejecuta fn(client) dentro de una transacción. */
async function enTransaccion(fn) {
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
}

/** Error "controlado" dentro de una transacción → se responde tal cual. */
class ErrorRespuesta extends Error {
    constructor(status, error) { super(error); this.status = status; this.error = error; }
}
const fallar = (r) => { throw new ErrorRespuesta(r.status, r.error); };

function validarPassword(password) {
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LEN)
        return `La contrasena debe tener al menos ${PASSWORD_MIN_LEN} caracteres.`;
    if (password.length > PASSWORD_MAX_LEN)
        return `La contrasena no puede tener mas de ${PASSWORD_MAX_LEN} caracteres.`;
    return null;
}

/** Contraseña temporal aleatoria (se muestra una sola vez al superadministrador). */
function generarPasswordTemporal() {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = crypto.randomBytes(12);
    let s = '';
    for (const b of bytes) s += alfabeto[b % alfabeto.length];
    return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

function validarDatosBasicos({ nombre, email, telefono, cedula }) {
    if (!nombre || !String(nombre).trim()) return 'El nombre es obligatorio.';
    if (String(nombre).trim().length > 100) return 'El nombre es demasiado largo.';
    if (!email || !EMAIL_RE.test(String(email).trim())) return 'El correo no es valido.';
    if (String(email).length > 150) return 'El correo es demasiado largo.';
    if (telefono && String(telefono).length > 20) return 'El telefono no es valido.';
    if (cedula && String(cedula).length > 20) return 'La cedula no es valida.';
    return null;
}

// ─────────────────────────────────────────────────────────────
// CATALOGO DE PERMISOS
// GET /api/users/catalogo-permisos   (superadmin)
// ─────────────────────────────────────────────────────────────
const catalogoPermisos = (req, res) => {
    const modulos = MODULOS.filter(m => !m.soloSuperadmin);
    const todos = modulos.flatMap(m => m.acciones.map(a => `${m.codigo}:${a.codigo}`));
    return res.json({
        modulos,
        plantillas: PLANTILLAS,
        roles: ROLES_ASIGNABLES,
        // Lo que ESTA persona puede conceder (el resto se muestra bloqueado).
        concedibles: esSuperadmin(req.usuario) ? todos : todos.filter(p => (req.usuario.permisos || []).includes(p)),
    });
};

// ─────────────────────────────────────────────────────────────
// LISTAR USUARIOS
// GET /api/users   (superadmin)
// query: q (nombre, correo o cedula), rol, estado
// ─────────────────────────────────────────────────────────────
const listarUsuarios = async (req, res) => {
    const { q, rol, estado } = req.query;
    let query = `SELECT ${CAMPOS_PUBLICOS},
                        (SELECT COUNT(*)::int FROM usuario_permisos up WHERE up.usuario_id = u.id) AS total_permisos
                 FROM usuarios u WHERE 1=1`;
    const params = [];

    if (q && String(q).trim()) {
        params.push(`%${String(q).trim().slice(0, 100)}%`);
        query += ` AND (u.nombre ILIKE $${params.length} OR u.email ILIKE $${params.length} OR u.cedula ILIKE $${params.length})`;
    }
    if (rol === 'staff') {
        params.push(ROLES_STAFF);
        query += ` AND u.rol = ANY($${params.length})`;
    } else if (rol && ROLES_TODOS.includes(rol)) {
        params.push(rol);
        query += ` AND u.rol = $${params.length}`;
    }
    if (estado && ESTADOS_VALIDOS.includes(estado)) {
        params.push(estado);
        query += ` AND u.estado = $${params.length}`;
    }
    query += ` ORDER BY (u.rol = '${ROL_SUPERADMIN}') DESC, u.created_at DESC`;

    try {
        const { rows } = await pool.query(query, params);
        return res.json({ usuarios: rows, total: rows.length });
    } catch (err) {
        return responderError(res, err, 'listarUsuarios', 'Error al obtener usuarios.');
    }
};

// ─────────────────────────────────────────────────────────────
// DETALLE (datos + permisos + ultimos cambios)
// GET /api/users/:id   (superadmin)
// ─────────────────────────────────────────────────────────────
const obtenerUsuario = async (req, res) => {
    const { id } = req.params;
    if (!idValido(id)) return res.status(400).json({ error: 'Identificador invalido.' });
    try {
        const usuario = await buscarUsuario(pool, id);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado.' });
        const permisos = usuario.rol === ROL_SUPERADMIN ? ['*'] : await permisosDeUsuario(pool, id);
        const { rows: historial } = await pool.query(
            `SELECT id, created_at, actor_email, accion, resultado, detalle
             FROM auditoria_seguridad WHERE recurso_tipo = 'usuario' AND recurso_id = $1
             ORDER BY created_at DESC, id DESC LIMIT 30`, [String(id)]);
        return res.json({ usuario, permisos, historial });
    } catch (err) {
        return responderError(res, err, 'obtenerUsuario', 'Error al obtener el usuario.');
    }
};

// ─────────────────────────────────────────────────────────────
// CREAR USUARIO
// POST /api/users   (superadmin)
// body: { nombre, email, password?, rol, telefono?, cedula?, permisos? }
// Sin "password" se genera una temporal y se devuelve UNA vez.
// Sin "permisos" se aplica la plantilla del rol.
// ─────────────────────────────────────────────────────────────
const crearUsuario = async (req, res) => {
    const { nombre, email, password, rol, telefono, cedula, permisos } = req.body || {};
    const errDatos = validarDatosBasicos(req.body || {});
    if (errDatos) return res.status(400).json({ error: errDatos });
    if (!ROLES_ASIGNABLES.includes(rol)) return res.status(400).json({ error: 'Rol invalido.' });

    const passwordFinal = password ? String(password) : generarPasswordTemporal();
    const errPass = validarPassword(passwordFinal);
    if (errPass) return res.status(400).json({ error: errPass });

    const esStaff = ROLES_STAFF.includes(rol);
    let listaPermisos = [];
    let ignorados = [];
    if (esStaff) {
        const n = normalizarPermisos(permisos === undefined ? (PLANTILLAS[rol] || []) : permisos);
        if (n.error) return res.status(400).json({ error: n.error });
        ({ permisos: listaPermisos, ignorados } = limitarAlActor(req.usuario, n.permisos));
    }

    const emailNorm = String(email).toLowerCase().trim();
    try {
        const resultado = await enTransaccion(async (client) => {
            const { rows: existe } = await client.query('SELECT id FROM usuarios WHERE email = $1', [emailNorm]);
            if (existe.length) fallar({ status: 409, error: 'Ya existe un usuario con ese email.' });

            const hash = await bcrypt.hash(passwordFinal, 10);
            const { rows } = await client.query(
                `INSERT INTO usuarios (nombre, email, password, rol, telefono, cedula, permisos_inicializados)
                 VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                 RETURNING id`,
                [String(nombre).trim(), emailNorm, hash, rol, telefono || null, cedula || null]
            );
            const nuevoId = rows[0].id;
            if (esStaff) await guardarPermisos(client, nuevoId, listaPermisos, req.usuario.id);
            await registrarAuditoria({
                req, accion: 'usuario.crear', recursoTipo: 'usuario', recursoId: nuevoId,
                detalle: { email: emailNorm, rol, permisos_otorgados: listaPermisos },
            }, client, true);
            return nuevoId;
        });
        const usuario = await buscarUsuario(pool, resultado);
        return res.status(201).json({
            usuario,
            permisos: listaPermisos,
            permisos_no_concedidos: ignorados,
            // Solo cuando la genero el servidor: el superadministrador la entrega en persona.
            password_temporal: password ? undefined : passwordFinal,
        });
    } catch (err) {
        if (err instanceof ErrorRespuesta) return res.status(err.status).json({ error: err.error });
        return responderError(res, err, 'crearUsuario', 'Error al crear usuario.');
    }
};

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR DATOS (nombre, email, telefono, cedula)
// PUT /api/users/:id   (superadmin)
// ─────────────────────────────────────────────────────────────
const actualizarUsuario = async (req, res) => {
    const { id } = req.params;
    const { nombre, email, telefono, cedula } = req.body || {};
    const errDatos = validarDatosBasicos(req.body || {});
    if (errDatos) return res.status(400).json({ error: errDatos });
    const emailNorm = String(email).toLowerCase().trim();

    try {
        const usuario = await enTransaccion(async (client) => {
            const r = await cuentaModificable(client, req, id);
            if (r.error) fallar(r);
            const { rows: existe } = await client.query(
                'SELECT id FROM usuarios WHERE email = $1 AND id <> $2', [emailNorm, id]);
            if (existe.length) fallar({ status: 409, error: 'Ya existe otro usuario con ese email.' });

            await client.query(
                `UPDATE usuarios SET nombre = $1, email = $2, telefono = $3, cedula = $4 WHERE id = $5`,
                [String(nombre).trim(), emailNorm, telefono || null, cedula || null, id]);

            const antes = r.usuario;
            const cambios = {};
            const despues = { nombre: String(nombre).trim(), email: emailNorm, telefono: telefono || null, cedula: cedula || null };
            for (const k of Object.keys(despues)) if ((antes[k] || null) !== despues[k]) cambios[k] = { antes: antes[k] || null, despues: despues[k] };
            if (Object.keys(cambios).length) {
                await registrarAuditoria({ req, accion: 'usuario.editar', recursoTipo: 'usuario', recursoId: id, detalle: { cambios } }, client, true);
            }
            return buscarUsuario(client, id);
        });
        return res.json({ usuario });
    } catch (err) {
        if (err instanceof ErrorRespuesta) return res.status(err.status).json({ error: err.error });
        return responderError(res, err, 'actualizarUsuario', 'Error al actualizar usuario.');
    }
};

// ─────────────────────────────────────────────────────────────
// CAMBIAR ROL
// PUT /api/users/:id/rol   (superadmin)   body: { rol, aplicar_plantilla? }
// Nunca hacia ni desde superadministrador. Cierra las sesiones de la cuenta.
// ─────────────────────────────────────────────────────────────
const cambiarRol = async (req, res) => {
    const { id } = req.params;
    const { rol, aplicar_plantilla } = req.body || {};
    if (!ROLES_ASIGNABLES.includes(rol))
        return res.status(400).json({ error: `Rol invalido. Permitidos: ${ROLES_ASIGNABLES.join(', ')}.` });

    try {
        const resultado = await enTransaccion(async (client) => {
            const r = await cuentaModificable(client, req, id);
            if (r.error) fallar(r);
            const anterior = r.usuario.rol;
            await client.query('UPDATE usuarios SET rol = $1, token_version = token_version + 1 WHERE id = $2', [rol, id]);

            let cambiosPermisos = null;
            if (!ROLES_STAFF.includes(rol)) {
                // Un cliente del portal nunca conserva permisos del panel.
                cambiosPermisos = await guardarPermisos(client, id, [], req.usuario.id);
            } else if (aplicar_plantilla) {
                const actuales = await permisosDeUsuario(client, id);
                const { permisos } = limitarAlActor(req.usuario, [...(PLANTILLAS[rol] || [])].sort(), actuales);
                cambiosPermisos = await guardarPermisos(client, id, permisos, req.usuario.id);
            }
            await registrarAuditoria({
                req, accion: 'usuario.cambiar_rol', recursoTipo: 'usuario', recursoId: id,
                detalle: { antes: anterior, despues: rol, ...(cambiosPermisos || {}) },
            }, client, true);
            return { usuario: await buscarUsuario(client, id), permisos: await permisosDeUsuario(client, id) };
        });
        return res.json(resultado);
    } catch (err) {
        if (err instanceof ErrorRespuesta) return res.status(err.status).json({ error: err.error });
        return responderError(res, err, 'cambiarRol', 'Error al cambiar rol.');
    }
};

// ─────────────────────────────────────────────────────────────
// CAMBIAR ESTADO (activar / desactivar)
// PUT /api/users/:id/estado   (superadmin)   body: { estado }
// Al desactivar se invalidan todas sus sesiones abiertas.
// ─────────────────────────────────────────────────────────────
const cambiarEstado = async (req, res) => {
    const { id }     = req.params;
    const { estado } = req.body || {};

    if (!ESTADOS_VALIDOS.includes(estado))
        return res.status(400).json({ error: `Estado invalido. Permitidos: ${ESTADOS_VALIDOS.join(', ')}.` });

    try {
        const usuario = await enTransaccion(async (client) => {
            const r = await cuentaModificable(client, req, id);
            if (r.error) fallar(r);
            const activo = estado === 'activo';
            await client.query(
                `UPDATE usuarios SET estado = $1, activo = $2,
                        token_version = token_version + CASE WHEN $2 THEN 0 ELSE 1 END
                 WHERE id = $3`, [estado, activo, id]);
            await registrarAuditoria({
                req, accion: activo ? 'usuario.activar' : 'usuario.desactivar', recursoTipo: 'usuario', recursoId: id,
                detalle: { antes: r.usuario.estado, despues: estado },
            }, client, true);
            return buscarUsuario(client, id);
        });
        return res.json({ usuario });
    } catch (err) {
        if (err instanceof ErrorRespuesta) return res.status(err.status).json({ error: err.error });
        return responderError(res, err, 'cambiarEstado', 'Error al cambiar estado.');
    }
};

// ─────────────────────────────────────────────────────────────
// PERMISOS
// PUT /api/users/:id/permisos   (superadmin)   body: { permisos: ['modulo:accion', ...] }
// Reemplaza el conjunto completo. Surte efecto en la siguiente peticion del
// usuario (los permisos se leen de la BD en cada peticion).
// ─────────────────────────────────────────────────────────────
const actualizarPermisos = async (req, res) => {
    const { id } = req.params;
    const n = normalizarPermisos(req.body?.permisos);
    if (n.error) return res.status(400).json({ error: n.error });

    try {
        const resultado = await enTransaccion(async (client) => {
            const r = await cuentaModificable(client, req, id);
            if (r.error) fallar(r);
            if (!ROLES_STAFF.includes(r.usuario.rol))
                fallar({ status: 400, error: 'Los clientes del portal no pueden tener permisos del panel.' });

            const actuales = await permisosDeUsuario(client, id);
            const { permisos: finales, ignorados } = limitarAlActor(req.usuario, n.permisos, actuales);
            const { agregados, revocados } = await guardarPermisos(client, id, finales, req.usuario.id);
            if (agregados.length || revocados.length) {
                await registrarAuditoria({
                    req, accion: 'permisos.actualizar', recursoTipo: 'usuario', recursoId: id,
                    detalle: { email: r.usuario.email, otorgados: agregados, revocados },
                }, client, true);
            }
            return { permisos: await permisosDeUsuario(client, id), agregados, revocados, permisos_no_concedidos: ignorados };
        });
        return res.json(resultado);
    } catch (err) {
        if (err instanceof ErrorRespuesta) return res.status(err.status).json({ error: err.error });
        return responderError(res, err, 'actualizarPermisos', 'Error al guardar los permisos.');
    }
};

// ─────────────────────────────────────────────────────────────
// RESTABLECER ACCESO
// PUT /api/users/:id/password   (superadmin)   body: { password? }
// Sin "password" se genera una temporal segura. En ambos casos se cierran
// todas las sesiones abiertas de la cuenta.
// ─────────────────────────────────────────────────────────────
const cambiarPassword = async (req, res) => {
    const { id } = req.params;
    const generada = !req.body?.password;
    const password = generada ? generarPasswordTemporal() : String(req.body.password);
    const errPass = validarPassword(password);
    if (errPass) return res.status(400).json({ error: errPass });

    try {
        await enTransaccion(async (client) => {
            const r = await cuentaModificable(client, req, id);
            if (r.error) fallar(r);
            const hash = await bcrypt.hash(password, 10);
            await client.query(
                'UPDATE usuarios SET password = $1, token_version = token_version + 1 WHERE id = $2', [hash, id]);
            await registrarAuditoria({
                req, accion: 'usuario.restablecer_acceso', recursoTipo: 'usuario', recursoId: id,
                detalle: { email: r.usuario.email, contrasena_generada: generada },
            }, client, true);
        });
        return res.json({
            ok: true,
            mensaje: 'Acceso restablecido. Las sesiones abiertas de esa cuenta se cerraron.',
            password_temporal: generada ? password : undefined,
        });
    } catch (err) {
        if (err instanceof ErrorRespuesta) return res.status(err.status).json({ error: err.error });
        return responderError(res, err, 'cambiarPassword', 'Error al restablecer el acceso.');
    }
};

// ─────────────────────────────────────────────────────────────
// CERRAR SESIONES
// POST /api/users/:id/cerrar-sesiones   (superadmin)
// ─────────────────────────────────────────────────────────────
const cerrarSesiones = async (req, res) => {
    const { id } = req.params;
    try {
        await enTransaccion(async (client) => {
            const r = await cuentaModificable(client, req, id);
            if (r.error) fallar(r);
            await client.query('UPDATE usuarios SET token_version = token_version + 1 WHERE id = $1', [id]);
            await registrarAuditoria({ req, accion: 'usuario.cerrar_sesiones', recursoTipo: 'usuario', recursoId: id }, client, true);
        });
        return res.json({ ok: true, mensaje: 'Se cerraron todas las sesiones de esa cuenta.' });
    } catch (err) {
        if (err instanceof ErrorRespuesta) return res.status(err.status).json({ error: err.error });
        return responderError(res, err, 'cerrarSesiones', 'Error al cerrar las sesiones.');
    }
};

// ─────────────────────────────────────────────────────────────
// ELIMINAR USUARIO
// DELETE /api/users/:id   (superadmin)
// Solo cuentas sin operaciones registradas; si tiene historial se debe
// desactivar (las llaves foraneas de la BD tambien lo impiden).
// ─────────────────────────────────────────────────────────────
const eliminarUsuario = async (req, res) => {
    const { id } = req.params;

    try {
        await enTransaccion(async (client) => {
            const r = await cuentaModificable(client, req, id);
            if (r.error) fallar(r);
            const { rows: mov } = await client.query(
                'SELECT COUNT(*)::int AS n FROM movimientos_inventario WHERE usuario_id = $1', [id]);
            if (mov[0].n > 0) {
                fallar({ status: 409, error: `Este usuario tiene ${mov[0].n} movimiento(s) registrado(s). Desactiva su acceso en lugar de eliminarlo.` });
            }
            await client.query('DELETE FROM usuarios WHERE id = $1', [id]);
            await registrarAuditoria({
                req, accion: 'usuario.eliminar', recursoTipo: 'usuario', recursoId: id,
                detalle: { email: r.usuario.email, rol: r.usuario.rol },
            }, client, true);
        });
        return res.json({ ok: true });
    } catch (err) {
        if (err instanceof ErrorRespuesta) return res.status(err.status).json({ error: err.error });
        if (err.code === '23503')
            return res.status(409).json({ error: 'Este usuario tiene registros del negocio asociados. Desactiva su acceso en lugar de eliminarlo.' });
        return responderError(res, err, 'eliminarUsuario', 'Error al eliminar usuario.');
    }
};

// ─────────────────────────────────────────────────────────────
// TECNICOS (para asignar ordenes de trabajo)
// GET /api/users/tecnicos   (quien puede ver/asignar ordenes)
// ─────────────────────────────────────────────────────────────
const listarTecnicos = async (_req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, nombre, email FROM usuarios
             WHERE rol = 'tecnico' AND activo AND estado = 'activo' ORDER BY nombre`);
        return res.json({ usuarios: rows, total: rows.length });
    } catch (err) {
        return responderError(res, err, 'listarTecnicos', 'Error al obtener los tecnicos.');
    }
};

// ─────────────────────────────────────────────────────────────
// AUDITORIA
// GET /api/users/auditoria   (permiso auditoria: solo la propia empresa)
// query: accion, resultado, usuario_id (afectado), actor_id, q, desde, hasta, page, limit
// ─────────────────────────────────────────────────────────────
const listarAuditoria = async (req, res) => {
    const { accion, resultado, usuario_id, actor_id, q, desde, hasta } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const where = [];
    const params = [];
    const add = (sql, v) => { params.push(v); where.push(sql.replace('$?', `$${params.length}`)); };

    if (accion && /^[a-z_.]{1,60}$/.test(accion)) {
        if (accion.endsWith('.')) add(`accion LIKE $?`, `${accion}%`); else add('accion = $?', accion);
    }
    if (['exito', 'denegado', 'error'].includes(resultado)) add('resultado = $?', resultado);
    if (usuario_id && idValido(usuario_id)) { add(`recurso_tipo = 'usuario' AND recurso_id = $?`, String(usuario_id)); }
    if (actor_id && idValido(actor_id)) add('actor_id = $?', Number(actor_id));
    if (q && String(q).trim()) {
        params.push(`%${String(q).trim().slice(0, 80)}%`);
        where.push(`(actor_email ILIKE $${params.length} OR detalle::text ILIKE $${params.length})`);
    }
    if (desde && /^\d{4}-\d{2}-\d{2}$/.test(desde)) add('created_at >= $?::date', desde);
    if (hasta && /^\d{4}-\d{2}-\d{2}$/.test(hasta)) add(`created_at < ($?::date + INTERVAL '1 day')`, hasta);

    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    try {
        const { rows: total } = await pool.query(`SELECT COUNT(*)::int AS n FROM auditoria_seguridad ${w}`, params);
        const { rows } = await pool.query(
            `SELECT a.id, a.created_at, a.actor_id, a.actor_email, a.actor_rol, a.accion, a.recurso_tipo, a.recurso_id,
                    a.resultado, a.detalle, a.ip,
                    CASE WHEN a.recurso_tipo = 'usuario' THEN (SELECT u.email FROM usuarios u WHERE u.id::text = a.recurso_id) END AS recurso_email
             FROM (SELECT * FROM auditoria_seguridad ${w}) a
             ORDER BY a.created_at DESC, a.id DESC
             LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params);
        return res.json({ registros: rows, total: total[0].n, page, limit });
    } catch (err) {
        return responderError(res, err, 'listarAuditoria', 'Error al obtener la auditoria.');
    }
};

// ─────────────────────────────────────────────────────────────
// PERFIL PROPIO (cualquier usuario autenticado: cliente o staff)
// ─────────────────────────────────────────────────────────────

/** Genera y firma un nuevo JWT con los datos actualizados del usuario (conserva su token_version). */
async function reemitirToken(usuarioRow) {
    const { rows } = await pool.query('SELECT token_version FROM usuarios WHERE id = $1', [usuarioRow.id]);
    return firmarToken({ ...usuarioRow, token_version: rows[0]?.token_version });
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
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
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

        // El portal vincula la cuenta con el cliente del taller POR CORREO: tomar
        // el correo de otro cliente (que aun no tiene cuenta) daria acceso a sus
        // ordenes, vehiculos y pagos.
        if (emailNuevo !== emailActual) {
            const { rows: esDeOtroCliente } = await pool.query(
                'SELECT 1 FROM clientes WHERE LOWER(email) = $1 LIMIT 1', [emailNuevo]
            );
            if (esDeOtroCliente.length > 0) return res.status(409).json({ error: 'Ese correo pertenece a otro cliente del taller.' });
        }

        // clientes.cedula tiene restriccion UNIQUE: se valida antes de escribir para
        // no dejar "usuarios" actualizado mientras la sincronizacion con "clientes" falla.
        if (cedulaLimpia) {
            const { rows: existeCedula } = await pool.query(
                'SELECT id FROM clientes WHERE cedula = $1 AND LOWER(email) != $2', [cedulaLimpia, emailActual]
            );
            if (existeCedula.length > 0) return res.status(409).json({ error: 'Ya existe otro cliente registrado con esa cedula.' });
        }

        let client;
        let usuarioActualizado;
        try {
            client = await pool.connect();
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
            await client?.query('ROLLBACK');
            throw err;
        } finally {
            client?.release();
        }

        const { token, usuario } = await reemitirToken(usuarioActualizado);
        return res.json({ usuario: usuarioActualizado, token, sesion: usuario });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Ese correo o cedula ya esta en uso por otro registro.' });
        console.error('Error actualizarMiPerfil:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
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
    if (typeof password_nueva !== 'string' || password_nueva.length < PASSWORD_MIN_LEN)
        return res.status(400).json({ error: `La nueva contrasena debe tener al menos ${PASSWORD_MIN_LEN} caracteres.` });
    if (password_nueva.length > PASSWORD_MAX_LEN)
        return res.status(400).json({ error: `La contrasena no puede tener mas de ${PASSWORD_MAX_LEN} caracteres.` });

    try {
        const { rows } = await pool.query('SELECT password FROM usuarios WHERE id = $1', [req.usuario.id]);
        if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado.' });

        const ok = await bcrypt.compare(String(password_actual), rows[0].password);
        if (!ok) return res.status(400).json({ error: 'Tu contrasena actual no es correcta.' });

        // Cambiar la contrasena cierra TODAS las demas sesiones (token_version + 1):
        // si alguien tenia un token robado, deja de servir. Esta sesion recibe uno nuevo.
        const hash = await bcrypt.hash(password_nueva, 10);
        const { rows: act } = await pool.query(
            `UPDATE usuarios SET password = $1, token_version = token_version + 1 WHERE id = $2
             RETURNING id, nombre, email, rol, token_version`, [hash, req.usuario.id]);
        registrarAuditoria({ req, accion: 'usuario.password_cambiada', recursoTipo: 'usuario', recursoId: req.usuario.id,
            detalle: { otras_sesiones_cerradas: true } });
        const { token } = firmarToken(act[0]);
        return res.json({ ok: true, token, mensaje: 'Contrasena actualizada. Se cerraron tus otras sesiones abiertas.' });
    } catch (err) {
        console.error('Error cambiarMiPassword:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
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

        const { token, usuario } = await reemitirToken(rows[0]);
        return res.json({ usuario: rows[0], token, sesion: usuario });
    } catch (err) {
        console.error('Error subirMiFoto:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al guardar la foto de perfil.' });
    }
};


module.exports = {
    catalogoPermisos, listarUsuarios, obtenerUsuario, crearUsuario, actualizarUsuario,
    cambiarRol, cambiarEstado, actualizarPermisos, cambiarPassword, cerrarSesiones, eliminarUsuario,
    listarTecnicos, listarAuditoria,
    obtenerMiPerfil, actualizarMiPerfil, cambiarMiPassword, subirMiFoto,
};
