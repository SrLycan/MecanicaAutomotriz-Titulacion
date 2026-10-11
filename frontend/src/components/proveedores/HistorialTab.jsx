/**
 * SS SWAP - Pestaña "Historial financiero" (dentro de la seccion Proveedores)
 * Muestra todos los movimientos de dinero con proveedores. Los tipos
 * 'compra', 'gasto' y 'cancelacion' se generan automaticamente (solo lectura);
 * 'pago', 'abono' y 'ajuste' se registran manualmente desde aqui.
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Paginador from './Paginador';
import { useAuth } from '../../context/AuthContext';

function IconPlus() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconX()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconBan()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.9" y1="4.9" x2="19.1" y2="19.1"/></svg>; }

const TIPOS = ['compra', 'pago', 'abono', 'gasto', 'cancelacion', 'ajuste'];
const TIPOS_MANUALES = ['pago', 'abono', 'ajuste'];
const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'];
const TIPO_COLOR = { compra: '#0ea5e9', pago: '#10b981', abono: '#22c55e', gasto: '#f59e0b', cancelacion: '#ef4444', ajuste: '#8b5cf6' };
const EMPTY = { proveedor_id: '', tipo: 'pago', compra_id: '', descripcion: '', monto: '', metodo_pago: 'efectivo', referencia: '' };

export default function HistorialTab({ theme, proveedores }) {
    const { puede } = useAuth();
    const { txt, txtSf, mut, bdr, card, cardSh, SKY, SKY_DEEP, SKY_PALE, labelSt, inputSt } = theme;
    const [movimientos, setMovimientos] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(false);
    const [filtros, setFiltros] = useState({ proveedor_id: '', tipo: '', fecha_inicio: '', fecha_fin: '' });
    const [pagina, setPagina] = useState(1);
    const POR_PAGINA = 20;

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
            params.set('page', String(pagina));
            params.set('limit', String(POR_PAGINA));
            const { data } = await api.get(`/proveedores/movimientos?${params}`);
            setMovimientos(data.movimientos || []);
            setTotal(data.total || 0);
        } catch (err) { toast.error('Error al cargar el historial financiero.'); }
        finally { setLoading(false); }
    }, [filtros, pagina]);

    useEffect(() => { setPagina(1); }, [filtros]);
    useEffect(() => { cargar(); }, [cargar]);

    const registrar = async (form) => {
        try {
            await api.post('/proveedores/movimientos', form);
            toast.success('Movimiento registrado.');
            setModal(false);
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al registrar el movimiento.'); }
    };

    const anular = async (m) => {
        try {
            await api.patch(`/proveedores/movimientos/${m.id}/estado`, { estado: 'anulado' });
            toast.success('Movimiento anulado.');
            cargar();
        } catch (err) { toast.error('Error al anular el movimiento.'); }
    };

    const filtroSel = { ...inputSt, padding: '8px 10px', fontSize: '.8rem' };

    return (
        <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
                <div>
                    <label style={labelSt}>PROVEEDOR</label>
                    <select style={filtroSel} value={filtros.proveedor_id} onChange={e => setFiltros({ ...filtros, proveedor_id: e.target.value })}>
                        <option value="">Todos</option>
                        {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
                    </select>
                </div>
                <div>
                    <label style={labelSt}>TIPO</label>
                    <select style={filtroSel} value={filtros.tipo} onChange={e => setFiltros({ ...filtros, tipo: e.target.value })}>
                        <option value="">Todos</option>
                        {TIPOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>
                <div>
                    <label style={labelSt}>DESDE</label>
                    <input type="date" style={filtroSel} value={filtros.fecha_inicio} onChange={e => setFiltros({ ...filtros, fecha_inicio: e.target.value })} />
                </div>
                <div>
                    <label style={labelSt}>HASTA</label>
                    <input type="date" style={filtroSel} value={filtros.fecha_fin} onChange={e => setFiltros({ ...filtros, fecha_fin: e.target.value })} />
                </div>
                {puede('proveedores', 'crear') && <button onClick={() => setModal(true)}
                    style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 11, padding: '10px 20px', cursor: 'pointer', height: 38 }}>
                    <IconPlus /> REGISTRAR PAGO/ABONO
                </button>}
            </div>

            <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginBottom: 12 }}>{total} movimiento{total !== 1 ? 's' : ''}</p>

            {loading ? (
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando historial...</p>
            ) : movimientos.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>Sin movimientos para estos filtros</p>
                </div>
            ) : (
                <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                    <table className="prov-table">
                        <thead>
                            <tr style={{ background: SKY_PALE }}>
                                {['Fecha', 'Proveedor', 'Tipo', 'Descripcion', 'Monto', 'Metodo', 'Estado', 'Usuario', ''].map(h => (
                                    <th key={h} style={{ color: SKY_DEEP }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {movimientos.map(m => (
                                <tr key={m.id} style={{ borderColor: bdr, opacity: m.estado === 'anulado' ? .5 : 1 }}>
                                    <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{new Date(m.created_at).toLocaleDateString('es-EC')}</td>
                                    <td style={{ color: txt, fontWeight: 600 }}>{m.proveedor_nombre}</td>
                                    <td>
                                        <span className="prov-badge" style={{ background: `${TIPO_COLOR[m.tipo]}18`, border: `1px solid ${TIPO_COLOR[m.tipo]}44`, color: TIPO_COLOR[m.tipo] }}>
                                            {m.tipo.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ color: txtSf, maxWidth: 200 }}>{m.descripcion || '—'}</td>
                                    <td style={{ color: txt, fontWeight: 600 }}>${parseFloat(m.monto).toFixed(2)}</td>
                                    <td style={{ color: txtSf, textTransform: 'capitalize' }}>{m.metodo_pago || '—'}</td>
                                    <td style={{ color: txtSf, textTransform: 'capitalize' }}>{m.estado}</td>
                                    <td style={{ color: txtSf }}>{m.usuario_nombre || '—'}</td>
                                    <td>
                                        {TIPOS_MANUALES.includes(m.tipo) && m.estado !== 'anulado' && (
                                            puede('proveedores', 'editar') && <button className="prov-icon-btn" title="Anular" style={{ color: '#ef4444' }} onClick={() => anular(m)}><IconBan /></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Paginador pagina={pagina} setPagina={setPagina} total={total} porPagina={POR_PAGINA} theme={theme} />

            {modal && (
                <ModalMovimiento theme={theme} proveedores={proveedores} onClose={() => setModal(false)} onGuardar={registrar} />
            )}
        </div>
    );
}

function ModalMovimiento({ theme, proveedores, onClose, onGuardar }) {
    const { txt, mut, bdr, boxBg, SKY, SKY_DEEP, labelSt, inputSt } = theme;
    const [form, setForm] = useState(EMPTY);
    const [compras, setCompras] = useState([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!form.proveedor_id) { setCompras([]); return; }
        api.get(`/proveedores/compras?proveedor_id=${form.proveedor_id}&limit=50`)
            .then(({ data }) => setCompras(data.compras || []))
            .catch(() => setCompras([]));
    }, [form.proveedor_id]);

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const onSubmit = async (e) => {
        e.preventDefault();
        if (!form.proveedor_id) return toast.error('Selecciona un proveedor.');
        if (!form.monto || parseFloat(form.monto) <= 0) return toast.error('El monto debe ser mayor a cero.');
        setSaving(true);
        await onGuardar({ ...form, compra_id: form.compra_id || undefined });
        setSaving(false);
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 560, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>HISTORIAL FINANCIERO</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.04em', color: txt }}>Registrar Movimiento</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut }}><IconX /></button>
                </div>

                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>PROVEEDOR *</label>
                            <select name="proveedor_id" value={form.proveedor_id} onChange={onChange} required style={inputSt}>
                                <option value="">Seleccionar...</option>
                                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelSt}>TIPO</label>
                            <select name="tipo" value={form.tipo} onChange={onChange} style={inputSt}>
                                {TIPOS_MANUALES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelSt}>MONTO *</label>
                            <input type="number" step="0.01" min="0.01" name="monto" value={form.monto} onChange={onChange} required style={inputSt} />
                        </div>
                        {compras.length > 0 && (
                            <div style={{ gridColumn: '1/-1' }}>
                                <label style={labelSt}>COMPRA RELACIONADA (opcional)</label>
                                <select name="compra_id" value={form.compra_id} onChange={onChange} style={inputSt}>
                                    <option value="">Ninguna / pago general</option>
                                    {compras.map(c => <option key={c.id} value={c.id}>#{c.id} — {c.fecha_solicitud} — ${parseFloat(c.total).toFixed(2)}</option>)}
                                </select>
                            </div>
                        )}
                        <div>
                            <label style={labelSt}>METODO DE PAGO</label>
                            <select name="metodo_pago" value={form.metodo_pago} onChange={onChange} style={inputSt}>
                                {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelSt}>REFERENCIA</label>
                            <input name="referencia" value={form.referencia} onChange={onChange} placeholder="N° transferencia, cheque..." style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>DESCRIPCION</label>
                            <textarea name="descripcion" value={form.descripcion} onChange={onChange} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}` }}>
                        <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                        <button type="submit" disabled={saving} style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1 }}>
                            {saving ? 'GUARDANDO...' : 'REGISTRAR'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
