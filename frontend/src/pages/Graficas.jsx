/**
 * SS SWAP - Seccion Graficas (panel admin)
 */
import React from 'react';
import useParamUrl from '../hooks/useParamUrl';
import { useTheme } from '../context/ThemeContext';
import ProductosTab from '../components/graficas/ProductosTab';
import ServiciosTab from '../components/graficas/ServiciosTab';
import CrecimientoTab from '../components/graficas/CrecimientoTab';
import ProformasTab from '../components/graficas/ProformasTab';
import './Proveedores.css';
import './Graficas.css';

const TABS = [
    { id: 'productos', label: 'PRODUCTOS MÁS VENDIDOS' },
    { id: 'servicios', label: 'SERVICIOS MÁS SOLICITADOS' },
    { id: 'proformas', label: 'PROFORMAS (PRODUCTOS Y SERVICIOS)' },
    { id: 'crecimiento', label: 'CRECIMIENTO' },
];

export default function Graficas() {
    const { isDark } = useTheme();
    const [tab, setTab] = useParamUrl('tab', 'productos', TABS.map(t => t.id));

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.05)';
    const txt   = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf = isDark ? '#cbd5e1' : '#334155';
    const mut   = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr   = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.07)';
    const card  = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const cardSh = isDark
        ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)'
        : '0 4px 16px -4px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04)';

    const theme = { isDark, txt, txtSf, mut, bdr, card, cardSh, SKY, SKY_DEEP, SKY_PALE };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1400, '--graf-bdr': bdr, '--graf-mut': mut, '--graf-sky': SKY_DEEP }}>
            <div style={{ marginBottom: 20 }}>
                <div className="SS SWAP-chip" style={{ marginBottom: 8 }}>
                    <span className="dot" />
                    <span>SS SWAP · ADMIN · GRÁFICAS</span>
                </div>
                <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Gráficas</h1>
                <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                    Estadísticas del negocio a partir de datos reales del sistema
                </p>
            </div>

            <div className="graf-tabs">
                {TABS.map(t => (
                    <button key={t.id} className={`graf-tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'productos' && <ProductosTab theme={theme} />}
            {tab === 'servicios' && <ServiciosTab theme={theme} />}
            {tab === 'proformas' && <ProformasTab theme={theme} />}
            {tab === 'crecimiento' && <CrecimientoTab theme={theme} />}
        </div>
    );
}
