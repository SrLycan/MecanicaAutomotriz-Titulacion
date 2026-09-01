/**
 * SS SWAP - Gestión de Citas del Taller (Panel Administrativo)
 * Lista y gestiona las solicitudes de cita recibidas desde el portal público.
 * Permite confirmar, completar o cancelar citas, con filtros por estado y orden.
 * El panel hace polling cada 30 segundos para detectar nuevas solicitudes en tiempo real.
 */
import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';

const ESTADOS = { pendiente: '#d97706', confirmada: '#0284c7', completada: '#059669', cancelada: '#dc2626' };
const NOMBRES = { pendiente: 'Pendiente', confirmada: 'Confirmada', completada: 'Completada', cancelada: 'Cancelada' };
const SKY = '#0ea5e9';
const SKY_DEEP = '#0284c7';

export default function Citas() {
    const { isDark } = useTheme();
    const [citas, setCitas] = useState([]);
    const [estado, setEstado] = useState('pendiente');
    const [orden, setOrden] = useState('fecha_asc');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [statsGlobal, setStatsGlobal] = useState({ total: 0, pendiente: 0, confirmada: 0, completada: 0, cancelada: 0 });
    const [cargando, setCargando] = useState(true);

    const bg = isDark ? '#0b1220' : '#fff';
    const text = isDark ? '#f1f5f9' : '#0f172a';
    const muted = isDark ? '#94a3b8' : '#64748b';
    const border = isDark ? '#223047' : '#e2e8f0';
    const card2 = isDark ? '#111c2e' : '#f8fafc';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.05)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.18)';

    const cargar = useCallback((estadoVal = estado, ordenVal = orden, p = 1) => {
        setCargando(true);
        api.get('/citas', { params: { estado: estadoVal, orden: ordenVal, page: p, limit: 50 } })
            .then(r => {
                setCitas(r.data.citas || []);
                setPage(r.data.page || p);
                setTotalPages(r.data.totalPages || 1);
                if (r.data.stats) {
                    setStatsGlobal(r.data.stats);
                }
            })
            .catch(() => toast.error('No se pudieron cargar las citas.'))
            .finally(() => setCargando(false));
    }, [estado, orden]);

    useEffect(() => {
        cargar(estado, orden, 1);
    }, [estado, orden]);

    useEffect(() => {
        const id = setInterval(() => cargar(estado, orden, page), 30000);
        return () => clearInterval(id);
    }, [estado, orden, page, cargar]);

    const cambiar = async (id, nuevo) => {
        try {
            await api.patch(`/citas/${id}/estado`, { estado: nuevo });
            toast.success(nuevo === 'confirmada' ? 'Cita confirmada. El cliente ya puede verla.' : 'Cita actualizada.');
            cargar(estado, orden, page);
        } catch (e) {
            toast.error(e.response?.data?.error || 'No se pudo actualizar la cita.');
        }
    };

    const handleCambiarEstado = (nuevoEstado) => {
        setEstado(nuevoEstado);
        setPage(1);
    };

    const handleCambiarOrden = (e) => {
        setOrden(e.target.value);
        setPage(1);
    };

    const kpis = [
        { val: 'todas',      label: 'Total',       n: statsGlobal.total,      color: SKY },
        { val: 'pendiente',  label: 'Pendientes',  n: statsGlobal.pendiente,  color: ESTADOS.pendiente },
        { val: 'confirmada', label: 'Confirmadas', n: statsGlobal.confirmada, color: ESTADOS.confirmada },
        { val: 'completada', label: 'Completadas', n: statsGlobal.completada, color: ESTADOS.completada },
        { val: 'cancelada',  label: 'Canceladas',  n: statsGlobal.cancelada,  color: ESTADOS.cancelada },
    ];

    return (
        <div className="appointments-page">
            <div className="appointments-hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: 16, marginBottom: 22, padding: '20px 22px', borderRadius: 18, background: isDark ? 'linear-gradient(135deg, #101b2c, #0b1220)' : 'linear-gradient(135deg, #eff8ff, #fff)', border: `1px solid ${border}` }}>
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <p style={{ color: '#3b7bab', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.16em' }}>AGENDA DE SERVICIOS</p>
                    <h1 style={{ color: text, margin: '5px 0', fontSize: 'clamp(1.35rem, 4vw, 1.8rem)' }}>Citas y solicitudes</h1>
                    <p style={{ color: muted, margin: 0, fontSize: '.86rem' }}>Gestiona la agenda y confirma solicitudes en pocos segundos.</p>
                </div>
                <button className="btn-ghost" onClick={() => cargar(estado, orden, page)} style={{ position: 'relative', zIndex: 1 }}>↻ Actualizar</button>
            </div>

            {/* KPIs — clic filtra la lista de abajo por ese estado */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
                {kpis.map(k => {
                    const activo = estado === k.val;
                    return (
                        <button key={k.val} onClick={() => handleCambiarEstado(k.val)} className="appointments-kpi"
                            style={{
                                textAlign: 'left', cursor: 'pointer', padding: 16,
                                background: activo ? `${k.color}14` : card2,
                                border: `1px solid ${activo ? k.color : border}`,
                                borderRadius: 14, position: 'relative', overflow: 'hidden',
                                transition: 'all .15s',
                            }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: `linear-gradient(180deg, ${k.color}, transparent)` }} />
                            <p style={{ fontSize: '.62rem', fontWeight: 800, letterSpacing: '.14em', color: muted, margin: 0, textTransform: 'uppercase' }}>{k.label}</p>
                            <p style={{ fontSize: '1.7rem', fontWeight: 800, color: k.color, margin: '4px 0 0', lineHeight: 1 }}>{k.n}</p>
                        </button>
                    );
                })}
            </div>

            <div className="appointments-toolbar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
                <select className="appointments-select" aria-label="Filtrar por estado" value={estado} onChange={e => handleCambiarEstado(e.target.value)} style={control(bg, text, border)}>
                    <option value="pendiente">Pendientes</option>
                    <option value="confirmada">Confirmadas</option>
                    <option value="completada">Completadas</option>
                    <option value="todas">Todas</option>
                    <option value="cancelada">Canceladas</option>
                </select>
                <select className="appointments-select" aria-label="Ordenar citas" value={orden} onChange={handleCambiarOrden} style={control(bg, text, border)}>
                    <option value="fecha_asc">Fecha de cita: próxima primero</option>
                    <option value="fecha_desc">Fecha de cita: más reciente primero</option>
                    <option value="registro_desc">Registro: más reciente primero</option>
                    <option value="registro_asc">Registro: más antiguo primero</option>
                </select>
            </div>

            {cargando ? (
                <p style={{ color: muted }}>Cargando agenda…</p>
            ) : citas.length === 0 ? (
                <div className="SS SWAP-card" style={card(bg, border)}>
                    <p style={{ color: muted, margin: 0 }}>No hay citas con este filtro.</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                    {citas.map((c, index) => (
                        <div key={c.id} className="appointments-card" style={{ ...card(bg, border), animationDelay: `${index * 45}ms` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
                                <div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <strong style={{ color: text }}>{c.servicio_nombre}</strong>
                                        <span className="appointments-status" style={{ color: ESTADOS[c.estado], fontWeight: 800, fontSize: '.72rem' }}>{NOMBRES[c.estado]}</span>
                                    </div>
                                    <p style={{ color: muted, margin: '6px 0 0', fontSize: '.85rem' }}>{c.cliente_nombre} {c.cliente_telefono ? `· ${c.cliente_telefono}` : ''}{c.placa ? ` · ${c.placa}` : ''}</p>
                                </div>
                                <div style={{ textAlign: 'right', color: text, fontSize: '.86rem' }}>
                                    {new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-EC')}<br/>
                                    <span style={{ color: '#3b7bab', fontWeight: 700 }}>{c.hora_inicio?.slice(0,5)} – {c.hora_fin?.slice(0,5)}</span>
                                </div>
                            </div>
                            <p style={{ color: muted, fontSize: '.8rem', margin: '12px 0 0' }}>{c.sucursal_nombre} · Registrada: {new Date(c.created_at).toLocaleString('es-EC')}</p>
                            {c.notas && <p style={{ color: muted, fontSize: '.8rem', fontStyle: 'italic', margin: '7px 0 0' }}>“{c.notas}”</p>}
                            {c.estado === 'pendiente' && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                                    <button className="appointments-action" onClick={() => cambiar(c.id, 'confirmada')} style={action('#059669')}>✓ Aceptar cita</button>
                                    <button className="appointments-action" onClick={() => cambiar(c.id, 'cancelada')} style={action('#dc2626')}>Cancelar</button>
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Paginación */}
                    {totalPages > 1 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 6, padding: '16px 18px',
                            background: card2, border: `1px solid ${border}`, borderRadius: 14,
                            marginTop: 6,
                        }}>
                            <PageBtn
                                disabled={page <= 1}
                                onClick={() => cargar(estado, orden, page - 1)}
                                bdr={border} txtSoft={text} mut={muted}
                                isDark={isDark} SKY={SKY} SKY_BDR={SKY_BDR} SKY_PALE={SKY_PALE}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </PageBtn>

                            {generarPaginas(page, totalPages).map((p, i) =>
                                p === '...' ? (
                                    <span key={`e${i}`} style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: muted, padding: '0 4px' }}>...</span>
                                ) : (
                                    <PageNumBtn
                                        key={p}
                                        active={p === page}
                                        onClick={() => cargar(estado, orden, p)}
                                        isDark={isDark} SKY={SKY} SKY_DEEP={SKY_DEEP} SKY_PALE={SKY_PALE} txt={text} mut={muted} bdr={border}
                                    >
                                        {p}
                                    </PageNumBtn>
                                )
                            )}

                            <PageBtn
                                disabled={page >= totalPages}
                                onClick={() => cargar(estado, orden, page + 1)}
                                bdr={border} txtSoft={text} mut={muted}
                                isDark={isDark} SKY={SKY} SKY_BDR={SKY_BDR} SKY_PALE={SKY_PALE}
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </PageBtn>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function generarPaginas(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    if (current <= 3) {
        for (let i = 1; i <= Math.min(5, total); i++) pages.push(i);
        if (total > 5) { pages.push('...'); pages.push(total); }
    } else if (current >= total - 2) {
        pages.push(1); pages.push('...');
        for (let i = Math.max(total - 4, 2); i <= total; i++) pages.push(i);
    } else {
        pages.push(1); pages.push('...');
        pages.push(current - 1); pages.push(current); pages.push(current + 1);
        pages.push('...'); pages.push(total);
    }
    return pages;
}

function PageBtn({ disabled, onClick, bdr, txtSoft, mut, isDark, SKY, SKY_BDR, SKY_PALE, children }) {
    return (
        <button disabled={disabled} onClick={onClick}
            style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 9,
                background: 'transparent', border: `1px solid ${bdr}`,
                color: disabled ? mut : txtSoft, cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.35 : 1,
                transition: 'all .18s',
            }}
            onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = SKY_BDR; e.currentTarget.style.color = SKY; e.currentTarget.style.background = SKY_PALE; } }}
            onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = bdr; e.currentTarget.style.color = txtSoft; e.currentTarget.style.background = 'transparent'; } }}>
            {children}
        </button>
    );
}

function PageNumBtn({ active, onClick, isDark, SKY, SKY_DEEP, SKY_PALE, txt, mut, bdr, children }) {
    return (
        <button onClick={onClick}
            style={{
                minWidth: 34, height: 34, borderRadius: 9,
                background: active ? `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})` : 'transparent',
                border: active ? 'none' : `1px solid ${bdr}`,
                color: active ? '#fff' : txt,
                fontFamily: "'Outfit'", fontWeight: active ? 700 : 500, fontSize: '.82rem',
                cursor: 'pointer', padding: '0 8px',
                boxShadow: active ? `0 4px 12px -4px ${SKY}` : 'none',
                transition: 'all .18s',
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = SKY + '55'; e.currentTarget.style.background = SKY_PALE; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = bdr; e.currentTarget.style.background = 'transparent'; } }}>
            {children}
        </button>
    );
}

const control = (bg, color, border) => ({ background: bg, color, border: `1px solid ${border}`, borderRadius: 8, padding: '9px 11px' });
const card = (background, border) => ({ background, border: `1px solid ${border}`, borderRadius: 12, padding: '17px 18px' });
const action = color => ({ border: 0, borderRadius: 7, padding: '8px 12px', background: color, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '.8rem' });

