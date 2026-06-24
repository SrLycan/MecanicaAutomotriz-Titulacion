import React, { useState, useEffect } from 'react';
import Navbar from '../components/public/Navbar';
import Footer from '../components/public/Footer';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ── Icons ── */
function IconOrden()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>; }
function IconCar()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.5l2-3h7l2 3H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><circle cx="8" cy="15" r="2"/><circle cx="16" cy="15" r="2"/></svg>; }
function IconBox()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function IconEmpty()    { return <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>; }
function IconUser()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }

const GOLD = '#c9a227';

const ESTADO_LABELS = {
    pendiente:    { label: 'Pendiente',    color: '#f59e0b', bg: 'rgba(245,158,11,.12)', bdr: 'rgba(245,158,11,.25)' },
    en_progreso:  { label: 'En progreso',  color: '#38bdf8', bg: 'rgba(56,189,248,.12)', bdr: 'rgba(56,189,248,.25)' },
    completado:   { label: 'Completado',   color: '#10b981', bg: 'rgba(16,185,129,.12)', bdr: 'rgba(16,185,129,.25)' },
    cancelado:    { label: 'Cancelado',    color: '#ef4444', bg: 'rgba(239,68,68,.12)',  bdr: 'rgba(239,68,68,.25)'  },
};

const PROGRESO_LABELS = {
    en_revision:         'En revisión',
    deteccion_falla:     'Detección de falla',
    en_reparacion:       'En reparación',
    esperando_repuestos: 'Esperando repuestos',
    pruebas_finales:     'Pruebas finales',
    listo_entrega:       'Listo para entrega',
};

const TABS = [
    { id: 'ordenes',   label: 'Mis Órdenes',  icon: IconOrden },
    { id: 'vehiculos', label: 'Mis Vehículos', icon: IconCar   },
    { id: 'catalogo',  label: 'Catálogo',      icon: IconBox   },
];

export default function PanelCliente() {
    const { usuario } = useAuth();
    const [data, setData]     = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab]       = useState('ordenes');
    const [error, setError]   = useState(null);

    useEffect(() => {
        api.get('/panel/mi-actividad')
            .then(r => setData(r.data))
            .catch(err => setError(err.response?.data?.error || 'Error al cargar tu panel.'))
            .finally(() => setLoading(false));
    }, []);

    const txt  = 'rgba(241,245,249,1)';
    const mut  = 'rgba(241,245,249,.55)';
    const card = 'rgba(255,255,255,.04)';
    const bdr  = 'rgba(255,255,255,.08)';

    return (
        <div style={{ background: '#050505', minHeight: '100vh', color: '#fff' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700&display=swap');
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { background: #050505; }
                ::-webkit-scrollbar { width: 6px; }
                ::-webkit-scrollbar-track { background: #050505; }
                ::-webkit-scrollbar-thumb { background: rgba(201,162,39,.3); border-radius: 8px; }
                @keyframes fadeUp { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform:none; } }
                .pc-fade { animation: fadeUp .4s ease both; }
                .pc-tab { transition: color .2s, border-color .2s, background .2s; }
                .pc-tab:hover { color: #fff !important; }
                .pc-card { transition: border-color .25s, transform .25s; }
                .pc-card:hover { border-color: rgba(201,162,39,.35) !important; transform: translateY(-2px); }
            `}</style>

            <Navbar />

            <main style={{ maxWidth: 1100, margin: '0 auto', padding: '110px 24px 60px', minHeight: '100vh' }}>

                {/* Welcome header */}
                <div className="pc-fade" style={{ marginBottom: 36, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: `rgba(201,162,39,.12)`, border: `1px solid rgba(201,162,39,.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD }}>
                        <IconUser />
                    </div>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.3em', color: GOLD }}>MI PANEL</p>
                        <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(1.6rem,4vw,2.4rem)', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>
                            Hola, {usuario?.nombre?.split(' ')[0] || 'Cliente'}
                        </h1>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, marginTop: 4 }}>Monitorea tu actividad en SSWAP</p>
                    </div>
                </div>

                {/* Stats */}
                {data && (
                    <div className="pc-fade" style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap', animationDelay: '.1s' }}>
                        {[
                            { label: 'Órdenes',   val: data.ordenes?.length || 0,         color: '#38bdf8' },
                            { label: 'Vehículos', val: data.vehiculos?.length || 0,        color: GOLD       },
                            { label: 'En Progreso',val: data.ordenes?.filter(o => o.estado === 'en_progreso').length || 0, color: '#a78bfa' },
                            { label: 'Completadas',val: data.ordenes?.filter(o => o.estado === 'completado').length || 0,  color: '#10b981' },
                        ].map(s => (
                            <div key={s.label} style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '16px 22px', flex: '1 1 140px' }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.8rem', color: s.color, lineHeight: 1 }}>{s.val}</p>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut, marginTop: 4 }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Tabs */}
                <div className="pc-fade" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${bdr}`, marginBottom: 28, animationDelay: '.15s', overflowX: 'auto', paddingBottom: 0 }}>
                    {TABS.map(t => (
                        <button key={t.id} className="pc-tab" onClick={() => setTab(t.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', border: 'none', background: tab === t.id ? 'rgba(201,162,39,.1)' : 'none', borderBottom: `2px solid ${tab === t.id ? GOLD : 'transparent'}`, color: tab === t.id ? '#fff' : mut, fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem', cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: '8px 8px 0 0' }}>
                            <t.icon /> {t.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {loading && <div style={{ textAlign: 'center', padding: '60px 0', color: mut, fontFamily: "'Outfit'" }}>Cargando tu información…</div>}
                {error  && <div style={{ textAlign: 'center', padding: '60px 0', color: '#ef4444', fontFamily: "'Outfit'" }}>{error}</div>}

                {data && tab === 'ordenes' && (
                    <div className="pc-fade" style={{ animationDelay: '.2s' }}>
                        {!data.cliente ? (
                            <NoVinculo />
                        ) : data.ordenes.length === 0 ? (
                            <EmptyState msg="Aún no tienes órdenes de trabajo registradas." />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {data.ordenes.map((o, i) => {
                                    const est = ESTADO_LABELS[o.estado] || ESTADO_LABELS.pendiente;
                                    return (
                                        <div key={o.id} className="pc-card" style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '20px 22px', animationDelay: `${i * 50}ms` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.65rem', letterSpacing: '.2em', color: GOLD }}>ORDEN #{o.id}</p>
                                                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.14em', padding: '2px 8px', borderRadius: 999, background: est.bg, color: est.color, border: `1px solid ${est.bdr}` }}>{est.label}</span>
                                                        {o.estado_progreso && (
                                                            <span style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: '#a78bfa', background: 'rgba(167,139,250,.1)', padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(167,139,250,.2)' }}>
                                                                {PROGRESO_LABELS[o.estado_progreso] || o.estado_progreso}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {o.placa && (
                                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: txt }}>
                                                            🚗 {o.marca} {o.modelo} {o.anio} — <code style={{ background: 'rgba(255,255,255,.07)', padding: '1px 6px', borderRadius: 4, fontSize: '.8rem' }}>{o.placa}</code>
                                                        </p>
                                                    )}
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut }}>Ingreso</p>
                                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem', color: txt }}>{o.fecha_ingreso ? new Date(o.fecha_ingreso + 'T00:00:00').toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                                                </div>
                                            </div>
                                            <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, lineHeight: 1.6 }}>{o.descripcion}</p>
                                            {o.diagnostico && (
                                                <div style={{ marginTop: 10, background: 'rgba(56,189,248,.05)', border: '1px solid rgba(56,189,248,.15)', borderRadius: 8, padding: '10px 14px' }}>
                                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', fontWeight: 600, color: '#38bdf8', marginBottom: 4, letterSpacing: '.06em' }}>DIAGNÓSTICO</p>
                                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.84rem', color: txt }}>{o.diagnostico}</p>
                                                </div>
                                            )}
                                            {o.tecnico_nombre && (
                                                <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut, marginTop: 10 }}>Técnico asignado: <strong style={{ color: txt }}>{o.tecnico_nombre}</strong></p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {data && tab === 'vehiculos' && (
                    <div className="pc-fade" style={{ animationDelay: '.2s' }}>
                        {!data.cliente ? (
                            <NoVinculo />
                        ) : data.vehiculos.length === 0 ? (
                            <EmptyState msg="No tienes vehículos registrados en el sistema." />
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
                                {data.vehiculos.map((v, i) => (
                                    <div key={v.id} className="pc-card" style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '20px 22px', animationDelay: `${i * 50}ms` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                            <div style={{ width: 42, height: 42, borderRadius: 10, background: `rgba(201,162,39,.1)`, border: `1px solid rgba(201,162,39,.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD }}>
                                                <IconCar />
                                            </div>
                                            <div>
                                                <p style={{ fontFamily: "'Outfit'", fontWeight: 700, color: txt, fontSize: '.95rem' }}>{v.marca} {v.modelo}</p>
                                                <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut }}>{v.anio}{v.color ? ` · ${v.color}` : ''}</p>
                                            </div>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.1em', color: GOLD }}>{v.placa}</p>
                                            <p style={{ fontFamily: "'Outfit'", fontSize: '.7rem', color: mut }}>Placa</p>
                                        </div>
                                        {v.vin && <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut, marginTop: 10 }}>VIN: <code style={{ color: txt, fontSize: '.72rem' }}>{v.vin}</code></p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {data && tab === 'catalogo' && (
                    <div className="pc-fade" style={{ animationDelay: '.2s' }}>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, marginBottom: 22 }}>
                            Repuestos disponibles para compra directa en el taller.
                        </p>
                        {data.repuestosVenta.length === 0 ? (
                            <EmptyState msg="No hay productos en venta en este momento." />
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
                                {data.repuestosVenta.map((r, i) => (
                                    <div key={r.id} className="pc-card" style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '18px 20px', animationDelay: `${i * 40}ms` }}>
                                        {r.imagen_url && (
                                            <div style={{ width: '100%', height: 140, borderRadius: 10, overflow: 'hidden', marginBottom: 14, background: '#111' }}>
                                                <img src={r.imagen_url} alt={r.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                            </div>
                                        )}
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.93rem', color: txt, marginBottom: 4, lineHeight: 1.3 }}>{r.nombre}</p>
                                        {r.categoria_nombre && <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut, marginBottom: 10 }}>{r.categoria_nombre}</p>}
                                        {r.descripcion && <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, marginBottom: 12, lineHeight: 1.5 }}>{r.descripcion}</p>}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.3rem', color: GOLD, lineHeight: 1 }}>${parseFloat(r.precio_venta).toFixed(2)}</p>
                                                <p style={{ fontFamily: "'Outfit'", fontSize: '.7rem', color: mut }}>por {r.unidad_medida}</p>
                                            </div>
                                            <span style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: '#10b981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', padding: '4px 10px', borderRadius: 999 }}>
                                                Stock: {r.stock_actual}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}

function EmptyState({ msg }) {
    return (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ color: 'rgba(255,255,255,.1)', marginBottom: 16, display: 'flex', justifyContent: 'center' }}><IconEmpty /></div>
            <p style={{ fontFamily: "'Outfit'", color: 'rgba(241,245,249,.4)', fontSize: '.9rem' }}>{msg}</p>
        </div>
    );
}

function NoVinculo() {
    return (
        <div style={{ background: 'rgba(245,158,11,.06)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 14, padding: '28px 24px', textAlign: 'center' }}>
            <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: '#f59e0b', marginBottom: 8 }}>Sin historial vinculado</p>
            <p style={{ fontFamily: "'Outfit'", fontSize: '.88rem', color: 'rgba(241,245,249,.5)', maxWidth: 420, margin: '0 auto' }}>
                Tu cuenta de usuario no está vinculada a ningún cliente del taller todavía. Visítanos o contacta a recepción para que registremos tus datos.
            </p>
        </div>
    );
}
