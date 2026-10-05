/**
 * SS SWAP - Modal de Registro de Movimientos de Inventario (Entrada / Salida)
 * Permite asentar entradas por compras o salidas por servicios con cálculo visual en tiempo real del nuevo stock.
 */
import React, { useState } from 'react';
import { useTheme } from '../../context/ThemeContext';
import api from '../../services/api';

function IconX()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconIn()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>; }
function IconOut()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>; }

export default function ModalMovimiento({ repuesto, onGuardado, onCerrar }) {
    const { isDark } = useTheme();
    const [form, setForm]     = useState({ tipo: 'entrada', cantidad: '', motivo: '', referencia: '', origen: 'manual' });
    const [saving, setSaving] = useState(false);
    const [error,  setError]  = useState('');

    // ── Paleta celeste / blanco / negro ──
    const SKY      = '#0ea5e9';
    const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.06)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.22)';

    const txt     = isDark ? '#f1f5f9'                : '#0f172a';
    const mut     = isDark ? 'rgba(241,245,249,0.55)' : 'rgba(15,23,42,0.55)';
    const bdr     = isDark ? 'rgba(148,163,184,0.18)' : 'rgba(15,23,42,0.10)';
    const inputBg = isDark ? '#0b1220'                : '#f8fafc';
    const boxBg   = isDark ? '#0a0f1c'                : '#ffffff';
    const previewBg = isDark ? 'rgba(14,165,233,0.05)' : 'rgba(14,165,233,0.04)';

    const inputSt = {
        width: '100%', boxSizing: 'border-box',
        padding: '10px 13px', borderRadius: 10,
        border: `1px solid ${bdr}`, background: inputBg, color: txt,
        fontFamily: "'Outfit', sans-serif", fontWeight: 400, fontSize: '.88rem',
        outline: 'none', transition: 'border-color .18s, box-shadow .18s',
    };
    const labelSt = {
        display: 'block', marginBottom: 6,
        fontFamily: "'Bebas Neue', sans-serif", fontSize: '.62rem', letterSpacing: '.22em',
        color: SKY_DEEP, WebkitTextFillColor: SKY_DEEP, background: 'none',
    };

    // Cálculo en vivo del stock resultante: se muestra antes de guardar para
    // evitar salidas que dejarian el stock en negativo.
    const esEntrada   = form.tipo === 'entrada';
    const accentColor = esEntrada ? '#10b981' : '#ef4444';
    const qty         = Math.round((parseFloat(form.cantidad) || 0) * 100) / 100; // stock decimal (Sprint 14)
    const stockNuevo  = esEntrada ? Math.round((Number(repuesto.stock_actual) + qty) * 100) / 100 : Math.round((Number(repuesto.stock_actual) - qty) * 100) / 100;

    const handleChange = (e) => { setForm({ ...form, [e.target.name]: e.target.value }); setError(''); };
    const onFocus = (e) => { e.target.style.borderColor = SKY; e.target.style.boxShadow = `0 0 0 3px rgba(14,165,233,.14)`; };
    const onBlur  = (e) => { e.target.style.borderColor = bdr; e.target.style.boxShadow = 'none'; };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.cantidad || qty <= 0) { setError('La cantidad debe ser mayor a cero.'); return; }
        setSaving(true);
        try {
            await api.post('/inventory/movimientos', {
                repuesto_id: repuesto.id, tipo: form.tipo, cantidad: qty,
                motivo: form.motivo, referencia: form.referencia, origen: form.origen,
            });
            onGuardado();
        } catch (err) {
            setError(err.response?.data?.error || 'Error al registrar movimiento.');
        } finally { setSaving(false); }
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onCerrar()}>
            <div className="modal-box" style={{ maxWidth: 500, overflow: 'visible', background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>

                {/* Línea de color según tipo */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`, borderRadius: '20px 20px 0 0', transition: 'background .3s' }} />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '3px 9px', borderRadius: 999, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, marginBottom: 6 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: SKY }} />
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.24em', color: SKY_DEEP }}>SS SWAP · ALMACEN</p>
                        </div>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>
                            Movimiento de Stock
                        </h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.78rem', color: mut, marginTop: 6 }}>
                            <code style={{ fontFamily: 'monospace', fontSize: '.74rem', fontWeight: 600, background: SKY_PALE, padding: '2px 7px', borderRadius: 5, color: SKY_DEEP, border: `1px solid ${SKY_BDR}` }}>{repuesto.codigo}</code>
                            {' '}{repuesto.nombre}
                        </p>
                    </div>
                    <button onClick={onCerrar}
                        style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', marginTop: 4 }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = mut; e.currentTarget.style.borderColor = bdr; }}>
                        <IconX />
                    </button>
                </div>

                {/* Preview de stock */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px', background: previewBg, borderRadius: 12, border: `1px solid ${SKY_BDR}`, marginBottom: 18 }}>
                    <div style={{ textAlign: 'center', flex: 1 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.1rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>{repuesto.stock_actual}</p>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.62rem', color: mut, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.14em' }}>Stock Actual</p>
                    </div>

                    {qty > 0 && (
                        <>
                            <div style={{ textAlign: 'center', color: accentColor }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', lineHeight: 1 }}>{esEntrada ? '+' : '−'}</p>
                            </div>
                            <div style={{ textAlign: 'center', flex: 1, transition: 'transform .25s', transform: 'scale(1)' }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.1rem', letterSpacing: '.04em', color: accentColor, lineHeight: 1 }}>{qty}</p>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.62rem', color: accentColor, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.14em', opacity: .85 }}>{esEntrada ? 'Entrada' : 'Salida'}</p>
                            </div>
                            <div style={{ textAlign: 'center', color: mut }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', lineHeight: 1 }}>=</p>
                            </div>
                            <div style={{
                                textAlign: 'center', flex: 1,
                                background: stockNuevo < 0 ? 'rgba(239,68,68,.08)' : SKY_PALE,
                                borderRadius: 10, padding: '8px 6px',
                                border: `1px solid ${stockNuevo < 0 ? 'rgba(239,68,68,.25)' : SKY_BDR}`,
                            }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.1rem', letterSpacing: '.04em', color: stockNuevo < 0 ? '#ef4444' : SKY_DEEP, lineHeight: 1 }}>{stockNuevo}</p>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.62rem', color: stockNuevo < 0 ? '#ef4444' : SKY_DEEP, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.14em', opacity: .85 }}>Nuevo Stock</p>
                            </div>
                        </>
                    )}
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                    {/* Tipo toggle */}
                    <div>
                        <label style={labelSt}>TIPO DE MOVIMIENTO</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {[
                                { val: 'entrada', label: 'Entrada de Stock', color: '#10b981', icon: <IconIn /> },
                                { val: 'salida',  label: 'Salida de Stock',  color: '#ef4444', icon: <IconOut /> },
                            ].map(t => {
                                const active = form.tipo === t.val;
                                return (
                                    <button key={t.val} type="button"
                                        style={{
                                            flex: 1, padding: '11px',
                                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                            borderRadius: 10,
                                            border: `1px solid ${active ? t.color + '66' : bdr}`,
                                            background: active ? t.color + '15' : 'transparent',
                                            color: active ? t.color : mut,
                                            fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em',
                                            cursor: 'pointer', transition: 'all .18s', textTransform: 'uppercase',
                                            boxShadow: active ? `0 6px 18px -8px ${t.color}` : 'none',
                                        }}
                                        onClick={() => setForm(f => ({ ...f, tipo: t.val, origen: t.val === 'salida' && f.origen === 'devolucion' ? 'manual' : f.origen }))}>
                                        {t.icon} {t.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Origen (Sprint 14): diferencia salida manual / ajuste / devolucion.
                        Las salidas por proforma y entradas por compra las registra el sistema. */}
                    <div>
                        <label style={labelSt}>ORIGEN DEL MOVIMIENTO</label>
                        <select value={form.origen} onChange={e => { const o = e.target.value; setForm(f => ({ ...f, origen: o, tipo: o === 'devolucion' ? 'entrada' : f.tipo })); setError(''); }} style={inputSt}>
                            <option value="manual">{esEntrada ? 'Entrada manual' : 'Salida manual'}</option>
                            <option value="ajuste">Ajuste de inventario (conteo físico, merma, daño)</option>
                            <option value="devolucion">Devolución (entrada)</option>
                        </select>
                    </div>

                    {/* Cantidad */}
                    <div>
                        <label style={labelSt}>CANTIDAD *</label>
                        <input type="number" min="0.01" step="0.01" name="cantidad"
                            value={form.cantidad} onChange={handleChange}
                            onFocus={onFocus} onBlur={onBlur}
                            required placeholder="0"
                            style={{ ...inputSt, fontSize: '1.15rem', textAlign: 'center', fontFamily: "'Bebas Neue'", letterSpacing: '.04em', padding: '12px' }} />
                    </div>

                    {/* Motivo */}
                    <div>
                        <label style={labelSt}>MOTIVO</label>
                        <input name="motivo" value={form.motivo} onChange={handleChange}
                            onFocus={onFocus} onBlur={onBlur}
                            placeholder="Ej: Compra proveedor, Uso en OT-042" style={inputSt} />
                    </div>

                    {/* Referencia */}
                    <div>
                        <label style={labelSt}>REFERENCIA <span style={{ fontFamily: "'Outfit'", textTransform: 'none', letterSpacing: 0, fontSize: '.7rem', fontWeight: 300, color: mut, WebkitTextFillColor: mut }}>· Nro. factura / OT</span></label>
                        <input name="referencia" value={form.referencia} onChange={handleChange}
                            onFocus={onFocus} onBlur={onBlur}
                            placeholder="FAC-001, OT-042" style={inputSt} />
                    </div>

                    {error && (
                        <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', fontFamily: "'Outfit'", fontSize: '.82rem', fontWeight: 500 }}>
                            {error}
                        </div>
                    )}

                    {/* Footer */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}`, marginTop: 4 }}>
                        <button type="button" onClick={onCerrar}
                            style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut, transition: 'all .18s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = SKY_BDR; e.currentTarget.style.color = txt; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = bdr; e.currentTarget.style.color = mut; }}>
                            CANCELAR
                        </button>
                        <button type="submit" disabled={saving}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 7,
                                fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em',
                                color: '#fff',
                                background: `linear-gradient(135deg, ${esEntrada ? '#059669' : '#dc2626'}, ${accentColor})`,
                                border: 'none', borderRadius: 10, padding: '10px 22px',
                                cursor: saving ? 'not-allowed' : 'pointer', transition: 'all .2s',
                                opacity: saving ? .6 : 1, boxShadow: `0 6px 18px -8px ${accentColor}`,
                            }}
                            onMouseEnter={e => { if (!saving) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 10px 26px -8px ${accentColor}`; } }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 6px 18px -8px ${accentColor}`; }}>
                            {saving ? 'GUARDANDO...' : `CONFIRMAR ${esEntrada ? 'ENTRADA' : 'SALIDA'}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
