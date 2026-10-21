/**
 * SS SWAP - Servicio de Finanzas
 *
 * Calculos de dinero compartidos por el modulo de Finanzas y la Caja.
 * La fuente de verdad es la vista v_flujo_dinero (ver migrations.sql,
 * Sprint 17): une pagos de clientes, pagos a proveedores, gastos pagados,
 * caja, nomina y otros movimientos, sin duplicar informacion.
 *
 * Saldo de una cuenta = saldo_inicial + ingresos - egresos del flujo con
 * fecha >= fecha_saldo_inicial.
 */
const pool = require('../config/db');
const { redondear2 } = require('../utils/numeros');

/**
 * Saldo por proveedor (proveedor_id, saldo): compras confirmadas menos pagos
 * y abonos confirmados, sin contar compras canceladas ni los pagos hechos a
 * ellas. 'cancelacion' es solo un registro informativo: la compra cancelada
 * ya queda anulada, por eso no se resta otra vez. `extra` = filtros SQL
 * adicionales sobre m. Lo usan el resumen de Proveedores, Finanzas y el panel.
 */
function saldoProveedoresSql(extra = '') {
    return `SELECT m.proveedor_id,
                   SUM(CASE WHEN m.tipo = 'compra' THEN m.monto
                            WHEN m.tipo IN ('pago','abono') THEN -m.monto ELSE 0 END) AS saldo
            FROM movimientos_financieros_proveedor m
            LEFT JOIN compras_proveedor c ON c.id = m.compra_id
            WHERE m.estado = 'confirmado' AND (c.id IS NULL OR c.estado <> 'cancelada')${extra}
            GROUP BY m.proveedor_id`;
}

/** Saldos de todas las cuentas (o de una). `db` puede ser el pool o un client de transaccion. */
async function saldosCuentas(db = pool, { soloActivas = false, cuentaId = null } = {}) {
    const params = [];
    let where = 'WHERE 1=1';
    if (soloActivas) where += ' AND cd.activa';
    if (cuentaId) { params.push(cuentaId); where += ` AND cd.id = $${params.length}`; }
    const { rows } = await db.query(
        `SELECT cd.*,
                COALESCE(SUM(f.monto) FILTER (WHERE f.tipo = 'ingreso'), 0) AS ingresos,
                COALESCE(SUM(f.monto) FILTER (WHERE f.tipo = 'egreso'), 0)  AS egresos,
                cd.saldo_inicial
                  + COALESCE(SUM(f.monto) FILTER (WHERE f.tipo = 'ingreso'), 0)
                  - COALESCE(SUM(f.monto) FILTER (WHERE f.tipo = 'egreso'), 0) AS saldo,
                COUNT(f.origen_id) AS movimientos
         FROM cuentas_dinero cd
         LEFT JOIN v_flujo_dinero f ON f.cuenta_dinero_id = cd.id AND f.fecha >= cd.fecha_saldo_inicial
         ${where}
         GROUP BY cd.id
         ORDER BY cd.activa DESC, cd.predeterminada DESC, cd.tipo, cd.nombre`,
        params
    );
    return rows.map(r => ({
        ...r,
        saldo_inicial: Number(r.saldo_inicial),
        ingresos: Number(r.ingresos),
        egresos: Number(r.egresos),
        saldo: redondear2(r.saldo),
        movimientos: Number(r.movimientos),
    }));
}

/** Cuenta de caja predeterminada (donde cae el efectivo). */
async function cuentaCajaPredeterminada(db = pool) {
    const { rows } = await db.query("SELECT * FROM cuentas_dinero WHERE tipo = 'caja' AND predeterminada LIMIT 1");
    return rows[0] || null;
}

/** Saldo actual de la caja predeterminada (0 si no existe). */
async function saldoCaja(db = pool) {
    const caja = await cuentaCajaPredeterminada(db);
    if (!caja) return { caja: null, saldo: 0 };
    const [cuenta] = await saldosCuentas(db, { cuentaId: caja.id });
    return { caja, saldo: cuenta ? cuenta.saldo : 0 };
}

/**
 * Registra un ajuste de caja (diferencia entre lo contado y lo que dice el
 * sistema) para que el saldo de la caja quede igual al conteo real.
 * No hace nada si la diferencia es 0. Devuelve el movimiento o null.
 */
async function registrarAjusteCaja(db, { diferencia, cajaSesionId, usuarioId, descripcion }) {
    const dif = redondear2(diferencia);
    if (Math.abs(dif) < 0.005) return null;
    const caja = await cuentaCajaPredeterminada(db);
    if (!caja) return null;
    const { rows } = await db.query(
        `INSERT INTO movimientos_dinero (tipo, categoria, monto, cuenta_dinero_id, metodo_pago, descripcion, caja_sesion_id, usuario_id)
         VALUES ($1, 'ajuste_caja', $2, $3, 'efectivo', $4, $5, $6) RETURNING *`,
        [dif > 0 ? 'ingreso' : 'egreso', Math.abs(dif), caja.id, descripcion, cajaSesionId || null, usuarioId]
    );
    return rows[0];
}

/** Primer dia del mes (YYYY-MM-01) de una fecha 'YYYY-MM-DD' o 'YYYY-MM'. */
function inicioDeMes(valor) {
    const m = /^(\d{4})-(\d{2})/.exec(String(valor || ''));
    if (!m) return null;
    const mes = Number(m[2]);
    if (mes < 1 || mes > 12) return null;
    return `${m[1]}-${m[2]}-01`;
}

module.exports = { saldoProveedoresSql, saldosCuentas, cuentaCajaPredeterminada, saldoCaja, registrarAjusteCaja, inicioDeMes };
