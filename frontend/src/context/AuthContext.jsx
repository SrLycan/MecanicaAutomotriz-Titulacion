import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [usuario, setUsuario] = useState(() => {
        try { return JSON.parse(localStorage.getItem('sswap_usuario')); }
        catch { return null; }
    });
    const [loading, setLoading] = useState(false);

    const login = useCallback(async (email, password) => {
        setLoading(true);
        try {
            const { data } = await api.post('/auth/login', { email, password });
            localStorage.setItem('sswap_token',   data.token);
            localStorage.setItem('sswap_usuario', JSON.stringify(data.usuario));
            setUsuario(data.usuario);
            return { ok: true, usuario: data.usuario };
        } catch (err) {
            return { ok: false, error: err.response?.data?.error || 'Error al iniciar sesion.' };
        } finally {
            setLoading(false);
        }
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('sswap_token');
        localStorage.removeItem('sswap_usuario');
        setUsuario(null);
    }, []);

    const tieneRol = useCallback((...roles) => {
        return usuario && roles.includes(usuario.rol);
    }, [usuario]);

    // Sincroniza el estado si localStorage cambia (ej: tras registro directo)
    const syncFromStorage = useCallback(() => {
        try {
            const u = JSON.parse(localStorage.getItem('sswap_usuario'));
            if (u) setUsuario(u);
        } catch {}
    }, []);

    return (
        <AuthContext.Provider value={{ usuario, loading, login, logout, tieneRol, syncFromStorage }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
    return ctx;
};
