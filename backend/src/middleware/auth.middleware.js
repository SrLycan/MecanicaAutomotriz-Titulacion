/**
 * SS SWAP - Middlewares de Autenticación y Autorización
 *
 * verificarToken valida el JWT del header Authorization y, en cada petición,
 * vuelve a leer la cuenta en la BD: si fue desactivada, cambió de rol o se le
 * restableció el acceso (token_version distinto), la sesión deja de servir de
 * inmediato. También carga los permisos vigentes, así que revocar un permiso
 * surte efecto en la siguiente petición sin esperar a que expire el token.
 *
 * Multiempresa (Sprint 22): verificarToken decide la EMPRESA de la petición
 * a partir de la cuenta autenticada (nunca de un dato del navegador) y
 * ejecuta el resto de la petición dentro de ese contexto: todas las
 * consultas quedan aisladas por la base de datos (Row Level Security).
 *  - Personal y clientes: su propia empresa. Si la empresa está suspendida o
 *    inactiva, la sesión deja de valer.
 *  - Superadministrador: su empresa propia (si tiene una) o, si envía la
 *    cabecera X-Soporte-Empresa, la empresa de un acceso de soporte VIGENTE
 *    que él abrió con motivo (tabla accesos_soporte). Sin eso no ve datos de
 *    ninguna empresa; solo la plataforma.
 *
 * Autorización:
 *  - verificarRol / soloStaff: por rol (portal de clientes vs. personal).
 *  - requierePermiso(modulo, accion) / requiereAlguno([...]): por permiso
 *    individual del catálogo (config/permisos.js). El superadministrador
 *    pasa siempre DENTRO de una empresa (en soporte de solo lectura, solo "ver").
 *  - soloSuperadmin: administración de la plataforma.
 */
const jwt  = require('jsonwebtoken');
const pool = require('../config/db');
const { conEmpresa, sinAislamiento } = require('../config/contexto');
const { ROL_SUPERADMIN, ROLES_STAFF, moduloProforma, moduloInventario, AREAS_INVENTARIO } = require('../config/permisos');
const { registrarDenegado, registrarAuditoria } = require('../services/auditoria.service');

const SQL_SESION = `
    SELECT u.id, u.nombre, u.email, u.rol, u.activo, u.estado, u.token_version, u.empresa_id,
           e.nombre AS empresa_nombre, e.slug AS empresa_slug, e.estado AS empresa_estado,
           ARRAY(SELECT up.modulo || ':' || up.accion FROM usuario_permisos up WHERE up.usuario_id = u.id) AS permisos
    FROM usuarios u LEFT JOIN empresas e ON e.id = u.empresa_id
    WHERE u.id = $1`;

/** Lee la cuenta, su empresa y sus permisos vigentes (null si no existe). Ve todas las empresas. */
async function cargarSesion(id) {
    const { rows } = await sinAislamiento(() => pool.query(SQL_SESION, [id]));
    return rows[0] || null;
}

/** Acceso de soporte vigente del superadministrador a una empresa (o null). */
async function cargarSoporte(superadminId, empresaId) {
    const { rows } = await sinAislamiento(() => pool.query(
        `SELECT a.id, a.empresa_id, a.modo, a.expira, a.motivo, e.nombre AS empresa_nombre, e.slug AS empresa_slug
         FROM accesos_soporte a JOIN empresas e ON e.id = a.empresa_id
         WHERE a.superadmin_id = $1 AND a.empresa_id = $2 AND a.finalizado_at IS NULL AND a.expira > NOW()
           AND e.estado <> 'inactiva'
         ORDER BY a.id DESC LIMIT 1`, [superadminId, empresaId]));
    return rows[0] || null;
}

/** true si la cuenta puede usar el sistema ahora mismo. */
const cuentaHabilitada = (u) => Boolean(u && u.activo && u.estado === 'activo');

/**
 * Verifica el JWT en el header Authorization y la vigencia de la cuenta.
 * Adjunta req.usuario = { id, nombre, email, rol, permisos: ['modulo:accion', ...] }
 * con los datos ACTUALES de la BD (no los que venían dentro del token).
 */
const verificarToken = async (req, res, next) => {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer '))
        return res.status(401).json({ error: 'Token de acceso requerido.' });

    const token = header.split(' ')[1];
    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
        const msg = err.name === 'TokenExpiredError'
            ? 'Token expirado. Inicia sesion nuevamente.'
            : 'Token invalido.';
        return res.status(401).json({ error: msg });
    }

    try {
        const u = await cargarSesion(payload.id);
        // Tokens emitidos antes de token_version no traen "tv": cuentan como 0.
        if (!u || Number(u.token_version) !== Number(payload.tv ?? 0))
            return res.status(401).json({ error: 'Tu sesion ya no es valida. Inicia sesion nuevamente.', codigo: 'SESION_REVOCADA' });
        if (!cuentaHabilitada(u))
            return res.status(401).json({ error: 'Tu cuenta esta desactivada. Contacta al administrador.', codigo: 'CUENTA_INACTIVA' });
        if (u.empresa_id && u.empresa_estado !== 'activa' && u.rol !== ROL_SUPERADMIN)
            return res.status(401).json({ error: 'La empresa de esta cuenta no esta activa. Contacta al administrador de la plataforma.', codigo: 'EMPRESA_INACTIVA' });

        // Empresa de la peticion: la de la cuenta, o la de un soporte vigente.
        let empresa = u.empresa_id ? { id: u.empresa_id, nombre: u.empresa_nombre, slug: u.empresa_slug } : null;
        let soporte = null;
        const pedido = req.headers['x-soporte-empresa'];
        if (pedido !== undefined && pedido !== '') {
            if (u.rol !== ROL_SUPERADMIN || !/^\d+$/.test(String(pedido)))
                return res.status(403).json({ error: 'Acceso de soporte no permitido.', codigo: 'SOPORTE_NO_VALIDO' });
            const acceso = await cargarSoporte(u.id, Number(pedido));
            if (!acceso)
                return res.status(403).json({ error: 'El acceso de soporte vencio o no existe. Abre uno nuevo desde la plataforma.', codigo: 'SOPORTE_NO_VALIDO' });
            soporte = { id: acceso.id, modo: acceso.modo, expira: acceso.expira, motivo: acceso.motivo };
            empresa = { id: acceso.empresa_id, nombre: acceso.empresa_nombre, slug: acceso.empresa_slug };
        }

        req.usuario = {
            id: u.id, nombre: u.nombre, email: u.email, rol: u.rol,
            empresa_id: empresa?.id ?? null,
            empresa,
            soporte,
            permisos: ROLES_STAFF.includes(u.rol) ? (u.permisos || []) : [],
        };

        // Todo lo que siga en esta peticion queda aislado en esa empresa.
        return conEmpresa(req.usuario.empresa_id, () => {
            // Trazabilidad del soporte: cada accion que modifica algo queda auditada.
            if (soporte && req.method !== 'GET' && req.method !== 'HEAD') {
                registrarAuditoria({
                    req, accion: 'soporte.accion', recursoTipo: 'endpoint',
                    recursoId: `${req.method} ${(req.originalUrl || '').split('?')[0]}`.slice(0, 60),
                    detalle: { acceso_soporte: soporte.id, modo: soporte.modo },
                });
            }
            return next();
        }, { usuarioId: u.id, soporteId: soporte?.id ?? null });
    } catch (err) {
        console.error('Error verificando sesion:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

/**
 * Restringe la ruta a los roles indicados.
 * Uso: verificarRol('administrador', 'tecnico')
 */
const verificarRol = (...rolesPermitidos) => (req, res, next) => {
    if (!req.usuario)
        return res.status(401).json({ error: 'No autenticado.' });
    if (!rolesPermitidos.includes(req.usuario.rol))
        return res.status(403).json({
            error: `Acceso denegado. Roles permitidos: ${rolesPermitidos.join(', ')}.`
        });
    next();
};

/**
 * Solo personal interno del taller (excluye clientes)
 */
const soloStaff = verificarRol(...ROLES_STAFF);

const esSuperadmin = (usuario) => usuario?.rol === ROL_SUPERADMIN;

/** true si el usuario tiene el permiso (modulo, accion). Nunca confía en el navegador: usa req.usuario. */
function puede(usuario, modulo, accion) {
    if (!usuario) return false;
    if (esSuperadmin(usuario)) {
        // Solo dentro de una empresa (la propia o un soporte vigente).
        if (!usuario.empresa_id) return false;
        if (usuario.soporte?.modo === 'lectura' && accion !== 'ver') return false;
        return true;
    }
    return ROLES_STAFF.includes(usuario.rol)
        && Array.isArray(usuario.permisos)
        && usuario.permisos.includes(`${modulo}:${accion}`);
}

/** Responde 403 y deja constancia (con límite) en la auditoría. */
function denegar(req, res, pares) {
    const requeridos = pares.map(([m, a]) => `${m}:${a}`).join(' | ');
    registrarDenegado(req, requeridos);
    return res.status(403).json({ error: 'No tienes permiso para realizar esta accion.', codigo: 'SIN_PERMISO' });
}

/** Deja pasar si el usuario tiene AL MENOS UNO de los permisos [modulo, accion] indicados. */
const requiereAlguno = (...pares) => (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: 'No autenticado.' });
    if (pares.some(([m, a]) => puede(req.usuario, m, a))) return next();
    return denegar(req, res, pares);
};

/** Exige el permiso (modulo, accion). */
const requierePermiso = (modulo, accion) => requiereAlguno([modulo, accion]);

/** Permiso según el verbo HTTP: GET=ver, POST=crear, PUT/PATCH=editar, DELETE=eliminar. */
const ACCION_POR_METODO = { GET: 'ver', HEAD: 'ver', POST: 'crear', PUT: 'editar', PATCH: 'editar', DELETE: 'eliminar' };
const permisoPorMetodo = (modulo) => (req, res, next) =>
    requierePermiso(modulo, ACCION_POR_METODO[req.method] || 'editar')(req, res, next);

/** Administración de la plataforma (empresas, respaldos, auditoría global). */
const soloSuperadmin = (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ error: 'No autenticado.' });
    if (esSuperadmin(req.usuario)) return next();
    return denegar(req, res, [['plataforma', 'superadministrador']]);
};

/** Tipos de proforma ('mecanica' | 'pintura') que el usuario puede usar con la acción indicada. */
const tiposProformaPermitidos = (usuario, accion) =>
    ['mecanica', 'pintura'].filter(t => puede(usuario, moduloProforma(t), accion));

/** Áreas de inventario que el usuario puede usar con la acción indicada. */
const areasInventarioPermitidas = (usuario, accion) =>
    AREAS_INVENTARIO.filter(a => puede(usuario, moduloInventario(a), accion));

/**
 * Permisos que necesitan CONSULTAR el catálogo de repuestos sin administrar
 * el inventario: elegir ítems en una proforma, registrar una compra a un
 * proveedor o un movimiento de stock. Solo lectura.
 */
const LECTURA_REPUESTOS = [
    ['inventario_mecanica', 'ver'], ['inventario_colisiones', 'ver'],
    ['proformas_mecanica', 'crear'], ['proformas_mecanica', 'editar'],
    ['proformas_colisiones', 'crear'], ['proformas_colisiones', 'editar'],
    ['proveedores', 'crear'], ['proveedores', 'editar'],
];
const NECESITA_CATALOGO_COMPLETO = LECTURA_REPUESTOS.slice(2);

/**
 * Áreas cuyos repuestos puede listar el usuario: null = todas (superadmin o
 * quien arma proformas/compras); si no, solo las áreas con permiso "ver".
 */
const areasRepuestosVisibles = (usuario) =>
    (NECESITA_CATALOGO_COMPLETO.some(([m, a]) => puede(usuario, m, a)) ? null : areasInventarioPermitidas(usuario, 'ver'));

module.exports = {
    verificarToken, verificarRol, soloStaff, soloSuperadmin,
    requierePermiso, requiereAlguno, permisoPorMetodo,
    puede, esSuperadmin, denegar, cargarSesion, cuentaHabilitada,
    tiposProformaPermitidos, areasInventarioPermitidas, areasRepuestosVisibles, LECTURA_REPUESTOS,
};
