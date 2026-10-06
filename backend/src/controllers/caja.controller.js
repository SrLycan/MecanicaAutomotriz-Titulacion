/**
 * SS SWAP - Controlador de Caja
 *
 * Apertura/cierre de caja diaria. Solo puede existir una sesion 'abierta'
 * a la vez (indice uq_caja_sesion_abierta).
 *
 * Coherencia con Finanzas (Sprint 17): la caja es la cuenta de dinero
 * predeterminada de tipo 'caja'. Durante la sesion se muestra TODO el
 * efectivo que entra o sale (cobros a clientes, gastos, sueldos, ingresos/
 * egresos de caja...) leido de v_flujo_dinero. Al abrir y al cerrar, la
 * diferencia entre lo contado y lo que dice el sistema se registra como
 * "ajuste de caja", asi el saldo de la caja siempre coincide con el conteo.
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { redondear2 } = require('../utils/numeros');
const { saldoCaja, cuentaCajaPredeterminada, registrarAjusteCaja } = require('../services/finanzas.service');

/** Flujo de efectivo de la caja desde la apertura de la sesion (sin ajustes). */
async function flujoSesion(db, sesion, cajaId) {
    const { rows } = await db.query(
        `SELECT f.*, COALESCE(c.nombre, f.categoria) AS categoria_nombre
         FROM v_flujo_dinero f
         LEFT JOIN cat_categorias_dinero c ON c.codigo = f.categoria
         WHERE f.cuenta_dinero_id = $1 AND f.momento >= $2 AND f.categoria <> 'ajuste_caja'
         ORDER BY f.momento DESC, f.origen_id DESC`,
        [cajaId, sesion.fecha_apertura]
    );
    const ingresos = redondear2(rows.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + Number(m.monto), 0));
    const egresos  = redondear2(rows.filter(m => m.tipo === 'egreso').reduce((a, m) => a + Number(m.monto), 0));
    return { movimientos: rows, ingresos, egresos, esperado: redondear2(Number(sesion.monto_apertura) + ingresos - egresos) };
}

/** GET /api/caja/actual — sesion abierta (o null), su flujo de efectivo y el saldo de caja */
const obtenerSesionActual = async (req, res) => {
    try {
        const { caja, saldo } = await saldoCaja(pool);
        const { rows } = await pool.query(
            `SELECT s.*, u.nombre AS usuario_apertura_nombre
             FROM caja_sesiones s
             JOIN usuarios u ON u.id = s.usuario_apertura_id
             WHERE s.estado='abierta' ORDER BY s.fecha_apertura DESC LIMIT 1`
        );
        const sesion = rows[0];
        if (!sesion || !caja) {
            return res.json({ sesion: sesion || null, caja, saldo_caja: saldo, movimientos: [], totales: { ingresos: 0, egresos: 0, saldo: 0 } });
        }
        const f = await flujoSesion(pool, sesion, caja.id);
        return res.json({
            sesion, caja, saldo_caja: saldo, movimientos: f.movimientos,
            totales: { ingresos: f.ingresos, egresos: f.egresos, saldo: f.esperado },
        });
    } catch (err) {
        console.error('Error obtenerSesionActual:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener la sesion de caja.' });
    }
};

/** POST /api/caja/apertura — abre la caja con el efectivo contado (por defecto, el saldo del sistema) */
const abrirCaja = async (req, res) => {
    const { monto_apertura, sucursal_id, notas_apertura } = req.body;
    const usuario_id = req.usuario.id;
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
        const { saldo } = await saldoCaja(client);
        const contado = monto_apertura === undefined || monto_apertura === '' ? saldo : redondear2(monto_apertura);

        const { rows } = await client.query(
            `INSERT INTO caja_sesiones (sucursal_id, usuario_apertura_id, monto_apertura, notas_apertura)
             VALUES ($1,$2,$3,$4) RETURNING *`,
            [sucursal_id || null, usuario_id, contado, notas_apertura?.trim() || null]
        );
        const ajuste = await registrarAjusteCaja(client, {
            diferencia: contado - saldo, cajaSesionId: rows[0].id, usuarioId: usuario_id,
            descripcion: `Ajuste en apertura de caja: contado $${contado.toFixed(2)}, sistema $${saldo.toFixed(2)}`,
        });
        await client.query('COMMIT');
        return res.status(201).json({ ...rows[0], saldo_sistema: saldo, ajuste });
    } catch (err) {
        await client?.query('ROLLBACK').catch(() => {});
        console.error('Error abrirCaja:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al abrir caja.' });
    } finally { client?.release(); }
};

/** POST /api/caja/cierre — cierra la sesion abierta con el conteo real */
const cerrarCaja = async (req, res) => {
    const { monto_cierre_real, notas_cierre } = req.body;
    const usuario_id = req.usuario.id;

    if (monto_cierre_real === undefined || monto_cierre_real === null || monto_cierre_real === '' || Number.isNaN(Number(monto_cierre_real)) || Number(monto_cierre_real) < 0) {
        return res.status(400).json({ error: 'Ingresa el efectivo contado (0 o mas).' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');
        const { rows: abiertas } = await client.query("SELECT * FROM caja_sesiones WHERE estado='abierta' LIMIT 1 FOR UPDATE");
        const sesion = abiertas[0];
        if (!sesion) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No hay ninguna caja abierta.' }); }
        const caja = await cuentaCajaPredeterminada(client);
        if (!caja) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'No hay una cuenta de caja predeterminada configurada en Finanzas.' }); }

        const f = await flujoSesion(client, sesion, caja.id);
        const real = redondear2(monto_cierre_real);
        const diferencia = redondear2(real - f.esperado);

        const { rows } = await client.query(
            `UPDATE caja_sesiones SET estado='cerrada', usuario_cierre_id=$1, monto_cierre_esperado=$2,
             monto_cierre_real=$3, diferencia=$4, notas_cierre=$5, fecha_cierre=NOW()
             WHERE id=$6 RETURNING *`,
            [usuario_id, f.esperado, real, diferencia, notas_cierre?.trim() || null, sesion.id]
        );
        const ajuste = await registrarAjusteCaja(client, {
            diferencia, cajaSesionId: sesion.id, usuarioId: usuario_id,
            descripcion: `${diferencia > 0 ? 'Sobrante' : 'Faltante'} en cierre de caja #${sesion.id}`,
        });
        await client.query('COMMIT');
        return res.json({ ...rows[0], ingresos: f.ingresos, egresos: f.egresos, ajuste });
    } catch (err) {
        await client?.query('ROLLBACK').catch(() => {});
        console.error('Error cerrarCaja:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al cerrar caja.' });
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
        console.error('Error registrarMovimientoCaja:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al registrar el movimiento de caja.' });
    }
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
        console.error('Error listarHistorial:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener el historial de caja.' });
    }
};

module.exports = {
    obtenerSesionActual, abrirCaja, cerrarCaja, registrarMovimientoCaja, listarHistorial,
};
