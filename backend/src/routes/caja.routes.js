/**
 * SS SWAP - Enrutador de Caja (/api/caja)
 * Accesible a administrador y recepcionista (quienes manejan caja en piso);
 * el historial completo tambien queda disponible para ambos roles.
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const {
    obtenerSesionActual, abrirCaja, cerrarCaja, registrarMovimientoCaja, listarHistorial,
} = require('../controllers/caja.controller');

router.use(verificarToken, verificarRol('administrador', 'recepcionista'));

router.get('/actual',       obtenerSesionActual);
router.post('/apertura',    abrirCaja);
router.post('/cierre',      cerrarCaja);
router.post('/movimientos', registrarMovimientoCaja);
router.get('/historial',    listarHistorial);

module.exports = router;
