const express = require('express');
const router  = express.Router();
const { responderMensaje } = require('../controllers/chatbot.controller');
const { limitarPorIp }     = require('../middleware/chatbotThrottle.middleware');

// Publico: sin verificarToken. El widget debe funcionar tanto para
// visitantes anonimos como para clientes logueados.
router.post('/mensaje', limitarPorIp, responderMensaje);

module.exports = router;
