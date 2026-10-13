/**
 * SS SWAP - Configuración de la propia empresa (/api/empresa)
 */
const express = require('express');
const router  = express.Router();
const c = require('../controllers/empresa.controller');
const { verificarToken, requierePermiso } = require('../middleware/auth.middleware');
const { subirLogoEmpresa } = require('../middleware/upload.middleware');

router.use(verificarToken);
router.get('/', requierePermiso('empresa', 'ver'), c.obtener);
router.put('/', requierePermiso('empresa', 'editar'), c.actualizar);
// El permiso se comprueba ANTES de recibir el archivo.
router.post('/logo', requierePermiso('empresa', 'editar'), subirLogoEmpresa, c.subirLogo);
router.delete('/logo', requierePermiso('empresa', 'editar'), c.quitarLogo);

module.exports = router;
