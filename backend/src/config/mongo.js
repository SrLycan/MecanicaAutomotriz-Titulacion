/**
 * SS SWAP — Conexion a MongoDB Atlas.
 *
 * Todo lo transaccional del taller (inventario, ordenes, citas, usuarios,
 * clientes, vehiculos, catalogo) sigue viviendo en PostgreSQL/Supabase —
 * ahi es donde importa la integridad referencial y las transacciones ACID
 * (ej. el descuento de stock en inventory.controller.js).
 *
 * MongoDB se usa solo para datos de tipo bitacora/log, donde no hace falta
 * un JOIN relacional y basta con consistencia eventual:
 *   - chatbot_conversaciones : historial de chats de SWAPBot
 *   - chatbot_cuota_diaria   : contador de consumo diario de la API de Gemini
 *   - ordenes_historial      : bitacora de cambios de estado de las ordenes
 *                              de trabajo (antes era una tabla de Postgres;
 *                              ver migrations.sql, Sprint 8, para el historial
 *                              de esa decision).
 */
const { MongoClient } = require('mongodb');
require('dotenv').config();

const uri    = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB_NAME || 'sswap_chatbot';

let db = null;

async function connectMongo() {
    if (db) return db;
    if (!uri) {
        console.warn('  [mongo] MONGO_URI no configurado — el chatbot y el historial de ordenes funcionaran sin persistencia (solo Gemini/Postgres en memoria).');
        return null;
    }
    try {
        const client = new MongoClient(uri);
        await client.connect();
        db = client.db(dbName);
        await asegurarIndices(db);
        console.log(`  [mongo] Conectado a MongoDB Atlas (${dbName}).`);
        return db;
    } catch (err) {
        console.error('  [mongo] Error al conectar con MongoDB Atlas:', err.message);
        db = null;
        return null;
    }
}

async function asegurarIndices(database) {
    // chatbot_conversaciones
    await database.collection('chatbot_conversaciones').createIndex({ sesion_id: 1 }, { unique: true });
    await database.collection('chatbot_conversaciones').createIndex({ cliente_id: 1 });
    // TTL: purga automatica de conversaciones tras 180 dias (privacidad + espacio en el tier gratuito de Atlas)
    await database.collection('chatbot_conversaciones').createIndex(
        { actualizado_en: 1 },
        { expireAfterSeconds: 60 * 60 * 24 * 180 }
    );

    // ordenes_historial
    await database.collection('ordenes_historial').createIndex({ orden_id: 1 });
    await database.collection('ordenes_historial').createIndex({ created_at: -1 });

    // chatbot_cuota_diaria: el _id (fecha 'YYYY-MM-DD') ya actua como indice unico, no requiere mas.
}

/** Devuelve la conexion activa, o null si Mongo no esta disponible. Nunca lanza. */
function getMongoDb() {
    return db;
}

module.exports = { connectMongo, getMongoDb };
