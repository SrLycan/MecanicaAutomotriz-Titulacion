/**
 * SS SWAP - Pantalla de acceso denegado del panel
 * Se muestra cuando alguien del personal abre (por menú, enlace o URL
 * escrita a mano) una sección para la que no tiene permiso.
 */
import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function AccesoDenegado() {
    const { isDark } = useTheme();
    const { usuario } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const desde = location.state?.desde;

    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.72)' : '#526075';
    const bdr = isDark ? 'rgba(148,163,184,0.28)' : '#b6c3d3';
    const card = isDark ? 'rgba(255,255,255,0.045)' : '#ffffff';

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 620, margin: '6vh auto 0', textAlign: 'center' }}>
            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 20, padding: '40px 32px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #ef4444, #f59e0b, #ef4444, transparent)' }} />
                <div style={{ width: 72, height: 72, borderRadius: 20, margin: '0 auto 18px', background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.24em', color: '#ef4444' }}>ERROR 403</p>
                <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.4rem', letterSpacing: '.04em', color: txt, lineHeight: 1.1, marginTop: 6 }}>Acceso denegado</h1>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.95rem', color: mut, marginTop: 12, lineHeight: 1.6 }}>
                    {usuario?.nombre ? `${usuario.nombre}, tu` : 'Tu'} cuenta no tiene permiso para abrir esta sección
                    {desde ? <> (<code style={{ fontSize: '.85rem' }}>{desde}</code>)</> : null}.
                    Si la necesitas para tu trabajo, pide al superadministrador que te la habilite.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
                    <button onClick={() => navigate(-1)} style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>VOLVER</button>
                    <Link to="/dashboard" style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: 'linear-gradient(135deg, #0284c7, #0ea5e9)', borderRadius: 10, padding: '10px 22px', textDecoration: 'none' }}>IR AL INICIO DEL PANEL</Link>
                </div>
            </div>
        </div>
    );
}
