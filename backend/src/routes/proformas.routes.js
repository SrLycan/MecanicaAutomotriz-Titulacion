/**
 * SS SWAP - Enrutador de Proformas (/api/proformas)
 *
 * Igual criterio de permisos que Ordenes de Trabajo (soloStaff: admin +
 * tecnico + recepcionista) para todo el modulo, EXCEPTO eliminar, que
 * queda restringido a 'administrador' — es un documento comercial que se
 * entrega al cliente, mas sensible que una orden interna.
 */
const express = require('express');
const router  = express.Router();
const { verificarToken, soloStaff, verificarRol } = require('../middleware/auth.middleware');

const {
    listarProformas, obtenerProforma, crearProforma, actualizarProforma,
    cambiarEstadoProforma, duplicarProforma, eliminarProforma,
    generarDesdeOrden, convertirAOrden, confirmarUso, revertirSalida,
} = require('../controllers/proformas.controller');

const { descargarPdf, descargarExcel } = require('../controllers/proformasExport.controller');

router.use(verificarToken, soloStaff);

router.get('/desde-orden/:ordenId', generarDesdeOrden);

router.get('/',                       listarProformas);
router.get('/:id',                    obtenerProforma);
router.post('/',                      crearProforma);
router.put('/:id',                    actualizarProforma);
router.patch('/:id/estado',           cambiarEstadoProforma);
router.post('/:id/duplicar',          duplicarProforma);
router.post('/:id/convertir-orden',   convertirAOrden);
router.post('/:id/confirmar-uso',     confirmarUso);
router.post('/:id/revertir-salida', verificarRol('administrador'), revertirSalida);
router.get('/:id/pdf',                descargarPdf);
router.get('/:id/excel',              descargarExcel);
router.delete('/:id', verificarRol('administrador'), eliminarProforma);

module.exports = router;
