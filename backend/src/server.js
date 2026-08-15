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
const chatbotRoutes    = require('./routes/chatbot.routes');
// Nota: ya NO se requiere './config/initDb' aqui a proposito. El esquema y
// las migraciones de Postgres se corrieron manualmente contra Supabase
// (schema.sql + migrations.sql via el SQL Editor), y no se quiere que el
// servidor intente correr nada mas (ni migraciones ni seed) en cada arranque
// — los datos deben quedar tal cual estan en Supabase.
const { connectMongo }  = require('./config/mongo');
const path = require('path');

const app  = express();
const PORT = process.env.PORT || 5000;

// Hostinger (y la mayoria de hostings) sirven la app detras de un proxy
// inverso (SSL/LiteSpeed). Sin esto, req.ip devuelve siempre la IP interna
// del proxy — rompe el rate-limit por IP del chatbot y el registro de IP
// en las conversaciones de MongoDB. En local no afecta nada.
app.set('trust proxy', 1);

// ── Middlewares globales ─────────────────────────────────────
// CORS_ORIGIN admite una o varias URLs separadas por coma, por si el
// frontend responde en mas de un dominio (ej. con y sin "www").
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Sin "origin" = curl, health checks, apps moviles: se permite.
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        callback(new Error('Origen no permitido por CORS.'));
    },
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
app.use('/api/chatbot',    chatbotRoutes);

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
    console.log(`  Postgres: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
    await connectMongo();
    console.log('');
});
