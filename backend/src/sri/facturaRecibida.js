/**
 * SS SWAP - Lectura de facturas electrónicas RECIBIDAS de proveedores
 *
 * Lee el XML real de una factura del SRI (versiones 1.0.0, 1.1.0, 2.0.0 y
 * 2.1.0 comparten la estructura usada aquí: infoTributaria, infoFactura y
 * detalles/detalle) o la respuesta de autorización que lo envuelve
 * (<autorizacion> … <comprobante><![CDATA[…]]></comprobante>).
 *
 * Seguridad: tamaño máximo, sin DOCTYPE ni entidades (evita XXE y "billion
 * laughs"; xmldom además no resuelve entidades externas) y validación de la
 * coherencia entre el contenido y la clave de acceso (dígito verificador,
 * RUC, fecha, tipo, serie y secuencial). Nunca se confía en el nombre del
 * archivo ni en lo que el usuario escribe en pantalla.
 */
const { DOMParser } = require('@xmldom/xmldom');
const { digitoVerificador } = require('./claveAcceso');

const MAX_BYTES = 2 * 1024 * 1024;

class ErrorXml extends Error {
    constructor(mensaje, codigo = 'XML_INVALIDO') { super(mensaje); this.codigo = codigo; this.status = 400; }
}

/**
 * Valida y descompone una clave de acceso de 49 dígitos (Ficha técnica, Tabla 1).
 * Devuelve { clave, fechaEmision 'YYYY-MM-DD', codDoc, ruc, ambiente, establecimiento, puntoEmision, secuencial } o lanza ErrorXml.
 */
function analizarClave(valor) {
    const clave = String(valor ?? '').replace(/\s+/g, '');
    if (!/^\d{49}$/.test(clave)) throw new ErrorXml('La clave de acceso debe tener exactamente 49 dígitos.', 'CLAVE_INVALIDA');
    if (digitoVerificador(clave.slice(0, 48)) !== Number(clave[48])) {
        throw new ErrorXml('La clave de acceso no es válida (el dígito verificador no coincide). Revise que la haya copiado completa.', 'CLAVE_INVALIDA');
    }
    const [d, m, a] = [clave.slice(0, 2), clave.slice(2, 4), clave.slice(4, 8)];
    const fecha = new Date(`${a}-${m}-${d}T00:00:00Z`);
    if (Number.isNaN(fecha.getTime()) || fecha.getUTCDate() !== Number(d)) throw new ErrorXml('La fecha contenida en la clave de acceso no es válida.', 'CLAVE_INVALIDA');
    const ambiente = Number(clave[23]);
    if (![1, 2].includes(ambiente)) throw new ErrorXml('El ambiente de la clave de acceso no es válido.', 'CLAVE_INVALIDA');
    return {
        clave, fechaEmision: `${a}-${m}-${d}`, codDoc: clave.slice(8, 10), ruc: clave.slice(10, 23), ambiente,
        establecimiento: clave.slice(24, 27), puntoEmision: clave.slice(27, 30), secuencial: clave.slice(30, 39),
    };
}

/** Parser estricto: cualquier error de sintaxis invalida el documento. */
function parsearEstricto(texto) {
    const errores = [];
    const doc = new DOMParser({
        errorHandler: { warning() {}, error(m) { errores.push(m); }, fatalError(m) { errores.push(m); } },
    }).parseFromString(texto, 'text/xml');
    if (errores.length || !doc || !doc.documentElement) throw new ErrorXml('El archivo no es un XML bien formado.');
    return doc;
}

const hijos = (nodo, nombre) => (nodo ? Array.from(nodo.childNodes).filter(n => n.nodeType === 1 && (n.localName || n.nodeName) === nombre) : []);
const hijo = (nodo, nombre) => hijos(nodo, nombre)[0] || null;
const valor = (nodo, nombre) => { const n = hijo(nodo, nombre); return n ? String(n.textContent).trim() : null; };
const numero = (v) => {
    if (v === null || v === undefined || v === '') return 0;
    if (!/^-?\d+(\.\d+)?$/.test(String(v).trim())) throw new ErrorXml(`Valor numérico inválido en el XML: "${String(v).slice(0, 20)}".`);
    return Number(v);
};
/** dd/mm/aaaa -> aaaa-mm-dd */
const fechaIso = (v) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v || '').trim()); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };

/**
 * Comprueba que el texto sea seguro de procesar: tamaño y sin DOCTYPE/ENTITY.
 * (Se aplica al archivo cargado y también al XML que entrega el SRI.)
 */
function comprobarSeguridad(texto) {
    if (typeof texto !== 'string' || !texto.trim()) throw new ErrorXml('El XML está vacío.');
    if (Buffer.byteLength(texto, 'utf8') > MAX_BYTES) throw new ErrorXml('El XML supera el tamaño máximo permitido (2 MB).', 'XML_GRANDE');
    if (/<!DOCTYPE|<!ENTITY/i.test(texto)) throw new ErrorXml('El XML contiene declaraciones DOCTYPE/ENTITY, que no se aceptan por seguridad.', 'XML_PELIGROSO');
}

/**
 * Lee una factura del SRI desde un texto XML (factura sola o respuesta de
 * autorización que la envuelve). Devuelve:
 *   { xmlComprobante, cabecera, detalles, autorizacionArchivo }
 * autorizacionArchivo = estado/número/fecha que trae el ARCHIVO (no es una
 * verificación: eso solo lo hace la consulta al SRI).
 */
function leerFactura(texto) {
    comprobarSeguridad(texto);
    let doc = parsearEstricto(texto.replace(/^﻿/, ''));
    let raiz = doc.documentElement;
    let autorizacionArchivo = null;
    let xmlComprobante = texto;

    // Respuesta de autorización (archivo que entregan muchos proveedores o portales).
    const nombreRaiz = raiz.localName || raiz.nodeName;
    if (nombreRaiz !== 'factura') {
        const aut = nombreRaiz === 'autorizacion' ? raiz : raiz.getElementsByTagName('autorizacion')[0];
        const comp = aut ? hijo(aut, 'comprobante') : null;
        if (!comp) {
            if (['notaCredito', 'notaDebito', 'comprobanteRetencion', 'guiaRemision', 'liquidacionCompra'].includes(nombreRaiz)) {
                throw new ErrorXml('El XML no es una factura: solo se pueden registrar facturas (código 01).', 'NO_ES_FACTURA');
            }
            throw new ErrorXml('El XML no contiene una factura electrónica del SRI.', 'NO_ES_FACTURA');
        }
        autorizacionArchivo = {
            estado: valor(aut, 'estado'), numeroAutorizacion: valor(aut, 'numeroAutorizacion'), fechaAutorizacion: valor(aut, 'fechaAutorizacion'),
        };
        xmlComprobante = String(comp.textContent || '').trim();
        comprobarSeguridad(xmlComprobante);
        doc = parsearEstricto(xmlComprobante);
        raiz = doc.documentElement;
        if ((raiz.localName || raiz.nodeName) !== 'factura') throw new ErrorXml('El comprobante autorizado no es una factura (código 01).', 'NO_ES_FACTURA');
    }

    const it = hijo(raiz, 'infoTributaria');
    const inf = hijo(raiz, 'infoFactura');
    if (!it || !inf) throw new ErrorXml('La factura no tiene infoTributaria o infoFactura.');

    const claveXml = valor(it, 'claveAcceso');
    const clave = analizarClave(claveXml);
    const cabecera = {
        version: raiz.getAttribute('version') || null,
        claveAcceso: clave.clave,
        ambiente: Number(valor(it, 'ambiente')),
        codDoc: valor(it, 'codDoc'),
        ruc: valor(it, 'ruc'),
        razonSocial: valor(it, 'razonSocial'),
        nombreComercial: valor(it, 'nombreComercial'),
        dirMatriz: valor(it, 'dirMatriz'),
        establecimiento: valor(it, 'estab'),
        puntoEmision: valor(it, 'ptoEmi'),
        secuencial: valor(it, 'secuencial'),
        fechaEmision: fechaIso(valor(inf, 'fechaEmision')),
        dirEstablecimiento: valor(inf, 'dirEstablecimiento'),
        compradorTipoIdentificacion: valor(inf, 'tipoIdentificacionComprador'),
        compradorIdentificacion: valor(inf, 'identificacionComprador'),
        compradorRazonSocial: valor(inf, 'razonSocialComprador'),
        totalSinImpuestos: numero(valor(inf, 'totalSinImpuestos')),
        totalDescuento: numero(valor(inf, 'totalDescuento')),
        importeTotal: numero(valor(inf, 'importeTotal')),
        totalesImpuestos: hijos(hijo(inf, 'totalConImpuestos'), 'totalImpuesto').map(t => ({
            codigo: valor(t, 'codigo'), codigoPorcentaje: valor(t, 'codigoPorcentaje'),
            baseImponible: numero(valor(t, 'baseImponible')), valor: numero(valor(t, 'valor')),
        })),
    };
    // Datos informativos (para la representación impresa).
    cabecera.obligadoContabilidad = valor(inf, 'obligadoContabilidad');
    cabecera.contribuyenteEspecial = valor(inf, 'contribuyenteEspecial');
    cabecera.pagos = hijos(hijo(inf, 'pagos'), 'pago').map(p => ({
        formaPago: valor(p, 'formaPago'), total: numero(valor(p, 'total')), plazo: valor(p, 'plazo'), unidadTiempo: valor(p, 'unidadTiempo'),
    }));
    cabecera.infoAdicional = hijos(hijo(raiz, 'infoAdicional'), 'campoAdicional')
        .map(c => ({ nombre: String(c.getAttribute('nombre') || '').slice(0, 100), valor: String(c.textContent || '').trim().slice(0, 300) }))
        .filter(c => c.nombre || c.valor).slice(0, 15);
    cabecera.totalIva = Math.round(cabecera.totalesImpuestos.filter(t => t.codigo === '2').reduce((s, t) => s + t.valor, 0) * 100) / 100;

    // Coherencia entre el contenido y la clave de acceso.
    const incoherencias = [];
    if (cabecera.codDoc !== '01' || clave.codDoc !== '01') incoherencias.push('el tipo de comprobante no es factura (01)');
    if (cabecera.ruc !== clave.ruc) incoherencias.push('el RUC del emisor');
    if (cabecera.fechaEmision !== clave.fechaEmision) incoherencias.push('la fecha de emisión');
    if (cabecera.ambiente !== clave.ambiente) incoherencias.push('el ambiente');
    if (cabecera.establecimiento !== clave.establecimiento || cabecera.puntoEmision !== clave.puntoEmision || cabecera.secuencial !== clave.secuencial) {
        incoherencias.push('el número de la factura');
    }
    if (incoherencias.length) {
        if (cabecera.codDoc !== '01') throw new ErrorXml('El XML no es una factura: solo se pueden registrar facturas (código 01).', 'NO_ES_FACTURA');
        throw new ErrorXml(`El contenido del XML no coincide con su clave de acceso (${incoherencias.join(', ')}).`, 'XML_INCOHERENTE');
    }

    const detalles = hijos(hijo(raiz, 'detalles'), 'detalle').map((d, i) => {
        const adicionales = hijos(hijo(d, 'detallesAdicionales'), 'detAdicional')
            .map(a => ({ nombre: a.getAttribute('nombre'), valor: a.getAttribute('valor') }));
        const unidad = valor(d, 'unidadMedida')
            || (adicionales.find(a => /unidad|u\.?\s*medida/i.test(a.nombre || '')) || {}).valor || null;
        const cantidad = numero(valor(d, 'cantidad'));
        if (!(cantidad > 0)) throw new ErrorXml(`El artículo ${i + 1} tiene una cantidad inválida.`);
        return {
            linea: i + 1,
            codigoPrincipal: valor(d, 'codigoPrincipal') || valor(d, 'codigoInterno'),
            codigoAuxiliar: valor(d, 'codigoAuxiliar') || valor(d, 'codigoAdicional'),
            descripcion: String(valor(d, 'descripcion') || '').slice(0, 300),
            unidadMedida: unidad ? String(unidad).slice(0, 50) : null,
            cantidad,
            precioUnitario: numero(valor(d, 'precioUnitario')),
            descuento: numero(valor(d, 'descuento')),
            precioTotalSinImpuesto: numero(valor(d, 'precioTotalSinImpuesto')),
            impuestos: hijos(hijo(d, 'impuestos'), 'impuesto').map(t => ({
                codigo: valor(t, 'codigo'), codigoPorcentaje: valor(t, 'codigoPorcentaje'), tarifa: numero(valor(t, 'tarifa')),
                baseImponible: numero(valor(t, 'baseImponible')), valor: numero(valor(t, 'valor')),
            })),
        };
    });
    if (!detalles.length) throw new ErrorXml('La factura no tiene artículos (detalles).');
    if (detalles.some(d => !d.descripcion)) throw new ErrorXml('Hay artículos sin descripción en la factura.');

    return { xmlComprobante, cabecera, detalles, autorizacionArchivo };
}

module.exports = { analizarClave, leerFactura, comprobarSeguridad, ErrorXml, MAX_BYTES };
