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
            localStorage.removeItem('SS SWAP_token');
            localStorage.removeItem('SS SWAP_usuario');
            if (!window.location.pathname.startsWith('/auth')) {
                window.location.href = '/auth?sesion=expirada';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
