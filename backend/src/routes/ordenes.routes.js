/**
 * SS SWAP - Enrutador de Clientes, Vehículos y Órdenes de Trabajo (/api/ordenes)
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, soloStaff, verificarRol } = require('../middleware/auth.middleware');
const {
    listarClientes, obtenerCliente, crearCliente, actualizarCliente, eliminarCliente,
    listarVehiculos, crearVehiculo, actualizarVehiculo, eliminarVehiculo,
    listarOrdenes, obtenerOrden, crearOrden, actualizarOrden, eliminarOrden,
    obtenerHistorialOrden, listarHistorialGeneral,
} = require('../controllers/ordenes.controller');

// Todas las rutas requieren autenticacion como staff
router.use(verificarToken, soloStaff);

// ── Clientes ──────────────────────────────────────────────
router.get('/clientes',        listarClientes);
router.get('/clientes/:id',    obtenerCliente);
router.post('/clientes',       crearCliente);
router.put('/clientes/:id',    actualizarCliente);
router.delete('/clientes/:id', eliminarCliente);

// ── Vehiculos ─────────────────────────────────────────────
router.get('/vehiculos',        listarVehiculos);
router.post('/vehiculos',       crearVehiculo);
router.put('/vehiculos/:id',    actualizarVehiculo);
router.delete('/vehiculos/:id', eliminarVehiculo);

// ── Ordenes de Trabajo ────────────────────────────────────
router.get('/ordenes',                    listarOrdenes);
router.get('/ordenes/historial/general',  verificarRol('administrador'), listarHistorialGeneral);
router.get('/ordenes/:id/historial',      obtenerHistorialOrden);
router.get('/ordenes/:id',                obtenerOrden);
router.post('/ordenes',       crearOrden);
router.put('/ordenes/:id',    actualizarOrden);
router.delete('/ordenes/:id', eliminarOrden);

module.exports = router;
