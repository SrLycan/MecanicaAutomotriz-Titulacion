/**
 * SS SWAP - Administración de Sucursales
 * Gestiona las sedes del taller: nombre, dirección, ciudad, teléfono, horario
 * y estado activo/inactivo. La sucursal marcada como principal aparece destacada
 * en el catálogo de citas y en la sección de contacto del portal público.
 */
import React, { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useConfirm } from '../components/common/ConfirmDialog';
import './Sucursales.css';

function IconPlus()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconEdit()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconTrash() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>; }
function IconX()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconMap()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>; }
function IconPhone() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>; }
function IconClock() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconStar()  { return <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>; }

const EMPTY = { nombre: '', direccion: '', ciudad: '', telefono: '', email: '', horario: '', descripcion: '', es_principal: false, activa: true };

export default function Sucursales() {
    const confirm = useConfirm();
    const { puede } = useAuth();
    const { isDark } = useTheme();
    const [sucursales, setSucursales] = useState([]);
    const [loading, setLoading]       = useState(true);
    const [modal, setModal]           = useState({ open: false, data: null });

    // Paleta
    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.12)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.35)';
    const txt    = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf  = isDark ? '#cbd5e1' : '#334155';
    const mut    = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr    = isDark ? 'rgba(148,163,184,0.18)' : '#b6c3d3';
    const card   = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const cardSh = isDark
        ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)'
        : '0 1px 2px rgba(15,23,42,0.06), 0 8px 22px -8px rgba(15,23,42,0.20)';

    const cargar = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/sucursales');
            setSucursales(data.sucursales);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al cargar sucursales.');
        } finally { setLoading(false); }
    };
    useEffect(() => { cargar(); }, []);

    const guardar = async (form) => {
        try {
            if (modal.data) {
                await api.put(`/sucursales/${modal.data.id}`, form);
                toast.success('Sucursal actualizada.');
            } else {
                await api.post('/sucursales', form);
                toast.success('Sucursal creada.');
            }
            setModal({ open: false, data: null });
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar.'); }
    };

    const eliminar = async (s) => {
        if (!(await confirm({ message: `Eliminar la sucursal "${s.nombre}"?` }))) return;
        try {
            await api.delete(`/sucursales/${s.id}`);
            toast.success('Sucursal eliminada.');
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar.'); }
    };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500, '--sky-bdr': SKY_BDR }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div className="ssswap-chip" style={{ marginBottom: 8 }}>
                        <span className="dot" />
                        <span>SS SWAP · ADMIN · SUCURSALES</span>
                    </div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Sucursales</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                        Gestion de ubicaciones · Visibles en la pagina principal
                    </p>
                </div>
                {puede('sucursales', 'crear') && <button onClick={() => setModal({ open: true, data: null })}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 11, padding: '11px 22px', cursor: 'pointer', boxShadow: `0 6px 18px -6px ${SKY}` }}>
                    <IconPlus /> NUEVA SUCURSAL
                </button>}
            </div>

            {loading ? (
                <div style={{ padding: 80, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${bdr}`, borderTopColor: SKY, animation: 'spin 1s linear infinite' }} />
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut }}>Cargando sucursales...</p>
                </div>
            ) : sucursales.length === 0 ? (
                <div style={{ padding: 90, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh }}>
                    <div style={{ width: 64, height: 64, margin: '0 auto 16px', borderRadius: 18, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SKY }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.06em', color: txt }}>Sin sucursales</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginTop: 4 }}>Crea la primera para que aparezca en la pagina principal</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18 }}>
                    {sucursales.map((s, i) => (
                        <div key={s.id} className="s-card"
                            style={{
                                background: card, border: `1px solid ${s.es_principal ? SKY_BDR : bdr}`,
                                borderRadius: 16, padding: 22, boxShadow: cardSh,
                                position: 'relative', overflow: 'hidden',
                                animationDelay: `${i * 50}ms`,
                                opacity: s.activa ? 1 : .55,
                            }}>
                            {s.es_principal && (
                                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${SKY_DEEP}, ${SKY})` }} />
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                        {s.es_principal && (
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px', borderRadius: 999, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, color: SKY_DEEP, fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.2em' }}>
                                                <IconStar /> PRINCIPAL
                                            </span>
                                        )}
                                        {!s.activa && (
                                            <span style={{ padding: '3px 9px', borderRadius: 999, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.2em' }}>
                                                OCULTA
                                            </span>
                                        )}
                                    </div>
                                    <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.04em', color: txt, lineHeight: 1.1 }}>{s.nombre}</h3>
                                    {s.ciudad && <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginTop: 2 }}>{s.ciudad}</p>}
                                </div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {puede('sucursales', 'editar') && <button onClick={() => setModal({ open: true, data: s })}
                                            title="Editar"
                                            style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: 7, cursor: 'pointer', color: SKY_DEEP, display: 'flex' }}>
                                        <IconEdit />
                                    </button>}
                                    {puede('sucursales', 'eliminar') && <button onClick={() => eliminar(s)}
                                            title="Eliminar"
                                            style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: 7, cursor: 'pointer', color: '#ef4444', display: 'flex' }}>
                                        <IconTrash />
                                    </button>}
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                                {s.direccion && (
                                    <Linea icon={<IconMap />}   text={s.direccion}   mut={mut} txtSf={txtSf} sky={SKY_DEEP} />
                                )}
                                {s.telefono && (
                                    <Linea icon={<IconPhone />} text={s.telefono}    mut={mut} txtSf={txtSf} sky={SKY_DEEP} />
                                )}
                                {s.horario && (
                                    <Linea icon={<IconClock />} text={s.horario}     mut={mut} txtSf={txtSf} sky={SKY_DEEP} />
                                )}
                            </div>

                            {s.descripcion && (
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, lineHeight: 1.55, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${bdr}` }}>
                                    {s.descripcion}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {modal.open && (
                <ModalSucursal data={modal.data} onClose={() => setModal({ open: false, data: null })} onGuardar={guardar} />
            )}
        </div>
    );
}

function Linea({ icon, text, mut, txtSf, sky }) {
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ color: sky, marginTop: 2, flexShrink: 0 }}>{icon}</span>
            <span style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf, lineHeight: 1.4 }}>{text}</span>
        </div>
    );
}

function ModalSucursal({ data, onClose, onGuardar }) {
    const { isDark } = useTheme();
    const [form, setForm] = useState(data ? { ...EMPTY, ...data } : EMPTY);
    const [saving, setSaving] = useState(false);
    const esEdicion = Boolean(data);

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : '#b6c3d3';
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
        const { name, value, type, checked } = e.target;
        if (name === 'telefono') return handlePhoneChange(e);
        setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        await onGuardar(form);
        setSaving(false);
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 600, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${SKY}, ${SKY_DEEP}, ${SKY}, transparent)`, borderRadius: '20px 20px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>ADMIN · SUCURSALES</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt }}>{esEdicion ? 'Editar Sucursal' : 'Nueva Sucursal'}</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}>
                        <IconX />
                    </button>
                </div>

                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>NOMBRE *</label>
                            <input name="nombre" value={form.nombre} onChange={onChange} required placeholder="Ej: SS SWAP Norte" style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>DIRECCION</label>
                            <input name="direccion" value={form.direccion || ''} onChange={onChange} placeholder="Av. ..." style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>CIUDAD</label>
                            <input name="ciudad" value={form.ciudad || ''} onChange={onChange} placeholder="Quito" style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>TELEFONO</label>
                            <input name="telefono" value={form.telefono || ''} onChange={onChange} placeholder="+593..." style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>EMAIL</label>
                            <input type="email" name="email" value={form.email || ''} onChange={onChange} placeholder="sucursal@ssswap.com" style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>HORARIO</label>
                            <input name="horario" value={form.horario || ''} onChange={onChange} placeholder="Lun-Vie 8:00-18:00 · Sab 8:00-14:00" style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>DESCRIPCION</label>
                            <textarea name="descripcion" value={form.descripcion || ''} onChange={onChange} rows={3} placeholder="Servicios y especialidades de esta sucursal..." style={{ ...inputSt, resize: 'vertical', minHeight: 72 }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 18, paddingTop: 8 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: "'Outfit'", fontSize: '.85rem', color: txt }}>
                            <input type="checkbox" name="es_principal" checked={Boolean(form.es_principal)} onChange={onChange} style={{ accentColor: SKY }} />
                            Marcar como principal
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: "'Outfit'", fontSize: '.85rem', color: txt }}>
                            <input type="checkbox" name="activa" checked={form.activa !== false} onChange={onChange} style={{ accentColor: '#10b981' }} />
                            Visible en pagina publica
                        </label>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}`, marginTop: 4 }}>
                        <button type="button" onClick={onClose}
                                style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>
                            CANCELAR
                        </button>
                        <button type="submit" disabled={saving}
                                style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1, boxShadow: `0 6px 18px -6px ${SKY}` }}>
                            {saving ? 'GUARDANDO...' : esEdicion ? 'GUARDAR CAMBIOS' : 'CREAR SUCURSAL'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
