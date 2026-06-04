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

// Todas las rutas requieren admin
router.use(verificarToken, verificarRol('administrador'));

router.get('/',              listarUsuarios);
router.post('/',             crearUsuario);
router.put('/:id',           actualizarUsuario);
router.put('/:id/rol',       cambiarRol);
router.put('/:id/estado',    cambiarEstado);
router.put('/:id/password',  cambiarPassword);
router.delete('/:id',        eliminarUsuario);

module.exports = router;
