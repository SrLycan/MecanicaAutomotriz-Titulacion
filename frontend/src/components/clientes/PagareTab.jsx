/**
 * SS SWAP - Pestaña "Pagaré" (dentro de Clientes)
 * Cuentas por cobrar: quien debe, cuanto, y registro de pagos/abonos
 * hasta saldar. Contraparte, del lado de clientes, de lo que ya existe
 * para proveedores (Historial financiero).
 *
 * Sprint 14:
 *  - El formulario de pago muestra campos adicionales SEGÚN el método
 *    (transferencia, cheque, tarjeta) y esos datos quedan guardados y
 *    visibles en el historial.
 * Sprint 20:
 *  - El pagaré representa el 100% de la deuda. El anticipo (70% en
 *    colisiones; opcional en mecánica) es un monto REQUERIDO: solo cuenta
 *    como pagado cuando se registra el pago.
 *  - El estado (pendiente / parcial / vencido / pagado) lo calcula el
 *    servidor con los pagos confirmados y la fecha límite; ya no se elige a
 *    mano (solo se puede anular o reabrir).
 *  - Antes de registrar un pago se muestra una confirmación con el total,
 *    lo abonado, el nuevo pago, el saldo resultante y el estado nuevo.
 *  - Alertas de pagarés vencidos o por vencer en la parte superior.
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useConfirm } from '../common/ConfirmDialog';
import api from '../../services/api';
import Paginador from '../proveedores/Paginador';

function IconPlus()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconX()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconCash()  { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>; }
function IconEye()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>; }

const ESTADOS = ['pendiente', 'parcial', 'vencido', 'pagado', 'anulado'];
const ESTADO_COLOR = { pendiente: '#f59e0b', parcial: '#0ea5e9', pagado: '#10b981', vencido: '#ef4444', anulado: '#64748b' };
const ESTADO_LABEL = { pendiente: 'Pendiente de pago', parcial: 'Pago parcial', vencido: 'Vencido', pagado: 'Pagado', anulado: 'Anulado' };
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
/** Mismo calculo que el servidor (reglasPago.calcularEstadoPago). */
function estadoTrasPago(total, pagado, fechaVencimiento) {
    if (pagado + 0.005 >= total) return 'pagado';
    if (fechaVencimiento && String(fechaVencimiento).slice(0, 10) < new Date().toISOString().slice(0, 10)) return 'vencido';
    return pagado > 0.005 ? 'parcial' : 'pendiente';
}
const METODOS = ['efectivo', 'transferencia', 'tarjeta', 'cheque', 'otro'];
const METODO_LABEL = { efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta', cheque: 'Cheque', otro: 'Otro' };
const EMPTY_CUENTA = { cliente_id: '', vehiculo_id: '', concepto: '', monto_total: '', anticipo_requerido: '', fecha: '', fecha_vencimiento: '', notas: '' };
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

/**
 * Barra de progreso de pago: (pagado / total) x 100. El servidor nunca
 * devuelve 100% mientras quede saldo. `anticipo` marca donde esta el
 * anticipo requerido (p. ej. el 70% en colisiones).
 */
function BarraPago({ pagado, color = '#10b981', bdr, anticipo, alto = 6 }) {
    const v = Math.max(0, Math.min(100, Number(pagado) || 0));
    const a = Number(anticipo) > 0 && Number(anticipo) < 100 ? Number(anticipo) : null;
    return (
        <div style={{ position: 'relative', height: alto, borderRadius: 999, background: bdr, overflow: 'hidden', minWidth: 70 }}
            role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${v}%`, height: '100%', background: v >= 100 ? '#10b981' : color, borderRadius: 999, transition: 'width .3s' }} />
            {a && <div title={`Anticipo requerido (${a}%)`} style={{ position: 'absolute', top: 0, bottom: 0, left: `${a}%`, width: 2, background: 'rgba(15,23,42,.45)' }} />}
        </div>
    );
}

function BadgeEstado({ estado, diasRetraso }) {
    const color = ESTADO_COLOR[estado] || '#64748b';
    return (
        <span className="prov-badge" style={{ background: `${color}18`, border: `1px solid ${color}55`, color, whiteSpace: 'nowrap' }}>
            {(ESTADO_LABEL[estado] || estado).toUpperCase()}{estado === 'vencido' && diasRetraso > 0 ? ` · ${diasRetraso} d` : ''}
        </span>
    );
}

/** Alertas de pagarés vencidos / por vencer (GET /cuentas-cobrar/alertas). */
function AlertasVencimiento({ alertas, onVer, theme }) {
    const [abierto, setAbierto] = useState(true);
    if (!alertas.length) return null;
    const vencidas = alertas.filter(a => a.tipo_alerta === 'vencido');
    const porVencer = alertas.filter(a => a.tipo_alerta === 'por_vencer');
    const totalVencido = vencidas.reduce((s, a) => s + Number(a.saldo), 0);
    const color = vencidas.length ? '#ef4444' : '#f59e0b';
    return (
        <div role="alert" style={{ border: `1px solid ${color}55`, background: `${color}10`, borderRadius: 14, padding: '12px 16px', marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem', color }}>
                    ⚠ {vencidas.length ? `${vencidas.length} pagaré${vencidas.length !== 1 ? 's' : ''} vencido${vencidas.length !== 1 ? 's' : ''} · ${money(totalVencido)} pendiente` : ''}
                    {vencidas.length && porVencer.length ? ' · ' : ''}
                    {porVencer.length ? `${porVencer.length} vence${porVencer.length !== 1 ? 'n' : ''} en 3 días o menos` : ''}
                </p>
                <button type="button" onClick={() => setAbierto(!abierto)} style={{ background: 'none', border: 'none', color: theme.mut, cursor: 'pointer', fontFamily: "'Outfit'", fontSize: '.78rem' }}>{abierto ? 'Ocultar' : 'Ver detalle'}</button>
            </div>
            {abierto && (
                <div style={{ overflowX: 'auto', marginTop: 8 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Outfit'", fontSize: '.8rem', color: theme.txt }}>
                        <thead>
                            <tr style={{ textAlign: 'left', color: theme.mut }}>
                                {['Cliente', 'Pagaré / Proforma', 'Fecha límite', 'Retraso', 'Pendiente', 'Estado', ''].map(h => <th key={h} style={{ padding: '4px 8px', fontWeight: 500 }}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {alertas.map(a => (
                                <tr key={a.id} style={{ borderTop: `1px solid ${color}22` }}>
                                    <td style={{ padding: '5px 8px', fontWeight: 600 }}>{a.cliente_nombre}</td>
                                    <td style={{ padding: '5px 8px' }}>#{a.id}{a.proforma_numero ? ` · ${a.proforma_numero}` : ''}</td>
                                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{a.fecha_vencimiento}</td>
                                    <td style={{ padding: '5px 8px', whiteSpace: 'nowrap', color: a.dias_retraso > 0 ? '#ef4444' : theme.mut }}>{a.dias_retraso > 0 ? `${a.dias_retraso} día${a.dias_retraso !== 1 ? 's' : ''}` : 'Por vencer'}</td>
                                    <td style={{ padding: '5px 8px', fontWeight: 700, whiteSpace: 'nowrap' }}>{money(a.saldo)}</td>
                                    <td style={{ padding: '5px 8px' }}><BadgeEstado estado={a.estado} diasRetraso={a.dias_retraso} /></td>
                                    <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                                        <button type="button" onClick={() => onVer(a.id)} style={{ background: 'none', border: `1px solid ${color}55`, borderRadius: 8, padding: '3px 10px', cursor: 'pointer', color, fontFamily: "'Outfit'", fontSize: '.74rem' }}>Ver / cobrar</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function ResumenCard({ label, value, color, theme }) {
    const { card, bdr, cardSh, txt } = theme;
    return (
        <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '14px 16px', boxShadow: cardSh }}>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.16em', color, marginBottom: 6 }}>{label}</p>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', color: txt, lineHeight: 1 }}>{value}</p>
        </div>
    );
}

export default function PagareTab({ theme, cuentaInicial }) {
    const { txt, txtSf, mut, bdr, card, cardSh, inputBg, SKY, SKY_DEEP } = theme;
    const SKY_PALE = theme.isDark ? 'rgba(201,162,39,0.10)' : 'rgba(201,162,39,0.06)';
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.86rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.2em', color: SKY_DEEP };

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
    const [alertas, setAlertas] = useState([]);
    const { puede } = useAuth();
    // Permisos de cartera y de pagos (el backend valida cada operacion).
    const permisos = {
        crear: puede('cuentas_cobrar', 'crear'),
        editar: puede('cuentas_cobrar', 'editar'),
        anular: puede('cuentas_cobrar', 'eliminar'),
        registrarPago: puede('pagos_clientes', 'crear'),
        anularPago: puede('pagos_clientes', 'eliminar'),
    };

    const cargarClientes = useCallback(async () => {
        try {
            const { data } = await api.get('/ordenes/clientes');
            setClientes(data.clientes || []);
        } catch { /* silencioso: solo alimenta el selector del modal */ }
    }, []);

    const cargarResumen = useCallback(async () => {
        try {
            const [{ data }, { data: al }] = await Promise.all([api.get('/cuentas-cobrar/resumen'), api.get('/cuentas-cobrar/alertas')]);
            setResumen(data);
            setAlertas(al.alertas || []);
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

    // El estado de pago se calcula solo; a mano solo se anula o se reabre.
    const confirm = useConfirm();
    const cambiarEstado = async (cuenta, estado) => {
        const anular = estado === 'anulado';
        if (!(await confirm({
            title: anular ? 'Anular pagaré' : 'Reabrir pagaré', danger: anular, confirmLabel: anular ? 'Anular' : 'Reabrir',
            message: anular
                ? `¿Anular el pagaré #${cuenta.id} de ${cuenta.cliente_nombre}? Deja de contar como deuda; los pagos registrados se conservan en el historial.`
                : `¿Reabrir el pagaré #${cuenta.id}? Su estado se recalculará con los pagos registrados.`,
        }))) return;
        try {
            await api.patch(`/cuentas-cobrar/${cuenta.id}/estado`, { estado });
            toast.success(anular ? 'Pagaré anulado.' : 'Pagaré reabierto.');
            refrescarTodo();
            if (modalDetalle?.id === cuenta.id) abrirDetalle(cuenta.id);
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
            <AlertasVencimiento alertas={alertas} onVer={abrirDetalle} theme={theme} />
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
                        <option value="automatico">Automático (desde proforma / OT)</option>
                        <option value="manual">Manual</option>
                    </select>
                </div>
                <div>
                    <label style={labelSt}>ESTADO</label>
                    <select style={filtroSel} value={filtros.estado} onChange={e => setFiltros({ ...filtros, estado: e.target.value })}>
                        <option value="">Todos</option>
                        {ESTADOS.map(e => <option key={e} value={e}>{ESTADO_LABEL[e]}</option>)}
                    </select>
                </div>
                {permisos.crear && (
                <button onClick={() => setModalNueva(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 11, padding: '10px 20px', cursor: 'pointer', height: 38 }}>
                    <IconPlus /> NUEVA CUENTA MANUAL
                </button>
                )}
            </div>

            <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginBottom: 12 }}>
                {total} cuenta{total !== 1 ? 's' : ''} · Al convertir una proforma en orden de trabajo se genera su pagaré por el total (colisiones: anticipo requerido del 70%; mecánica: sin anticipo obligatorio).
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
                                {['Pagaré', 'Cliente / Vehículo', 'Orden / Proforma', 'Total', 'Anticipo req.', 'Pagado', 'Saldo', 'Vence', 'Estado', ''].map(h => (
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
                                    <td style={{ color: txt, fontWeight: 600, whiteSpace: 'nowrap' }}>{money(c.total)}</td>
                                    <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>
                                        {c.anticipo_requerido > 0 ? money(c.anticipo_requerido) : '—'}
                                        {c.anticipo_requerido > 0 && (
                                            <span style={{ display: 'block', fontSize: '.7rem', color: c.anticipo_cubierto ? '#10b981' : '#f59e0b' }}>
                                                {c.porcentaje ? `${pct(c.porcentaje)} · ` : ''}{c.anticipo_cubierto ? 'recibido' : 'por cobrar'}
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ color: '#10b981', whiteSpace: 'nowrap' }}>
                                        {money(c.pagado)}
                                        <div style={{ marginTop: 4 }}><BarraPago pagado={c.porcentaje_pagado} bdr={bdr} anticipo={c.porcentaje} /></div>
                                        <span style={{ fontSize: '.7rem', color: mut }}>{pct(c.porcentaje_pagado)} pagado</span>
                                    </td>
                                    <td style={{ color: c.saldo > 0 ? '#ef4444' : txt, fontWeight: 600, whiteSpace: 'nowrap' }}>{money(c.saldo)}</td>
                                    <td style={{ whiteSpace: 'nowrap', fontSize: '.8rem', color: c.estado === 'vencido' ? '#ef4444' : txtSf }}>
                                        {c.fecha_vencimiento || '—'}
                                        {c.dias_retraso > 0 && <span style={{ display: 'block', fontSize: '.7rem' }}>{c.dias_retraso} día{c.dias_retraso !== 1 ? 's' : ''} de retraso</span>}
                                    </td>
                                    <td><BadgeEstado estado={c.estado} diasRetraso={c.dias_retraso} /></td>
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
                <ModalDetalleCuenta theme={theme} cuenta={modalDetalle} onClose={() => setModalDetalle(null)} permisos={permisos}
                    onCambiarEstado={cambiarEstado}
                    onActualizado={async () => { await abrirDetalle(modalDetalle.id); refrescarTodo(); }} />
            )}
        </div>
    );
}

function ModalNuevaCuenta({ theme, clientes, onClose, onGuardar }) {
    const { txt, mut, bdr, boxBg, SKY, SKY_DEEP, inputBg } = theme;
    const bg = boxBg || (theme.isDark ? '#111826' : '#ffffff');
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.86rem', outline: 'none' };
    const labelSt = { display: 'block', marginBottom: 6, fontFamily: "'Bebas Neue'", fontSize: '.74rem', letterSpacing: '.22em', color: SKY_DEEP };
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
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 6 }}>PAGARÉ</p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.04em', color: txt }}>Nueva Cuenta por Cobrar (manual)</h2>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginTop: 4 }}>Para deudas sin proforma. Las órdenes con proforma generan su pagaré automáticamente.</p>
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
                            <label style={labelSt}>ANTICIPO REQUERIDO (opcional)</label>
                            <input type="number" step="0.01" min="0" max={form.monto_total || undefined} name="anticipo_requerido" value={form.anticipo_requerido} onChange={onChange} placeholder="0.00" style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>FECHA</label>
                            <input type="date" name="fecha" value={form.fecha} onChange={onChange} style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>FECHA LÍMITE DE PAGO (opcional)</label>
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
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.18em', color: mut }}>{k}</p>
            <p style={{ fontFamily: "'Outfit'", fontSize: fuerte ? '1rem' : '.86rem', fontWeight: fuerte ? 700 : 500, color: txt }}>{v || '—'}</p>
        </div>
    );
}

function ModalDetalleCuenta({ theme, cuenta, onClose, onActualizado, onCambiarEstado, permisos }) {
    const { txt, txtSf, mut, bdr, SKY, SKY_DEEP, inputBg } = theme;
    const bg = theme.boxBg || (theme.isDark ? '#111826' : '#ffffff');
    const SKY_PALE = theme.isDark ? 'rgba(201,162,39,0.10)' : 'rgba(201,162,39,0.06)';
    const inputSt = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.84rem', outline: 'none' };
    const etiqSt = { display: 'block', fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.18em', color: mut, marginBottom: 4 };
    const [form, setForm] = useState(EMPTY_PAGO);
    const [saving, setSaving] = useState(false);
    const [anulando, setAnulando] = useState(null); // { id, motivo }
    const [confirmando, setConfirmando] = useState(null); // payload pendiente de confirmar
    const [venc, setVenc] = useState(cuenta.fecha_vencimiento || '');
    const saldo = Number(cuenta.saldo);
    const anticipoPendiente = Number(cuenta.anticipo_pendiente || 0);

    // Fecha limite de pago (alimenta las alertas de vencimiento)
    const guardarVencimiento = async () => {
        try {
            await api.put(`/cuentas-cobrar/${cuenta.id}`, { concepto: cuenta.concepto, monto_total: cuenta.monto_total, notas: cuenta.notas, fecha_vencimiento: venc || null });
            toast.success(venc ? 'Fecha límite actualizada.' : 'Fecha límite eliminada.');
            onActualizado();
        } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar la fecha límite.'); }
    };

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
    // Paso 1: validar y mostrar la confirmacion con los montos resultantes.
    const onSubmit = (e) => {
        e.preventDefault();
        const monto = r2(parseFloat(form.monto));
        if (!(monto > 0)) return toast.error('Ingresa un monto valido.');
        if (monto > saldo + 0.005) return toast.error(`El pago no puede superar el saldo pendiente (${money(saldo)}).`);
        const falta = campos.find(c => c.req && !String(form[c.name] || '').trim());
        if (falta) return toast.error(`Completa: ${falta.label.replace(' *', '')}.`);
        // Solo se envian los campos del metodo elegido
        const payload = { monto, fecha: form.fecha, metodo_pago: form.metodo_pago, referencia: form.referencia, notas: form.notas };
        campos.forEach(c => { payload[c.name] = form[c.name]; });
        setConfirmando(payload);
    };
    // Paso 2: registrar de verdad (el servidor recalcula todo desde los pagos).
    const registrarConfirmado = async (forzarDuplicado = false) => {
        if (!confirmando || saving) return;
        setSaving(true);
        try {
            const { data } = await api.post(`/cuentas-cobrar/${cuenta.id}/pagos`, { ...confirmando, confirmar_duplicado: forzarDuplicado || undefined });
            const c = data.cuenta;
            toast.success(`Pago de ${money(confirmando.monto)} registrado. Saldo: ${money(c.saldo)} · ${ESTADO_LABEL[c.estado] || c.estado}.`, { duration: 6000 });
            setForm(EMPTY_PAGO);
            setConfirmando(null);
            onActualizado();
        } catch (err) {
            if (err.response?.data?.posible_duplicado && !forzarDuplicado) {
                setSaving(false);
                if (window.confirm(`${err.response.data.error}\n\n¿Registrar de todas formas?`)) return registrarConfirmado(true);
                return;
            }
            toast.error(err.response?.data?.error || 'Error al registrar el pago.');
        } finally { setSaving(false); }
    };

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box" style={{ maxWidth: 720, background: bg, border: `1px solid ${bdr}`, padding: 28, maxHeight: '92vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.24em', color: SKY_DEEP, marginBottom: 4 }}>
                            {cuenta.origen === 'automatico'
                                ? `PAGARÉ AUTOMÁTICO · ${cuenta.proforma_tipo === 'pintura' ? 'COLISIONES' : 'MECÁNICA GENERAL'}`
                                : 'CUENTA POR COBRAR (MANUAL)'}
                        </p>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt }}>Pagaré #{cuenta.id} <BadgeEstado estado={cuenta.estado} diasRetraso={cuenta.dias_retraso} /></h2>
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
                    <Dato k="TOTAL DE LA DEUDA" v={money(cuenta.total)} mut={mut} txt={txt} fuerte />
                    <Dato k={cuenta.porcentaje ? `ANTICIPO REQUERIDO (${pct(cuenta.porcentaje)})` : 'ANTICIPO REQUERIDO'}
                        v={cuenta.anticipo_requerido > 0 ? `${money(cuenta.anticipo_requerido)} · ${cuenta.anticipo_cubierto ? 'recibido' : 'por cobrar'}` : 'No exigido'} mut={mut} txt={SKY_DEEP} fuerte />
                    <Dato k="TOTAL ABONADO" v={money(cuenta.pagado)} mut={mut} txt="#10b981" fuerte />
                    <Dato k="SALDO PENDIENTE" v={money(saldo)} mut={mut} txt={saldo > 0 ? '#ef4444' : txt} fuerte />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}><BarraPago pagado={cuenta.porcentaje_pagado} bdr={bdr} anticipo={cuenta.porcentaje} alto={9} /></div>
                    <span style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: txtSf, whiteSpace: 'nowrap' }}>
                        Pagado {pct(cuenta.porcentaje_pagado)} · Pendiente {pct(cuenta.porcentaje_pendiente)}
                    </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 18, fontFamily: "'Outfit'", fontSize: '.8rem', color: txtSf }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={etiqSt}>FECHA LÍMITE DE PAGO</span>
                        <span style={{ display: 'flex', gap: 6 }}>
                            <input type="date" value={venc} min={cuenta.fecha} onChange={e => setVenc(e.target.value)} style={{ ...inputSt, width: 170 }} disabled={cuenta.estado === 'anulado' || !permisos.editar} />
                            {venc !== (cuenta.fecha_vencimiento || '') && <button type="button" onClick={guardarVencimiento} style={{ background: SKY_DEEP, color: '#fff', border: 'none', borderRadius: 8, padding: '0 12px', cursor: 'pointer', fontFamily: "'Bebas Neue'", letterSpacing: '.1em' }}>GUARDAR</button>}
                        </span>
                    </label>
                    {cuenta.dias_retraso > 0 && <span style={{ color: '#ef4444', fontWeight: 600 }}>Vencido hace {cuenta.dias_retraso} día{cuenta.dias_retraso !== 1 ? 's' : ''}</span>}
                    {cuenta.fecha_pago_completo && <span style={{ color: '#10b981', fontWeight: 600 }}>Pagado por completo el {new Date(cuenta.fecha_pago_completo).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                    <span style={{ flex: 1 }} />
                    {permisos.anular && cuenta.estado !== 'anulado' && (
                        <button type="button" onClick={() => onCambiarEstado(cuenta, 'anulado')} style={{ background: 'none', border: '1px solid rgba(239,68,68,.4)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#ef4444', fontFamily: "'Outfit'", fontSize: '.76rem' }}>Anular pagaré</button>
                    )}
                    {permisos.anular && cuenta.estado === 'anulado' && (
                        <button type="button" onClick={() => onCambiarEstado(cuenta, 'pendiente')} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: txt, fontFamily: "'Outfit'", fontSize: '.76rem' }}>Reabrir pagaré</button>
                    )}
                </div>

                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.18em', color: SKY_DEEP, marginBottom: 8 }}>HISTORIAL DE PAGOS</p>
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
                                            {permisos.anularPago && !anulado && anulando?.id !== p.id && (
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

                {saldo > 0 && cuenta.estado !== 'anulado' && permisos.registrarPago && (
                    <form onSubmit={onSubmit} style={{ borderTop: `1px solid ${bdr}`, paddingTop: 16 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.18em', color: SKY_DEEP, marginBottom: 10 }}>REGISTRAR PAGO</p>
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
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.18em', color: SKY_DEEP, marginBottom: 8 }}>
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
                        {anticipoPendiente > 0 && (
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: '#f59e0b', marginBottom: 10 }}>
                                Anticipo requerido pendiente de cobro: <strong>{money(anticipoPendiente)}</strong>
                                <button type="button" onClick={() => setForm(f => ({ ...f, monto: String(anticipoPendiente) }))} style={{ marginLeft: 8, background: 'none', border: '1px solid #f59e0b77', borderRadius: 7, padding: '1px 8px', cursor: 'pointer', color: '#f59e0b', fontSize: '.74rem' }}>Usar este monto</button>
                            </p>
                        )}
                        {!confirmando && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button type="submit" disabled={saving}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.12em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 9, padding: '9px 18px', cursor: saving ? 'not-allowed' : 'pointer' }}>
                                    <IconCash /> REVISAR Y REGISTRAR PAGO
                                </button>
                            </div>
                        )}
                    </form>
                )}

                {/* Confirmacion previa del pago: verificar montos antes de registrar */}
                {confirmando && (() => {
                    const previo = Number(cuenta.pagado);
                    const nuevoPagado = r2(previo + Number(confirmando.monto));
                    const nuevoSaldo = r2(Math.max(0, Number(cuenta.total) - nuevoPagado));
                    const nuevoEstado = estadoTrasPago(Number(cuenta.total), nuevoPagado, cuenta.fecha_vencimiento);
                    const pctNuevo = Number(cuenta.total) > 0 ? Math.min(nuevoSaldo > 0.005 ? 99.99 : 100, r2(nuevoPagado * 100 / Number(cuenta.total))) : 0;
                    const filas = [
                        ['Cliente', cuenta.cliente_nombre],
                        ['Proforma / Orden', [cuenta.proforma_numero, cuenta.orden_numero].filter(Boolean).join(' · ') || cuenta.concepto],
                        ['Monto total del trabajo', money(cuenta.total)],
                        ['Abonado anteriormente', money(previo)],
                        ['Pago que se registra', `${money(confirmando.monto)} (${METODO_LABEL[confirmando.metodo_pago]})`],
                        ['Saldo pendiente después del pago', money(nuevoSaldo)],
                    ];
                    return (
                        <div role="dialog" aria-label="Confirmar pago" style={{ marginTop: 14, border: `2px solid ${ESTADO_COLOR[nuevoEstado]}66`, borderRadius: 12, padding: 16, background: `${ESTADO_COLOR[nuevoEstado]}0d` }}>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.8rem', letterSpacing: '.16em', color: txt, marginBottom: 10 }}>CONFIRMAR REGISTRO DE PAGO</p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 16px', fontFamily: "'Outfit'", fontSize: '.84rem', color: txt }}>
                                {filas.map(([k, v]) => (<React.Fragment key={k}><span style={{ color: mut }}>{k}</span><strong>{v}</strong></React.Fragment>))}
                                <span style={{ color: mut }}>Estado del pagaré</span>
                                <span><BadgeEstado estado={cuenta.estado} diasRetraso={cuenta.dias_retraso} /> → <BadgeEstado estado={nuevoEstado} /></span>
                            </div>
                            <div style={{ margin: '12px 0 4px' }}><BarraPago pagado={pctNuevo} bdr={bdr} anticipo={cuenta.porcentaje} alto={9} /></div>
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.76rem', color: mut, marginBottom: 12 }}>
                                Progreso después del pago: {pct(pctNuevo)} pagado · {pct(r2(100 - pctNuevo))} pendiente.
                                {nuevoEstado !== 'pagado' && ' La deuda NO quedará pagada: se conserva el saldo para pagos posteriores.'}
                            </p>
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button type="button" onClick={() => setConfirmando(null)} disabled={saving} style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: '8px 16px', cursor: 'pointer', color: mut, fontFamily: "'Bebas Neue'", letterSpacing: '.1em' }}>CORREGIR</button>
                                <button type="button" onClick={() => registrarConfirmado(false)} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: '#10b981', border: 'none', borderRadius: 9, padding: '8px 18px', cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontFamily: "'Bebas Neue'", letterSpacing: '.12em' }}>
                                    <IconCash /> {saving ? 'REGISTRANDO...' : 'CONFIRMAR PAGO'}
                                </button>
                            </div>
                        </div>
                    );
                })()}
            </div>
        </div>
    );
}
