/**
 * SS SWAP - Pestaña "Pagaré" (dentro de Clientes)
 * Cuentas por cobrar: quien debe, cuanto, y registro de pagos/abonos
 * hasta saldar. Contraparte, del lado de clientes, de lo que ya existe
 * para proveedores (Historial financiero).
 *
 * Sprint 14:
 *  - Los pagarés AUTOMÁTICOS (70% del total de la proforma, generados al
 *    convertirla en orden de trabajo) muestran claramente qué OT y qué
 *    proforma se están cobrando, el total (100%), el 70%, lo pagado, el
 *    saldo y los porcentajes pagado/pendiente.
 *  - El formulario de pago muestra campos adicionales SEGÚN el método
 *    (transferencia, cheque, tarjeta) y esos datos quedan guardados y
 *    visibles en el historial.
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import Paginador from '../proveedores/Paginador';

function IconPlus()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconX()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconCash()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>; }
function IconEye()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>; }

const ESTADOS = ['pendiente', 'parcial', 'pagado', 'vencido', 'anulado'];
const ESTADO_COLOR = { pendiente: '#f59e0b', parcial: '#0ea5e9', pagado: '#10b981', vencido: '#ef4444', anulado: '#64748b' };
const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'];
const METODO_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', cheque: 'Cheque', otro: 'Otro' };
const EMPTY_CUENTA = { cliente_id: '', vehiculo_id: '', concepto: '', monto_total: '', fecha: '', fecha_vencimiento: '', notas: '' };
const EMPTY_PAGO = {
    monto: '', fecha: '', metodo_pago: 'efectivo', referencia: '', notas: '',
    banco: '', numero_cuenta: '', tipo_cuenta: '', titular: '', numero_comprobante: '', numero_cheque: '', fecha_documento: '',
    tarjeta_tipo: '', tarjeta_ultimos4: '', autorizacion: '',
};
// Campos adicionales por metodo de pago (los obligatorios se validan tambien en el servidor)
const CAMPOS_METODO = {
    transferencia: [
        { name: 'banco', label: 'Banco *', req: true, placeholder: 'Ej: Banco Pichincha' },
        { name: 'numero_cuenta', label: 'Número de cuenta *', req: true },
        { name: 'tipo_cuenta', label: 'Tipo de cuenta', tipo: 'select', opciones: [['', 'Seleccionar...'], ['ahorros', 'Ahorros'], ['corriente', 'Corriente']] },
        { name: 'titular', label: 'Titular de la cuenta *', req: true },
        { name: 'numero_comprobante', label: 'Número de comprobante *', req: true },
        { name: 'fecha_documento', label: 'Fecha de transferencia *', req: true, tipo: 'date' },
    ],
    cheque: [
        { name: 'banco', label: 'Banco *', req: true, placeholder: 'Ej: Banco Guayaquil' },
        { name: 'numero_cheque', label: 'Número de cheque *', req: true },
        { name: 'numero_cuenta', label: 'Cuenta *', req: true },
        { name: 'titular', label: 'Titular *', req: true },
        { name: 'fecha_documento', label: 'Fecha del cheque *', req: true, tipo: 'date' },
    ],
    tarjeta: [
        { name: 'tarjeta_tipo', label: 'Tipo de tarjeta *', req: true, tipo: 'select', opciones: [['', 'Seleccionar...'], ['credito', 'Crédito'], ['debito', 'Débito']] },
        { name: 'banco', label: 'Banco / emisor', placeholder: 'Ej: Visa Banco Pichincha' },
        { name: 'tarjeta_ultimos4', label: 'Últimos 4 dígitos', placeholder: '1234', maxLength: 4, pattern: '\\d{4}' },
        { name: 'autorizacion', label: 'Código de autorización *', req: true },
    ],
};
const money = (v) => `$${Number(v || 0).toFixed(2)}`;
const pct = (v) => `${Number(v || 0).toFixed(Number(v) % 1 === 0 ? 0 : 2)}%`;

/** Lineas legibles del detalle de un pago (historial). */
function detallePago(p) {
    if (p.metodo_pago === 'transferencia') return [['Banco', p.banco], ['Cuenta', [p.numero_cuenta, p.tipo_cuenta].filter(Boolean).join(' · ')], ['Titular', p.titular], ['Comprobante', p.numero_comprobante], ['Fecha transferencia', p.fecha_documento]];
    if (p.metodo_pago === 'cheque') return [['Banco', p.banco], ['Cheque', p.numero_cheque], ['Cuenta', p.numero_cuenta], ['Titular', p.titular], ['Fecha del cheque', p.fecha_documento]];
    if (p.metodo_pago === 'tarjeta') return [['Tarjeta', p.tarjeta_tipo ? (p.tarjeta_tipo === 'credito' ? 'Crédito' : 'Débito') : null], ['Emisor', p.banco], ['Número', p.tarjeta_ultimos4 ? `**** ${p.tarjeta_ultimos4}` : null], ['Autorización', p.autorizacion]];
    return p.referencia ? [['Referencia', p.referencia]] : [];
}

function BarraPago({ pagado, color = '#10b981', bdr }) {
    const v = Math.max(0, Math.min(100, Number(pagado) || 0));
    return (
        <div style={{ height: 6, borderRadius: 999, background: bdr, overflow: 'hidden', minWidth: 70 }}>
            <div style={{ width: `${v}%`, height: '100%', background: color, borderRadius: 999, transition: 'width .3s' }} />
        </div>
    );
}

function ResumenCard({ label, value, color, theme }) {
    const { card, bdr, cardSh, txt } = theme;
    return (
        <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '14px 16px', boxShadow: cardSh }}>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.56rem', letterSpacing: '.16em', color, marginBottom: 6 }}>{label}</p>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', color: txt, lineHeight: 1 }}>{value}</p>
        </div>
    );
}

export default function PagareTab({ theme, cuentaInicial }) {
    const { txt, txtSf, mut, bdr, card, cardSh, inputBg, SKY, SKY_DEEP } = theme;
    const SKY_PALE = theme.isDark ? 'rgba(201,162,39,0.10)' : 'rgba(201,162,39,0.06)';
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.86rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.2em', color: SKY_DEEP };

    const [cuentas, setCuentas] = useState([]);
    const [resumen, setResumen] = useState(null);
    const [clientes, setClientes] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [pagina, setPagina] = useState(1);
    const POR_PAGINA = 15;
    const [filtros, setFiltros] = useState({ estado: '', q: '', origen: '' });
    const [modalNueva, setModalNueva] = useState(false);
    const [modalDetalle, setModalDetalle] = useState(null);

    const cargarClientes = useCallback(async () => {
        try {
            const { data } = await api.get('/ordenes/clientes');
            setClientes(data.clientes || []);
        } catch { /* silencioso: solo alimenta el selector del modal */ }
    }, []);

    const cargarResumen = useCallback(async () => {
        try {
            const { data } = await api.get('/cuentas-cobrar/resumen');
            setResumen(data);
        } catch { /* informativo, no bloquea la pantalla */ }
    }, []);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
            params.set('page', String(pagina));
            params.set('limit', String(POR_PAGINA));
            const { data } = await api.get(`/cuentas-cobrar?${params}`);
            setCuentas(data.cuentas || []);
            setTotal(data.total || 0);
        } catch (err) { toast.error('Error al cargar las cuentas por cobrar.'); }
        finally { setLoading(false); }
    }, [filtros, pagina]);

    useEffect(() => { cargarClientes(); cargarResumen(); }, [cargarClientes, cargarResumen]);
    useEffect(() => { setPagina(1); }, [filtros]);
    useEffect(() => { cargar(); }, [cargar]);

    const refrescarTodo = () => { cargar(); cargarResumen(); };

    const crearCuenta = async (form) => {
        try {
            await api.post('/cuentas-cobrar', form);
            toast.success('Cuenta por cobrar registrada.');
            setModalNueva(false);
            refrescarTodo();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al registrar la cuenta.'); }
    };

    const cambiarEstado = async (cuenta, estado) => {
        try {
            await api.patch(`/cuentas-cobrar/${cuenta.id}/estado`, { estado });
            toast.success('Estado actualizado.');
            refrescarTodo();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cambiar el estado.'); }
    };

    const abrirDetalle = useCallback(async (cuentaId) => {
        try {
            const { data } = await api.get(`/cuentas-cobrar/${cuentaId}`);
            setModalDetalle(data.cuenta);
        } catch { toast.error('Error al cargar el detalle de la cuenta.'); }
    }, []);

    // Enlace directo desde una proforma: /dashboard/clientes?tab=pagare&cuenta=ID
    useEffect(() => { if (cuentaInicial) abrirDetalle(cuentaInicial); }, [cuentaInicial, abrirDetalle]);

    const filtroSel = { ...inputSt, padding: '8px 10px', fontSize: '.8rem' };

    return (
        <div>
            {resumen && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
                    <ResumenCard theme={theme} label="TOTAL POR COBRAR" value={money(resumen.total_pendiente)} color={SKY_DEEP} />
                    <ResumenCard theme={theme} label="CUENTAS PENDIENTES" value={resumen.cuentas_pendientes} color="#f59e0b" />
                    <ResumenCard theme={theme} label="CLIENTES CON DEUDA" value={resumen.clientes_con_deuda} color="#8b5cf6" />
                    <ResumenCard theme={theme} label="VENCIDO" value={money(resumen.total_vencido)} color="#ef4444" />
                </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={labelSt}>BUSCAR</label>
                    <input value={filtros.q} onChange={e => setFiltros({ ...filtros, q: e.target.value })} placeholder="Cliente, concepto, OT, proforma o placa..." style={{ ...filtroSel, width: '100%', boxSizing: 'border-box' }} />
                </div>
                <div>
                    <label style={labelSt}>ORIGEN</label>
                    <select style={filtroSel} value={filtros.origen} onChange={e => setFiltros({ ...filtros, origen: e.target.value })}>
                        <option value="">Todos</option>
                        <option value="automatico">Automático (70% OT)</option>
                        <option value="manual">Manual</option>
                    </select>
                </div>
                <div>
                    <label style={labelSt}>ESTADO</label>
                    <select style={filtroSel} value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value })}>
                        <option value="">Todos</option>
                        {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                </div>
                <button onClick={() => setModalNueva(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 11, padding: '10px 20px', cursor: 'pointer', height: 38 }}>
                    <IconPlus /> NUEVA CUENTA MANUAL
                </button>
            </div>

            <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginBottom: 12 }}>
                {total} cuenta{total !== 1 ? 's' : ''} · Los pagarés del 70% se generan solos al convertir una proforma en orden de trabajo.
            </p>

            {loading ? (
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando...</p>
            ) : cuentas.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>Sin cuentas por cobrar para estos filtros</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginTop: 4 }}>Convierte una proforma en orden de trabajo para generar su pagaré automáticamente.</p>
                </div>
            ) : (
                <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                    <table className="prov-table">
                        <thead>
                            <tr style={{ background: SKY_PALE }}>
                                {['Pagaré', 'Cliente / Vehículo', 'Orden / Proforma', 'Total', 'A cobrar', 'Pagado', 'Saldo', 'Estado', ''].map(h => (
                                    <th key={h} style={{ color: SKY_DEEP }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {cuentas.map(c => (
                                <tr key={c.id} style={{ borderColor: bdr }}>
                                    <td style={{ color: txt, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                        #{c.id}
                                        <span style={{ display: 'block', fontSize: '.7rem', fontWeight: 400, color: c.origen === 'automatico' ? SKY_DEEP : mut }}>{c.origen === 'automatico' ? 'AUTOMÁTICO' : 'MANUAL'}</span>
                                    </td>
                                    <td>
                                        <p style={{ color: txt, fontWeight: 600 }}>{c.cliente_nombre}</p>
                                        <p style={{ color: mut, fontSize: '.76rem' }}>{[c.vehiculo_descripcion, c.vehiculo_placa].filter(Boolean).join(' · ') || '—'}</p>
                                    </td>
                                    <td style={{ whiteSpace: 'nowrap', fontSize: '.8rem' }}>
                                        <p style={{ color: txt, fontWeight: 600 }}>{c.orden_numero || '—'}</p>
                                        <p style={{ color: mut }}>{c.proforma_numero || (c.origen === 'manual' ? c.concepto : '—')}</p>
                                    </td>
                                    <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{c.monto_base ? money(c.monto_base) : '—'}</td>
                                    <td style={{ color: txt, whiteSpace: 'nowrap' }}>
                                        {money(c.monto_total)}
                                        {c.porcentaje && <span style={{ display: 'block', fontSize: '.7rem', color: mut }}>{pct(c.porcentaje)} del total</span>}
                                    </td>
                                    <td style={{ color: '#10b981', whiteSpace: 'nowrap' }}>
                                        {money(c.monto_pagado)}
                                        <div style={{ marginTop: 4 }}><BarraPago pagado={c.porcentaje_pagado} bdr={bdr} /></div>
                                        <span style={{ fontSize: '.7rem', color: mut }}>{pct(c.porcentaje_pagado)} pagado</span>
                                    </td>
                                    <td style={{ color: Number(c.saldo) > 0 ? '#ef4444' : txt, fontWeight: 600, whiteSpace: 'nowrap' }}>{money(c.saldo)}</td>
                                    <td>
                                        <select value={c.estado} onChange={e => cambiarEstado(c, e.target.value)}
                                            className="prov-badge" style={{ background: `${ESTADO_COLOR[c.estado]}18`, border: `1px solid ${ESTADO_COLOR[c.estado]}44`, color: ESTADO_COLOR[c.estado], cursor: 'pointer' }}>
                                            {ESTADOS.map(e => <option key={e} value={e}>{e.toUpperCase()}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                            <button className="prov-icon-btn" title="Ver / registrar pago" style={{ color: SKY_DEEP }} onClick={() => abrirDetalle(c.id)}><IconEye /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Paginador pagina={pagina} setPagina={setPagina} total={total} porPagina={POR_PAGINA} theme={theme} />

            {modalNueva && (
                <ModalNuevaCuenta theme={theme} clientes={clientes} onClose={() => setModalNueva(false)} onGuardar={crearCuenta} />
            )}
            {modalDetalle && (
                <ModalDetalleCuenta theme={theme} cuenta={modalDetalle} onClose={() => setModalDetalle(null)}
                    onActualizado={async () => { await abrirDetalle(modalDetalle.id); refrescarTodo(); }} />
            )}
        </div>
    );
}

function ModalNuevaCuenta({ theme, clientes, onClose, onGuardar }) {
    const { txt, mut, bdr, boxBg, SKY, SKY_DEEP, inputBg } = theme;
    const bg = boxBg || (theme.isDark ? '#0a0f1c' : '#ffffff');
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.86rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP };
    const [form, setForm] = useState(EMPTY_CUENTA);
    const [vehiculos, setVehiculos] = useState([]);
    const [saving, setSaving] = useState(false);

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const onCliente = async (e) => {
        const cliente_id = e.target.value;
        setForm(f => ({ ...f, cliente_id, vehiculo_id: '' }));
        setVehiculos([]);
        if (!cliente_id) return;
        try { const { data } = await api.get(`/ordenes/vehiculos?cliente_id=${cliente_id}`); setVehiculos(data.vehiculos || []); } catch { /* opcional */ }
    };
    const onSubmit = async (e) => { e.preventDefault(); setSaving(true); await onGuardar(form); setSaving(false); };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 560, background: bg, border: `1px solid ${bdr}`, padding: 28 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>PAGARÉ</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.04em', color: txt }}>Nueva Cuenta por Cobrar (manual)</h2>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginTop: 4 }}>Para deudas sin proforma. Las órdenes con proforma generan su pagaré del 70% automáticamente.</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut }}><IconX /></button>
                </div>

                <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                        <div>
                            <label style={labelSt}>CLIENTE *</label>
                            <select name="cliente_id" value={form.cliente_id} onChange={onCliente} required style={inputSt}>
                                <option value="">Seleccionar...</option>
                                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={labelSt}>VEHÍCULO</label>
                            <select name="vehiculo_id" value={form.vehiculo_id} onChange={onChange} style={inputSt} disabled={!form.cliente_id}>
                                <option value="">{form.cliente_id ? 'Sin vehículo' : 'Primero el cliente'}</option>
                                {vehiculos.map(v => <option key={v.id} value={v.id}>{v.marca} {v.modelo} — {v.placa}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={labelSt}>CONCEPTO *</label>
                        <input name="concepto" value={form.concepto} onChange={onChange} required placeholder="Ej: Saldo reparación de frenos" style={inputSt} />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                        <div>
                            <label style={labelSt}>MONTO *</label>
                            <input type="number" step="0.01" min="0.01" name="monto_total" value={form.monto_total} onChange={onChange} required style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>FECHA</label>
                            <input type="date" name="fecha" value={form.fecha} onChange={onChange} style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>VENCE EL (opcional)</label>
                            <input type="date" name="fecha_vencimiento" value={form.fecha_vencimiento} onChange={onChange} style={inputSt} />
                        </div>
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>NOTAS</label>
                            <textarea name="notas" value={form.notas} onChange={onChange} rows={2} style={{ ...inputSt, resize: 'vertical' }} />
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

function Dato({ k, v, mut, txt, fuerte }) {
    return (
        <div>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.56rem', letterSpacing: '.18em', color: mut }}>{k}</p>
            <p style={{ fontFamily: "'Outfit'", fontSize: fuerte ? '1rem' : '.86rem', fontWeight: fuerte ? 700 : 500, color: txt }}>{v || '—'}</p>
        </div>
    );
}

function ModalDetalleCuenta({ theme, cuenta, onClose, onActualizado }) {
    const { txt, txtSf, mut, bdr, SKY, SKY_DEEP, inputBg } = theme;
    const bg = theme.boxBg || (theme.isDark ? '#0a0f1c' : '#ffffff');
    const SKY_PALE = theme.isDark ? 'rgba(201,162,39,0.10)' : 'rgba(201,162,39,0.06)';
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.84rem', outline: 'none' };
    const etiqSt = { display: 'block', fontFamily: "'Bebas Neue'", fontSize: '.56rem', letterSpacing: '.18em', color: mut, marginBottom: 4 };
    const [form, setForm] = useState(EMPTY_PAGO);
    const [saving, setSaving] = useState(false);
    const { tieneRol } = useAuth();
    const esAdmin = tieneRol('administrador');
    const [anulando, setAnulando] = useState(null); // { id, motivo }
    const saldo = Number(cuenta.saldo);

    // Sprint 15: los pagos ya no se borran, se ANULAN (quedan en el historial)
    const anularPago = async () => {
        if (!anulando?.motivo?.trim()) return toast.error('Indica el motivo de la anulación.');
        try {
            const { data } = await api.delete(`/cuentas-cobrar/${cuenta.id}/pagos/${anulando.id}`, { data: { motivo: anulando.motivo.trim() } });
            toast.success(data.mensaje || 'Pago anulado.');
            setAnulando(null);
            onActualizado();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al anular el pago.'); }
    };
    const campos = CAMPOS_METODO[form.metodo_pago] || [];

    const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    // Al cambiar de metodo se limpian los campos del metodo anterior (no se mezclan datos)
    const onMetodo = (e) => setForm({ ...EMPTY_PAGO, monto: form.monto, fecha: form.fecha, notas: form.notas, metodo_pago: e.target.value });
    const onSubmit = async (e) => {
        e.preventDefault();
        if (!form.monto || parseFloat(form.monto) <= 0) return toast.error('Ingresa un monto valido.');
        const falta = campos.find(c => c.req && !String(form[c.name] || '').trim());
        if (falta) return toast.error(`Completa: ${falta.label.replace(' *', '')}.`);
        setSaving(true);
        try {
            // Solo se envian los campos del metodo elegido
            const payload = { monto: form.monto, fecha: form.fecha, metodo_pago: form.metodo_pago, referencia: form.referencia, notas: form.notas };
            campos.forEach(c => { payload[c.name] = form[c.name]; });
            await api.post(`/cuentas-cobrar/${cuenta.id}/pagos`, payload);
            toast.success('Pago registrado.');
            setForm(EMPTY_PAGO);
            onActualizado();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al registrar el pago.'); }
        finally { setSaving(false); }
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 720, background: bg, border: `1px solid ${bdr}`, padding: 28, maxHeight: '92vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 4 }}>
                            {cuenta.origen === 'automatico' ? `PAGARÉ AUTOMÁTICO · ${pct(cuenta.porcentaje)} DEL TOTAL` : 'CUENTA POR COBRAR (MANUAL)'}
                        </p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt }}>Pagaré #{cuenta.id}</h2>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: txtSf }}>{cuenta.concepto}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut }}><IconX /></button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, padding: '14px 16px', border: `1px solid ${bdr}`, borderRadius: 12, marginBottom: 12 }}>
                    <Dato k="CLIENTE" v={cuenta.cliente_nombre} mut={mut} txt={txt} />
                    <Dato k="VEHÍCULO" v={[cuenta.vehiculo_descripcion, cuenta.vehiculo_placa].filter(Boolean).join(' · ')} mut={mut} txt={txt} />
                    <Dato k="ORDEN DE TRABAJO" v={cuenta.orden_numero} mut={mut} txt={txt} />
                    <Dato k="PROFORMA" v={cuenta.proforma_numero ? <Link to={`/dashboard/proformas/${cuenta.proforma_id}`} style={{ color: SKY_DEEP }}>{cuenta.proforma_numero}</Link> : null} mut={mut} txt={txt} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12, padding: '14px 16px', background: SKY_PALE, borderRadius: 12, marginBottom: 8 }}>
                    <Dato k="TOTAL (100%)" v={cuenta.monto_base ? money(cuenta.monto_base) : money(cuenta.monto_total)} mut={mut} txt={txt} fuerte />
                    <Dato k={cuenta.porcentaje ? `${pct(cuenta.porcentaje)} A COBRAR` : 'A COBRAR'} v={money(cuenta.monto_total)} mut={mut} txt={SKY_DEEP} fuerte />
                    <Dato k="PAGADO" v={money(cuenta.monto_pagado)} mut={mut} txt="#10b981" fuerte />
                    <Dato k="SALDO PENDIENTE" v={money(saldo)} mut={mut} txt={saldo > 0 ? '#ef4444' : txt} fuerte />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                    <div style={{ flex: 1 }}><BarraPago pagado={cuenta.porcentaje_pagado} bdr={bdr} /></div>
                    <span style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: txtSf, whiteSpace: 'nowrap' }}>
                        Pagado {pct(cuenta.porcentaje_pagado)} · Pendiente {pct(cuenta.porcentaje_pendiente)} · <strong style={{ color: ESTADO_COLOR[cuenta.estado] }}>{cuenta.estado.toUpperCase()}</strong>
                    </span>
                </div>

                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.65rem', letterSpacing: '.18em', color: SKY_DEEP, marginBottom: 8 }}>HISTORIAL DE PAGOS</p>
                {(!cuenta.pagos || cuenta.pagos.length === 0) ? (
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginBottom: 16 }}>Sin pagos registrados todavía.</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                        {cuenta.pagos.map(p => {
                            const lineas = detallePago(p).filter(([, v]) => v);
                            const anulado = Boolean(p.anulado_at);
                            return (
                                <div key={p.id} style={{ padding: '10px 12px', borderRadius: 10, border: `1px solid ${anulado ? 'rgba(239,68,68,0.35)' : bdr}`, fontFamily: "'Outfit'", fontSize: '.8rem', opacity: anulado ? 0.7 : 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                                        <span style={{ color: txt }}>
                                            <strong style={{ fontFamily: "'Bebas Neue'", letterSpacing: '.1em', fontSize: '.85rem' }}>{(METODO_LABEL[p.metodo_pago] || p.metodo_pago || '').toUpperCase()}</strong>
                                            <span style={{ color: mut }}> · {p.fecha}{p.usuario_nombre ? ` · registró ${p.usuario_nombre}` : ''}</span>
                                        </span>
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                            <strong style={{ color: anulado ? '#ef4444' : '#10b981', textDecoration: anulado ? 'line-through' : 'none' }}>{money(p.monto)}</strong>
                                            {esAdmin && !anulado && anulando?.id !== p.id && (
                                                <button type="button" onClick={() => setAnulando({ id: p.id, motivo: '' })}
                                                    style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 7, padding: '2px 8px', cursor: 'pointer', color: '#ef4444', fontFamily: "'Outfit'", fontSize: '.72rem' }}>Anular</button>
                                            )}
                                        </span>
                                    </div>
                                    {anulado && (
                                        <p style={{ color: '#ef4444', marginTop: 4 }}>
                                            ANULADO el {new Date(p.anulado_at).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}{p.anulado_por_nombre ? ` por ${p.anulado_por_nombre}` : ''}{p.motivo_anulacion ? ` · ${p.motivo_anulacion}` : ''}
                                        </p>
                                    )}
                                    {anulando?.id === p.id && (
                                        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                                            <input autoFocus value={anulando.motivo} onChange={e => setAnulando({ ...anulando, motivo: e.target.value })}
                                                placeholder="Motivo de la anulación (ej: cheque rebotado)" style={{ ...inputSt, flex: 1, minWidth: 200, padding: '6px 10px' }} />
                                            <button type="button" onClick={anularPago} style={{ background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontFamily: "'Bebas Neue'", letterSpacing: '.1em' }}>ANULAR PAGO</button>
                                            <button type="button" onClick={() => setAnulando(null)} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: mut }}>Cancelar</button>
                                        </div>
                                    )}
                                    {lineas.length > 0 && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '2px 14px', marginTop: 6, color: txtSf }}>
                                            {lineas.map(([k, v]) => <span key={k}><span style={{ color: mut }}>{k}:</span> {v}</span>)}
                                        </div>
                                    )}
                                    {p.notas && <p style={{ color: mut, marginTop: 4 }}>Observación: {p.notas}</p>}
                                </div>
                            );
                        })}
                    </div>
                )}

                {saldo > 0 && cuenta.estado !== 'anulado' && (
                    <form onSubmit={onSubmit} style={{ borderTop: `1px solid ${bdr}`, paddingTop: 16 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.65rem', letterSpacing: '.18em', color: SKY_DEEP, marginBottom: 10 }}>REGISTRAR PAGO</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10, marginBottom: 10 }}>
                            <label><span style={etiqSt}>MÉTODO DE PAGO</span>
                                <select name="metodo_pago" value={form.metodo_pago} onChange={onMetodo} style={inputSt}>
                                    {METODOS.map(m => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
                                </select>
                            </label>
                            <label><span style={etiqSt}>{form.metodo_pago === 'cheque' ? 'VALOR DEL CHEQUE *' : 'MONTO *'}</span>
                                <input type="number" step="0.01" min="0.01" max={saldo} name="monto" value={form.monto} onChange={onChange} placeholder={`Máx ${money(saldo)}`} style={inputSt} />
                            </label>
                            <label><span style={etiqSt}>FECHA DE REGISTRO</span>
                                <input type="date" name="fecha" value={form.fecha} onChange={onChange} style={inputSt} />
                            </label>
                        </div>

                        {campos.length > 0 && (
                            <div style={{ border: `1px dashed ${bdr}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.18em', color: SKY_DEEP, marginBottom: 8 }}>
                                    DATOS DE {METODO_LABEL[form.metodo_pago].toUpperCase()}
                                </p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                                    {campos.map(c => (
                                        <label key={c.name}><span style={etiqSt}>{c.label.toUpperCase()}</span>
                                            {c.tipo === 'select'
                                                ? <select name={c.name} value={form[c.name]} onChange={onChange} style={inputSt} required={c.req}>
                                                    {c.opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                                                  </select>
                                                : <input type={c.tipo || 'text'} name={c.name} value={form[c.name]} onChange={onChange} required={c.req}
                                                    placeholder={c.placeholder || ''} maxLength={c.maxLength} pattern={c.pattern} style={inputSt} />}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: campos.length ? '1fr' : '1fr 2fr', gap: 10, marginBottom: 10 }}>
                            {!campos.length && (
                                <label><span style={etiqSt}>REFERENCIA</span>
                                    <input name="referencia" value={form.referencia} onChange={onChange} placeholder="Opcional" style={inputSt} />
                                </label>
                            )}
                            <label><span style={etiqSt}>OBSERVACIÓN</span>
                                <input name="notas" value={form.notas} onChange={onChange} placeholder="Opcional" style={inputSt} />
                            </label>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" disabled={saving}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.12em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 9, padding: '9px 18px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                                <IconCash /> {saving ? 'REGISTRANDO...' : 'REGISTRAR PAGO'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
