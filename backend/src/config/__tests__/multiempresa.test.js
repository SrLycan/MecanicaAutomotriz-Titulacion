/**
 * SS SWAP - Pruebas de la definición multiempresa (config/multiempresa.js)
 *
 * - La migración (Sprint 22) contiene exactamente las llaves compuestas
 *   generadas desde multiempresa.js (si alguien cambia la lista sin
 *   regenerarlas, esta prueba falla).
 * - Toda relación protegida une tablas de empresa.
 * - Ninguna tabla está a la vez en "empresa" y "global".
 */
const fs = require('fs');
const path = require('path');
const M = require('../multiempresa');

const migracion = fs.readFileSync(path.join(__dirname, '..', 'migrations.sql'), 'utf-8').replace(/\r\n/g, '\n');
const bloque = migracion.slice(migracion.indexOf('-- RELACIONES_INICIO'), migracion.indexOf('-- RELACIONES_FIN'));

describe('config/multiempresa — aislamiento por empresa', () => {
    test('la migracion contiene exactamente las llaves compuestas generadas', () => {
        expect(bloque).toContain(M.sqlRelaciones());
    });

    test('las relaciones protegidas solo unen tablas de empresa', () => {
        for (const [tabla, , ref] of M.RELACIONES_EMPRESA) {
            expect(M.TABLAS_EMPRESA).toContain(tabla);
            expect(M.TABLAS_EMPRESA).toContain(ref);
        }
    });

    test('ninguna tabla es de empresa y global a la vez', () => {
        const globales = [...M.TABLAS_GLOBALES.catalogos, ...M.TABLAS_GLOBALES.plataforma];
        expect(M.TABLAS_EMPRESA.filter(t => globales.includes(t))).toEqual([]);
    });

    test('Sprint 23: la migracion contiene las llaves compuestas y las tablas generadas', () => {
        const b23 = migracion.slice(migracion.indexOf('-- RELACIONES23_INICIO'), migracion.indexOf('-- RELACIONES23_FIN'));
        expect(b23).toContain(M.sqlRelaciones(M.RELACIONES_SPRINT23));
        const lista = M.TABLAS_EMPRESA_SPRINT23.map(t => `'${t}'`).join(', ');
        // Politicas RLS y validaciones finales del bloque 23.
        expect(migracion.split(`ARRAY[${lista}]`).length - 1).toBe(2);
        for (const [tabla, , ref] of M.RELACIONES_SPRINT23) {
            expect(M.TODAS_TABLAS_EMPRESA).toContain(tabla);
            expect(M.TODAS_TABLAS_EMPRESA).toContain(ref);
        }
    });

    test('la migracion aplica RLS a la lista de tablas de empresa', () => {
        const lista = M.TABLAS_EMPRESA.map(t => `'${t}'`).join(', ');
        // Aparece en la asignacion de empresa, en las politicas y en las validaciones.
        expect(migracion.split(`ARRAY[${lista}]`).length - 1).toBe(3);
    });
});
