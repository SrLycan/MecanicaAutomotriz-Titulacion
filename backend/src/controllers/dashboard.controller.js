/**
 * SS SWAP - Panel de inicio (Dashboard) del personal
 *
 * Un solo endpoint que calcula en la BD (no en el navegador) lo mas
 * importante del taller, adaptado al rol:
 *  - administrador: todo, incluido dinero (Finanzas) y crecimiento con montos.
 *  - recepcionista: taller, citas, cartera y caja (sin saldos de bancos ni sueldos).
 *  - tecnico: sus ordenes asignadas, taller e inventario (sin dinero).
 * Ademas arma la lista "Necesita tu atencion" con enlaces directos.
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { redondear2 } = require('../utils/numeros');
const { saldosCuentas, saldoCaja } = require('../services/finanzas.service');

const num = (v) => Number(v) || 0;
const ETAPAS = ['en_revision', 'deteccion_falla', 'en_reparacion', 'esperando_repuestos', 'pruebas_finales', 'listo_entrega'];

/** Variacion porcentual (null si no hay base para comparar). */
const variacion = (actual, anterior) => (anterior > 0 ? Math.round(((actual - anterior) / anterior) * 1000) / 10 : null);

// GET /api/dashboard?meses=12
const resumenDashboard = async (req, res) => {
    const { id: usuarioId, rol } = req.usuario;
    const esAdmin = rol === 'administrador';
    const veDinero = esAdmin || rol === 'recepcionista';
    const meses = [6, 12].includes(Number(req.query.meses)) ? Number(req.query.meses) : 12;

    try {
        const consultas = {
            ordenes: pool.query(
                `SELECT COUNT(*) FILTER (WHERE estado = 'pendiente')   AS pendientes,
                        COUNT(*) FILTER (WHERE estado = 'en_progreso') AS en_progreso,
                        COUNT(*) FILTER (WHERE estado IN ('pendiente','en_progreso') AND estado_progreso = 'listo_entrega') AS listas_entrega,
                        COUNT(*) FILTER (WHERE estado IN ('pendiente','en_progreso') AND tecnico_id IS NULL) AS sin_tecnico,
                        COUNT(*) FILTER (WHERE estado = 'completado' AND date_trunc('month', COALESCE(fecha_salida, updated_at::date)) = date_trunc('month', CURRENT_DATE)) AS entregadas_mes,
                        COUNT(*) FILTER (WHERE estado IN ('pendiente','en_progreso') AND tecnico_id = $1) AS mias_activas,
                        COUNT(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)) AS creadas_mes,
                        COUNT(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE) - INTERVAL '1 month') AS creadas_mes_ant
                 FROM ordenes_trabajo`, [usuarioId]),
            etapas: pool.query(
                `SELECT COALESCE(estado_progreso, 'sin_etapa') AS etapa, COUNT(*) AS total
                 FROM ordenes_trabajo WHERE estado IN ('pendiente','en_progreso')
                   AND ($1::int IS NULL OR tecnico_id = $1)
                 GROUP BY 1`, [rol === 'tecnico' ? usuarioId : null]),
            ordenesActivas: pool.query(
                `SELECT o.id, o.numero, o.estado, o.estado_progreso, o.fecha_ingreso, c.nombre AS cliente_nombre,
                        v.placa, v.marca, v.modelo, t.nombre AS tecnico_nombre
                 FROM ordenes_trabajo o
                 JOIN clientes c ON c.id = o.cliente_id
                 LEFT JOIN vehiculos v ON v.id = o.vehiculo_id
                 LEFT JOIN usuarios t ON t.id = o.tecnico_id
                 WHERE o.estado IN ('pendiente','en_progreso') AND ($1::int IS NULL OR o.tecnico_id = $1)
                 ORDER BY (o.estado_progreso = 'listo_entrega') DESC, o.fecha_ingreso ASC, o.id ASC
                 LIMIT 6`, [rol === 'tecnico' ? usuarioId : null]),
            citasHoy: pool.query(
                `SELECT ci.id, ci.hora_inicio, ci.hora_fin, ci.estado, c.nombre AS cliente_nombre, s.nombre AS servicio_nombre,
                        v.placa
                 FROM citas ci
                 JOIN clientes c ON c.id = ci.cliente_id
                 JOIN tipos_servicio s ON s.id = ci.servicio_id
                 LEFT JOIN vehiculos v ON v.id = ci.vehiculo_id
                 WHERE ci.fecha = CURRENT_DATE AND ci.estado IN ('pendiente','confirmada')
                 ORDER BY ci.hora_inicio`),
            citasPendientes: pool.query(`SELECT COUNT(*) AS total FROM citas WHERE estado = 'pendiente' AND fecha >= CURRENT_DATE`),
            pedidos: pool.query(`SELECT COUNT(*) AS total FROM solicitudes_producto WHERE estado = 'pendiente'`),
            proformas: pool.query(
                `SELECT COUNT(*) FILTER (WHERE estado IN ('borrador','emitida')) AS por_aprobar,
                        COUNT(*) FILTER (WHERE estado = 'aprobada') AS aprobadas_sin_convertir,
                        COUNT(*) FILTER (WHERE estado IN ('aprobada','convertida') AND inventario_descontado_at IS NULL
                            AND EXISTS (SELECT 1 FROM proforma_items i WHERE i.proforma_id = p.id AND i.referencia_tipo = 'repuesto' AND i.referencia_id IS NOT NULL)) AS inventario_pendiente,
                        COUNT(*) FILTER (WHERE estado IN ('borrador','emitida') AND fecha_validez IS NOT NULL AND fecha_validez < CURRENT_DATE) AS vencidas_sin_marcar
                 FROM proformas p`),
            inventario: pool.query(
                `SELECT COUNT(*) AS productos,
                        COUNT(*) FILTER (WHERE stock_actual <= stock_minimo) AS bajo_stock,
                        COUNT(*) FILTER (WHERE stock_actual <= 0) AS agotados,
                        COALESCE(SUM(stock_actual * precio_compra), 0) AS valor_costo,
                        COALESCE(SUM(stock_actual * precio_venta), 0)  AS valor_venta
                 FROM repuestos WHERE activo`),
            bajoStock: pool.query(
                `SELECT id, codigo, nombre, stock_actual, stock_minimo, unidad_medida, area
                 FROM repuestos WHERE activo AND stock_actual <= stock_minimo
                 ORDER BY (stock_actual <= 0) DESC, stock_actual / NULLIF(stock_minimo, 0) NULLS FIRST, nombre
                 LIMIT 6`),
            movHoy: pool.query(
                `SELECT COUNT(*) FILTER (WHERE tipo = 'entrada') AS entradas, COUNT(*) FILTER (WHERE tipo = 'salida') AS salidas
                 FROM movimientos_inventario WHERE created_at >= CURRENT_DATE`),
            movRecientes: pool.query(
                `SELECT m.id, m.tipo, m.origen, m.cantidad, m.created_at, r.nombre AS repuesto_nombre, r.unidad_medida,
                        u.nombre AS usuario_nombre, p.numero AS proforma_numero, m.proforma_id
                 FROM movimientos_inventario m
                 JOIN repuestos r ON r.id = m.repuesto_id
                 JOIN usuarios u ON u.id = m.usuario_id
                 LEFT JOIN proformas p ON p.id = m.proforma_id
                 ORDER BY m.created_at DESC, m.id DESC LIMIT 6`),
            clientes: pool.query(
                `SELECT (SELECT COUNT(*) FROM clientes) AS total,
                        (SELECT COUNT(*) FROM clientes WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)) AS nuevos_mes,
                        (SELECT COUNT(*) FROM vehiculos) AS vehiculos`),
            // Crecimiento: ordenes, clientes nuevos (y dinero si es admin) por mes.
            serie: pool.query(
                `SELECT TO_CHAR(m.mes, 'YYYY-MM') AS mes,
                        (SELECT COUNT(*) FROM ordenes_trabajo o WHERE date_trunc('month', o.created_at) = m.mes) AS ordenes,
                        (SELECT COUNT(*) FROM clientes c WHERE date_trunc('month', c.created_at) = m.mes) AS clientes_nuevos,
                        (SELECT COUNT(*) FROM proformas p WHERE date_trunc('month', p.fecha_emision) = m.mes) AS proformas,
                        ${esAdmin ? `(SELECT COALESCE(SUM(f.monto), 0) FROM v_flujo_dinero f WHERE f.tipo = 'ingreso' AND f.categoria <> 'transferencia' AND date_trunc('month', f.fecha) = m.mes)` : '0'} AS ingresos,
                        ${esAdmin ? `(SELECT COALESCE(SUM(f.monto), 0) FROM v_flujo_dinero f WHERE f.tipo = 'egreso' AND f.categoria <> 'transferencia' AND date_trunc('month', f.fecha) = m.mes)` : '0'} AS egresos
                 FROM generate_series(date_trunc('month', CURRENT_DATE) - ($1::int - 1) * INTERVAL '1 month',
                                      date_trunc('month', CURRENT_DATE), INTERVAL '1 month') AS m(mes)
                 ORDER BY m.mes`, [meses]),
        };
        if (veDinero) {
            consultas.cartera = pool.query(
                `SELECT COALESCE(SUM(monto_total - monto_pagado), 0) AS por_cobrar,
                        COUNT(*) FILTER (WHERE estado = 'vencido' OR (fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURRENT_DATE)) AS vencidas,
                        COALESCE(SUM(monto_total - monto_pagado) FILTER (WHERE estado = 'vencido' OR (fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURRENT_DATE)), 0) AS monto_vencido
                 FROM cuentas_cobrar WHERE estado IN ('pendiente','parcial','vencido')`);
            consultas.cobradoMes = pool.query(
                `SELECT COALESCE(SUM(monto), 0) AS total FROM pagos_cliente
                 WHERE anulado_at IS NULL AND date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)`);
            consultas.caja = pool.query(
                `SELECT s.id, s.fecha_apertura, u.nombre AS usuario_nombre FROM caja_sesiones s
                 JOIN usuarios u ON u.id = s.usuario_apertura_id WHERE s.estado = 'abierta' LIMIT 1`);
        }
        if (esAdmin) {
            consultas.flujoMes = pool.query(
                `SELECT COALESCE(SUM(monto) FILTER (WHERE tipo = 'ingreso' AND date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)), 0) AS ingresos,
                        COALESCE(SUM(monto) FILTER (WHERE tipo = 'egreso'  AND date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)), 0) AS egresos,
                        COALESCE(SUM(monto) FILTER (WHERE tipo = 'ingreso' AND date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'), 0) AS ingresos_ant
                 FROM v_flujo_dinero WHERE categoria <> 'transferencia'`);
            consultas.nomina = pool.query(
                `SELECT COALESCE(SUM(GREATEST(ep.sueldo_base - COALESCE(pg.pagado, 0), 0)), 0) AS pendiente
                 FROM empleados_perfil ep
                 JOIN usuarios u ON u.id = ep.usuario_id AND u.activo
                 LEFT JOIN (SELECT usuario_id, SUM(monto_neto) AS pagado FROM pagos_empleados
                            WHERE anulado_at IS NULL AND tipo IN ('sueldo','anticipo') AND periodo = date_trunc('month', CURRENT_DATE)::date
                            GROUP BY usuario_id) pg ON pg.usuario_id = ep.usuario_id
                 WHERE ep.en_nomina`);
            consultas.deudaProv = pool.query(
                `SELECT COALESCE(SUM(GREATEST(saldo, 0)), 0) AS total FROM (
                    SELECT SUM(CASE WHEN tipo = 'compra' THEN monto WHEN tipo IN ('pago','abono','cancelacion') THEN -monto ELSE 0 END) AS saldo
                    FROM movimientos_financieros_proveedor WHERE estado = 'confirmado' GROUP BY proveedor_id) s`);
        }

        const claves = Object.keys(consultas);
        const resultados = await Promise.all(Object.values(consultas));
        const r = Object.fromEntries(claves.map((k, i) => [k, resultados[i].rows]));

        const o = r.ordenes[0];
        const inv = r.inventario[0];
        const prof = r.proformas[0];
        const cli = r.clientes[0];
        const etapas = Object.fromEntries(r.etapas.map(e => [e.etapa, Number(e.total)]));

        const datos = {
            rol,
            taller: {
                pendientes: Number(o.pendientes), en_progreso: Number(o.en_progreso), activas: Number(o.pendientes) + Number(o.en_progreso),
                listas_entrega: Number(o.listas_entrega), sin_tecnico: Number(o.sin_tecnico), entregadas_mes: Number(o.entregadas_mes),
                mias_activas: Number(o.mias_activas),
                creadas_mes: Number(o.creadas_mes), variacion_ordenes: variacion(Number(o.creadas_mes), Number(o.creadas_mes_ant)),
                etapas: [...ETAPAS, 'sin_etapa'].map(e => ({ etapa: e, total: etapas[e] || 0 })),
                ordenes_activas: r.ordenesActivas,
            },
            citas: { hoy: r.citasHoy, pendientes_confirmar: Number(r.citasPendientes[0].total) },
            pedidos_pendientes: Number(r.pedidos[0].total),
            proformas: {
                por_aprobar: Number(prof.por_aprobar), aprobadas_sin_convertir: Number(prof.aprobadas_sin_convertir),
                inventario_pendiente: Number(prof.inventario_pendiente), vencidas_sin_marcar: Number(prof.vencidas_sin_marcar),
            },
            inventario: {
                productos: Number(inv.productos), bajo_stock: Number(inv.bajo_stock), agotados: Number(inv.agotados),
                valor_costo: num(inv.valor_costo), valor_venta: num(inv.valor_venta),
                entradas_hoy: Number(r.movHoy[0].entradas), salidas_hoy: Number(r.movHoy[0].salidas),
                lista_bajo_stock: r.bajoStock.map(b => ({ ...b, stock_actual: num(b.stock_actual), stock_minimo: num(b.stock_minimo) })),
                movimientos_recientes: r.movRecientes.map(m => ({ ...m, cantidad: num(m.cantidad) })),
            },
            clientes: { total: Number(cli.total), nuevos_mes: Number(cli.nuevos_mes), vehiculos: Number(cli.vehiculos) },
            serie: r.serie.map(s => ({ mes: s.mes, ordenes: Number(s.ordenes), clientes_nuevos: Number(s.clientes_nuevos), proformas: Number(s.proformas), ingresos: num(s.ingresos), egresos: num(s.egresos) })),
        };

        if (veDinero) {
            const c = r.cartera[0];
            const { saldo } = await saldoCaja(pool);
            datos.cartera = { por_cobrar: num(c.por_cobrar), vencidas: Number(c.vencidas), monto_vencido: num(c.monto_vencido), cobrado_mes: num(r.cobradoMes[0].total) };
            datos.caja = { abierta: Boolean(r.caja[0]), sesion: r.caja[0] || null, saldo };
        }
        if (esAdmin) {
            const cuentas = await saldosCuentas(pool, { soloActivas: true });
            const f = r.flujoMes[0];
            datos.finanzas = {
                disponible: redondear2(cuentas.reduce((s, c) => s + c.saldo, 0)),
                cuentas: cuentas.map(c => ({ id: c.id, nombre: c.nombre, tipo: c.tipo, saldo: c.saldo })),
                ingresos_mes: num(f.ingresos), egresos_mes: num(f.egresos), resultado_mes: redondear2(num(f.ingresos) - num(f.egresos)),
                variacion_ingresos: variacion(num(f.ingresos), num(f.ingresos_ant)),
                nomina_pendiente: num(r.nomina[0].pendiente),
                deuda_proveedores: num(r.deudaProv[0].total),
            };
        }

        datos.atencion = construirAlertas(datos, rol);
        return res.json(datos);
    } catch (err) {
        console.error('Error resumenDashboard:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al cargar el panel de inicio.' });
    }
};

/** Lista priorizada de cosas que alguien tiene que hacer, con enlace directo. */
function construirAlertas(d, rol) {
    const a = [];
    const add = (nivel, texto, link, roles) => { if (!roles || roles.includes(rol)) a.push({ nivel, texto, link }); };
    const ADMIN_RECEP = ['administrador', 'recepcionista'];
    const s = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

    if (d.inventario.agotados > 0) add('alta', `${s(d.inventario.agotados, 'producto agotado', 'productos agotados')} en el inventario`, '/dashboard/inventario');
    if (d.proformas.inventario_pendiente > 0) add('alta', `${s(d.proformas.inventario_pendiente, 'proforma aprobada tiene', 'proformas aprobadas tienen')} material sin descontar del inventario (revisa el stock y confirma el uso)`, '/dashboard/proformas');
    if (d.cartera?.vencidas > 0) add('alta', `${s(d.cartera.vencidas, 'pagaré vencido', 'pagarés vencidos')} por $${d.cartera.monto_vencido.toFixed(2)}`, '/dashboard/clientes?tab=pagare', ADMIN_RECEP);
    if (d.pedidos_pendientes > 0) add('media', `${d.pedidos_pendientes === 1 ? '1 pedido de la tienda espera ser atendido' : `${d.pedidos_pendientes} pedidos de la tienda esperan ser atendidos`}`, '/dashboard/pedidos');
    if (d.taller.listas_entrega > 0) add('media', `${s(d.taller.listas_entrega, 'vehículo listo', 'vehículos listos')} para entregar al cliente`, '/dashboard/ordenes');
    if (d.citas.hoy.length > 0) add('media', `${s(d.citas.hoy.length, 'cita', 'citas')} para hoy`, '/dashboard/citas');
    if (d.citas.pendientes_confirmar > 0) add('media', `${s(d.citas.pendientes_confirmar, 'cita espera', 'citas esperan')} confirmación`, '/dashboard/citas', ADMIN_RECEP);
    if (d.taller.sin_tecnico > 0) add('media', `${s(d.taller.sin_tecnico, 'orden activa no tiene', 'órdenes activas no tienen')} técnico asignado`, '/dashboard/ordenes', ADMIN_RECEP);
    if (d.inventario.bajo_stock - d.inventario.agotados > 0) add('media', `${s(d.inventario.bajo_stock - d.inventario.agotados, 'producto está', 'productos están')} por debajo del stock mínimo`, '/dashboard/inventario');
    if (d.proformas.aprobadas_sin_convertir > 0) add('baja', `${s(d.proformas.aprobadas_sin_convertir, 'proforma aprobada', 'proformas aprobadas')} sin convertir en orden de trabajo`, '/dashboard/proformas');
    if (d.proformas.vencidas_sin_marcar > 0) add('baja', `${s(d.proformas.vencidas_sin_marcar, 'proforma pasó', 'proformas pasaron')} su fecha de validez`, '/dashboard/proformas');
    if (d.caja && !d.caja.abierta) add('baja', 'La caja diaria está cerrada', '/dashboard/caja', ADMIN_RECEP);
    if (d.finanzas?.nomina_pendiente > 0) add('baja', `Nómina del mes pendiente: $${d.finanzas.nomina_pendiente.toFixed(2)}`, '/dashboard/finanzas?tab=nomina', ['administrador']);
    return a;
}

module.exports = { resumenDashboard };
