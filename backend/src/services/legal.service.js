/**
 * SS SWAP - Documentos legales, aceptaciones y constancias
 *
 * Dos ámbitos (tabla documentos_legales):
 *  - PLATAFORMA (empresa_id NULL, audiencia 'empresas'): términos del
 *    servicio SaaS, privacidad, condiciones comerciales, cancelación. Los
 *    redacta el superadministrador y los acepta cada EMPRESA (su
 *    administrador) al contratar.
 *  - EMPRESA (audiencia 'clientes_portal'): términos y privacidad del taller
 *    para los clientes de su portal. Los acepta cada CLIENTE al registrarse.
 *
 * Reglas de evidencia:
 *  - Una versión publicada es inmutable (texto y hash SHA-256 los fija la BD).
 *  - Aceptar = insertar una fila en aceptaciones_legales (solo inserción):
 *    versión exacta, hash copiado por la BD, hora del servidor, transacción,
 *    método, contexto y datos técnicos mínimos (IP y navegador).
 *  - Una versión nueva con cambio material exige nueva aceptación; un cambio
 *    informativo no. La primera versión publicada siempre es material.
 *  - Nada de esto bloquea el acceso a información que deba seguir
 *    disponible: lo pendiente se muestra como aviso, salvo en la
 *    contratación y el registro, que no se completan sin aceptar.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { Writable } = require('stream');
const pool = require('../config/db');
const { sinAislamiento } = require('../config/contexto');
const { ErrorNegocio } = require('./inventarioProforma.service');

const TIPOS = {
    terminos: 'Términos y condiciones del servicio',
    privacidad: 'Política de privacidad y tratamiento de datos personales',
    condiciones_comerciales: 'Condiciones comerciales y de contratación',
    cancelacion: 'Política de cancelación, renovación y terminación',
    condiciones_empresariales: 'Condiciones particulares para clientes empresariales',
    autorizacion_datos: 'Autorización específica de tratamiento de datos',
};

const DIR_PLANTILLAS = path.join(__dirname, '..', 'legal', 'plantillas');

/** Plantillas de borrador incluidas en el sistema (texto de partida, requieren revisión profesional). */
function plantillas() {
    if (!fs.existsSync(DIR_PLANTILLAS)) return [];
    return fs.readdirSync(DIR_PLANTILLAS).filter(f => f.endsWith('.md')).map(f => {
        const contenido = fs.readFileSync(path.join(DIR_PLANTILLAS, f), 'utf8');
        const titulo = (contenido.match(/^#\s+(.+)$/m) || [])[1] || f;
        const [ambito, tipo] = f.replace(/\.md$/, '').split('__');
        return { archivo: f, ambito, tipo, titulo, contenido };
    });
}

// ───────────────────────────── Consultas ─────────────────────────────

/**
 * Documentos activos de una audiencia con su versión vigente (la última
 * publicada) y la versión que exige aceptación (la última con cambio material).
 */
async function documentosVigentes(audiencia, db = pool) {
    const filtro = audiencia === 'empresas' ? 'd.empresa_id IS NULL' : 'd.empresa_id = empresa_actual()';
    const { rows } = await db.query(
        `SELECT d.id AS documento_id, d.tipo, d.titulo, d.obligatorio,
                v.id AS version_id, v.version, v.contenido, v.hash_contenido, v.vigente_desde, v.publicada_at, v.revision_profesional,
                (SELECT MAX(m.version) FROM documento_legal_versiones m
                  WHERE m.documento_id = d.id AND m.estado IN ('publicada','retirada') AND (m.cambio_material OR m.version = (
                        SELECT MIN(x.version) FROM documento_legal_versiones x WHERE x.documento_id = d.id AND x.estado IN ('publicada','retirada'))))
                  AS version_material
         FROM documentos_legales d
         JOIN LATERAL (SELECT * FROM documento_legal_versiones v WHERE v.documento_id = d.id AND v.estado = 'publicada'
                       ORDER BY v.version DESC LIMIT 1) v ON TRUE
         WHERE d.activo AND d.audiencia = $1 AND ${filtro}
         ORDER BY d.obligatorio DESC, d.tipo`, [audiencia]);
    return rows;
}

/**
 * Documentos que un usuario (cliente del portal) o una empresa (por su
 * administrador) aún debe aceptar.
 */
async function pendientes({ audiencia, usuarioId = null }) {
    const docs = await documentosVigentes(audiencia);
    if (!docs.length) return [];
    const params = [docs.map(d => d.documento_id)];
    let quien = '';
    if (audiencia === 'clientes_portal') { params.push(usuarioId); quien = 'AND a.usuario_id = $2'; }
    const { rows: hechas } = await pool.query(
        `SELECT DISTINCT ON (a.documento_id) a.documento_id, a.evento, v.version
         FROM aceptaciones_legales a JOIN documento_legal_versiones v ON v.id = a.version_id
         WHERE a.documento_id = ANY($1::int[]) ${quien}
         ORDER BY a.documento_id, a.id DESC`, params);
    const ultima = new Map(hechas.map(h => [h.documento_id, h]));
    return docs.filter(d => {
        const h = ultima.get(d.documento_id);
        if (!h || h.evento === 'revocacion') return d.obligatorio || d.tipo !== 'autorizacion_datos' ? true : false;
        return Number(h.version) < Number(d.version_material || d.version);
    }).map(d => ({ ...d, motivo: ultima.get(d.documento_id) ? 'nueva_version' : 'sin_aceptar' }));
}

// ───────────────────────────── Aceptación ─────────────────────────────

/**
 * Registra las aceptaciones de varias versiones como UNA transacción
 * (mismo transaccion_id). Valida que sean versiones vigentes de la audiencia
 * correspondiente. `db` debe ser un cliente dentro de una transacción.
 */
async function registrarAceptaciones(db, { versionIds, audiencia, usuarioId = null, clienteId = null, contratoId = null,
    contexto, req = null, nombre = null, identificacion = null, exigirObligatorias = true }) {
    const ids = [...new Set((versionIds || []).map(Number).filter(n => Number.isInteger(n) && n > 0))];
    const vigentes = await documentosVigentes(audiencia, db);
    if (!vigentes.length) return { transaccionId: null, aceptadas: [] };
    const porVersion = new Map(vigentes.map(d => [Number(d.version_id), d]));
    for (const id of ids) {
        if (!porVersion.has(id)) throw new ErrorNegocio(409, 'Alguno de los documentos que aceptó ya no es la versión vigente. Recargue la página y revíselos de nuevo.');
    }
    if (exigirObligatorias) {
        const faltan = vigentes.filter(d => d.obligatorio && !ids.includes(Number(d.version_id)));
        if (faltan.length) {
            throw new ErrorNegocio(400, `Debe leer y aceptar: ${faltan.map(d => d.titulo).join(', ')}.`, { documentos_pendientes: faltan.map(d => d.version_id) });
        }
    }
    const transaccionId = crypto.randomUUID();
    const ip = req?.ip ? String(req.ip).slice(0, 64) : null;
    const agente = req?.headers?.['user-agent'] ? String(req.headers['user-agent']).slice(0, 250) : null;
    const aceptadas = [];
    for (const id of ids) {
        const { rows } = await db.query(
            `INSERT INTO aceptaciones_legales (version_id, documento_id, evento, usuario_id, cliente_id, contrato_id, contexto, metodo,
                transaccion_id, hash_contenido, nombre_aceptante, identificacion_aceptante, ip, user_agent)
             VALUES ($1, 0, 'aceptacion', $2, $3, $4, $5, 'casilla_web', $6, '', $7, $8, $9, $10)
             RETURNING id, version_id, documento_id, hash_contenido, aceptado_at`,
            [id, usuarioId, clienteId, contratoId, contexto, transaccionId, nombre ? String(nombre).slice(0, 200) : null,
             identificacion ? String(identificacion).slice(0, 20) : null, ip, agente]);
        aceptadas.push(rows[0]);
    }
    return { transaccionId, aceptadas };
}

/** Revocar una autorización opcional de datos (consentimiento): fila nueva, nunca se borra la anterior. */
async function revocarAutorizacion(db, { documentoId, usuarioId, req }) {
    const { rows } = await db.query(
        `SELECT d.tipo, d.obligatorio, v.id AS version_id FROM documentos_legales d
         JOIN documento_legal_versiones v ON v.documento_id = d.id AND v.estado IN ('publicada','retirada')
         WHERE d.id = $1 ORDER BY v.version DESC LIMIT 1`, [documentoId]);
    const d = rows[0];
    if (!d) throw new ErrorNegocio(404, 'Documento no encontrado.');
    if (d.tipo !== 'autorizacion_datos' || d.obligatorio) throw new ErrorNegocio(409, 'Solo se revocan autorizaciones opcionales de tratamiento de datos.');
    const transaccionId = crypto.randomUUID();
    await db.query(
        `INSERT INTO aceptaciones_legales (version_id, documento_id, evento, usuario_id, contexto, metodo, transaccion_id, hash_contenido, ip, user_agent)
         VALUES ($1, 0, 'revocacion', $2, 'revocacion', 'casilla_web', $3, '', $4, $5)`,
        [d.version_id, usuarioId, transaccionId, req?.ip ? String(req.ip).slice(0, 64) : null,
         req?.headers?.['user-agent'] ? String(req.headers['user-agent']).slice(0, 250) : null]);
    return { transaccionId };
}

// ───────────────────────────── Constancia PDF ─────────────────────────────

const FUENTE = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FUENTE_B = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');

/**
 * Constancia de una transacción de aceptación: quién, qué documento y
 * versión (con su hash), cuándo y cómo. Incluye el texto aceptado como
 * anexo para que la constancia sea autosuficiente.
 */
async function constanciaPdf(transaccionId) {
    const { rows } = await pool.query(
        `SELECT a.*, d.titulo, d.tipo, v.version, v.vigente_desde, v.contenido, v.hash_contenido AS hash_version,
                u.nombre AS usuario_nombre, u.email AS usuario_email, c.nombre AS cliente_nombre, c.cedula AS cliente_identificacion,
                e.nombre AS empresa_nombre, e.razon_social AS empresa_razon_social, e.ruc AS empresa_ruc,
                k.plan AS contrato_plan
         FROM aceptaciones_legales a
         JOIN documento_legal_versiones v ON v.id = a.version_id
         JOIN documentos_legales d ON d.id = a.documento_id
         LEFT JOIN usuarios u ON u.id = a.usuario_id
         LEFT JOIN clientes c ON c.id = a.cliente_id
         LEFT JOIN empresas e ON e.id = a.empresa_id
         LEFT JOIN contratos_empresa k ON k.id = a.contrato_id
         WHERE a.transaccion_id = $1 ORDER BY a.id`, [transaccionId]);
    if (!rows.length) throw new ErrorNegocio(404, 'Constancia no encontrada.');
    const proveedor = await datosProveedor().catch(() => null);

    const doc = new PDFDocument({ size: 'A4', margin: 50, info: { Title: 'Constancia de aceptación', Producer: 'SS SWAP' } });
    const unicode = fs.existsSync(FUENTE) && fs.existsSync(FUENTE_B);
    if (unicode) { doc.registerFont('R', FUENTE); doc.registerFont('B', FUENTE_B); }
    const n = unicode ? 'R' : 'Helvetica';
    const b = unicode ? 'B' : 'Helvetica-Bold';
    const partes = [];
    const salida = new Writable({ write(ch, _e, cb) { partes.push(ch); cb(); } });
    doc.pipe(salida);

    const a0 = rows[0];
    const fecha = (d) => new Date(new Date(d).getTime() - 5 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19) + ' (UTC-05:00)';
    doc.font(b).fontSize(16).text('CONSTANCIA DE ACEPTACIÓN DE DOCUMENTOS', { align: 'center' });
    doc.moveDown(0.3).font(n).fontSize(9).fillColor('#475569')
        .text('Registro electrónico generado por el sistema a partir de la evidencia almacenada. No equivale a una firma electrónica certificada.', { align: 'center' });
    doc.fillColor('black').moveDown(1);

    const par = (et, val) => { doc.font(b).fontSize(10).text(`${et}: `, { continued: true }).font(n).text(val || '—'); };
    par('Transacción', transaccionId);
    par('Fecha y hora del servidor', fecha(a0.aceptado_at));
    par('Contexto', { registro_cliente: 'Registro de cliente en el portal', contratacion_empresa: 'Contratación del servicio por la empresa',
        reaceptacion: 'Aceptación de una nueva versión', revocacion: 'Revocación de autorización' }[a0.contexto] || a0.contexto);
    par('Método', 'Casilla de aceptación expresa en la web (inicialmente desmarcada), con acceso previo al texto completo');
    doc.moveDown(0.5);
    par('Aceptante', a0.nombre_aceptante || a0.usuario_nombre || a0.cliente_nombre);
    par('Identificación', a0.identificacion_aceptante || a0.cliente_identificacion);
    par('Cuenta', a0.usuario_email);
    par('Empresa', [a0.empresa_razon_social || a0.empresa_nombre, a0.empresa_ruc ? `RUC ${a0.empresa_ruc}` : null].filter(Boolean).join(' · '));
    if (a0.contrato_plan) par('Contrato', a0.contrato_plan);
    if (a0.contexto === 'contratacion_empresa' && proveedor?.razon_social) {
        par('Proveedor del servicio', [proveedor.razon_social, proveedor.ruc ? `RUC ${proveedor.ruc}` : null].filter(Boolean).join(' · '));
    }
    par('Datos técnicos', `IP ${a0.ip || 'no registrada'} · ${a0.user_agent ? a0.user_agent.slice(0, 120) : 'navegador no registrado'}`);
    doc.moveDown(0.8);
    doc.font(b).fontSize(11).text('Documentos');
    for (const r of rows) {
        doc.moveDown(0.3).font(n).fontSize(9.5).text(
            `• ${r.titulo} — versión ${r.version} (vigente desde ${String(r.vigente_desde).slice(0, 10)}) — ${r.evento === 'revocacion' ? 'REVOCADA' : 'ACEPTADA'}\n`
            + `  SHA-256 del texto: ${r.hash_contenido}`);
    }
    doc.moveDown(1).font(n).fontSize(8.5).fillColor('#475569').text(
        'La integridad del texto aceptado se puede comprobar calculando el SHA-256 del anexo correspondiente y comparándolo con el valor indicado. '
        + 'Las aceptaciones se guardan en un registro que no admite modificaciones ni borrados.');
    doc.fillColor('black');
    for (const r of rows) {
        doc.addPage();
        doc.font(b).fontSize(12).text(`Anexo: ${r.titulo} (versión ${r.version})`);
        doc.moveDown(0.5).font(n).fontSize(9).text(r.contenido, { align: 'justify' });
    }
    doc.end();
    await new Promise(ok => salida.on('finish', ok));
    return { pdf: Buffer.concat(partes), filas: rows };
}

// ───────────────────────────── Proveedor de la plataforma ─────────────────────────────

async function datosProveedor() {
    const { rows } = await sinAislamiento(() => pool.query('SELECT razon_social, ruc, direccion, email_contacto, telefono, canal_reclamos FROM plataforma_proveedor WHERE id = 1'));
    return rows[0] || null;
}

module.exports = { TIPOS, plantillas, documentosVigentes, pendientes, registrarAceptaciones, revocarAutorizacion, constanciaPdf, datosProveedor };
