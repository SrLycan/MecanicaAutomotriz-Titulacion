/**
 * SS SWAP - Pestaña "Gastos" (dentro de la seccion Proveedores)
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useConfirm } from '../common/ConfirmDialog';
import Paginador from './Paginador';
import { useAuth } from '../../context/AuthContext';

function IconPlus()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconEdit()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconTrash() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>; }
function IconX()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }

const CATEGORIAS = ['repuestos', 'materiales', 'insumos', 'herramientas', 'servicios', 'otros'];
const METODOS    = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'];
const ESTADOS    = ['pendiente', 'pagado', 'anulado'];
const ESTADO_COLOR = { pendiente: '#f59e0b', pagado: '#10b981', anulado: '#ef4444' };
const EMPTY = { proveedor_id: '', categoria: 'otros', descripcion: '', monto: '', fecha: '', metodo_pago: 'efectivo', estado: 'pagado', numero_comprobante: '', observaciones: '' };

export default function GastosTab({ theme, proveedores }) {
    const { puede } = useAuth();
    const confirm = useConfirm();
    const { txt, txtSf, mut, bdr, card, cardSh, inputBg, SKY, SKY_DEEP, SKY_PALE, labelSt, inputSt } = theme;
    const [gastos, setGastos]   = useState([]);
    const [total, setTotal]     = useState(0);
    const [loading, setLoading] = useState(true);
    const [modal, setModal]     = useState({ open: false, data: null });
    const [filtros, setFiltros] = useState({ proveedor_id: '', categoria: '', estado: '', fecha_inicio: '', fecha_fin: '' });
    const [pagina, setPagina] = useState(1);
    const POR_PAGINA = 20;

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
            params.set('page', String(pagina));
            params.set('limit', String(POR_PAGINA));
            const { data } = await api.get(`/proveedores/gastos?${params}`);
            setGastos(data.gastos || []);
            setTotal(data.total || 0);
        } catch (err) { toast.error('Error al cargar gastos.'); }
        finally { setLoading(false); }
    }, [filtros, pagina]);

    // Cualquier cambio de filtro vuelve a la pagina 1 (evita quedar en una
    // pagina vacia si el filtro nuevo tiene menos resultados).
    useEffect(() => { setPagina(1); }, [filtros]);

    useEffect(() => { cargar(); }, [cargar]);

    const sumaVisible = gastos.filter(g => g.estado !== 'anulado').reduce((s, g) => s + parseFloat(g.monto || 0), 0);

    const guardar = async (form) => {
        try {
            if (modal.data) {
                await api.put(`/proveedores/gastos/${modal.data.id}`, form);
                toast.success('Gasto actualizado.');
            } else {
                await api.post('/proveedores/gastos', form);
                toast.success('Gasto registrado.');
            }
            setModal({ open: false, data: null });
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar el gasto.'); }
    };

    const eliminar = async (g) => {
        if (!(await confirm({ message: `Eliminar el gasto "${g.descripcion}"?` }))) return;
        try { await api.delete(`/proveedores/gastos/${g.id}`); toast.success('Gasto eliminado.'); cargar(); }
        catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar. Si ya esta pagado, anulalo en su lugar.'); }
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
                    <label style={labelSt}>CATEGORIA</label>
                    <select style={filtroSel} value={filtros.categoria} onChange={e => setFiltros({ ...filtros, categoria: e.target.value })}>
                        <option value="">Todas</option>
                        {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <div>
                    <label style={labelSt}>ESTADO</label>
                    <select style={filtroSel} value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value })}>
                        <option value="">Todos</option>
                        {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
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
                {puede('proveedores', 'crear') && <button onClick={() => setModal({ open: true, data: null })}
                    style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 11, padding: '10px 20px', cursor: 'pointer', height: 38 }}>
                    <IconPlus /> NUEVO GASTO
                </button>}
            </div>

            <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginBottom: 12 }}>
                {total} gasto{total !== 1 ? 's' : ''} · Suma visible (sin anulados): <strong style={{ color: txt }}>${sumaVisible.toFixed(2)}</strong>
            </p>

            {loading ? (
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando gastos...</p>
            ) : gastos.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>No hay gastos para estos filtros</p>
                </div>
            ) : (
                <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                    <table className="prov-table">
                        <thead>
                            <tr style={{ background: SKY_PALE }}>
                                {['Fecha', 'Proveedor', 'Categoria', 'Descripcion', 'Monto', 'Metodo', 'Estado', ''].map(h => (
                                    <th key={h} style={{ color: SKY_DEEP }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {gastos.map(g => (
                                <tr key={g.id} style={{ borderColor: bdr }}>
                                    <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{g.fecha}</td>
                                    <td style={{ color: txtSf }}>{g.proveedor_nombre || '—'}</td>
                                    <td style={{ color: txtSf, textTransform: 'capitalize' }}>{g.categoria}</td>
                                    <td style={{ color: txt, maxWidth: 220 }}>{g.descripcion}</td>
                                    <td style={{ color: txt, fontWeight: 600 }}>${parseFloat(g.monto).toFixed(2)}</td>
                                    <td style={{ color: txtSf, textTransform: 'capitalize' }}>{g.metodo_pago}</td>
                                    <td>
                                        <span className="prov-badge" style={{ background: `${ESTADO_COLOR[g.estado]}18`, border: `1px solid ${ESTADO_COLOR[g.estado]}44`, color: ESTADO_COLOR[g.estado] }}>
                                            {g.estado.toUpperCase()}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                            {puede('proveedores', 'editar') && <button className="prov-icon-btn" style={{ color: SKY_DEEP }} onClick={() => setModal({ open: true, data: g })}><IconEdit /></button>}
                                            {g.estado !== 'pagado' && (
                                                puede('proveedores', 'eliminar') && <button className="prov-icon-btn" style={{ color: '#ef4444' }} onClick={() => eliminar(g)}><IconTrash /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Paginador pagina={pagina} setPagina={setPagina} total={total} porPagina={POR_PAGINA} theme={theme} />

            {modal.open && (
                <ModalGasto theme={theme} proveedores={proveedores} data={modal.data} onClose={() => setModal({ open: false, data: null })} onGuardar={guardar} />
            )}
        </div>
    );
}

function ModalGasto({ theme, proveedores, data, onClose, onGuardar }) {
    const { txt, mut, bdr, boxBg, SKY, SKY_DEEP, labelSt, inputSt } = theme;
    const [form, setForm] = useState(data ? { ...EMPTY, ...data, monto: String(data.monto) } : EMPTY);
    const [saving, setSaving] = useState(false);
    const esEdicion = Boolean(data);

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const onSubmit = async (e) => { e.preventDefault(); setSaving(true); await onGuardar(form); setSaving(false); };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 640, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>GASTOS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.04em', color: txt }}>{esEdicion ? 'Editar Gasto' : 'Nuevo Gasto'}</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut }}><IconX /></button>
                </div>

                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>PROVEEDOR (opcional)</label>
                            <select name="proveedor_id" value={form.proveedor_id || ''} onChange={onChange} style={inputSt}>
                                <option value="">Sin proveedor asociado</option>
                                {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
                            </select>
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>DESCRIPCION *</label>
                            <input name="descripcion" value={form.descripcion} onChange={onChange} required style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>CATEGORIA</label>
                            <select name="categoria" value={form.categoria} onChange={onChange} style={inputSt}>
                                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelSt}>MONTO *</label>
                            <input type="number" step="0.01" min="0.01" name="monto" value={form.monto} onChange={onChange} required style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>FECHA</label>
                            <input type="date" name="fecha" value={form.fecha || ''} onChange={onChange} style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>METODO DE PAGO</label>
                            <select name="metodo_pago" value={form.metodo_pago} onChange={onChange} style={inputSt}>
                                {METODOS.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelSt}>ESTADO</label>
                            <select name="estado" value={form.estado} onChange={onChange} style={inputSt}>
                                {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelSt}>N° COMPROBANTE</label>
                            <input name="numero_comprobante" value={form.numero_comprobante || ''} onChange={onChange} style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>OBSERVACIONES</label>
                            <textarea name="observaciones" value={form.observaciones || ''} onChange={onChange} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}`, marginTop: 4 }}>
                        <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                        <button type="submit" disabled={saving} style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1 }}>
                            {saving ? 'GUARDANDO...' : esEdicion ? 'GUARDAR CAMBIOS' : 'REGISTRAR GASTO'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
