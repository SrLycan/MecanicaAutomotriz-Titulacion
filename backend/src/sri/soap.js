/**
 * SS SWAP - Cliente de los servicios web OFICIALES del SRI (SOAP, esquema off-line)
 *
 * Direcciones (Ficha Técnica v2.34, 7.2 y 8.2). Se pueden cambiar con
 * variables de entorno sin tocar el código, como recomienda el SRI (7.1.4):
 *   pruebas:    https://celcer.sri.gob.ec/comprobantes-electronicos-ws/...
 *   producción: https://cel.sri.gob.ec/comprobantes-electronicos-ws/...
 *
 * Operaciones:
 *  - recepcion(xmlFirmado)          validarComprobante  → RECIBIDA | DEVUELTA
 *  - autorizacion(claveAcceso)      autorizacionComprobante → AUTORIZADO | NO AUTORIZADO | (vacío = en procesamiento)
 *  - consultaEstado(claveAcceso)    consultarEstadoAutorizacionComprobante → AUTORIZADO | NO AUTORIZADO |
 *                                   PENDIENTE DE ANULAR | ANULADO
 *
 * Cualquier fallo de red o respuesta ilegible se devuelve como
 * { ok:false, incierto:true }: el emisor NO sabe si el SRI recibió el
 * comprobante, así que nunca se reemite con otro número; se consulta.
 */
const { DOMParser } = require('@xmldom/xmldom');

const BASE = {
    1: process.env.SRI_WS_PRUEBAS || 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws',
    2: process.env.SRI_WS_PRODUCCION || 'https://cel.sri.gob.ec/comprobantes-electronicos-ws',
};
const TIMEOUT_MS = Number(process.env.SRI_TIMEOUT_MS) || 30000;

const sobre = (ns, cuerpo) => '<?xml version="1.0" encoding="UTF-8"?>'
    + `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="${ns}">`
    + `<soapenv:Header/><soapenv:Body>${cuerpo}</soapenv:Body></soapenv:Envelope>`;

async function llamar(url, xml, fetchImpl = globalThis.fetch) {
    const control = new AbortController();
    const temporizador = setTimeout(() => control.abort(), TIMEOUT_MS);
    try {
        const r = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
            body: xml,
            signal: control.signal,
        });
        const texto = await r.text();
        if (!r.ok && !/Envelope/.test(texto)) return { ok: false, incierto: true, error: `HTTP ${r.status} del SRI`, crudo: texto.slice(0, 2000) };
        return { ok: true, texto };
    } catch (err) {
        return { ok: false, incierto: true, error: err.name === 'AbortError' ? 'El SRI no respondió a tiempo.' : `Sin conexión con el SRI: ${err.message}` };
    } finally {
        clearTimeout(temporizador);
    }
}

const parsear = (texto) => new DOMParser({ errorHandler: { warning() {}, error() {}, fatalError() {} } }).parseFromString(texto, 'text/xml');
/** Texto del primer elemento con ese nombre local (ignora namespaces). */
function texto(nodo, nombre) {
    const n = nodo.getElementsByTagNameNS('*', nombre)[0] || nodo.getElementsByTagName(nombre)[0];
    return n ? String(n.textContent).trim() : null;
}
function mensajes(nodo) {
    const lista = Array.from(nodo.getElementsByTagName('mensaje')).filter(m => m.getElementsByTagName('identificador').length);
    return lista.map(m => ({
        identificador: texto(m, 'identificador'),
        mensaje: texto(m, 'mensaje'),
        informacionAdicional: texto(m, 'informacionAdicional'),
        tipo: texto(m, 'tipo'),
    }));
}
function falla(doc) {
    const f = doc.getElementsByTagNameNS('*', 'Fault')[0];
    return f ? (texto(f, 'faultstring') || 'Error SOAP del SRI') : null;
}

/** Envía el XML firmado al servicio de recepción. */
async function recepcion(xmlFirmado, ambiente, { fetchImpl } = {}) {
    const ns = 'http://ec.gob.sri.ws.recepcion';
    const cuerpo = `<ec:validarComprobante><xml>${Buffer.from(xmlFirmado, 'utf8').toString('base64')}</xml></ec:validarComprobante>`;
    const r = await llamar(`${BASE[ambiente]}/RecepcionComprobantesOffline`, sobre(ns, cuerpo), fetchImpl);
    if (!r.ok) return r;
    const doc = parsear(r.texto);
    const fault = falla(doc);
    const estado = texto(doc, 'estado');
    if (fault || !estado) return { ok: false, incierto: true, error: fault || 'Respuesta de recepción sin estado.', crudo: r.texto.slice(0, 4000) };
    return { ok: true, estado, mensajes: mensajes(doc), crudo: r.texto.slice(0, 20000) };
}

/** Consulta la autorización de un comprobante por su clave de acceso. */
async function autorizacion(claveAcceso, ambiente, { fetchImpl } = {}) {
    const ns = 'http://ec.gob.sri.ws.autorizacion';
    const cuerpo = `<ec:autorizacionComprobante><claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante></ec:autorizacionComprobante>`;
    const r = await llamar(`${BASE[ambiente]}/AutorizacionComprobantesOffline`, sobre(ns, cuerpo), fetchImpl);
    if (!r.ok) return r;
    const doc = parsear(r.texto);
    const fault = falla(doc);
    if (fault) return { ok: false, incierto: true, error: fault, crudo: r.texto.slice(0, 4000) };
    const numero = Number(texto(doc, 'numeroComprobantes') || 0);
    const autorizaciones = Array.from(doc.getElementsByTagName('autorizacion')).map(a => ({
        estado: texto(a, 'estado'),
        numeroAutorizacion: texto(a, 'numeroAutorizacion'),
        fechaAutorizacion: texto(a, 'fechaAutorizacion'),
        ambiente: texto(a, 'ambiente'),
        comprobante: texto(a, 'comprobante'),
        mensajes: mensajes(a),
    }));
    // Ficha 5.11: si fue autorizado se devuelve el XML autorizado; si no,
    // puede haber varias respuestas NO AUTORIZADO y solo cuenta la última.
    const autorizada = autorizaciones.find(a => a.estado === 'AUTORIZADO');
    const ultima = autorizada || autorizaciones[autorizaciones.length - 1] || null;
    return {
        ok: true,
        numeroComprobantes: numero,
        estado: ultima ? ultima.estado : null, // null = aún en procesamiento / sin registro
        autorizacion: ultima,
        crudo: r.texto.slice(0, 2000),
    };
}

/** Consulta de validez (AUTORIZADO, NO AUTORIZADO, PENDIENTE DE ANULAR, ANULADO). */
async function consultaEstado(claveAcceso, ambiente, { fetchImpl } = {}) {
    const ns = 'http://ec.gob.sri.ws.consultas';
    const cuerpo = `<ec:consultarEstadoAutorizacionComprobante><claveAcceso>${claveAcceso}</claveAcceso></ec:consultarEstadoAutorizacionComprobante>`;
    const r = await llamar(`${BASE[ambiente]}/ConsultaComprobante`, sobre(ns, cuerpo), fetchImpl);
    if (!r.ok) return r;
    const doc = parsear(r.texto);
    const fault = falla(doc);
    if (fault) return { ok: false, incierto: true, error: fault, crudo: r.texto.slice(0, 4000) };
    return {
        ok: true,
        estadoConsulta: texto(doc, 'estadoConsulta'),
        estadoAutorizacion: texto(doc, 'estadoAutorizacion'),
        fechaAutorizacion: texto(doc, 'fechaAutorizacion'),
        mensajes: mensajes(doc),
        crudo: r.texto.slice(0, 4000),
    };
}

module.exports = { recepcion, autorizacion, consultaEstado, BASE };
