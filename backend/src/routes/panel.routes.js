const express = require('express');
const router  = express.Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const { miActividad } = require('../controllers/panel.controller');

router.use(verificarToken);

// Solo clientes pueden ver su panel
router.get('/mi-actividad', verificarRol('cliente'), miActividad);

module.exports = router;
