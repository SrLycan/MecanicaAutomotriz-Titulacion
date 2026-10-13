/**
 * SS SWAP - Seccion Proveedores (panel admin)
 * Agrupa Proveedores, Gastos, Compras e Historial financiero en tabs,
 * con un resumen financiero arriba. Mismo estilo visual (paleta SKY,
 * tipografia Bebas Neue / Outfit) que Sucursales/Servicios/Clientes.
 */
import React, { useState, useEffect, useCallback } from 'react';
import useParamUrl from '../hooks/useParamUrl';
import toast from 'react-hot-toast';
import { useTemaPanel } from '../components/finanzas/tema';
import api from '../services/api';
import ProveedoresTab from '../components/proveedores/ProveedoresTab';
import GastosTab from '../components/proveedores/GastosTab';
import ComprasTab, { textoVencimiento } from '../components/proveedores/ComprasTab';
import HistorialTab from '../components/proveedores/HistorialTab';
import './Proveedores.css';

import { NombreEmpresa } from '../components/common/MarcaEmpresa';
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

/** Aviso de compras a credito que vencen en 3 dias o menos (o ya vencidas). */
function AvisoCreditos({ alertas, onVer }) {
    if (!alertas.length) return null;
    const vencidas = alertas.filter(a => Number(a.dias_para_vencer) < 0).length;
    const color = vencidas ? '#ef4444' : '#f59e0b';
    const totalSaldo = alertas.reduce((s, a) => s + Number(a.saldo), 0);
    return (
        <div role="alert" style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', background: `${color}14`, border: `1px solid ${color}66`, borderLeft: `4px solid ${color}`, borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            <div style={{ flex: 1, minWidth: 220 }}>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1rem', letterSpacing: '.06em', color }}>
                    {alertas.length} compra{alertas.length !== 1 ? 's' : ''} a crédito por pagar · ${totalSaldo.toFixed(2)}
                </p>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontFamily: "'Outfit'", fontSize: '.84rem', color: 'inherit' }}>
                    {alertas.slice(0, 6).map(a => (
                        <li key={a.id}>
                            <strong>#{a.id} {a.proveedor_nombre}</strong> — saldo ${Number(a.saldo).toFixed(2)} · <span style={{ color: Number(a.dias_para_vencer) < 0 ? '#ef4444' : undefined, fontWeight: 600 }}>{textoVencimiento(a.dias_para_vencer)}</span>
                        </li>
                    ))}
                    {alertas.length > 6 && <li>y {alertas.length - 6} más…</li>}
                </ul>
            </div>
            <button onClick={onVer} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: color, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 14px', cursor: 'pointer', alignSelf: 'center' }}>VER COMPRAS</button>
        </div>
    );
}

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
    const theme = useTemaPanel();
    const { txt, mut, bdr, card, SKY, SKY_DEEP } = theme;
    const [tab, setTab] = useParamUrl('tab', 'proveedores', TABS.map(t => t.id));
    const [periodo, setPeriodo] = useState('todo');
    const [resumen, setResumen] = useState(null);
    const [proveedores, setProveedores] = useState([]);
    const [loadingProv, setLoadingProv] = useState(true);
    const [busqueda, setBusqueda] = useState('');
    const [alertas, setAlertas] = useState([]);

    const cargarAlertas = useCallback(async () => {
        try {
            const { data } = await api.get('/proveedores/compras/alertas-credito');
            setAlertas(data.alertas || []);
        } catch (err) { /* silencioso: el aviso es informativo */ }
    }, []);
    useEffect(() => { cargarAlertas(); }, [cargarAlertas, tab]);


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
                        <span><NombreEmpresa /> · ADMIN · PROVEEDORES</span>
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

            <AvisoCreditos alertas={alertas} onVer={() => setTab('compras')} />

            {/* Datos anteriores a la correccion: pagos que siguen vigentes en compras ya canceladas. */}
            {resumen?.pagos_en_compras_canceladas?.cantidad > 0 && (
                <div role="alert" style={{ background: '#ef444414', border: '1px solid #ef444466', borderLeft: '4px solid #ef4444', borderRadius: 12, padding: '14px 16px', marginBottom: 20, fontFamily: "'Outfit'", fontSize: '.86rem', color: txt }}>
                    <strong style={{ color: '#ef4444' }}>Revisar: {resumen.pagos_en_compras_canceladas.cantidad} pago(s) por ${Number(resumen.pagos_en_compras_canceladas.total).toFixed(2)} siguen confirmados en compras canceladas.</strong>{' '}
                    Ese dinero figura como pagado sin una compra vigente (por eso “Total pagado” supera a “Total comprado”). Si el proveedor lo devolvió o el pago fue un error,
                    anúlalo en <button onClick={() => setTab('historial')} style={{ background: 'none', border: 'none', padding: 0, color: SKY_DEEP, cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}>Historial financiero</button>.
                    Si el pago fue real y el proveedor no lo devolvió, déjalo como está.
                </div>
            )}

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
            {tab === 'compras' && <ComprasTab theme={theme} proveedores={proveedores} onCambio={() => { cargarAlertas(); cargarResumen(); }} />}
            {tab === 'historial' && <HistorialTab theme={theme} proveedores={proveedores} onCambio={() => { cargarAlertas(); cargarResumen(); }} />}
        </div>
    );
}
