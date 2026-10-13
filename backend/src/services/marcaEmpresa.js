/**
 * SS SWAP - Datos de la empresa para documentos (PDF / Excel) y para el panel
 *
 * Cada documento usa los datos de la empresa DUEÑA del documento. Desde el
 * Sprint 24 las proformas y órdenes nuevas guardan una copia de esos datos
 * al crearse (columna empresa_datos): si existe se usa la copia, así el
 * documento conserva la identidad con la que se emitió aunque la empresa
 * cambie después su nombre o su logo. Los documentos anteriores (sin copia)
 * usan los datos actuales de su empresa (columnas empresa_* de la consulta).
 * Nunca hay un nombre ni un logo "por defecto" de SS SWAP: una empresa sin
 * logo sale sin logo.
 *
 * logo_archivo:
 *   upload:<archivo>  subido por la empresa (backend/uploads/logos)
 *   asset:<archivo>   incluido en el backend (backend/src/assets)
 */
const path = require('path');
const fs = require('fs');

const ASSETS = path.join(__dirname, '..', 'assets');
const DIR_LOGOS = path.join(__dirname, '..', '..', 'uploads', 'logos');

/** Separa "upload:x.png" en { origen, archivo } (archivo sin rutas) o null. */
function partesLogo(valor) {
    const m = /^(upload|asset):(.+)$/.exec(String(valor || ''));
    if (!m) return null;
    const archivo = path.basename(m[2]);
    if (!/\.(png|jpe?g)$/i.test(archivo)) return null;
    return { origen: m[1], archivo };
}

/** Ruta en disco del logo (solo dentro de las carpetas permitidas) o null si no existe. */
function rutaLogo(valor) {
    const p = partesLogo(valor);
    if (!p) return null;
    const ruta = path.join(p.origen === 'upload' ? DIR_LOGOS : ASSETS, p.archivo);
    return fs.existsSync(ruta) ? ruta : null;
}

/** URL pública (relativa al servidor de la API) para mostrar el logo en el panel, o null. */
function urlLogo(valor) {
    const p = partesLogo(valor);
    if (!p) return null;
    return p.origen === 'upload' ? `/uploads/logos/${p.archivo}` : `/recursos-marca/${p.archivo}`;
}

/**
 * Identidad de la empresa dueña de un documento.
 * Usa la copia guardada en el documento (empresa_datos) y, si no existe,
 * las columnas empresa_* (datos actuales) que agrega la consulta.
 */
function marcaDe(doc) {
    const copia = doc.empresa_datos && typeof doc.empresa_datos === 'object' ? doc.empresa_datos : null;
    const v = (campo) => (copia ? copia[campo] : doc[`empresa_${campo}`]) || null;
    const logo = copia ? copia.logo_archivo : doc.empresa_logo;
    return {
        nombre: String(v('nombre_comercial') || v('nombre') || '').trim(),
        razonSocial: v('razon_social'),
        ruc: v('ruc'),
        direccion: v('direccion'),
        telefono: v('telefono'),
        email: v('email'),
        // Documento emitido sin logo: sigue sin logo. Si el archivo de la copia
        // ya no existe en disco, se usa el logo actual de la misma empresa.
        logo: logo ? (rutaLogo(logo) || rutaLogo(doc.empresa_logo)) : null,
    };
}

/** Datos de la empresa que viajan en la sesión del panel (sin datos internos). */
const empresaSesion = (id, f) => ({ id, nombre: f.empresa_nombre, slug: f.empresa_slug,
    nombre_comercial: f.empresa_nombre_comercial || null, logo_url: urlLogo(f.empresa_logo) });

/** Columnas SQL con los datos ACTUALES de la empresa (alias e) para marcaDe(). */
const COLUMNAS_EMPRESA_SQL = `e.nombre AS empresa_nombre, e.nombre_comercial AS empresa_nombre_comercial,
    e.razon_social AS empresa_razon_social, e.ruc AS empresa_ruc, e.direccion AS empresa_direccion,
    e.telefono AS empresa_telefono, e.email AS empresa_email, e.logo_archivo AS empresa_logo`;

module.exports = { marcaDe, empresaSesion, rutaLogo, urlLogo, partesLogo, DIR_LOGOS, COLUMNAS_EMPRESA_SQL };
