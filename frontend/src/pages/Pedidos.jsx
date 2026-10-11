/**
 * SS SWAP - Pedidos de la tienda en línea (personal del taller)
 * Lo que los clientes piden desde la página de Productos. Al ENTREGAR un
 * pedido sale del inventario (queda en Registros como "Venta a cliente") y,
 * si ya se cobró, el dinero entra en Finanzas. También se puede cancelar
 * con un motivo que el cliente ve en su cuenta.
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import useParamUrl from '../hooks/useParamUrl';
import { useTemaPanel, dinero, METODOS_PAGO, VERDE, ROJO, AMBAR } from '../components/finanzas/tema';
import { Badge, Modal, ModalAnular } from '../components/finanzas/Modales';
import Paginador from '../components/proveedores/Paginador';
import './Proveedores.css';
import { useAuth } from '../context/AuthContext';

const ESTADOS = [
    { id: 'pendiente', label: 'POR ATENDER', color: AMBAR },
    { id: 'atendida', label: 'ENTREGADOS', color: VERDE },
    { id: 'cancelada', label: 'CANCELADOS', color: ROJO },
    { id: 'todos', label: 'TODOS', color: '#64748b' },
];
const COLOR = { pendiente: AMBAR, atendida: VERDE, cancelada: ROJO };
const LABEL = { pendiente: 'POR ATENDER', atendida: 'ENTREGADO', cancelada: 'CANCELADO' };
const POR_PAGINA = 25;
const fmtCant = (n) => (Number(n) % 1 === 0 ? String(Number(n)) : Number(n).toFixed(2));
const fecha = (iso) => new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function Pedidos() {
    const theme = useTemaPanel();
    const { puede } = useAuth();
    const puedeAtender = puede('pedidos_tienda', 'editar');
    const { txt, txtSf, mut, bdr, card, cardSh, inputSt, SKY_DEEP, SKY_PALE } = theme;
    const [estado, setEstado] = useParamUrl('estado', 'pendiente', ESTADOS.map(e => e.id));
    const [q, setQ] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [pagina, setPagina] = useState(1);
    const [data, setData] = useState({ solicitudes: [], total: 0, conteo: {} });
    const [loading, setLoading] = useState(true);
    const [entregando, setEntregando] = useState(null);
    const [cancelando, setCancelando] = useState(null);

    useEffect(() => { const t = setTimeout(() => setBusqueda(q.trim()), 350); return () => clearTimeout(t); }, [q]);
    useEffect(() => { setPagina(1); }, [estado, busqueda]);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page: pagina, limit: POR_PAGINA });
            if (estado !== 'todos') params.set('estado', estado);
            if (busqueda) params.set('q', busqueda);
            const { data } = await api.get(`/solicitudes?${params}`);
            setData(data);
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cargar los pedidos.'); }
        finally { setLoading(false); }
    }, [estado, busqueda, pagina]);

    useEffect(() => { cargar(); }, [cargar]);

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1400, '--prov-bdr': bdr, '--prov-mut': mut, '--prov-sky': SKY_DEEP }}>
            <div style={{ marginBottom: 20 }}>
                <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>SS SWAP · INVENTARIO · TIENDA</span></div>
                <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Pedidos de la tienda</h1>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, marginTop: 6 }}>
                    Lo que los clientes piden desde la página de productos. Al entregar, el producto sale del inventario y, si ya se cobró, el dinero entra en Finanzas.
                </p>
            </div>

            <div className="prov-tabs">
                {ESTADOS.map(e => (
                    <button key={e.id} className={`prov-tab-btn ${estado === e.id ? 'active' : ''}`} onClick={() => setEstado(e.id)}>
                        {e.label}{e.id !== 'todos' && data.conteo?.[e.id] ? ` (${data.conteo[e.id]})` : ''}
                    </button>
                ))}
            </div>

            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por cliente, producto o código..." style={{ ...inputSt, maxWidth: 420, marginBottom: 14 }} />

            {loading ? (
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando pedidos...</p>
            ) : data.solicitudes.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>{estado === 'pendiente' ? 'No hay pedidos por atender' : 'No hay pedidos aquí'}</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginTop: 6 }}>Para que un producto aparezca en la tienda, márcalo como "En venta" en Inventario.</p>
                </div>
            ) : (
                <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                    <table className="prov-table">
                        <thead><tr style={{ background: SKY_PALE }}>{['Pedido', 'Cliente', 'Producto', 'Cant.', 'Total', 'Estado', ''].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {data.solicitudes.map(s => {
                                const sinStock = s.estado === 'pendiente' && Number(s.stock_actual) < s.cantidad;
                                return (
                                    <tr key={s.id}>
                                        <td style={{ color: txt, whiteSpace: 'nowrap' }}>#{s.id}<div style={{ fontSize: '.72rem', color: mut }}>{fecha(s.created_at)}</div></td>
                                        <td style={{ color: txt }}>{s.cliente_nombre}<div style={{ fontSize: '.72rem', color: mut }}>{[s.cliente_telefono, s.cliente_email].filter(Boolean).join(' · ')}</div></td>
                                        <td style={{ color: txt, minWidth: 180 }}>
                                            {s.repuesto_nombre} <span style={{ color: mut, fontSize: '.75rem' }}>{s.repuesto_codigo}</span>
                                            {s.notas && <div style={{ fontSize: '.74rem', color: txtSf, fontStyle: 'italic' }}>"{s.notas}"</div>}
                                            {sinStock && <div style={{ fontSize: '.72rem', color: ROJO }}>⚠ Stock insuficiente (hay {fmtCant(s.stock_actual)})</div>}
                                        </td>
                                        <td style={{ color: txtSf }}>{s.cantidad}</td>
                                        <td style={{ color: txt, fontWeight: 600 }}>{dinero(s.total)}</td>
                                        <td>
                                            <Badge color={COLOR[s.estado]}>{LABEL[s.estado]}</Badge>
                                            {s.atendida_por_nombre && <div style={{ fontSize: '.7rem', color: mut, marginTop: 3 }}>{s.atendida_por_nombre} · {fecha(s.atendida_at)}</div>}
                                            {s.estado === 'atendida' && <div style={{ fontSize: '.7rem', color: s.cobro_id ? VERDE : AMBAR }}>{s.cobro_id ? 'Cobrado' : 'Entregado sin registrar cobro'}</div>}
                                            {s.motivo_cancelacion && <div style={{ fontSize: '.7rem', color: ROJO }}>{s.motivo_cancelacion}</div>}
                                        </td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            {s.estado === 'pendiente' && puedeAtender && (<>
                                                <button className="prov-icon-btn" disabled={sinStock} title={sinStock ? 'Repón el stock para poder entregarlo' : ''}
                                                    style={{ color: sinStock ? mut : VERDE, fontFamily: "'Bebas Neue'", fontSize: '.64rem', letterSpacing: '.12em', padding: '6px 10px', marginRight: 6, cursor: sinStock ? 'not-allowed' : 'pointer' }}
                                                    onClick={() => setEntregando(s)}>ENTREGAR</button>
                                                <button className="prov-icon-btn" style={{ color: ROJO, fontFamily: "'Bebas Neue'", fontSize: '.64rem', letterSpacing: '.12em', padding: '6px 10px' }} onClick={() => setCancelando(s)}>CANCELAR</button>
                                            </>)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <Paginador pagina={pagina} setPagina={setPagina} total={data.total} porPagina={POR_PAGINA} theme={theme} />

            {entregando && <ModalEntregar theme={theme} pedido={entregando} onClose={() => setEntregando(null)} onListo={cargar} />}
            {cancelando && (
                <ModalAnular theme={theme} titulo={`Cancelar pedido #${cancelando.id}`} onClose={() => setCancelando(null)}
                    detalle={`${cancelando.cantidad} x ${cancelando.repuesto_nombre} de ${cancelando.cliente_nombre}. El cliente verá el motivo en su cuenta.`}
                    onConfirmar={async (motivo) => { await api.patch(`/solicitudes/${cancelando.id}/cancelar`, { motivo }); toast.success('Pedido cancelado.'); cargar(); }} />
            )}
        </div>
    );
}

function ModalEntregar({ theme, pedido, onClose, onListo }) {
    const { txt, txtSf, mut, bdr, inputSt, labelSt, btnPrim, SKY_PALE } = theme;
    const [cobrado, setCobrado] = useState(true);
    const [metodo, setMetodo] = useState('efectivo');
    const [saving, setSaving] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const { data } = await api.patch(`/solicitudes/${pedido.id}/atender`, { cobrado, metodo_pago: metodo });
            toast.success(`Pedido #${pedido.id} entregado. Stock de ${pedido.repuesto_nombre}: ${fmtCant(data.stock_nuevo)}.${data.cobrado ? ' Cobro registrado en Finanzas.' : ''}`, { duration: 6000 });
            onListo(); onClose();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo entregar el pedido.'); }
        finally { setSaving(false); }
    };
    return (
        <Modal theme={theme} etiqueta="PEDIDOS DE LA TIENDA" titulo={`Entregar pedido #${pedido.id}`} onClose={onClose} ancho={480}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: SKY_PALE, border: `1px solid ${bdr}`, borderRadius: 10, padding: '12px 14px', fontFamily: "'Outfit'", fontSize: '.86rem', color: txt }}>
                    {pedido.cantidad} x <strong>{pedido.repuesto_nombre}</strong> para {pedido.cliente_nombre}
                    <div style={{ color: txtSf, marginTop: 4 }}>Total: <strong>{dinero(pedido.total)}</strong> · Stock: {fmtCant(pedido.stock_actual)} → {fmtCant(Number(pedido.stock_actual) - pedido.cantidad)}</div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Outfit'", fontSize: '.88rem', color: txt, cursor: 'pointer' }}>
                    <input type="checkbox" checked={cobrado} onChange={e => setCobrado(e.target.checked)} /> El cliente ya pagó (registrar el cobro en Finanzas)
                </label>
                {cobrado && (
                    <div>
                        <label style={labelSt}>¿CÓMO PAGÓ?</label>
                        <select value={metodo} onChange={e => setMetodo(e.target.value)} style={inputSt}>
                            {METODOS_PAGO.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.74rem', color: mut, marginTop: 6 }}>
                            {metodo === 'efectivo' ? 'El dinero entra a la caja (aparece en la Caja diaria).' : 'El dinero entra a la cuenta bancaria predeterminada.'}
                        </p>
                    </div>
                )}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 14, borderTop: `1px solid ${bdr}` }}>
                    <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                    <button type="submit" disabled={saving} style={{ ...btnPrim, opacity: saving ? .6 : 1 }}>{saving ? 'GUARDANDO...' : 'CONFIRMAR ENTREGA'}</button>
                </div>
            </form>
        </Modal>
    );
}
