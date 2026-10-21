/**
 * SS SWAP - Reporte de una sesion de caja (Sprint 29)
 *
 * Arma, para una caja abierta o cerrada, todo lo que paso entre su apertura
 * y su cierre (o hasta ahora si sigue abierta):
 *  - Cuadre de EFECTIVO: apertura + entradas - salidas = esperado, contra lo
 *    contado por el cajero.
 *  - Cuadre por FORMA DE PAGO: lo que dice el sistema (cheques,
 *    transferencias, tarjetas) contra lo que declaro el cajero.
 *  - Ventas del periodo (pagares creados y facturas sin pagare), ventas
 *    100 % a credito, recaudaciones de cartera (cobros de deudas anteriores),
 *    anticipos de clientes, resumen por documento y por vendedor.
 *  - Movimientos manuales de la caja (incluidos los anulados, marcados).
 *
 * En una caja CERRADA el cuadre sale de lo que se guardo al cerrar
 * (monto_cierre_esperado, declaracion_cierre, resumen_cierre), asi el reporte
 * no cambia aunque despues se anule algo; los listados se leen en vivo.
 * Las ventas, cobros y anticipos son de toda la empresa (la caja es una sola).
 */
const { redondear2 } = require('../utils/numeros');
const { cuentaCajaPredeterminada } = require('./finanzas.service');

/** Formas de pago que el cajero declara al cerrar (ademas del efectivo contado). */
const FORMAS_DECLARABLES = [
    { codigo: 'cheque',          nombre: 'Cheques' },
    { codigo: 'transferencia',   nombre: 'Transferencias' },
    { codigo: 'tarjeta_credito', nombre: 'Tarjeta de crédito' },
    { codigo: 'tarjeta_debito',  nombre: 'Tarjeta de débito' },
    { codigo: 'otro',            nombre: 'Otros medios' },
];
/** Documentos que el cliente entrega y el cajero solo declara (el sistema no los registra todavía). */
const RETENCIONES = [
    { codigo: 'retencion_fuente', nombre: 'Retención en la fuente' },
    { codigo: 'retencion_iva',    nombre: 'Retención del IVA' },
];
const NOMBRE_METODO = {
    efectivo: 'Efectivo', cheque: 'Cheque', transferencia: 'Transferencia',
    tarjeta_credito: 'Tarjeta de crédito', tarjeta_debito: 'Tarjeta de débito', otro: 'Otro',
};

/** Clave de forma de pago: la tarjeta se separa en credito/debito (sin tipo cuenta como credito). */
const claveMetodo = (metodo, tarjetaTipo) =>
    metodo === 'tarjeta' ? (tarjetaTipo === 'debito' ? 'tarjeta_debito' : 'tarjeta_credito') : (metodo || 'otro');

/** Limpia la declaracion del cajero: solo formas conocidas, montos >= 0 con 2 decimales. */
function limpiarDeclaracion(entrada) {
    const out = {};
    if (!entrada || typeof entrada !== 'object') return out;
    for (const { codigo } of [...FORMAS_DECLARABLES, ...RETENCIONES]) {
        const v = entrada[codigo];
        if (v === undefined || v === null || v === '') continue;
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) {
            const e = new Error(`El valor declarado en "${codigo}" no es válido.`);
            e.status = 400;
            throw e;
        }
        if (n > 0) out[codigo] = redondear2(n);
    }
    return out;
}

/** Inicio y fin de la sesion (fin = ahora si sigue abierta). */
const ventana = (sesion) => [sesion.fecha_apertura, sesion.fecha_cierre || new Date()];

/** Flujo de EFECTIVO de la caja durante la sesion (sin ajustes de conteo). */
async function flujoEfectivo(db, sesion, cajaId) {
    const [ini, fin] = ventana(sesion);
    const { rows } = await db.query(
        `SELECT f.*, COALESCE(c.nombre, f.categoria) AS categoria_nombre
         FROM v_flujo_dinero f
         LEFT JOIN cat_categorias_dinero c ON c.codigo = f.categoria
         WHERE f.cuenta_dinero_id = $1 AND f.momento >= $2 AND f.momento <= $3 AND f.categoria <> 'ajuste_caja'
         ORDER BY f.momento DESC, f.origen_id DESC`,
        [cajaId, ini, fin]
    );
    const suma = (tipo) => redondear2(rows.filter(m => m.tipo === tipo).reduce((a, m) => a + Number(m.monto), 0));
    const ingresos = suma('ingreso');
    const egresos = suma('egreso');
    return { movimientos: rows, ingresos, egresos, esperado: redondear2(Number(sesion.monto_apertura) + ingresos - egresos) };
}

/** Ingresos de la sesion por forma de pago en TODAS las cuentas (tarjeta separada en credito/debito). */
async function ingresosPorForma(db, sesion) {
    const [ini, fin] = ventana(sesion);
    const { rows } = await db.query(
        `SELECT f.metodo_pago, pc.tarjeta_tipo, f.tipo, SUM(f.monto) AS total, COUNT(*)::int AS cantidad
         FROM v_flujo_dinero f
         LEFT JOIN pagos_cliente pc ON f.origen = 'pago_cliente' AND pc.id = f.origen_id
         WHERE f.momento >= $1 AND f.momento <= $2
           AND f.categoria NOT IN ('ajuste_caja', 'transferencia')  -- ni conteos ni dinero movido entre cuentas
         GROUP BY f.metodo_pago, pc.tarjeta_tipo, f.tipo`,
        [ini, fin]
    );
    const res = {};
    for (const r of rows) {
        const k = claveMetodo(r.metodo_pago, r.tarjeta_tipo);
        res[k] = res[k] || { ingresos: 0, egresos: 0, cantidad: 0 };
        if (r.tipo === 'ingreso') { res[k].ingresos = redondear2(res[k].ingresos + Number(r.total)); res[k].cantidad += r.cantidad; }
        else res[k].egresos = redondear2(res[k].egresos + Number(r.total));
    }
    return res;
}

/** Sesion con nombres de cajero, usuarios y sucursal. */
async function obtenerSesion(db, id) {
    const { rows } = await db.query(
        `SELECT s.*, ua.nombre AS usuario_apertura_nombre, uc.nombre AS usuario_cierre_nombre,
                COALESCE(cj.nombre, ua.nombre) AS cajero_nombre, su.nombre AS sucursal_nombre
         FROM caja_sesiones s
         JOIN usuarios ua ON ua.id = s.usuario_apertura_id
         LEFT JOIN usuarios uc ON uc.id = s.usuario_cierre_id
         LEFT JOIN usuarios cj ON cj.id = s.cajero_id
         LEFT JOIN sucursales su ON su.id = s.sucursal_id
         WHERE s.id = $1`,
        [id]
    );
    return rows[0] || null;
}

const numeroFactura = (f) => (f && f.secuencial ? `${f.establecimiento}-${f.punto_emision}-${f.secuencial}` : null);

/** Ventas del periodo: pagares creados en la sesion + facturas emitidas sin pagare. */
async function ventasDeSesion(db, sesion) {
    const [ini, fin] = ventana(sesion);
    const { rows: pagares } = await db.query(
        `SELECT cc.id AS cuenta_id, COALESCE(p.aprobada_at, cc.created_at) AS momento, cc.fecha, cc.fecha_vencimiento, cc.concepto,
                cc.monto_total, cc.monto_pagado, cc.estado, cc.usuario_id, cc.orden_id,
                c.nombre AS cliente, u.nombre AS vendedor, p.numero AS proforma_numero,
                f.id AS factura_id, f.establecimiento, f.punto_emision, f.secuencial,
                COALESCE((SELECT json_agg(json_build_object('metodo', pg.metodo_pago, 'tarjeta_tipo', pg.tarjeta_tipo, 'monto', pg.monto) ORDER BY pg.id)
                            FROM pagos_cliente pg
                           WHERE pg.cuenta_id = cc.id AND pg.anulado_at IS NULL AND pg.created_at <= $2), '[]'::json) AS pagos
         FROM cuentas_cobrar cc
         JOIN clientes c ON c.id = cc.cliente_id
         LEFT JOIN usuarios u ON u.id = cc.usuario_id
         LEFT JOIN proformas p ON p.id = cc.proforma_id
         LEFT JOIN LATERAL (
             SELECT fe.id, fe.establecimiento, fe.punto_emision, fe.secuencial FROM comprobantes_electronicos fe
              WHERE fe.cuenta_cobrar_id = cc.id AND fe.cod_doc = '01' AND fe.estado NOT IN ('borrador','descartado','anulado')
              ORDER BY fe.id DESC LIMIT 1) f ON TRUE
         WHERE COALESCE(p.aprobada_at, cc.created_at) >= $1 AND COALESCE(p.aprobada_at, cc.created_at) <= $2 AND cc.estado <> 'anulado'
         ORDER BY 2`,
        [ini, fin]
    );
    const { rows: facturas } = await db.query(
        `SELECT fe.id AS factura_id, fe.cod_doc, COALESCE(fe.emitido_at, fe.created_at) AS momento, fe.fecha_emision AS fecha,
                fe.establecimiento, fe.punto_emision, fe.secuencial, fe.importe_total, fe.estado AS estado_sri,
                fe.comprador_razon_social AS cliente, u.nombre AS vendedor, COALESCE(fe.emitido_por, fe.creado_por) AS usuario_id
         FROM comprobantes_electronicos fe
         LEFT JOIN usuarios u ON u.id = COALESCE(fe.emitido_por, fe.creado_por)
         WHERE fe.cod_doc IN ('01','04') AND fe.estado NOT IN ('borrador','descartado','anulado')
           AND COALESCE(fe.emitido_at, fe.created_at) >= $1 AND COALESCE(fe.emitido_at, fe.created_at) <= $2
           AND (fe.cod_doc = '04' OR fe.cuenta_cobrar_id IS NULL)
         ORDER BY 3`,
        [ini, fin]
    );

    // Proformas aprobadas (o convertidas en orden) durante la caja que todavia
    // no tienen pagare ni factura: son ventas por cobrar completas.
    const { rows: proformas } = await db.query(
        `SELECT p.id, p.numero, p.aprobada_at AS momento, p.fecha_emision AS fecha, p.fecha_validez, p.total, p.estado, p.tipo,
                COALESCE(c.nombre, p.cliente_nombre) AS cliente, u.nombre AS vendedor, p.usuario_id
         FROM proformas p
         LEFT JOIN clientes c ON c.id = p.cliente_id
         LEFT JOIN usuarios u ON u.id = p.usuario_id
         WHERE p.estado IN ('aprobada', 'convertida') AND p.total > 0
           AND p.aprobada_at >= $1 AND p.aprobada_at <= $2
           AND NOT EXISTS (SELECT 1 FROM cuentas_cobrar cc WHERE cc.proforma_id = p.id AND cc.estado <> 'anulado')
           AND NOT EXISTS (SELECT 1 FROM comprobantes_electronicos fe WHERE fe.proforma_id = p.id AND fe.cod_doc = '01'
                             AND fe.estado NOT IN ('borrador', 'descartado', 'anulado'))
         ORDER BY p.aprobada_at`,
        [ini, fin]
    );

    const ventas = pagares.map(v => {
        const pagos = (v.pagos || []).map(pg => ({ forma: claveMetodo(pg.metodo, pg.tarjeta_tipo), monto: redondear2(pg.monto) }));
        const pagado = redondear2(pagos.reduce((a, pg) => a + pg.monto, 0));
        const total = redondear2(v.monto_total);
        const nf = numeroFactura(v);
        return {
            tipo: nf ? 'FACTURA' : 'PAGARÉ',
            numero: nf || `Pagaré #${v.cuenta_id}`,
            referencia: v.proforma_numero ? `Proforma ${v.proforma_numero}` : v.concepto,
            momento: v.momento, fecha: v.fecha, vencimiento: v.fecha_vencimiento,
            cliente: v.cliente, vendedor: v.vendedor || 'Sin registro', usuario_id: v.usuario_id,
            total, pagos, pagado, pendiente: redondear2(Math.max(total - pagado, 0)),
            estado: v.estado, cuenta_id: v.cuenta_id, factura_id: v.factura_id,
        };
    });
    for (const p of proformas) {
        const total = redondear2(p.total);
        ventas.push({
            tipo: 'PROFORMA', numero: `Proforma ${p.numero}`,
            referencia: p.estado === 'convertida' ? 'Convertida en orden, sin pagaré' : 'Aprobada, sin pagaré ni pagos',
            momento: p.momento, fecha: p.fecha, vencimiento: p.fecha_validez,
            cliente: p.cliente || 'Sin cliente', vendedor: p.vendedor || 'Sin registro', usuario_id: p.usuario_id,
            total, pagos: [], pagado: 0, pendiente: total, estado: p.estado, cuenta_id: null, factura_id: null, proforma_id: p.id,
        });
    }
    for (const f of facturas) {
        const nc = f.cod_doc === '04';
        const total = redondear2(f.importe_total) * (nc ? -1 : 1);
        ventas.push({
            tipo: nc ? 'NOTA DE CRÉDITO' : 'FACTURA', numero: numeroFactura(f),
            referencia: nc ? 'Nota de crédito' : 'Factura sin pagaré (el cobro no pasó por Pagarés)',
            momento: f.momento, fecha: f.fecha, vencimiento: null,
            cliente: f.cliente, vendedor: f.vendedor || 'Sin registro', usuario_id: f.usuario_id,
            total, pagos: [], pagado: null, pendiente: null, estado: f.estado_sri, cuenta_id: null, factura_id: f.factura_id,
        });
    }
    ventas.sort((a, b) => new Date(a.momento) - new Date(b.momento));
    return ventas;
}

/** Cobros de la sesion a deudas creadas ANTES de la apertura (cartera). */
async function recaudacionesDeSesion(db, sesion) {
    const [ini, fin] = ventana(sesion);
    const { rows } = await db.query(
        `SELECT pg.id, pg.created_at AS momento, pg.monto, pg.metodo_pago, pg.tarjeta_tipo, pg.referencia, pg.numero_comprobante,
                c.nombre AS cliente, cc.id AS cuenta_id, cc.concepto, cc.monto_total, cc.fecha AS fecha_deuda,
                p.numero AS proforma_numero, f.establecimiento, f.punto_emision, f.secuencial, u.nombre AS registrado_por
         FROM pagos_cliente pg
         JOIN cuentas_cobrar cc ON cc.id = pg.cuenta_id
         JOIN clientes c ON c.id = cc.cliente_id
         LEFT JOIN proformas p ON p.id = cc.proforma_id
         LEFT JOIN usuarios u ON u.id = pg.usuario_id
         LEFT JOIN LATERAL (
             SELECT fe.establecimiento, fe.punto_emision, fe.secuencial FROM comprobantes_electronicos fe
              WHERE fe.cuenta_cobrar_id = cc.id AND fe.cod_doc = '01' AND fe.estado NOT IN ('borrador','descartado','anulado')
              ORDER BY fe.id DESC LIMIT 1) f ON TRUE
         WHERE pg.anulado_at IS NULL AND pg.created_at >= $1 AND pg.created_at <= $2 AND COALESCE(p.aprobada_at, cc.created_at) < $1
         ORDER BY pg.created_at`,
        [ini, fin]
    );
    return rows.map(r => ({
        id: r.id, momento: r.momento, cliente: r.cliente,
        documento: numeroFactura(r) ? `Factura ${numeroFactura(r)}` : `Pagaré #${r.cuenta_id}${r.proforma_numero ? ` · ${r.proforma_numero}` : ''}`,
        total_documento: redondear2(r.monto_total), forma: claveMetodo(r.metodo_pago, r.tarjeta_tipo),
        cobrado: redondear2(r.monto), referencia: r.numero_comprobante || r.referencia || null, registrado_por: r.registrado_por,
    }));
}

/** Anticipos de clientes registrados en Finanzas durante la sesion. */
async function anticiposDeSesion(db, sesion) {
    const [ini, fin] = ventana(sesion);
    const { rows } = await db.query(
        `SELECT md.id, md.created_at AS momento, md.descripcion, md.referencia, md.metodo_pago, md.monto, u.nombre AS registrado_por
         FROM movimientos_dinero md
         LEFT JOIN usuarios u ON u.id = md.usuario_id
         WHERE md.categoria = 'anticipo_cliente' AND md.tipo = 'ingreso' AND md.anulado_at IS NULL
           AND md.created_at >= $1 AND md.created_at <= $2
         ORDER BY md.created_at`,
        [ini, fin]
    );
    return rows.map(r => ({ ...r, monto: redondear2(r.monto), forma: claveMetodo(r.metodo_pago) }));
}

/** Movimientos manuales (entradas/salidas) de la sesion, con los anulados marcados. */
async function movimientosManuales(db, sesionId) {
    const { rows } = await db.query(
        `SELECT cm.id, cm.tipo, cm.concepto, cm.monto, cm.referencia, cm.created_at, cm.anulado_at, cm.motivo_anulacion,
                u.nombre AS usuario_nombre, ua.nombre AS anulado_por_nombre
         FROM caja_movimientos cm
         LEFT JOIN usuarios u ON u.id = cm.usuario_id
         LEFT JOIN usuarios ua ON ua.id = cm.anulado_por
         WHERE cm.caja_sesion_id = $1
         ORDER BY cm.created_at`,
        [sesionId]
    );
    return rows.map(r => ({ ...r, monto: redondear2(r.monto) }));
}

/**
 * TODO el dinero que entro y salio durante la sesion, en cualquier forma de
 * pago (cobros, anticipos, pagos a proveedores, gastos, sueldos, caja...),
 * sin ajustes de conteo ni transferencias entre cuentas.
 */
async function movimientosDinero(db, sesion) {
    const [ini, fin] = ventana(sesion);
    const { rows } = await db.query(
        `SELECT f.origen, f.origen_id, f.momento, f.tipo, f.categoria, COALESCE(c.nombre, f.categoria) AS categoria_nombre,
                f.monto, f.metodo_pago, pc.tarjeta_tipo, f.descripcion, f.tercero, f.referencia
         FROM v_flujo_dinero f
         LEFT JOIN cat_categorias_dinero c ON c.codigo = f.categoria
         LEFT JOIN pagos_cliente pc ON f.origen = 'pago_cliente' AND pc.id = f.origen_id
         WHERE f.momento >= $1 AND f.momento <= $2 AND f.categoria NOT IN ('ajuste_caja', 'transferencia')
         ORDER BY f.momento, f.origen_id`,
        [ini, fin]
    );
    return rows.map(r => ({
        origen: r.origen, origen_id: r.origen_id, momento: r.momento, tipo: r.tipo, categoria: r.categoria_nombre,
        forma: claveMetodo(r.metodo_pago, r.tarjeta_tipo), monto: redondear2(r.monto),
        descripcion: r.descripcion, tercero: r.tercero, referencia: r.referencia,
    }));
}

/** Conteo { "20": 4, "0.25": 8 } -> filas ordenadas de mayor a menor con su subtotal. */
function filasConteo(conteo) {
    if (!conteo || typeof conteo !== 'object') return [];
    return Object.entries(conteo)
        .map(([valor, cantidad]) => ({ valor: Number(valor), cantidad: Number(cantidad), subtotal: redondear2(Number(valor) * Number(cantidad)) }))
        .filter(x => x.cantidad > 0)
        .sort((a, b) => b.valor - a.valor);
}

/** Agrupa filas por una clave y suma un campo. */
function agrupar(filas, clave, campo) {
    const m = new Map();
    for (const f of filas) {
        const k = f[clave];
        const a = m.get(k) || { [clave]: k, cantidad: 0, total: 0 };
        a.cantidad += 1;
        a.total = redondear2(a.total + Number(f[campo] || 0));
        m.set(k, a);
    }
    return [...m.values()];
}

/**
 * Reporte completo de una sesion. Devuelve null si no existe.
 * @param {object} db  pool o cliente (respeta el aislamiento por empresa)
 */
async function reporteSesion(db, sesionId) {
    const sesion = await obtenerSesion(db, sesionId);
    if (!sesion) return null;
    const caja = await cuentaCajaPredeterminada(db);
    const cerrada = sesion.estado === 'cerrada';

    const [flujo, porForma, ventas, recaudaciones, anticipos, manuales, dinero] = await Promise.all([
        caja ? flujoEfectivo(db, sesion, caja.id) : Promise.resolve({ movimientos: [], ingresos: 0, egresos: 0, esperado: Number(sesion.monto_apertura) }),
        ingresosPorForma(db, sesion),
        ventasDeSesion(db, sesion),
        recaudacionesDeSesion(db, sesion),
        anticiposDeSesion(db, sesion),
        movimientosManuales(db, sesion.id),
        movimientosDinero(db, sesion),
    ]);

    // ── Cuadre de efectivo ──
    const congelado = cerrada && sesion.resumen_cierre ? sesion.resumen_cierre : null;
    const efectivo = {
        apertura: redondear2(sesion.monto_apertura),
        ingresos: congelado ? redondear2(congelado.ingresos) : flujo.ingresos,
        egresos: congelado ? redondear2(congelado.egresos) : flujo.egresos,
        esperado: cerrada && sesion.monto_cierre_esperado != null ? redondear2(sesion.monto_cierre_esperado) : flujo.esperado,
        contado: cerrada ? redondear2(sesion.monto_cierre_real) : null,
        diferencia: cerrada ? redondear2(sesion.diferencia) : null,
    };

    // ── Cuadre por forma de pago (sistema contra lo declarado) ──
    const sistemaFormas = congelado?.formas || Object.fromEntries(FORMAS_DECLARABLES.map(f => [f.codigo, redondear2(porForma[f.codigo]?.ingresos || 0)]));
    const declaracion = sesion.declaracion_cierre || {};
    const formas = [
        { codigo: 'efectivo', nombre: 'Efectivo (en caja)', sistema: efectivo.esperado, declarado: efectivo.contado,
          diferencia: efectivo.diferencia },
        ...FORMAS_DECLARABLES.map(f => {
            const sistema = redondear2(sistemaFormas[f.codigo] || 0);
            const declarado = cerrada ? redondear2(declaracion[f.codigo] || 0) : null;
            return { ...f, sistema, declarado, diferencia: cerrada ? redondear2(declarado - sistema) : null };
        }),
    ];
    const retenciones = RETENCIONES.map(r => ({ ...r, declarado: cerrada ? redondear2(declaracion[r.codigo] || 0) : null }));

    // ── Ingresos del sistema: cobros + anticipos por forma de pago, y lo que quedo por cobrar ──
    const cobrosVentas = ventas.flatMap(v => v.pagos.map(pg => ({ forma: pg.forma, monto: pg.monto })));
    const ingresosDetalle = [
        ...cobrosVentas,
        ...recaudaciones.map(r => ({ forma: r.forma, monto: r.cobrado })),
        ...anticipos.map(a => ({ forma: a.forma, monto: a.monto })),
    ];
    const ingresosSistema = agrupar(ingresosDetalle, 'forma', 'monto').map(f => ({ ...f, nombre: NOMBRE_METODO[f.forma] || f.forma }));
    const porCobrar = redondear2(ventas.reduce((a, v) => a + (v.pendiente || 0), 0));
    // El credito (por cobrar) siempre se muestra, aunque sea $0.00.
    ingresosSistema.push({ forma: 'credito', nombre: 'Crédito (por cobrar)', cantidad: ventas.filter(v => v.pendiente > 0).length, total: porCobrar });

    const totalVentas = redondear2(ventas.reduce((a, v) => a + v.total, 0));
    const ventasCredito = ventas.filter(v => v.pendiente !== null && v.pagado === 0 && v.total > 0);
    const porCobrarLista = ventas.filter(v => v.pendiente > 0);

    // Ingresos y egresos del periodo por forma de pago (todas las cuentas).
    const resumenDinero = {};
    for (const m of dinero) {
        const r = resumenDinero[m.forma] || (resumenDinero[m.forma] = { forma: m.forma, nombre: NOMBRE_METODO[m.forma] || m.forma, ingresos: 0, egresos: 0 });
        r[m.tipo === 'ingreso' ? 'ingresos' : 'egresos'] = redondear2(r[m.tipo === 'ingreso' ? 'ingresos' : 'egresos'] + m.monto);
    }

    // Con cuanto y como se abrio la caja (y como se conto al cerrar).
    const apertura = {
        monto: redondear2(sesion.monto_apertura), forma: 'efectivo', contada: Boolean(sesion.denominaciones_apertura),
        conteo: filasConteo(sesion.denominaciones_apertura), usuario: sesion.usuario_apertura_nombre, notas: sesion.notas_apertura,
    };
    const conteoCierre = filasConteo(sesion.denominaciones_cierre);
    const activos = manuales.filter(m => !m.anulado_at);

    return {
        sesion, caja, cerrada,
        efectivo, formas, retenciones, apertura, conteo_cierre: conteoCierre,
        ingresos_sistema: ingresosSistema,
        ventas, ventas_credito: ventasCredito, recaudaciones, anticipos,
        documentos: agrupar(ventas, 'tipo', 'total'),
        por_vendedor: agrupar(ventas, 'vendedor', 'total'),
        movimientos_manuales: manuales,
        movimientos_efectivo: flujo.movimientos,
        movimientos_dinero: dinero,
        resumen_dinero: Object.values(resumenDinero),
        por_cobrar: porCobrarLista,
        totales: {
            ventas: totalVentas,
            credito_puro: redondear2(ventasCredito.reduce((a, v) => a + v.total, 0)),
            recaudado: redondear2(recaudaciones.reduce((a, r) => a + r.cobrado, 0)),
            anticipos: redondear2(anticipos.reduce((a, r) => a + r.monto, 0)),
            por_cobrar: porCobrar,
            ingresos_periodo: redondear2(dinero.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0)),
            egresos_periodo: redondear2(dinero.filter(m => m.tipo === 'egreso').reduce((a, m) => a + m.monto, 0)),
            dinero_recibido: redondear2(ingresosDetalle.reduce((a, r) => a + r.monto, 0)),
            manuales_ingresos: redondear2(activos.filter(m => m.tipo === 'ingreso').reduce((a, m) => a + m.monto, 0)),
            manuales_egresos: redondear2(activos.filter(m => m.tipo === 'egreso').reduce((a, m) => a + m.monto, 0)),
        },
        reaperturas: sesion.reaperturas || [],
    };
}

module.exports = {
    FORMAS_DECLARABLES, RETENCIONES, NOMBRE_METODO,
    claveMetodo, limpiarDeclaracion, flujoEfectivo, ingresosPorForma, obtenerSesion, reporteSesion,
};
