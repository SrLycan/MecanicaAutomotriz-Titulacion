/**
 * SS SWAP - Enrutador de Autenticación (/api/auth)
 * Define los endpoints públicos de login/registro y el endpoint protegido
 * 'me'. El login pasa antes por el anti-fuerza-bruta (verificarBloqueo).
 */
const express = require('express');
const router  = express.Router();
const { login, register, me } = require('../controllers/auth.controller');
const { verificarToken }       = require('../middleware/auth.middleware');
const { verificarBloqueo }     = require('../middleware/loginThrottle.middleware');

router.post('/login',    verificarBloqueo, login);
router.post('/register', register);
router.get('/me',        verificarToken, me);

module.exports = router;
