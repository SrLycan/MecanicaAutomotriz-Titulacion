import React, { useState, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';

const EMPTY = { codigo: '', nombre: '', descripcion: '', categoria_id: '', precio_compra: '', precio_venta: '', stock_actual: '', stock_minimo: '5', unidad_medida: 'unidad' };

function IconX() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }

export default function ModalRepuesto({ repuesto, categorias, onGuardar, onCerrar }) {
    const { isDark } = useTheme();
    const [form, setForm]     = useState(EMPTY);
    const [saving, setSaving] = useState(false);
    const esEdicion = Boolean(repuesto);

    const txt     = isDark ? '#e2dff0' : '#160830';
    const mut     = isDark ? 'rgba(226,223,240,0.42)' : 'rgba(55,10,120,0.55)';
    const bdr     = isDark ? 'rgba(147,51,234,0.13)'  : 'rgba(100,30,180,0.16)';
    const inputSt = { background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(124,58,237,0.04)', border: `1px solid ${bdr}`, color: txt };

    useEffect(() => {
        if (repuesto) setForm({
            codigo: repuesto.codigo || '', nombre: repuesto.nombre || '', descripcion: repuesto.descripcion || '',
            categoria_id: repuesto.categoria_id || '', precio_compra: repuesto.precio_compra || '',
            precio_venta: repuesto.precio_venta || '', stock_actual: repuesto.stock_actual || '',
            stock_minimo: repuesto.stock_minimo || '5', unidad_medida: repuesto.unidad_medida || 'unidad',
        });
    }, [repuesto]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        await onGuardar(form);
        setSaving(false);
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onCerrar()}>
            <div className="modal-box" style={{ maxWidth: 560 }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.28em', color: isDark ? 'rgba(168,85,247,.45)' : 'rgba(124,58,237,.5)', marginBottom: 2 }}>
                            Admin · Inventario
                        </p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.06em', color: txt, lineHeight: 1 }}>
                            {esEdicion ? 'Editar Repuesto' : 'Nuevo Repuesto'}
                        </h2>
                    </div>
                    <button className="btn-icon" onClick={onCerrar}
                        style={{ color: mut }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = mut; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                        <IconX />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                        {/* Codigo */}
                        <div>
                            <label className="sswap-label">CODIGO *</label>
                            <input className="sswap-input" name="codigo" value={form.codigo} onChange={handleChange}
                                required disabled={esEdicion}
                                placeholder="ACE-MOT-5W30"
                                style={{ ...inputSt, opacity: esEdicion ? .5 : 1, textTransform: 'uppercase' }} />
                        </div>

                        {/* Unidad */}
                        <div>
                            <label className="sswap-label">UNIDAD DE MEDIDA</label>
                            <select className="sswap-input" name="unidad_medida" value={form.unidad_medida} onChange={handleChange} style={inputSt}>
                                {['unidad','litro','kg','metro','juego','par','caja'].map(u => <option key={u}>{u}</option>)}
                            </select>
                        </div>

                        {/* Nombre */}
                        <div style={{ gridColumn: '1/-1' }}>
                            <label className="sswap-label">NOMBRE *</label>
                            <input className="sswap-input" name="nombre" value={form.nombre} onChange={handleChange}
                                required placeholder="Nombre del repuesto" style={inputSt} />
                        </div>

                        {/* Descripcion */}
                        <div style={{ gridColumn: '1/-1' }}>
                            <label className="sswap-label">DESCRIPCION</label>
                            <textarea className="sswap-input" name="descripcion" value={form.descripcion} onChange={handleChange}
                                rows={2} placeholder="Descripcion breve del repuesto..."
                                style={{ ...inputSt, resize: 'vertical', minHeight: 64 }} />
                        </div>

                        {/* Categoria */}
                        <div style={{ gridColumn: '1/-1' }}>
                            <label className="sswap-label">CATEGORIA</label>
                            <select className="sswap-input" name="categoria_id" value={form.categoria_id} onChange={handleChange} style={inputSt}>
                                <option value="">Sin categoria</option>
                                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>

                        {/* Precios */}
                        <div>
                            <label className="sswap-label">PRECIO COMPRA (USD)</label>
                            <input className="sswap-input" type="number" min="0" step="0.01" name="precio_compra"
                                value={form.precio_compra} onChange={handleChange} placeholder="0.00" style={inputSt} />
                        </div>
                        <div>
                            <label className="sswap-label">PRECIO VENTA (USD)</label>
                            <input className="sswap-input" type="number" min="0" step="0.01" name="precio_venta"
                                value={form.precio_venta} onChange={handleChange} placeholder="0.00" style={inputSt} />
                        </div>

                        {/* Stock */}
                        <div>
                            <label className="sswap-label">
                                {esEdicion ? 'STOCK ACTUAL (usar Movimientos)' : 'STOCK INICIAL'}
                            </label>
                            <input className="sswap-input" type="number" min="0" name="stock_actual"
                                value={form.stock_actual} onChange={handleChange}
                                disabled={esEdicion}
                                style={{ ...inputSt, opacity: esEdicion ? .45 : 1 }} />
                        </div>
                        <div>
                            <label className="sswap-label">STOCK MINIMO (alerta)</label>
                            <input className="sswap-input" type="number" min="0" name="stock_minimo"
                                value={form.stock_minimo} onChange={handleChange} style={inputSt} />
                        </div>
                    </div>

                    {/* Margen */}
                    {form.precio_compra && form.precio_venta && parseFloat(form.precio_compra) > 0 && (
                        <div style={{ padding: '10px 14px', borderRadius: 10, background: isDark ? 'rgba(168,85,247,.06)' : 'rgba(124,58,237,.05)', border: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.18em', color: isDark ? 'rgba(168,85,247,.5)' : 'rgba(124,58,237,.55)' }}>MARGEN</p>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.3rem', letterSpacing: '.05em', color: '#22c55e' }}>
                                    {((parseFloat(form.precio_venta) - parseFloat(form.precio_compra)) / parseFloat(form.precio_compra) * 100).toFixed(1)}%
                                </p>
                            </div>
                            <div>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.18em', color: isDark ? 'rgba(168,85,247,.5)' : 'rgba(124,58,237,.55)' }}>UTILIDAD POR UNIDAD</p>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.3rem', letterSpacing: '.05em', color: '#a855f7' }}>
                                    ${(parseFloat(form.precio_venta) - parseFloat(form.precio_compra)).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,.06)' : 'rgba(100,30,180,.08)'}`, marginTop: 4 }}>
                        <button type="button" className="btn-ghost" onClick={onCerrar}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={saving}>
                            <span>{saving ? 'Guardando...' : esEdicion ? 'Guardar Cambios' : 'Crear Repuesto'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
