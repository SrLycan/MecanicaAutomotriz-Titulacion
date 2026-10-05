/**
 * SS SWAP - Salida de inventario a partir de una proforma
 *
 * Flujo: PROFORMA -> ITEMS (referencia_tipo='repuesto') -> REPUESTOS ->
 *        MOVIMIENTO DE SALIDA (origen='proforma').
 *
 * Todas las funciones reciben un `client` YA dentro de una transaccion
 * (BEGIN hecho por el controller) y lanzan ErrorNegocio ante cualquier
 * problema, para que el controller haga ROLLBACK completo: nunca queda un
 * stock actualizado sin su movimiento ni al reves.
 *
 * Protecciones (en capas):
 *  1. `SELECT ... FOR UPDATE` sobre la proforma: dos confirmaciones
 *     simultaneas de la misma proforma se serializan.
 *  2. `proformas.inventario_descontado_at`: si ya tiene valor, se rechaza.
 *  3. Indice UNIQUE parcial `uq_mov_salida_por_item_proforma`: aunque las
 *     dos capas anteriores fallaran, Postgres no permite una segunda salida
 *     activa para el mismo item.
 *  4. `FOR UPDATE` sobre cada repuesto (ordenado por id para evitar
 *     deadlocks) + validacion de stock de TODA la proforma antes de tocar
 *     nada + CHECK (stock_actual >= 0) en la tabla.
 *  5. Trigger `trg_proteger_item_proforma_con_salida`: un item con salida
 *     activa no se puede borrar (protege la edicion/eliminacion).
 */
const { redondear2 } = require('../utils/numeros');

const ESTADOS_PERMITIDOS_SALIDA = ['aprobada', 'convertida'];

class ErrorNegocio extends Error {
    constructor(status, mensaje, detalle = null) {
        super(mensaje);
        this.status = status;
        this.detalle = detalle;
    }
}

const formatoOrden = (id) => (id ? `OT-${String(id).padStart(6, '0')}` : null);

/** Items de la proforma ligados a un repuesto del inventario. */
async function itemsDeInventario(client, proformaId) {
    const { rows } = await client.query(
        `SELECT * FROM proforma_items
         WHERE proforma_id = $1 AND referencia_tipo = 'repuesto' AND referencia_id IS NOT NULL
         ORDER BY orden_linea, id`,
        [proformaId]
    );
    return rows;
}

/**
 * Confirma el uso de materiales de una proforma: descuenta stock y crea un
 * movimiento de salida por cada item ligado al inventario.
 * @returns {{proforma, movimientos: object[]}}
 */
async function confirmarUsoProforma(client, proformaId, usuario) {
    const { rows: profRows } = await client.query('SELECT * FROM proformas WHERE id = $1 FOR UPDATE', [proformaId]);
    const proforma = profRows[0];
    if (!proforma) throw new ErrorNegocio(404, 'Proforma no encontrada.');

    if (proforma.inventario_descontado_at) {
        throw new ErrorNegocio(409, `La proforma ${proforma.numero} ya desconto su inventario el ${new Date(proforma.inventario_descontado_at).toLocaleString('es-EC')}. No se puede volver a descontar.`);
    }
    if (!ESTADOS_PERMITIDOS_SALIDA.includes(proforma.estado)) {
        throw new ErrorNegocio(409, `Solo se puede confirmar el uso de materiales de una proforma aprobada o convertida a orden (estado actual: "${proforma.estado}").`);
    }

    const items = await itemsDeInventario(client, proformaId);
    if (!items.length) {
        throw new ErrorNegocio(400, 'Esta proforma no tiene productos/insumos seleccionados desde el inventario.');
    }

    // Cantidad total pedida por repuesto (un mismo repuesto puede estar en
    // varias lineas): se valida contra el stock ANTES de tocar nada.
    const totalPorRepuesto = new Map();
    for (const it of items) {
        totalPorRepuesto.set(it.referencia_id, redondear2((totalPorRepuesto.get(it.referencia_id) || 0) + Number(it.cantidad)));
    }
    const idsOrdenados = [...totalPorRepuesto.keys()].sort((a, b) => a - b);
    const { rows: repRows } = await client.query(
        'SELECT id, codigo, nombre, stock_actual, area, activo, unidad_medida FROM repuestos WHERE id = ANY($1::int[]) ORDER BY id FOR UPDATE',
        [idsOrdenados]
    );
    const repuestos = new Map(repRows.map(r => [r.id, { ...r, stock_actual: Number(r.stock_actual) }]));

    const faltantes = [];
    for (const [repId, pedido] of totalPorRepuesto) {
        const r = repuestos.get(repId);
        if (!r || !r.activo) {
            const it = items.find(i => i.referencia_id === repId);
            faltantes.push(`"${it.descripcion}": el producto ya no existe o esta inactivo en el inventario.`);
        } else if (r.stock_actual < pedido) {
            faltantes.push(`"${r.nombre}" (${r.codigo}): stock disponible ${r.stock_actual} ${r.unidad_medida}, se necesitan ${pedido}.`);
        }
    }
    if (faltantes.length) {
        throw new ErrorNegocio(409, 'Stock insuficiente. No se desconto ningun producto.', faltantes);
    }

    const ordenId = proforma.orden_generada_id || proforma.orden_id || null;
    const movimientos = [];
    for (const it of items) {
        const r = repuestos.get(it.referencia_id);
        const cantidad = redondear2(Number(it.cantidad));
        const stockAnterior = r.stock_actual;
        const stockNuevo = redondear2(stockAnterior - cantidad);

        await client.query('UPDATE repuestos SET stock_actual = $1 WHERE id = $2', [stockNuevo, r.id]);
        const { rows } = await client.query(
            `INSERT INTO movimientos_inventario
                (repuesto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia,
                 origen, area, proforma_id, proforma_item_id, orden_id, precio_unitario)
             VALUES ($1,$2,'salida',$3,$4,$5,$6,$7,'proforma',$8,$9,$10,$11,$12)
             RETURNING *`,
            [r.id, usuario.id, cantidad, stockAnterior, stockNuevo,
             `Salida por proforma ${proforma.numero}${ordenId ? ` · ${formatoOrden(ordenId)}` : ''}`,
             proforma.numero, r.area, proforma.id, it.id, ordenId, Number(it.precio_unitario)]
        );
        r.stock_actual = stockNuevo; // por si el mismo repuesto aparece en otra linea
        movimientos.push({ ...rows[0], repuesto_nombre: r.nombre, repuesto_codigo: r.codigo });
    }

    const { rows: actualizada } = await client.query(
        'UPDATE proformas SET inventario_descontado_at = NOW(), inventario_descontado_por = $1 WHERE id = $2 RETURNING *',
        [usuario.id, proforma.id]
    );
    return { proforma: actualizada[0], movimientos };
}

/**
 * Devuelve al inventario TODAS las salidas activas de una proforma (solo
 * administrador). No borra nada: marca cada salida como revertida y crea un
 * movimiento de entrada con origen 'devolucion' que la referencia.
 */
async function revertirSalidaProforma(client, proformaId, usuario, motivo) {
    const { rows: profRows } = await client.query('SELECT * FROM proformas WHERE id = $1 FOR UPDATE', [proformaId]);
    const proforma = profRows[0];
    if (!proforma) throw new ErrorNegocio(404, 'Proforma no encontrada.');
    if (!proforma.inventario_descontado_at) throw new ErrorNegocio(409, 'Esta proforma no tiene una salida de inventario activa.');

    const { rows: salidas } = await client.query(
        `SELECT * FROM movimientos_inventario
         WHERE proforma_id = $1 AND origen = 'proforma' AND tipo = 'salida' AND revertido_at IS NULL
         ORDER BY repuesto_id, id`,
        [proformaId]
    );
    const devoluciones = [];
    for (const s of salidas) {
        const { rows: repRows } = await client.query('SELECT id, nombre, stock_actual, area FROM repuestos WHERE id = $1 FOR UPDATE', [s.repuesto_id]);
        const r = repRows[0];
        const stockAnterior = Number(r.stock_actual);
        const stockNuevo = redondear2(stockAnterior + Number(s.cantidad));
        await client.query('UPDATE repuestos SET stock_actual = $1 WHERE id = $2', [stockNuevo, r.id]);
        await client.query('UPDATE movimientos_inventario SET revertido_at = NOW() WHERE id = $1', [s.id]);
        const { rows } = await client.query(
            `INSERT INTO movimientos_inventario
                (repuesto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia,
                 origen, area, proforma_id, orden_id, movimiento_revertido_id, precio_unitario)
             VALUES ($1,$2,'entrada',$3,$4,$5,$6,$7,'devolucion',$8,$9,$10,$11,$12)
             RETURNING *`,
            [r.id, usuario.id, s.cantidad, stockAnterior, stockNuevo,
             `Devolucion de salida por proforma ${proforma.numero}${motivo ? `: ${motivo}` : ''}`,
             proforma.numero, r.area, proforma.id, s.orden_id, s.id, s.precio_unitario]
        );
        devoluciones.push(rows[0]);
    }
    const { rows: actualizada } = await client.query(
        'UPDATE proformas SET inventario_descontado_at = NULL, inventario_descontado_por = NULL WHERE id = $1 RETURNING *',
        [proformaId]
    );
    return { proforma: actualizada[0], devoluciones };
}

module.exports = { confirmarUsoProforma, revertirSalidaProforma, ErrorNegocio, formatoOrden, ESTADOS_PERMITIDOS_SALIDA };
