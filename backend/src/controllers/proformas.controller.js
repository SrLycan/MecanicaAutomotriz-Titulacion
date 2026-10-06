/**
 * SS SWAP - Controlador de Proformas
 *
 * Dos tipos de proforma comparten esta misma tabla (`proformas` +
 * `proforma_items`), diferenciados por `tipo`:
 *  - 'mecanica': items de categoria 'producto' / 'servicio'
 *  - 'pintura':  items de categoria 'mano_obra' / 'pintura' / 'repuesto' / 'insumo'
 *
 * DECISION TECNICA (IVA): el proyecto no tenia una configuracion global de
 * impuestos (se reviso Ordenes, Servicios, Inventario y Proveedores — ver
 * auditoria). Se implementa `iva_porcentaje` como campo editable por
 * proforma, por defecto 0 (nunca se asume una tasa), documentado tambien en
 * el frontend. Si en el futuro se define una tasa fija del pais, el unico
 * lugar a tocar es el valor por defecto en `crearProforma` de este archivo.
 *
 * Los totales SIEMPRE se recalculan en el servidor a partir de los items
 * (nunca se confia en los totales que mande el frontend), igual criterio
 * que ya se uso en compras_proveedor con recalcularTotales().
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { registrarAccionBitacora } = require('../services/ordenesHistorial.service');
const { TIPOS_CARROCERIA, normalizarPuertas, zonasValidas, etiquetaZona, CARROCERIAS } = require('../shared/vehiculoDiagramas');
const { confirmarUsoProforma, revertirSalidaProforma, descontarInventarioAutomatico, ErrorNegocio, formatoOrden } = require('../services/inventarioProforma.service');
const { generarPagareAutomatico, sincronizarPagareConProforma, buscarPagareActivo } = require('../services/pagare.service');
const { cantidadValida } = require('../utils/numeros');

const TIPOS = ['mecanica', 'pintura'];
const ESTADOS = ['borrador', 'emitida', 'aprobada', 'rechazada', 'vencida', 'convertida'];
const CATEGORIAS_POR_TIPO = {
    mecanica: ['producto', 'servicio'],
    pintura: ['mano_obra', 'pintura', 'repuesto', 'insumo'],
};
// Categorias cuyos items pueden venir del inventario (y por lo tanto
// generar una salida de stock al confirmar el uso de la proforma).
const CATEGORIAS_INVENTARIO = ['producto', 'repuesto', 'insumo'];
const CAMPO_SUBTOTAL = {
    producto: 'subtotal_productos', servicio: 'subtotal_servicios',
    mano_obra: 'subtotal_mano_obra', pintura: 'subtotal_pintura',
    repuesto: 'subtotal_repuestos', insumo: 'subtotal_insumos',
};

/** Calcula todos los subtotales/totales a partir de los items — nunca se confia en el frontend. */
function calcularTotales(items, descuento, ivaPorcentaje, anticipo) {
    const porCategoria = { producto: 0, servicio: 0, mano_obra: 0, pintura: 0, repuesto: 0, insumo: 0 };
    let subtotal = 0;
    for (const it of items) {
        const sub = Math.round(parseFloat(it.cantidad) * parseFloat(it.precio_unitario) * 100) / 100;
        porCategoria[it.categoria] = Math.round((porCategoria[it.categoria] + sub) * 100) / 100;
        subtotal = Math.round((subtotal + sub) * 100) / 100;
    }
    const descuentoNum = Math.max(0, parseFloat(descuento) || 0);
    const baseImponible = Math.max(0, subtotal - descuentoNum);
    const ivaValor = Math.round(baseImponible * (parseFloat(ivaPorcentaje) || 0) / 100 * 100) / 100;
    const total = Math.round((baseImponible + ivaValor) * 100) / 100;
    const anticipoNum = Math.max(0, parseFloat(anticipo) || 0);
    const saldo = Math.round((total - anticipoNum) * 100) / 100;
    return {
        subtotal_productos: porCategoria.producto, subtotal_servicios: porCategoria.servicio,
        subtotal_mano_obra: porCategoria.mano_obra, subtotal_pintura: porCategoria.pintura,
        subtotal_repuestos: porCategoria.repuesto, subtotal_insumos: porCategoria.insumo,
        subtotal, iva_valor: ivaValor, total, saldo, descuento: descuentoNum, anticipo: anticipoNum,
    };
}

function validarItems(tipo, items) {
    if (!Array.isArray(items) || items.length === 0) return 'La proforma debe tener al menos un item.';
    const categoriasValidas = CATEGORIAS_POR_TIPO[tipo];
    for (const it of items) {
        if (!categoriasValidas.includes(it.categoria)) return `Categoria "${it.categoria}" no valida para proformas de tipo "${tipo}".`;
        if (!it.descripcion || !it.descripcion.trim()) return 'Cada item requiere una descripcion.';
        if (cantidadValida(it.cantidad) === null) return 'La cantidad de cada item debe ser mayor a cero (maximo 2 decimales).';
        if (it.precio_unitario === undefined || parseFloat(it.precio_unitario) < 0) return 'El precio unitario de cada item es invalido.';
        if (it.referencia_tipo === 'repuesto' && it.referencia_id && !CATEGORIAS_INVENTARIO.includes(it.categoria)) {
            return `Los items de categoria "${it.categoria}" no pueden vincularse a un producto del inventario.`;
        }
    }
    return null;
}

/** Los items ligados al inventario deben apuntar a repuestos existentes y activos. */
async function validarRepuestosDeItems(client, items) {
    const ids = [...new Set(items.filter(i => i.referencia_tipo === 'repuesto' && i.referencia_id).map(i => Number(i.referencia_id)))];
    if (!ids.length) return null;
    const { rows } = await client.query('SELECT id FROM repuestos WHERE id = ANY($1::int[]) AND activo = TRUE', [ids]);
    const existentes = new Set(rows.map(r => r.id));
    const faltante = items.find(i => i.referencia_tipo === 'repuesto' && i.referencia_id && !existentes.has(Number(i.referencia_id)));
    return faltante ? `El producto de inventario "${faltante.descripcion}" ya no existe o esta inactivo.` : null;
}

/**
 * Valida y normaliza los datos del pictograma (solo proformas de
 * Colisiones / Pintura). Las zonas son codigos del catalogo compartido
 * shared/vehiculoDiagramas.js, validados segun carroceria y puertas.
 */
function validarCarroceria(tipo, body) {
    const vacio = { carroceria_tipo: null, carroceria_puertas: null, zonas: [], danos_observaciones: null };
    if (tipo !== 'pintura') return { datos: vacio };
    const { carroceria_tipo, carroceria_puertas, zonas_danadas, danos_observaciones } = body;
    const obs = typeof danos_observaciones === 'string' && danos_observaciones.trim() ? danos_observaciones.trim() : null;
    if (!carroceria_tipo) {
        if (Array.isArray(zonas_danadas) && zonas_danadas.length) return { error: 'Selecciona el tipo de vehiculo antes de marcar zonas danadas.' };
        return { datos: { ...vacio, danos_observaciones: obs } };
    }
    if (!TIPOS_CARROCERIA.includes(carroceria_tipo)) return { error: `Tipo de vehiculo invalido. Valores permitidos: ${TIPOS_CARROCERIA.join(', ')}.` };
    if (carroceria_puertas && !CARROCERIAS[carroceria_tipo].puertas.includes(Number(carroceria_puertas))) {
        return { error: `Cantidad de puertas invalida para ${CARROCERIAS[carroceria_tipo].etiqueta}.` };
    }
    const puertas = normalizarPuertas(carroceria_tipo, carroceria_puertas);
    const validas = new Set(zonasValidas(carroceria_tipo, puertas));
    const zonas = [...new Set(Array.isArray(zonas_danadas) ? zonas_danadas : [])];
    const invalida = zonas.find(z => typeof z !== 'string' || !validas.has(z));
    if (invalida !== undefined) return { error: `La zona "${invalida}" no existe en el pictograma de ${CARROCERIAS[carroceria_tipo].etiqueta}.` };
    return { datos: { carroceria_tipo, carroceria_puertas: puertas, zonas, danos_observaciones: obs } };
}

async function guardarZonas(client, proformaId, zonas) {
    await client.query('DELETE FROM proforma_zonas_danadas WHERE proforma_id = $1', [proformaId]);
    for (const z of zonas) {
        await client.query('INSERT INTO proforma_zonas_danadas (proforma_id, zona) VALUES ($1,$2)', [proformaId, z]);
    }
}

async function obtenerZonas(db, proformaId) {
    const { rows } = await db.query('SELECT zona FROM proforma_zonas_danadas WHERE proforma_id = $1 ORDER BY id', [proformaId]);
    return rows.map(r => r.zona);
}

/** Respuesta uniforme para errores de negocio / restricciones de BD. */
function responderError(res, err, mensajeGenerico) {
    if (err instanceof ErrorNegocio) return res.status(err.status).json({ error: err.message, detalle: err.detalle || undefined });
    if (err && err.code === 'P0001') return res.status(409).json({ error: 'Esta proforma ya desconto inventario: sus productos no se pueden modificar ni eliminar.' });
    if (err && err.code === '23505' && /uq_mov_salida_por_item_proforma/.test(err.constraint || err.message)) {
        return res.status(409).json({ error: 'Esta proforma ya desconto su inventario. No se puede volver a descontar.' });
    }
    if (err && err.code === '23505' && /uq_cuenta_auto/.test(err.constraint || err.message)) {
        return res.status(409).json({ error: 'Ya existe un pagare automatico para esta orden/proforma.' });
    }
    if (err && err.code === '23514' && /repuestos_stock_no_negativo/.test(err.constraint || err.message)) {
        return res.status(409).json({ error: 'Stock insuficiente: la operacion dejaria el inventario en negativo.' });
    }
    console.error(mensajeGenerico, err);
    const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
    return res.status(500).json({ error: mensajeGenerico });
}

// ─────────────────────────────────────────────────────────────
// LISTAR
// GET /api/proformas?q=&tipo=&estado=&fecha_inicio=&fecha_fin=&page=&limit=
// ─────────────────────────────────────────────────────────────
const listarProformas = async (req, res) => {
    const { q, tipo, estado, fecha_inicio, fecha_fin, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE 1=1';
    const params = [];
    if (q) {
        params.push(`%${q}%`);
        where += ` AND (p.numero ILIKE $${params.length} OR p.cliente_nombre ILIKE $${params.length} OR p.vehiculo_placa ILIKE $${params.length})`;
    }
    if (tipo && TIPOS.includes(tipo))     { params.push(tipo);   where += ` AND p.tipo = $${params.length}`; }
    if (estado && ESTADOS.includes(estado)) { params.push(estado); where += ` AND p.estado = $${params.length}`; }
    if (fecha_inicio) { params.push(fecha_inicio); where += ` AND p.fecha_emision >= $${params.length}`; }
    if (fecha_fin)    { params.push(fecha_fin);    where += ` AND p.fecha_emision <= $${params.length}`; }

    const countQuery = `SELECT COUNT(*) AS total FROM proformas p ${where}`;
    const dataQuery = `
        SELECT p.id, p.numero, p.tipo, p.estado, p.fecha_emision, p.fecha_validez,
               p.cliente_nombre, p.vehiculo_marca, p.vehiculo_modelo, p.vehiculo_placa,
               p.total, p.anticipo, p.saldo, p.usuario_id, u.nombre AS usuario_nombre,
               p.carroceria_tipo, p.inventario_descontado_at, p.orden_id, p.orden_generada_id,
               (SELECT COUNT(*) FROM proforma_items i WHERE i.proforma_id = p.id) AS total_items
        FROM proformas p
        LEFT JOIN usuarios u ON u.id = p.usuario_id
        ${where}
        ORDER BY p.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    try {
        const [{ rows: countRows }, { rows }] = await Promise.all([
            pool.query(countQuery, params),
            pool.query(dataQuery, [...params, limitNum, offset]),
        ]);
        const total = parseInt(countRows[0].total, 10);
        return res.json({ proformas: rows, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
    } catch (err) {
        console.error('Error listarProformas:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener proformas.' });
    }
};

// ─────────────────────────────────────────────────────────────
// OBTENER UNA (con items)
// GET /api/proformas/:id
// ─────────────────────────────────────────────────────────────
const obtenerProforma = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            `SELECT p.*, u.nombre AS usuario_nombre,
                    s.nombre AS sucursal_nombre, s.direccion AS sucursal_direccion,
                    s.telefono AS sucursal_telefono, s.email AS sucursal_email
             FROM proformas p
             LEFT JOIN usuarios u ON u.id = p.usuario_id
             LEFT JOIN sucursales s ON s.id = p.sucursal_id
             WHERE p.id = $1`,
            [id]
        );
        const proforma = rows[0];
        if (!proforma) return res.status(404).json({ error: 'Proforma no encontrada.' });

        const { rows: items } = await pool.query(
            `SELECT i.*, r.codigo AS repuesto_codigo, r.area AS repuesto_area, r.stock_actual AS repuesto_stock, r.unidad_medida AS repuesto_unidad
             FROM proforma_items i
             LEFT JOIN repuestos r ON i.referencia_tipo = 'repuesto' AND r.id = i.referencia_id
             WHERE i.proforma_id = $1 ORDER BY i.categoria, i.orden_linea ASC, i.id ASC`,
            [id]
        );
        const zonas_danadas = await obtenerZonas(pool, id);
        const { rows: salidas } = await pool.query(
            `SELECT m.id, m.tipo, m.origen, m.cantidad, m.stock_anterior, m.stock_nuevo, m.precio_unitario, m.created_at,
                    m.revertido_at, m.proforma_item_id, m.orden_id, r.nombre AS repuesto_nombre, r.codigo AS repuesto_codigo,
                    m.area, u.nombre AS usuario_nombre
             FROM movimientos_inventario m
             JOIN repuestos r ON r.id = m.repuesto_id
             LEFT JOIN usuarios u ON u.id = m.usuario_id
             WHERE m.proforma_id = $1 ORDER BY m.created_at, m.id`,
            [id]
        );
        const pagare = await buscarPagareActivo(pool, { proformaId: proforma.id, ordenId: null });
        let descontadoPor = null;
        if (proforma.inventario_descontado_por) {
            const { rows: uRows } = await pool.query('SELECT nombre FROM usuarios WHERE id = $1', [proforma.inventario_descontado_por]);
            descontadoPor = uRows[0]?.nombre || null;
        }
        const numNorm = (o) => ({ ...o, cantidad: Number(o.cantidad), stock_anterior: o.stock_anterior != null ? Number(o.stock_anterior) : undefined, stock_nuevo: o.stock_nuevo != null ? Number(o.stock_nuevo) : undefined });

        return res.json({ proforma: {
            ...proforma, items: items.map(i => ({ ...i, repuesto_stock: i.repuesto_stock != null ? Number(i.repuesto_stock) : null })),
            zonas_danadas,
            zonas_danadas_detalle: zonas_danadas.map(z => ({ codigo: z, etiqueta: etiquetaZona(z) })),
            movimientos_inventario: salidas.map(numNorm),
            inventario_descontado_por_nombre: descontadoPor,
            orden_numero: formatoOrden(proforma.orden_generada_id || proforma.orden_id),
            pagare: pagare ? { id: pagare.id, monto_total: pagare.monto_total, monto_pagado: pagare.monto_pagado, estado: pagare.estado, porcentaje: pagare.porcentaje } : null,
        } });
    } catch (err) {
        console.error('Error obtenerProforma:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener la proforma.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CREAR
// POST /api/proformas   (soloStaff)
// ─────────────────────────────────────────────────────────────
const crearProforma = async (req, res) => {
    const {
        tipo, cliente_id, vehiculo_id, orden_id, sucursal_id,
        cliente_nombre, cliente_ruc, cliente_direccion, cliente_telefono, cliente_email,
        vehiculo_marca, vehiculo_modelo, vehiculo_anio, vehiculo_color, vehiculo_placa, vehiculo_vin, vehiculo_tipo,
        fecha_emision, fecha_validez, observaciones, condiciones, garantia, tiempo_estimado,
        descuento, iva_porcentaje, anticipo, estado, items,
    } = req.body;
    const usuario_id = req.usuario.id;
    const carroceria = validarCarroceria(tipo, req.body);
    if (carroceria.error) return res.status(400).json({ error: carroceria.error });
    const danos = carroceria.datos;

    if (!tipo || !TIPOS.includes(tipo)) return res.status(400).json({ error: `Tipo invalido. Valores permitidos: ${TIPOS.join(', ')}.` });
    if (!cliente_id) return res.status(400).json({ error: 'El cliente es obligatorio.' });
    if (!vehiculo_id) return res.status(400).json({ error: 'El vehiculo es obligatorio.' });
    if (!fecha_emision) return res.status(400).json({ error: 'La fecha de emision es obligatoria.' });
    const errorItems = validarItems(tipo, items);
    if (errorItems) return res.status(400).json({ error: errorItems });
    if (estado && !['borrador', 'emitida'].includes(estado)) {
        return res.status(400).json({ error: 'Una proforma solo puede crearse como "borrador" o "emitida".' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { rows: clienteRows } = await client.query('SELECT * FROM clientes WHERE id = $1', [cliente_id]);
        if (!clienteRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Cliente no encontrado.' }); }

        const { rows: vehiculoRows } = await client.query('SELECT * FROM vehiculos WHERE id = $1 AND cliente_id = $2', [vehiculo_id, cliente_id]);
        if (!vehiculoRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'El vehiculo no pertenece al cliente indicado.' }); }

        if (orden_id) {
            const { rows: ordenRows } = await client.query('SELECT id FROM ordenes_trabajo WHERE id = $1', [orden_id]);
            if (!ordenRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Orden de trabajo no encontrada.' }); }
        }
        if (sucursal_id) {
            const { rows: sucRows } = await client.query('SELECT id FROM sucursales WHERE id = $1', [sucursal_id]);
            if (!sucRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Sucursal no encontrada.' }); }
        }

        const errorRepuestos = await validarRepuestosDeItems(client, items);
        if (errorRepuestos) { await client.query('ROLLBACK'); return res.status(400).json({ error: errorRepuestos }); }

        const cliente = clienteRows[0];
        const vehiculo = vehiculoRows[0];
        const totales = calcularTotales(items, descuento, iva_porcentaje, anticipo);

        // Numeracion atomica: nextval nunca repite un valor aunque el resto
        // de la transaccion falle despues (no hace ROLLBACK de secuencias).
        const { rows: seqRows } = await client.query("SELECT nextval('proformas_numero_seq') AS n");
        const numero = `PROFORMA-${String(seqRows[0].n).padStart(6, '0')}`;

        const { rows: profRows } = await client.query(
            `INSERT INTO proformas (
                numero, tipo, estado, cliente_id, vehiculo_id, orden_id, sucursal_id, usuario_id,
                cliente_nombre, cliente_ruc, cliente_direccion, cliente_telefono, cliente_email,
                vehiculo_marca, vehiculo_modelo, vehiculo_anio, vehiculo_color, vehiculo_placa, vehiculo_vin, vehiculo_tipo,
                fecha_emision, fecha_validez, observaciones, condiciones, garantia, tiempo_estimado,
                descuento, iva_porcentaje, anticipo,
                subtotal_productos, subtotal_servicios, subtotal_mano_obra, subtotal_pintura, subtotal_repuestos, subtotal_insumos,
                subtotal, iva_valor, total, saldo,
                carroceria_tipo, carroceria_puertas, danos_observaciones
            ) VALUES (
                $1,$2,$3,$4,$5,$6,$7,$8,
                $9,$10,$11,$12,$13,
                $14,$15,$16,$17,$18,$19,$20,
                $21,$22,$23,$24,$25,$26,
                $27,$28,$29,
                $30,$31,$32,$33,$34,$35,
                $36,$37,$38,$39,
                $40,$41,$42
            ) RETURNING *`,
            [
                numero, tipo, estado || 'borrador', cliente_id, vehiculo_id, orden_id || null, sucursal_id || null, usuario_id,
                cliente_nombre || cliente.nombre, cliente_ruc || cliente.cedula, cliente_direccion || cliente.direccion,
                cliente_telefono || cliente.telefono, cliente_email || cliente.email,
                vehiculo_marca || vehiculo.marca, vehiculo_modelo || vehiculo.modelo, vehiculo_anio || vehiculo.anio,
                vehiculo_color || vehiculo.color, vehiculo_placa || vehiculo.placa, vehiculo_vin || vehiculo.vin, vehiculo_tipo || null,
                fecha_emision, fecha_validez || null, observaciones || null, condiciones || null, garantia || null, tiempo_estimado || null,
                totales.descuento, parseFloat(iva_porcentaje) || 0, totales.anticipo,
                totales.subtotal_productos, totales.subtotal_servicios, totales.subtotal_mano_obra,
                totales.subtotal_pintura, totales.subtotal_repuestos, totales.subtotal_insumos,
                totales.subtotal, totales.iva_valor, totales.total, totales.saldo,
                danos.carroceria_tipo, danos.carroceria_puertas, danos.danos_observaciones,
            ]
        );
        const proforma = profRows[0];
        await guardarZonas(client, proforma.id, danos.zonas);

        let orden = 1;
        for (const it of items) {
            await client.query(
                `INSERT INTO proforma_items (proforma_id, categoria, referencia_tipo, referencia_id, orden_linea, descripcion, cantidad, precio_unitario, subtotal)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [proforma.id, it.categoria, it.referencia_tipo || null, it.referencia_id || null, orden++,
                 it.descripcion.trim(), parseFloat(it.cantidad), parseFloat(it.precio_unitario),
                 Math.round(parseFloat(it.cantidad) * parseFloat(it.precio_unitario) * 100) / 100]
            );
        }

        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'proforma', entidad_id: proforma.id, accion: 'creada',
            usuario_id, usuario_nombre: req.usuario.nombre,
            detalle: `Proforma ${proforma.numero} (${tipo === 'pintura' ? 'colisiones/pintura' : tipo}) creada para ${proforma.cliente_nombre}. Total $${Number(proforma.total).toFixed(2)}.`
                + (danos.carroceria_tipo ? ` Vehiculo ${CARROCERIAS[danos.carroceria_tipo].etiqueta}, ${danos.zonas.length} zona(s) danada(s).` : ''),
            metadata: { numero: proforma.numero, total: Number(proforma.total), cliente_id: proforma.cliente_id, vehiculo_id: proforma.vehiculo_id, carroceria_tipo: danos.carroceria_tipo, zonas: danos.zonas },
        });

        const { rows: items_final } = await pool.query('SELECT * FROM proforma_items WHERE proforma_id = $1 ORDER BY categoria, orden_linea', [proforma.id]);
        return res.status(201).json({ proforma: { ...proforma, items: items_final, zonas_danadas: danos.zonas } });
    } catch (err) {
        await client?.query('ROLLBACK');
        return responderError(res, err, 'Error al crear la proforma.');
    } finally {
        client?.release();
    }
};

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR
// PUT /api/proformas/:id   (soloStaff)
// ─────────────────────────────────────────────────────────────
const actualizarProforma = async (req, res) => {
    const { id } = req.params;
    const {
        tipo, cliente_id, vehiculo_id, sucursal_id,
        cliente_nombre, cliente_ruc, cliente_direccion, cliente_telefono, cliente_email,
        vehiculo_marca, vehiculo_modelo, vehiculo_anio, vehiculo_color, vehiculo_placa, vehiculo_vin, vehiculo_tipo,
        fecha_emision, fecha_validez, observaciones, condiciones, garantia, tiempo_estimado,
        descuento, iva_porcentaje, anticipo, items,
    } = req.body;
    const carroceria = validarCarroceria(tipo, req.body);
    if (carroceria.error) return res.status(400).json({ error: carroceria.error });
    const danos = carroceria.datos;

    if (!tipo || !TIPOS.includes(tipo)) return res.status(400).json({ error: `Tipo invalido. Valores permitidos: ${TIPOS.join(', ')}.` });
    if (!cliente_id) return res.status(400).json({ error: 'El cliente es obligatorio.' });
    if (!vehiculo_id) return res.status(400).json({ error: 'El vehiculo es obligatorio.' });
    if (!fecha_emision) return res.status(400).json({ error: 'La fecha de emision es obligatoria.' });
    const errorItems = validarItems(tipo, items);
    if (errorItems) return res.status(400).json({ error: errorItems });

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { rows: actualRows } = await client.query('SELECT estado, total, inventario_descontado_at FROM proformas WHERE id = $1 FOR UPDATE', [id]);
        if (!actualRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Proforma no encontrada.' }); }
        if (actualRows[0].estado === 'convertida') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'No se puede editar una proforma ya convertida a orden de trabajo.' });
        }
        if (actualRows[0].inventario_descontado_at) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Esta proforma ya desconto productos del inventario y no se puede editar. Para corregirla, cambiala a "borrador": el material vuelve solo al inventario.' });
        }
        const errorRepuestos = await validarRepuestosDeItems(client, items);
        if (errorRepuestos) { await client.query('ROLLBACK'); return res.status(400).json({ error: errorRepuestos }); }

        const { rows: vehiculoRows } = await client.query('SELECT * FROM vehiculos WHERE id = $1 AND cliente_id = $2', [vehiculo_id, cliente_id]);
        if (!vehiculoRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'El vehiculo no pertenece al cliente indicado.' }); }
        const vehiculo = vehiculoRows[0];

        if (sucursal_id) {
            const { rows: sucRows } = await client.query('SELECT id FROM sucursales WHERE id = $1', [sucursal_id]);
            if (!sucRows[0]) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Sucursal no encontrada.' }); }
        }

        const totales = calcularTotales(items, descuento, iva_porcentaje, anticipo);

        const { rows } = await client.query(
            `UPDATE proformas SET
                tipo=$1, cliente_id=$2, vehiculo_id=$3, sucursal_id=$4,
                cliente_nombre=$5, cliente_ruc=$6, cliente_direccion=$7, cliente_telefono=$8, cliente_email=$9,
                vehiculo_marca=$10, vehiculo_modelo=$11, vehiculo_anio=$12, vehiculo_color=$13, vehiculo_placa=$14, vehiculo_vin=$15, vehiculo_tipo=$16,
                fecha_emision=$17, fecha_validez=$18, observaciones=$19, condiciones=$20, garantia=$21, tiempo_estimado=$22,
                descuento=$23, iva_porcentaje=$24, anticipo=$25,
                subtotal_productos=$26, subtotal_servicios=$27, subtotal_mano_obra=$28, subtotal_pintura=$29, subtotal_repuestos=$30, subtotal_insumos=$31,
                subtotal=$32, iva_valor=$33, total=$34, saldo=$35,
                carroceria_tipo=$37, carroceria_puertas=$38, danos_observaciones=$39
             WHERE id=$36 RETURNING *`,
            [
                tipo, cliente_id, vehiculo_id, sucursal_id || null,
                cliente_nombre, cliente_ruc || null, cliente_direccion || null, cliente_telefono || null, cliente_email || null,
                vehiculo_marca || vehiculo.marca, vehiculo_modelo || vehiculo.modelo, vehiculo_anio || vehiculo.anio,
                vehiculo_color || vehiculo.color, vehiculo_placa || vehiculo.placa, vehiculo_vin || vehiculo.vin, vehiculo_tipo || null,
                fecha_emision, fecha_validez || null, observaciones || null, condiciones || null, garantia || null, tiempo_estimado || null,
                totales.descuento, parseFloat(iva_porcentaje) || 0, totales.anticipo,
                totales.subtotal_productos, totales.subtotal_servicios, totales.subtotal_mano_obra,
                totales.subtotal_pintura, totales.subtotal_repuestos, totales.subtotal_insumos,
                totales.subtotal, totales.iva_valor, totales.total, totales.saldo,
                id,
                danos.carroceria_tipo, danos.carroceria_puertas, danos.danos_observaciones,
            ]
        );
        const proforma = rows[0];
        await guardarZonas(client, id, danos.zonas);

        // Reemplaza los items completos (mas simple y seguro que hacer diff
        // linea por linea; la proforma no tiene items referenciados desde
        // otras tablas, asi que no hay riesgo de romper una FK externa).
        await client.query('DELETE FROM proforma_items WHERE proforma_id = $1', [id]);
        let orden = 1;
        for (const it of items) {
            await client.query(
                `INSERT INTO proforma_items (proforma_id, categoria, referencia_tipo, referencia_id, orden_linea, descripcion, cantidad, precio_unitario, subtotal)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [id, it.categoria, it.referencia_tipo || null, it.referencia_id || null, orden++,
                 it.descripcion.trim(), parseFloat(it.cantidad), parseFloat(it.precio_unitario),
                 Math.round(parseFloat(it.cantidad) * parseFloat(it.precio_unitario) * 100) / 100]
            );
        }

        // Si la proforma ya tiene pagare automatico (aprobada desde una OT),
        // el 70% se mantiene sincronizado con el nuevo total.
        const pagareSincronizado = await sincronizarPagareConProforma(client, proforma);

        await client.query('COMMIT');

        const totalAnterior = Number(actualRows[0].total);
        registrarAccionBitacora({
            entidad_tipo: 'proforma', entidad_id: proforma.id, accion: 'actualizada',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Proforma ${proforma.numero} actualizada.` + (Math.abs(totalAnterior - Number(proforma.total)) >= 0.005 ? ` Total: $${totalAnterior.toFixed(2)} -> $${Number(proforma.total).toFixed(2)}.` : '')
                + (pagareSincronizado ? ` Pagare #${pagareSincronizado.id} recalculado a $${Number(pagareSincronizado.monto_total).toFixed(2)}.` : ''),
            metadata: { numero: proforma.numero, total_anterior: totalAnterior, total: Number(proforma.total), zonas: danos.zonas, pagare_id: pagareSincronizado?.id || null },
        });

        const { rows: items_final } = await pool.query('SELECT * FROM proforma_items WHERE proforma_id = $1 ORDER BY categoria, orden_linea', [id]);
        return res.json({ proforma: { ...proforma, items: items_final, zonas_danadas: danos.zonas } });
    } catch (err) {
        await client?.query('ROLLBACK');
        return responderError(res, err, 'Error al actualizar la proforma.');
    } finally {
        client?.release();
    }
};

// ─────────────────────────────────────────────────────────────
// CAMBIAR ESTADO
// PATCH /api/proformas/:id/estado   (soloStaff)
// ─────────────────────────────────────────────────────────────
const cambiarEstadoProforma = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    if (!estado || !ESTADOS.includes(estado)) return res.status(400).json({ error: `Estado invalido. Valores permitidos: ${ESTADOS.join(', ')}.` });
    if (estado === 'convertida') return res.status(400).json({ error: 'El estado "convertida" solo se asigna automaticamente al convertir la proforma en orden de trabajo.' });

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows: actualRows } = await client.query('SELECT * FROM proformas WHERE id = $1 FOR UPDATE', [id]);
        const actual = actualRows[0];
        if (!actual) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Proforma no encontrada.' }); }
        if (actual.estado === 'convertida') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Esta proforma ya fue convertida a orden de trabajo y no puede cambiar de estado.' }); }
        // Si la proforma ya desconto inventario y deja de estar aprobada
        // (rechazada, vencida, vuelve a borrador...), el material vuelve
        // automaticamente al inventario con un movimiento de devolucion.
        let devolucion = null;
        if (actual.inventario_descontado_at && estado !== 'aprobada') {
            devolucion = await revertirSalidaProforma(client, id, req.usuario, `Proforma pasa a "${estado}"`);
        }

        const { rows } = await client.query('UPDATE proformas SET estado = $1 WHERE id = $2 RETURNING *', [estado, id]);
        let proforma = rows[0];

        // Al aprobar se descuentan automaticamente del inventario los
        // productos vinculados (si falta stock, queda pendiente y se avisa).
        let inventario = null;
        if (estado === 'aprobada') {
            inventario = await descontarInventarioAutomatico(client, id, req.usuario);
            if (inventario.descontado && !inventario.ya_estaba) {
                proforma = (await client.query('SELECT * FROM proformas WHERE id = $1', [id])).rows[0];
            }
        }

        // Proforma creada desde una OT existente que se aprueba -> pagare 70%.
        let pagare = null;
        if (estado === 'aprobada' && proforma.orden_id) {
            pagare = await generarPagareAutomatico(client, { proforma, ordenId: proforma.orden_id, usuario: req.usuario });
        }
        // Proforma rechazada: su pagare automatico (si no tiene pagos) se anula.
        let pagareAnulado = null;
        if (estado === 'rechazada') {
            const { rows: anuladas } = await client.query(
                `UPDATE cuentas_cobrar SET estado = 'anulado'
                 WHERE proforma_id = $1 AND origen = 'automatico' AND estado <> 'anulado' AND monto_pagado = 0
                 RETURNING id`,
                [id]
            );
            pagareAnulado = anuladas[0]?.id || null;
        }

        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'proforma', entidad_id: Number(id), accion: `estado_${estado}`,
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Proforma ${actual.numero} cambio de estado "${actual.estado}" -> "${estado}".`,
            metadata: { numero: actual.numero, estado_anterior: actual.estado, estado_nuevo: estado },
        });
        if (pagare?.creada) registrarBitacoraPagare(req, pagare.cuenta, proforma, proforma.orden_id);
        if (inventario?.movimientos?.length) registrarBitacoraSalida(req, proforma, inventario.movimientos);
        if (devolucion?.devoluciones?.length) {
            registrarAccionBitacora({
                entidad_tipo: 'inventario', entidad_id: Number(id), accion: 'devolucion_por_proforma',
                usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
                detalle: `Devolucion automatica al inventario: la proforma ${actual.numero} paso a "${estado}" (${devolucion.devoluciones.length} producto(s)).`,
                metadata: { proforma_id: Number(id), movimientos: devolucion.devoluciones.map(d => d.id) },
            });
        }
        if (pagareAnulado) {
            registrarAccionBitacora({
                entidad_tipo: 'cuenta_cobrar', entidad_id: pagareAnulado, accion: 'anulada_automaticamente',
                usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
                detalle: `Pagare #${pagareAnulado} anulado porque la proforma ${actual.numero} fue rechazada (no tenia pagos).`,
                metadata: { proforma_id: Number(id) },
            });
        }

        return res.json({
            proforma, pagare: pagare?.cuenta || null,
            inventario: resumenInventario(inventario, devolucion),
        });
    } catch (err) {
        await client?.query('ROLLBACK');
        return responderError(res, err, 'Error al cambiar el estado de la proforma.');
    } finally {
        client?.release();
    }
};

/** Bitacora de una salida de inventario por proforma (manual o automatica). */
function registrarBitacoraSalida(req, proforma, movimientos) {
    const resumen = movimientos.map(m => `${m.repuesto_nombre} x${Number(m.cantidad)}`).join(', ');
    const ordenId = proforma.orden_generada_id || proforma.orden_id;
    registrarAccionBitacora({
        entidad_tipo: 'inventario', entidad_id: proforma.id, accion: 'salida_por_proforma',
        usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
        detalle: `Salida de inventario por proforma ${proforma.numero}${ordenId ? ` (${formatoOrden(ordenId)})` : ''} · ${proforma.cliente_nombre} · ${[proforma.vehiculo_marca, proforma.vehiculo_modelo, proforma.vehiculo_placa].filter(Boolean).join(' ')}: ${resumen}.`,
        metadata: {
            proforma_id: proforma.id, proforma_numero: proforma.numero, orden_id: ordenId || null,
            cliente_id: proforma.cliente_id, vehiculo_id: proforma.vehiculo_id,
            movimientos: movimientos.map(m => ({ movimiento_id: m.id, repuesto_id: m.repuesto_id, producto: m.repuesto_nombre, cantidad: Number(m.cantidad), area: m.area, precio_unitario: Number(m.precio_unitario) })),
        },
    });
}

/** Resumen para el frontend de lo que paso con el inventario al cambiar de estado. */
function resumenInventario(inventario, devolucion) {
    if (devolucion?.devoluciones?.length) return { accion: 'devuelto', productos: devolucion.devoluciones.length };
    if (!inventario || inventario.ya_estaba) return null;
    if (inventario.sin_items) return { accion: 'sin_items' };
    if (inventario.descontado) return { accion: 'descontado', productos: inventario.movimientos.length };
    return { accion: 'pendiente', motivo: inventario.motivo, detalle: inventario.detalle };
}

function registrarBitacoraPagare(req, cuenta, proforma, ordenId) {
    registrarAccionBitacora({
        entidad_tipo: 'cuenta_cobrar', entidad_id: cuenta.id, accion: 'creada_automatica',
        usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
        detalle: `Pagare #${cuenta.id} generado automaticamente: ${Number(cuenta.porcentaje)}% de $${Number(cuenta.monto_base).toFixed(2)} = $${Number(cuenta.monto_total).toFixed(2)} · ${formatoOrden(ordenId) || 'sin OT'} · ${proforma.numero} · ${proforma.cliente_nombre}.`,
        metadata: { cuenta_id: cuenta.id, proforma_id: proforma.id, proforma_numero: proforma.numero, orden_id: ordenId || null, cliente_id: proforma.cliente_id, vehiculo_id: proforma.vehiculo_id, monto_base: Number(cuenta.monto_base), porcentaje: Number(cuenta.porcentaje), monto_total: Number(cuenta.monto_total) },
    });
}

// ─────────────────────────────────────────────────────────────
// DUPLICAR
// POST /api/proformas/:id/duplicar   (soloStaff)
// ─────────────────────────────────────────────────────────────
const duplicarProforma = async (req, res) => {
    const { id } = req.params;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows: origRows } = await client.query('SELECT * FROM proformas WHERE id = $1', [id]);
        const original = origRows[0];
        if (!original) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Proforma no encontrada.' }); }

        const { rows: itemRows } = await client.query('SELECT * FROM proforma_items WHERE proforma_id = $1 ORDER BY id', [id]);

        const { rows: seqRows } = await client.query("SELECT nextval('proformas_numero_seq') AS n");
        const numero = `PROFORMA-${String(seqRows[0].n).padStart(6, '0')}`;

        const { rows: nuevaRows } = await client.query(
            `INSERT INTO proformas (
                numero, tipo, estado, cliente_id, vehiculo_id, sucursal_id, usuario_id,
                cliente_nombre, cliente_ruc, cliente_direccion, cliente_telefono, cliente_email,
                vehiculo_marca, vehiculo_modelo, vehiculo_anio, vehiculo_color, vehiculo_placa, vehiculo_vin, vehiculo_tipo,
                fecha_emision, fecha_validez, observaciones, condiciones, garantia, tiempo_estimado,
                descuento, iva_porcentaje, anticipo,
                subtotal_productos, subtotal_servicios, subtotal_mano_obra, subtotal_pintura, subtotal_repuestos, subtotal_insumos,
                subtotal, iva_valor, total, saldo,
                carroceria_tipo, carroceria_puertas, danos_observaciones
             ) VALUES (
                $1,$2,'borrador',$3,$4,$5,$6,
                $7,$8,$9,$10,$11,
                $12,$13,$14,$15,$16,$17,$18,
                CURRENT_DATE,$19,$20,$21,$22,$23,
                $24,$25,$26,
                $27,$28,$29,$30,$31,$32,
                $33,$34,$35,$36,
                $37,$38,$39
             ) RETURNING *`,
            [
                numero, original.tipo, original.cliente_id, original.vehiculo_id, original.sucursal_id, req.usuario.id,
                original.cliente_nombre, original.cliente_ruc, original.cliente_direccion, original.cliente_telefono, original.cliente_email,
                original.vehiculo_marca, original.vehiculo_modelo, original.vehiculo_anio, original.vehiculo_color, original.vehiculo_placa, original.vehiculo_vin, original.vehiculo_tipo,
                original.fecha_validez, original.observaciones, original.condiciones, original.garantia, original.tiempo_estimado,
                original.descuento, original.iva_porcentaje, original.anticipo,
                original.subtotal_productos, original.subtotal_servicios, original.subtotal_mano_obra,
                original.subtotal_pintura, original.subtotal_repuestos, original.subtotal_insumos,
                original.subtotal, original.iva_valor, original.total, original.saldo,
                original.carroceria_tipo, original.carroceria_puertas, original.danos_observaciones,
            ]
        );
        const nueva = nuevaRows[0];
        await guardarZonas(client, nueva.id, await obtenerZonas(client, id));

        for (const it of itemRows) {
            await client.query(
                `INSERT INTO proforma_items (proforma_id, categoria, referencia_tipo, referencia_id, orden_linea, descripcion, cantidad, precio_unitario, subtotal)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [nueva.id, it.categoria, it.referencia_tipo, it.referencia_id, it.orden_linea, it.descripcion, it.cantidad, it.precio_unitario, it.subtotal]
            );
        }

        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'proforma', entidad_id: nueva.id, accion: 'duplicada',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Proforma ${nueva.numero} creada como duplicado de ${original.numero}.`,
        });

        const { rows: items_final } = await pool.query('SELECT * FROM proforma_items WHERE proforma_id = $1 ORDER BY categoria, orden_linea', [nueva.id]);
        return res.status(201).json({ proforma: { ...nueva, items: items_final } });
    } catch (err) {
        await client?.query('ROLLBACK');
        return responderError(res, err, 'Error al duplicar la proforma.');
    } finally {
        client?.release();
    }
};

// ─────────────────────────────────────────────────────────────
// ELIMINAR — solo administrador (documento comercial, mas sensible que
// el resto del modulo que es soloStaff)
// DELETE /api/proformas/:id
// ─────────────────────────────────────────────────────────────
const eliminarProforma = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows: actualRows } = await pool.query('SELECT numero, estado FROM proformas WHERE id = $1', [id]);
        if (!actualRows[0]) return res.status(404).json({ error: 'Proforma no encontrada.' });
        if (actualRows[0].estado === 'convertida') {
            return res.status(409).json({ error: 'No se puede eliminar una proforma ya convertida a orden de trabajo.' });
        }
        const { rows: movRows } = await pool.query('SELECT COUNT(*)::int AS n FROM movimientos_inventario WHERE proforma_id = $1', [id]);
        if (movRows[0].n > 0) {
            return res.status(409).json({ error: 'Esta proforma tiene movimientos de inventario registrados (salidas o devoluciones) y no se puede eliminar para no perder la trazabilidad.' });
        }
        const { rows: ccRows } = await pool.query("SELECT COUNT(*)::int AS n FROM cuentas_cobrar WHERE proforma_id = $1 AND estado <> 'anulado'", [id]);
        if (ccRows[0].n > 0) {
            return res.status(409).json({ error: 'Esta proforma tiene un pagare/cuenta por cobrar activo. Anulalo antes de eliminar la proforma.' });
        }
        await pool.query('DELETE FROM proformas WHERE id = $1', [id]);

        registrarAccionBitacora({
            entidad_tipo: 'proforma', entidad_id: Number(id), accion: 'eliminada',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Proforma ${actualRows[0].numero} eliminada.`,
        });

        return res.json({ mensaje: 'Proforma eliminada correctamente.' });
    } catch (err) {
        return responderError(res, err, 'Error al eliminar la proforma.');
    }
};

// ─────────────────────────────────────────────────────────────
// GENERAR BORRADOR DESDE UNA ORDEN DE TRABAJO (no persiste nada; el
// usuario revisa/modifica y guarda con POST /api/proformas normal — asi
// es IMPOSIBLE que esto modifique la orden original).
// GET /api/proformas/desde-orden/:ordenId
// ─────────────────────────────────────────────────────────────
const generarDesdeOrden = async (req, res) => {
    const { ordenId } = req.params;
    try {
        const { rows: ordenRows } = await pool.query(
            `SELECT o.*, c.nombre AS cliente_nombre, c.cedula AS cliente_ruc, c.direccion AS cliente_direccion,
                    c.telefono AS cliente_telefono, c.email AS cliente_email,
                    v.marca AS vehiculo_marca, v.modelo AS vehiculo_modelo, v.anio AS vehiculo_anio,
                    v.color AS vehiculo_color, v.placa AS vehiculo_placa, v.vin AS vehiculo_vin
             FROM ordenes_trabajo o
             JOIN clientes c ON c.id = o.cliente_id
             LEFT JOIN vehiculos v ON v.id = o.vehiculo_id
             WHERE o.id = $1`,
            [ordenId]
        );
        const orden = ordenRows[0];
        if (!orden) return res.status(404).json({ error: 'Orden de trabajo no encontrada.' });
        if (!orden.vehiculo_id) return res.status(400).json({ error: 'La orden no tiene un vehiculo asociado; no se puede generar una proforma.' });

        // La orden de trabajo (ver auditoria del proyecto) no tiene una lista
        // estructurada de productos/servicios — solo una `descripcion` libre.
        // Se copia como una sola linea de servicio editable; el usuario
        // agrega/ajusta el resto antes de guardar.
        return res.json({
            borrador: {
                tipo: 'mecanica',
                orden_id: orden.id,
                cliente_id: orden.cliente_id,
                vehiculo_id: orden.vehiculo_id,
                cliente_nombre: orden.cliente_nombre, cliente_ruc: orden.cliente_ruc,
                cliente_direccion: orden.cliente_direccion, cliente_telefono: orden.cliente_telefono, cliente_email: orden.cliente_email,
                vehiculo_marca: orden.vehiculo_marca, vehiculo_modelo: orden.vehiculo_modelo, vehiculo_anio: orden.vehiculo_anio,
                vehiculo_color: orden.vehiculo_color, vehiculo_placa: orden.vehiculo_placa, vehiculo_vin: orden.vehiculo_vin,
                observaciones: orden.diagnostico || null,
                items: [{
                    categoria: 'servicio', descripcion: orden.descripcion, cantidad: 1, precio_unitario: 0,
                }],
            },
        });
    } catch (err) {
        console.error('Error generarDesdeOrden:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al generar la proforma desde la orden.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CONVERTIR A ORDEN DE TRABAJO
// POST /api/proformas/:id/convertir-orden   (soloStaff)
// ─────────────────────────────────────────────────────────────
const convertirAOrden = async (req, res) => {
    const { id } = req.params;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows: profRows } = await client.query('SELECT * FROM proformas WHERE id = $1 FOR UPDATE', [id]);
        const proforma = profRows[0];
        if (!proforma) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Proforma no encontrada.' }); }
        if (proforma.estado === 'convertida') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Esta proforma ya fue convertida a orden de trabajo.' }); }
        if (!proforma.cliente_id || !proforma.vehiculo_id) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'La proforma necesita un cliente y vehiculo del catalogo (no solo snapshot) para convertirse en orden.' });
        }

        const { rows: itemRows } = await client.query('SELECT descripcion FROM proforma_items WHERE proforma_id = $1 ORDER BY categoria, orden_linea', [id]);
        const descripcion = `Generado desde proforma ${proforma.numero}:\n` + itemRows.map(i => `- ${i.descripcion}`).join('\n');

        const { rows: ordenRows } = await client.query(
            `INSERT INTO ordenes_trabajo (cliente_id, vehiculo_id, usuario_id, estado, descripcion, fecha_ingreso)
             VALUES ($1,$2,$3,'pendiente',$4,CURRENT_DATE) RETURNING *`,
            [proforma.cliente_id, proforma.vehiculo_id, req.usuario.id, descripcion]
        );
        const orden = ordenRows[0];

        const { rows: convRows } = await client.query(
            "UPDATE proformas SET estado = 'convertida', orden_generada_id = $1 WHERE id = $2 RETURNING *",
            [orden.id, id]
        );
        // Si la proforma ya habia descontado inventario, esas salidas quedan
        // ahora ligadas tambien a la OT generada (trazabilidad completa).
        await client.query('UPDATE movimientos_inventario SET orden_id = $1 WHERE proforma_id = $2 AND orden_id IS NULL', [orden.id, id]);
        // Si aun no lo habia hecho, convertir en orden descuenta el material.
        const inventario = await descontarInventarioAutomatico(client, id, req.usuario);

        // Pagare automatico del 70% (no duplica si ya existe uno).
        const pagare = await generarPagareAutomatico(client, { proforma: convRows[0], ordenId: orden.id, usuario: req.usuario });

        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'proforma', entidad_id: proforma.id, accion: 'convertida_a_orden',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Proforma ${proforma.numero} convertida en orden de trabajo ${formatoOrden(orden.id)}.`,
            metadata: { numero: proforma.numero, orden_id: orden.id, pagare_id: pagare.cuenta?.id || null },
        });
        if (pagare.creada) registrarBitacoraPagare(req, pagare.cuenta, convRows[0], orden.id);
        if (inventario.movimientos?.length) registrarBitacoraSalida(req, convRows[0], inventario.movimientos);

        return res.status(201).json({
            orden, proforma_id: proforma.id, pagare: pagare.cuenta, pagare_creado: pagare.creada, pagare_motivo: pagare.motivo || null,
            inventario: resumenInventario(inventario, null),
        });
    } catch (err) {
        await client?.query('ROLLBACK');
        return responderError(res, err, 'Error al convertir la proforma en orden de trabajo.');
    } finally {
        client?.release();
    }
};

// ─────────────────────────────────────────────────────────────
// CONFIRMAR USO DE MATERIALES (salida de inventario)
// POST /api/proformas/:id/confirmar-uso   (soloStaff)
// Descuenta del inventario los items ligados a productos, en UNA sola
// transaccion, y es idempotente (un segundo intento responde 409 sin tocar
// el stock). Ver services/inventarioProforma.service.js.
// ─────────────────────────────────────────────────────────────
const confirmarUso = async (req, res) => {
    const { id } = req.params;
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { proforma, movimientos } = await confirmarUsoProforma(client, id, req.usuario);
        await client.query('COMMIT');

        registrarBitacoraSalida(req, proforma, movimientos);

        return res.status(201).json({
            mensaje: `Inventario descontado: ${movimientos.length} producto(s).`,
            proforma,
            movimientos: movimientos.map(m => ({ ...m, cantidad: Number(m.cantidad), stock_anterior: Number(m.stock_anterior), stock_nuevo: Number(m.stock_nuevo) })),
        });
    } catch (err) {
        await client?.query('ROLLBACK');
        return responderError(res, err, 'Error al descontar el inventario de la proforma.');
    } finally {
        client?.release();
    }
};

// ─────────────────────────────────────────────────────────────
// REVERTIR SALIDA DE INVENTARIO (devolucion) — solo administrador
// POST /api/proformas/:id/revertir-salida   body: { motivo }
// ─────────────────────────────────────────────────────────────
const revertirSalida = async (req, res) => {
    const { id } = req.params;
    const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim().slice(0, 200) : '';
    if (!motivo) return res.status(400).json({ error: 'Indica el motivo de la devolucion al inventario.' });
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { proforma, devoluciones } = await revertirSalidaProforma(client, id, req.usuario, motivo);
        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'inventario', entidad_id: proforma.id, accion: 'devolucion_por_proforma',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Devolucion al inventario de la salida de la proforma ${proforma.numero} (${devoluciones.length} producto(s)). Motivo: ${motivo}.`,
            metadata: { proforma_id: proforma.id, proforma_numero: proforma.numero, motivo, movimientos: devoluciones.map(d => d.id) },
        });
        return res.json({ mensaje: 'Salida revertida: el stock fue devuelto al inventario.', proforma, devoluciones: devoluciones.length });
    } catch (err) {
        await client?.query('ROLLBACK');
        return responderError(res, err, 'Error al revertir la salida de inventario.');
    } finally {
        client?.release();
    }
};

module.exports = {
    listarProformas, obtenerProforma, crearProforma, actualizarProforma,
    cambiarEstadoProforma, duplicarProforma, eliminarProforma,
    generarDesdeOrden, convertirAOrden, calcularTotales,
    confirmarUso, revertirSalida, validarCarroceria,
};
