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
            estado_anterior, estado_nuevo, progreso_anterior, progreso_nuevo,
            usuario_id, usuario_nombre, notas,
            created_at: new Date(),
        });
    } catch (err) {
        console.error(`[ordenesHistorial] Error al registrar historial de la orden #${orden_id}:`, err.message);
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
 * Panel de administracion: bitacora general de TODAS las ordenes,
 * paginada, mas reciente primero. Se enriquece con nombre del cliente y
 * placa consultando Postgres (fuente de verdad de esos datos) solo para
 * las ordenes presentes en la pagina actual.
 */
const listarHistorialGeneral = async ({ pagina = 1, porPagina = 20 } = {}) => {
    const db = getMongoDb();
    if (!db) return { total: 0, registros: [] };
    try {
        const skip = (pagina - 1) * porPagina;
        const [docs, total] = await Promise.all([
            db.collection('ordenes_historial').find({}).sort({ created_at: -1 }).skip(skip).limit(porPagina).toArray(),
            db.collection('ordenes_historial').countDocuments(),
        ]);

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
    estado_anterior: d.estado_anterior,
    estado_nuevo: d.estado_nuevo,
    progreso_anterior: d.progreso_anterior,
    progreso_nuevo: d.progreso_nuevo,
    usuario_nombre: d.usuario_nombre,
    notas: d.notas,
    created_at: d.created_at,
});

module.exports = { registrarHistorial, obtenerHistorialPorOrden, listarHistorialGeneral };
