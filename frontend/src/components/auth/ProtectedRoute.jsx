/**
 * SS SWAP - Guardián de Rutas Protegidas (ProtectedRoute)
 * Controla el acceso basado en autenticación y roles permitidos:
 * - Redirige a /admin/login para intentos no autorizados al panel administrativo.
 * - Redirige a /auth para accesos no autenticados al portal de clientes.
 * - Restringe vistas exclusivas de administrador/técnico/recepcionista.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ROLES_STAFF = ['administrador', 'tecnico', 'recepcionista'];

export default function ProtectedRoute({ children, roles }) {
    const { usuario } = useAuth();
    const location    = useLocation();

    // No autenticado
    if (!usuario) {
        // Si la ruta es del panel admin, redirige al login de admin
        const esAdmin = location.pathname.startsWith('/dashboard');
        return <Navigate to={esAdmin ? '/admin/login' : '/auth'} replace />;
    }

    // Cliente intentando acceder al panel admin
    if (roles && !roles.includes(usuario.rol)) {
        // Si es cliente redirige al inicio
        if (!ROLES_STAFF.includes(usuario.rol)) {
            return <Navigate to="/" replace />;
        }
        // Si es staff pero sin el rol especifico, va al dashboard base
        return <Navigate to="/dashboard" replace />;
    }

    return children;
}
