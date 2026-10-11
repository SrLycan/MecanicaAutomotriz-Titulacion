/**
 * SS SWAP - Pagare automatico de una proforma / orden de trabajo
 *
 * REGLA DE NEGOCIO (Sprint 20, corrige el pagare "del 70%"):
 *  - El pagare representa SIEMPRE el 100% de la deuda: monto_total = total
 *    de la proforma (con IVA y descuento ya aplicados). Antes se guardaba
 *    solo el 70% y, al pagarlo, la deuda quedaba "pagada" aunque faltaba
 *    el 30% restante.
 *  - anticipo_requerido guarda el anticipo programado segun el tipo de
 *    trabajo (ver reglasPago.js): 70% en Colisiones/Pintura, y en Mecanica
 *    general el que indique la proforma (0 por defecto). Es un monto
 *    REQUERIDO, no dinero recibido: solo los pagos registrados cuentan.
 *
 * Se genera automaticamente cuando:
 *  a) una proforma se convierte en orden de trabajo (convertirAOrden), o
 *  b) una proforma creada DESDE una orden existente (proformas.orden_id)
 *     pasa a estado 'aprobada'.
 *
 * Anti-duplicado: busqueda previa + indices UNIQUE parciales
 * (uq_cuenta_auto_por_proforma / uq_cuenta_auto_por_orden) en la BD.
 * Todas las funciones reciben un `client` dentro de una transaccion.
 */
const { redondear2 } = require('../utils/numeros');
const { ErrorNegocio, formatoOrden } = require('./inventarioProforma.service');
const { porcentajeAnticipo, calcularAnticipoRequerido, estadoPersistido } = require('./reglasPago');

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

/** Concepto legible del pagare segun el tipo de trabajo. */
function conceptoPagare(proforma, ordenId, anticipo) {
    const ref = `${formatoOrden(ordenId) || 'sin OT'} / ${proforma.numero}`;
    const pct = porcentajeAnticipo(proforma.tipo);
    if (pct) return `Pagaré colisiones (anticipo ${pct}%) — ${ref}`;
    return anticipo > 0 ? `Pagaré mecánica (anticipo $${anticipo.toFixed(2)}) — ${ref}` : `Pagaré mecánica — ${ref}`;
}

/**
 * Crea el pagare (100% del total) si todavia no existe uno activo para esa
 * proforma/orden. Devuelve { cuenta, creada: boolean, motivo? }.
 */
async function generarPagareAutomatico(client, { proforma, ordenId, usuario }) {
    const total = redondear2(Number(proforma.total));
    if (!(total > 0)) return { cuenta: null, creada: false, motivo: 'La proforma tiene total $0; no se genera pagare.' };
    if (!proforma.cliente_id) return { cuenta: null, creada: false, motivo: 'La proforma no tiene cliente del catalogo.' };

    const existente = await buscarPagareActivo(client, { proformaId: proforma.id, ordenId });
    if (existente) return { cuenta: existente, creada: false, motivo: 'Ya existe un pagare para esta orden/proforma.' };

    const pct = porcentajeAnticipo(proforma.tipo);
    const anticipo = calcularAnticipoRequerido(proforma.tipo, total, proforma.anticipo);
    const notas = pct
        ? `Generado automaticamente: total $${total.toFixed(2)}. Anticipo requerido ${pct}% = $${anticipo.toFixed(2)}; saldo restante ${100 - pct}% = $${(total - anticipo).toFixed(2)}.`
        : `Generado automaticamente: total $${total.toFixed(2)}. Mecanica general: ${anticipo > 0 ? `anticipo requerido $${anticipo.toFixed(2)}` : 'sin anticipo obligatorio'}.`;
    const { rows } = await client.query(
        `INSERT INTO cuentas_cobrar
            (cliente_id, vehiculo_id, proforma_id, orden_id, concepto, monto_total, monto_base, porcentaje,
             anticipo_requerido, origen, fecha, notas, usuario_id)
         VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,'automatico',CURRENT_DATE,$9,$10)
         RETURNING *`,
        [proforma.cliente_id, proforma.vehiculo_id || null, proforma.id, ordenId || null,
         conceptoPagare(proforma, ordenId, anticipo), total, pct, anticipo, notas, usuario.id]
    );
    return { cuenta: rows[0], creada: true };
}

/**
 * Mantiene el pagare sincronizado si la proforma cambia de total despues
 * de generarlo (solo posible en proformas 'aprobada' creadas desde una OT).
 * Si el nuevo total queda por debajo de lo ya pagado, se bloquea.
 */
async function sincronizarPagareConProforma(client, proforma) {
    const cuenta = await buscarPagareActivo(client, { proformaId: proforma.id, ordenId: null });
    if (!cuenta) return null;
    const nuevoTotal = redondear2(Number(proforma.total));
    const nuevoAnticipo = calcularAnticipoRequerido(proforma.tipo, nuevoTotal, proforma.anticipo);
    if (Math.abs(nuevoTotal - Number(cuenta.monto_total)) < 0.005 && Math.abs(nuevoAnticipo - Number(cuenta.anticipo_requerido || 0)) < 0.005) return cuenta;
    if (!(nuevoTotal > 0)) {
        throw new ErrorNegocio(409, 'La proforma ya tiene un pagare generado; el total no puede quedar en $0.');
    }
    if (nuevoTotal + 0.001 < Number(cuenta.monto_pagado)) {
        throw new ErrorNegocio(409, `El nuevo total ($${nuevoTotal.toFixed(2)}) seria menor a lo ya pagado en el pagare #${cuenta.id} ($${Number(cuenta.monto_pagado).toFixed(2)}).`);
    }
    const estado = estadoPersistido({ montoTotal: nuevoTotal, montoPagado: cuenta.monto_pagado });
    const { rows } = await client.query(
        `UPDATE cuentas_cobrar SET monto_base = $1, monto_total = $1, anticipo_requerido = $2, estado = $3::varchar,
                fecha_pago_completo = CASE WHEN $3::varchar = 'pagado' THEN COALESCE(fecha_pago_completo, NOW()) ELSE NULL END
         WHERE id = $4 RETURNING *`,
        [nuevoTotal, nuevoAnticipo, estado, cuenta.id]
    );
    return rows[0];
}

module.exports = { generarPagareAutomatico, buscarPagareActivo, sincronizarPagareConProforma };
