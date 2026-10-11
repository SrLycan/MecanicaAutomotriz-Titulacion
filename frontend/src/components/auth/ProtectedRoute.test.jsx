/**
 * SS SWAP - Pruebas de Componente para ProtectedRoute y RutaPublica
 * Verifica la matriz completa de acceso del guardián:
 *
 *   - sin sesion en ruta admin             -> /admin/login
 *   - sin sesion en ruta de cliente        -> /auth
 *   - cliente pidiendo ruta de staff       -> / (inicio)
 *   - staff sin el rol especifico          -> /dashboard/acceso-denegado
 *   - staff sin el permiso de la pagina    -> /dashboard/acceso-denegado (URL directa)
 *   - staff con el permiso (o uno de ellos)-> ve el contenido
 *   - superadministrador                   -> ve todo, incluida la gestion de usuarios
 *   - solo superadmin + administrador comun -> acceso denegado
 *   - web publica: visitantes y clientes la ven; el personal va a su panel
 *
 * Se mockea useAuth (el AuthProvider real habla con la API y localStorage,
 * eso seria una prueba de integracion). El router es MemoryRouter y se usa
 * una "sonda" que muestra la URL final, para afirmar a DONDE redirigio.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route, Outlet, useLocation } from 'react-router-dom';
import ProtectedRoute, { RutaPublica } from './ProtectedRoute';

// Estado mutable que cada prueba configura ANTES de renderizar.
const mockEstadoAuth = { usuario: null, permisos: [] };

jest.mock('../../context/AuthContext', () => {
    const ROLES_STAFF = ['superadministrador', 'administrador', 'tecnico', 'recepcionista', 'interno'];
    return {
        ROLES_STAFF,
        // Misma regla que el AuthContext real: superadmin = todo; resto = su lista.
        useAuth: () => ({
            usuario: mockEstadoAuth.usuario,
            puede: (modulo, accion) => {
                const u = mockEstadoAuth.usuario;
                if (!u || !ROLES_STAFF.includes(u.rol)) return false;
                if (u.rol === 'superadministrador') return true;
                return mockEstadoAuth.permisos.includes(accion ? `${modulo}:${accion}` : modulo);
            },
        }),
    };
});

// Sonda: renderiza la ruta ACTUAL tras las redirecciones del guardián.
function SondaRuta() {
    const location = useLocation();
    return <p data-testid="ruta-final">{location.pathname}</p>;
}

// Renderiza un mini-router con las rutas destino reales y una protegida.
function renderConRutas({ rutaProtegida = '/dashboard/reportes', props = {}, children }) {
    return render(
        <MemoryRouter initialEntries={[rutaProtegida]}>
            <Routes>
                {/* Layout route: la sonda se renderiza SIEMPRE, gane la ruta que gane */}
                <Route element={<><SondaRuta /><Outlet /></>}>
                    <Route path="/admin/login" element={<div>login-admin</div>} />
                    <Route path="/auth" element={<div>login-cliente</div>} />
                    <Route path="/dashboard" element={<div>dashboard-base</div>} />
                    <Route path="/dashboard/acceso-denegado" element={<div>acceso-denegado</div>} />
                    <Route path="/" element={<div>home</div>} />
                    <Route
                        path={rutaProtegida}
                        element={
                            <ProtectedRoute {...props}>{children || <div>contenido-protegido</div>}</ProtectedRoute>
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
        mockEstadoAuth.permisos = [];
    });

    test('sin sesion en una ruta admin (/dashboard/...) redirige a /admin/login', () => {
        renderConRutas({ props: { roles: ['administrador'] } });

        // La sonda confirma el destino exacto del redirect.
        expect(screen.getByTestId('ruta-final')).toHaveTextContent('/admin/login');
        expect(screen.getByText('login-admin')).toBeInTheDocument();
        expect(screen.queryByText('contenido-protegido')).not.toBeInTheDocument();
    });

    test('sin sesion en una ruta de cliente redirige a /auth', () => {
        renderConRutas({ rutaProtegida: '/panel/perfil' }); // NO empieza con /dashboard

        expect(screen.getByTestId('ruta-final')).toHaveTextContent('/auth');
        expect(screen.getByText('login-cliente')).toBeInTheDocument();
    });

    test('un cliente logueado que pide ruta de staff es enviado al inicio (/)', () => {
        mockEstadoAuth.usuario = { id: 7, nombre: 'Ana', rol: 'cliente' };

        renderConRutas({ props: { roles: ['administrador', 'tecnico'] } });

        expect(screen.getByTestId('ruta-final')).toHaveTextContent(/^\/$/);
        expect(screen.queryByText('contenido-protegido')).not.toBeInTheDocument();
    });

    test('staff sin el rol especifico ve la pantalla de acceso denegado', () => {
        mockEstadoAuth.usuario = { id: 3, nombre: 'Luis', rol: 'recepcionista' };

        renderConRutas({ props: { roles: ['administrador'] } });

        expect(screen.getByTestId('ruta-final')).toHaveTextContent('/dashboard/acceso-denegado');
        expect(screen.getByText('acceso-denegado')).toBeInTheDocument();
    });

    test('un usuario con el rol permitido SI ve el contenido protegido', () => {
        mockEstadoAuth.usuario = { id: 1, nombre: 'Admin', rol: 'administrador' };

        renderConRutas({ props: { roles: ['administrador'] }, children: <div>panel-secreto</div> });

        // Sin redireccion: la ruta sigue siendo la original y hay contenido.
        expect(screen.getByTestId('ruta-final')).toHaveTextContent('/dashboard/reportes');
        expect(screen.getByText('panel-secreto')).toBeInTheDocument();
    });

    test('URL directa a un modulo sin permiso: acceso denegado', () => {
        mockEstadoAuth.usuario = { id: 5, nombre: 'Bodega', rol: 'interno' };
        mockEstadoAuth.permisos = ['inventario_colisiones:ver'];

        renderConRutas({ rutaProtegida: '/dashboard/finanzas', props: { permiso: 'finanzas:ver' } });

        expect(screen.getByTestId('ruta-final')).toHaveTextContent('/dashboard/acceso-denegado');
        expect(screen.queryByText('contenido-protegido')).not.toBeInTheDocument();
    });

    test('con UNO de los permisos de la lista se entra', () => {
        mockEstadoAuth.usuario = { id: 5, nombre: 'Bodega', rol: 'interno' };
        mockEstadoAuth.permisos = ['inventario_colisiones:ver'];

        renderConRutas({ rutaProtegida: '/dashboard/inventario', props: { permiso: ['inventario_mecanica:ver', 'inventario_colisiones:ver'] } });

        expect(screen.getByText('contenido-protegido')).toBeInTheDocument();
    });

    test('el superadministrador entra a cualquier modulo y a la gestion de usuarios', () => {
        mockEstadoAuth.usuario = { id: 1, nombre: 'Dueño', rol: 'superadministrador' };

        renderConRutas({ rutaProtegida: '/dashboard/usuarios', props: { soloSuperadmin: true } });
        expect(screen.getByText('contenido-protegido')).toBeInTheDocument();
    });

    test('un administrador comun NO entra a la gestion de usuarios', () => {
        mockEstadoAuth.usuario = { id: 2, nombre: 'Admin', rol: 'administrador' };
        mockEstadoAuth.permisos = ['clientes:ver', 'finanzas:ver'];

        renderConRutas({ rutaProtegida: '/dashboard/usuarios', props: { soloSuperadmin: true } });
        expect(screen.getByTestId('ruta-final')).toHaveTextContent('/dashboard/acceso-denegado');
    });

    test('un cliente con permisos falsos en el navegador no entra al panel', () => {
        mockEstadoAuth.usuario = { id: 9, nombre: 'Cliente', rol: 'cliente' };
        mockEstadoAuth.permisos = ['finanzas:ver'];

        renderConRutas({ rutaProtegida: '/dashboard/finanzas', props: { roles: ['administrador', 'interno'], permiso: 'finanzas:ver' } });
        expect(screen.getByTestId('ruta-final')).toHaveTextContent(/^\/$/);
    });
});

describe('RutaPublica — la web publica sigue para clientes y visitantes', () => {
    function renderPublica() {
        return render(
            <MemoryRouter initialEntries={['/productos']}>
                <Routes>
                    <Route element={<><SondaRuta /><Outlet /></>}>
                        <Route path="/productos" element={<RutaPublica><div>web-publica</div></RutaPublica>} />
                        <Route path="/dashboard" element={<div>panel</div>} />
                    </Route>
                </Routes>
            </MemoryRouter>
        );
    }

    afterEach(() => { mockEstadoAuth.usuario = null; });

    test('un visitante sin sesion ve la web publica', () => {
        renderPublica();
        expect(screen.getByText('web-publica')).toBeInTheDocument();
    });

    test('un cliente ve la web publica', () => {
        mockEstadoAuth.usuario = { id: 9, rol: 'cliente' };
        renderPublica();
        expect(screen.getByText('web-publica')).toBeInTheDocument();
    });

    test.each(['interno', 'tecnico', 'administrador', 'superadministrador'])(
        'el personal (%s) es llevado a su panel',
        (rol) => {
            mockEstadoAuth.usuario = { id: 2, rol };
            renderPublica();
            expect(screen.getByTestId('ruta-final')).toHaveTextContent('/dashboard');
            expect(screen.queryByText('web-publica')).not.toBeInTheDocument();
        }
    );
});
