/**
 * SS SWAP - Controlador de Caja
 *
 * Apertura/cierre de caja diaria. Solo puede existir una sesion 'abierta'
 * a la vez por empresa (indice uq_caja_sesion_abierta).
 *
 * Coherencia con Finanzas (Sprint 17): la caja es la cuenta de dinero
 * predeterminada de tipo 'caja'. Durante la sesion se muestra TODO el
 * efectivo que entra o sale (cobros a clientes, gastos, sueldos, ingresos/
 * egresos de caja...) leido de v_flujo_dinero. Al abrir y al cerrar, la
 * diferencia entre lo contado y lo que dice el sistema se registra como
 * "ajuste de caja", asi el saldo de la caja siempre coincide con el conteo.
 *
 * Sprint 29 (control de cajas): cajero responsable y sucursal al abrir,
 * declaracion del cajero por forma de pago al cerrar, listado de todas las
 * cajas con filtros y Excel, reporte completo + PDF, anulacion de
 * movimientos manuales y reapertura de la ultima caja cerrada.
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { redondear2 } = require('../utils/numeros');
const { saldoCaja, cuentaCajaPredeterminada, registrarAjusteCaja } = require('../services/finanzas.service');
const C = require('../services/caja.service');
const { generarCajaPdf } = require('../services/cajaPdf.service');
const { generarCajasExcel } = require('../services/cajaExcel.service');
const { marcaDe, COLUMNAS_EMPRESA_SQL } = require('../services/marcaEmpresa');
const { registrarAuditoria } = require('../services/auditoria.service');

/** Billetes y monedas que se cuentan en caja (dolares, Ecuador). */
const DENOMINACIONES = ['100', '50', '20', '10', '5', '1', '0.5', '0.25', '0.10', '0.05', '0.01'];

/**
 * Limpia el conteo de billetes/monedas que manda el cliente:
 * { "20": 4, "0.25": 8 } -> solo denominaciones validas y cantidades enteras >= 0.
 * Devuelve { conteo, total } o null si no se envio conteo.
 */
function limpiarDenominaciones(entrada) {
    if (!entrada || typeof entrada !== 'object') return null;
    const conteo = {};
    let total = 0;
    for (const d of DENOMINACIONES) {
        const n = parseInt(entrada[d], 10);
        if (n > 0) { conteo[d] = n; total += n * Number(d); }
    }
    return { conteo, total: redondear2(total) };
}

/** Responde un error de la BD o uno generico. */
function fallo(res, err, donde, mensaje) {
    if (err.status && err.status < 500) return res.status(err.status).json({ error: err.message });
    console.error(`Error ${donde}:`, err);
    const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
    return res.status(500).json({ error: mensaje });
}

/** Cuentas de la empresa que pueden ser cajero (personal activo con permiso de caja). */
async function cajerosDisponibles(db) {
    const { rows } = await db.query(
        `SELECT u.id, u.nombre, u.rol
         FROM usuarios u
         WHERE u.empresa_id = empresa_actual() AND u.activo AND u.estado = 'activo' AND u.rol <> 'cliente'
           AND (u.rol = 'superadministrador' OR EXISTS (
                SELECT 1 FROM usuario_permisos up
                 WHERE up.usuario_id = u.id AND up.modulo = 'caja' AND up.accion IN ('crear', 'aprobar')))
         ORDER BY u.nombre`
    );
    return rows;
}

/** GET /api/caja/actual — sesion abierta (o null), su flujo de efectivo y el saldo de caja */
const obtenerSesionActual = async (req, res) => {
    try {
        // El saldo y la sesion abierta no dependen entre si: se piden a la vez.
        const [{ caja, saldo }, sesion] = await Promise.all([
            saldoCaja(pool),
            pool.query("SELECT id FROM caja_sesiones WHERE estado='abierta' ORDER BY fecha_apertura DESC LIMIT 1")
                .then(({ rows }) => (rows[0] ? C.obtenerSesion(pool, rows[0].id) : null)),
        ]);
        if (!sesion || !caja) {
            return res.json({ sesion, caja, saldo_caja: saldo, movimientos: [], totales: { ingresos: 0, egresos: 0, saldo: 0 } });
        }
        const [f, porMetodo] = await Promise.all([C.flujoEfectivo(pool, sesion, caja.id), C.ingresosPorForma(pool, sesion)]);
        return res.json({
            sesion, caja, saldo_caja: saldo, movimientos: f.movimientos, por_metodo: porMetodo,
            formas_declarables: C.FORMAS_DECLARABLES, retenciones: C.RETENCIONES,
            totales: { ingresos: f.ingresos, egresos: f.egresos, saldo: f.esperado },
        });
    } catch (err) {
        return fallo(res, err, 'obtenerSesionActual', 'Error al obtener la sesion de caja.');
    }
};

/** GET /api/caja/opciones — cajeros y sucursales para abrir caja */
const opciones = async (req, res) => {
    try {
        const [cajeros, sucursales] = await Promise.all([
            cajerosDisponibles(pool),
            pool.query('SELECT id, nombre, es_principal FROM sucursales WHERE activa ORDER BY es_principal DESC, nombre').then(r => r.rows),
        ]);
        return res.json({ cajeros, sucursales });
    } catch (err) {
        return fallo(res, err, 'opcionesCaja', 'Error al cargar las opciones de caja.');
    }
};

/** POST /api/caja/apertura — abre la caja con el efectivo contado (por defecto, el saldo del sistema) */
const abrirCaja = async (req, res) => {
    const { sucursal_id, notas_apertura, denominaciones } = req.body;
    const usuario_id = req.usuario.id;
    const cajero_id = req.body.cajero_id ? parseInt(req.body.cajero_id, 10) : usuario_id;
    // Si se contaron billetes y monedas, el monto de apertura es ese conteo.
    const den = limpiarDenominaciones(denominaciones);
    const monto_apertura = den && den.total > 0 ? den.total : req.body.monto_apertura;
    if (monto_apertura !== undefined && monto_apertura !== '' && (Number.isNaN(Number(monto_apertura)) || Number(monto_apertura) < 0)) {
        return res.status(400).json({ error: 'El monto de apertura no puede ser negativo.' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows: abiertas } = await client.query("SELECT id FROM caja_sesiones WHERE estado='abierta' LIMIT 1");
        if (abiertas[0]) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Ya existe una caja abierta. Ciérrala antes de abrir una nueva.' });
        }
        if (!(await cajerosDisponibles(client)).some(u => u.id === cajero_id)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'El cajero elegido no es una cuenta activa de esta empresa con permiso de caja.' });
        }
        if (sucursal_id) {
            const { rows: s } = await client.query('SELECT id FROM sucursales WHERE id = $1 AND activa', [sucursal_id]);
            if (!s[0]) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'La sucursal elegida no existe o está inactiva.' }); }
        }
        const { saldo } = await saldoCaja(client);
        const contado = monto_apertura === undefined || monto_apertura === '' ? saldo : redondear2(monto_apertura);

        const { rows } = await client.query(
            `INSERT INTO caja_sesiones (sucursal_id, usuario_apertura_id, cajero_id, monto_apertura, notas_apertura, denominaciones_apertura)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
            [sucursal_id || null, usuario_id, cajero_id, contado, notas_apertura?.trim() || null, den && den.total > 0 ? JSON.stringify(den.conteo) : null]
        );
        const ajuste = await registrarAjusteCaja(client, {
            diferencia: contado - saldo, cajaSesionId: rows[0].id, usuarioId: usuario_id,
            descripcion: `Ajuste en apertura de caja: contado $${contado.toFixed(2)}, sistema $${saldo.toFixed(2)}`,
        });
        await client.query('COMMIT');
        return res.status(201).json({ ...rows[0], saldo_sistema: saldo, ajuste });
    } catch (err) {
        await client?.query('ROLLBACK').catch(() => {});
        return fallo(res, err, 'abrirCaja', 'Error al abrir caja.');
    } finally { client?.release(); }
};

/**
 * POST /api/caja/cierre — cierra la sesion abierta con el conteo real
 * y la declaracion del cajero por forma de pago:
 *   { denominaciones | monto_cierre_real, declaracion: { cheque, transferencia,
 *     tarjeta_credito, tarjeta_debito, otro, retencion_fuente, retencion_iva }, notas_cierre }
 */
const cerrarCaja = async (req, res) => {
    const { notas_cierre, denominaciones } = req.body;
    const usuario_id = req.usuario.id;
    // Con conteo de billetes/monedas, el efectivo contado es la suma del conteo.
    const den = limpiarDenominaciones(denominaciones);
    const monto_cierre_real = den ? den.total : req.body.monto_cierre_real;

    if (monto_cierre_real === undefined || monto_cierre_real === null || monto_cierre_real === '' || Number.isNaN(Number(monto_cierre_real)) || Number(monto_cierre_real) < 0) {
        return res.status(400).json({ error: 'Ingresa el efectivo contado (0 o mas).' });
    }

    let client;
    try {
        const declarado = C.limpiarDeclaracion(req.body.declaracion);
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows: abiertas } = await client.query("SELECT * FROM caja_sesiones WHERE estado='abierta' LIMIT 1 FOR UPDATE");
        const sesion = abiertas[0];
        if (!sesion) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No hay ninguna caja abierta.' }); }
        const caja = await cuentaCajaPredeterminada(client);
        if (!caja) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'No hay una cuenta de caja predeterminada configurada en Finanzas.' }); }

        const f = await C.flujoEfectivo(client, sesion, caja.id);
        const porForma = await C.ingresosPorForma(client, sesion);
        const real = redondear2(monto_cierre_real);
        const diferencia = redondear2(real - f.esperado);
        const resumen = {
            ingresos: f.ingresos, egresos: f.egresos, esperado: f.esperado,
            formas: Object.fromEntries(C.FORMAS_DECLARABLES.map(x => [x.codigo, redondear2(porForma[x.codigo]?.ingresos || 0)])),
        };

        const ajuste = await registrarAjusteCaja(client, {
            diferencia, cajaSesionId: sesion.id, usuarioId: usuario_id,
            descripcion: `${diferencia > 0 ? 'Sobrante' : 'Faltante'} en cierre de caja #${sesion.id}`,
        });
        const { rows } = await client.query(
            `UPDATE caja_sesiones SET estado='cerrada', usuario_cierre_id=$1, monto_cierre_esperado=$2,
             monto_cierre_real=$3, diferencia=$4, notas_cierre=$5, fecha_cierre=NOW(), denominaciones_cierre=$7,
             declaracion_cierre=$8, resumen_cierre=$9, ajuste_cierre_id=$10
             WHERE id=$6 RETURNING *`,
            [usuario_id, f.esperado, real, diferencia, notas_cierre?.trim() || null, sesion.id, den ? JSON.stringify(den.conteo) : null,
             JSON.stringify({ efectivo: real, ...declarado }), JSON.stringify(resumen), ajuste?.id || null]
        );
        await client.query('COMMIT');
        return res.json({ ...rows[0], ingresos: f.ingresos, egresos: f.egresos, ajuste });
    } catch (err) {
        await client?.query('ROLLBACK').catch(() => {});
        return fallo(res, err, 'cerrarCaja', 'Error al cerrar caja.');
    } finally { client?.release(); }
};

/**
 * POST /api/caja/movimientos — ingreso o egreso de EFECTIVO en la sesion abierta
 * (gastos menores, vueltos, etc.). Los cobros a clientes se registran en
 * Pagaré/Cartera y aparecen solos en la caja si son en efectivo.
 */
const registrarMovimientoCaja = async (req, res) => {
    const { tipo, concepto, monto, referencia } = req.body;
    const usuario_id = req.usuario.id;

    if (!['ingreso', 'egreso'].includes(tipo)) {
        return res.status(400).json({ error: "tipo debe ser 'ingreso' o 'egreso'." });
    }
    if (!concepto?.trim()) return res.status(400).json({ error: 'El concepto es obligatorio.' });
    if (!(Number(monto) > 0)) return res.status(400).json({ error: 'El monto debe ser mayor a cero.' });

    try {
        const { rows: abiertas } = await pool.query("SELECT id FROM caja_sesiones WHERE estado='abierta' LIMIT 1");
        const sesion = abiertas[0];
        if (!sesion) return res.status(409).json({ error: 'No hay ninguna caja abierta. Abre caja primero.' });
        const caja = await cuentaCajaPredeterminada(pool);

        const { rows } = await pool.query(
            `INSERT INTO caja_movimientos (caja_sesion_id, usuario_id, tipo, concepto, monto, metodo_pago, referencia, cuenta_dinero_id)
             VALUES ($1,$2,$3,$4,$5,'efectivo',$6,$7) RETURNING *`,
            [sesion.id, usuario_id, tipo, concepto.trim(), redondear2(monto), referencia?.trim() || null, caja?.id || null]
        );
        return res.status(201).json(rows[0]);
    } catch (err) {
        return fallo(res, err, 'registrarMovimientoCaja', 'Error al registrar el movimiento de caja.');
    }
};

/** POST /api/caja/movimientos/:id/anular — anula una entrada/salida manual de la caja abierta { motivo } */
const anularMovimientoCaja = async (req, res) => {
    const motivo = String(req.body.motivo || '').trim();
    if (motivo.length < 3) return res.status(400).json({ error: 'Escribe el motivo de la anulación.' });
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT cm.*, s.estado AS sesion_estado FROM caja_movimientos cm
             JOIN caja_sesiones s ON s.id = cm.caja_sesion_id
             WHERE cm.id = $1 FOR UPDATE OF cm`, [req.params.id]);
        const mov = rows[0];
        if (!mov) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Movimiento no encontrado.' }); }
        if (mov.anulado_at) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'El movimiento ya estaba anulado.' }); }
        if (mov.sesion_estado !== 'abierta') {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Solo se anulan movimientos de la caja abierta. Reabre la caja si necesitas corregir un cierre.' });
        }
        const { rows: act } = await client.query(
            `UPDATE caja_movimientos SET anulado_at = NOW(), anulado_por = $2, motivo_anulacion = $3 WHERE id = $1 RETURNING *`,
            [mov.id, req.usuario.id, motivo.slice(0, 255)]);
        await registrarAuditoria({ req, accion: 'caja.movimiento_anulado', recursoTipo: 'caja_movimiento', recursoId: mov.id,
            detalle: { sesion: mov.caja_sesion_id, tipo: mov.tipo, monto: Number(mov.monto), concepto: mov.concepto, motivo } }, client);
        await client.query('COMMIT');
        return res.json(act[0]);
    } catch (err) {
        await client?.query('ROLLBACK').catch(() => {});
        return fallo(res, err, 'anularMovimientoCaja', 'Error al anular el movimiento.');
    } finally { client?.release(); }
};

/** Filtros del listado de cajas (compartidos con el Excel). */
function filtrosListado(query) {
    const { q, estado, desde, hasta, cajero_id } = query;
    const where = ['TRUE'];
    const params = [];
    if (['abierta', 'cerrada'].includes(estado)) { params.push(estado); where.push(`s.estado = $${params.length}`); }
    if (desde) { params.push(desde); where.push(`s.fecha_apertura >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); where.push(`s.fecha_apertura < $${params.length}::date + 1`); }
    if (cajero_id) { params.push(parseInt(cajero_id, 10) || 0); where.push(`s.cajero_id = $${params.length}`); }
    if (q && String(q).trim()) {
        params.push(`%${String(q).trim()}%`);
        const i = params.length;
        where.push(`(s.id::text ILIKE $${i} OR cj.nombre ILIKE $${i} OR ua.nombre ILIKE $${i} OR su.nombre ILIKE $${i} OR s.notas_cierre ILIKE $${i})`);
    }
    return { where: where.join(' AND '), params };
}

const SELECT_LISTADO = `
    SELECT s.id, s.estado, s.fecha_apertura, s.fecha_cierre, s.monto_apertura, s.monto_cierre_esperado, s.monto_cierre_real,
           s.diferencia, s.notas_apertura, s.notas_cierre, s.sucursal_id, s.cajero_id,
           jsonb_array_length(s.reaperturas) AS veces_reabierta,
           su.nombre AS sucursal_nombre, COALESCE(cj.nombre, ua.nombre) AS cajero_nombre,
           ua.nombre AS usuario_apertura_nombre, uc.nombre AS usuario_cierre_nombre
    FROM caja_sesiones s
    JOIN usuarios ua ON ua.id = s.usuario_apertura_id
    LEFT JOIN usuarios uc ON uc.id = s.usuario_cierre_id
    LEFT JOIN usuarios cj ON cj.id = s.cajero_id
    LEFT JOIN sucursales su ON su.id = s.sucursal_id`;

/** GET /api/caja/sesiones — todas las cajas (abiertas y cerradas) con filtros y paginacion */
const listarSesiones = async (req, res) => {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const { where, params } = filtrosListado(req.query);
    try {
        const [lista, total, ultima] = await Promise.all([
            pool.query(`${SELECT_LISTADO} WHERE ${where} ORDER BY s.fecha_apertura DESC, s.id DESC LIMIT ${limit} OFFSET ${(page - 1) * limit}`, params),
            pool.query(`SELECT COUNT(*)::int AS n FROM caja_sesiones s
                        JOIN usuarios ua ON ua.id = s.usuario_apertura_id
                        LEFT JOIN usuarios cj ON cj.id = s.cajero_id
                        LEFT JOIN sucursales su ON su.id = s.sucursal_id WHERE ${where}`, params),
            pool.query(`SELECT id, estado FROM caja_sesiones ORDER BY fecha_apertura DESC, id DESC LIMIT 1`),
        ]);
        // Solo se puede reabrir la ULTIMA caja, si esta cerrada (no hay otra abierta).
        const reabrible = ultima.rows[0]?.estado === 'cerrada' ? ultima.rows[0].id : null;
        return res.json({
            sesiones: lista.rows.map(s => ({ ...s, puede_reabrir: s.id === reabrible })),
            total: total.rows[0].n, page, limit,
        });
    } catch (err) {
        return fallo(res, err, 'listarSesiones', 'Error al listar las cajas.');
    }
};

/** GET /api/caja/sesiones/excel — el listado filtrado en Excel */
const exportarSesionesExcel = async (req, res) => {
    const { where, params } = filtrosListado(req.query);
    try {
        const { rows } = await pool.query(`${SELECT_LISTADO} WHERE ${where} ORDER BY s.fecha_apertura DESC, s.id DESC LIMIT 5000`, params);
        const buffer = await generarCajasExcel(rows);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="cajas-${new Date().toISOString().slice(0, 10)}.xlsx"`);
        return res.send(buffer);
    } catch (err) {
        return fallo(res, err, 'exportarSesionesExcel', 'Error al generar el Excel de cajas.');
    }
};

/** GET /api/caja/sesiones/:id/reporte — reporte completo de una caja */
const reporte = async (req, res) => {
    try {
        const r = await C.reporteSesion(pool, req.params.id);
        if (!r) return res.status(404).json({ error: 'Caja no encontrada.' });
        return res.json(r);
    } catch (err) {
        return fallo(res, err, 'reporteCaja', 'Error al generar el reporte de caja.');
    }
};

/** GET /api/caja/sesiones/:id/pdf — reporte de cierre en PDF (?ver=1 para abrirlo e imprimir) */
const pdf = async (req, res) => {
    try {
        const r = await C.reporteSesion(pool, req.params.id);
        if (!r) return res.status(404).json({ error: 'Caja no encontrada.' });
        const { rows } = await pool.query(`SELECT ${COLUMNAS_EMPRESA_SQL} FROM empresas e WHERE e.id = empresa_actual()`);
        const marca = rows[0] ? marcaDe(rows[0]) : { nombre: '', logo: null };
        const buffer = await generarCajaPdf(r, { empresa: marca });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${req.query.ver === '1' ? 'inline' : 'attachment'}; filename="cierre-caja-${r.sesion.id}.pdf"`);
        return res.send(buffer);
    } catch (err) {
        return fallo(res, err, 'pdfCaja', 'Error al generar el PDF de caja.');
    }
};

/**
 * POST /api/caja/sesiones/:id/reabrir — reabre la ULTIMA caja cerrada { motivo }.
 * Anula el ajuste del cierre (el saldo de caja vuelve a lo que dice el
 * sistema) y guarda el cierre anterior en el historial de reaperturas.
 */
const reabrirCaja = async (req, res) => {
    const motivo = String(req.body.motivo || '').trim();
    if (motivo.length < 3) return res.status(400).json({ error: 'Escribe el motivo de la reapertura.' });
    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows } = await client.query('SELECT * FROM caja_sesiones WHERE id = $1 FOR UPDATE', [req.params.id]);
        const s = rows[0];
        if (!s) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Caja no encontrada.' }); }
        if (s.estado !== 'cerrada') { await client.query('ROLLBACK'); return res.status(409).json({ error: 'La caja ya está abierta.' }); }
        const { rows: otras } = await client.query(
            `SELECT id, estado FROM caja_sesiones WHERE id <> $1 AND (estado = 'abierta' OR fecha_apertura > $2) LIMIT 1`,
            [s.id, s.fecha_apertura]);
        if (otras[0]) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: otras[0].estado === 'abierta'
                ? 'Hay otra caja abierta. Ciérrala antes de reabrir esta.'
                : 'Solo se puede reabrir la última caja cerrada (después de esta ya se abrió otra).' });
        }

        // Ajuste del cierre: el guardado o, en cierres anteriores al Sprint 29, el que se creo al cerrar.
        let ajusteId = s.ajuste_cierre_id;
        if (!ajusteId) {
            const { rows: aj } = await client.query(
                `SELECT id FROM movimientos_dinero WHERE caja_sesion_id = $1 AND categoria = 'ajuste_caja' AND anulado_at IS NULL
                   AND created_at >= $2::timestamptz - INTERVAL '5 seconds' ORDER BY id DESC LIMIT 1`, [s.id, s.fecha_cierre]);
            ajusteId = aj[0]?.id || null;
        }
        if (ajusteId) {
            await client.query(
                `UPDATE movimientos_dinero SET anulado_at = NOW(), anulado_por = $2, motivo_anulacion = $3 WHERE id = $1 AND anulado_at IS NULL`,
                [ajusteId, req.usuario.id, `Reapertura de caja #${s.id}: ${motivo}`.slice(0, 255)]);
        }
        const historial = {
            reabierta_at: new Date().toISOString(), reabierta_por: req.usuario.id, reabierta_por_nombre: req.usuario.nombre || null, motivo,
            cierre: { fecha_cierre: s.fecha_cierre, usuario_cierre_id: s.usuario_cierre_id, monto_cierre_esperado: s.monto_cierre_esperado,
                      monto_cierre_real: s.monto_cierre_real, diferencia: s.diferencia, notas_cierre: s.notas_cierre,
                      declaracion_cierre: s.declaracion_cierre, ajuste_anulado_id: ajusteId },
        };
        const { rows: act } = await client.query(
            `UPDATE caja_sesiones SET estado = 'abierta', usuario_cierre_id = NULL, monto_cierre_esperado = NULL, monto_cierre_real = NULL,
                    diferencia = NULL, notas_cierre = NULL, fecha_cierre = NULL, denominaciones_cierre = NULL,
                    declaracion_cierre = NULL, resumen_cierre = NULL, ajuste_cierre_id = NULL,
                    reaperturas = reaperturas || $2::jsonb
             WHERE id = $1 RETURNING *`, [s.id, JSON.stringify([historial])]);
        await registrarAuditoria({ req, accion: 'caja.reabierta', recursoTipo: 'caja_sesion', recursoId: s.id,
            detalle: { motivo, diferencia_anterior: Number(s.diferencia), ajuste_anulado_id: ajusteId } }, client);
        await client.query('COMMIT');
        return res.json(act[0]);
    } catch (err) {
        await client?.query('ROLLBACK').catch(() => {});
        return fallo(res, err, 'reabrirCaja', 'Error al reabrir la caja.');
    } finally { client?.release(); }
};

/**
 * GET /api/caja/historial — sesiones cerradas (resumen dia a dia)
 * Query params: desde, hasta, limit
 */
const listarHistorial = async (req, res) => {
    const { desde, hasta, limit = 60 } = req.query;
    let query = `
        SELECT s.*, ua.nombre AS usuario_apertura_nombre, uc.nombre AS usuario_cierre_nombre
        FROM caja_sesiones s
        JOIN usuarios ua ON ua.id = s.usuario_apertura_id
        LEFT JOIN usuarios uc ON uc.id = s.usuario_cierre_id
        WHERE s.estado='cerrada'
    `;
    const params = [];
    if (desde) { params.push(desde); query += ` AND s.fecha_apertura >= $${params.length}::date`; }
    if (hasta) { params.push(hasta); query += ` AND s.fecha_apertura < $${params.length}::date + 1`; }
    params.push(Math.min(365, parseInt(limit) || 60));
    query += ` ORDER BY s.fecha_apertura DESC LIMIT $${params.length}`;

    try {
        const { rows } = await pool.query(query, params);
        return res.json({ sesiones: rows });
    } catch (err) {
        return fallo(res, err, 'listarHistorial', 'Error al obtener el historial de caja.');
    }
};

module.exports = {
    obtenerSesionActual, opciones, abrirCaja, cerrarCaja, registrarMovimientoCaja, anularMovimientoCaja,
    listarSesiones, exportarSesionesExcel, reporte, pdf, reabrirCaja, listarHistorial,
};
