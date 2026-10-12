/**
 * SS SWAP - Panel Personal del Cliente
 * Portal de autoservicio para clientes autenticados. Permite consultar el estado
 * de sus órdenes en tiempo real (barra de progreso animada con etapas técnicas),
 * gestionar citas, ver sus vehículos registrados y actualizar datos de perfil y foto.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../components/public/Navbar';
import Footer from '../components/public/Footer';
import api, { API_ORIGIN } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './PanelCliente.css';

/* ── Icons ── */
function IconOrden()    { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>; }
function IconCar()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.5l2-3h7l2 3H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><circle cx="8" cy="15" r="2"/><circle cx="16" cy="15" r="2"/></svg>; }
function IconBox()      { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function IconEmpty()    { return <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>; }
function IconUser()     { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function IconCalendar() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>; }
function IconCheck()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>; }
function IconCamera()   { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>; }
function IconLock()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }

const ACCENT       = '#3b7bab';
const ACCENT_LIGHT = '#7fabce';

const ESTADO_LABELS = {
    pendiente:    { label: 'Pendiente',    color: '#f59e0b', bg: 'rgba(245,158,11,.12)', bdr: 'rgba(245,158,11,.25)' },
    en_progreso:  { label: 'En progreso',  color: '#38bdf8', bg: 'rgba(56,189,248,.12)', bdr: 'rgba(56,189,248,.25)' },
    completado:   { label: 'Entregado',    color: '#10b981', bg: 'rgba(16,185,129,.12)', bdr: 'rgba(16,185,129,.25)' },
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
const ETAPAS = [
    { key: 'en_revision',         label: 'Revisión' },
    { key: 'deteccion_falla',     label: 'Diagnóstico' },
    { key: 'en_reparacion',       label: 'Reparación' },
    { key: 'esperando_repuestos', label: 'Repuestos' },
    { key: 'pruebas_finales',     label: 'Pruebas' },
    { key: 'listo_entrega',       label: 'Listo' },
];
const ESTADO_CITA_LABELS = {
    pendiente:  { label: 'Pendiente',  color: '#f59e0b', bg: 'rgba(245,158,11,.12)', bdr: 'rgba(245,158,11,.25)' },
    confirmada: { label: 'Confirmada', color: '#38bdf8', bg: 'rgba(56,189,248,.12)', bdr: 'rgba(56,189,248,.25)' },
    completada: { label: 'Completada', color: '#10b981', bg: 'rgba(16,185,129,.12)', bdr: 'rgba(16,185,129,.25)' },
    cancelada:  { label: 'Cancelada',  color: '#ef4444', bg: 'rgba(239,68,68,.12)',  bdr: 'rgba(239,68,68,.25)'  },
};

const TABS = [
    { id: 'ordenes',   label: 'Mis Órdenes',  icon: IconOrden    },
    { id: 'citas',     label: 'Mis Citas',    icon: IconCalendar },
    { id: 'vehiculos', label: 'Mis Vehículos',icon: IconCar      },
    { id: 'perfil',    label: 'Mi Perfil',    icon: IconUser     },
];

export default function PanelCliente() {
    const location = useLocation();
    const { usuario } = useAuth();
    const [data, setData]       = useState(null);
    const [citas, setCitas]     = useState([]);
    const [perfil, setPerfil]   = useState(null);
    const [loading, setLoading] = useState(true);
    const [tab, setTab]         = useState(location.state?.tab || 'ordenes');
    const [error, setError]     = useState(null);

    useEffect(() => {
        api.get('/panel/mi-actividad')
            .then(r => setData(r.data))
            .catch(err => setError(err.response?.data?.error || 'Error al cargar tu panel.'))
            .finally(() => setLoading(false));

        api.get('/citas/mias', { params: { orden: 'registro_desc' } }).then(r => setCitas(r.data.citas || [])).catch(() => {});
        api.get('/users/me').then(r => setPerfil(r.data.usuario)).catch(() => {});
    }, []);

    // Refresca el estado confirmado/cancelado sin que el cliente deba recargar.
    useEffect(() => {
        const id = setInterval(() => api.get('/citas/mias', { params: { orden: 'registro_desc' } }).then(r => setCitas(r.data.citas || [])).catch(() => {}), 30000);
        return () => clearInterval(id);
    }, []);

    const txt  = 'rgba(241,245,249,1)';
    const mut  = 'rgba(241,245,249,.55)';
    const card = 'rgba(255,255,255,.04)';
    const bdr  = 'rgba(255,255,255,.08)';

    const ordenesActivas = (data?.ordenes || []).filter(o => o.estado === 'pendiente' || o.estado === 'en_progreso');

    const cancelarCita = async (id) => {
        try {
            const { data: resp } = await api.patch(`/citas/${id}/cancelar`);
            setCitas(prev => prev.map(c => c.id === id ? { ...c, estado: resp.cita.estado } : c));
            toast.success('Cita cancelada.');
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo cancelar la cita.');
        }
    };

    return (
        <div style={{ background: '#050505', minHeight: '100vh', color: '#fff' }}>

            <Navbar />

            <main style={{ maxWidth: 1100, margin: '0 auto', padding: '110px 24px 60px', minHeight: '100vh' }}>

                {/* Welcome header */}
                <div className="pc-fade" style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: `rgba(59,123,171,.12)`, border: `1px solid rgba(59,123,171,.3)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, overflow: 'hidden', flexShrink: 0 }}>
                        {perfil?.foto_url
                            ? <img src={`${API_ORIGIN}${perfil.foto_url}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <IconUser />}
                    </div>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.3em', color: ACCENT }}>MI PANEL</p>
                        <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(1.6rem,4vw,2.4rem)', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>
                            Hola, {usuario?.nombre?.split(' ')[0] || 'Cliente'}
                        </h1>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, marginTop: 4 }}>Monitorea tu actividad en SS SWAP</p>
                    </div>
                </div>

                {/* Stats */}
                {data && (
                    <div className="pc-fade" style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', animationDelay: '.1s' }}>
                        {[
                            { label: 'Órdenes',    val: data.ordenes?.length || 0, color: '#38bdf8' },
                            { label: 'Vehículos',  val: data.vehiculos?.length || 0, color: ACCENT },
                            { label: 'Citas',      val: citas.filter(c => c.estado !== 'cancelada').length, color: '#a78bfa' },
                            { label: 'Entregadas', val: data.ordenes?.filter(o => o.estado === 'completado').length || 0, color: '#10b981' },
                        ].map(s => (
                            <div key={s.label} style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '16px 22px', flex: '1 1 140px' }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.8rem', color: s.color, lineHeight: 1 }}>{s.val}</p>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut, marginTop: 4 }}>{s.label}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Monitor de estado del vehiculo (siempre visible si hay trabajo activo) */}
                {ordenesActivas.length > 0 && (
                    <div className="pc-fade" style={{ marginBottom: 28, animationDelay: '.12s' }}>
                        {ordenesActivas.map(o => (
                            <EstadoVehiculoCard key={o.id} orden={o} txt={txt} mut={mut} card={card} />
                        ))}
                    </div>
                )}

                {/* Tabs */}
                <div className="pc-fade" style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${bdr}`, marginBottom: 28, animationDelay: '.15s', overflowX: 'auto', paddingBottom: 0 }}>
                    {TABS.map(t => (
                        <button key={t.id} className="pc-tab" onClick={() => setTab(t.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', border: 'none', background: tab === t.id ? 'rgba(59,123,171,.1)' : 'none', borderBottom: `2px solid ${tab === t.id ? ACCENT : 'transparent'}`, color: tab === t.id ? '#fff' : mut, fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem', cursor: 'pointer', whiteSpace: 'nowrap', borderRadius: '8px 8px 0 0' }}>
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
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                                                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.05rem', letterSpacing: '.12em', color: ACCENT }}>ORDEN #{o.id}</p>
                                                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.82rem', letterSpacing: '.05em', padding: '5px 14px', borderRadius: 999, background: est.bg, color: est.color, border: `1px solid ${est.bdr}` }}>{est.label}</span>
                                                        {o.estado_progreso && (
                                                            <span style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: '#a78bfa', background: 'rgba(167,139,250,.1)', padding: '2px 8px', borderRadius: 999, border: '1px solid rgba(167,139,250,.2)' }}>
                                                                {PROGRESO_LABELS[o.estado_progreso] || o.estado_progreso}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {o.placa && (
                                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: txt }}>
                                                            {o.marca} {o.modelo} {o.anio} — <code style={{ background: 'rgba(255,255,255,.07)', padding: '1px 6px', borderRadius: 4, fontSize: '.8rem' }}>{o.placa}</code>
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

                {tab === 'citas' && (
                    <div className="pc-fade" style={{ animationDelay: '.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut }}>Tus solicitudes y citas. El estado se actualiza automáticamente cuando el taller la confirma o cancela.</p>
                            <Link to="/servicios" className="pc-btn-outline">
                                <IconCalendar /> Agendar nuevo servicio
                            </Link>
                        </div>
                        {citas.length === 0 ? (
                            <EmptyState msg="Aún no tienes citas agendadas." />
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {citas.map((c, i) => {
                                    const est = ESTADO_CITA_LABELS[c.estado] || ESTADO_CITA_LABELS.pendiente;
                                    const puedeCancelar = c.estado === 'pendiente' || c.estado === 'confirmada';
                                    const fechaFmt = new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
                                    return (
                                        <div key={c.id} className="pc-card" style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '20px 22px', animationDelay: `${i * 50}ms` }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 700, color: txt, fontSize: '.95rem' }}>{c.servicio_nombre}</p>
                                                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.82rem', letterSpacing: '.05em', padding: '5px 14px', borderRadius: 999, background: est.bg, color: est.color, border: `1px solid ${est.bdr}` }}>{est.label}</span>
                                                    </div>
                                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>{c.sucursal_nombre}{c.sucursal_direccion ? ` · ${c.sucursal_direccion}` : ''}</p>
                                                </div>
                                                <div style={{ textAlign: 'right' }}>
                                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.85rem', color: txt, textTransform: 'capitalize' }}>{fechaFmt}</p>
                                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: ACCENT }}>{c.hora_inicio?.slice(0,5)} — {c.hora_fin?.slice(0,5)}</p>
                                                </div>
                                            </div>
                                            {c.placa && (
                                                <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, marginBottom: 8 }}>
                                                    Vehículo: {c.marca} {c.modelo} <code style={{ background: 'rgba(255,255,255,.07)', padding: '1px 6px', borderRadius: 4 }}>{c.placa}</code>
                                                </p>
                                            )}
                                            {c.notas && <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, fontStyle: 'italic', marginBottom: 10 }}>"{c.notas}"</p>}
                                            {puedeCancelar && (
                                                <button className="pc-btn-danger" onClick={() => cancelarCita(c.id)}>Cancelar cita</button>
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 14 }}>
                                {data.vehiculos.map((v, i) => (
                                    <div key={v.id} className="pc-card" style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '20px 22px', animationDelay: `${i * 50}ms` }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                            <div style={{ width: 42, height: 42, borderRadius: 10, background: `rgba(59,123,171,.1)`, border: `1px solid rgba(59,123,171,.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT }}>
                                                <IconCar />
                                            </div>
                                            <div>
                                                <p style={{ fontFamily: "'Outfit'", fontWeight: 700, color: txt, fontSize: '.95rem' }}>{v.marca} {v.modelo}</p>
                                                <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut }}>{v.anio}{v.color ? ` · ${v.color}` : ''}</p>
                                            </div>
                                        </div>
                                        <div style={{ background: 'rgba(255,255,255,.04)', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.1em', color: ACCENT }}>{v.placa}</p>
                                            <p style={{ fontFamily: "'Outfit'", fontSize: '.7rem', color: mut }}>Placa</p>
                                        </div>
                                        {v.vin && <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut, marginTop: 10 }}>VIN: <code style={{ color: txt, fontSize: '.72rem' }}>{v.vin}</code></p>}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'perfil' && (
                    <div className="pc-fade" style={{ animationDelay: '.2s' }}>
                        <PerfilForm perfil={perfil} onActualizado={setPerfil} txt={txt} mut={mut} card={card} bdr={bdr} />
                        <HistorialChatCard txt={txt} mut={mut} card={card} bdr={bdr} />
                    </div>
                )}
            </main>

            <Footer />
        </div>
    );
}

/* ── Monitor de estado del vehiculo en el taller ── */
function EstadoVehiculoCard({ orden, txt, mut, card }) {
    const idx = ETAPAS.findIndex(e => e.key === orden.estado_progreso);
    const [mounted, setMounted]     = useState(false);
    const [historialOpen, setHistorialOpen] = useState(false);
    const [historial, setHistorial] = useState(null);
    const [cargandoHist, setCargandoHist] = useState(false);

    // Dispara la animacion de "llenado" de la barra de progreso apenas se monta la tarjeta.
    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 60);
        return () => clearTimeout(t);
    }, []);

    const toggleHistorial = async () => {
        if (historialOpen) { setHistorialOpen(false); return; }
        setHistorialOpen(true);
        if (historial) return;
        setCargandoHist(true);
        try {
            const { data } = await api.get(`/panel/ordenes/${orden.id}/historial`);
            setHistorial(data.historial || []);
        } catch {
            setHistorial([]);
        } finally {
            setCargandoHist(false);
        }
    };

    return (
        <div style={{ position: 'relative', background: card, border: `1px solid rgba(59,123,171,.3)`, borderRadius: 16, padding: '22px 24px', marginBottom: 14, overflow: 'hidden' }}>
            <div className="pc-taller-glow" />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span className="pc-live-dot" />
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.85rem', letterSpacing: '.18em', color: ACCENT_LIGHT }}>EN EL TALLER AHORA · ORDEN #{orden.id}</p>
                    </div>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 700, color: txt, fontSize: '1rem' }}>
                        {orden.placa
                            ? <>{orden.marca} {orden.modelo} {orden.anio ? `· ${orden.anio}` : ''} <code style={{ background: 'rgba(255,255,255,.07)', padding: '1px 6px', borderRadius: 4, fontSize: '.82rem' }}>{orden.placa}</code></>
                            : 'Vehículo sin placa registrada'}
                    </p>
                </div>
                {orden.tecnico_nombre && (
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut }}>Técnico asignado</p>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.85rem', color: txt }}>{orden.tecnico_nombre}</p>
                    </div>
                )}
            </div>

            <div style={{ position: 'relative', display: 'flex', overflowX: 'auto', paddingBottom: 4 }}>
                {ETAPAS.map((e, i) => {
                    const completada = idx >= 0 && i < idx;
                    const enCurso    = idx >= 0 && i === idx;
                    const color = completada || enCurso ? ACCENT : 'rgba(255,255,255,.15)';
                    // El segmento se "llena" solo si ya esta completado Y la animacion de montaje ya arranco.
                    const segmentoLleno = mounted && completada;
                    return (
                        <div key={e.key} style={{ display: 'flex', alignItems: 'center', flex: '1 0 auto', minWidth: 88 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 74 }}>
                                <div className={enCurso ? 'pc-etapa-actual' : ''} style={{
                                    width: 30, height: 30, borderRadius: '50%',
                                    background: enCurso ? ACCENT : completada ? 'rgba(59,123,171,.18)' : 'rgba(255,255,255,.04)',
                                    border: `1.5px solid ${color}`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: enCurso ? '#fff' : color, flexShrink: 0,
                                    transition: 'background .4s, border-color .4s, color .4s',
                                }}>
                                    {completada ? <IconCheck /> : <span style={{ fontFamily: "'Outfit'", fontSize: '.7rem', fontWeight: 700 }}>{i + 1}</span>}
                                </div>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.68rem', fontWeight: enCurso ? 700 : 500, color: enCurso ? txt : mut, textAlign: 'center', lineHeight: 1.2 }}>
                                    {e.label}{enCurso && <span className="pc-dots"><span>.</span><span>.</span><span>.</span></span>}
                                </p>
                            </div>
                            {i < ETAPAS.length - 1 && (
                                <div style={{ flex: 1, height: 2, minWidth: 16, background: 'rgba(255,255,255,.1)', marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ position: 'absolute', inset: 0, background: ACCENT, transformOrigin: 'left', transform: `scaleX(${segmentoLleno ? 1 : 0})`, transition: `transform .55s cubic-bezier(.4,0,.2,1) ${i * 0.12}s` }} />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {idx === -1 && <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginTop: 12 }}>Tu vehículo está en cola, pronto comenzará la revisión inicial.</p>}
            {orden.diagnostico && (
                <div style={{ marginTop: 16, background: 'rgba(56,189,248,.05)', border: '1px solid rgba(56,189,248,.15)', borderRadius: 8, padding: '10px 14px' }}>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', fontWeight: 600, color: '#38bdf8', marginBottom: 4, letterSpacing: '.06em' }}>DIAGNÓSTICO</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.84rem', color: txt }}>{orden.diagnostico}</p>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                {orden.updated_at ? (
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.7rem', color: 'rgba(255,255,255,.3)' }}>
                        Última actualización: {new Date(orden.updated_at).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                ) : <span />}
                <button type="button" onClick={toggleHistorial} className="pc-hist-toggle">
                    {historialOpen ? 'Ocultar historial' : 'Ver progresión completa'}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ transform: historialOpen ? 'rotate(180deg)' : 'none', transition: 'transform .25s' }}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
            </div>

            {historialOpen && (
                <div className="pc-hist-panel">
                    {cargandoHist && <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, padding: '14px 2px' }}>Cargando historial…</p>}
                    {!cargandoHist && historial && historial.length === 0 && (
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, padding: '14px 2px' }}>Todavía no hay cambios de estado registrados para esta orden.</p>
                    )}
                    {!cargandoHist && historial && historial.length > 0 && (
                        <div className="pc-timeline">
                            {historial.map((h, i) => (
                                <div key={h.id} className="pc-timeline-item" style={{ animationDelay: `${i * 60}ms` }}>
                                    <span className="pc-timeline-dot" />
                                    <div>
                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.7rem', color: 'rgba(255,255,255,.4)', marginBottom: 3 }}>
                                            {new Date(h.created_at).toLocaleString('es-EC', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.84rem', color: txt, fontWeight: 500 }}>
                                            {h.estado_nuevo && h.estado_nuevo !== h.estado_anterior && (
                                                <>Estado: <span style={{ color: mut }}>{ESTADO_LABELS[h.estado_anterior]?.label || h.estado_anterior || '—'}</span> → <span style={{ color: ACCENT_LIGHT }}>{ESTADO_LABELS[h.estado_nuevo]?.label || h.estado_nuevo}</span></>
                                            )}
                                            {h.progreso_nuevo && h.progreso_nuevo !== h.progreso_anterior && (
                                                <>{h.estado_nuevo && h.estado_nuevo !== h.estado_anterior ? <br /> : null}Progreso: <span style={{ color: mut }}>{PROGRESO_LABELS[h.progreso_anterior] || h.progreso_anterior || '—'}</span> → <span style={{ color: ACCENT_LIGHT }}>{PROGRESO_LABELS[h.progreso_nuevo] || h.progreso_nuevo}</span></>
                                            )}
                                        </p>
                                        {h.notas && <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, fontStyle: 'italic', marginTop: 4 }}>"{h.notas}"</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ── Mi Perfil: datos, contrasena y foto ── */
function PerfilForm({ perfil, onActualizado, txt, mut, card, bdr }) {
    const { actualizarSesion } = useAuth();
    const fileInputRef = useRef(null);

    const [form, setForm]           = useState({ nombre: '', email: '', telefono: '', cedula: '' });
    const [guardando, setGuardando] = useState(false);
    const [errorPerfil, setErrorPerfil] = useState('');

    const [pwd, setPwd]                 = useState({ actual: '', nueva: '', confirmar: '' });
    const [cambiandoPwd, setCambiandoPwd] = useState(false);
    const [errorPwd, setErrorPwd]       = useState('');

    const [subiendoFoto, setSubiendoFoto] = useState(false);
    const [previewLocal, setPreviewLocal] = useState(null);

    useEffect(() => {
        if (perfil) setForm({ nombre: perfil.nombre || '', email: perfil.email || '', telefono: perfil.telefono || '', cedula: perfil.cedula || '' });
    }, [perfil]);

    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    // Formatea el telefono ecuatoriano mientras se escribe: +593 96 386 3847
    const formatearTelefono = (raw) => {
        let digits = raw.replace(/\D/g, '');
        if (digits.startsWith('593')) digits = digits.slice(3);
        if (digits.startsWith('0'))   digits = digits.slice(1);
        digits = digits.slice(0, 9);
        let out = '+593';
        if (digits.length > 0) out += ' ' + digits.slice(0, 2);
        if (digits.length > 2) out += ' ' + digits.slice(2, 5);
        if (digits.length > 5) out += ' ' + digits.slice(5, 9);
        return out;
    };

    const guardarPerfil = async (e) => {
        e.preventDefault();
        setErrorPerfil('');
        if (!form.nombre.trim()) { setErrorPerfil('El nombre es obligatorio.'); return; }
        if (!EMAIL_REGEX.test(form.email.trim())) { setErrorPerfil('Ingresa un correo electrónico válido.'); return; }
        if (form.cedula && form.cedula.length !== 10) { setErrorPerfil('La cédula debe tener 10 dígitos.'); return; }
        setGuardando(true);
        try {
            const { data } = await api.put('/users/me', form);
            actualizarSesion(data.token, data.sesion);
            onActualizado(data.usuario);
            toast.success('Perfil actualizado correctamente.');
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo actualizar tu perfil.');
        } finally {
            setGuardando(false);
        }
    };

    const cambiarPassword = async (e) => {
        e.preventDefault();
        setErrorPwd('');
        if (pwd.nueva.length < 8) { setErrorPwd('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
        if (pwd.nueva !== pwd.confirmar) { setErrorPwd('Las contraseñas nuevas no coinciden.'); return; }
        setCambiandoPwd(true);
        try {
            const { data } = await api.put('/users/me/password', { password_actual: pwd.actual, password_nueva: pwd.nueva });
            // El backend cierra las demas sesiones y entrega un token nuevo para esta.
            if (data?.token) actualizarSesion(data.token);
            setPwd({ actual: '', nueva: '', confirmar: '' });
            toast.success('Contraseña actualizada. Se cerraron tus otras sesiones.');
        } catch (err) {
            setErrorPwd(err.response?.data?.error || 'No se pudo cambiar tu contraseña.');
        } finally {
            setCambiandoPwd(false);
        }
    };

    const subirFoto = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (!/\.(jpg|jpeg|png|webp)$/i.test(file.name)) { toast.error('Formato no permitido. Usa JPG, PNG o WEBP.'); return; }
        if (file.size > 3 * 1024 * 1024) { toast.error('La imagen no puede superar 3MB.'); return; }

        setPreviewLocal(URL.createObjectURL(file));
        setSubiendoFoto(true);
        const fd = new FormData();
        fd.append('foto', file);
        try {
            const { data } = await api.post('/users/me/foto', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            actualizarSesion(data.token, data.sesion);
            onActualizado(data.usuario);
            toast.success('Foto de perfil actualizada.');
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo subir la foto.');
        } finally {
            setSubiendoFoto(false);
            setPreviewLocal(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const fotoSrc = previewLocal || (perfil?.foto_url ? `${API_ORIGIN}${perfil.foto_url}` : null);

    return (
        <div className="pc-perfil-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,280px) minmax(0,1fr)', gap: 28, alignItems: 'start' }}>
            {/* Avatar */}
            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, padding: '28px 24px', textAlign: 'center' }}>
                <div style={{ position: 'relative', width: 110, height: 110, margin: '0 auto 16px' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'rgba(59,123,171,.1)', border: '1px solid rgba(59,123,171,.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ACCENT, opacity: subiendoFoto ? .5 : 1 }}>
                        {fotoSrc ? <img src={fotoSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ transform: 'scale(2.2)' }}><IconUser /></span>}
                    </div>
                    <button type="button" className="pc-avatar-edit" onClick={() => fileInputRef.current?.click()} disabled={subiendoFoto} aria-label="Cambiar foto">
                        <IconCamera />
                    </button>
                    <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display: 'none' }} onChange={subirFoto} />
                </div>
                <p style={{ fontFamily: "'Outfit'", fontWeight: 700, color: txt, fontSize: '.95rem' }}>{perfil?.nombre}</p>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginTop: 2 }}>{perfil?.email}</p>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.7rem', color: 'rgba(255,255,255,.3)', marginTop: 14 }}>JPG, PNG o WEBP · máx. 3MB</p>
            </div>

            {/* Formularios */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <form onSubmit={guardarPerfil} style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, padding: '24px 26px' }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.15rem', letterSpacing: '.1em', color: ACCENT, marginBottom: 18 }}>DATOS PERSONALES</p>
                    <div className="pc-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                        <div>
                            <p className="pc-label">Nombre completo</p>
                            <input className="pc-input" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required />
                        </div>
                        <div>
                            <p className="pc-label">Correo electrónico</p>
                            <input className="pc-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
                        </div>
                    </div>
                    <div className="pc-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                        <div>
                            <p className="pc-label">Teléfono</p>
                            <input className="pc-input" value={form.telefono} onChange={e => setForm({ ...form, telefono: formatearTelefono(e.target.value) })} placeholder="+593 96 386 3847" inputMode="numeric" />
                        </div>
                        <div>
                            <p className="pc-label">Cédula</p>
                            <input className="pc-input" value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="1712345678" maxLength={10} inputMode="numeric" />
                        </div>
                    </div>
                    {errorPerfil && <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: '#f87171', marginBottom: 14 }}>{errorPerfil}</p>}
                    <button className="pc-btn-primary" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
                </form>

                <form onSubmit={cambiarPassword} style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, padding: '24px 26px' }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.15rem', letterSpacing: '.1em', color: ACCENT, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}><IconLock /> CAMBIAR CONTRASEÑA</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginBottom: 18 }}>Tu contraseña actual es necesaria para confirmar el cambio. Mínimo 6 caracteres.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
                        <input className="pc-input" type="password" placeholder="Contraseña actual" value={pwd.actual} onChange={e => setPwd({ ...pwd, actual: e.target.value })} required />
                        <div className="pc-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <input className="pc-input" type="password" placeholder="Nueva contraseña (mín. 8)" minLength={8} value={pwd.nueva} onChange={e => setPwd({ ...pwd, nueva: e.target.value })} required />
                            <input className="pc-input" type="password" placeholder="Confirmar nueva" minLength={8} value={pwd.confirmar} onChange={e => setPwd({ ...pwd, confirmar: e.target.value })} required />
                        </div>
                    </div>
                    {errorPwd && <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: '#f87171', marginBottom: 14 }}>{errorPwd}</p>}
                    <button className="pc-btn-primary" type="submit" disabled={cambiandoPwd}>{cambiandoPwd ? 'Actualizando…' : 'Actualizar contraseña'}</button>
                </form>
            </div>
        </div>
    );
}

/* ── Historial de conversaciones con SWAPBot (mismo patron de toggle que EstadoVehiculoCard) ── */
function HistorialChatCard({ txt, mut, card, bdr }) {
    const [abierto, setAbierto]               = useState(false);
    const [conversaciones, setConversaciones] = useState(null);
    const [cargando, setCargando]             = useState(false);

    const toggle = async () => {
        if (abierto) { setAbierto(false); return; }
        setAbierto(true);
        if (conversaciones) return;
        setCargando(true);
        try {
            const { data } = await api.get('/panel/chatbot-historial');
            setConversaciones(data.conversaciones || []);
        } catch {
            setConversaciones([]);
        } finally {
            setCargando(false);
        }
    };

    return (
        <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, padding: '22px 24px', marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.85rem', letterSpacing: '.18em', color: ACCENT_LIGHT }}>MIS CONVERSACIONES CON SWAPBOT</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginTop: 4 }}>Revisa lo último que hablaste con el asistente virtual.</p>
                </div>
                <button type="button" className="pc-hist-toggle" onClick={toggle}>
                    {abierto ? 'Ocultar' : 'Ver historial'}
                </button>
            </div>

            {abierto && (
                <div className="pc-hist-panel">
                    {cargando && (
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>
                            Cargando<span className="pc-dots"><span>.</span><span>.</span><span>.</span></span>
                        </p>
                    )}
                    {!cargando && conversaciones?.length === 0 && (
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>
                            Todavía no tienes conversaciones guardadas con SWAPBot.
                        </p>
                    )}
                    {!cargando && conversaciones?.map(c => (
                        <div key={c.id} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: `1px solid ${bdr}` }}>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.78rem', color: txt, marginBottom: 8 }}>
                                {new Date(c.actualizado_en).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {c.mensajes.slice(-4).map((m, i) => (
                                    <p key={i} style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: m.rol === 'user' ? txt : mut }}>
                                        <strong style={{ color: m.rol === 'user' ? ACCENT_LIGHT : ACCENT }}>{m.rol === 'user' ? 'Tú: ' : 'SWAPBot: '}</strong>
                                        {m.texto}
                                    </p>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
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