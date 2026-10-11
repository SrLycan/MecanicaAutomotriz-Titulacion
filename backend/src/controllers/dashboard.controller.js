/**
 * SS SWAP - Panel de inicio (Dashboard) del personal
 *
 * Un solo endpoint que calcula en la BD (no en el navegador) lo mas
 * importante del taller, adaptado a los PERMISOS de quien lo consulta:
 * cada seccion (taller, citas, proformas, inventario, cartera, caja,
 * finanzas...) solo se calcula y se devuelve si el usuario tiene permiso
 * para ver ese modulo. Las proformas y el inventario se limitan ademas a
 * los tipos / areas permitidos.
 * Ademas arma la lista "Necesita tu atencion" con enlaces directos.
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { redondear2 } = require('../utils/numeros');
const { saldosCuentas, saldoCaja } = require('../services/finanzas.service');
const { puede, esSuperadmin, tiposProformaPermitidos, areasInventarioPermitidas } = require('../middleware/auth.middleware');

const num = (v) => Number(v) || 0;
const ETAPAS = ['en_revision', 'deteccion_falla', 'en_reparacion', 'esperando_repuestos', 'pruebas_finales', 'listo_entrega'];

/** Variacion porcentual (null si no hay base para comparar). */
const variacion = (actual, anterior) => (anterior > 0 ? Math.round(((actual - anterior) / anterior) * 1000) / 10 : null);

/** Secciones del panel que el usuario puede ver. */
function seccionesVisibles(usuario) {
    const P = (m, a) => puede(usuario, m, a);
    const areas = areasInventarioPermitidas(usuario, 'ver');
    const tipos = tiposProformaPermitidos(usuario, 'ver');
    return {
        taller: P('ordenes', 'ver'),
        citas: P('citas', 'ver'),
        pedidos: P('pedidos_tienda', 'ver'),
        proformas: tipos.length > 0,
        inventario: areas.length > 0,
        movimientos: areas.length > 0 && P('registros_inventario', 'ver'),
        clientes: P('clientes', 'ver'),
        vehiculos: P('vehiculos', 'ver'),
        cartera: P('cuentas_cobrar', 'ver'),
        caja: P('caja', 'ver'),
        finanzas: P('finanzas', 'ver'),
        // Filtros: null = sin restriccion (superadministrador).
        areas: esSuperadmin(usuario) ? null : areas,
        tipos: esSuperadmin(usuario) ? null : tipos,
    };
}

// GET /api/dashboard?meses=12
const resumenDashboard = async (req, res) => {
    const { id: usuarioId, rol } = req.usuario;
    const esTecnico = rol === 'tecnico';
    const meses = [6, 12].includes(Number(req.query.meses)) ? Number(req.query.meses) : 12;
    const v = seccionesVisibles(req.usuario);

    try {
        const consultas = {};
        if (v.taller) {
            consultas.ordenes = pool.query(
                `SELECT COUNT(*) FILTER (WHERE estado = 'pendiente')   AS pendientes,
                        COUNT(*) FILTER (WHERE estado = 'en_progreso') AS en_progreso,
                        COUNT(*) FILTER (WHERE estado IN ('pendiente','en_progreso') AND estado_progreso = 'listo_entrega') AS listas_entrega,
                        COUNT(*) FILTER (WHERE estado IN ('pendiente','en_progreso') AND tecnico_id IS NULL) AS sin_tecnico,
                        COUNT(*) FILTER (WHERE estado = 'completado' AND date_trunc('month', COALESCE(fecha_salida, updated_at::date)) = date_trunc('month', CURRENT_DATE)) AS entregadas_mes,
                        COUNT(*) FILTER (WHERE estado IN ('pendiente','en_progreso') AND tecnico_id = $1) AS mias_activas,
                        COUNT(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)) AS creadas_mes,
                        COUNT(*) FILTER (WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE) - INTERVAL '1 month') AS creadas_mes_ant
                 FROM ordenes_trabajo`, [usuarioId]);
            consultas.etapas = pool.query(
                `SELECT COALESCE(estado_progreso, 'sin_etapa') AS etapa, COUNT(*) AS total
                 FROM ordenes_trabajo WHERE estado IN ('pendiente','en_progreso')
                   AND ($1::int IS NULL OR tecnico_id = $1)
                 GROUP BY 1`, [esTecnico ? usuarioId : null]);
            consultas.ordenesActivas = pool.query(
                `SELECT o.id, o.numero, o.estado, o.estado_progreso, o.fecha_ingreso, c.nombre AS cliente_nombre,
                        v.placa, v.marca, v.modelo, t.nombre AS tecnico_nombre
                 FROM ordenes_trabajo o
                 JOIN clientes c ON c.id = o.cliente_id
                 LEFT JOIN vehiculos v ON v.id = o.vehiculo_id
                 LEFT JOIN usuarios t ON t.id = o.tecnico_id
                 WHERE o.estado IN ('pendiente','en_progreso') AND ($1::int IS NULL OR o.tecnico_id = $1)
                 ORDER BY (o.estado_progreso = 'listo_entrega') DESC, o.fecha_ingreso ASC, o.id ASC
                 LIMIT 6`, [esTecnico ? usuarioId : null]);
        }
        if (v.citas) {
            consultas.citasHoy = pool.query(
                `SELECT ci.id, ci.hora_inicio, ci.hora_fin, ci.estado, c.nombre AS cliente_nombre, s.nombre AS servicio_nombre,
                        v.placa
                 FROM citas ci
                 JOIN clientes c ON c.id = ci.cliente_id
                 JOIN tipos_servicio s ON s.id = ci.servicio_id
                 LEFT JOIN vehiculos v ON v.id = ci.vehiculo_id
                 WHERE ci.fecha = CURRENT_DATE AND ci.estado IN ('pendiente','confirmada')
                 ORDER BY ci.hora_inicio`);
            consultas.citasPendientes = pool.query(`SELECT COUNT(*) AS total FROM citas WHERE estado = 'pendiente' AND fecha >= CURRENT_DATE`);
        }
        if (v.pedidos) consultas.pedidos = pool.query(`SELECT COUNT(*) AS total FROM solicitudes_producto WHERE estado = 'pendiente'`);
        if (v.proformas) {
            consultas.proformas = pool.query(
                `SELECT COUNT(*) FILTER (WHERE estado IN ('borrador','emitida')) AS por_aprobar,
                        COUNT(*) FILTER (WHERE estado = 'aprobada') AS aprobadas_sin_convertir,
                        COUNT(*) FILTER (WHERE estado IN ('aprobada','convertida') AND inventario_descontado_at IS NULL
                            AND EXISTS (SELECT 1 FROM proforma_items i WHERE i.proforma_id = p.id AND i.referencia_tipo = 'repuesto' AND i.referencia_id IS NOT NULL)) AS inventario_pendiente,
                        COUNT(*) FILTER (WHERE estado IN ('borrador','emitida') AND fecha_validez IS NOT NULL AND fecha_validez < CURRENT_DATE) AS vencidas_sin_marcar
                 FROM proformas p WHERE ($1::text[] IS NULL OR p.tipo = ANY($1))`, [v.tipos]);
        }
        if (v.inventario) {
            consultas.inventario = pool.query(
                `SELECT COUNT(*) AS productos,
                        COUNT(*) FILTER (WHERE stock_actual <= stock_minimo AND COALESCE(area, '') <> 'colisiones') AS bajo_stock,
                        COUNT(*) FILTER (WHERE stock_actual <= 0 AND COALESCE(area, '') <> 'colisiones') AS agotados,
                        COALESCE(SUM(stock_actual * precio_compra), 0) AS valor_costo,
                        COALESCE(SUM(stock_actual * precio_venta), 0)  AS valor_venta
                 FROM repuestos WHERE activo AND ($1::text[] IS NULL OR area = ANY($1))`, [v.areas]);
            consultas.bajoStock = pool.query(
                `SELECT id, codigo, nombre, stock_actual, stock_minimo, unidad_medida, area
                 FROM repuestos WHERE activo AND stock_actual <= stock_minimo
                   AND COALESCE(area, '') <> 'colisiones'  -- Colisiones/Pintura no genera alertas de stock
                   AND ($1::text[] IS NULL OR area = ANY($1))
                 ORDER BY (stock_actual <= 0) DESC, stock_actual / NULLIF(stock_minimo, 0) NULLS FIRST, nombre
                 LIMIT 6`, [v.areas]);
        }
        if (v.movimientos) {
            consultas.movHoy = pool.query(
                `SELECT COUNT(*) FILTER (WHERE m.tipo = 'entrada') AS entradas, COUNT(*) FILTER (WHERE m.tipo = 'salida') AS salidas
                 FROM movimientos_inventario m JOIN repuestos r ON r.id = m.repuesto_id
                 WHERE m.created_at >= CURRENT_DATE AND ($1::text[] IS NULL OR COALESCE(m.area, r.area) = ANY($1))`, [v.areas]);
            consultas.movRecientes = pool.query(
                `SELECT m.id, m.tipo, m.origen, m.cantidad, m.created_at, r.nombre AS repuesto_nombre, r.unidad_medida,
                        u.nombre AS usuario_nombre, p.numero AS proforma_numero, m.proforma_id
                 FROM movimientos_inventario m
                 JOIN repuestos r ON r.id = m.repuesto_id
                 JOIN usuarios u ON u.id = m.usuario_id
                 LEFT JOIN proformas p ON p.id = m.proforma_id
                 WHERE ($1::text[] IS NULL OR COALESCE(m.area, r.area) = ANY($1))
                 ORDER BY m.created_at DESC, m.id DESC LIMIT 6`, [v.areas]);
        }
        if (v.clientes || v.vehiculos) {
            consultas.clientes = pool.query(
                `SELECT (SELECT COUNT(*) FROM clientes) AS total,
                        (SELECT COUNT(*) FROM clientes WHERE date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)) AS nuevos_mes,
                        (SELECT COUNT(*) FROM vehiculos) AS vehiculos`);
        }
        // Crecimiento: cada serie solo si el usuario puede ver ese modulo.
        if (v.taller || v.clientes || v.proformas || v.finanzas) {
            consultas.serie = pool.query(
                `SELECT TO_CHAR(m.mes, 'YYYY-MM') AS mes,
                        ${v.taller ? `(SELECT COUNT(*) FROM ordenes_trabajo o WHERE date_trunc('month', o.created_at) = m.mes)` : '0'} AS ordenes,
                        ${v.clientes ? `(SELECT COUNT(*) FROM clientes c WHERE date_trunc('month', c.created_at) = m.mes)` : '0'} AS clientes_nuevos,
                        ${v.proformas ? `(SELECT COUNT(*) FROM proformas p WHERE date_trunc('month', p.fecha_emision) = m.mes AND ($2::text[] IS NULL OR p.tipo = ANY($2)))` : '0'} AS proformas,
                        ${v.finanzas ? `(SELECT COALESCE(SUM(f.monto), 0) FROM v_flujo_dinero f WHERE f.tipo = 'ingreso' AND f.categoria <> 'transferencia' AND date_trunc('month', f.fecha) = m.mes)` : '0'} AS ingresos,
                        ${v.finanzas ? `(SELECT COALESCE(SUM(f.monto), 0) FROM v_flujo_dinero f WHERE f.tipo = 'egreso' AND f.categoria <> 'transferencia' AND date_trunc('month', f.fecha) = m.mes)` : '0'} AS egresos
                 FROM generate_series(date_trunc('month', CURRENT_DATE) - ($1::int - 1) * INTERVAL '1 month',
                                      date_trunc('month', CURRENT_DATE), INTERVAL '1 month') AS m(mes)
                 ORDER BY m.mes`, v.proformas ? [meses, v.tipos] : [meses]);
        }
        if (v.cartera) {
            consultas.cartera = pool.query(
                `SELECT COALESCE(SUM(monto_total - monto_pagado), 0) AS por_cobrar,
                        COUNT(*) FILTER (WHERE estado = 'vencido' OR (fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURRENT_DATE)) AS vencidas,
                        COALESCE(SUM(monto_total - monto_pagado) FILTER (WHERE estado = 'vencido' OR (fecha_vencimiento IS NOT NULL AND fecha_vencimiento < CURRENT_DATE)), 0) AS monto_vencido
                 FROM cuentas_cobrar WHERE estado IN ('pendiente','parcial','vencido')`);
            consultas.cobradoMes = pool.query(
                `SELECT COALESCE(SUM(monto), 0) AS total FROM pagos_cliente
                 WHERE anulado_at IS NULL AND date_trunc('month', fecha) = date_trunc('month', CURRENT_DATE)`);
        }
        if (v.caja) {
            consultas.caja = pool.query(
                `SELECT s.id, s.fecha_apertura, u.nombre AS usuario_nombre FROM caja_sesiones s
                 JOIN usuarios u ON u.id = s.usuario_apertura_id WHERE s.estado = 'abierta' LIMIT 1`);
        }
        if (v.finanzas) {
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

        const datos = {
            rol,
            secciones: Object.fromEntries(Object.entries(v).filter(([k]) => !['areas', 'tipos'].includes(k))),
        };

        if (v.taller) {
            const o = r.ordenes[0];
            const etapas = Object.fromEntries(r.etapas.map(e => [e.etapa, Number(e.total)]));
            datos.taller = {
                pendientes: Number(o.pendientes), en_progreso: Number(o.en_progreso), activas: Number(o.pendientes) + Number(o.en_progreso),
                listas_entrega: Number(o.listas_entrega), sin_tecnico: Number(o.sin_tecnico), entregadas_mes: Number(o.entregadas_mes),
                mias_activas: Number(o.mias_activas),
                creadas_mes: Number(o.creadas_mes), variacion_ordenes: variacion(Number(o.creadas_mes), Number(o.creadas_mes_ant)),
                etapas: [...ETAPAS, 'sin_etapa'].map(e => ({ etapa: e, total: etapas[e] || 0 })),
                ordenes_activas: r.ordenesActivas,
            };
        }
        if (v.citas) datos.citas = { hoy: r.citasHoy, pendientes_confirmar: Number(r.citasPendientes[0].total) };
        if (v.pedidos) datos.pedidos_pendientes = Number(r.pedidos[0].total);
        if (v.proformas) {
            const prof = r.proformas[0];
            datos.proformas = {
                por_aprobar: Number(prof.por_aprobar), aprobadas_sin_convertir: Number(prof.aprobadas_sin_convertir),
                inventario_pendiente: Number(prof.inventario_pendiente), vencidas_sin_marcar: Number(prof.vencidas_sin_marcar),
            };
        }
        if (v.inventario) {
            const inv = r.inventario[0];
            datos.inventario = {
                productos: Number(inv.productos), bajo_stock: Number(inv.bajo_stock), agotados: Number(inv.agotados),
                valor_costo: num(inv.valor_costo), valor_venta: num(inv.valor_venta),
                lista_bajo_stock: r.bajoStock.map(b => ({ ...b, stock_actual: num(b.stock_actual), stock_minimo: num(b.stock_minimo) })),
            };
            if (v.movimientos) {
                datos.inventario.entradas_hoy = Number(r.movHoy[0].entradas);
                datos.inventario.salidas_hoy = Number(r.movHoy[0].salidas);
                datos.inventario.movimientos_recientes = r.movRecientes.map(m => ({ ...m, cantidad: num(m.cantidad) }));
            }
        }
        if (r.clientes) {
            const cli = r.clientes[0];
            datos.clientes = {
                total: v.clientes ? Number(cli.total) : null,
                nuevos_mes: v.clientes ? Number(cli.nuevos_mes) : null,
                vehiculos: v.vehiculos ? Number(cli.vehiculos) : null,
            };
        }
        if (r.serie) {
            datos.serie = r.serie.map(s => ({ mes: s.mes, ordenes: Number(s.ordenes), clientes_nuevos: Number(s.clientes_nuevos), proformas: Number(s.proformas), ingresos: num(s.ingresos), egresos: num(s.egresos) }));
        }
        if (v.cartera) {
            const c = r.cartera[0];
            datos.cartera = { por_cobrar: num(c.por_cobrar), vencidas: Number(c.vencidas), monto_vencido: num(c.monto_vencido), cobrado_mes: num(r.cobradoMes[0].total) };
        }
        if (v.caja) {
            const { saldo } = await saldoCaja(pool);
            datos.caja = { abierta: Boolean(r.caja[0]), sesion: r.caja[0] || null, saldo };
        }
        if (v.finanzas) {
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

        datos.atencion = construirAlertas(datos, req.usuario);
        return res.json(datos);
    } catch (err) {
        console.error('Error resumenDashboard:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al cargar el panel de inicio.' });
    }
};

/**
 * Lista priorizada de cosas que alguien tiene que hacer, con enlace directo.
 * Cada alerta aparece solo si su seccion se calculo (permiso de ver) y, en
 * las que implican actuar, si el usuario tiene ese permiso.
 */
function construirAlertas(d, usuario) {
    const a = [];
    const add = (nivel, texto, link) => a.push({ nivel, texto, link });
    const P = (m, x) => puede(usuario, m, x);
    const s = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

    if (d.inventario?.agotados > 0) add('alta', `${s(d.inventario.agotados, 'producto agotado', 'productos agotados')} en el inventario`, '/dashboard/inventario');
    if (d.proformas?.inventario_pendiente > 0) add('alta', `${s(d.proformas.inventario_pendiente, 'proforma aprobada tiene', 'proformas aprobadas tienen')} material sin descontar del inventario (revisa el stock y confirma el uso)`, '/dashboard/proformas');
    if (d.cartera?.vencidas > 0) add('alta', `${s(d.cartera.vencidas, 'pagaré vencido', 'pagarés vencidos')} por $${d.cartera.monto_vencido.toFixed(2)}`, '/dashboard/clientes?tab=pagare');
    if (d.pedidos_pendientes > 0) add('media', `${d.pedidos_pendientes === 1 ? '1 pedido de la tienda espera ser atendido' : `${d.pedidos_pendientes} pedidos de la tienda esperan ser atendidos`}`, '/dashboard/pedidos');
    if (d.taller?.listas_entrega > 0) add('media', `${s(d.taller.listas_entrega, 'vehículo listo', 'vehículos listos')} para entregar al cliente`, '/dashboard/ordenes');
    if (d.citas?.hoy.length > 0) add('media', `${s(d.citas.hoy.length, 'cita', 'citas')} para hoy`, '/dashboard/citas');
    if (d.citas?.pendientes_confirmar > 0 && P('citas', 'editar')) add('media', `${s(d.citas.pendientes_confirmar, 'cita espera', 'citas esperan')} confirmación`, '/dashboard/citas');
    if (d.taller?.sin_tecnico > 0 && P('ordenes', 'asignar')) add('media', `${s(d.taller.sin_tecnico, 'orden activa no tiene', 'órdenes activas no tienen')} técnico asignado`, '/dashboard/ordenes');
    if (d.inventario && d.inventario.bajo_stock - d.inventario.agotados > 0) add('media', `${s(d.inventario.bajo_stock - d.inventario.agotados, 'producto está', 'productos están')} por debajo del stock mínimo`, '/dashboard/inventario');
    if (d.proformas?.aprobadas_sin_convertir > 0) add('baja', `${s(d.proformas.aprobadas_sin_convertir, 'proforma aprobada', 'proformas aprobadas')} sin convertir en orden de trabajo`, '/dashboard/proformas');
    if (d.proformas?.vencidas_sin_marcar > 0) add('baja', `${s(d.proformas.vencidas_sin_marcar, 'proforma pasó', 'proformas pasaron')} su fecha de validez`, '/dashboard/proformas');
    if (d.caja && !d.caja.abierta && P('caja', 'aprobar')) add('baja', 'La caja diaria está cerrada', '/dashboard/caja');
    if (d.finanzas?.nomina_pendiente > 0) add('baja', `Nómina del mes pendiente: $${d.finanzas.nomina_pendiente.toFixed(2)}`, '/dashboard/finanzas?tab=nomina');
    return a;
}

module.exports = { resumenDashboard, seccionesVisibles };
