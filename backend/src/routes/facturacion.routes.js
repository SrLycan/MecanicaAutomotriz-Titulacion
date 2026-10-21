/**
 * SS SWAP - Enrutador de Facturación electrónica (/api/facturacion)
 *
 * Permisos (config/permisos.js):
 *  - facturacion: ver · crear (borradores) · aprobar (emitir y enviar al SRI)
 *    · exportar (XML/RIDE/correo) · anular (notas de crédito y anulaciones)
 *    · eliminar (descartar borradores)
 *  - facturacion_config: ver · editar (emisor, puntos, certificado) · aprobar (activar producción)
 */
const express = require('express');
const router = express.Router();
const c = require('../controllers/facturacion.controller');
const { verificarToken, soloStaff, requierePermiso, requiereAlguno } = require('../middleware/auth.middleware');
const { limitarPorIp } = require('../middleware/seguridad.middleware');

router.use(verificarToken, soloStaff);

// Envíos al SRI y correos: tope por IP para que un botón insistente o un script no saturen los servicios.
const limiteSri = limitarPorIp({ ventanaMs: 60 * 1000, maximo: 30, mensaje: 'Demasiadas solicitudes al SRI. Espere un minuto.' });

// ── Configuración ──
router.get('/catalogos',                     requiereAlguno(['facturacion', 'ver'], ['facturacion_config', 'ver']), c.catalogos);
router.get('/config',                        requierePermiso('facturacion_config', 'ver'), c.obtenerConfig);
router.put('/config',                        requierePermiso('facturacion_config', 'editar'), c.guardarConfig);
router.post('/config/puntos',                requierePermiso('facturacion_config', 'editar'), c.guardarPunto);
router.put('/config/puntos/:id',             requierePermiso('facturacion_config', 'editar'), c.guardarPunto);
router.put('/config/puntos/:id/secuencial',  requierePermiso('facturacion_config', 'editar'), c.fijarSecuencial);
router.post('/config/certificado',           requierePermiso('facturacion_config', 'editar'), c.recibirCertificado, c.cargarCertificado);
router.post('/config/produccion',            requierePermiso('facturacion_config', 'aprobar'), c.activarProduccion);
router.post('/config/pruebas',               requierePermiso('facturacion_config', 'editar'), c.volverAPruebas);
router.post('/config/probar-conexion',       requierePermiso('facturacion_config', 'editar'), limiteSri, c.probarConexion);

// ── Comprobantes ──
router.get('/resumen',                       requierePermiso('facturacion', 'ver'), c.resumen);
router.get('/validar-identificacion',        requiereAlguno(['facturacion', 'crear'], ['clientes', 'crear'], ['clientes', 'editar']), c.validarIdentificacionCtrl);
router.get('/propuesta',                     requierePermiso('facturacion', 'crear'), c.propuesta);
router.get('/',                              requierePermiso('facturacion', 'ver'), c.listar);
router.post('/',                             requierePermiso('facturacion', 'crear'), c.crear);
router.post('/notas-credito',                requierePermiso('facturacion', 'anular'), c.crearNotaCredito);
router.get('/:id',                           requierePermiso('facturacion', 'ver'), c.obtener);
router.put('/:id',                           requiereAlguno(['facturacion', 'crear'], ['facturacion', 'anular']), c.actualizar);
router.post('/:id/emitir',                   requierePermiso('facturacion', 'aprobar'), limiteSri, c.emitir);
router.post('/:id/procesar',                 requierePermiso('facturacion', 'ver'), limiteSri, c.procesar);
router.post('/:id/descartar',                requierePermiso('facturacion', 'eliminar'), c.descartar);
router.post('/:id/anulacion',                requierePermiso('facturacion', 'anular'), c.registrarAnulacion);
router.post('/:id/anulacion/cancelar',       requierePermiso('facturacion', 'anular'), c.cancelarAnulacion);
router.post('/:id/correo',                   requierePermiso('facturacion', 'exportar'), limiteSri, c.reenviarCorreo);
router.get('/:id/xml',                       requierePermiso('facturacion', 'exportar'), c.descargarXml);
router.get('/:id/ride',                      requierePermiso('facturacion', 'exportar'), c.descargarRide);

module.exports = router;
