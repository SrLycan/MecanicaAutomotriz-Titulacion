/**
 * SS SWAP - Seccion Proveedores (panel admin)
 * Agrupa Proveedores, Gastos, Compras e Historial financiero en tabs,
 * con un resumen financiero arriba. Mismo estilo visual (paleta SKY,
 * tipografia Bebas Neue / Outfit) que Sucursales/Servicios/Clientes.
 */
import React, { useState, useEffect, useCallback } from 'react';
import useParamUrl from '../hooks/useParamUrl';
import toast from 'react-hot-toast';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import ProveedoresTab from '../components/proveedores/ProveedoresTab';
import GastosTab from '../components/proveedores/GastosTab';
import ComprasTab from '../components/proveedores/ComprasTab';
import HistorialTab from '../components/proveedores/HistorialTab';
import './Proveedores.css';

const TABS = [
    { id: 'proveedores', label: 'PROVEEDORES' },
    { id: 'gastos', label: 'GASTOS' },
    { id: 'compras', label: 'COMPRAS' },
    { id: 'historial', label: 'HISTORIAL FINANCIERO' },
];

const PERIODOS = [
    { id: 'todo', label: 'Todo' },
    { id: 'semana', label: 'Semana' },
    { id: 'mes', label: 'Mes' },
    { id: 'anio', label: 'Año' },
];

function ResumenCard({ label, value, color, theme }) {
    const { card, bdr, cardSh, mut, txt } = theme;
    return (
        <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '14px 16px', boxShadow: cardSh }}>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.56rem', letterSpacing: '.16em', color, marginBottom: 6 }}>{label}</p>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', color: txt, lineHeight: 1 }}>{value}</p>
        </div>
    );
}

export default function Proveedores() {
    const { isDark } = useTheme();
    const [tab, setTab] = useParamUrl('tab', 'proveedores', TABS.map(t => t.id));
    const [periodo, setPeriodo] = useState('todo');
    const [resumen, setResumen] = useState(null);
    const [proveedores, setProveedores] = useState([]);
    const [loadingProv, setLoadingProv] = useState(true);
    const [busqueda, setBusqueda] = useState('');

    // ── Paleta compartida (misma que Sucursales/Clientes) ──────
    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.05)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.18)';
    const txt   = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf = isDark ? '#cbd5e1' : '#334155';
    const mut   = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr   = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.07)';
    const card  = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';
    const inputBg = isDark ? '#0b1220' : '#f8fafc';
    const cardSh = isDark
        ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)'
        : '0 4px 16px -4px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04)';
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.88rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP };

    const theme = { isDark, txt, txtSf, mut, bdr, card, boxBg, inputBg, cardSh, inputSt, labelSt, SKY, SKY_DEEP, SKY_PALE, SKY_BDR };

    const cargarProveedores = useCallback(async (q = busqueda) => {
        setLoadingProv(true);
        try {
            const params = new URLSearchParams();
            if (q) params.set('q', q);
            params.set('limit', '200');
            const { data } = await api.get(`/proveedores/proveedores?${params}`);
            setProveedores(data.proveedores || []);
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cargar proveedores.'); }
        finally { setLoadingProv(false); }
    }, []);

    const cargarResumen = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (periodo !== 'todo') params.set('periodo', periodo);
            const { data } = await api.get(`/proveedores/resumen?${params}`);
            setResumen(data);
        } catch (err) { /* silencioso: el resumen es informativo */ }
    }, [periodo]);

    useEffect(() => { cargarProveedores(); }, [cargarProveedores]);
    useEffect(() => { cargarResumen(); }, [cargarResumen]);

    useEffect(() => {
        const t = setTimeout(() => cargarProveedores(busqueda), 300);
        return () => clearTimeout(t);
    }, [busqueda]);

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500, '--prov-bdr': bdr, '--prov-mut': mut, '--prov-sky': SKY_DEEP }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="ssswap-chip" style={{ marginBottom: 8 }}>
                        <span className="dot" />
                        <span>SS SWAP · ADMIN · PROVEEDORES</span>
                    </div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Proveedores</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                        Compras, gastos y relacion financiera con proveedores del taller
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 6, background: card, border: `1px solid ${bdr}`, borderRadius: 11, padding: 4 }}>
                    {PERIODOS.map(p => (
                        <button key={p.id} onClick={() => setPeriodo(p.id)}
                            style={{ fontFamily: "'Bebas Neue'", fontSize: '.68rem', letterSpacing: '.1em', padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: periodo === p.id ? `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})` : 'transparent', color: periodo === p.id ? '#fff' : mut }}>
                            {p.label.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Resumen financiero */}
            {resumen && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
                    <ResumenCard theme={theme} label="TOTAL COMPRADO" value={`$${Number(resumen.total_comprado).toFixed(2)}`} color={SKY_DEEP} />
                    <ResumenCard theme={theme} label="TOTAL PAGADO" value={`$${Number(resumen.total_pagado).toFixed(2)}`} color="#10b981" />
                    <ResumenCard theme={theme} label="PENDIENTE" value={`$${Number(resumen.total_pendiente).toFixed(2)}`} color="#f59e0b" />
                    <ResumenCard theme={theme} label="GASTOS" value={`$${Number(resumen.total_gastos).toFixed(2)}`} color="#ef4444" />
                    <ResumenCard theme={theme} label="N° COMPRAS" value={resumen.numero_compras} color={SKY_DEEP} />
                    <ResumenCard theme={theme} label="PROVEEDORES ACTIVOS" value={resumen.proveedores_activos} color="#8b5cf6" />
                </div>
            )}

            {/* Tabs */}
            <div className="prov-tabs">
                {TABS.map(t => (
                    <button key={t.id} className={`prov-tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'proveedores' && (
                <ProveedoresTab theme={theme} proveedores={proveedores} loading={loadingProv} cargarProveedores={cargarProveedores} busqueda={busqueda} setBusqueda={setBusqueda} />
            )}
            {tab === 'gastos' && <GastosTab theme={theme} proveedores={proveedores} />}
            {tab === 'compras' && <ComprasTab theme={theme} proveedores={proveedores} />}
            {tab === 'historial' && <HistorialTab theme={theme} proveedores={proveedores} />}
        </div>
    );
}
