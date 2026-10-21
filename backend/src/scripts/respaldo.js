#!/usr/bin/env node
/**
 * SS SWAP - Respaldo manual / programado y prueba de restauración
 *
 *   npm run respaldo                      respaldo completo (BD + uploads/)
 *   npm run respaldo -- --tipo previo_migracion
 *   npm run respaldo:probar               restaura el último respaldo en una base
 *                                         TEMPORAL aislada, verifica y la borra
 *   npm run respaldo -- --listar          respaldos en disco
 *
 * Lo usa también el Programador de tareas de Windows / cron (ver
 * scripts/programar-respaldo-windows.ps1 y LEEME). Configuración por .env:
 * BACKUP_DIR, BACKUP_RETENTION_DAYS, BACKUP_MIN_KEEP, BACKUP_ENCRYPTION_KEY,
 * BACKUP_ENGINE, PG_BIN_DIR (ver backend/.env.example).
 * Termina con código 1 si algo falla, para que el programador lo detecte.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const pool = require('../config/db');
const respaldos = require('../services/respaldo.service');

const args = process.argv.slice(2);
const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const TIPOS = ['manual', 'automatico', 'previo_migracion', 'previo_restauracion'];

async function main() {
    if (args.includes('--listar')) {
        const lista = respaldos.respaldosEnDisco();
        if (!lista.length) console.log(`No hay respaldos en ${respaldos.config().dir}`);
        lista.forEach(g => console.log(`${g.clave}  ${g.manifiesto ? 'completo' : 'INCOMPLETO'}  (${g.archivos.length} archivo/s)`));
        return 0;
    }
    if (args.includes('--probar')) {
        const r = await respaldos.probarRestauracion({ clave: valor('--clave') || null, ejecutadoPor: 'npm run respaldo:probar', conservar: args.includes('--conservar') });
        console.log(JSON.stringify(r, null, 2));
        return r.resultado === 'exito' ? 0 : 1;
    }
    const tipo = TIPOS.includes(valor('--tipo')) ? valor('--tipo') : 'manual';
    const r = await respaldos.realizarRespaldo({ tipo, ejecutadoPor: `npm run respaldo (${require('os').userInfo().username})` });
    console.log(JSON.stringify(r, null, 2));
    return r.resultado === 'exito' ? 0 : 1;
}

main()
    .then(async (codigo) => { await pool.end().catch(() => {}); process.exit(codigo); })
    .catch(async (err) => { console.error(`ERROR: ${err.message}`); await pool.end().catch(() => {}); process.exit(1); });
