/**
 * SS SWAP - Enrutador de la Plataforma (/api/plataforma)
 * Exclusivo del superadministrador: empresas, administradores iniciales,
 * accesos de soporte, auditoría global, respaldos, migraciones y errores.
 */
const express = require('express');
const router  = express.Router();
const c = require('../controllers/plataforma.controller');
const { verificarToken, soloSuperadmin } = require('../middleware/auth.middleware');

router.use(verificarToken, soloSuperadmin);

router.get('/resumen',                         c.resumen);
router.get('/empresas',                        c.listarEmpresas);
router.post('/empresas',                       c.crearEmpresa);
router.get('/empresas/:id',                    c.obtenerEmpresa);
router.put('/empresas/:id',                    c.actualizarEmpresa);
router.patch('/empresas/:id/estado',           c.cambiarEstadoEmpresa);
router.post('/empresas/:id/administrador',     c.administradorEmpresa);
router.post('/empresas/:id/soporte',           c.abrirSoporte);
router.get('/soporte',                         c.listarSoporte);
router.delete('/soporte/:id',                  c.cerrarSoporte);
router.get('/auditoria',                       c.auditoriaGlobal);
router.get('/migraciones',                     c.listarMigraciones);
router.get('/errores',                         c.listarErrores);
router.get('/respaldos',                       c.estadoRespaldos);
router.post('/respaldos',                      c.respaldoManual);
router.post('/respaldos/prueba',               c.pruebaRestauracion);

module.exports = router;
