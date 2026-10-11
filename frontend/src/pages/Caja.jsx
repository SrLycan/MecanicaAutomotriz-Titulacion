/**
 * SS SWAP - Caja diaria (administrador y recepcion)
 * Abrir caja con el efectivo contado, ver en vivo todo el efectivo que entra
 * y sale (cobros a clientes, gastos, sueldos en efectivo, ingresos/egresos
 * de caja) y cerrar con el conteo real. La diferencia queda registrada
 * como ajuste para que la caja siempre coincida con lo contado.
 * Al abrir y al cerrar se cuentan billetes y monedas (ConteoEfectivo); el
 * cierre muestra el "reporte de cuadre" con lo que entro y salio del dia.
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTemaPanel, dinero, VERDE, ROJO, AMBAR, ORIGEN_LABEL } from '../components/finanzas/tema';
import { Kpi, Badge, Monto, Modal } from '../components/finanzas/Modales';
import ConteoEfectivo, { totalConteo, conteoParaBackend, conteoVacio } from '../components/finanzas/ConteoEfectivo';
import './Proveedores.css';
import { useAuth } from '../context/AuthContext';

const OTROS_METODOS = [
    { id: 'transferencia', label: 'Transferencia' },
    { id: 'tarjeta', label: 'Tarjeta' },
    { id: 'cheque', label: 'Cheques' },
    { id: 'otro', label: 'Otros' },
];

const hora = (iso) => new Date(iso).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
const fechaHora = (iso) => iso ? new Date(iso).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

function ColorDif({ valor }) {
    const v = Number(valor) || 0;
    if (Math.abs(v) < 0.005) return <Badge color={VERDE}>CUADRA</Badge>;
    return <strong style={{ color: v > 0 ? AMBAR : ROJO }}>{v > 0 ? 'Sobra ' : 'Falta '}{dinero(Math.abs(v))}</strong>;
}

export default function Caja() {
    const theme = useTemaPanel();
    const { txt, txtSf, mut, bdr, card, cardSh, inputSt, labelSt, SKY_DEEP, SKY_PALE, btnPrim, btnSec } = theme;
    const { puede } = useAuth();
    const puedeMovimientos = puede('caja', 'crear');
    const puedeAbrirCerrar = puede('caja', 'aprobar');
    const [estado, setEstado] = useState(null);
    const [historial, setHistorial] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // 'ingreso' | 'egreso' | 'cierre'
    const [apertura, setApertura] = useState({ monto: '', notas: '' });
    const [conteoApertura, setConteoApertura] = useState({});
    const [guardando, setGuardando] = useState(false);

    const cargar = useCallback(async () => {
        try {
            const [act, his] = await Promise.all([api.get('/caja/actual'), api.get('/caja/historial?limit=30')]);
            setEstado(act.data);
            setHistorial(his.data.sesiones || []);
            if (!act.data.sesion) setApertura(a => ({ ...a, monto: a.monto === '' ? String(act.data.saldo_caja ?? 0) : a.monto }));
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cargar la caja.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    // Refresco periodico: los cobros en efectivo de otros modulos aparecen solos.
    useEffect(() => {
        if (!estado?.sesion) return undefined;
        const t = setInterval(cargar, 30000);
        return () => clearInterval(t);
    }, [estado?.sesion, cargar]);

    const abrir = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            const contado = !conteoVacio(conteoApertura);
            const { data } = await api.post('/caja/apertura', {
                monto_apertura: contado ? totalConteo(conteoApertura) : apertura.monto,
                denominaciones: contado ? conteoParaBackend(conteoApertura) : undefined,
                notas_apertura: apertura.notas,
            });
            toast.success(data.ajuste ? 'Caja abierta. Se registró el ajuste por la diferencia de conteo.' : 'Caja abierta.');
            setApertura({ monto: '', notas: '' });
            setConteoApertura({});
            cargar();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo abrir la caja.'); }
        finally { setGuardando(false); }
    };

    if (loading) return <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando caja...</p>;

    const sesion = estado?.sesion;
    const saldoSistema = Number(estado?.saldo_caja || 0);
    const aperturaContada = !conteoVacio(conteoApertura);
    const montoApertura = aperturaContada ? totalConteo(conteoApertura) : (Number(apertura.monto) || 0);
    const difApertura = montoApertura - saldoSistema;
    const seccion = { background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: 20 };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1300, '--prov-bdr': bdr, '--prov-mut': mut, '--prov-sky': SKY_DEEP }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
                <div>
                    <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>SS SWAP · FINANZAS · CAJA</span></div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Caja diaria</h1>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, marginTop: 6 }}>
                        {estado?.caja ? `${estado.caja.nombre} · ` : ''}Efectivo del taller: apertura, movimientos y cierre con conteo.
                    </p>
                </div>
                {sesion && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {puedeMovimientos && <button style={{ ...btnPrim, background: `linear-gradient(135deg, #059669, ${VERDE})` }} onClick={() => setModal('ingreso')}>+ ENTRADA</button>}
                        {puedeMovimientos && <button style={{ ...btnPrim, background: `linear-gradient(135deg, #dc2626, ${ROJO})` }} onClick={() => setModal('egreso')}>− SALIDA</button>}
                        {puedeAbrirCerrar && <button style={btnSec} onClick={() => setModal('cierre')}>CERRAR CAJA</button>}
                    </div>
                )}
            </div>

            {!estado?.caja && (
                <p style={{ ...seccion, color: ROJO, fontFamily: "'Outfit'", marginBottom: 18 }}>
                    No hay una cuenta de caja predeterminada. Un administrador debe crearla en Finanzas › Cuentas.
                </p>
            )}

            {!sesion ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 24, alignItems: 'start' }}>
                    <div style={seccion}>
                        <Badge color={mut}>CAJA CERRADA</Badge>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: txtSf, marginTop: 14 }}>Según el sistema, en caja debería haber:</p>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', color: txt, lineHeight: 1.1 }}>{dinero(saldoSistema)}</p>
                    </div>
                    <form onSubmit={abrir} style={{ ...seccion, display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.3rem', letterSpacing: '.04em', color: txt }}>Abrir caja</p>
                        <div>
                            <label style={labelSt}>¿CON CUÁNTO SE ABRE? — CUENTA LOS BILLETES Y MONEDAS</label>
                            <ConteoEfectivo theme={theme} conteo={conteoApertura} onChange={setConteoApertura} />
                        </div>
                        <div>
                            <label style={labelSt}>MONTO DE APERTURA *</label>
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
                            ? <button type="submit" disabled={guardando || !estado?.caja} style={{ ...btnPrim, justifyContent: 'center', opacity: guardando ? .6 : 1 }}>{guardando ? 'ABRIENDO...' : 'ABRIR CAJA'}</button>
                            : <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>No tienes permiso para abrir la caja.</p>}
                    </form>
                </div>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
                        <Kpi theme={theme} label="APERTURA" value={dinero(sesion.monto_apertura)} color={SKY_DEEP} hint={`${fechaHora(sesion.fecha_apertura)} · ${sesion.usuario_apertura_nombre}`} />
                        <Kpi theme={theme} label="ENTRADAS DE EFECTIVO" value={dinero(estado.totales.ingresos)} color={VERDE} />
                        <Kpi theme={theme} label="SALIDAS DE EFECTIVO" value={dinero(estado.totales.egresos)} color={ROJO} />
                        <Kpi theme={theme} grande label="DEBERÍA HABER EN CAJA" value={dinero(estado.totales.saldo)} color={AMBAR} />
                    </div>
                    {OTROS_METODOS.some(m => estado.por_metodo?.[m.id]) && (
                        <div style={{ ...seccion, padding: '12px 18px', marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: '6px 22px', alignItems: 'center', fontFamily: "'Outfit'", fontSize: '.84rem', color: txtSf }}>
                            <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.16em', color: SKY_DEEP }}>OTROS MEDIOS HOY (NO ENTRAN A CAJA)</span>
                            {OTROS_METODOS.filter(m => estado.por_metodo?.[m.id]).map(m => (
                                <span key={m.id}>{m.label}: <strong style={{ color: VERDE }}>+{dinero(estado.por_metodo[m.id].ingresos)}</strong>
                                    {estado.por_metodo[m.id].egresos > 0 && <strong style={{ color: ROJO }}> −{dinero(estado.por_metodo[m.id].egresos)}</strong>}</span>
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
                                    <thead><tr style={{ background: SKY_PALE }}>{['Hora', 'Detalle', 'Tipo', 'Monto'].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h}</th>)}</tr></thead>
                                    <tbody>
                                        {estado.movimientos.map(m => (
                                            <tr key={m.origen + m.origen_id}>
                                                <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{hora(m.momento)}</td>
                                                <td style={{ color: txt }}>{m.descripcion}{m.tercero && <div style={{ fontSize: '.72rem', color: mut }}>{m.tercero}</div>}</td>
                                                <td style={{ color: mut, fontSize: '.8rem' }}>{m.categoria_nombre}<div style={{ fontSize: '.7rem' }}>{ORIGEN_LABEL[m.origen]}</div></td>
                                                <td><Monto tipo={m.tipo} monto={m.monto} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Historial */}
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.8rem', letterSpacing: '.18em', color: SKY_DEEP, marginBottom: 10 }}>CIERRES ANTERIORES</p>
            {historial.length === 0 ? (
                <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut }}>Aún no hay cierres de caja.</p>
            ) : (
                <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                    <table className="prov-table">
                        <thead><tr style={{ background: SKY_PALE }}>{['Apertura', 'Cierre', 'Inicial', 'Esperado', 'Contado', 'Diferencia', 'Responsables'].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h}</th>)}</tr></thead>
                        <tbody>
                            {historial.map(s => (
                                <tr key={s.id}>
                                    <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fechaHora(s.fecha_apertura)}</td>
                                    <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fechaHora(s.fecha_cierre)}</td>
                                    <td style={{ color: txtSf }}>{dinero(s.monto_apertura)}</td>
                                    <td style={{ color: txtSf }}>{dinero(s.monto_cierre_esperado)}</td>
                                    <td style={{ color: txt, fontWeight: 600 }}>{dinero(s.monto_cierre_real)}</td>
                                    <td><ColorDif valor={s.diferencia} /></td>
                                    <td style={{ color: mut, fontSize: '.78rem' }}>{s.usuario_apertura_nombre}{s.usuario_cierre_nombre && s.usuario_cierre_nombre !== s.usuario_apertura_nombre ? ` → ${s.usuario_cierre_nombre}` : ''}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {(modal === 'ingreso' || modal === 'egreso') && <ModalMovCaja theme={theme} tipo={modal} onClose={() => setModal(null)} onGuardado={cargar} />}
            {modal === 'cierre' && <ModalCierre theme={theme} estado={estado} onClose={() => setModal(null)} onGuardado={cargar} />}
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

function ModalCierre({ theme, estado, onClose, onGuardado }) {
    const { labelSt, inputSt, mut, bdr, txt, txtSf, btnPrim, SKY_PALE, SKY_DEEP } = theme;
    const { sesion, totales, por_metodo: porMetodo = {} } = estado;
    const esperado = Number(totales.saldo) || 0;
    const [conteo, setConteo] = useState({});
    const [notas, setNotas] = useState('');
    const [saving, setSaving] = useState(false);
    const contado = totalConteo(conteo);
    const vacio = conteoVacio(conteo);
    const dif = Math.round((contado - esperado) * 100) / 100;

    const submit = async (e) => {
        e.preventDefault();
        if (vacio && !window.confirm('No contaste ningún billete ni moneda. ¿Cerrar la caja con $0.00 en efectivo?')) return;
        setSaving(true);
        try {
            await api.post('/caja/cierre', { monto_cierre_real: contado, denominaciones: conteoParaBackend(conteo), notas_cierre: notas });
            toast.success('Caja cerrada.');
            onGuardado(); onClose();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo cerrar la caja.'); }
        finally { setSaving(false); }
    };

    const th = { padding: '10px 14px', fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', color: SKY_DEEP, background: SKY_PALE, textAlign: 'left' };
    const td = { padding: '10px 14px', borderTop: `1px solid ${bdr}`, fontFamily: "'Outfit'", fontSize: '.88rem', color: txtSf };
    const val = { ...td, textAlign: 'right', fontWeight: 600, color: txt, whiteSpace: 'nowrap' };
    const filas = [
        { d: 'Monto apertura (+)', v: Number(sesion.monto_apertura) },
        { d: 'Entradas en efectivo (+)', v: Number(totales.ingresos), color: VERDE },
        { d: 'Salidas en efectivo (−)', v: -Number(totales.egresos), color: ROJO },
    ];

    return (
        <Modal theme={theme} etiqueta="CAJA · REPORTE DE CUADRE" titulo="Cerrar caja" onClose={onClose} ancho={980}>
            <form onSubmit={submit}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, alignItems: 'start' }}>
                    {/* Lo que dice el sistema */}
                    <div style={{ border: `1px solid ${bdr}`, borderRadius: 12, overflow: 'hidden' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead><tr><th style={th}>Descripción</th><th style={{ ...th, textAlign: 'right' }}>Valor</th></tr></thead>
                            <tbody>
                                {filas.map(f => (
                                    <tr key={f.d}><td style={td}>{f.d}</td><td style={{ ...val, color: f.color || txt }}>{dinero(f.v)}</td></tr>
                                ))}
                                <tr>
                                    <td style={{ ...td, fontWeight: 700, color: txt, background: SKY_PALE }}>Debería haber en caja (=)</td>
                                    <td style={{ ...val, background: SKY_PALE, fontFamily: "'Bebas Neue'", fontSize: '1.35rem', color: AMBAR }}>{dinero(esperado)}</td>
                                </tr>
                                <tr><td colSpan={2} style={{ ...td, fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.14em', color: mut, paddingTop: 14 }}>OTROS COBROS DEL DÍA (NO VAN EN CAJA)</td></tr>
                                {OTROS_METODOS.map(m => (
                                    <tr key={m.id}>
                                        <td style={td}>{m.label} (+)</td>
                                        <td style={{ ...val, color: porMetodo[m.id]?.ingresos ? VERDE : mut }}>{dinero(porMetodo[m.id]?.ingresos || 0)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Lo que se cuenta */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <ConteoEfectivo theme={theme} conteo={conteo} onChange={setConteo} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', border: `1px solid ${bdr}`, borderRadius: 12, padding: '12px 14px' }}>
                            <div>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.16em', color: mut }}>TOTAL REPORTADO</p>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2rem', lineHeight: 1, color: vacio ? mut : Math.abs(dif) < 0.005 ? VERDE : ROJO }}>{dinero(contado)}</p>
                            </div>
                            {!vacio && <div style={{ fontFamily: "'Outfit'", fontSize: '.9rem' }}><ColorDif valor={dif} /></div>}
                        </div>
                    </div>
                </div>

                <div style={{ marginTop: 16 }}>
                    <label style={labelSt}>NOTAS</label>
                    <input value={notas} onChange={e => setNotas(e.target.value)} style={inputSt} placeholder={!vacio && Math.abs(dif) >= 0.005 ? 'Explica la diferencia (opcional)' : ''} />
                </div>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: mut, marginTop: 10 }}>
                    Si hay diferencia se registra como ajuste, y el saldo de caja queda igual a lo contado.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 14, marginTop: 10, borderTop: `1px solid ${bdr}` }}>
                    <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                    <button type="submit" disabled={saving} style={{ ...btnPrim, background: `linear-gradient(135deg, #dc2626, ${ROJO})`, opacity: saving ? .6 : 1 }}>{saving ? 'CERRANDO...' : 'CERRAR CAJA'}</button>
                </div>
            </form>
        </Modal>
    );
}
