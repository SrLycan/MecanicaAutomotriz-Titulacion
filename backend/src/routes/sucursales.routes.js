const express = require('express');
const router  = express.Router();
const {
    listarPublicas,
    listarTodas,
    crear,
    actualizar,
    eliminar,
} = require('../controllers/sucursales.controller');
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');

// Publico
router.get('/public', listarPublicas);

// Admin
router.get('/',       verificarToken, verificarRol('administrador'), listarTodas);
router.post('/',      verificarToken, verificarRol('administrador'), crear);
router.put('/:id',    verificarToken, verificarRol('administrador'), actualizar);
router.delete('/:id', verificarToken, verificarRol('administrador'), eliminar);

module.exports = router;
