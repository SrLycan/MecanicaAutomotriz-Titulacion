/**
 * SS SWAP - Normalizacion de columnas NUMERIC que devuelve `pg`.
 *
 * Desde el Sprint 14 el stock es NUMERIC(10,2) (para litros/galones
 * parciales de pintura). El driver `pg` devuelve NUMERIC como STRING
 * ("12.00"); el frontend hace operaciones como `stock_actual + qty`, que
 * con un string concatenaria en vez de sumar. En lugar de cambiar el parser
 * global de NUMERIC (afectaria a TODOS los montos del sistema), se
 * convierten explicitamente solo los campos de cantidades de inventario.
 */
const CAMPOS_STOCK = ['stock_actual', 'stock_minimo', 'cantidad', 'stock_anterior', 'stock_nuevo', 'precio_unitario', 'cantidad_devuelta'];

const aNumero = (v) => (v === null || v === undefined || v === '' ? v : Number(v));

/** Devuelve una copia de la fila con los campos de cantidad convertidos a Number. */
function normalizarCantidades(fila) {
    if (!fila) return fila;
    const out = { ...fila };
    for (const c of CAMPOS_STOCK) if (c in out) out[c] = aNumero(out[c]);
    return out;
}

/** Redondea a 2 decimales evitando errores de coma flotante (0.1+0.2). */
const redondear2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/** Valida una cantidad positiva con maximo 2 decimales. Devuelve el numero o null. */
function cantidadValida(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    if (Math.abs(redondear2(n) - n) > 1e-9) return null;
    return redondear2(n);
}

module.exports = { normalizarCantidades, redondear2, cantidadValida, aNumero };
