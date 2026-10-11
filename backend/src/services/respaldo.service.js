/**
 * SS SWAP - Respaldos de la base de datos y de los archivos subidos
 *
 * Qué respalda: la base de datos COMPLETA (todas las empresas, esquema y
 * datos) y la carpeta uploads/ (fotos de perfil). La configuración (.env) NO
 * se copia porque contiene secretos; en cada respaldo se guarda un
 * manifiesto con la versión del sistema, el commit, el alcance, tamaños,
 * SHA-256 y el número de filas de cada tabla (sin contraseñas ni claves).
 *
 * Motores:
 *  - pg_dump (preferido): formato "custom" de PostgreSQL; se restaura con
 *    pg_restore. Requiere los binarios de PostgreSQL en el servidor.
 *  - json (alternativo, 100 % Node): para servidores sin pg_dump (p. ej.
 *    hosting compartido). Guarda los datos de cada tabla; al restaurar, el
 *    esquema se reconstruye con schema.sql + migrations.sql y luego se cargan
 *    los datos respetando el orden de las llaves foráneas.
 *
 * Seguridad:
 *  - Carpeta fuera de lo que sirve el frontend (BACKUP_DIR, por defecto
 *    <proyecto>/respaldos, ignorada por git).
 *  - Cifrado AES-256-GCM si se define BACKUP_ENCRYPTION_KEY (frase o clave);
 *    sin clave el respaldo queda sin cifrar y así se registra.
 *  - La contraseña de la BD viaja a pg_dump por variable de entorno, nunca en
 *    la línea de comandos ni en los registros.
 *  - Retención: borra solo archivos creados por este servicio (prefijo
 *    "ssswap_"), más antiguos que BACKUP_RETENTION_DAYS, y SIEMPRE conserva
 *    al menos BACKUP_MIN_KEEP respaldos correctos.
 *
 * Cada respaldo y cada prueba de restauración queda en respaldos_registro.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { spawn, spawnSync, execFileSync } = require('child_process');
const { Client } = require('pg');
const pool = require('../config/db');
const { sinAislamiento } = require('../config/contexto');

const RAIZ_BACKEND = path.resolve(__dirname, '..', '..');
const RAIZ_PROYECTO = path.resolve(RAIZ_BACKEND, '..');
const entero = (v, d) => (Number.isFinite(parseInt(v)) ? parseInt(v) : d);

function config() {
    return {
        dir: path.resolve(process.env.BACKUP_DIR || path.join(RAIZ_PROYECTO, 'respaldos')),
        retencionDias: entero(process.env.BACKUP_RETENTION_DAYS, 30),
        minimoConservar: Math.max(1, entero(process.env.BACKUP_MIN_KEEP, 7)),
        automatico: process.env.BACKUP_AUTO === 'true',
        hora: Math.min(23, Math.max(0, entero(process.env.BACKUP_HOUR, 3))),
        clave: process.env.BACKUP_ENCRYPTION_KEY || '',
        motor: ['pg_dump', 'json'].includes(process.env.BACKUP_ENGINE) ? process.env.BACKUP_ENGINE : 'auto',
        pgBin: process.env.PG_BIN_DIR || '',
    };
}

function conexion(baseDatos) {
    return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        database: baseDatos || process.env.DB_NAME || 'SS SWAP_db',
        ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };
}

/** Conexión para la prueba de restauración (por defecto, el mismo servidor). */
function conexionPrueba(baseDatos) {
    const base = conexion(baseDatos);
    return {
        ...base,
        host: process.env.RESTORE_TEST_HOST || base.host,
        port: parseInt(process.env.RESTORE_TEST_PORT) || base.port,
        user: process.env.RESTORE_TEST_USER || base.user,
        password: process.env.RESTORE_TEST_PASSWORD || base.password,
        ssl: process.env.RESTORE_TEST_HOST ? (process.env.RESTORE_TEST_SSL === 'true' ? { rejectUnauthorized: false } : false) : base.ssl,
    };
}

// ── Binarios de PostgreSQL ─────────────────────────────────────

/** Ruta de un binario (pg_dump / pg_restore) o null si no está disponible. */
function binarioPg(nombre) {
    const exe = process.platform === 'win32' ? `${nombre}.exe` : nombre;
    const candidatos = [];
    if (config().pgBin) candidatos.push(path.join(config().pgBin, exe));
    candidatos.push(exe);
    if (process.platform === 'win32') {
        const raiz = 'C:\\Program Files\\PostgreSQL';
        try {
            fs.readdirSync(raiz).sort((a, b) => Number(b) - Number(a))
                .forEach(v => candidatos.push(path.join(raiz, v, 'bin', exe)));
        } catch { /* sin instalacion en la ruta estandar */ }
    }
    for (const c of candidatos) {
        try {
            const r = spawnSync(c, ['--version'], { encoding: 'utf8', timeout: 10000 });
            if (r.status === 0) return c;
        } catch { /* probar el siguiente */ }
    }
    return null;
}

function motorDisponible() {
    const cfg = config();
    if (cfg.motor === 'json') return 'json';
    const pgDump = binarioPg('pg_dump');
    if (pgDump) return 'pg_dump';
    if (cfg.motor === 'pg_dump') throw new Error('BACKUP_ENGINE=pg_dump pero pg_dump no esta disponible (definir PG_BIN_DIR).');
    return 'json';
}

/** Ejecuta un binario sin pasar la contraseña por la línea de comandos. */
function ejecutar(binario, args, con) {
    return new Promise((resolve, reject) => {
        const env = { ...process.env, PGPASSWORD: con.password || '' };
        if (con.ssl) env.PGSSLMODE = 'require';
        const p = spawn(binario, args, { env, windowsHide: true });
        let err = '';
        p.stderr.on('data', d => { err += d.toString(); });
        p.on('error', reject);
        p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${path.basename(binario)} termino con codigo ${code}: ${err.slice(0, 500)}`))));
    });
}

// ── Cifrado (AES-256-GCM) ──────────────────────────────────────
const MAGIA = Buffer.from('SSWBK1');

function derivarClave(clave, sal) {
    return crypto.scryptSync(clave, sal, 32);
}

function cifrarArchivo(origen, destino, clave) {
    const sal = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const cifrador = crypto.createCipheriv('aes-256-gcm', derivarClave(clave, sal), iv);
    const datos = Buffer.concat([cifrador.update(fs.readFileSync(origen)), cifrador.final()]);
    fs.writeFileSync(destino, Buffer.concat([MAGIA, sal, iv, datos, cifrador.getAuthTag()]), { mode: 0o600 });
}

function descifrarArchivo(origen, destino, clave) {
    const b = fs.readFileSync(origen);
    if (!b.subarray(0, MAGIA.length).equals(MAGIA)) throw new Error('El archivo no es un respaldo cifrado de SS SWAP.');
    if (!clave) throw new Error('El respaldo esta cifrado: define BACKUP_ENCRYPTION_KEY para descifrarlo.');
    const sal = b.subarray(6, 22);
    const iv = b.subarray(22, 34);
    const tag = b.subarray(b.length - 16);
    const d = crypto.createDecipheriv('aes-256-gcm', derivarClave(clave, sal), iv);
    d.setAuthTag(tag);
    fs.writeFileSync(destino, Buffer.concat([d.update(b.subarray(34, b.length - 16)), d.final()]), { mode: 0o600 });
}

const sha256 = (archivo) => crypto.createHash('sha256').update(fs.readFileSync(archivo)).digest('hex');

// ── Información del sistema ───────────────────────────────────

function versionApp() {
    try { return require(path.join(RAIZ_BACKEND, 'package.json')).version; } catch { return null; }
}

function commitGit() {
    try {
        return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: RAIZ_PROYECTO, encoding: 'utf8', timeout: 5000 }).trim();
    } catch { return null; }
}

// ── Registro (tabla respaldos_registro) ───────────────────────

async function registrar(sql, params) {
    try {
        // Tabla de la plataforma: sin aislamiento por empresa.
        const { rows } = await sinAislamiento(() => pool.query(sql, params));
        return rows[0] || null;
    } catch (err) {
        // Antes de la migracion multiempresa la tabla no existe: el respaldo
        // se hace igual (queda el manifiesto y la salida en consola).
        console.warn('[respaldo] No se pudo registrar en respaldos_registro:', err.message);
        return null;
    }
}

async function tablasPublicas(cliente) {
    const { rows } = await cliente.query(
        `SELECT c.relname AS tabla FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' ORDER BY c.relname`);
    return rows.map(r => r.tabla);
}

async function conteos(cliente) {
    const out = {};
    for (const t of await tablasPublicas(cliente)) {
        const { rows } = await cliente.query(`SELECT COUNT(*)::bigint AS n FROM "${t}"`);
        out[t] = Number(rows[0].n);
    }
    return out;
}

// ── Motor JSON ────────────────────────────────────────────────

async function volcarJson(cliente, archivo) {
    const gz = zlib.createGzip();
    const salida = fs.createWriteStream(archivo, { mode: 0o600 });
    gz.pipe(salida);
    const escribir = (obj) => new Promise(ok => { if (gz.write(`${JSON.stringify(obj)}\n`)) ok(); else gz.once('drain', ok); });
    for (const t of await tablasPublicas(cliente)) {
        const { rows } = await cliente.query(`SELECT row_to_json(x) AS f FROM "${t}" x`);
        for (const r of rows) await escribir({ t, f: r.f });
    }
    const { rows: seqs } = await cliente.query(
        `SELECT schemaname, sequencename, last_value FROM pg_sequences WHERE schemaname = 'public'`);
    await escribir({ secuencias: seqs.map(s => ({ nombre: s.sequencename, valor: s.last_value })) });
    await new Promise((ok, mal) => { salida.on('finish', ok); salida.on('error', mal); gz.end(); });
}

/** Orden de carga: primero las tablas referenciadas (llaves foráneas). */
async function ordenTablas(cliente, tablas) {
    const { rows } = await cliente.query(
        `SELECT DISTINCT conrelid::regclass::text AS hija, confrelid::regclass::text AS padre
         FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace AND conrelid <> confrelid`);
    const deps = new Map(tablas.map(t => [t, new Set()]));
    rows.forEach(r => { if (deps.has(r.hija) && deps.has(r.padre)) deps.get(r.hija).add(r.padre); });
    const orden = [];
    const pendientes = new Set(tablas);
    while (pendientes.size) {
        const listas = [...pendientes].filter(t => [...deps.get(t)].every(p => !pendientes.has(p)));
        if (!listas.length) throw new Error(`Dependencia circular entre tablas: ${[...pendientes].join(', ')}`);
        listas.sort().forEach(t => { orden.push(t); pendientes.delete(t); });
    }
    return orden;
}

async function cargarJson(cliente, archivo) {
    // Esquema: el mismo que usa la aplicacion (schema.sql + migrations.sql).
    const config_ = path.join(__dirname, '..', 'config');
    await cliente.query(fs.readFileSync(path.join(config_, 'schema.sql'), 'utf8').replace('$2b$10$PLACEHOLDER_REPLACED_BY_SEED', '$2b$10$restauracion.sin.acceso.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'));
    await cliente.query(fs.readFileSync(path.join(config_, 'migrations.sql'), 'utf8'));

    const filas = new Map();
    let secuencias = [];
    const lineas = zlib.gunzipSync(fs.readFileSync(archivo)).toString('utf8').split('\n');
    for (const l of lineas) {
        if (!l.trim()) continue;
        const o = JSON.parse(l);
        if (o.secuencias) { secuencias = o.secuencias; continue; }
        if (!filas.has(o.t)) filas.set(o.t, []);
        filas.get(o.t).push(o.f);
    }
    const tablas = await tablasPublicas(cliente);
    await cliente.query('BEGIN');
    try {
        await cliente.query(`SELECT set_config('ssswap.gestion_superadmin', 'on', true)`);
        // Las semillas de migrations.sql se reemplazan por los datos del respaldo.
        await cliente.query(`TRUNCATE ${tablas.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
        for (const t of await ordenTablas(cliente, tablas)) {
            const datos = filas.get(t);
            if (!datos?.length) continue;
            const { rows: cols } = await cliente.query(
                `SELECT attname FROM pg_attribute WHERE attrelid = $1::regclass AND attnum > 0 AND NOT attisdropped AND attgenerated = ''
                 ORDER BY attnum`, [`"${t}"`]);
            const lista = cols.map(c => `"${c.attname}"`).join(', ');
            // Autorreferencias (p. ej. movimiento revertido): por id ascendente.
            datos.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
            for (let i = 0; i < datos.length; i += 500) {
                await cliente.query(
                    `INSERT INTO "${t}" (${lista}) SELECT ${lista} FROM json_populate_recordset(NULL::"${t}", $1::json)`,
                    [JSON.stringify(datos.slice(i, i + 500))]);
            }
        }
        for (const s of secuencias) {
            if (s.valor != null) await cliente.query('SELECT setval($1::regclass, $2)', [`"${s.nombre}"`, s.valor]);
        }
        await cliente.query('COMMIT');
    } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
    }
}

// ── Archivos subidos (uploads/) ───────────────────────────────

function empaquetarUploads(destino) {
    const uploads = path.join(RAIZ_BACKEND, 'uploads');
    if (!fs.existsSync(uploads)) return { incluido: false, motivo: 'no existe la carpeta uploads' };
    // Rutas RELATIVAS: el tar de Git para Windows confunde 'C:' con un servidor remoto.
    const r = spawnSync('tar', ['-czf', path.relative(RAIZ_BACKEND, destino), 'uploads'],
        { cwd: RAIZ_BACKEND, encoding: 'utf8', timeout: 5 * 60 * 1000, windowsHide: true });
    if (r.status !== 0) return { incluido: false, motivo: `tar no disponible o fallo: ${(r.stderr || r.error?.message || '').slice(0, 200)}` };
    return { incluido: true };
}

// ── Respaldo ──────────────────────────────────────────────────

let enCurso = false;

const marcaTiempo = (d = new Date()) => d.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);

/**
 * Realiza un respaldo completo. tipo: automatico | manual | previo_migracion | previo_restauracion.
 * Devuelve el resumen (también queda en respaldos_registro).
 */
async function realizarRespaldo({ tipo = 'manual', ejecutadoPor = 'sistema' } = {}) {
    if (enCurso) throw new Error('Ya hay un respaldo en curso.');
    enCurso = true;
    const cfg = config();
    const inicio = new Date();
    const base = `ssswap_${marcaTiempo(inicio)}_${tipo}`;
    const resumen = { tipo, inicio, archivo: null, motor: null, cifrado: Boolean(cfg.clave), resultado: 'error' };
    const reg = await registrar(
        `INSERT INTO respaldos_registro (tipo, version_app, commit_git, alcance, ejecutado_por, cifrado)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [tipo, versionApp(), commitGit(), 'Base de datos completa (todas las empresas) + uploads/', String(ejecutadoPor).slice(0, 150), resumen.cifrado]);
    resumen.id = reg?.id ?? null;
    const temporales = [];
    try {
        fs.mkdirSync(cfg.dir, { recursive: true, mode: 0o700 });
        const motor = motorDisponible();
        resumen.motor = motor;
        const con = conexion();
        const cliente = new Client(con);
        await cliente.connect();
        let filas;
        let archivoPlano;
        try {
            filas = await conteos(cliente);
            if (motor === 'pg_dump') {
                archivoPlano = path.join(cfg.dir, `${base}.dump`);
                await ejecutar(binarioPg('pg_dump'), ['-h', con.host, '-p', String(con.port), '-U', con.user, '-d', con.database, '-Fc', '--no-owner', '-f', archivoPlano], con);
            } else {
                archivoPlano = path.join(cfg.dir, `${base}.json.gz`);
                await volcarJson(cliente, archivoPlano);
            }
        } finally {
            await cliente.end().catch(() => {});
        }

        const archivos = [];
        const agregar = (plano) => {
            if (cfg.clave) {
                const cifrado = `${plano}.enc`;
                cifrarArchivo(plano, cifrado, cfg.clave);
                temporales.push(plano);
                archivos.push(cifrado);
            } else {
                fs.chmodSync(plano, 0o600);
                archivos.push(plano);
            }
        };
        agregar(archivoPlano);
        const archivoUploads = path.join(cfg.dir, `${base}_uploads.tar.gz`);
        const uploads = empaquetarUploads(archivoUploads);
        if (uploads.incluido) agregar(archivoUploads);

        const detalleArchivos = archivos.map(a => ({ nombre: path.basename(a), bytes: fs.statSync(a).size, sha256: sha256(a) }));
        const manifiesto = {
            sistema: 'SS SWAP', version_app: versionApp(), commit_git: commitGit(),
            fecha: inicio.toISOString(), tipo, motor, cifrado: Boolean(cfg.clave),
            alcance: 'Base de datos completa (todas las empresas: esquema y datos) + uploads/. NO incluye .env (secretos).',
            base_datos: { host: con.host, nombre: con.database },
            uploads, archivos: detalleArchivos, filas,
        };
        fs.writeFileSync(path.join(cfg.dir, `${base}.manifest.json`), JSON.stringify(manifiesto, null, 2), { mode: 0o600 });

        resumen.archivo = detalleArchivos[0].nombre;
        resumen.bytes = detalleArchivos.reduce((s, a) => s + a.bytes, 0);
        resumen.sha256 = detalleArchivos[0].sha256;
        resumen.resultado = 'exito';
        resumen.retencion = limpiarAntiguos();
        await registrar(
            `UPDATE respaldos_registro SET fin = NOW(), motor = $2, archivo = $3, tamano_bytes = $4, sha256 = $5,
                    resultado = 'exito', detalle = $6 WHERE id = $1`,
            [resumen.id, motor, resumen.archivo, resumen.bytes, resumen.sha256,
             JSON.stringify({ archivos: detalleArchivos, uploads, tablas: Object.keys(filas).length, retencion: resumen.retencion })]);
        return resumen;
    } catch (err) {
        resumen.error = err.message;
        console.error('[respaldo] Error:', err.message);
        await registrar(`UPDATE respaldos_registro SET fin = NOW(), motor = $2, resultado = 'error', detalle = $3 WHERE id = $1`,
            [resumen.id, resumen.motor, JSON.stringify({ error: err.message.slice(0, 500) })]);
        return resumen;
    } finally {
        temporales.forEach(t => fs.rmSync(t, { force: true }));
        enCurso = false;
    }
}

// ── Retención ─────────────────────────────────────────────────
const PATRON = /^ssswap_(\d{8}-\d{6})_[a-z_]+/;

/** Grupos de archivos por respaldo (mismo prefijo), del más nuevo al más viejo. */
function respaldosEnDisco() {
    const cfg = config();
    if (!fs.existsSync(cfg.dir)) return [];
    const grupos = new Map();
    for (const nombre of fs.readdirSync(cfg.dir)) {
        const m = nombre.match(PATRON);
        if (!m) continue; // archivos ajenos (respaldos manuales, etc.): nunca se tocan
        const clave = m[0];
        if (!grupos.has(clave)) grupos.set(clave, { clave, fecha: m[1], archivos: [], manifiesto: null });
        const g = grupos.get(clave);
        g.archivos.push(nombre);
        if (nombre.endsWith('.manifest.json')) g.manifiesto = nombre;
    }
    return [...grupos.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function limpiarAntiguos() {
    const cfg = config();
    const limite = Date.now() - cfg.retencionDias * 24 * 60 * 60 * 1000;
    // Solo cuentan como "correctos" los que tienen manifiesto (se escribe al final).
    const correctos = respaldosEnDisco().filter(g => g.manifiesto && !g.clave.includes('prueba'));
    const borrados = [];
    correctos.slice(cfg.minimoConservar).forEach(g => {
        const f = g.fecha;
        const fecha = Date.UTC(+f.slice(0, 4), +f.slice(4, 6) - 1, +f.slice(6, 8), +f.slice(9, 11), +f.slice(11, 13), +f.slice(13, 15));
        if (fecha < limite) {
            g.archivos.forEach(a => fs.rmSync(path.join(cfg.dir, a), { force: true }));
            borrados.push(g.clave);
        }
    });
    if (borrados.length) console.log(`[respaldo] Retencion: se eliminaron ${borrados.length} respaldo(s) antiguos.`);
    return { conservados: Math.min(correctos.length, Math.max(cfg.minimoConservar, correctos.length - borrados.length)), eliminados: borrados };
}

// ── Restauración ──────────────────────────────────────────────

/** Lee el manifiesto y deja el archivo de datos descifrado en un temporal. */
function prepararArchivo(grupo) {
    const cfg = config();
    const manifiesto = JSON.parse(fs.readFileSync(path.join(cfg.dir, grupo.manifiesto), 'utf8'));
    const datos = manifiesto.archivos[0];
    const ruta = path.join(cfg.dir, datos.nombre);
    if (sha256(ruta) !== datos.sha256) throw new Error(`El archivo ${datos.nombre} no coincide con su SHA-256: esta danado o fue modificado.`);
    if (!manifiesto.cifrado) return { manifiesto, archivo: ruta, temporal: null };
    const temporal = path.join(os.tmpdir(), `ssswap_restauracion_${process.pid}_${Date.now()}`);
    descifrarArchivo(ruta, temporal, cfg.clave);
    return { manifiesto, archivo: temporal, temporal };
}

/**
 * El respaldo incluye los permisos del rol de la aplicacion (ssswap_app):
 * el rol debe existir en el servidor de destino antes de restaurar.
 */
async function asegurarRolApp(con, destino) {
    const cliente = new Client({ ...con, database: destino });
    await cliente.connect();
    try {
        await cliente.query(`DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${pool.ROL_APP}') THEN
                CREATE ROLE ${pool.ROL_APP} NOLOGIN NOSUPERUSER NOBYPASSRLS;
            END IF;
            IF NOT pg_has_role(current_user, '${pool.ROL_APP}', 'MEMBER') THEN
                EXECUTE format('GRANT ${pool.ROL_APP} TO %I', current_user);
            END IF;
        END $$`);
    } finally { await cliente.end().catch(() => {}); }
}

/** Restaura el respaldo en `destino` (debe estar vacía o ser creada aquí). */
async function restaurarEn(grupo, destino, con) {
    const { manifiesto, archivo, temporal } = prepararArchivo(grupo);
    try {
        await asegurarRolApp(con, destino);
        if (manifiesto.motor === 'pg_dump') {
            const pgRestore = binarioPg('pg_restore');
            if (!pgRestore) throw new Error('pg_restore no esta disponible en este servidor.');
            await ejecutar(pgRestore, ['-h', con.host, '-p', String(con.port), '-U', con.user, '-d', destino,
                '--no-owner', '--clean', '--if-exists', '--exit-on-error', archivo], con);
        } else {
            const cliente = new Client({ ...con, database: destino });
            await cliente.connect();
            try { await cargarJson(cliente, archivo); } finally { await cliente.end().catch(() => {}); }
        }
        return manifiesto;
    } finally {
        if (temporal) fs.rmSync(temporal, { force: true });
    }
}

/** Verificaciones sobre una base restaurada: filas por tabla y relaciones. */
async function verificar(con, destino, manifiesto) {
    const cliente = new Client({ ...con, database: destino });
    await cliente.connect();
    try {
        const filas = await conteos(cliente);
        const diferencias = Object.entries(manifiesto.filas || {})
            .filter(([t, n]) => filas[t] !== n)
            .map(([t, n]) => ({ tabla: t, esperado: n, restaurado: filas[t] ?? null }));
        // Relaciones: ningun hijo apunta a un padre inexistente (todas las FK).
        const { rows: fks } = await cliente.query(
            `SELECT conrelid::regclass::text AS hija, confrelid::regclass::text AS padre,
                    (SELECT array_agg(a.attname::text ORDER BY k.n) FROM unnest(conkey) WITH ORDINALITY k(col, n)
                       JOIN pg_attribute a ON a.attrelid = conrelid AND a.attnum = k.col) AS cols,
                    (SELECT array_agg(a.attname::text ORDER BY k.n) FROM unnest(confkey) WITH ORDINALITY k(col, n)
                       JOIN pg_attribute a ON a.attrelid = confrelid AND a.attnum = k.col) AS refs
             FROM pg_constraint WHERE contype = 'f' AND connamespace = 'public'::regnamespace`);
        const huerfanos = [];
        for (const fk of fks) {
            const on = fk.cols.map((c, i) => `p."${fk.refs[i]}" = h."${c}"`).join(' AND ');
            const noNulos = fk.cols.map(c => `h."${c}" IS NOT NULL`).join(' AND ');
            const { rows } = await cliente.query(
                `SELECT COUNT(*)::int AS n FROM ${fk.hija} h WHERE ${noNulos} AND NOT EXISTS (SELECT 1 FROM ${fk.padre} p WHERE ${on})`);
            if (rows[0].n) huerfanos.push({ relacion: `${fk.hija}(${fk.cols}) -> ${fk.padre}`, filas: rows[0].n });
        }
        const { rows: rls } = await cliente.query(
            `SELECT COUNT(*)::int AS n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
             WHERE ns.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity`);
        return { tablas: Object.keys(filas).length, filas_totales: Object.values(filas).reduce((s, n) => s + n, 0),
                 diferencias, relaciones_revisadas: fks.length, huerfanos, tablas_con_rls: rls[0].n,
                 correcto: diferencias.length === 0 && huerfanos.length === 0 };
    } finally {
        await cliente.end().catch(() => {});
    }
}

async function crearBase(con, nombre) {
    const admin = new Client({ ...con, database: process.env.RESTORE_TEST_ADMIN_DB || 'postgres' });
    await admin.connect();
    try {
        await admin.query(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`);
        await admin.query(`CREATE DATABASE "${nombre}"`);
    } finally { await admin.end().catch(() => {}); }
}

async function borrarBase(con, nombre) {
    const admin = new Client({ ...con, database: process.env.RESTORE_TEST_ADMIN_DB || 'postgres' });
    await admin.connect();
    try { await admin.query(`DROP DATABASE IF EXISTS "${nombre}" WITH (FORCE)`); } finally { await admin.end().catch(() => {}); }
}

const BASE_PRUEBA = 'ssswap_prueba_restauracion';

/**
 * Restaura el respaldo más reciente (o `clave`) en una base TEMPORAL aislada,
 * verifica filas y relaciones, y la elimina. Nunca toca la base de la app.
 */
async function probarRestauracion({ clave = null, ejecutadoPor = 'sistema', conservar = false } = {}) {
    const grupo = respaldosEnDisco().find(g => g.manifiesto && (!clave || g.clave === clave));
    const resumen = { tipo: 'prueba_restauracion', archivo: grupo?.clave ?? null, resultado: 'error', base_prueba: BASE_PRUEBA };
    const con = conexionPrueba();
    const reg = await registrar(
        `INSERT INTO respaldos_registro (tipo, archivo, version_app, commit_git, alcance, ejecutado_por)
         VALUES ('prueba_restauracion', $1, $2, $3, $4, $5) RETURNING id`,
        [resumen.archivo, versionApp(), commitGit(), `Restauracion en base aislada ${BASE_PRUEBA} (${con.host})`, String(ejecutadoPor).slice(0, 150)]);
    resumen.id = reg?.id ?? null;
    try {
        if (!grupo) throw new Error('No hay respaldos completos (con manifiesto) para probar.');
        if (con.host === conexion().host && BASE_PRUEBA === conexion().database) throw new Error('La base de prueba no puede ser la base de la aplicacion.');
        await crearBase(con, BASE_PRUEBA);
        const manifiesto = await restaurarEn(grupo, BASE_PRUEBA, con);
        resumen.verificacion = await verificar(con, BASE_PRUEBA, manifiesto);
        resumen.motor = manifiesto.motor;
        resumen.resultado = resumen.verificacion.correcto ? 'exito' : 'error';
    } catch (err) {
        resumen.error = err.message;
        console.error('[respaldo] Prueba de restauracion fallida:', err.message);
    } finally {
        if (!conservar) await borrarBase(con, BASE_PRUEBA).catch(() => {});
    }
    await registrar(`UPDATE respaldos_registro SET fin = NOW(), motor = $2, resultado = $3, detalle = $4 WHERE id = $1`,
        [resumen.id, resumen.motor || null, resumen.resultado,
         JSON.stringify(resumen.error ? { error: resumen.error.slice(0, 500) } : resumen.verificacion)]);
    return resumen;
}

// ── Estado y programación ─────────────────────────────────────

async function ultimoRespaldo() {
    const r = await registrar(
        `SELECT id, inicio, fin, tipo, motor, archivo, tamano_bytes, cifrado, resultado FROM respaldos_registro
         WHERE tipo <> 'prueba_restauracion' ORDER BY inicio DESC LIMIT 1`, []);
    return r;
}

async function estado() {
    const cfg = config();
    let registro = [];
    try {
        ({ rows: registro } = await sinAislamiento(() => pool.query(
            `SELECT id, inicio, fin, tipo, motor, archivo, tamano_bytes, sha256, cifrado, version_app, commit_git, alcance, resultado, detalle, ejecutado_por
             FROM respaldos_registro ORDER BY inicio DESC LIMIT 60`)));
    } catch { /* sin tabla todavia */ }
    let motor;
    try { motor = motorDisponible(); } catch (err) { motor = `no disponible (${err.message})`; }
    return {
        configuracion: {
            carpeta: cfg.dir, automatico: cfg.automatico, hora: cfg.hora, retencion_dias: cfg.retencionDias,
            minimo_conservar: cfg.minimoConservar, cifrado: Boolean(cfg.clave), motor,
        },
        en_disco: respaldosEnDisco().slice(0, 30).map(g => ({ clave: g.clave, completo: Boolean(g.manifiesto), archivos: g.archivos.length })),
        registro,
    };
}

let temporizador = null;

/** Programa el respaldo diario dentro del servidor (si BACKUP_AUTO=true). */
function iniciarRespaldoAutomatico() {
    const cfg = config();
    if (!cfg.automatico) {
        console.log('  Respaldos: automaticos DESACTIVADOS (BACKUP_AUTO no es "true").');
        return;
    }
    const programar = () => {
        const ahora = new Date();
        const proximo = new Date(ahora);
        proximo.setHours(cfg.hora, 0, 0, 0);
        if (proximo <= ahora) proximo.setDate(proximo.getDate() + 1);
        clearTimeout(temporizador);
        temporizador = setTimeout(async () => {
            const r = await realizarRespaldo({ tipo: 'automatico', ejecutadoPor: 'programador del servidor' }).catch(e => ({ resultado: 'error', error: e.message }));
            console.log(`[respaldo] Automatico: ${r.resultado}${r.error ? ` (${r.error})` : ''}`);
            programar();
        }, proximo - ahora);
        temporizador.unref();
        console.log(`  Respaldos: automatico diario a las ${String(cfg.hora).padStart(2, '0')}:00 (proximo ${proximo.toLocaleString('es-EC')}).`);
    };
    programar();
    // Si el servidor estuvo apagado a la hora programada, recupera el respaldo atrasado.
    setTimeout(async () => {
        const ultimo = await ultimoRespaldo().catch(() => null);
        const horas = ultimo?.inicio ? (Date.now() - new Date(ultimo.inicio).getTime()) / 3600000 : Infinity;
        if (horas > 26 || ultimo?.resultado === 'error') {
            const r = await realizarRespaldo({ tipo: 'automatico', ejecutadoPor: 'recuperacion al arrancar' }).catch(e => ({ resultado: 'error', error: e.message }));
            console.log(`[respaldo] Respaldo atrasado: ${r.resultado}${r.error ? ` (${r.error})` : ''}`);
        }
    }, 2 * 60 * 1000).unref();
}

module.exports = {
    realizarRespaldo, probarRestauracion, restaurarEn, verificar, respaldosEnDisco, estado, ultimoRespaldo,
    iniciarRespaldoAutomatico, limpiarAntiguos, conexion, crearBase, borrarBase, config,
    _interno: { cifrarArchivo, descifrarArchivo, ordenTablas },
};
