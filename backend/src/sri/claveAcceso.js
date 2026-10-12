/**
 * SS SWAP - Clave de acceso de 49 dígitos (Ficha Técnica v2.34, Tabla 1)
 *
 *   fecha ddmmaaaa (8) + tipo comprobante (2) + RUC (13) + ambiente (1)
 *   + serie estab+ptoEmi (6) + secuencial (9) + código numérico (8)
 *   + tipo de emisión (1, siempre 1 = normal en off-line)
 *   + dígito verificador módulo 11 (1)
 *
 * Módulo 11 con factor ponderado 2..7 desde la derecha; si el resultado es
 * 11 el dígito es 0 y si es 10 el dígito es 1. En el esquema off-line la
 * clave de acceso es también el número de autorización.
 */
const crypto = require('crypto');

/** Dígito verificador módulo 11 de una cadena numérica (ficha: ejemplo 41261533 → 6). */
function digitoVerificador(cadena) {
    if (!/^\d+$/.test(cadena)) throw new Error('La cadena de la clave de acceso solo admite dígitos.');
    let suma = 0;
    let factor = 2;
    for (let i = cadena.length - 1; i >= 0; i--) {
        suma += Number(cadena[i]) * factor;
        factor = factor === 7 ? 2 : factor + 1;
    }
    const resultado = 11 - (suma % 11);
    if (resultado === 11) return 0;
    if (resultado === 10) return 1;
    return resultado;
}

/** Código numérico de 8 dígitos (la ficha deja el algoritmo al emisor): aleatorio criptográfico. */
const codigoNumerico = () => String(crypto.randomInt(0, 100000000)).padStart(8, '0');

/** Fecha 'YYYY-MM-DD' (o Date) → 'ddmmaaaa'. */
function fechaClave(fecha) {
    const iso = fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha).slice(0, 10);
    const [a, m, d] = iso.split('-');
    return `${d}${m}${a}`;
}

/**
 * Genera la clave. Todos los campos se validan por longitud: una clave mal
 * conformada es causa de rechazo (ficha, nota de la Tabla 1).
 */
function generarClaveAcceso({ fechaEmision, codDoc, ruc, ambiente, establecimiento, puntoEmision, secuencial, codigo, tipoEmision = '1' }) {
    const partes = {
        fecha: fechaClave(fechaEmision),
        codDoc: String(codDoc),
        ruc: String(ruc),
        ambiente: String(ambiente),
        serie: `${establecimiento}${puntoEmision}`,
        secuencial: String(secuencial).padStart(9, '0'),
        codigo: String(codigo ?? codigoNumerico()),
        tipoEmision: String(tipoEmision),
    };
    const reglas = { fecha: 8, codDoc: 2, ruc: 13, ambiente: 1, serie: 6, secuencial: 9, codigo: 8, tipoEmision: 1 };
    for (const [k, largo] of Object.entries(reglas)) {
        if (!new RegExp(`^\\d{${largo}}$`).test(partes[k])) throw new Error(`Clave de acceso: el campo ${k} debe tener ${largo} dígitos.`);
    }
    const base = partes.fecha + partes.codDoc + partes.ruc + partes.ambiente + partes.serie + partes.secuencial + partes.codigo + partes.tipoEmision;
    return base + digitoVerificador(base);
}

/** true si la clave tiene 49 dígitos y su dígito verificador es correcto. */
function claveValida(clave) {
    return /^\d{49}$/.test(String(clave)) && digitoVerificador(clave.slice(0, 48)) === Number(clave[48]);
}

/** Descompone una clave en sus partes (para mostrar y para reconciliar). */
function descomponerClave(clave) {
    return {
        fecha: clave.slice(0, 8), codDoc: clave.slice(8, 10), ruc: clave.slice(10, 23), ambiente: clave.slice(23, 24),
        establecimiento: clave.slice(24, 27), puntoEmision: clave.slice(27, 30), secuencial: clave.slice(30, 39),
        codigo: clave.slice(39, 47), tipoEmision: clave.slice(47, 48), digito: clave.slice(48),
    };
}

module.exports = { digitoVerificador, codigoNumerico, generarClaveAcceso, claveValida, descomponerClave, fechaClave };
