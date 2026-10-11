/**
 * SS SWAP - Pruebas del menú lateral dinámico (Layout)
 *
 * El menú solo muestra los módulos que el usuario tiene permitidos:
 *  - superadministrador: todo + "Usuarios y permisos".
 *  - usuario con permisos parciales: solo sus módulos; nada de gestión de usuarios.
 *  - usuario sin permisos: solo "Panel".
 * La API se simula (las insignias del menú no deben pedir datos que el
 * usuario no puede ver).
 */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const mockEstadoAuth = { usuario: null, permisos: [] };
// Funcion simple (CRA reinicia las implementaciones de jest.fn entre pruebas).
const mockLlamadas = [];
const mockGet = (url) => { mockLlamadas.push(url); return Promise.resolve({ data: {} }); };

jest.mock('../../services/api', () => ({ __esModule: true, default: { get: (...a) => mockGet(...a) } }));
jest.mock('../../context/ThemeContext', () => ({ useTheme: () => ({ isDark: false, toggle: () => {} }) }));
jest.mock('../../context/AuthContext', () => {
    // Misma regla que el AuthContext real: '*' = todo (superadmin dentro de una empresa).
    const puede = (modulo, accion) => {
        if (!mockEstadoAuth.usuario) return false;
        if (mockEstadoAuth.permisos.includes('*')) return true;
        return mockEstadoAuth.permisos.includes(accion ? `${modulo}:${accion}` : modulo);
    };
    return {
        useAuth: () => ({
            usuario: mockEstadoAuth.usuario,
            permisos: mockEstadoAuth.permisos,
            logout: () => {},
            esSuperadmin: mockEstadoAuth.usuario?.rol === 'superadministrador',
            puede,
            puedeAlguno: (...claves) => claves.flat().some(c => puede(c)),
            empresa: mockEstadoAuth.empresa,
            soporte: mockEstadoAuth.soporte,
            terminarSoporte: () => {},
        }),
    };
});

// eslint-disable-next-line import/first
import Layout from './Layout';

beforeAll(() => {
    window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
});

function renderLayout() {
    return render(
        <MemoryRouter initialEntries={['/dashboard']}>
            <Routes>
                <Route path="/dashboard" element={<Layout />}>
                    <Route index element={<div>inicio</div>} />
                </Route>
            </Routes>
        </MemoryRouter>
    );
}

const menu = () => within(screen.getByRole('navigation'));

describe('Layout — menú lateral según permisos', () => {
    afterEach(() => {
        mockEstadoAuth.usuario = null; mockEstadoAuth.permisos = []; mockLlamadas.length = 0;
        mockEstadoAuth.empresa = null; mockEstadoAuth.soporte = null;
    });

    test('el superadministrador en su empresa ve todos los modulos, su empresa y la plataforma', () => {
        mockEstadoAuth.usuario = { id: 1, nombre: 'Dueño', rol: 'superadministrador' };
        mockEstadoAuth.permisos = ['*'];
        mockEstadoAuth.empresa = { id: 1, nombre: 'SS SWAP', slug: 'ss-swap' };
        renderLayout();
        for (const g of ['Panel', 'Inventario', 'Taller', 'Clientes', 'Proveedores', 'Finanzas', 'Gráficas', 'Ajustes', 'Mi empresa', 'Plataforma']) {
            expect(menu().getByText(g)).toBeInTheDocument();
        }
        expect(screen.getByText('SUPERADMIN')).toBeInTheDocument();
        expect(screen.getByTitle('Empresa en la que estas trabajando')).toHaveTextContent('SS SWAP'); // empresa de la sesion
    });

    test('Sprint 22: el superadministrador global (sin empresa) solo ve la plataforma', () => {
        mockEstadoAuth.usuario = { id: 1, nombre: 'Plataforma', rol: 'superadministrador' };
        mockEstadoAuth.permisos = [];
        renderLayout();
        expect(menu().getByText('Plataforma')).toBeInTheDocument();
        for (const g of ['Inventario', 'Taller', 'Clientes', 'Finanzas', 'Mi empresa']) {
            expect(menu().queryByText(g)).not.toBeInTheDocument();
        }
        expect(screen.getByText('PLATAFORMA')).toBeInTheDocument();
    });

    test('Sprint 22: el administrador de una empresa gestiona su empresa pero nunca ve la plataforma', () => {
        mockEstadoAuth.usuario = { id: 2, nombre: 'Admin Norte', rol: 'administrador' };
        mockEstadoAuth.permisos = ['usuarios:ver', 'auditoria:ver', 'empresa:ver', 'clientes:ver'];
        mockEstadoAuth.empresa = { id: 5, nombre: 'Taller Norte', slug: 'taller-norte' };
        renderLayout();
        expect(menu().getByText('Mi empresa')).toBeInTheDocument();
        expect(menu().queryByText('Plataforma')).not.toBeInTheDocument();
        expect(screen.getByText('TALLER NORTE')).toBeInTheDocument();
    });

    test('Sprint 22: en modo soporte se ve un aviso con el motivo y el boton para terminar', () => {
        mockEstadoAuth.usuario = { id: 1, nombre: 'Plataforma', rol: 'superadministrador' };
        mockEstadoAuth.permisos = ['clientes:ver'];
        mockEstadoAuth.empresa = { id: 5, nombre: 'Taller Norte', slug: 'taller-norte' };
        mockEstadoAuth.soporte = { modo: 'lectura', motivo: 'Revisar descuadre de inventario', expira: new Date(Date.now() + 3600e3).toISOString() };
        renderLayout();
        expect(screen.getByRole('status')).toHaveTextContent(/MODO SOPORTE · SOLO LECTURA/);
        expect(screen.getByRole('status')).toHaveTextContent(/Revisar descuadre de inventario/);
        expect(screen.getByRole('button', { name: 'TERMINAR SOPORTE' })).toBeInTheDocument();
    });

    test('permisos parciales: solo inventario de colisiones y sus registros', () => {
        mockEstadoAuth.usuario = { id: 5, nombre: 'Bodega', rol: 'interno' };
        mockEstadoAuth.permisos = ['inventario_colisiones:ver', 'registros_inventario:ver', 'registros_inventario:crear'];
        renderLayout();
        expect(menu().getByText('Inventario')).toBeInTheDocument();
        expect(menu().getByText('Colisiones / Pintura')).toBeInTheDocument();
        expect(menu().getByText('Registrar movimiento')).toBeInTheDocument();
        expect(menu().queryByText('Inventario Mecánica')).not.toBeInTheDocument();
        for (const g of ['Taller', 'Clientes', 'Proveedores', 'Finanzas', 'Gráficas', 'Ajustes', 'Usuarios y permisos']) {
            expect(menu().queryByText(g)).not.toBeInTheDocument();
        }
        // No consulta datos de modulos que no puede ver (insignias del menu).
        const rutas = [...mockLlamadas];
        expect(rutas.some(r => r.startsWith('/cuentas-cobrar'))).toBe(false);
        expect(rutas.some(r => r.startsWith('/proveedores'))).toBe(false);
        expect(rutas.some(r => r.startsWith('/inventory/repuestos'))).toBe(false);
    });

    test('un administrador comun no ve la gestion de usuarios aunque tenga muchos permisos', () => {
        mockEstadoAuth.usuario = { id: 2, nombre: 'Admin', rol: 'administrador' };
        mockEstadoAuth.permisos = ['clientes:ver', 'finanzas:ver', 'ordenes:ver'];
        renderLayout();
        expect(menu().getByText('Clientes')).toBeInTheDocument();
        expect(menu().getByText('Finanzas')).toBeInTheDocument();
        expect(menu().queryByText('Usuarios y permisos')).not.toBeInTheDocument();
    });

    test('sin permisos solo aparece el Panel', () => {
        mockEstadoAuth.usuario = { id: 6, nombre: 'Nuevo', rol: 'interno' };
        renderLayout();
        expect(menu().getByText('Panel')).toBeInTheDocument();
        expect(menu().queryByText('Inventario')).not.toBeInTheDocument();
        expect(screen.getByText('PERSONAL')).toBeInTheDocument();
    });
});
