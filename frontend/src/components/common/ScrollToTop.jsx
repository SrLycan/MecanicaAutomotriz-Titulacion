/**
 * SS SWAP - Restauración Automática de Scroll
 * Restablece la posición vertical de la ventana al inicio (0, 0) tras cada navegación de ruta.
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export default function ScrollToTop() {
    const { pathname } = useLocation();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
}