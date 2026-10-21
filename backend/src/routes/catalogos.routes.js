/**
 * SS SWAP - Enrutador de Catalogos (/api/catalogos) — personal autenticado.
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, soloStaff } = require('../middleware/auth.middleware');
const { obtenerCatalogos } = require('../controllers/catalogos.controller');

router.get('/', verificarToken, soloStaff, obtenerCatalogos);

module.exports = router;
