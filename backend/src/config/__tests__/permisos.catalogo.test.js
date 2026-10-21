/**
 * SS SWAP - Pruebas del catálogo de permisos (config/permisos.js)
 *
 * - El catálogo y las plantillas que la migración (Sprint 21) copia a la BD
 *   deben coincidir EXACTAMENTE con permisos.js; si alguien agrega un módulo
 *   y olvida la migración, esta prueba falla.
 * - Las plantillas solo usan permisos que existen y son asignables.
 * - Los módulos de seguridad (usuarios, auditoría) no se pueden delegar.
 */
const fs = require('fs');
const path = require('path');
const P = require('../permisos');
const { filasCatalogo, filasPlantillas } = require('../permisosSql');

const migracion = fs.readFileSync(path.join(__dirname, '..', 'migrations.sql'), 'utf-8').replace(/\r\n/g, '\n');
/** Todos los bloques entre las marcas (el catalogo aparece en el Sprint 21 y en el 22). */
function bloques(inicio, fin) {
    const out = [];
    let i = migracion.indexOf(inicio);
    while (i >= 0) {
        out.push(migracion.slice(i, migracion.indexOf(fin, i)));
        i = migracion.indexOf(inicio, i + 1);
    }
    return out;
}

describe('config/permisos — catalogo de modulos y acciones', () => {
    test('cada bloque de catalogo de la migracion es exactamente el generado desde permisos.js', () => {
        const lista = bloques('-- CATALOGO_INICIO', '-- CATALOGO_FIN');
        expect(lista.length).toBeGreaterThanOrEqual(2);
        lista.forEach(b => expect(b).toContain(filasCatalogo()));
    });

    test('la migracion contiene exactamente las plantillas generadas desde permisos.js', () => {
        const lista = bloques('-- PLANTILLAS_INICIO', '-- PLANTILLAS_FIN');
        expect(lista.length).toBe(1);
        expect(lista[0]).toContain(filasPlantillas());
    });

    test('no hay modulos ni acciones repetidos', () => {
        const codigos = P.MODULOS.map(m => m.codigo);
        expect(new Set(codigos).size).toBe(codigos.length);
        for (const m of P.MODULOS) {
            const acciones = m.acciones.map(a => a.codigo);
            expect(new Set(acciones).size).toBe(acciones.length);
        }
    });

    test('todas las plantillas usan permisos existentes y asignables', () => {
        for (const [rol, lista] of Object.entries(P.PLANTILLAS)) {
            for (const p of lista) {
                const [m, a] = p.split(':');
                expect({ rol, p, ok: P.esAsignable(m, a) }).toEqual({ rol, p, ok: true });
            }
        }
    });

    test('Sprint 22: usuarios, auditoria y configuracion de empresa se delegan al administrador de cada empresa', () => {
        expect(P.esAsignable('usuarios', 'editar')).toBe(true);
        expect(P.esAsignable('auditoria', 'ver')).toBe(true);
        expect(P.esAsignable('empresa', 'editar')).toBe(true);
        expect(P.PLANTILLAS.administrador).toEqual(expect.arrayContaining(['usuarios:ver', 'usuarios:editar', 'auditoria:ver', 'empresa:editar']));
        // Ni recepcion ni tecnicos los reciben por plantilla.
        expect(P.PLANTILLAS.recepcionista.some(p => p.startsWith('usuarios:'))).toBe(false);
        // La plataforma no es un permiso asignable.
        expect(P.todosAsignables().some(p => p.startsWith('plataforma:'))).toBe(false);
    });

    test('el rol superadministrador no es asignable desde el panel', () => {
        expect(P.ROLES_ASIGNABLES).not.toContain('superadministrador');
        expect(P.ROLES_STAFF).toContain('superadministrador');
    });

    test('el rol "interno" empieza sin permisos', () => {
        expect(P.PLANTILLAS.interno).toEqual([]);
    });

    test('mapeo de tipo de proforma y area de inventario a su modulo', () => {
        expect(P.moduloProforma('pintura')).toBe('proformas_colisiones');
        expect(P.moduloProforma('mecanica')).toBe('proformas_mecanica');
        expect(P.moduloInventario('colisiones')).toBe('inventario_colisiones');
        expect(P.moduloInventario('mecanica')).toBe('inventario_mecanica');
    });
});
