/**
 * SS SWAP - Numeración por empresa (tabla empresa_secuencias)
 *
 * Cada mecánica tiene sus propios contadores (proformas, códigos de
 * repuesto): una empresa nueva empieza en 1 y nunca "ve" ni consume los
 * números de otra. La fila del contador se bloquea mientras dura la
 * transacción, así dos usuarios a la vez nunca obtienen el mismo número.
 * La empresa la pone la base de datos (empresa de la petición).
 */

/** Siguiente valor del contador `nombre` de la empresa actual. */
async function siguienteNumero(db, nombre) {
    const { rows } = await db.query(
        `INSERT INTO empresa_secuencias (nombre, valor) VALUES ($1, 1)
         ON CONFLICT (empresa_id, nombre) DO UPDATE SET valor = empresa_secuencias.valor + 1
         RETURNING valor`, [nombre]);
    return Number(rows[0].valor);
}

module.exports = { siguienteNumero };
