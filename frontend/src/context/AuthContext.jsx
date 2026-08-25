/**
 * SS SWAP - Contexto Global de Autenticación (AuthContext)
 * Administra el estado de sesión, persistencia de tokens JWT en localStorage,
 * control de roles y sincronización ante actualizaciones de perfil.
 * El login exige indicar el panel ('cliente' o 'staff'), igual que el backend.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [usuario, setUsuario] = useState(() => {
        try { return JSON.parse(localStorage.getItem('SS SWAP_usuario')); }
        catch { return null; }
    });
    const [loading, setLoading] = useState(false);

    // 'panel' se envia al backend para que valide si el rol corresponde
    // al portal desde el que se inicia sesion (cliente vs personal).
    const login = useCallback(async (email, password, panel) => {
        setLoading(true);
        try {
            const { data } = await api.post('/auth/login', { email, password, panel });
            localStorage.setItem('SS SWAP_token',   data.token);
            localStorage.setItem('SS SWAP_usuario', JSON.stringify(data.usuario));
            setUsuario(data.usuario);
            return { ok: true, usuario: data.usuario };
        } catch (err) {
            return { ok: false, error: err.response?.data?.error || 'Error al iniciar sesion.' };
        } finally {
            setLoading(false);
        }
    }, []);

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
        setUsuario(null);
    }, []);

    const tieneRol = useCallback((...roles) => {
        return usuario && roles.includes(usuario.rol);
    }, [usuario]);

    // Sincroniza el estado si localStorage cambia (ej: tras registro directo)
    const syncFromStorage = useCallback(() => {
        try {
            const u = JSON.parse(localStorage.getItem('SS SWAP_usuario'));
            if (u) setUsuario(u);
        } catch {}
    }, []);

    return (
        <AuthContext.Provider value={{ usuario, loading, login, logout, tieneRol, syncFromStorage, actualizarSesion }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
    return ctx;
};
