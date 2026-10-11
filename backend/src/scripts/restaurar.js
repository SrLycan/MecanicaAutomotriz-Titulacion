#!/usr/bin/env node
/**
 * SS SWAP - Restauración CONTROLADA de un respaldo
 *
 *   npm run restaurar -- --clave ssswap_20261011-180000_manual --destino ssswap_restaurada
 *       Restaura en una base NUEVA (se crea). Es lo recomendado: se revisa y,
 *       si todo está bien, se apunta la aplicación a esa base.
 *
 *   npm run restaurar -- --clave ... --destino "<base de la app>" --confirmar-produccion
 *       Sobrescribe la base que usa la aplicación. Exige:
 *         1. el indicador --confirmar-produccion,
 *         2. escribir a mano el nombre de la base cuando se pide,
 *       y ANTES hace un respaldo "previo_restauracion" de esa base. Si ese
 *       respaldo falla, no restaura nada.
 *
 * Nunca restaura automáticamente: siempre lo ejecuta una persona.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });
const readline = require('readline');
const pool = require('../config/db');
const respaldos = require('../services/respaldo.service');

const args = process.argv.slice(2);
const valor = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };

function preguntar(texto) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(ok => rl.question(texto, r => { rl.close(); ok(r.trim()); }));
}

async function main() {
    const clave = valor('--clave');
    const destino = valor('--destino');
    if (!clave || !destino) {
        console.log('Uso: npm run restaurar -- --clave <respaldo> --destino <base> [--confirmar-produccion]');
        console.log('Respaldos disponibles:');
        respaldos.respaldosEnDisco().filter(g => g.manifiesto).forEach(g => console.log(`  ${g.clave}`));
        return 1;
    }
    const grupo = respaldos.respaldosEnDisco().find(g => g.clave === clave && g.manifiesto);
    if (!grupo) throw new Error(`No existe un respaldo completo con la clave ${clave}.`);

    const con = respaldos.conexion();
    const esProduccion = destino === con.database;
    if (esProduccion) {
        if (!args.includes('--confirmar-produccion'))
            throw new Error(`"${destino}" es la base que usa la aplicacion. Para sobrescribirla agrega --confirmar-produccion.`);
        console.log(`\n*** ATENCION: se va a SOBRESCRIBIR la base "${destino}" en ${con.host} con el respaldo ${clave}. ***`);
        console.log('Detén el servidor de la aplicacion antes de continuar.');
        const escrito = await preguntar(`Escribe el nombre exacto de la base para confirmar: `);
        if (escrito !== destino) throw new Error('Confirmacion incorrecta. No se restauro nada.');
        console.log('Respaldo previo de la base actual...');
        const previo = await respaldos.realizarRespaldo({ tipo: 'previo_restauracion', ejecutadoPor: 'npm run restaurar' });
        if (previo.resultado !== 'exito') throw new Error(`El respaldo previo fallo (${previo.error}). No se restauro nada.`);
        console.log(`Respaldo previo: ${previo.archivo}`);
    } else {
        await respaldos.crearBase(con, destino);
    }

    const manifiesto = await respaldos.restaurarEn(grupo, destino, con);
    const verificacion = await respaldos.verificar(con, destino, manifiesto);
    console.log(JSON.stringify({ restaurado_en: destino, respaldo: clave, verificacion }, null, 2));
    console.log(verificacion.correcto
        ? 'Restauracion verificada: filas y relaciones coinciden con el respaldo.'
        : 'ATENCION: la verificacion encontro diferencias. Revisa el detalle antes de usar esta base.');
    return verificacion.correcto ? 0 : 1;
}

main()
    .then(async (codigo) => { await pool.end().catch(() => {}); process.exit(codigo); })
    .catch(async (err) => { console.error(`ERROR: ${err.message}`); await pool.end().catch(() => {}); process.exit(1); });
