/**
 * SS SWAP - Validación de identificaciones (cédula, RUC, pasaporte)
 *
 * El SRI NO publica un servicio oficial para consultar los datos de un RUC o
 * cédula (la Ficha Técnica v2.34 solo expone recepción, autorización y
 * consulta de comprobantes). Por eso aquí solo se valida el FORMATO:
 *  - Cédula: 10 dígitos, provincia 01-24 o 30, tercer dígito < 6 y dígito
 *    verificador módulo 10.
 *  - RUC: 13 dígitos terminados en 001..999 (establecimiento) y la
 *    estructura según el tercer dígito (natural 0-5, pública 6, privada 9).
 *    El dígito verificador de sociedades se comprueba, pero un fallo es solo
 *    ADVERTENCIA: existen RUC vigentes emitidos que no cumplen el algoritmo,
 *    así que bloquearlos sería un error. Una persona autorizada confirma.
 *
 * Resultado: { valido, normalizada, advertencias[], errores[] }.
 * `valido` = se puede usar; nunca significa "verificado en el SRI".
 */
const { CONSUMIDOR_FINAL } = require('./catalogos');

const soloDigitos = (v) => String(v ?? '').replace(/\s+/g, '');

function provinciaValida(dosDigitos) {
    const p = Number(dosDigitos);
    return (p >= 1 && p <= 24) || p === 30;
}

/** Dígito verificador módulo 10 de una cédula (9 primeros dígitos). */
function digitoCedula(nueve) {
    let suma = 0;
    for (let i = 0; i < 9; i++) {
        let d = Number(nueve[i]) * (i % 2 === 0 ? 2 : 1);
        if (d > 9) d -= 9;
        suma += d;
    }
    const r = suma % 10;
    return r === 0 ? 0 : 10 - r;
}

/** Dígito verificador módulo 11 con los coeficientes indicados. */
function digitoModulo11(digitos, coeficientes) {
    const suma = coeficientes.reduce((s, c, i) => s + c * Number(digitos[i]), 0);
    const r = suma % 11;
    return r === 0 ? 0 : 11 - r;
}

function validarCedula(valor) {
    const v = soloDigitos(valor);
    const res = { valido: false, normalizada: v, advertencias: [], errores: [] };
    if (!/^\d{10}$/.test(v)) { res.errores.push('La cédula debe tener 10 dígitos.'); return res; }
    if (!provinciaValida(v.slice(0, 2))) { res.errores.push('Los dos primeros dígitos de la cédula no corresponden a una provincia.'); return res; }
    if (Number(v[2]) >= 6) { res.errores.push('El tercer dígito de una cédula debe ser menor a 6.'); return res; }
    if (digitoCedula(v) !== Number(v[9])) {
        res.errores.push('El dígito verificador de la cédula no es correcto. Revise el número.');
        return res;
    }
    res.valido = true;
    return res;
}

function validarRuc(valor) {
    const v = soloDigitos(valor);
    const res = { valido: false, normalizada: v, advertencias: [], errores: [] };
    if (!/^\d{13}$/.test(v)) { res.errores.push('El RUC debe tener 13 dígitos.'); return res; }
    if (!provinciaValida(v.slice(0, 2))) { res.errores.push('Los dos primeros dígitos del RUC no corresponden a una provincia.'); return res; }
    if (v.slice(10) === '000') { res.errores.push('El RUC debe terminar en el número de establecimiento (001 o mayor).'); return res; }
    const tercero = Number(v[2]);
    if (tercero <= 5) {
        // Persona natural: los 10 primeros dígitos son su cédula.
        const ced = validarCedula(v.slice(0, 10));
        if (!ced.valido) {
            res.advertencias.push('Los 10 primeros dígitos no pasan la validación de cédula. Confirme el RUC en el SRI antes de usarlo.');
        }
    } else if (tercero === 6) {
        if (digitoModulo11(v, [3, 2, 7, 6, 5, 4, 3, 2]) !== Number(v[8])) {
            res.advertencias.push('El dígito verificador (entidad pública) no coincide. Confirme el RUC en el SRI antes de usarlo.');
        }
    } else if (tercero === 9) {
        if (digitoModulo11(v, [4, 3, 2, 7, 6, 5, 4, 3, 2]) !== Number(v[9])) {
            res.advertencias.push('El dígito verificador (sociedad privada) no coincide. Confirme el RUC en el SRI antes de usarlo.');
        }
    } else {
        res.errores.push('El tercer dígito del RUC no es válido (0-5 natural, 6 pública, 9 privada).');
        return res;
    }
    res.valido = true;
    return res;
}

/**
 * Valida una identificación según su tipo SRI (Tabla 6).
 * '04' RUC · '05' cédula · '06' pasaporte · '07' consumidor final · '08' exterior.
 */
function validarIdentificacion(tipo, valor) {
    const texto = String(valor ?? '').trim();
    switch (tipo) {
        case '04': return validarRuc(texto);
        case '05': return validarCedula(texto);
        case '06':
        case '08': {
            const res = { valido: false, normalizada: texto.toUpperCase(), advertencias: [], errores: [] };
            if (!/^[A-Za-z0-9-]{3,20}$/.test(texto)) res.errores.push('La identificación debe tener de 3 a 20 letras o números.');
            else res.valido = true;
            return res;
        }
        case '07': {
            const ok = texto === CONSUMIDOR_FINAL.identificacion;
            return { valido: ok, normalizada: CONSUMIDOR_FINAL.identificacion, advertencias: [],
                errores: ok ? [] : ['Consumidor final usa la identificación 9999999999999.'] };
        }
        default:
            return { valido: false, normalizada: texto, advertencias: [], errores: ['Tipo de identificación no válido.'] };
    }
}

/** Tipo SRI sugerido a partir del texto (10 dígitos = cédula, 13 = RUC). */
function tipoSugerido(valor) {
    const v = soloDigitos(valor);
    if (v === CONSUMIDOR_FINAL.identificacion) return '07';
    if (/^\d{13}$/.test(v)) return '04';
    if (/^\d{10}$/.test(v)) return '05';
    return v ? '06' : null;
}

module.exports = { validarCedula, validarRuc, validarIdentificacion, tipoSugerido, digitoCedula, digitoModulo11 };
