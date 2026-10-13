/**
 * SS SWAP - Facturas de compra (comprobantes electrónicos RECIBIDOS)
 *
 * Flujo:
 *  1. CONSULTAR por clave de acceso: se pregunta al SRI (servicio oficial de
 *     autorización, el mismo que usa la facturación propia). Si la factura
 *     está AUTORIZADA el SRI devuelve su XML y de ahí salen cabecera y
 *     artículos. Se guarda la factura en "pendiente_confirmacion".
 *     CONSULTAR NUNCA TOCA EL INVENTARIO.
 *  2. Si el SRI no responde o no devuelve el XML: se puede CARGAR el XML que
 *     entregó el proveedor (se valida y se vuelve a verificar con el SRI) o,
 *     en último caso, escribir los artículos a mano (queda como "no
 *     verificado", nunca como verificado por el SRI).
 *  3. CONFIRMAR: en UNA transacción se crea la compra (Proveedores ›
 *     Compras, con su deuda/pago), se crean o relacionan los productos, se
 *     suman las existencias en el inventario elegido de cada artículo y se
 *     registran las entradas. Si algo falla no queda nada a medias.
 *
 * Sin duplicados: UNIQUE (empresa, clave de acceso) en la factura; la
 * confirmación bloquea la fila (FOR UPDATE) y solo procede si sigue
 * pendiente; cada artículo puede generar UNA entrada (índice único en
 * movimientos_inventario.factura_compra_detalle_id); y una factura
 * registrada no se puede borrar ni alterar (trigger en la base).
 */
const crypto = require('crypto');
const pool = require('../config/db');
const sriPorDefecto = require('../sri/soap');
const { leerFactura, analizarClave, comprobarSeguridad, ErrorXml } = require('../sri/facturaRecibida');
const { verificarFirma } = require('../sri/firma');
const { puede, areasInventarioPermitidas } = require('../middleware/auth.middleware');
const { generarCodigoReferencia, areasValidas } = require('../controllers/inventory.controller');
const { registrarAuditoria } = require('./auditoria.service');
const { registrarAccionBitacora } = require('./ordenesHistorial.service');
const { redondear2 } = require('../utils/numeros');
const { marcaDe, COLUMNAS_EMPRESA_SQL } = require('./marcaEmpresa');
const { generarFacturaCompraPdf } = require('./facturaCompraPdf.service');

const DIAS_CREDITO = 15;
const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'];
const REGISTRABLE_SRI = ['AUTORIZADO'];
const BLOQUEADO_SRI = ['NO AUTORIZADO', 'ANULADO', 'PENDIENTE DE ANULAR', 'NO_ENCONTRADO'];

class ErrorNegocio extends Error {
    constructor(status, error, extra = {}) { super(error); this.status = status; this.error = error; Object.assign(this, extra); }
}

// Servicios del SRI (se pueden sustituir en pruebas por un servidor SOAP local).
let sri = sriPorDefecto;
const _usarSri = (impl) => { sri = impl || sriPorDefecto; };

const sha256 = (t) => crypto.createHash('sha256').update(String(t), 'utf8').digest('hex');
const numeroFactura = (c) => `${c.establecimiento}-${c.puntoEmision}-${c.secuencial}`;
const rucNormal = (v) => String(v ?? '').replace(/\s+/g, '').toUpperCase() || null;

/**
 * Pregunta al SRI por la clave. Reintenta una vez si la red falla (los
 * servicios del SRI tienen cortes breves). Devuelve:
 *   { disponible:false, error }                          SRI sin respuesta
 *   { disponible:true, estado:null }                     no existe (aún)
 *   { disponible:true, estado, numeroAutorizacion, fechaAutorizacion, xml, mensajes }
 */
async function consultarSri(clave, ambiente) {
    let r = await sri.autorizacion(clave, ambiente);
    if (!r.ok && r.incierto) r = await sri.autorizacion(clave, ambiente);
    if (!r.ok) return { disponible: false, error: r.error || 'El SRI no respondió.' };
    if (!r.estado) return { disponible: true, estado: null };
    const a = r.autorizacion || {};
    return {
        disponible: true, estado: r.estado, numeroAutorizacion: a.numeroAutorizacion || null,
        fechaAutorizacion: a.fechaAutorizacion || null, xml: a.comprobante || null,
        mensajes: (a.mensajes || []).map(m => m.mensaje).filter(Boolean).slice(0, 5),
    };
}

/**
 * Estado de validez (detecta facturas ANULADAS después de autorizadas).
 * { verificada:true, estado } o { verificada:false } si el servicio no responde.
 */
async function consultarAnulacion(clave, ambiente) {
    try {
        const r = await sri.consultaEstado(clave, ambiente);
        if (!r.ok) return { verificada: false };
        return { verificada: true, estado: r.estadoAutorizacion || null };
    } catch { return { verificada: false }; }
}

/** RUC de la empresa compradora (configuración tributaria o datos de la empresa). */
async function rucEmpresa(db) {
    const { rows } = await db.query(
        `SELECT COALESCE(NULLIF(s.ruc, ''), NULLIF(e.ruc, '')) AS ruc
         FROM empresas e LEFT JOIN sri_configuracion s ON s.empresa_id = e.id WHERE e.id = empresa_actual()`);
    return rows[0]?.ruc || null;
}

/** Advertencias que el usuario debe aceptar explícitamente al confirmar. */
async function calcularAdvertencias(db, f) {
    const adv = [];
    if (Number(f.ambiente) === 1) {
        adv.push({ codigo: 'AMBIENTE_PRUEBAS', confirmar: true,
            mensaje: 'La factura es del ambiente de PRUEBAS del SRI: no tiene validez tributaria.' });
    }
    if (f.estado_sri === 'SIN_VERIFICAR') {
        adv.push({ codigo: 'SIN_VERIFICAR', confirmar: true,
            mensaje: 'No se pudo comprobar la factura con el SRI. Los datos vienen del ' + (f.origen_datos === 'manual' ? 'ingreso manual' : 'XML cargado') + ' y no están verificados oficialmente.' });
    }
    if (f.estado_sri === 'AUTORIZADO' && f.anulacion_verificada === false) {
        adv.push({ codigo: 'ANULACION_NO_VERIFICADA', confirmar: false,
            mensaje: 'El SRI confirmó la autorización, pero no se pudo comprobar si la factura fue anulada después.' });
    }
    if (f.firma_valida === false) {
        adv.push({ codigo: 'FIRMA_INVALIDA', confirmar: true, mensaje: 'La firma electrónica del XML cargado no es válida: el archivo pudo ser modificado.' });
    }
    const ruc = await rucEmpresa(db);
    if (ruc && f.comprador_identificacion && rucNormal(ruc) !== rucNormal(f.comprador_identificacion)) {
        adv.push({ codigo: 'COMPRADOR_DISTINTO', confirmar: true,
            mensaje: `La factura está emitida a ${f.comprador_razon_social || 'otro comprador'} (${f.comprador_identificacion}), no al RUC de la empresa (${ruc}).` });
    }
    return adv;
}

const ESTADO_INTERNO = (estadoSri) => (BLOQUEADO_SRI.includes(estadoSri) ? 'no_registrable' : 'pendiente_confirmacion');

/**
 * Inserta o actualiza (si sigue pendiente) la factura y sus artículos.
 * `datos`: { cabecera, detalles, xml, origen, estadoSri, numeroAutorizacion, fechaAutorizacion, verificado, anulacionVerificada, firmaValida }
 */
async function guardarFactura(client, datos, usuario) {
    const c = datos.cabecera;
    const { rows: prov } = await client.query(
        `SELECT id FROM proveedores WHERE UPPER(REGEXP_REPLACE(COALESCE(ruc, ''), '[[:space:]]', '', 'g')) = $1 ORDER BY activo DESC, id LIMIT 1`, [rucNormal(c.ruc)]);
    const valores = [
        c.claveAcceso, c.ambiente, '01', numeroFactura(c), c.fechaEmision, c.ruc, c.razonSocial, c.nombreComercial,
        c.dirEstablecimiento || c.dirMatriz, c.compradorTipoIdentificacion, c.compradorIdentificacion, c.compradorRazonSocial,
        c.totalSinImpuestos, c.totalDescuento, c.totalIva, c.importeTotal, JSON.stringify(c.totalesImpuestos || []),
        datos.estadoSri, datos.numeroAutorizacion || null, datos.fechaAutorizacion || null, datos.verificado ? new Date() : null,
        datos.anulacionVerificada ?? null, datos.origen, datos.firmaValida ?? null, datos.xml || null, datos.xml ? sha256(datos.xml) : null,
        ESTADO_INTERNO(datos.estadoSri), prov[0]?.id || null, usuario.id,
    ];
    const { rows: existe } = await client.query('SELECT id, estado FROM facturas_compra WHERE clave_acceso = $1 FOR UPDATE', [c.claveAcceso]);
    let id;
    if (existe[0]) {
        if (existe[0].estado === 'registrada') throw new ErrorNegocio(409, 'Esta factura ya fue registrada como compra.', { codigo: 'YA_REGISTRADA', factura_id: existe[0].id });
        id = existe[0].id;
        await client.query(
            `UPDATE facturas_compra SET ambiente=$2, numero=$4, fecha_emision=$5, emisor_ruc=$6, emisor_razon_social=$7, emisor_nombre_comercial=$8,
                emisor_direccion=$9, comprador_tipo_identificacion=$10, comprador_identificacion=$11, comprador_razon_social=$12,
                total_sin_impuestos=$13, total_descuento=$14, total_iva=$15, importe_total=$16, totales_impuestos=$17, estado_sri=$18,
                numero_autorizacion=$19, fecha_autorizacion=$20, verificado_sri_at=$21, anulacion_verificada=$22, origen_datos=$23,
                firma_valida=$24, xml_original=$25, xml_sha256=$26, estado=$27, proveedor_id=COALESCE(proveedor_id, $28), consultada_por=$29, ultimo_error=NULL
             WHERE id = $30 AND clave_acceso = $1 AND cod_doc = $3`, [...valores, id]);
        await client.query('DELETE FROM facturas_compra_detalles WHERE factura_id = $1', [id]);
    } else {
        const { rows } = await client.query(
            `INSERT INTO facturas_compra (clave_acceso, ambiente, cod_doc, numero, fecha_emision, emisor_ruc, emisor_razon_social, emisor_nombre_comercial,
                emisor_direccion, comprador_tipo_identificacion, comprador_identificacion, comprador_razon_social, total_sin_impuestos, total_descuento,
                total_iva, importe_total, totales_impuestos, estado_sri, numero_autorizacion, fecha_autorizacion, verificado_sri_at, anulacion_verificada,
                origen_datos, firma_valida, xml_original, xml_sha256, estado, proveedor_id, consultada_por)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29) RETURNING id`, valores);
        id = rows[0].id;
    }
    for (const d of datos.detalles) {
        await client.query(
            `INSERT INTO facturas_compra_detalles (factura_id, linea, codigo_principal, codigo_auxiliar, descripcion, unidad_medida, cantidad,
                precio_unitario, descuento, precio_total_sin_impuesto, impuestos)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [id, d.linea, d.codigoPrincipal ? String(d.codigoPrincipal).slice(0, 100) : null, d.codigoAuxiliar ? String(d.codigoAuxiliar).slice(0, 100) : null,
             d.descripcion, d.unidadMedida, d.cantidad, d.precioUnitario, d.descuento, d.precioTotalSinImpuesto, JSON.stringify(d.impuestos || [])]);
    }
    const { rows: f } = await client.query('SELECT * FROM facturas_compra WHERE id = $1', [id]);
    await client.query('UPDATE facturas_compra SET advertencias = $2 WHERE id = $1', [id, JSON.stringify(await calcularAdvertencias(client, f[0]))]);
    return id;
}

async function enTransaccion(fn) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const r = await fn(client);
        await client.query('COMMIT');
        return r;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

/** Guarda con reintento si otra persona guardó la misma clave al mismo tiempo (UNIQUE). */
async function guardarSeguro(datos, usuario) {
    for (let intento = 0; intento < 2; intento++) {
        try {
            return await enTransaccion(client => guardarFactura(client, datos, usuario));
        } catch (err) {
            if (err.code === '23505' && err.constraint === 'uq_facturas_compra_clave' && intento === 0) continue;
            throw err;
        }
    }
    return null;
}

/** Interpreta la respuesta del SRI para una clave: { estadoSri, lectura?, ... } o lanza. */
async function verificarClave(info) {
    const r = await consultarSri(info.clave, info.ambiente);
    if (!r.disponible) return { disponible: false, error: r.error };
    if (!r.estado) return { disponible: true, estadoSri: 'NO_ENCONTRADO' };
    if (r.estado !== 'AUTORIZADO') return { disponible: true, estadoSri: 'NO AUTORIZADO', mensajes: r.mensajes };
    if (!r.xml) return { disponible: true, estadoSri: 'AUTORIZADO', sinXml: true, numeroAutorizacion: r.numeroAutorizacion, fechaAutorizacion: r.fechaAutorizacion };
    const lectura = leerFactura(r.xml);
    if (lectura.cabecera.claveAcceso !== info.clave) throw new ErrorNegocio(502, 'El SRI devolvió un comprobante que no corresponde a la clave consultada.');
    const anulacion = await consultarAnulacion(info.clave, info.ambiente);
    const anulada = anulacion.verificada && ['ANULADO', 'PENDIENTE DE ANULAR'].includes(anulacion.estado);
    return {
        disponible: true, estadoSri: anulada ? anulacion.estado : 'AUTORIZADO', lectura,
        numeroAutorizacion: r.numeroAutorizacion, fechaAutorizacion: r.fechaAutorizacion, anulacionVerificada: anulacion.verificada,
    };
}

// ───────────────────────────── Consultar por clave ─────────────────────────────

/**
 * Consulta una factura por clave de acceso. Si ya existe en la empresa se
 * devuelve tal cual (no se vuelve a crear ni toca el inventario). Con
 * `reconsultar` se refresca el estado en el SRI de una factura pendiente.
 */
async function consultar(claveTexto, usuario, { reconsultar = false } = {}) {
    const info = analizarClave(claveTexto);
    if (info.codDoc !== '01') throw new ErrorNegocio(400, 'La clave de acceso no corresponde a una factura (código 01).', { codigo: 'NO_ES_FACTURA' });

    const { rows: existe } = await pool.query('SELECT id, estado FROM facturas_compra WHERE clave_acceso = $1', [info.clave]);
    if (existe[0] && (!reconsultar || existe[0].estado === 'registrada')) return { factura_id: existe[0].id, existente: true };

    const v = await verificarClave(info);
    if (!v.disponible) {
        throw new ErrorNegocio(503, 'El SRI no está disponible en este momento. Puede intentar más tarde o cargar el XML que le entregó el proveedor.',
            { codigo: 'SRI_NO_DISPONIBLE' });
    }
    if (v.estadoSri === 'NO_ENCONTRADO') {
        if (existe[0]) {
            await pool.query(`UPDATE facturas_compra SET estado_sri = 'NO_ENCONTRADO', estado = 'no_registrable' WHERE id = $1 AND estado <> 'registrada'`, [existe[0].id]);
            return { factura_id: existe[0].id, existente: true };
        }
        throw new ErrorNegocio(404, 'El SRI no tiene una factura autorizada con esa clave de acceso (puede estar aún en proceso o la clave es incorrecta).',
            { codigo: 'NO_ENCONTRADA' });
    }
    if (v.estadoSri === 'NO AUTORIZADO') {
        throw new ErrorNegocio(409, `El SRI indica que la factura NO está autorizada${v.mensajes?.length ? `: ${v.mensajes.join('; ')}` : ''}. No se puede registrar como compra.`,
            { codigo: 'NO_AUTORIZADA' });
    }
    if (v.sinXml) {
        throw new ErrorNegocio(422, 'El SRI confirma que la factura está AUTORIZADA, pero no entregó su detalle. Cargue el XML que le envió el proveedor para obtener los artículos.',
            { codigo: 'SIN_DETALLE' });
    }
    const id = await guardarSeguro({
        cabecera: v.lectura.cabecera, detalles: v.lectura.detalles, xml: v.lectura.xmlComprobante, origen: 'sri',
        estadoSri: v.estadoSri, numeroAutorizacion: v.numeroAutorizacion, fechaAutorizacion: v.fechaAutorizacion,
        verificado: true, anulacionVerificada: v.anulacionVerificada, firmaValida: null,
    }, usuario);
    return { factura_id: id, existente: Boolean(existe[0]) };
}

// ───────────────────────────── Cargar XML del proveedor ─────────────────────────────

async function cargarXml(xmlTexto, usuario) {
    const lectura = leerFactura(xmlTexto);
    const c = lectura.cabecera;
    const info = analizarClave(c.claveAcceso);
    let firmaValida = null;
    try { firmaValida = /<(ds:)?Signature[\s>]/.test(lectura.xmlComprobante) ? verificarFirma(lectura.xmlComprobante).valida : null; } catch { firmaValida = false; }

    const { rows: existe } = await pool.query('SELECT id, estado FROM facturas_compra WHERE clave_acceso = $1', [c.claveAcceso]);
    if (existe[0]?.estado === 'registrada') return { factura_id: existe[0].id, existente: true };

    // Se vuelve a preguntar al SRI: el archivo por sí solo no prueba nada.
    const v = await verificarClave(info);
    let datos;
    if (v.disponible && v.lectura) {
        // El XML oficial manda: si el archivo difiere, se usa el del SRI.
        const difiere = sha256(v.lectura.xmlComprobante) !== sha256(lectura.xmlComprobante)
            && Math.abs(v.lectura.cabecera.importeTotal - c.importeTotal) > 0.009;
        datos = { cabecera: v.lectura.cabecera, detalles: v.lectura.detalles, xml: v.lectura.xmlComprobante, origen: 'sri',
            estadoSri: v.estadoSri, numeroAutorizacion: v.numeroAutorizacion, fechaAutorizacion: v.fechaAutorizacion,
            verificado: true, anulacionVerificada: v.anulacionVerificada, firmaValida: difiere ? false : firmaValida };
    } else if (v.disponible && v.estadoSri === 'AUTORIZADO') {
        // Autorizada pero el SRI no entregó el XML: se usa el archivo (verificado el estado).
        datos = { cabecera: c, detalles: lectura.detalles, xml: lectura.xmlComprobante, origen: 'xml', estadoSri: 'AUTORIZADO',
            numeroAutorizacion: v.numeroAutorizacion, fechaAutorizacion: v.fechaAutorizacion, verificado: true, anulacionVerificada: false, firmaValida };
    } else if (v.disponible) {
        if (v.estadoSri === 'NO AUTORIZADO') throw new ErrorNegocio(409, 'El SRI indica que esta factura NO está autorizada. No se puede registrar como compra.', { codigo: 'NO_AUTORIZADA' });
        throw new ErrorNegocio(404, 'El SRI no tiene registrada como autorizada la factura de este XML. Verifique con el proveedor que la factura esté autorizada.',
            { codigo: 'NO_ENCONTRADA' });
    } else {
        // SRI fuera de servicio: se guarda SIN VERIFICAR (al confirmar se pide aceptarlo).
        datos = { cabecera: c, detalles: lectura.detalles, xml: lectura.xmlComprobante, origen: 'xml', estadoSri: 'SIN_VERIFICAR',
            verificado: false, anulacionVerificada: null, firmaValida };
    }
    const id = await guardarSeguro(datos, usuario);
    return { factura_id: id, existente: Boolean(existe[0]), sri_disponible: v.disponible };
}

// ───────────────────────────── Ingreso manual ─────────────────────────────

/**
 * Último recurso: el SRI no responde y no hay XML. Se guardan los datos que
 * escribe el usuario como NO VERIFICADOS. Si el SRI sí responde, se usan sus
 * datos (no se permite escribir a mano una factura que el SRI puede dar).
 */
async function ingresoManual(body, usuario) {
    const info = analizarClave(body.clave_acceso);
    if (info.codDoc !== '01') throw new ErrorNegocio(400, 'La clave de acceso no corresponde a una factura (código 01).', { codigo: 'NO_ES_FACTURA' });
    const v = await verificarClave(info);
    if (v.disponible && v.lectura) return consultar(info.clave, usuario, { reconsultar: true });
    if (v.disponible && v.estadoSri !== 'AUTORIZADO') {
        throw new ErrorNegocio(v.estadoSri === 'NO AUTORIZADO' ? 409 : 404,
            v.estadoSri === 'NO AUTORIZADO' ? 'El SRI indica que la factura NO está autorizada.' : 'El SRI no tiene una factura autorizada con esa clave.',
            { codigo: v.estadoSri === 'NO AUTORIZADO' ? 'NO_AUTORIZADA' : 'NO_ENCONTRADA' });
    }
    const lineas = Array.isArray(body.lineas) ? body.lineas : [];
    if (!lineas.length || lineas.length > 300) throw new ErrorNegocio(400, 'Ingrese entre 1 y 300 artículos.');
    const r2n = (x) => Math.round(Number(x) * 100) / 100;
    const detalles = lineas.map((l, i) => {
        const cantidad = Number(l.cantidad);
        const precio = Number(l.precio_unitario);
        const descuento = Number(l.descuento || 0);
        if (!String(l.descripcion || '').trim()) throw new ErrorNegocio(400, `Artículo ${i + 1}: la descripción es obligatoria.`);
        if (!(cantidad > 0) || !(precio >= 0) || !(descuento >= 0)) throw new ErrorNegocio(400, `Artículo ${i + 1}: cantidad, precio o descuento inválidos.`);
        const total = r2n(cantidad * precio - descuento);
        if (total < 0) throw new ErrorNegocio(400, `Artículo ${i + 1}: el descuento supera el valor.`);
        return { linea: i + 1, codigoPrincipal: String(l.codigo || '').trim().slice(0, 100) || null, codigoAuxiliar: null,
            descripcion: String(l.descripcion).trim().slice(0, 300), unidadMedida: l.unidad_medida ? String(l.unidad_medida).slice(0, 50) : null,
            cantidad, precioUnitario: precio, descuento: r2n(descuento), precioTotalSinImpuesto: total, impuestos: [] };
    });
    const subtotal = r2n(detalles.reduce((s, d) => s + d.precioTotalSinImpuesto, 0));
    const iva = r2n(Number(body.total_iva || 0));
    if (!(iva >= 0)) throw new ErrorNegocio(400, 'El IVA es inválido.');
    const cabecera = {
        claveAcceso: info.clave, ambiente: info.ambiente, ruc: info.ruc, establecimiento: info.establecimiento, puntoEmision: info.puntoEmision,
        secuencial: info.secuencial, fechaEmision: info.fechaEmision,
        razonSocial: String(body.razon_social || '').trim().slice(0, 300) || null, nombreComercial: null, dirMatriz: null, dirEstablecimiento: null,
        compradorTipoIdentificacion: null, compradorIdentificacion: null, compradorRazonSocial: null,
        totalSinImpuestos: subtotal, totalDescuento: r2n(detalles.reduce((s, d) => s + d.descuento, 0)), totalIva: iva,
        importeTotal: r2n(subtotal + iva), totalesImpuestos: iva ? [{ codigo: '2', valor: iva }] : [],
    };
    const id = await guardarSeguro({ cabecera, detalles, xml: null, origen: 'manual', estadoSri: 'SIN_VERIFICAR', verificado: false }, usuario);
    return { factura_id: id, existente: false, sri_disponible: false };
}

// ───────────────────────────── Lectura ─────────────────────────────

/** Sugerencia de producto para cada artículo (nunca solo por descripción). */
async function sugerencias(db, factura, detalles) {
    const out = {};
    for (const d of detalles) {
        const codigos = [d.codigo_principal, d.codigo_auxiliar].filter(Boolean);
        let sugerido = null;
        let motivo = null;
        let candidatos = [];
        if (codigos.length && factura.proveedor_id) {
            const { rows } = await db.query(
                `SELECT r.id, r.codigo, r.nombre, r.area, r.stock_actual, r.activo FROM repuestos_codigos_proveedor m JOIN repuestos r ON r.id = m.repuesto_id
                 WHERE m.proveedor_id = $1 AND m.codigo = ANY($2::text[]) AND r.activo ORDER BY m.id LIMIT 1`, [factura.proveedor_id, codigos]);
            if (rows[0]) { sugerido = rows[0]; motivo = 'codigo_proveedor_registrado'; }
        }
        if (!sugerido && codigos.length) {
            const { rows } = await db.query(
                `SELECT id, codigo, nombre, area, stock_actual FROM repuestos
                 WHERE activo AND (UPPER(codigo_proveedor) = ANY($1::text[]) OR UPPER(codigo) = ANY($1::text[])) ORDER BY id LIMIT 5`,
                [codigos.map(x => String(x).toUpperCase())]);
            if (rows.length === 1) { sugerido = rows[0]; motivo = 'codigo'; } else if (rows.length > 1) { candidatos = rows; motivo = 'varios_por_codigo'; }
        }
        if (!sugerido && !candidatos.length) {
            // Solo como ayuda visual: nunca se relaciona automáticamente por nombre.
            const palabra = String(d.descripcion || '').split(/\s+/).filter(p => p.length >= 4).sort((a, b) => b.length - a.length)[0];
            if (palabra) {
                const { rows } = await db.query(`SELECT id, codigo, nombre, area, stock_actual FROM repuestos WHERE activo AND nombre ILIKE $1 ORDER BY nombre LIMIT 5`,
                    [`%${palabra.replace(/[%_\\]/g, '')}%`]);
                candidatos = rows;
                if (rows.length) motivo = 'parecidos_por_nombre';
            }
        }
        out[d.id] = { sugerido, motivo, candidatos };
    }
    return out;
}

async function obtener(id) {
    if (!/^\d+$/.test(String(id))) return null;
    const { rows } = await pool.query(
        `SELECT f.id, f.clave_acceso, f.ambiente, f.cod_doc, f.numero, f.fecha_emision, f.emisor_ruc, f.emisor_razon_social, f.emisor_nombre_comercial,
                f.emisor_direccion, f.comprador_tipo_identificacion, f.comprador_identificacion, f.comprador_razon_social, f.total_sin_impuestos,
                f.total_descuento, f.total_iva, f.importe_total, f.totales_impuestos, f.estado_sri, f.numero_autorizacion, f.fecha_autorizacion,
                f.verificado_sri_at, f.anulacion_verificada, f.origen_datos, f.firma_valida, (f.xml_original IS NOT NULL) AS tiene_xml, f.estado,
                f.advertencias, f.ultimo_error, f.proveedor_id, f.compra_id, f.registrada_at, f.created_at, f.updated_at,
                p.nombre_comercial AS proveedor_nombre, p.ruc AS proveedor_ruc, p.activo AS proveedor_activo,
                uc.nombre AS consultada_por_nombre, ur.nombre AS registrada_por_nombre,
                c.estado AS compra_estado, c.forma_pago, c.fecha_vencimiento, c.total AS compra_total
         FROM facturas_compra f
         LEFT JOIN proveedores p ON p.id = f.proveedor_id
         LEFT JOIN usuarios uc ON uc.id = f.consultada_por
         LEFT JOIN usuarios ur ON ur.id = f.registrada_por
         LEFT JOIN compras_proveedor c ON c.id = f.compra_id
         WHERE f.id = $1`, [id]);
    const f = rows[0];
    if (!f) return null;
    const { rows: detalles } = await pool.query(
        `SELECT d.*, r.codigo AS repuesto_codigo, r.nombre AS repuesto_nombre,
                m.id AS movimiento_id, m.stock_anterior, m.stock_nuevo, m.cantidad AS movimiento_cantidad, m.created_at AS movimiento_fecha
         FROM facturas_compra_detalles d
         LEFT JOIN repuestos r ON r.id = d.repuesto_id
         LEFT JOIN movimientos_inventario m ON m.factura_compra_detalle_id = d.id
         WHERE d.factura_id = $1 ORDER BY d.linea`, [id]);
    let pagos = [];
    if (f.compra_id) {
        const { rows: pg } = await pool.query(
            `SELECT id, tipo, descripcion, monto, metodo_pago, estado, created_at FROM movimientos_financieros_proveedor
             WHERE compra_id = $1 ORDER BY created_at, id`, [f.compra_id]);
        pagos = pg;
    }
    const pagado = pagos.filter(p => ['pago', 'abono'].includes(p.tipo) && p.estado === 'confirmado').reduce((s, p) => s + Number(p.monto), 0);
    return {
        ...f,
        registrable: f.estado === 'pendiente_confirmacion',
        detalles,
        sugerencias: f.estado === 'pendiente_confirmacion' ? await sugerencias(pool, f, detalles) : {},
        pagos,
        saldo: f.compra_id ? redondear2(Math.max(Number(f.compra_total) - pagado, 0)) : null,
    };
}

async function listar({ q, estado, desde, hasta, proveedor_id, page = 1, limit = 20 }) {
    const params = [];
    let where = 'WHERE 1=1';
    const add = (sql, v) => { params.push(v); where += ` AND ${sql.replace('$?', `$${params.length}`)}`; };
    if (q && String(q).trim()) {
        params.push(`%${String(q).trim().slice(0, 60)}%`);
        const n = params.length;
        where += ` AND (f.clave_acceso ILIKE $${n} OR f.numero ILIKE $${n} OR f.emisor_ruc ILIKE $${n} OR f.emisor_razon_social ILIKE $${n} OR p.nombre_comercial ILIKE $${n})`;
    }
    if (['pendiente_confirmacion', 'registrada', 'no_registrable', 'error'].includes(estado)) add('f.estado = $?', estado);
    if (/^\d{4}-\d{2}-\d{2}$/.test(desde || '')) add('f.fecha_emision >= $?', desde);
    if (/^\d{4}-\d{2}-\d{2}$/.test(hasta || '')) add('f.fecha_emision <= $?', hasta);
    if (/^\d+$/.test(String(proveedor_id || ''))) add('f.proveedor_id = $?', proveedor_id);
    const lim = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const off = (Math.max(1, parseInt(page) || 1) - 1) * lim;
    const base = `FROM facturas_compra f LEFT JOIN proveedores p ON p.id = f.proveedor_id ${where}`;
    const [{ rows: total }, { rows }] = await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS n ${base}`, params),
        pool.query(`SELECT f.id, f.clave_acceso, f.numero, f.fecha_emision, f.emisor_ruc, f.emisor_razon_social, f.importe_total, f.estado_sri,
                           f.origen_datos, f.estado, f.ambiente, f.compra_id, f.registrada_at, f.created_at, p.nombre_comercial AS proveedor_nombre,
                           (SELECT COUNT(*)::int FROM facturas_compra_detalles d WHERE d.factura_id = f.id) AS articulos
                    ${base} ORDER BY f.created_at DESC, f.id DESC LIMIT ${lim} OFFSET ${off}`, params),
    ]);
    return { facturas: rows, total: total[0].n };
}

async function xmlOriginal(id) {
    if (!/^\d+$/.test(String(id))) return null;
    const { rows } = await pool.query('SELECT numero, clave_acceso, xml_original FROM facturas_compra WHERE id = $1', [id]);
    return rows[0] || null;
}

/** PDF legible de la factura (con el logo y nombre de la empresa que la recibió). */
async function pdf(id) {
    const f = await obtener(id);
    if (!f) return null;
    let cabeceraXml = null;
    const crudo = await xmlOriginal(id);
    if (crudo?.xml_original) {
        try { cabeceraXml = leerFactura(crudo.xml_original).cabecera; } catch { cabeceraXml = null; }
    }
    const { rows } = await pool.query(`SELECT ${COLUMNAS_EMPRESA_SQL} FROM empresas e WHERE e.id = empresa_actual()`);
    const marca = rows[0] ? marcaDe(rows[0]) : { nombre: '', logo: null };
    const buffer = await generarFacturaCompraPdf(f, { cabeceraXml, empresa: { nombre: marca.nombre, logo: marca.logo } });
    return { buffer, numero: f.numero, emisor: f.emisor_razon_social };
}

/** Descarta una factura consultada que no se va a registrar (la base impide borrar las registradas). */
async function descartar(id) {
    const { rowCount } = await pool.query(`DELETE FROM facturas_compra WHERE id = $1 AND estado <> 'registrada'`, [id]);
    if (!rowCount) throw new ErrorNegocio(409, 'La factura no existe o ya fue registrada (no se puede descartar).');
}

// ───────────────────────────── Confirmar compra ─────────────────────────────

/**
 * Registra la compra. body:
 * { proveedor_id? | crear_proveedor:true, forma_pago:'contado'|'credito', metodo_pago?, referencia_pago?,
 *   aceptar_advertencias?: true,
 *   lineas: [{ detalle_id, accion:'existente'|'nuevo'|'omitir', repuesto_id?, area?, cantidad_recibida?,
 *              confirmar_nuevo?: true, nuevo?: { nombre?, categoria_id?, precio_venta?, stock_minimo?, unidad_medida? } }] }
 */
async function confirmar(id, body, req) {
    const usuario = req.usuario;
    if (!puede(usuario, 'registros_inventario', 'crear')) {
        throw new ErrorNegocio(403, 'Necesita el permiso "Registrar entradas / salidas" de inventario para registrar la compra.');
    }
    const formaPago = body.forma_pago === 'contado' ? 'contado' : body.forma_pago === 'credito' ? 'credito' : null;
    if (!formaPago) throw new ErrorNegocio(400, "Indique la forma de pago: 'contado' o 'credito'.");
    const metodo = body.metodo_pago || 'transferencia';
    if (formaPago === 'contado' && !METODOS.includes(metodo)) throw new ErrorNegocio(400, 'Método de pago inválido.');
    const lineasBody = Array.isArray(body.lineas) ? body.lineas : [];
    const areasSistema = await areasValidas();
    const areasVer = areasInventarioPermitidas(usuario, 'ver');
    const areasCrear = areasInventarioPermitidas(usuario, 'crear');

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        // Bloqueo de la factura: una segunda confirmación (doble clic, otro
        // usuario, reintento) espera aquí y luego ve que ya está registrada.
        const { rows: fr } = await client.query('SELECT * FROM facturas_compra WHERE id = $1 FOR UPDATE', [id]);
        const f = fr[0];
        if (!f) throw new ErrorNegocio(404, 'Factura no encontrada.');
        if (f.estado === 'registrada') throw new ErrorNegocio(409, 'Esta factura ya fue registrada como compra. No se volvió a sumar al inventario.', { codigo: 'YA_REGISTRADA', compra_id: f.compra_id });
        if (f.estado !== 'pendiente_confirmacion' || !REGISTRABLE_SRI.concat('SIN_VERIFICAR').includes(f.estado_sri)) {
            throw new ErrorNegocio(409, `La factura no se puede registrar: estado en el SRI ${f.estado_sri}.`, { codigo: 'NO_REGISTRABLE' });
        }
        const advertencias = await calcularAdvertencias(client, f);
        if (advertencias.some(a => a.confirmar) && body.aceptar_advertencias !== true) {
            throw new ErrorNegocio(409, 'Debe revisar y aceptar las advertencias de la factura antes de registrarla.', { codigo: 'ADVERTENCIAS', advertencias });
        }

        // ── Proveedor (debe ser el emisor de la factura) ──
        let proveedorId = null;
        if (body.crear_proveedor) {
            const { rows: ya } = await client.query(
                `SELECT id FROM proveedores WHERE UPPER(REGEXP_REPLACE(COALESCE(ruc, ''), '[[:space:]]', '', 'g')) = $1 LIMIT 1`, [rucNormal(f.emisor_ruc)]);
            if (ya[0]) proveedorId = ya[0].id;
            else {
                const { rows: np } = await client.query(
                    `INSERT INTO proveedores (nombre_comercial, razon_social, ruc, direccion, categoria, notas, activo)
                     VALUES ($1,$2,$3,$4,'Repuestos',$5,TRUE) RETURNING id`,
                    [String(f.emisor_nombre_comercial || f.emisor_razon_social || f.emisor_ruc).slice(0, 150), f.emisor_razon_social ? String(f.emisor_razon_social).slice(0, 150) : null,
                     rucNormal(f.emisor_ruc), f.emisor_direccion ? String(f.emisor_direccion).slice(0, 255) : null, `Creado al registrar la factura ${f.numero}.`]);
                proveedorId = np[0].id;
            }
        } else {
            if (!/^\d+$/.test(String(body.proveedor_id || ''))) throw new ErrorNegocio(400, 'Seleccione el proveedor o elija crearlo con los datos de la factura.');
            const { rows: pr } = await client.query('SELECT id, ruc, activo FROM proveedores WHERE id = $1', [body.proveedor_id]);
            if (!pr[0]) throw new ErrorNegocio(404, 'Proveedor no encontrado.');
            if (pr[0].ruc && rucNormal(pr[0].ruc) !== rucNormal(f.emisor_ruc)) {
                throw new ErrorNegocio(409, `El proveedor seleccionado tiene otro RUC (${pr[0].ruc}); la factura la emitió el RUC ${f.emisor_ruc}.`, { codigo: 'PROVEEDOR_DISTINTO' });
            }
            if (!pr[0].ruc) await client.query('UPDATE proveedores SET ruc = $1 WHERE id = $2', [rucNormal(f.emisor_ruc), pr[0].id]);
            if (!pr[0].activo) await client.query('UPDATE proveedores SET activo = TRUE WHERE id = $1', [pr[0].id]);
            proveedorId = pr[0].id;
        }

        // ── Decisiones por artículo (todas deben venir) ──
        const { rows: detalles } = await client.query('SELECT * FROM facturas_compra_detalles WHERE factura_id = $1 ORDER BY linea', [id]);
        const decision = new Map(lineasBody.map(l => [Number(l.detalle_id), l]));
        const faltan = detalles.filter(d => !decision.has(d.id));
        if (faltan.length) throw new ErrorNegocio(400, `Falta decidir qué hacer con ${faltan.length} artículo(s) (líneas ${faltan.map(d => d.linea).join(', ')}).`);
        if (decision.size !== detalles.length) throw new ErrorNegocio(400, 'Hay decisiones para artículos que no pertenecen a esta factura.');

        // ── Compra (Proveedores › Compras), ya recibida ──
        const { rows: cr } = await client.query(
            `INSERT INTO compras_proveedor (proveedor_id, usuario_id, estado, fecha_solicitud, fecha_recepcion, notas, forma_pago, fecha_vencimiento, subtotal, iva, total)
             VALUES ($1,$2,'recibida',$3::date,CURRENT_DATE,$4,$5::varchar,
                     CASE WHEN $5::varchar = 'credito' THEN $3::date + $6::int END, $7,$8,$9) RETURNING id`,
            [proveedorId, usuario.id, f.fecha_emision, `Factura ${f.numero} (clave ${f.clave_acceso}).`, formaPago, DIAS_CREDITO,
             f.total_sin_impuestos, f.total_iva, f.importe_total]);
        const compraId = cr[0].id;
        const referencia = `FC-${f.numero}`;
        const resultado = [];

        // Orden fijo por producto existente: evita bloqueos cruzados entre dos compras simultáneas.
        const ordenados = [...detalles].sort((a, b) => (Number(decision.get(a.id).repuesto_id) || 0) - (Number(decision.get(b.id).repuesto_id) || 0) || a.linea - b.linea);
        for (const d of ordenados) {
            const l = decision.get(d.id);
            const cantFact = redondear2(d.cantidad);
            const recibida = l.cantidad_recibida === undefined || l.cantidad_recibida === null || l.cantidad_recibida === '' ? cantFact : redondear2(l.cantidad_recibida);
            const costo = redondear2(Number(d.precio_total_sin_impuesto) / Number(d.cantidad));
            if (!['existente', 'nuevo', 'omitir'].includes(l.accion)) throw new ErrorNegocio(400, `Línea ${d.linea}: acción inválida.`);
            if (l.accion !== 'omitir' && (!(recibida > 0) || recibida > cantFact)) {
                throw new ErrorNegocio(400, `Línea ${d.linea}: la cantidad recibida debe ser mayor a 0 y no superar la facturada (${cantFact}).`);
            }
            let repuesto = null;
            let codigoCreado = null;
            const codigoProv = d.codigo_principal || d.codigo_auxiliar || null;

            if (l.accion === 'existente') {
                if (!/^\d+$/.test(String(l.repuesto_id || ''))) throw new ErrorNegocio(400, `Línea ${d.linea}: seleccione el producto existente.`);
                const { rows: rr } = await client.query('SELECT id, codigo, nombre, area, stock_actual, activo FROM repuestos WHERE id = $1 FOR UPDATE', [l.repuesto_id]);
                repuesto = rr[0];
                if (!repuesto || !repuesto.activo) throw new ErrorNegocio(409, `Línea ${d.linea}: el producto elegido no existe o está inactivo.`);
                if (l.area && l.area !== repuesto.area) {
                    throw new ErrorNegocio(400, `Línea ${d.linea}: el producto ${repuesto.codigo} pertenece al inventario de ${repuesto.area}; no se puede ingresar en ${l.area}.`);
                }
                if (!areasVer.includes(repuesto.area)) throw new ErrorNegocio(403, `Línea ${d.linea}: no tiene acceso al inventario de ${repuesto.area}.`);
            } else if (l.accion === 'nuevo') {
                const area = l.area;
                if (!areasSistema.includes(area)) throw new ErrorNegocio(400, `Línea ${d.linea}: elija el inventario de destino (Mecánica o Colisiones/Pintura).`);
                if (!areasCrear.includes(area)) throw new ErrorNegocio(403, `Línea ${d.linea}: no tiene permiso para crear productos en el inventario de ${area}.`);
                // Antes de crear, se comprueba que no exista ya (evita duplicados).
                if (codigoProv) {
                    const { rows: m } = await client.query(
                        `SELECT r.codigo FROM repuestos_codigos_proveedor m JOIN repuestos r ON r.id = m.repuesto_id
                         WHERE m.proveedor_id = $1 AND m.codigo = $2 AND r.activo`, [proveedorId, codigoProv]);
                    if (m[0]) throw new ErrorNegocio(409, `Línea ${d.linea}: el código ${codigoProv} de este proveedor ya corresponde al producto ${m[0].codigo}. Elija "producto existente".`, { codigo: 'PRODUCTO_EXISTE', linea: d.linea });
                    const { rows: s } = await client.query(
                        `SELECT codigo FROM repuestos WHERE activo AND area = $1 AND UPPER(codigo_proveedor) = UPPER($2) LIMIT 1`, [area, codigoProv]);
                    if (s[0] && l.confirmar_nuevo !== true) {
                        throw new ErrorNegocio(409, `Línea ${d.linea}: ya existe el producto ${s[0].codigo} con el código de proveedor ${codigoProv}. Relaciónelo con ese producto o confirme que es otro.`, { codigo: 'POSIBLE_DUPLICADO', linea: d.linea });
                    }
                }
                const n = l.nuevo || {};
                let categoriaId = null;
                if (n.categoria_id) {
                    const { rows: cat } = await client.query('SELECT id, area FROM categorias_repuesto WHERE id = $1', [n.categoria_id]);
                    if (!cat[0]) throw new ErrorNegocio(400, `Línea ${d.linea}: categoría inexistente.`);
                    if (cat[0].area && cat[0].area !== area) throw new ErrorNegocio(400, `Línea ${d.linea}: la categoría pertenece a otro inventario.`);
                    categoriaId = cat[0].id;
                }
                const precioVenta = n.precio_venta === undefined || n.precio_venta === '' || n.precio_venta === null ? 0 : redondear2(n.precio_venta);
                const stockMin = n.stock_minimo === undefined || n.stock_minimo === '' || n.stock_minimo === null ? 0 : redondear2(n.stock_minimo);
                if (!(precioVenta >= 0) || !(stockMin >= 0)) throw new ErrorNegocio(400, `Línea ${d.linea}: precio de venta o stock mínimo inválidos.`);
                codigoCreado = await generarCodigoReferencia(client, area);
                const { rows: nr } = await client.query(
                    `INSERT INTO repuestos (codigo, nombre, descripcion, categoria_id, precio_compra, precio_venta, stock_actual, stock_minimo, unidad_medida, area, codigo_proveedor, en_venta)
                     VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,$10,FALSE) RETURNING id, codigo, nombre, area, stock_actual`,
                    [codigoCreado, String(n.nombre || d.descripcion).trim().slice(0, 200), `Ingresado por la factura ${f.numero} de ${f.emisor_razon_social || f.emisor_ruc}.`,
                     categoriaId, costo, precioVenta, stockMin, String(n.unidad_medida || d.unidad_medida || 'unidad').slice(0, 30), area,
                     codigoProv ? String(codigoProv).slice(0, 100) : null]);
                repuesto = nr[0];
            }

            let movimiento = null;
            if (repuesto) {
                const anterior = Number(repuesto.stock_actual);
                const nuevo = redondear2(anterior + recibida);
                await client.query('UPDATE repuestos SET stock_actual = $1, precio_compra = $2 WHERE id = $3', [nuevo, costo, repuesto.id]);
                const { rows: mv } = await client.query(
                    `INSERT INTO movimientos_inventario (repuesto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia, origen, area,
                        compra_id, precio_unitario, factura_compra_id, factura_compra_detalle_id)
                     VALUES ($1,$2,'entrada',$3,$4,$5,$6,$7,'compra',$8,$9,$10,$11,$12) RETURNING id`,
                    [repuesto.id, usuario.id, recibida, anterior, nuevo,
                     `Compra: factura ${f.numero} de ${String(f.emisor_razon_social || f.emisor_ruc).slice(0, 80)}`.slice(0, 255),
                     referencia.slice(0, 100), repuesto.area, compraId, costo, f.id, d.id]);
                movimiento = { id: mv[0].id, stock_anterior: anterior, stock_nuevo: nuevo };
                // Código del proveedor -> código interno (sin reemplazar el interno).
                if (codigoProv) {
                    await client.query(
                        `INSERT INTO repuestos_codigos_proveedor (repuesto_id, proveedor_id, codigo, creado_por) VALUES ($1,$2,$3,$4)
                         ON CONFLICT (empresa_id, proveedor_id, codigo) DO UPDATE SET repuesto_id = EXCLUDED.repuesto_id`,
                        [repuesto.id, proveedorId, String(codigoProv).slice(0, 100), usuario.id]);
                }
            }
            await client.query(
                `INSERT INTO compras_proveedor_items (compra_id, repuesto_id, descripcion, cantidad, cantidad_recibida, precio_unitario, subtotal)
                 VALUES ($1,$2,$3,$4,$5,$6,$7)`,
                [compraId, repuesto?.id || null, String(d.descripcion).slice(0, 200), cantFact, l.accion === 'omitir' ? 0 : recibida, costo, d.precio_total_sin_impuesto]);
            await client.query(
                `UPDATE facturas_compra_detalles SET accion = $2, repuesto_id = $3, area = $4, cantidad_recibida = $5, costo_unitario = $6 WHERE id = $1`,
                [d.id, l.accion, repuesto?.id || null, repuesto?.area || null, l.accion === 'omitir' ? null : recibida, costo]);
            resultado.push({ linea: d.linea, accion: l.accion, repuesto_id: repuesto?.id || null, codigo: repuesto?.codigo || null,
                creado: Boolean(codigoCreado), cantidad: l.accion === 'omitir' ? 0 : recibida, movimiento });
        }

        // ── Deuda / pago con el proveedor (mismo registro que una compra manual) ──
        await client.query(
            `INSERT INTO movimientos_financieros_proveedor (proveedor_id, tipo, compra_id, descripcion, monto, estado, usuario_id)
             VALUES ($1,'compra',$2,$3,$4,'confirmado',$5)`,
            [proveedorId, compraId, `Factura de compra ${f.numero}`, f.importe_total, usuario.id]);
        if (formaPago === 'contado' && Number(f.importe_total) > 0) {
            await client.query(
                `INSERT INTO movimientos_financieros_proveedor (proveedor_id, tipo, compra_id, descripcion, monto, metodo_pago, referencia, estado, usuario_id)
                 VALUES ($1,'pago',$2,$3,$4,$5,$6,'confirmado',$7)`,
                [proveedorId, compraId, `Pago al contado factura ${f.numero}`, f.importe_total, metodo, String(body.referencia_pago || '').trim().slice(0, 100) || null, usuario.id]);
        }

        await client.query(
            `UPDATE facturas_compra SET estado = 'registrada', proveedor_id = $2, compra_id = $3, registrada_por = $4, registrada_at = NOW(),
                ultimo_error = NULL, advertencias = $5 WHERE id = $1`,
            [f.id, proveedorId, compraId, usuario.id, JSON.stringify(advertencias)]);
        await registrarAuditoria({ req, accion: 'factura_compra.registrar', recursoTipo: 'factura_compra', recursoId: f.id,
            detalle: { numero: f.numero, compra_id: compraId, articulos: resultado.length, entradas: resultado.filter(r => r.movimiento).length,
                productos_nuevos: resultado.filter(r => r.creado).length, advertencias_aceptadas: advertencias.filter(a => a.confirmar).map(a => a.codigo) } }, client, true);
        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'compra', entidad_id: compraId, accion: 'factura_registrada', usuario_id: usuario.id, usuario_nombre: usuario.nombre,
            detalle: `Factura ${f.numero} registrada: ${resultado.filter(r => r.movimiento).length} entrada(s) de inventario.`,
        });
        return { factura_id: f.id, compra_id: compraId, proveedor_id: proveedorId, lineas: resultado };
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        // Nada quedó a medias (ROLLBACK). Se deja constancia del error para el usuario.
        const mensaje = err instanceof ErrorNegocio ? err.error : 'Error interno al registrar la compra.';
        if (!(err instanceof ErrorNegocio && err.codigo === 'YA_REGISTRADA')) {
            await pool.query(`UPDATE facturas_compra SET ultimo_error = $2 WHERE id = $1 AND estado <> 'registrada'`, [id, mensaje.slice(0, 500)]).catch(() => {});
        }
        throw err;
    } finally {
        client.release();
    }
}

module.exports = {
    consultar, cargarXml, ingresoManual, obtener, listar, xmlOriginal, descartar, confirmar, pdf,
    ErrorNegocio, ErrorXml, comprobarSeguridad, _usarSri,
};
