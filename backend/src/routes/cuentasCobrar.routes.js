/**
 * SS SWAP - Enrutador de Cuentas por Cobrar / Pagaré (/api/cuentas-cobrar)
 * Mismos roles que la pagina de Clientes: administrador y recepcionista.
 * Eliminar queda restringido a administrador (igual criterio que Proformas
 * y Proveedores: operacion sensible sobre un registro financiero).
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, requierePermiso } = require('../middleware/auth.middleware');

const {
    listarCuentas, obtenerCuenta, crearCuenta, actualizarCuenta,
    cambiarEstadoCuenta, registrarPago, eliminarPago, eliminarCuenta, resumenCuentas, alertasVencimiento,
} = require('../controllers/cuentasCobrar.controller');

router.use(verificarToken);

const ver = requierePermiso('cuentas_cobrar', 'ver');
router.get('/resumen',              ver, resumenCuentas);
router.get('/alertas',              ver, alertasVencimiento);
router.get('/',                     ver, listarCuentas);
router.get('/:id',                  ver, obtenerCuenta);
router.post('/',                    requierePermiso('cuentas_cobrar', 'crear'),    crearCuenta);
router.put('/:id',                  requierePermiso('cuentas_cobrar', 'editar'),   actualizarCuenta);
router.patch('/:id/estado',         requierePermiso('cuentas_cobrar', 'eliminar'), cambiarEstadoCuenta); // anular / reabrir
router.post('/:id/pagos',           requierePermiso('pagos_clientes', 'crear'),    registrarPago);
router.delete('/:id/pagos/:pagoId', requierePermiso('pagos_clientes', 'eliminar'), eliminarPago);
router.delete('/:id',               requierePermiso('cuentas_cobrar', 'eliminar'), eliminarCuenta);

module.exports = router;
