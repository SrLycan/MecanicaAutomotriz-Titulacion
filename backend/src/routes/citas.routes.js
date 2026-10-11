/**
 * SS SWAP - Enrutador de Citas y Agendamiento (/api/citas)
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, verificarRol, requierePermiso } = require('../middleware/auth.middleware');
const { disponibilidad, crearCita, misCitas, cancelarCita, listarCitas, actualizarEstado } = require('../controllers/citas.controller');

// Todas las rutas de citas requieren estar autenticado
router.use(verificarToken);

router.get('/disponibilidad',   verificarRol('cliente'), disponibilidad);
router.get('/mias',             verificarRol('cliente'), misCitas);
router.post('/',                verificarRol('cliente'), crearCita);
router.patch('/:id/cancelar',   verificarRol('cliente'), cancelarCita);
router.get('/',                 requierePermiso('citas', 'ver'),    listarCitas);
router.patch('/:id/estado',     requierePermiso('citas', 'editar'), actualizarEstado);

module.exports = router;
