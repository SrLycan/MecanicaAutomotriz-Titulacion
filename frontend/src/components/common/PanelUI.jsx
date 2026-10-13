/**
 * SS SWAP - Piezas visuales compartidas del panel (paleta, botones, modal,
 * píldoras y tarjetas). Mismo estilo que Usuarios, Clientes o Finanzas; se
 * reutilizan en las páginas de empresa y de la plataforma.
 */
import React from 'react';
import { useTheme } from '../../context/ThemeContext';

function IconX()       { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }

/** Paleta compartida (misma que el resto del panel). */
export function usePaleta() {
    const { isDark } = useTheme();
    const SKY = '#0ea5e9';
    const SKY_DEEP = '#0284c7';
    return {
        isDark, SKY, SKY_DEEP,
        SKY_PALE: isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.12)',
        SKY_BDR: isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.35)',
        txt: isDark ? '#f1f5f9' : '#0f172a',
        txtSf: isDark ? '#cbd5e1' : '#334155',
        mut: isDark ? 'rgba(241,245,249,0.72)' : '#526075',
        faint: isDark ? 'rgba(241,245,249,0.56)' : '#5f6b7d',
        bdr: isDark ? 'rgba(148,163,184,0.28)' : '#b6c3d3',
        card: isDark ? 'rgba(255,255,255,0.045)' : '#ffffff',
        cardSh: isDark
            ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)'
            : '0 1px 2px rgba(15,23,42,0.06), 0 8px 22px -8px rgba(15,23,42,0.20)',
        inputBg: isDark ? '#0b1220' : '#fafcff',
        boxBg: isDark ? '#111826' : '#ffffff',
    };
}

export const bebas = (size, ls = '.14em') => ({ fontFamily: "'Bebas Neue'", fontSize: size, letterSpacing: ls });
export const outfit = (size, weight = 400) => ({ fontFamily: "'Outfit'", fontSize: size, fontWeight: weight });

export function Pildora({ color, children, title }) {
    return (
        <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: color + '14', border: `1px solid ${color}40`, color, ...bebas('.72rem'), whiteSpace: 'nowrap' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: color }} />{children}
        </span>
    );
}

export function BotonPrimario({ children, onClick, type = 'button', disabled, color }) {
    const p = usePaleta();
    const fondo = color ? `linear-gradient(135deg, ${color}, ${color}cc)` : `linear-gradient(135deg, ${p.SKY_DEEP}, ${p.SKY})`;
    return (
        <button type={type} onClick={onClick} disabled={disabled}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...bebas('.78rem'), color: '#fff', background: fondo, border: 'none', borderRadius: 11, padding: '10px 20px', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .6 : 1, boxShadow: `0 6px 18px -6px ${color || p.SKY}` }}>
            {children}
        </button>
    );
}

export function BotonSecundario({ children, onClick, color, disabled, title }) {
    const p = usePaleta();
    const c = color || p.mut;
    return (
        <button type="button" onClick={onClick} disabled={disabled} title={title}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...bebas('.76rem'), background: 'none', border: `1px solid ${color ? color + '55' : p.bdr}`, borderRadius: 10, padding: '8px 14px', cursor: disabled ? 'not-allowed' : 'pointer', color: c, opacity: disabled ? .55 : 1 }}>
            {children}
        </button>
    );
}

export function Modal({ titulo, subtitulo, etiqueta = 'EMPRESA · USUARIOS', onClose, ancho = 540, color, children }) {
    const p = usePaleta();
    const c = color || p.SKY_DEEP;
    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" role="dialog" aria-modal="true" aria-label={titulo}
                style={{ maxWidth: ancho, width: '100%', background: p.boxBg, border: `1px solid ${p.bdr}`, padding: 26, maxHeight: '92vh', overflowY: 'auto' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${c}, ${p.SKY}, ${c}, transparent)`, borderRadius: '20px 20px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 12 }}>
                    <div>
                        <p style={{ ...bebas('.7rem', '.24em'), color: c, marginBottom: 6 }}>{etiqueta}</p>
                        <h2 style={{ ...bebas('1.7rem', '.04em'), color: p.txt }}>{titulo}</h2>
                        {subtitulo && <p style={{ ...outfit('.8rem', 400), color: p.mut, marginTop: 4 }}>{subtitulo}</p>}
                    </div>
                    <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: `1px solid ${p.bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: p.mut, display: 'flex' }}><IconX /></button>
                </div>
                {children}
            </div>
        </div>
    );
}


export function KpiCard({ label, value, color }) {
    const p = usePaleta();
    return (
        <div className="u-kpi" style={{ padding: 18, background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, position: 'relative', overflow: 'hidden', boxShadow: p.cardSh }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: `linear-gradient(180deg, ${color}, transparent)` }} />
            <p style={{ ...bebas('.7rem', '.22em'), color: p.mut }}>{label.toUpperCase()}</p>
            <p style={{ ...bebas('1.9rem', '.02em'), color, lineHeight: 1, marginTop: 6 }}>{value}</p>
        </div>
    );
}
