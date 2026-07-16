import React from 'react';
import AuthPage from './AuthPage';

// Reutiliza exactamente la misma experiencia visual del acceso de clientes,
// restringiendo el inicio de sesion al personal del taller.
export default function AdminLogin() {
    return <AuthPage staffOnly />;
}
