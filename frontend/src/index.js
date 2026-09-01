/**
 * SS SWAP - Punto de Entrada de la Aplicación React
 * Monta <App /> en #root con StrictMode activado.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Obtiene el elemento HTML donde se montara la aplicacion de React.
const root = ReactDOM.createRoot(document.getElementById('root'));

// StrictMode ayuda a detectar problemas potenciales durante el desarrollo.
root.render(<React.StrictMode><App /></React.StrictMode>);
