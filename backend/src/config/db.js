/**
 * SS SWAP - Conexión Principal a Base de Datos Relacional (PostgreSQL)
 * Gestiona el pool de conexiones para todas las entidades transaccionales
 * del sistema (usuarios, citas, inventario, órdenes de trabajo, sucursales).
 */
const { Pool, types } = require('pg');
require('dotenv').config();

// El driver `pg` por defecto convierte las columnas DATE (oid 1082) en objetos
// Date de JS a medianoche en la zona horaria del servidor. Al serializarlas a
// JSON (toISOString) se desplazan a UTC y pueden "saltar" al dia anterior,
// ademas de venir como datetime completo. El frontend hace `fecha + 'T00:00:00'`
// esperando un string plano 'YYYY-MM-DD', lo que con ese datetime completo
// genera "Invalid Date". Forzamos a pg a devolver el valor crudo (string)
// para las columnas DATE, evitando el problema de raiz en toda la app.
types.setTypeParser(1082, (val) => val);

// Supabase (y la mayoria de Postgres administrados) exigen SSL. En local
// (DB_SSL=false o sin definir) se conecta sin SSL como antes.
const usarSSL = process.env.DB_SSL === 'true';

const pool = new Pool({
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 5432,
    database: process.env.DB_NAME     || 'SS SWAP_db',
    user:     process.env.DB_USER     || 'postgres',
    password: process.env.DB_PASSWORD,
    ssl:      usarSSL ? { rejectUnauthorized: false } : false,
    max: 10,              // Máximo de conexiones en el pool
    // Conexiones inactivas se conservan 5 min (antes 30 s): reabrirlas contra
    // Supabase es lo que hacia lenta la "primera" peticion tras un rato.
    idleTimeoutMillis: 5 * 60 * 1000,
    // Antes 2 s: una conexion nueva al pooler de Supabase puede tardar mas,
    // y al vencer se lanzaba un error que dejaba la peticion colgada.
    connectionTimeoutMillis: 15000,
    keepAlive: true,
});

pool.on('error', (err) => {
    console.error('Error inesperado en el pool de PostgreSQL:', err);
});

module.exports = pool;
