import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import toast from 'react-hot-toast';

function IconSearch() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconIn()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>; }
function IconOut()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>; }
function IconPkg()   { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function IconCheck() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>; }

export default function RegistrarMovimiento() {
    const { isDark } = useTheme();
    const [repuestos, setRepuestos] = useState([]);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ tipo: 'entrada', cantidad: '', motivo: '', referencia: '' });
    const [error, setError] = useState('');
    const [step, setStep] = useState('select'); // 'select' | 'form' | 'done'

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
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
    const rowHov  = isDark ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.04)';

    useEffect(() => {
        setLoading(true);
        api.get('/inventory/repuestos')
            .then(r => setRepuestos(r.data.repuestos || []))
            .catch(() => toast.error('Error al cargar repuestos'))
            .finally(() => setLoading(false));
    }, []);

    const filtrados = useMemo(() => {
        if (!search) return repuestos;
        const q = search.toLowerCase();
        return repuestos.filter(r =>
            r.nombre?.toLowerCase().includes(q) ||
            r.codigo?.toLowerCase().includes(q) ||
            r.categoria_nombre?.toLowerCase().includes(q)
        );
    }, [repuestos, search]);

    const esEntrada = form.tipo === 'entrada';
    const accentColor = esEntrada ? '#10b981' : '#ef4444';
    const qty = parseInt(form.cantidad) || 0;
    const stockNuevo = selected ? (esEntrada ? selected.stock_actual + qty : selected.stock_actual - qty) : 0;

    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit', sans-serif", fontWeight: 400, fontSize: '.88rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue', sans-serif", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP, WebkitTextFillColor: SKY_DEEP, background: 'none' };

    const handleSelect = (r) => {
        setSelected(r);
        setForm({ tipo: 'entrada', cantidad: '', motivo: '', referencia: '' });
        setError('');
        setStep('form');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.cantidad || qty <= 0) { setError('La cantidad debe ser mayor a cero.'); return; }
        if (!esEntrada && qty > selected.stock_actual) { setError(`Stock insuficiente. Stock actual: ${selected.stock_actual}.`); return; }
        setSaving(true);
        try {
            await api.post('/inventory/movimientos', {
                repuesto_id: selected.id,
                tipo: form.tipo,
                cantidad: qty,
                motivo: form.motivo,
                referencia: form.referencia,
            });
            toast.success(`Movimiento registrado: ${esEntrada ? '+' : '-'}${qty} ${selected.nombre}`);
            // Update local stock
            setSelected(prev => ({ ...prev, stock_actual: stockNuevo }));
            setRepuestos(prev => prev.map(r => r.id === selected.id ? { ...r, stock_actual: stockNuevo } : r));
            setStep('done');
        } catch (err) {
            setError(err.response?.data?.error || 'Error al registrar movimiento.');
        } finally { setSaving(false); }
    };

    const resetAll = () => {
        setSelected(null);
        setForm({ tipo: 'entrada', cantidad: '', motivo: '', referencia: '' });
        setError('');
        setStep('select');
    };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1200 }}>
            <style>{`
                @keyframes regIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
                .reg-item { animation: regIn .25s ease both; transition: background .15s, border-color .2s, transform .2s; cursor: pointer; }
                .reg-item:hover { border-color: ${SKY_BDR} !important; background: ${rowHov} !important; transform: translateY(-2px); }
                .reg-item.selected { border-color: ${SKY} !important; background: ${SKY_PALE} !important; }
            `}</style>

            {/* Header */}
            <div style={{ marginBottom: 22 }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 999, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, marginBottom: 8 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: SKY, boxShadow: `0 0 8px ${SKY}` }} />
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP }}>SSWAP · REGISTRO RAPIDO</p>
                </div>
                <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>
                    {step === 'select' ? 'Registrar Movimiento' : step === 'form' ? 'Confirmar Movimiento' : 'Movimiento Completado'}
                </h1>
                <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                    {step === 'select' ? 'Selecciona un producto del inventario para registrar entrada o salida' :
                     step === 'form' ? `Revisa los datos antes de confirmar` : 'El movimiento se ha registrado correctamente'}
                </p>
            </div>

            {/* Step indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                {['Seleccionar Producto', 'Registrar Movimiento', 'Confirmacion'].map((l, i) => {
                    const states = ['select', 'form', 'done'];
                    const current = states.indexOf(step);
                    const active = i <= current;
                    return (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: '50%',
                                background: active ? `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})` : card,
                                border: `1px solid ${active ? 'transparent' : bdr}`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: active ? `0 4px 12px -4px ${SKY}` : 'none',
                            }}>
                                {active && current > i
                                    ? <IconCheck />
                                    : <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', color: active ? '#fff' : mut }}>{i + 1}</span>}
                            </div>
                            <span style={{ fontFamily: "'Outfit'", fontWeight: active ? 600 : 400, fontSize: '.78rem', color: active ? txt : mut }}>{l}</span>
                            {i < 2 && <span style={{ color: bdr, fontSize: '.7rem' }}>—</span>}
                        </div>
                    );
                })}
            </div>

            {/* ── STEP 1: Select product ── */}
            {step === 'select' && (
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, overflow: 'hidden', boxShadow: cardSh }}>
                    {/* Search */}
                    <div style={{ padding: 16, borderBottom: `1px solid ${bdr}` }}>
                        <div style={{ position: 'relative', maxWidth: 400 }}>
                            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: faint, display: 'flex' }}><IconSearch /></span>
                            <input
                                placeholder="Buscar por codigo, nombre o categoria..."
                                value={search} onChange={e => setSearch(e.target.value)}
                                style={{ width: '100%', padding: '10px 12px 10px 34px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none' }}
                            />
                        </div>
                    </div>

                    {/* List */}
                    {loading ? (
                        <div style={{ padding: 60, textAlign: 'center' }}>
                            <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${bdr}`, borderTopColor: SKY, animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut }}>Cargando inventario...</p>
                        </div>
                    ) : filtrados.length === 0 ? (
                        <div style={{ padding: 60, textAlign: 'center' }}>
                            <div style={{ width: 56, height: 56, borderRadius: 16, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SKY, margin: '0 auto 12px' }}><IconPkg /></div>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>Sin resultados</p>
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, marginTop: 4 }}>No se encontraron productos con esa busqueda</p>
                        </div>
                    ) : (
                        <div style={{ maxHeight: 480, overflowY: 'auto', padding: 4 }}>
                            {filtrados.map((r, i) => {
                                const bajo = r.stock_actual <= r.stock_minimo;
                                return (
                                    <div key={r.id} className="reg-item"
                                        onClick={() => handleSelect(r)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 14,
                                            padding: '14px 16px', margin: 3,
                                            borderRadius: 12,
                                            border: `1px solid transparent`,
                                            background: 'transparent',
                                            animationDelay: `${i * 25}ms`,
                                        }}>
                                        {/* Avatar */}
                                        <div style={{
                                            width: 42, height: 42, borderRadius: 10,
                                            background: SKY_PALE, border: `1px solid ${SKY_BDR}`,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: SKY_DEEP, flexShrink: 0,
                                        }}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</p>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                                                <code style={{ fontFamily: 'monospace', fontSize: '.7rem', fontWeight: 600, background: SKY_PALE, padding: '1px 7px', borderRadius: 5, color: SKY_DEEP, border: `1px solid ${SKY_BDR}` }}>{r.codigo}</code>
                                                {r.categoria_nombre && <span style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut }}>{r.categoria_nombre}</span>}
                                            </div>
                                        </div>

                                        {/* Stock */}
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.3rem', letterSpacing: '.02em', color: bajo ? '#ef4444' : txt, lineHeight: 1 }}>{r.stock_actual}</p>
                                            <p style={{ fontFamily: "'Outfit'", fontSize: '.64rem', color: mut }}>stock</p>
                                            {bajo && <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.54rem', letterSpacing: '.14em', color: '#ef4444' }}>BAJO</span>}
                                        </div>

                                        {/* Arrow */}
                                        <span style={{ color: faint }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg></span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── STEP 2: Movement form ── */}
            {step === 'form' && selected && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 20, alignItems: 'start' }}>
                    {/* Selected product card */}
                    <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 22, boxShadow: cardSh }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '3px 9px', borderRadius: 999, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, marginBottom: 12 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: SKY }} />
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.24em', color: SKY_DEEP }}>PRODUCTO SELECCIONADO</p>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SKY_DEEP, flexShrink: 0 }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                            </div>
                            <div>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.95rem', color: txt }}>{selected.nombre}</p>
                                <code style={{ fontFamily: 'monospace', fontSize: '.72rem', fontWeight: 600, background: SKY_PALE, padding: '2px 8px', borderRadius: 5, color: SKY_DEEP, border: `1px solid ${SKY_BDR}` }}>{selected.codigo}</code>
                            </div>
                        </div>

                        {/* Stock preview */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '18px 14px', background: SKY_PALE, borderRadius: 12, border: `1px solid ${SKY_BDR}` }}>
                            <div style={{ textAlign: 'center', flex: 1 }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.4rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>{selected.stock_actual}</p>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.6rem', color: mut, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.14em' }}>Actual</p>
                            </div>
                            {qty > 0 && (
                                <>
                                    <div style={{ color: accentColor, fontSize: '1.8rem', fontFamily: "'Bebas Neue'" }}>{esEntrada ? '+' : '−'}</div>
                                    <div style={{ textAlign: 'center', flex: 1 }}>
                                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.4rem', letterSpacing: '.04em', color: accentColor, lineHeight: 1 }}>{qty}</p>
                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.6rem', color: accentColor, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.14em', opacity: .85 }}>{esEntrada ? 'Entrada' : 'Salida'}</p>
                                    </div>
                                    <div style={{ color: mut, fontSize: '1.4rem' }}>=</div>
                                    <div style={{ textAlign: 'center', flex: 1, background: stockNuevo < 0 ? 'rgba(239,68,68,.08)' : SKY_PALE, borderRadius: 10, padding: '8px 6px', border: `1px solid ${stockNuevo < 0 ? 'rgba(239,68,68,.25)' : SKY_BDR}` }}>
                                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.4rem', letterSpacing: '.04em', color: stockNuevo < 0 ? '#ef4444' : SKY_DEEP, lineHeight: 1 }}>{stockNuevo}</p>
                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.6rem', color: stockNuevo < 0 ? '#ef4444' : SKY_DEEP, marginTop: 4, textTransform: 'uppercase', letterSpacing: '.14em', opacity: .85 }}>Resultado</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Form */}
                    <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 22, boxShadow: cardSh }}>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* Tipo */}
                            <div>
                                <label style={labelSt}>TIPO DE MOVIMIENTO</label>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[
                                        { val: 'entrada', label: 'Entrada', color: '#10b981', icon: <IconIn /> },
                                        { val: 'salida', label: 'Salida', color: '#ef4444', icon: <IconOut /> },
                                    ].map(t => {
                                        const active = form.tipo === t.val;
                                        return (
                                            <button key={t.val} type="button"
                                                style={{
                                                    flex: 1, padding: '11px',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                                                    borderRadius: 10,
                                                    border: `1px solid ${active ? t.color + '66' : bdr}`,
                                                    background: active ? t.color + '15' : 'transparent',
                                                    color: active ? t.color : mut,
                                                    fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em',
                                                    cursor: 'pointer', transition: 'all .18s',
                                                }}
                                                onClick={() => { setForm(f => ({ ...f, tipo: t.val })); setError(''); }}>
                                                {t.icon} {t.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Cantidad */}
                            <div>
                                <label style={labelSt}>CANTIDAD *</label>
                                <input type="number" min="1" name="cantidad"
                                    value={form.cantidad} onChange={e => { setForm(f => ({ ...f, cantidad: e.target.value })); setError(''); }}
                                    required placeholder="0"
                                    style={{ ...inputSt, fontSize: '1.15rem', textAlign: 'center', fontFamily: "'Bebas Neue'", letterSpacing: '.04em', padding: '12px' }} />
                                {!esEntrada && qty > selected.stock_actual && (
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: '#ef4444', marginTop: 4 }}>Stock insuficiente. Maximo: {selected.stock_actual}</p>
                                )}
                            </div>

                            {/* Motivo */}
                            <div>
                                <label style={labelSt}>MOTIVO</label>
                                <input name="motivo" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                                    placeholder="Ej: Compra proveedor, Uso en OT-042" style={inputSt} />
                            </div>

                            {/* Referencia */}
                            <div>
                                <label style={labelSt}>REFERENCIA</label>
                                <input name="referencia" value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))}
                                    placeholder="FAC-001, OT-042" style={inputSt} />
                            </div>

                            {error && (
                                <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,.08)', border: '1px solid rgba(239,68,68,.25)', color: '#ef4444', fontFamily: "'Outfit'", fontSize: '.82rem' }}>
                                    {error}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 12, borderTop: `1px solid ${bdr}`, marginTop: 4 }}>
                                <button type="button" onClick={resetAll}
                                    style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>
                                    CANCELAR
                                </button>
                                <button type="submit" disabled={saving}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 7,
                                        fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em',
                                        color: '#fff',
                                        background: `linear-gradient(135deg, ${esEntrada ? '#059669' : '#dc2626'}, ${accentColor})`,
                                        border: 'none', borderRadius: 10, padding: '10px 22px',
                                        cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1,
                                        boxShadow: `0 6px 18px -8px ${accentColor}`,
                                    }}>
                                    {saving ? 'GUARDANDO...' : `CONFIRMAR ${esEntrada ? 'ENTRADA' : 'SALIDA'}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── STEP 3: Done ── */}
            {step === 'done' && (
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '60px 28px', boxShadow: cardSh, textAlign: 'center' }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: '50%',
                        background: 'rgba(16,185,129,.12)', border: '1px solid rgba(16,185,129,.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#10b981', margin: '0 auto 20px',
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.8rem', letterSpacing: '.04em', color: txt, marginBottom: 8 }}>Movimiento Registrado</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.9rem', color: mut, maxWidth: 400, margin: '0 auto 28px' }}>
                        Se ha registrado {esEntrada ? 'una entrada' : 'una salida'} de <strong style={{ color: txt }}>{qty} {qty === 1 ? 'unidad' : 'unidades'}</strong> de <strong style={{ color: txt }}>{selected?.nombre}</strong>.
                    </p>
                    <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                        <button onClick={() => { resetAll(); setRepuestos([]); setLoading(true); api.get('/inventory/repuestos').then(r => setRepuestos(r.data.repuestos || [])).finally(() => setLoading(false)); }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '11px 24px', cursor: 'pointer', boxShadow: `0 6px 18px -6px ${SKY}` }}>
                            NUEVO MOVIMIENTO
                        </button>
                        <button onClick={resetAll}
                            style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '11px 18px', cursor: 'pointer', color: mut }}>
                            CAMBIAR PRODUCTO
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
