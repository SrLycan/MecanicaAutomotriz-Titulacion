/**
 * SS SWAP - Enrutador de documentos legales y contratación (/api/legal)
 *
 *  - /publico/*            sin sesión (web pública: registro de clientes)
 *  - /pendientes, /aceptar, /revocar, /mis-aceptaciones, /constancias/:t   cualquier usuario autenticado
 *  - /contratacion         quien representa a la empresa (empresa:editar)
 *  - /documentos, /versiones, /aceptaciones, /pendientes-resumen          permiso legal (ver/editar/aprobar);
 *                          con ?ambito=plataforma, solo el superadministrador
 *  - /plataforma/*         solo superadministrador
 */
const express = require('express');
const router = express.Router();
const c = require('../controllers/legal.controller');
const { verificarToken, requierePermiso, soloSuperadmin, esSuperadmin } = require('../middleware/auth.middleware');

/** Permiso legal de la empresa; en el ámbito de la plataforma, solo el superadministrador. */
const legal = (accion) => (req, res, next) => {
    if (req.query.ambito === 'plataforma' || req.body?.ambito === 'plataforma') {
        return esSuperadmin(req.usuario) ? next() : soloSuperadmin(req, res, next);
    }
    return requierePermiso('legal', accion)(req, res, next);
};

router.get('/publico/vigentes', c.vigentesPublicos);

router.use(verificarToken);

router.get('/pendientes',               c.misPendientes);
router.post('/aceptar',                 c.aceptar);
router.post('/revocar',                 c.revocar);
router.get('/mis-aceptaciones',         c.misAceptaciones);
router.get('/constancias/:transaccion', c.constancia);
router.get('/contratacion',             requierePermiso('empresa', 'editar'), c.contratacion);

router.get('/documentos',               legal('ver'), c.listarDocumentos);
router.get('/plantillas/:archivo',      legal('editar'), c.obtenerPlantilla);
router.post('/documentos',              legal('editar'), c.crearDocumento);
router.put('/documentos/:id',           legal('editar'), c.editarDocumento);
router.post('/documentos/:id/versiones', legal('editar'), c.crearVersion);
router.get('/versiones/:id',            legal('ver'), c.obtenerVersion);
router.put('/versiones/:id',            legal('editar'), c.editarVersion);
router.delete('/versiones/:id',         legal('editar'), c.eliminarBorrador);
router.post('/versiones/:id/publicar',  legal('aprobar'), c.publicarVersion);
router.get('/aceptaciones',             legal('ver'), c.listarAceptaciones);
router.get('/pendientes-resumen',       requierePermiso('legal', 'ver'), c.pendientesResumen);

router.get('/plataforma/proveedor',             soloSuperadmin, c.obtenerProveedor);
router.put('/plataforma/proveedor',             soloSuperadmin, c.guardarProveedor);
router.get('/plataforma/contratos',             soloSuperadmin, c.listarContratos);
router.post('/plataforma/contratos',            soloSuperadmin, c.crearContrato);
router.post('/plataforma/contratos/:id/terminar', soloSuperadmin, c.terminarContrato);

module.exports = router;
