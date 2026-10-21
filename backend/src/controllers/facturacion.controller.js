/**
 * SS SWAP - Controlador de Facturación electrónica (/api/facturacion)
 *
 * Toda la lógica tributaria vive en services/facturacion.service.js; aquí se
 * validan entradas, se aplican permisos finos y se responde. Cada consulta
 * corre dentro de la empresa del usuario (RLS): un comprobante, una
 * configuración o un certificado de otra empresa no existen para esta.
 *
 * Secretos: el certificado .p12 y su clave entran por multipart, se validan
 * abriéndolos en memoria, se cifran y se guardan. NUNCA se devuelven, ni se
 * registran en auditoría o logs (solo su huella SHA-256 y datos públicos).
 */
const multer = require('multer');
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { puede, denegar } = require('../middleware/auth.middleware');
const { registrarAuditoria } = require('../services/auditoria.service');
const { ErrorNegocio } = require('../services/inventarioProforma.service');
const F = require('../services/facturacion.service');
const { abrirP12, ErrorFirma } = require('../sri/firma');
const { cifrar, huella, ErrorCustodia } = require('../sri/certificado');
const { validarRuc, validarIdentificacion } = require('../sri/identificacion');
const soap = require('../sri/soap');
const { generarRide } = require('../sri/ride');
const { configurado: correoConfigurado } = require('../sri/correo');
const C = require('../sri/catalogos');

const ID_RE = /^\d{1,9}$/;

/** Respuesta uniforme de errores (negocio, triggers de la BD y restricciones). */
function responder(res, err, generico) {
    if (err instanceof ErrorNegocio) return res.status(err.status).json({ error: err.message, ...(err.detalle || {}) });
    // Triggers de integridad del Sprint 23: su mensaje ya es claro para el usuario.
    if (err && err.code === '42501' && /comprobante|version|contrato|evidencia|numero|clave/i.test(err.message || '')) {
        return res.status(409).json({ error: err.message });
    }
    if (err && err.code === '23505' && /uq_factura_por_proforma/.test(err.constraint || '')) {
        return res.status(409).json({ error: 'Esta proforma ya tiene una factura en este ambiente. No se factura dos veces.' });
    }
    if (err && err.code === '23505' && /uq_comprobante_numero/.test(err.constraint || '')) {
        return res.status(409).json({ error: 'Ese número de comprobante ya existe. Revise el secuencial del punto de emisión.' });
    }
    console.error(generico, err);
    const eBD = errorBD(err);
    if (eBD) return res.status(eBD.status).json({ error: eBD.error });
    return res.status(500).json({ error: generico });
}

const idValido = (req, res) => {
    if (!ID_RE.test(String(req.params.id))) { res.status(404).json({ error: 'Comprobante no encontrado.' }); return null; }
    return Number(req.params.id);
};

// ───────────────────────────── Catálogos y configuración ─────────────────────────────

/** GET /catalogos — lo que necesita la pantalla de emisión (sin datos sensibles). */
const catalogos = async (_req, res) => {
    try {
        const config = await F.obtenerConfig();
        const puntos = await F.obtenerPuntos(pool, { soloActivos: true });
        return res.json({
            ambiente: config ? Number(config.ambiente) : 1,
            iva_codigo_defecto: config?.iva_codigo_defecto || '4',
            faltantes: F.faltantesConfig(config, await F.obtenerPuntos()),
            puntos: puntos.map(p => ({ id: p.id, establecimiento: p.establecimiento, punto_emision: p.punto_emision, direccion: p.direccion, descripcion: p.descripcion })),
            tarifas_iva: Object.entries(C.TARIFAS_IVA).filter(([, t]) => t.vigente).map(([codigo, t]) => ({ codigo, ...t })),
            formas_pago: Object.entries(C.FORMAS_PAGO).map(([codigo, nombre]) => ({ codigo, nombre })),
            tipos_identificacion: Object.entries(C.TIPOS_IDENTIFICACION).map(([codigo, nombre]) => ({ codigo, nombre })),
            limite_consumidor_final: C.LIMITE_CONSUMIDOR_FINAL,
            correo_configurado: correoConfigurado(),
            version_ficha: C.VERSION_FICHA,
        });
    } catch (err) { return responder(res, err, 'Error al cargar los catálogos de facturación.'); }
};

/** GET /config — configuración tributaria completa (sin el certificado). */
const obtenerConfig = async (_req, res) => {
    try {
        const config = await F.obtenerConfig();
        const puntos = await F.obtenerPuntos();
        const { rows: pruebas } = await pool.query(
            `SELECT COUNT(*)::int AS n FROM comprobantes_electronicos WHERE ambiente = 1 AND estado = 'autorizado'`);
        const { rows: secuencias } = await pool.query(
            `SELECT nombre, valor FROM empresa_secuencias WHERE nombre LIKE 'sri:%' ORDER BY nombre`);
        return res.json({
            config, puntos, faltantes: F.faltantesConfig(config, puntos),
            regimenes: Object.entries(C.REGIMENES).map(([codigo, r]) => ({ codigo, nombre: r.nombre })),
            tarifas_iva: Object.entries(C.TARIFAS_IVA).filter(([, t]) => t.vigente).map(([codigo, t]) => ({ codigo, ...t })),
            autorizados_en_pruebas: pruebas[0].n,
            secuencias: secuencias.map(s => ({ nombre: s.nombre, ultimo: Number(s.valor) })),
            servicios: { pruebas: soap.BASE[1], produccion: soap.BASE[2] },
            custodia_configurada: Boolean(process.env.SRI_CERT_KEY && process.env.SRI_CERT_KEY.length >= 32),
            correo_configurado: correoConfigurado(),
        });
    } catch (err) { return responder(res, err, 'Error al cargar la configuración tributaria.'); }
};

const CAMPOS_CONFIG = {
    ruc: 13, razon_social: 300, nombre_comercial: 300, dir_matriz: 300, regimen: 30, contribuyente_especial: 13,
    agente_retencion: 8, email_emisor: 150, telefono: 30, iva_codigo_defecto: 4, ruc_proveedor_sistema: 13,
};

/** PUT /config — datos del emisor. El RUC no cambia si ya hay comprobantes emitidos. */
const guardarConfig = async (req, res) => {
    const body = req.body || {};
    const datos = {};
    for (const [campo, max] of Object.entries(CAMPOS_CONFIG)) {
        if (body[campo] === undefined) continue;
        const v = body[campo] === null ? null : String(body[campo]).replace(/[\r\n\t]+/g, ' ').trim();
        if (v && v.length > max) return res.status(400).json({ error: `El campo ${campo} es demasiado largo.` });
        datos[campo] = v || null;
    }
    if (body.obligado_contabilidad !== undefined) datos.obligado_contabilidad = Boolean(body.obligado_contabilidad);
    if (body.espera_autorizacion_seg !== undefined) {
        const n = Number(body.espera_autorizacion_seg);
        if (!Number.isInteger(n) || n < 1 || n > 60) return res.status(400).json({ error: 'La espera debe ser de 1 a 60 segundos.' });
        datos.espera_autorizacion_seg = n;
    }
    const advertencias = [];
    if (datos.ruc) {
        const v = validarRuc(datos.ruc);
        if (!v.valido) return res.status(400).json({ error: v.errores.join(' ') });
        advertencias.push(...v.advertencias);
        datos.ruc = v.normalizada;
    }
    if (datos.ruc_proveedor_sistema && !validarRuc(datos.ruc_proveedor_sistema).valido) {
        return res.status(400).json({ error: 'El RUC del proveedor del sistema no es válido.' });
    }
    if (datos.regimen && !C.REGIMENES[datos.regimen]) return res.status(400).json({ error: 'Régimen no válido.' });
    if (datos.iva_codigo_defecto && !C.TARIFAS_IVA[datos.iva_codigo_defecto]?.vigente) return res.status(400).json({ error: 'Tarifa de IVA no válida.' });
    if (datos.email_emisor && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.email_emisor)) return res.status(400).json({ error: 'El correo del emisor no es válido.' });
    if (datos.agente_retencion && !/^\d{1,8}$/.test(datos.agente_retencion)) return res.status(400).json({ error: 'El número de resolución de agente de retención solo admite dígitos (máx. 8).' });
    if (datos.contribuyente_especial && !/^[A-Za-z0-9]{3,13}$/.test(datos.contribuyente_especial)) return res.status(400).json({ error: 'El número de contribuyente especial no es válido (3 a 13 caracteres).' });
    const campos = Object.keys(datos);
    if (!campos.length) return res.status(400).json({ error: 'No hay datos para guardar.' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: antes } = await client.query('SELECT * FROM sri_configuracion FOR UPDATE');
        if (antes[0] && datos.ruc && antes[0].ruc && datos.ruc !== antes[0].ruc) {
            const { rows: em } = await client.query('SELECT 1 FROM comprobantes_electronicos WHERE secuencial IS NOT NULL LIMIT 1');
            if (em.length) throw new ErrorNegocio(409, 'Ya hay comprobantes emitidos con el RUC actual: no se puede cambiar. Si el emisor cambió, se necesita otra empresa.');
        }
        let fila;
        if (antes[0]) {
            const sets = campos.map((c, i) => `${c} = $${i + 1}`).join(', ');
            const { rows } = await client.query(`UPDATE sri_configuracion SET ${sets}, actualizado_por = $${campos.length + 1} RETURNING id`,
                [...campos.map(c => datos[c]), req.usuario.id]);
            fila = rows[0];
        } else {
            const { rows } = await client.query(
                `INSERT INTO sri_configuracion (${campos.join(', ')}, actualizado_por) VALUES (${campos.map((_, i) => `$${i + 1}`).join(', ')}, $${campos.length + 1}) RETURNING id`,
                [...campos.map(c => datos[c]), req.usuario.id]);
            fila = rows[0];
        }
        const cambios = Object.fromEntries(campos.filter(c => String(antes[0]?.[c] ?? '') !== String(datos[c] ?? ''))
            .map(c => [c, { antes: antes[0]?.[c] ?? null, despues: datos[c] }]));
        await registrarAuditoria({ req, accion: 'facturacion.configurar', recursoTipo: 'sri_configuracion', recursoId: fila.id, detalle: { cambios } }, client, true);
        await client.query('COMMIT');
        return res.json({ config: await F.obtenerConfig(), advertencias });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        return responder(res, err, 'Error al guardar la configuración tributaria.');
    } finally {
        client.release();
    }
};

/** POST /config/puntos  ·  PUT /config/puntos/:id */
const guardarPunto = async (req, res) => {
    const id = req.params.id ? idValido(req, res) : null;
    if (req.params.id && id === null) return undefined;
    const b = req.body || {};
    const estab = String(b.establecimiento ?? '').trim();
    const pto = String(b.punto_emision ?? '').trim();
    const direccion = String(b.direccion ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 300);
    if (!/^\d{3}$/.test(estab) || estab === '000') return res.status(400).json({ error: 'El establecimiento son 3 dígitos (001 o mayor), como está habilitado en el SRI.' });
    if (!/^\d{3}$/.test(pto) || pto === '000') return res.status(400).json({ error: 'El punto de emisión son 3 dígitos (001 o mayor).' });
    if (direccion.length < 5) return res.status(400).json({ error: 'Ingrese la dirección del establecimiento.' });
    const sucursalId = b.sucursal_id ? Number(b.sucursal_id) : null;
    const descripcion = b.descripcion ? String(b.descripcion).trim().slice(0, 120) : null;
    const activo = b.activo === undefined ? true : Boolean(b.activo);
    try {
        let fila;
        if (id) {
            const { rows: act } = await pool.query('SELECT * FROM sri_puntos_emision WHERE id = $1', [id]);
            if (!act[0]) return res.status(404).json({ error: 'Punto de emisión no encontrado.' });
            if (act[0].establecimiento !== estab || act[0].punto_emision !== pto) {
                const { rows: usado } = await pool.query('SELECT 1 FROM comprobantes_electronicos WHERE punto_emision_id = $1 AND secuencial IS NOT NULL LIMIT 1', [id]);
                if (usado.length) return res.status(409).json({ error: 'Este punto ya emitió comprobantes: su código no se puede cambiar. Cree otro punto.' });
            }
            const { rows } = await pool.query(
                `UPDATE sri_puntos_emision SET establecimiento=$1, punto_emision=$2, direccion=$3, sucursal_id=$4, descripcion=$5, activo=$6
                 WHERE id=$7 RETURNING *`, [estab, pto, direccion, sucursalId, descripcion, activo, id]);
            fila = rows[0];
        } else {
            const { rows } = await pool.query(
                `INSERT INTO sri_puntos_emision (establecimiento, punto_emision, direccion, sucursal_id, descripcion, activo)
                 VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [estab, pto, direccion, sucursalId, descripcion, activo]);
            fila = rows[0];
        }
        registrarAuditoria({ req, accion: id ? 'facturacion.punto_editar' : 'facturacion.punto_crear', recursoTipo: 'sri_punto_emision',
            recursoId: fila.id, detalle: { establecimiento: estab, punto_emision: pto, activo } });
        return res.status(id ? 200 : 201).json({ punto: fila });
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'Ese establecimiento y punto de emisión ya están registrados.' });
        return responder(res, err, 'Error al guardar el punto de emisión.');
    }
};

/**
 * PUT /config/puntos/:id/secuencial  body: { ambiente, cod_doc, ultimo_usado }
 * Para quien ya emitía comprobantes electrónicos con otro sistema: el próximo
 * número será ultimo_usado + 1. Solo puede AUMENTAR (nunca repetir números).
 */
const fijarSecuencial = async (req, res) => {
    const id = idValido(req, res); if (id === null) return undefined;
    const ambiente = Number(req.body?.ambiente);
    const codDoc = String(req.body?.cod_doc || '');
    const ultimo = Number(req.body?.ultimo_usado);
    if (![1, 2].includes(ambiente)) return res.status(400).json({ error: 'Ambiente no válido.' });
    if (!['01', '04'].includes(codDoc)) return res.status(400).json({ error: 'Tipo de comprobante no válido.' });
    if (!Number.isInteger(ultimo) || ultimo < 0 || ultimo > 999999998) return res.status(400).json({ error: 'El último número usado debe ser un entero entre 0 y 999999998.' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: p } = await client.query('SELECT * FROM sri_puntos_emision WHERE id = $1', [id]);
        if (!p[0]) throw new ErrorNegocio(404, 'Punto de emisión no encontrado.');
        const nombre = `sri:${ambiente}:${codDoc}:${p[0].establecimiento}-${p[0].punto_emision}`;
        const { rows: act } = await client.query('SELECT valor FROM empresa_secuencias WHERE nombre = $1 FOR UPDATE', [nombre]);
        const actual = act[0] ? Number(act[0].valor) : 0;
        if (ultimo < actual) throw new ErrorNegocio(409, `La numeración solo puede avanzar: el último número usado ya es ${actual}.`);
        await client.query(
            `INSERT INTO empresa_secuencias (nombre, valor) VALUES ($1, $2)
             ON CONFLICT (empresa_id, nombre) DO UPDATE SET valor = EXCLUDED.valor`, [nombre, ultimo]);
        await registrarAuditoria({ req, accion: 'facturacion.secuencial_fijar', recursoTipo: 'sri_punto_emision', recursoId: id,
            detalle: { contador: nombre, antes: actual, despues: ultimo } }, client, true);
        await client.query('COMMIT');
        return res.json({ contador: nombre, ultimo_usado: ultimo, siguiente: ultimo + 1 });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        return responder(res, err, 'Error al fijar la numeración.');
    } finally {
        client.release();
    }
};

// Certificado: solo en memoria, máx. 100 KB, un archivo.
const subidaCertificado = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024, files: 1, fields: 5 } }).single('certificado');
const recibirCertificado = (req, res, next) => subidaCertificado(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'El certificado no puede superar 100 KB.' : 'No se pudo recibir el archivo.' });
    return next();
});

/** POST /config/certificado (multipart: certificado=.p12, clave) */
const cargarCertificado = async (req, res) => {
    const archivo = req.file;
    const clave = typeof req.body?.clave === 'string' ? req.body.clave : '';
    if (!archivo) return res.status(400).json({ error: 'Seleccione el archivo .p12 de su firma electrónica.' });
    if (!/\.(p12|pfx)$/i.test(archivo.originalname || '')) return res.status(400).json({ error: 'El certificado debe ser un archivo .p12 o .pfx.' });
    if (!clave || clave.length > 200) return res.status(400).json({ error: 'Ingrese la clave del certificado.' });
    let datos;
    try {
        datos = abrirP12(archivo.buffer, clave).datos;
    } catch (err) {
        if (err instanceof ErrorFirma) return res.status(400).json({ error: err.message });
        return res.status(400).json({ error: 'No se pudo leer el certificado.' });
    }
    if (new Date(datos.validoHasta) < new Date()) return res.status(400).json({ error: `El certificado caducó el ${datos.validoHasta.slice(0, 10)}.` });
    const advertencias = [];
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: cfg } = await client.query('SELECT id, ruc FROM sri_configuracion FOR UPDATE');
        if (!cfg[0]) throw new ErrorNegocio(409, 'Primero guarde los datos tributarios del emisor.');
        if (datos.rucDetectado && cfg[0].ruc && datos.rucDetectado !== cfg[0].ruc) {
            advertencias.push(`El certificado parece pertenecer al RUC ${datos.rucDetectado}, distinto del emisor (${cfg[0].ruc}). Verifique que sea la firma correcta.`);
        }
        let blobP12;
        let blobClave;
        try {
            blobP12 = cifrar(archivo.buffer);
            blobClave = cifrar(clave);
        } catch (err) {
            if (err instanceof ErrorCustodia) throw new ErrorNegocio(409, err.message);
            throw err;
        }
        const h = huella(archivo.buffer);
        await client.query(
            `UPDATE sri_configuracion SET certificado_cifrado=$1, certificado_clave_cifrada=$2, certificado_titular=$3, certificado_emisor=$4,
                certificado_serial=$5, certificado_desde=$6, certificado_hasta=$7, certificado_ruc=$8, certificado_huella=$9,
                certificado_cargado_por=$10, certificado_cargado_at=NOW() WHERE id=$11`,
            [blobP12, blobClave, datos.titular, datos.emisor, String(datos.serial).slice(0, 80), datos.validoDesde, datos.validoHasta,
             datos.rucDetectado, h, req.usuario.id, cfg[0].id]);
        // Auditoría: datos públicos del certificado y su huella. Nunca el archivo ni la clave.
        await registrarAuditoria({ req, accion: 'facturacion.certificado_cargar', recursoTipo: 'sri_configuracion', recursoId: cfg[0].id,
            detalle: { titular: datos.titular, emisor: datos.emisor, valido_hasta: datos.validoHasta, huella_sha256: h } }, client, true);
        await client.query('COMMIT');
        return res.json({ certificado: { titular: datos.titular, emisor: datos.emisor, valido_desde: datos.validoDesde,
            valido_hasta: datos.validoHasta, ruc_detectado: datos.rucDetectado, huella: h }, advertencias });
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        return responder(res, err, 'Error al guardar el certificado.');
    } finally {
        client.release();
    }
};

/**
 * POST /config/produccion  body: { confirmacion: 'ACTIVAR PRODUCCION', confirmo_habilitacion_sri: true }
 * Requisitos: configuración completa, al menos un comprobante AUTORIZADO en
 * pruebas (prueba real con el SRI) y confirmación expresa de que el RUC está
 * habilitado para emitir. Permiso aparte: facturacion_config:aprobar.
 */
const activarProduccion = async (req, res) => {
    if (req.body?.confirmacion !== 'ACTIVAR PRODUCCION' || req.body?.confirmo_habilitacion_sri !== true) {
        return res.status(400).json({ error: 'Escriba ACTIVAR PRODUCCION y confirme que el RUC está habilitado para emitir comprobantes electrónicos en el SRI.' });
    }
    try {
        const config = await F.obtenerConfig();
        const faltan = F.faltantesConfig(config, await F.obtenerPuntos());
        if (faltan.length) return res.status(409).json({ error: 'La configuración está incompleta.', faltantes: faltan });
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM comprobantes_electronicos WHERE ambiente = 1 AND estado = 'autorizado'`);
        if (!rows[0].n) {
            return res.status(409).json({ error: 'Antes de pasar a producción emita al menos una factura en el ambiente de PRUEBAS y verifique que el SRI la AUTORICE.' });
        }
        await pool.query(`UPDATE sri_configuracion SET ambiente = 2, produccion_habilitada_at = NOW(), produccion_habilitada_por = $1`, [req.usuario.id]);
        await registrarAuditoria({ req, accion: 'facturacion.produccion_activar', recursoTipo: 'sri_configuracion', recursoId: config.id,
            detalle: { autorizados_en_pruebas: rows[0].n } });
        return res.json({ config: await F.obtenerConfig() });
    } catch (err) { return responder(res, err, 'Error al activar el ambiente de producción.'); }
};

/** POST /config/pruebas — volver al ambiente de pruebas (los comprobantes ya emitidos no cambian). */
const volverAPruebas = async (req, res) => {
    try {
        const { rows } = await pool.query('UPDATE sri_configuracion SET ambiente = 1 RETURNING id');
        if (!rows[0]) return res.status(404).json({ error: 'No hay configuración tributaria.' });
        await registrarAuditoria({ req, accion: 'facturacion.ambiente_pruebas', recursoTipo: 'sri_configuracion', recursoId: rows[0].id });
        return res.json({ config: await F.obtenerConfig() });
    } catch (err) { return responder(res, err, 'Error al cambiar de ambiente.'); }
};

/** POST /config/probar-conexion — verifica que los servicios del SRI respondan (no envía comprobantes). */
const probarConexion = async (_req, res) => {
    try {
        const config = await F.obtenerConfig();
        const ambiente = Number(config?.ambiente || 1);
        const inicio = Date.now();
        // Una clave inexistente: el SRI responde "0 comprobantes" sin registrar nada.
        const r = await soap.autorizacion('0'.repeat(49), ambiente);
        return res.json({ ambiente, ok: r.ok, milisegundos: Date.now() - inicio, detalle: r.ok ? 'El servicio de autorización del SRI respondió.' : r.error });
    } catch (err) { return responder(res, err, 'Error al probar la conexión con el SRI.'); }
};

// ───────────────────────────── Comprobantes ─────────────────────────────

const listar = async (req, res) => {
    try { return res.json(await F.listar(req.query)); } catch (err) { return responder(res, err, 'Error al listar comprobantes.'); }
};

const resumen = async (req, res) => {
    const fecha = (v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(String(v)) ? String(v) : null);
    try { return res.json(await F.resumen({ desde: fecha(req.query.desde), hasta: fecha(req.query.hasta) })); }
    catch (err) { return responder(res, err, 'Error al calcular el resumen de facturación.'); }
};

/** GET /propuesta?proforma_id= | ?orden_id= */
const propuesta = async (req, res) => {
    try {
        if (req.query.proforma_id && ID_RE.test(String(req.query.proforma_id))) return res.json(await F.propuestaDesdeProforma(Number(req.query.proforma_id)));
        if (req.query.orden_id && ID_RE.test(String(req.query.orden_id))) return res.json(await F.propuestaDesdeOrden(Number(req.query.orden_id)));
        return res.status(400).json({ error: 'Indique la proforma o la orden de trabajo a facturar.' });
    } catch (err) { return responder(res, err, 'Error al preparar la factura.'); }
};

/** GET /validar-identificacion?tipo=05&valor=... (solo formato; el SRI no publica consulta de datos) */
const validarIdentificacionCtrl = (req, res) => {
    const r = validarIdentificacion(String(req.query.tipo || ''), String(req.query.valor || '').slice(0, 30));
    return res.json({ ...r, nota: 'Validación de formato. Confirme el nombre o la razón social con el cliente o en el portal del SRI.' });
};

const crear = async (req, res) => {
    const clave = req.headers['idempotency-key'];
    const idem = typeof clave === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(clave) ? clave : null;
    try {
        const c = await F.guardarBorradorFactura(req.body || {}, req.usuario, { idempotencyKey: idem });
        return res.status(201).json(c);
    } catch (err) { return responder(res, err, 'Error al crear la factura.'); }
};

const actualizar = async (req, res) => {
    const id = idValido(req, res); if (id === null) return undefined;
    try {
        const { rows } = await pool.query('SELECT cod_doc FROM comprobantes_electronicos WHERE id = $1', [id]);
        if (!rows[0]) return res.status(404).json({ error: 'Comprobante no encontrado.' });
        // Facturas: permiso "crear"; notas de crédito: permiso "anular" (según el comprobante REAL).
        const requerido = rows[0].cod_doc === '04' ? 'anular' : 'crear';
        if (!puede(req.usuario, 'facturacion', requerido)) return denegar(req, res, [['facturacion', requerido]]);
        const c = rows[0].cod_doc === '04'
            ? await F.guardarBorradorNotaCredito(req.body || {}, req.usuario, { id })
            : await F.guardarBorradorFactura(req.body || {}, req.usuario, { id });
        return res.json(c);
    } catch (err) { return responder(res, err, 'Error al guardar el comprobante.'); }
};

const obtener = async (req, res) => {
    const id = idValido(req, res); if (id === null) return undefined;
    try {
        const c = await F.obtenerComprobante(id);
        delete c.logo;
        return res.json(c);
    } catch (err) { return responder(res, err, 'Error al obtener el comprobante.'); }
};

const emitir = async (req, res) => {
    const id = idValido(req, res); if (id === null) return undefined;
    try {
        const c = await F.emitir(id, req.usuario, { confirmarComprador: req.body?.confirmar_comprador === true });
        registrarAuditoria({ req, accion: 'facturacion.emitir', recursoTipo: 'comprobante', recursoId: id,
            detalle: { numero: c.numero, estado: c.estado, ambiente: c.ambiente, importe_total: c.importe_total } });
        delete c.logo;
        return res.json(c);
    } catch (err) { return responder(res, err, 'Error al emitir el comprobante.'); }
};

/** POST /:id/procesar — consultar/avanzar ahora (el sistema también lo hace solo cada minuto). */
const procesar = async (req, res) => {
    const id = idValido(req, res); if (id === null) return undefined;
    try {
        const r = await F.procesar(id, { usuarioId: req.usuario.id });
        const c = await F.obtenerComprobante(id);
        delete c.logo;
        return res.json({ ...c, ocupado: Boolean(r?.ocupado) });
    } catch (err) { return responder(res, err, 'Error al consultar el comprobante.'); }
};

const descartar = async (req, res) => {
    const id = idValido(req, res); if (id === null) return undefined;
    try { const c = await F.descartarBorrador(id, req.usuario); delete c.logo; return res.json(c); }
    catch (err) { return responder(res, err, 'Error al descartar el borrador.'); }
};

const crearNotaCredito = async (req, res) => {
    try {
        const c = await F.guardarBorradorNotaCredito(req.body || {}, req.usuario);
        registrarAuditoria({ req, accion: 'facturacion.nota_credito_borrador', recursoTipo: 'comprobante', recursoId: c.id,
            detalle: { factura_id: c.comprobante_modificado_id, importe_total: c.importe_total } });
        delete c.logo;
        return res.status(201).json(c);
    } catch (err) { return responder(res, err, 'Error al crear la nota de crédito.'); }
};

const registrarAnulacion = async (req, res) => {
    const id = idValido(req, res); if (id === null) return undefined;
    try {
        const c = await F.registrarAnulacion(id, req.usuario, req.body?.motivo);
        registrarAuditoria({ req, accion: 'facturacion.anulacion_registrar', recursoTipo: 'comprobante', recursoId: id, detalle: { numero: c.numero } });
        delete c.logo;
        return res.json(c);
    } catch (err) { return responder(res, err, 'Error al registrar la anulación.'); }
};

const cancelarAnulacion = async (req, res) => {
    const id = idValido(req, res); if (id === null) return undefined;
    try { const c = await F.cancelarAnulacion(id, req.usuario); delete c.logo; return res.json(c); }
    catch (err) { return responder(res, err, 'Error al cancelar la anulación.'); }
};

const reenviarCorreo = async (req, res) => {
    const id = idValido(req, res); if (id === null) return undefined;
    try {
        const r = await F.enviarCorreo(id, { para: req.body?.para || null, usuarioId: req.usuario.id });
        return res.status(r.enviado ? 200 : 502).json(r.enviado ? { ok: true, para: r.para } : { error: r.motivo });
    } catch (err) { return responder(res, err, 'Error al enviar el correo.'); }
};

const nombreArchivo = (c) => `${c.cod_doc === '04' ? 'NC' : 'FAC'}-${c.numero || `BORRADOR-${c.id}`}`;

const descargarXml = async (req, res) => {
    const id = idValido(req, res); if (id === null) return undefined;
    try {
        const c = await F.obtenerComprobante(id);
        const xml = c.xml_autorizado || c.xml_firmado;
        if (!xml) return res.status(409).json({ error: 'El comprobante todavía no tiene XML (es un borrador).' });
        registrarAuditoria({ req, accion: 'facturacion.descargar_xml', recursoTipo: 'comprobante', recursoId: id });
        res.setHeader('Content-Type', 'application/xml; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(c)}${c.xml_autorizado ? '' : '-FIRMADO-SIN-AUTORIZAR'}.xml"`);
        return res.send(xml);
    } catch (err) { return responder(res, err, 'Error al descargar el XML.'); }
};

const descargarRide = async (req, res) => {
    const id = idValido(req, res); if (id === null) return undefined;
    try {
        const c = await F.obtenerComprobante(id);
        const pdf = await generarRide(c, { logo: c.logo });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${req.query.descargar === '1' ? 'attachment' : 'inline'}; filename="${nombreArchivo(c)}.pdf"`);
        return res.send(pdf);
    } catch (err) { return responder(res, err, 'Error al generar el RIDE.'); }
};

// ───────────────────────────── Portal del cliente ─────────────────────────────

/** Cliente del portal vinculado a la cuenta (mismo criterio que /panel/mi-actividad: correo). */
async function clienteDelPortal(req) {
    const { rows } = await pool.query('SELECT id FROM clientes WHERE LOWER(email) = LOWER($1) ORDER BY id LIMIT 1', [req.usuario.email]);
    return rows[0]?.id || null;
}
const ESTADOS_VISIBLES_CLIENTE = ['autorizado', 'anulacion_solicitada', 'anulado'];

/** GET /api/panel/facturas — solo comprobantes AUTORIZADOS (o anulados) del propio cliente. */
const misComprobantes = async (req, res) => {
    try {
        const clienteId = await clienteDelPortal(req);
        if (!clienteId) return res.json({ comprobantes: [] });
        const { rows } = await pool.query(
            `SELECT id, cod_doc, ambiente, estado, establecimiento, punto_emision, secuencial, fecha_emision, importe_total, clave_acceso
             FROM comprobantes_electronicos WHERE cliente_id = $1 AND estado = ANY($2::text[]) ORDER BY id DESC LIMIT 100`,
            [clienteId, ESTADOS_VISIBLES_CLIENTE]);
        return res.json({ comprobantes: rows.map(r => ({ ...r, numero: `${r.establecimiento}-${r.punto_emision}-${r.secuencial}` })) });
    } catch (err) { return responder(res, err, 'Error al consultar sus comprobantes.'); }
};

/** GET /api/panel/facturas/:id/(ride|xml) — el id debe ser de un comprobante del MISMO cliente. */
const miDocumento = (tipo) => async (req, res) => {
    const id = idValido(req, res); if (id === null) return undefined;
    try {
        const clienteId = await clienteDelPortal(req);
        const { rows } = await pool.query('SELECT id FROM comprobantes_electronicos WHERE id = $1 AND cliente_id = $2 AND estado = ANY($3::text[])',
            [id, clienteId, ESTADOS_VISIBLES_CLIENTE]);
        if (!clienteId || !rows[0]) return res.status(404).json({ error: 'Comprobante no encontrado.' });
        const c = await F.obtenerComprobante(id);
        if (tipo === 'xml') {
            res.setHeader('Content-Type', 'application/xml; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(c)}.xml"`);
            return res.send(c.xml_autorizado || c.xml_firmado);
        }
        const pdf = await generarRide(c, { logo: c.logo });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo(c)}.pdf"`);
        return res.send(pdf);
    } catch (err) { return responder(res, err, 'Error al descargar el comprobante.'); }
};

module.exports = {
    misComprobantes, miDocumento,
    catalogos, obtenerConfig, guardarConfig, guardarPunto, fijarSecuencial, recibirCertificado, cargarCertificado,
    activarProduccion, volverAPruebas, probarConexion,
    listar, resumen, propuesta, validarIdentificacionCtrl, crear, actualizar, obtener, emitir, procesar, descartar,
    crearNotaCredito, registrarAnulacion, cancelarAnulacion, reenviarCorreo, descargarXml, descargarRide,
    responder,
};
