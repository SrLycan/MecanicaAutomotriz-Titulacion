/**
 * SS SWAP - Compras: detalle de una compra (Sprint 26)
 * Artículos (filas / artículos), proveedor, pagos, impresión y totales por
 * tarifa. Las órdenes de compra conservan su ciclo: solicitar, en proceso,
 * recibir (suma al inventario) o cancelar.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { useConfirm } from '../../common/ConfirmDialog';
import { LogoEmpresa } from '../../common/MarcaEmpresa';
import { dinero } from '../../finanzas/tema';
import { nuevaClaveIdempotencia, conClave } from '../../../utils/idempotencia';
import {
    AREA_LABEL, DOCUMENTO_CORTO, TIPO_REGISTRO_LABEL, ESTADOS_COMPRA, SIG_ESTADO, METODOS, SUSTENTOS,
    fechaCorta, cant, precio4,
} from './comunes';
import { TotalesCompra, Badge, IconUsuario, IconImpresora, IconDinero, IconXml } from './piezas';

function IconX() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconEngranaje() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>; }

export const tituloCompra = (c) => (c.numero_documento ? `${DOCUMENTO_CORTO[c.tipo_documento] || 'COMPRA'} ${c.numero_documento}` : `${DOCUMENTO_CORTO[c.tipo_documento] || 'COMPRA'} #${c.id}`);

function Modal({ theme, titulo, etiqueta, onClose, ancho = 520, children }) {
    const { txt, mut, bdr, boxBg, SKY_DEEP } = theme;
    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" role="dialog" aria-modal="true" aria-label={titulo} style={{ maxWidth: ancho, background: boxBg, border: `1px solid ${bdr}`, padding: 26 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 10 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.22em', color: SKY_DEEP, marginBottom: 4 }}>{etiqueta}</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.5rem', letterSpacing: '.04em', color: txt }}>{titulo}</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex' }}><IconX /></button>
                </div>
                {children}
            </div>
        </div>
    );
}

/** Pagos de la compra: historial y registro de un pago o abono. */
function ModalPagos({ theme, compra, onClose, onActualizado }) {
    const { txt, txtSf, mut, bdr, inputSt, labelSt } = theme;
    const saldo = Number(compra.saldo) || 0;
    const [pago, setPago] = useState({ monto: saldo ? saldo.toFixed(2) : '', metodo_pago: 'efectivo', referencia: '' });
    const [pagando, setPagando] = useState(false);
    const clavePago = useRef(nuevaClaveIdempotencia());

    const registrar = async (e) => {
        e.preventDefault();
        const monto = parseFloat(pago.monto);
        if (!(monto > 0)) return toast.error('Ingrese un monto mayor a cero.');
        if (pagando) return;
        setPagando(true);
        try {
            const completo = monto >= saldo - 0.005;
            await api.post('/proveedores/movimientos', {
                proveedor_id: compra.proveedor_id, compra_id: compra.id, tipo: completo ? 'pago' : 'abono',
                descripcion: `${completo ? 'Pago' : 'Abono'} ${tituloCompra(compra).toLowerCase()}`,
                monto, metodo_pago: pago.metodo_pago, referencia: pago.referencia || undefined,
            }, conClave(clavePago.current));
            clavePago.current = nuevaClaveIdempotencia();
            toast.success(completo ? 'Compra pagada por completo.' : 'Abono registrado.');
            onActualizado();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo registrar el pago.'); }
        finally { setPagando(false); }
    };

    return (
        <Modal theme={theme} titulo="Pagos de la compra" etiqueta={tituloCompra(compra)} onClose={onClose} ancho={600}>
            <div style={{ display: 'flex', gap: '6px 20px', flexWrap: 'wrap', fontFamily: "'Outfit'", fontSize: '.9rem', color: txtSf, marginBottom: 14 }}>
                <span>Total: <strong style={{ color: txt }}>{dinero(compra.total)}</strong></span>
                <span>Pagado: <strong style={{ color: '#10b981' }}>{dinero(compra.pagado)}</strong></span>
                <span>Saldo: <strong style={{ color: saldo > 0.005 ? '#f59e0b' : '#10b981' }}>{dinero(saldo)}</strong></span>
                {compra.forma_pago === 'credito' && compra.fecha_vencimiento && <span>Vence: <strong style={{ color: txt }}>{fechaCorta(compra.fecha_vencimiento)}</strong></span>}
            </div>
            {(compra.pagos || []).length === 0
                ? <p style={{ fontFamily: "'Outfit'", fontSize: '.88rem', color: mut, marginBottom: 14 }}>Aún no hay pagos registrados.</p>
                : (
                    <div className="prov-table-wrap" style={{ border: `1px solid ${bdr}`, marginBottom: 14 }}>
                        <table className="prov-table" style={{ minWidth: 480 }}>
                            <thead><tr>{['Fecha', 'Tipo', 'Método', 'Monto', 'Estado'].map(h => <th key={h} style={{ color: mut }}>{h}</th>)}</tr></thead>
                            <tbody>
                                {compra.pagos.map(p => (
                                    <tr key={p.id} style={{ borderColor: bdr }}>
                                        <td style={{ color: txtSf }}>{new Date(p.created_at).toLocaleDateString('es-EC')}</td>
                                        <td style={{ color: txt }}>{p.tipo === 'pago' ? 'Pago' : 'Abono'}{p.referencia ? <div style={{ fontSize: '.76rem', color: mut }}>Ref. {p.referencia}</div> : null}</td>
                                        <td style={{ color: txtSf }}>{p.metodo_pago || '—'}</td>
                                        <td style={{ color: txt, fontWeight: 600 }}>{dinero(p.monto)}</td>
                                        <td><Badge color={p.estado === 'confirmado' ? '#10b981' : '#ef4444'}>{p.estado.toUpperCase()}</Badge></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            {compra.estado !== 'cancelada' && saldo > 0.005 && (
                <form onSubmit={registrar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(150px, 100%), 1fr))', gap: 10, alignItems: 'end' }}>
                    <div><label style={labelSt}>MONTO</label><input type="number" step="0.01" min="0.01" max={saldo.toFixed(2)} value={pago.monto} onChange={e => setPago({ ...pago, monto: e.target.value })} style={inputSt} required /></div>
                    <div><label style={labelSt}>MÉTODO</label><select value={pago.metodo_pago} onChange={e => setPago({ ...pago, metodo_pago: e.target.value })} style={inputSt}>{METODOS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>
                    <div><label style={labelSt}>REFERENCIA</label><input value={pago.referencia} onChange={e => setPago({ ...pago, referencia: e.target.value })} style={inputSt} placeholder="Opcional" /></div>
                    <button type="submit" disabled={pagando} style={{ fontFamily: "'Bebas Neue'", fontSize: '.86rem', letterSpacing: '.12em', color: '#fff', background: '#047857', border: 'none', borderRadius: 10, padding: '11px 16px', cursor: pagando ? 'not-allowed' : 'pointer', opacity: pagando ? .6 : 1 }}>
                        {pagando ? 'GUARDANDO...' : 'REGISTRAR PAGO'}
                    </button>
                </form>
            )}
        </Modal>
    );
}

/** Corrección de sustento tributario y notas (el engranaje de la lista). */
export function ModalEditar({ theme, compra, onClose, onActualizado }) {
    const { inputSt, labelSt, btnPrim, btnSec } = theme;
    const [sustento, setSustento] = useState(compra.sustento_tributario || '');
    const [notas, setNotas] = useState(compra.notas || '');
    const [guardando, setGuardando] = useState(false);
    const guardar = async () => {
        setGuardando(true);
        try {
            await api.put(`/proveedores/compras/${compra.id}`, { sustento_tributario: sustento, notas });
            toast.success('Compra actualizada.');
            onActualizado();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo actualizar.'); }
        finally { setGuardando(false); }
    };
    return (
        <Modal theme={theme} titulo="Editar compra" etiqueta={tituloCompra(compra)} onClose={onClose}>
            <div style={{ display: 'grid', gap: 12 }}>
                <div><label style={labelSt}>SUSTENTO TRIBUTARIO</label>
                    <select style={inputSt} value={sustento} onChange={e => setSustento(e.target.value)}>
                        <option value="">Sin sustento</option>
                        {SUSTENTOS.map(s => <option key={s.codigo} value={s.codigo}>{s.codigo} {s.texto}</option>)}
                    </select></div>
                <div><label style={labelSt}>NOTAS</label><textarea rows={3} style={{ ...inputSt, resize: 'vertical' }} value={notas} onChange={e => setNotas(e.target.value)} /></div>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: theme.mut }}>Los artículos, montos y entradas de inventario no se modifican: para corregirlos cancele la compra (si no tiene pagos) y regístrela de nuevo.</p>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                    <button type="button" onClick={onClose} style={btnSec}>CANCELAR</button>
                    <button type="button" onClick={guardar} disabled={guardando} style={{ ...btnPrim, opacity: guardando ? .6 : 1 }}>{guardando ? 'GUARDANDO...' : 'GUARDAR'}</button>
                </div>
            </div>
        </Modal>
    );
}

/** Hoja imprimible de la compra (como el comprobante interno de los sistemas contables). */
export function ImprimirCompra({ compra, onClose }) {
    const t = compra.totales || {};
    const filaTot = (k, v, fuerte) => (
        <tr><td style={{ padding: '7px 10px', fontWeight: fuerte ? 700 : 600, fontSize: fuerte ? '1rem' : '.86rem' }}>{k}</td><td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: fuerte ? 700 : 600 }}>{v}</td></tr>
    );
    return (
        <div className="modal-backdrop compra-print-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="compra-print-hoja color-fijo" role="dialog" aria-modal="true" aria-label="Vista para imprimir">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 22 }}>
                    <div>
                        <p style={{ fontSize: '1.05rem' }}><strong>{DOCUMENTO_CORTO[compra.tipo_documento] || 'COMPRA'}:</strong> {compra.numero_documento || `#${compra.id}`}</p>
                        <p style={{ fontSize: '.86rem' }}><strong>Fecha:</strong> {fechaCorta(compra.fecha_solicitud)}</p>
                        <p style={{ fontSize: '.86rem' }}><strong>Vence:</strong> {compra.forma_pago === 'credito' ? fechaCorta(compra.fecha_vencimiento) : `${fechaCorta(compra.fecha_solicitud)} (contado)`}</p>
                    </div>
                    <div style={{ width: 150, flexShrink: 0 }}><LogoEmpresa alto={64} radio={6} /></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 18, fontSize: '.84rem', color: '#334155' }}>
                    <div>
                        <p style={{ color: '#0b1220' }}><strong>Proveedor: {String(compra.proveedor_razon_social || compra.proveedor_nombre || '').toUpperCase()}</strong></p>
                        {compra.proveedor_ruc && <p>RUC/CI: {compra.proveedor_ruc}</p>}
                        {compra.proveedor_email && <p>{compra.proveedor_email}</p>}
                        {compra.proveedor_direccion && <p>{compra.proveedor_direccion}{compra.proveedor_telefono ? ` · Teléfono ${compra.proveedor_telefono}` : ''}</p>}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ color: '#0b1220' }}><strong>Inventario: {String(AREA_LABEL[compra.area] || 'General').toUpperCase()}</strong></p>
                        <p>{TIPO_REGISTRO_LABEL[compra.tipo_registro] || 'Inventarios'}{compra.sustento_tributario ? ` · Sustento ${compra.sustento_tributario}` : ''}</p>
                        <p>Movimiento: {compra.id}</p>
                        <p>Usuario: {compra.usuario_nombre || '—'}</p>
                        <p>Registro: {compra.created_at ? new Date(compra.created_at).toLocaleString('es-EC') : '—'}</p>
                    </div>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.84rem' }}>
                    <thead>
                        <tr style={{ background: '#f1f5f9' }}>
                            {['Código', 'Descripción', 'Cantidad', 'Costo', 'Subtotal'].map((h, i) => <th key={h} style={{ padding: '9px 10px', textAlign: i >= 2 ? 'right' : 'left', fontWeight: 700 }}>{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {(compra.items || []).map(it => (
                            <tr key={it.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '9px 10px', color: '#475569' }}>{it.repuesto_codigo || '—'}</td>
                                <td style={{ padding: '9px 10px' }}>{it.descripcion}</td>
                                <td style={{ padding: '9px 10px', textAlign: 'right' }}>{Number(it.cantidad).toFixed(2)}</td>
                                <td style={{ padding: '9px 10px', textAlign: 'right' }}>{precio4(it.precio_unitario)}</td>
                                <td style={{ padding: '9px 10px', textAlign: 'right' }}>${precio4(it.subtotal)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                    <table style={{ width: 300, borderCollapse: 'collapse', background: '#f8fafc', fontSize: '.86rem' }}>
                        <tbody>
                            {filaTot(`Subtotal ${cant(t.tarifa_iva ?? 15)}%`, dinero(t.subtotal_iva))}
                            {filaTot('Subtotal 0%', dinero(t.subtotal_0))}
                            {filaTot('Descuento', `-${dinero(t.descuento)}`)}
                            {filaTot(`Impuesto ${cant(t.tarifa_iva ?? 15)}%`, dinero(t.iva))}
                            {filaTot('Importe total', dinero(t.total), true)}
                        </tbody>
                    </table>
                </div>
                <div className="no-print" style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 22 }}>
                    <button type="button" onClick={() => window.print()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#dcfce7', color: '#14532d', border: '1px solid #86efac', borderRadius: 9, padding: '9px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}><IconImpresora /> Imprimir</button>
                    <button type="button" onClick={onClose} style={{ background: '#fff', color: '#334155', border: '1px solid #cbd5e1', borderRadius: 9, padding: '9px 18px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cerrar</button>
                </div>
            </div>
        </div>
    );
}

export default function DetalleCompra({ theme, compraId, onVolver, onCambio }) {
    const { puede } = useAuth();
    const confirm = useConfirm();
    const { txt, txtSf, mut, bdr, card, cardSh, inputBg, SKY_DEEP, SKY_PALE, labelSt, btnSec } = theme;
    const [compra, setCompra] = useState(null);
    const [modal, setModal] = useState(null); // 'pagos' | 'proveedor' | 'imprimir' | 'editar'
    const [cantidades, setCantidades] = useState({});
    const [cambiando, setCambiando] = useState(false);
    const volverRef = useRef(onVolver); volverRef.current = onVolver;

    const cargar = useCallback(async () => {
        try {
            const { data } = await api.get(`/proveedores/compras/${compraId}`);
            setCompra(data.compra);
            setCantidades(Object.fromEntries((data.compra.items || []).map(i => [i.id, Number(i.cantidad_recibida) > 0 ? cant(i.cantidad_recibida) : cant(i.cantidad)])));
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo abrir la compra.'); volverRef.current(); }
    }, [compraId]);
    useEffect(() => { cargar(); }, [cargar]);
    const actualizado = () => { setModal(null); cargar(); onCambio?.(); };

    // Atajos como en el sistema de referencia: F4 pagos, F7 imprimir.
    useEffect(() => {
        const tecla = (e) => {
            if (!compra || modal) return;
            if (e.key === 'F4') { e.preventDefault(); setModal('pagos'); }
            if (e.key === 'F7') { e.preventDefault(); setModal('imprimir'); }
        };
        window.addEventListener('keydown', tecla);
        return () => window.removeEventListener('keydown', tecla);
    }, [compra, modal]);

    if (!compra) return <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando la compra…</p>;

    const est = ESTADOS_COMPRA[compra.estado] || ESTADOS_COMPRA.pendiente;
    const siguiente = SIG_ESTADO[compra.estado];
    const esOrdenAbierta = !['recibida', 'cancelada'].includes(compra.estado);
    const saldo = Number(compra.saldo) || 0;

    const avanzar = async (nuevo) => {
        if (nuevo === 'cancelada') {
            if (Number(compra.pagado) > 0.005) {
                return toast.error(`Esta compra tiene pagos por ${dinero(compra.pagado)}. Si el proveedor devolvió el dinero o el pago fue un error, anúlelo en "Historial financiero" y luego cancele la compra.`, { duration: 8000 });
            }
            if (!(await confirm({ title: 'Cancelar compra', message: `¿Cancelar ${tituloCompra(compra).toLowerCase()}? Deja de contar como deuda con el proveedor y queda registrada la cancelación.`, confirmLabel: 'Cancelar compra' }))) return;
        }
        setCambiando(true);
        try {
            const body = { estado: nuevo };
            if (nuevo === 'recibida') body.cantidades_recibidas = Object.entries(cantidades).map(([item_id, c]) => ({ item_id: Number(item_id), cantidad_recibida: Number(c) || 0 }));
            const { data } = await api.patch(`/proveedores/compras/${compra.id}/estado`, body);
            toast.success(`Compra actualizada a "${(ESTADOS_COMPRA[nuevo] || {}).label || nuevo}".`);
            if (nuevo === 'recibida' && Array.isArray(data.stock_actualizado)) {
                const ok = data.stock_actualizado.filter(s => !s.omitido).length;
                const omit = data.stock_actualizado.filter(s => s.omitido).length;
                if (ok) toast.success(`Stock actualizado: ${ok} producto(s) sumados al inventario.`, { duration: 5000 });
                if (omit) toast.error(`${omit} artículo(s) no se sumaron (producto inactivo o no encontrado).`, { duration: 6000 });
            }
            actualizado();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cambiar el estado.'); }
        finally { setCambiando(false); }
    };

    const pdfSri = async () => {
        const ventana = window.open('', '_blank');
        try {
            const { data } = await api.get(`/proveedores/facturas-compra/${compra.factura.id}/pdf`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
            ventana.location.href = url;
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } catch { ventana?.close(); toast.error('No se pudo generar el PDF de la factura.'); }
    };
    const xmlSri = async () => {
        try {
            const { data } = await api.get(`/proveedores/facturas-compra/${compra.factura.id}/xml`, { responseType: 'blob' });
            const url = URL.createObjectURL(new Blob([data], { type: 'application/xml' }));
            const a = document.createElement('a'); a.href = url; a.download = `factura-${compra.factura.numero}.xml`;
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
        } catch { toast.error('No se pudo descargar el XML.'); }
    };

    const Tarjeta = ({ icono, titulo, sub, color, onClick, etiquetaAria }) => (
        <button type="button" onClick={onClick} aria-label={etiquetaAria}
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: '14px 16px', cursor: 'pointer', textAlign: 'left', minWidth: 0, fontFamily: 'inherit' }}>
            <span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 11, background: `${color}1a`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icono}</span>
            <span style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
                <span style={{ display: 'block', fontFamily: "'Bebas Neue'", fontSize: '1rem', letterSpacing: '.1em', color: txt }}>{titulo}</span>
                <span style={{ display: 'block', fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
            </span>
        </button>
    );
    const Info = ({ k, v }) => (<div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', borderBottom: `1px solid ${bdr}`, fontFamily: "'Outfit'", fontSize: '.86rem' }}><span style={{ color: mut }}>{k}</span><span style={{ color: txt, textAlign: 'right', fontWeight: 500 }}>{v}</span></div>);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <button type="button" onClick={onVolver} style={{ ...btnSec, padding: '7px 14px' }}>← VOLVER A COMPRAS</button>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {puede('proveedores', 'editar') && compra.estado !== 'cancelada' && <button type="button" onClick={() => setModal('editar')} style={{ ...btnSec, padding: '7px 12px' }}><IconEngranaje /> EDITAR</button>}
                    {compra.factura && <button type="button" onClick={pdfSri} style={{ ...btnSec, padding: '7px 12px' }}>FACTURA SRI (PDF)</button>}
                    {compra.factura?.tiene_xml && <button type="button" onClick={xmlSri} style={{ ...btnSec, padding: '7px 12px' }}><IconXml /> XML</button>}
                </div>
            </div>

            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 16, boxShadow: cardSh, padding: '18px 20px', marginBottom: 16, textAlign: 'center' }}>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.86rem', letterSpacing: '.2em', color: SKY_DEEP }}>{tituloCompra(compra)}</p>
                <button type="button" onClick={() => setModal('proveedor')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, margin: '8px 0', background: '#6d28d9', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 18px', cursor: 'pointer', fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.95rem' }}>
                    <IconUsuario /> {compra.proveedor_nombre}
                </button>
                <div><Badge color={est.color}>{compra.estado === 'recibida' ? 'DOCUMENTO REGISTRADO' : est.label}</Badge></div>
            </div>

            <div className="compra-layout">
                <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <Badge color={SKY_DEEP}>FILAS: {compra.items.length}</Badge>
                        <Badge color="#f59e0b">ARTÍCULOS: {cant(compra.totales?.articulos || 0)}</Badge>
                    </div>
                    <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                        <table className="prov-table" style={{ minWidth: 720 }}>
                            <thead><tr style={{ background: SKY_PALE }}>
                                {['Producto / servicio', 'Cantidad', 'Precio', 'IVA', 'Total', 'Inventario'].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h}</th>)}
                            </tr></thead>
                            <tbody>
                                {compra.items.map(it => (
                                    <tr key={it.id} style={{ borderColor: bdr, verticalAlign: 'top' }}>
                                        <td style={{ maxWidth: 320 }}>
                                            <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: txt }}>{it.descripcion}</p>
                                            {it.repuesto_codigo && <p style={{ fontSize: '.78rem', color: mut }}>{it.repuesto_codigo} · {AREA_LABEL[it.repuesto_area] || it.repuesto_area}</p>}
                                        </td>
                                        <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>
                                            {cant(it.cantidad)}
                                            {esOrdenAbierta && siguiente === 'recibida' && it.repuesto_id && puede('proveedores', 'editar') && (
                                                <label style={{ display: 'block', fontSize: '.74rem', color: mut, marginTop: 4 }}>Recibido
                                                    <input type="number" min="0" step="0.01" max={it.cantidad} value={cantidades[it.id] ?? ''} aria-label={`Cantidad recibida de ${it.descripcion}`}
                                                        onChange={e => setCantidades({ ...cantidades, [it.id]: e.target.value })}
                                                        style={{ width: 70, marginLeft: 6, padding: '4px 6px', borderRadius: 7, border: `1px solid ${bdr}`, background: inputBg, color: txt, textAlign: 'center' }} />
                                                </label>
                                            )}
                                        </td>
                                        <td style={{ color: txtSf }}>{precio4(it.precio_unitario)}</td>
                                        <td style={{ color: txtSf }}>{cant(it.iva_porcentaje)}%</td>
                                        <td style={{ color: txt, fontWeight: 600 }}>{precio4(it.subtotal)}</td>
                                        <td style={{ color: txtSf, fontSize: '.84rem' }}>
                                            {compra.tipo_registro !== 'inventario' ? 'No suma stock (gasto)'
                                                : !it.repuesto_id ? 'Sin producto'
                                                    : compra.estado === 'recibida'
                                                        ? (Number(it.cantidad_recibida) > 0 ? <>+{cant(it.cantidad_recibida)}{it.stock_tras_entrada != null ? ` · stock ${cant(it.stock_tras_entrada)}` : ''}<div><a href={`/dashboard/movimientos?repuesto_id=${it.repuesto_id}`} style={{ fontSize: '.76rem', color: SKY_DEEP }}>Historial</a></div></> : 'No recibido')
                                                        : compra.estado === 'cancelada' ? '—' : 'Pendiente de recibir'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {compra.notas && <p style={{ fontFamily: "'Outfit'", fontSize: '.86rem', color: txtSf, marginTop: 12 }}><span style={labelSt}>NOTAS</span>{compra.notas}</p>}

                    {esOrdenAbierta && puede('proveedores', 'editar') && (
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: 16 }}>
                            <button type="button" onClick={() => avanzar('cancelada')} disabled={cambiando}
                                style={{ fontFamily: "'Bebas Neue'", fontSize: '.86rem', letterSpacing: '.12em', background: 'none', border: '1px solid rgba(239,68,68,.45)', color: '#ef4444', borderRadius: 10, padding: '10px 16px', cursor: 'pointer' }}>CANCELAR COMPRA</button>
                            {siguiente && (
                                <button type="button" onClick={() => avanzar(siguiente)} disabled={cambiando}
                                    style={{ fontFamily: "'Bebas Neue'", fontSize: '.9rem', letterSpacing: '.12em', color: '#fff', background: siguiente === 'recibida' ? '#047857' : '#1d4ed8', border: 'none', borderRadius: 10, padding: '10px 20px', cursor: cambiando ? 'not-allowed' : 'pointer', opacity: cambiando ? .6 : 1 }}>
                                    {cambiando ? 'ACTUALIZANDO...' : siguiente === 'recibida' ? 'MARCAR COMO RECIBIDA Y SUMAR AL INVENTARIO' : `MARCAR COMO ${ESTADOS_COMPRA[siguiente].label}`}
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <aside className="compra-aside">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                        <Tarjeta icono={<IconUsuario />} titulo="PROVEEDOR" sub="Ver datos" color="#f59e0b" onClick={() => setModal('proveedor')} etiquetaAria="Ver datos del proveedor" />
                        <Tarjeta icono={<IconDinero />} titulo="PAGOS" sub={saldo > 0.005 ? `Saldo ${dinero(saldo)} (F4)` : 'Pagada (F4)'} color="#10b981" onClick={() => setModal('pagos')} etiquetaAria="Pagos de la compra" />
                        <Tarjeta icono={<IconImpresora />} titulo="IMPRIMIR" sub="(F7)" color="#ec4899" onClick={() => setModal('imprimir')} etiquetaAria="Imprimir la compra" />
                    </div>
                    <TotalesCompra theme={theme} totales={compra.totales} />
                    <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: '6px 16px', marginTop: 12 }}>
                        <Info k="Inventario" v={AREA_LABEL[compra.area] || '—'} />
                        <Info k="Tipo de registro" v={TIPO_REGISTRO_LABEL[compra.tipo_registro] || '—'} />
                        <Info k="Sustento tributario" v={compra.sustento_tributario ? <span title={compra.sustento_texto || ''}>{compra.sustento_tributario}</span> : '—'} />
                        <Info k="F. emisión" v={fechaCorta(compra.fecha_solicitud)} />
                        <Info k="Pago" v={compra.forma_pago === 'credito' ? `Crédito · vence ${fechaCorta(compra.fecha_vencimiento)}` : 'Contado'} />
                        <Info k="Pagado / saldo" v={`${dinero(compra.pagado)} / ${dinero(saldo)}`} />
                        <Info k="Registrado por" v={compra.usuario_nombre || '—'} />
                        {compra.factura && <Info k="Autorización SRI" v={<span style={{ fontSize: '.74rem', overflowWrap: 'anywhere' }}>{compra.factura.clave_acceso}</span>} />}
                    </div>
                </aside>
            </div>

            {modal === 'pagos' && <ModalPagos theme={theme} compra={compra} onClose={() => setModal(null)} onActualizado={actualizado} />}
            {modal === 'editar' && <ModalEditar theme={theme} compra={compra} onClose={() => setModal(null)} onActualizado={actualizado} />}
            {modal === 'imprimir' && <ImprimirCompra compra={compra} onClose={() => setModal(null)} />}
            {modal === 'proveedor' && (
                <Modal theme={theme} titulo={compra.proveedor_nombre} etiqueta="PROVEEDOR" onClose={() => setModal(null)}>
                    <div style={{ fontFamily: "'Outfit'" }}>
                        <Info k="Razón social" v={compra.proveedor_razon_social || '—'} />
                        <Info k="RUC / CI" v={compra.proveedor_ruc || '—'} />
                        <Info k="Dirección" v={compra.proveedor_direccion || '—'} />
                        <Info k="Teléfono" v={compra.proveedor_telefono || '—'} />
                        <Info k="Correo" v={compra.proveedor_email || '—'} />
                        <p style={{ fontSize: '.82rem', color: mut, marginTop: 12 }}>Para actualizar estos datos use Proveedores › Visualizar.</p>
                    </div>
                </Modal>
            )}
        </div>
    );
}
