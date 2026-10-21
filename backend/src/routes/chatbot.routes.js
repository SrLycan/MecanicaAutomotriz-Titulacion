/**
 * SS SWAP - Enrutador del Asistente Virtual (/api/chatbot)
 */
const express = require('express');
const router  = express.Router();
const { responderMensaje, listarConversacionesAdmin } = require('../controllers/chatbot.controller');
const { limitarPorIp }                  = require('../middleware/chatbotThrottle.middleware');
const { verificarToken, requierePermiso } = require('../middleware/auth.middleware');

// Publico: sin verificarToken. El widget debe funcionar tanto para
// visitantes anonimos como para clientes logueados.
router.post('/mensaje', limitarPorIp, responderMensaje);

// Bitacora de conversaciones guardadas en MongoDB Atlas (permiso "bitacora").
router.get('/conversaciones', verificarToken, requierePermiso('bitacora', 'ver'), listarConversacionesAdmin);

module.exports = router;
