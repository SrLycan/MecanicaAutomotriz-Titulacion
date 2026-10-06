/**
 * SS SWAP - Enrutador Principal de la Aplicación (React Router)
 * Configura proveedores globales (Tema, Autenticación, Confirmación),
 * rutas públicas, portal de clientes y panel administrativo con control por roles.
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
import ProtectedRoute from './components/auth/ProtectedRoute';

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
const Movimientos         = lazy(() => import('./pages/Movimientos'));
const RegistrarMovimiento = lazy(() => import('./pages/RegistrarMovimiento'));
const Usuarios            = lazy(() => import('./pages/Usuarios'));
const Sucursales          = lazy(() => import('./pages/Sucursales'));
const OrdenesTrabajo      = lazy(() => import('./pages/OrdenesTrabajo'));
const Vehiculos           = lazy(() => import('./pages/Vehiculos'));
const Clientes            = lazy(() => import('./pages/Clientes'));
const Servicios           = lazy(() => import('./pages/Servicios'));
const Citas               = lazy(() => import('./pages/Citas'));
const Bitacora            = lazy(() => import('./pages/Bitacora'));       // solo administradores
const Proveedores         = lazy(() => import('./pages/Proveedores'));    // solo administradores
const Graficas            = lazy(() => import('./pages/Graficas'));       // solo administradores
const Proformas           = lazy(() => import('./pages/Proformas'));
const ProformaForm        = lazy(() => import('./pages/ProformaForm'));
const ProformaView        = lazy(() => import('./pages/ProformaView'));
const Finanzas            = lazy(() => import('./pages/Finanzas'));       // solo administradores
const Caja                = lazy(() => import('./pages/Caja'));           // admin y recepcion
const Pedidos             = lazy(() => import('./pages/Pedidos'));        // pedidos de la tienda

const ROLES_STAFF = ['administrador', 'tecnico', 'recepcionista'];

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
                        {/* ── Paginas publicas ── */}
                        <Route path="/"            element={<Home />} />
                        <Route path="/auth"         element={<AuthPage />} />
                        <Route path="/admin/login"  element={<AdminLogin />} />

                        <Route path="/productos"   element={<ProductosPublic />} />
                        <Route path="/servicios"   element={<ServiciosPublic />} />
                        <Route path="/nosotros"    element={<NosotrosPublic />} />

                        {/* Panel del cliente */}
                        <Route path="/mi-panel" element={
                            <ProtectedRoute roles={['cliente']}>
                                <PanelCliente />
                            </ProtectedRoute>
                        } />

                        {/* ── Panel de administracion ── */}
                        <Route path="/dashboard" element={
                            <ProtectedRoute roles={ROLES_STAFF}>
                                <Layout />
                            </ProtectedRoute>
                        }>
                            <Route index                element={<Dashboard />} />
                            <Route path="inventario"    element={<Inventario />} />
                            <Route path="registrar"     element={
                                <ProtectedRoute roles={['administrador', 'tecnico', 'recepcionista']}>
                                    <RegistrarMovimiento />
                                </ProtectedRoute>
                            } />
                            <Route path="movimientos"   element={
                                <ProtectedRoute roles={['administrador', 'tecnico', 'recepcionista']}>
                                    <Movimientos />
                                </ProtectedRoute>
                            } />
                            <Route path="usuarios"      element={
                                <ProtectedRoute roles={['administrador']}>
                                    <Usuarios />
                                </ProtectedRoute>
                            } />
                            <Route path="clientes"      element={
                                <ProtectedRoute roles={['administrador','recepcionista']}>
                                    <Clientes />
                                </ProtectedRoute>
                            } />
                            <Route path="ordenes"       element={
                                <ProtectedRoute roles={['administrador','tecnico','recepcionista']}>
                                    <OrdenesTrabajo />
                                </ProtectedRoute>
                            } />
                            <Route path="vehiculos"    element={
                                <ProtectedRoute roles={['administrador','tecnico','recepcionista']}>
                                    <Vehiculos />
                                </ProtectedRoute>
                            } />
                            <Route path="sucursales"    element={
                                <ProtectedRoute roles={['administrador']}>
                                    <Sucursales />
                                </ProtectedRoute>
                            } />
                            <Route path="servicios"     element={
                                <ProtectedRoute roles={['administrador']}>
                                    <Servicios />
                                </ProtectedRoute>
                            } />
                            <Route path="citas" element={<ProtectedRoute roles={['administrador','tecnico','recepcionista']}><Citas /></ProtectedRoute>} />
                            <Route path="bitacora" element={
                                <ProtectedRoute roles={['administrador']}>
                                    <Bitacora />
                                </ProtectedRoute>
                            } />
                            <Route path="proveedores" element={
                                <ProtectedRoute roles={['administrador']}>
                                    <Proveedores />
                                </ProtectedRoute>
                            } />
                            <Route path="graficas" element={
                                <ProtectedRoute roles={['administrador']}>
                                    <Graficas />
                                </ProtectedRoute>
                            } />
                            <Route path="proformas" element={
                                <ProtectedRoute roles={['administrador','tecnico','recepcionista']}>
                                    <Proformas />
                                </ProtectedRoute>
                            } />
                            <Route path="proformas/nueva" element={
                                <ProtectedRoute roles={['administrador','tecnico','recepcionista']}>
                                    <ProformaForm />
                                </ProtectedRoute>
                            } />
                            <Route path="proformas/:id/editar" element={
                                <ProtectedRoute roles={['administrador','tecnico','recepcionista']}>
                                    <ProformaForm />
                                </ProtectedRoute>
                            } />
                            <Route path="finanzas" element={
                                <ProtectedRoute roles={['administrador']}>
                                    <Finanzas />
                                </ProtectedRoute>
                            } />
                            <Route path="pedidos" element={
                                <ProtectedRoute roles={['administrador','tecnico','recepcionista']}>
                                    <Pedidos />
                                </ProtectedRoute>
                            } />
                            <Route path="caja" element={
                                <ProtectedRoute roles={['administrador','recepcionista']}>
                                    <Caja />
                                </ProtectedRoute>
                            } />
                            <Route path="proformas/:id" element={
                                <ProtectedRoute roles={['administrador','tecnico','recepcionista']}>
                                    <ProformaView />
                                </ProtectedRoute>
                            } />
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