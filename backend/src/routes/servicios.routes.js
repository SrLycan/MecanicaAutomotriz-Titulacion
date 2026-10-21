/**
 * SS SWAP - Enrutador de Catálogo de Servicios (/api/servicios)
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, requierePermiso } = require('../middleware/auth.middleware');
const {
    listarServicios, obtenerServicio, crearServicio, actualizarServicio, eliminarServicio
} = require('../controllers/servicios.controller');

// Lectura pública (sin token) — para que el home muestre los servicios disponibles
router.get('/',     listarServicios);
router.get('/:id',  obtenerServicio);

// Escritura — solo administrador
router.use(verificarToken);
router.post('/',       requierePermiso('servicios', 'crear'),    crearServicio);
router.put('/:id',     requierePermiso('servicios', 'editar'),   actualizarServicio);
router.delete('/:id',  requierePermiso('servicios', 'eliminar'), eliminarServicio);

module.exports = router;
