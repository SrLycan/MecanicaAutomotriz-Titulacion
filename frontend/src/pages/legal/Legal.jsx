/**
 * SS SWAP - Documentos legales de la empresa (/dashboard/legal)
 * Términos y privacidad que aceptan los clientes del portal, con su evidencia.
 */
import React from 'react';
import { usePaleta, bebas, outfit } from '../../components/common/PanelUI';
import GestionDocumentos from '../../components/legal/GestionDocumentos';

export default function Legal() {
    const p = usePaleta();
    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1200 }}>
            <div style={{ marginBottom: 18 }}>
                <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>MI EMPRESA · LEGAL</span></div>
                <h1 style={{ ...bebas('2.5rem', '.04em'), color: p.txt, lineHeight: 1 }}>Documentos legales</h1>
                <p style={{ ...outfit('.85rem'), color: p.mut, marginTop: 6, maxWidth: 780 }}>
                    Términos, política de privacidad y autorizaciones que aceptan los clientes de su portal. Cada aceptación queda registrada con la versión exacta,
                    la huella del texto y la fecha del servidor, y se puede descargar como constancia.
                </p>
            </div>
            <GestionDocumentos ambito="empresa" />
        </div>
    );
}
