/**
 * SS SWAP - Utilidades para pruebas de integración multiempresa
 *
 * Las pruebas que llaman a los controladores directamente (sin pasar por
 * verificarToken) deben ejecutarse dentro de una empresa, igual que una
 * petición real: así las consultas quedan aisladas por RLS y los INSERT
 * toman empresa_id de la empresa del contexto.
 */
const db = require('../config/db');
const { conEmpresa, sinAislamiento } = require('../config/contexto');

/** Id de una empresa por slug (consulta de plataforma). */
async function idEmpresa(slug = 'ss-swap') {
    const { rows } = await sinAislamiento(() => db.query('SELECT id FROM empresas WHERE slug = $1', [slug]));
    if (!rows[0]) throw new Error(`No existe la empresa ${slug}: aplica migrations.sql a la base de pruebas.`);
    return rows[0].id;
}

/** "pool" que ejecuta todo dentro de la empresa que devuelve getId(). */
function poolEnEmpresa(getId) {
    return {
        query: (texto, params) => conEmpresa(getId(), () => db.query(texto, params)),
        connect: () => conEmpresa(getId(), () => db.connect()),
        end: () => db.end(),
    };
}

module.exports = { idEmpresa, poolEnEmpresa, conEmpresa, sinAislamiento, db };
