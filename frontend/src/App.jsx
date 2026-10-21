/**
 * SS SWAP - Enrutador Principal de la Aplicación (React Router)
 * Configura proveedores globales (Tema, Autenticación, Confirmación),
 * rutas públicas, portal de clientes y panel administrativo con control por
 * roles y permisos individuales (módulo:acción).
 */
import React, { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ConfirmProvider } from './components/common/ConfirmDialog';
import ScrollToTop from './components/common/ScrollToTop';
import CargandoPagina from './components/common/CargandoPagina';
import SwapBot from './components/chatbot/SwapBot';
import ProtectedRoute, { RutaPublica } from './components/auth/ProtectedRoute';
import { ROLES_STAFF, useAuth } from './context/AuthContext';

// ── Rutas Públicas de entrada (en el paquete principal) ──────
// Home, registro/login de clientes y login del personal abren al instante.
import Home       from './pages/public/Home';
import AuthPage   from './pages/public/AuthPage';
import AdminLogin from './pages/public/AdminLogin';

import './styles/global.css';
import './styles/mobile-performance.css';

// El resto de paginas se carga bajo demanda (lazy): antes todo el panel, las
// graficas (recharts) y las paginas publicas se descargaban y procesaban de
// golpe al abrir la web, lo que en telefonos hacia lenta la primera carga.
const ServiciosPublic = lazy(() => import('./pages/public/Servicios'));
const NosotrosPublic  = lazy(() => import('./pages/public/Nosotros'));
const ProductosPublic = lazy(() => import('./pages/public/Productos'));

// Portal del cliente
const PanelCliente    = lazy(() => import('./pages/PanelCliente'));

// ── Panel Administrativo (Staff) ─────────────────────────────
const Layout              = lazy(() => import('./components/layout/Layout'));
const Dashboard           = lazy(() => import('./pages/Dashboard'));
const Inventario          = lazy(() => import('./pages/Inventario'));
// Sprint 27: Registros + Registrar movimiento en una sola página ("Entradas y salidas").
const EntradasSalidas     = lazy(() => import('./pages/EntradasSalidas'));
const HistorialProductos  = lazy(() => import('./pages/HistorialProductos'));
const Usuarios            = lazy(() => import('./pages/Usuarios'));
const Sucursales          = lazy(() => import('./pages/Sucursales'));
const OrdenesTrabajo      = lazy(() => import('./pages/OrdenesTrabajo'));
const Vehiculos           = lazy(() => import('./pages/Vehiculos'));
const Clientes            = lazy(() => import('./pages/Clientes'));
const Servicios           = lazy(() => import('./pages/Servicios'));
const Citas               = lazy(() => import('./pages/Citas'));
const Bitacora            = lazy(() => import('./pages/Bitacora'));
const Proveedores         = lazy(() => import('./pages/Proveedores'));
const Graficas            = lazy(() => import('./pages/Graficas'));
const Proformas           = lazy(() => import('./pages/Proformas'));
const ProformaForm        = lazy(() => import('./pages/ProformaForm'));
const ProformaView        = lazy(() => import('./pages/ProformaView'));
const Finanzas            = lazy(() => import('./pages/Finanzas'));
const Caja                = lazy(() => import('./pages/Caja'));
const Pedidos             = lazy(() => import('./pages/Pedidos'));

const Auditoria           = lazy(() => import('./pages/Auditoria'));
const EmpresaConfig       = lazy(() => import('./pages/EmpresaConfig'));
// Sprint 23: facturación electrónica SRI y documentos legales
const Facturacion         = lazy(() => import('./pages/facturacion/Facturacion'));
const FacturaEditor       = lazy(() => import('./pages/facturacion/FacturaEditor'));
const FacturaDetalle      = lazy(() => import('./pages/facturacion/FacturaDetalle'));
const FacturacionConfig   = lazy(() => import('./pages/facturacion/FacturacionConfig'));
const Legal               = lazy(() => import('./pages/legal/Legal'));
const Contratacion        = lazy(() => import('./pages/legal/Contratacion'));
const PlataformaLegal     = lazy(() => import('./pages/plataforma/LegalPlataforma'));
// Plataforma (solo superadministrador)
const PlataformaEmpresas  = lazy(() => import('./pages/plataforma/Empresas'));
const PlataformaAuditoria = lazy(() => import('./pages/plataforma/AuditoriaGlobal'));
const PlataformaRespaldos = lazy(() => import('./pages/plataforma/Respaldos'));
const PlataformaSistema   = lazy(() => import('./pages/plataforma/Sistema'));
const AccesoDenegado      = lazy(() => import('./pages/AccesoDenegado'));

/**
 * Inicio del panel: el superadministrador sin empresa (solo plataforma) no
 * tiene panel de empresa y va directo a la gestion de empresas.
 */
function InicioPanel() {
    const { usuario, empresa } = useAuth();
    if (usuario?.rol === 'superadministrador' && !empresa) return <Navigate to="/dashboard/plataforma" replace />;
    return <Dashboard />;
}

/** Enlaces antiguos a /dashboard/registrar: abren la pestaña "Registrar" de Entradas y salidas. */
const RedirigirRegistrar = () => <Navigate to="/dashboard/movimientos?tab=registrar" replace />;

const PROF_VER    = ['proformas_mecanica:ver', 'proformas_colisiones:ver'];
const PROF_CREAR  = ['proformas_mecanica:crear', 'proformas_colisiones:crear'];
const PROF_EDITAR = ['proformas_mecanica:editar', 'proformas_colisiones:editar'];

// Paginas del panel y el permiso que exige cada una (basta con uno de la lista).
const RUTAS_PANEL = [
    { path: 'inventario',           Pagina: Inventario,          permiso: ['inventario_mecanica:ver', 'inventario_colisiones:ver'] },
    { path: 'registrar',            Pagina: RedirigirRegistrar,  permiso: 'registros_inventario:crear' },
    { path: 'movimientos',          Pagina: EntradasSalidas,     permiso: ['registros_inventario:ver', 'registros_inventario:crear'] },
    { path: 'historial-productos',  Pagina: HistorialProductos,  permiso: ['inventario_mecanica:ver', 'inventario_colisiones:ver'] },
    { path: 'pedidos',              Pagina: Pedidos,             permiso: 'pedidos_tienda:ver' },
    { path: 'ordenes',              Pagina: OrdenesTrabajo,      permiso: 'ordenes:ver' },
    { path: 'proformas',            Pagina: Proformas,           permiso: PROF_VER },
    { path: 'proformas/nueva',      Pagina: ProformaForm,        permiso: PROF_CREAR },
    { path: 'proformas/:id/editar', Pagina: ProformaForm,        permiso: PROF_EDITAR },
    { path: 'proformas/:id',        Pagina: ProformaView,        permiso: PROF_VER },
    { path: 'citas',                Pagina: Citas,               permiso: 'citas:ver' },
    { path: 'clientes',             Pagina: Clientes,            permiso: ['clientes:ver', 'cuentas_cobrar:ver'] },
    { path: 'vehiculos',            Pagina: Vehiculos,           permiso: 'vehiculos:ver' },
    { path: 'proveedores',          Pagina: Proveedores,         permiso: 'proveedores:ver' },
    { path: 'finanzas',             Pagina: Finanzas,            permiso: 'finanzas:ver' },
    { path: 'caja',                 Pagina: Caja,                permiso: 'caja:ver' },
    { path: 'graficas',             Pagina: Graficas,            permiso: 'estadisticas:ver' },
    { path: 'servicios',            Pagina: Servicios,           permiso: 'servicios:ver' },
    { path: 'sucursales',           Pagina: Sucursales,          permiso: 'sucursales:ver' },
    { path: 'bitacora',             Pagina: Bitacora,            permiso: 'bitacora:ver' },
    // Administracion de la empresa (cada empresa la suya).
    { path: 'usuarios',             Pagina: Usuarios,            permiso: 'usuarios:ver' },
    { path: 'auditoria',            Pagina: Auditoria,           permiso: 'auditoria:ver' },
    { path: 'empresa',              Pagina: EmpresaConfig,       permiso: 'empresa:ver' },
    { path: 'legal',                Pagina: Legal,               permiso: 'legal:ver' },
    { path: 'contratacion',         Pagina: Contratacion,        permiso: 'empresa:editar' },
    // Facturación electrónica (SRI)
    { path: 'facturacion',            Pagina: Facturacion,       permiso: 'facturacion:ver' },
    { path: 'facturacion/nueva',      Pagina: FacturaEditor,     permiso: 'facturacion:crear' },
    { path: 'facturacion/config',     Pagina: FacturacionConfig, permiso: 'facturacion_config:ver' },
    { path: 'facturacion/:id/editar', Pagina: FacturaEditor,     permiso: ['facturacion:crear', 'facturacion:anular'] },
    { path: 'facturacion/:id',        Pagina: FacturaDetalle,    permiso: 'facturacion:ver' },
    // Plataforma: solo el superadministrador.
    { path: 'plataforma',           Pagina: PlataformaEmpresas,  soloSuperadmin: true },
    { path: 'plataforma/auditoria', Pagina: PlataformaAuditoria, soloSuperadmin: true },
    { path: 'plataforma/respaldos', Pagina: PlataformaRespaldos, soloSuperadmin: true },
    { path: 'plataforma/sistema',   Pagina: PlataformaSistema,   soloSuperadmin: true },
    { path: 'plataforma/legal',     Pagina: PlataformaLegal,     soloSuperadmin: true },
];

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
            <ConfirmProvider>
                <BrowserRouter>
                    <ScrollToTop />
                    <Toaster
                        position="top-center"
                        toastOptions={{
                            duration: 3500,
                            style: {
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: '.85rem',
                                borderRadius: '10px',
                            },
                            error: { duration: 4500 },
                        }}
                    />
                    <Suspense fallback={<CargandoPagina />}>
                    <Routes>
                        {/* ── Paginas publicas (clientes y visitantes) ──
                            El personal con sesion iniciada va directo a su panel. */}
                        <Route path="/"            element={<RutaPublica><Home /></RutaPublica>} />
                        <Route path="/auth"         element={<RutaPublica><AuthPage /></RutaPublica>} />
                        <Route path="/admin/login"  element={<RutaPublica><AdminLogin /></RutaPublica>} />
                        <Route path="/admin"        element={<Navigate to="/dashboard" replace />} />

                        <Route path="/productos"   element={<RutaPublica><ProductosPublic /></RutaPublica>} />
                        <Route path="/servicios"   element={<RutaPublica><ServiciosPublic /></RutaPublica>} />
                        <Route path="/nosotros"    element={<RutaPublica><NosotrosPublic /></RutaPublica>} />

                        {/* Panel del cliente */}
                        <Route path="/mi-panel" element={
                            <ProtectedRoute roles={['cliente']}>
                                <PanelCliente />
                            </ProtectedRoute>
                        } />

                        {/* ── Panel de administracion ──
                            Cada pagina exige su permiso (modulo:accion). El backend
                            vuelve a validar todo en cada peticion. */}
                        <Route path="/dashboard" element={
                            <ProtectedRoute roles={ROLES_STAFF}>
                                <Layout />
                            </ProtectedRoute>
                        }>
                            <Route index                element={<InicioPanel />} />
                            <Route path="acceso-denegado" element={<AccesoDenegado />} />
                            {RUTAS_PANEL.map(({ path, permiso, soloSuperadmin, Pagina }) => (
                                <Route key={path} path={path} element={
                                    <ProtectedRoute permiso={permiso} soloSuperadmin={soloSuperadmin}>
                                        <Pagina />
                                    </ProtectedRoute>
                                } />
                            ))}
                        </Route>

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                    </Suspense>
                    <SwapBot />
                </BrowserRouter>
            </ConfirmProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}