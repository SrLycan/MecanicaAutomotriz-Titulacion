/**
 * SS SWAP - Enrutador de Inventario y Repuestos (/api/inventory)
 *
 * Permisos por ÁREA: cada repuesto pertenece a Mecánica o a Colisiones /
 * Pintura y cada área es un módulo distinto (inventario_mecanica,
 * inventario_colisiones). El área se lee de la BD (permisosRecurso).
 * Los movimientos usan el módulo "registros_inventario" y además exigen
 * poder ver el área del repuesto.
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, requiereAlguno, requierePermiso, LECTURA_REPUESTOS } = require('../middleware/auth.middleware');
const { areaDelCuerpo, areaDelRepuesto, areaDeCategoria } = require('../middleware/permisosRecurso.middleware');
const {
    listarRepuestos, obtenerRepuesto, crearRepuesto, actualizarRepuesto, eliminarRepuesto,
    registrarMovimiento, listarMovimientos, filtrosMovimientos, listarCategorias, crearCategoria, actualizarCategoria, eliminarCategoria, toggleEnVenta, listarPublico
} = require('../controllers/inventory.controller');

/** Alguna de las areas de inventario con la accion indicada. */
const algunaArea = (accion) => requiereAlguno(['inventario_mecanica', accion], ['inventario_colisiones', accion]);

// Catalogo publico — sin autenticacion (usado por la pagina publica de Productos)
router.get('/publico', listarPublico);

// El resto de rutas requieren autenticacion
router.use(verificarToken);

// Categorias — lectura para cualquier usuario autenticado (no es informacion sensible)
router.get('/categorias', listarCategorias);
router.post('/categorias',       algunaArea('editar'), areaDeCategoria('editar'), crearCategoria);
router.put('/categorias/:id',    algunaArea('editar'), areaDeCategoria('editar'), actualizarCategoria);
router.delete('/categorias/:id', algunaArea('editar'), areaDeCategoria('editar'), eliminarCategoria);

// Repuestos — la lista se filtra por las areas visibles en el controlador
router.get('/repuestos',          requiereAlguno(...LECTURA_REPUESTOS), listarRepuestos);
router.get('/repuestos/:id',      requiereAlguno(...LECTURA_REPUESTOS), areaDelRepuesto('ver'), obtenerRepuesto);
router.post('/repuestos',         algunaArea('crear'),    areaDelCuerpo('crear'),      crearRepuesto);
router.put('/repuestos/:id',      algunaArea('editar'),   areaDelRepuesto('editar'),   actualizarRepuesto);
router.patch('/repuestos/:id/en-venta', algunaArea('editar'), areaDelRepuesto('editar'), toggleEnVenta);
router.delete('/repuestos/:id',   algunaArea('eliminar'), areaDelRepuesto('eliminar'), eliminarRepuesto);

// Movimientos (entradas / salidas) — solo de las areas que el usuario puede ver
router.post('/movimientos',        requierePermiso('registros_inventario', 'crear'), areaDelRepuesto('ver', { desdeCuerpo: true }), registrarMovimiento);
router.get('/movimientos/filtros', requierePermiso('registros_inventario', 'ver'), filtrosMovimientos);
router.get('/movimientos',         requierePermiso('registros_inventario', 'ver'), listarMovimientos);

module.exports = router;
