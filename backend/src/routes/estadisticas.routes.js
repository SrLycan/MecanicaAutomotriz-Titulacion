/**
 * SS SWAP - Enrutador de Estadisticas (/api/estadisticas)
 * Restringido a 'administrador', igual que Proveedores/Sucursales/Servicios.
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const { productosMasVendidos, serviciosMasSolicitados, crecimiento, estadisticasProformas } = require('../controllers/estadisticas.controller');

router.use(verificarToken, verificarRol('administrador'));

router.get('/productos-mas-vendidos',   productosMasVendidos);
router.get('/servicios-mas-solicitados', serviciosMasSolicitados);
router.get('/crecimiento',              crecimiento);
router.get('/proformas',                estadisticasProformas);

module.exports = router;
