/**
 * SS SWAP - Cálculo de valores de un comprobante electrónico
 *
 * Reglas (Ficha Técnica v2.34, 9.16-9.17 y Tabla 21):
 *  - precioTotalSinImpuesto de cada línea = cantidad x precioUnitario - descuento.
 *  - Valores con 2 decimales; cantidad y precio unitario hasta 6 (versión 1.1.0).
 *  - totalConImpuestos agrupa por codigoPorcentaje: base = suma de las bases,
 *    valor = base x tarifa (redondeado). El IVA de cada línea se ajusta para
 *    que su suma sea EXACTAMENTE el del grupo (evita el error 52 "Error en
 *    diferencias").
 *  - importeTotal = totalSinImpuestos + IVA + propina.
 *
 * El descuento global de una proforma se reparte entre sus líneas en
 * proporción a su subtotal; la última línea absorbe el centavo de redondeo.
 * Todo se calcula en centavos enteros para no arrastrar errores de coma flotante.
 */
const { TARIFAS_IVA } = require('./catalogos');

const aCentavos = (v) => Math.round(Number(v) * 100);
const deCentavos = (c) => Math.round(c) / 100;
/** Redondeo a 2 decimales "half up" (como lo calcula el SRI). */
const r2 = (v) => deCentavos(Math.round((Number(v) + Number.EPSILON) * 100));
const r6 = (v) => Math.round((Number(v) + Number.EPSILON) * 1e6) / 1e6;

class ErrorCalculo extends Error {}

/**
 * @param {Array<{codigo?:string, descripcion:string, cantidad:number, precio_unitario:number,
 *                descuento?:number, iva_codigo:string}>} lineas
 * @param {object} opciones { descuentoGlobal = 0, propina = 0 }
 * @returns {{ lineas, totalSinImpuestos, totalDescuento, impuestos:[{codigoPorcentaje,tarifa,base,valor}], totalIva, propina, importeTotal }}
 */
function calcularComprobante(lineas, { descuentoGlobal = 0, propina = 0 } = {}) {
    if (!Array.isArray(lineas) || lineas.length === 0) throw new ErrorCalculo('El comprobante necesita al menos una línea.');

    const base = lineas.map((l, i) => {
        const cantidad = r6(l.cantidad);
        const precio = r6(l.precio_unitario);
        if (!(cantidad > 0)) throw new ErrorCalculo(`Línea ${i + 1}: la cantidad debe ser mayor a 0.`);
        if (!(precio >= 0)) throw new ErrorCalculo(`Línea ${i + 1}: el precio unitario no puede ser negativo.`);
        const tarifa = TARIFAS_IVA[String(l.iva_codigo)];
        if (!tarifa) throw new ErrorCalculo(`Línea ${i + 1}: tarifa de IVA no válida (${l.iva_codigo}).`);
        const bruto = aCentavos(r2(cantidad * precio));
        const descLinea = aCentavos(l.descuento || 0);
        if (descLinea < 0 || descLinea > bruto) throw new ErrorCalculo(`Línea ${i + 1}: el descuento no puede superar el valor de la línea.`);
        return { ...l, cantidad, precio_unitario: precio, bruto, descuentoLinea: descLinea, iva_codigo: String(l.iva_codigo), tarifa: tarifa.tarifa };
    });

    // Reparto del descuento global en proporción al valor neto de cada línea.
    const netos = base.map(l => l.bruto - l.descuentoLinea);
    const totalNeto = netos.reduce((s, v) => s + v, 0);
    let global = aCentavos(descuentoGlobal || 0);
    if (global < 0) throw new ErrorCalculo('El descuento no puede ser negativo.');
    if (global > totalNeto) throw new ErrorCalculo('El descuento no puede superar el subtotal.');
    const repartos = netos.map(n => (totalNeto > 0 ? Math.floor(global * n / totalNeto) : 0));
    let resto = global - repartos.reduce((s, v) => s + v, 0);
    // El centavo que sobra va a las líneas de mayor valor que aún lo admiten.
    const orden = netos.map((n, i) => i).sort((a, b) => netos[b] - netos[a]);
    for (const i of orden) {
        if (resto <= 0) break;
        if (netos[i] - repartos[i] > 0) { repartos[i] += 1; resto -= 1; }
    }

    const calculadas = base.map((l, i) => {
        const descuento = l.descuentoLinea + repartos[i];
        const totalSin = l.bruto - descuento;
        return {
            linea: i + 1,
            codigo: l.codigo || null,
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            precio_unitario: l.precio_unitario,
            descuento: deCentavos(descuento),
            precio_total_sin_impuesto: deCentavos(totalSin),
            iva_codigo: l.iva_codigo,
            iva_tarifa: l.tarifa,
            iva_base: deCentavos(totalSin),
            iva_valor: 0,
            _totalSin: totalSin,
            proforma_item_id: l.proforma_item_id || null,
            detalles_adicionales: l.detalles_adicionales || null,
        };
    });

    // IVA por grupo de tarifa y ajuste de las líneas al total del grupo.
    const grupos = new Map();
    for (const l of calculadas) {
        if (!grupos.has(l.iva_codigo)) grupos.set(l.iva_codigo, { codigoPorcentaje: l.iva_codigo, tarifa: l.iva_tarifa, base: 0, lineas: [] });
        const g = grupos.get(l.iva_codigo);
        g.base += l._totalSin;
        g.lineas.push(l);
    }
    const impuestos = [];
    for (const g of grupos.values()) {
        const valorGrupo = Math.round(g.base * g.tarifa / 100);
        let asignado = 0;
        g.lineas.forEach((l, idx) => {
            const v = idx === g.lineas.length - 1 ? valorGrupo - asignado : Math.round(l._totalSin * g.tarifa / 100);
            l.iva_valor = deCentavos(v);
            asignado += v;
        });
        impuestos.push({ codigoPorcentaje: g.codigoPorcentaje, tarifa: g.tarifa, base: deCentavos(g.base), valor: deCentavos(valorGrupo) });
    }
    calculadas.forEach(l => { delete l._totalSin; });

    const totalSinImpuestos = calculadas.reduce((s, l) => s + aCentavos(l.precio_total_sin_impuesto), 0);
    const totalDescuento = calculadas.reduce((s, l) => s + aCentavos(l.descuento), 0);
    const totalIva = impuestos.reduce((s, g) => s + aCentavos(g.valor), 0);
    const propinaC = aCentavos(propina || 0);
    if (propinaC < 0) throw new ErrorCalculo('La propina no puede ser negativa.');
    // Ficha 9.16: la propina no puede superar el 10 % del subtotal.
    if (propinaC > Math.round(totalSinImpuestos * 0.10)) throw new ErrorCalculo('La propina no puede superar el 10 % del subtotal.');

    return {
        lineas: calculadas,
        totalSinImpuestos: deCentavos(totalSinImpuestos),
        totalDescuento: deCentavos(totalDescuento),
        impuestos: impuestos.sort((a, b) => Number(a.codigoPorcentaje) - Number(b.codigoPorcentaje)),
        totalIva: deCentavos(totalIva),
        propina: deCentavos(propinaC),
        importeTotal: deCentavos(totalSinImpuestos + totalIva + propinaC),
    };
}

/** Número con 2 decimales para el XML ("123.40"). */
const f2 = (v) => r2(v).toFixed(2);
/** Número con hasta 6 decimales para cantidad/precio (sin ceros de más, mínimo 2). */
function f6(v) {
    const s = r6(v).toFixed(6).replace(/0+$/, '');
    const [ent, dec = ''] = s.split('.');
    return `${ent}.${dec.padEnd(2, '0')}`;
}

module.exports = { calcularComprobante, ErrorCalculo, r2, r6, f2, f6, aCentavos, deCentavos };
