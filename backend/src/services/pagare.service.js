/**
 * SS SWAP - Pagare automatico (cuenta por cobrar del 70%)
 *
 * REGLA DE NEGOCIO: el pagare siempre corresponde al 70% del TOTAL de la
 * proforma (con IVA y descuento ya aplicados). El campo `anticipo` de la
 * proforma no altera la base.
 *
 * Se genera automaticamente (sin intervencion del usuario) cuando:
 *  a) una proforma se convierte en orden de trabajo (convertirAOrden), o
 *  b) una proforma creada DESDE una orden existente (proformas.orden_id)
 *     pasa a estado 'aprobada'.
 * Las ordenes creadas a mano no tienen montos, por eso no pueden generar
 * un pagare por si solas (ver auditoria).
 *
 * Anti-duplicado: busqueda previa + indices UNIQUE parciales
 * (uq_cuenta_auto_por_proforma / uq_cuenta_auto_por_orden) en la BD.
 * Todas las funciones reciben un `client` dentro de una transaccion.
 */
const { redondear2 } = require('../utils/numeros');
const { ErrorNegocio, formatoOrden } = require('./inventarioProforma.service');

const PORCENTAJE_PAGARE = 70;

const calcularMontoPagare = (total) => redondear2(Number(total) * PORCENTAJE_PAGARE / 100);

async function buscarPagareActivo(client, { proformaId, ordenId }) {
    const { rows } = await client.query(
        `SELECT * FROM cuentas_cobrar
         WHERE origen = 'automatico' AND estado <> 'anulado'
           AND ((proforma_id IS NOT NULL AND proforma_id = $1) OR (orden_id IS NOT NULL AND orden_id = $2))
         ORDER BY id LIMIT 1`,
        [proformaId || null, ordenId || null]
    );
    return rows[0] || null;
}

/**
 * Crea el pagare del 70% si todavia no existe uno activo para esa
 * proforma/orden. Devuelve { cuenta, creada: boolean, motivo? }.
 */
async function generarPagareAutomatico(client, { proforma, ordenId, usuario }) {
    const total = Number(proforma.total);
    if (!(total > 0)) return { cuenta: null, creada: false, motivo: 'La proforma tiene total $0; no se genera pagare.' };
    if (!proforma.cliente_id) return { cuenta: null, creada: false, motivo: 'La proforma no tiene cliente del catalogo.' };

    const existente = await buscarPagareActivo(client, { proformaId: proforma.id, ordenId });
    if (existente) return { cuenta: existente, creada: false, motivo: 'Ya existe un pagare para esta orden/proforma.' };

    const monto = calcularMontoPagare(total);
    const concepto = `Pagaré ${PORCENTAJE_PAGARE}% — ${formatoOrden(ordenId) || 'sin OT'} / ${proforma.numero}`;
    const { rows } = await client.query(
        `INSERT INTO cuentas_cobrar
            (cliente_id, vehiculo_id, proforma_id, orden_id, concepto, monto_total, monto_base, porcentaje,
             origen, fecha, notas, usuario_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'automatico',CURRENT_DATE,$9,$10)
         RETURNING *`,
        [proforma.cliente_id, proforma.vehiculo_id || null, proforma.id, ordenId || null, concepto,
         monto, total, PORCENTAJE_PAGARE,
         `Generado automaticamente: ${PORCENTAJE_PAGARE}% de $${total.toFixed(2)} (total de ${proforma.numero}).`,
         usuario.id]
    );
    return { cuenta: rows[0], creada: true };
}

/**
 * Mantiene el pagare sincronizado si la proforma cambia de total despues
 * de generarlo (solo posible en proformas 'aprobada' creadas desde una OT).
 * Si ya hay pagos y el nuevo 70% queda por debajo de lo pagado, se bloquea.
 */
async function sincronizarPagareConProforma(client, proforma) {
    const cuenta = await buscarPagareActivo(client, { proformaId: proforma.id, ordenId: null });
    if (!cuenta) return null;
    const nuevoBase = Number(proforma.total);
    if (Math.abs(nuevoBase - Number(cuenta.monto_base)) < 0.005) return cuenta;
    const nuevoMonto = calcularMontoPagare(nuevoBase);
    if (!(nuevoMonto > 0)) {
        throw new ErrorNegocio(409, 'La proforma ya tiene un pagare generado; el total no puede quedar en $0.');
    }
    if (nuevoMonto + 0.001 < Number(cuenta.monto_pagado)) {
        throw new ErrorNegocio(409, `El nuevo 70% ($${nuevoMonto.toFixed(2)}) seria menor a lo ya pagado en el pagare #${cuenta.id} ($${Number(cuenta.monto_pagado).toFixed(2)}).`);
    }
    const pagado = Number(cuenta.monto_pagado);
    const estado = cuenta.estado === 'vencido' || cuenta.estado === 'anulado' ? cuenta.estado
        : pagado >= nuevoMonto ? 'pagado' : pagado > 0 ? 'parcial' : 'pendiente';
    const { rows } = await client.query(
        'UPDATE cuentas_cobrar SET monto_base = $1, monto_total = $2, estado = $3 WHERE id = $4 RETURNING *',
        [nuevoBase, nuevoMonto, estado, cuenta.id]
    );
    return rows[0];
}

module.exports = { PORCENTAJE_PAGARE, calcularMontoPagare, generarPagareAutomatico, buscarPagareActivo, sincronizarPagareConProforma };
