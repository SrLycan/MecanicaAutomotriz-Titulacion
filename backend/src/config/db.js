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
const { prepareValue, escapeLiteral } = require('pg/lib/utils');
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
    // Máximo de conexiones en el pool (DB_POOL_MAX para ajustarlo al plan de Supabase).
    max: parseInt(process.env.DB_POOL_MAX, 10) || 10,
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
 * SQL que fija rol, empresa y usuario para la transacción en curso. La empresa es un
 * entero validado (o vacía = ninguna empresa: no se ve nada).
 */
function sqlEmpresa(ctx) {
    const empresa = Number.isInteger(ctx.empresaId) && ctx.empresaId > 0 ? String(ctx.empresaId) : '';
    // Usuario de la sesion: la BD lo pone como creador por defecto (usuario_actual()).
    const usuario = Number.isInteger(ctx.usuarioId) && ctx.usuarioId > 0 ? String(ctx.usuarioId) : '';
    return `SELECT set_config('role', '${ROL_APP}', true), set_config('app.empresa_id', '${empresa}', true), set_config('app.usuario_id', '${usuario}', true)`;
}

// ── Consulta aislada en UN solo viaje a la base ─────────────────────────────
// Antes cada consulta aislada hacia 3 viajes (BEGIN+empresa, consulta, COMMIT).
// Contra Supabase cada viaje cuesta la latencia de red completa, y eso era
// lo que mas pesaba al abrir cada pagina. Ahora, si la consulta es segura de
// enviar como texto, se manda todo junto:
//     BEGIN; SELECT set_config(...); <consulta>; COMMIT
// Los parametros se convierten en literales con escapeLiteral (el mismo
// escape del driver) y se insertan solo FUERA de textos, identificadores
// entre comillas y comentarios. Ante cualquier cosa rara (E'...', $$...$$,
// /* */, bytes nulos, Buffers, configuraciones especiales) se usa el camino
// anterior de 3 viajes. DB_UN_VIAJE=false lo desactiva por completo.
const UN_VIAJE = process.env.DB_UN_VIAJE !== 'false';
const ES_IDENT = /[A-Za-z0-9_$\u0080-￿]/;

/** Valor JS -> literal SQL (o undefined si no se puede enviar como texto). */
function literal(valor) {
    const v = prepareValue(valor);
    if (v === null || v === undefined) return 'NULL';
    if (Buffer.isBuffer(v)) return undefined;
    const s = String(v);
    if (s.includes('\0')) return undefined;
    return escapeLiteral(s);
}

/**
 * Inserta los parametros $n como literales. Devuelve el SQL resultante o
 * null si la consulta no es segura para este camino.
 */
function sqlConLiterales(sql, params = []) {
    let out = '';
    let i = 0;
    const n = sql.length;
    while (i < n) {
        const c = sql[i];
        const prev = i > 0 ? sql[i - 1] : '';
        if (c === "'") {
            // E'...' admite escapes con barra invertida: no se interpreta aqui.
            if ((prev === 'e' || prev === 'E') && !(i > 1 && ES_IDENT.test(sql[i - 2]))) return null;
            let j = i + 1;
            for (;;) {
                const k = sql.indexOf("'", j);
                if (k < 0) return null;
                if (sql[k + 1] === "'") { j = k + 2; continue; }
                j = k + 1;
                break;
            }
            out += sql.slice(i, j); i = j; continue;
        }
        if (c === '"') {
            let j = i + 1;
            for (;;) {
                const k = sql.indexOf('"', j);
                if (k < 0) return null;
                if (sql[k + 1] === '"') { j = k + 2; continue; }
                j = k + 1;
                break;
            }
            out += sql.slice(i, j); i = j; continue;
        }
        if (c === '-' && sql[i + 1] === '-') {
            const k = sql.indexOf('\n', i);
            const j = k < 0 ? n : k;
            out += sql.slice(i, j); i = j; continue;
        }
        if (c === '/' && sql[i + 1] === '*') return null;
        if (c === '$' && !ES_IDENT.test(prev)) {
            const m = /^\$(\d+)/.exec(sql.slice(i, i + 12));
            if (!m) return null; // $$ o $etiqueta$: texto con dolares
            const idx = Number(m[1]);
            if (idx < 1 || idx > params.length) return null;
            const lit = literal(params[idx - 1]);
            if (lit === undefined) return null;
            out += lit; i += m[0].length; continue;
        }
        out += c; i++;
    }
    return out.replace(/[\s;]+$/, '');
}

/** SQL de un solo viaje para la consulta, o null si debe ir por el camino de 3 viajes. */
function sqlUnViaje(ctx, text, params) {
    if (!UN_VIAJE || typeof text !== 'string') return null;
    if (params !== undefined && !Array.isArray(params)) return null;
    const sql = sqlConLiterales(text, params || []);
    if (sql === null || sql === '') return null;
    // El salto de linea cierra un posible comentario "--" al final de la consulta.
    return `BEGIN; ${sqlEmpresa(ctx)}; ${sql}\n; COMMIT`;
}

/** De los resultados de "BEGIN; set_config; <consulta>; COMMIT" deja solo los de la consulta. */
function resultadoDeConsulta(resultados) {
    const propios = resultados.slice(2, -1);
    return propios.length === 1 ? propios[0] : propios;
}

const ES_INICIO = /^\s*(BEGIN|START\s+TRANSACTION)\b/i;
// Solo el fin real de la transaccion ("ROLLBACK TO SAVEPOINT" no lo es).
const ES_FIN = /^\s*(COMMIT|END|ROLLBACK)(\s+(WORK|TRANSACTION))?\s*;?\s*$/i;
const textoDe = (q) => (typeof q === 'string' ? q : q?.text || '');

/** Ejecuta una consulta suelta dentro de su propia transacción aislada. */
async function consultaAislada(cliente, ctx, text, params) {
    const unViaje = sqlUnViaje(ctx, text, params);
    if (unViaje) {
        try {
            return resultadoDeConsulta(await cliente.query(unViaje));
        } catch (err) {
            // La transaccion quedo abierta (abortada): se revierte antes de devolver la conexion.
            await cliente.query('ROLLBACK').catch(() => {});
            throw err;
        }
    }
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
    /** Solo para pruebas. */
    _sqlConLiterales: sqlConLiterales,
};
