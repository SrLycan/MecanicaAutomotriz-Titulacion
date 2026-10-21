/**
 * SS SWAP - Firma electrónica XAdES-BES de comprobantes (Ficha Técnica v2.34, cap. 6)
 *
 * Especificación del SRI:
 *  - Estándar XAdES_BES, esquema 1.3.2 (http://uri.etsi.org/01903/v1.3.2#),
 *    tipo ENVELOPED, codificación UTF-8.
 *  - Algoritmo RSA-SHA1, clave de 2048 bits, certificado en un archivo PKCS#12 (.p12).
 *  - ds:KeyInfo con el certificado en base64, y firmado (referencia propia)
 *    para impedir que lo sustituyan.
 *  - Se firman: el comprobante completo, las SignedProperties y el KeyInfo.
 *
 * Canonicalización: C14N inclusivo (REC-xml-c14n-20010315) con la
 * implementación de xml-crypto. Cada nodo firmado se canonicaliza dentro del
 * documento real, así heredan los namespaces ds/etsi tal como los verá el SRI.
 *
 * Seguridad: el .p12 y su clave solo existen descifrados en memoria durante
 * la firma (ver certificado.js). Nunca se escriben en disco ni en logs.
 * La firma RSA usa el crypto nativo de Node; node-forge solo abre el .p12.
 */
const crypto = require('crypto');
const forge = require('node-forge');
const { DOMParser } = require('@xmldom/xmldom');
const { C14nCanonicalization } = require('xml-crypto');

const NS_DS = 'http://www.w3.org/2000/09/xmldsig#';
const NS_ETSI = 'http://uri.etsi.org/01903/v1.3.2#';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';

class ErrorFirma extends Error {}

/**
 * Abre un .p12 y devuelve la clave privada (PEM), el certificado de firma y
 * sus datos. Elige el certificado que corresponde a la clave privada (los
 * .p12 de algunos proveedores traen también la cadena de la CA).
 */
function abrirP12(p12Buffer, clave) {
    let p12;
    try {
        const asn1 = forge.asn1.fromDer(forge.util.createBuffer(p12Buffer.toString('binary')));
        p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, clave);
    } catch (err) {
        throw new ErrorFirma(/password|MAC|Invalid/i.test(err.message)
            ? 'La clave del certificado no es correcta o el archivo no es un .p12 válido.'
            : 'No se pudo leer el certificado .p12.');
    }
    const llaves = [
        ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
        ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
    ].filter(b => b.key);
    const certs = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || []).filter(b => b.cert);
    if (!llaves.length || !certs.length) throw new ErrorFirma('El .p12 no contiene una clave privada y su certificado.');

    // Certificado cuyo módulo coincide con la clave privada.
    let llave = null;
    let cert = null;
    for (const k of llaves) {
        const c = certs.find(cb => cb.cert.publicKey.n && cb.cert.publicKey.n.equals(k.key.n));
        if (c) { llave = k.key; cert = c.cert; break; }
    }
    if (!cert) throw new ErrorFirma('Ningún certificado del .p12 corresponde a su clave privada.');

    const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
    const derBuf = Buffer.from(der, 'binary');
    return {
        privateKeyPem: forge.pki.privateKeyToPem(llave),
        certDerBase64: derBuf.toString('base64'),
        certSha1Base64: crypto.createHash('sha1').update(derBuf).digest('base64'),
        modulusBase64: trimCero(llave.n.toByteArray()).toString('base64'),
        exponentBase64: trimCero(llave.e.toByteArray()).toString('base64'),
        issuerName: nombreRfc2253(cert.issuer.attributes),
        serialDecimal: BigInt('0x' + cert.serialNumber).toString(10),
        datos: datosCertificado(cert),
    };
}

/** Bytes sin signo de un entero de forge, sin el byte 0 de signo inicial. */
function trimCero(bytes) {
    const arr = Array.from(bytes, c => (typeof c === 'string' ? c.charCodeAt(0) : c) & 0xff);
    while (arr.length > 1 && arr[0] === 0) arr.shift();
    return Buffer.from(arr);
}

const NOMBRES_OID = { CN: 'CN', OU: 'OU', O: 'O', L: 'L', ST: 'ST', C: 'C', E: 'E' };
/** Nombre distinguido estilo RFC 2253 (orden inverso, "CN=...,O=...,C=..."). */
function nombreRfc2253(attrs) {
    return attrs.slice().reverse().map(a => {
        const tipo = NOMBRES_OID[a.shortName] || a.shortName || a.type;
        const valor = String(a.value).replace(/([,+"\\<>;])/g, '\\$1');
        return `${tipo}=${valor}`;
    }).join(',');
}

/** Datos visibles del certificado (para mostrar en la configuración; sin secretos). */
function datosCertificado(cert) {
    const attr = (lista, nombre) => lista.find(a => a.shortName === nombre || a.name === nombre)?.value || null;
    // Los certificados ecuatorianos llevan el RUC/cédula en extensiones o en serialNumber del sujeto.
    const textoSujeto = cert.subject.attributes.map(a => `${a.shortName || a.name}=${a.value}`).join(', ');
    const rucEnCert = (textoSujeto.match(/\b\d{13}\b/) || [])[0]
        || (cert.extensions || []).map(ext => String(ext.value || '')).join(' ').match(/\b\d{13}\b/)?.[0] || null;
    return {
        titular: attr(cert.subject.attributes, 'CN'),
        emisor: attr(cert.issuer.attributes, 'CN') || attr(cert.issuer.attributes, 'O'),
        serial: cert.serialNumber,
        validoDesde: cert.validity.notBefore.toISOString(),
        validoHasta: cert.validity.notAfter.toISOString(),
        rucDetectado: rucEnCert,
        sujeto: textoSujeto.slice(0, 300),
    };
}

// ── Canonicalización ────────────────────────────────────────────

/** Namespaces declarados en los ancestros de un nodo (para C14N de un subconjunto). */
function namespacesHeredados(nodo) {
    const vistos = new Map();
    for (let p = nodo.parentNode; p && p.attributes; p = p.parentNode) {
        for (let i = 0; i < p.attributes.length; i++) {
            const a = p.attributes[i];
            if (a.prefix === 'xmlns' && !vistos.has(a.localName)) vistos.set(a.localName, a.value);
        }
    }
    return [...vistos].map(([prefix, namespaceURI]) => ({ prefix, namespaceURI }));
}

const c14n = new C14nCanonicalization();
function canonico(nodo) {
    return c14n.process(nodo, { ancestorNamespaces: namespacesHeredados(nodo) });
}

const sha1b64 = (texto) => crypto.createHash('sha1').update(texto, 'utf8').digest('base64');

function buscarPorId(doc, id) {
    const todos = doc.getElementsByTagName('*');
    for (let i = 0; i < todos.length; i++) {
        const n = todos[i];
        if (n.getAttribute && (n.getAttribute('Id') === id || n.getAttribute('id') === id)) return n;
    }
    throw new ErrorFirma(`No se encontró el nodo ${id} al firmar.`);
}

const malFormado = (msg) => { throw new ErrorFirma(`XML mal formado: ${msg}`); };
const parsear = (xml) => new DOMParser({ errorHandler: { warning: () => {}, error: malFormado, fatalError: malFormado } })
    .parseFromString(xml, 'text/xml');

/**
 * Fecha y hora de firma en hora de Ecuador continental (UTC-05:00, sin horario de verano).
 */
function horaEcuador(fecha = new Date()) {
    const local = new Date(fecha.getTime() - 5 * 3600 * 1000);
    return local.toISOString().slice(0, 19) + '-05:00';
}

/**
 * Firma el XML de un comprobante (raíz con id="comprobante").
 * @param {string} xml  XML sin firma (con o sin declaración <?xml?>)
 * @param {Buffer} p12Buffer
 * @param {string} clave
 * @returns {string} XML firmado (con declaración UTF-8)
 */
function firmarComprobante(xml, p12Buffer, clave, { fecha = new Date() } = {}) {
    const cert = abrirP12(p12Buffer, clave);
    const ahora = new Date();
    if (new Date(cert.datos.validoHasta) < ahora) throw new ErrorFirma('El certificado de firma electrónica está caducado.');
    if (new Date(cert.datos.validoDesde) > ahora) throw new ErrorFirma('El certificado de firma electrónica aún no es válido.');

    const sinDecl = xml.replace(/^<\?xml[^>]*\?>\s*/, '');
    const n = crypto.randomInt(100000, 999999);
    const ids = {
        firma: `Signature${n}`,
        signedInfo: `Signature-SignedInfo${n}`,
        signedPropsRef: `SignedPropertiesID${n}`,
        signedProps: `Signature${n}-SignedProperties${n}`,
        certificado: `Certificate${n}`,
        refComprobante: `Reference-ID-${n}`,
        valor: `SignatureValue${n}`,
        objeto: `Signature${n}-Object${n}`,
    };

    // 1) Digest del comprobante (transformación enveloped: aún no tiene firma).
    const docSinFirma = parsear(sinDecl);
    const digestComprobante = sha1b64(canonico(docSinFirma.documentElement));

    const keyInfo = `<ds:KeyInfo Id="${ids.certificado}"><ds:X509Data><ds:X509Certificate>${cert.certDerBase64}</ds:X509Certificate></ds:X509Data>`
        + `<ds:KeyValue><ds:RSAKeyValue><ds:Modulus>${cert.modulusBase64}</ds:Modulus><ds:Exponent>${cert.exponentBase64}</ds:Exponent></ds:RSAKeyValue></ds:KeyValue></ds:KeyInfo>`;

    const signedProperties = `<etsi:SignedProperties Id="${ids.signedProps}"><etsi:SignedSignatureProperties>`
        + `<etsi:SigningTime>${horaEcuador(fecha)}</etsi:SigningTime>`
        + '<etsi:SigningCertificate><etsi:Cert><etsi:CertDigest>'
        + `<ds:DigestMethod Algorithm="${NS_DS}sha1"></ds:DigestMethod><ds:DigestValue>${cert.certSha1Base64}</ds:DigestValue>`
        + `</etsi:CertDigest><etsi:IssuerSerial><ds:X509IssuerName>${escAttr(cert.issuerName)}</ds:X509IssuerName>`
        + `<ds:X509SerialNumber>${cert.serialDecimal}</ds:X509SerialNumber></etsi:IssuerSerial></etsi:Cert></etsi:SigningCertificate>`
        + '</etsi:SignedSignatureProperties><etsi:SignedDataObjectProperties>'
        + `<etsi:DataObjectFormat ObjectReference="#${ids.refComprobante}"><etsi:Description>contenido comprobante</etsi:Description><etsi:MimeType>text/xml</etsi:MimeType></etsi:DataObjectFormat>`
        + '</etsi:SignedDataObjectProperties></etsi:SignedProperties>';

    const objeto = `<ds:Object Id="${ids.objeto}"><etsi:QualifyingProperties Target="#${ids.firma}">${signedProperties}</etsi:QualifyingProperties></ds:Object>`;

    const signedInfo = (dProps, dCert) => `<ds:SignedInfo Id="${ids.signedInfo}">`
        + `<ds:CanonicalizationMethod Algorithm="${C14N}"></ds:CanonicalizationMethod>`
        + `<ds:SignatureMethod Algorithm="${NS_DS}rsa-sha1"></ds:SignatureMethod>`
        + `<ds:Reference Id="${ids.signedPropsRef}" Type="http://uri.etsi.org/01903#SignedProperties" URI="#${ids.signedProps}">`
        + `<ds:DigestMethod Algorithm="${NS_DS}sha1"></ds:DigestMethod><ds:DigestValue>${dProps}</ds:DigestValue></ds:Reference>`
        + `<ds:Reference URI="#${ids.certificado}">`
        + `<ds:DigestMethod Algorithm="${NS_DS}sha1"></ds:DigestMethod><ds:DigestValue>${dCert}</ds:DigestValue></ds:Reference>`
        + `<ds:Reference Id="${ids.refComprobante}" URI="#comprobante">`
        + `<ds:Transforms><ds:Transform Algorithm="${NS_DS}enveloped-signature"></ds:Transform></ds:Transforms>`
        + `<ds:DigestMethod Algorithm="${NS_DS}sha1"></ds:DigestMethod><ds:DigestValue>${digestComprobante}</ds:DigestValue></ds:Reference>`
        + '</ds:SignedInfo>';

    const firma = (si, valor) => `<ds:Signature xmlns:ds="${NS_DS}" xmlns:etsi="${NS_ETSI}" Id="${ids.firma}">`
        + si + `<ds:SignatureValue Id="${ids.valor}">${valor}</ds:SignatureValue>` + keyInfo + objeto + '</ds:Signature>';

    const insertar = (sig) => sinDecl.replace(/<\/(factura|notaCredito)>\s*$/, (_m, raiz) => `${sig}</${raiz}>`);
    if (!/<\/(factura|notaCredito)>\s*$/.test(sinDecl)) throw new ErrorFirma('El XML no termina en </factura> o </notaCredito>.');

    // 2) Digests de SignedProperties y KeyInfo, canonicalizados dentro del documento.
    const borrador = parsear(insertar(firma(signedInfo('', ''), '')));
    const digestProps = sha1b64(canonico(buscarPorId(borrador, ids.signedProps)));
    const digestCert = sha1b64(canonico(buscarPorId(borrador, ids.certificado)));

    // 3) Firma RSA-SHA1 sobre el SignedInfo canonicalizado.
    const si = signedInfo(digestProps, digestCert);
    const conSignedInfo = parsear(insertar(firma(si, '')));
    const siCanonico = canonico(buscarPorId(conSignedInfo, ids.signedInfo));
    const valor = crypto.createSign('RSA-SHA1').update(siCanonico, 'utf8').sign(cert.privateKeyPem, 'base64');

    return '<?xml version="1.0" encoding="UTF-8"?>' + insertar(firma(si, valor));
}

function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Verifica una firma generada por firmarComprobante (autocomprobación antes
 * de enviar y en las pruebas). Recalcula los 3 digests y valida la firma RSA
 * con el certificado incluido. No reemplaza la validación del SRI.
 */
function verificarFirma(xmlFirmado) {
    const doc = parsear(xmlFirmado.replace(/^<\?xml[^>]*\?>\s*/, ''));
    const firma = doc.getElementsByTagNameNS(NS_DS, 'Signature')[0];
    if (!firma) return { valida: false, motivo: 'No tiene firma.' };
    const refs = Array.from(firma.getElementsByTagNameNS(NS_DS, 'Reference'));
    for (const ref of refs) {
        const uri = ref.getAttribute('URI').replace(/^#/, '');
        const esperado = ref.getElementsByTagNameNS(NS_DS, 'DigestValue')[0].textContent;
        let calculado;
        if (uri === 'comprobante') {
            const copia = parsear(xmlFirmado.replace(/^<\?xml[^>]*\?>\s*/, ''));
            const s = copia.getElementsByTagNameNS(NS_DS, 'Signature')[0];
            s.parentNode.removeChild(s);
            calculado = sha1b64(canonico(copia.documentElement));
        } else {
            calculado = sha1b64(canonico(buscarPorId(doc, uri)));
        }
        if (calculado !== esperado) return { valida: false, motivo: `El digest de #${uri} no coincide.` };
    }
    const si = firma.getElementsByTagNameNS(NS_DS, 'SignedInfo')[0];
    const valor = firma.getElementsByTagNameNS(NS_DS, 'SignatureValue')[0].textContent.replace(/\s+/g, '');
    const certB64 = firma.getElementsByTagNameNS(NS_DS, 'X509Certificate')[0].textContent.replace(/\s+/g, '');
    const pem = `-----BEGIN CERTIFICATE-----\n${certB64.match(/.{1,64}/g).join('\n')}\n-----END CERTIFICATE-----\n`;
    const ok = crypto.createVerify('RSA-SHA1').update(canonico(si), 'utf8').verify(pem, valor, 'base64');
    return ok ? { valida: true } : { valida: false, motivo: 'El valor de la firma RSA no es válido.' };
}

module.exports = { firmarComprobante, verificarFirma, abrirP12, ErrorFirma, horaEcuador };
