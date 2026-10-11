/**
 * SS SWAP - Visualización de Proforma (/dashboard/proformas/:id)
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { avisarInventario } from '../utils/avisoInventario';
import { useConfirm } from '../components/common/ConfirmDialog';
import { DIAGRAMAS, CARROCERIAS } from '../components/proformas/vehiculo';
import './Proformas.css';

function IconEdit()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconDownload() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>; }
function IconRefresh() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>; }

const ESTADO_COLOR = { borrador: '#64748b', emitida: '#0ea5e9', aprobada: '#10b981', rechazada: '#ef4444', vencida: '#f59e0b', convertida: '#8b5cf6' };
const TIPO_LABEL = { mecanica: 'Mecánica', pintura: 'Colisiones / Pintura y Carrocería' };
const fmtCant = (n) => (Number(n) % 1 === 0 ? String(Number(n)) : Number(n).toFixed(2));
const fmtFecha = (v) => (v ? new Date(v).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—');
const ESTADO_PAGO_LABEL = { pendiente: 'Pendiente de pago', parcial: 'Pago parcial', vencido: 'Vencido', pagado: 'Pagado', anulado: 'Anulado' };
const CATEGORIA_LABEL = { producto: 'Productos / Repuestos', servicio: 'Servicios / Mano de obra', mano_obra: 'Mano de obra / Enderezado', pintura: 'Pintura', repuesto: 'Repuestos', insumo: 'Insumos' };

export default function ProformaView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { puede } = useAuth();
    const { isDark } = useTheme();
    const confirm = useConfirm();
    // Devolver material al inventario es un permiso de inventario; ver el pagare, de cartera.
    const puedeDevolver = puede('registros_inventario', 'aprobar');
    const veCuentas = puede('cuentas_cobrar', 'ver');

    const SKY_DEEP = '#0284c7'; const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.12)';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf = isDark ? '#cbd5e1' : '#334155';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : '#b6c3d3';
    const card = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const cardSh = isDark ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)' : '0 1px 2px rgba(15,23,42,0.06), 0 8px 22px -8px rgba(15,23,42,0.20)';

    const [proforma, setProforma] = useState(null);
    const [loading, setLoading] = useState(true);
    const [convirtiendo, setConvirtiendo] = useState(false);
    const [descontando, setDescontando] = useState(false);
    const [faltantes, setFaltantes] = useState([]);
    const [motivoReversion, setMotivoReversion] = useState('');
    const [mostrarReversion, setMostrarReversion] = useState(false);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/proformas/${id}`);
            setProforma(data.proforma);
        } catch (err) { toast.error('Error al cargar la proforma.'); }
        finally { setLoading(false); }
    }, [id]);

    useEffect(() => { cargar(); }, [cargar]);

    const descargar = async (tipo) => {
        try {
            const { data } = await api.get(`/proformas/${id}/${tipo}`, { responseType: 'blob' });
            const url = window.URL.createObjectURL(new Blob([data]));
            const a = document.createElement('a');
            a.href = url; a.download = `${proforma.numero}.${tipo === 'pdf' ? 'pdf' : 'xlsx'}`;
            document.body.appendChild(a); a.click(); a.remove();
            window.URL.revokeObjectURL(url);
        } catch { toast.error(`Error al generar el ${tipo === 'pdf' ? 'PDF' : 'Excel'}.`); }
    };

    const convertirAOrden = async () => {
        const reglaPago = proforma.tipo === 'pintura'
            ? `por el total de $${Number(proforma.total).toFixed(2)} con un anticipo requerido del 70% ($${Number(proforma.anticipo).toFixed(2)})`
            : `por el total de $${Number(proforma.total).toFixed(2)}${Number(proforma.anticipo) > 0 ? ` (anticipo requerido $${Number(proforma.anticipo).toFixed(2)})` : ', sin anticipo obligatorio'}`;
        if (!(await confirm({ title: 'Convertir a orden de trabajo', confirmLabel: 'Convertir', danger: false, message: `¿Convertir la proforma ${proforma.numero} en una orden de trabajo? La proforma quedará marcada como "convertida" y se generará el pagaré ${reglaPago}${(proforma.items || []).some(i => i.referencia_tipo === 'repuesto' && i.referencia_id) && !proforma.inventario_descontado_at ? '; además se descontarán del inventario los productos vinculados' : ''}.` }))) return;
        setConvirtiendo(true);
        try {
            const { data } = await api.post(`/proformas/${id}/convertir-orden`);
            const ot = `OT-${String(data.orden.id).padStart(6, '0')}`;
            toast.success(data.pagare_creado
                ? `Orden ${ot} creada. Pagaré #${data.pagare.id} por $${Number(data.pagare.monto_total).toFixed(2)}${Number(data.pagare.anticipo_requerido) > 0 ? ` (anticipo requerido $${Number(data.pagare.anticipo_requerido).toFixed(2)})` : ''}.`
                : `Orden ${ot} creada.${data.pagare_motivo ? ` ${data.pagare_motivo}` : ''}`, { duration: 6000 });
            avisarInventario(data.inventario);
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al convertir la proforma.'); }
        finally { setConvirtiendo(false); }
    };

    const cambiarEstado = async (estado, mensaje) => {
        if (!(await confirm({ title: 'Cambiar estado', confirmLabel: 'Confirmar', danger: estado === 'rechazada', message: mensaje }))) return;
        try {
            const { data } = await api.patch(`/proformas/${id}/estado`, { estado });
            toast.success(`Proforma ${estado}.`);
            avisarInventario(data.inventario);
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cambiar el estado.'); }
    };

    const confirmarUso = async () => {
        const n = (proforma.items || []).filter(i => i.referencia_tipo === 'repuesto' && i.referencia_id).length;
        if (!(await confirm({ title: 'Confirmar uso de materiales', confirmLabel: 'Descontar inventario',
            message: `Se descontarán del inventario ${n} producto(s) de la proforma ${proforma.numero} y se registrará la salida. Esta acción no se puede repetir. ¿Continuar?` }))) return;
        setDescontando(true); setFaltantes([]);
        try {
            const { data } = await api.post(`/proformas/${id}/confirmar-uso`);
            toast.success(data.mensaje);
            cargar();
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al descontar el inventario.');
            setFaltantes(err.response?.data?.detalle || []);
        } finally { setDescontando(false); }
    };

    const revertirSalida = async () => {
        if (!motivoReversion.trim()) return toast.error('Indica el motivo de la devolución.');
        if (!(await confirm({ title: 'Devolver al inventario', danger: true, confirmLabel: 'Devolver',
            message: `Se devolverá al stock todo lo descontado por ${proforma.numero}. La salida original queda en el historial marcada como devuelta.` }))) return;
        try {
            const { data } = await api.post(`/proformas/${id}/revertir-salida`, { motivo: motivoReversion.trim() });
            toast.success(data.mensaje);
            setMostrarReversion(false); setMotivoReversion('');
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al revertir la salida.'); }
    };

    if (loading) return <p style={{ fontFamily: "'Outfit'", color: mut, padding: 60, textAlign: 'center' }}>Cargando...</p>;
    if (!proforma) return <p style={{ fontFamily: "'Outfit'", color: mut, padding: 60, textAlign: 'center' }}>Proforma no encontrada.</p>;

    const porCategoria = (cat) => (proforma.items || []).filter(i => i.categoria === cat);
    const categorias = proforma.tipo === 'mecanica' ? ['producto', 'servicio'] : ['mano_obra', 'pintura', 'repuesto', 'insumo'];
    const itemsInventario = (proforma.items || []).filter(i => i.referencia_tipo === 'repuesto' && i.referencia_id);
    const descontado = Boolean(proforma.inventario_descontado_at);
    // Permiso sobre ESTA proforma segun su tipo (mecanica / colisiones-pintura).
    const pf = (accion) => puede(proforma.tipo === 'pintura' ? 'proformas_colisiones' : 'proformas_mecanica', accion);
    const puedeDescontar = ['aprobada', 'convertida'].includes(proforma.estado);
    const Diagrama = proforma.carroceria_tipo ? DIAGRAMAS[proforma.carroceria_tipo] : null;
    const ordenId = proforma.orden_generada_id || proforma.orden_id;
    const salidas = (proforma.movimientos_inventario || []);

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1000 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22, flexWrap: 'wrap', gap: 14 }}>
                <div>
                    <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>SS SWAP · PROFORMAS</span></div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.4rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>{proforma.numero}</h1>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                        <span className="pf-badge" style={{ background: `${ESTADO_COLOR[proforma.estado]}18`, border: `1px solid ${ESTADO_COLOR[proforma.estado]}44`, color: ESTADO_COLOR[proforma.estado] }}>{proforma.estado.toUpperCase()}</span>
                        <span style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>{TIPO_LABEL[proforma.tipo]} · {proforma.fecha_emision}</span>
                    </div>
                </div>
                <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {pf('editar') && proforma.estado !== 'convertida' && !descontado && (
                        <button onClick={() => navigate(`/dashboard/proformas/${id}/editar`)} style={btnSec(bdr, txt)}><IconEdit /> EDITAR</button>
                    )}
                    {pf('exportar') && <button onClick={() => descargar('pdf')} style={btnSec(bdr, txt)}><IconDownload /> PDF</button>}
                    {pf('exportar') && <button onClick={() => descargar('excel')} style={btnSec(bdr, txt)}><IconDownload /> EXCEL</button>}
                    {pf('aprobar') && ['borrador', 'emitida', 'rechazada', 'vencida'].includes(proforma.estado) && (
                        <button onClick={() => cambiarEstado('aprobada', `¿Aprobar la proforma ${proforma.numero}?${itemsInventario.length ? ` Se descontarán del inventario ${itemsInventario.length} producto(s) y quedarán en Inventario › Registros.` : ''}`)}
                            style={btnPrim('#10b981')}>✔ APROBAR</button>
                    )}
                    {pf('aprobar') && proforma.estado === 'aprobada' && (
                        <button onClick={() => cambiarEstado('rechazada', `¿Marcar la proforma ${proforma.numero} como rechazada?${descontado ? ' El material descontado volverá al inventario.' : ''}`)}
                            style={btnSec(bdr, '#ef4444')}>RECHAZAR</button>
                    )}
                    {pf('aprobar') && proforma.estado !== 'convertida' && (
                        <button onClick={convertirAOrden} disabled={convirtiendo} style={btnPrim(SKY_DEEP)}><IconRefresh /> {convirtiendo ? 'CONVIRTIENDO...' : 'CONVERTIR A ORDEN'}</button>
                    )}
                    {ordenId && (
                        <Link to="/dashboard/ordenes" style={{ ...btnSec(bdr, txt), textDecoration: 'none', display: 'inline-flex' }}>VER ORDEN {proforma.orden_numero}</Link>
                    )}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 18, boxShadow: cardSh }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.64rem', letterSpacing: '.18em', color: SKY_DEEP, marginBottom: 8 }}>CLIENTE</p>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: txt }}>{proforma.cliente_nombre}</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf }}>{[proforma.cliente_ruc, proforma.cliente_telefono, proforma.cliente_email].filter(Boolean).join(' · ')}</p>
                    {proforma.cliente_direccion && <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, marginTop: 2 }}>{proforma.cliente_direccion}</p>}
                </div>
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 18, boxShadow: cardSh }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.64rem', letterSpacing: '.18em', color: SKY_DEEP, marginBottom: 8 }}>VEHÍCULO</p>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: txt }}>{[proforma.vehiculo_marca, proforma.vehiculo_modelo].filter(Boolean).join(' ')}</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf }}>{[proforma.vehiculo_tipo, proforma.vehiculo_color, proforma.vehiculo_anio].filter(Boolean).join(' · ')}</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, marginTop: 2 }}>{[proforma.vehiculo_placa ? `Placa: ${proforma.vehiculo_placa}` : null, proforma.vehiculo_vin ? `VIN: ${proforma.vehiculo_vin}` : null].filter(Boolean).join(' · ')}</p>
                </div>
            </div>

            {/* ── Pictograma de daños (solo lectura) ── */}
            {proforma.tipo === 'pintura' && Diagrama && (
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 18, boxShadow: cardSh, marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: SKY_DEEP }}>DAÑOS REPORTADOS</p>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.84rem', color: txt }}>
                            Tipo de vehículo: <strong>{CARROCERIAS[proforma.carroceria_tipo]?.etiqueta}</strong>
                            {proforma.carroceria_puertas && ['hatchback', 'pickup'].includes(proforma.carroceria_tipo) ? ` · ${proforma.carroceria_puertas} puertas` : ''}
                        </p>
                    </div>
                    <Diagrama puertas={proforma.carroceria_puertas} seleccion={proforma.zonas_danadas || []} isDark={isDark} />
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.66rem', letterSpacing: '.16em', color: SKY_DEEP, margin: '12px 0 6px' }}>ZONAS AFECTADAS ({(proforma.zonas_danadas || []).length})</p>
                    {(proforma.zonas_danadas_detalle || []).length
                        ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{proforma.zonas_danadas_detalle.map(z => <span key={z.codigo} className="vd-chip" style={{ paddingRight: 10 }}>{z.etiqueta}</span>)}</div>
                        : <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>No se marcaron zonas.</p>}
                    {proforma.danos_observaciones && (
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.84rem', color: txtSf, marginTop: 10 }}><strong style={{ color: txt }}>Observaciones:</strong> {proforma.danos_observaciones}</p>
                    )}
                </div>
            )}

            {categorias.map(cat => {
                const list = porCategoria(cat);
                if (!list.length) return null;
                return (
                    <div key={cat} style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, marginBottom: 14, overflow: 'hidden' }}>
                        <div style={{ background: SKY_PALE, padding: '10px 16px' }}>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.12em', color: SKY_DEEP }}>{CATEGORIA_LABEL[cat].toUpperCase()}</p>
                        </div>
                        <table className="pf-table">
                            <tbody>
                                {list.map(it => (
                                    <tr key={it.id} style={{ borderColor: bdr }}>
                                        <td style={{ color: txt }}>
                                            {it.referencia_tipo === 'repuesto' && it.repuesto_codigo && (
                                                <code style={{ fontSize: '.72rem', fontWeight: 600, color: SKY_DEEP, marginRight: 8 }}>{it.repuesto_codigo}</code>
                                            )}
                                            {it.descripcion}
                                            {it.referencia_tipo === 'repuesto' && it.referencia_id && (
                                                <span className="pf-badge" style={{ marginLeft: 8, background: 'rgba(14,165,233,0.10)', border: '1px solid rgba(14,165,233,0.3)', color: SKY_DEEP }}>
                                                    INVENTARIO{it.repuesto_area === 'colisiones' ? ' COLISIONES' : it.repuesto_area === 'mecanica' ? ' MECÁNICA' : ''}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ color: txtSf, textAlign: 'center' }}>{Number(it.cantidad) % 1 === 0 ? Number(it.cantidad) : Number(it.cantidad).toFixed(2)}</td>
                                        <td style={{ color: txtSf, textAlign: 'right' }}>${Number(it.precio_unitario).toFixed(2)}</td>
                                        <td style={{ color: txt, fontWeight: 600, textAlign: 'right' }}>${Number(it.subtotal).toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                );
            })}

            {/* ── Inventario: confirmar uso / estado de la salida ── */}
            {itemsInventario.length > 0 && (
                <div className="no-print" style={{ background: card, border: `1px solid ${descontado ? 'rgba(16,185,129,0.35)' : bdr}`, borderRadius: 14, padding: 18, boxShadow: cardSh, marginBottom: 18 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                        <div>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: SKY_DEEP }}>SALIDA DE INVENTARIO</p>
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.84rem', color: txtSf, marginTop: 2 }}>
                                {descontado
                                    ? <>✔ Descontado el {fmtFecha(proforma.inventario_descontado_at)} por <strong>{proforma.inventario_descontado_por_nombre || '—'}</strong></>
                                    : puedeDescontar
                                        ? `${itemsInventario.length} producto(s) vinculados al inventario. No se pudieron descontar al aprobar (falta stock): repón el stock y confírmalo aquí.`
                                        : `${itemsInventario.length} producto(s) vinculados al inventario. Se descontarán automáticamente al APROBAR la proforma o convertirla en orden.`}
                            </p>
                        </div>
                        {!descontado && pf('aprobar') && (
                            <button onClick={confirmarUso} disabled={!puedeDescontar || descontando}
                                style={{ ...btnPrim(puedeDescontar ? '#10b981' : '#94a3b8'), cursor: puedeDescontar ? 'pointer' : 'not-allowed' }}>
                                {descontando ? 'DESCONTANDO...' : 'CONFIRMAR USO DE MATERIALES'}
                            </button>
                        )}
                        {descontado && puedeDevolver && !mostrarReversion && (
                            <button onClick={() => setMostrarReversion(true)} style={btnSec(bdr, '#ef4444')}>DEVOLVER AL INVENTARIO</button>
                        )}
                    </div>
                    {faltantes.length > 0 && (
                        <ul style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: '#ef4444', margin: '10px 0 0 18px' }}>
                            {faltantes.map((f, i) => <li key={i}>{f}</li>)}
                        </ul>
                    )}
                    {mostrarReversion && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                            <input value={motivoReversion} onChange={e => setMotivoReversion(e.target.value)} placeholder="Motivo de la devolución (obligatorio)"
                                style={{ flex: 1, minWidth: 220, padding: '9px 12px', borderRadius: 10, border: `1px solid ${bdr}`, background: 'transparent', color: txt, fontFamily: "'Outfit'", fontSize: '.84rem' }} />
                            <button onClick={revertirSalida} style={btnPrim('#ef4444')}>CONFIRMAR DEVOLUCIÓN</button>
                            <button onClick={() => { setMostrarReversion(false); setMotivoReversion(''); }} style={btnSec(bdr, txt)}>CANCELAR</button>
                        </div>
                    )}
                    {salidas.length > 0 && (
                        <table className="pf-table" style={{ marginTop: 12, minWidth: 0 }}>
                            <thead><tr>
                                {['Movimiento', 'Producto', 'Cant.', 'Stock', 'Usuario', 'Fecha'].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h.toUpperCase()}</th>)}
                            </tr></thead>
                            <tbody>
                                {salidas.map(m => (
                                    <tr key={m.id} style={{ opacity: m.revertido_at ? 0.55 : 1 }}>
                                        <td style={{ color: m.tipo === 'salida' ? '#ef4444' : '#10b981', fontWeight: 600 }}>
                                            {m.tipo === 'salida' ? 'SALIDA' : 'DEVOLUCIÓN'}{m.revertido_at ? ' (devuelta)' : ''}
                                        </td>
                                        <td style={{ color: txt }}>{m.repuesto_nombre} <span style={{ color: mut, fontSize: '.75rem' }}>{m.repuesto_codigo}</span></td>
                                        <td style={{ color: txt }}>{m.tipo === 'salida' ? '−' : '+'}{fmtCant(m.cantidad)}</td>
                                        <td style={{ color: txtSf }}>{fmtCant(m.stock_anterior)} → {fmtCant(m.stock_nuevo)}</td>
                                        <td style={{ color: txtSf }}>{m.usuario_nombre}</td>
                                        <td style={{ color: mut }}>{fmtFecha(m.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ── Pagaré de la proforma (100% de la deuda) ── */}
            {proforma.pagare && (
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 16, boxShadow: cardSh, marginBottom: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div style={{ fontFamily: "'Outfit'", fontSize: '.84rem', color: txtSf, flex: 1, minWidth: 260 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: SKY_DEEP }}>PAGARÉ #{proforma.pagare.id} · {(ESTADO_PAGO_LABEL[proforma.pagare.estado] || proforma.pagare.estado).toUpperCase()}</p>
                        Total <strong style={{ color: txt }}>${Number(proforma.pagare.total).toFixed(2)}</strong> · Pagado <strong style={{ color: '#10b981' }}>${Number(proforma.pagare.pagado).toFixed(2)}</strong> ·
                        Saldo <strong style={{ color: proforma.pagare.saldo > 0 ? '#ef4444' : txt }}>${Number(proforma.pagare.saldo).toFixed(2)}</strong>
                        {proforma.pagare.anticipo_requerido > 0 && <> · Anticipo requerido ${Number(proforma.pagare.anticipo_requerido).toFixed(2)} ({proforma.pagare.anticipo_cubierto ? 'recibido' : 'por cobrar'})</>}
                        <div style={{ height: 6, borderRadius: 999, background: bdr, overflow: 'hidden', marginTop: 6 }}>
                            <div style={{ width: `${proforma.pagare.porcentaje_pagado}%`, height: '100%', background: '#10b981' }} />
                        </div>
                    </div>
                    {veCuentas && <Link to={`/dashboard/clientes?tab=pagare&cuenta=${proforma.pagare.id}`} style={{ ...btnSec(bdr, txt), textDecoration: 'none' }}>VER PAGARÉ</Link>}
                </div>
            )}

            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 20, boxShadow: cardSh, marginBottom: 18, maxWidth: 380, marginLeft: 'auto' }}>
                <ResumenLinea label="Subtotal" val={proforma.subtotal} mut={mut} txt={txt} />
                {Number(proforma.descuento) > 0 && <ResumenLinea label="Descuento" val={-proforma.descuento} mut={mut} txt={txt} />}
                <ResumenLinea label={`IVA (${Number(proforma.iva_porcentaje)}%)`} val={proforma.iva_valor} mut={mut} txt={txt} />
                <div style={{ borderTop: `1px solid ${bdr}`, margin: '8px 0' }} />
                <ResumenLinea label="TOTAL" val={proforma.total} mut={txt} txt={SKY_DEEP} grande />
                {Number(proforma.anticipo) > 0 && <ResumenLinea label={proforma.tipo === 'pintura' ? 'Anticipo requerido (70%)' : 'Anticipo requerido'} val={proforma.anticipo} mut={mut} txt={txt} />}
                {Number(proforma.anticipo) > 0 && <ResumenLinea label={proforma.tipo === 'pintura' ? 'Saldo restante (30%)' : 'Saldo después del anticipo'} val={Number(proforma.total) - Number(proforma.anticipo)} mut={mut} txt={txt} />}
                <ResumenLinea label="Total pagado" val={proforma.pagare ? proforma.pagare.pagado : 0} mut={mut} txt="#10b981" />
                <ResumenLinea label="Saldo pendiente de pago" val={proforma.pagare ? proforma.pagare.saldo : proforma.total} mut={txt} txt={txt} negrita />
                {proforma.tipo !== 'pintura' && !(Number(proforma.anticipo) > 0) && (
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.74rem', color: mut, marginTop: 6 }}>Mecánica general: sin anticipo obligatorio.</p>
                )}
            </div>

            {(proforma.observaciones || proforma.condiciones || proforma.garantia || proforma.tiempo_estimado) && (
                <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: 18, boxShadow: cardSh, fontFamily: "'Outfit'", fontSize: '.84rem', color: txtSf }}>
                    {proforma.garantia && <p style={{ marginBottom: 6 }}><strong style={{ color: txt }}>Garantía:</strong> {proforma.garantia}</p>}
                    {proforma.tiempo_estimado && <p style={{ marginBottom: 6 }}><strong style={{ color: txt }}>Tiempo estimado:</strong> {proforma.tiempo_estimado}</p>}
                    {proforma.observaciones && <p style={{ marginBottom: 6 }}><strong style={{ color: txt }}>Observaciones:</strong> {proforma.observaciones}</p>}
                    {proforma.condiciones && <p><strong style={{ color: txt }}>Condiciones:</strong> {proforma.condiciones}</p>}
                </div>
            )}
        </div>
    );
}

function ResumenLinea({ label, val, mut, txt, grande, negrita }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontFamily: "'Outfit'", fontSize: grande ? '1rem' : '.86rem', fontWeight: grande || negrita ? 700 : 400, color: txt }}>
            <span style={{ color: grande ? txt : mut }}>{label}</span>
            <span>${Number(val).toFixed(2)}</span>
        </div>
    );
}

function btnSec(bdr, txt) {
    return { display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Bebas Neue'", fontSize: '.68rem', letterSpacing: '.12em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '9px 14px', cursor: 'pointer', color: txt };
}
function btnPrim(sky) {
    return { display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Bebas Neue'", fontSize: '.68rem', letterSpacing: '.12em', background: sky, border: 'none', borderRadius: 10, padding: '9px 14px', cursor: 'pointer', color: '#fff' };
}
