import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Public
import Home       from './pages/public/Home';
import AuthPage   from './pages/public/AuthPage';
import AdminLogin from './pages/public/AdminLogin';

// Admin panel
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

import './styles/global.css';

const ROLES_STAFF = ['administrador', 'tecnico', 'recepcionista'];

export default function App() {
    return (
        <ThemeProvider>
            <AuthProvider>
                <BrowserRouter>
                    <Toaster
                        position="top-right"
                        toastOptions={{
                            duration: 3200,
                            style: {
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: '.85rem',
                                borderRadius: '10px',
                            },
                        }}
                    />
                    <Routes>
                        {/* ── Paginas publicas ── */}
                        <Route path="/"            element={<Home />} />
                        <Route path="/auth"         element={<AuthPage />} />
                        <Route path="/admin/login"  element={<AdminLogin />} />

                        {/* Placeholders para el navbar (Sprint 2) */}
                        <Route path="/productos"   element={<ComingSoon titulo="Productos" />} />
                        <Route path="/servicios"   element={<ComingSoon titulo="Agendar Servicio" />} />
                        <Route path="/nosotros"    element={<ComingSoon titulo="Nosotros" />} />

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
                        </Route>

                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </BrowserRouter>
            </AuthProvider>
        </ThemeProvider>
    );
}

/* ── Placeholder para secciones en construccion ── */
import Navbar from './components/public/Navbar';
import Footer from './components/public/Footer';

function ComingSoon({ titulo }) {
    return (
        <div style={{ background: '#0d0d0d', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500&display=swap');`}</style>
            <Navbar />
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: '120px 24px' }}>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.65rem', letterSpacing: '.3em', color: '#c9a227' }}>PROXIMAMENTE</p>
                <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.5rem,6vw,4rem)', letterSpacing: '.06em', color: '#fff', textAlign: 'center' }}>{titulo}</h1>
                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.95rem', color: 'rgba(255,255,255,.4)', textAlign: 'center', maxWidth: 400 }}>
                    Esta seccion esta en desarrollo. Estara disponible en el proximo sprint.
                </p>
                <a href="/" style={{ marginTop: 12, fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem', color: '#0d0d0d', background: '#c9a227', padding: '11px 24px', borderRadius: 6, textDecoration: 'none' }}>
                    Volver al inicio
                </a>
            </div>
            <Footer />
        </div>
    );
}
