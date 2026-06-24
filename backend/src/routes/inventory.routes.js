const express = require('express');
const router  = express.Router();
const { verificarToken, verificarRol, soloStaff } = require('../middleware/auth.middleware');
const {
    listarRepuestos, obtenerRepuesto, crearRepuesto, actualizarRepuesto, eliminarRepuesto,
    registrarMovimiento, listarMovimientos, listarCategorias, toggleEnVenta
} = require('../controllers/inventory.controller');

// Todas las rutas requieren autenticacion
router.use(verificarToken);

// Categorias — cualquier usuario autenticado (incluyendo clientes para el portal)
router.get('/categorias', listarCategorias);

// Repuestos — lectura: staff + clientes; escritura: admin + tecnico
router.get('/repuestos',          listarRepuestos);
router.get('/repuestos/:id',      obtenerRepuesto);
router.post('/repuestos',         verificarRol('administrador','tecnico'), crearRepuesto);
router.put('/repuestos/:id',      verificarRol('administrador','tecnico'), actualizarRepuesto);
router.patch('/repuestos/:id/en-venta', verificarRol('administrador','tecnico'), toggleEnVenta);
router.delete('/repuestos/:id',   verificarRol('administrador'), eliminarRepuesto);

// Movimientos — registro: admin + tecnico + recepcionista; consulta: staff
router.post('/movimientos',       verificarRol('administrador','tecnico','recepcionista'), registrarMovimiento);
router.get('/movimientos',        soloStaff, listarMovimientos);

module.exports = router;
