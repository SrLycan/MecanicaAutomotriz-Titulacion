require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes       = require('./routes/auth.routes');
const inventoryRoutes  = require('./routes/inventory.routes');
const usersRoutes      = require('./routes/users.routes');
const sucursalesRoutes = require('./routes/sucursales.routes');
const ordenesRoutes    = require('./routes/ordenes.routes');
const serviciosRoutes  = require('./routes/servicios.routes');
const panelRoutes      = require('./routes/panel.routes');
const citasRoutes      = require('./routes/citas.routes');
const solicitudesRoutes = require('./routes/solicitudes.routes');
const { runMigrations } = require('./config/initDb');
const path = require('path');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middlewares globales ─────────────────────────────────────
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Archivos subidos (fotos de perfil, etc.)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Rutas ────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/inventory',  inventoryRoutes);
app.use('/api/users',      usersRoutes);
app.use('/api/sucursales', sucursalesRoutes);
app.use('/api/ordenes',    ordenesRoutes);
app.use('/api/servicios',  serviciosRoutes);
app.use('/api/panel',      panelRoutes);
app.use('/api/citas',      citasRoutes);
app.use('/api/solicitudes', solicitudesRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({
    status: 'ok',
    sistema: 'SS SWAP',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
}));

// 404
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));

// Error global
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Error interno del servidor.' });
});

// ── Arranque ─────────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`\n SS SWAP Backend corriendo en http://localhost:${PORT}`);
    console.log(`  Entorno : ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Base de datos: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
    await runMigrations();
    console.log('');
});
