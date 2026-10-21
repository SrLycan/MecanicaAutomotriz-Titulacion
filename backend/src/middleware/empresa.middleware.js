/**
 * SS SWAP - Contexto de empresa de las peticiones y registro de errores
 *
 * contextoPublico: TODA petición empieza dentro de la empresa dueña de la
 * página web pública (por defecto SS SWAP, configurable con EMPRESA_PUBLICA
 * = slug). Así el catálogo, los servicios, las sucursales, el chatbot y el
 * registro de clientes de la web pública siguen funcionando igual y solo
 * muestran datos de esa empresa. Las rutas autenticadas cambian luego al
 * contexto de la empresa del usuario (verificarToken).
 *
 * registrarErrores: guarda en errores_sistema las respuestas 500 (ruta,
 * empresa y un mensaje breve) para que el superadministrador las revise.
 */
const pool = require('../config/db');
const { conEmpresa, sinAislamiento, contextoActual } = require('../config/contexto');

const SLUG_PUBLICO = (process.env.EMPRESA_PUBLICA || 'ss-swap').trim().toLowerCase();
const CACHE_MS = 5 * 60 * 1000;
let cache = { id: null, hasta: 0 };

/** Id de la empresa de la web pública (cacheado). null si no existe. */
async function empresaPublicaId() {
    if (cache.id && Date.now() < cache.hasta) return cache.id;
    const { rows } = await sinAislamiento(() => pool.query(
        `SELECT id FROM empresas WHERE slug = $1 AND estado = 'activa'`, [SLUG_PUBLICO]));
    cache = { id: rows[0]?.id ?? null, hasta: Date.now() + CACHE_MS };
    return cache.id;
}

const contextoPublico = async (req, res, next) => {
    let id = null;
    try {
        id = await empresaPublicaId();
    } catch (err) {
        // Sin la migracion multiempresa la tabla no existe: falla cerrado
        // (sin empresa no se ve ningun dato), pero el servidor sigue vivo.
        console.error('[empresa] No se pudo resolver la empresa publica:', err.message);
    }
    return conEmpresa(id, next, { publico: true });
};

const registrarErrores = (req, res, next) => {
    const jsonOriginal = res.json.bind(res);
    res.json = (cuerpo) => {
        if (res.statusCode >= 500) res.locals.mensajeError = cuerpo?.error;
        return jsonOriginal(cuerpo);
    };
    res.on('finish', () => {
        if (res.statusCode < 500) return;
        const ctx = contextoActual();
        sinAislamiento(() => pool.query(
            `INSERT INTO errores_sistema (metodo, ruta, estado_http, empresa_id, usuario_id, mensaje)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [req.method, (req.originalUrl || '').split('?')[0].slice(0, 200), res.statusCode,
             req.usuario?.empresa_id ?? ctx?.empresaId ?? null, req.usuario?.id ?? null,
             String(res.locals.mensajeError || 'Error interno').slice(0, 300)]
        )).catch(() => {});
    });
    next();
};

module.exports = { contextoPublico, registrarErrores, empresaPublicaId };
