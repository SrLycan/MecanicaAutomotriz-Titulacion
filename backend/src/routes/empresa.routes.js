/**
 * SS SWAP - Configuración de la propia empresa (/api/empresa)
 */
const express = require('express');
const router  = express.Router();
const c = require('../controllers/empresa.controller');
const { verificarToken, requierePermiso } = require('../middleware/auth.middleware');

router.use(verificarToken);
router.get('/', requierePermiso('empresa', 'ver'), c.obtener);
router.put('/', requierePermiso('empresa', 'editar'), c.actualizar);

module.exports = router;
