/**
 * SS SWAP - Enrutador de Usuarios y Gestión de Cuentas (/api/users)
 */
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
    obtenerMiPerfil,
    actualizarMiPerfil,
    cambiarMiPassword,
    subirMiFoto,
} = require('../controllers/users.controller');
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const { subirFotoPerfil } = require('../middleware/upload.middleware');

// Perfil propio — cualquier usuario autenticado (cliente o staff).
// IMPORTANTE: deben ir antes de "/:id" para que Express no interprete "me" como un id.
router.get('/me',            verificarToken, obtenerMiPerfil);
router.put('/me',             verificarToken, actualizarMiPerfil);
router.put('/me/password',    verificarToken, cambiarMiPassword);
router.post('/me/foto',       verificarToken, subirFotoPerfil, subirMiFoto);

// Admin
router.get('/',              verificarToken, verificarRol('administrador'), listarUsuarios);
router.post('/',             verificarToken, verificarRol('administrador'), crearUsuario);
router.put('/:id',           verificarToken, verificarRol('administrador'), actualizarUsuario);
router.put('/:id/rol',       verificarToken, verificarRol('administrador'), cambiarRol);
router.put('/:id/estado',    verificarToken, verificarRol('administrador'), cambiarEstado);
router.put('/:id/password',  verificarToken, verificarRol('administrador'), cambiarPassword);
router.delete('/:id',        verificarToken, verificarRol('administrador'), eliminarUsuario);

module.exports = router;