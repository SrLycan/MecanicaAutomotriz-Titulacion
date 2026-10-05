/**
 * SS SWAP - Pestaña "Servicios más solicitados" (seccion Graficas)
 * Fuente: citas (unica tabla que vincula un servicio con una fecha).
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../services/api';

const PERIODOS = [{ id: 'semana', label: 'Semanal' }, { id: 'mes', label: 'Mensual' }, { id: 'anio', label: 'Anual' }];
const COLORES = ['#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc', '#8b5cf6', '#a78bfa', '#f59e0b', '#fbbf24', '#10b981', '#34d399'];

export default function ServiciosTab({ theme }) {
    const { txt, txtSf, mut, bdr, card, cardSh, SKY, SKY_DEEP, SKY_PALE } = theme;
    const [periodo, setPeriodo] = useState('mes');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/estadisticas/servicios-mas-solicitados?periodo=${periodo}&limit=10`);
            setData(data);
        } catch (err) { toast.error('Error al cargar servicios mas solicitados.'); }
        finally { setLoading(false); }
    }, [periodo]);

    useEffect(() => { cargar(); }, [cargar]);

    const chartData = (data?.servicios || []).map(s => ({ name: s.nombre, value: s.veces_solicitado }));

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut }}>
                    Ranking por número de citas (excluye canceladas). Ingresos estimados con precio base de catálogo.
                </p>
                <div style={{ display: 'flex', gap: 6, background: card, border: `1px solid ${bdr}`, borderRadius: 11, padding: 4 }}>
                    {PERIODOS.map(p => (
                        <button key={p.id} className="graf-periodo-btn" onClick={() => setPeriodo(p.id)}
                            style={{ background: periodo === p.id ? `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})` : 'transparent', color: periodo === p.id ? '#fff' : mut }}>
                            {p.label.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando...</p>
            ) : !data || data.servicios.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>No existen datos suficientes para este período</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginTop: 4 }}>Agenda citas con un servicio asignado para ver este ranking.</p>
                </div>
            ) : (
                <>
                    <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: '16px 12px', marginBottom: 20, height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={100} paddingAngle={2}>
                                    {chartData.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: card, border: `1px solid ${bdr}`, borderRadius: 10, fontFamily: 'Outfit', fontSize: 12 }}
                                    formatter={(value) => [`${value} solicitudes`, '']}
                                />
                                <Legend wrapperStyle={{ fontFamily: 'Outfit', fontSize: 12, color: mut }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh, overflowX: 'auto' }}>
                        <table className="graf-table">
                            <thead>
                                <tr style={{ background: SKY_PALE }}>
                                    {['#', 'Servicio', 'Veces solicitado', 'Ingresos (estimado)', '% Participación'].map(h => (
                                        <th key={h} style={{ color: SKY_DEEP }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.servicios.map((s, i) => (
                                    <tr key={s.id} style={{ borderColor: bdr }}>
                                        <td style={{ color: mut }}>{i + 1}</td>
                                        <td style={{ color: txt, fontWeight: 600 }}>{s.nombre}</td>
                                        <td style={{ color: txtSf }}>{s.veces_solicitado}</td>
                                        <td style={{ color: txtSf }}>${s.ingresos_estimados.toFixed(2)}</td>
                                        <td style={{ color: txtSf }}>{s.porcentaje}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
}
