/**
 * SS SWAP - Servicio de facturación electrónica (SRI, esquema off-line)
 *
 * Flujo de una factura:
 *   borrador ──emitir──► firmado ──recepción──► recibida ──autorización──► autorizado
 *                                  │                  └──► no_autorizado (se corrige y se reenvía con la MISMA clave)
 *                                  ├─► devuelta (error de estructura/datos: se corrige y se reenvía)
 *                                  └─► pendiente_reintento (sin respuesta: primero se CONSULTA, nunca se reemite)
 *   recibida / en_procesamiento ──consulta──► autorizado | no_autorizado | sigue en procesamiento (hasta 24 h)
 *   autorizado ──registrar anulación (hecha en SRI en Línea)──► anulacion_solicitada ──consulta──► anulado
 *
 * Reglas que garantizan que no haya duplicados (Ficha v2.34, 9.18 y notas de la Tabla de errores):
 *  - El secuencial y la clave se asignan UNA vez, en la transacción de emisión,
 *    con el contador de la empresa bloqueado (empresa_secuencias). Nunca cambian
 *    (trigger proteger_comprobante_electronico).
 *  - Un comprobante devuelto/no autorizado se corrige y se reenvía con la
 *    misma clave y secuencial.
 *  - Error 70 (en procesamiento), 43 (clave registrada) o 45 (secuencial
 *    registrado): NO es un rechazo; se consulta la autorización.
 *  - Ante una respuesta incierta (red, tiempo agotado) se consulta primero y
 *    solo se reenvía el MISMO XML si el SRI no lo tiene.
 *  - Un "candado" (procesando_hasta) evita que dos procesos envíen el mismo
 *    comprobante a la vez (botón + tarea automática).
 *
 * Este módulo NO mueve inventario ni registra cobros: la factura se enlaza a
 * la proforma, la OT y el pagaré, pero el stock y los pagos siguen su propio
 * flujo (inventarioProforma.service / cuentas por cobrar).
 *
 * Todas las consultas corren dentro de la empresa de la petición (RLS).
 */
const pool = require('../config/db');
const { conEmpresa, sinAislamiento } = require('../config/contexto');
const { ErrorNegocio, formatoOrden } = require('./inventarioProforma.service');
const { buscarPagareActivo } = require('./pagare.service');
const { siguienteNumero } = require('./secuencias.service');
const { calcularComprobante, ErrorCalculo, r2 } = require('../sri/calculos');
const { construirXml } = require('../sri/xml');
const { validarXsd } = require('../sri/validadorXsd');
const { firmarComprobante, verificarFirma, ErrorFirma } = require('../sri/firma');
const { generarClaveAcceso } = require('../sri/claveAcceso');
const soap = require('../sri/soap');
const { descifrar, ErrorCustodia } = require('../sri/certificado');
const { validarIdentificacion, tipoSugerido } = require('../sri/identificacion');
const {
    TARIFAS_IVA, FORMAS_PAGO, TIPOS_IDENTIFICACION, CONSUMIDOR_FINAL, LIMITE_CONSUMIDOR_FINAL,
    codigoIvaPorPorcentaje, FORMA_PAGO_POR_METODO, FORMA_PAGO_POR_TARJETA,
} = require('../sri/catalogos');
const { generarRide } = require('../sri/ride');
const { enviarComprobante } = require('../sri/correo');
const { rutaLogo } = require('./marcaEmpresa');

const ESTADOS_EDITABLES = ['borrador', 'devuelta', 'no_autorizado'];
const ESTADOS_EN_CURSO = ['firmado', 'recibida', 'en_procesamiento', 'pendiente_reintento'];
const CODIGOS_NO_RECHAZO = ['43', '45', '70']; // clave/secuencial ya registrados o en procesamiento
const MAX_HORAS_PROCESAMIENTO = 24;
const CANDADO_SEG = 120;

/** Fecha 'YYYY-MM-DD' (db.js devuelve las columnas DATE como texto, sin zona horaria). */
const fechaIso = (f) => (f instanceof Date ? new Date(f.getTime() - f.getTimezoneOffset() * 60000).toISOString().slice(0, 10) : String(f || '').slice(0, 10));
/** Fecha de hoy en Ecuador continental (UTC-05:00) como 'YYYY-MM-DD'. */
const hoyEcuador = () => new Date(Date.now() - 5 * 3600 * 1000).toISOString().slice(0, 10);
const espera = (ms) => new Promise(ok => setTimeout(ok, ms));

// ───────────────────────────── Configuración ─────────────────────────────

const COLUMNAS_CONFIG = `id, empresa_id, ruc, razon_social, nombre_comercial, dir_matriz, regimen, obligado_contabilidad,
    contribuyente_especial, agente_retencion, email_emisor, telefono, iva_codigo_defecto, ruc_proveedor_sistema,
    ambiente, produccion_habilitada_at, produccion_habilitada_por, espera_autorizacion_seg,
    (certificado_cifrado IS NOT NULL) AS certificado_cargado, certificado_titular, certificado_emisor, certificado_serial,
    certificado_desde, certificado_hasta, certificado_ruc, certificado_huella, certificado_cargado_at, updated_at`;

/** Configuración tributaria de la empresa (sin el certificado). null si no existe. */
async function obtenerConfig(db = pool) {
    const { rows } = await db.query(`SELECT ${COLUMNAS_CONFIG} FROM sri_configuracion LIMIT 1`);
    return rows[0] || null;
}

async function obtenerPuntos(db = pool, { soloActivos = false } = {}) {
    const { rows } = await db.query(
        `SELECT p.*, s.nombre AS sucursal_nombre FROM sri_puntos_emision p
         LEFT JOIN sucursales s ON s.id = p.sucursal_id
         ${soloActivos ? 'WHERE p.activo' : ''} ORDER BY p.establecimiento, p.punto_emision`);
    return rows;
}

/** Lista de lo que falta para poder emitir (vacía = listo). */
function faltantesConfig(config, puntos) {
    const f = [];
    if (!config) return ['Registre los datos tributarios del emisor (RUC, razón social, dirección matriz).'];
    if (!config.ruc) f.push('RUC del emisor.');
    if (!config.razon_social) f.push('Razón social del emisor.');
    if (!config.dir_matriz) f.push('Dirección matriz.');
    if (!puntos.some(p => p.activo)) f.push('Al menos un punto de emisión activo (establecimiento y punto habilitados en el SRI).');
    if (!config.certificado_cargado) f.push('Certificado de firma electrónica (.p12).');
    else if (config.certificado_hasta && new Date(config.certificado_hasta) < new Date()) f.push('El certificado de firma electrónica está caducado.');
    if (!process.env.SRI_CERT_KEY) f.push('Variable SRI_CERT_KEY en el servidor (custodia del certificado).');
    return f;
}

function emisorSnapshot(config, punto) {
    return {
        ruc: config.ruc,
        razonSocial: config.razon_social,
        nombreComercial: config.nombre_comercial || null,
        dirMatriz: config.dir_matriz,
        dirEstablecimiento: punto.direccion,
        obligadoContabilidad: Boolean(config.obligado_contabilidad),
        contribuyenteEspecial: config.contribuyente_especial || null,
        agenteRetencion: config.agente_retencion || null,
        regimen: config.regimen,
    };
}

// ───────────────────────────── Eventos ─────────────────────────────

async function registrarEvento(db, comprobanteId, { usuarioId = null, tipo, anterior = null, nuevo = null, detalle = null, respuesta = null }) {
    await db.query(
        `INSERT INTO comprobante_eventos (comprobante_id, usuario_id, tipo, estado_anterior, estado_nuevo, detalle, respuesta_sri)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [comprobanteId, usuarioId, tipo, anterior, nuevo, detalle ? JSON.stringify(detalle) : null, respuesta ? String(respuesta).slice(0, 20000) : null]);
}

// ───────────────────────────── Propuesta desde proforma / OT ─────────────────────────────

/**
 * Datos sugeridos para facturar una proforma (no guarda nada). La proforma
 * debe estar aprobada o convertida: se factura lo que el cliente aprobó.
 */
async function propuestaDesdeProforma(proformaId) {
    const { rows } = await pool.query(
        `SELECT p.*, c.nombre AS c_nombre, c.cedula AS c_identificacion, c.tipo_identificacion AS c_tipo,
                c.direccion AS c_direccion, c.email AS c_email, c.telefono AS c_telefono,
                c.identificacion_confirmada_at AS c_confirmada_at
         FROM proformas p LEFT JOIN clientes c ON c.id = p.cliente_id WHERE p.id = $1`, [proformaId]);
    const p = rows[0];
    if (!p) throw new ErrorNegocio(404, 'Proforma no encontrada.');
    if (!['aprobada', 'convertida'].includes(p.estado)) {
        throw new ErrorNegocio(409, `Solo se facturan proformas aprobadas o convertidas en orden de trabajo (esta está "${p.estado}").`);
    }
    const { rows: items } = await pool.query(
        `SELECT pi.*, r.codigo AS repuesto_codigo FROM proforma_items pi
         LEFT JOIN repuestos r ON pi.referencia_tipo = 'repuesto' AND r.id = pi.referencia_id
         WHERE pi.proforma_id = $1 ORDER BY pi.categoria, pi.orden_linea, pi.id`, [proformaId]);
    if (!items.length) throw new ErrorNegocio(409, 'La proforma no tiene ítems para facturar.');

    const config = await obtenerConfig();
    const ivaProforma = codigoIvaPorPorcentaje(p.iva_porcentaje);
    const avisos = [];
    let ivaCodigo = ivaProforma;
    if (!ivaProforma) {
        ivaCodigo = config?.iva_codigo_defecto || '4';
        avisos.push(`La proforma usa un IVA de ${p.iva_porcentaje}%, que no es una tarifa vigente del SRI. Se propone ${TARIFAS_IVA[ivaCodigo].nombre}; revise cada línea.`);
    } else if (ivaProforma === '0' && config?.iva_codigo_defecto && config.iva_codigo_defecto !== '0') {
        avisos.push(`La proforma tiene IVA 0%. La tarifa por defecto del emisor es ${TARIFAS_IVA[config.iva_codigo_defecto].nombre}. Confirme la tarifa correcta de cada línea: si la cambia, el total será distinto al de la proforma.`);
    }

    const ordenId = p.orden_generada_id || p.orden_id || null;
    const existente = await facturaActivaDeProforma(proformaId, config?.ambiente || 1);
    if (existente) avisos.push(`Esta proforma ya tiene la factura ${existente.numero || '(borrador)'} en estado ${existente.estado}.`);

    const pagare = await buscarPagareActivo(pool, { proformaId: p.id, ordenId });
    const formaPago = await formaPagoSugerida(pagare?.id);

    return {
        origen: { proforma_id: p.id, proforma_numero: p.numero, proforma_tipo: p.tipo, orden_id: ordenId, orden_numero: formatoOrden(ordenId),
            total_proforma: Number(p.total), cuenta_cobrar_id: pagare?.id || null, factura_existente: existente },
        comprador: compradorDesdeCliente({
            cliente_id: p.cliente_id, nombre: p.c_nombre || p.cliente_nombre, identificacion: p.c_identificacion || p.cliente_ruc,
            tipo: p.c_tipo, direccion: p.c_direccion || p.cliente_direccion, email: p.c_email || p.cliente_email,
            telefono: p.c_telefono || p.cliente_telefono, confirmada_at: p.c_confirmada_at,
        }),
        vehiculo: p.vehiculo_placa || p.vehiculo_marca ? {
            placa: p.vehiculo_placa || null, marca: p.vehiculo_marca || null, modelo: p.vehiculo_modelo || null,
            anio: p.vehiculo_anio || null, color: p.vehiculo_color || null, vin: p.vehiculo_vin || null,
        } : null,
        lineas: items.map(it => ({
            proforma_item_id: it.id,
            codigo: (it.repuesto_codigo || `${it.categoria.slice(0, 3).toUpperCase()}-${it.id}`).slice(0, 25),
            descripcion: it.descripcion,
            cantidad: Number(it.cantidad),
            precio_unitario: Number(it.precio_unitario),
            descuento: 0,
            iva_codigo: ivaCodigo,
        })),
        descuento_global: Number(p.descuento) || 0,
        pagos: [{ formaPago, total: null }],
        info_adicional: [],
        avisos,
    };
}

/** Propuesta desde una OT: se factura la proforma aprobada/convertida de esa OT. */
async function propuestaDesdeOrden(ordenId) {
    const { rows } = await pool.query(
        `SELECT id FROM proformas WHERE (orden_generada_id = $1 OR orden_id = $1) AND estado IN ('aprobada','convertida')
         ORDER BY (estado = 'convertida') DESC, id DESC`, [ordenId]);
    if (!rows.length) {
        throw new ErrorNegocio(409, 'Esta orden de trabajo no tiene una proforma aprobada. La factura se arma con los conceptos aprobados en su proforma: créela o apruébela primero.');
    }
    const propuesta = await propuestaDesdeProforma(rows[0].id);
    if (rows.length > 1) propuesta.avisos.push(`La orden tiene ${rows.length} proformas aprobadas; se usó la más reciente. Las demás se facturan por separado.`);
    return propuesta;
}

function compradorDesdeCliente(c) {
    const identificacion = String(c.identificacion || '').trim();
    const tipo = c.tipo || tipoSugerido(identificacion) || '05';
    return {
        cliente_id: c.cliente_id || null,
        tipo_identificacion: tipo,
        identificacion,
        razon_social: c.nombre || '',
        direccion: c.direccion || '',
        email: c.email || '',
        telefono: c.telefono || '',
        confirmada: Boolean(c.confirmada_at),
        validacion: identificacion ? validarIdentificacion(tipo, identificacion) : null,
    };
}

async function formaPagoSugerida(cuentaId) {
    if (!cuentaId) return '01';
    const { rows } = await pool.query(
        `SELECT metodo_pago, tarjeta_tipo FROM pagos_cliente WHERE cuenta_id = $1 AND anulado_at IS NULL ORDER BY monto DESC LIMIT 1`, [cuentaId]);
    if (!rows[0]) return '01';
    if (rows[0].metodo_pago === 'tarjeta' && FORMA_PAGO_POR_TARJETA[rows[0].tarjeta_tipo]) return FORMA_PAGO_POR_TARJETA[rows[0].tarjeta_tipo];
    return FORMA_PAGO_POR_METODO[rows[0].metodo_pago] || '01';
}

async function facturaActivaDeProforma(proformaId, ambiente, db = pool) {
    const { rows } = await db.query(
        `SELECT id, estado, establecimiento, punto_emision, secuencial FROM comprobantes_electronicos
         WHERE proforma_id = $1 AND cod_doc = '01' AND ambiente = $2 AND estado NOT IN ('descartado','anulado') LIMIT 1`,
        [proformaId, ambiente]);
    if (!rows[0]) return null;
    const r = rows[0];
    return { id: r.id, estado: r.estado, numero: r.secuencial ? `${r.establecimiento}-${r.punto_emision}-${r.secuencial}` : null };
}

// ───────────────────────────── Validación de datos de entrada ─────────────────────────────

const texto = (v, max) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

/** Valida y normaliza el comprador. Lanza ErrorNegocio con mensajes claros. */
function validarComprador(entrada, importeTotal, codDoc) {
    const tipo = String(entrada?.tipo_identificacion || '');
    if (!TIPOS_IDENTIFICACION[tipo]) throw new ErrorNegocio(400, 'Seleccione el tipo de identificación del comprador.');
    if (tipo === '07') {
        if (codDoc !== '01') throw new ErrorNegocio(400, 'Las notas de crédito exigen identificar al comprador (no se permite consumidor final).');
        if (importeTotal > LIMITE_CONSUMIDOR_FINAL) {
            throw new ErrorNegocio(400, `Por encima de USD ${LIMITE_CONSUMIDOR_FINAL} hay que identificar al comprador (no se permite consumidor final).`);
        }
        return { ...CONSUMIDOR_FINAL, tipo_identificacion: '07', razon_social: CONSUMIDOR_FINAL.razonSocial, direccion: null,
            email: texto(entrada.email, 300) || null, telefono: texto(entrada.telefono, 50) || null, advertencias: [] };
    }
    const v = validarIdentificacion(tipo, entrada.identificacion);
    if (!v.valido) throw new ErrorNegocio(400, v.errores.join(' '));
    const razon = texto(entrada.razon_social, 300);
    if (razon.length < 2) throw new ErrorNegocio(400, 'Ingrese la razón social o los nombres y apellidos del comprador.');
    return {
        tipo_identificacion: tipo, identificacion: v.normalizada, razon_social: razon,
        direccion: texto(entrada.direccion, 300) || null, email: texto(entrada.email, 300) || null,
        telefono: texto(entrada.telefono, 50) || null, advertencias: v.advertencias,
    };
}

function validarPagos(pagos, importeTotal) {
    const lista = (Array.isArray(pagos) ? pagos : []).filter(Boolean).slice(0, 10).map(p => ({
        formaPago: String(p.formaPago || p.forma_pago || ''),
        total: p.total == null || p.total === '' ? null : r2(p.total),
        plazo: p.plazo ? Number(p.plazo) : null,
        unidadTiempo: p.plazo ? (texto(p.unidadTiempo || p.unidad_tiempo, 10) || 'dias') : null,
    }));
    if (!lista.length) lista.push({ formaPago: '01', total: null, plazo: null, unidadTiempo: null });
    for (const p of lista) if (!FORMAS_PAGO[p.formaPago]) throw new ErrorNegocio(400, `Forma de pago no válida: ${p.formaPago}.`);
    // Un solo pago sin monto = el total de la factura.
    if (lista.length === 1 && lista[0].total == null) lista[0].total = importeTotal;
    if (lista.some(p => p.total == null || !(p.total > 0))) throw new ErrorNegocio(400, 'Indique el valor de cada forma de pago.');
    const suma = r2(lista.reduce((s, p) => s + p.total, 0));
    if (Math.abs(suma - importeTotal) > 0.009) {
        throw new ErrorNegocio(400, `La suma de las formas de pago ($${suma.toFixed(2)}) debe ser igual al total ($${importeTotal.toFixed(2)}).`);
    }
    return lista;
}

function validarInfoAdicional(lista) {
    return (Array.isArray(lista) ? lista : []).filter(x => x && texto(x.nombre, 300) && texto(x.valor, 300))
        .map(x => ({ nombre: texto(x.nombre, 300), valor: texto(x.valor, 300) }));
}

/** infoAdicional final: la del usuario + datos de contacto, OT, vehículo y Anexo 26. Máximo 15. */
function infoAdicionalFinal(entrada, { comprador, origen, vehiculo, config }) {
    const lista = [];
    const agregar = (nombre, valor) => {
        if (!valor || lista.some(x => x.nombre.toLowerCase() === nombre.toLowerCase())) return;
        lista.push({ nombre, valor: texto(valor, 300) });
    };
    for (const x of validarInfoAdicional(entrada)) agregar(x.nombre, x.valor);
    agregar('Email', comprador.email);
    agregar('Teléfono', comprador.telefono);
    if (origen?.orden_numero) agregar('Orden de trabajo', origen.orden_numero);
    if (origen?.proforma_numero) agregar('Proforma', origen.proforma_numero);
    if (vehiculo?.placa) agregar('Placa', vehiculo.placa);
    if (vehiculo && (vehiculo.marca || vehiculo.modelo)) agregar('Vehículo', [vehiculo.marca, vehiculo.modelo, vehiculo.anio].filter(Boolean).join(' '));
    // Anexo 26: solo si la empresa usa un sistema de facturación de terceros.
    if (config?.ruc_proveedor_sistema) agregar('RUC Proveedor', config.ruc_proveedor_sistema);
    return lista.slice(0, 15);
}

// ───────────────────────────── Borradores ─────────────────────────────

/**
 * Crea (o actualiza) un borrador de factura. `datos`:
 *   { proforma_id?, orden_id?, cliente_id?, comprador, lineas, descuento_global, pagos, info_adicional, punto_emision_id, vehiculo }
 * Las líneas se recalculan SIEMPRE aquí (nunca se confía en totales del navegador).
 */
async function guardarBorradorFactura(datos, usuario, { id = null, idempotencyKey = null } = {}) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const config = await obtenerConfig(client);
        if (!config) throw new ErrorNegocio(409, 'Primero registre la configuración tributaria del emisor (Facturación › Configuración).');
        const ambiente = Number(config.ambiente);

        let actual = null;
        if (id) {
            const { rows } = await client.query('SELECT * FROM comprobantes_electronicos WHERE id = $1 FOR UPDATE', [id]);
            actual = rows[0];
            if (!actual) throw new ErrorNegocio(404, 'Comprobante no encontrado.');
            if (actual.cod_doc !== '01') throw new ErrorNegocio(400, 'Este comprobante no es una factura.');
            if (!ESTADOS_EDITABLES.includes(actual.estado)) throw new ErrorNegocio(409, `Un comprobante en estado "${actual.estado}" no se puede editar.`);
        } else if (idempotencyKey) {
            const { rows } = await client.query('SELECT id FROM comprobantes_electronicos WHERE idempotency_key = $1', [idempotencyKey]);
            if (rows[0]) { await client.query('ROLLBACK'); return obtenerComprobante(rows[0].id); }
        }

        // Punto de emisión (fijo una vez emitido: la clave lo incluye).
        const puntoId = actual?.secuencial ? actual.punto_emision_id : Number(datos.punto_emision_id);
        const { rows: pr } = await client.query('SELECT * FROM sri_puntos_emision WHERE id = $1 AND activo', [puntoId]);
        const punto = pr[0];
        if (!punto) throw new ErrorNegocio(400, 'Seleccione un punto de emisión activo.');

        // Origen: proforma (opcional). Se valida en la BD, no se confía en el navegador.
        let origen = null;
        let vehiculo = null;
        const proformaId = actual ? actual.proforma_id : (datos.proforma_id ? Number(datos.proforma_id) : null);
        if (proformaId) {
            const { rows } = await client.query(
                `SELECT id, numero, estado, cliente_id, orden_id, orden_generada_id, vehiculo_placa, vehiculo_marca, vehiculo_modelo,
                        vehiculo_anio, vehiculo_color, vehiculo_vin FROM proformas WHERE id = $1`, [proformaId]);
            const p = rows[0];
            if (!p) throw new ErrorNegocio(404, 'Proforma no encontrada.');
            if (!actual && !['aprobada', 'convertida'].includes(p.estado)) throw new ErrorNegocio(409, 'Solo se facturan proformas aprobadas o convertidas.');
            const ordenId = p.orden_generada_id || p.orden_id || null;
            origen = { proforma_id: p.id, proforma_numero: p.numero, orden_id: ordenId, orden_numero: formatoOrden(ordenId) };
            vehiculo = p.vehiculo_placa || p.vehiculo_marca ? { placa: p.vehiculo_placa, marca: p.vehiculo_marca, modelo: p.vehiculo_modelo,
                anio: p.vehiculo_anio, color: p.vehiculo_color, vin: p.vehiculo_vin } : null;
            if (!actual) {
                const existe = await facturaActivaDeProforma(p.id, ambiente, client);
                if (existe) throw new ErrorNegocio(409, `Esta proforma ya tiene una factura (${existe.numero || 'borrador'}, ${existe.estado}). No se factura dos veces.`);
            }
            // Las líneas ligadas a la proforma deben pertenecer a ESA proforma.
            const ids = (datos.lineas || []).map(l => l.proforma_item_id).filter(Boolean).map(Number);
            if (ids.length) {
                const { rows: own } = await client.query('SELECT id FROM proforma_items WHERE proforma_id = $1 AND id = ANY($2::int[])', [p.id, ids]);
                if (own.length !== new Set(ids).size) throw new ErrorNegocio(400, 'Alguna línea no pertenece a la proforma de origen.');
            }
        }

        const lineas = (datos.lineas || []).map(l => ({
            codigo: texto(l.codigo, 25) || null,
            descripcion: texto(l.descripcion, 300),
            cantidad: Number(l.cantidad),
            precio_unitario: Number(l.precio_unitario),
            descuento: Number(l.descuento || 0),
            iva_codigo: String(l.iva_codigo ?? ''),
            proforma_item_id: proformaId && l.proforma_item_id ? Number(l.proforma_item_id) : null,
            detalles_adicionales: validarInfoAdicional(l.detalles_adicionales).slice(0, 3),
        }));
        if (lineas.some(l => !l.descripcion)) throw new ErrorNegocio(400, 'Cada línea necesita una descripción.');
        if (lineas.some(l => TARIFAS_IVA[l.iva_codigo] && !TARIFAS_IVA[l.iva_codigo].vigente)) {
            throw new ErrorNegocio(400, 'Alguna línea usa una tarifa de IVA que ya no está vigente.');
        }
        let calc;
        try {
            calc = calcularComprobante(lineas, { descuentoGlobal: datos.descuento_global || 0 });
        } catch (err) {
            if (err instanceof ErrorCalculo) throw new ErrorNegocio(400, err.message);
            throw err;
        }
        if (!(calc.importeTotal > 0)) throw new ErrorNegocio(400, 'El total de la factura debe ser mayor a 0.');

        const comprador = validarComprador(datos.comprador, calc.importeTotal, '01');
        const clienteId = actual ? actual.cliente_id : (datos.comprador?.cliente_id ? Number(datos.comprador.cliente_id) : null);
        const pagos = validarPagos(datos.pagos, calc.importeTotal);
        const info = infoAdicionalFinal(datos.info_adicional, { comprador, origen, vehiculo, config });

        const cuenta = origen ? await buscarPagareActivo(client, { proformaId: origen.proforma_id, ordenId: origen.orden_id }) : null;
        const valores = [
            punto.id, punto.establecimiento, punto.punto_emision, clienteId,
            comprador.tipo_identificacion, comprador.identificacion, comprador.razon_social, comprador.direccion,
            comprador.email, comprador.telefono, vehiculo ? JSON.stringify(vehiculo) : null,
            origen?.proforma_id || null, origen?.orden_id || null, cuenta?.id || null,
            calc.totalSinImpuestos, calc.totalDescuento, calc.totalIva, calc.propina, calc.importeTotal,
            JSON.stringify(calc.impuestos), JSON.stringify(pagos), JSON.stringify(info),
        ];
        let comprobanteId;
        if (actual) {
            await client.query(
                `UPDATE comprobantes_electronicos SET punto_emision_id=$1, establecimiento=$2, punto_emision=$3, cliente_id=$4,
                    comprador_tipo_identificacion=$5, comprador_identificacion=$6, comprador_razon_social=$7, comprador_direccion=$8,
                    comprador_email=$9, comprador_telefono=$10, vehiculo=$11, proforma_id=$12, orden_id=$13, cuenta_cobrar_id=$14,
                    total_sin_impuestos=$15, total_descuento=$16, total_iva=$17, propina=$18, importe_total=$19,
                    totales_impuestos=$20, pagos=$21, info_adicional=$22
                 WHERE id = $23`, [...valores, actual.id]);
            comprobanteId = actual.id;
            await client.query('DELETE FROM comprobante_detalles WHERE comprobante_id = $1', [comprobanteId]);
            await registrarEvento(client, comprobanteId, { usuarioId: usuario.id, tipo: 'editado', anterior: actual.estado, nuevo: actual.estado,
                detalle: { importe_total: calc.importeTotal } });
        } else {
            const { rows } = await client.query(
                `INSERT INTO comprobantes_electronicos
                    (cod_doc, ambiente, estado, punto_emision_id, establecimiento, punto_emision, cliente_id,
                     comprador_tipo_identificacion, comprador_identificacion, comprador_razon_social, comprador_direccion,
                     comprador_email, comprador_telefono, vehiculo, proforma_id, orden_id, cuenta_cobrar_id,
                     total_sin_impuestos, total_descuento, total_iva, propina, importe_total,
                     totales_impuestos, pagos, info_adicional, idempotency_key, creado_por)
                 VALUES ('01',$23,'borrador',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$24,$25)
                 RETURNING id`, [...valores, ambiente, idempotencyKey, usuario.id]);
            comprobanteId = rows[0].id;
            await registrarEvento(client, comprobanteId, { usuarioId: usuario.id, tipo: 'borrador_creado', nuevo: 'borrador',
                detalle: { proforma_id: origen?.proforma_id || null, importe_total: calc.importeTotal } });
        }
        await insertarDetalles(client, comprobanteId, calc.lineas);
        await client.query('COMMIT');
        const resultado = await obtenerComprobante(comprobanteId);
        resultado.advertencias = comprador.advertencias;
        return resultado;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

async function insertarDetalles(client, comprobanteId, lineas) {
    for (const l of lineas) {
        await client.query(
            `INSERT INTO comprobante_detalles (comprobante_id, linea, codigo_principal, descripcion, cantidad, precio_unitario,
                descuento, precio_total_sin_impuesto, iva_codigo, iva_tarifa, iva_base, iva_valor, proforma_item_id, detalles_adicionales)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
            [comprobanteId, l.linea, l.codigo, l.descripcion, l.cantidad, l.precio_unitario, l.descuento,
             l.precio_total_sin_impuesto, l.iva_codigo, l.iva_tarifa, l.iva_base, l.iva_valor, l.proforma_item_id,
             l.detalles_adicionales && l.detalles_adicionales.length ? JSON.stringify(l.detalles_adicionales) : null]);
    }
}

/** Borrador de NOTA DE CRÉDITO sobre una factura AUTORIZADA (devolución o corrección de valores). */
async function guardarBorradorNotaCredito({ factura_id, motivo, lineas, punto_emision_id }, usuario, { id = null } = {}) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let actual = null;
        let facturaId = Number(factura_id);
        if (id) {
            const { rows } = await client.query('SELECT * FROM comprobantes_electronicos WHERE id = $1 FOR UPDATE', [id]);
            actual = rows[0];
            if (!actual || actual.cod_doc !== '04') throw new ErrorNegocio(404, 'Nota de crédito no encontrada.');
            if (!ESTADOS_EDITABLES.includes(actual.estado)) throw new ErrorNegocio(409, `Una nota de crédito en estado "${actual.estado}" no se puede editar.`);
            facturaId = actual.comprobante_modificado_id;
        }
        const { rows: fr } = await client.query('SELECT * FROM comprobantes_electronicos WHERE id = $1', [facturaId]);
        const factura = fr[0];
        if (!factura || factura.cod_doc !== '01') throw new ErrorNegocio(404, 'Factura no encontrada.');
        if (factura.estado !== 'autorizado') throw new ErrorNegocio(409, 'Solo se emite una nota de crédito sobre una factura AUTORIZADA por el SRI.');
        if (factura.comprador_tipo_identificacion === '07') throw new ErrorNegocio(409, 'Una factura a consumidor final no admite nota de crédito (el SRI exige identificar al comprador).');
        const motivoTxt = texto(motivo, 300);
        if (motivoTxt.length < 5) throw new ErrorNegocio(400, 'Indique el motivo de la nota de crédito.');

        const { rows: det } = await client.query('SELECT * FROM comprobante_detalles WHERE comprobante_id = $1 ORDER BY linea', [facturaId]);
        const lineasNc = (Array.isArray(lineas) && lineas.length ? lineas : det.map(d => ({ ...d, iva_codigo: d.iva_codigo, codigo: d.codigo_principal })))
            .map(l => ({
                codigo: texto(l.codigo ?? l.codigo_principal, 25) || null, descripcion: texto(l.descripcion, 300),
                cantidad: Number(l.cantidad), precio_unitario: Number(l.precio_unitario), descuento: Number(l.descuento || 0),
                iva_codigo: String(l.iva_codigo),
            }));
        // Las tarifas deben existir en la factura original.
        const tarifasFactura = new Set(det.map(d => d.iva_codigo));
        if (lineasNc.some(l => !tarifasFactura.has(l.iva_codigo))) throw new ErrorNegocio(400, 'La nota de crédito solo puede usar las tarifas de IVA de la factura original.');
        let calc;
        try { calc = calcularComprobante(lineasNc); } catch (err) {
            if (err instanceof ErrorCalculo) throw new ErrorNegocio(400, err.message);
            throw err;
        }
        // No se puede devolver más de lo facturado (sumando otras NC no anuladas/descartadas).
        const { rows: otras } = await client.query(
            `SELECT COALESCE(SUM(importe_total),0) AS total FROM comprobantes_electronicos
             WHERE comprobante_modificado_id = $1 AND cod_doc = '04' AND estado NOT IN ('descartado','anulado') AND id <> COALESCE($2, 0)`,
            [facturaId, actual?.id || null]);
        const disponible = r2(Number(factura.importe_total) - Number(otras[0].total));
        if (calc.importeTotal > disponible + 0.001) {
            throw new ErrorNegocio(400, `La nota de crédito ($${calc.importeTotal.toFixed(2)}) supera el saldo de la factura que aún se puede acreditar ($${disponible.toFixed(2)}).`);
        }
        const puntoId = actual?.secuencial ? actual.punto_emision_id : Number(punto_emision_id || factura.punto_emision_id);
        const { rows: pr } = await client.query('SELECT * FROM sri_puntos_emision WHERE id = $1 AND activo', [puntoId]);
        if (!pr[0]) throw new ErrorNegocio(400, 'Seleccione un punto de emisión activo.');
        const punto = pr[0];
        const info = (factura.info_adicional || []).filter(x => ['Email', 'Teléfono', 'RUC Proveedor'].includes(x.nombre));

        let comprobanteId;
        const valores = [punto.id, punto.establecimiento, punto.punto_emision, calc.totalSinImpuestos, calc.totalDescuento, calc.totalIva,
            calc.importeTotal, JSON.stringify(calc.impuestos), JSON.stringify(info), motivoTxt];
        if (actual) {
            await client.query(
                `UPDATE comprobantes_electronicos SET punto_emision_id=$1, establecimiento=$2, punto_emision=$3, total_sin_impuestos=$4,
                    total_descuento=$5, total_iva=$6, importe_total=$7, totales_impuestos=$8, info_adicional=$9, motivo_nc=$10 WHERE id=$11`,
                [...valores, actual.id]);
            comprobanteId = actual.id;
            await client.query('DELETE FROM comprobante_detalles WHERE comprobante_id = $1', [comprobanteId]);
        } else {
            const { rows } = await client.query(
                `INSERT INTO comprobantes_electronicos
                    (cod_doc, ambiente, estado, punto_emision_id, establecimiento, punto_emision, total_sin_impuestos, total_descuento,
                     total_iva, importe_total, totales_impuestos, info_adicional, motivo_nc, comprobante_modificado_id, cliente_id,
                     comprador_tipo_identificacion, comprador_identificacion, comprador_razon_social, comprador_direccion, comprador_email,
                     comprador_telefono, vehiculo, proforma_id, orden_id, cuenta_cobrar_id, creado_por)
                 SELECT '04', f.ambiente, 'borrador', $1,$2,$3,$4,$5,$6,$7,$8,$9,$10, f.id, f.cliente_id,
                        f.comprador_tipo_identificacion, f.comprador_identificacion, f.comprador_razon_social, f.comprador_direccion,
                        f.comprador_email, f.comprador_telefono, f.vehiculo, f.proforma_id, f.orden_id, f.cuenta_cobrar_id, $12
                 FROM comprobantes_electronicos f WHERE f.id = $11 RETURNING id`, [...valores, facturaId, usuario.id]);
            comprobanteId = rows[0].id;
            await registrarEvento(client, comprobanteId, { usuarioId: usuario.id, tipo: 'borrador_creado', nuevo: 'borrador',
                detalle: { factura_id: facturaId, importe_total: calc.importeTotal } });
        }
        await insertarDetalles(client, comprobanteId, calc.lineas);
        await client.query('COMMIT');
        return obtenerComprobante(comprobanteId);
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
}

async function descartarBorrador(id, usuario) {
    const { rows } = await pool.query(
        `UPDATE comprobantes_electronicos SET estado = 'descartado' WHERE id = $1 AND estado = 'borrador' AND secuencial IS NULL RETURNING id`, [id]);
    if (!rows[0]) throw new ErrorNegocio(409, 'Solo se descartan borradores que todavía no se emitieron.');
    await registrarEvento(pool, id, { usuarioId: usuario.id, tipo: 'descartado', anterior: 'borrador', nuevo: 'descartado' });
    return obtenerComprobante(id);
}

// ───────────────────────────── Emisión (numerar, construir, validar, firmar) ─────────────────────────────

function datosParaXml(c, detalles, sustento = null) {
    return {
        codDoc: c.cod_doc, ambiente: c.ambiente, claveAcceso: c.clave_acceso, establecimiento: c.establecimiento,
        puntoEmision: c.punto_emision, secuencial: c.secuencial, fechaEmision: fechaIso(c.fecha_emision),
        emisor: c.emisor,
        comprador: { tipoIdentificacion: c.comprador_tipo_identificacion, razonSocial: c.comprador_razon_social,
            identificacion: c.comprador_identificacion, direccion: c.comprador_direccion },
        lineas: detalles.map(d => ({
            codigo: d.codigo_principal, descripcion: d.descripcion, cantidad: Number(d.cantidad), precio_unitario: Number(d.precio_unitario),
            descuento: Number(d.descuento), precio_total_sin_impuesto: Number(d.precio_total_sin_impuesto), iva_codigo: d.iva_codigo,
            iva_tarifa: Number(d.iva_tarifa), iva_base: Number(d.iva_base), iva_valor: Number(d.iva_valor),
            detalles_adicionales: d.detalles_adicionales || [],
        })),
        totalSinImpuestos: Number(c.total_sin_impuestos), totalDescuento: Number(c.total_descuento),
        impuestos: c.totales_impuestos, propina: Number(c.propina), importeTotal: Number(c.importe_total),
        pagos: c.pagos, infoAdicional: c.info_adicional, motivo: c.motivo_nc, sustento,
    };
}

/**
 * Emite: asigna número y clave (si aún no tiene), arma el XML, lo valida contra
 * el XSD oficial, lo firma y verifica la firma. Todo en UNA transacción: si
 * algo falla, el número no se consume y el comprobante sigue editable.
 * Después intenta el envío al SRI (fuera de la transacción).
 */
async function emitir(id, usuario, { confirmarComprador = false, enviarAhora = true } = {}) {
    const client = await pool.connect();
    let comprobante;
    try {
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT * FROM comprobantes_electronicos WHERE id = $1 FOR UPDATE', [id]);
        const c = rows[0];
        if (!c) throw new ErrorNegocio(404, 'Comprobante no encontrado.');
        if (!ESTADOS_EDITABLES.includes(c.estado)) throw new ErrorNegocio(409, `El comprobante está "${c.estado}"; no se puede emitir de nuevo.`);
        if (c.comprador_tipo_identificacion !== '07' && !confirmarComprador) {
            throw new ErrorNegocio(400, 'Confirme que la identificación y la razón social del comprador son correctas antes de emitir.', { codigo: 'CONFIRMAR_COMPRADOR' });
        }
        const config = await obtenerConfig(client);
        const puntos = await obtenerPuntos(client);
        const faltan = faltantesConfig(config, puntos);
        if (faltan.length) throw new ErrorNegocio(409, 'La facturación electrónica aún no está lista.', { faltantes: faltan });
        if (Number(c.ambiente) === 2 && !config.produccion_habilitada_at) throw new ErrorNegocio(409, 'El ambiente de producción no está habilitado.');
        if (c.cod_doc === '01' && Number(c.ambiente) !== Number(config.ambiente) && c.estado === 'borrador' && !c.secuencial) {
            // El ambiente cambió desde que se creó el borrador: la factura se emite en el ambiente vigente.
            // (Una nota de crédito va siempre en el ambiente de su factura.)
            await client.query('UPDATE comprobantes_electronicos SET ambiente = $1 WHERE id = $2', [config.ambiente, c.id]);
            c.ambiente = config.ambiente;
        }
        const { rows: pr } = await client.query('SELECT * FROM sri_puntos_emision WHERE id = $1', [c.punto_emision_id]);
        const punto = pr[0];
        if (!punto || (!punto.activo && !c.secuencial)) throw new ErrorNegocio(409, 'El punto de emisión no está activo.');

        let sustento = null;
        if (c.cod_doc === '04') {
            const { rows: fr } = await client.query('SELECT * FROM comprobantes_electronicos WHERE id = $1', [c.comprobante_modificado_id]);
            const f = fr[0];
            if (!f || f.estado !== 'autorizado') throw new ErrorNegocio(409, 'La factura que modifica esta nota de crédito ya no está autorizada.');
            sustento = { codDoc: '01', numero: `${f.establecimiento}-${f.punto_emision}-${f.secuencial}`,
                fechaEmision: fechaIso(f.fecha_emision) };
        }

        // Número y clave: solo la primera vez (luego son fijos y se reutilizan al corregir).
        if (!c.secuencial) {
            const contador = `sri:${c.ambiente}:${c.cod_doc}:${punto.establecimiento}-${punto.punto_emision}`;
            const n = await siguienteNumero(client, contador);
            if (n > 999999999) throw new ErrorNegocio(409, 'Se agotó la numeración de este punto de emisión.');
            c.secuencial = String(n).padStart(9, '0');
            c.fecha_emision = hoyEcuador();
            c.clave_acceso = generarClaveAcceso({ fechaEmision: c.fecha_emision, codDoc: c.cod_doc, ruc: config.ruc, ambiente: c.ambiente,
                establecimiento: punto.establecimiento, puntoEmision: punto.punto_emision, secuencial: c.secuencial });
        }
        c.emisor = emisorSnapshot(config, punto);
        // Logo de la empresa al emitir (solo para el RIDE; el XML no lo usa).
        const { rows: empLogo } = await client.query('SELECT logo_archivo FROM empresas WHERE id = $1', [c.empresa_id]);
        c.emisor.logoArchivo = empLogo[0]?.logo_archivo || null;

        const { rows: detalles } = await client.query('SELECT * FROM comprobante_detalles WHERE comprobante_id = $1 ORDER BY linea', [c.id]);
        const xml = construirXml(datosParaXml(c, detalles, sustento));
        const xsd = await validarXsd(xml, c.cod_doc);
        if (!xsd.valido) throw new ErrorNegocio(422, 'El comprobante no cumple el esquema oficial del SRI. Revise los datos.', { errores_xsd: xsd.errores });

        const { rows: cr } = await client.query('SELECT certificado_cifrado, certificado_clave_cifrada FROM sri_configuracion LIMIT 1');
        let firmado;
        try {
            const p12 = descifrar(cr[0].certificado_cifrado);
            const clave = descifrar(cr[0].certificado_clave_cifrada).toString('utf8');
            firmado = firmarComprobante(xml, p12, clave);
        } catch (err) {
            if (err instanceof ErrorFirma || err instanceof ErrorCustodia) throw new ErrorNegocio(409, err.message);
            throw err;
        }
        const verif = verificarFirma(firmado);
        if (!verif.valida) throw new ErrorNegocio(500, `La firma generada no se pudo verificar (${verif.motivo}). No se envió nada al SRI.`);

        const anterior = c.estado;
        await client.query(
            `UPDATE comprobantes_electronicos SET secuencial=$1, clave_acceso=$2, fecha_emision=$3, emisor=$4, xml_firmado=$5,
                estado='firmado', emitido_por=COALESCE(emitido_por,$6), emitido_at=COALESCE(emitido_at,NOW()),
                ultimo_mensaje=NULL, proximo_intento=NOW(), ambiente=$7
             WHERE id=$8`,
            [c.secuencial, c.clave_acceso, c.fecha_emision, JSON.stringify(c.emisor), firmado, usuario.id, c.ambiente, c.id]);
        // Confirmación de los datos del comprador (por una persona autorizada).
        if (c.cliente_id && confirmarComprador) {
            await client.query(
                `UPDATE clientes SET tipo_identificacion = $1, identificacion_confirmada_at = NOW(), identificacion_confirmada_por = $2
                 WHERE id = $3 AND (cedula = $4 OR cedula IS NULL)`,
                [c.comprador_tipo_identificacion, usuario.id, c.cliente_id, c.comprador_identificacion]);
        }
        await registrarEvento(client, c.id, { usuarioId: usuario.id, tipo: 'firmado', anterior, nuevo: 'firmado',
            detalle: { numero: `${c.establecimiento}-${c.punto_emision}-${c.secuencial}`, clave_acceso: c.clave_acceso, ambiente: c.ambiente } });
        await client.query('COMMIT');
        comprobante = c;
    } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw err;
    } finally {
        client.release();
    }
    if (enviarAhora) await procesar(comprobante.id, { usuarioId: usuario.id });
    return obtenerComprobante(comprobante.id);
}

// ───────────────────────────── Envío y autorización ─────────────────────────────

/** Toma el candado del comprobante (null si otro proceso lo está atendiendo). */
async function tomarCandado(id) {
    const { rows } = await pool.query(
        `UPDATE comprobantes_electronicos SET procesando_hasta = NOW() + ($2 || ' seconds')::interval
         WHERE id = $1 AND (procesando_hasta IS NULL OR procesando_hasta < NOW()) RETURNING *`, [id, String(CANDADO_SEG)]);
    return rows[0] || null;
}
const soltarCandado = (id) => pool.query('UPDATE comprobantes_electronicos SET procesando_hasta = NULL WHERE id = $1', [id]);

async function cambiarEstado(c, nuevo, campos = {}, evento = {}) {
    const sets = ['estado = $2'];
    const vals = [c.id, nuevo];
    for (const [k, v] of Object.entries(campos)) { vals.push(v); sets.push(`${k} = $${vals.length}`); }
    await pool.query(`UPDATE comprobantes_electronicos SET ${sets.join(', ')} WHERE id = $1`, vals);
    await registrarEvento(pool, c.id, { anterior: c.estado, nuevo, ...evento });
    c.estado = nuevo;
}

/** Espera creciente entre reintentos: 1, 2, 5, 10, 30 minutos y luego cada hora. */
function siguienteIntento(intentos) {
    const minutos = [1, 2, 5, 10, 30][intentos] ?? 60;
    return new Date(Date.now() + minutos * 60 * 1000);
}

/**
 * Avanza un comprobante en curso un paso (enviar o consultar), según su estado.
 * Se puede llamar muchas veces sin efectos duplicados.
 */
async function procesar(id, { usuarioId = null } = {}) {
    const c = await tomarCandado(id);
    if (!c) return { ocupado: true };
    try {
        if (c.estado === 'firmado') return await enviarARecepcion(c, usuarioId);
        if (c.estado === 'pendiente_reintento') {
            // Resultado incierto del envío anterior: primero preguntar al SRI.
            const r = await consultarAutorizacion(c, usuarioId);
            if (r.sinRegistro) return await enviarARecepcion(c, usuarioId);
            return r;
        }
        if (c.estado === 'recibida' || c.estado === 'en_procesamiento') return await consultarAutorizacion(c, usuarioId);
        if (c.estado === 'anulacion_solicitada') return await verificarAnulacion(c, usuarioId);
        return { sinCambios: true };
    } finally {
        await soltarCandado(id);
    }
}

async function enviarARecepcion(c, usuarioId) {
    const r = await soap.recepcion(c.xml_firmado, Number(c.ambiente));
    const intentos = c.intentos_envio + 1;
    if (!r.ok) {
        await cambiarEstado(c, 'pendiente_reintento', { intentos_envio: intentos, proximo_intento: siguienteIntento(intentos - 1),
            ultimo_mensaje: JSON.stringify({ incierto: true, error: r.error }) },
        { usuarioId, tipo: 'envio_sin_respuesta', detalle: { error: r.error } });
        return { estado: c.estado, mensaje: r.error };
    }
    if (r.estado === 'RECIBIDA') {
        await cambiarEstado(c, 'recibida', { intentos_envio: intentos, ultimo_mensaje: JSON.stringify(r.mensajes) },
            { usuarioId, tipo: 'recibida', detalle: { mensajes: r.mensajes }, respuesta: r.crudo });
        const config = await obtenerConfig();
        await espera(Math.min(Number(config?.espera_autorizacion_seg) || 3, 10) * 1000);
        return consultarAutorizacion(c, usuarioId);
    }
    // DEVUELTA.
    const codigos = r.mensajes.map(m => m.identificador);
    if (codigos.some(cod => CODIGOS_NO_RECHAZO.includes(cod))) {
        // Ya lo tiene el SRI (o lo está procesando): consultar, nunca reemitir.
        await cambiarEstado(c, 'en_procesamiento', { intentos_envio: intentos, proximo_intento: siguienteIntento(0),
            ultimo_mensaje: JSON.stringify(r.mensajes) }, { usuarioId, tipo: 'devuelta_ya_registrado', detalle: { mensajes: r.mensajes }, respuesta: r.crudo });
        return consultarAutorizacion(c, usuarioId);
    }
    await cambiarEstado(c, 'devuelta', { intentos_envio: intentos, proximo_intento: null, ultimo_mensaje: JSON.stringify(r.mensajes) },
        { usuarioId, tipo: 'devuelta', detalle: { mensajes: r.mensajes }, respuesta: r.crudo });
    return { estado: 'devuelta', mensajes: r.mensajes };
}

/** XML "autorizado" para entregar: el sobre <autorizacion> con estado, número, fecha y comprobante. */
function xmlAutorizacion(a) {
    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return '<?xml version="1.0" encoding="UTF-8"?><autorizacion>'
        + `<estado>${esc(a.estado)}</estado><numeroAutorizacion>${esc(a.numeroAutorizacion)}</numeroAutorizacion>`
        + `<fechaAutorizacion>${esc(a.fechaAutorizacion)}</fechaAutorizacion><ambiente>${esc(a.ambiente)}</ambiente>`
        + `<comprobante><![CDATA[${String(a.comprobante || '').replace(/]]>/g, ']]]]><![CDATA[>')}]]></comprobante></autorizacion>`;
}

async function consultarAutorizacion(c, usuarioId) {
    const r = await soap.autorizacion(c.clave_acceso, Number(c.ambiente));
    if (!r.ok) {
        const intentos = c.intentos_envio + 1;
        await pool.query('UPDATE comprobantes_electronicos SET proximo_intento = $2, intentos_envio = $3 WHERE id = $1',
            [c.id, siguienteIntento(Math.min(intentos, 5)), intentos]);
        await registrarEvento(pool, c.id, { usuarioId, tipo: 'consulta_sin_respuesta', detalle: { error: r.error } });
        return { estado: c.estado, mensaje: r.error };
    }
    if (r.estado === 'AUTORIZADO') {
        const a = r.autorizacion;
        await cambiarEstado(c, 'autorizado', {
            numero_autorizacion: a.numeroAutorizacion || c.clave_acceso,
            fecha_autorizacion: a.fechaAutorizacion ? new Date(a.fechaAutorizacion) : new Date(),
            xml_autorizado: xmlAutorizacion(a), proximo_intento: null, ultimo_mensaje: JSON.stringify(a.mensajes || []),
        }, { usuarioId, tipo: 'autorizado', detalle: { numero_autorizacion: a.numeroAutorizacion, mensajes: a.mensajes } });
        // La entrega por correo nunca cambia el estado tributario.
        enviarCorreo(c.id, { automatico: true }).catch(err => console.error('[facturacion] correo:', err.message));
        return { estado: 'autorizado' };
    }
    if (r.estado === 'NO AUTORIZADO' || r.estado === 'RECHAZADO') {
        const mensajes = r.autorizacion?.mensajes || [];
        await cambiarEstado(c, 'no_autorizado', { proximo_intento: null, ultimo_mensaje: JSON.stringify(mensajes) },
            { usuarioId, tipo: 'no_autorizado', detalle: { mensajes } });
        return { estado: 'no_autorizado', mensajes };
    }
    // Sin registro todavía: en procesamiento (hasta 24 h según la ficha).
    const horas = (Date.now() - new Date(c.emitido_at || c.created_at).getTime()) / 3600000;
    if (c.estado === 'pendiente_reintento') return { sinRegistro: true };
    const nuevo = 'en_procesamiento';
    const intentos = c.intentos_envio + 1;
    await cambiarEstado(c, nuevo, { proximo_intento: siguienteIntento(Math.min(intentos, 5)), intentos_envio: intentos,
        ultimo_mensaje: JSON.stringify(horas > MAX_HORAS_PROCESAMIENTO
            ? [{ tipo: 'ADVERTENCIA', mensaje: `El SRI lleva más de ${MAX_HORAS_PROCESAMIENTO} h sin responder. Verifique el comprobante en SRI en Línea.` }]
            : []) },
    { usuarioId, tipo: 'en_procesamiento', detalle: { numero_comprobantes: r.numeroComprobantes } });
    return { estado: nuevo };
}

// ───────────────────────────── Anulación ─────────────────────────────

/**
 * Registra que la anulación se solicitó en SRI en Línea (el SRI no ofrece un
 * servicio web para anular facturas; plazo: 90 días desde la emisión). El
 * estado ANULADO solo se marca cuando la consulta oficial lo confirma.
 */
async function registrarAnulacion(id, usuario, motivo) {
    const motivoTxt = texto(motivo, 300);
    if (motivoTxt.length < 10) throw new ErrorNegocio(400, 'Describa el motivo de la anulación (mínimo 10 caracteres).');
    const c = await obtenerFila(id);
    if (c.estado !== 'autorizado') throw new ErrorNegocio(409, 'Solo se anula un comprobante autorizado.');
    const dias = (Date.now() - new Date(`${fechaIso(c.fecha_emision)}T00:00:00-05:00`).getTime()) / 86400000;
    await cambiarEstado(c, 'anulacion_solicitada', { anulacion_solicitada_at: new Date(), anulacion_solicitada_por: usuario.id,
        anulacion_motivo: motivoTxt, proximo_intento: new Date() },
    { usuarioId: usuario.id, tipo: 'anulacion_solicitada', detalle: { motivo: motivoTxt, dias_desde_emision: Math.floor(dias) } });
    return obtenerComprobante(id);
}

async function verificarAnulacion(c, usuarioId) {
    const r = await soap.consultaEstado(c.clave_acceso, Number(c.ambiente));
    if (!r.ok) {
        await pool.query('UPDATE comprobantes_electronicos SET proximo_intento = $2 WHERE id = $1', [c.id, siguienteIntento(3)]);
        return { estado: c.estado, mensaje: r.error };
    }
    const estadoSri = String(r.estadoAutorizacion || '').toUpperCase();
    if (estadoSri === 'ANULADO') {
        await cambiarEstado(c, 'anulado', { anulado_at: new Date(), proximo_intento: null },
            { usuarioId, tipo: 'anulado', detalle: { estado_sri: estadoSri }, respuesta: r.crudo });
        return { estado: 'anulado' };
    }
    await pool.query('UPDATE comprobantes_electronicos SET proximo_intento = $2, ultimo_mensaje = $3 WHERE id = $1',
        [c.id, siguienteIntento(4), JSON.stringify([{ tipo: 'INFORMATIVO', mensaje: `Estado en el SRI: ${estadoSri || 'sin dato'}` }])]);
    await registrarEvento(pool, c.id, { usuarioId, tipo: 'consulta_anulacion', detalle: { estado_sri: estadoSri } });
    return { estado: c.estado, estadoSri };
}

/** Deshace el registro de anulación (p. ej. se registró por error y en el SRI sigue autorizado). */
async function cancelarAnulacion(id, usuario) {
    const c = await obtenerFila(id);
    if (c.estado !== 'anulacion_solicitada') throw new ErrorNegocio(409, 'Este comprobante no tiene una anulación pendiente.');
    await cambiarEstado(c, 'autorizado', { proximo_intento: null }, { usuarioId: usuario.id, tipo: 'anulacion_cancelada' });
    return obtenerComprobante(id);
}

// ───────────────────────────── Correo, RIDE y XML ─────────────────────────────

async function enviarCorreo(id, { para = null, automatico = false, usuarioId = null } = {}) {
    const c = await obtenerComprobante(id);
    if (!['autorizado', 'anulacion_solicitada'].includes(c.estado)) throw new ErrorNegocio(409, 'Solo se envían comprobantes autorizados.');
    const destino = para || c.comprador_email;
    const pdf = await generarRide(c, { logo: c.logo });
    const nombre = `${c.cod_doc === '04' ? 'NC' : 'FAC'}-${c.establecimiento}-${c.punto_emision}-${c.secuencial}`;
    const r = await enviarComprobante({
        para: destino,
        asunto: `${c.cod_doc === '04' ? 'Nota de crédito' : 'Factura'} electrónica ${c.establecimiento}-${c.punto_emision}-${c.secuencial} — ${c.emisor?.nombreComercial || c.emisor?.razonSocial || ''}`,
        texto: `Estimado(a) ${c.comprador_razon_social}:\n\nAdjuntamos su comprobante electrónico autorizado por el SRI.\n`
            + `Número: ${c.establecimiento}-${c.punto_emision}-${c.secuencial}\nClave de acceso: ${c.clave_acceso}\n`
            + `Valor: $${Number(c.importe_total).toFixed(2)}\n\n`
            + 'Puede verificar su validez en el portal del SRI (Consulta de validez de comprobantes electrónicos).\n'
            + (Number(c.ambiente) === 1 ? '\nIMPORTANTE: comprobante del AMBIENTE DE PRUEBAS, sin validez tributaria.\n' : ''),
        adjuntos: [
            { nombre: `${nombre}.xml`, contenido: Buffer.from(c.xml_autorizado || c.xml_firmado, 'utf8'), tipo: 'application/xml' },
            { nombre: `${nombre}.pdf`, contenido: pdf, tipo: 'application/pdf' },
        ],
    });
    const estadoCorreo = r.enviado ? 'enviado' : (/correo válido|no está configurado/.test(r.motivo || '') ? 'sin_correo' : 'error');
    await pool.query(
        `UPDATE comprobantes_electronicos SET correo_estado = $2::varchar, correo_enviado_at = CASE WHEN $2::varchar = 'enviado' THEN NOW() ELSE correo_enviado_at END,
            correo_destinatarios = $3, correo_error = $4 WHERE id = $1`,
        [id, estadoCorreo, r.para ? r.para.join(', ').slice(0, 500) : null, r.enviado ? null : (r.motivo || '').slice(0, 300)]);
    await registrarEvento(pool, id, { usuarioId, tipo: r.enviado ? 'correo_enviado' : 'correo_no_enviado',
        detalle: { automatico, para: r.para || null, motivo: r.motivo || null } });
    return r;
}

// ───────────────────────────── Consultas ─────────────────────────────

async function obtenerFila(id, db = pool) {
    const { rows } = await db.query('SELECT * FROM comprobantes_electronicos WHERE id = $1', [id]);
    if (!rows[0]) throw new ErrorNegocio(404, 'Comprobante no encontrado.');
    return rows[0];
}

/** Comprobante completo para la API y el RIDE (sin certificados; con detalles, eventos y sustento). */
async function obtenerComprobante(id) {
    const c = await obtenerFila(id);
    const { rows: detalles } = await pool.query('SELECT * FROM comprobante_detalles WHERE comprobante_id = $1 ORDER BY linea', [id]);
    const { rows: eventos } = await pool.query(
        `SELECT e.id, e.created_at, e.tipo, e.estado_anterior, e.estado_nuevo, e.detalle, u.nombre AS usuario_nombre
         FROM comprobante_eventos e LEFT JOIN usuarios u ON u.id = e.usuario_id WHERE e.comprobante_id = $1 ORDER BY e.id`, [id]);
    // Logo de la empresa DUEÑA del comprobante: el que tenía al emitirse o, si no, el actual.
    const { rows: emp } = await pool.query('SELECT logo_archivo FROM empresas WHERE id = $1', [c.empresa_id]);
    let sustento = null;
    if (c.cod_doc === '04' && c.comprobante_modificado_id) {
        const { rows } = await pool.query('SELECT id, establecimiento, punto_emision, secuencial, fecha_emision, importe_total FROM comprobantes_electronicos WHERE id = $1',
            [c.comprobante_modificado_id]);
        if (rows[0]) sustento = { id: rows[0].id, numero: `${rows[0].establecimiento}-${rows[0].punto_emision}-${rows[0].secuencial}`,
            fechaEmision: fechaIso(rows[0].fecha_emision), importe_total: rows[0].importe_total };
    }
    const { rows: nc } = await pool.query(
        `SELECT id, estado, establecimiento, punto_emision, secuencial, importe_total FROM comprobantes_electronicos
         WHERE comprobante_modificado_id = $1 AND cod_doc = '04' ORDER BY id`, [id]);
    return {
        ...c,
        fecha_emision: fechaIso(c.fecha_emision),
        numero: c.secuencial ? `${c.establecimiento}-${c.punto_emision}-${c.secuencial}` : null,
        comprador: { tipo_identificacion: c.comprador_tipo_identificacion, identificacion: c.comprador_identificacion,
            razon_social: c.comprador_razon_social, direccion: c.comprador_direccion, email: c.comprador_email, telefono: c.comprador_telefono },
        detalles: detalles.map(d => ({ ...d, cantidad: Number(d.cantidad), precio_unitario: Number(d.precio_unitario),
            descuento: Number(d.descuento), precio_total_sin_impuesto: Number(d.precio_total_sin_impuesto),
            iva_tarifa: Number(d.iva_tarifa), iva_base: Number(d.iva_base), iva_valor: Number(d.iva_valor),
            detalles_adicionales: d.detalles_adicionales || [] })),
        eventos,
        sustento,
        notas_credito: nc.map(n => ({ ...n, numero: n.secuencial ? `${n.establecimiento}-${n.punto_emision}-${n.secuencial}` : null })),
        logo: rutaLogo(c.emisor?.logoArchivo) || rutaLogo(emp[0]?.logo_archivo),
    };
}


/** Listado con filtros (cliente/RUC/cédula, número, fechas, estado, tipo, ambiente). */
async function listar({ q, estado, cod_doc, ambiente, desde, hasta, page = 1, limit = 20 }) {
    const params = [];
    let where = 'WHERE 1=1';
    if (q) {
        params.push(`%${String(q).trim()}%`);
        where += ` AND (c.comprador_razon_social ILIKE $${params.length} OR c.comprador_identificacion ILIKE $${params.length}
                       OR (c.establecimiento || '-' || c.punto_emision || '-' || COALESCE(c.secuencial,'')) ILIKE $${params.length}
                       OR c.clave_acceso ILIKE $${params.length})`;
    }
    if (estado) { params.push(String(estado)); where += ` AND c.estado = $${params.length}`; }
    if (cod_doc) { params.push(String(cod_doc)); where += ` AND c.cod_doc = $${params.length}`; }
    if (ambiente) { params.push(Number(ambiente)); where += ` AND c.ambiente = $${params.length}`; }
    if (desde) { params.push(desde); where += ` AND c.fecha_emision >= $${params.length}`; }
    if (hasta) { params.push(hasta); where += ` AND c.fecha_emision <= $${params.length}`; }
    const lim = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const off = (Math.max(Number(page) || 1, 1) - 1) * lim;
    const { rows: total } = await pool.query(`SELECT COUNT(*)::int AS n FROM comprobantes_electronicos c ${where}`, params);
    const { rows } = await pool.query(
        `SELECT c.id, c.cod_doc, c.ambiente, c.estado, c.establecimiento, c.punto_emision, c.secuencial, c.clave_acceso,
                c.fecha_emision, c.comprador_razon_social, c.comprador_identificacion, c.importe_total, c.correo_estado,
                c.proforma_id, c.orden_id, c.ultimo_mensaje, c.created_at, p.numero AS proforma_numero
         FROM comprobantes_electronicos c LEFT JOIN proformas p ON p.id = c.proforma_id
         ${where} ORDER BY c.id DESC LIMIT ${lim} OFFSET ${off}`, params);
    return { comprobantes: rows.map(r => ({ ...r, fecha_emision: fechaIso(r.fecha_emision),
        numero: r.secuencial ? `${r.establecimiento}-${r.punto_emision}-${r.secuencial}` : null })), total: total[0].n };
}

/**
 * Resumen para el panel: lo FACTURADO (autorizado, menos notas de crédito)
 * se muestra separado de lo COBRADO (pagos registrados) y del saldo: una
 * factura autorizada no significa que el cliente haya pagado.
 */
async function resumen({ desde, hasta }) {
    const d = desde || hoyEcuador().slice(0, 8) + '01';
    const h = hasta || hoyEcuador();
    const { rows: fac } = await pool.query(
        `SELECT ambiente,
                COALESCE(SUM(importe_total) FILTER (WHERE cod_doc='01' AND estado IN ('autorizado','anulacion_solicitada')),0) AS facturado,
                COALESCE(SUM(importe_total) FILTER (WHERE cod_doc='04' AND estado IN ('autorizado','anulacion_solicitada')),0) AS notas_credito,
                COALESCE(SUM(total_iva) FILTER (WHERE cod_doc='01' AND estado IN ('autorizado','anulacion_solicitada')),0) AS iva,
                COUNT(*) FILTER (WHERE cod_doc='01' AND estado IN ('autorizado','anulacion_solicitada')) AS facturas,
                COUNT(*) FILTER (WHERE estado IN ('firmado','recibida','en_procesamiento','pendiente_reintento')) AS en_curso,
                COUNT(*) FILTER (WHERE estado IN ('devuelta','no_autorizado')) AS con_error,
                COUNT(*) FILTER (WHERE estado = 'borrador') AS borradores
         FROM comprobantes_electronicos WHERE fecha_emision BETWEEN $1 AND $2 GROUP BY ambiente`, [d, h]);
    const { rows: cobros } = await pool.query(
        `SELECT COALESCE(SUM(monto),0) AS cobrado FROM pagos_cliente WHERE anulado_at IS NULL AND fecha BETWEEN $1 AND $2`, [d, h]);
    const { rows: saldo } = await pool.query(
        `SELECT COALESCE(SUM(c.monto_total - c.monto_pagado),0) AS saldo FROM cuentas_cobrar c
         WHERE c.estado <> 'anulado' AND EXISTS (SELECT 1 FROM comprobantes_electronicos f WHERE f.cuenta_cobrar_id = c.id
               AND f.cod_doc = '01' AND f.ambiente = 2 AND f.estado IN ('autorizado','anulacion_solicitada'))`);
    const porAmbiente = Object.fromEntries(fac.map(r => [r.ambiente, {
        facturado: Number(r.facturado), notas_credito: Number(r.notas_credito), neto: r2(Number(r.facturado) - Number(r.notas_credito)),
        iva: Number(r.iva), facturas: Number(r.facturas), en_curso: Number(r.en_curso), con_error: Number(r.con_error), borradores: Number(r.borradores),
    }]));
    return { desde: d, hasta: h, produccion: porAmbiente[2] || null, pruebas: porAmbiente[1] || null,
        cobrado: Number(cobros[0].cobrado), saldo_facturas_produccion: Number(saldo[0].saldo) };
}

// ───────────────────────────── Tarea automática ─────────────────────────────

/**
 * Atiende los comprobantes en curso de TODAS las empresas (cada uno dentro de
 * su empresa). Se ejecuta cada minuto desde server.js.
 */
async function procesarPendientes({ limite = 20 } = {}) {
    const { rows } = await sinAislamiento(() => pool.query(
        `SELECT id, empresa_id FROM comprobantes_electronicos
         WHERE estado IN ('firmado','recibida','en_procesamiento','pendiente_reintento','anulacion_solicitada')
           AND (proximo_intento IS NULL OR proximo_intento <= NOW())
           AND (procesando_hasta IS NULL OR procesando_hasta < NOW())
         ORDER BY proximo_intento NULLS FIRST LIMIT $1`, [limite]));
    let atendidos = 0;
    for (const r of rows) {
        try {
            await conEmpresa(r.empresa_id, () => procesar(r.id));
            atendidos++;
        } catch (err) {
            console.error(`[facturacion] No se pudo procesar el comprobante ${r.id}:`, err.message);
        }
    }
    return atendidos;
}

let temporizador = null;
function iniciarTareaAutomatica() {
    if (temporizador || process.env.SRI_TAREA_AUTOMATICA === 'false') return;
    temporizador = setInterval(() => {
        procesarPendientes().catch(err => console.error('[facturacion] tarea automatica:', err.message));
    }, 60 * 1000);
    temporizador.unref?.();
}

module.exports = {
    ESTADOS_EDITABLES, ESTADOS_EN_CURSO, hoyEcuador,
    obtenerConfig, obtenerPuntos, faltantesConfig,
    propuestaDesdeProforma, propuestaDesdeOrden,
    guardarBorradorFactura, guardarBorradorNotaCredito, descartarBorrador,
    emitir, procesar, registrarAnulacion, cancelarAnulacion, enviarCorreo,
    obtenerComprobante, listar, resumen, procesarPendientes, iniciarTareaAutomatica,
    datosParaXml, validarComprador, validarPagos, registrarEvento,
};
