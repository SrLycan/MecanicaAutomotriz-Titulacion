/**
 * SS SWAP - Enrutador de Estadisticas (/api/estadisticas)
 * Restringido a 'administrador', igual que Proveedores/Sucursales/Servicios.
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, requierePermiso } = require('../middleware/auth.middleware');
const { productosMasVendidos, serviciosMasSolicitados, crecimiento, estadisticasProformas } = require('../controllers/estadisticas.controller');

router.use(verificarToken, requierePermiso('estadisticas', 'ver'));

router.get('/productos-mas-vendidos',   productosMasVendidos);
router.get('/servicios-mas-solicitados', serviciosMasSolicitados);
router.get('/crecimiento',              crecimiento);
router.get('/proformas',                estadisticasProformas);

module.exports = router;
