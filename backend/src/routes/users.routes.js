/**
 * SS SWAP - Enrutador de Usuarios, Permisos y Auditoría (/api/users)
 *
 * - /me...: perfil propio (cualquier usuario autenticado).
 * - /tecnicos: lista para asignar órdenes (quien ve o asigna órdenes).
 * - Todo lo demás: gestión del personal DE LA PROPIA EMPRESA con el permiso
 *   "usuarios" (y "auditoria" para el historial). Las consultas corren
 *   aisladas por empresa, así que nunca se ve ni se toca otra empresa.
 */
const express = require('express');
const router  = express.Router();
const c = require('../controllers/users.controller');
const { verificarToken, requierePermiso, requiereAlguno } = require('../middleware/auth.middleware');
const { subirFotoPerfil } = require('../middleware/upload.middleware');

// Perfil propio — cualquier usuario autenticado (cliente o staff).
// IMPORTANTE: deben ir antes de "/:id" para que Express no interprete "me" como un id.
router.get('/me',            verificarToken, c.obtenerMiPerfil);
router.put('/me',            verificarToken, c.actualizarMiPerfil);
router.put('/me/password',   verificarToken, c.cambiarMiPassword);
router.post('/me/foto',      verificarToken, subirFotoPerfil, c.subirMiFoto);

router.get('/tecnicos', verificarToken, requiereAlguno(['ordenes', 'ver'], ['ordenes', 'asignar']), c.listarTecnicos);

// Personal de la empresa
router.use(verificarToken);
const ver = requierePermiso('usuarios', 'ver');
const editar = requierePermiso('usuarios', 'editar');
router.get('/catalogo-permisos',     ver, c.catalogoPermisos);
router.get('/auditoria',             requierePermiso('auditoria', 'ver'), c.listarAuditoria);
router.get('/',                      ver, c.listarUsuarios);
router.post('/',                     requierePermiso('usuarios', 'crear'), c.crearUsuario);
router.get('/:id',                   ver, c.obtenerUsuario);
router.put('/:id',                   editar, c.actualizarUsuario);
router.put('/:id/rol',               editar, c.cambiarRol);
router.put('/:id/estado',            editar, c.cambiarEstado);
router.put('/:id/permisos',          editar, c.actualizarPermisos);
router.put('/:id/password',          editar, c.cambiarPassword);
router.post('/:id/cerrar-sesiones',  editar, c.cerrarSesiones);
router.delete('/:id',                requierePermiso('usuarios', 'eliminar'), c.eliminarUsuario);

module.exports = router;
