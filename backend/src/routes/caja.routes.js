/**
 * SS SWAP - Enrutador de Caja (/api/caja)
 * Accesible a administrador y recepcionista (quienes manejan caja en piso);
 * el historial completo tambien queda disponible para ambos roles.
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, requierePermiso } = require('../middleware/auth.middleware');
const {
    obtenerSesionActual, abrirCaja, cerrarCaja, registrarMovimientoCaja, listarHistorial,
} = require('../controllers/caja.controller');

router.use(verificarToken);

router.get('/actual',       requierePermiso('caja', 'ver'),     obtenerSesionActual);
router.post('/apertura',    requierePermiso('caja', 'aprobar'), abrirCaja);
router.post('/cierre',      requierePermiso('caja', 'aprobar'), cerrarCaja);
router.post('/movimientos', requierePermiso('caja', 'crear'),   registrarMovimientoCaja);
router.get('/historial',    requierePermiso('caja', 'ver'),     listarHistorial);

module.exports = router;
