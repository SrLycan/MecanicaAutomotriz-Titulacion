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
    const puede = (modulo, accion) => {
        const u = mockEstadoAuth.usuario;
        if (!u) return false;
        if (u.rol === 'superadministrador') return true;
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
    afterEach(() => { mockEstadoAuth.usuario = null; mockEstadoAuth.permisos = []; mockLlamadas.length = 0; });

    test('el superadministrador ve todos los modulos y la gestion de usuarios', () => {
        mockEstadoAuth.usuario = { id: 1, nombre: 'Dueño', rol: 'superadministrador' };
        renderLayout();
        for (const g of ['Panel', 'Inventario', 'Taller', 'Clientes', 'Proveedores', 'Finanzas', 'Gráficas', 'Ajustes', 'Usuarios y permisos']) {
            expect(menu().getByText(g)).toBeInTheDocument();
        }
        expect(screen.getByText('SUPERADMIN')).toBeInTheDocument();
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
