/**
 * SS SWAP - Autorización que depende del registro afectado
 *
 * Algunos permisos no se deciden solo por la ruta:
 *  - Inventario: un repuesto (o categoría) pertenece a un área
 *    (mecánica / colisiones) y cada área es un módulo distinto.
 *  - Proformas: el tipo (mecánica / pintura) decide si aplica
 *    "proformas_mecanica" o "proformas_colisiones".
 *
 * Estos middlewares leen el área/tipo REAL desde la BD (nunca confían en lo
 * que diga el navegador) y responden 403 si falta el permiso. Si el registro
 * no existe dejan pasar: el controlador responde su 404 habitual.
 */
const pool = require('../config/db');
const { moduloInventario, moduloProforma, AREAS_INVENTARIO } = require('../config/permisos');
const { puede, denegar } = require('./auth.middleware');

const idValido = (id) => /^\d+$/.test(String(id ?? ''));

/** Exige [modulo, accion] para cada par; si alguno falta responde 403. */
function exigirTodos(req, res, next, pares) {
    const falta = pares.filter(([m, a]) => !puede(req.usuario, m, a));
    if (falta.length) return denegar(req, res, falta);
    return next();
}

const manejarError = (res, err) => {
    console.error('Error verificando permisos del recurso:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
};

// ── Inventario ────────────────────────────────────────────────

/** POST /repuestos: el área viene en el cuerpo (por defecto mecánica). */
const areaDelCuerpo = (accion) => (req, res, next) =>
    exigirTodos(req, res, next, [[moduloInventario(req.body?.area || 'mecanica'), accion]]);

/**
 * Rutas /repuestos/:id (o body.repuesto_id): exige `accion` sobre el área
 * real del repuesto. Si el cuerpo trae un área distinta (mover de área),
 * también se exige sobre la nueva.
 */
const areaDelRepuesto = (accion, { desdeCuerpo = false } = {}) => async (req, res, next) => {
    const id = desdeCuerpo ? req.body?.repuesto_id : req.params.id;
    if (!idValido(id)) return next();
    try {
        const { rows } = await pool.query('SELECT area FROM repuestos WHERE id = $1', [id]);
        if (!rows[0]) return next();
        const pares = [[moduloInventario(rows[0].area), accion]];
        const nueva = req.body?.area;
        if (!desdeCuerpo && nueva && nueva !== rows[0].area) pares.push([moduloInventario(nueva), accion]);
        return exigirTodos(req, res, next, pares);
    } catch (err) { return manejarError(res, err); }
};

/**
 * Categorías: una categoría de un área exige `accion` en esa área; una
 * compartida (área vacía) afecta a todas, así que exige todas las áreas.
 */
function paresCategoria(area, accion) {
    return area ? [[moduloInventario(area), accion]] : AREAS_INVENTARIO.map(a => [moduloInventario(a), accion]);
}
const areaDeCategoria = (accion) => async (req, res, next) => {
    try {
        const pares = [];
        if (req.params.id) {
            if (!idValido(req.params.id)) return next();
            const { rows } = await pool.query('SELECT area FROM categorias_repuesto WHERE id = $1', [req.params.id]);
            if (!rows[0]) return next();
            pares.push(...paresCategoria(rows[0].area, accion));
        }
        if (req.method !== 'DELETE') pares.push(...paresCategoria(req.body?.area || null, accion));
        return exigirTodos(req, res, next, pares);
    } catch (err) { return manejarError(res, err); }
};

// ── Proformas ─────────────────────────────────────────────────

/** POST /proformas: el tipo viene en el cuerpo. */
const tipoDelCuerpo = (accion) => (req, res, next) =>
    exigirTodos(req, res, next, [[moduloProforma(req.body?.tipo), accion]]);

/**
 * Rutas /proformas/:id: exige la acción sobre el tipo real de la proforma.
 * `accion` puede ser una función (req) => accion (p. ej. cambio de estado).
 * En PUT, si el cuerpo cambia el tipo, también se exige sobre el nuevo.
 */
const tipoDeProforma = (accion) => async (req, res, next) => {
    if (!idValido(req.params.id)) return next();
    try {
        const { rows } = await pool.query('SELECT tipo FROM proformas WHERE id = $1', [req.params.id]);
        if (!rows[0]) return next();
        const acc = typeof accion === 'function' ? accion(req) : accion;
        const pares = [[moduloProforma(rows[0].tipo), acc]];
        if (req.method === 'PUT' && req.body?.tipo && req.body.tipo !== rows[0].tipo) pares.push([moduloProforma(req.body.tipo), acc]);
        return exigirTodos(req, res, next, pares);
    } catch (err) { return manejarError(res, err); }
};

/** Aprobar/rechazar es una acción sensible; los demás cambios de estado son edición. */
const accionCambioEstadoProforma = (req) =>
    (['aprobada', 'rechazada'].includes(req.body?.estado) ? 'aprobar' : 'editar');

module.exports = {
    areaDelCuerpo, areaDelRepuesto, areaDeCategoria,
    tipoDelCuerpo, tipoDeProforma, accionCambioEstadoProforma,
};
