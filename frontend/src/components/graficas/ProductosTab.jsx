/**
 * SS SWAP - Pestaña "Productos más vendidos" (seccion Graficas)
 * Fuente: movimientos_inventario (salidas no devueltas). Sprint 14: si la
 * salida viene de una proforma se usa el PRECIO HISTORICO cobrado en ella;
 * las salidas manuales siguen valorizadas con el precio de catalogo actual.
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../../services/api';

const PERIODOS = [{ id: 'semana', label: 'Semanal' }, { id: 'mes', label: 'Mensual' }, { id: 'anio', label: 'Anual' }];

export default function ProductosTab({ theme }) {
    const { txt, txtSf, mut, bdr, card, cardSh, SKY, SKY_DEEP, SKY_PALE } = theme;
    const [periodo, setPeriodo] = useState('mes');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/estadisticas/productos-mas-vendidos?periodo=${periodo}&limit=10`);
            setData(data);
        } catch (err) { toast.error('Error al cargar productos mas vendidos.'); }
        finally { setLoading(false); }
    }, [periodo]);

    useEffect(() => { cargar(); }, [cargar]);

    const chartData = (data?.productos || []).map(p => ({ nombre: p.codigo, cantidad: p.cantidad_vendida, nombreCompleto: p.nombre }));

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut }}>
                    Ranking por cantidad (salidas de inventario). Valor: precio cobrado en la proforma para salidas por proforma; precio de catálogo actual para salidas manuales.
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
            ) : !data || data.productos.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>No existen datos suficientes para este período</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginTop: 4 }}>Registra salidas de inventario para ver este ranking.</p>
                </div>
            ) : (
                <>
                    <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: '20px 12px 8px', marginBottom: 20, height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={bdr} />
                                <XAxis dataKey="nombre" tick={{ fontFamily: 'Outfit', fontSize: 11, fill: mut }} />
                                <YAxis tick={{ fontFamily: 'Outfit', fontSize: 11, fill: mut }} />
                                <Tooltip
                                    contentStyle={{ background: card, border: `1px solid ${bdr}`, borderRadius: 10, fontFamily: 'Outfit', fontSize: 12 }}
                                    formatter={(value, _n, p) => [`${value} unidades`, p.payload.nombreCompleto]}
                                />
                                <Bar dataKey="cantidad" fill={SKY_DEEP} radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh, overflowX: 'auto' }}>
                        <table className="graf-table">
                            <thead>
                                <tr style={{ background: SKY_PALE }}>
                                    {['#', 'Producto', 'Cantidad', 'Por proforma', 'Ingresos', '% Participación'].map(h => (
                                        <th key={h} style={{ color: SKY_DEEP }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.productos.map((p, i) => (
                                    <tr key={p.id} style={{ borderColor: bdr }}>
                                        <td style={{ color: mut }}>{i + 1}</td>
                                        <td style={{ color: txt, fontWeight: 600 }}>{p.nombre} <span style={{ color: mut, fontWeight: 400 }}>({p.codigo})</span></td>
                                        <td style={{ color: txtSf }}>{p.cantidad_vendida}</td>
                                        <td style={{ color: txtSf }}>{p.cantidad_por_proforma || 0}</td>
                                        <td style={{ color: txtSf }}>${p.ingresos_estimados.toFixed(2)}</td>
                                        <td style={{ color: txtSf }}>{p.porcentaje}%</td>
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
