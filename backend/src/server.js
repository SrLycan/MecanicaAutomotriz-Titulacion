require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const authRoutes       = require('./routes/auth.routes');
const inventoryRoutes  = require('./routes/inventory.routes');
const usersRoutes      = require('./routes/users.routes');
const sucursalesRoutes = require('./routes/sucursales.routes');
const { runMigrations } = require('./config/initDb');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middlewares globales ─────────────────────────────────────
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());

// ── Rutas ────────────────────────────────────────────────────
app.use('/api/auth',       authRoutes);
app.use('/api/inventory',  inventoryRoutes);
app.use('/api/users',      usersRoutes);
app.use('/api/sucursales', sucursalesRoutes);

// Health check
app.get('/api/health', (_req, res) => res.json({
    status: 'ok',
    sistema: 'SSWAP',
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
    console.log(`\n SSWAP Backend corriendo en http://localhost:${PORT}`);
    console.log(`  Entorno : ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Base de datos: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
    await runMigrations();
    console.log('');
});
