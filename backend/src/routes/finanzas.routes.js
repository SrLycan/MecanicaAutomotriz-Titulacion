/**
 * SS SWAP - Enrutador de Finanzas (/api/finanzas)
 * Informacion sensible (saldos, sueldos): solo administradores.
 * La caja diaria (/api/caja) sigue abierta tambien a recepcion.
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, requierePermiso } = require('../middleware/auth.middleware');
const {
    listarCategorias, resumen, listarFlujo,
    listarCuentas, crearCuenta, actualizarCuenta,
    crearMovimiento, crearTransferencia, anularMovimiento,
    listarEmpleados, guardarPerfilEmpleado, listarPagosEmpleados, crearPagoEmpleado, anularPagoEmpleado,
} = require('../controllers/finanzas.controller');

router.use(verificarToken);

const ver = requierePermiso('finanzas', 'ver');
const crear = requierePermiso('finanzas', 'crear');
const editar = requierePermiso('finanzas', 'editar');
const anular = requierePermiso('finanzas', 'eliminar');

router.get('/categorias',                  ver,    listarCategorias);
router.get('/resumen',                     ver,    resumen);
router.get('/flujo',                       ver,    listarFlujo);

router.get('/cuentas',                     ver,    listarCuentas);
router.post('/cuentas',                    crear,  crearCuenta);
router.put('/cuentas/:id',                 editar, actualizarCuenta);

router.post('/movimientos',                crear,  crearMovimiento);
router.post('/movimientos/:id/anular',     anular, anularMovimiento);
router.post('/transferencias',             crear,  crearTransferencia);

router.get('/empleados',                   ver,    listarEmpleados);
router.put('/empleados/:usuarioId',        editar, guardarPerfilEmpleado);
router.get('/pagos-empleados',             ver,    listarPagosEmpleados);
router.post('/pagos-empleados',            crear,  crearPagoEmpleado);
router.post('/pagos-empleados/:id/anular', anular, anularPagoEmpleado);

module.exports = router;
