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
 *
 * Multiempresa: la sesión conoce su empresa (la decide el servidor) y, para
 * el superadministrador, si es de la plataforma y si está en modo soporte
 * dentro de otra empresa (la empresa de soporte se guarda en localStorage y
 * api.js la envía en la cabecera X-Soporte-Empresa; el servidor la valida
 * contra un acceso de soporte vigente).
 */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const ROL_SUPERADMIN = 'superadministrador';
export const ROLES_STAFF = [ROL_SUPERADMIN, 'administrador', 'tecnico', 'recepcionista', 'interno'];
export const EVENTO_PERMISOS = 'ssswap:permisos-cambiaron';
export const CLAVE_SOPORTE = 'SS SWAP_soporte';

const leer = (clave) => {
    try { return JSON.parse(localStorage.getItem(clave)); } catch { return null; }
};

export const AuthProvider = ({ children }) => {
    const [usuario, setUsuario] = useState(() => leer('SS SWAP_usuario'));
    const [permisos, setPermisos] = useState(() => leer('SS SWAP_permisos') || []);
    const [sesion, setSesion] = useState(() => leer('SS SWAP_sesion') || { empresa: null, plataforma: false, soporte: null });
    const [loading, setLoading] = useState(false);

    /** Empresa, plataforma y soporte de la sesion (lo que diga el servidor). */
    const guardarSesion = useCallback((datos) => {
        const valor = { empresa: datos?.empresa || null, plataforma: Boolean(datos?.plataforma), soporte: datos?.soporte || null };
        try { localStorage.setItem('SS SWAP_sesion', JSON.stringify(valor)); } catch { /* sin storage */ }
        setSesion(prev => (JSON.stringify(prev) === JSON.stringify(valor) ? prev : valor));
    }, []);

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
            localStorage.removeItem(CLAVE_SOPORTE);
            guardarPermisos(data.permisos);
            guardarSesion(data);
            setUsuario(data.usuario);
            return { ok: true, usuario: data.usuario, empresa: data.empresa, plataforma: data.plataforma };
        } catch (err) {
            return { ok: false, error: err.response?.data?.error || 'Error al iniciar sesion.' };
        } finally {
            setLoading(false);
        }
    }, [guardarPermisos, guardarSesion]);

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
        localStorage.removeItem('SS SWAP_sesion');
        localStorage.removeItem(CLAVE_SOPORTE);
        setUsuario(null);
        setPermisos([]);
        setSesion({ empresa: null, plataforma: false, soporte: null });
    }, []);

    const tieneRol = useCallback((...roles) => {
        return Boolean(usuario && roles.includes(usuario.rol));
    }, [usuario]);

    const esStaff = Boolean(usuario && ROLES_STAFF.includes(usuario.rol));
    const esSuperadmin = usuario?.rol === ROL_SUPERADMIN;

    /**
     * true si el usuario tiene el permiso 'modulo:accion' (o puede(modulo, accion)).
     * '*' = todos (superadministrador dentro de una empresa). Sin empresa, el
     * superadministrador recibe [] del servidor: solo ve la plataforma.
     */
    const puede = useCallback((modulo, accion) => {
        if (!usuario || !ROLES_STAFF.includes(usuario.rol)) return false;
        if (permisos.includes('*')) return true;
        const clave = accion ? `${modulo}:${accion}` : modulo;
        return permisos.includes(clave);
    }, [usuario, permisos]);

    /** Entra a otra empresa con un acceso de soporte vigente (lo valida el servidor). */
    const iniciarSoporte = useCallback((empresa) => {
        try { localStorage.setItem(CLAVE_SOPORTE, JSON.stringify({ id: empresa.id, nombre: empresa.nombre })); } catch { /* sin storage */ }
        window.location.href = '/dashboard';
    }, []);

    /** Sale del modo soporte y CIERRA el acceso en el servidor (no espera a que venza). */
    const terminarSoporte = useCallback(async () => {
        let empresaId = null;
        try { empresaId = JSON.parse(localStorage.getItem(CLAVE_SOPORTE))?.id ?? null; localStorage.removeItem(CLAVE_SOPORTE); } catch { /* sin storage */ }
        try {
            const { data } = await api.get('/plataforma/soporte');
            await Promise.all((data.accesos || []).filter(a => a.vigente && a.empresa_id === empresaId)
                .map(a => api.delete(`/plataforma/soporte/${a.id}`)));
        } catch { /* si falla, el acceso vence solo */ }
        window.location.href = '/dashboard/plataforma';
    }, []);

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
            guardarSesion(data);
            if (data.usuario) {
                localStorage.setItem('SS SWAP_usuario', JSON.stringify(data.usuario));
                setUsuario(prev => (prev && JSON.stringify(prev) === JSON.stringify(data.usuario) ? prev : data.usuario));
            }
        } catch { /* un 401 lo maneja el interceptor de api.js */ }
        finally { refrescando.current = false; }
    }, [guardarPermisos, guardarSesion]);

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
            empresa: sesion.empresa, plataforma: sesion.plataforma, soporte: sesion.soporte,
            iniciarSoporte, terminarSoporte,
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
