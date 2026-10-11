/**
 * SS SWAP - Conexión Principal a Base de Datos Relacional (PostgreSQL)
 *
 * Exporta un "pool" con la misma interfaz de siempre (query, connect, end,
 * on), pero que AÍSLA cada empresa:
 *
 *  - Dentro de una petición de una empresa (config/contexto.js), cada consulta
 *    corre en una transacción que primero hace
 *        set_config('role', 'ssswap_app', true)
 *        set_config('app.empresa_id', '<empresa>', true)
 *    El rol ssswap_app está sujeto a Row Level Security: la base de datos
 *    solo devuelve, modifica o inserta filas de esa empresa, aunque una
 *    consulta olvide filtrar. Los valores son LOCALES a la transacción, así
 *    que funcionan igual con el pooler de Supabase en modo transacción y
 *    nunca quedan "pegados" a la conexión para la siguiente petición.
 *  - Fuera de una petición (scripts, migraciones) o con sinAislamiento(),
 *    se usa el usuario de conexión tal cual (propietario de las tablas).
 *
 * pool.connect() devuelve un cliente que respeta las transacciones del
 * código: el BEGIN del controlador también fija la empresa, y una consulta
 * suelta fuera de transacción se envuelve sola.
 */
const { Pool, types } = require('pg');
const { contextoActual } = require('./contexto');
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

const poolReal = new Pool({
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

poolReal.on('error', (err) => {
    console.error('Error inesperado en el pool de PostgreSQL:', err);
});

// Rol sin privilegios de propietario (lo crea la migracion del Sprint 22).
const ROL_APP = process.env.DB_APP_ROLE || 'ssswap_app';
if (!/^[a-z_][a-z0-9_]*$/.test(ROL_APP)) throw new Error('DB_APP_ROLE invalido.');

/** true si las consultas del contexto deben ir aisladas por empresa. */
const aislado = (ctx) => Boolean(ctx) && !ctx.sistema;

/**
 * SQL que fija rol y empresa para la transacción en curso. La empresa es un
 * entero validado (o vacía = ninguna empresa: no se ve nada).
 */
function sqlEmpresa(ctx) {
    const empresa = Number.isInteger(ctx.empresaId) && ctx.empresaId > 0 ? String(ctx.empresaId) : '';
    return `SELECT set_config('role', '${ROL_APP}', true), set_config('app.empresa_id', '${empresa}', true)`;
}

const ES_INICIO = /^\s*(BEGIN|START\s+TRANSACTION)\b/i;
// Solo el fin real de la transaccion ("ROLLBACK TO SAVEPOINT" no lo es).
const ES_FIN = /^\s*(COMMIT|END|ROLLBACK)(\s+(WORK|TRANSACTION))?\s*;?\s*$/i;
const textoDe = (q) => (typeof q === 'string' ? q : q?.text || '');

/** Ejecuta una consulta suelta dentro de su propia transacción aislada. */
async function consultaAislada(cliente, ctx, text, params) {
    await cliente.query(`BEGIN; ${sqlEmpresa(ctx)}`);
    try {
        const r = await cliente.query(text, params);
        await cliente.query('COMMIT');
        return r;
    } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
    }
}

async function query(text, params) {
    const ctx = contextoActual();
    if (!aislado(ctx)) return poolReal.query(text, params);
    const cliente = await poolReal.connect();
    let roto = false;
    try {
        return await consultaAislada(cliente, ctx, text, params);
    } catch (err) {
        roto = !err.code; // error de conexion (no de SQL): no reutilizarla
        throw err;
    } finally {
        cliente.release(roto);
    }
}

async function connect() {
    const ctx = contextoActual();
    const cliente = await poolReal.connect();
    if (!aislado(ctx)) return cliente;

    let enTransaccion = false;
    return {
        async query(text, params) {
            const sql = textoDe(text);
            if (ES_INICIO.test(sql)) {
                const r = await cliente.query(`${sql}; ${sqlEmpresa(ctx)}`);
                enTransaccion = true;
                return Array.isArray(r) ? r[0] : r;
            }
            if (ES_FIN.test(sql)) {
                enTransaccion = false;
                return cliente.query(text, params);
            }
            if (enTransaccion) return cliente.query(text, params);
            return consultaAislada(cliente, ctx, text, params);
        },
        release(err) {
            // Una transaccion que quedo abierta no vuelve al pool: se destruye
            // la conexion (PostgreSQL la revierte sola).
            const descartar = enTransaccion || err;
            enTransaccion = false;
            return cliente.release(descartar ? true : undefined);
        },
    };
}

module.exports = {
    query,
    connect,
    end: () => poolReal.end(),
    on: (...args) => poolReal.on(...args),
    /** Pool sin envoltura (solo para diagnostico). */
    poolReal,
    ROL_APP,
};
