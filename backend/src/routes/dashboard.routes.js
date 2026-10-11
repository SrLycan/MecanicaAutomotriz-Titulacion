/**
 * SS SWAP - Enrutador del panel de inicio (/api/dashboard)
 * Todo el personal; el controller decide que datos ve cada rol.
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, requierePermiso } = require('../middleware/auth.middleware');
const { resumenDashboard } = require('../controllers/dashboard.controller');

router.get('/', verificarToken, requierePermiso('dashboard', 'ver'), resumenDashboard);

module.exports = router;
