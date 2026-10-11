/**
 * SS SWAP - Controlador de Cuentas por Cobrar de Clientes ("Pagaré")
 *
 * Contraparte de movimientos_financieros_proveedor pero del lado de
 * clientes: permite ver quien debe, cuanto, registrar pagos parciales o
 * totales, y cambiar el estado manualmente cuando haga falta.
 *
 * Sprint 20: el estado ya NO se elige a mano. Se calcula siempre a partir
 * de los pagos confirmados y de la fecha limite (reglasPago.js):
 * pendiente -> parcial -> pagado, y 'vencido' cuando la fecha limite paso
 * con saldo. A mano solo se puede ANULAR una cuenta o reabrirla.
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { redondear2 } = require('../utils/numeros');
const { registrarAccionBitacora } = require('../services/ordenesHistorial.service');
const { estadoPersistido, calcularEstadoPago, resumenDeuda, SQL_ESTADO_EFECTIVO } = require('../services/reglasPago');

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
    SELECT cc.*, ${SQL_ESTADO_EFECTIVO} AS estado,
           c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, c.email AS cliente_email,
           c.cedula AS cliente_cedula,
           GREATEST(cc.monto_total - cc.monto_pagado, 0) AS saldo,
           CASE WHEN cc.fecha_vencimiento < CURRENT_DATE AND cc.monto_pagado + 0.005 < cc.monto_total AND cc.estado <> 'anulado'
                THEN CURRENT_DATE - cc.fecha_vencimiento ELSE 0 END AS dias_retraso,
           p.numero AS proforma_numero, p.total AS proforma_total, p.tipo AS proforma_tipo,
           COALESCE(v.placa, p.vehiculo_placa) AS vehiculo_placa,
           NULLIF(TRIM(CONCAT_WS(' ', COALESCE(v.marca, p.vehiculo_marca), COALESCE(v.modelo, p.vehiculo_modelo))), '') AS vehiculo_descripcion,
           u.nombre AS usuario_nombre
    FROM cuentas_cobrar cc
    JOIN clientes c ON c.id = cc.cliente_id
    LEFT JOIN proformas p ON p.id = cc.proforma_id
    LEFT JOIN vehiculos v ON v.id = COALESCE(cc.vehiculo_id, p.vehiculo_id)
    LEFT JOIN usuarios u ON u.id = cc.usuario_id`;
// Fila lista para la API: numero de OT + resumen economico (mismo calculo
// que la interfaz y los PDF: reglasPago.resumenDeuda).
const conNumeroOrden = (c) => ({
    ...c,
    orden_numero: formatoOrden(c.orden_id),
    ...resumenDeuda({ montoTotal: c.monto_total, montoPagado: c.monto_pagado, anticipoRequerido: c.anticipo_requerido }),
    dias_retraso: Number(c.dias_retraso || 0),
});

/** Estado que se guarda tras un cambio de montos (el 'vencido' se calcula al leer). */
const estadoAutomatico = (montoTotal, montoPagado, estadoActual) =>
    estadoPersistido({ montoTotal, montoPagado, anulado: estadoActual === 'anulado' });

/** Recalcula monto_pagado desde los pagos activos (fuente de verdad) y guarda estado/fecha de pago completo. */
async function recalcularCuenta(client, cuentaId) {
    const { rows } = await client.query(
        `UPDATE cuentas_cobrar cc SET
            monto_pagado = x.pagado,
            estado = CASE WHEN cc.estado = 'anulado' THEN 'anulado'
                          WHEN x.pagado + 0.005 >= cc.monto_total THEN 'pagado'
                          WHEN x.pagado > 0.005 THEN 'parcial' ELSE 'pendiente' END,
            fecha_pago_completo = CASE WHEN cc.estado <> 'anulado' AND x.pagado + 0.005 >= cc.monto_total
                                       THEN COALESCE(cc.fecha_pago_completo, NOW()) ELSE NULL END
         FROM (SELECT COALESCE(SUM(monto), 0) AS pagado FROM pagos_cliente WHERE cuenta_id = $1 AND anulado_at IS NULL) x
         WHERE cc.id = $1
         RETURNING cc.*`,
        [cuentaId]
    );
    return rows[0];
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
    if (estado && ESTADOS.includes(estado)) { params.push(estado); where += ` AND ${SQL_ESTADO_EFECTIVO} = $${params.length}`; }
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
            CASE ${SQL_ESTADO_EFECTIVO} WHEN 'vencido' THEN 0 WHEN 'pendiente' THEN 1 WHEN 'parcial' THEN 2 ELSE 3 END,
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
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
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
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener la cuenta.' });
    }
};

// ─────────────────────────────────────────────────────────────
// CREAR
// POST /api/cuentas-cobrar
// ─────────────────────────────────────────────────────────────
const crearCuenta = async (req, res) => {
    const { cliente_id, proforma_id, orden_id, vehiculo_id, concepto, monto_total, fecha, fecha_vencimiento, notas } = req.body;
    const anticipo = redondear2(Math.max(0, parseFloat(req.body.anticipo_requerido) || 0));
    const usuario_id = req.usuario.id;

    if (!cliente_id) return res.status(400).json({ error: 'El cliente es obligatorio.' });
    if (!concepto || !concepto.trim()) return res.status(400).json({ error: 'El concepto es obligatorio.' });
    if (!monto_total || parseFloat(monto_total) <= 0) return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });
    // Sin `fecha` (= hoy en la BD) lo valida la restriccion cuentas_cobrar_vencimiento_valido.
    if (fecha && fecha_vencimiento && fecha_vencimiento < fecha)
        return res.status(400).json({ error: 'La fecha de vencimiento no puede ser anterior a la fecha de la cuenta.' });
    if (anticipo > parseFloat(monto_total)) return res.status(400).json({ error: 'El anticipo requerido no puede superar el monto total.' });

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
            `INSERT INTO cuentas_cobrar (cliente_id, proforma_id, orden_id, vehiculo_id, concepto, monto_total, monto_base, anticipo_requerido, fecha, fecha_vencimiento, notas, usuario_id, origen)
             VALUES ($1,$2,$3,$4,$5,$6,$6,$7,COALESCE($8, CURRENT_DATE),$9,$10,$11,'manual')
             RETURNING *`,
            [cliente_id, proforma_id || null, orden_id || null, vehiculo_id || null, concepto.trim(), parseFloat(monto_total), anticipo,
             fecha || null, fecha_vencimiento || null, notas || null, usuario_id]
        );
        const cuenta = rows[0];

        registrarAccionBitacora({
            entidad_tipo: 'cuenta_cobrar', entidad_id: cuenta.id, accion: 'creada',
            usuario_id, usuario_nombre: req.usuario.nombre,
            detalle: `Cuenta por cobrar de $${cuenta.monto_total} registrada ("${cuenta.concepto}").`,
        });

        return res.status(201).json({ cuenta: conNumeroOrden(cuenta) });
    } catch (err) {
        console.error('Error crearCuenta:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
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
        const { rows: actualRows } = await pool.query('SELECT monto_pagado, monto_total, anticipo_requerido, estado, origen, fecha FROM cuentas_cobrar WHERE id = $1', [id]);
        if (!actualRows[0]) return res.status(404).json({ error: 'Cuenta no encontrada.' });
        const { monto_pagado, estado } = actualRows[0];
        // El monto de un pagare automatico es el total de la proforma: no se
        // edita a mano (se recalcula solo si cambia la proforma).
        if (actualRows[0].origen === 'automatico' && Math.abs(parseFloat(monto_total) - parseFloat(actualRows[0].monto_total)) >= 0.005) {
            return res.status(409).json({ error: 'El monto de un pagare automatico es el total de la proforma y no se puede modificar manualmente.' });
        }

        if (parseFloat(monto_total) < parseFloat(monto_pagado)) {
            return res.status(409).json({ error: `El monto no puede ser menor a lo ya pagado ($${monto_pagado}).` });
        }
        // Anticipo: en automaticos lo fija la proforma; en manuales se puede ajustar.
        const anticipo = actualRows[0].origen === 'automatico' || req.body.anticipo_requerido === undefined
            ? Number(actualRows[0].anticipo_requerido || 0)
            : redondear2(Math.max(0, parseFloat(req.body.anticipo_requerido) || 0));
        if (anticipo > parseFloat(monto_total) + 0.005) return res.status(400).json({ error: 'El anticipo requerido no puede superar el monto total.' });
        if (fecha_vencimiento && String(fecha_vencimiento) < String(actualRows[0].fecha instanceof Date ? actualRows[0].fecha.toISOString().slice(0, 10) : actualRows[0].fecha)) {
            return res.status(400).json({ error: 'La fecha limite no puede ser anterior a la fecha de la cuenta.' });
        }

        const nuevoEstado = estadoAutomatico(parseFloat(monto_total), parseFloat(monto_pagado), estado);
        const { rows } = await pool.query(
            `UPDATE cuentas_cobrar SET concepto=$1, monto_total=$2, fecha_vencimiento=$3, notas=$4, estado=$5::varchar, anticipo_requerido=$7,
                    fecha_pago_completo = CASE WHEN $5::varchar = 'pagado' THEN COALESCE(fecha_pago_completo, NOW()) ELSE NULL END
             WHERE id=$6 RETURNING *`,
            [concepto.trim(), parseFloat(monto_total), fecha_vencimiento || null, notas || null, nuevoEstado, id, anticipo]
        );

        registrarAccionBitacora({
            entidad_tipo: 'cuenta_cobrar', entidad_id: Number(id), accion: 'actualizada',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Cuenta por cobrar #${id} actualizada (monto $${parseFloat(actualRows[0].monto_total).toFixed(2)} -> $${parseFloat(monto_total).toFixed(2)}).`,
            metadata: { cuenta_id: Number(id), monto_anterior: parseFloat(actualRows[0].monto_total), monto_nuevo: parseFloat(monto_total) },
        });

        return res.json({ cuenta: conNumeroOrden(rows[0]) });
    } catch (err) {
        console.error('Error actualizarCuenta:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al actualizar la cuenta.' });
    }
};

// ─────────────────────────────────────────────────────────────
// ANULAR / REABRIR una cuenta
// PATCH /api/cuentas-cobrar/:id/estado   body: { estado: 'anulado' | 'pendiente' }
// Sprint 20: 'pagado', 'parcial' y 'vencido' ya no se eligen a mano (una
// deuda no puede quedar "pagada" sin pagos registrados). 'pendiente'
// significa REABRIR una cuenta anulada: su estado real se recalcula.
// ─────────────────────────────────────────────────────────────
const cambiarEstadoCuenta = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body;
    if (!['anulado', 'pendiente'].includes(estado)) {
        return res.status(400).json({ error: 'El estado de pago se calcula automaticamente con los pagos registrados y la fecha limite. Manualmente solo se puede anular o reabrir la cuenta.' });
    }

    try {
        const { rows: actualRows } = await pool.query('SELECT * FROM cuentas_cobrar WHERE id = $1', [id]);
        if (!actualRows[0]) return res.status(404).json({ error: 'Cuenta no encontrada.' });
        if (estado === 'pendiente' && actualRows[0].estado !== 'anulado') {
            return res.status(409).json({ error: 'Solo se puede reabrir una cuenta anulada.' });
        }
        if (estado === 'anulado' && actualRows[0].estado === 'anulado') {
            return res.status(409).json({ error: 'La cuenta ya esta anulada.' });
        }

        const nuevo = estado === 'anulado' ? 'anulado'
            : estadoPersistido({ montoTotal: actualRows[0].monto_total, montoPagado: actualRows[0].monto_pagado });
        const { rows } = await pool.query(
            `UPDATE cuentas_cobrar SET estado = $1::varchar,
                    fecha_pago_completo = CASE WHEN $1::varchar = 'pagado' THEN COALESCE(fecha_pago_completo, NOW()) WHEN $1::varchar = 'anulado' THEN fecha_pago_completo ELSE NULL END
             WHERE id = $2 RETURNING *`, [nuevo, id]);

        registrarAccionBitacora({
            entidad_tipo: 'cuenta_cobrar', entidad_id: Number(id), accion: `estado_${estado}`,
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Cuenta por cobrar #${id} ${estado === 'anulado' ? 'ANULADA' : `reabierta (estado ${nuevo})`}.`,
            metadata: { cuenta_id: Number(id), estado_anterior: actualRows[0].estado, estado_nuevo: nuevo, orden_id: actualRows[0].orden_id, proforma_id: actualRows[0].proforma_id },
        });

        return res.json({ cuenta: conNumeroOrden(rows[0]) });
    } catch (err) {
        console.error('Error cambiarEstadoCuenta:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
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

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        const { rows: cuentaRows } = await client.query('SELECT * FROM cuentas_cobrar WHERE id = $1 FOR UPDATE', [id]);
        const cuenta = cuentaRows[0];
        if (!cuenta) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Cuenta no encontrada.' }); }
        if (cuenta.estado === 'anulado') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Esta cuenta esta anulada, no se pueden registrar pagos.' }); }

        const saldoActual = redondear2(parseFloat(cuenta.monto_total) - parseFloat(cuenta.monto_pagado));
        if (saldoActual <= 0.005) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Esta cuenta ya esta pagada por completo; no se pueden registrar mas pagos.' });
        }
        if (parseFloat(monto) > saldoActual + 0.005) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `El pago ($${parseFloat(monto).toFixed(2)}) no puede superar el saldo pendiente ($${saldoActual.toFixed(2)}).` });
        }

        // Anti-duplicado: el mismo comprobante/cheque/autorizacion no se
        // registra dos veces, ni el mismo pago repetido en menos de 2 minutos
        // (doble clic, reintento de red). La fila de la cuenta esta bloqueada
        // (FOR UPDATE), asi que dos registros simultaneos se serializan.
        const docRef = d.numero_comprobante || d.numero_cheque || d.autorizacion;
        if (docRef) {
            const { rows: dup } = await client.query(
                `SELECT id FROM pagos_cliente
                 WHERE anulado_at IS NULL AND metodo_pago = $1
                   AND COALESCE(numero_comprobante, numero_cheque, autorizacion) = $2
                   AND COALESCE(banco, '') = COALESCE($3, '') LIMIT 1`,
                [metodo_pago, docRef, d.banco]
            );
            if (dup[0]) {
                await client.query('ROLLBACK');
                return res.status(409).json({ error: `Ya existe un pago registrado con el documento "${docRef}" (pago #${dup[0].id}). Verifica que no sea un pago duplicado.` });
            }
        }
        const { rows: reciente } = await client.query(
            `SELECT id FROM pagos_cliente
             WHERE cuenta_id = $1 AND anulado_at IS NULL AND monto = $2 AND metodo_pago = $3
               AND created_at > NOW() - INTERVAL '2 minutes' LIMIT 1`,
            [id, parseFloat(monto), metodo_pago]
        );
        if (reciente[0] && req.body.confirmar_duplicado !== true) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: `Se acaba de registrar un pago igual ($${parseFloat(monto).toFixed(2)}, ${metodo_pago}) en esta cuenta. Si realmente es otro pago, vuelve a intentarlo confirmando.`, posible_duplicado: true });
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

        // monto_pagado se recalcula desde los pagos activos (fuente de verdad).
        const c = await recalcularCuenta(client, id);
        const nuevoEstado = calcularEstadoPago({ montoTotal: c.monto_total, montoPagado: c.monto_pagado, fechaVencimiento: c.fecha_vencimiento, anulado: c.estado === 'anulado' });

        await client.query('COMMIT');

        const resumen = resumenDetallePago(metodo_pago, d);
        registrarAccionBitacora({
            entidad_tipo: 'pago', entidad_id: pagoRows[0].id, accion: `pago_${metodo_pago}`,
            usuario_id, usuario_nombre: req.usuario.nombre,
            detalle: `Pago de $${parseFloat(monto).toFixed(2)} (${metodo_pago.toUpperCase()}) al pagare #${id}${c.orden_id ? ` · ${formatoOrden(c.orden_id)}` : ''}. ${resumen ? `${resumen}. ` : ''}Saldo: $${(c.monto_total - c.monto_pagado).toFixed(2)}. Estado: ${nuevoEstado}.`,
            metadata: { pago_id: pagoRows[0].id, cuenta_id: Number(id), cliente_id: c.cliente_id, orden_id: c.orden_id, proforma_id: c.proforma_id, monto: parseFloat(monto), metodo_pago, ...Object.fromEntries(Object.entries(d).filter(([, v]) => v)) },
        });

        return res.status(201).json({ pago: { ...pagoRows[0], detalle: resumen }, cuenta: conNumeroOrden({ ...c, estado: nuevoEstado }) });
    } catch (err) {
        await client?.query('ROLLBACK');
        console.error('Error registrarPago:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al registrar el pago.' });
    } finally {
        client?.release();
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
    let client;
    try {
        client = await pool.connect();
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
        // monto_pagado, estado y fecha de pago completo se recalculan desde los pagos activos
        const recalculada = await recalcularCuenta(client, id);
        const nuevoMontoPagado = Number(recalculada.monto_pagado);

        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'pago', entidad_id: Number(pagoId), accion: 'pago_anulado',
            usuario_id: req.usuario.id, usuario_nombre: req.usuario.nombre,
            detalle: `Pago de $${pago.monto} (${pago.metodo_pago || 'efectivo'}${pago.numero_comprobante || pago.numero_cheque ? ` ${pago.numero_comprobante || pago.numero_cheque}` : ''}) ANULADO en el pagare #${id}. Motivo: ${motivo}. Nuevo saldo: $${(parseFloat(cuenta.monto_total) - nuevoMontoPagado).toFixed(2)}.`,
            metadata: { pago_id: Number(pagoId), cuenta_id: Number(id), monto: parseFloat(pago.monto), metodo_pago: pago.metodo_pago, motivo },
        });

        return res.json({ mensaje: 'Pago anulado. Sigue visible en el historial, pero ya no cuenta como pagado.' });
    } catch (err) {
        await client?.query('ROLLBACK');
        console.error('Error anular pago:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al anular el pago.' });
    } finally {
        client?.release();
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
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
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
                COALESCE(SUM(monto_total - monto_pagado) FILTER (WHERE est IN ('pendiente','parcial','vencido')), 0) AS total_pendiente,
                COUNT(*) FILTER (WHERE est IN ('pendiente','parcial','vencido')) AS cuentas_pendientes,
                COUNT(DISTINCT cliente_id) FILTER (WHERE est IN ('pendiente','parcial','vencido')) AS clientes_con_deuda,
                COALESCE(SUM(monto_total - monto_pagado) FILTER (WHERE est = 'vencido'), 0) AS total_vencido,
                COUNT(*) FILTER (WHERE est = 'vencido') AS cuentas_vencidas
             FROM (SELECT cc.*, ${SQL_ESTADO_EFECTIVO} AS est FROM cuentas_cobrar cc) t`
        );
        return res.json(rows[0]);
    } catch (err) {
        console.error('Error resumenCuentas:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al calcular el resumen.' });
    }
};

// ─────────────────────────────────────────────────────────────
// ALERTAS DE VENCIMIENTO — pagares con saldo cuya fecha limite ya paso
// (y los que vencen en los proximos 3 dias). Una cuenta pagada por
// completo o anulada nunca aparece aqui.
// GET /api/cuentas-cobrar/alertas
// ─────────────────────────────────────────────────────────────
const alertasVencimiento = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `${SELECT_CUENTA}
             WHERE cc.estado <> 'anulado' AND cc.monto_pagado + 0.005 < cc.monto_total
               AND cc.fecha_vencimiento IS NOT NULL AND cc.fecha_vencimiento <= CURRENT_DATE + 3
             ORDER BY cc.fecha_vencimiento ASC, cc.id ASC
             LIMIT 50`
        );
        const alertas = rows.map(conNumeroOrden).map(c => ({
            ...c, tipo_alerta: c.estado === 'vencido' ? 'vencido' : 'por_vencer',
        }));
        return res.json({
            alertas,
            vencidas: alertas.filter(a => a.tipo_alerta === 'vencido').length,
            por_vencer: alertas.filter(a => a.tipo_alerta === 'por_vencer').length,
        });
    } catch (err) {
        console.error('Error alertasVencimiento:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener las alertas de vencimiento.' });
    }
};

module.exports = {
    listarCuentas, obtenerCuenta, crearCuenta, actualizarCuenta,
    cambiarEstadoCuenta, registrarPago, eliminarPago, eliminarCuenta, resumenCuentas, alertasVencimiento,
};
