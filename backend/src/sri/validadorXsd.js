/**
 * SS SWAP - Validación local del XML contra los XSD OFICIALES del SRI
 *
 * Antes de firmar y enviar, cada comprobante se valida con los mismos
 * esquemas que publica el SRI (src/sri/xsd, ver LEEME.txt). Así un error de
 * estructura se detecta aquí, con un mensaje claro, y no consume un envío
 * ni deja un comprobante DEVUELTO.
 *
 * Usa xmllint-wasm (libxml2 compilado a WebAssembly): no necesita
 * compiladores ni binarios nativos en el servidor (Hostinger) ni internet.
 */
const fs = require('fs');
const path = require('path');
const { validateXML } = require('xmllint-wasm');

const DIR = path.join(__dirname, 'xsd');
const ESQUEMAS = { '01': 'factura_V1.1.0.xsd', '04': 'NotaCredito_V1.1.0.xsd' };
const cache = new Map();
const leer = (archivo) => {
    if (!cache.has(archivo)) cache.set(archivo, fs.readFileSync(path.join(DIR, archivo), 'utf8'));
    return cache.get(archivo);
};

/**
 * Valida el XML (firmado o no) del tipo de comprobante indicado.
 * @returns {Promise<{valido:boolean, errores:string[]}>}
 */
async function validarXsd(xml, codDoc) {
    const esquema = ESQUEMAS[codDoc];
    if (!esquema) return { valido: false, errores: [`No hay esquema para el tipo de comprobante ${codDoc}.`] };
    const r = await validateXML({
        xml: [{ fileName: 'comprobante.xml', contents: xml }],
        schema: [{ fileName: esquema, contents: leer(esquema) }],
        preload: [{ fileName: 'xmldsig-core-schema.xsd', contents: leer('xmldsig-core-schema.xsd') }],
    });
    return {
        valido: r.valid,
        errores: r.errors.slice(0, 10).map(e => String(e.message || e.rawMessage).replace(/^comprobante\.xml:\d+:\s*/, '').trim()),
    };
}

module.exports = { validarXsd };
