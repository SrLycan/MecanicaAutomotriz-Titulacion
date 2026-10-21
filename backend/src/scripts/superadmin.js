#!/usr/bin/env node
/**
 * SS SWAP - Gestión de SUPERADMINISTRADORES (solo desde el servidor)
 *
 * El rol superadministrador NO se puede obtener desde la web: ni el registro
 * público, ni la API, ni el panel lo asignan, y un trigger de la BD rechaza
 * cualquier cambio a ese rol que no venga de una sesión que active
 * "ssswap.gestion_superadmin" (lo que hace este script). Solo quien tiene
 * acceso al servidor y al .env de la base de datos puede ejecutarlo.
 *
 * Uso (desde la carpeta backend/):
 *   npm run superadmin -- --listar
 *   npm run superadmin -- --promover --email persona@ssswap.com
 *   npm run superadmin -- --crear --email persona@ssswap.com --nombre "Nombre Apellido" [--empresa ss-swap]
 *   npm run superadmin -- --empresa ss-swap --email persona@ssswap.com     (asigna su empresa propia)
 *   npm run superadmin -- --sin-empresa --email persona@ssswap.com         (solo plataforma)
 *   npm run superadmin -- --revocar --email persona@ssswap.com [--forzar]
 *
 * Multiempresa: el superadministrador administra la PLATAFORMA. Si además
 * tiene una "empresa propia" (p. ej. el dueño de SS SWAP) trabaja en ella con
 * acceso total; en cualquier otra empresa necesita un acceso de soporte.
 * --promover conserva la empresa que la cuenta ya tenía.
 *
 * --crear genera una contraseña temporal aleatoria y la muestra UNA sola vez
 * (no se guarda en ningún archivo ni registro). Cámbiala al iniciar sesión
 * desde "Mi cuenta". --revocar deja la cuenta como administrador con la
 * plantilla de permisos de administrador.
 */
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { ROL_SUPERADMIN, PLANTILLAS } = require('../config/permisos');

function leerArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (!a.startsWith('--')) continue;
        const clave = a.slice(2);
        const sig = argv[i + 1];
        if (sig !== undefined && !sig.startsWith('--')) { args[clave] = sig; i++; } else args[clave] = true;
    }
    return args;
}

function passwordTemporal() {
    const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    return [...crypto.randomBytes(16)].map(b => alfabeto[b % alfabeto.length]).join('').replace(/(.{4})(?!$)/g, '$1-');
}

async function auditar(client, accion, usuarioId, detalle) {
    await client.query(
        `INSERT INTO auditoria_seguridad (actor_id, actor_email, actor_rol, accion, recurso_tipo, recurso_id, resultado, detalle, empresa_id)
         VALUES (NULL, 'servidor (npm run superadmin)', NULL, $1, 'usuario', $2, 'exito', $3,
                 (SELECT empresa_id FROM usuarios WHERE id = $4))`,
        [accion, String(usuarioId), JSON.stringify(detalle), usuarioId]);
}

/** Id de la empresa por slug (o error claro). */
async function empresaPorSlug(client, slug) {
    const { rows } = await client.query('SELECT id FROM empresas WHERE slug = $1', [String(slug).toLowerCase()]);
    if (!rows[0]) throw new Error(`No existe la empresa "${slug}". Empresas: npm run superadmin -- --listar`);
    return rows[0].id;
}

/** Ejecuta fn dentro de una transacción con el permiso del trigger activado. */
async function conPermiso(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`SELECT set_config('ssswap.gestion_superadmin', 'on', true)`); // solo esta transaccion
        const r = await fn(client);
        await client.query('COMMIT');
        return r;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

async function listar() {
    const { rows } = await pool.query(
        `SELECT u.id, u.nombre, u.email, u.estado, u.ultimo_acceso, e.slug AS empresa
         FROM usuarios u LEFT JOIN empresas e ON e.id = u.empresa_id WHERE u.rol = $1 ORDER BY u.id`, [ROL_SUPERADMIN]);
    if (!rows.length) console.log('No hay superadministradores.');
    rows.forEach(u => console.log(`#${u.id}  ${u.email}  (${u.nombre})  estado: ${u.estado}  empresa propia: ${u.empresa || '(ninguna, solo plataforma)'}  ultimo acceso: ${u.ultimo_acceso ? u.ultimo_acceso.toISOString() : '-'}`));
    const { rows: emp } = await pool.query('SELECT id, slug, nombre, estado FROM empresas ORDER BY id').catch(() => ({ rows: [] }));
    if (emp.length) console.log('Empresas: ' + emp.map(e => `${e.slug} (${e.nombre}, ${e.estado})`).join(' | '));
}

async function promover(email) {
    return conPermiso(async (client) => {
        const { rows } = await client.query('SELECT id, rol, nombre FROM usuarios WHERE email = $1 FOR UPDATE', [email]);
        const u = rows[0];
        if (!u) throw new Error(`No existe una cuenta con el correo ${email}. Usa --crear.`);
        if (u.rol === ROL_SUPERADMIN) { console.log(`${email} ya es superadministrador.`); return; }
        if (u.rol === 'cliente') throw new Error('Esa cuenta es de un cliente del portal; crea una cuenta de personal con --crear.');
        await client.query(
            `UPDATE usuarios SET rol = $1, estado = 'activo', activo = TRUE, permisos_inicializados = TRUE,
                    token_version = token_version + 1 WHERE id = $2`, [ROL_SUPERADMIN, u.id]);
        // Ya tiene acceso total: las filas de permisos sobran.
        await client.query('DELETE FROM usuario_permisos WHERE usuario_id = $1', [u.id]);
        await auditar(client, 'superadmin.conceder', u.id, { email, rol_anterior: u.rol });
        console.log(`OK: ${u.nombre} <${email}> ahora es SUPERADMINISTRADOR. Debe iniciar sesion de nuevo.`);
    });
}

async function crear(email, nombre, slugEmpresa) {
    if (!nombre || nombre === true) throw new Error('Indica --nombre "Nombre Apellido".');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Correo invalido.');
    const password = passwordTemporal();
    return conPermiso(async (client) => {
        const { rows: existe } = await client.query('SELECT id FROM usuarios WHERE email = $1', [email]);
        if (existe.length) throw new Error('Ya existe una cuenta con ese correo. Usa --promover.');
        const hash = await bcrypt.hash(password, 10);
        const empresaId = slugEmpresa ? await empresaPorSlug(client, slugEmpresa) : null;
        const { rows } = await client.query(
            `INSERT INTO usuarios (nombre, email, password, rol, estado, activo, permisos_inicializados, empresa_id)
             VALUES ($1, $2, $3, $4, 'activo', TRUE, TRUE, $5) RETURNING id`,
            [String(nombre).trim(), email, hash, ROL_SUPERADMIN, empresaId]);
        await auditar(client, 'superadmin.crear', rows[0].id, { email });
        console.log(`OK: superadministrador creado (#${rows[0].id}) <${email}>.`);
        console.log('Contrasena temporal (se muestra UNA sola vez, no se guarda en ningun lado):');
        console.log(`\n    ${password}\n`);
        console.log('Inicia sesion en /admin/login y cambiala de inmediato desde "Mi cuenta".');
    });
}

async function asignarEmpresa(email, slugEmpresa) {
    return conPermiso(async (client) => {
        const { rows } = await client.query('SELECT id, rol FROM usuarios WHERE email = $1 FOR UPDATE', [email]);
        if (!rows[0] || rows[0].rol !== ROL_SUPERADMIN) throw new Error(`${email} no es superadministrador.`);
        const empresaId = slugEmpresa ? await empresaPorSlug(client, slugEmpresa) : null;
        await client.query('UPDATE usuarios SET empresa_id = $1, token_version = token_version + 1 WHERE id = $2', [empresaId, rows[0].id]);
        await auditar(client, 'superadmin.empresa_propia', rows[0].id, { email, empresa: slugEmpresa || null });
        console.log(`OK: ${email} ${slugEmpresa ? `tiene como empresa propia "${slugEmpresa}"` : 'queda solo como administrador de la plataforma'}. Debe iniciar sesion de nuevo.`);
    });
}

async function revocar(email, forzar) {
    return conPermiso(async (client) => {
        const { rows } = await client.query('SELECT id, rol, empresa_id FROM usuarios WHERE email = $1 FOR UPDATE', [email]);
        const u = rows[0];
        if (!u || u.rol !== ROL_SUPERADMIN) throw new Error(`${email} no es superadministrador.`);
        if (!u.empresa_id) throw new Error('Esta cuenta no tiene empresa propia: asigna una con --empresa <slug> antes de revocar (un administrador pertenece a una empresa).');
        const { rows: cuenta } = await client.query(
            `SELECT COUNT(*)::int AS n FROM usuarios WHERE rol = $1 AND activo AND estado = 'activo'`, [ROL_SUPERADMIN]);
        if (cuenta[0].n <= 1 && !forzar)
            throw new Error('Es el unico superadministrador activo. Crea otro antes o usa --forzar.');
        await client.query(
            `UPDATE usuarios SET rol = 'administrador', token_version = token_version + 1 WHERE id = $1`, [u.id]);
        for (const p of PLANTILLAS.administrador) {
            const [modulo, accion] = p.split(':');
            await client.query(
                `INSERT INTO usuario_permisos (usuario_id, modulo, accion, empresa_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
                [u.id, modulo, accion, u.empresa_id]);
        }
        await auditar(client, 'superadmin.revocar', u.id, { email, rol_nuevo: 'administrador' });
        console.log(`OK: ${email} dejo de ser superadministrador (ahora es administrador).`);
    });
}

async function main() {
    const args = leerArgs(process.argv.slice(2));
    const email = typeof args.email === 'string' ? args.email.toLowerCase().trim() : null;
    if (args.listar) return listar();
    if (!email) throw new Error('Indica --email. Ver uso al inicio de src/scripts/superadmin.js');
    if (args.promover) return promover(email);
    if (args.crear) return crear(email, args.nombre, typeof args.empresa === 'string' ? args.empresa : null);
    if (args.revocar) return revocar(email, Boolean(args.forzar));
    if (typeof args.empresa === 'string') return asignarEmpresa(email, args.empresa);
    if (args['sin-empresa']) return asignarEmpresa(email, null);
    throw new Error('Indica una accion: --listar, --promover, --crear, --empresa, --sin-empresa o --revocar.');
}

main()
    .then(() => pool.end())
    .catch(async (err) => {
        console.error(`ERROR: ${err.message}`);
        await pool.end().catch(() => {});
        process.exit(1);
    });
