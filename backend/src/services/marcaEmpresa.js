/**
 * SS SWAP - Datos de la empresa para documentos (PDF / Excel)
 *
 * Cada documento usa los datos de la empresa DUEÑA del documento (columnas
 * empresa_* que agrega la consulta de exportación). Nunca hay un nombre ni
 * un logo "por defecto" de SS SWAP: una empresa sin logo sale sin logo.
 */
const path = require('path');
const fs = require('fs');

const ASSETS = path.join(__dirname, '..', 'assets');

/** Ruta del logo de la empresa (solo archivos incluidos en el backend) o null. */
function rutaLogo(archivo) {
    if (!archivo || !String(archivo).startsWith('asset:')) return null;
    const ruta = path.join(ASSETS, path.basename(String(archivo).slice('asset:'.length)));
    return fs.existsSync(ruta) ? ruta : null;
}

/** { nombre, logo, ruc, razonSocial } de la empresa dueña del documento. */
function marcaDe(doc) {
    return {
        nombre: String(doc.empresa_nombre_comercial || doc.empresa_nombre || '').trim(),
        razonSocial: doc.empresa_razon_social || null,
        ruc: doc.empresa_ruc || null,
        logo: rutaLogo(doc.empresa_logo),
    };
}

module.exports = { marcaDe, rutaLogo };
