const express = require('express');
const router  = express.Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const {
    listarServicios, obtenerServicio, crearServicio, actualizarServicio, eliminarServicio
} = require('../controllers/servicios.controller');

// Lectura pública (sin token) — para que el home muestre los servicios disponibles
router.get('/',     listarServicios);
router.get('/:id',  obtenerServicio);

// Escritura — solo administrador
router.use(verificarToken);
router.post('/',       verificarRol('administrador'), crearServicio);
router.put('/:id',     verificarRol('administrador'), actualizarServicio);
router.delete('/:id',  verificarRol('administrador'), eliminarServicio);

module.exports = router;
