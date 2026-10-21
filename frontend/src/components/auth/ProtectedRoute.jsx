/**
 * SS SWAP - Guardián de Rutas Protegidas (ProtectedRoute)
 * Controla el acceso basado en autenticación, roles y permisos:
 * - Redirige a /admin/login para intentos no autenticados al panel administrativo.
 * - Redirige a /auth para accesos no autenticados al portal de clientes.
 * - Un cliente que intenta entrar al panel vuelve al inicio.
 * - Personal sin el rol o permiso requerido ve la pantalla "Acceso denegado"
 *   (también si escribe la URL a mano).
 *
 * Props:
 *  - roles:          lista de roles admitidos (portal de clientes / panel).
 *  - permiso:        'modulo:accion' o lista (basta con uno de ellos).
 *  - soloSuperadmin: rutas de gestión de usuarios, permisos y auditoría.
 *
 * Esto solo decide QUÉ SE MUESTRA: el backend vuelve a validar cada petición.
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, ROLES_STAFF } from '../../context/AuthContext';

export const RUTA_ACCESO_DENEGADO = '/dashboard/acceso-denegado';

export default function ProtectedRoute({ children, roles, permiso, soloSuperadmin }) {
    const { usuario, puede } = useAuth();
    const location    = useLocation();

    // No autenticado
    if (!usuario) {
        // Si la ruta es del panel admin, redirige al login de admin
        const esAdmin = location.pathname.startsWith('/dashboard');
        return <Navigate to={esAdmin ? '/admin/login' : '/auth'} replace />;
    }

    const esStaff = ROLES_STAFF.includes(usuario.rol);

    // Cliente intentando acceder al panel admin
    if (roles && !roles.includes(usuario.rol)) {
        // Si es cliente redirige al inicio
        if (!esStaff) {
            return <Navigate to="/" replace />;
        }
        // Personal sin el rol especifico: pantalla de acceso denegado
        return <Navigate to={RUTA_ACCESO_DENEGADO} replace state={{ desde: location.pathname }} />;
    }

    if (soloSuperadmin && usuario.rol !== 'superadministrador') {
        return <Navigate to={RUTA_ACCESO_DENEGADO} replace state={{ desde: location.pathname }} />;
    }

    if (permiso) {
        const lista = Array.isArray(permiso) ? permiso : [permiso];
        if (!lista.some(p => puede(p))) {
            return <Navigate to={RUTA_ACCESO_DENEGADO} replace state={{ desde: location.pathname }} />;
        }
    }

    return children;
}

/**
 * Páginas de la web pública. Clientes y visitantes las usan normalmente;
 * el personal del taller no navega la web pública con su sesión de trabajo:
 * se le lleva directo a su panel (sin tocar nada de la web para los demás).
 */
export function RutaPublica({ children }) {
    const { usuario } = useAuth();
    if (usuario && ROLES_STAFF.includes(usuario.rol)) return <Navigate to="/dashboard" replace />;
    return children;
}
