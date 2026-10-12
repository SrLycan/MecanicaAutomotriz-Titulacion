/**
 * SS SWAP - Lector de un documento legal (modal)
 *
 * El texto se muestra como TEXTO (white-space: pre-wrap), nunca como HTML:
 * un documento no puede inyectar scripts. Se puede descargar tal cual, con su
 * versión y su huella SHA-256 para comprobar que es el mismo que se aceptó.
 */
import React from 'react';
import { Modal, BotonSecundario, usePaleta, outfit } from '../common/PanelUI';

export function descargarTexto(doc) {
    const encabezado = `${doc.titulo}\nVersión ${doc.version}${doc.vigente_desde ? ` · vigente desde ${String(doc.vigente_desde).slice(0, 10)}` : ''}\nSHA-256: ${doc.hash || doc.hash_contenido || ''}\n\n`;
    const blob = new Blob([encabezado + doc.contenido], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.titulo.replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 60)}-v${doc.version}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
}

export default function LectorDocumento({ doc, onClose, etiqueta = 'DOCUMENTO LEGAL' }) {
    const p = usePaleta();
    if (!doc) return null;
    return (
        <Modal titulo={doc.titulo} etiqueta={etiqueta} ancho={820} onClose={onClose}
            subtitulo={`Versión ${doc.version}${doc.vigente_desde ? ` · vigente desde ${String(doc.vigente_desde).slice(0, 10)}` : ' · borrador'}`}>
            <div tabIndex={0} aria-label="Texto del documento" style={{ maxHeight: '58vh', overflowY: 'auto', padding: 16, border: `1px solid ${p.bdr}`, borderRadius: 12, background: p.inputBg, whiteSpace: 'pre-wrap', ...outfit('.86rem'), color: p.txt, lineHeight: 1.55 }}>
                {doc.contenido}
            </div>
            {(doc.hash || doc.hash_contenido) && <p style={{ ...outfit('.72rem'), color: p.mut, marginTop: 8, wordBreak: 'break-all' }}>Huella SHA-256 del texto: {doc.hash || doc.hash_contenido}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <BotonSecundario onClick={() => descargarTexto(doc)}>DESCARGAR</BotonSecundario>
                <BotonSecundario onClick={onClose}>CERRAR</BotonSecundario>
            </div>
        </Modal>
    );
}
