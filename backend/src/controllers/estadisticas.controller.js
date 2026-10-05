/**
 * SS SWAP - Controlador de Estadisticas (seccion Graficas del panel admin)
 *
 * IMPORTANTE sobre las fuentes de datos (ver auditoria Fase 0): el sistema
 * no tiene una tabla de "ventas" ni items de servicio vinculados a
 * ordenes_trabajo. Por lo tanto:
 *  - "Productos mas vendidos" / "ventas" usan `movimientos_inventario`
 *    (tipo='salida') cruzado con el PRECIO ACTUAL del catalogo
 *    (`repuestos.precio_venta`). Es un estimado: si el precio cambio
 *    despues de una salida antigua, el ingreso mostrado usa el precio de
 *    hoy, no el que se cobro en su momento.
 *  - "Servicios mas solicitados" usa `citas` (unica tabla que vincula un
 *    servicio con una fecha) cruzado con `tipos_servicio.precio_base`.
 *  - Sprint 14: las salidas originadas por una PROFORMA guardan el precio
 *    realmente cobrado (`movimientos_inventario.precio_unitario`), y se usa
 *    ese precio historico en lugar del de catalogo. Las salidas devueltas
 *    al inventario (revertido_at) ya no cuentan. El nuevo endpoint
 *    /proformas analiza ingresos por categoria con el precio historico de
 *    `proforma_items` (cambiar el catalogo no altera estadisticas pasadas).
 *  - Ningun numero se inventa: si no hay filas en el periodo, se devuelve
 *    una lista vacia / ceros reales (el frontend debe mostrar el mensaje
 *    "No existen datos suficientes para este periodo").
 */
const pool = require('../config/db');

const PERIODOS = { semana: 7, mes: 30, anio: 365 };

function fechaDesde(periodo) {
    const dias = PERIODOS[periodo] || PERIODOS.mes;
    const d = new Date();
    d.setDate(d.getDate() - dias);
    return d;
}

// ─────────────────────────────────────────────────────────────
// GET /api/estadisticas/productos-mas-vendidos?periodo=semana|mes|anio&limit=10
// ─────────────────────────────────────────────────────────────
const productosMasVendidos = async (req, res) => {
    const periodo = ['semana', 'mes', 'anio'].includes(req.query.periodo) ? req.query.periodo : 'mes';
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const desde = fechaDesde(periodo);

    try {
        const { rows } = await pool.query(
            `SELECT r.id, r.codigo, r.nombre, r.precio_venta, r.area,
                    SUM(m.cantidad) AS cantidad_vendida,
                    ROUND(SUM(m.cantidad * COALESCE(m.precio_unitario, r.precio_venta)), 2) AS ingresos_estimados,
                    SUM(m.cantidad) FILTER (WHERE m.origen = 'proforma') AS cantidad_por_proforma
             FROM movimientos_inventario m
             JOIN repuestos r ON r.id = m.repuesto_id
             WHERE m.tipo = 'salida' AND m.revertido_at IS NULL AND m.created_at >= $1
             GROUP BY r.id, r.codigo, r.nombre, r.precio_venta, r.area
             ORDER BY cantidad_vendida DESC
             LIMIT $2`,
            [desde, limit]
        );

        const { rows: totalRows } = await pool.query(
            `SELECT COALESCE(SUM(cantidad), 0) AS total FROM movimientos_inventario WHERE tipo = 'salida' AND revertido_at IS NULL AND created_at >= $1`,
            [desde]
        );
        const totalCantidad = parseFloat(totalRows[0].total);

        const productos = rows.map(r => ({
            id: r.id,
            codigo: r.codigo,
            nombre: r.nombre,
            area: r.area,
            cantidad_vendida: parseFloat(r.cantidad_vendida),
            cantidad_por_proforma: parseFloat(r.cantidad_por_proforma || 0),
            ingresos_estimados: parseFloat(r.ingresos_estimados),
            porcentaje: totalCantidad > 0 ? Math.round((parseFloat(r.cantidad_vendida) / totalCantidad) * 1000) / 10 : 0,
        }));

        return res.json({ periodo, desde, total_cantidad: totalCantidad, productos, fuente: 'precio_historico_proforma_o_catalogo_actual' });
    } catch (err) {
        console.error('Error productosMasVendidos:', err);
        return res.status(500).json({ error: 'Error al calcular productos mas vendidos.' });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/estadisticas/servicios-mas-solicitados?periodo=semana|mes|anio&limit=10
// ─────────────────────────────────────────────────────────────
const serviciosMasSolicitados = async (req, res) => {
    const periodo = ['semana', 'mes', 'anio'].includes(req.query.periodo) ? req.query.periodo : 'mes';
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const desde = fechaDesde(periodo).toISOString().slice(0, 10);

    try {
        const { rows } = await pool.query(
            `SELECT s.id, s.nombre, s.precio_base,
                    COUNT(c.id) AS veces_solicitado,
                    ROUND(COUNT(c.id) * s.precio_base, 2) AS ingresos_estimados
             FROM citas c
             JOIN tipos_servicio s ON s.id = c.servicio_id
             WHERE c.estado != 'cancelada' AND c.fecha >= $1
             GROUP BY s.id, s.nombre, s.precio_base
             ORDER BY veces_solicitado DESC
             LIMIT $2`,
            [desde, limit]
        );

        const { rows: totalRows } = await pool.query(
            `SELECT COUNT(*) AS total FROM citas WHERE estado != 'cancelada' AND fecha >= $1`,
            [desde]
        );
        const totalSolicitudes = parseInt(totalRows[0].total, 10);

        const servicios = rows.map(r => ({
            id: r.id,
            nombre: r.nombre,
            veces_solicitado: parseInt(r.veces_solicitado, 10),
            ingresos_estimados: parseFloat(r.ingresos_estimados),
            porcentaje: totalSolicitudes > 0 ? Math.round((parseInt(r.veces_solicitado, 10) / totalSolicitudes) * 1000) / 10 : 0,
        }));

        return res.json({ periodo, desde, total_solicitudes: totalSolicitudes, servicios, fuente: 'citas_agendadas' });
    } catch (err) {
        console.error('Error serviciosMasSolicitados:', err);
        return res.status(500).json({ error: 'Error al calcular servicios mas solicitados.' });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/estadisticas/crecimiento?periodo=semana|mes|anio
// Serie temporal: clientes, vehiculos, ordenes, servicios, ventas, gastos.
// ─────────────────────────────────────────────────────────────
const crecimiento = async (req, res) => {
    const periodo = ['semana', 'mes', 'anio'].includes(req.query.periodo) ? req.query.periodo : 'mes';
    const granularidad = periodo === 'anio' ? 'month' : 'day';
    const numBuckets = periodo === 'semana' ? 7 : periodo === 'anio' ? 12 : 30;

    const desde = new Date();
    if (granularidad === 'month') { desde.setMonth(desde.getMonth() - (numBuckets - 1)); desde.setDate(1); }
    else { desde.setDate(desde.getDate() - (numBuckets - 1)); }
    desde.setHours(0, 0, 0, 0);

    const claveBucket = (fecha) => granularidad === 'month'
        ? `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
        : fecha.toISOString().slice(0, 10);

    // Genera la lista de buckets del periodo (con ceros reales, no inventados,
    // para que el grafico no tenga huecos aunque no haya actividad ese dia/mes).
    const buckets = [];
    const cursor = new Date(desde);
    for (let i = 0; i < numBuckets; i++) {
        buckets.push(claveBucket(cursor));
        if (granularidad === 'month') cursor.setMonth(cursor.getMonth() + 1);
        else cursor.setDate(cursor.getDate() + 1);
    }
    const truncSql = granularidad === 'month' ? "TO_CHAR(fecha_col, 'YYYY-MM')" : "TO_CHAR(fecha_col, 'YYYY-MM-DD')";

    const consulta = (tabla, columnaFecha, where = '', agregado = 'COUNT(*)') => pool.query(
        `SELECT ${truncSql.replace('fecha_col', columnaFecha)} AS bucket, ${agregado} AS valor
         FROM ${tabla}
         WHERE ${columnaFecha} >= $1 ${where}
         GROUP BY 1`,
        [desde]
    );

    try {
        const [clientesR, vehiculosR, ordenesR, serviciosR, ventasR, gastosR, proformasR] = await Promise.all([
            consulta('clientes', 'created_at'),
            consulta('vehiculos', 'created_at'),
            consulta('ordenes_trabajo', 'created_at'),
            pool.query(
                `SELECT TO_CHAR(fecha, ${granularidad === 'month' ? "'YYYY-MM'" : "'YYYY-MM-DD'"}) AS bucket, COUNT(*) AS valor
                 FROM citas WHERE estado = 'completada' AND fecha >= $1 GROUP BY 1`,
                [desde]
            ),
            pool.query(
                `SELECT TO_CHAR(m.created_at, ${granularidad === 'month' ? "'YYYY-MM'" : "'YYYY-MM-DD'"}) AS bucket,
                        COALESCE(SUM(m.cantidad * COALESCE(m.precio_unitario, r.precio_venta)), 0) AS valor
                 FROM movimientos_inventario m JOIN repuestos r ON r.id = m.repuesto_id
                 WHERE m.tipo = 'salida' AND m.revertido_at IS NULL AND m.created_at >= $1 GROUP BY 1`,
                [desde]
            ),
            pool.query(
                `SELECT TO_CHAR(fecha, ${granularidad === 'month' ? "'YYYY-MM'" : "'YYYY-MM-DD'"}) AS bucket, COALESCE(SUM(monto), 0) AS valor
                 FROM gastos_proveedor WHERE estado != 'anulado' AND fecha >= $1 GROUP BY 1`,
                [desde]
            ),
            // Sprint 14: total facturado en proformas aprobadas/convertidas (precio historico).
            pool.query(
                `SELECT TO_CHAR(fecha_emision, ${granularidad === 'month' ? "'YYYY-MM'" : "'YYYY-MM-DD'"}) AS bucket, COALESCE(SUM(total), 0) AS valor
                 FROM proformas WHERE estado IN ('aprobada','convertida') AND fecha_emision >= $1 GROUP BY 1`,
                [desde]
            ),
        ]);

        const aMapa = (rows) => Object.fromEntries(rows.map(r => [r.bucket, parseFloat(r.valor)]));
        const mClientes = aMapa(clientesR.rows), mVehiculos = aMapa(vehiculosR.rows), mOrdenes = aMapa(ordenesR.rows),
              mServicios = aMapa(serviciosR.rows), mVentas = aMapa(ventasR.rows), mGastos = aMapa(gastosR.rows),
              mProformas = aMapa(proformasR.rows);

        const serie = buckets.map(b => {
            const ventas = mVentas[b] || 0;
            const gastos = mGastos[b] || 0;
            return {
                periodo: b,
                clientes_nuevos: mClientes[b] || 0,
                vehiculos_nuevos: mVehiculos[b] || 0,
                ordenes: mOrdenes[b] || 0,
                servicios_realizados: mServicios[b] || 0,
                ventas_estimadas: Math.round(ventas * 100) / 100,
                gastos: Math.round(gastos * 100) / 100,
                utilidad_estimada: Math.round((ventas - gastos) * 100) / 100,
                proformas_aprobadas: Math.round((mProformas[b] || 0) * 100) / 100,
            };
        });

        const totales = serie.reduce((acc, p) => ({
            clientes_nuevos: acc.clientes_nuevos + p.clientes_nuevos,
            vehiculos_nuevos: acc.vehiculos_nuevos + p.vehiculos_nuevos,
            ordenes: acc.ordenes + p.ordenes,
            servicios_realizados: acc.servicios_realizados + p.servicios_realizados,
            ventas_estimadas: Math.round((acc.ventas_estimadas + p.ventas_estimadas) * 100) / 100,
            gastos: Math.round((acc.gastos + p.gastos) * 100) / 100,
            proformas_aprobadas: Math.round((acc.proformas_aprobadas + p.proformas_aprobadas) * 100) / 100,
        }), { clientes_nuevos: 0, vehiculos_nuevos: 0, ordenes: 0, servicios_realizados: 0, ventas_estimadas: 0, gastos: 0, proformas_aprobadas: 0 });
        totales.utilidad_estimada = Math.round((totales.ventas_estimadas - totales.gastos) * 100) / 100;

        return res.json({ periodo, granularidad, serie, totales, fuente: 'estimado_catalogo_actual' });
    } catch (err) {
        console.error('Error crecimiento:', err);
        return res.status(500).json({ error: 'Error al calcular el crecimiento.' });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/estadisticas/proformas?periodo=semana|mes|anio&limit=10
// Analisis de PROFORMAS aprobadas/convertidas con el PRECIO HISTORICO
// guardado en cada item (proforma_items.precio_unitario):
//  - por_grupo: Productos/Repuestos, Servicios, Mano de obra,
//    Pintura/Carroceria, Insumos (valor + cantidad + lineas)
//  - productos_utilizados: salidas REALES de inventario por proforma
//    (movimientos origen='proforma', no revertidos), con cantidad y valor
//    al precio cobrado.
//  - servicios_vendidos: lineas de servicio/mano de obra/pintura
//    agrupadas por descripcion (o por servicio del catalogo si esta ligado).
// Valores de linea ANTES de descuento e IVA (el descuento es global a la
// proforma y no se puede prorratear por item sin inventar un criterio).
// ─────────────────────────────────────────────────────────────
const GRUPOS = {
    producto: 'productos', repuesto: 'productos',
    servicio: 'servicios', mano_obra: 'mano_obra',
    pintura: 'pintura', insumo: 'insumos',
};
const ETIQUETA_GRUPO = {
    productos: 'Productos / Repuestos', servicios: 'Servicios', mano_obra: 'Mano de obra',
    pintura: 'Pintura / Carrocería', insumos: 'Insumos',
};

const estadisticasProformas = async (req, res) => {
    const periodo = ['semana', 'mes', 'anio'].includes(req.query.periodo) ? req.query.periodo : 'mes';
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const desde = fechaDesde(periodo).toISOString().slice(0, 10);

    try {
        const [{ rows: porCategoria }, { rows: resumen }, { rows: productos }, { rows: servicios }] = await Promise.all([
            pool.query(
                `SELECT i.categoria, COUNT(*)::int AS lineas, SUM(i.cantidad) AS cantidad, SUM(i.subtotal) AS valor
                 FROM proforma_items i JOIN proformas p ON p.id = i.proforma_id
                 WHERE p.estado IN ('aprobada','convertida') AND p.fecha_emision >= $1
                 GROUP BY i.categoria`,
                [desde]
            ),
            pool.query(
                `SELECT COUNT(*)::int AS proformas, COALESCE(SUM(total), 0) AS total_facturado,
                        COALESCE(SUM(descuento), 0) AS descuentos, COALESCE(SUM(iva_valor), 0) AS iva,
                        COUNT(*) FILTER (WHERE tipo = 'mecanica')::int AS mecanica,
                        COUNT(*) FILTER (WHERE tipo = 'pintura')::int AS colisiones
                 FROM proformas WHERE estado IN ('aprobada','convertida') AND fecha_emision >= $1`,
                [desde]
            ),
            pool.query(
                `SELECT r.id, r.codigo, r.nombre, r.area, r.unidad_medida,
                        SUM(m.cantidad) AS cantidad, ROUND(SUM(m.cantidad * m.precio_unitario), 2) AS valor,
                        COUNT(DISTINCT m.proforma_id)::int AS proformas
                 FROM movimientos_inventario m JOIN repuestos r ON r.id = m.repuesto_id
                 WHERE m.origen = 'proforma' AND m.tipo = 'salida' AND m.revertido_at IS NULL AND m.created_at >= $1::date
                 GROUP BY r.id, r.codigo, r.nombre, r.area, r.unidad_medida
                 ORDER BY valor DESC, cantidad DESC
                 LIMIT $2`,
                [desde, limit]
            ),
            pool.query(
                `SELECT COALESCE(s.nombre, i.descripcion) AS nombre, i.categoria,
                        COUNT(*)::int AS veces, SUM(i.subtotal) AS valor
                 FROM proforma_items i
                 JOIN proformas p ON p.id = i.proforma_id
                 LEFT JOIN tipos_servicio s ON i.referencia_tipo = 'servicio' AND s.id = i.referencia_id
                 WHERE p.estado IN ('aprobada','convertida') AND p.fecha_emision >= $1
                   AND i.categoria IN ('servicio','mano_obra','pintura')
                 GROUP BY 1, 2 ORDER BY valor DESC LIMIT $2`,
                [desde, limit]
            ),
        ]);

        const grupos = Object.fromEntries(Object.keys(ETIQUETA_GRUPO).map(g => [g, { grupo: g, etiqueta: ETIQUETA_GRUPO[g], lineas: 0, cantidad: 0, valor: 0 }]));
        for (const r of porCategoria) {
            const g = grupos[GRUPOS[r.categoria]];
            if (!g) continue;
            g.lineas += r.lineas;
            g.cantidad = Math.round((g.cantidad + parseFloat(r.cantidad)) * 100) / 100;
            g.valor = Math.round((g.valor + parseFloat(r.valor)) * 100) / 100;
        }
        const porGrupo = Object.values(grupos);
        const totalLineas = porGrupo.reduce((s, g) => s + g.valor, 0);
        porGrupo.forEach(g => { g.porcentaje = totalLineas > 0 ? Math.round(g.valor / totalLineas * 1000) / 10 : 0; });
        const r0 = resumen[0];

        return res.json({
            periodo, desde,
            resumen: {
                proformas: r0.proformas, mecanica: r0.mecanica, colisiones: r0.colisiones,
                total_facturado: parseFloat(r0.total_facturado), descuentos: parseFloat(r0.descuentos), iva: parseFloat(r0.iva),
                total_productos: Math.round((grupos.productos.valor + grupos.insumos.valor) * 100) / 100,
                total_servicios: Math.round((grupos.servicios.valor + grupos.mano_obra.valor + grupos.pintura.valor) * 100) / 100,
                total_lineas: Math.round(totalLineas * 100) / 100,
            },
            por_grupo: porGrupo,
            productos_utilizados: productos.map(p => ({ ...p, cantidad: parseFloat(p.cantidad), valor: parseFloat(p.valor || 0) })),
            servicios_vendidos: servicios.map(s => ({ ...s, valor: parseFloat(s.valor), grupo: ETIQUETA_GRUPO[GRUPOS[s.categoria]] })),
            fuente: 'proformas_precio_historico',
        });
    } catch (err) {
        console.error('Error estadisticasProformas:', err);
        return res.status(500).json({ error: 'Error al calcular las estadisticas de proformas.' });
    }
};

module.exports = { productosMasVendidos, serviciosMasSolicitados, crecimiento, estadisticasProformas };
