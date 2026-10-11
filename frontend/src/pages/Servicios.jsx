/**
 * SS SWAP - Administración de Servicios Mecánicos (Panel Interno)
 * CRUD del catálogo de servicios: crea, edita y elimina servicios con nombre,
 * descripción, precio base, duración estimada e imagen. Los servicios marcados como
 * activos son visibles en el catálogo público y disponibles para reserva de citas.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useConfirm } from '../components/common/ConfirmDialog';
import { resolveImagenSrc, fileToDataUrl, comprimirImagen } from '../utils/imagen';
import './Servicios.css';

/* ── Icons ── */
function IconPlus()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconEdit()    { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconTrash()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>; }
function IconX()       { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconWrench()  { return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>; }
function IconClock()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }
function IconImage()   { return <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>; }

const GOLD = '#c9a227';
const EMPTY = { nombre: '', descripcion: '', precio_base: '', duracion_estimada_min: '', activo: true, imagen_url: '' };

function Modal({ servicio, onClose, onSaved, isDark }) {
    const [form, setForm] = useState(servicio ? {
        nombre: servicio.nombre || '',
        descripcion: servicio.descripcion || '',
        precio_base: servicio.precio_base ?? '',
        duracion_estimada_min: servicio.duracion_estimada_min ?? '',
        activo: servicio.activo ?? true,
        imagen_url: servicio.imagen_url || '',
    } : { ...EMPTY });
    const [preview, setPreview] = useState(resolveImagenSrc(servicio?.imagen_url || ''));
    const [saving, setSaving] = useState(false);

    const bg    = isDark ? '#080e1c' : '#ffffff';
    const bdr   = isDark ? 'rgba(201,162,39,.22)' : '#b6c3d3';
    const txt   = isDark ? '#f1f5f9' : '#0f172a';
    const mut   = isDark ? 'rgba(241,245,249,.55)' : '#64748b';
    const inp   = isDark ? '#0d1526' : '#f8fafc';
    const inpBdr= isDark ? 'rgba(255,255,255,.1)' : 'rgba(15,23,42,.15)';

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleImagenFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await comprimirImagen(file);
            set('imagen_url', dataUrl);
            setPreview(dataUrl);
        } catch { toast.error('No se pudo procesar la imagen.'); }
    };

    const quitarImagen = () => { set('imagen_url', ''); setPreview(''); };

    const handleSubmit = async () => {
        if (!form.nombre.trim()) { toast.error('El nombre es obligatorio.'); return; }
        setSaving(true);
        try {
            const payload = { ...form, precio_base: parseFloat(form.precio_base) || 0, duracion_estimada_min: parseInt(form.duracion_estimada_min) || null };
            if (servicio?.id) await api.put(`/servicios/${servicio.id}`, payload);
            else await api.post('/servicios', payload);
            toast.success(servicio?.id ? 'Servicio actualizado.' : 'Servicio creado.');
            onSaved();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al guardar.');
        } finally { setSaving(false); }
    };

    return (
        <div onClick={e => e.target === e.currentTarget && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}>
            <div style={{ width: '100%', maxWidth: 520, background: bg, border: `1px solid ${bdr}`, borderRadius: 18, padding: 28, position: 'relative', boxShadow: isDark ? '0 24px 64px -20px rgba(0,0,0,.8)' : '0 24px 64px -20px rgba(15,23,42,.25)' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, borderRadius: '18px 18px 0 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.15rem', letterSpacing: '.06em', color: txt }}>
                        {servicio?.id ? 'Editar Servicio' : 'Nuevo Servicio'}
                    </p>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${inpBdr}`, borderRadius: 8, padding: 6, cursor: 'pointer', color: mut, display: 'flex' }}><IconX /></button>
                </div>

                {[
                    { label: 'Nombre del servicio *', key: 'nombre', type: 'text', placeholder: 'Ej: Cambio de aceite y filtro' },
                    { label: 'Precio base (USD)', key: 'precio_base', type: 'number', placeholder: '0.00', min: 0, step: '0.01' },
                    { label: 'Duración estimada (minutos)', key: 'duracion_estimada_min', type: 'number', placeholder: 'Ej: 60', min: 0 },
                ].map(f => (
                    <div key={f.key} style={{ marginBottom: 14 }}>
                        <label style={{ display: 'block', fontFamily: "'Outfit'", fontSize: '.75rem', fontWeight: 600, color: mut, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>{f.label}</label>
                        <input type={f.type} value={form[f.key]} onChange={e => set(f.key, e.target.value)}
                            placeholder={f.placeholder} min={f.min} step={f.step}
                            style={{ width: '100%', background: inp, border: `1px solid ${inpBdr}`, borderRadius: 10, padding: '10px 14px', color: txt, fontFamily: "'Outfit'", fontSize: '.9rem', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                ))}

                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontFamily: "'Outfit'", fontSize: '.75rem', fontWeight: 600, color: mut, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>Foto del servicio</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr', gap: 12, alignItems: 'stretch' }}>
                        <div style={{ minHeight: 92, borderRadius: 12, border: `1px dashed ${inpBdr}`, background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(201,162,39,.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: mut }}>
                            {preview ? (
                                <img src={preview} alt="Vista previa del servicio" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setPreview('')} />
                            ) : (
                                <IconImage />
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                            <input type="file" accept="image/*" onChange={handleImagenFile}
                                style={{ width: '100%', background: inp, border: `1px solid ${inpBdr}`, borderRadius: 10, padding: '9px 12px', color: txt, fontFamily: "'Outfit'", fontSize: '.82rem', boxSizing: 'border-box' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.68rem', color: mut }}>
                                    Se muestra en la página pública de Servicios.
                                </p>
                                {preview && (
                                    <button type="button" onClick={quitarImagen} style={{ background: 'none', border: 'none', color: '#ef4444', fontFamily: "'Outfit'", fontSize: '.72rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>Quitar</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontFamily: "'Outfit'", fontSize: '.75rem', fontWeight: 600, color: mut, marginBottom: 6, letterSpacing: '.04em', textTransform: 'uppercase' }}>Descripción</label>
                    <textarea value={form.descripcion} onChange={e => set('descripcion', e.target.value)} rows={3}
                        placeholder="Detalla qué incluye el servicio..."
                        style={{ width: '100%', background: inp, border: `1px solid ${inpBdr}`, borderRadius: 10, padding: '10px 14px', color: txt, fontFamily: "'Outfit'", fontSize: '.9rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 22 }}>
                    <div onClick={() => set('activo', !form.activo)} style={{
                        width: 40, height: 22, borderRadius: 999, background: form.activo ? GOLD : (isDark ? 'rgba(255,255,255,.15)' : '#cbd5e1'),
                        position: 'relative', transition: 'background .2s', flexShrink: 0,
                    }}>
                        <div style={{ position: 'absolute', top: 3, left: form.activo ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 4px rgba(0,0,0,.3)' }} />
                    </div>
                    <span style={{ fontFamily: "'Outfit'", fontSize: '.88rem', color: txt }}>Servicio activo (visible para clientes)</span>
                </label>

                <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={onClose} style={{ flex: 1, padding: '11px 0', borderRadius: 10, border: `1px solid ${inpBdr}`, background: 'none', color: mut, fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={handleSubmit} disabled={saving} style={{ flex: 2, padding: '11px 0', borderRadius: 10, border: 'none', background: GOLD, color: '#0a0a0a', fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.88rem', cursor: 'pointer', opacity: saving ? .7 : 1 }}>
                        {saving ? 'Guardando…' : servicio?.id ? 'Actualizar' : 'Crear Servicio'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Servicios() {
    const { puede } = useAuth();
    const confirm = useConfirm();
    const { isDark } = useTheme();
    const [servicios, setServicios]   = useState([]);
    const [loading, setLoading]       = useState(true);
    const [search, setSearch]         = useState('');
    const [modal, setModal]           = useState(null); // null | {} (nuevo) | {servicio}
    const [deletingId, setDeletingId] = useState(null);

    const bg   = isDark ? '#050a14' : '#f1f5f9';
    const card = isDark ? '#0a1020' : '#ffffff';
    const bdr  = isDark ? 'rgba(201,162,39,.18)' : '#b6c3d3';
    const txt  = isDark ? '#f1f5f9' : '#0f172a';
    const mut  = isDark ? 'rgba(241,245,249,.55)' : '#64748b';

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/servicios?activo=all');
            setServicios(data.servicios || []);
        } catch { toast.error('Error al cargar servicios.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    const handleDelete = async (id) => {
        if (!(await confirm({ message: '¿Desactivar este servicio?', confirmLabel: 'Desactivar' }))) return;
        setDeletingId(id);
        try {
            await api.delete(`/servicios/${id}`);
            toast.success('Servicio desactivado.');
            cargar();
        } catch { toast.error('No se pudo desactivar.'); }
        finally { setDeletingId(null); }
    };

    const filtered = servicios.filter(s =>
        s.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (s.descripcion || '').toLowerCase().includes(search.toLowerCase())
    );

    const fmtDur = (min) => {
        if (!min) return '—';
        if (min < 60) return `${min} min`;
        const h = Math.floor(min / 60), m = min % 60;
        return m ? `${h}h ${m}min` : `${h}h`;
    };

    return (
        <div style={{ minHeight: '100%', background: bg, padding: '28px 24px', boxSizing: 'border-box' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, marginBottom: 28 }}>
                <div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.3em', color: GOLD, marginBottom: 4 }}>ADMINISTRACIÓN</p>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(1.6rem,4vw,2.2rem)', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Tipos de Servicio</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                        Define qué servicios ofrece el taller para que los clientes puedan agendar.
                    </p>
                </div>
                {puede('servicios', 'crear') && <button onClick={() => setModal({})}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, background: GOLD, color: '#0a0a0a', border: 'none', borderRadius: 10, padding: '11px 20px', fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.88rem', cursor: 'pointer', flexShrink: 0 }}>
                    <IconPlus /> Nuevo Servicio
                </button>}
            </div>

            {/* Search */}
            <div style={{ maxWidth: 420, marginBottom: 22 }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar servicio..."
                    style={{ width: '100%', background: card, border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 16px', color: txt, fontFamily: "'Outfit'", fontSize: '.9rem', outline: 'none' }} />
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
                {[
                    { label: 'Total servicios', val: servicios.length, color: GOLD },
                    { label: 'Activos', val: servicios.filter(s => s.activo).length, color: '#10b981' },
                    { label: 'Inactivos', val: servicios.filter(s => !s.activo).length, color: '#64748b' },
                ].map(s => (
                    <div key={s.label} style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 12, padding: '14px 20px', minWidth: 130 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.5rem', color: s.color, lineHeight: 1 }}>{s.val}</p>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut, marginTop: 3 }}>{s.label}</p>
                    </div>
                ))}
            </div>

            {/* Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '60px 0', color: mut, fontFamily: "'Outfit'" }}>Cargando servicios…</div>
            ) : filtered.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                    <div style={{ color: isDark ? 'rgba(255,255,255,.1)' : 'rgba(0,0,0,.08)', marginBottom: 16 }}><IconWrench /></div>
                    <p style={{ fontFamily: "'Outfit'", color: mut }}>{search ? 'Sin resultados para tu búsqueda.' : 'No hay servicios registrados. Crea el primero.'}</p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                    {filtered.map((s, i) => (
                        <div key={s.id} className="svc-card svc-row"
                            style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '20px 22px', animationDelay: `${i * 40}ms`, position: 'relative', overflow: 'hidden' }}>
                            {/* Top accent */}
                            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: s.activo ? `linear-gradient(90deg, ${GOLD}, transparent)` : 'rgba(100,116,139,.3)', borderRadius: '14px 14px 0 0' }} />

                            {/* Badge activo */}
                            <div style={{ position: 'absolute', top: 14, right: 14 }}>
                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.16em', padding: '3px 9px', borderRadius: 999, background: s.activo ? 'rgba(16,185,129,.12)' : 'rgba(100,116,139,.12)', color: s.activo ? '#10b981' : '#64748b', border: `1px solid ${s.activo ? 'rgba(16,185,129,.25)' : 'rgba(100,116,139,.2)'}` }}>
                                    {s.activo ? 'ACTIVO' : 'INACTIVO'}
                                </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12, paddingRight: 80 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 10, background: `rgba(201,162,39,.1)`, border: `1px solid rgba(201,162,39,.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, flexShrink: 0, overflow: 'hidden' }}>
                                    {s.imagen_url ? (
                                        <img src={resolveImagenSrc(s.imagen_url)} alt={s.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { e.target.style.display = 'none'; }} />
                                    ) : (
                                        <IconWrench />
                                    )}
                                </div>
                                <div>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.97rem', color: txt, lineHeight: 1.3 }}>{s.nombre}</p>
                                    {s.descripcion && <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, marginTop: 4, lineHeight: 1.5 }}>{s.descripcion}</p>}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                                <div style={{ background: isDark ? 'rgba(255,255,255,.04)' : '#f8fafc', borderRadius: 8, padding: '8px 12px', flex: 1, textAlign: 'center' }}>
                                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: GOLD }}>${parseFloat(s.precio_base || 0).toFixed(2)}</p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.7rem', color: mut }}>Precio base</p>
                                </div>
                                <div style={{ background: isDark ? 'rgba(255,255,255,.04)' : '#f8fafc', borderRadius: 8, padding: '8px 12px', flex: 1, textAlign: 'center' }}>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.92rem', color: txt, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                                        <IconClock />{fmtDur(s.duracion_estimada_min)}
                                    </p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.7rem', color: mut }}>Duración est.</p>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: 8 }}>
                                {puede('servicios', 'editar') && <button onClick={() => setModal(s)}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 8, border: `1px solid ${bdr}`, background: 'none', color: mut, fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.82rem', cursor: 'pointer' }}>
                                    <IconEdit /> Editar
                                </button>}
                                {puede('servicios', 'eliminar') && <button onClick={() => handleDelete(s.id)} disabled={deletingId === s.id}
                                    style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 0', borderRadius: 8, border: '1px solid rgba(239,68,68,.25)', background: 'none', color: '#ef4444', fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.82rem', cursor: 'pointer', opacity: deletingId === s.id ? .5 : 1 }}>
                                    <IconTrash /> {deletingId === s.id ? '…' : 'Desactivar'}
                                </button>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {modal !== null && (
                <Modal
                    servicio={modal?.id ? modal : null}
                    onClose={() => setModal(null)}
                    onSaved={() => { setModal(null); cargar(); }}
                    isDark={isDark}
                />
            )}
        </div>
    );
}
