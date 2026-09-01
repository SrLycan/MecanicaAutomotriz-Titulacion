/**
 * SS SWAP - Pruebas de Componente para ProtectedRoute
 * Verifica la matriz completa de acceso del guardián:
 *
 *   - sin sesion en ruta admin        -> /admin/login
 *   - sin sesion en ruta de cliente   -> /auth
 *   - cliente pidiendo ruta de staff  -> / (inicio)
 *   - staff sin el rol especifico     -> /dashboard (base)
 *   - usuario con el rol permitido    -> ve el contenido
 *
 * Se mockea useAuth (el AuthProvider real habla con la API y localStorage,
 * eso seria una prueba de integracion). El router es MemoryRouter y se usa
 * una "sonda" que muestra la URL final, para afirmar a DONDE redirigio.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

// Estado mutable que cada prueba configura ANTES de renderizar.
const mockEstadoAuth = { usuario: null };

jest.mock('../../context/AuthContext', () => ({
    // useAuth debe devolver el estado actual, no una copia fija.
    useAuth: () => mockEstadoAuth,
}));

// Sonda: renderiza la ruta ACTUAL tras las redirecciones del guardián.
function SondaRuta() {
    const location = useLocation();
    return <p data-testid="ruta-final">{location.pathname}</p>;
}

// Renderiza un mini-router con las rutas destino reales y una protegida.
function renderConRutas({ rutaProtegida = '/dashboard/reportes', roles, children }) {
    return render(
        <MemoryRouter
            initialEntries={[rutaProtegida]}
            future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
            <Routes>
                {/* Layout route: la sonda se renderiza SIEMPRE, gane la ruta que gane */}
                <Route element={<><SondaRuta /><Outlet /></>}>
                    <Route path="/admin/login" element={<div>login-admin</div>} />
                    <Route path="/auth" element={<div>login-cliente</div>} />
                    <Route path="/dashboard" element={<div>dashboard-base</div>} />
                    <Route path="/" element={<div>home</div>} />
                <Route
                    path={rutaProtegida}
                    element={
                        <ProtectedRoute roles={roles}>{children || <div>contenido-protegido</div>}</ProtectedRoute>
                    }
                />
            </Route>
            </Routes>
        </MemoryRouter>
    );
}

describe('components/auth/ProtectedRoute — control de acceso', () => {
    afterEach(() => {
        mockEstadoAuth.usuario = null; // limpia entre pruebas
    });

    test('sin sesion en una ruta admin (/dashboard/...) redirige a /admin/login', () => {
        mockEstadoAuth.usuario = null;

        renderConRutas({ roles: ['administrador'] });

        // La sonda confirma el destino exacto del redirect.
        expect(screen.getByTestId('ruta-final')).toHaveTextContent('/admin/login');
        expect(screen.getByText('login-admin')).toBeInTheDocument();
        expect(screen.queryByText('contenido-protegido')).not.toBeInTheDocument();
    });

    test('sin sesion en una ruta de cliente redirige a /auth', () => {
        mockEstadoAuth.usuario = null;

        renderConRutas({ rutaProtegida: '/panel/perfil' }); // NO empieza con /dashboard

        expect(screen.getByTestId('ruta-final')).toHaveTextContent('/auth');
        expect(screen.getByText('login-cliente')).toBeInTheDocument();
    });

    test('un cliente logueado que pide ruta de staff es enviado al inicio (/)', () => {
        mockEstadoAuth.usuario = { id: 7, nombre: 'Ana', rol: 'cliente' };

        renderConRutas({ roles: ['administrador', 'tecnico'] });

        expect(screen.getByTestId('ruta-final')).toHaveTextContent('/');
        expect(screen.queryByText('contenido-protegido')).not.toBeInTheDocument();
    });

    test('staff sin el rol especifico cae al dashboard base, no al inicio', () => {
        // Recepcionista intentando ver algo exclusivo de administrador:
        // sigue siendo personal valido, por eso va a /dashboard y no a "/".
        mockEstadoAuth.usuario = { id: 3, nombre: 'Luis', rol: 'recepcionista' };

        renderConRutas({ roles: ['administrador'] });

        expect(screen.getByTestId('ruta-final')).toHaveTextContent('/dashboard');
        expect(screen.getByText('dashboard-base')).toBeInTheDocument();
    });

    test('un usuario con el rol permitido SI ve el contenido protegido', () => {
        mockEstadoAuth.usuario = { id: 1, nombre: 'Admin', rol: 'administrador' };

        renderConRutas({ roles: ['administrador'], children: <div>panel-secreto</div> });

        // Sin redireccion: la ruta sigue siendo la original y hay contenido.
        expect(screen.getByTestId('ruta-final')).toHaveTextContent('/dashboard/reportes');
        expect(screen.getByText('panel-secreto')).toBeInTheDocument();
    });
});
