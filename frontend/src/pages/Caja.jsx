/**
 * SS SWAP - Caja diaria (administrador y recepcion)
 * Abrir caja con el efectivo contado, ver en vivo todo el efectivo que entra
 * y sale (cobros a clientes, gastos, sueldos en efectivo, ingresos/egresos
 * de caja) y cerrar con el conteo real. La diferencia queda registrada
 * como ajuste para que la caja siempre coincida con lo contado.
 * Al abrir y al cerrar se cuentan billetes y monedas (ConteoEfectivo); el
 * cierre muestra el "reporte de cuadre" con lo que entro y salio del dia.
 *
 * Sprint 29: pestaña "Control de cajas" (todas las cajas con filtros, Excel,
 * reporte, PDF, imprimir y reabrir), cajero y sucursal al abrir,
 * declaracion por forma de pago al cerrar y anulacion de movimientos
 * manuales (permiso caja:eliminar).
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTemaPanel, dinero, VERDE, ROJO, AMBAR, ORIGEN_LABEL } from '../components/finanzas/tema';
import { Kpi, Badge, Monto, Modal, ModalAnular } from '../components/finanzas/Modales';
import ConteoEfectivo, { totalConteo, conteoParaBackend, conteoVacio } from '../components/finanzas/ConteoEfectivo';
import ModalCierre from '../components/caja/ModalCierre';
import ReporteCaja from '../components/caja/ReporteCaja';
import ControlCajas from '../components/caja/ControlCajas';
import { fechaHora, hora, NOMBRE_FORMA } from '../components/caja/comunes';
import './Proveedores.css';
import { useAuth } from '../context/AuthContext';

import { NombreEmpresa } from '../components/common/MarcaEmpresa';
const OTROS_METODOS = ['transferencia', 'cheque', 'tarjeta_credito', 'tarjeta_debito', 'otro'];

const PESTANAS = [
    { id: 'actual', label: 'CAJA ACTUAL' },
    { id: 'control', label: 'CONTROL DE CAJAS' },
];
const leerPestana = () => { try { return localStorage.getItem('caja.pestana') === 'control' ? 'control' : 'actual'; } catch { return 'actual'; } };

export default function Caja() {
    const theme = useTemaPanel();
    const { txt, txtSf, mut, bdr, card, cardSh, inputSt, labelSt, SKY_DEEP, SKY_PALE, btnPrim, btnSec } = theme;
    const { puede, usuario } = useAuth();
    const puedeMovimientos = puede('caja', 'crear');
    const puedeAbrirCerrar = puede('caja', 'aprobar');
    const puedeAnular = puede('caja', 'eliminar');
    const [pestana, setPestanaEstado] = useState(leerPestana);
    const [estado, setEstado] = useState(null);
    const [opciones, setOpciones] = useState({ cajeros: [], sucursales: [] });
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // 'ingreso' | 'egreso' | 'cierre' | 'reporte'
    const [anulando, setAnulando] = useState(null);
    const [apertura, setApertura] = useState({ monto: '', notas: '', cajero_id: '', sucursal_id: '' });
    const [conteoApertura, setConteoApertura] = useState({});
    const [guardando, setGuardando] = useState(false);
    const [recargaListado, setRecargaListado] = useState(0);

    const setPestana = (p) => { setPestanaEstado(p); try { localStorage.setItem('caja.pestana', p); } catch { /* sin almacenamiento */ } };

    const cargar = useCallback(async () => {
        try {
            const { data } = await api.get('/caja/actual');
            setEstado(data);
            if (!data.sesion) setApertura(a => ({ ...a, monto: a.monto === '' ? String(data.saldo_caja ?? 0) : a.monto }));
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cargar la caja.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);
    useEffect(() => {
        api.get('/caja/opciones').then(({ data }) => {
            setOpciones(data);
            const principal = (data.sucursales || []).find(s => s.es_principal) || (data.sucursales || [])[0];
            setApertura(a => ({
                ...a,
                cajero_id: a.cajero_id || ((data.cajeros || []).some(c => c.id === usuario?.id) ? String(usuario.id) : String(data.cajeros?.[0]?.id || '')),
                sucursal_id: a.sucursal_id || (principal ? String(principal.id) : ''),
            }));
        }).catch(() => {});
    }, [usuario?.id]);

    // Refresco periodico: los cobros en efectivo de otros modulos aparecen solos.
    useEffect(() => {
        if (!estado?.sesion || pestana !== 'actual') return undefined;
        const t = setInterval(cargar, 30000);
        return () => clearInterval(t);
    }, [estado?.sesion, cargar, pestana]);

    const trasCambio = () => { cargar(); setRecargaListado(n => n + 1); };

    const abrir = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            const contado = !conteoVacio(conteoApertura);
            const { data } = await api.post('/caja/apertura', {
                monto_apertura: contado ? totalConteo(conteoApertura) : apertura.monto,
                denominaciones: contado ? conteoParaBackend(conteoApertura) : undefined,
                notas_apertura: apertura.notas,
                cajero_id: apertura.cajero_id ? Number(apertura.cajero_id) : undefined,
                sucursal_id: apertura.sucursal_id ? Number(apertura.sucursal_id) : undefined,
            });
            toast.success(data.ajuste ? 'Caja abierta. Se registró el ajuste por la diferencia de conteo.' : 'Caja abierta.');
            setApertura(a => ({ ...a, monto: '', notas: '' }));
            setConteoApertura({});
            trasCambio();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo abrir la caja.'); }
        finally { setGuardando(false); }
    };

    const anular = async (motivo) => {
        await api.post(`/caja/movimientos/${anulando.origen_id}/anular`, { motivo });
        toast.success('Movimiento anulado.');
        trasCambio();
    };

    if (loading) return <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando caja...</p>;

    const sesion = estado?.sesion;
    const saldoSistema = Number(estado?.saldo_caja || 0);
    const aperturaContada = !conteoVacio(conteoApertura);
    const montoApertura = aperturaContada ? totalConteo(conteoApertura) : (Number(apertura.monto) || 0);
    const difApertura = montoApertura - saldoSistema;
    const seccion = { background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: 20 };
    const otrosHoy = OTROS_METODOS.filter(m => estado?.por_metodo?.[m]?.ingresos || estado?.por_metodo?.[m]?.egresos);

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1300, '--prov-bdr': bdr, '--prov-mut': mut, '--prov-sky': SKY_DEEP }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                    <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span><NombreEmpresa /> · FINANZAS · CAJA</span></div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Caja diaria</h1>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, marginTop: 6 }}>
                        {estado?.caja ? `${estado.caja.nombre} · ` : ''}Efectivo del taller: apertura, movimientos, cierre con conteo y control de todas las cajas.
                    </p>
                </div>
                {sesion && pestana === 'actual' && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {puedeMovimientos && <button style={{ ...btnPrim, background: `linear-gradient(135deg, #059669, ${VERDE})` }} onClick={() => setModal('ingreso')}>+ ENTRADA</button>}
                        {puedeMovimientos && <button style={{ ...btnPrim, background: `linear-gradient(135deg, #dc2626, ${ROJO})` }} onClick={() => setModal('egreso')}>− SALIDA</button>}
                        <button style={btnSec} onClick={() => setModal('reporte')}>VER REPORTE</button>
                        {puedeAbrirCerrar && <button style={btnSec} onClick={() => setModal('cierre')}>CERRAR CAJA</button>}
                    </div>
                )}
            </div>

            <div role="tablist" aria-label="Secciones de caja" style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${bdr}`, marginBottom: 20 }}>
                {PESTANAS.map(p => (
                    <button key={p.id} role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)}
                        style={{ fontFamily: "'Bebas Neue'", fontSize: '.85rem', letterSpacing: '.14em', padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
                            color: pestana === p.id ? SKY_DEEP : mut, borderBottom: `3px solid ${pestana === p.id ? SKY_DEEP : 'transparent'}`, marginBottom: -1 }}>
                        {p.label}{p.id === 'actual' && sesion ? ' · ABIERTA' : ''}
                    </button>
                ))}
            </div>

            {pestana === 'control' ? (
                <ControlCajas theme={theme} recarga={recargaListado} onCambio={cargar} />
            ) : (
                <>
                    {!estado?.caja && (
                        <p style={{ ...seccion, color: ROJO, fontFamily: "'Outfit'", marginBottom: 18 }}>
                            No hay una cuenta de caja predeterminada. Un administrador debe crearla en Finanzas › Cuentas.
                        </p>
                    )}

                    {!sesion ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: 18, marginBottom: 24, alignItems: 'start' }}>
                            <div style={seccion}>
                                <Badge color={mut}>CAJA CERRADA</Badge>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: txtSf, marginTop: 14 }}>Según el sistema, en caja debería haber:</p>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', color: txt, lineHeight: 1.1 }}>{dinero(saldoSistema)}</p>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginTop: 10 }}>
                                    Es lo que quedó al cerrar la última caja, más lo que haya entrado o salido en efectivo desde entonces.
                                </p>
                            </div>
                            <form onSubmit={abrir} style={{ ...seccion, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.3rem', letterSpacing: '.04em', color: txt }}>Apertura de caja</p>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: 12 }}>
                                    <div>
                                        <label style={labelSt}>SUCURSAL</label>
                                        <select value={apertura.sucursal_id} onChange={e => setApertura({ ...apertura, sucursal_id: e.target.value })} style={inputSt}>
                                            <option value="">General</option>
                                            {opciones.sucursales.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={labelSt}>CAJERO *</label>
                                        <select value={apertura.cajero_id} onChange={e => setApertura({ ...apertura, cajero_id: e.target.value })} style={inputSt} required>
                                            {opciones.cajeros.length === 0 && <option value="">(sin cajeros disponibles)</option>}
                                            {opciones.cajeros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label style={labelSt}>¿CON CUÁNTO SE ABRE? — CUENTA LOS BILLETES Y MONEDAS</label>
                                    <ConteoEfectivo theme={theme} conteo={conteoApertura} onChange={setConteoApertura} />
                                </div>
                                <div>
                                    <label style={labelSt}>SALDO INICIAL *</label>
                                    <input type="number" step="0.01" min="0" value={aperturaContada ? montoApertura.toFixed(2) : apertura.monto}
                                        onChange={e => setApertura({ ...apertura, monto: e.target.value })} readOnly={aperturaContada}
                                        style={{ ...inputSt, fontSize: '1.05rem', fontWeight: 600, background: aperturaContada ? SKY_PALE : inputSt.background }} required />
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut, marginTop: 4 }}>
                                        {aperturaContada ? 'Se toma del conteo de billetes y monedas.' : 'Escríbelo a mano o llena el conteo de arriba.'}
                                    </p>
                                </div>
                                {(aperturaContada || apertura.monto !== '') && Math.abs(difApertura) >= 0.005 && (
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: AMBAR }}>
                                        {difApertura > 0 ? 'Sobran' : 'Faltan'} {dinero(Math.abs(difApertura))} respecto al sistema. Se registrará un ajuste de caja.
                                    </p>
                                )}
                                <div>
                                    <label style={labelSt}>NOTAS</label>
                                    <input value={apertura.notas} onChange={e => setApertura({ ...apertura, notas: e.target.value })} style={inputSt} />
                                </div>
                                {puedeAbrirCerrar
                                    ? <button type="submit" disabled={guardando || !estado?.caja} style={{ ...btnPrim, justifyContent: 'center', opacity: guardando ? .6 : 1 }}>{guardando ? 'ABRIENDO...' : 'APERTURA DE CAJA'}</button>
                                    : <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>No tienes permiso para abrir la caja.</p>}
                            </form>
                        </div>
                    ) : (
                        <>
                            <div style={{ ...seccion, padding: '12px 18px', marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: '6px 22px', alignItems: 'center', fontFamily: "'Outfit'", fontSize: '.85rem', color: txtSf }}>
                                <Badge color={VERDE}>CAJA #{sesion.id} ABIERTA</Badge>
                                <span>Cajero: <strong style={{ color: txt }}>{sesion.cajero_nombre}</strong></span>
                                <span>Sucursal: <strong style={{ color: txt }}>{sesion.sucursal_nombre || 'General'}</strong></span>
                                <span>Abierta: {fechaHora(sesion.fecha_apertura)}{sesion.usuario_apertura_nombre !== sesion.cajero_nombre ? ` por ${sesion.usuario_apertura_nombre}` : ''}</span>
                                {Array.isArray(sesion.reaperturas) && sesion.reaperturas.length > 0 && <Badge color={AMBAR}>REABIERTA</Badge>}
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
                                <Kpi theme={theme} label="APERTURA" value={dinero(sesion.monto_apertura)} color={SKY_DEEP} hint={fechaHora(sesion.fecha_apertura)} />
                                <Kpi theme={theme} label="ENTRADAS DE EFECTIVO" value={dinero(estado.totales.ingresos)} color={VERDE} />
                                <Kpi theme={theme} label="SALIDAS DE EFECTIVO" value={dinero(estado.totales.egresos)} color={ROJO} />
                                <Kpi theme={theme} grande label="DEBERÍA HABER EN CAJA" value={dinero(estado.totales.saldo)} color={AMBAR} />
                            </div>
                            {otrosHoy.length > 0 && (
                                <div style={{ ...seccion, padding: '12px 18px', marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: '6px 22px', alignItems: 'center', fontFamily: "'Outfit'", fontSize: '.84rem', color: txtSf }}>
                                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.16em', color: SKY_DEEP }}>OTROS MEDIOS EN ESTA CAJA (NO ENTRAN AL EFECTIVO)</span>
                                    {otrosHoy.map(m => (
                                        <span key={m}>{NOMBRE_FORMA[m]}: <strong style={{ color: VERDE }}>+{dinero(estado.por_metodo[m].ingresos)}</strong>
                                            {estado.por_metodo[m].egresos > 0 && <strong style={{ color: ROJO }}> −{dinero(estado.por_metodo[m].egresos)}</strong>}</span>
                                    ))}
                                </div>
                            )}

                            <div style={{ ...seccion, padding: 0, marginBottom: 24, overflow: 'hidden' }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.18em', color: SKY_DEEP, padding: '16px 18px 6px' }}>MOVIMIENTOS DE EFECTIVO DESDE LA APERTURA</p>
                                {estado.movimientos.length === 0 ? (
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, padding: '6px 18px 18px' }}>
                                        Todavía no hay movimientos. Los cobros, gastos y sueldos pagados en efectivo aparecerán aquí automáticamente.
                                    </p>
                                ) : (
                                    <div className="prov-table-wrap">
                                        <table className="prov-table">
                                            <thead><tr style={{ background: SKY_PALE }}>{['Hora', 'Detalle', 'Tipo', 'Monto', ''].map((h, i) => <th key={i} style={{ color: SKY_DEEP }}>{h}</th>)}</tr></thead>
                                            <tbody>
                                                {estado.movimientos.map(m => (
                                                    <tr key={m.origen + m.origen_id}>
                                                        <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{hora(m.momento)}</td>
                                                        <td style={{ color: txt }}>{m.descripcion}{m.tercero && <div style={{ fontSize: '.72rem', color: mut }}>{m.tercero}</div>}</td>
                                                        <td style={{ color: mut, fontSize: '.8rem' }}>
                                                            <Badge color={m.tipo === 'ingreso' ? VERDE : ROJO}>{m.tipo === 'ingreso' ? 'INGRESO' : 'EGRESO'}</Badge>
                                                            <div style={{ marginTop: 4 }}>{m.categoria_nombre} · {ORIGEN_LABEL[m.origen]}</div>
                                                        </td>
                                                        <td><Monto tipo={m.tipo} monto={m.monto} /></td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            {m.origen === 'caja' && puedeAnular && (
                                                                <button type="button" onClick={() => setAnulando(m)} style={{ fontFamily: "'Bebas Neue'", fontSize: '.66rem', letterSpacing: '.12em', background: 'none', border: `1px solid ${ROJO}55`, color: ROJO, borderRadius: 8, padding: '5px 10px', cursor: 'pointer' }}>ANULAR</button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </>
            )}

            {(modal === 'ingreso' || modal === 'egreso') && <ModalMovCaja theme={theme} tipo={modal} onClose={() => setModal(null)} onGuardado={cargar} />}
            {modal === 'cierre' && <ModalCierre theme={theme} estado={estado} onClose={() => setModal(null)} onGuardado={trasCambio} />}
            {modal === 'reporte' && sesion && <ReporteCaja theme={theme} sesionId={sesion.id} onClose={() => setModal(null)} />}
            {anulando && (
                <ModalAnular theme={theme} titulo="Anular movimiento de caja" onClose={() => setAnulando(null)} onConfirmar={anular}
                    detalle={`${anulando.tipo === 'ingreso' ? 'Entrada' : 'Salida'} de ${dinero(anulando.monto)}: "${anulando.descripcion}". Deja de contar en el efectivo de la caja y queda marcada como anulada en el reporte.`} />
            )}
        </div>
    );
}

function ModalMovCaja({ theme, tipo, onClose, onGuardado }) {
    const { labelSt, inputSt, mut, bdr, btnPrim } = theme;
    const [form, setForm] = useState({ concepto: '', monto: '', referencia: '' });
    const [saving, setSaving] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/caja/movimientos', { ...form, tipo });
            toast.success(tipo === 'ingreso' ? 'Entrada registrada.' : 'Salida registrada.');
            onGuardado(); onClose();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo registrar.'); }
        finally { setSaving(false); }
    };
    return (
        <Modal theme={theme} etiqueta="CAJA" titulo={tipo === 'ingreso' ? 'Entrada de efectivo' : 'Salida de efectivo'} onClose={onClose} ancho={480}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                    <label style={labelSt}>CONCEPTO *</label>
                    <input value={form.concepto} onChange={e => setForm({ ...form, concepto: e.target.value })} style={inputSt} required maxLength={255} autoFocus
                        placeholder={tipo === 'ingreso' ? 'Ej: Cambio / sencillo' : 'Ej: Taxi para traer repuesto'} />
                </div>
                <div>
                    <label style={labelSt}>MONTO *</label>
                    <input type="number" step="0.01" min="0.01" value={form.monto} onChange={e => setForm({ ...form, monto: e.target.value })} style={inputSt} required />
                </div>
                <div>
                    <label style={labelSt}>REFERENCIA</label>
                    <input value={form.referencia} onChange={e => setForm({ ...form, referencia: e.target.value })} style={inputSt} placeholder="N° de recibo (opcional)" />
                </div>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut }}>
                    Para cobrar a un cliente usa Clientes › Pagaré; si el pago es en efectivo aparece aquí solo.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 14, borderTop: `1px solid ${bdr}` }}>
                    <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                    <button type="submit" disabled={saving} style={{ ...btnPrim, opacity: saving ? .6 : 1 }}>{saving ? 'GUARDANDO...' : 'REGISTRAR'}</button>
                </div>
            </form>
        </Modal>
    );
}
