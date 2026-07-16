const express = require('express');
const router  = express.Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const { crearSolicitud, misSolicitudes, cancelarSolicitud } = require('../controllers/solicitudes.controller');

router.use(verificarToken, verificarRol('cliente'));

router.post('/productos',              crearSolicitud);
router.get('/mias',                    misSolicitudes);
router.patch('/productos/:id/cancelar', cancelarSolicitud);

module.exports = router;
