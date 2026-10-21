/**
 * SS SWAP - Controlador de Compras a Proveedores
 *
 * Una compra puede ser:
 *  - una ORDEN de compra (pedido al proveedor): pendiente -> solicitada ->
 *    en_proceso -> recibida. Al marcarla "recibida" se suman las
 *    existencias de los items vinculados a un producto.
 *  - un COMPROBANTE ya recibido (factura fisica, nota de venta u otro), con
 *    su numero de documento: se registra recibido y suma al inventario en
 *    la misma transaccion (Sprint 26, "Crear compra").
 *  - una factura electronica del SRI: la registra facturasCompra.service
 *    (Sprint 25) con el mismo esquema.
 * El inventario solo se toca si la compra se registra como "inventario";
 * un gasto o un activo fijo no suma existencias.
 * La entrada al inventario reutiliza el bloqueo de fila (`FOR UPDATE`) de
 * inventory.controller.js -> registrarMovimiento.
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { registrarAccionBitacora } = require('../services/ordenesHistorial.service');
const { areasValidas } = require('./inventory.controller');
const {
    TIPOS_DOCUMENTO, TIPOS_REGISTRO, SUSTENTOS, SUSTENTO_POR_REGISTRO, normalizarNumeroDocumento,
} = require('../utils/comprasDocumento');

const ESTADOS = ['pendiente', 'solicitada', 'en_proceso', 'recibida', 'cancelada'];
const FORMAS_PAGO = ['contado', 'credito'];
const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'];
/** Las compras a credito vencen a los 15 dias salvo que se indique otra fecha; se avisa cuando faltan 3 o menos. */
const DIAS_CREDITO = 15;
const DIAS_AVISO   = 3;
const IVA_POR_DEFECTO = 15;

const r2 = (n) => Math.round(Number(n) * 100) / 100;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Columnas calculadas: lo pagado (pagos/abonos confirmados), saldo y dias para el vencimiento. */
const PAGADO_SQL = `(SELECT COALESCE(SUM(m.monto), 0) FROM movimientos_financieros_proveedor m
     WHERE m.compra_id = c.id AND m.tipo IN ('pago','abono') AND m.estado = 'confirmado')`;
const COLS_PAGO = `${PAGADO_SQL} AS pagado,
    GREATEST(c.total - ${PAGADO_SQL}, 0) AS saldo,
    (c.fecha_vencimiento - CURRENT_DATE) AS dias_para_vencer`;

/** Recalcula subtotal/iva/total de una compra a partir de sus items (IVA segun la tarifa de cada item). */
async function recalcularTotales(client, compraId) {
    const { rows } = await client.query(
        `SELECT COALESCE(SUM(subtotal), 0) AS subtotal,
                COALESCE(SUM(ROUND(subtotal * iva_porcentaje / 100, 2)), 0) AS iva
         FROM compras_proveedor_items WHERE compra_id = $1`,
        [compraId]
    );
    const subtotal = r2(rows[0].subtotal);
    const iva   = r2(rows[0].iva);
    const total = r2(subtotal + iva);
    await client.query('UPDATE compras_proveedor SET subtotal=$1, iva=$2, total=$3 WHERE id=$4', [subtotal, iva, total, compraId]);
    return { subtotal, iva, total };
}

/**
 * Suma al inventario los items recibidos de una compra (dentro de la
 * transaccion del llamador). Una compra registrada como gasto o activo fijo
 * no toca el inventario. Devuelve el detalle por item.
 */
async function recibirItems(client, compra, usuarioId) {
    if (compra.tipo_registro && compra.tipo_registro !== 'inventario') return [];
    const resultado = [];
    // Orden fijo por producto: evita bloqueos cruzados entre dos recepciones simultaneas.
    const { rows: items } = await client.query(
        'SELECT * FROM compras_proveedor_items WHERE compra_id = $1 AND repuesto_id IS NOT NULL AND cantidad_recibida > 0 ORDER BY repuesto_id, id',
        [compra.id]
    );
    const referencia = compra.numero_documento ? `${compra.tipo_documento === 'nota_venta' ? 'NV' : 'DOC'}-${compra.numero_documento}` : `COMPRA-${compra.id}`;
    for (const item of items) {
        // Mismo bloqueo de fila que inventory.controller.js -> registrarMovimiento
        const { rows: repRows } = await client.query(
            'SELECT id, nombre, stock_actual, area FROM repuestos WHERE id=$1 AND activo=TRUE FOR UPDATE',
            [item.repuesto_id]
        );
        const repuesto = repRows[0];
        if (!repuesto) {
            // El repuesto pudo haberse desactivado despues de crear la compra: se
            // omite ese item y se deja constancia en la respuesta.
            resultado.push({ item_id: item.id, repuesto_id: item.repuesto_id, omitido: true, razon: 'Repuesto no encontrado o inactivo.' });
            continue;
        }
        // Desde el Sprint 14 el stock es NUMERIC (pg lo devuelve como string).
        const stockAnterior = Number(repuesto.stock_actual);
        const stockNuevo    = r2(stockAnterior + Number(item.cantidad_recibida));
        await client.query('UPDATE repuestos SET stock_actual=$1, precio_compra=$2 WHERE id=$3', [stockNuevo, Number(item.precio_unitario), item.repuesto_id]);
        await client.query(
            `INSERT INTO movimientos_inventario
                (repuesto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia, origen, area, compra_id, precio_unitario)
             VALUES ($1,$2,'entrada',$3,$4,$5,$6,$7,'compra',$8,$9,$10)`,
            [item.repuesto_id, usuarioId, item.cantidad_recibida, stockAnterior, stockNuevo,
             compra.numero_documento ? `Compra: documento ${compra.numero_documento}` : 'Recepcion de compra a proveedor',
             referencia, repuesto.area, compra.id, Number(item.precio_unitario)]
        );
        resultado.push({ item_id: item.id, repuesto_id: item.repuesto_id, repuesto_nombre: repuesto.nombre, cantidad: item.cantidad_recibida, stock_anterior: stockAnterior, stock_nuevo: stockNuevo });
    }
    return resultado;
}

/** Fecha de vencimiento: la indicada (no antes de la emision) o emision + 15 dias. */
function calcularVencimiento(formaPago, fechaEmision, fechaVencimiento) {
    if (formaPago !== 'credito') return { valor: null };
    if (fechaVencimiento === undefined || fechaVencimiento === null || fechaVencimiento === '') return { valor: undefined };
    if (!FECHA_RE.test(String(fechaVencimiento))) return { error: 'La fecha de vencimiento es inválida.' };
    if (fechaEmision && fechaVencimiento < fechaEmision) return { error: 'La fecha de vencimiento no puede ser anterior a la fecha de emisión.' };
    return { valor: fechaVencimiento };
}

// ─────────────────────────────────────────────────────────────
// LISTAR
// GET /api/proveedores/compras
// Filtros: q (proveedor, RUC o numero), proveedor_id, estado, forma_pago,
// area, tipo_documento, fecha_inicio|desde, fecha_fin|hasta, page, limit.
// Devuelve ademas el resumen (valor y cantidad, sin canceladas) del filtro.
// ─────────────────────────────────────────────────────────────
const listarCompras = async (req, res) => {
    const { q, proveedor_id, estado, forma_pago, area, tipo_documento, page = 1, limit = 20 } = req.query;
    const fechaInicio = req.query.fecha_inicio || req.query.desde;
    const fechaFin = req.query.fecha_fin || req.query.hasta;

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * limitNum;

    let where    = 'WHERE 1=1';
    const params = [];
    const add = (sql, v) => { params.push(v); where += ` AND ${sql.replace('$?', `$${params.length}`)}`; };

    if (q && String(q).trim()) {
        params.push(`%${String(q).trim().slice(0, 60)}%`);
        const n = params.length;
        where += ` AND (p.nombre_comercial ILIKE $${n} OR p.razon_social ILIKE $${n} OR p.ruc ILIKE $${n} OR c.numero_documento ILIKE $${n} OR c.notas ILIKE $${n})`;
    }
    if (/^\d+$/.test(String(proveedor_id || ''))) add('c.proveedor_id = $?', proveedor_id);
    if (ESTADOS.includes(estado))       add('c.estado = $?', estado);
    if (FORMAS_PAGO.includes(forma_pago)) add('c.forma_pago = $?', forma_pago);
    if (TIPOS_DOCUMENTO.includes(tipo_documento)) add('c.tipo_documento = $?', tipo_documento);
    if (area && /^[a-z_]{1,30}$/.test(String(area))) add('c.area = $?', area);
    if (FECHA_RE.test(String(fechaInicio || ''))) add('c.fecha_solicitud >= $?', fechaInicio);
    if (FECHA_RE.test(String(fechaFin || '')))    add('c.fecha_solicitud <= $?', fechaFin);

    const base = `FROM compras_proveedor c LEFT JOIN proveedores p ON p.id = c.proveedor_id ${where}`;
    const dataQuery  = `
        SELECT c.*, p.nombre_comercial AS proveedor_nombre, p.ruc AS proveedor_ruc, u.nombre AS usuario_nombre,
               (SELECT COUNT(*) FROM compras_proveedor_items i WHERE i.compra_id = c.id) AS total_items,
               (SELECT fc.id FROM facturas_compra fc WHERE fc.compra_id = c.id) AS factura_compra_id,
               ${COLS_PAGO}
        FROM compras_proveedor c
        LEFT JOIN proveedores p ON p.id = c.proveedor_id
        LEFT JOIN usuarios    u ON u.id = c.usuario_id
        ${where}
        ORDER BY c.fecha_solicitud DESC, c.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    try {
        const [{ rows: resumenRows }, { rows }] = await Promise.all([
            pool.query(`SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE c.estado <> 'cancelada')::int AS cantidad,
                               COALESCE(SUM(c.total) FILTER (WHERE c.estado <> 'cancelada'), 0) AS valor ${base}`, params),
            pool.query(dataQuery, [...params, limitNum, offset]),
        ]);
        const total = resumenRows[0].total;
        return res.json({
            compras: rows, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum),
            resumen: { valor: r2(resumenRows[0].valor), cantidad: resumenRows[0].cantidad },
        });
    } catch (err) {
        console.error('Error listarCompras:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener compras.' });
    }
};

// ─────────────────────────────────────────────────────────────
// OBTENER UNA (con items, proveedor, factura del SRI y totales por tarifa)
// GET /api/proveedores/compras/:id
// ─────────────────────────────────────────────────────────────
const obtenerCompra = async (req, res) => {
    const { id } = req.params;
    if (!/^\d+$/.test(String(id))) return res.status(404).json({ error: 'Compra no encontrada.' });
    try {
        const { rows } = await pool.query(
            `SELECT c.*, p.nombre_comercial AS proveedor_nombre, p.razon_social AS proveedor_razon_social, p.ruc AS proveedor_ruc,
                    p.direccion AS proveedor_direccion, p.telefono AS proveedor_telefono, p.email AS proveedor_email,
                    u.nombre AS usuario_nombre, ${COLS_PAGO}
             FROM compras_proveedor c
             LEFT JOIN proveedores p ON p.id = c.proveedor_id
             LEFT JOIN usuarios    u ON u.id = c.usuario_id
             WHERE c.id = $1`,
            [id]
        );
        const compra = rows[0];
        if (!compra) return res.status(404).json({ error: 'Compra no encontrada.' });

        const [{ rows: items }, { rows: fac }, { rows: pagos }] = await Promise.all([
            pool.query(
                `SELECT i.*, r.nombre AS repuesto_nombre_actual, r.codigo AS repuesto_codigo, r.area AS repuesto_area,
                        (SELECT m.stock_nuevo FROM movimientos_inventario m WHERE m.compra_id = i.compra_id AND m.repuesto_id = i.repuesto_id ORDER BY m.id DESC LIMIT 1) AS stock_tras_entrada
                 FROM compras_proveedor_items i
                 LEFT JOIN repuestos r ON r.id = i.repuesto_id
                 WHERE i.compra_id = $1 ORDER BY i.id ASC`, [id]),
            pool.query(
                `SELECT id, clave_acceso, numero, estado_sri, ambiente, total_descuento, origen_datos, (xml_original IS NOT NULL) AS tiene_xml
                 FROM facturas_compra WHERE compra_id = $1`, [id]),
            pool.query(
                `SELECT id, tipo, descripcion, monto, metodo_pago, referencia, estado, created_at FROM movimientos_financieros_proveedor
                 WHERE compra_id = $1 AND tipo IN ('pago', 'abono') ORDER BY created_at, id`, [id]),
        ]);
        const conIva = items.filter(i => Number(i.iva_porcentaje) > 0);
        const totales = {
            subtotal_iva: r2(conIva.reduce((s, i) => s + Number(i.subtotal), 0)),
            subtotal_0: r2(items.filter(i => Number(i.iva_porcentaje) === 0).reduce((s, i) => s + Number(i.subtotal), 0)),
            tarifa_iva: conIva.length ? Math.max(...conIva.map(i => Number(i.iva_porcentaje))) : IVA_POR_DEFECTO,
            descuento: r2(fac[0]?.total_descuento || 0),
            iva: r2(compra.iva),
            total: r2(compra.total),
            articulos: r2(items.reduce((s, i) => s + Number(i.cantidad), 0)),
        };
        return res.json({ compra: { ...compra, items, factura: fac[0] || null, pagos, totales, sustento_texto: SUSTENTOS[compra.sustento_tributario] || null } });
    } catch (err) {
        console.error('Error obtenerCompra:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener la compra.' });
    }
};

// ─────────────────────────────────────────────────────────────
// ¿EXISTE YA ESTE DOCUMENTO?
// GET /api/proveedores/compras/documento?proveedor_id=&tipo_documento=&numero_documento=
// Para avisar antes de cargar los items ("Ya existe un registro...").
// ─────────────────────────────────────────────────────────────
const existeDocumento = async (req, res) => {
    const { proveedor_id, tipo_documento } = req.query;
    let numero;
    try { numero = normalizarNumeroDocumento(req.query.numero_documento); } catch (e) { return res.status(400).json({ error: e.message }); }
    if (!numero || !/^\d+$/.test(String(proveedor_id || '')) || !TIPOS_DOCUMENTO.includes(tipo_documento)) {
        return res.status(400).json({ error: 'Indique proveedor, tipo y número del documento.' });
    }
    try {
        const { rows } = await pool.query(
            `SELECT id FROM compras_proveedor WHERE proveedor_id = $1 AND tipo_documento = $2 AND numero_documento = $3 AND estado <> 'cancelada' LIMIT 1`,
            [proveedor_id, tipo_documento, numero]);
        return res.json({ existe: Boolean(rows[0]), compra_id: rows[0]?.id || null, numero_documento: numero });
    } catch (err) {
        console.error('Error existeDocumento:', err);
        return res.status(500).json({ error: 'Error al verificar el documento.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CREAR (con items)
// POST /api/proveedores/compras   (admin)
// body: { proveedor_id, fecha_solicitud (emision), notas, forma_pago, metodo_pago?, referencia_pago?,
//         fecha_vencimiento?, tipo_documento?, numero_documento?, area?, tipo_registro?, sustento_tributario?,
//         recibir_ahora?, items: [{repuesto_id?, descripcion, cantidad, precio_unitario, iva_porcentaje?}] }
// forma_pago 'contado' registra el pago completo en ese momento; 'credito'
// vence en la fecha indicada (o a los 15 dias). Un comprobante (factura,
// nota de venta u otro) se registra ya recibido y suma al inventario.
// ─────────────────────────────────────────────────────────────
const crearCompra = async (req, res) => {
    const {
        proveedor_id, fecha_solicitud, notas, items, forma_pago = 'credito', metodo_pago = 'efectivo', referencia_pago,
        fecha_vencimiento, tipo_documento = 'orden', tipo_registro = 'inventario',
    } = req.body;
    const usuario_id = req.usuario.id;

    if (!proveedor_id) return res.status(400).json({ error: 'proveedor_id es requerido.' });
    if (!FORMAS_PAGO.includes(forma_pago)) return res.status(400).json({ error: "forma_pago debe ser 'contado' o 'credito'." });
    if (forma_pago === 'contado' && !METODOS.includes(metodo_pago)) return res.status(400).json({ error: 'Metodo de pago invalido.' });
    if (!TIPOS_DOCUMENTO.includes(tipo_documento)) return res.status(400).json({ error: 'Tipo de documento inválido.' });
    if (!TIPOS_REGISTRO.includes(tipo_registro)) return res.status(400).json({ error: 'Tipo de registro inválido.' });
    const sustento = req.body.sustento_tributario ? String(req.body.sustento_tributario) : (tipo_documento === 'orden' ? null : SUSTENTO_POR_REGISTRO[tipo_registro]);
    if (sustento && !SUSTENTOS[sustento]) return res.status(400).json({ error: 'Sustento tributario inválido.' });
    let numeroDocumento;
    try { numeroDocumento = normalizarNumeroDocumento(req.body.numero_documento); } catch (e) { return res.status(400).json({ error: e.message }); }
    if (tipo_documento !== 'orden' && !numeroDocumento) return res.status(400).json({ error: 'Ingrese el número del documento del proveedor (001-001-000000123).' });
    if (fecha_solicitud && !FECHA_RE.test(String(fecha_solicitud))) return res.status(400).json({ error: 'La fecha de emisión es inválida.' });
    const vence = calcularVencimiento(forma_pago, fecha_solicitud, fecha_vencimiento);
    if (vence.error) return res.status(400).json({ error: vence.error });
    const area = req.body.area || null;
    if (area && !(await areasValidas()).includes(area)) return res.status(400).json({ error: 'Inventario de destino inválido.' });
    // Un comprobante ya en manos del taller se registra recibido (salvo que se pida lo contrario).
    const recibirAhora = tipo_documento === 'orden' ? req.body.recibir_ahora === true : req.body.recibir_ahora !== false;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'La compra debe incluir al menos un item.' });
    }
    if (items.length > 300) return res.status(400).json({ error: 'Una compra admite hasta 300 items.' });
    for (const it of items) {
        if (!it.descripcion || !String(it.descripcion).trim()) return res.status(400).json({ error: 'Cada item requiere una descripcion.' });
        if (!(Number(it.cantidad) > 0) || r2(it.cantidad) <= 0) return res.status(400).json({ error: 'La cantidad de cada item debe ser mayor a cero.' });
        if (it.precio_unitario === undefined || it.precio_unitario === '' || !(Number(it.precio_unitario) >= 0)) {
            return res.status(400).json({ error: 'El precio unitario de cada item es invalido.' });
        }
        if (it.iva_porcentaje !== undefined && it.iva_porcentaje !== '' && !(Number(it.iva_porcentaje) >= 0 && Number(it.iva_porcentaje) <= 100)) {
            return res.status(400).json({ error: 'La tarifa de IVA de un item es inválida.' });
        }
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { rows: provRows } = await client.query('SELECT id FROM proveedores WHERE id = $1 AND activo = TRUE', [proveedor_id]);
        if (!provRows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Proveedor no encontrado o inactivo.' });
        }

        if (numeroDocumento) {
            const { rows: dup } = await client.query(
                `SELECT id FROM compras_proveedor WHERE proveedor_id = $1 AND tipo_documento = $2 AND numero_documento = $3 AND estado <> 'cancelada' LIMIT 1`,
                [proveedor_id, tipo_documento, numeroDocumento]);
            if (dup[0]) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: `Ya existe un registro con esta información: el documento ${numeroDocumento} de este proveedor ya fue ingresado (compra #${dup[0].id}).`, codigo: 'DOCUMENTO_DUPLICADO', compra_id: dup[0].id });
            }
        }

        const repuestoIds = [...new Set(items.map(it => it.repuesto_id).filter(Boolean))];
        if (repuestoIds.length) {
            const { rows: repRows } = await client.query('SELECT id FROM repuestos WHERE id = ANY($1::int[])', [repuestoIds]);
            const encontrados = new Set(repRows.map(r => r.id));
            const faltantes = repuestoIds.filter(id => !encontrados.has(Number(id)));
            if (faltantes.length) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `Repuesto(s) no encontrado(s): ${faltantes.join(', ')}.` });
            }
        }

        const { rows: compraRows } = await client.query(
            `INSERT INTO compras_proveedor (proveedor_id, usuario_id, fecha_solicitud, notas, forma_pago, fecha_vencimiento,
                                            tipo_documento, numero_documento, area, tipo_registro, sustento_tributario)
             VALUES ($1,$2,COALESCE($3::date, CURRENT_DATE),$4,$5::varchar,
                     CASE WHEN $5::varchar = 'credito' THEN COALESCE($6::date, COALESCE($3::date, CURRENT_DATE) + $7::int) END,
                     $8,$9,$10,$11,$12)
             RETURNING *`,
            [proveedor_id, usuario_id, fecha_solicitud || null, notas || null, forma_pago, vence.valor || null, DIAS_CREDITO,
             tipo_documento, numeroDocumento, area, tipo_registro, sustento]
        );
        let compra = compraRows[0];

        for (const it of items) {
            const cantidad  = r2(it.cantidad);
            const precio    = Number(it.precio_unitario);
            const subtotal  = r2(cantidad * precio);
            const iva = it.iva_porcentaje === undefined || it.iva_porcentaje === '' ? (tipo_documento === 'nota_venta' ? 0 : IVA_POR_DEFECTO) : Number(it.iva_porcentaje);
            await client.query(
                `INSERT INTO compras_proveedor_items (compra_id, repuesto_id, descripcion, cantidad, cantidad_recibida, precio_unitario, subtotal, iva_porcentaje)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
                [compra.id, it.repuesto_id || null, String(it.descripcion).trim().slice(0, 200), cantidad, recibirAhora ? cantidad : 0, precio, subtotal, iva]
            );
        }

        const totales = await recalcularTotales(client, compra.id);

        // Registro inicial en el historial financiero del proveedor.
        const etiqueta = numeroDocumento ? `${tipo_documento === 'nota_venta' ? 'Nota de venta' : tipo_documento === 'factura' ? 'Factura' : 'Documento'} ${numeroDocumento}` : `Orden de compra #${compra.id}`;
        await client.query(
            `INSERT INTO movimientos_financieros_proveedor
                (proveedor_id, tipo, compra_id, descripcion, monto, estado, usuario_id)
             VALUES ($1,'compra',$2,$3,$4,'confirmado',$5)`,
            [proveedor_id, compra.id, etiqueta, totales.total, usuario_id]
        );

        // Compra al contado: el pago sale en este mismo momento.
        if (forma_pago === 'contado' && totales.total > 0) {
            await client.query(
                `INSERT INTO movimientos_financieros_proveedor
                    (proveedor_id, tipo, compra_id, descripcion, monto, metodo_pago, referencia, estado, usuario_id)
                 VALUES ($1,'pago',$2,$3,$4,$5,$6,'confirmado',$7)`,
                [proveedor_id, compra.id, `Pago al contado ${numeroDocumento ? etiqueta.toLowerCase() : `compra #${compra.id}`}`, totales.total, metodo_pago, referencia_pago?.trim() || null, usuario_id]
            );
        }

        // Comprobante ya recibido: entra al inventario en esta misma transaccion.
        let stockActualizado = [];
        if (recibirAhora) {
            const { rows: rec } = await client.query(
                `UPDATE compras_proveedor SET estado = 'recibida', fecha_recepcion = CURRENT_DATE WHERE id = $1 RETURNING *`, [compra.id]);
            compra = rec[0];
            stockActualizado = await recibirItems(client, compra, usuario_id);
        }

        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'compra', entidad_id: compra.id, accion: recibirAhora ? 'registrada' : 'creada',
            usuario_id, usuario_nombre: req.usuario.nombre,
            detalle: `${etiqueta} por $${totales.total} (${forma_pago})${recibirAhora ? `: ${stockActualizado.filter(s => !s.omitido).length} entrada(s) de inventario` : ' creada'}.`,
        });

        const { rows: items_final } = await pool.query('SELECT * FROM compras_proveedor_items WHERE compra_id = $1 ORDER BY id ASC', [compra.id]);
        return res.status(201).json({ compra: { ...compra, ...totales, items: items_final }, stock_actualizado: stockActualizado });
    } catch (err) {
        await client?.query('ROLLBACK');
        if (err.code === '23505' && err.constraint === 'uq_compras_documento') {
            return res.status(409).json({ error: `Ya existe un registro con esta información: el documento ${numeroDocumento} de este proveedor ya fue ingresado.`, codigo: 'DOCUMENTO_DUPLICADO' });
        }
        console.error('Error crearCompra:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al registrar la compra.' });
    } finally {
        client?.release();
    }
};

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR DATOS GENERALES (no items)
// PUT /api/proveedores/compras/:id   (admin)
// Notas y sustento tributario se pueden corregir mientras la compra no este
// cancelada; la fecha de solicitud solo si sigue pendiente/solicitada.
// ─────────────────────────────────────────────────────────────
const actualizarCompra = async (req, res) => {
    const { id } = req.params;
    const { fecha_solicitud, notas } = req.body;
    const sustento = req.body.sustento_tributario;
    if (sustento !== undefined && sustento !== null && sustento !== '' && !SUSTENTOS[String(sustento)]) {
        return res.status(400).json({ error: 'Sustento tributario inválido.' });
    }

    try {
        const { rows: actualRows } = await pool.query('SELECT estado FROM compras_proveedor WHERE id = $1', [id]);
        if (!actualRows[0]) return res.status(404).json({ error: 'Compra no encontrada.' });
        const estado = actualRows[0].estado;
        if (estado === 'cancelada') return res.status(409).json({ error: 'Una compra cancelada no se puede editar.' });
        if (fecha_solicitud && !['pendiente', 'solicitada'].includes(estado)) {
            return res.status(409).json({ error: 'Solo se pueden editar compras pendientes o solicitadas.' });
        }

        const { rows } = await pool.query(
            `UPDATE compras_proveedor SET fecha_solicitud = COALESCE($1, fecha_solicitud), notas = $2,
                    sustento_tributario = CASE WHEN $4::boolean THEN NULLIF($3, '') ELSE sustento_tributario END
             WHERE id = $5 RETURNING *`,
            [fecha_solicitud || null, notas || null, sustento === undefined ? null : String(sustento ?? ''), sustento !== undefined, id]
        );
        return res.json({ compra: rows[0] });
    } catch (err) {
        console.error('Error actualizarCompra:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al actualizar la compra.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CAMBIAR ESTADO
// PATCH /api/proveedores/compras/:id/estado   (admin)
// body: { estado, cantidades_recibidas?: [{item_id, cantidad_recibida}] }
// Al marcar 'recibida' se suman al inventario (misma transaccion) los items
// vinculados a un producto con cantidad recibida > 0.
// ─────────────────────────────────────────────────────────────
const cambiarEstadoCompra = async (req, res) => {
    const { id } = req.params;
    const { estado, cantidades_recibidas } = req.body;
    const usuario_id = req.usuario.id;

    if (!estado || !ESTADOS.includes(estado)) {
        return res.status(400).json({ error: `Estado invalido. Valores permitidos: ${ESTADOS.join(', ')}.` });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { rows: compraRows } = await client.query('SELECT * FROM compras_proveedor WHERE id = $1 FOR UPDATE', [id]);
        const compra = compraRows[0];
        if (!compra) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Compra no encontrada.' });
        }
        if (compra.estado === 'recibida' || compra.estado === 'cancelada') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `La compra ya esta en estado "${compra.estado}" y no se puede modificar.` });
        }
        if (estado === 'cancelada') {
            // Una compra con pagos vigentes no se cancela: el dinero ya salio de
            // la cuenta. Primero se anulan esos pagos y luego se cancela.
            const { rows: pg } = await client.query(
                `SELECT COALESCE(SUM(monto), 0) AS pagado, COUNT(*)::int AS n FROM movimientos_financieros_proveedor
                 WHERE compra_id = $1 AND tipo IN ('pago','abono') AND estado = 'confirmado'`, [compra.id]);
            if (Number(pg[0].pagado) > 0.005) {
                await client.query('ROLLBACK');
                return res.status(409).json({
                    error: `La compra #${compra.id} tiene ${pg[0].n} pago(s) confirmado(s) por $${Number(pg[0].pagado).toFixed(2)}. Si el proveedor devolvio el dinero o el pago fue un error, anulalo en "Historial financiero" y luego cancela la compra.`,
                    codigo: 'COMPRA_CON_PAGOS', pagado: Number(pg[0].pagado),
                });
            }
        }

        if (Array.isArray(cantidades_recibidas)) {
            for (const c of cantidades_recibidas) {
                // La cantidad recibida nunca supera la pedida (se re-valida en servidor).
                await client.query(
                    `UPDATE compras_proveedor_items
                     SET cantidad_recibida = LEAST(GREATEST(ROUND($1::numeric, 2), 0), cantidad)
                     WHERE id = $2 AND compra_id = $3`,
                    [Number(c.cantidad_recibida) || 0, c.item_id, id]
                );
            }
        }

        const fechaRecepcion = estado === 'recibida' ? new Date().toISOString().slice(0, 10) : compra.fecha_recepcion;
        const { rows } = await client.query(
            'UPDATE compras_proveedor SET estado = $1, fecha_recepcion = $2 WHERE id = $3 RETURNING *',
            [estado, fechaRecepcion, id]
        );

        const stockActualizado = estado === 'recibida' ? await recibirItems(client, rows[0], usuario_id) : [];

        if (estado === 'cancelada') {
            // Anula el movimiento 'compra' original para que el resumen deje de
            // contarlo, y agrega el registro de cancelacion al historial.
            await client.query(
                `UPDATE movimientos_financieros_proveedor SET estado = 'anulado'
                 WHERE compra_id = $1 AND tipo = 'compra'`,
                [compra.id]
            );
            await client.query(
                `INSERT INTO movimientos_financieros_proveedor
                    (proveedor_id, tipo, compra_id, descripcion, monto, estado, usuario_id)
                 VALUES ($1,'cancelacion',$2,$3,$4,'confirmado',$5)`,
                [compra.proveedor_id, compra.id, `Compra #${compra.id} cancelada`, compra.total, usuario_id]
            );
        }

        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'compra', entidad_id: compra.id, accion: `estado_${estado}`,
            usuario_id, usuario_nombre: req.usuario.nombre,
            detalle: estado === 'recibida'
                ? `Compra #${compra.id} recibida. ${stockActualizado.filter(s => !s.omitido).length} item(s) sumados al inventario.`
                : `Compra #${compra.id} cambio de estado a "${estado}".`,
        });

        return res.json({ compra: rows[0], stock_actualizado: stockActualizado });
    } catch (err) {
        await client?.query('ROLLBACK');
        console.error('Error cambiarEstadoCompra:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al cambiar el estado de la compra.' });
    } finally {
        client?.release();
    }
};

// ─────────────────────────────────────────────────────────────
// CANCELAR / ELIMINAR (solo si sigue pendiente)
// DELETE /api/proveedores/compras/:id   (admin)
// ─────────────────────────────────────────────────────────────
const eliminarCompra = async (req, res) => {
    const { id } = req.params;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows: compraRows } = await client.query('SELECT estado FROM compras_proveedor WHERE id = $1', [id]);
        if (!compraRows[0]) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Compra no encontrada.' });
        }
        if (compraRows[0].estado !== 'pendiente') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Solo se pueden eliminar compras en estado pendiente. Usa el cambio de estado a "cancelada" en su lugar.' });
        }
        // Limpia el movimiento 'compra' que crearCompra genero.
        await client.query('DELETE FROM movimientos_financieros_proveedor WHERE compra_id = $1', [id]);
        await client.query('DELETE FROM compras_proveedor WHERE id = $1', [id]);
        await client.query('COMMIT');
        return res.json({ mensaje: 'Compra eliminada correctamente.' });
    } catch (err) {
        await client?.query('ROLLBACK');
        console.error('Error eliminarCompra:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al eliminar la compra.' });
    } finally {
        client?.release();
    }
};

// ─────────────────────────────────────────────────────────────
// ALERTAS DE CREDITO
// GET /api/proveedores/compras/alertas-credito
// Compras a credito con saldo pendiente que vencen en 3 dias o menos
// (incluye las ya vencidas). Se usa para el aviso del panel.
// ─────────────────────────────────────────────────────────────
const alertasCredito = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT * FROM (
                SELECT c.id, c.proveedor_id, c.fecha_solicitud, c.fecha_vencimiento, c.total, c.estado, c.numero_documento,
                       p.nombre_comercial AS proveedor_nombre, ${COLS_PAGO}
                FROM compras_proveedor c
                JOIN proveedores p ON p.id = c.proveedor_id
                WHERE c.forma_pago = 'credito' AND c.estado <> 'cancelada'
                  AND c.fecha_vencimiento <= CURRENT_DATE + $1::int
             ) x
             WHERE x.saldo > 0.005
             ORDER BY x.fecha_vencimiento ASC, x.id ASC`,
            [DIAS_AVISO]
        );
        return res.json({ alertas: rows, dias_aviso: DIAS_AVISO });
    } catch (err) {
        console.error('Error alertasCredito:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener las alertas de credito.' });
    }
};

/** GET /api/proveedores/compras/catalogos: sustentos tributarios y tipos (para los formularios). */
const catalogos = (req, res) => res.json({
    sustentos: Object.entries(SUSTENTOS).map(([codigo, texto]) => ({ codigo, texto })),
    sustento_por_registro: SUSTENTO_POR_REGISTRO,
    dias_credito: DIAS_CREDITO,
});

module.exports = {
    alertasCredito, catalogos, existeDocumento,
    listarCompras, obtenerCompra, crearCompra, actualizarCompra, cambiarEstadoCompra, eliminarCompra,
};
