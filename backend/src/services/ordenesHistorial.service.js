/**
 * SS SWAP - Servicio de Bitácora de Órdenes de Trabajo (Auditoría)
 *
 * Persiste en MongoDB Atlas el historial de cambios de estado y progreso de
 * las órdenes de trabajo. Es un caso natural para Mongo: solo se inserta
 * (nunca se actualiza ni se hace JOIN sobre esta bitácora desde otra tabla),
 * mientras que PostgreSQL conserva las entidades transaccionales del negocio.
 * El propio controller trata estos registros como "best-effort": no forman
 * parte de la transacción que cambia el estado real de la orden.
 */
const pool = require('../config/db');
const { getMongoDb } = require('../config/mongo');

/**
 * Registra una entrada en el historial de cambios de una orden.
 * Nunca lanza: si Mongo no esta disponible o falla, solo se loguea, para
 * no romper el flujo principal de creacion/actualizacion de la orden.
 */
const registrarHistorial = async ({
    orden_id, estado_anterior = null, estado_nuevo = null,
    progreso_anterior = null, progreso_nuevo = null,
    usuario_id = null, usuario_nombre = null, notas = null,
}) => {
    const db = getMongoDb();
    if (!db) {
        // Esta es la causa mas comun de "el historial no se guarda": Mongo no
        // esta conectado (MONGO_URI/MONGO_DB_NAME ausentes o incorrectos en
        // este entorno). No se lanza para no romper el guardado de la orden,
        // pero se deja bien visible en los logs del servidor.
        console.warn(`[ordenesHistorial] Mongo no esta conectado — NO se guardo el cambio de la orden #${orden_id}.`);
        return;
    }
    try {
        await db.collection('ordenes_historial').insertOne({
            orden_id: Number(orden_id),
            entidad_tipo: 'orden', entidad_id: Number(orden_id),
            estado_anterior, estado_nuevo, progreso_anterior, progreso_nuevo,
            usuario_id, usuario_nombre, notas,
            created_at: new Date(),
        });
    } catch (err) {
        console.error(`[ordenesHistorial] Error al registrar historial de la orden #${orden_id}:`, err.message);
    }
};

/**
 * Registra una accion generica de auditoria (Fase 3: Proveedores, Compras,
 * Gastos, etc.) en la MISMA coleccion `ordenes_historial` que ya usa la
 * bitacora de ordenes — no se crea una bitacora paralela. Se distingue por
 * `entidad_tipo` (!= 'orden'), por lo que NO aparece en la pestaña
 * "Historial de Ordenes" del panel (que sigue mostrando solo ordenes,
 * exactamente igual que antes) sino en la pestaña "Otras acciones".
 * Best-effort: nunca lanza, igual que registrarHistorial.
 */
const registrarAccionBitacora = async ({
    entidad_tipo, entidad_id = null, accion,
    usuario_id = null, usuario_nombre = null, detalle = null,
    // Sprint 14: datos estructurados opcionales (ids relacionados, montos,
    // productos...) para que la bitacora indique "ID relacionado" e
    // "informacion relevante" sin tener que parsear el texto de `detalle`.
    metadata = null,
}) => {
    const db = getMongoDb();
    if (!db) {
        console.warn(`[bitacora] Mongo no esta conectado — NO se guardo la accion "${accion}" sobre ${entidad_tipo}#${entidad_id}.`);
        return;
    }
    try {
        await db.collection('ordenes_historial').insertOne({
            orden_id: null,
            entidad_tipo, entidad_id: entidad_id !== null ? Number(entidad_id) : null,
            accion, detalle,
            ...(metadata ? { metadata } : {}),
            usuario_id, usuario_nombre,
            created_at: new Date(),
        });
    } catch (err) {
        console.error(`[bitacora] Error al registrar accion "${accion}" sobre ${entidad_tipo}#${entidad_id}:`, err.message);
    }
};

/** Historial de UNA orden, mas antiguo primero (igual que la version SQL original). */
const obtenerHistorialPorOrden = async (ordenId) => {
    const db = getMongoDb();
    if (!db) return [];
    try {
        const docs = await db.collection('ordenes_historial')
            .find({ orden_id: Number(ordenId) })
            .sort({ created_at: 1, _id: 1 })
            .toArray();
        return docs.map(formatearEntrada);
    } catch (err) {
        console.error('[ordenesHistorial] Error al obtener historial de la orden:', err.message);
        return [];
    }
};

/**
 * Panel de administracion: bitacora general, paginada, mas reciente primero.
 *
 * `tipo` ('orden' por defecto, o 'otras'):
 *  - 'orden' (o ausente): SOLO entradas de ordenes de trabajo — exactamente
 *    el mismo comportamiento y forma de datos que tenia esta funcion antes
 *    de la Fase 3 (incluye los documentos legacy que no tienen
 *    `entidad_tipo` porque se escribieron antes de este cambio).
 *  - 'otras': entradas generadas por registrarAccionBitacora (Proveedores,
 *    Compras, Gastos, Movimientos financieros, etc.), SIN el enriquecido
 *    con Postgres de ordenes (join distinto, no aplica).
 */
const listarHistorialGeneral = async ({ pagina = 1, porPagina = 20, tipo = 'orden', entidad = null } = {}) => {
    const db = getMongoDb();
    if (!db) return { total: 0, registros: [] };
    try {
        // `entidad` (Sprint 14, opcional): filtra "Otras acciones" por un
        // entidad_tipo concreto (proforma, inventario, cuenta_cobrar, pago...).
        const filtro = tipo === 'otras'
            ? { entidad_tipo: entidad ? String(entidad) : { $exists: true, $ne: 'orden' } }
            : { $or: [{ entidad_tipo: 'orden' }, { entidad_tipo: { $exists: false } }] };

        const skip = (pagina - 1) * porPagina;
        const [docs, total] = await Promise.all([
            db.collection('ordenes_historial').find(filtro).sort({ created_at: -1 }).skip(skip).limit(porPagina).toArray(),
            db.collection('ordenes_historial').countDocuments(filtro),
        ]);

        if (tipo === 'otras') {
            const registros = docs.map(d => ({
                ...formatearEntrada(d),
                orden_id: d.orden_id,
            }));
            return { total, registros };
        }

        const ordenIds = [...new Set(docs.map(d => d.orden_id))];
        let contexto = {};
        if (ordenIds.length) {
            const { rows } = await pool.query(
                `SELECT o.id, c.nombre AS cliente_nombre, v.placa
                 FROM ordenes_trabajo o
                 JOIN clientes c ON c.id = o.cliente_id
                 LEFT JOIN vehiculos v ON v.id = o.vehiculo_id
                 WHERE o.id = ANY($1::int[])`,
                [ordenIds]
            );
            contexto = Object.fromEntries(rows.map(r => [r.id, r]));
        }

        const registros = docs.map(d => ({
            ...formatearEntrada(d),
            orden_id: d.orden_id,
            cliente_nombre: contexto[d.orden_id]?.cliente_nombre || null,
            placa: contexto[d.orden_id]?.placa || null,
        }));

        return { total, registros };
    } catch (err) {
        console.error('[ordenesHistorial] Error al listar historial general:', err.message);
        return { total: 0, registros: [] };
    }
};

const formatearEntrada = (d) => ({
    id: d._id.toString(),
    entidad_tipo: d.entidad_tipo || 'orden',
    entidad_id: d.entidad_id ?? d.orden_id ?? null,
    accion: d.accion || null,
    detalle: d.detalle || null,
    metadata: d.metadata || null,
    estado_anterior: d.estado_anterior,
    estado_nuevo: d.estado_nuevo,
    progreso_anterior: d.progreso_anterior,
    progreso_nuevo: d.progreso_nuevo,
    usuario_nombre: d.usuario_nombre,
    notas: d.notas,
    created_at: d.created_at,
});

module.exports = { registrarHistorial, registrarAccionBitacora, obtenerHistorialPorOrden, listarHistorialGeneral };
