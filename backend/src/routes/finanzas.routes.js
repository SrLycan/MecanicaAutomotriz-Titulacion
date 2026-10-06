/**
 * SS SWAP - Enrutador de Finanzas (/api/finanzas)
 * Informacion sensible (saldos, sueldos): solo administradores.
 * La caja diaria (/api/caja) sigue abierta tambien a recepcion.
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const {
    listarCategorias, resumen, listarFlujo,
    listarCuentas, crearCuenta, actualizarCuenta,
    crearMovimiento, crearTransferencia, anularMovimiento,
    listarEmpleados, guardarPerfilEmpleado, listarPagosEmpleados, crearPagoEmpleado, anularPagoEmpleado,
} = require('../controllers/finanzas.controller');

router.use(verificarToken, verificarRol('administrador'));

router.get('/categorias',                  listarCategorias);
router.get('/resumen',                     resumen);
router.get('/flujo',                       listarFlujo);

router.get('/cuentas',                     listarCuentas);
router.post('/cuentas',                    crearCuenta);
router.put('/cuentas/:id',                 actualizarCuenta);

router.post('/movimientos',                crearMovimiento);
router.post('/movimientos/:id/anular',     anularMovimiento);
router.post('/transferencias',             crearTransferencia);

router.get('/empleados',                   listarEmpleados);
router.put('/empleados/:usuarioId',        guardarPerfilEmpleado);
router.get('/pagos-empleados',             listarPagosEmpleados);
router.post('/pagos-empleados',            crearPagoEmpleado);
router.post('/pagos-empleados/:id/anular', anularPagoEmpleado);

module.exports = router;
