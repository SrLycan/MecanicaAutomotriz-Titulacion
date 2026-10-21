/**
 * SS SWAP - Enrutador de Sucursales y Sedes (/api/sucursales)
 */
const express = require('express');
const router  = express.Router();
const {
    listarPublicas,
    listarTodas,
    crear,
    actualizar,
    eliminar,
} = require('../controllers/sucursales.controller');
const { verificarToken, requierePermiso } = require('../middleware/auth.middleware');

// Publico
router.get('/public', listarPublicas);

// Admin
router.get('/',       verificarToken, requierePermiso('sucursales', 'ver'),      listarTodas);
router.post('/',      verificarToken, requierePermiso('sucursales', 'crear'),    crear);
router.put('/:id',    verificarToken, requierePermiso('sucursales', 'editar'),   actualizar);
router.delete('/:id', verificarToken, requierePermiso('sucursales', 'eliminar'), eliminar);

module.exports = router;
