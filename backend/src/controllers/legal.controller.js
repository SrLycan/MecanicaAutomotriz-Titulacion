/**
 * SS SWAP - Controlador de documentos legales y contratación (/api/legal)
 *
 * Público (web, empresa pública): leer los documentos vigentes que se aceptan
 * al registrarse.
 * Usuario autenticado: pendientes, aceptar, revocar autorizaciones
 * opcionales, sus aceptaciones y constancias.
 * Empresa (permiso legal): redactar, previsualizar, publicar y retirar
 * documentos para su portal; consultar aceptaciones y pendientes.
 * Empresa (permiso empresa:editar): aceptar la contratación del servicio.
 * Plataforma (superadministrador): documentos de la plataforma, contratos de
 * cada empresa y datos del proveedor.
 *
 * Los textos se guardan y se devuelven como TEXTO plano (el frontend nunca
 * los inserta como HTML), así un documento no puede inyectar scripts.
 */
const pool = require('../config/db');
const { sinAislamiento } = require('../config/contexto');
const { registrarAuditoria } = require('../services/auditoria.service');
const { ErrorNegocio } = require('../services/inventarioProforma.service');
const L = require('../services/legal.service');
const { responder } = require('./facturacion.controller');
const { puede, esSuperadmin } = require('../middleware/auth.middleware');

const ID_RE = /^\d{1,9}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const limpio = (v, max) => String(v ?? '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);
const fecha = (v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null);

/** Ejecuta fn sobre los documentos de la PLATAFORMA (superadmin) o de la empresa actual. */
const ambito = (req) => (req.query.ambito === 'plataforma' || req.body?.ambito === 'plataforma' ? 'plataforma' : 'empresa');
function enAmbito(req, fn) {
    if (ambito(req) === 'plataforma') {
        if (!esSuperadmin(req.usuario)) throw new ErrorNegocio(403, 'Solo el superadministrador gestiona los documentos de la plataforma.');
        return sinAislamiento(fn);
    }
    if (!req.usuario.empresa_id) throw new ErrorNegocio(403, 'Esta cuenta no pertenece a una empresa.');
    return fn();
}
const filtroAmbito = (req) => (ambito(req) === 'plataforma' ? 'd.empresa_id IS NULL' : 'd.empresa_id = empresa_actual()');

// ───────────────────────────── Público ─────────────────────────────

/** GET /publico/vigentes — documentos que un cliente acepta al registrarse en el portal. */
const vigentesPublicos = async (_req, res) => {
    try {
        const docs = await L.documentosVigentes('clientes_portal');
        return res.json({ documentos: docs.map(d => ({ documento_id: d.documento_id, tipo: d.tipo, titulo: d.titulo, obligatorio: d.obligatorio,
            version_id: d.version_id, version: d.version, vigente_desde: d.vigente_desde, hash: d.hash_contenido, contenido: d.contenido })) });
    } catch (err) { return responder(res, err, 'Error al cargar los documentos legales.'); }
};

// ───────────────────────────── Usuario ─────────────────────────────

/** GET /pendientes — lo que el usuario (o su empresa, si la representa) debe aceptar. */
const misPendientes = async (req, res) => {
    try {
        const u = req.usuario;
        if (u.rol === 'cliente') {
            return res.json({ documentos: await L.pendientes({ audiencia: 'clientes_portal', usuarioId: u.id }), contratos: [] });
        }
        // Personal: solo quien representa a la empresa (empresa:editar) acepta en su nombre.
        if (!u.empresa_id || !puede(u, 'empresa', 'editar')) return res.json({ documentos: [], contratos: [] });
        const documentos = await L.pendientes({ audiencia: 'empresas' });
        const { rows: contratos } = await pool.query(`SELECT * FROM contratos_empresa WHERE estado = 'pendiente_aceptacion' ORDER BY id`);
        return res.json({ documentos, contratos });
    } catch (err) { return responder(res, err, 'Error al consultar los documentos pendientes.'); }
};

/** POST /aceptar  body: { version_ids:[], acepto:true, contrato_id? } */
const aceptar = async (req, res) => {
    if (req.body?.acepto !== true) return res.status(400).json({ error: 'Debe marcar la casilla de aceptación.' });
    const u = req.usuario;
    const esCliente = u.rol === 'cliente';
    if (!esCliente && !puede(u, 'empresa', 'editar')) return res.status(403).json({ error: 'Solo quien representa a la empresa puede aceptar en su nombre.' });
    const contratoId = req.body?.contrato_id && ID_RE.test(String(req.body.contrato_id)) ? Number(req.body.contrato_id) : null;
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let clienteId = null;
        if (esCliente) {
            const { rows } = await client.query('SELECT c.id FROM clientes c JOIN usuarios u ON LOWER(u.email) = LOWER(c.email) WHERE u.id = $1 LIMIT 1', [u.id]);
            clienteId = rows[0]?.id || null;
        }
        let contrato = null;
        if (contratoId) {
            if (esCliente) throw new ErrorNegocio(403, 'Operación no permitida.');
            const { rows } = await client.query(`SELECT * FROM contratos_empresa WHERE id = $1 FOR UPDATE`, [contratoId]);
            contrato = rows[0];
            if (!contrato) throw new ErrorNegocio(404, 'Contrato no encontrado.');
            if (contrato.estado !== 'pendiente_aceptacion') throw new ErrorNegocio(409, 'Este contrato ya fue aceptado.');
        }
        const r = await L.registrarAceptaciones(client, {
            versionIds: req.body?.version_ids, audiencia: esCliente ? 'clientes_portal' : 'empresas', usuarioId: u.id, clienteId,
            contratoId, contexto: contrato ? 'contratacion_empresa' : 'reaceptacion', req, nombre: u.nombre,
            // En una contratación todos los documentos obligatorios vigentes deben aceptarse juntos.
            exigirObligatorias: Boolean(contrato),
        });
        if (!r.transaccionId || !r.aceptadas.length) throw new ErrorNegocio(400, 'No hay documentos que aceptar.');
        if (contrato) {
            await client.query(
                `UPDATE contratos_empresa SET estado = 'vigente', aceptado_por = $1, aceptado_at = NOW(), transaccion_aceptacion = $2 WHERE id = $3`,
                [u.id, r.transaccionId, contrato.id]);
        }
        await registrarAuditoria({ req, accion: contrato ? 'legal.contratacion_aceptada' : 'legal.aceptacion', recursoTipo: 'aceptacion',
            recursoId: r.transaccionId, detalle: { versiones: r.aceptadas.map(a => a.version_id), contrato_id: contrato?.id || null } }, client, true);
        await client.query('COMMIT');
        return res.status(201).json({ transaccion_id: r.transaccionId, aceptadas: r.aceptadas });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        return responder(res, err, 'Error al registrar la aceptación.');
    } finally {
        client.release();
    }
};

/** POST /revocar  body: { documento_id } — retira una autorización OPCIONAL (consentimiento). */
const revocar = async (req, res) => {
    if (!ID_RE.test(String(req.body?.documento_id))) return res.status(400).json({ error: 'Documento no válido.' });
    try {
        const r = await L.revocarAutorizacion(pool, { documentoId: Number(req.body.documento_id), usuarioId: req.usuario.id, req });
        registrarAuditoria({ req, accion: 'legal.revocacion', recursoTipo: 'documento_legal', recursoId: req.body.documento_id });
        return res.json({ transaccion_id: r.transaccionId });
    } catch (err) { return responder(res, err, 'Error al revocar la autorización.'); }
};

/** GET /mis-aceptaciones */
const misAceptaciones = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT a.transaccion_id, a.evento, a.contexto, a.aceptado_at, a.hash_contenido, a.documento_id, d.titulo, d.tipo, d.obligatorio, v.version
             FROM aceptaciones_legales a JOIN documentos_legales d ON d.id = a.documento_id JOIN documento_legal_versiones v ON v.id = a.version_id
             WHERE a.usuario_id = $1 ORDER BY a.id DESC LIMIT 200`, [req.usuario.id]);
        return res.json({ aceptaciones: rows });
    } catch (err) { return responder(res, err, 'Error al consultar sus aceptaciones.'); }
};

/** GET /constancias/:transaccion — propia, o cualquiera de la empresa con legal:ver (superadmin: con ?ambito=plataforma). */
const constancia = async (req, res) => {
    const t = String(req.params.transaccion || '');
    if (!UUID_RE.test(t)) return res.status(404).json({ error: 'Constancia no encontrada.' });
    try {
        const generar = () => L.constanciaPdf(t);
        const { pdf, filas } = req.query.ambito === 'plataforma' && esSuperadmin(req.usuario) ? await sinAislamiento(generar) : await generar();
        const propia = filas.every(f => f.usuario_id === req.usuario.id);
        if (!propia && !puede(req.usuario, 'legal', 'ver') && !esSuperadmin(req.usuario)) return res.status(404).json({ error: 'Constancia no encontrada.' });
        registrarAuditoria({ req, accion: 'legal.constancia_descargar', recursoTipo: 'aceptacion', recursoId: t });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="constancia-aceptacion-${t.slice(0, 8)}.pdf"`);
        return res.send(pdf);
    } catch (err) { return responder(res, err, 'Error al generar la constancia.'); }
};

/** GET /contratacion — lo que la empresa ve antes de aceptar el contrato (proveedor, empresa, contrato y documentos). */
const contratacion = async (req, res) => {
    try {
        if (!req.usuario.empresa_id) return res.status(403).json({ error: 'Esta cuenta no pertenece a una empresa.' });
        const proveedor = await L.datosProveedor();
        const { rows: emp } = await pool.query('SELECT id, nombre, razon_social, ruc, direccion, email, telefono FROM empresas WHERE id = empresa_actual()');
        const { rows: contratos } = await pool.query('SELECT * FROM contratos_empresa ORDER BY id DESC');
        const documentos = await L.documentosVigentes('empresas');
        return res.json({ proveedor, empresa: emp[0] || null, contratos, documentos });
    } catch (err) { return responder(res, err, 'Error al cargar la contratación.'); }
};

// ───────────────────────────── Administración de documentos ─────────────────────────────

/** GET /documentos?ambito=empresa|plataforma — documentos con sus versiones (sin el texto completo). */
const listarDocumentos = async (req, res) => {
    try {
        const datos = await enAmbito(req, async () => {
            const { rows: docs } = await pool.query(
                `SELECT d.* FROM documentos_legales d WHERE ${filtroAmbito(req)} ORDER BY d.activo DESC, d.tipo`);
            const { rows: versiones } = await pool.query(
                `SELECT v.id, v.documento_id, v.version, v.estado, v.cambio_material, v.resumen_cambios, v.revision_profesional,
                        v.vigente_desde, v.publicada_at, v.retirada_at, v.hash_contenido, v.created_at, length(v.contenido) AS caracteres,
                        (SELECT COUNT(*)::int FROM aceptaciones_legales a WHERE a.version_id = v.id AND a.evento = 'aceptacion') AS aceptaciones,
                        u.nombre AS publicada_por_nombre
                 FROM documento_legal_versiones v JOIN documentos_legales d ON d.id = v.documento_id
                 LEFT JOIN usuarios u ON u.id = v.publicada_por
                 WHERE ${filtroAmbito(req)} ORDER BY v.documento_id, v.version DESC`);
            return docs.map(d => ({ ...d, nombre_tipo: L.TIPOS[d.tipo], versiones: versiones.filter(v => v.documento_id === d.id) }));
        });
        return res.json({ documentos: datos, tipos: L.TIPOS, plantillas: L.plantillas().map(({ contenido, ...p }) => p) });
    } catch (err) { return responder(res, err, 'Error al listar los documentos legales.'); }
};

/** GET /plantillas/:archivo — texto de una plantilla de borrador. */
const obtenerPlantilla = (req, res) => {
    const p = L.plantillas().find(x => x.archivo === req.params.archivo);
    if (!p) return res.status(404).json({ error: 'Plantilla no encontrada.' });
    return res.json(p);
};

/** POST /documentos  body: { tipo, titulo, obligatorio, ambito? } */
const crearDocumento = async (req, res) => {
    const tipo = String(req.body?.tipo || '');
    if (!L.TIPOS[tipo]) return res.status(400).json({ error: 'Tipo de documento no válido.' });
    const titulo = limpio(req.body?.titulo || L.TIPOS[tipo], 200);
    const obligatorio = tipo === 'autorizacion_datos' ? Boolean(req.body?.obligatorio) : req.body?.obligatorio !== false;
    try {
        const doc = await enAmbito(req, async () => {
            const plataforma = ambito(req) === 'plataforma';
            const { rows } = await pool.query(
                `INSERT INTO documentos_legales (empresa_id, tipo, titulo, audiencia, obligatorio)
                 VALUES (${plataforma ? 'NULL' : 'empresa_actual()'}, $1, $2, $3, $4) RETURNING *`,
                [tipo, titulo, plataforma ? 'empresas' : 'clientes_portal', obligatorio]);
            return rows[0];
        });
        registrarAuditoria({ req, accion: 'legal.documento_crear', recursoTipo: 'documento_legal', recursoId: doc.id, detalle: { tipo, ambito: ambito(req) } });
        return res.status(201).json({ documento: doc });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Ya existe un documento de ese tipo. Cree una versión nueva del existente.' });
        return responder(res, err, 'Error al crear el documento.');
    }
};

/** PUT /documentos/:id  body: { titulo?, obligatorio?, activo? } — desactivar no borra historial. */
const editarDocumento = async (req, res) => {
    if (!ID_RE.test(String(req.params.id))) return res.status(404).json({ error: 'Documento no encontrado.' });
    try {
        const doc = await enAmbito(req, async () => {
            const { rows: act } = await pool.query(`SELECT d.* FROM documentos_legales d WHERE d.id = $1 AND ${filtroAmbito(req)}`, [req.params.id]);
            if (!act[0]) throw new ErrorNegocio(404, 'Documento no encontrado.');
            const titulo = req.body?.titulo !== undefined ? limpio(req.body.titulo, 200) : act[0].titulo;
            const obligatorio = req.body?.obligatorio !== undefined ? Boolean(req.body.obligatorio) : act[0].obligatorio;
            const activo = req.body?.activo !== undefined ? Boolean(req.body.activo) : act[0].activo;
            if (titulo.length < 3) throw new ErrorNegocio(400, 'El título es obligatorio.');
            const { rows } = await pool.query('UPDATE documentos_legales SET titulo = $1, obligatorio = $2, activo = $3 WHERE id = $4 RETURNING *',
                [titulo, obligatorio, activo, act[0].id]);
            return rows[0];
        });
        registrarAuditoria({ req, accion: 'legal.documento_editar', recursoTipo: 'documento_legal', recursoId: doc.id,
            detalle: { titulo: doc.titulo, obligatorio: doc.obligatorio, activo: doc.activo } });
        return res.json({ documento: doc });
    } catch (err) { return responder(res, err, 'Error al editar el documento.'); }
};

/** GET /versiones/:id — texto completo de una versión (para previsualizar). */
const obtenerVersion = async (req, res) => {
    if (!ID_RE.test(String(req.params.id))) return res.status(404).json({ error: 'Versión no encontrada.' });
    try {
        const v = await enAmbito(req, async () => {
            const { rows } = await pool.query(
                `SELECT v.*, d.titulo, d.tipo, d.obligatorio FROM documento_legal_versiones v JOIN documentos_legales d ON d.id = v.documento_id
                 WHERE v.id = $1 AND ${filtroAmbito(req)}`, [req.params.id]);
            return rows[0];
        });
        if (!v) return res.status(404).json({ error: 'Versión no encontrada.' });
        return res.json({ version: v });
    } catch (err) { return responder(res, err, 'Error al obtener la versión.'); }
};

/** POST /documentos/:id/versiones  body: { contenido, cambio_material, resumen_cambios } — nuevo borrador. */
const crearVersion = async (req, res) => {
    if (!ID_RE.test(String(req.params.id))) return res.status(404).json({ error: 'Documento no encontrado.' });
    const contenido = limpio(req.body?.contenido, 200000);
    if (contenido.length < 50) return res.status(400).json({ error: 'El texto del documento es demasiado corto.' });
    try {
        const v = await enAmbito(req, async () => {
            const { rows: d } = await pool.query(`SELECT d.id FROM documentos_legales d WHERE d.id = $1 AND ${filtroAmbito(req)}`, [req.params.id]);
            if (!d[0]) throw new ErrorNegocio(404, 'Documento no encontrado.');
            const { rows: b } = await pool.query(`SELECT id FROM documento_legal_versiones WHERE documento_id = $1 AND estado = 'borrador'`, [d[0].id]);
            if (b[0]) throw new ErrorNegocio(409, 'Ya hay un borrador de este documento: edítelo o publíquelo antes de crear otro.');
            const { rows } = await pool.query(
                `INSERT INTO documento_legal_versiones (documento_id, empresa_id, version, contenido, hash_contenido, cambio_material, resumen_cambios, creado_por)
                 SELECT $1, NULL, COALESCE(MAX(version), 0) + 1, $2, '', $3, $4, $5 FROM documento_legal_versiones WHERE documento_id = $1
                 RETURNING id, documento_id, version, estado, hash_contenido`,
                [d[0].id, contenido, Boolean(req.body?.cambio_material), limpio(req.body?.resumen_cambios, 1000) || null, req.usuario.id]);
            return rows[0];
        });
        registrarAuditoria({ req, accion: 'legal.version_borrador', recursoTipo: 'documento_legal_version', recursoId: v.id, detalle: { version: v.version } });
        return res.status(201).json({ version: v });
    } catch (err) { return responder(res, err, 'Error al crear la versión.'); }
};

/** PUT /versiones/:id — editar un BORRADOR (las publicadas son inmutables). */
const editarVersion = async (req, res) => {
    if (!ID_RE.test(String(req.params.id))) return res.status(404).json({ error: 'Versión no encontrada.' });
    const contenido = limpio(req.body?.contenido, 200000);
    if (contenido.length < 50) return res.status(400).json({ error: 'El texto del documento es demasiado corto.' });
    try {
        const v = await enAmbito(req, async () => {
            const { rows } = await pool.query(
                `UPDATE documento_legal_versiones v SET contenido = $1, cambio_material = $2, resumen_cambios = $3,
                        revision_profesional = $4
                 FROM documentos_legales d WHERE d.id = v.documento_id AND v.id = $5 AND v.estado = 'borrador' AND ${filtroAmbito(req)}
                 RETURNING v.id, v.version, v.estado, v.hash_contenido`,
                [contenido, Boolean(req.body?.cambio_material), limpio(req.body?.resumen_cambios, 1000) || null,
                 req.body?.revision_profesional === 'revisado' ? 'revisado' : 'pendiente', req.params.id]);
            if (!rows[0]) throw new ErrorNegocio(409, 'Solo se editan borradores. Para cambiar una versión publicada cree una nueva.');
            return rows[0];
        });
        registrarAuditoria({ req, accion: 'legal.version_editar', recursoTipo: 'documento_legal_version', recursoId: v.id, detalle: { hash: v.hash_contenido } });
        return res.json({ version: v });
    } catch (err) { return responder(res, err, 'Error al editar la versión.'); }
};

/** DELETE /versiones/:id — solo borradores. */
const eliminarBorrador = async (req, res) => {
    if (!ID_RE.test(String(req.params.id))) return res.status(404).json({ error: 'Versión no encontrada.' });
    try {
        const n = await enAmbito(req, async () => {
            const { rowCount } = await pool.query(
                `DELETE FROM documento_legal_versiones v USING documentos_legales d
                 WHERE d.id = v.documento_id AND v.id = $1 AND v.estado = 'borrador' AND ${filtroAmbito(req)}`, [req.params.id]);
            return rowCount;
        });
        if (!n) return res.status(409).json({ error: 'Solo se eliminan borradores.' });
        registrarAuditoria({ req, accion: 'legal.version_borrador_eliminar', recursoTipo: 'documento_legal_version', recursoId: req.params.id });
        return res.json({ ok: true });
    } catch (err) { return responder(res, err, 'Error al eliminar el borrador.'); }
};

/**
 * POST /versiones/:id/publicar  body: { vigente_desde?, cambio_material, confirmacion:true }
 * La versión anterior pasa a "retirada" (se conserva). Si el cambio es
 * material, todos los afectados quedan con aceptación pendiente y se registra
 * la notificación en el panel.
 */
const publicarVersion = async (req, res) => {
    if (!ID_RE.test(String(req.params.id))) return res.status(404).json({ error: 'Versión no encontrada.' });
    if (req.body?.confirmacion !== true) return res.status(400).json({ error: 'Confirme que revisó el texto antes de publicarlo.' });
    const vigente = fecha(req.body?.vigente_desde) || new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
    // La conexión se abre DENTRO del contexto (empresa o plataforma): db.js aísla según el contexto al conectar.
    const ejecutar = async () => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const { rows } = await client.query(
                `SELECT v.*, d.audiencia, d.empresa_id AS doc_empresa FROM documento_legal_versiones v JOIN documentos_legales d ON d.id = v.documento_id
                 WHERE v.id = $1 AND ${filtroAmbito(req)} FOR UPDATE OF v`, [req.params.id]);
            const v = rows[0];
            if (!v) throw new ErrorNegocio(404, 'Versión no encontrada.');
            if (v.estado !== 'borrador') throw new ErrorNegocio(409, 'Esta versión ya fue publicada.');
            const { rows: previas } = await client.query(`SELECT COUNT(*)::int AS n FROM documento_legal_versiones WHERE documento_id = $1 AND estado <> 'borrador'`, [v.documento_id]);
            const material = previas[0].n === 0 ? true : Boolean(req.body?.cambio_material ?? v.cambio_material);
            await client.query(`UPDATE documento_legal_versiones SET estado = 'retirada', retirada_at = NOW() WHERE documento_id = $1 AND estado = 'publicada'`, [v.documento_id]);
            const { rows: pub } = await client.query(
                `UPDATE documento_legal_versiones SET estado = 'publicada', publicada_at = NOW(), publicada_por = $1, vigente_desde = $2, cambio_material = $3
                 WHERE id = $4 RETURNING id, documento_id, version, hash_contenido, vigente_desde, cambio_material`,
                [req.usuario.id, vigente, material, v.id]);
            // Notificación en el panel a quienes deben volver a aceptar (cambio material de un documento de la empresa).
            let notificados = 0;
            if (material && v.audiencia === 'clientes_portal' && previas[0].n > 0) {
                const { rowCount } = await client.query(
                    `INSERT INTO notificaciones_legales (version_id, usuario_id, medio, detalle)
                     SELECT DISTINCT $1::int, a.usuario_id, 'panel', 'Nueva versión con cambios materiales: requiere aceptación.'
                     FROM aceptaciones_legales a WHERE a.documento_id = $2 AND a.usuario_id IS NOT NULL`, [v.id, v.documento_id]);
                notificados = rowCount;
            }
            await registrarAuditoria({ req, accion: 'legal.version_publicar', recursoTipo: 'documento_legal_version', recursoId: v.id,
                detalle: { version: pub[0].version, hash: pub[0].hash_contenido, cambio_material: material, vigente_desde: vigente, notificados } }, client, true);
            await client.query('COMMIT');
            return { version: pub[0], notificados };
        } catch (err) {
            await client.query('ROLLBACK').catch(() => {});
            throw err;
        } finally {
            client.release();
        }
    };
    try {
        const r = await enAmbito(req, ejecutar);
        return res.json(r);
    } catch (err) {
        return responder(res, err, 'Error al publicar la versión.');
    }
};

/** GET /aceptaciones?version_id=&documento_id=&q=&desde=&hasta= — evidencia (permiso legal:ver). */
const listarAceptaciones = async (req, res) => {
    const params = [];
    let where = 'WHERE 1=1';
    const add = (cond, val) => { params.push(val); where += ` AND ${cond.replace('?', `$${params.length}`)}`; };
    if (ID_RE.test(String(req.query.version_id || ''))) add('a.version_id = ?', Number(req.query.version_id));
    if (ID_RE.test(String(req.query.documento_id || ''))) add('a.documento_id = ?', Number(req.query.documento_id));
    if (req.query.q) {
        params.push(`%${String(req.query.q).slice(0, 80)}%`);
        const i = params.length;
        where += ` AND (u.nombre ILIKE $${i} OR u.email ILIKE $${i} OR a.nombre_aceptante ILIKE $${i})`;
    }
    if (fecha(req.query.desde)) add('a.aceptado_at >= ?::date', fecha(req.query.desde));
    if (fecha(req.query.hasta)) add("a.aceptado_at < (?::date + INTERVAL '1 day')", fecha(req.query.hasta));
    try {
        const ejecutar = () => pool.query(
            `SELECT a.id, a.transaccion_id, a.evento, a.contexto, a.aceptado_at, a.hash_contenido, a.ip, a.nombre_aceptante,
                    d.titulo, d.tipo, v.version, u.nombre AS usuario_nombre, u.email AS usuario_email, e.nombre AS empresa_nombre
             FROM aceptaciones_legales a JOIN documentos_legales d ON d.id = a.documento_id JOIN documento_legal_versiones v ON v.id = a.version_id
             LEFT JOIN usuarios u ON u.id = a.usuario_id LEFT JOIN empresas e ON e.id = a.empresa_id
             ${where} ${ambito(req) === 'plataforma' ? 'AND d.empresa_id IS NULL' : ''} ORDER BY a.id DESC LIMIT 500`, params);
        const { rows } = ambito(req) === 'plataforma'
            ? (esSuperadmin(req.usuario) ? await sinAislamiento(ejecutar) : { rows: [] })
            : await ejecutar();
        return res.json({ aceptaciones: rows });
    } catch (err) { return responder(res, err, 'Error al consultar las aceptaciones.'); }
};

/** GET /pendientes-resumen — clientes del portal que no aceptaron la versión vigente (permiso legal:ver). */
const pendientesResumen = async (_req, res) => {
    try {
        const docs = await L.documentosVigentes('clientes_portal');
        const resumen = [];
        for (const d of docs.filter(x => x.obligatorio)) {
            const { rows } = await pool.query(
                `SELECT u.id, u.nombre, u.email FROM usuarios u
                 WHERE u.rol = 'cliente' AND NOT EXISTS (
                     SELECT 1 FROM aceptaciones_legales a JOIN documento_legal_versiones v ON v.id = a.version_id
                     WHERE a.usuario_id = u.id AND a.documento_id = $1 AND a.evento = 'aceptacion' AND v.version >= $2)
                 ORDER BY u.nombre LIMIT 200`, [d.documento_id, d.version_material || d.version]);
            resumen.push({ documento_id: d.documento_id, titulo: d.titulo, version: d.version, version_exigida: d.version_material || d.version,
                pendientes: rows.length, usuarios: rows });
        }
        return res.json({ documentos: resumen });
    } catch (err) { return responder(res, err, 'Error al calcular los pendientes de aceptación.'); }
};

// ───────────────────────────── Plataforma (superadministrador) ─────────────────────────────

const obtenerProveedor = async (_req, res) => {
    try { return res.json({ proveedor: await L.datosProveedor() }); } catch (err) { return responder(res, err, 'Error al cargar el proveedor.'); }
};

const guardarProveedor = async (req, res) => {
    const b = req.body || {};
    const d = {
        razon_social: limpio(b.razon_social, 300) || null, ruc: limpio(b.ruc, 13) || null, direccion: limpio(b.direccion, 300) || null,
        email_contacto: limpio(b.email_contacto, 150) || null, telefono: limpio(b.telefono, 30) || null, canal_reclamos: limpio(b.canal_reclamos, 300) || null,
    };
    if (d.ruc && !/^\d{13}$/.test(d.ruc)) return res.status(400).json({ error: 'El RUC del proveedor debe tener 13 dígitos.' });
    try {
        await sinAislamiento(() => pool.query(
            `INSERT INTO plataforma_proveedor (id, razon_social, ruc, direccion, email_contacto, telefono, canal_reclamos, actualizado_por, updated_at)
             VALUES (1,$1,$2,$3,$4,$5,$6,$7,NOW())
             ON CONFLICT (id) DO UPDATE SET razon_social=$1, ruc=$2, direccion=$3, email_contacto=$4, telefono=$5, canal_reclamos=$6, actualizado_por=$7, updated_at=NOW()`,
            [d.razon_social, d.ruc, d.direccion, d.email_contacto, d.telefono, d.canal_reclamos, req.usuario.id]));
        registrarAuditoria({ req, accion: 'plataforma.proveedor_editar', recursoTipo: 'plataforma_proveedor', recursoId: 1, detalle: d });
        return res.json({ proveedor: await L.datosProveedor() });
    } catch (err) { return responder(res, err, 'Error al guardar el proveedor.'); }
};

/** GET /plataforma/contratos?empresa_id= */
const listarContratos = async (req, res) => {
    try {
        const params = [];
        let where = '';
        if (ID_RE.test(String(req.query.empresa_id || ''))) { params.push(Number(req.query.empresa_id)); where = 'WHERE k.empresa_id = $1'; }
        const { rows } = await sinAislamiento(() => pool.query(
            `SELECT k.*, e.nombre AS empresa_nombre, u.nombre AS aceptado_por_nombre FROM contratos_empresa k
             JOIN empresas e ON e.id = k.empresa_id LEFT JOIN usuarios u ON u.id = k.aceptado_por ${where} ORDER BY k.id DESC LIMIT 200`, params));
        return res.json({ contratos: rows });
    } catch (err) { return responder(res, err, 'Error al listar los contratos.'); }
};

/** POST /plataforma/contratos  body: { empresa_id, plan, alcance, precio, periodicidad, condiciones_soporte, fecha_inicio } */
const crearContrato = async (req, res) => {
    const b = req.body || {};
    if (!ID_RE.test(String(b.empresa_id || ''))) return res.status(400).json({ error: 'Seleccione la empresa.' });
    const plan = limpio(b.plan, 120);
    const alcance = limpio(b.alcance, 20000);
    if (plan.length < 3 || alcance.length < 20) return res.status(400).json({ error: 'Describa el plan y el alcance del servicio contratado.' });
    const precio = b.precio === '' || b.precio == null ? null : Number(b.precio);
    if (precio !== null && !(precio >= 0)) return res.status(400).json({ error: 'El precio no es válido.' });
    const periodicidad = b.periodicidad || null;
    if (periodicidad && !['mensual', 'trimestral', 'semestral', 'anual', 'unico'].includes(periodicidad)) return res.status(400).json({ error: 'Periodicidad no válida.' });
    try {
        const { rows } = await sinAislamiento(() => pool.query(
            `INSERT INTO contratos_empresa (empresa_id, plan, alcance, precio, periodicidad, condiciones_soporte, fecha_inicio, creado_por)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
            [Number(b.empresa_id), plan, alcance, precio, periodicidad, limpio(b.condiciones_soporte, 5000) || null, fecha(b.fecha_inicio), req.usuario.id]));
        registrarAuditoria({ req, accion: 'plataforma.contrato_crear', recursoTipo: 'contrato', recursoId: rows[0].id, empresaId: rows[0].empresa_id,
            detalle: { plan, precio, periodicidad } });
        return res.status(201).json({ contrato: rows[0] });
    } catch (err) { return responder(res, err, 'Error al crear el contrato.'); }
};

/** POST /plataforma/contratos/:id/terminar  body: { motivo } */
const terminarContrato = async (req, res) => {
    if (!ID_RE.test(String(req.params.id))) return res.status(404).json({ error: 'Contrato no encontrado.' });
    const motivo = limpio(req.body?.motivo, 300);
    if (motivo.length < 5) return res.status(400).json({ error: 'Indique el motivo de la terminación.' });
    try {
        const { rows } = await sinAislamiento(() => pool.query(
            `UPDATE contratos_empresa SET estado = 'terminado', terminado_at = NOW(), motivo_terminacion = $1
             WHERE id = $2 AND estado = 'vigente' RETURNING *`, [motivo, req.params.id]));
        if (!rows[0]) return res.status(409).json({ error: 'Solo se termina un contrato vigente.' });
        registrarAuditoria({ req, accion: 'plataforma.contrato_terminar', recursoTipo: 'contrato', recursoId: rows[0].id, empresaId: rows[0].empresa_id, detalle: { motivo } });
        return res.json({ contrato: rows[0] });
    } catch (err) { return responder(res, err, 'Error al terminar el contrato.'); }
};

module.exports = {
    vigentesPublicos, misPendientes, aceptar, revocar, misAceptaciones, constancia, contratacion,
    listarDocumentos, obtenerPlantilla, crearDocumento, editarDocumento, obtenerVersion, crearVersion, editarVersion, eliminarBorrador,
    publicarVersion, listarAceptaciones, pendientesResumen,
    obtenerProveedor, guardarProveedor, listarContratos, crearContrato, terminarContrato,
};
