import axios from 'axios';

const api = axios.create({
    baseURL: process.env.REACT_APP_API_URL || '/api',
    headers: { 'Content-Type': 'application/json' },
});

// Interceptor: adjunta el JWT en cada petición
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('sswap_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Interceptor: redirige al login si el token expira
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('sswap_token');
            localStorage.removeItem('sswap_usuario');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;
