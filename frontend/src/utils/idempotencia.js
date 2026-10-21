/**
 * SS SWAP - Clave de idempotencia para formularios de creación
 *
 * Cada formulario abierto genera UNA clave y la envía en la cabecera
 * Idempotency-Key: si el mismo envío llega dos veces (doble clic, reintento
 * de red) el servidor no crea un segundo registro (idempotencia.middleware.js).
 */
export function nuevaClaveIdempotencia() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Config de axios con la cabecera de idempotencia. */
export const conClave = (clave) => ({ headers: { 'Idempotency-Key': clave } });
