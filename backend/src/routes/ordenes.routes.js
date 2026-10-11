/**
 * SS SWAP - Enrutador de Clientes, Vehículos y Órdenes de Trabajo (/api/ordenes)
 *
 * Permisos por módulo: clientes, vehiculos y ordenes. Las listas de
 * clientes y vehículos también las consultan otros formularios (orden de
 * trabajo, proforma, pagaré) para elegir a quién corresponde el documento,
 * por eso aceptan cualquiera de esos permisos de creación/edición.
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, soloStaff, requierePermiso, requiereAlguno } = require('../middleware/auth.middleware');
const {
    listarClientes, obtenerCliente, crearCliente, actualizarCliente, eliminarCliente,
    listarVehiculos, crearVehiculo, actualizarVehiculo, eliminarVehiculo,
    listarOrdenes, obtenerOrden, crearOrden, actualizarOrden, eliminarOrden,
    obtenerHistorialOrden, listarHistorialGeneral,
} = require('../controllers/ordenes.controller');

// Formularios que necesitan elegir cliente / vehiculo.
const FORMULARIOS = [
    ['ordenes', 'crear'], ['ordenes', 'editar'],
    ['proformas_mecanica', 'crear'], ['proformas_mecanica', 'editar'],
    ['proformas_colisiones', 'crear'], ['proformas_colisiones', 'editar'],
    ['cuentas_cobrar', 'ver'], ['cuentas_cobrar', 'crear'], ['cuentas_cobrar', 'editar'],
];

// Todas las rutas requieren autenticacion como staff
router.use(verificarToken, soloStaff);

// ── Clientes ──────────────────────────────────────────────
const leerClientes = requiereAlguno(['clientes', 'ver'], ['vehiculos', 'ver'], ['vehiculos', 'crear'], ['vehiculos', 'editar'], ...FORMULARIOS);
router.get('/clientes',        leerClientes, listarClientes);
router.get('/clientes/:id',    leerClientes, obtenerCliente);
router.post('/clientes',       requierePermiso('clientes', 'crear'),    crearCliente);
router.put('/clientes/:id',    requierePermiso('clientes', 'editar'),   actualizarCliente);
router.delete('/clientes/:id', requierePermiso('clientes', 'eliminar'), eliminarCliente);

// ── Vehiculos ─────────────────────────────────────────────
router.get('/vehiculos',        requiereAlguno(['vehiculos', 'ver'], ['clientes', 'ver'], ...FORMULARIOS), listarVehiculos);
router.post('/vehiculos',       requierePermiso('vehiculos', 'crear'),    crearVehiculo);
router.put('/vehiculos/:id',    requierePermiso('vehiculos', 'editar'),   actualizarVehiculo);
router.delete('/vehiculos/:id', requierePermiso('vehiculos', 'eliminar'), eliminarVehiculo);

// ── Ordenes de Trabajo ────────────────────────────────────
// La ficha del vehiculo muestra sus ordenes; la proforma "desde una orden" las lista.
router.get('/ordenes',                    requiereAlguno(['ordenes', 'ver'], ['vehiculos', 'ver']), listarOrdenes);
router.get('/ordenes/historial/general',  requierePermiso('bitacora', 'ver'), listarHistorialGeneral);
router.get('/ordenes/:id/historial',      requierePermiso('ordenes', 'ver'), obtenerHistorialOrden);
router.get('/ordenes/:id',                requierePermiso('ordenes', 'ver'), obtenerOrden);
router.post('/ordenes',       requierePermiso('ordenes', 'crear'),    crearOrden);
router.put('/ordenes/:id',    requierePermiso('ordenes', 'editar'),   actualizarOrden);
router.delete('/ordenes/:id', requierePermiso('ordenes', 'eliminar'), eliminarOrden);

module.exports = router;
