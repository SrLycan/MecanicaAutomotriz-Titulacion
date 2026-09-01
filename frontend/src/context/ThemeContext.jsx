/**
 * SS SWAP - Contexto Global de Tema Visual (ThemeContext)
 * Controla el modo oscuro (dark) y claro (light) con persistencia en localStorage.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
    const [isDark, setIsDark] = useState(() => {
        return localStorage.getItem('SS SWAP_theme') !== 'light';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        localStorage.setItem('SS SWAP_theme', isDark ? 'dark' : 'light');
    }, [isDark]);

    const toggle = () => setIsDark(d => !d);

    return (
        <ThemeContext.Provider value={{ isDark, toggle }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme debe usarse dentro de ThemeProvider');
    return ctx;
};
