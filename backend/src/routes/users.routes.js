/**
 * SS SWAP - Enrutador de Usuarios, Permisos y Auditoría (/api/users)
 *
 * - /me...: perfil propio (cualquier usuario autenticado).
 * - /tecnicos: lista para asignar órdenes (quien ve o asigna órdenes).
 * - Todo lo demás: EXCLUSIVO del superadministrador.
 */
const express = require('express');
const router  = express.Router();
const c = require('../controllers/users.controller');
const { verificarToken, soloSuperadmin, requiereAlguno } = require('../middleware/auth.middleware');
const { subirFotoPerfil } = require('../middleware/upload.middleware');

// Perfil propio — cualquier usuario autenticado (cliente o staff).
// IMPORTANTE: deben ir antes de "/:id" para que Express no interprete "me" como un id.
router.get('/me',            verificarToken, c.obtenerMiPerfil);
router.put('/me',            verificarToken, c.actualizarMiPerfil);
router.put('/me/password',   verificarToken, c.cambiarMiPassword);
router.post('/me/foto',      verificarToken, subirFotoPerfil, c.subirMiFoto);

router.get('/tecnicos', verificarToken, requiereAlguno(['ordenes', 'ver'], ['ordenes', 'asignar']), c.listarTecnicos);

// Superadministrador
router.use(verificarToken, soloSuperadmin);
router.get('/catalogo-permisos',     c.catalogoPermisos);
router.get('/auditoria',             c.listarAuditoria);
router.get('/',                      c.listarUsuarios);
router.post('/',                     c.crearUsuario);
router.get('/:id',                   c.obtenerUsuario);
router.put('/:id',                   c.actualizarUsuario);
router.put('/:id/rol',               c.cambiarRol);
router.put('/:id/estado',            c.cambiarEstado);
router.put('/:id/permisos',          c.actualizarPermisos);
router.put('/:id/password',          c.cambiarPassword);
router.post('/:id/cerrar-sesiones',  c.cerrarSesiones);
router.delete('/:id',                c.eliminarUsuario);

module.exports = router;
