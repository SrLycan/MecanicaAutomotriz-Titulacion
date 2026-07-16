const express = require('express');
const router  = express.Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const { disponibilidad, crearCita, misCitas, cancelarCita, listarCitas, actualizarEstado } = require('../controllers/citas.controller');

// Todas las rutas de citas requieren estar autenticado
router.use(verificarToken);

router.get('/disponibilidad',   verificarRol('cliente'), disponibilidad);
router.get('/mias',             verificarRol('cliente'), misCitas);
router.post('/',                verificarRol('cliente'), crearCita);
router.patch('/:id/cancelar',   verificarRol('cliente'), cancelarCita);
router.get('/',                 verificarRol('administrador', 'tecnico', 'recepcionista'), listarCitas);
router.patch('/:id/estado',     verificarRol('administrador', 'tecnico', 'recepcionista'), actualizarEstado);

module.exports = router;
