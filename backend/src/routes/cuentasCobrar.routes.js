/**
 * SS SWAP - Enrutador de Cuentas por Cobrar / Pagaré (/api/cuentas-cobrar)
 * Mismos roles que la pagina de Clientes: administrador y recepcionista.
 * Eliminar queda restringido a administrador (igual criterio que Proformas
 * y Proveedores: operacion sensible sobre un registro financiero).
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');

const {
    listarCuentas, obtenerCuenta, crearCuenta, actualizarCuenta,
    cambiarEstadoCuenta, registrarPago, eliminarPago, eliminarCuenta, resumenCuentas,
} = require('../controllers/cuentasCobrar.controller');

router.use(verificarToken, verificarRol('administrador', 'recepcionista'));

router.get('/resumen',              resumenCuentas);
router.get('/',                     listarCuentas);
router.get('/:id',                  obtenerCuenta);
router.post('/',                    crearCuenta);
router.put('/:id',                  actualizarCuenta);
router.patch('/:id/estado',         cambiarEstadoCuenta);
router.post('/:id/pagos',           registrarPago);
router.delete('/:id/pagos/:pagoId', verificarRol('administrador'), eliminarPago);
router.delete('/:id',               verificarRol('administrador'), eliminarCuenta);

module.exports = router;
