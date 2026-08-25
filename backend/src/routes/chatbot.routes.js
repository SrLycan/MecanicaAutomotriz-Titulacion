/**
 * SS SWAP - Enrutador del Asistente Virtual (/api/chatbot)
 */
const express = require('express');
const router  = express.Router();
const { responderMensaje, listarConversacionesAdmin } = require('../controllers/chatbot.controller');
const { limitarPorIp }                  = require('../middleware/chatbotThrottle.middleware');
const { verificarToken, verificarRol }  = require('../middleware/auth.middleware');

// Publico: sin verificarToken. El widget debe funcionar tanto para
// visitantes anonimos como para clientes logueados.
router.post('/mensaje', limitarPorIp, responderMensaje);

// Solo administrador: bitacora de conversaciones guardadas en MongoDB Atlas.
router.get('/conversaciones', verificarToken, verificarRol('administrador'), listarConversacionesAdmin);

module.exports = router;
