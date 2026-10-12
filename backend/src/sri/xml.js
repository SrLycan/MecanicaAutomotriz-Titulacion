/**
 * SS SWAP - Construcción del XML de comprobantes electrónicos (sin firmar)
 *
 * Formatos: factura 1.1.0 y nota de crédito 1.1.0 (Anexo 3 de la Ficha
 * Técnica v2.34; XSD oficiales en src/sri/xsd). El orden de los elementos
 * sigue EXACTAMENTE el de los XSD (una etiqueta fuera de orden = "DOCUMENTO
 * INVÁLIDO", error 35).
 *
 * El XML se genera compacto (sin espacios entre etiquetas) y con los
 * caracteres especiales escapados (&amp; &lt; &gt; &quot;): así su forma
 * canónica (C14N) coincide con el texto y la firma es estable.
 *
 * Entrada: un comprobante "normalizado" (ver facturacion.service.js →
 * datosParaXml), nunca filas crudas de la BD.
 */
const { f2, f6 } = require('./calculos');
const { CODIGO_IVA, REGIMENES } = require('./catalogos');

const VERSION = '1.1.0';

/** Escapa texto para XML y lo deja en una sola línea (los XSD exigen [^\n]*). */
function esc(valor) {
    return String(valor ?? '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .replace(/ {2,}/g, ' ')
        .trim()
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/** Texto recortado al máximo del XSD (por caracteres, sin partir entidades). */
const corto = (valor, max) => esc(String(valor ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max));

/** <tag>valor</tag>, u omitido si el valor está vacío (elementos minOccurs=0). */
function el(tag, valor, max = 300) {
    if (valor === null || valor === undefined || String(valor).trim() === '') return '';
    return `<${tag}>${corto(valor, max)}</${tag}>`;
}
/** Elemento obligatorio: falla si está vacío (mejor que un rechazo del SRI). */
function req(tag, valor, max = 300) {
    if (valor === null || valor === undefined || String(valor).trim() === '') throw new Error(`Falta el dato obligatorio <${tag}> del comprobante.`);
    return `<${tag}>${corto(valor, max)}</${tag}>`;
}

/** Fecha 'YYYY-MM-DD' → 'dd/mm/aaaa'. */
function fechaSri(iso) {
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
}

function infoTributaria(c) {
    const e = c.emisor;
    const leyenda = REGIMENES[e.regimen]?.leyenda || null;
    return '<infoTributaria>'
        + req('ambiente', String(c.ambiente))
        + req('tipoEmision', '1')
        + req('razonSocial', e.razonSocial)
        + el('nombreComercial', e.nombreComercial)
        + req('ruc', e.ruc, 13)
        + req('claveAcceso', c.claveAcceso, 49)
        + req('codDoc', c.codDoc, 2)
        + req('estab', c.establecimiento, 3)
        + req('ptoEmi', c.puntoEmision, 3)
        + req('secuencial', c.secuencial, 9)
        + req('dirMatriz', e.dirMatriz)
        + el('agenteRetencion', e.agenteRetencion, 8)
        + (leyenda ? `<contribuyenteRimpe>${esc(leyenda)}</contribuyenteRimpe>` : '')
        + '</infoTributaria>';
}

/** <impuesto> de un detalle (IVA). */
function impuestoDetalle(l) {
    return '<impuestos><impuesto>'
        + `<codigo>${CODIGO_IVA}</codigo>`
        + `<codigoPorcentaje>${esc(l.iva_codigo)}</codigoPorcentaje>`
        + `<tarifa>${f2(l.iva_tarifa)}</tarifa>`
        + `<baseImponible>${f2(l.iva_base)}</baseImponible>`
        + `<valor>${f2(l.iva_valor)}</valor>`
        + '</impuesto></impuestos>';
}

function detallesAdicionales(l) {
    const lista = (l.detalles_adicionales || []).filter(d => d && d.nombre && d.valor).slice(0, 3);
    if (!lista.length) return '';
    return '<detallesAdicionales>'
        + lista.map(d => `<detAdicional nombre="${corto(d.nombre, 300)}" valor="${corto(d.valor, 300)}"/>`).join('')
        + '</detallesAdicionales>';
}

function infoAdicional(c) {
    const campos = (c.infoAdicional || []).filter(x => x && x.nombre && String(x.valor ?? '').trim() !== '').slice(0, 15);
    if (!campos.length) return '';
    return '<infoAdicional>'
        + campos.map(x => `<campoAdicional nombre="${corto(x.nombre, 300)}">${corto(x.valor, 300)}</campoAdicional>`).join('')
        + '</infoAdicional>';
}

function totalConImpuestos(c, conTarifa) {
    return '<totalConImpuestos>'
        + c.impuestos.map(g => '<totalImpuesto>'
            + `<codigo>${CODIGO_IVA}</codigo>`
            + `<codigoPorcentaje>${esc(g.codigoPorcentaje)}</codigoPorcentaje>`
            + `<baseImponible>${f2(g.base)}</baseImponible>`
            + (conTarifa ? `<tarifa>${f2(g.tarifa)}</tarifa>` : '')
            + `<valor>${f2(g.valor)}</valor>`
            + '</totalImpuesto>').join('')
        + '</totalConImpuestos>';
}

/** XML de una FACTURA 1.1.0 (sin firma). */
function construirFactura(c) {
    const e = c.emisor;
    const comp = c.comprador;
    const pagos = (c.pagos || []).length
        ? '<pagos>' + c.pagos.map(p => '<pago>'
            + `<formaPago>${esc(p.formaPago)}</formaPago>`
            + `<total>${f2(p.total)}</total>`
            + (p.plazo ? `<plazo>${f2(p.plazo)}</plazo>` : '')
            + (p.plazo && p.unidadTiempo ? el('unidadTiempo', p.unidadTiempo, 10) : '')
            + '</pago>').join('') + '</pagos>'
        : '';

    return '<?xml version="1.0" encoding="UTF-8"?>'
        + `<factura id="comprobante" version="${VERSION}">`
        + infoTributaria(c)
        + '<infoFactura>'
        + req('fechaEmision', fechaSri(c.fechaEmision))
        + el('dirEstablecimiento', e.dirEstablecimiento)
        + el('contribuyenteEspecial', e.contribuyenteEspecial, 13)
        + (e.obligadoContabilidad != null ? `<obligadoContabilidad>${e.obligadoContabilidad ? 'SI' : 'NO'}</obligadoContabilidad>` : '')
        + req('tipoIdentificacionComprador', comp.tipoIdentificacion, 2)
        + req('razonSocialComprador', comp.razonSocial)
        + req('identificacionComprador', comp.identificacion, 20)
        + el('direccionComprador', comp.direccion)
        + `<totalSinImpuestos>${f2(c.totalSinImpuestos)}</totalSinImpuestos>`
        + `<totalDescuento>${f2(c.totalDescuento)}</totalDescuento>`
        + totalConImpuestos(c, false)
        + `<propina>${f2(c.propina || 0)}</propina>`
        + `<importeTotal>${f2(c.importeTotal)}</importeTotal>`
        + '<moneda>DOLAR</moneda>'
        + pagos
        + '</infoFactura>'
        + '<detalles>'
        + c.lineas.map(l => '<detalle>'
            + el('codigoPrincipal', l.codigo, 25)
            + req('descripcion', l.descripcion)
            + `<cantidad>${f6(l.cantidad)}</cantidad>`
            + `<precioUnitario>${f6(l.precio_unitario)}</precioUnitario>`
            + `<descuento>${f2(l.descuento)}</descuento>`
            + `<precioTotalSinImpuesto>${f2(l.precio_total_sin_impuesto)}</precioTotalSinImpuesto>`
            + detallesAdicionales(l)
            + impuestoDetalle(l)
            + '</detalle>').join('')
        + '</detalles>'
        + infoAdicional(c)
        + '</factura>';
}

/** XML de una NOTA DE CRÉDITO 1.1.0 (sin firma). */
function construirNotaCredito(c) {
    const e = c.emisor;
    const comp = c.comprador;
    const s = c.sustento; // { codDoc:'01', numero:'001-001-000000123', fechaEmision:'YYYY-MM-DD' }
    return '<?xml version="1.0" encoding="UTF-8"?>'
        + `<notaCredito id="comprobante" version="${VERSION}">`
        + infoTributaria(c)
        + '<infoNotaCredito>'
        + req('fechaEmision', fechaSri(c.fechaEmision))
        + el('dirEstablecimiento', e.dirEstablecimiento)
        + req('tipoIdentificacionComprador', comp.tipoIdentificacion, 2)
        + req('razonSocialComprador', comp.razonSocial)
        + req('identificacionComprador', comp.identificacion, 20)
        + el('contribuyenteEspecial', e.contribuyenteEspecial, 13)
        + (e.obligadoContabilidad != null ? `<obligadoContabilidad>${e.obligadoContabilidad ? 'SI' : 'NO'}</obligadoContabilidad>` : '')
        + req('codDocModificado', s.codDoc, 2)
        + req('numDocModificado', s.numero, 17)
        + req('fechaEmisionDocSustento', fechaSri(s.fechaEmision))
        + `<totalSinImpuestos>${f2(c.totalSinImpuestos)}</totalSinImpuestos>`
        + `<valorModificacion>${f2(c.importeTotal)}</valorModificacion>`
        + '<moneda>DOLAR</moneda>'
        + totalConImpuestos(c, false)
        + req('motivo', c.motivo)
        + '</infoNotaCredito>'
        + '<detalles>'
        + c.lineas.map(l => '<detalle>'
            + el('codigoInterno', l.codigo, 25)
            + req('descripcion', l.descripcion)
            + `<cantidad>${f6(l.cantidad)}</cantidad>`
            + `<precioUnitario>${f6(l.precio_unitario)}</precioUnitario>`
            + `<descuento>${f2(l.descuento)}</descuento>`
            + `<precioTotalSinImpuesto>${f2(l.precio_total_sin_impuesto)}</precioTotalSinImpuesto>`
            + detallesAdicionales(l)
            + impuestoDetalle(l)
            + '</detalle>').join('')
        + '</detalles>'
        + infoAdicional(c)
        + '</notaCredito>';
}

function construirXml(c) {
    if (c.codDoc === '01') return construirFactura(c);
    if (c.codDoc === '04') return construirNotaCredito(c);
    throw new Error(`Tipo de comprobante no soportado: ${c.codDoc}`);
}

module.exports = { construirXml, construirFactura, construirNotaCredito, fechaSri, esc, VERSION };
