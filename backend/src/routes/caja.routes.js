/**
 * SS SWAP - Enrutador de Caja (/api/caja)
 * Accesible a administrador y recepcionista (quienes manejan caja en piso);
 * el historial completo tambien queda disponible para ambos roles.
 * Sprint 29: listado de cajas, reporte/PDF/Excel, anular movimientos
 * manuales (caja:eliminar) y reabrir la ultima caja (caja:reabrir).
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, requierePermiso } = require('../middleware/auth.middleware');
const {
    obtenerSesionActual, opciones, abrirCaja, cerrarCaja, registrarMovimientoCaja, anularMovimientoCaja,
    listarSesiones, exportarSesionesExcel, reporte, pdf, reabrirCaja, listarHistorial,
} = require('../controllers/caja.controller');

router.use(verificarToken);

const ver = requierePermiso('caja', 'ver');

router.get('/actual',                    ver,                                  obtenerSesionActual);
router.get('/opciones',                  ver,                                  opciones);
router.post('/apertura',                 requierePermiso('caja', 'aprobar'),   abrirCaja);
router.post('/cierre',                   requierePermiso('caja', 'aprobar'),   cerrarCaja);
router.post('/movimientos',              requierePermiso('caja', 'crear'),     registrarMovimientoCaja);
router.post('/movimientos/:id(\\d+)/anular', requierePermiso('caja', 'eliminar'),  anularMovimientoCaja);
router.get('/sesiones',                    ver,                                  listarSesiones);
router.get('/sesiones/excel',              ver,                                  exportarSesionesExcel);
router.get('/sesiones/:id(\\d+)/reporte',   ver,                                  reporte);
router.get('/sesiones/:id(\\d+)/pdf',       ver,                                  pdf);
router.post('/sesiones/:id(\\d+)/reabrir',  requierePermiso('caja', 'reabrir'),   reabrirCaja);
router.get('/historial',                 ver,                                  listarHistorial);

module.exports = router;
