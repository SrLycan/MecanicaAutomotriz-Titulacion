import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

function IconX() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }

export default function ModalMovimiento({ repuesto, onGuardado, onCerrar }) {
    const { isDark } = useTheme();
    const [form, setForm]     = useState({ tipo: 'entrada', cantidad: '', motivo: '', referencia: '' });
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    const txt     = isDark ? '#e2dff0' : '#160830';
    const mut     = isDark ? 'rgba(226,223,240,0.42)' : 'rgba(55,10,120,0.55)';
    const bdr     = isDark ? 'rgba(147,51,234,0.13)'  : 'rgba(100,30,180,0.16)';
    const inputSt = { background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(124,58,237,0.04)', border: `1px solid ${bdr}`, color: txt };

    const esEntrada  = form.tipo === 'entrada';
    const accentColor = esEntrada ? '#22c55e' : '#ef4444';
    const qty        = parseInt(form.cantidad) || 0;
    const stockNuevo = esEntrada ? repuesto.stock_actual + qty : repuesto.stock_actual - qty;

    const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setError(''); };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.cantidad || qty <= 0) { setError('La cantidad debe ser mayor a cero.'); return; }
        setSaving(true);
        try {
            await api.post('/inventory/movimientos', {
                repuesto_id: repuesto.id, tipo: form.tipo, cantidad: qty,
                motivo: form.motivo, referencia: form.referencia,
            });
            onGuardado();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al registrar movimiento.');
        } finally { setSaving(false); }
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onCerrar()}>
            <div className="modal-box" style={{ maxWidth: 480, overflow: 'visible' }}>

                {/* Linea de color segun tipo */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accentColor}66, transparent)`, borderRadius: '20px 20px 0 0' }} />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.28em', color: isDark ? 'rgba(168,85,247,.45)' : 'rgba(124,58,237,.5)', marginBottom: 2 }}>
                            SSWAP · Almacen
                        </p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.06em', color: txt, lineHeight: 1 }}>
                            Movimiento de Stock
                        </h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.78rem', color: mut, marginTop: 4 }}>
                            <code style={{ fontFamily: 'monospace', fontSize: '.75rem', background: isDark ? 'rgba(168,85,247,.1)' : 'rgba(124,58,237,.08)', padding: '1px 6px', borderRadius: 4, color: isDark ? 'rgba(168,85,247,.9)' : 'rgba(124,58,237,.9)' }}>{repuesto.codigo}</code>
                            {' '}{repuesto.nombre}
                        </p>
                    </div>
                    <button className="btn-icon" onClick={onCerrar} style={{ color: mut, marginTop: 4 }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = mut; e.currentTarget.style.borderColor = 'var(--border)'; }}>
                        <IconX />
                    </button>
                </div>

                {/* Preview de stock */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(124,58,237,0.04)', borderRadius: 12, border: `1px solid ${bdr}`, marginBottom: 20 }}>
                    {/* Stock actual */}
                    <div style={{ textAlign: 'center', flex: 1 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>{repuesto.stock_actual}</p>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.65rem', color: mut, marginTop: 2, textTransform: 'uppercase', letterSpacing: '.08em' }}>Stock Actual</p>
                    </div>

                    {qty > 0 && (
                        <>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', color: accentColor }}>{esEntrada ? '+' : '-'}</p>
                            </div>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2rem', letterSpacing: '.04em', color: accentColor, lineHeight: 1 }}>{qty}</p>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.65rem', color: accentColor, marginTop: 2, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .8 }}>{esEntrada ? 'Entrada' : 'Salida'}</p>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', color: mut }}>=</p>
                            </div>
                            <div style={{ textAlign: 'center', flex: 1, background: stockNuevo < 0 ? 'rgba(239,68,68,.08)' : 'rgba(34,197,94,.06)', borderRadius: 10, padding: '8px 6px', border: `1px solid ${stockNuevo < 0 ? 'rgba(239,68,68,.2)' : 'rgba(34,197,94,.15)'}` }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2rem', letterSpacing: '.04em', color: stockNuevo < 0 ? '#ef4444' : '#22c55e', lineHeight: 1 }}>{stockNuevo}</p>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.65rem', color: stockNuevo < 0 ? '#ef4444' : '#22c55e', marginTop: 2, textTransform: 'uppercase', letterSpacing: '.08em', opacity: .8 }}>Nuevo Stock</p>
                            </div>
                        </>
                    )}
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Tipo toggle */}
                    <div>
                        <label className="sswap-label">TIPO DE MOVIMIENTO</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {['entrada', 'salida'].map(t => (
                                <button key={t} type="button"
                                    style={{ flex: 1, padding: '10px', borderRadius: 9, border: `1px solid ${form.tipo === t ? (t === 'entrada' ? 'rgba(34,197,94,.4)' : 'rgba(239,68,68,.4)') : bdr}`, background: form.tipo === t ? (t === 'entrada' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)') : 'none', color: form.tipo === t ? (t === 'entrada' ? '#22c55e' : '#ef4444') : mut, fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.12em', cursor: 'pointer', transition: 'all .15s', textTransform: 'uppercase' }}
                                    onClick={() => setForm(f => ({ ...f, tipo: t }))}>
                                    {t === 'entrada' ? 'Entrada de Stock' : 'Salida de Stock'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Cantidad */}
                    <div>
                        <label className="sswap-label">CANTIDAD *</label>
                        <input className="sswap-input" type="number" min="1" name="cantidad"
                            value={form.cantidad} onChange={handleChange}
                            required placeholder="0"
                            style={{ ...inputSt, fontSize: '1.1rem', textAlign: 'center', fontFamily: "'Bebas Neue'", letterSpacing: '.04em' }} />
                    </div>

                    {/* Motivo */}
                    <div>
                        <label className="sswap-label">MOTIVO</label>
                        <input className="sswap-input" name="motivo" value={form.motivo} onChange={handleChange}
                            placeholder="Ej: Compra proveedor, Uso en OT-042" style={inputSt} />
                    </div>

                    {/* Referencia */}
                    <div>
                        <label className="sswap-label">REFERENCIA <span style={{ fontFamily: "'Outfit'", textTransform: 'none', letterSpacing: 0, fontSize: '.7rem', fontWeight: 300, WebkitTextFillColor: mut }}>Nro. factura / OT</span></label>
                        <input className="sswap-input" name="referencia" value={form.referencia} onChange={handleChange}
                            placeholder="FAC-001, OT-042" style={inputSt} />
                    </div>

                    {error && (
                        <div style={{ padding: '10px 14px', borderRadius: 9, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.22)', color: '#ef4444', fontFamily: "'Outfit'", fontSize: '.82rem', fontWeight: 500 }}>
                            {error}
                        </div>
                    )}

                    {/* Footer */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${isDark ? 'rgba(255,255,255,.06)' : 'rgba(100,30,180,.08)'}`, marginTop: 4 }}>
                        <button type="button" className="btn-ghost" onClick={onCerrar}>Cancelar</button>
                        <button type="submit" disabled={saving}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Bebas Neue'", fontSize: '.75rem', letterSpacing: '.12em', color: '#fff', background: `linear-gradient(135deg, ${esEntrada ? '#16a34a, #22c55e' : '#dc2626, #ef4444'})`, border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', transition: 'all .2s', opacity: saving ? .6 : 1 }}>
                            {saving ? 'Guardando...' : `Confirmar ${esEntrada ? 'Entrada' : 'Salida'}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
