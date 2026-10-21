/**
 * SS SWAP - Enrutador de Proformas (/api/proformas)
 *
 * Dos módulos de permisos según el tipo de la proforma:
 *  - proformas_mecanica   (tipo 'mecanica')
 *  - proformas_colisiones (tipo 'pintura' = Colisiones / Pintura)
 * Cada ruta exige primero la acción en ALGUNO de los dos módulos y luego,
 * leyendo el tipo real de la proforma en la BD, en el que corresponde.
 * Aprobar/rechazar, convertir en OT y confirmar materiales = "aprobar";
 * PDF/Excel = "exportar". Devolver una salida al inventario es un permiso
 * de inventario (registros_inventario: aprobar).
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, soloStaff, requierePermiso, requiereAlguno } = require('../middleware/auth.middleware');
const { tipoDelCuerpo, tipoDeProforma, accionCambioEstadoProforma } = require('../middleware/permisosRecurso.middleware');

const {
    listarProformas, obtenerProforma, crearProforma, actualizarProforma,
    cambiarEstadoProforma, duplicarProforma, eliminarProforma,
    generarDesdeOrden, convertirAOrden, confirmarUso, revertirSalida,
} = require('../controllers/proformas.controller');

const { descargarPdf, descargarExcel } = require('../controllers/proformasExport.controller');

/** La accion en alguno de los dos modulos de proformas. */
const alguna = (...acciones) => requiereAlguno(...acciones.flatMap(a => [['proformas_mecanica', a], ['proformas_colisiones', a]]));

router.use(verificarToken, soloStaff);

router.get('/desde-orden/:ordenId', alguna('crear'), generarDesdeOrden);

router.get('/',                     alguna('ver'), listarProformas);
router.get('/:id',                  alguna('ver'),      tipoDeProforma('ver'),      obtenerProforma);
router.post('/',                    alguna('crear'),    tipoDelCuerpo('crear'),     crearProforma);
router.put('/:id',                  alguna('editar'),   tipoDeProforma('editar'),   actualizarProforma);
router.patch('/:id/estado',         alguna('editar', 'aprobar'), tipoDeProforma(accionCambioEstadoProforma), cambiarEstadoProforma);
router.post('/:id/duplicar',        alguna('crear'),    tipoDeProforma('crear'),    duplicarProforma);
router.post('/:id/convertir-orden', alguna('aprobar'),  tipoDeProforma('aprobar'),  convertirAOrden);
router.post('/:id/confirmar-uso',   alguna('aprobar'),  tipoDeProforma('aprobar'),  confirmarUso);
router.post('/:id/revertir-salida', requierePermiso('registros_inventario', 'aprobar'), revertirSalida);
router.get('/:id/pdf',              alguna('exportar'), tipoDeProforma('exportar'), descargarPdf);
router.get('/:id/excel',            alguna('exportar'), tipoDeProforma('exportar'), descargarExcel);
router.delete('/:id',               alguna('eliminar'), tipoDeProforma('eliminar'), eliminarProforma);

module.exports = router;
