import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
    ESTADOS_PROGRESO,
    ESTADO_ORDEN_MAP, ESTADO_PROGRESO_MAP, FILTROS_ORDEN,
} from '../constants/ordenes';
import { useConfirm } from '../components/common/ConfirmDialog';
import './OrdenesTrabajo.css';

// ── Iconos ────────────────────────────────────────────────────
function IconPlus()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconSearch(){ return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconX()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconEdit()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconTrash() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>; }
function IconCar()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.5l2-3h7l2 3H19a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><circle cx="8" cy="15" r="2"/><circle cx="16" cy="15" r="2"/></svg>; }
function IconUser()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }
function IconChevron({ open }) { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .18s' }}><polyline points="9 18 15 12 9 6"/></svg>; }
function IconArrowRight() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>; }
function IconClock() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }

export default function OrdenesTrabajo() {
    const confirm = useConfirm();
    const { tieneRol, usuario } = useAuth();
    const { isDark }  = useTheme();
    const esAdmin        = tieneRol('administrador');
    const esRecepcionista = tieneRol('recepcionista');
    const esTecnico      = tieneRol('tecnico');
    const puedeAsignar   = esAdmin || esRecepcionista;
    const puedeVerAcciones = esAdmin || esTecnico;

    const [ordenes, setOrdenes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filtroGrupo, setFiltroGrupo] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [modal, setModal] = useState({ open: false, data: null });
    const [modalCliente, setModalCliente] = useState(false);
    const [expandedId, setExpandedId] = useState(null);
    const [historialAbierto, setHistorialAbierto] = useState({});
    const [historialData, setHistorialData] = useState({});
    const [historialCargando, setHistorialCargando] = useState({});

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.05)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.18)';
    const txt    = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf  = isDark ? '#cbd5e1' : '#334155';
    const mut    = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr    = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.07)';
    const card   = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const cardSh = isDark
        ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)'
        : '0 4px 16px -4px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04)';
    const inputBg = isDark ? '#0b1220' : '#fafcff';

    const cargar = useCallback(async (q = '', grupo = filtroGrupo) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (q) params.set('q', q);
            if (grupo === 'anteriores') params.set('grupo', 'anteriores');
            else if (grupo) params.set('estado', grupo);
            const { data } = await api.get(`/ordenes/ordenes?${params}`);
            setOrdenes(data.ordenes);
        } catch { toast.error('Error al cargar ordenes.'); }
        finally { setLoading(false); }
    }, [filtroGrupo]);

    useEffect(() => { cargar(busqueda, filtroGrupo); }, []);

    const handleBusqueda = (e) => {
        const v = e.target.value;
        setBusqueda(v);
        setTimeout(() => cargar(v, filtroGrupo), 300);
    };

    // Determina si el usuario actual puede cambiar estado de una orden concreta
    const puedeCambiarEstado = (orden) => {
        if (esAdmin) return true;
        if (esTecnico && orden.tecnico_id === usuario?.id) return true;
        return false;
    };

    const cambiarEstado = async (id, nuevo, extra = {}) => {
        try {
            await api.put(`/ordenes/ordenes/${id}`, { estado: nuevo, ...extra });
            toast.success(`Orden ${ESTADO_ORDEN_MAP[nuevo]?.label || nuevo}.`);
            cargar(busqueda, filtroGrupo);
        } catch (err) { toast.error(err.response?.data?.error || 'Error.'); }
    };

    const actualizarProgreso = async (id, estado_progreso, notas_progreso) => {
        try {
            await api.put(`/ordenes/ordenes/${id}`, { estado_progreso, notas_progreso: notas_progreso || null });
            toast.success('Progreso actualizado.');
            cargar(busqueda, filtroGrupo);
        } catch (err) { toast.error(err.response?.data?.error || 'Error.'); }
    };

    const toggleHistorial = async (id) => {
        const abrir = !historialAbierto[id];
        setHistorialAbierto(prev => ({ ...prev, [id]: abrir }));
        if (abrir && !historialData[id]) {
            setHistorialCargando(prev => ({ ...prev, [id]: true }));
            try {
                const { data } = await api.get(`/ordenes/ordenes/${id}/historial`);
                setHistorialData(prev => ({ ...prev, [id]: data.historial || [] }));
            } catch {
                toast.error('No se pudo cargar el historial de la orden.');
            } finally {
                setHistorialCargando(prev => ({ ...prev, [id]: false }));
            }
        }
    };

    const eliminarOrden = async (o) => {
        if (!(await confirm({ message: `Eliminar orden #${o.id}?` }))) return;
        try {
            await api.delete(`/ordenes/ordenes/${o.id}`);
            toast.success('Orden eliminada.');
            cargar(busqueda, filtroGrupo);
        } catch (err) { toast.error(err.response?.data?.error || 'Error.'); }
    };

    const guardarOrden = async (form) => {
        try {
            if (modal.data) {
                await api.put(`/ordenes/ordenes/${modal.data.id}`, form);
                toast.success('Orden actualizada.');
            } else {
                await api.post('/ordenes/ordenes', form);
                toast.success('Orden creada.');
            }
            setModal({ open: false, data: null });
            cargar(busqueda, filtroGrupo);
        } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar.'); }
    };

    const creadoCliente = (cliente) => {
        setModalCliente(false);
        setModal({ open: true, data: null, clientePre: cliente });
    };

    const aplicarFiltro = (grupo) => {
        setFiltroGrupo(grupo);
        cargar(busqueda, grupo);
    };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500 }}>

            {/* Header */}
            <div className="ot-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="SS SWAP-chip" style={{ marginBottom: 8 }}>
                        <span className="dot" />
                        <span>SS SWAP · TALLER · ORDENES DE TRABAJO</span>
                    </div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Ordenes de Trabajo</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                        Control de reparaciones vinculadas a clientes y vehiculos
                    </p>
                </div>
                {(esAdmin || esRecepcionista) && (
                    <button onClick={() => setModal({ open: true, data: null, clientePre: undefined })}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
                            fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em',
                            color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`,
                            border: 'none', borderRadius: 11, padding: '11px 22px', cursor: 'pointer',
                            boxShadow: `0 6px 18px -6px ${SKY}` }}>
                        <IconPlus /> NUEVA ORDEN
                    </button>
                )}
            </div>

            {/* Filtros por grupo */}
            <div className="ot-filtros" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {FILTROS_ORDEN.map(f => {
                    const activo = filtroGrupo === f.val;
                    return (
                        <button key={f.val} onClick={() => aplicarFiltro(f.val)}
                            style={{
                                fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.12em',
                                padding: '10px 18px', borderRadius: 10, cursor: 'pointer', transition: 'all .15s',
                                background: activo ? `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})` : card,
                                color: activo ? '#fff' : mut,
                                border: `1px solid ${activo ? 'transparent' : bdr}`,
                                boxShadow: activo ? `0 4px 14px -4px ${SKY}` : 'none',
                            }}>
                            {f.label}
                        </button>
                    );
                })}
            </div>

            {/* Buscador */}
            <div className="ot-search-row" style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: mut, pointerEvents: 'none' }}><IconSearch /></span>
                    <input value={busqueda} onChange={handleBusqueda}
                        placeholder="Buscar por cliente, placa o descripcion..."
                        style={{ width: '100%', boxSizing: 'border-box', paddingLeft: 34, paddingRight: 12, paddingTop: 10, paddingBottom: 10,
                            borderRadius: 11, border: `1px solid ${bdr}`, background: inputBg,
                            color: txt, fontFamily: "'Outfit'", fontSize: '.88rem', outline: 'none' }} />
                </div>
            </div>

            {/* Lista */}
            {loading ? (
                <p style={{ textAlign: 'center', color: mut, fontFamily: "'Outfit'", paddingTop: 40 }}>Cargando ordenes...</p>
            ) : ordenes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <IconCar />
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.1em', color: mut, marginTop: 14 }}>Sin ordenes</p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {ordenes.map(o => {
                        const est  = ESTADO_ORDEN_MAP[o.estado]   || { label: o.estado,   color: '#94a3b8' };
                        const prog = ESTADO_PROGRESO_MAP[o.estado_progreso];
                        const expanded = expandedId === o.id;
                        const puedeEste = puedeCambiarEstado(o);

                        return (
                            <div key={o.id}
                                style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14,
                                    boxShadow: cardSh, overflow: 'hidden', transition: 'box-shadow .15s' }}>
                                {/* Card header (clickable) */}
                                <div className="ot-card-header" onClick={() => setExpandedId(expanded ? null : o.id)}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        padding: '14px 20px', cursor: 'pointer', gap: 10 }}>
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                                            <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.3rem', letterSpacing: '.03em', color: txt }}>#{String(o.id).padStart(4, '0')}</span>
                                            <span style={{ padding: '3px 10px', borderRadius: 999, background: `${est.color}14`, border: `1px solid ${est.color}35`, color: est.color, fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.16em' }}>{est.label.toUpperCase()}</span>
                                            {prog && (
                                                <span style={{ padding: '3px 10px', borderRadius: 999, background: `${prog.color}14`, border: `1px solid ${prog.color}35`, color: prog.color, fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.16em' }}>{prog.label.toUpperCase()}</span>
                                            )}
                                            {o.tecnico_nombre && (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 999, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', color: '#10b981', fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.12em' }}>
                                                    <IconUser /> {o.tecnico_nombre}
                                                </span>
                                            )}
                                        </div>
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.85rem', color: txt, marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {o.cliente_nombre} {o.placa && <span style={{ color: mut, fontWeight: 400 }}>· {o.placa} {o.marca && `(${o.marca})`}</span>}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut }}>
                                            {new Date(o.fecha_ingreso || o.created_at).toLocaleDateString('es-EC')}
                                        </p>
                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.68rem', color: mut, marginTop: 1 }}>{o.usuario_nombre}</p>
                                    </div>
                                </div>

                                {expanded && (
                                    <div style={{ borderTop: `1px solid ${bdr}`, padding: '16px 20px', background: isDark ? 'rgba(255,255,255,.015)' : 'rgba(14,165,233,.02)' }}>
                                        <div className="ot-detail-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                                            <div>
                                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.2em', color: SKY_DEEP, marginBottom: 4 }}>CLIENTE</p>
                                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.85rem', color: txt }}>{o.cliente_nombre}</p>
                                                {o.cliente_telefono && <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut }}>{o.cliente_telefono}</p>}
                                            </div>
                                            {o.placa && (
                                                <div>
                                                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.2em', color: SKY_DEEP, marginBottom: 4 }}>VEHICULO</p>
                                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.85rem', color: txt }}>{o.placa}</p>
                                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut }}>{[o.marca, o.modelo, o.anio].filter(Boolean).join(' · ')}</p>
                                                </div>
                                            )}
                                        </div>

                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf, lineHeight: 1.5, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{o.descripcion}</p>

                                        {o.diagnostico && (
                                            <div style={{ padding: '10px 14px', borderRadius: 10, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, marginBottom: 14 }}>
                                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.2em', color: SKY_DEEP, marginBottom: 3 }}>DIAGNOSTICO</p>
                                                <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf }}>{o.diagnostico}</p>
                                            </div>
                                        )}

                                        {o.notas_progreso && (
                                            <div style={{ padding: '10px 14px', borderRadius: 10, background: isDark ? 'rgba(99,102,241,.08)' : 'rgba(99,102,241,.04)', border: `1px solid ${isDark ? 'rgba(99,102,241,.25)' : 'rgba(99,102,241,.15)'}`, marginBottom: 14 }}>
                                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.2em', color: '#6366f1', marginBottom: 3 }}>NOTAS DE PROGRESO</p>
                                                <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf }}>{o.notas_progreso}</p>
                                            </div>
                                        )}

                                        {/* Panel progreso: solo si puede cambiar estado y está en progreso */}
                                        {puedeEste && o.estado === 'en_progreso' && (
                                            <PanelProgreso
                                                orden={o}
                                                onGuardar={actualizarProgreso}
                                                isDark={isDark}
                                                bdr={bdr}
                                                inputBg={inputBg}
                                                txt={txt}
                                                mut={mut}
                                            />
                                        )}

                                        {/* Historial de cambios: sub-seccion expandible con flecha */}
                                        <div style={{ borderTop: `1px solid ${bdr}`, paddingTop: 12, marginBottom: 12 }}>
                                            <button onClick={() => toggleHistorial(o.id)}
                                                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: SKY_DEEP, fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.18em' }}>
                                                <IconChevron open={!!historialAbierto[o.id]} />
                                                HISTORIAL DE CAMBIOS
                                            </button>
                                            {historialAbierto[o.id] && (
                                                <div style={{ marginTop: 12 }}>
                                                    {historialCargando[o.id] ? (
                                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut }}>Cargando historial…</p>
                                                    ) : (
                                                        <HistorialTimeline
                                                            historial={historialData[o.id] || []}
                                                            isDark={isDark} txt={txt} mut={mut} bdr={bdr}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="ot-card-actions" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: `1px solid ${bdr}`, paddingTop: 12 }}>
                                            {/* Iniciar: admin siempre, tecnico solo si está asignado */}
                                            {puedeEste && o.estado === 'pendiente' && (
                                                <EstBtn color="#0ea5e9" label="Iniciar" onClick={() => cambiarEstado(o.id, 'en_progreso', { estado_progreso: 'en_revision' })} />
                                            )}
                                            {/* Marcar entregado (estado final; independiente del progreso de reparacion) */}
                                            {puedeEste && o.estado === 'en_progreso' && (
                                                <EstBtn color="#10b981" label="Marcar entregado" onClick={() => cambiarEstado(o.id, 'completado')} />
                                            )}
                                            {/* Cancelar: solo admin */}
                                            {esAdmin && o.estado === 'pendiente' && (
                                                <EstBtn color="#ef4444" label="Cancelar" onClick={() => cambiarEstado(o.id, 'cancelado')} />
                                            )}
                                            {/* Editar: admin y recepcionista pueden editar datos / asignar técnico */}
                                            {(esAdmin || esRecepcionista) && o.estado !== 'completado' && o.estado !== 'cancelado' && (
                                                <button onClick={() => setModal({ open: true, data: o })}
                                                    style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: SKY_DEEP, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.14em' }}>
                                                    <IconEdit /> EDITAR / ASIGNAR
                                                </button>
                                            )}
                                            {/* Eliminar: solo admin */}
                                            {esAdmin && (
                                                <button onClick={() => eliminarOrden(o)}
                                                    style={{ marginLeft: 'auto', background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: '7px 12px', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.14em' }}>
                                                    <IconTrash /> ELIMINAR
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal orden */}
            {modal.open && (
                <ModalOrden
                    data={modal.data}
                    clientePre={modal.clientePre}
                    onClose={() => setModal({ open: false, data: null })}
                    onGuardar={guardarOrden}
                    onNuevoCliente={() => { setModalCliente(true); }}
                    isDark={isDark}
                    puedeAsignar={puedeAsignar}
                />
            )}

            {/* Modal cliente */}
            {modalCliente && (
                <ModalCliente
                    onClose={() => setModalCliente(false)}
                    onCreado={creadoCliente}
                    isDark={isDark}
                />
            )}
        </div>
    );
}

function PanelProgreso({ orden, onGuardar, isDark, bdr, inputBg, txt, mut }) {
    const [progreso, setProgreso] = useState(orden.estado_progreso || 'en_revision');
    const [notas, setNotas] = useState(orden.notas_progreso || '');
    const SKY_DEEP = '#0284c7';

    return (
        <div style={{ padding: 14, borderRadius: 12, background: isDark ? 'rgba(14,165,233,.06)' : 'rgba(14,165,233,.03)', border: `1px solid ${bdr}`, marginBottom: 14 }}>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.2em', color: SKY_DEEP, marginBottom: 10 }}>ACTUALIZAR PROGRESO DE REPARACION</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div style={{ gridColumn: '1/-1' }}>
                    <select value={progreso} onChange={e => setProgreso(e.target.value)}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none' }}>
                        {ESTADOS_PROGRESO.map(e => <option key={e.val} value={e.val}>{e.label}</option>)}
                    </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                    <textarea value={notas} onChange={e => setNotas(e.target.value)}
                        placeholder="Detalles opcionales para el cliente (ej: se detecto falla en el alternador)..."
                        rows={2}
                        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.82rem', outline: 'none', resize: 'vertical' }} />
                </div>
            </div>
            <button onClick={() => onGuardar(orden.id, progreso, notas)}
                style={{ fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.14em', padding: '7px 16px', borderRadius: 8, background: 'linear-gradient(135deg, #0284c7, #0ea5e9)', border: 'none', color: '#fff', cursor: 'pointer' }}>
                GUARDAR PROGRESO
            </button>
        </div>
    );
}

function EstBtn({ color, label, onClick }) {
    return (
        <button onClick={onClick}
            style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.14em', padding: '5px 14px', borderRadius: 8, background: `${color}14`, border: `1px solid ${color}35`, color, cursor: 'pointer', transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.background = `${color}30`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${color}14`; e.currentTarget.style.transform = 'none'; }}>
            {label}
        </button>
    );
}

function HistorialTimeline({ historial, isDark, txt, mut, bdr }) {
    const [abierto, setAbierto] = useState(null);
    const SKY_DEEP = '#0284c7';

    if (!historial.length) {
        return <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut }}>Aun no hay cambios registrados para esta orden.</p>;
    }

    const etiqueta = (map, val, fallback) => (val ? (map[val]?.label || val) : fallback);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {historial.map((h, i) => {
                const expandido = abierto === h.id;
                const pasoAnterior = h.progreso_anterior
                    ? etiqueta(ESTADO_PROGRESO_MAP, h.progreso_anterior)
                    : etiqueta(ESTADO_ORDEN_MAP, h.estado_anterior, 'Inicio');
                const pasoNuevo = h.progreso_nuevo
                    ? etiqueta(ESTADO_PROGRESO_MAP, h.progreso_nuevo)
                    : etiqueta(ESTADO_ORDEN_MAP, h.estado_nuevo, '—');
                const colorNuevo = ESTADO_PROGRESO_MAP[h.progreso_nuevo]?.color || ESTADO_ORDEN_MAP[h.estado_nuevo]?.color || SKY_DEEP;
                const fecha = h.created_at ? new Date(h.created_at) : null;

                return (
                    <div key={h.id} style={{ background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(14,165,233,.02)', border: `1px solid ${bdr}`, borderRadius: 10, overflow: 'hidden' }}>
                        <button onClick={() => setAbierto(expandido ? null : h.id)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', padding: '9px 12px', textAlign: 'left' }}>
                            <IconChevron open={expandido} />
                            <span style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, whiteSpace: 'nowrap' }}>{pasoAnterior}</span>
                            <span style={{ color: colorNuevo, flexShrink: 0 }}><IconArrowRight /></span>
                            <span style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.8rem', color: colorNuevo, whiteSpace: 'nowrap' }}>{pasoNuevo}</span>
                            <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4, fontFamily: "'Outfit'", fontSize: '.7rem', color: mut, flexShrink: 0 }}>
                                <IconClock />
                                {fecha ? fecha.toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </span>
                        </button>
                        {expandido && (
                            <div style={{ padding: '0 12px 12px 32px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: txt }}>
                                    Realizado por <strong>{h.usuario_nombre || 'Sistema'}</strong>
                                </p>
                                {h.estado_anterior !== h.estado_nuevo && (
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut }}>
                                        Estado de orden: {etiqueta(ESTADO_ORDEN_MAP, h.estado_anterior, 'Nueva')} → {etiqueta(ESTADO_ORDEN_MAP, h.estado_nuevo, '—')}
                                    </p>
                                )}
                                {h.notas && (
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: txt, background: isDark ? 'rgba(99,102,241,.08)' : 'rgba(99,102,241,.05)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 8, padding: '8px 10px', marginTop: 2 }}>
                                        {h.notas}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MODAL: Cliente (crear/editar)
// ═══════════════════════════════════════════════════════════════
function ModalCliente({ onClose, onCreado, isDark }) {
    const [form, setForm] = useState({ nombre: '', email: '', telefono: '', cedula: '', direccion: '' });
    const [saving, setSaving] = useState(false);
    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.10)';
    const inputBg = isDark ? '#0b1220' : '#f8fafc';
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.88rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP };

    const handlePhoneChange = (e) => {
        let val = e.target.value.replace(/[^\d+]/g, '');
        if (!val.startsWith('+')) val = '+' + val;
        if (val === '+') val = '+593';
        if (!val.startsWith('+593')) val = '+593' + val.replace(/^\+?\d*/, '');
        if (val.length > 13) val = val.slice(0, 13);
        setForm({ ...form, telefono: val });
    };
    const onChange = (e) => {
        const { name, value } = e.target;
        if (name === 'telefono') return handlePhoneChange(e);
        if (name === 'cedula' && value.length > 15) return;
        setForm({ ...form, [name]: value });
    };
    const onSubmit = async (e) => {
        e.preventDefault();
        if (!form.cedula?.trim()) { toast.error('La cedula es obligatoria.'); return; }
        if (!form.telefono?.trim() && !form.email?.trim()) { toast.error('Debe indicar telefono o email.'); return; }
        setSaving(true);
        try {
            const { data } = await api.post('/ordenes/clientes', form);
            toast.success('Cliente registrado.');
            onCreado(data.cliente);
        } catch (err) { toast.error(err.response?.data?.error || 'Error.'); }
        finally { setSaving(false); }
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 540, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${SKY}, ${SKY_DEEP}, ${SKY}, transparent)`, borderRadius: '20px 20px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>TALLER · CLIENTES</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt }}>Nuevo Cliente</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}><IconX /></button>
                </div>
                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>NOMBRE *</label>
                            <input name="nombre" value={form.nombre} onChange={onChange} required placeholder="Nombre completo" style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>CEDULA / RUC *</label>
                            <input name="cedula" value={form.cedula} onChange={onChange} required maxLength={15} placeholder="Cedula o RUC" style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>EMAIL (tel. o email obligatorio)</label>
                            <input type="email" name="email" value={form.email} onChange={onChange} placeholder="cliente@email.com" style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>TELEFONO (tel. o email obligatorio)</label>
                            <input name="telefono" value={form.telefono} onChange={onChange} placeholder="+593 99 XXX XXXX" style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>DIRECCION (opcional)</label>
                            <input name="direccion" value={form.direccion} onChange={onChange} placeholder="Direccion del cliente" style={inputSt} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}` }}>
                        <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                        <button type="submit" disabled={saving} style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1, boxShadow: `0 6px 18px -6px ${SKY}` }}>
                            {saving ? 'GUARDANDO...' : 'REGISTRAR CLIENTE'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════
// MODAL: Orden de Trabajo (crear/editar)
// ═══════════════════════════════════════════════════════════════
function ModalOrden({ data, clientePre, onClose, onGuardar, onNuevoCliente, isDark, puedeAsignar }) {
    const esEdicion = Boolean(data);
    const [clientes, setClientes] = useState([]);
    const [vehiculos, setVehiculos] = useState([]);
    const [tecnicos, setTecnicos] = useState([]);
    const [buscandoCliente, setBuscandoCliente] = useState('');
    const [creandoVehiculo, setCreandoVehiculo] = useState(false);
    const [form, setForm] = useState({
        cliente_id: data?.cliente_id || clientePre?.id || '',
        vehiculo_id: data?.vehiculo_id || '',
        descripcion: data?.descripcion || '',
        diagnostico: data?.diagnostico || '',
        kilometraje: data?.kilometraje || '',
        tecnico_id: data?.tecnico_id || '',
    });
    const [vehForm, setVehForm] = useState({ placa: '', marca: '', modelo: '', anio: '', color: '' });
    const [saving, setSaving] = useState(false);

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.10)';
    const inputBg = isDark ? '#0b1220' : '#f8fafc';
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.88rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP };

    useEffect(() => {
        api.get('/ordenes/clientes').then(r => {
            setClientes(r.data.clientes);
            if (clientePre?.id && !data) {
                setForm(f => ({ ...f, cliente_id: clientePre.id }));
            }
        }).catch(() => {});
        // Cargar tecnicos activos
        api.get('/users?rol=tecnico&estado=activo').then(r => {
            setTecnicos(r.data.usuarios || []);
        }).catch(() => {});
    }, []);

    useEffect(() => {
        if (form.cliente_id) {
            api.get(`/ordenes/vehiculos?cliente_id=${form.cliente_id}`)
                .then(r => setVehiculos(r.data.vehiculos))
                .catch(() => {});
        } else {
            setVehiculos([]);
        }
    }, [form.cliente_id]);

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const onChangeVeh = (e) => setVehForm({ ...vehForm, [e.target.name]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!form.cliente_id) { toast.error('Selecciona un cliente.'); return; }
        setSaving(true);
        // Enviar tecnico_id como null si vacío
        const payload = { ...form, tecnico_id: form.tecnico_id || null };
        await onGuardar(payload);
        setSaving(false);
    };

    const guardarVehiculo = async (e) => {
        e.preventDefault();
        if (!vehForm.placa || !vehForm.marca) { toast.error('Placa y marca son obligatorios.'); return; }
        try {
            const { data } = await api.post('/ordenes/vehiculos', { ...vehForm, cliente_id: form.cliente_id });
            toast.success('Vehiculo registrado.');
            setVehiculos(prev => [...prev, data.vehiculo]);
            setForm(f => ({ ...f, vehiculo_id: data.vehiculo.id }));
            setCreandoVehiculo(false);
            setVehForm({ placa: '', marca: '', modelo: '', anio: '', color: '' });
        } catch (err) { toast.error(err.response?.data?.error || 'Error.'); }
    };

    const filtered = buscandoCliente
        ? clientes.filter(c =>
            c.nombre.toLowerCase().includes(buscandoCliente.toLowerCase()) ||
            c.cedula?.includes(buscandoCliente) ||
            c.email?.toLowerCase().includes(buscandoCliente.toLowerCase()) ||
            c.telefono?.includes(buscandoCliente))
        : clientes;

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 620, background: boxBg, border: `1px solid ${bdr}`, padding: 28, maxHeight: '90vh', overflowY: 'auto' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${SKY}, ${SKY_DEEP}, ${SKY}, transparent)`, borderRadius: '20px 20px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>TALLER · ORDENES</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt }}>{esEdicion ? 'Editar Orden' : 'Nueva Orden de Trabajo'}</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}><IconX /></button>
                </div>

                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {/* Seleccionar Cliente */}
                    <div>
                        <label style={labelSt}>CLIENTE *</label>
                        {esEdicion ? (
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem', color: txt, padding: '10px 13px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10 }}>
                                {data?.cliente_nombre}
                            </p>
                        ) : (
                            <>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                                    <input placeholder="Buscar cliente..." value={buscandoCliente}
                                        onChange={e => setBuscandoCliente(e.target.value)}
                                        style={{ ...inputSt, flex: 1 }} />
                                    <button type="button" onClick={onNuevoCliente}
                                        style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '0 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                        + NUEVO
                                    </button>
                                </div>
                                <select name="cliente_id" value={form.cliente_id} onChange={onChange} required style={{ ...inputSt }}>
                                    <option value="">Seleccionar cliente...</option>
                                    {filtered.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.nombre} {c.cedula ? `· ${c.cedula}` : ''} {c.telefono ? `· ${c.telefono}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </>
                        )}
                    </div>

                    {/* Asignar Tecnico (solo admin y recepcionista) */}
                    {puedeAsignar && (
                        <div>
                            <label style={labelSt}>TECNICO ASIGNADO</label>
                            <select name="tecnico_id" value={form.tecnico_id} onChange={onChange} style={{ ...inputSt }}>
                                <option value="">Sin asignar</option>
                                {tecnicos.map(t => (
                                    <option key={t.id} value={t.id}>{t.nombre}</option>
                                ))}
                            </select>
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut, marginTop: 5 }}>
                                Solo el tecnico asignado podrá actualizar el estado de esta orden.
                            </p>
                        </div>
                    )}

                    {/* Seleccionar / Crear Vehiculo */}
                    <div>
                        <label style={labelSt}>VEHICULO</label>
                        {!creandoVehiculo ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                                <select name="vehiculo_id" value={form.vehiculo_id} onChange={onChange} style={{ ...inputSt, flex: 1 }}>
                                    <option value="">Sin vehiculo</option>
                                    {vehiculos.map(v => (
                                        <option key={v.id} value={v.id}>
                                            {v.placa} · {v.marca} {v.modelo || ''} {v.anio || ''}
                                        </option>
                                    ))}
                                </select>
                                {form.cliente_id && (
                                    <button type="button" onClick={() => setCreandoVehiculo(true)}
                                        style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.14em', color: '#10b981', background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.25)', borderRadius: 10, padding: '0 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                        + VEHICULO
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div style={{ padding: 14, borderRadius: 12, background: 'rgba(16,185,129,.04)', border: '1px solid rgba(16,185,129,.18)' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                                    <input name="placa" value={vehForm.placa} onChange={onChangeVeh} required placeholder="Placa *" style={inputSt} />
                                    <input name="marca" value={vehForm.marca} onChange={onChangeVeh} required placeholder="Marca *" style={inputSt} />
                                    <input name="modelo" value={vehForm.modelo} onChange={onChangeVeh} placeholder="Modelo" style={inputSt} />
                                    <input name="anio" value={vehForm.anio} onChange={onChangeVeh} placeholder="Año" type="number" style={inputSt} />
                                    <input name="color" value={vehForm.color} onChange={onChangeVeh} placeholder="Color" style={inputSt} />
                                </div>
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button type="button" onClick={() => setCreandoVehiculo(false)} style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                                    <button type="button" onClick={guardarVehiculo} style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', color: '#fff', background: 'linear-gradient(135deg, #059669, #10b981)', border: 'none', borderRadius: 8, padding: '6px 16px', cursor: 'pointer' }}>GUARDAR VEHICULO</button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Descripcion */}
                    <div>
                        <label style={labelSt}>DESCRIPCION DEL TRABAJO *</label>
                        <textarea name="descripcion" value={form.descripcion} onChange={onChange} required
                            rows={3} placeholder="Describe el trabajo a realizar, la necesidad del cliente o la reparacion solicitada..."
                            style={{ ...inputSt, resize: 'vertical', minHeight: 72 }} />
                    </div>

                    {/* Diagnostico + Kilometraje */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 13 }}>
                        <div>
                            <label style={labelSt}>DIAGNOSTICO</label>
                            <textarea name="diagnostico" value={form.diagnostico} onChange={onChange}
                                rows={2} placeholder="Hallazgos, causas o notas tecnicas..."
                                style={{ ...inputSt, resize: 'vertical', minHeight: 56 }} />
                        </div>
                        <div>
                            <label style={labelSt}>KM</label>
                            <input type="number" name="kilometraje" value={form.kilometraje} onChange={onChange}
                                placeholder="0" min="0" style={inputSt} />
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}` }}>
                        <button type="button" onClick={onClose}
                            style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                        <button type="submit" disabled={saving}
                            style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1, boxShadow: `0 6px 18px -6px ${SKY}` }}>
                            {saving ? 'GUARDANDO...' : esEdicion ? 'ACTUALIZAR ORDEN' : 'CREAR ORDEN'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
