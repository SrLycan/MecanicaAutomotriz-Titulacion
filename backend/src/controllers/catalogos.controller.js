/**
 * SS SWAP - Catalogos del sistema (Sprint 15)
 * GET /api/catalogos — devuelve en una sola llamada las tablas cat_* para
 * que el frontend muestre siempre el mismo nombre para cada codigo
 * (areas de inventario, metodos de pago, tipos de proforma, origenes de
 * movimiento). Solo lectura.
 */
const pool = require('../config/db');

const obtenerCatalogos = async (_req, res) => {
    try {
        const [areas, metodos, tipos, origenes] = await Promise.all([
            pool.query('SELECT codigo, nombre, descripcion FROM cat_areas_inventario WHERE activo = TRUE ORDER BY orden, codigo'),
            pool.query('SELECT codigo, nombre, campos_requeridos FROM cat_metodos_pago WHERE activo = TRUE ORDER BY orden, codigo'),
            pool.query('SELECT codigo, nombre, descripcion FROM cat_tipos_proforma ORDER BY orden, codigo'),
            pool.query('SELECT codigo, nombre, tipo_permitido, registrable_manual, descripcion FROM cat_origenes_movimiento ORDER BY codigo'),
        ]);
        return res.json({
            areas_inventario: areas.rows,
            metodos_pago: metodos.rows,
            tipos_proforma: tipos.rows,
            origenes_movimiento: origenes.rows,
        });
    } catch (err) {
        console.error('Error obtenerCatalogos:', err);
        return res.status(500).json({ error: 'Error al obtener los catálogos. ¿Se corrió la migración del Sprint 15?' });
    }
};

module.exports = { obtenerCatalogos };
