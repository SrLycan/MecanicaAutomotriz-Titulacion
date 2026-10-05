/**
 * SS SWAP - Controlador de Cuentas por Cobrar de Clientes ("Pagaré")
 *
 * Contraparte de movimientos_financieros_proveedor pero del lado de
 * clientes: permite ver quien debe, cuanto, registrar pagos parciales o
 * totales, y cambiar el estado manualmente cuando haga falta.
 *
 * El estado se recalcula automaticamente cada vez que se registra un pago
 * (pendiente -> parcial -> pagado), pero tambien se puede forzar a mano
 * (ej. marcar 'vencido' o 'anulado') via cambiarEstadoCuenta.
 */
const pool = require('../config/db');
const { registrarAccionBitacora } = require('../services/ordenesHistorial.service');

const ESTADOS = ['pendiente', 'parcial', 'pagado', 'vencido', 'anulado'];
const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'];

// Sprint 14: datos adicionales por metodo de pago. Solo se guardan los
// campos del metodo elegido (los demas quedan en NULL), y los obligatorios
// se validan en el servidor, no solo en el formulario.
const CAMPOS_PAGO = ['banco', 'numero_cuenta', 'tipo_cuenta', 'titular', 'numero_comprobante', 'numero_cheque', 'fecha_documento', 'tarjeta_tipo', 'tarjeta_ultimos4', 'autorizacion'];
const CAMPOS_POR_METODO = {
    efectivo: { permitidos: [], obligatorios: [] },
    otro: { permitidos: [], obligatorios: [] },
    transferencia: {
        permitidos: ['banco', 'numero_cuenta', 'tipo_cuenta', 'titular', 'numero_comprobante', 'fecha_documento'],
        obligatorios: ['banco', 'numero_cuenta', 'titular', 'numero_comprobante', 'fecha_documento'],
    },
    cheque: {
        permitidos: ['banco', 'numero_cheque', 'numero_cuenta', 'titular', 'fecha_documento'],
        obligatorios: ['banco', 'numero_cheque', 'numero_cuenta', 'titular', 'fecha_documento'],
    },
    tarjeta: {
        permitidos: ['tarjeta_tipo', 'tarjeta_ultimos4', 'banco', 'autorizacion'],
        obligatorios: ['tarjeta_tipo', 'autorizacion'],
    },
};
const ETIQUETA_CAMPO = {
    banco: 'Banco', numero_cuenta: 'Número de cuenta', tipo_cuenta: 'Tipo de cuenta', titular: 'Titular',
    numero_comprobante: 'Número de comprobante', numero_cheque: 'Número de cheque', fecha_documento: 'Fecha',
    tarjeta_tipo: 'Tipo de tarjeta', tarjeta_ultimos4: 'Últimos 4 dígitos', autorizacion: 'Código de autorización',
};

/** Devuelve { datos } con solo los campos del metodo, o { error }. */
function validarDetallePago(metodo, body) {
    const reglas = CAMPOS_POR_METODO[metodo] || CAMPOS_POR_METODO.otro;
    const datos = Object.fromEntries(CAMPOS_PAGO.map(c => [c, null]));
    for (const c of reglas.permitidos) {
        const v = body[c];
        datos[c] = typeof v === 'string' ? (v.trim() || null) : (v ?? null);
    }
    const falta = reglas.obligatorios.find(c => !datos[c]);
    if (falta) return { error: `Para pagos con ${metodo}, el campo "${ETIQUETA_CAMPO[falta]}" es obligatorio.` };
    if (datos.tipo_cuenta && !['ahorros', 'corriente'].includes(datos.tipo_cuenta)) return { error: 'Tipo de cuenta invalido (ahorros o corriente).' };
    if (datos.tarjeta_tipo && !['credito', 'debito'].includes(datos.tarjeta_tipo)) return { error: 'Tipo de tarjeta invalido (credito o debito).' };
    if (datos.tarjeta_ultimos4 && !/^\d{4}$/.test(datos.tarjeta_ultimos4)) return { error: 'Los ultimos digitos de la tarjeta deben ser exactamente 4 numeros.' };
    if (datos.fecha_documento && !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha_documento)) return { error: 'Fecha invalida (formato AAAA-MM-DD).' };
    const largos = { banco: 100, numero_cuenta: 40, titular: 150, numero_comprobante: 60, numero_cheque: 40, autorizacion: 40 };
    const largo = Object.entries(largos).find(([c, max]) => datos[c] && String(datos[c]).length > max);
    if (largo) return { error: `El campo "${ETIQUETA_CAMPO[largo[0]]}" es demasiado largo (maximo ${largo[1]} caracteres).` };
    return { datos };
}

/** Texto legible del detalle de un pago (bitacora / historial). */
function resumenDetallePago(metodo, d) {
    const partes = [];
    if (metodo === 'transferencia') {
        if (d.banco) partes.push(`Banco: ${d.banco}`);
        if (d.numero_cuenta) partes.push(`Cuenta: ${d.numero_cuenta}${d.tipo_cuenta ? ` (${d.tipo_cuenta})` : ''}`);
        if (d.titular) partes.push(`Titular: ${d.titular}`);
        if (d.numero_comprobante) partes.push(`Comprobante: ${d.numero_comprobante}`);
    } else if (metodo === 'cheque') {
        if (d.banco) partes.push(`Banco: ${d.banco}`);
        if (d.numero_cheque) partes.push(`Cheque: ${d.numero_cheque}`);
        if (d.numero_cuenta) partes.push(`Cuenta: ${d.numero_cuenta}`);
        if (d.titular) partes.push(`Titular: ${d.titular}`);
    } else if (metodo === 'tarjeta') {
        if (d.tarjeta_tipo) partes.push(`Tarjeta de ${d.tarjeta_tipo}`);
        if (d.tarjeta_ultimos4) partes.push(`**** ${d.tarjeta_ultimos4}`);
        if (d.autorizacion) partes.push(`Autorizacion: ${d.autorizacion}`);
    }
    return partes.join(' · ');
}

const formatoOrden = (id) => (id ? `OT-${String(id).padStart(6, '0')}` : null);

// Columnas comunes para listar/obtener: cliente, vehiculo, OT, proforma y
// porcentajes pagado/pendiente calculados en SQL.
const SELECT_CUENTA = `
    SELECT cc.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email,
           c.cedula AS cliente_cedula,
           (cc.monto_total - cc.monto_pagado) AS saldo,
           CASE WHEN cc.monto_total > 0 THEN ROUND(cc.monto_pagado * 100 / cc.monto_total, 2) ELSE 0 END AS porcentaje_pagado,
           CASE WHEN cc.monto_total > 0 THEN ROUND((cc.monto_total - cc.monto_pagado) * 100 / cc.monto_total, 2) ELSE 0 END AS porcentaje_pendiente,
           p.numero AS proforma_numero, p.total AS proforma_total,
           COALESCE(v.placa, p.vehiculo_placa) AS vehiculo_placa,
           NULLIF(TRIM(CONCAT_WS(' ', COALESCE(v.marca, p.vehiculo_marca), COALESCE(v.modelo, p.vehiculo_modelo))), '') AS vehiculo_descripcion,
           u.nombre AS usuario_nombre
    FROM cuentas_cobrar cc
    JOIN clientes c ON c.id = cc.cliente_id
    LEFT JOIN proformas p ON p.id = cc.proforma_id
    LEFT JOIN vehiculos v ON v.id = COALESCE(cc.vehiculo_id, p.vehiculo_id)
    LEFT JOIN usuarios u ON u.id = cc.usuario_id`;
const conNumeroOrden = (c) => ({ ...c, orden_numero: formatoOrden(c.orden_id) });

/** Recalcula el estado automatico a partir de monto_total/monto_pagado (no toca 'anulado' ni 'vencido', esos son manuales). */
function estadoAutomatico(montoTotal, montoPagado, estadoActual) {
    if (estadoActual === 'anulado') return 'anulado';
    if (montoPagado >= montoTotal) return 'pagado';
    if (montoPagado > 0) return 'parcial';
    return estadoActual === 'vencido' ? 'vencido' : 'pendiente';
}

// ─────────────────────────────────────────────────────────────
// LISTAR
// GET /api/cuentas-cobrar?cliente_id=&estado=&q=&fecha_inicio=&fecha_fin=&page=&limit=
// ─────────────────────────────────────────────────────────────
const listarCuentas = async (req, res) => {
    const { cliente_id, estado, q, fecha_inicio, fecha_fin, origen, page = 1, limit = 20 } = req.query;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    let where = 'WHERE 1=1';
    const params = [];
    if (cliente_id) { params.push(cliente_id); where += ` AND cc.cliente_id = $${params.length}`; }
    if (estado && ESTADOS.includes(estado)) { params.push(estado); where += ` AND cc.estado = $${params.length}`; }
    if (fecha_inicio) { params.push(fecha_inicio); where += ` AND cc.fecha >= $${params.length}`; }
    if (fecha_fin) { params.push(fecha_fin); where += ` AND cc.fecha <= $${params.length}`; }
    if (origen && ['manual', 'automatico'].includes(origen)) { params.push(origen); where += ` AND cc.origen = $${params.length}`; }
    if (q) {
        params.push(`%${q}%`);
        const i = params.length;
        // Busca tambien por numero de proforma, placa u OT (OT-000123 o 123).
        params.push(String(q).replace(/\D/g, '') || null);
        where += ` AND (c.nombre ILIKE $${i} OR cc.concepto ILIKE $${i} OR p.numero ILIKE $${i} OR p.vehiculo_placa ILIKE $${i}
                   OR ($${i + 1}::text IS NOT NULL AND cc.orden_id::text = LTRIM($${i + 1}::text, '0')))`;
    }

    const countQuery = `SELECT COUNT(*) AS total FROM cuentas_cobrar cc JOIN clientes c ON c.id = cc.cliente_id LEFT JOIN proformas p ON p.id = cc.proforma_id ${where}`;
    const dataQuery = `
        ${SELECT_CUENTA}
        ${where}
        ORDER BY
            CASE cc.estado WHEN 'vencido' THEN 0 WHEN 'pendiente' THEN 1 WHEN 'parcial' THEN 2 ELSE 3 END,
            cc.fecha_vencimiento ASC NULLS LAST,
            cc.created_at DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    try {
        const [{ rows: countRows }, { rows }] = await Promise.all([
            pool.query(countQuery, params),
            pool.query(dataQuery, [...params, limitNum, offset]),
        ]);
        const total = parseInt(countRows[0].total, 10);
        return res.json({ cuentas: rows.map(conNumeroOrden), total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
    } catch (err) {
        console.error('Error listarCuentas:', err);
        return res.status(500).json({ error: 'Error al obtener las cuentas por cobrar.' });
    }
};

// ─────────────────────────────────────────────────────────────
// OBTENER UNA (con historial de pagos)
// GET /api/cuentas-cobrar/:id
// ─────────────────────────────────────────────────────────────
const obtenerCuenta = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(`${SELECT_CUENTA} WHERE cc.id = $1`, [id]);
        const cuenta = rows[0];
        if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada.' });

        const { rows: pagos } = await pool.query(
            `SELECT p.*, u.nombre AS usuario_nombre, ua.nombre AS anulado_por_nombre FROM pagos_cliente p
             LEFT JOIN usuarios u ON u.id = p.usuario_id
             LEFT JOIN usuarios ua ON ua.id = p.anulado_por
             WHERE p.cuenta_id = $1 ORDER BY p.fecha DESC, p.id DESC`,
            [id]
        );

        return res.json({ cuenta: { ...conNumeroOrden(cuenta), pagos: pagos.map(pg => ({ ...pg, detalle: resumenDetallePago(pg.metodo_pago, pg) })) } });
    } catch (err) {
        console.error('Error obtenerCuenta:', err);
        return res.status(500).json({ error: 'Error al obtener la cuenta.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CREAR
// POST /api/cuentas-cobrar
// ─────────────────────────────────────────────────────────────
const crearCuenta = async (req, res) => {
    const { cliente_id, proforma_id, orden_id, vehiculo_id, concepto, monto_total, fecha, fecha_vencimiento, notas } = req.body;
    const usuario_id = req.usuario.id;

    if (!cliente_id) return res.status(400).json({ error: 'El cliente es obligatorio.' });
    if (!concepto || !concepto.trim()) return res.status(400).json({ error: 'El concepto es obligatorio.' });
    if (!monto_total || parseFloat(monto_total) <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });

    try {
        const { rows: clienteRows } = await pool.query('SELECT id FROM clientes WHERE id = $1', [cliente_id]);
        if (!clienteRows[0]) return res.status(404).json({ error: 'Cliente no encontrado.' });

        if (proforma_id) {
            const { rows } = await pool.query('SELECT id FROM proformas WHERE id = $1 AND cliente_id = $2', [proforma_id, cliente_id]);
            if (!rows[0]) return res.status(404).json({ error: 'La proforma indicada no pertenece a este cliente.' });
        }
        if (orden_id) {
            const { rows } = await pool.query('SELECT id FROM ordenes_trabajo WHERE id = $1 AND cliente_id = $2', [orden_id, cliente_id]);
            if (!rows[0]) return res.status(404).json({ error: 'La orden indicada no pertenece a este cliente.' });
        }
        if (vehiculo_id) {
            const { rows } = await pool.query('SELECT id FROM vehiculos WHERE id = $1 AND cliente_id = $2', [vehiculo_id, cliente_id]);
            if (!rows[0]) return res.status(404).json({ error: 'El vehiculo indicado no pertenece a este cliente.' });
        }

        const { rows } = await pool.query(
            `INSERT INTO cuentas_cobrar (cliente_id, proforma_id, orden_id, vehiculo_id, concepto, monto_total, monto_base, fecha, fecha_vencimiento, notas, usuario_id, origen)
             VALUES ($1,$2,$3,$4,$5,$6,$6,COALESCE($7, CURRENT_DATE),$8,$9,$10,'manual')
             RETURNING *`,
            [cliente_id, proforma_id || null, orden_id || null, vehiculo_id || null, concepto.trim(), parseFloat(monto_total),
             fecha || null, fecha_vencimiento || null, notas || null, usuario_id]
        );
        const cuenta = rows[0];

        registrarAccionBitacora({
            entidad_tipo: 'cuenta_cobrar', entidad_id: cuenta.id, accion: 'creada',
            usuario_id, usuario_nombre: req.usuario.nombre,
            detalle: `Cuenta por cobrar de $${cuenta.monto_total} registrada ("${cuenta.concepto}").`,
        });

        return res.status(201).json({ cuenta: { ...cuenta, saldo: cuenta.monto_total } });
    } catch (err) {
        console.error('Error crearCuenta:', err);
        return res.status(500).json({ error: 'Error al crear la cuenta por cobrar.' });
    }
};

// ─────────────────────────────────────────────────────────────
// ACTUALIZAR (concepto, fecha de vencimiento, notas — y monto_total solo
// si todavia no tiene pagos registrados, para no desincronizar el saldo)
// PUT /api/cuentas-cobrar/:id
// ─────────────────────────────────────────────────────────────
const actualizarCuenta = async (req, res) => {
    const { id } = req.params;
    const { concepto, monto_total, fecha_vencimiento, notas } = req.body;
    if (!concepto || !concepto.trim()) return res.status(400).json({ error: 'El concepto es obligatorio.' });
    if (!monto_total || parseFloat(monto_total) <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });

    try {
        const { rows: actualRows } = await pool.query('SELECT monto_pagado, monto_total, estado, origen FROM cuentas_cobrar WHERE id = $1', [id]);
        if (!actualRows[0]) return res.status(404).json({ error: 'Cuenta no encontrada.' });
        const { monto_pagado, estado } = actualRows[0];
        // El monto de un pagare automatico lo fija la regla del 70% de la
        // proforma: no se edita a mano (se recalcula si cambia la proforma).
        if (actualRows[0].origen === 'automatico' && Math.abs(parseFloat(monto_total) - parseFloat(actualRows[0].monto_total)) >= 0.005) {
            return res.status(409).json({ error: 'El monto de un pagare automatico corresponde al 70% de la proforma y no se puede modificar manualmente.' });
        }

        if (parseFloat(monto_total) < parseFloat(monto_pagado)) {
            return res.status(409).json({ error: `El monto no puede ser menor a lo ya pagado ($${monto_pagado}).` });
        }

        const nuevoEstado = estadoAutomatico(parseFloat(monto_total), parseFloat(monto_pagado), estado);
        const { rows } = await pool.query(
            `UPDATE cuentas_cobrar SET concepto=$1, monto_total=$2, fecha_vencimiento=$3, notas=$4, estado=$5
             WHERE id=$6 RETURNING *`,
            [concepto.trim(), parseFloat(monto_total), fecha_vencimiento || null, notas || null, nuevoEstado, id]
        );

        registrarAccionBitacora({
            entidad_tipo: 'cuenta_cobrar', entidad_id: Number(id), accion: 'actualizada',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Cuenta por cobrar #${id} actualizada (monto $${parseFloat(actualRows[0].monto_total).toFixed(2)} -> $${parseFloat(monto_total).toFixed(2)}).`,
            metadata: { cuenta_id: Number(id), monto_anterior: parseFloat(actualRows[0].monto_total), monto_nuevo: parseFloat(monto_total) },
        });

        return res.json({ cuenta: { ...rows[0], saldo: rows[0].monto_total - rows[0].monto_pagado } });
    } catch (err) {
        console.error('Error actualizarCuenta:', err);
        return res.status(500).json({ error: 'Error al actualizar la cuenta.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CAMBIAR ESTADO manualmente (vencido / anulado / reabrir a pendiente)
// PATCH /api/cuentas-cobrar/:id/estado
// ─────────────────────────────────────────────────────────────
const cambiarEstadoCuenta = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    if (!estado || !ESTADOS.includes(estado)) return res.status(400).json({ error: `Estado invalido. Valores permitidos: ${ESTADOS.join(', ')}.` });

    try {
        const { rows: actualRows } = await pool.query('SELECT * FROM cuentas_cobrar WHERE id = $1', [id]);
        if (!actualRows[0]) return res.status(404).json({ error: 'Cuenta no encontrada.' });

        const { rows } = await pool.query('UPDATE cuentas_cobrar SET estado = $1 WHERE id = $2 RETURNING *', [estado, id]);

        registrarAccionBitacora({
            entidad_tipo: 'cuenta_cobrar', entidad_id: Number(id), accion: `estado_${estado}`,
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Cuenta por cobrar #${id} cambio de estado "${actualRows[0].estado}" -> "${estado}".`,
            metadata: { cuenta_id: Number(id), estado_anterior: actualRows[0].estado, estado_nuevo: estado, orden_id: actualRows[0].orden_id, proforma_id: actualRows[0].proforma_id },
        });

        return res.json({ cuenta: { ...rows[0], saldo: rows[0].monto_total - rows[0].monto_pagado } });
    } catch (err) {
        console.error('Error cambiarEstadoCuenta:', err);
        return res.status(500).json({ error: 'Error al cambiar el estado de la cuenta.' });
    }
};

// ─────────────────────────────────────────────────────────────
// REGISTRAR PAGO (abono o pago total) — recalcula monto_pagado y estado
// POST /api/cuentas-cobrar/:id/pagos
// ─────────────────────────────────────────────────────────────
const registrarPago = async (req, res) => {
    const { id } = req.params;
    const { monto, fecha, referencia, notas } = req.body;
    const metodo_pago = req.body.metodo_pago || 'efectivo';
    const usuario_id = req.usuario.id;

    if (!monto || parseFloat(monto) <= 0) return res.status(400).json({ error: 'El monto del pago debe ser mayor a cero.' });
    if (!METODOS.includes(metodo_pago)) return res.status(400).json({ error: 'Metodo de pago invalido.' });
    const detallePago = validarDetallePago(metodo_pago, req.body);
    if (detallePago.error) return res.status(400).json({ error: detallePago.error });
    const d = detallePago.datos;
    // La referencia general se completa con el comprobante/cheque si no se envio.
    const referenciaFinal = (referencia && String(referencia).trim()) || d.numero_comprobante || d.numero_cheque || d.autorizacion || null;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const { rows: cuentaRows } = await client.query('SELECT * FROM cuentas_cobrar WHERE id = $1 FOR UPDATE', [id]);
        const cuenta = cuentaRows[0];
        if (!cuenta) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Cuenta no encontrada.' }); }
        if (cuenta.estado === 'anulado') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Esta cuenta esta anulada, no se pueden registrar pagos.' }); }

        const saldoActual = parseFloat(cuenta.monto_total) - parseFloat(cuenta.monto_pagado);
        if (parseFloat(monto) > saldoActual + 0.01) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `El pago ($${monto}) no puede superar el saldo pendiente ($${saldoActual.toFixed(2)}).` });
        }

        const { rows: pagoRows } = await client.query(
            `INSERT INTO pagos_cliente (cuenta_id, monto, fecha, metodo_pago, referencia, notas, usuario_id,
                banco, numero_cuenta, tipo_cuenta, titular, numero_comprobante, numero_cheque, fecha_documento,
                tarjeta_tipo, tarjeta_ultimos4, autorizacion)
             VALUES ($1,$2,COALESCE($3, CURRENT_DATE),$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
            [id, parseFloat(monto), fecha || null, metodo_pago, referenciaFinal, notas || null, usuario_id,
             d.banco, d.numero_cuenta, d.tipo_cuenta, d.titular, d.numero_comprobante, d.numero_cheque, d.fecha_documento,
             d.tarjeta_tipo, d.tarjeta_ultimos4, d.autorizacion]
        );

        const nuevoMontoPagado = Math.round((parseFloat(cuenta.monto_pagado) + parseFloat(monto)) * 100) / 100;
        const nuevoEstado = estadoAutomatico(parseFloat(cuenta.monto_total), nuevoMontoPagado, cuenta.estado);

        const { rows: cuentaActualizada } = await client.query(
            'UPDATE cuentas_cobrar SET monto_pagado = $1, estado = $2 WHERE id = $3 RETURNING *',
            [nuevoMontoPagado, nuevoEstado, id]
        );

        await client.query('COMMIT');

        const c = cuentaActualizada[0];
        const resumen = resumenDetallePago(metodo_pago, d);
        registrarAccionBitacora({
            entidad_tipo: 'pago', entidad_id: pagoRows[0].id, accion: `pago_${metodo_pago}`,
            usuario_id, usuario_nombre: req.usuario.nombre,
            detalle: `Pago de $${parseFloat(monto).toFixed(2)} (${metodo_pago.toUpperCase()}) al pagare #${id}${c.orden_id ? ` · ${formatoOrden(c.orden_id)}` : ''}. ${resumen ? `${resumen}. ` : ''}Saldo: $${(c.monto_total - c.monto_pagado).toFixed(2)}. Estado: ${nuevoEstado}.`,
            metadata: { pago_id: pagoRows[0].id, cuenta_id: Number(id), cliente_id: c.cliente_id, orden_id: c.orden_id, proforma_id: c.proforma_id, monto: parseFloat(monto), metodo_pago, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v)) },
        });

        return res.status(201).json({ pago: { ...pagoRows[0], detalle: resumen }, cuenta: { ...c, saldo: c.monto_total - c.monto_pagado } });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error registrarPago:', err);
        return res.status(500).json({ error: 'Error al registrar el pago.' });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────
// ANULAR UN PAGO (si se registro por error) — recalcula monto_pagado y estado
// DELETE /api/cuentas-cobrar/:id/pagos/:pagoId   (administrador)
// body opcional: { motivo }
// Sprint 15: el pago YA NO se borra fisicamente. Se marca como anulado
// (anulado_at / anulado_por / motivo_anulacion), deja de sumar en
// monto_pagado y sigue visible en el historial: el dinero registrado nunca
// desaparece sin rastro. Se mantiene la misma ruta para no romper el
// frontend existente.
// ─────────────────────────────────────────────────────────────
const eliminarPago = async (req, res) => {
    const { id, pagoId } = req.params;
    const motivo = (req.body && typeof req.body.motivo === 'string' && req.body.motivo.trim()) ? req.body.motivo.trim().slice(0, 255) : 'Registrado por error';
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const { rows: cuentaRows } = await client.query('SELECT * FROM cuentas_cobrar WHERE id = $1 FOR UPDATE', [id]);
        const cuenta = cuentaRows[0];
        if (!cuenta) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Cuenta no encontrada.' }); }
        const { rows: pagoRows } = await client.query('SELECT * FROM pagos_cliente WHERE id = $1 AND cuenta_id = $2 FOR UPDATE', [pagoId, id]);
        const pago = pagoRows[0];
        if (!pago) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Pago no encontrado.' }); }
        if (pago.anulado_at) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Este pago ya estaba anulado.' }); }

        await client.query(
            'UPDATE pagos_cliente SET anulado_at = NOW(), anulado_por = $1, motivo_anulacion = $2 WHERE id = $3',
            [req.usuario.id, motivo, pagoId]
        );
        // monto_pagado se recalcula desde los pagos activos (fuente de verdad)
        const { rows: suma } = await client.query(
            'SELECT COALESCE(SUM(monto), 0) AS total FROM pagos_cliente WHERE cuenta_id = $1 AND anulado_at IS NULL', [id]
        );
        const nuevoMontoPagado = Math.round(parseFloat(suma[0].total) * 100) / 100;
        const nuevoEstado = estadoAutomatico(parseFloat(cuenta.monto_total), nuevoMontoPagado, cuenta.estado === 'pagado' ? 'pendiente' : cuenta.estado);
        await client.query('UPDATE cuentas_cobrar SET monto_pagado = $1, estado = $2 WHERE id = $3', [nuevoMontoPagado, nuevoEstado, id]);

        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'pago', entidad_id: Number(pagoId), accion: 'pago_anulado',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Pago de $${pago.monto} (${pago.metodo_pago || 'efectivo'}${pago.numero_comprobante || pago.numero_cheque ? ` ${pago.numero_comprobante || pago.numero_cheque}` : ''}) ANULADO en el pagare #${id}. Motivo: ${motivo}. Nuevo saldo: $${(parseFloat(cuenta.monto_total) - nuevoMontoPagado).toFixed(2)}.`,
            metadata: { pago_id: Number(pagoId), cuenta_id: Number(id), monto: parseFloat(pago.monto), metodo_pago: pago.metodo_pago, motivo },
        });

        return res.json({ mensaje: 'Pago anulado. Sigue visible en el historial, pero ya no cuenta como pagado.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error anular pago:', err);
        return res.status(500).json({ error: 'Error al anular el pago.' });
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────
// ELIMINAR CUENTA — solo administrador, y solo si no tiene pagos (si ya
// tiene pagos registrados, se debe anular en vez de eliminar para no
// perder ese historial).
// DELETE /api/cuentas-cobrar/:id
// ─────────────────────────────────────────────────────────────
const eliminarCuenta = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows: cuentaRows } = await pool.query(
            `SELECT monto_pagado, origen, (SELECT COUNT(*)::int FROM pagos_cliente WHERE cuenta_id = cc.id) AS pagos
             FROM cuentas_cobrar cc WHERE id = $1`, [id]);
        if (!cuentaRows[0]) return res.status(404).json({ error: 'Cuenta no encontrada.' });
        if (cuentaRows[0].origen === 'automatico') {
            return res.status(409).json({ error: 'Un pagare generado automaticamente desde una orden/proforma no se elimina: anulalo para conservar el historial.' });
        }
        if (parseFloat(cuentaRows[0].monto_pagado) > 0 || cuentaRows[0].pagos > 0) {
            return res.status(409).json({ error: 'Esta cuenta ya tiene pagos registrados. Anulala en vez de eliminarla para conservar el historial.' });
        }
        await pool.query('DELETE FROM cuentas_cobrar WHERE id = $1', [id]);

        registrarAccionBitacora({
            entidad_tipo: 'cuenta_cobrar', entidad_id: Number(id), accion: 'eliminada',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Cuenta por cobrar #${id} eliminada.`,
        });

        return res.json({ mensaje: 'Cuenta eliminada correctamente.' });
    } catch (err) {
        console.error('Error eliminarCuenta:', err);
        return res.status(500).json({ error: 'Error al eliminar la cuenta.' });
    }
};

// ─────────────────────────────────────────────────────────────
// RESUMEN — para la tira de KPIs del tab "Pagaré"
// GET /api/cuentas-cobrar/resumen
// ─────────────────────────────────────────────────────────────
const resumenCuentas = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT
                COALESCE(SUM(monto_total - monto_pagado) FILTER (WHERE estado IN ('pendiente','parcial','vencido')), 0) AS total_pendiente,
                COUNT(*) FILTER (WHERE estado IN ('pendiente','parcial','vencido')) AS cuentas_pendientes,
                COUNT(DISTINCT cliente_id) FILTER (WHERE estado IN ('pendiente','parcial','vencido')) AS clientes_con_deuda,
                COALESCE(SUM(monto_total - monto_pagado) FILTER (WHERE estado = 'vencido'), 0) AS total_vencido,
                COUNT(*) FILTER (WHERE estado = 'vencido') AS cuentas_vencidas
             FROM cuentas_cobrar`
        );
        return res.json(rows[0]);
    } catch (err) {
        console.error('Error resumenCuentas:', err);
        return res.status(500).json({ error: 'Error al calcular el resumen.' });
    }
};

module.exports = {
    listarCuentas, obtenerCuenta, crearCuenta, actualizarCuenta,
    cambiarEstadoCuenta, registrarPago, eliminarPago, eliminarCuenta, resumenCuentas,
};
