/**
 * SS SWAP - Enrutador de Pedidos de la tienda (/api/solicitudes)
 * Cliente: crear, ver y cancelar sus pedidos.
 * Personal: ver todos los pedidos, atenderlos (sale del inventario y se
 * puede registrar el cobro) o cancelarlos con motivo.
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, verificarRol, requierePermiso } = require('../middleware/auth.middleware');
const {
    crearSolicitud, misSolicitudes, cancelarSolicitud,
    listarSolicitudes, atenderSolicitud, cancelarSolicitudStaff,
} = require('../controllers/solicitudes.controller');

const soloCliente = verificarRol('cliente');
router.use(verificarToken);

// Cliente
router.post('/productos',               soloCliente, crearSolicitud);
router.get('/mias',                     soloCliente, misSolicitudes);
router.patch('/productos/:id/cancelar', soloCliente, cancelarSolicitud);

// Personal del taller
router.get('/',                         requierePermiso('pedidos_tienda', 'ver'),    listarSolicitudes);
router.patch('/:id/atender',            requierePermiso('pedidos_tienda', 'editar'), atenderSolicitud);
router.patch('/:id/cancelar',           requierePermiso('pedidos_tienda', 'editar'), cancelarSolicitudStaff);

module.exports = router;
