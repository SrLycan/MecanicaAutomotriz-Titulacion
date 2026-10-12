/**
 * SS SWAP - Enrutador del Portal de Clientes (/api/panel)
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, verificarRol } = require('../middleware/auth.middleware');
const { miActividad, miHistorialOrden, miHistorialChat } = require('../controllers/panel.controller');

router.use(verificarToken);

// Solo clientes pueden ver su panel
router.get('/mi-actividad',              verificarRol('cliente'), miActividad);
router.get('/ordenes/:id/historial',     verificarRol('cliente'), miHistorialOrden);
router.get('/chatbot-historial',         verificarRol('cliente'), miHistorialChat);

// Comprobantes electronicos del propio cliente (solo autorizados).
const { misComprobantes, miDocumento } = require('../controllers/facturacion.controller');
router.get('/facturas',                  verificarRol('cliente'), misComprobantes);
router.get('/facturas/:id/ride',         verificarRol('cliente'), miDocumento('ride'));
router.get('/facturas/:id/xml',          verificarRol('cliente'), miDocumento('xml'));

module.exports = router;
