/**
 * SS SWAP - Enrutador Principal de la Aplicación (React Router)
 * Configura proveedores globales (Tema, Autenticación, Confirmación),
 * rutas públicas, portal de clientes y panel administrativo con control por roles.
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ConfirmProvider } from './components/common/ConfirmDialog';
import ScrollToTop from './components/common/ScrollToTop';
import SwapBot from './components/chatbot/SwapBot';

// ── Rutas Públicas ───────────────────────────────────────────
import Home       from './pages/public/Home';
import AuthPage   from './pages/public/AuthPage';
import AdminLogin from './pages/public/AdminLogin';
import ServiciosPublic from './pages/public/Servicios';
import NosotrosPublic  from './pages/public/Nosotros';
import ProductosPublic from './pages/public/Productos';

// ── Rutas del Panel Administrativo (Staff) ───────────────
import ProtectedRoute from './components/auth/ProtectedRoute';
import Layout         from './components/layout/Layout';
import Dashboard      from './pages/Dashboard';
import Inventario     from './pages/Inventario';
import Movimientos    from './pages/Movimientos';
import RegistrarMovimiento from './pages/RegistrarMovimiento';
import Usuarios       from './pages/Usuarios';
import Sucursales     from './pages/Sucursales';
import OrdenesTrabajo from './pages/OrdenesTrabajo';
import Vehiculos      from './pages/Vehiculos';
import Clientes       from './pages/Clientes';
import Servicios      from './pages/Servicios';
import Citas          from './pages/Citas';
// Public / cliente
import PanelCliente   from './pages/PanelCliente';

// Bitacora de actividad — solo administradores
import Bitacora       from './pages/Bitacora';

// Proveedores — solo administradores
import Proveedores    from './pages/Proveedores';

// Graficas — solo administradores
import Graficas        from './pages/Graficas';

// Proformas — administrador, tecnico y recepcionista (igual que Ordenes)
import Proformas        from './pages/Proformas';
import ProformaForm     from './pages/ProformaForm';
import ProformaView     from './pages/ProformaView';

import './styles/global.css';

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
                            <Route path="proformas/:id" element={
                                <ProtectedRoute roles={['administrador','tecnico','recepcionista']}>
                                    <ProformaView />
                                </ProtectedRoute>
                            } />
                        </Route>

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                    <SwapBot />
                </BrowserRouter>
            </ConfirmProvider>
            </AuthProvider>
        </ThemeProvider>
    );
}