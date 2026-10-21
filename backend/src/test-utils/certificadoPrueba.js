/**
 * SS SWAP - Certificado .p12 DESECHABLE solo para pruebas automáticas
 *
 * Genera en memoria un par de claves RSA 2048 y un certificado autofirmado
 * ("PRUEBAS SS SWAP - SIN VALIDEZ"). Sirve para probar la firma XAdES-BES
 * localmente; el SRI lo rechazaría (no lo emite una entidad acreditada).
 * Nunca se guarda en disco ni se usa fuera de las pruebas.
 */
const forge = require('node-forge');

let cache = null;

function certificadoPrueba({ clave = 'clave-de-prueba', ruc = '1790000000001', dias = 365 } = {}) {
    if (cache && cache.clave === clave && cache.ruc === ruc) return cache;
    const llaves = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
    const cert = forge.pki.createCertificate();
    cert.publicKey = llaves.publicKey;
    cert.serialNumber = '0' + forge.util.bytesToHex(forge.random.getBytesSync(9));
    cert.validity.notBefore = new Date(Date.now() - 60 * 1000);
    cert.validity.notAfter = new Date(Date.now() + dias * 86400 * 1000);
    const attrs = [
        { name: 'commonName', value: 'PRUEBAS SS SWAP - SIN VALIDEZ' },
        { name: 'organizationName', value: 'SS SWAP PRUEBAS' },
        { name: 'countryName', value: 'EC' },
        { shortName: 'OU', value: `RUC ${ruc}` },
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.sign(llaves.privateKey, forge.md.sha256.create());
    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(llaves.privateKey, [cert], clave, { algorithm: '3des' });
    const p12 = Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary');
    cache = { p12, clave, ruc };
    return cache;
}

module.exports = { certificadoPrueba };
