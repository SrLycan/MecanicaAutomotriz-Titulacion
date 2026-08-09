const express = require('express');
const router  = express.Router();
const { login, register, me } = require('../controllers/auth.controller');
const { verificarToken }       = require('../middleware/auth.middleware');
const { verificarBloqueo }     = require('../middleware/loginThrottle.middleware');

router.post('/login',    verificarBloqueo, login);
router.post('/register', register);
router.get('/me',        verificarToken, me);

module.exports = router;
