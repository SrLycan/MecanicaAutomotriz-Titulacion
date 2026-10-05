/**
 * SS SWAP - Listado de Proformas (/dashboard/proformas)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { useConfirm } from '../components/common/ConfirmDialog';
import Paginador from '../components/proveedores/Paginador';
import './Proformas.css';

function IconPlus()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconEye()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>; }
function IconEdit()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconCopy()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>; }
function IconDownload() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>; }
function IconFileSpread() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>; }
function IconTrash() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>; }

const ESTADOS = ['borrador', 'emitida', 'aprobada', 'rechazada', 'vencida', 'convertida'];
const ESTADO_COLOR = { borrador: '#64748b', emitida: '#0ea5e9', aprobada: '#10b981', rechazada: '#ef4444', vencida: '#f59e0b', convertida: '#8b5cf6' };
const TIPO_LABEL = { mecanica: 'Mecánica', pintura: 'Colisiones / Pintura' };
const CARROCERIA_LABEL = { pickup: 'Pickup', hatchback: 'Hatchback', sedan: 'Sedán', suv: 'SUV' };

export default function Proformas() {
    const { usuario, tieneRol } = useAuth();
    const { isDark } = useTheme();
    const navigate = useNavigate();
    const confirm = useConfirm();
    const esAdmin = tieneRol('administrador');

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.05)';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf = isDark ? '#cbd5e1' : '#334155';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.07)';
    const card = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const inputBg = isDark ? '#0b1220' : '#f8fafc';
    const cardSh = isDark ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)' : '0 4px 16px -4px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04)';
    const theme = { txt, txtSf, mut, bdr, card };

    const [proformas, setProformas] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [pagina, setPagina] = useState(1);
    const POR_PAGINA = 15;
    const [filtros, setFiltros] = useState({ q: '', tipo: '', estado: '', fecha_inicio: '', fecha_fin: '' });

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
            params.set('page', String(pagina));
            params.set('limit', String(POR_PAGINA));
            const { data } = await api.get(`/proformas?${params}`);
            setProformas(data.proformas || []);
            setTotal(data.total || 0);
        } catch (err) { toast.error('Error al cargar proformas.'); }
        finally { setLoading(false); }
    }, [filtros, pagina]);

    useEffect(() => { setPagina(1); }, [filtros]);
    useEffect(() => { cargar(); }, [cargar]);

    const descargar = async (p, tipo) => {
        try {
            const { data } = await api.get(`/proformas/${p.id}/${tipo}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `${p.numero}.${tipo === 'pdf' ? 'pdf' : 'xlsx'}`;
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) { toast.error(`Error al generar el ${tipo === 'pdf' ? 'PDF' : 'Excel'}.`); }
    };

    const duplicar = async (p) => {
        try {
            const { data } = await api.post(`/proformas/${p.id}/duplicar`);
            toast.success(`Proforma duplicada como ${data.proforma.numero}.`);
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al duplicar.'); }
    };

    const cambiarEstado = async (p, estado) => {
        try {
            await api.patch(`/proformas/${p.id}/estado`, { estado });
            toast.success('Estado actualizado.');
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cambiar el estado.'); }
    };

    const eliminar = async (p) => {
        if (!(await confirm({ message: `Eliminar la proforma ${p.numero}? Esta accion no se puede deshacer.` }))) return;
        try {
            await api.delete(`/proformas/${p.id}`);
            toast.success('Proforma eliminada.');
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar.'); }
    };

    const filtroSel = { padding: '8px 10px', fontSize: '.8rem', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.2em', color: SKY_DEEP };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500, '--pf-bdr': bdr, '--pf-sky': SKY_DEEP }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="SS SWAP-chip" style={{ marginBottom: 8 }}>
                        <span className="dot" />
                        <span>SS SWAP · PROFORMAS</span>
                    </div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Proformas</h1>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, marginTop: 6 }}>Mecánica y Colisiones / Pintura — numeración automática</p>
                </div>
                <button onClick={() => navigate('/dashboard/proformas/nueva')}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Bebas Neue'", fontSize: '.8rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 11, padding: '12px 22px', cursor: 'pointer' }}>
                    <IconPlus /> NUEVA PROFORMA
                </button>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 18 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={labelSt}>BUSCAR</label>
                    <input value={filtros.q} onChange={e => setFiltros({ ...filtros, q: e.target.value })} placeholder="Número, cliente o placa..." style={{ ...filtroSel, width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div>
                    <label style={labelSt}>TIPO</label>
                    <select style={filtroSel} value={filtros.tipo} onChange={e => setFiltros({ ...filtros, tipo: e.target.value })}>
                        <option value="">Todos</option>
                        <option value="mecanica">Mecánica</option>
                        <option value="pintura">Colisiones / Pintura</option>
                    </select>
                </div>
                <div>
                    <label style={labelSt}>ESTADO</label>
                    <select style={filtroSel} value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value })}>
                        <option value="">Todos</option>
                        {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                </div>
                <div>
                    <label style={labelSt}>DESDE</label>
                    <input type="date" style={filtroSel} value={filtros.fecha_inicio} onChange={e => setFiltros({ ...filtros, fecha_inicio: e.target.value })} />
                </div>
                <div>
                    <label style={labelSt}>HASTA</label>
                    <input type="date" style={filtroSel} value={filtros.fecha_fin} onChange={e => setFiltros({ ...filtros, fecha_fin: e.target.value })} />
                </div>
            </div>

            <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginBottom: 12 }}>{total} proforma{total !== 1 ? 's' : ''}</p>

            {loading ? (
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando proformas...</p>
            ) : proformas.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>Sin proformas para estos filtros</p>
                </div>
            ) : (
                <div className="pf-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                    <table className="pf-table">
                        <thead>
                            <tr style={{ background: SKY_PALE }}>
                                {['Número', 'Fecha', 'Cliente', 'Vehículo', 'Tipo', 'Total', 'Estado', ''].map(h => (
                                    <th key={h} style={{ color: SKY_DEEP }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {proformas.map(p => (
                                <tr key={p.id} style={{ borderColor: bdr }}>
                                    <td style={{ color: txt, fontWeight: 700 }}>{p.numero}</td>
                                    <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{p.fecha_emision}</td>
                                    <td style={{ color: txt }}>{p.cliente_nombre}</td>
                                    <td style={{ color: txtSf }}>{[p.vehiculo_marca, p.vehiculo_modelo].filter(Boolean).join(' ')} {p.vehiculo_placa ? `· ${p.vehiculo_placa}` : ''}</td>
                                    <td style={{ color: txtSf }}>
                                        {TIPO_LABEL[p.tipo]}
                                        {p.carroceria_tipo && <span style={{ display: 'block', fontSize: '.72rem', color: mut }}>{CARROCERIA_LABEL[p.carroceria_tipo]}</span>}
                                        {p.inventario_descontado_at && <span className="pf-badge" style={{ marginTop: 3, background: 'rgba(16,185,129,0.10)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981' }}>INVENTARIO DESCONTADO</span>}
                                    </td>
                                    <td style={{ color: txt, fontWeight: 600 }}>${Number(p.total).toFixed(2)}</td>
                                    <td>
                                        <select value={p.estado} onChange={e => cambiarEstado(p, e.target.value)} disabled={p.estado === 'convertida'}
                                            className="pf-badge" style={{ background: `${ESTADO_COLOR[p.estado]}18`, border: `1px solid ${ESTADO_COLOR[p.estado]}44`, color: ESTADO_COLOR[p.estado], cursor: p.estado === 'convertida' ? 'default' : 'pointer' }}>
                                            {ESTADOS.map(e => <option key={e} value={e} disabled={e === 'convertida'}>{e.toUpperCase()}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                                            <Link to={`/dashboard/proformas/${p.id}`} className="pf-icon-btn" style={{ color: SKY_DEEP }} title="Ver"><IconEye /></Link>
                                            {p.estado !== 'convertida' && !p.inventario_descontado_at && (
                                                <Link to={`/dashboard/proformas/${p.id}/editar`} className="pf-icon-btn" style={{ color: SKY_DEEP }} title="Editar"><IconEdit /></Link>
                                            )}
                                            <button className="pf-icon-btn" style={{ color: SKY_DEEP }} title="Duplicar" onClick={() => duplicar(p)}><IconCopy /></button>
                                            <button className="pf-icon-btn" style={{ color: SKY_DEEP }} title="Descargar PDF" onClick={() => descargar(p, 'pdf')}><IconDownload /></button>
                                            <button className="pf-icon-btn" style={{ color: SKY_DEEP }} title="Descargar Excel" onClick={() => descargar(p, 'excel')}><IconFileSpread /></button>
                                            {esAdmin && p.estado !== 'convertida' && !p.inventario_descontado_at && (
                                                <button className="pf-icon-btn" style={{ color: '#ef4444' }} title="Eliminar" onClick={() => eliminar(p)}><IconTrash /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Paginador pagina={pagina} setPagina={setPagina} total={total} porPagina={POR_PAGINA} theme={theme} />
        </div>
    );
}
