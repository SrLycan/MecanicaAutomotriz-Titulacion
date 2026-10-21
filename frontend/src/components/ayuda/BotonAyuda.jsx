/**
 * SS SWAP - Botón "?" de ayuda contextual (Sprint 27)
 * Se ubica en el encabezado del panel, junto al nombre de la sección, y abre
 * la guía que corresponde a la ruta y pestaña actuales. También se abre con
 * la tecla "?" (fuera de los campos de texto).
 */
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useLocation } from 'react-router-dom';
import { GUIAS } from '../../ayuda/guias';
import { guiaParaUbicacion } from '../../ayuda/resolver';

const PanelAyuda = lazy(() => import('./PanelAyuda'));

export default function BotonAyuda({ color, borde }) {
    const location = useLocation();
    const guia = guiaParaUbicacion(GUIAS, location.pathname, location.search);
    const [abierta, setAbierta] = useState(false);

    // Al cambiar de sección se cierra la guía anterior.
    useEffect(() => { setAbierta(false); }, [location.pathname, location.search]);
    useEffect(() => {
        const tecla = (e) => {
            const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
            if (e.key === '?' && !enCampo && guia) { e.preventDefault(); setAbierta(true); }
        };
        window.addEventListener('keydown', tecla);
        return () => window.removeEventListener('keydown', tecla);
    }, [guia]);

    if (!guia) return null;
    return (
        <>
            <button type="button" className="boton-ayuda" onClick={() => setAbierta(true)}
                aria-label={`Ayuda: cómo usar ${guia.titulo}`} title={`Ayuda: ${guia.titulo} (tecla ?)`}
                style={{ color, borderColor: borde }}>
                ?
            </button>
            {abierta && (
                <Suspense fallback={null}>
                    <PanelAyuda guia={guia} onClose={() => setAbierta(false)} />
                </Suspense>
            )}
        </>
    );
}
