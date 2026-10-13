/**
 * SS SWAP - Servidor Principal de API REST (Node.js / Express)
 * Configura middlewares globales, enrutamiento modular de la API,
 * servicio de archivos estáticos y la conexión a MongoDB (conversaciones
 * del chatbot). Las migraciones de Postgres se aplican manualmente en
 * Supabase, no en el arranque.
 */
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
const proveedoresRoutes = require('./routes/proveedores.routes');
const estadisticasRoutes = require('./routes/estadisticas.routes');
const proformasRoutes = require('./routes/proformas.routes');
const cuentasCobrarRoutes = require('./routes/cuentasCobrar.routes');
const catalogosRoutes = require('./routes/catalogos.routes');
const cajaRoutes = require('./routes/caja.routes');
const finanzasRoutes = require('./routes/finanzas.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const plataformaRoutes = require('./routes/plataforma.routes');
const empresaRoutes = require('./routes/empresa.routes');
const facturacionRoutes = require('./routes/facturacion.routes');
const legalRoutes = require('./routes/legal.routes');
const { contextoPublico, registrarErrores } = require('./middleware/empresa.middleware');
const { protegerControladoresAsync, cabecerasSeguridad } = require('./middleware/seguridad.middleware');
// Antes de montar cualquier ruta: un error en un controlador async ya no cierra el proceso.
protegerControladoresAsync();
const { iniciarRespaldoAutomatico } = require('./services/respaldo.service');
const { iniciarTareaAutomatica: iniciarTareaFacturacion } = require('./services/facturacion.service');
// Nota: ya NO se requiere './config/initDb' aqui a proposito. El esquema y
// las migraciones de Postgres se corrieron manualmente contra Supabase
// (schema.sql + migrations.sql via el SQL Editor), y no se quiere que el
// servidor intente correr nada mas (ni migraciones ni seed) en cada arranque
// — los datos deben quedar tal cual estan en Supabase.
// Con BD local se activa RUN_MIGRATIONS=true en el .env para aplicar
// migrations.sql (idempotente) en cada arranque.
const { runMigrations } = require('./config/initDb');
const { connectMongo }  = require('./config/mongo');
const path = require('path');

const app  = express();
const PORT = process.env.PORT || 5000;

// Hostinger (y la mayoria de hostings) sirven la app detras de un proxy
// inverso (SSL/LiteSpeed). Sin esto, req.ip devuelve siempre la IP interna
// del proxy — rompe el rate-limit por IP del chatbot y el registro de IP
// en las conversaciones de MongoDB. En local no afecta nada.
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(cabecerasSeguridad);

// ── Middlewares globales ─────────────────────────────────────
// CORS_ORIGIN admite una o varias URLs separadas por coma, por si el
// frontend responde en mas de un dominio (ej. con y sin "www").
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

// Mantiene disponibles las dos direcciones locales habituales aunque el
// proceso haya heredado una configuracion CORS anterior del entorno.
for (const localOrigin of ['http://localhost:3000', 'http://127.0.0.1:3000']) {
    if (!allowedOrigins.includes(localOrigin)) allowedOrigins.push(localOrigin);
}

// Agrega automaticamente la variante con/sin "www" de cada dominio, porque
// los clientes entran a veces por una y a veces por otra (la causa de los
// "Origen no permitido por CORS" en produccion).
for (const o of [...allowedOrigins]) {
    const variante = o.includes('://www.') ? o.replace('://www.', '://') : o.replace('://', '://www.');
    if (!o.includes('localhost') && !o.includes('127.0.0.1') && !allowedOrigins.includes(variante)) {
        allowedOrigins.push(variante);
    }
}

app.use(cors({
    origin: (origin, callback) => {
        // Sin "origin" = curl, health checks, apps moviles: se permite.
        // En desarrollo tambien se permite el origen del navegador local, ya
        // que VS Code puede servir el frontend con una variante de localhost.
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        // Se rechaza sin lanzar error: antes el Error caia en el manejador
        // global (500 + stack completo en el log por cada peticion). Ahora
        // simplemente no se envian cabeceras CORS y se registra una linea.
        console.warn(`[cors] Origen rechazado: ${origin}`);
        callback(null, false);
    },
    credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Archivos subidos (fotos de perfil, etc.)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
// Logos incluidos en el backend (empresas.logo_archivo = 'asset:...'): solo imagenes.
app.use('/recursos-marca', (req, res, next) => (/^\/[\w.-]+\.(png|jpe?g)$/i.test(req.path) ? next() : res.status(404).end()),
    express.static(path.join(__dirname, 'assets'), { index: false, fallthrough: false }));

// ── Multiempresa ─────────────────────────────────────────────
// Toda peticion arranca en la empresa de la web publica (SS SWAP); las rutas
// autenticadas pasan a la empresa del usuario en verificarToken.
app.use('/api', registrarErrores, contextoPublico);

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
app.use('/api/proveedores', proveedoresRoutes);
app.use('/api/estadisticas', estadisticasRoutes);
app.use('/api/proformas', proformasRoutes);
app.use('/api/cuentas-cobrar', cuentasCobrarRoutes);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/finanzas', finanzasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/plataforma', plataformaRoutes);
app.use('/api/empresa', empresaRoutes);
app.use('/api/facturacion', facturacionRoutes);
app.use('/api/legal', legalRoutes);

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
    // JSON mal formado o demasiado grande: es un error del cliente, no del servidor.
    if (err && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
        return res.status(err.status || 400).json({ error: 'Solicitud invalida.' });
    }
    console.error(err && err.stack ? err.stack : err);
    if (res.headersSent) return;
    res.status(500).json({ error: 'Error interno del servidor.' });
});

// Ultima red: un error asincrono suelto se registra en vez de cerrar el servidor.
process.on('unhandledRejection', (razon) => {
    console.error('[proceso] Promesa rechazada sin manejar:', razon && razon.stack ? razon.stack : razon);
});

// ── Conexion "caliente" a Postgres ─────────────────────────────
// Abrir una conexion nueva al pooler de Supabase (TLS + auth) tarda varios
// segundos; si eso ocurre en la primera peticion del usuario (ej. registro),
// esa peticion se siente lentisima. Se abre una al arrancar y se hace un
// ping periodico para que el pool nunca quede vacio por inactividad.
const pool = require('./config/db');
const PING_MS = 4 * 60 * 1000;
function calentarPostgres() {
    const ping = () => pool.query('SELECT 1').catch(err =>
        console.warn('[postgres] Ping fallido:', err.message));
    ping();
    setInterval(ping, PING_MS).unref();
}

// ── Arranque ─────────────────────────────────────────────────
app.listen(PORT, async () => {
    console.log(`\n SS SWAP Backend corriendo en http://localhost:${PORT}`);
    console.log(`  Entorno : ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Postgres: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
    if (process.env.RUN_MIGRATIONS === 'true') await runMigrations();
    await connectMongo();
    calentarPostgres();
    iniciarRespaldoAutomatico();
    // Comprobantes electronicos en curso: consulta/reintento automatico cada minuto.
    iniciarTareaFacturacion();
    console.log('');
});
