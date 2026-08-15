import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useConfirm } from '../components/common/ConfirmDialog';
import './Usuarios.css';

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
function IconLock()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }
function IconX()       { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconUsers()   { return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconEdit()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }

export default function Usuarios() {
    const confirm = useConfirm();
    const { usuario: yo } = useAuth();
    const { isDark } = useTheme();
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [q, setQ]               = useState('');
    const [filtroRol, setFiltroRol]   = useState('');
    const [filtroEst, setFiltroEst]   = useState('');
    const [modalNew,    setModalNew]  = useState(false);
    const [modalEdit,   setModalEdit] = useState(null);
    const [modalPass,   setModalPass] = useState(null);
    const [modalAccion, setModalAccion] = useState(null);
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
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';

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
        if (!(await confirm({ message: `Eliminar a "${u.nombre}"? Esta accion no se puede deshacer.` }))) return;
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
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500, '--sky-bdr': SKY_BDR }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="SS SWAP-chip" style={{ marginBottom: 8 }}>
                        <span className="dot" />
                        <span>SS SWAP · ADMIN · USUARIOS</span>
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
            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh }}>
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
                                                {!esYo && (
                                                    <button onClick={() => setModalAccion(u)}
                                                        style={{
                                                            background: 'none',
                                                            border: `1px solid ${bdr}`,
                                                            borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                                                            color: mut,
                                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                                            fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.12em',
                                                            transition: 'all .15s',
                                                        }}
                                                        onMouseEnter={e => { e.currentTarget.style.background = SKY_DEEP + '14'; e.currentTarget.style.borderColor = SKY_BDR; e.currentTarget.style.color = SKY_DEEP; }}
                                                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = bdr; e.currentTarget.style.color = mut; }}>
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                                                        ACCIONES
                                                    </button>
                                                )}
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
            {modalEdit && <ModalEditarUsuario usuario={modalEdit} onClose={() => setModalEdit(null)} onActualizado={() => { setModalEdit(null); cargar(); }} />}
            {modalPass && <ModalCambiarPassword usuario={modalPass} onClose={() => setModalPass(null)} onCambiado={() => { setModalPass(null); }} />}
            {modalAccion && <ModalAccionesUsuario usuario={modalAccion} onClose={() => setModalAccion(null)}
                onAccion={(accion) => {
                    const u = modalAccion;
                    setModalAccion(null);
                    if (accion === 'editar') setModalEdit(u);
                    else if (accion === 'password') setModalPass(u);
                    else if (accion === 'eliminar') eliminar(u);
                }}
                onCambiarRol={(rol) => { setModalAccion(null); cambiarRol(modalAccion, rol); }}
                onCambiarEstado={(est) => { setModalAccion(null); cambiarEstado(modalAccion, est); }}
            />}
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

function KpiCard({ label, value, color, bg, bdr, mut, txt, sh }) {
    return (
        <div className="u-kpi" style={{ padding: 18, background: bg, border: `1px solid ${bdr}`, borderRadius: 14, position: 'relative', overflow: 'hidden', boxShadow: sh }}>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: `linear-gradient(180deg, ${color}, transparent)` }} />
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.22em', color: mut }}>{label.toUpperCase()}</p>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.9rem', letterSpacing: '.02em', color, lineHeight: 1, marginTop: 6 }}>{value}</p>
        </div>
    );
}

function ModalEditarUsuario({ usuario, onClose, onActualizado }) {
    const { isDark } = useTheme();
    const [form, setForm] = useState({ nombre: usuario.nombre || '', email: usuario.email || '', telefono: usuario.telefono || '', cedula: usuario.cedula || '' });
    const [saving, setSaving] = useState(false);

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.10)';
    const inputBg = isDark ? '#0b1220' : '#f8fafc';
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';

    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.88rem', outline: 'none' };
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
        setSaving(true);
        try {
            await api.put(`/users/${usuario.id}`, form);
            toast.success('Usuario actualizado.');
            onActualizado();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al actualizar usuario.');
        } finally { setSaving(false); }
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 540, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${SKY}, ${SKY_DEEP}, ${SKY}, transparent)`, borderRadius: '20px 20px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>ADMIN · USUARIOS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt }}>Editar Usuario</h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.78rem', color: mut, marginTop: 4 }}>{usuario.nombre}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}><IconX /></button>
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
                            <label style={labelSt}>TELEFONO</label>
                            <input name="telefono" value={form.telefono} onChange={onChange} placeholder="+593..." style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>CEDULA</label>
                            <input name="cedula" value={form.cedula} onChange={onChange} maxLength={15} style={inputSt} />
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}`, marginTop: 4 }}>
                        <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                        <button type="submit" disabled={saving} style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1, boxShadow: `0 6px 18px -6px ${SKY}` }}>
                            {saving ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ModalCambiarPassword({ usuario, onClose, onCambiado }) {
    const { isDark } = useTheme();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.10)';
    const inputBg = isDark ? '#0b1220' : '#f8fafc';
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';

    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.88rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: '#f59e0b' };

    const onSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (password.length < 6) { setError('La contrasena debe tener al menos 6 caracteres.'); return; }
        if (password !== confirm) { setError('Las contrasenas no coinciden.'); return; }
        setSaving(true);
        try {
            await api.put(`/users/${usuario.id}/password`, { password });
            toast.success('Contrasena actualizada correctamente.');
            onCambiado();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al cambiar contrasena.');
        } finally { setSaving(false); }
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 480, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, #f59e0b, #d97706, #f59e0b, transparent)`, borderRadius: '20px 20px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: '#f59e0b', marginBottom: 6 }}>ADMIN · SEGURIDAD</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt }}>Cambiar Contrasena</h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.78rem', color: mut, marginTop: 4 }}>{usuario.nombre} · {usuario.email}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}><IconX /></button>
                </div>
                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                        <label style={labelSt}>NUEVA CONTRASENA *</label>
                        <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(''); }} required minLength={6} placeholder="Minimo 6 caracteres" style={inputSt} />
                    </div>
                    <div>
                        <label style={labelSt}>CONFIRMAR CONTRASENA *</label>
                        <input type="password" value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }} required placeholder="Repite la contrasena" style={inputSt} />
                    </div>
                    {error && (
                        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', fontFamily: "'Outfit'", fontSize: '.82rem' }}>{error}</div>
                    )}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}`, marginTop: 4 }}>
                        <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                        <button type="submit" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 7, fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: 'linear-gradient(135deg, #d97706, #f59e0b)', border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1, boxShadow: '0 6px 18px -6px #f59e0b' }}>
                            {saving ? 'GUARDANDO...' : 'ACTUALIZAR CONTRASENA'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ModalAccionesUsuario({ usuario, onClose, onAccion, onCambiarRol, onCambiarEstado }) {
    const { isDark } = useTheme();
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.10)';
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';

    const SKY_DEEP = '#0284c7';

    const ActionBtn = ({ icon, label, color, desc, onClick }) => (
        <button onClick={onClick}
            style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                padding: '13px 16px', border: `1px solid ${bdr}`, borderRadius: 12,
                background: 'transparent', cursor: 'pointer', textAlign: 'left',
                transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = (color || SKY_DEEP) + '60'; e.currentTarget.style.background = (color || SKY_DEEP) + '08'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = bdr; e.currentTarget.style.background = 'transparent'; }}>
            <span style={{
                width: 36, height: 36, borderRadius: 10,
                background: (color || SKY_DEEP) + '14', color: color || SKY_DEEP,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>{icon}</span>
            <div>
                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.85rem', color: color || txt }}>{label}</p>
                {desc && <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.72rem', color: mut, marginTop: 2 }}>{desc}</p>}
            </div>
        </button>
    );

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 480, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${SKY_DEEP}, #0ea5e9, ${SKY_DEEP}, transparent)`, borderRadius: '20px 20px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>ADMIN · USUARIOS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt }}>Acciones</h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.78rem', color: mut, marginTop: 4 }}>{usuario.nombre} · {usuario.email}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}>
                        <IconX />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {/* Editar */}
                    <ActionBtn icon={<IconEdit />} label="Editar usuario" desc="Modificar nombre, email, telefono y cedula" onClick={() => onAccion('editar')} />
                    {/* Cambiar contrasena */}
                    <ActionBtn icon={<IconLock />} label="Cambiar contrasena" desc="Restablecer la contrasena del usuario" color="#f59e0b" onClick={() => onAccion('password')} />

                    {/* Separador */}
                    <div style={{ height: 1, background: bdr, margin: '4px 0' }} />

                    {/* Cambiar rol */}
                    <div>
                        <p style={{ padding: '4px 0 6px', fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.2em', color: mut }}>CAMBIAR ROL</p>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {ROLES.filter(r => r.val !== usuario.rol).map(r => (
                                <button key={r.val} onClick={() => onCambiarRol(r.val)}
                                    style={{
                                        padding: '7px 14px', borderRadius: 999,
                                        background: r.color + '14', border: `1px solid ${r.color}40`,
                                        color: r.color, cursor: 'pointer',
                                        fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.16em',
                                        transition: 'all .12s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = r.color + '28'}
                                    onMouseLeave={e => e.currentTarget.style.background = r.color + '14'}>
                                    {r.label.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cambiar estado */}
                    <div>
                        <p style={{ padding: '6px 0 6px', fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.2em', color: mut }}>CAMBIAR ESTADO</p>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {ESTADOS.filter(s => s.val !== usuario.estado).map(s => (
                                <button key={s.val} onClick={() => onCambiarEstado(s.val)}
                                    style={{
                                        padding: '7px 14px', borderRadius: 999,
                                        background: s.color + '14', border: `1px solid ${s.color}40`,
                                        color: s.color, cursor: 'pointer',
                                        fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.16em',
                                        transition: 'all .12s',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.background = s.color + '28'}
                                    onMouseLeave={e => e.currentTarget.style.background = s.color + '14'}>
                                    {s.label.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Separador */}
                    <div style={{ height: 1, background: bdr, margin: '4px 0' }} />

                    {/* Eliminar */}
                    <ActionBtn icon={<IconTrash />} label="Eliminar usuario" desc="Esta accion no se puede deshacer" color="#ef4444" onClick={() => onAccion('eliminar')} />
                </div>
            </div>
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
                            <input name="telefono" value={form.telefono} onChange={onChange} placeholder="+593..." style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>CEDULA</label>
                            <input name="cedula" value={form.cedula} onChange={onChange} maxLength={15} style={inputSt} />
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
