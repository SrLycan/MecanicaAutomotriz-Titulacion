/**
 * SS SWAP - Enrutador de Proveedores (/api/proveedores)
 *
 * Agrupa, siguiendo el mismo patron que ordenes.routes.js (clientes +
 * vehiculos + ordenes bajo /api/ordenes), los sub-recursos de la seccion
 * "Proveedores" del panel: proveedores, sus contactos, gastos, compras y
 * el historial financiero.
 *
 * Todo el modulo queda restringido a 'administrador', igual que Sucursales
 * y Servicios (secciones ya existentes con informacion sensible del
 * negocio). Si se necesita abrir lectura a otros roles, se ajusta aqui.
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, permisoPorMetodo } = require('../middleware/auth.middleware');
const { idempotencia } = require('../middleware/idempotencia.middleware');
const fc = require('../controllers/facturasCompra.controller');

const {
    listarProveedores, obtenerProveedor, crearProveedor, actualizarProveedor, eliminarProveedor,
    listarContactos, crearContacto, actualizarContacto, cambiarEstadoContacto, eliminarContacto,
} = require('../controllers/proveedores.controller');

const {
    listarGastos, obtenerGasto, crearGasto, actualizarGasto, eliminarGasto,
} = require('../controllers/gastosProveedor.controller');

const {
    alertasCredito, listarCompras, obtenerCompra, crearCompra, actualizarCompra, cambiarEstadoCompra, eliminarCompra,
} = require('../controllers/comprasProveedor.controller');

const {
    listarMovimientos, registrarMovimiento, cambiarEstadoMovimiento, resumenFinanciero,
} = require('../controllers/movimientosFinancieros.controller');

// Todas las rutas de este modulo requieren estar autenticado como administrador
// GET = ver, POST = crear, PUT/PATCH = editar, DELETE = eliminar (modulo "proveedores").
// Idempotency-Key: un doble clic o un reintento no crea dos proveedores, compras ni pagos.
router.use(verificarToken, permisoPorMetodo('proveedores'), idempotencia);

// ── Proveedores ──────────────────────────────────────────────
router.get('/proveedores',        listarProveedores);
router.get('/proveedores/:id',    obtenerProveedor);
router.post('/proveedores',       crearProveedor);
router.put('/proveedores/:id',    actualizarProveedor);
router.delete('/proveedores/:id', eliminarProveedor);

// ── Contactos de proveedor ───────────────────────────────────
router.get('/contactos',              listarContactos);
router.post('/contactos',             crearContacto);
router.put('/contactos/:id',          actualizarContacto);
router.patch('/contactos/:id/estado', cambiarEstadoContacto);
router.delete('/contactos/:id',       eliminarContacto);

// ── Gastos ───────────────────────────────────────────────────
router.get('/gastos',        listarGastos);
router.get('/gastos/:id',    obtenerGasto);
router.post('/gastos',       crearGasto);
router.put('/gastos/:id',    actualizarGasto);
router.delete('/gastos/:id', eliminarGasto);

// ── Compras ──────────────────────────────────────────────────
router.get('/compras',              listarCompras);
router.get('/compras/alertas-credito', alertasCredito);
router.get('/compras/:id',          obtenerCompra);
router.post('/compras',             crearCompra);
router.put('/compras/:id',          actualizarCompra);
router.patch('/compras/:id/estado', cambiarEstadoCompra);
router.delete('/compras/:id',       eliminarCompra);

// ── Facturas de compra (Sprint 25) ───────────────────────────
// GET = ver, POST = crear (consultar, cargar XML, confirmar), DELETE = eliminar (descartar no registradas).
router.get('/facturas-compra',               fc.listar);
router.post('/facturas-compra/consultar',    fc.limiteConsultas, fc.consultar);
router.post('/facturas-compra/xml',          fc.limiteConsultas, fc.cargarXml);
router.post('/facturas-compra/manual',       fc.limiteConsultas, fc.ingresoManual);
router.get('/facturas-compra/:id',           fc.obtener);
router.get('/facturas-compra/:id/xml',       fc.descargarXml);
router.get('/facturas-compra/:id/pdf',       fc.descargarPdf);
router.post('/facturas-compra/:id/confirmar', fc.confirmar);
router.delete('/facturas-compra/:id',        fc.descartar);

// ── Historial financiero + resumen ───────────────────────────
router.get('/movimientos',               listarMovimientos);
router.post('/movimientos',              registrarMovimiento);
router.patch('/movimientos/:id/estado',  cambiarEstadoMovimiento);
router.get('/resumen',                   resumenFinanciero);

module.exports = router;
