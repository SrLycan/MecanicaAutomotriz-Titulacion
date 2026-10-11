/**
 * SS SWAP - Pestaña "Compras" (dentro de la seccion Proveedores)
 *
 * Al marcar una compra como "recibida", el backend actualiza el stock real
 * de los repuestos vinculados (repuestos.stock_actual) y registra el
 * movimiento en movimientos_inventario (Fase 3). Items sin repuesto_id
 * vinculado (herramientas, insumos fuera de catalogo) no afectan stock.
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Paginador from './Paginador';
import { useAuth } from '../../context/AuthContext';

function IconPlus() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconX()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconTrash(){ return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>; }
function IconEye()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>; }

const ESTADOS = ['pendiente', 'solicitada', 'en_proceso', 'recibida', 'cancelada'];
const ESTADO_COLOR = { pendiente: '#f59e0b', solicitada: '#0ea5e9', en_proceso: '#8b5cf6', recibida: '#10b981', cancelada: '#ef4444' };
const SIG_ESTADO = { pendiente: 'solicitada', solicitada: 'en_proceso', en_proceso: 'recibida' };
const ITEM_VACIO = { repuesto_id: '', descripcion: '', cantidad: 1, precio_unitario: '' };
const METODOS = [
    { id: 'efectivo', label: 'Efectivo (sale de caja)' },
    { id: 'transferencia', label: 'Transferencia' },
    { id: 'tarjeta', label: 'Tarjeta' },
    { id: 'cheque', label: 'Cheque' },
    { id: 'otro', label: 'Otro' },
];
const DIAS_CREDITO = 15;

/** 2026-10-05 -> 05/10/2026 */
const fechaCorta = (f) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'; };

/** Texto corto del vencimiento: "vence hoy", "vence en 2 dias", "vencida hace 1 dia" */
export function textoVencimiento(dias) {
    const d = Number(dias);
    if (d === 0) return 'vence hoy';
    if (d > 0) return `vence en ${d} día${d !== 1 ? 's' : ''}`;
    return `vencida hace ${-d} día${d !== -1 ? 's' : ''}`;
}

/** Estado del pago de una compra: CONTADO / PAGADA / vence en N dias / VENCIDA */
function EstadoPago({ c }) {
    const saldo = Number(c.saldo);
    if (c.estado === 'cancelada') return <span style={{ color: '#94a3b8' }}>—</span>;
    if (saldo <= 0.005) {
        return <span className="prov-badge" style={{ background: '#10b98118', border: '1px solid #10b98144', color: '#10b981' }}>{c.forma_pago === 'contado' ? 'CONTADO · PAGADA' : 'CRÉDITO · PAGADA'}</span>;
    }
    const dias = Number(c.dias_para_vencer);
    const color = dias < 0 ? '#ef4444' : dias <= 3 ? '#f59e0b' : '#0ea5e9';
    return (
        <div>
            <span className="prov-badge" style={{ background: `${color}18`, border: `1px solid ${color}44`, color }}>CRÉDITO · SALDO ${saldo.toFixed(2)}</span>
            {c.fecha_vencimiento && <div style={{ fontSize: '.72rem', color, marginTop: 3, fontWeight: dias <= 3 ? 600 : 400 }}>{fechaCorta(c.fecha_vencimiento)} · {textoVencimiento(dias)}</div>}
        </div>
    );
}

export default function ComprasTab({ theme, proveedores, onCambio }) {
    const { puede } = useAuth();
    const { txt, txtSf, mut, bdr, card, cardSh, SKY, SKY_DEEP, SKY_PALE, labelSt, inputSt } = theme;
    const [compras, setCompras] = useState([]);
    const [total, setTotal]     = useState(0);
    const [loading, setLoading] = useState(true);
    const [modal, setModal]     = useState(false);
    const [detalle, setDetalle] = useState(null);
    const [filtros, setFiltros] = useState({ proveedor_id: '', estado: '', forma_pago: '' });
    const [pagina, setPagina] = useState(1);
    const POR_PAGINA = 20;

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
            params.set('page', String(pagina));
            params.set('limit', String(POR_PAGINA));
            const { data } = await api.get(`/proveedores/compras?${params}`);
            setCompras(data.compras || []);
            setTotal(data.total || 0);
        } catch (err) { toast.error('Error al cargar compras.'); }
        finally { setLoading(false); }
    }, [filtros, pagina]);

    useEffect(() => { setPagina(1); }, [filtros]);
    useEffect(() => { cargar(); }, [cargar]);

    const crear = async (payload) => {
        try {
            await api.post('/proveedores/compras', payload);
            toast.success(payload.forma_pago === 'contado' ? 'Compra registrada y pagada.' : `Compra a crédito registrada (vence en ${DIAS_CREDITO} días).`);
            setModal(false);
            cargar();
            onCambio?.();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al registrar la compra.'); }
    };

    const abrirDetalle = async (c) => {
        try {
            const { data } = await api.get(`/proveedores/compras/${c.id}`);
            setDetalle(data.compra);
        } catch (err) { toast.error('Error al cargar el detalle de la compra.'); }
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
                    <label style={labelSt}>ESTADO</label>
                    <select style={filtroSel} value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value })}>
                        <option value="">Todos</option>
                        {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                </div>
                <div>
                    <label style={labelSt}>PAGO</label>
                    <select style={filtroSel} value={filtros.forma_pago} onChange={e => setFiltros({ ...filtros, forma_pago: e.target.value })}>
                        <option value="">Todos</option>
                        <option value="contado">Contado</option>
                        <option value="credito">Crédito</option>
                    </select>
                </div>
                {puede('proveedores', 'crear') && <button onClick={() => setModal(true)}
                    style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 11, padding: '10px 20px', cursor: 'pointer', height: 38 }}>
                    <IconPlus /> NUEVA COMPRA
                </button>}
            </div>

            <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginBottom: 12 }}>{total} compra{total !== 1 ? 's' : ''}</p>

            {loading ? (
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando compras...</p>
            ) : compras.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>No hay compras para estos filtros</p>
                </div>
            ) : (
                <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                    <table className="prov-table">
                        <thead>
                            <tr style={{ background: SKY_PALE }}>
                                {['#', 'Proveedor', 'Fecha solicitud', 'Items', 'Total', 'Pago', 'Estado', ''].map(h => (
                                    <th key={h} style={{ color: SKY_DEEP }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {compras.map(c => (
                                <tr key={c.id} style={{ borderColor: bdr }}>
                                    <td style={{ color: txtSf }}>#{c.id}</td>
                                    <td style={{ color: txt, fontWeight: 600 }}>{c.proveedor_nombre}</td>
                                    <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{c.fecha_solicitud}</td>
                                    <td style={{ color: txtSf }}>{c.total_items}</td>
                                    <td style={{ color: txt, fontWeight: 600 }}>${parseFloat(c.total).toFixed(2)}</td>
                                    <td><EstadoPago c={c} /></td>
                                    <td>
                                        <span className="prov-badge" style={{ background: `${ESTADO_COLOR[c.estado]}18`, border: `1px solid ${ESTADO_COLOR[c.estado]}44`, color: ESTADO_COLOR[c.estado] }}>
                                            {c.estado.replace('_', ' ').toUpperCase()}
                                        </span>
                                    </td>
                                    <td>
                                        <button className="prov-icon-btn" style={{ color: SKY_DEEP }} onClick={() => abrirDetalle(c)}><IconEye /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Paginador pagina={pagina} setPagina={setPagina} total={total} porPagina={POR_PAGINA} theme={theme} />

            {modal && (
                <ModalNuevaCompra theme={theme} proveedores={proveedores} onClose={() => setModal(false)} onGuardar={crear} />
            )}
            {detalle && (
                <ModalDetalleCompra theme={theme} compra={detalle} onClose={() => setDetalle(null)} onActualizado={() => { setDetalle(null); cargar(); onCambio?.(); }} />
            )}
        </div>
    );
}

/** Fecha de vencimiento (dd/mm/aaaa) de una compra a credito solicitada en `fecha` (o hoy). */
function venceEl(fecha) {
    const base = fecha ? new Date(`${fecha}T12:00:00`) : new Date();
    base.setDate(base.getDate() + DIAS_CREDITO);
    return base.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function ModalNuevaCompra({ theme, proveedores, onClose, onGuardar }) {
    const { txt, mut, bdr, boxBg, SKY, SKY_DEEP, labelSt, inputSt } = theme;
    const [proveedorId, setProveedorId] = useState('');
    const [fecha, setFecha]             = useState('');
    const [notas, setNotas]             = useState('');
    const [formaPago, setFormaPago]     = useState('contado');
    const [metodoPago, setMetodoPago]   = useState('efectivo');
    const [refPago, setRefPago]         = useState('');
    const [items, setItems]             = useState([{ ...ITEM_VACIO }]);
    const [repuestos, setRepuestos]     = useState([]);
    const [saving, setSaving]           = useState(false);

    useEffect(() => {
        api.get('/inventory/repuestos?limit=200').then(({ data }) => setRepuestos(data.repuestos || [])).catch(() => {});
    }, []);

    const actualizarItem = (idx, campo, valor) => {
        setItems(prev => prev.map((it, i) => {
            if (i !== idx) return it;
            const nuevo = { ...it, [campo]: valor };
            if (campo === 'repuesto_id' && valor) {
                const rep = repuestos.find(r => String(r.id) === String(valor));
                if (rep) { nuevo.descripcion = rep.nombre; nuevo.precio_unitario = rep.precio_compra; }
            }
            return nuevo;
        }));
    };
    const agregarItem  = () => setItems(prev => [...prev, { ...ITEM_VACIO }]);
    const quitarItem   = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

    const subtotal = items.reduce((s, it) => s + (parseFloat(it.cantidad) || 0) * (parseFloat(it.precio_unitario) || 0), 0);
    const iva      = subtotal * 0.15;
    const total    = subtotal + iva;

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!proveedorId) return toast.error('Selecciona un proveedor.');
        const itemsValidos = items.filter(it => it.descripcion.trim() && parseFloat(it.cantidad) > 0);
        if (itemsValidos.length === 0) return toast.error('Agrega al menos un item valido.');
        setSaving(true);
        await onGuardar({
            proveedor_id: proveedorId,
            fecha_solicitud: fecha || undefined,
            notas,
            forma_pago: formaPago,
            metodo_pago: formaPago === 'contado' ? metodoPago : undefined,
            referencia_pago: formaPago === 'contado' ? refPago : undefined,
            items: itemsValidos.map(it => ({
                repuesto_id: it.repuesto_id || undefined,
                descripcion: it.descripcion,
                cantidad: parseInt(it.cantidad),
                precio_unitario: parseFloat(it.precio_unitario) || 0,
            })),
        });
        setSaving(false);
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 760, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>COMPRAS</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.04em', color: txt }}>Nueva Orden de Compra</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut }}><IconX /></button>
                </div>

                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 13 }}>
                        <div>
                            <label style={labelSt}>PROVEEDOR *</label>
                            <select value={proveedorId} onChange={e => setProveedorId(e.target.value)} required style={inputSt}>
                                <option value="">Seleccionar...</option>
                                {proveedores.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre_comercial}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelSt}>FECHA SOLICITUD</label>
                            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputSt} />
                        </div>
                    </div>

                    <div>
                        <label style={labelSt}>ITEMS *</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                            {items.map((it, idx) => (
                                <div key={idx} className="prov-items-row">
                                    <select value={it.repuesto_id} onChange={e => actualizarItem(idx, 'repuesto_id', e.target.value)} style={inputSt}>
                                        <option value="">Item libre / no es repuesto...</option>
                                        {repuestos.map(r => <option key={r.id} value={r.id}>{r.codigo} — {r.nombre}</option>)}
                                    </select>
                                    <input placeholder="Descripcion" value={it.descripcion} onChange={e => actualizarItem(idx, 'descripcion', e.target.value)} style={inputSt} />
                                    <input type="number" min="1" placeholder="Cant." value={it.cantidad} onChange={e => actualizarItem(idx, 'cantidad', e.target.value)} style={inputSt} />
                                    <input type="number" step="0.01" min="0" placeholder="Precio unit." value={it.precio_unitario} onChange={e => actualizarItem(idx, 'precio_unitario', e.target.value)} style={inputSt} />
                                    <button type="button" onClick={() => quitarItem(idx)} disabled={items.length === 1}
                                        style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: 8, cursor: items.length === 1 ? 'not-allowed' : 'pointer', color: '#ef4444', opacity: items.length === 1 ? .4 : 1 }}>
                                        <IconTrash />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <button type="button" onClick={agregarItem}
                            style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: `1px dashed ${bdr}`, borderRadius: 9, padding: '8px 14px', cursor: 'pointer', color: SKY_DEEP, fontFamily: "'Outfit'", fontSize: '.82rem' }}>
                            <IconPlus /> Agregar item
                        </button>
                    </div>

                    <div>
                        <label style={labelSt}>FORMA DE PAGO *</label>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginTop: 4 }}>
                            {[
                                { id: 'contado', t: 'Contado', d: 'Se paga ahora mismo' },
                                { id: 'credito', t: `Crédito ${DIAS_CREDITO} días`, d: `Vence el ${venceEl(fecha)} · aviso 3 días antes` },
                            ].map(o => (
                                <button type="button" key={o.id} onClick={() => setFormaPago(o.id)}
                                    style={{ textAlign: 'left', padding: '11px 14px', borderRadius: 10, cursor: 'pointer', fontFamily: "'Outfit'", background: formaPago === o.id ? `${SKY}1a` : 'transparent', border: `1.5px solid ${formaPago === o.id ? SKY_DEEP : bdr}`, color: txt }}>
                                    <strong style={{ display: 'block', fontSize: '.9rem', color: formaPago === o.id ? SKY_DEEP : txt }}>{o.t}</strong>
                                    <span style={{ fontSize: '.75rem', color: mut }}>{o.d}</span>
                                </button>
                            ))}
                        </div>
                        {formaPago === 'contado' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                                <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={inputSt}>
                                    {METODOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                </select>
                                <input placeholder="Referencia / N° comprobante" value={refPago} onChange={e => setRefPago(e.target.value)} style={inputSt} />
                            </div>
                        )}
                    </div>

                    <div>
                        <label style={labelSt}>NOTAS</label>
                        <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, fontFamily: "'Outfit'", fontSize: '.85rem', color: txt, paddingTop: 4 }}>
                        <span>Subtotal: <strong>${subtotal.toFixed(2)}</strong></span>
                        <span>IVA 15%: <strong>${iva.toFixed(2)}</strong></span>
                        <span>Total: <strong style={{ color: SKY_DEEP }}>${total.toFixed(2)}</strong></span>
                    </div>

                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}` }}>
                        <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                        <button type="submit" disabled={saving} style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1 }}>
                            {saving ? 'GUARDANDO...' : 'CREAR COMPRA'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function ModalDetalleCompra({ theme, compra, onClose, onActualizado }) {
    const { puede } = useAuth();
    const { txt, txtSf, mut, bdr, boxBg, inputBg, inputSt, SKY_DEEP, SKY_PALE } = theme;
    const [cambiando, setCambiando] = useState(false);
    const saldo = Number(compra.saldo) || 0;
    const [pago, setPago] = useState({ monto: saldo ? saldo.toFixed(2) : '', metodo_pago: 'efectivo', referencia: '' });
    const [pagando, setPagando] = useState(false);

    const registrarPago = async (e) => {
        e.preventDefault();
        const monto = parseFloat(pago.monto);
        if (!(monto > 0)) return toast.error('Ingresa un monto mayor a cero.');
        setPagando(true);
        try {
            await api.post('/proveedores/movimientos', {
                proveedor_id: compra.proveedor_id, compra_id: compra.id,
                tipo: monto >= saldo - 0.005 ? 'pago' : 'abono',
                descripcion: `${monto >= saldo - 0.005 ? 'Pago' : 'Abono'} compra a crédito #${compra.id}`,
                monto, metodo_pago: pago.metodo_pago, referencia: pago.referencia || undefined,
            });
            toast.success(monto >= saldo - 0.005 ? 'Compra pagada por completo.' : 'Abono registrado.');
            onActualizado();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo registrar el pago.'); }
        finally { setPagando(false); }
    };
    const [cantidades, setCantidades] = useState(() => Object.fromEntries((compra.items || []).map(i => [i.id, i.cantidad_recibida ?? i.cantidad])));

    const avanzarEstado = async (nuevoEstado) => {
        setCambiando(true);
        try {
            const body = { estado: nuevoEstado };
            if (nuevoEstado === 'recibida') {
                body.cantidades_recibidas = Object.entries(cantidades).map(([item_id, cantidad_recibida]) => ({ item_id: parseInt(item_id), cantidad_recibida: parseInt(cantidad_recibida) || 0 }));
            }
            const { data } = await api.patch(`/proveedores/compras/${compra.id}/estado`, body);
            toast.success(`Compra actualizada a "${nuevoEstado}".`);
            if (nuevoEstado === 'recibida' && Array.isArray(data.stock_actualizado)) {
                const aplicados = data.stock_actualizado.filter(s => !s.omitido);
                const omitidos  = data.stock_actualizado.filter(s => s.omitido);
                if (aplicados.length) toast.success(`Stock actualizado: ${aplicados.length} item(s) sumados al inventario.`, { duration: 5000 });
                if (omitidos.length) toast.error(`${omitidos.length} item(s) no se pudieron sumar al inventario (repuesto inactivo o no encontrado).`, { duration: 6000 });
            }
            onActualizado();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cambiar el estado.'); }
        finally { setCambiando(false); }
    };

    const siguiente = SIG_ESTADO[compra.estado];

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 680, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>COMPRA #{compra.id}</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.5rem', letterSpacing: '.04em', color: txt }}>{compra.proveedor_nombre}</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut }}><IconX /></button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {(compra.items || []).map(it => (
                        <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', borderRadius: 9, background: SKY_PALE, gap: 10 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: txt, fontSize: '.86rem' }}>{it.descripcion}</p>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.76rem', color: txtSf }}>{it.cantidad} × ${parseFloat(it.precio_unitario).toFixed(2)} = ${parseFloat(it.subtotal).toFixed(2)}</p>
                            </div>
                            {compra.estado !== 'recibida' && compra.estado !== 'cancelada' && siguiente === 'recibida' && (
                                <div>
                                    <label style={{ fontFamily: "'Outfit'", fontSize: '.7rem', color: txtSf, display: 'block', marginBottom: 2 }}>Recibido</label>
                                    <input type="number" min="0" max={it.cantidad} value={cantidades[it.id]}
                                        onChange={e => setCantidades({ ...cantidades, [it.id]: e.target.value })}
                                        style={{ width: 64, padding: '5px 8px', borderRadius: 7, border: `1px solid ${bdr}`, background: inputBg, color: txt, textAlign: 'center' }} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, fontFamily: "'Outfit'", fontSize: '.84rem', color: txt, paddingBottom: 16, borderBottom: `1px solid ${bdr}` }}>
                    <span>Subtotal: ${parseFloat(compra.subtotal).toFixed(2)}</span>
                    <span>IVA: ${parseFloat(compra.iva).toFixed(2)}</span>
                    <span>Total: <strong>${parseFloat(compra.total).toFixed(2)}</strong></span>
                </div>

                {/* Forma de pago y saldo */}
                <div style={{ marginTop: 14, padding: '12px 14px', borderRadius: 10, border: `1px solid ${bdr}`, fontFamily: "'Outfit'", fontSize: '.84rem', color: txtSf, display: 'flex', flexWrap: 'wrap', gap: '6px 20px', alignItems: 'center' }}>
                    <span>Pago: <strong style={{ color: txt }}>{compra.forma_pago === 'contado' ? 'Contado' : `Crédito ${DIAS_CREDITO} días`}</strong></span>
                    {compra.forma_pago === 'credito' && compra.fecha_vencimiento && <span>Vence: <strong style={{ color: txt }}>{fechaCorta(compra.fecha_vencimiento)}</strong></span>}
                    <span>Pagado: <strong style={{ color: '#10b981' }}>${Number(compra.pagado || 0).toFixed(2)}</strong></span>
                    <span>Saldo: <strong style={{ color: saldo > 0.005 ? '#f59e0b' : '#10b981' }}>${saldo.toFixed(2)}</strong></span>
                    {compra.estado !== 'cancelada' && <EstadoPago c={compra} />}
                </div>
                {compra.estado !== 'cancelada' && saldo > 0.005 && (
                    <form onSubmit={registrarPago} style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1.3fr 1.3fr auto', gap: 8, alignItems: 'center' }} className="prov-pago-row">
                        <input type="number" step="0.01" min="0.01" max={saldo.toFixed(2)} value={pago.monto} onChange={e => setPago({ ...pago, monto: e.target.value })} style={inputSt} placeholder="Monto" required />
                        <select value={pago.metodo_pago} onChange={e => setPago({ ...pago, metodo_pago: e.target.value })} style={inputSt}>
                            {METODOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                        <input value={pago.referencia} onChange={e => setPago({ ...pago, referencia: e.target.value })} style={inputSt} placeholder="Referencia (opcional)" />
                        <button type="submit" disabled={pagando} style={{ fontFamily: "'Bebas Neue'", fontSize: '.74rem', letterSpacing: '.14em', color: '#fff', background: '#10b981', border: 'none', borderRadius: 10, padding: '11px 16px', cursor: pagando ? 'not-allowed' : 'pointer', opacity: pagando ? .6 : 1, whiteSpace: 'nowrap' }}>
                            {pagando ? 'GUARDANDO...' : 'REGISTRAR PAGO'}
                        </button>
                    </form>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16 }}>
                    {compra.estado !== 'recibida' && compra.estado !== 'cancelada' && (
                        puede('proveedores', 'editar') && <button onClick={() => avanzarEstado('cancelada')} disabled={cambiando}
                            style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: '1px solid rgba(239,68,68,.3)', color: '#ef4444', borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>
                            CANCELAR COMPRA
                        </button>
                    )}
                    {siguiente && (
                        puede('proveedores', 'editar') && <button onClick={() => avanzarEstado(siguiente)} disabled={cambiando}
                            style={{ fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.14em', color: '#fff', background: `${ESTADO_COLOR[siguiente]}`, border: 'none', borderRadius: 10, padding: '10px 20px', cursor: cambiando ? 'not-allowed' : 'pointer', opacity: cambiando ? .6 : 1 }}>
                            {cambiando ? 'ACTUALIZANDO...' : `MARCAR COMO ${siguiente.replace('_', ' ').toUpperCase()}`}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
