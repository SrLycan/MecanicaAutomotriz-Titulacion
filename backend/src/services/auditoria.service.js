/**
 * SS SWAP - Registro de auditoría de seguridad (tabla auditoria_seguridad)
 *
 * Guarda quién hizo qué, sobre qué recurso, cuándo y con qué resultado:
 * altas y cambios de usuarios, permisos concedidos/revocados, cambios de rol
 * o estado y accesos denegados. La tabla es de solo inserción (un trigger
 * rechaza UPDATE/DELETE), así que nadie puede alterar su propio historial.
 *
 * Nunca se guardan contraseñas, hashes ni tokens: el detalle pasa por
 * limpiarDetalle() antes de escribirse.
 */
const pool = require('../config/db');
const { contextoActual, sinAislamiento } = require('../config/contexto');

const CLAVES_SENSIBLES = /pass|token|secret|hash|authorization/i;

/** Copia del detalle sin campos sensibles (recursivo, profundidad limitada). */
function limpiarDetalle(valor, profundidad = 0) {
    if (valor == null || typeof valor !== 'object' || profundidad > 4) return valor;
    if (Array.isArray(valor)) return valor.map(v => limpiarDetalle(v, profundidad + 1));
    return Object.fromEntries(Object.entries(valor)
        .filter(([k]) => !CLAVES_SENSIBLES.test(k))
        .map(([k, v]) => [k, limpiarDetalle(v, profundidad + 1)]));
}

/**
 * Inserta un registro. `db` puede ser un cliente dentro de una transacción
 * (para que el registro se confirme junto con el cambio) o el pool.
 * Si `estricto` es false (por defecto) un fallo solo se reporta en consola:
 * la auditoría nunca debe tumbar la operación que la originó.
 *
 * Empresa del evento: la de la petición (la pone la base de datos), o
 * `empresaId` explícito para eventos de la plataforma sobre una empresa.
 * Sin empresa (superadministrador global) el evento queda como global.
 */
async function registrarAuditoria({ req, actor, accion, recursoTipo = null, recursoId = null, resultado = 'exito', detalle = null, empresaId = null }, db = pool, estricto = false) {
    const quien = actor || req?.usuario || null;
    const ctx = contextoActual();
    // Sin empresa en la peticion no hay fila de empresa donde escribir: el
    // evento se guarda como evento de la plataforma.
    const global = db === pool && ctx && !ctx.sistema && !ctx.empresaId;
    const insertar = () => db.query(
            `INSERT INTO auditoria_seguridad (actor_id, actor_email, actor_rol, accion, recurso_tipo, recurso_id, resultado, detalle, ip, empresa_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::int, empresa_actual()))`,
            [
                quien?.id ?? null, quien?.email ?? null, quien?.rol ?? null,
                accion, recursoTipo, recursoId == null ? null : String(recursoId), resultado,
                detalle ? JSON.stringify(limpiarDetalle(detalle)) : null,
                req?.ip ? String(req.ip).slice(0, 64) : null,
                empresaId,
            ]
        );
    try {
        await (global ? sinAislamiento(insertar) : insertar());
    } catch (err) {
        if (estricto) throw err;
        console.error('[auditoria] No se pudo registrar:', accion, err.message);
    }
}

// Los accesos denegados se registran como máximo una vez cada 5 minutos por
// usuario + permiso + ruta, para que un botón insistente o un script no
// llenen la tabla.
const ULTIMO_DENEGADO = new Map();
const VENTANA_DENEGADO_MS = 5 * 60 * 1000;

function registrarDenegado(req, permisos) {
    const clave = `${req.usuario?.id}|${permisos}|${req.method} ${req.baseUrl || ''}${req.route?.path || ''}`;
    const ahora = Date.now();
    if (ahora - (ULTIMO_DENEGADO.get(clave) || 0) < VENTANA_DENEGADO_MS) return;
    ULTIMO_DENEGADO.set(clave, ahora);
    if (ULTIMO_DENEGADO.size > 5000) ULTIMO_DENEGADO.clear();
    registrarAuditoria({
        req, accion: 'acceso.denegado', recursoTipo: 'endpoint',
        recursoId: `${req.method} ${(req.originalUrl || '').split('?')[0]}`.slice(0, 60),
        resultado: 'denegado', detalle: { requiere: permisos },
    });
}

module.exports = { registrarAuditoria, registrarDenegado, limpiarDetalle };
