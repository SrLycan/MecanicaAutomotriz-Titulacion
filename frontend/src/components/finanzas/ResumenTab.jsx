/**
 * SS SWAP - Finanzas · Resumen
 * "¿Cuanto dinero tiene el taller?": disponible por cuenta, ingresos y
 * egresos del periodo, lo que le deben, lo que debe, y patrimonio estimado.
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../services/api';
import { Kpi, Badge, Monto } from './Modales';
import { dinero, nombreMes, fechaCorta, hoyLocal, ORIGEN_LABEL, VERDE, ROJO, AMBAR, VIOLETA } from './tema';

function rangoPeriodo(id) {
    const hoy = hoyLocal();
    const [y, m] = hoy.split('-').map(Number);
    const pad = (n) => String(n).padStart(2, '0');
    if (id === 'mes') return { desde: `${y}-${pad(m)}-01`, hasta: hoy };
    if (id === 'mes_anterior') {
        const py = m === 1 ? y - 1 : y, pm = m === 1 ? 12 : m - 1;
        const fin = new Date(py, pm, 0).getDate();
        return { desde: `${py}-${pad(pm)}-01`, hasta: `${py}-${pad(pm)}-${pad(fin)}` };
    }
    if (id === 'anio') return { desde: `${y}-01-01`, hasta: hoy };
    return null;
}
const PERIODOS = [{ id: 'mes', label: 'Este mes' }, { id: 'mes_anterior', label: 'Mes anterior' }, { id: 'anio', label: 'Este año' }];

export default function ResumenTab({ theme, version, onAccion, irA }) {
    const { txt, txtSf, mut, bdr, card, cardSh, SKY, SKY_DEEP, SKY_PALE, btnPrim, btnSec } = theme;
    const [periodo, setPeriodo] = useState('mes');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const r = rangoPeriodo(periodo);
            const { data } = await api.get(`/finanzas/resumen?desde=${r.desde}&hasta=${r.hasta}`);
            setData(data);
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cargar el resumen financiero.'); }
        finally { setLoading(false); }
    }, [periodo]);

    useEffect(() => { cargar(); }, [cargar, version]);

    if (loading && !data) return <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Calculando finanzas...</p>;
    if (!data) return null;

    const ingresosCat = data.categorias.filter(c => c.tipo === 'ingreso');
    const egresosCat = data.categorias.filter(c => c.tipo === 'egreso');
    const maxCat = Math.max(1, ...data.categorias.map(c => c.total));
    const r = data.periodo;
    const seccion = { background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: 18 };
    const tituloSec = { fontFamily: "'Bebas Neue'", fontSize: '.75rem', letterSpacing: '.18em', color: SKY_DEEP, marginBottom: 12 };

    const barras = (lista) => lista.length === 0
        ? <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut }}>Sin movimientos en este período.</p>
        : lista.map(c => (
            <div key={c.tipo + c.categoria} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Outfit'", fontSize: '.8rem', marginBottom: 4 }}>
                    <span style={{ color: txtSf }}>{c.nombre} <span style={{ color: mut }}>· {c.cantidad}</span></span>
                    <strong style={{ color: txt }}>{dinero(c.total)}</strong>
                </div>
                <div style={{ height: 7, borderRadius: 99, background: SKY_PALE, overflow: 'hidden' }}>
                    <div style={{ width: `${(c.total / maxCat) * 100}%`, height: '100%', background: c.color, borderRadius: 99 }} />
                </div>
            </div>
        ));

    return (
        <div>
            {/* Acciones rapidas + periodo */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button style={{ ...btnPrim, background: `linear-gradient(135deg, #059669, ${VERDE})` }} onClick={() => onAccion('ingreso')}>+ INGRESO</button>
                    <button style={{ ...btnPrim, background: `linear-gradient(135deg, #dc2626, ${ROJO})` }} onClick={() => onAccion('egreso')}>− EGRESO</button>
                    <button style={btnSec} onClick={() => onAccion('transferencia')}>⇄ TRANSFERIR</button>
                    <button style={btnSec} onClick={() => onAccion('pago_empleado')}>PAGAR EMPLEADO</button>
                </div>
                <div style={{ display: 'flex', gap: 6, background: card, border: `1px solid ${bdr}`, borderRadius: 11, padding: 4 }}>
                    {PERIODOS.map(p => (
                        <button key={p.id} onClick={() => setPeriodo(p.id)}
                            style={{ fontFamily: "'Bebas Neue'", fontSize: '.68rem', letterSpacing: '.1em', padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: periodo === p.id ? `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})` : 'transparent', color: periodo === p.id ? '#fff' : mut }}>
                            {p.label.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Dinero disponible */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginBottom: 12 }}>
                <Kpi theme={theme} grande label="DINERO DISPONIBLE HOY" value={dinero(data.disponible)} color={SKY_DEEP}
                    hint={data.cuentas.filter(c => c.activa).map(c => `${c.nombre}: ${dinero(c.saldo)}`).join(' · ')} />
                <Kpi theme={theme} grande label="PATRIMONIO ESTIMADO" value={dinero(data.patrimonio)} color={VIOLETA}
                    hint="Disponible + por cobrar + inventario − deudas" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 22 }}>
                <Kpi theme={theme} label={`INGRESOS · ${fechaCorta(r.desde)} - ${fechaCorta(r.hasta)}`} value={dinero(r.ingresos)} color={VERDE} />
                <Kpi theme={theme} label="EGRESOS DEL PERIODO" value={dinero(r.egresos)} color={ROJO} />
                <Kpi theme={theme} label="RESULTADO" value={dinero(r.resultado)} color={r.resultado >= 0 ? VERDE : ROJO} hint={r.resultado >= 0 ? 'Entró más de lo que salió' : 'Salió más de lo que entró'} />
                <Kpi theme={theme} label="POR COBRAR A CLIENTES" value={dinero(data.por_cobrar.total)} color={AMBAR}
                    hint={`${data.por_cobrar.clientes} cliente(s)${data.por_cobrar.vencido > 0 ? ` · vencido ${dinero(data.por_cobrar.vencido)}` : ''}`} />
                <Kpi theme={theme} label="POR PAGAR (PROVEEDORES)" value={dinero(data.por_pagar.total)} color="#f97316"
                    hint={`Compras ${dinero(data.por_pagar.proveedores)} · gastos pend. ${dinero(data.por_pagar.gastos_pendientes)}`} />
                <Kpi theme={theme} label="NOMINA PENDIENTE DEL MES" value={dinero(data.nomina.pendiente_mes)} color="#eab308"
                    hint={`Sueldos ${dinero(data.nomina.sueldos_mes)} · ${data.nomina.empleados} en nómina`} />
                <Kpi theme={theme} label="INVENTARIO (A COSTO)" value={dinero(data.inventario.costo)} color="#14b8a6"
                    hint={`A precio de venta ${dinero(data.inventario.venta)}`} />
            </div>

            {/* Grafico 12 meses */}
            <div style={{ ...seccion, marginBottom: 18 }}>
                <p style={tituloSec}>INGRESOS VS EGRESOS · ÚLTIMOS 12 MESES</p>
                <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.serie.map(s => ({ ...s, etiqueta: nombreMes(s.mes).slice(0, 3) + ' ' + s.mes.slice(2, 4) }))} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={bdr} vertical={false} />
                            <XAxis dataKey="etiqueta" tick={{ fontFamily: 'Outfit', fontSize: 10, fill: mut }} />
                            <YAxis tick={{ fontFamily: 'Outfit', fontSize: 11, fill: mut }} width={60} />
                            <Tooltip formatter={(v) => dinero(v)} contentStyle={{ background: theme.boxBg, border: `1px solid ${bdr}`, borderRadius: 10, fontFamily: 'Outfit', fontSize: 12, color: txt }} />
                            <Legend wrapperStyle={{ fontFamily: 'Outfit', fontSize: 12 }} />
                            <Bar dataKey="ingresos" name="Ingresos" fill={VERDE} radius={[4, 4, 0, 0]} />
                            <Bar dataKey="egresos" name="Egresos" fill={ROJO} radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* De donde viene y a donde va */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 18 }}>
                <div style={seccion}><p style={tituloSec}>¿DE DÓNDE ENTRA EL DINERO?</p>{barras(ingresosCat)}</div>
                <div style={seccion}><p style={tituloSec}>¿EN QUÉ SE VA EL DINERO?</p>{barras(egresosCat)}</div>
            </div>

            {/* Ultimos movimientos */}
            <div style={seccion}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <p style={{ ...tituloSec, marginBottom: 0 }}>ÚLTIMOS MOVIMIENTOS</p>
                    <button onClick={() => irA('movimientos')} style={{ background: 'none', border: 'none', color: SKY_DEEP, cursor: 'pointer', fontFamily: "'Outfit'", fontSize: '.8rem', fontWeight: 600 }}>Ver todos →</button>
                </div>
                {data.ultimos.length === 0 ? (
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut }}>Todavía no hay movimientos de dinero.</p>
                ) : data.ultimos.map(m => (
                    <div key={m.origen + m.origen_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: `1px solid ${bdr}`, flexWrap: 'wrap' }}>
                        <div style={{ minWidth: 0 }}>
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: txt, margin: 0 }}>{m.descripcion}</p>
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut, margin: '3px 0 0' }}>
                                {fechaCorta(m.fecha)} · {m.cuenta_nombre || '—'}{m.tercero ? ` · ${m.tercero}` : ''}
                            </p>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Badge color={m.color}>{ORIGEN_LABEL[m.origen] || m.origen}</Badge>
                            <Monto tipo={m.tipo} monto={m.monto} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
