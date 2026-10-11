/**
 * SS SWAP - Contexto Global de Autenticación (AuthContext)
 * Administra el estado de sesión, persistencia de tokens JWT en localStorage,
 * control de roles y permisos, y sincronización ante actualizaciones de perfil.
 * El login exige indicar el panel ('cliente' o 'staff'), igual que el backend.
 *
 * Permisos: la lista que se guarda aquí SOLO decide qué se muestra (menú,
 * botones, rutas). La seguridad real está en el backend, que vuelve a leer
 * los permisos de la BD en cada petición; por eso editar localStorage no
 * concede nada. La lista se refresca desde /auth/me al cargar, cada minuto,
 * al volver a la pestaña y cuando el backend responde "sin permiso".
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const ROL_SUPERADMIN = 'superadministrador';
export const ROLES_STAFF = [ROL_SUPERADMIN, 'administrador', 'tecnico', 'recepcionista', 'interno'];
export const EVENTO_PERMISOS = 'ssswap:permisos-cambiaron';

const leer = (clave) => {
    try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; }
};

export const AuthProvider = ({ children }) => {
    const [usuario, setUsuario] = useState(() => leer('SS SWAP_usuario'));
    const [permisos, setPermisos] = useState(() => leer('SS SWAP_permisos') || []);
    const [loading, setLoading] = useState(false);

    const guardarPermisos = useCallback((lista) => {
        const valor = Array.isArray(lista) ? lista : [];
        try { localStorage.setItem('SS SWAP_permisos', JSON.stringify(valor)); } catch { /* sin storage */ }
        setPermisos(valor);
    }, []);

    // 'panel' se envia al backend para que valide si el rol corresponde
    // al portal desde el que se inicia sesion (cliente vs personal).
    const login = useCallback(async (email, password, panel) => {
        setLoading(true);
        try {
            const { data } = await api.post('/auth/login', { email, password, panel });
            localStorage.setItem('SS SWAP_token',   data.token);
            localStorage.setItem('SS SWAP_usuario', JSON.stringify(data.usuario));
            guardarPermisos(data.permisos);
            setUsuario(data.usuario);
            return { ok: true, usuario: data.usuario };
        } catch (err) {
            return { ok: false, error: err.response?.data?.error || 'Error al iniciar sesion.' };
        } finally {
            setLoading(false);
        }
    }, [guardarPermisos]);

    // Reemplaza token + usuario tras editar perfil, contrasena o foto (el backend
    // reemite un JWT fresco cada vez que cambian nombre, email o rol).
    const actualizarSesion = useCallback((token, usuario) => {
        if (token) localStorage.setItem('SS SWAP_token', token);
        if (usuario) {
            localStorage.setItem('SS SWAP_usuario', JSON.stringify(usuario));
            setUsuario(usuario);
        }
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('SS SWAP_token');
        localStorage.removeItem('SS SWAP_usuario');
        localStorage.removeItem('SS SWAP_permisos');
        setUsuario(null);
        setPermisos([]);
    }, []);

    const tieneRol = useCallback((...roles) => {
        return Boolean(usuario && roles.includes(usuario.rol));
    }, [usuario]);

    const esStaff = Boolean(usuario && ROLES_STAFF.includes(usuario.rol));
    const esSuperadmin = usuario?.rol === ROL_SUPERADMIN;

    /** true si el usuario tiene el permiso 'modulo:accion' (o puede(modulo, accion)). */
    const puede = useCallback((modulo, accion) => {
        if (!usuario || !ROLES_STAFF.includes(usuario.rol)) return false;
        if (usuario.rol === ROL_SUPERADMIN || permisos.includes('*')) return true;
        const clave = accion ? `${modulo}:${accion}` : modulo;
        return permisos.includes(clave);
    }, [usuario, permisos]);

    /** true si tiene al menos uno de los permisos ('modulo:accion'). */
    const puedeAlguno = useCallback((...claves) => claves.flat().some(c => puede(c)), [puede]);

    // Refresca usuario + permisos desde el servidor (fuente de verdad).
    const refrescando = useRef(false);
    const refrescarSesion = useCallback(async () => {
        if (refrescando.current || !localStorage.getItem('SS SWAP_token')) return;
        refrescando.current = true;
        try {
            const { data } = await api.get('/auth/me');
            guardarPermisos(data.permisos);
            if (data.usuario) {
                localStorage.setItem('SS SWAP_usuario', JSON.stringify(data.usuario));
                setUsuario(prev => (prev && JSON.stringify(prev) === JSON.stringify(data.usuario) ? prev : data.usuario));
            }
        } catch { /* un 401 lo maneja el interceptor de api.js */ }
        finally { refrescando.current = false; }
    }, [guardarPermisos]);

    useEffect(() => {
        if (!esStaff) return undefined;
        refrescarSesion();
        const intervalo = setInterval(refrescarSesion, 60000);
        const alVolver = () => { if (document.visibilityState === 'visible') refrescarSesion(); };
        document.addEventListener('visibilitychange', alVolver);
        window.addEventListener(EVENTO_PERMISOS, refrescarSesion);
        return () => {
            clearInterval(intervalo);
            document.removeEventListener('visibilitychange', alVolver);
            window.removeEventListener(EVENTO_PERMISOS, refrescarSesion);
        };
    }, [esStaff, refrescarSesion]);

    // Sincroniza el estado si localStorage cambia (ej: tras registro directo)
    const syncFromStorage = useCallback(() => {
        const u = leer('SS SWAP_usuario');
        if (u) setUsuario(u);
        setPermisos(leer('SS SWAP_permisos') || []);
    }, []);

    return (
        <AuthContext.Provider value={{
            usuario, permisos, loading, login, logout, tieneRol, syncFromStorage, actualizarSesion,
            esStaff, esSuperadmin, puede, puedeAlguno, refrescarSesion,
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
    return ctx;
};
