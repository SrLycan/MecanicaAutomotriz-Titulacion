/**
 * SS SWAP - Controlador de Inventario y Control de Stock
 *
 * Gestiona el catálogo de repuestos, categorías y registro de movimientos
 * (entradas/salidas). Implementa concurrencia segura mediante bloqueo de fila
 * ('FOR UPDATE') en transacciones de actualización de stock para evitar
 * condiciones de carrera (race conditions).
 */
const pool = require('../config/db');
const { errorBD } = require('../utils/erroresBD');
const { normalizarCantidades, cantidadValida, redondear2 } = require('../utils/numeros');
const { registrarAccionBitacora } = require('../services/ordenesHistorial.service');
const { siguienteNumero } = require('../services/secuencias.service');
const { areasRepuestosVisibles, areasInventarioPermitidas, esSuperadmin } = require('../middleware/auth.middleware');

// Sprint 14: dos inventarios conceptuales sobre el MISMO catalogo.
// Sprint 15: las areas validas salen de la tabla cat_areas_inventario
// (agregar un area nueva = insertar una fila). Cache corto para no consultar
// en cada request; si la tabla aun no existe se usan las dos areas base.
const AREAS_BASE = ['mecanica', 'colisiones'];
// Areas que NO generan alertas de stock bajo (Colisiones/Pintura se maneja
// por consumo). Debe coincidir con frontend/src/utils/stock.js.
const AREAS_SIN_ALERTA = ['colisiones'];
const ETIQUETA_AREA = { mecanica: 'Mecánica', colisiones: 'Colisiones / Pintura' };
let cacheAreas = { valores: null, expira: 0 };
async function areasValidas() {
    if (cacheAreas.valores && Date.now() < cacheAreas.expira) return cacheAreas.valores;
    try {
        const { rows } = await pool.query('SELECT codigo, nombre FROM cat_areas_inventario WHERE activo = TRUE ORDER BY orden, codigo');
        rows.forEach(r => { ETIQUETA_AREA[r.codigo] = ETIQUETA_AREA[r.codigo] || r.nombre; });
        cacheAreas = { valores: rows.length ? rows.map(r => r.codigo) : AREAS_BASE, expira: Date.now() + 60000 };
    } catch {
        cacheAreas = { valores: AREAS_BASE, expira: Date.now() + 60000 };
    }
    return cacheAreas.valores;
}
// Origenes que un usuario puede registrar a mano. 'compra' y 'proforma' los
// asigna solo el sistema (recepcion de compras / confirmar uso de proforma).
const ORIGENES_MANUALES = ['manual', 'ajuste', 'devolucion'];
const ORIGENES = ['manual', 'compra', 'proforma', 'ajuste', 'devolucion', 'venta'];
const numeroONull = (v, porDefecto) => (v === '' || v == null ? porDefecto : redondear2(v));

// Sprint 20: codigo de referencia INTERNO generado por el sistema
// (MEC-000012, COL-000013...). Es el unico codigo que se imprime en
// proformas; el del proveedor/fabricante se guarda aparte en
// codigo_proveedor. Usa el contador de la empresa (atomico entre usuarios) y, si el
// codigo ya existiera por un registro antiguo cargado a mano, salta al
// siguiente numero.
const PREFIJO_AREA = { mecanica: 'MEC', colisiones: 'COL' };
async function generarCodigoReferencia(client, area) {
    const prefijo = PREFIJO_AREA[area] || String(area || 'INV').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase() || 'INV';
    for (let intento = 0; intento < 20; intento++) {
        const n = await siguienteNumero(client, 'repuestos_referencia');
        const codigo = `${prefijo}-${String(n).padStart(6, '0')}`;
        const { rows: existe } = await client.query('SELECT 1 FROM repuestos WHERE codigo = $1', [codigo]);
        if (!existe[0]) return codigo;
    }
    throw new Error('No se pudo generar un codigo de referencia unico.');
}
const limpiarCodigoProveedor = (v) => {
    const t = String(v ?? '').trim();
    return t ? t.slice(0, 100) : null;
};

// ─────────────────────────────────────────────────────────────
// REPUESTOS - CRUD
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/inventory/repuestos
 * Consulta repuestos con soporte de paginación, filtros por categoría/texto
 * y alerta de bajo stock.
 */
const listarRepuestos = async (req, res) => {
    const { q, categoria_id, bajo_stock, area, page = 1, limit = 15 } = req.query;

    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit) || 15)); // 500: selector de proformas carga el catalogo completo
    const offset   = (pageNum - 1) * limitNum;

    let where   = 'WHERE r.activo = TRUE';
    const params = [];

    if (q) {
        params.push(`%${q}%`);
        where += ` AND (r.nombre ILIKE $${params.length} OR r.codigo ILIKE $${params.length} OR r.codigo_proveedor ILIKE $${params.length})`;
    }
    if (categoria_id) {
        params.push(categoria_id);
        where += ` AND r.categoria_id = $${params.length}`;
    }
    if (bajo_stock === 'true') {
        params.push(AREAS_SIN_ALERTA);
        where += ` AND r.stock_actual <= r.stock_minimo AND NOT (COALESCE(r.area, '') = ANY($${params.length}))`;
    }
    if (area && (await areasValidas()).includes(area)) {
        params.push(area);
        where += ` AND r.area = $${params.length}`;
    }
    // Permisos: sin acceso amplio, solo las areas que el usuario puede ver.
    const visibles = areasRepuestosVisibles(req.usuario);
    if (visibles) {
        params.push(visibles);
        where += ` AND r.area = ANY($${params.length})`;
    }

    const countQuery = `SELECT COUNT(*) AS total FROM repuestos r ${where}`;
    const dataQuery  = `
        SELECT r.*, c.nombre AS categoria_nombre
        FROM repuestos r
        LEFT JOIN categorias_repuesto c ON r.categoria_id = c.id
        ${where}
        ORDER BY r.nombre ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    try {
        const [{ rows: countRows }, { rows }] = await Promise.all([
            pool.query(countQuery, params),
            pool.query(dataQuery, [...params, limitNum, offset]),
        ]);
        const total = parseInt(countRows[0].total, 10);
        return res.json({
            repuestos: rows.map(normalizarCantidades),
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum),
        });
    } catch (err) {
        console.error('Error listarRepuestos:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener repuestos.' });
    }
};

/**
 * GET /api/inventory/repuestos/:id
 */
const obtenerRepuesto = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            `SELECT r.*, c.nombre AS categoria_nombre
             FROM repuestos r
             LEFT JOIN categorias_repuesto c ON r.categoria_id = c.id
             WHERE r.id = $1 AND r.activo = TRUE`,
            [id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Repuesto no encontrado.' });
        return res.json(normalizarCantidades(rows[0]));
    } catch (err) {
        console.error('Error obtenerRepuesto:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener repuesto.' });
    }
};

/**
 * POST /api/inventory/repuestos
 * Roles permitidos: administrador
 */
const crearRepuesto = async (req, res) => {
    const {
        nombre,
        descripcion,
        categoria_id,
        precio_compra,
        precio_venta,
        stock_actual,
        stock_minimo,
        unidad_medida,
        imagen_url,
        en_venta = false,
        area = 'mecanica',
    } = req.body;

    // El codigo de referencia lo genera el sistema (no se acepta del cliente).
    if (!nombre || !String(nombre).trim()) {
        return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }
    if (!(await areasValidas()).includes(area)) {
        return res.status(400).json({ error: `Área inválida. Valores permitidos: ${(await areasValidas()).join(', ')}.` });
    }
    if (stock_actual !== '' && stock_actual != null && !(Number(stock_actual) >= 0)) {
        return res.status(400).json({ error: 'El stock inicial no puede ser negativo.' });
    }

    try {
        const codigo = await generarCodigoReferencia(pool, area);
        const { rows } = await pool.query(
            `INSERT INTO repuestos
                (codigo, nombre, descripcion, categoria_id, precio_compra, precio_venta, stock_actual, stock_minimo, unidad_medida, imagen_url, en_venta, area, codigo_proveedor)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             RETURNING *`,
            [
                codigo,
                nombre.trim(),
                descripcion || null,
                categoria_id || null,
                precio_compra === '' || precio_compra == null ? 0 : precio_compra,
                precio_venta === '' || precio_venta == null ? 0 : precio_venta,
                numeroONull(stock_actual, 0),
                numeroONull(stock_minimo, 5),
                unidad_medida || 'unidad',
                imagen_url || null,
                en_venta === true || en_venta === 'true',
                area,
                limpiarCodigoProveedor(req.body.codigo_proveedor),
            ]
        );
        return res.status(201).json(normalizarCantidades(rows[0]));
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'El código ya existe.' });
        console.error('Error crearRepuesto:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al crear repuesto.' });
    }
};
/**
 * PUT /api/inventory/repuestos/:id
 * Roles permitidos: administrador
 * Nota: el stock NO se modifica directamente aquí; se usa el endpoint de movimientos.
 */
const actualizarRepuesto = async (req, res) => {
    const { id } = req.params;
    // `codigo` (referencia interna) NO se modifica al editar: se ignora si llega.
    const {
        nombre,
        descripcion,
        categoria_id,
        precio_compra,
        precio_venta,
        stock_minimo,
        unidad_medida,
        activo,
        imagen_url,
        en_venta,
        area,
    } = req.body;

    if (!nombre) {
        return res.status(400).json({ error: 'El nombre es obligatorio.' });
    }
    if (area !== undefined && area !== null && area !== '' && !(await areasValidas()).includes(area)) {
        return res.status(400).json({ error: `Área inválida. Valores permitidos: ${(await areasValidas()).join(', ')}.` });
    }

    try {
        const { rows } = await pool.query(
            `UPDATE repuestos
             SET codigo_proveedor=CASE WHEN $1::boolean THEN $14 ELSE codigo_proveedor END,
                 nombre=$2,
                 descripcion=$3,
                 categoria_id=$4,
                 precio_compra=$5,
                 precio_venta=$6,
                 stock_minimo=$7,
                 unidad_medida=$8,
                 activo=COALESCE($9, activo),
                 imagen_url=$10,
                 en_venta=COALESCE($11, en_venta),
                 area=COALESCE($13, area)
             WHERE id=$12
             RETURNING *`,
            [
                Object.prototype.hasOwnProperty.call(req.body, 'codigo_proveedor'),
                nombre.trim(),
                descripcion || null,
                categoria_id || null,
                precio_compra === '' || precio_compra == null ? 0 : precio_compra,
                precio_venta === '' || precio_venta == null ? 0 : precio_venta,
                numeroONull(stock_minimo, 5),
                unidad_medida || 'unidad',
                typeof activo === 'boolean' ? activo : null,
                imagen_url || null,
                typeof en_venta === 'boolean' ? en_venta : (en_venta === 'true' ? true : en_venta === 'false' ? false : null),
                id,
                (await areasValidas()).includes(area) ? area : null,
                limpiarCodigoProveedor(req.body.codigo_proveedor),
            ]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Repuesto no encontrado.' });
        return res.json(normalizarCantidades(rows[0]));
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ error: 'El código ya existe.' });
        console.error('Error actualizarRepuesto:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al actualizar repuesto.' });
    }
};
/**
 * DELETE /api/inventory/repuestos/:id  — solo administrador
 * Elimina definitivamente un repuesto y limpia sus movimientos asociados en
 * una única transacción.
 */
const eliminarRepuesto = async (req, res) => {
    const { id } = req.params;
    let client;

    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Sprint 14: un producto que ya salio por una proforma (o fue
        // devuelto por una) forma parte del historial de esa proforma/OT y
        // de las estadisticas: NO se borra fisicamente.
        const { rows: ligados } = await client.query(
            "SELECT COUNT(*)::int AS n FROM movimientos_inventario WHERE repuesto_id = $1 AND proforma_id IS NOT NULL",
            [id]
        );
        if (ligados[0].n > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ error: 'Este producto tiene salidas registradas por proformas y no se puede eliminar para no perder la trazabilidad. Puedes editarlo o desactivarlo.' });
        }

        // Borra primero los movimientos relacionados para evitar errores de llave foranea.
        await client.query(
            'DELETE FROM movimientos_inventario WHERE repuesto_id=$1',
            [id]
        );

        // Ahora borra el repuesto de verdad de la tabla repuestos.
        const { rows, rowCount } = await client.query(
            'DELETE FROM repuestos WHERE id=$1 RETURNING id, nombre',
            [id]
        );

        if (!rowCount) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Repuesto no encontrado.' });
        }

        await client.query('COMMIT');
        return res.json({
            mensaje: 'Repuesto eliminado definitivamente de la base de datos.',
            repuesto: rows[0],
        });
    } catch (err) {
        await client?.query('ROLLBACK');
        console.error('Error eliminarRepuesto:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al eliminar repuesto.' });
    } finally {
        client?.release();
    }
};
// ─────────────────────────────────────────────────────────────
// MOVIMIENTOS DE STOCK
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/inventory/movimientos
 * Body: { repuesto_id, tipo ('entrada'|'salida'), cantidad, motivo, referencia }
 * Actualiza automáticamente stock_actual en repuestos.
 */
const registrarMovimiento = async (req, res) => {
    const { repuesto_id, tipo, cantidad, motivo, referencia } = req.body;
    const origen = req.body.origen || 'manual';
    const usuario_id = req.usuario.id;

    if (!repuesto_id || !tipo || !cantidad) {
        return res.status(400).json({ error: 'repuesto_id, tipo y cantidad son obligatorios.' });
    }
    if (!['entrada', 'salida'].includes(tipo)) {
        return res.status(400).json({ error: 'tipo debe ser "entrada" o "salida".' });
    }
    if (!ORIGENES_MANUALES.includes(origen)) {
        return res.status(400).json({ error: `Origen invalido. Desde este formulario solo se permite: ${ORIGENES_MANUALES.join(', ')}. Las salidas por proforma se registran desde la proforma y las entradas por compra desde Proveedores.` });
    }
    if (origen === 'devolucion' && tipo !== 'entrada') {
        return res.status(400).json({ error: 'Una devolucion siempre es una entrada al inventario.' });
    }
    const cantidadNum = cantidadValida(cantidad);
    if (cantidadNum === null) {
        return res.status(400).json({ error: 'La cantidad debe ser mayor a cero (maximo 2 decimales).' });
    }

    let client;
    try {
        client = await pool.connect();
        await client.query('BEGIN');

        // Bloquea la fila para evitar race conditions
        const { rows } = await client.query(
            'SELECT id, nombre, codigo, stock_actual, area FROM repuestos WHERE id=$1 AND activo=TRUE FOR UPDATE',
            [repuesto_id]
        );
        const repuesto = rows[0];
        if (!repuesto) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Repuesto no encontrado.' });
        }

        const stockAnterior = Number(repuesto.stock_actual);
        const stockNuevo    = tipo === 'entrada'
            ? redondear2(stockAnterior + cantidadNum)
            : redondear2(stockAnterior - cantidadNum);

        if (stockNuevo < 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({
                error: `Stock insuficiente. Stock actual: ${stockAnterior}. Salida solicitada: ${cantidadNum}.`
            });
        }

        // 1) Actualizar stock
        await client.query(
            'UPDATE repuestos SET stock_actual=$1 WHERE id=$2',
            [stockNuevo, repuesto_id]
        );

        // 2) Registrar movimiento para trazabilidad
        const { rows: movRows } = await client.query(
            `INSERT INTO movimientos_inventario
                (repuesto_id, usuario_id, tipo, cantidad, stock_anterior, stock_nuevo, motivo, referencia, origen, area)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING *`,
            [repuesto_id, usuario_id, tipo, cantidadNum, stockAnterior, stockNuevo, motivo || null, referencia || null, origen, repuesto.area]
        );

        await client.query('COMMIT');

        registrarAccionBitacora({
            entidad_tipo: 'inventario', entidad_id: movRows[0].id, accion: `${tipo}_${origen}`,
            usuario_id, usuario_nombre: req.usuario.nombre,
            detalle: `${tipo === 'entrada' ? 'Entrada' : 'Salida'} (${origen}) de ${cantidadNum} x ${repuesto.nombre} [${ETIQUETA_AREA[repuesto.area] || repuesto.area}]. Stock ${stockAnterior} -> ${stockNuevo}.${motivo ? ` Motivo: ${motivo}.` : ''}`,
            metadata: { movimiento_id: movRows[0].id, repuesto_id: Number(repuesto_id), cantidad: cantidadNum, area: repuesto.area, origen },
        });

        return res.status(201).json({
            movimiento: normalizarCantidades(movRows[0]),
            stock_anterior: stockAnterior,
            stock_nuevo: stockNuevo,
        });
    } catch (err) {
        await client?.query('ROLLBACK');
        console.error('Error registrarMovimiento:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al registrar movimiento.' });
    } finally {
        client?.release();
    }
};

/**
 * GET /api/inventory/movimientos
 * Filtros (todos opcionales): repuesto_id, tipo, origen, area, usuario_id,
 * proforma (id o numero), orden_id, fecha_inicio, fecha_fin, q (texto en
 * producto/codigo/motivo/referencia/cliente/placa).
 * Paginacion: page + limit. Sin `page` se mantiene el comportamiento previo
 * (ultimos `limit` movimientos, por defecto 50).
 * Cada fila incluye proforma, OT, cliente y vehiculo cuando aplica.
 */
const listarMovimientos = async (req, res) => {
    const { repuesto_id, tipo, origen, area, usuario_id, proforma, orden_id, fecha_inicio, fecha_fin, q } = req.query;
    const paginado = req.query.page !== undefined;
    const limitNum = Math.min(500, Math.max(1, parseInt(req.query.limit) || 50));
    const pageNum = Math.max(1, parseInt(req.query.page) || 1);

    let where = 'WHERE 1=1';
    const params = [];
    const add = (sql, v) => { params.push(v); where += ` AND ${sql.replace('$?', `$${params.length}`)}`; };
    if (repuesto_id) add('m.repuesto_id = $?', repuesto_id);
    if (tipo && ['entrada', 'salida'].includes(tipo)) add('m.tipo = $?', tipo);
    if (origen && ORIGENES.includes(origen)) add('m.origen = $?', origen);
    if (area && (await areasValidas()).includes(area)) add('COALESCE(m.area, r.area) = $?', area);
    // Permisos: solo movimientos de las areas de inventario que el usuario puede ver.
    if (!esSuperadmin(req.usuario)) add('COALESCE(m.area, r.area) = ANY($?)', areasInventarioPermitidas(req.usuario, 'ver'));
    if (usuario_id) add('m.usuario_id = $?', usuario_id);
    if (orden_id) add('m.orden_id = $?', String(orden_id).replace(/\D/g, '') || 0);
    if (proforma) {
        if (/^\d+$/.test(String(proforma))) add('m.proforma_id = $?', proforma);
        else add('p.numero ILIKE $?', `%${proforma}%`);
    }
    if (fecha_inicio) add('m.created_at >= $?::date', fecha_inicio);
    if (fecha_fin) add("m.created_at < ($?::date + INTERVAL '1 day')", fecha_fin);
    if (q) add(`(r.nombre ILIKE $? OR r.codigo ILIKE $1x OR m.motivo ILIKE $1x OR m.referencia ILIKE $1x OR p.cliente_nombre ILIKE $1x OR p.vehiculo_placa ILIKE $1x)`.replace(/\$1x/g, `$${params.length + 1}`), `%${q}%`);

    const from = `
        FROM movimientos_inventario m
        JOIN repuestos r ON r.id = m.repuesto_id
        JOIN usuarios  u ON u.id = m.usuario_id
        LEFT JOIN proformas p ON p.id = m.proforma_id
        LEFT JOIN ordenes_trabajo o ON o.id = m.orden_id
        LEFT JOIN clientes c ON c.id = COALESCE(p.cliente_id, o.cliente_id)
        LEFT JOIN vehiculos v ON v.id = COALESCE(p.vehiculo_id, o.vehiculo_id)
        ${where}`;
    const dataQuery = `
        SELECT m.*, r.nombre AS repuesto_nombre, r.codigo AS repuesto_codigo, r.unidad_medida,
               COALESCE(m.area, r.area) AS area,
               u.nombre AS usuario_nombre,
               p.numero AS proforma_numero, p.tipo AS proforma_tipo,
               COALESCE(p.cliente_nombre, c.nombre) AS cliente_nombre,
               COALESCE(NULLIF(TRIM(CONCAT_WS(' ', p.vehiculo_marca, p.vehiculo_modelo)), ''), NULLIF(TRIM(CONCAT_WS(' ', v.marca, v.modelo)), '')) AS vehiculo_descripcion,
               COALESCE(p.vehiculo_placa, v.placa) AS vehiculo_placa
        ${from}
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    try {
        const offset = paginado ? (pageNum - 1) * limitNum : 0;
        const [{ rows }, countRes] = await Promise.all([
            pool.query(dataQuery, [...params, limitNum, offset]),
            paginado ? pool.query(`SELECT COUNT(*)::int AS total ${from}`, params) : Promise.resolve(null),
        ]);
        const movimientos = rows.map(m => ({
            ...normalizarCantidades(m),
            orden_numero: m.orden_id ? `OT-${String(m.orden_id).padStart(6, '0')}` : null,
        }));
        if (!paginado) return res.json({ movimientos });
        const total = countRes.rows[0].total;
        return res.json({ movimientos, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) });
    } catch (err) {
        console.error('Error listarMovimientos:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener movimientos.' });
    }
};

/**
 * GET /api/inventory/movimientos/filtros — opciones para los selectores de
 * la pagina de Registros (usuarios que registraron movimientos + totales
 * por origen).
 */
const filtrosMovimientos = async (_req, res) => {
    try {
        const [{ rows: usuarios }, { rows: porOrigen }] = await Promise.all([
            pool.query(`SELECT DISTINCT u.id, u.nombre FROM movimientos_inventario m JOIN usuarios u ON u.id = m.usuario_id ORDER BY u.nombre`),
            pool.query(`SELECT origen, tipo, COUNT(*)::int AS n FROM movimientos_inventario GROUP BY origen, tipo`),
        ]);
        return res.json({ usuarios, por_origen: porOrigen, areas: (await areasValidas()).map(a => ({ valor: a, etiqueta: ETIQUETA_AREA[a] || a })), origenes: ORIGENES });
    } catch (err) {
        console.error('Error filtrosMovimientos:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener los filtros.' });
    }
};

/**
 * GET /api/inventory/categorias
 */
// Incluye cuantos repuestos usan cada categoria (para la gestion de categorias).
const SQL_CATEGORIAS = `SELECT c.*, (SELECT COUNT(*) FROM repuestos r WHERE r.categoria_id = c.id)::int AS total_repuestos
                        FROM categorias_repuesto c`;

const listarCategorias = async (req, res) => {
    try {
        // ?area=colisiones devuelve las categorias de esa area + las compartidas (area NULL).
        const area = (await areasValidas()).includes(req.query.area) ? req.query.area : null;
        const { rows } = area
            ? await pool.query(`${SQL_CATEGORIAS} WHERE c.area IS NULL OR c.area = $1 ORDER BY c.nombre`, [area])
            : await pool.query(`${SQL_CATEGORIAS} ORDER BY c.nombre`);
        return res.json({ categorias: rows });
    } catch (err) {
        return res.status(500).json({ error: 'Error al obtener categorías.' });
    }
};

// Valida y normaliza el cuerpo de crear/editar categoria.
async function datosCategoria(body) {
    const nombre = String(body.nombre || '').trim();
    if (!nombre) return { error: 'El nombre de la categoría es obligatorio.' };
    if (nombre.length > 100) return { error: 'El nombre no puede superar 100 caracteres.' };
    const descripcion = String(body.descripcion || '').trim() || null;
    // area vacia = categoria compartida por todas las areas
    const area = body.area ? String(body.area) : null;
    if (area && !(await areasValidas()).includes(area)) return { error: 'Área no válida.' };
    return { nombre, descripcion, area };
}

// ─────────────────────────────────────────────────────────────
// POST /api/inventory/categorias   (solo administrador)
// ─────────────────────────────────────────────────────────────
const crearCategoria = async (req, res) => {
    try {
        const d = await datosCategoria(req.body);
        if (d.error) return res.status(400).json({ error: d.error });
        const { rows } = await pool.query(
            'INSERT INTO categorias_repuesto (nombre, descripcion, area) VALUES ($1, $2, $3) RETURNING *',
            [d.nombre, d.descripcion, d.area]
        );
        return res.status(201).json({ categoria: rows[0] });
    } catch (err) {
        console.error('Error crearCategoria:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al crear la categoría.' });
    }
};

// ─────────────────────────────────────────────────────────────
// PUT /api/inventory/categorias/:id   (solo administrador)
// ─────────────────────────────────────────────────────────────
const actualizarCategoria = async (req, res) => {
    try {
        const d = await datosCategoria(req.body);
        if (d.error) return res.status(400).json({ error: d.error });
        const { rows } = await pool.query(
            'UPDATE categorias_repuesto SET nombre = $1, descripcion = $2, area = $3 WHERE id = $4 RETURNING *',
            [d.nombre, d.descripcion, d.area, req.params.id]
        );
        if (!rows.length) return res.status(404).json({ error: 'Categoría no encontrada.' });
        return res.json({ categoria: rows[0] });
    } catch (err) {
        console.error('Error actualizarCategoria:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al actualizar la categoría.' });
    }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/inventory/categorias/:id   (solo administrador)
// No se borra una categoria en uso: la FK la pondria en NULL y los
// repuestos quedarian sin categoria sin que nadie lo note.
// ─────────────────────────────────────────────────────────────
const eliminarCategoria = async (req, res) => {
    try {
        const { rows: uso } = await pool.query('SELECT COUNT(*)::int AS n FROM repuestos WHERE categoria_id = $1', [req.params.id]);
        if (uso[0].n > 0) {
            return res.status(409).json({ error: `La categoría tiene ${uso[0].n} repuesto(s) asignado(s). Reasígnalos a otra categoría antes de eliminarla.` });
        }
        const { rowCount } = await pool.query('DELETE FROM categorias_repuesto WHERE id = $1', [req.params.id]);
        if (!rowCount) return res.status(404).json({ error: 'Categoría no encontrada.' });
        return res.json({ mensaje: 'Categoría eliminada.' });
    } catch (err) {
        console.error('Error eliminarCategoria:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al eliminar la categoría.' });
    }
};

// ─────────────────────────────────────────────────────────────
// GET /api/inventory/publico   (sin autenticacion — catalogo publico)
// ─────────────────────────────────────────────────────────────
const listarPublico = async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT r.id, r.codigo, r.nombre, r.descripcion, r.precio_venta,
                    r.stock_actual, r.unidad_medida, r.imagen_url,
                    c.nombre AS categoria_nombre
             FROM repuestos r
             LEFT JOIN categorias_repuesto c ON c.id = r.categoria_id
             WHERE r.activo = TRUE AND r.en_venta = TRUE AND r.stock_actual > 0
             ORDER BY r.nombre ASC`
        );
        return res.json({ repuestos: rows.map(normalizarCantidades) });
    } catch (err) {
        console.error('Error listarPublico:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al obtener el catalogo.' });
    }
};

/**
 * PATCH /api/inventory/repuestos/:id/en-venta  — solo administrador
 * Alterna la visibilidad de un repuesto en el catálogo público (campo en_venta).
 */
const toggleEnVenta = async (req, res) => {
    const { id } = req.params;
    try {
        const { rows } = await pool.query(
            'UPDATE repuestos SET en_venta = NOT en_venta WHERE id = $1 AND activo = TRUE RETURNING id, nombre, en_venta',
            [id]
        );
        if (!rows[0]) return res.status(404).json({ error: 'Repuesto no encontrado.' });
        return res.json(rows[0]);
    } catch (err) {
        console.error('Error toggleEnVenta:', err);
        const eBD = errorBD(err); if (eBD) return res.status(eBD.status).json({ error: eBD.error });
        return res.status(500).json({ error: 'Error al cambiar estado de venta.' });
    }
};

module.exports = { generarCodigoReferencia, areasValidas, listarRepuestos, obtenerRepuesto, crearRepuesto, actualizarRepuesto, eliminarRepuesto, registrarMovimiento, listarMovimientos, filtrosMovimientos, listarCategorias, crearCategoria, actualizarCategoria, eliminarCategoria, toggleEnVenta, listarPublico };
