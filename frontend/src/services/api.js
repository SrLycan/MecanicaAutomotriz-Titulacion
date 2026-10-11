/**
 * SS SWAP - Cliente HTTP Axios y Manejo de Sesión
 * Configura la URL base de la API, inyección automática del token JWT
 * en cabeceras e interceptor de respuestas para expiración de sesión.
 */
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || '/api';
// Origen (sin el sufijo /api) para construir URLs de archivos servidos por el backend (ej. fotos de perfil)
export const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

const api = axios.create({
    baseURL: API_BASE,
    headers: { 'Content-Type': 'application/json' },
});

// Interceptor: adjunta el JWT en cada petición
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('SS SWAP_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Interceptor: redirige al login SOLO si una peticion autenticada pierde su sesion.
// Importante: /auth/login y /auth/register tambien responden 401/409 cuando las
// credenciales son invalidas o el registro falla; eso NO es una sesion expirada,
// es un simple error de formulario y debe mostrarse en la propia pagina sin recargar.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const url          = error.config?.url || '';
        const esAuthPublico = url.includes('/auth/login') || url.includes('/auth/register');
        const teniaToken    = Boolean(error.config?.headers?.Authorization);

        if (error.response?.status === 401 && teniaToken && !esAuthPublico) {
            // Sesion vencida, revocada o cuenta desactivada: el personal vuelve a
            // su propio acceso (/admin/login) y los clientes al portal (/auth).
            const enPanel = window.location.pathname.startsWith('/dashboard');
            localStorage.removeItem('SS SWAP_token');
            localStorage.removeItem('SS SWAP_usuario');
            localStorage.removeItem('SS SWAP_permisos');
            const destino = enPanel ? '/admin/login' : '/auth';
            if (!window.location.pathname.startsWith(destino)) {
                window.location.href = `${destino}?sesion=expirada`;
            }
        }
        // Sin permiso: puede que el superadministrador acabe de revocarlo;
        // se pide al AuthContext que refresque los permisos (y el menu).
        if (error.response?.status === 403 && error.response?.data?.codigo === 'SIN_PERMISO') {
            window.dispatchEvent(new Event('ssswap:permisos-cambiaron'));
        }
        return Promise.reject(error);
    }
);

export default api;
