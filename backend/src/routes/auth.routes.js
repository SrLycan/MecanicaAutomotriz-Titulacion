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
const { limitarPorIp }         = require('../middleware/seguridad.middleware');

// Evita la creacion masiva de cuentas falsas desde una misma IP.
const limiteRegistro = limitarPorIp({ ventanaMs: 60 * 60 * 1000, maximo: 10,
    mensaje: 'Demasiados registros desde esta conexion. Intenta mas tarde.' });

router.post('/login',    verificarBloqueo, login);
router.post('/register', limiteRegistro, register);
router.get('/me',        verificarToken, me);

module.exports = router;
