/**
 * SS SWAP - Servicio de Persistencia de Conversaciones de SWAPBot
 *
 * Guarda en MongoDB Atlas cada conversación del chatbot. Un documento =
 * una sesión de chat (varios turnos usuario/bot). Al igual que la bitácora
 * de órdenes, es un flujo append-only sin JOINs transaccionales, ideal para
 * un almacén de documentos en lugar de sobrecargar PostgreSQL.
 */
const { getMongoDb } = require('../config/mongo');

/**
 * Agrega un turno (usuario + bot) a la sesion indicada. Crea el documento
 * de sesion si no existe (upsert). Nunca lanza: si Mongo no esta
 * disponible o falla, se registra el error en consola y se continua sin
 * romper la respuesta del chat al usuario.
 */
const registrarTurno = async ({ sesionId, clienteId, clienteNombre, canal, ip, mensajeUsuario, mensajeBot }) => {
    const db = getMongoDb();
    if (!db || !sesionId) return;

    const ahora = new Date();
    try {
        await db.collection('chatbot_conversaciones').updateOne(
            { sesion_id: sesionId },
            {
                $setOnInsert: {
                    sesion_id: sesionId,
                    canal: canal || 'publico',
                    ip: ip || null,
                    creado_en: ahora,
                },
                $set: {
                    cliente_id: clienteId ?? null,
                    cliente_nombre: clienteNombre ?? null,
                    actualizado_en: ahora,
                },
                $push: {
                    mensajes: {
                        $each: [
                            { rol: 'user', texto: mensajeUsuario, timestamp: ahora },
                            { rol: 'bot',  texto: mensajeBot,     timestamp: ahora },
                        ],
                    },
                },
            },
            { upsert: true }
        );
    } catch (err) {
        console.error('[chatbotConversacion] Error al guardar turno:', err.message);
    }
};

/** Historial de conversaciones previas de un cliente logueado (panel del cliente). */
const obtenerHistorialPorCliente = async (clienteId, limite = 10) => {
    const db = getMongoDb();
    if (!db || !clienteId) return [];
    try {
        const docs = await db.collection('chatbot_conversaciones')
            .find({ cliente_id: clienteId })
            .sort({ actualizado_en: -1 })
            .limit(limite)
            .toArray();
        return docs.map(formatearConversacion);
    } catch (err) {
        console.error('[chatbotConversacion] Error al obtener historial:', err.message);
        return [];
    }
};

/** Panel de administracion: listado paginado de TODAS las conversaciones (mas recientes primero). */
const listarConversaciones = async ({ pagina = 1, porPagina = 20 } = {}) => {
    const db = getMongoDb();
    if (!db) return { total: 0, conversaciones: [] };
    try {
        const skip = (pagina - 1) * porPagina;
        const [docs, total] = await Promise.all([
            db.collection('chatbot_conversaciones')
                .find({})
                .sort({ actualizado_en: -1 })
                .skip(skip)
                .limit(porPagina)
                .toArray(),
            db.collection('chatbot_conversaciones').countDocuments(),
        ]);
        return { total, conversaciones: docs.map(formatearConversacion) };
    } catch (err) {
        console.error('[chatbotConversacion] Error al listar conversaciones:', err.message);
        return { total: 0, conversaciones: [] };
    }
};

const formatearConversacion = (d) => ({
    id: d._id.toString(),
    sesion_id: d.sesion_id,
    cliente_id: d.cliente_id || null,
    cliente_nombre: d.cliente_nombre || null,
    canal: d.canal,
    ip: d.ip || null,
    mensajes: d.mensajes || [],
    creado_en: d.creado_en,
    actualizado_en: d.actualizado_en,
});

module.exports = { registrarTurno, obtenerHistorialPorCliente, listarConversaciones };
