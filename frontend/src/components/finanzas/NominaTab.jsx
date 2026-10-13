/**
 * SS SWAP - Finanzas · Nomina
 * Personal del taller con su sueldo mensual, lo pagado en el mes elegido
 * (sueldo + anticipos) y lo que falta. Debajo, el detalle de pagos del mes.
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { Kpi, Badge, ModalPerfilEmpleado, ModalPagoEmpleado, ModalAnular } from './Modales';
import { dinero, fechaCorta, mesActual, nombreMes, ROL_LABEL, TIPOS_PAGO_EMPLEADO, VERDE, ROJO, AMBAR } from './tema';
import { useAuth } from '../../context/AuthContext';

const TIPO_LABEL = Object.fromEntries(TIPOS_PAGO_EMPLEADO.map(t => [t.id, t.label]));

export default function NominaTab({ theme, cuentas, version, onCambio }) {
    const { puede } = useAuth();
    const { txt, txtSf, mut, bdr, card, cardSh, inputSt, labelSt, SKY_DEEP, SKY_PALE, btnPrim } = theme;
    const [mes, setMes] = useState(mesActual());
    const [data, setData] = useState({ empleados: [], totales: { sueldos: 0, pagado: 0, pendiente: 0 } });
    const [pagos, setPagos] = useState([]);
    const [verAnulados, setVerAnulados] = useState(false);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null); // { tipo: 'perfil'|'pago'|'anular', empleado?, pago? }

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const [emp, pag] = await Promise.all([
                api.get(`/finanzas/empleados?periodo=${mes}`),
                api.get(`/finanzas/pagos-empleados?periodo=${mes}&limit=200${verAnulados ? '&anulados=true' : ''}`),
            ]);
            setData(emp.data);
            setPagos(pag.data.pagos || []);
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cargar la nómina.'); }
        finally { setLoading(false); }
    }, [mes, verAnulados]);

    useEffect(() => { cargar(); }, [cargar, version]);

    const sinPerfil = data.empleados.filter(e => !e.tiene_perfil && e.activo).length;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                <div>
                    <label style={labelSt}>MES</label>
                    <input type="month" value={mes} onChange={e => e.target.value && setMes(e.target.value)} style={{ ...inputSt, width: 200, padding: '8px 10px' }} />
                </div>
                {puede('finanzas', 'crear') && <button style={btnPrim} onClick={() => setModal({ tipo: 'pago' })}>+ REGISTRAR PAGO</button>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
                <Kpi theme={theme} label={`SUELDOS · ${nombreMes(mes).toUpperCase()}`} value={dinero(data.totales.sueldos)} color={SKY_DEEP} hint="Suma de sueldos mensuales en nómina" />
                <Kpi theme={theme} label="PAGADO EN EL MES" value={dinero(data.totales.pagado)} color={VERDE} hint="Incluye bonos, comisiones, etc." />
                <Kpi theme={theme} label="FALTA PAGAR" value={dinero(data.totales.pendiente)} color={data.totales.pendiente > 0 ? AMBAR : VERDE} />
            </div>

            {sinPerfil > 0 && (
                <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: AMBAR, background: `${AMBAR}12`, border: `1px solid ${AMBAR}40`, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                    {sinPerfil} persona(s) del personal todavía no tienen sueldo configurado. Usa "Configurar" para incluirlas en la nómina.
                </p>
            )}

            {loading ? (
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando nómina...</p>
            ) : (
                <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh, marginBottom: 24 }}>
                    <table className="prov-table">
                        <thead>
                            <tr style={{ background: SKY_PALE }}>
                                {['Empleado', 'Cargo', 'Sueldo mensual', 'Pagado (sueldo + anticipos)', 'Falta', ''].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {data.empleados.map(e => {
                                const pct = e.sueldo_base > 0 ? Math.min(100, (e.pagado_sueldo / e.sueldo_base) * 100) : 0;
                                return (
                                    <tr key={e.id} style={{ opacity: e.activo ? 1 : .5 }}>
                                        <td style={{ color: txt }}>
                                            {e.nombre}
                                            <div style={{ fontSize: '.72rem', color: mut }}>{ROL_LABEL[e.rol]}{!e.activo && ' · inactivo'}</div>
                                        </td>
                                        <td style={{ color: txtSf }}>{e.cargo || '—'}</td>
                                        <td style={{ color: txt }}>
                                            {e.tiene_perfil ? dinero(e.sueldo_base) : <span style={{ color: mut }}>Sin configurar</span>}
                                            {e.tiene_perfil && !e.en_nomina && <div style={{ fontSize: '.7rem', color: mut }}>fuera de nómina</div>}
                                        </td>
                                        <td style={{ minWidth: 170 }}>
                                            <span style={{ color: txtSf }}>{dinero(e.pagado_sueldo)}</span>
                                            {e.en_nomina && e.sueldo_base > 0 && (
                                                <div style={{ height: 5, borderRadius: 99, background: SKY_PALE, marginTop: 5, overflow: 'hidden' }}>
                                                    <div style={{ width: `${pct}%`, height: '100%', background: pct >= 100 ? VERDE : AMBAR }} />
                                                </div>
                                            )}
                                        </td>
                                        <td>
                                            {!e.en_nomina ? <span style={{ color: mut }}>—</span>
                                                : e.pendiente > 0 ? <strong style={{ color: AMBAR }}>{dinero(e.pendiente)}</strong>
                                                : <Badge color={VERDE}>AL DÍA</Badge>}
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                                {puede('finanzas', 'editar') && <button className="prov-icon-btn" style={{ color: SKY_DEEP, fontFamily: "'Bebas Neue'", fontSize: '.74rem', letterSpacing: '.12em', padding: '5px 9px' }} onClick={() => setModal({ tipo: 'perfil', empleado: e })}>
                                                    {e.tiene_perfil ? 'EDITAR' : 'CONFIGURAR'}
                                                </button>}
                                                {e.activo && (
                                                    puede('finanzas', 'crear') && <button className="prov-icon-btn" style={{ color: VERDE, fontFamily: "'Bebas Neue'", fontSize: '.74rem', letterSpacing: '.12em', padding: '5px 9px' }} onClick={() => setModal({ tipo: 'pago', empleado: e })}>PAGAR</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagos del mes */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.8rem', letterSpacing: '.18em', color: SKY_DEEP }}>PAGOS DE {nombreMes(mes).toUpperCase()}</p>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, cursor: 'pointer' }}>
                    <input type="checkbox" checked={verAnulados} onChange={e => setVerAnulados(e.target.checked)} /> Mostrar anulados
                </label>
            </div>
            {pagos.length === 0 ? (
                <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, padding: '20px 0' }}>No hay pagos registrados para este mes.</p>
            ) : (
                <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                    <table className="prov-table">
                        <thead>
                            <tr style={{ background: SKY_PALE }}>
                                {['Fecha', 'Empleado', 'Concepto', 'Monto', 'Descuentos', 'Neto', 'Cuenta', ''].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {pagos.map(p => {
                                const anulado = Boolean(p.anulado_at);
                                return (
                                    <tr key={p.id} style={{ opacity: anulado ? .55 : 1 }}>
                                        <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fechaCorta(p.fecha)}</td>
                                        <td style={{ color: txt }}>{p.empleado_nombre}</td>
                                        <td style={{ color: txtSf }}>
                                            {TIPO_LABEL[p.tipo] || p.tipo}
                                            {anulado && <div style={{ fontSize: '.7rem', color: ROJO }}>Anulado: {p.motivo_anulacion}</div>}
                                        </td>
                                        <td style={{ color: txtSf }}>{dinero(p.monto_bruto)}</td>
                                        <td style={{ color: Number(p.descuentos) > 0 ? ROJO : mut }}>{Number(p.descuentos) > 0 ? `−${dinero(p.descuentos)}` : '—'}</td>
                                        <td style={{ color: txt, fontWeight: 600, textDecoration: anulado ? 'line-through' : 'none' }}>{dinero(p.monto_neto)}</td>
                                        <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{p.cuenta_nombre}</td>
                                        <td style={{ textAlign: 'right' }}>
                                            {!anulado && (
                                                puede('finanzas', 'eliminar') && <button className="prov-icon-btn" style={{ color: ROJO, fontFamily: "'Bebas Neue'", fontSize: '.74rem', letterSpacing: '.12em', padding: '5px 9px' }} onClick={() => setModal({ tipo: 'anular', pago: p })}>ANULAR</button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {modal?.tipo === 'perfil' && <ModalPerfilEmpleado theme={theme} empleado={modal.empleado} onClose={() => setModal(null)} onGuardado={onCambio} />}
            {modal?.tipo === 'pago' && (
                <ModalPagoEmpleado theme={theme} empleados={data.empleados} empleado={modal.empleado} periodo={mes} cuentas={cuentas}
                    onClose={() => setModal(null)} onGuardado={onCambio} />
            )}
            {modal?.tipo === 'anular' && (
                <ModalAnular theme={theme} titulo="Anular pago" onClose={() => setModal(null)}
                    detalle={`${TIPO_LABEL[modal.pago.tipo]} de ${dinero(modal.pago.monto_neto)} a ${modal.pago.empleado_nombre}. El dinero vuelve a contar en el saldo de "${modal.pago.cuenta_nombre}".`}
                    onConfirmar={async (motivo) => { await api.post(`/finanzas/pagos-empleados/${modal.pago.id}/anular`, { motivo }); toast.success('Pago anulado.'); onCambio(); }} />
            )}
        </div>
    );
}
