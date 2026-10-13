/**
 * SS SWAP - Pestaña "Crecimiento" (seccion Graficas)
 * Serie temporal de clientes nuevos, vehiculos, ordenes, servicios,
 * ventas (estimadas), gastos y utilidad (estimada).
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import api from '../../services/api';

const PERIODOS = [{ id: 'semana', label: 'Semanal' }, { id: 'mes', label: 'Mensual' }, { id: 'anio', label: 'Anual' }];
const METRICAS = [
    { id: 'clientes_nuevos', label: 'Clientes nuevos', color: '#0284c7' },
    { id: 'vehiculos_nuevos', label: 'Vehículos', color: '#8b5cf6' },
    { id: 'ordenes', label: 'Órdenes', color: '#f59e0b' },
    { id: 'servicios_realizados', label: 'Servicios', color: '#10b981' },
    { id: 'ventas_estimadas', label: 'Ventas ($ est.)', color: '#0ea5e9' },
    { id: 'gastos', label: 'Gastos ($)', color: '#ef4444' },
    { id: 'proformas_aprobadas', label: 'Proformas aprobadas ($)', color: '#f97316' },
];

export default function CrecimientoTab({ theme }) {
    const { txt, mut, bdr, card, cardSh, SKY, SKY_DEEP } = theme;
    const [periodo, setPeriodo] = useState('mes');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activas, setActivas] = useState(['clientes_nuevos', 'ordenes', 'ventas_estimadas']);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/estadisticas/crecimiento?periodo=${periodo}`);
            setData(data);
        } catch (err) { toast.error('Error al cargar el crecimiento.'); }
        finally { setLoading(false); }
    }, [periodo]);

    useEffect(() => { cargar(); }, [cargar]);

    const toggleMetrica = (id) => setActivas(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

    const hayActividad = data?.serie?.some(p => METRICAS.some(m => p[m.id] > 0));

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut }}>
                    Evolución del negocio. "Ventas" y "Utilidad" son estimados (precio de catálogo actual).
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

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
                {METRICAS.map(m => {
                    const on = activas.includes(m.id);
                    return (
                        <button key={m.id} className="graf-metric-chip" onClick={() => toggleMetrica(m.id)}
                            style={{ background: on ? `${m.color}18` : 'transparent', borderColor: on ? `${m.color}55` : bdr, color: on ? m.color : mut }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color, opacity: on ? 1 : .3 }} />
                            {m.label}
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando...</p>
            ) : !data || !hayActividad ? (
                <div style={{ padding: 60, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>No existen datos suficientes para este período</p>
                </div>
            ) : (
                <>
                    <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: '20px 12px 8px', marginBottom: 20, height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data.serie} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={bdr} />
                                <XAxis dataKey="periodo" tick={{ fontFamily: 'Outfit', fontSize: 11, fill: mut }} />
                                <YAxis tick={{ fontFamily: 'Outfit', fontSize: 11, fill: mut }} />
                                <Tooltip contentStyle={{ background: card, border: `1px solid ${bdr}`, borderRadius: 10, fontFamily: 'Outfit', fontSize: 12 }} />
                                <Legend wrapperStyle={{ fontFamily: 'Outfit', fontSize: 12 }} />
                                {METRICAS.filter(m => activas.includes(m.id)).map(m => (
                                    <Line key={m.id} type="monotone" dataKey={m.id} name={m.label} stroke={m.color} strokeWidth={2.2} dot={false} />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                        {[
                            { label: 'CLIENTES NUEVOS', value: data.totales.clientes_nuevos, color: '#0284c7' },
                            { label: 'VEHÍCULOS', value: data.totales.vehiculos_nuevos, color: '#8b5cf6' },
                            { label: 'ÓRDENES', value: data.totales.ordenes, color: '#f59e0b' },
                            { label: 'SERVICIOS', value: data.totales.servicios_realizados, color: '#10b981' },
                            { label: 'VENTAS (EST.)', value: `$${data.totales.ventas_estimadas.toFixed(2)}`, color: '#0ea5e9' },
                            { label: 'GASTOS', value: `$${data.totales.gastos.toFixed(2)}`, color: '#ef4444' },
                            { label: 'PROFORMAS APROBADAS', value: `$${Number(data.totales.proformas_aprobadas || 0).toFixed(2)}`, color: '#f97316' },
                            { label: 'UTILIDAD (EST.)', value: `$${data.totales.utilidad_estimada.toFixed(2)}`, color: data.totales.utilidad_estimada >= 0 ? '#10b981' : '#ef4444' },
                        ].map(k => (
                            <div key={k.label} style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '14px 16px', boxShadow: cardSh }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.14em', color: k.color, marginBottom: 6 }}>{k.label}</p>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.25rem', color: txt, lineHeight: 1 }}>{k.value}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
