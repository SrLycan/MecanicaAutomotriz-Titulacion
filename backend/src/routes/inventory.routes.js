const express = require('express');
const router  = express.Router();
const { verificarToken, verificarRol, soloStaff } = require('../middleware/auth.middleware');
const {
    listarRepuestos, obtenerRepuesto, crearRepuesto, actualizarRepuesto, eliminarRepuesto,
    registrarMovimiento, listarMovimientos, listarCategorias
} = require('../controllers/inventory.controller');

// Todas las rutas requieren autenticacion
router.use(verificarToken);

// Categorias — cualquier usuario autenticado (incluyendo clientes para el portal)
router.get('/categorias', listarCategorias);

// Repuestos — lectura: staff + clientes; escritura: solo admin
router.get('/repuestos',          listarRepuestos);
router.get('/repuestos/:id',      obtenerRepuesto);
router.post('/repuestos',         verificarRol('administrador'), crearRepuesto);
router.put('/repuestos/:id',      verificarRol('administrador'), actualizarRepuesto);
router.delete('/repuestos/:id',   verificarRol('administrador'), eliminarRepuesto);

// Movimientos — registro: admin + tecnico; consulta: staff
router.post('/movimientos',       verificarRol('administrador','tecnico'), registrarMovimiento);
router.get('/movimientos',        soloStaff, listarMovimientos);

module.exports = router;
