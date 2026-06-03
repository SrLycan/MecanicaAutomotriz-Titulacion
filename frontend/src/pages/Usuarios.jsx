import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const ROLES = [
    { val: 'administrador', label: 'Administrador', color: '#0ea5e9' },
    { val: 'tecnico',       label: 'Tecnico',       color: '#10b981' },
    { val: 'recepcionista', label: 'Recepcionista', color: '#f59e0b' },
    { val: 'cliente',       label: 'Cliente',       color: '#64748b' },
];
const ESTADOS = [
    { val: 'activo',     label: 'Activo',     color: '#10b981' },
    { val: 'suspendido', label: 'Suspendido', color: '#f59e0b' },
    { val: 'bloqueado',  label: 'Bloqueado',  color: '#ef4444' },
];

function IconSearch()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconPlus()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconTrash()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>; }
function IconShield()  { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function IconLock()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }
function IconPause()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>; }
function IconPlay()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>; }
function IconX()       { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconUsers()   { return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }

export default function Usuarios() {
    const { usuario: yo } = useAuth();
    const { isDark } = useTheme();
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [q, setQ]               = useState('');
    const [filtroRol, setFiltroRol]   = useState('');
    const [filtroEst, setFiltroEst]   = useState('');
    const [modalNew,  setModalNew]  = useState(false);
    const debounceRef = useRef(null);

    // ── Paleta celeste / blanco / negro ──
    const SKY      = '#0ea5e9';
    const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.05)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.18)';

    const txt    = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf  = isDark ? '#cbd5e1' : '#334155';
    const mut    = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const faint  = isDark ? 'rgba(241,245,249,0.38)' : '#94a3b8';
    const bdr    = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.07)';
    const card   = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const cardSh = isDark
        ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)'
        : '0 4px 16px -4px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04)';
    const inputBg = isDark ? '#0b1220' : '#fafcff';

    const cargar = async (qVal = q, rol = filtroRol, est = filtroEst) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (qVal) params.set('q', qVal);
            if (rol)  params.set('rol', rol);
            if (est)  params.set('estado', est);
            const { data } = await api.get(`/users?${params}`);
            setUsuarios(data.usuarios);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al cargar usuarios.');
        } finally { setLoading(false); }
    };

    useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

    const handleQ = (e) => {
        const v = e.target.value; setQ(v);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => cargar(v, filtroRol, filtroEst), 300);
    };

    const cambiarRol = async (u, nuevo) => {
        try {
            await api.put(`/users/${u.id}/rol`, { rol: nuevo });
            toast.success(`Rol actualizado a ${nuevo}.`);
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error.'); }
    };

    const cambiarEstado = async (u, nuevo) => {
        try {
            await api.put(`/users/${u.id}/estado`, { estado: nuevo });
            toast.success(`Estado: ${nuevo}.`);
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error.'); }
    };

    const eliminar = async (u) => {
        if (!window.confirm(`Eliminar a "${u.nombre}"? Esta accion no se puede deshacer.`)) return;
        try {
            await api.delete(`/users/${u.id}`);
            toast.success('Usuario eliminado.');
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar.'); }
    };

    const stats = useMemo(() => {
        const total       = usuarios.length;
        const admins      = usuarios.filter(u => u.rol === 'administrador').length;
        const suspendidos = usuarios.filter(u => u.estado === 'suspendido').length;
        const bloqueados  = usuarios.filter(u => u.estado === 'bloqueado').length;
        return { total, admins, suspendidos, bloqueados };
    }, [usuarios]);

    const hayFiltros = Boolean(q || filtroRol || filtroEst);
    const limpiar = () => { setQ(''); setFiltroRol(''); setFiltroEst(''); cargar('', '', ''); };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500 }}>
            <style>{`
                @keyframes uRowIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
                .u-row { animation: uRowIn .28s ease both; }
                .u-input:focus { border-color: ${SKY} !important; box-shadow: 0 0 0 3px rgba(14,165,233,.14); }
                .u-kpi { transition: transform .25s, border-color .25s; }
                .u-kpi:hover { transform: translateY(-3px); border-color: ${SKY_BDR}; }
            `}</style>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="sswap-chip" style={{ marginBottom: 8 }}>
                        <span className="dot" />
                        <span>SSWAP · ADMIN · USUARIOS</span>
                    </div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Usuarios</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                        Gestion de cuentas: roles, estados y eliminacion
                    </p>
                </div>
                <button onClick={() => setModalNew(true)}
                    style={{
                        display: 'inline-flex', alignItems: 'center', gap: 8,
                        fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em',
                        color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`,
                        border: 'none', borderRadius: 11, padding: '11px 22px', cursor: 'pointer',
                        boxShadow: `0 6px 18px -6px ${SKY}`,
                    }}>
                    <IconPlus /> NUEVO USUARIO
                </button>
            </div>

            {/* ── KPIs ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
                <KpiCard label="Total" value={stats.total}       color={SKY}       bg={card} bdr={bdr} mut={mut} txt={txt} sh={cardSh} />
                <KpiCard label="Administradores" value={stats.admins} color={SKY_DEEP}  bg={card} bdr={bdr} mut={mut} txt={txt} sh={cardSh} />
                <KpiCard label="Suspendidos" value={stats.suspendidos} color="#f59e0b" bg={card} bdr={bdr} mut={mut} txt={txt} sh={cardSh} />
                <KpiCard label="Bloqueados"  value={stats.bloqueados}  color="#ef4444" bg={card} bdr={bdr} mut={mut} txt={txt} sh={cardSh} />
            </div>

            {/* ── Toolbar ── */}
            <div style={{ padding: 16, marginBottom: 16, background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: faint, display: 'flex' }}><IconSearch /></span>
                        <input className="u-input" placeholder="Buscar por nombre o email..."
                               value={q} onChange={handleQ}
                               style={{ padding: '10px 12px 10px 32px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none', width: 250, transition: 'all .18s' }} />
                    </div>
                    <select className="u-input" value={filtroRol}
                            onChange={e => { setFiltroRol(e.target.value); cargar(q, e.target.value, filtroEst); }}
                            style={{ padding: '10px 12px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none' }}>
                        <option value="">Todos los roles</option>
                        {ROLES.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
                    </select>
                    <select className="u-input" value={filtroEst}
                            onChange={e => { setFiltroEst(e.target.value); cargar(q, filtroRol, e.target.value); }}
                            style={{ padding: '10px 12px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none' }}>
                        <option value="">Todos los estados</option>
                        {ESTADOS.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
                    </select>
                    {hayFiltros && (
                        <button onClick={limpiar}
                                style={{ marginLeft: 'auto', fontFamily: "'Bebas Neue'", fontSize: '.66rem', letterSpacing: '.16em', background: 'transparent', border: 'none', cursor: 'pointer', color: mut }}>
                            LIMPIAR TODO ×
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tabla ── */}
            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, overflow: 'hidden', boxShadow: cardSh }}>
                {loading ? (
                    <Loader bdr={bdr} mut={mut} sky={SKY} />
                ) : usuarios.length === 0 ? (
                    <EmptyState txt={txt} mut={mut} skyPale={SKY_PALE} skyBdr={SKY_BDR} sky={SKY} />
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${bdr}`, background: SKY_PALE }}>
                                    {['Usuario','Email','Rol','Estado','Telefono','Acciones'].map(h => (
                                        <th key={h} style={{ padding: '13px 18px', textAlign: 'left', fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP, whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map((u, idx) => {
                                    const rolM = ROLES.find(r => r.val === u.rol) || ROLES[3];
                                    const estM = ESTADOS.find(s => s.val === u.estado) || ESTADOS[0];
                                    const esYo = u.id === yo?.id;
                                    return (
                                        <tr key={u.id} className="u-row"
                                            style={{ borderBottom: `1px solid ${bdr}`, transition: 'background .15s', animationDelay: `${Math.min(idx * 16, 220)}ms` }}
                                            onMouseEnter={e => e.currentTarget.style.background = SKY_PALE}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '13px 18px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: "'Bebas Neue'", fontSize: '.92rem', flexShrink: 0 }}>
                                                        {u.nombre?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem', color: txt }}>
                                                            {u.nombre} {esYo && <span style={{ fontSize: '.7rem', color: SKY, fontWeight: 500 }}>(tu)</span>}
                                                        </p>
                                                        {u.cedula && <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut, marginTop: 1 }}>CI {u.cedula}</p>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '13px 18px', fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf }}>{u.email}</td>
                                            <td style={{ padding: '13px 18px' }}>
                                                <select value={u.rol} disabled={esYo}
                                                        onChange={e => cambiarRol(u, e.target.value)}
                                                        style={{
                                                            padding: '5px 9px', borderRadius: 999,
                                                            background: rolM.color + '15', border: `1px solid ${rolM.color}40`, color: rolM.color,
                                                            fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.16em',
                                                            cursor: esYo ? 'not-allowed' : 'pointer', outline: 'none',
                                                            opacity: esYo ? .55 : 1,
                                                        }}>
                                                    {ROLES.map(r => <option key={r.val} value={r.val}>{r.label.toUpperCase()}</option>)}
                                                </select>
                                            </td>
                                            <td style={{ padding: '13px 18px' }}>
                                                <span style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 6,
                                                    padding: '4px 10px', borderRadius: 999,
                                                    background: estM.color + '12', border: `1px solid ${estM.color}38`, color: estM.color,
                                                    fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.14em',
                                                }}>
                                                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: estM.color }} />
                                                    {estM.label.toUpperCase()}
                                                </span>
                                            </td>
                                            <td style={{ padding: '13px 18px', fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, whiteSpace: 'nowrap' }}>{u.telefono || '—'}</td>
                                            <td style={{ padding: '13px 18px' }}>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {u.estado !== 'activo' && !esYo && (
                                                        <ActionBtn title="Activar" color="#10b981" bdr={bdr}
                                                                   onClick={() => cambiarEstado(u, 'activo')}>
                                                            <IconPlay />
                                                        </ActionBtn>
                                                    )}
                                                    {u.estado === 'activo' && !esYo && (
                                                        <ActionBtn title="Suspender" color="#f59e0b" bdr={bdr}
                                                                   onClick={() => cambiarEstado(u, 'suspendido')}>
                                                            <IconPause />
                                                        </ActionBtn>
                                                    )}
                                                    {u.estado !== 'bloqueado' && !esYo && (
                                                        <ActionBtn title="Bloquear" color="#ef4444" bdr={bdr}
                                                                   onClick={() => cambiarEstado(u, 'bloqueado')}>
                                                            <IconLock />
                                                        </ActionBtn>
                                                    )}
                                                    {u.rol !== 'administrador' && !esYo && (
                                                        <ActionBtn title="Hacer administrador" color={SKY_DEEP} bdr={bdr}
                                                                   onClick={() => cambiarRol(u, 'administrador')}>
                                                            <IconShield />
                                                        </ActionBtn>
                                                    )}
                                                    {!esYo && (
                                                        <ActionBtn title="Eliminar" color="#ef4444" bdr={bdr}
                                                                   onClick={() => eliminar(u)}>
                                                            <IconTrash />
                                                        </ActionBtn>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modalNew && <ModalNuevoUsuario onClose={() => setModalNew(false)} onCreado={() => { setModalNew(false); cargar(); }} />}
        </div>
    );
}

function Loader({ bdr, mut, sky }) {
    return (
        <div style={{ padding: 80, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${bdr}`, borderTopColor: sky, animation: 'spin 1s linear infinite' }} />
            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.85rem', color: mut }}>Cargando usuarios...</p>
        </div>
    );
}

function EmptyState({ txt, mut, skyPale, skyBdr, sky }) {
    return (
        <div style={{ padding: 90, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 64, height: 64, borderRadius: 18, background: skyPale, border: `1px solid ${skyBdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: sky }}>
                <IconUsers />
            </div>
            <div>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.06em', color: txt }}>Sin usuarios</p>
                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut, marginTop: 4 }}>No hay resultados con los filtros aplicados</p>
            </div>
        </div>
    );
}

function ActionBtn({ color, bdr, title, onClick, children }) {
    return (
        <button onClick={onClick} title={title}
            style={{
                background: 'none', border: `1px solid ${bdr}`, borderRadius: 8,
                padding: 6, cursor: 'pointer', color, display: 'flex',
                alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = color + '14'; e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = bdr; e.currentTarget.style.transform = 'none'; }}>
            {children}
        </button>
    );
}

function KpiCard({ label, value, color, bg, bdr, mut, txt, sh }) {
    return (
        <div className="u-kpi" style={{ padding: 18, background: bg, border: `1px solid ${bdr}`, borderRadius: 14, position: 'relative', overflow: 'hidden', boxShadow: sh }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: `linear-gradient(180deg, ${color}, transparent)` }} />
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.22em', color: mut }}>{label.toUpperCase()}</p>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.9rem', letterSpacing: '.02em', color, lineHeight: 1, marginTop: 6 }}>{value}</p>
        </div>
    );
}

function ModalNuevoUsuario({ onClose, onCreado }) {
    const { isDark } = useTheme();
    const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'tecnico', telefono: '', cedula: '' });
    const [saving, setSaving] = useState(false);

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.10)';
    const inputBg = isDark ? '#0b1220' : '#f8fafc';
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';

    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.88rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP };

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const onSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/users', form);
            toast.success('Usuario creado.');
            onCreado();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al crear usuario.');
        } finally { setSaving(false); }
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 540, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${SKY}, ${SKY_DEEP}, ${SKY}, transparent)`, borderRadius: '20px 20px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>ADMIN · USUARIOS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt }}>Nuevo Usuario</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}>
                        <IconX />
                    </button>
                </div>
                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>NOMBRE *</label>
                            <input name="nombre" value={form.nombre} onChange={onChange} required style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>EMAIL *</label>
                            <input type="email" name="email" value={form.email} onChange={onChange} required style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>CONTRASEÑA *</label>
                            <input type="password" name="password" value={form.password} onChange={onChange} required minLength={6} style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>ROL *</label>
                            <select name="rol" value={form.rol} onChange={onChange} style={inputSt}>
                                {ROLES.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelSt}>TELEFONO</label>
                            <input name="telefono" value={form.telefono} onChange={onChange} style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>CEDULA</label>
                            <input name="cedula" value={form.cedula} onChange={onChange} style={inputSt} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}`, marginTop: 4 }}>
                        <button type="button" onClick={onClose}
                                style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>
                            CANCELAR
                        </button>
                        <button type="submit" disabled={saving}
                                style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1, boxShadow: `0 6px 18px -6px ${SKY}` }}>
                            {saving ? 'CREANDO...' : 'CREAR USUARIO'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
