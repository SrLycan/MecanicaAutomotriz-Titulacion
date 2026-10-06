/**
 * SS SWAP - Aplicar migraciones idempotentes al arrancar el servidor.
 * Lee migrations.sql y lo ejecuta. Es seguro correrlo multiples veces
 * (usa IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
 */
const fs   = require('fs');
const path = require('path');
const pool = require('./db');

async function runMigrations() {
    const sqlPath = path.join(__dirname, 'migrations.sql');
    if (!fs.existsSync(sqlPath)) return;

    const sql = fs.readFileSync(sqlPath, 'utf-8');
    const client = await pool.connect();
    try {
        await client.query(sql);
        console.log('  Migraciones aplicadas (migrations.sql).');
    } catch (err) {
        console.error('  [migrations] Error aplicando migraciones:', err.message);
    } finally {
        client.release();
    }
}

module.exports = { runMigrations };
