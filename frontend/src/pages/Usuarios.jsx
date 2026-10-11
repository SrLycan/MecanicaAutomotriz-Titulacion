/**
 * SS SWAP - Gestión de usuarios y permisos DE LA EMPRESA
 *
 * Cada empresa gestiona a su propio personal (permiso "usuarios"); el
 * servidor aísla los datos por empresa. Quien gestiona solo puede conceder
 * o quitar los permisos que él mismo tiene: el resto se muestra bloqueado.
 *
 * - Lista de cuentas (personal y clientes del portal) con búsqueda por
 *   nombre, correo o cédula, y filtros por rol y estado.
 * - Alta de cuentas: contraseña propia o temporal generada por el servidor
 *   (se muestra una sola vez) y permisos iniciales según el rol.
 * - Ficha de cada cuenta: permisos por módulo y acción (con "todo el módulo"
 *   y plantillas por rol), datos, rol, activar/desactivar, restablecer acceso,
 *   cerrar sesiones e historial de cambios.
 *
 * Todo lo valida el backend (soloSuperadmin + catálogo de permisos); esta
 * pantalla solo es la interfaz. Las cuentas de superadministrador no se
 * pueden modificar desde aquí: se gestionan con "npm run superadmin".
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import useParamUrl from '../hooks/useParamUrl';
import { useAuth } from '../context/AuthContext';
import { usePaleta, bebas, outfit, Pildora, BotonPrimario, BotonSecundario, Modal, KpiCard } from '../components/common/PanelUI';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useConfirm } from '../components/common/ConfirmDialog';
import './Usuarios.css';
import './Proveedores.css'; // pestañas (.prov-tabs), igual que Clientes y Finanzas

export const ROLES = [
    { val: 'superadministrador', label: 'Superadministrador', color: '#a855f7' },
    { val: 'administrador', label: 'Administrador', color: '#0ea5e9' },
    { val: 'tecnico',       label: 'Técnico',       color: '#10b981' },
    { val: 'recepcionista', label: 'Recepcionista', color: '#f59e0b' },
    { val: 'interno',       label: 'Personal interno', color: '#6366f1' },
    { val: 'cliente',       label: 'Cliente (portal)', color: '#64748b' },
];
const ROLES_ASIGNABLES = ROLES.filter(r => r.val !== 'superadministrador');
const ROLES_STAFF = ['superadministrador', 'administrador', 'tecnico', 'recepcionista', 'interno'];
const ESTADOS = [
    { val: 'activo',     label: 'Activo',     color: '#10b981' },
    { val: 'suspendido', label: 'Suspendido', color: '#f59e0b' },
    { val: 'bloqueado',  label: 'Bloqueado',  color: '#ef4444' },
];
const rolMeta = (rol) => ROLES.find(r => r.val === rol) || { val: rol, label: rol, color: '#64748b' };
const estadoMeta = (est) => ESTADOS.find(s => s.val === est) || ESTADOS[0];
const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

function IconSearch()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconPlus()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconUsers()   { return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>; }
function IconShield()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>; }
function IconLock()    { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }

// ═════════════════════════════════════════════════════════════
// Página
// ═════════════════════════════════════════════════════════════
export default function Usuarios() {
    const p = usePaleta();
    const { usuario: yo, puede, empresa } = useAuth();
    const [usuarios, setUsuarios] = useState([]);
    const [catalogo, setCatalogo] = useState(null);
    const [loading, setLoading]   = useState(true);
    const [q, setQ]               = useState('');
    // El rol se lee de la URL (?rol=tecnico) para que el submenu abra la lista filtrada.
    const [rolUrl, setRolUrl] = useParamUrl('rol', '', ['staff', ...ROLES.map(r => r.val)]);
    const [filtroEst, setFiltroEst] = useState('');
    const [modalNuevo, setModalNuevo] = useState(false);
    const [fichaId, setFichaId] = useState(null);
    const [passwordMostrar, setPasswordMostrar] = useState(null);
    const debounceRef = useRef(null);

    const cargar = useCallback(async (qVal, rol, est) => {
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
    }, []);

    const recargar = () => cargar(q, rolUrl, filtroEst);

    useEffect(() => { cargar(q, rolUrl, filtroEst); /* eslint-disable-next-line */ }, [rolUrl]);
    useEffect(() => {
        api.get('/users/catalogo-permisos').then(r => setCatalogo(r.data)).catch(() => toast.error('No se pudo cargar el catálogo de permisos.'));
    }, []);

    const handleQ = (e) => {
        const v = e.target.value; setQ(v);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => cargar(v, rolUrl, filtroEst), 300);
    };

    const stats = useMemo(() => {
        const personal = usuarios.filter(u => ROLES_STAFF.includes(u.rol));
        return {
            personal: personal.length,
            activos: personal.filter(u => u.estado === 'activo').length,
            inactivos: usuarios.filter(u => u.estado !== 'activo').length,
            clientes: usuarios.filter(u => u.rol === 'cliente').length,
        };
    }, [usuarios]);

    const hayFiltros = Boolean(q || rolUrl || filtroEst);
    const limpiar = () => { setQ(''); setFiltroEst(''); if (rolUrl) setRolUrl(''); else cargar('', '', ''); };
    const selectSt = { padding: '10px 12px', background: p.inputBg, border: `1px solid ${p.bdr}`, borderRadius: 10, color: p.txt, ...outfit('.85rem'), outline: 'none' };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500, '--sky-bdr': p.SKY_BDR }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>{(empresa?.nombre || 'SS SWAP').toUpperCase()} · USUARIOS Y PERMISOS</span></div>
                    <h1 style={{ ...bebas('2.6rem', '.04em'), color: p.txt, lineHeight: 1 }}>Usuarios y permisos</h1>
                    <p style={{ ...outfit('.85rem'), color: p.mut, marginTop: 6, maxWidth: 640 }}>
                        Crea cuentas del personal y decide, módulo por módulo, qué puede ver y hacer cada persona.
                        Los cambios se aplican en su siguiente acción, sin cerrar su sesión.
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {puede('auditoria', 'ver') && (
                        <Link to="/dashboard/auditoria" style={{ textDecoration: 'none' }}>
                            <BotonSecundario color={p.SKY_DEEP}><IconShield /> AUDITORÍA</BotonSecundario>
                        </Link>
                    )}
                    {puede('usuarios', 'crear') && (
                        <BotonPrimario onClick={() => setModalNuevo(true)} disabled={!catalogo}><IconPlus /> NUEVO USUARIO</BotonPrimario>
                    )}
                </div>
            </div>

            {/* ── KPIs ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
                <KpiCard label="Personal" value={stats.personal} color={p.SKY} />
                <KpiCard label="Personal activo" value={stats.activos} color="#10b981" />
                <KpiCard label="Cuentas inactivas" value={stats.inactivos} color="#ef4444" />
                <KpiCard label="Clientes del portal" value={stats.clientes} color="#64748b" />
            </div>

            {/* ── Toolbar ── */}
            <div style={{ padding: 16, marginBottom: 16, background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, boxShadow: p.cardSh }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
                        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: p.faint, display: 'flex' }}><IconSearch /></span>
                        <input className="u-input" placeholder="Buscar por nombre, correo o cédula..." aria-label="Buscar usuarios"
                            value={q} onChange={handleQ}
                            style={{ ...selectSt, padding: '10px 12px 10px 32px', width: '100%', boxSizing: 'border-box' }} />
                    </div>
                    <select className="u-input" aria-label="Filtrar por rol" value={rolUrl} onChange={e => setRolUrl(e.target.value)} style={selectSt}>
                        <option value="">Todos los roles</option>
                        <option value="staff">Todo el personal</option>
                        {ROLES.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
                    </select>
                    <select className="u-input" aria-label="Filtrar por estado" value={filtroEst}
                        onChange={e => { setFiltroEst(e.target.value); cargar(q, rolUrl, e.target.value); }} style={selectSt}>
                        <option value="">Todos los estados</option>
                        {ESTADOS.map(s => <option key={s.val} value={s.val}>{s.label}</option>)}
                    </select>
                    {hayFiltros && (
                        <button onClick={limpiar} style={{ marginLeft: 'auto', ...bebas('.66rem', '.16em'), background: 'transparent', border: 'none', cursor: 'pointer', color: p.mut }}>LIMPIAR TODO ×</button>
                    )}
                </div>
            </div>

            {/* ── Tabla ── */}
            <div style={{ background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, boxShadow: p.cardSh }}>
                {loading ? (
                    <div style={{ padding: 80, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${p.bdr}`, borderTopColor: p.SKY, animation: 'spin 1s linear infinite' }} />
                        <p style={{ ...outfit('.85rem', 300), color: p.mut }}>Cargando usuarios...</p>
                    </div>
                ) : usuarios.length === 0 ? (
                    <div style={{ padding: 90, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 64, height: 64, borderRadius: 18, background: p.SKY_PALE, border: `1px solid ${p.SKY_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: p.SKY }}><IconUsers /></div>
                        <p style={{ ...bebas('1.4rem', '.06em'), color: p.txt }}>Sin usuarios</p>
                        <p style={{ ...outfit('.82rem', 300), color: p.mut }}>No hay resultados con los filtros aplicados</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${p.bdr}`, background: p.SKY_PALE }}>
                                    {['Usuario', 'Rol', 'Estado', 'Permisos', 'Último acceso', ''].map(h => (
                                        <th key={h} style={{ padding: '13px 18px', textAlign: 'left', ...bebas('.62rem', '.22em'), color: p.SKY_DEEP, whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {usuarios.map((u, idx) => {
                                    const rm = rolMeta(u.rol);
                                    const em = estadoMeta(u.estado);
                                    const esYo = u.id === yo?.id;
                                    const esSuper = u.rol === 'superadministrador';
                                    return (
                                        <tr key={u.id} className="u-row"
                                            // Toda la fila abre la ficha (en pantallas angostas el boton puede quedar fuera de vista).
                                            onClick={esSuper ? undefined : () => setFichaId(u.id)}
                                            style={{ borderBottom: `1px solid ${p.bdr}`, transition: 'background .15s', animationDelay: `${Math.min(idx * 16, 220)}ms`, opacity: u.estado === 'activo' ? 1 : .72, cursor: esSuper ? 'default' : 'pointer' }}
                                            onMouseEnter={e => { e.currentTarget.style.background = p.SKY_PALE; }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                                            <td style={{ padding: '12px 18px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg, ${rm.color}, ${rm.color}aa)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', ...bebas('.92rem', 0), flexShrink: 0 }}>
                                                        {u.nombre?.[0]?.toUpperCase()}
                                                    </div>
                                                    <div style={{ minWidth: 0 }}>
                                                        <p style={{ ...outfit('.88rem', 600), color: p.txt }}>
                                                            {u.nombre} {esYo && <span style={{ ...outfit('.7rem', 500), color: p.SKY }}>(tú)</span>}
                                                        </p>
                                                        <p style={{ ...outfit('.76rem'), color: p.txtSf }}>{u.email}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '12px 18px' }}><Pildora color={rm.color}>{rm.label.toUpperCase()}</Pildora></td>
                                            <td style={{ padding: '12px 18px' }}><Pildora color={em.color}>{em.label.toUpperCase()}</Pildora></td>
                                            <td style={{ padding: '12px 18px', ...outfit('.8rem'), color: p.txtSf, whiteSpace: 'nowrap' }}>
                                                {esSuper ? <span style={{ color: rm.color, fontWeight: 600 }}>Acceso total</span>
                                                    : u.rol === 'cliente' ? <span style={{ color: p.faint }}>Solo portal</span>
                                                        : u.total_permisos ? `${u.total_permisos} permiso(s)` : <span style={{ color: '#ef4444' }}>Sin acceso</span>}
                                            </td>
                                            <td style={{ padding: '12px 18px', ...outfit('.78rem'), color: p.mut, whiteSpace: 'nowrap' }}>{fechaHora(u.ultimo_acceso)}</td>
                                            <td style={{ padding: '12px 18px', textAlign: 'right' }}>
                                                {esSuper ? (
                                                    <span title="Se gestiona desde el servidor (npm run superadmin)" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, ...bebas('.6rem', '.12em'), color: p.faint }}><IconLock /> PROTEGIDO</span>
                                                ) : (
                                                    <BotonSecundario color={p.SKY_DEEP} onClick={(e) => { e.stopPropagation(); setFichaId(u.id); }}>
                                                        {ROLES_STAFF.includes(u.rol) ? 'PERMISOS Y CUENTA' : 'GESTIONAR'}
                                                    </BotonSecundario>
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

            {modalNuevo && catalogo && (
                <ModalNuevoUsuario catalogo={catalogo} onClose={() => setModalNuevo(false)}
                    onCreado={(resp) => {
                        setModalNuevo(false);
                        recargar();
                        if (resp.password_temporal) setPasswordMostrar({ email: resp.usuario.email, password: resp.password_temporal });
                    }} />
            )}
            {fichaId && catalogo && (
                <FichaUsuario id={fichaId} catalogo={catalogo} onClose={() => setFichaId(null)}
                    onCambio={recargar}
                    onPasswordTemporal={(email, password) => setPasswordMostrar({ email, password })} />
            )}
            {passwordMostrar && <ModalPasswordTemporal {...passwordMostrar} onClose={() => setPasswordMostrar(null)} />}
        </div>
    );
}


// ═════════════════════════════════════════════════════════════
// Editor de permisos
// ═════════════════════════════════════════════════════════════
/**
 * Casillas por módulo y acción, agrupadas como el menú lateral.
 * `valor` es un Set de 'modulo:accion'; `onChange` recibe el nuevo Set.
 * Solo se pueden marcar o desmarcar los permisos "concedibles" (los que la
 * persona que edita tiene); el resto queda bloqueado y no se modifica.
 */
export function EditorPermisos({ catalogo, valor, onChange, rol }) {
    const p = usePaleta();
    const grupos = useMemo(() => {
        const g = new Map();
        for (const m of catalogo.modulos) {
            if (!g.has(m.grupo)) g.set(m.grupo, []);
            g.get(m.grupo).push(m);
        }
        return [...g.entries()];
    }, [catalogo]);

    const concedibles = useMemo(() => new Set(catalogo.concedibles
        || catalogo.modulos.flatMap(m => m.acciones.map(a => `${m.codigo}:${a.codigo}`))), [catalogo]);
    const bloqueados = [...valor].filter(c => !concedibles.has(c)); // se conservan siempre

    const alternar = (clave) => {
        if (!concedibles.has(clave)) return;
        const s = new Set(valor);
        if (s.has(clave)) s.delete(clave); else s.add(clave);
        onChange(s);
    };
    const alternarModulo = (m) => {
        const claves = m.acciones.map(a => `${m.codigo}:${a.codigo}`).filter(c => concedibles.has(c));
        const todas = claves.every(c => valor.has(c));
        const s = new Set(valor);
        claves.forEach(c => (todas ? s.delete(c) : s.add(c)));
        onChange(s);
    };
    const plantilla = catalogo.plantillas?.[rol];
    const aplicar = (lista) => onChange(new Set([...bloqueados, ...lista.filter(c => concedibles.has(c))]));

    return (
        <div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ ...outfit('.8rem'), color: p.mut, flex: '1 1 200px' }}>
                    {valor.size} permiso(s) seleccionado(s)
                </span>
                {plantilla && (
                    <BotonSecundario onClick={() => aplicar(plantilla)} title="Reemplaza la selección por los permisos típicos del rol (solo los que puedes conceder)">
                        APLICAR PLANTILLA DE {rolMeta(rol).label.toUpperCase()}
                    </BotonSecundario>
                )}
                <BotonSecundario onClick={() => aplicar([])} color="#ef4444">QUITAR TODO</BotonSecundario>
            </div>
            {concedibles.size < catalogo.modulos.reduce((n, m) => n + m.acciones.length, 0) && (
                <p style={{ ...outfit('.76rem'), color: p.mut, marginBottom: 10 }}>
                    Los permisos con candado no los tienes tú, así que no puedes concederlos ni quitarlos.
                </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {grupos.map(([grupo, modulos]) => (
                    <fieldset key={grupo} style={{ border: `1px solid ${p.bdr}`, borderRadius: 12, padding: '10px 14px 4px', margin: 0 }}>
                        <legend style={{ ...bebas('.7rem', '.2em'), color: p.SKY_DEEP, padding: '0 6px' }}>{grupo.toUpperCase()}</legend>
                        {modulos.map(m => {
                            const claves = m.acciones.map(a => `${m.codigo}:${a.codigo}`);
                            const marcadas = claves.filter(c => valor.has(c)).length;
                            const todas = marcadas === claves.length;
                            return (
                                <div key={m.codigo} style={{ padding: '9px 0', borderTop: `1px dashed ${p.bdr}`, display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) 2fr', gap: 10, alignItems: 'start' }} className="perm-fila">
                                    <div>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                            <input type="checkbox" checked={todas}
                                                ref={el => { if (el) el.indeterminate = marcadas > 0 && !todas; }}
                                                onChange={() => alternarModulo(m)}
                                                aria-label={`Todo el módulo ${m.nombre}`} />
                                            <span style={{ ...outfit('.86rem', 600), color: marcadas ? p.txt : p.mut }}>{m.nombre}</span>
                                        </label>
                                        {m.descripcion && <p style={{ ...outfit('.72rem', 300), color: p.mut, marginTop: 3, marginLeft: 24 }}>{m.descripcion}</p>}
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                        {m.acciones.map(a => {
                                            const clave = `${m.codigo}:${a.codigo}`;
                                            const on = valor.has(clave);
                                            const libre = concedibles.has(clave);
                                            return (
                                                <label key={clave} title={libre ? undefined : 'No puedes conceder ni quitar un permiso que no tienes'} style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: 6, cursor: libre ? 'pointer' : 'not-allowed', opacity: libre ? 1 : .55,
                                                    padding: '5px 10px', borderRadius: 999, userSelect: 'none',
                                                    border: `1px solid ${on ? p.SKY + '88' : p.bdr}`,
                                                    background: on ? p.SKY_PALE : 'transparent',
                                                    ...outfit('.76rem', on ? 600 : 400), color: on ? p.SKY_DEEP : p.mut,
                                                }}>
                                                    <input type="checkbox" checked={on} disabled={!libre} onChange={() => alternar(clave)} style={{ margin: 0 }} />
                                                    {!libre && <IconLock />}
                                                    {a.nombre}
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </fieldset>
                ))}
            </div>
        </div>
    );
}

// ═════════════════════════════════════════════════════════════
// Nueva cuenta
// ═════════════════════════════════════════════════════════════
function ModalNuevoUsuario({ catalogo, onClose, onCreado }) {
    const p = usePaleta();
    const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'interno', telefono: '', cedula: '' });
    const [generar, setGenerar] = useState(true);
    const [permisos, setPermisos] = useState(() => new Set(catalogo.plantillas.interno || []));
    const [saving, setSaving] = useState(false);
    const esStaff = form.rol !== 'cliente';

    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.88rem'), outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, ...bebas('.62rem', '.22em'), color: p.SKY_DEEP };

    const onChange = (e) => {
        const { name, value } = e.target;
        if (name === 'rol') setPermisos(new Set(catalogo.plantillas[value] || []));
        setForm(f => ({ ...f, [name]: value }));
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!generar && form.password.length < 8) { toast.error('La contraseña debe tener al menos 8 caracteres.'); return; }
        setSaving(true);
        try {
            const body = { ...form, password: generar ? undefined : form.password, permisos: esStaff ? [...permisos] : undefined };
            const { data } = await api.post('/users', body);
            toast.success('Usuario creado.');
            onCreado(data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al crear usuario.');
        } finally { setSaving(false); }
    };

    return (
        <Modal titulo="Nuevo usuario" subtitulo="Cuenta del personal con acceso solo a los módulos que marques." onClose={onClose} ancho={860}>
            <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 13 }}>
                    <div><label style={labelSt} htmlFor="nu-nombre">NOMBRE *</label><input id="nu-nombre" name="nombre" value={form.nombre} onChange={onChange} required maxLength={100} style={inputSt} /></div>
                    <div><label style={labelSt} htmlFor="nu-email">CORREO (USUARIO DE ACCESO) *</label><input id="nu-email" type="email" name="email" value={form.email} onChange={onChange} required maxLength={150} style={inputSt} /></div>
                    <div>
                        <label style={labelSt} htmlFor="nu-rol">ROL *</label>
                        <select id="nu-rol" name="rol" value={form.rol} onChange={onChange} style={inputSt}>
                            {ROLES_ASIGNABLES.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
                        </select>
                    </div>
                    <div><label style={labelSt} htmlFor="nu-tel">TELÉFONO</label><input id="nu-tel" name="telefono" value={form.telefono} onChange={onChange} maxLength={20} placeholder="+593..." style={inputSt} /></div>
                    <div><label style={labelSt} htmlFor="nu-ced">CÉDULA</label><input id="nu-ced" name="cedula" value={form.cedula} onChange={onChange} maxLength={20} style={inputSt} /></div>
                    <div>
                        <label style={labelSt}>CONTRASEÑA</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, ...outfit('.82rem'), color: p.txtSf, marginBottom: 6, cursor: 'pointer' }}>
                            <input type="checkbox" checked={generar} onChange={e => setGenerar(e.target.checked)} />
                            Generar una temporal segura
                        </label>
                        {!generar && <input type="password" name="password" value={form.password} onChange={onChange} minLength={8} maxLength={72} required autoComplete="new-password" placeholder="Mínimo 8 caracteres" style={inputSt} aria-label="Contraseña" />}
                    </div>
                </div>

                {esStaff ? (
                    <div>
                        <p style={{ ...bebas('.8rem', '.18em'), color: p.txt, marginBottom: 8 }}>PERMISOS INICIALES</p>
                        <EditorPermisos catalogo={catalogo} valor={permisos} onChange={setPermisos} rol={form.rol} />
                    </div>
                ) : (
                    <p style={{ ...outfit('.82rem'), color: p.mut, padding: 12, border: `1px dashed ${p.bdr}`, borderRadius: 10 }}>
                        Un cliente del portal solo accede a "Mi panel" en la web pública; nunca al panel administrativo.
                    </p>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 14, borderTop: `1px solid ${p.bdr}` }}>
                    <BotonSecundario onClick={onClose}>CANCELAR</BotonSecundario>
                    <BotonPrimario type="submit" disabled={saving}>{saving ? 'CREANDO...' : 'CREAR USUARIO'}</BotonPrimario>
                </div>
            </form>
        </Modal>
    );
}

function ModalPasswordTemporal({ email, password, onClose }) {
    const p = usePaleta();
    const copiar = async () => {
        try { await navigator.clipboard.writeText(password); toast.success('Copiada.'); }
        catch { toast.error('No se pudo copiar; cópiala a mano.'); }
    };
    return (
        <Modal titulo="Contraseña temporal" etiqueta="SUPERADMIN · ACCESO" color="#f59e0b" onClose={onClose} ancho={460}
            subtitulo={`Para ${email}. Se muestra UNA sola vez: entrégala en persona y pide que la cambie en "Mi cuenta".`}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 16, borderRadius: 12, background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.35)' }}>
                <code style={{ flex: 1, fontSize: '1.2rem', letterSpacing: '.08em', color: p.txt, userSelect: 'all' }}>{password}</code>
                <BotonSecundario color="#f59e0b" onClick={copiar}>COPIAR</BotonSecundario>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
                <BotonPrimario onClick={onClose}>LISTO</BotonPrimario>
            </div>
        </Modal>
    );
}

// ═════════════════════════════════════════════════════════════
// Ficha de un usuario: permisos, datos, acceso e historial
// ═════════════════════════════════════════════════════════════
const DESCRIPCION_ACCION = {
    'usuario.crear': 'Cuenta creada',
    'usuario.editar': 'Datos modificados',
    'usuario.cambiar_rol': 'Rol cambiado',
    'usuario.activar': 'Cuenta activada',
    'usuario.desactivar': 'Cuenta desactivada',
    'usuario.restablecer_acceso': 'Acceso restablecido',
    'usuario.cerrar_sesiones': 'Sesiones cerradas',
    'usuario.eliminar': 'Cuenta eliminada',
    'permisos.actualizar': 'Permisos modificados',
    'superadmin.conceder': 'Promovido a superadministrador',
    'superadmin.revocar': 'Dejó de ser superadministrador',
    'superadmin.crear': 'Superadministrador creado',
    'sesion.inicio': 'Inició sesión',
    'acceso.denegado': 'Intento de acceso denegado',
};

function FichaUsuario({ id, catalogo, onClose, onCambio, onPasswordTemporal }) {
    const p = usePaleta();
    const confirm = useConfirm();
    const { puede } = useAuth();
    const puedeEditar = puede('usuarios', 'editar');
    const puedeEliminar = puede('usuarios', 'eliminar');
    // Sin permiso de editar, los permisos se ven pero no se tocan.
    const catalogoFicha = useMemo(() => (puedeEditar ? catalogo : { ...catalogo, concedibles: [] }), [catalogo, puedeEditar]);
    const [datos, setDatos] = useState(null);
    const [tab, setTab] = useState('permisos');
    const [seleccion, setSeleccion] = useState(new Set());
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(null);
    const [rolNuevo, setRolNuevo] = useState('');

    const nombreDe = useMemo(() => {
        const m = new Map();
        for (const mod of catalogo.modulos) for (const a of mod.acciones) m.set(`${mod.codigo}:${a.codigo}`, `${mod.nombre} · ${a.nombre}`);
        return (clave) => m.get(clave) || clave;
    }, [catalogo]);

    // onClose llega como funcion nueva en cada render del padre: se guarda en
    // una ref para que `cargar` no cambie (y no se repita la peticion en bucle).
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const cargar = useCallback(async () => {
        try {
            const { data } = await api.get(`/users/${id}`);
            setDatos(data);
            setSeleccion(new Set(data.permisos));
            setForm({ nombre: data.usuario.nombre || '', email: data.usuario.email || '', telefono: data.usuario.telefono || '', cedula: data.usuario.cedula || '' });
            setRolNuevo(data.usuario.rol);
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo cargar el usuario.');
            onCloseRef.current();
        }
    }, [id]);
    useEffect(() => { cargar(); }, [cargar]);

    if (!datos) {
        return <Modal titulo="Cargando..." onClose={onClose}><div style={{ height: 120 }} className="sk-pulse" /></Modal>;
    }
    const u = datos.usuario;
    const esStaff = ROLES_STAFF.includes(u.rol);
    const actuales = new Set(datos.permisos);
    const agregados = [...seleccion].filter(x => !actuales.has(x));
    const revocados = [...actuales].filter(x => !seleccion.has(x));
    const hayCambios = agregados.length + revocados.length > 0;

    const ejecutar = async (fn, exito) => {
        setSaving(true);
        try {
            const r = await fn();
            if (exito) toast.success(exito);
            await cargar();
            onCambio();
            return r;
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo completar la acción.');
            return null;
        } finally { setSaving(false); }
    };

    const guardarPermisos = async () => {
        if (revocados.length && !(await confirm({
            title: 'Revocar permisos',
            message: `Vas a quitar ${revocados.length} permiso(s) a ${u.nombre}${agregados.length ? ` y conceder ${agregados.length}` : ''}. Lo perderá en su siguiente acción. ¿Continuar?`,
            confirmLabel: 'Guardar cambios',
        }))) return;
        await ejecutar(() => api.put(`/users/${u.id}/permisos`, { permisos: [...seleccion] }), 'Permisos guardados.');
    };

    const guardarDatos = async (e) => {
        e.preventDefault();
        await ejecutar(() => api.put(`/users/${u.id}`, form), 'Datos actualizados.');
    };

    const cambiarEstado = async (estado) => {
        if (estado !== 'activo' && !(await confirm({
            title: estado === 'bloqueado' ? 'Bloquear cuenta' : 'Desactivar cuenta',
            message: `${u.nombre} no podrá iniciar sesión y su sesión actual se cerrará de inmediato. Sus registros del negocio se conservan. ¿Continuar?`,
            confirmLabel: estado === 'bloqueado' ? 'Bloquear' : 'Desactivar',
        }))) return;
        await ejecutar(() => api.put(`/users/${u.id}/estado`, { estado }), estado === 'activo' ? 'Cuenta activada.' : 'Cuenta desactivada.');
    };

    const cambiarRol = async () => {
        if (rolNuevo === u.rol) return;
        const aCliente = rolNuevo === 'cliente';
        const usarPlantilla = !aCliente && (await confirm({
            title: 'Permisos del nuevo rol',
            message: `¿Aplicar la plantilla de permisos de "${rolMeta(rolNuevo).label}"? Si eliges "Conservar", mantiene sus permisos actuales.`,
            confirmLabel: 'Aplicar plantilla', cancelLabel: 'Conservar', danger: false,
        }));
        if (!(await confirm({
            title: 'Cambiar rol',
            message: `${u.nombre} pasará a ${rolMeta(rolNuevo).label}${aCliente ? ' y perderá todos sus permisos del panel' : ''}. Deberá iniciar sesión de nuevo. ¿Continuar?`,
            confirmLabel: 'Cambiar rol',
        }))) { setRolNuevo(u.rol); return; }
        await ejecutar(() => api.put(`/users/${u.id}/rol`, { rol: rolNuevo, aplicar_plantilla: usarPlantilla }), 'Rol actualizado.');
    };

    const restablecer = async () => {
        if (!(await confirm({
            title: 'Restablecer acceso',
            message: `Se generará una contraseña temporal para ${u.nombre} y se cerrarán todas sus sesiones abiertas. ¿Continuar?`,
            confirmLabel: 'Restablecer', danger: false,
        }))) return;
        const r = await ejecutar(() => api.put(`/users/${u.id}/password`, {}), 'Acceso restablecido.');
        if (r?.data?.password_temporal) onPasswordTemporal(u.email, r.data.password_temporal);
    };

    const cerrarSesiones = async () => {
        if (!(await confirm({ title: 'Cerrar sesiones', message: `Se cerrarán todas las sesiones abiertas de ${u.nombre}.`, confirmLabel: 'Cerrar sesiones', danger: false }))) return;
        await ejecutar(() => api.post(`/users/${u.id}/cerrar-sesiones`), 'Sesiones cerradas.');
    };

    const eliminar = async () => {
        if (!(await confirm({
            title: 'Eliminar cuenta',
            message: `Eliminar a "${u.nombre}" no se puede deshacer. Si tiene registros del negocio el sistema lo impedirá: en ese caso desactívala. ¿Continuar?`,
        }))) return;
        setSaving(true);
        try {
            await api.delete(`/users/${u.id}`);
            toast.success('Usuario eliminado.');
            onCambio();
            onClose();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al eliminar.');
        } finally { setSaving(false); }
    };

    const rm = rolMeta(u.rol);
    const em = estadoMeta(u.estado);
    const TABS = [
        ...(esStaff ? [{ id: 'permisos', label: 'PERMISOS' }] : []),
        { id: 'cuenta', label: 'CUENTA Y ACCESO' },
        { id: 'historial', label: 'HISTORIAL' },
    ];
    const tabActual = TABS.some(t => t.id === tab) ? tab : TABS[0].id;
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${p.bdr}`, background: p.inputBg, color: p.txt, ...outfit('.88rem'), outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, ...bebas('.62rem', '.22em'), color: p.SKY_DEEP };
    const tituloSeccion = (t) => <p style={{ ...bebas('.78rem', '.18em'), color: p.txt, margin: '4px 0 10px' }}>{t}</p>;

    return (
        <Modal titulo={u.nombre} subtitulo={u.email} onClose={onClose} ancho={920}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: -6, marginBottom: 16 }}>
                <Pildora color={rm.color}>{rm.label.toUpperCase()}</Pildora>
                <Pildora color={em.color}>{em.label.toUpperCase()}</Pildora>
                <span style={{ ...outfit('.76rem'), color: p.mut, alignSelf: 'center' }}>Último acceso: {fechaHora(u.ultimo_acceso)}</span>
            </div>

            <div className="prov-tabs" role="tablist" style={{ marginBottom: 16, '--prov-bdr': p.bdr, '--prov-mut': p.mut, '--prov-sky': p.SKY_DEEP }}>
                {TABS.map(t => (
                    <button key={t.id} role="tab" aria-selected={tabActual === t.id} className={`prov-tab-btn ${tabActual === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
                ))}
            </div>

            {tabActual === 'permisos' && (
                <div>
                    <EditorPermisos catalogo={catalogoFicha} valor={seleccion} onChange={setSeleccion} rol={u.rol} />
                    {puedeEditar && <div style={{ position: 'sticky', bottom: -26, background: p.boxBg, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end', padding: '14px 0 4px', marginTop: 12, borderTop: `1px solid ${p.bdr}`, flexWrap: 'wrap' }}>
                        <span style={{ ...outfit('.8rem'), color: hayCambios ? '#f59e0b' : p.mut, marginRight: 'auto' }}>
                            {hayCambios ? `Sin guardar: +${agregados.length} / −${revocados.length}` : 'Sin cambios pendientes'}
                        </span>
                        <BotonSecundario disabled={!hayCambios || saving} onClick={() => setSeleccion(new Set(datos.permisos))}>DESHACER</BotonSecundario>
                        <BotonPrimario disabled={!hayCambios || saving} onClick={guardarPermisos}>{saving ? 'GUARDANDO...' : 'GUARDAR PERMISOS'}</BotonPrimario>
                    </div>}
                </div>
            )}

            {tabActual === 'cuenta' && !puedeEditar && (
                <p style={{ ...outfit('.85rem'), color: p.mut }}>Tu cuenta puede ver a este usuario, pero no modificarlo.</p>
            )}
            {tabActual === 'cuenta' && puedeEditar && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                    <form onSubmit={guardarDatos}>
                        {tituloSeccion('DATOS DE LA CUENTA')}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 13 }}>
                            <div><label style={labelSt} htmlFor="fu-nombre">NOMBRE *</label><input id="fu-nombre" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} required maxLength={100} style={inputSt} /></div>
                            <div><label style={labelSt} htmlFor="fu-email">CORREO *</label><input id="fu-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required maxLength={150} style={inputSt} /></div>
                            <div><label style={labelSt} htmlFor="fu-tel">TELÉFONO</label><input id="fu-tel" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} maxLength={20} style={inputSt} /></div>
                            <div><label style={labelSt} htmlFor="fu-ced">CÉDULA</label><input id="fu-ced" value={form.cedula} onChange={e => setForm({ ...form, cedula: e.target.value })} maxLength={20} style={inputSt} /></div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                            <BotonPrimario type="submit" disabled={saving}>GUARDAR DATOS</BotonPrimario>
                        </div>
                    </form>

                    <div>
                        {tituloSeccion('ROL')}
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                            <select aria-label="Nuevo rol" value={rolNuevo} onChange={e => setRolNuevo(e.target.value)} style={{ ...inputSt, width: 'auto', minWidth: 220 }}>
                                {ROLES_ASIGNABLES.map(r => <option key={r.val} value={r.val}>{r.label}</option>)}
                            </select>
                            <BotonSecundario color={p.SKY_DEEP} disabled={rolNuevo === u.rol || saving} onClick={cambiarRol}>CAMBIAR ROL</BotonSecundario>
                        </div>
                        <p style={{ ...outfit('.74rem', 300), color: p.mut, marginTop: 6 }}>El rol es una etiqueta y una plantilla; lo que la persona puede hacer lo deciden sus permisos.</p>
                    </div>

                    <div>
                        {tituloSeccion('ESTADO Y ACCESO')}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {u.estado === 'activo' ? (<>
                                <BotonSecundario color="#f59e0b" disabled={saving} onClick={() => cambiarEstado('suspendido')}>DESACTIVAR (SUSPENDER)</BotonSecundario>
                                <BotonSecundario color="#ef4444" disabled={saving} onClick={() => cambiarEstado('bloqueado')}>BLOQUEAR</BotonSecundario>
                            </>) : (
                                <BotonSecundario color="#10b981" disabled={saving} onClick={() => cambiarEstado('activo')}>ACTIVAR CUENTA</BotonSecundario>
                            )}
                            <BotonSecundario color={p.SKY_DEEP} disabled={saving} onClick={restablecer}>RESTABLECER ACCESO</BotonSecundario>
                            <BotonSecundario disabled={saving} onClick={cerrarSesiones}>CERRAR SESIONES</BotonSecundario>
                        </div>
                    </div>

                    {puedeEliminar && <div style={{ paddingTop: 14, borderTop: `1px solid ${p.bdr}` }}>
                        {tituloSeccion('ZONA DE RIESGO')}
                        <BotonSecundario color="#ef4444" disabled={saving} onClick={eliminar}>ELIMINAR CUENTA</BotonSecundario>
                        <p style={{ ...outfit('.74rem', 300), color: p.mut, marginTop: 6 }}>Solo para cuentas sin operaciones. Si trabajó en el taller, desactívala para conservar su historial.</p>
                    </div>}
                </div>
            )}

            {tabActual === 'historial' && (
                <div>
                    {datos.historial.length === 0 ? (
                        <p style={{ ...outfit('.85rem'), color: p.mut }}>Sin cambios registrados.</p>
                    ) : datos.historial.map(h => (
                        <div key={h.id} style={{ padding: '10px 0', borderTop: `1px solid ${p.bdr}` }}>
                            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
                                <span style={{ ...outfit('.86rem', 600), color: p.txt }}>{DESCRIPCION_ACCION[h.accion] || h.accion}</span>
                                <span style={{ ...outfit('.74rem'), color: p.mut }}>{fechaHora(h.created_at)} · por {h.actor_email || 'sistema'}</span>
                            </div>
                            {h.detalle?.otorgados?.length > 0 && <p style={{ ...outfit('.76rem'), color: '#10b981', marginTop: 3 }}>+ {h.detalle.otorgados.map(nombreDe).join(', ')}</p>}
                            {h.detalle?.revocados?.length > 0 && <p style={{ ...outfit('.76rem'), color: '#ef4444', marginTop: 3 }}>− {h.detalle.revocados.map(nombreDe).join(', ')}</p>}
                            {h.detalle?.antes && h.detalle?.despues && typeof h.detalle.antes === 'string' && (
                                <p style={{ ...outfit('.76rem'), color: p.txtSf, marginTop: 3 }}>{h.detalle.antes} → {h.detalle.despues}</p>
                            )}
                        </div>
                    ))}
                    {puede('auditoria', 'ver') && <div style={{ marginTop: 12 }}>
                        <Link to={`/dashboard/auditoria?usuario_id=${u.id}`} style={{ ...bebas('.7rem'), color: p.SKY_DEEP }}>VER TODO EN AUDITORÍA →</Link>
                    </div>}
                </div>
            )}
        </Modal>
    );
}
