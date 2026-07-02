const express = require('express');
const router  = express.Router();
const {
    listarUsuarios,
    cambiarRol,
    cambiarEstado,
    eliminarUsuario,
    crearUsuario,
    actualizarUsuario,
    cambiarPassword,
} = require('../controllers/users.controller');
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');

// Admin
router.get('/',              verificarToken, verificarRol('administrador'), listarUsuarios);
router.post('/',             verificarToken, verificarRol('administrador'), crearUsuario);
router.put('/:id',           verificarToken, verificarRol('administrador'), actualizarUsuario);
router.put('/:id/rol',       verificarToken, verificarRol('administrador'), cambiarRol);
router.put('/:id/estado',    verificarToken, verificarRol('administrador'), cambiarEstado);
router.put('/:id/password',  verificarToken, verificarRol('administrador'), cambiarPassword);
router.delete('/:id',        verificarToken, verificarRol('administrador'), eliminarUsuario);

module.exports = router;