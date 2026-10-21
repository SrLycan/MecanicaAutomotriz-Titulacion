/**
 * SS SWAP - Centro de ayuda: elige la guía de la sección actual (Sprint 27)
 *
 * Cada guía declara en `rutas` dónde aplica:
 *   { "path": "/dashboard/proveedores", "query": { "tab": "compras", "crear": "1" } }
 * - `path` admite segmentos ":id" (cualquier valor).
 * - En `query`, un valor puede ser texto, lista de textos, "" (el parámetro
 *   NO viene en la URL) o "*" (viene con cualquier valor).
 * Gana la regla más específica (ruta exacta y más parámetros coincidentes).
 */

function coincidePath(patron, pathname) {
    const a = patron.replace(/\/+$/, '').split('/');
    const b = pathname.replace(/\/+$/, '').split('/');
    if (a.length !== b.length) return false;
    return a.every((seg, i) => (seg.startsWith(':') ? Boolean(b[i]) : seg === b[i]));
}

function coincideValor(esperado, actual) {
    const lista = Array.isArray(esperado) ? esperado : [esperado];
    return lista.some(v => (v === '*' ? Boolean(actual) : v === '' ? !actual : actual === v));
}

/** Puntaje de una regla (0 = no aplica). */
export function puntajeRegla(regla, pathname, search) {
    if (!coincidePath(regla.path, pathname)) return 0;
    const params = new URLSearchParams(search || '');
    const query = regla.query || {};
    for (const [k, v] of Object.entries(query)) if (!coincideValor(v, params.get(k))) return 0;
    const dinamicos = (regla.path.match(/:/g) || []).length;
    return 100 - dinamicos * 5 + Object.keys(query).length * 10;
}

/** La guía que corresponde a la ubicación actual, o null. */
export function guiaParaUbicacion(guias, pathname, search) {
    let mejor = null;
    let puntos = 0;
    for (const g of guias) {
        for (const r of g.rutas || []) {
            const p = puntajeRegla(r, pathname, search);
            if (p > puntos) { puntos = p; mejor = g; }
        }
    }
    return mejor;
}

/** URL pública de una imagen de guía (frontend/public/ayuda/...). */
export const urlImagenAyuda = (archivo) => `${process.env.PUBLIC_URL || ''}/ayuda/${archivo}`;
