/**
 * SS SWAP - Modal de Gestion de Categorias de Repuesto (solo administrador)
 * Lista, crea, edita y elimina categorias. Una categoria con repuestos
 * asignados no se puede eliminar (el backend responde 409).
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { useConfirm } from '../common/ConfirmDialog';
import api from '../../services/api';
import toast from 'react-hot-toast';

function IconX()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconEdit()  { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconTrash() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>; }

const AREAS_BASE = [{ codigo: 'mecanica', nombre: 'Mecánica' }, { codigo: 'colisiones', nombre: 'Colisiones / Pintura' }];
const FORM_VACIO = { nombre: '', descripcion: '', area: '' };

export default function ModalCategorias({ onCambio, onCerrar }) {
    const { isDark } = useTheme();
    const confirm = useConfirm();
    const [categorias, setCategorias] = useState([]);
    const [areas, setAreas]           = useState(AREAS_BASE);
    const [form, setForm]             = useState(FORM_VACIO);
    const [editId, setEditId]         = useState(null);
    const [saving, setSaving]         = useState(false);
    const [error, setError]           = useState('');

    const SKY      = '#0ea5e9';
    const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.06)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.22)';
    const txt     = isDark ? '#f1f5f9'                : '#0f172a';
    const mut     = isDark ? 'rgba(241,245,249,0.55)' : 'rgba(15,23,42,0.55)';
    const bdr     = isDark ? 'rgba(148,163,184,0.18)' : '#b6c3d3';
    const inputBg = isDark ? '#0b1220'                : '#f8fafc';
    const boxBg   = isDark ? '#0a0f1c'                : '#ffffff';

    const inputSt = {
        width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10,
        border: `1px solid ${bdr}`, background: inputBg, color: txt,
        fontFamily: "'Outfit', sans-serif", fontSize: '.88rem', outline: 'none',
    };
    const labelSt = {
        display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue', sans-serif",
        fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP,
    };
    const btnIcon = (color) => ({
        background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: 6,
        cursor: 'pointer', color, display: 'inline-flex', alignItems: 'center',
    });

    const nombreArea = (codigo) => areas.find(a => a.codigo === codigo)?.nombre || codigo;

    const cargar = useCallback(() => {
        api.get('/inventory/categorias').then(r => setCategorias(r.data.categorias || [])).catch(() => toast.error('No se pudieron cargar las categorías.'));
    }, []);

    useEffect(() => {
        cargar();
        api.get('/catalogos').then(r => { if (r.data.areas_inventario?.length) setAreas(r.data.areas_inventario); }).catch(() => {});
    }, [cargar]);

    const cancelarEdicion = () => { setEditId(null); setForm(FORM_VACIO); setError(''); };

    const editar = (c) => {
        setEditId(c.id);
        setForm({ nombre: c.nombre, descripcion: c.descripcion || '', area: c.area || '' });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.nombre.trim()) { setError('El nombre es obligatorio.'); return; }
        setSaving(true);
        try {
            if (editId) { await api.put(`/inventory/categorias/${editId}`, form); toast.success('Categoría actualizada.'); }
            else        { await api.post('/inventory/categorias', form);           toast.success('Categoría creada.'); }
            cancelarEdicion();
            cargar();
            onCambio();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al guardar la categoría.');
        } finally { setSaving(false); }
    };

    const eliminar = async (c) => {
        if (!(await confirm({ message: `Eliminar la categoría "${c.nombre}"?` }))) return;
        try {
            await api.delete(`/inventory/categorias/${c.id}`);
            toast.success('Categoría eliminada.');
            if (editId === c.id) cancelarEdicion();
            cargar();
            onCambio();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar.'); }
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onCerrar()}>
            <div className="modal-box" style={{ maxWidth: 640, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${SKY}, transparent)`, borderRadius: '20px 20px 0 0' }} />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '3px 9px', borderRadius: 999, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, marginBottom: 6 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: SKY }} />
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.24em', color: SKY_DEEP }}>SS SWAP · ALMACEN</p>
                        </div>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Categorías de Repuesto</h2>
                    </div>
                    <button onClick={onCerrar} style={btnIcon(mut)}><IconX /></button>
                </div>

                {/* Formulario crear / editar */}
                <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, padding: 16, borderRadius: 12, border: `1px solid ${SKY_BDR}`, background: SKY_PALE, marginBottom: 18 }}>
                    <div>
                        <label style={labelSt}>NOMBRE *</label>
                        <input style={inputSt} value={form.nombre} maxLength={100} onChange={e => { setForm({ ...form, nombre: e.target.value }); setError(''); }} placeholder="Ej. Frenos" />
                    </div>
                    <div>
                        <label style={labelSt}>ÁREA</label>
                        <select style={inputSt} value={form.area} onChange={e => setForm({ ...form, area: e.target.value })}>
                            <option value="">Compartida (todas)</option>
                            {areas.map(a => <option key={a.codigo} value={a.codigo}>{a.nombre}</option>)}
                        </select>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelSt}>DESCRIPCIÓN</label>
                        <input style={inputSt} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Opcional" />
                    </div>
                    {error && <p style={{ gridColumn: '1 / -1', color: '#ef4444', fontFamily: "'Outfit'", fontSize: '.82rem' }}>{error}</p>}
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {editId && <button type="button" className="btn-ghost" onClick={cancelarEdicion}>Cancelar</button>}
                        <button type="submit" disabled={saving}
                            style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 20px', cursor: saving ? 'wait' : 'pointer', opacity: saving ? .7 : 1 }}>
                            {saving ? 'GUARDANDO...' : editId ? 'GUARDAR CAMBIOS' : 'AGREGAR CATEGORÍA'}
                        </button>
                    </div>
                </form>

                {/* Lista */}
                <div style={{ maxHeight: 340, overflowY: 'auto', border: `1px solid ${bdr}`, borderRadius: 12 }}>
                    {categorias.length === 0 && <p style={{ padding: 18, textAlign: 'center', color: mut, fontFamily: "'Outfit'" }}>No hay categorías registradas.</p>}
                    {categorias.map((c, i) => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderTop: i ? `1px solid ${bdr}` : 'none', background: editId === c.id ? SKY_PALE : 'transparent' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.9rem', color: txt }}>{c.nombre}</p>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.74rem', color: mut, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {c.area ? nombreArea(c.area) : 'Compartida'} · {c.total_repuestos ?? 0} repuesto{c.total_repuestos === 1 ? '' : 's'}{c.descripcion ? ` · ${c.descripcion}` : ''}
                                </p>
                            </div>
                            <button title="Editar" onClick={() => editar(c)} style={btnIcon(SKY_DEEP)}><IconEdit /></button>
                            <button title="Eliminar" onClick={() => eliminar(c)} style={btnIcon('#ef4444')}><IconTrash /></button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
