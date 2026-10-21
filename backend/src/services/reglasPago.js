/**
 * SS SWAP - Reglas de negocio de cobro (FUENTE UNICA DE VERDAD)
 *
 * Toda la logica de anticipos, saldos, porcentajes y estado de pago vive
 * aqui; proformas, pagares, PDF/Excel y los listados la reutilizan en vez
 * de repetir formulas.
 *
 *  - Mecanica general  (proformas.tipo = 'mecanica'): NO exige anticipo.
 *    El anticipo requerido es el que el usuario indique (0 por defecto).
 *  - Colisiones/Pintura (proformas.tipo = 'pintura'): anticipo requerido
 *    del 70% y saldo restante del 30%.
 *
 * El pagare SIEMPRE representa el 100% de la deuda (total de la proforma).
 * El anticipo es un monto REQUERIDO/programado: solo cuenta como pagado
 * cuando se registra como pago en pagos_cliente.
 *
 * Estado del pago (se calcula, nunca depende de un boton):
 *   anulado  -> anulado a mano (se conserva)
 *   pagado   -> lo pagado cubre el total
 *   vencido  -> tiene saldo y la fecha limite ya paso
 *   parcial  -> tiene abonos pero aun hay saldo
 *   pendiente-> sin pagos
 */
const { redondear2 } = require('../utils/numeros');

const PORCENTAJE_ANTICIPO_COLISIONES = 70;
const TIPOS_CON_ANTICIPO = { pintura: PORCENTAJE_ANTICIPO_COLISIONES };
const TOLERANCIA = 0.005;

/** % de anticipo obligatorio del tipo de proforma (null si no exige). */
const porcentajeAnticipo = (tipo) => TIPOS_CON_ANTICIPO[tipo] || null;

/**
 * Anticipo requerido de una proforma.
 * Colisiones: 70% del total (no se puede cambiar a mano).
 * Mecanica: lo indicado por el usuario, limitado a [0, total].
 */
function calcularAnticipoRequerido(tipo, total, anticipoManual = 0) {
    const t = Math.max(0, Number(total) || 0);
    const pct = porcentajeAnticipo(tipo);
    if (pct) return redondear2(t * pct / 100);
    return redondear2(Math.min(t, Math.max(0, Number(anticipoManual) || 0)));
}

/** Estado de pago a partir de los montos reales y la fecha limite. */
function calcularEstadoPago({ montoTotal, montoPagado, fechaVencimiento, anulado = false, hoy = new Date() }) {
    if (anulado) return 'anulado';
    const total = Number(montoTotal) || 0;
    const pagado = Number(montoPagado) || 0;
    if (total > 0 && pagado + TOLERANCIA >= total) return 'pagado';
    if (fechaVencimiento) {
        const venc = String(fechaVencimiento instanceof Date ? fechaVencimiento.toISOString() : fechaVencimiento).slice(0, 10);
        const hoyStr = hoy.toISOString().slice(0, 10);
        if (venc < hoyStr) return 'vencido';
    }
    return pagado > TOLERANCIA ? 'parcial' : 'pendiente';
}

/** Estado que se GUARDA en la BD (sin 'vencido': ese depende del dia y se calcula al leer). */
function estadoPersistido({ montoTotal, montoPagado, anulado = false }) {
    return calcularEstadoPago({ montoTotal, montoPagado, anulado, fechaVencimiento: null });
}

/** Porcentajes pagado/pendiente: (pagado / total) x 100. Nunca 100% con saldo. */
function porcentajes(montoTotal, montoPagado) {
    const total = Number(montoTotal) || 0;
    const pagado = Math.min(Number(montoPagado) || 0, total);
    if (!(total > 0)) return { pagado: 0, pendiente: 0 };
    const saldo = redondear2(total - pagado);
    let p = redondear2(pagado * 100 / total);
    if (saldo > TOLERANCIA && p >= 100) p = 99.99;
    return { pagado: p, pendiente: redondear2(100 - p) };
}

/**
 * Resumen economico completo de una deuda (mismo calculo en la API, la
 * interfaz y los PDF).
 */
function resumenDeuda({ montoTotal, montoPagado, anticipoRequerido = 0 }) {
    const total = redondear2(Number(montoTotal) || 0);
    const pagado = redondear2(Number(montoPagado) || 0);
    const anticipo = redondear2(Number(anticipoRequerido) || 0);
    const saldo = redondear2(Math.max(0, total - pagado));
    const pct = porcentajes(total, pagado);
    return {
        total, pagado, saldo, anticipo_requerido: anticipo,
        anticipo_cubierto: anticipo > 0 && pagado + TOLERANCIA >= anticipo,
        anticipo_pendiente: redondear2(Math.max(0, anticipo - pagado)),
        saldo_despues_anticipo: redondear2(Math.max(0, total - anticipo)),
        porcentaje_pagado: pct.pagado, porcentaje_pendiente: pct.pendiente,
    };
}

/**
 * Expresion SQL del estado efectivo de una fila de cuentas_cobrar (alias
 * `cc`). Mantiene la misma regla que calcularEstadoPago para que listados,
 * filtros y alertas coincidan con lo que se guarda.
 */
const SQL_ESTADO_EFECTIVO = `(CASE
    WHEN cc.estado = 'anulado' THEN 'anulado'
    WHEN cc.monto_pagado + ${TOLERANCIA} >= cc.monto_total THEN 'pagado'
    WHEN cc.fecha_vencimiento IS NOT NULL AND cc.fecha_vencimiento < CURRENT_DATE THEN 'vencido'
    WHEN cc.monto_pagado > ${TOLERANCIA} THEN 'parcial'
    ELSE 'pendiente' END)`;

module.exports = {
    PORCENTAJE_ANTICIPO_COLISIONES, TOLERANCIA,
    porcentajeAnticipo, calcularAnticipoRequerido, calcularEstadoPago, estadoPersistido,
    porcentajes, resumenDeuda, SQL_ESTADO_EFECTIVO,
};
