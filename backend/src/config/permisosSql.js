/**
 * SS SWAP - Genera las filas SQL del catálogo de permisos y de las
 * plantillas por rol a partir de permisos.js.
 *
 * migrations.sql (Sprint 21) contiene estas filas copiadas tal cual; la
 * prueba permisos.catalogo.test.js falla si alguien cambia permisos.js sin
 * actualizar la migración. Para regenerar:
 *
 *   node src/config/permisosSql.js
 */
const { MODULOS, PLANTILLAS } = require('./permisos');

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function filasCatalogo() {
    let orden = 0;
    return MODULOS.flatMap(m => m.acciones.map(a =>
        `    (${[q(m.codigo), q(a.codigo), q(m.nombre), q(a.nombre), q(m.grupo), ++orden, m.soloSuperadmin ? 'TRUE' : 'FALSE'].join(', ')})`
    )).join(',\n');
}

function filasPlantillas() {
    return Object.entries(PLANTILLAS).flatMap(([rol, permisos]) => permisos.map(p => {
        const [modulo, accion] = p.split(':');
        return `    (${[q(rol), q(modulo), q(accion)].join(', ')})`;
    })).join(',\n');
}

if (require.main === module) {
    console.log('-- Catalogo\n' + filasCatalogo() + '\n\n-- Plantillas\n' + filasPlantillas());
}

module.exports = { filasCatalogo, filasPlantillas };
