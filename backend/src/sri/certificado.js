/**
 * SS SWAP - Custodia del certificado de firma electrónica (.p12) y su clave
 *
 * El .p12 y su clave se guardan CIFRADOS en la base de datos
 * (sri_configuracion.certificado_cifrado / certificado_clave_cifrada) con
 * AES-256-GCM. La llave de cifrado se deriva (scrypt) de SRI_CERT_KEY, que
 * vive SOLO en el .env del servidor: ni la base de datos, ni un respaldo, ni
 * el frontend pueden abrir el certificado sin ella.
 *
 *  - Nunca se devuelve el certificado ni su clave por la API.
 *  - Nunca se escriben en disco ni en logs (solo existen descifrados en
 *    memoria durante la firma).
 *  - Cambiar SRI_CERT_KEY obliga a volver a cargar el certificado.
 *
 * Formato del blob: 'S1' | sal(16) | iv(12) | tag(16) | datos cifrados.
 */
const crypto = require('crypto');

const PREFIJO = Buffer.from('S1');

class ErrorCustodia extends Error {}

function llaveMaestra() {
    const k = process.env.SRI_CERT_KEY;
    if (!k || k.length < 32) {
        throw new ErrorCustodia('Falta SRI_CERT_KEY en el .env del servidor (mínimo 32 caracteres aleatorios). Sin ella no se puede guardar ni usar el certificado.');
    }
    return k;
}

function cifrar(datos) {
    const sal = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const llave = crypto.scryptSync(llaveMaestra(), sal, 32);
    const c = crypto.createCipheriv('aes-256-gcm', llave, iv);
    const cifrado = Buffer.concat([c.update(Buffer.isBuffer(datos) ? datos : Buffer.from(String(datos), 'utf8')), c.final()]);
    return Buffer.concat([PREFIJO, sal, iv, c.getAuthTag(), cifrado]);
}

function descifrar(blob) {
    const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
    if (b.length < 46 || !b.subarray(0, 2).equals(PREFIJO)) throw new ErrorCustodia('El certificado guardado no tiene un formato válido. Vuelva a cargarlo.');
    const sal = b.subarray(2, 18);
    const iv = b.subarray(18, 30);
    const tag = b.subarray(30, 46);
    try {
        const llave = crypto.scryptSync(llaveMaestra(), sal, 32);
        const d = crypto.createDecipheriv('aes-256-gcm', llave, iv);
        d.setAuthTag(tag);
        return Buffer.concat([d.update(b.subarray(46)), d.final()]);
    } catch (err) {
        if (err instanceof ErrorCustodia) throw err;
        throw new ErrorCustodia('No se pudo abrir el certificado guardado (¿cambió SRI_CERT_KEY?). Vuelva a cargarlo.');
    }
}

/** Huella SHA-256 del .p12 (para identificarlo en pantalla y auditoría sin exponerlo). */
const huella = (p12) => crypto.createHash('sha256').update(p12).digest('hex');

module.exports = { cifrar, descifrar, huella, ErrorCustodia };
