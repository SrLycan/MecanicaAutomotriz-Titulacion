/**
 * SS SWAP - Pestaña "Proformas" (seccion Graficas)
 *
 * Sprint 14: analisis con datos REALES de las proformas aprobadas o
 * convertidas a orden, usando el PRECIO HISTORICO guardado en cada item
 * (cambiar el precio del catalogo no altera estas estadisticas).
 *  - Valor por grupo: Productos/Repuestos, Servicios, Mano de obra,
 *    Pintura/Carroceria, Insumos.
 *  - Productos utilizados: salidas REALES de inventario confirmadas desde
 *    proformas (cantidad + valor al precio cobrado).
 *  - Servicios vendidos: lineas de servicio / mano de obra / pintura.
 * Fuente: GET /api/estadisticas/proformas
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import api from '../../services/api';

const PERIODOS = [{ id: 'semana', label: 'Semanal' }, { id: 'mes', label: 'Mensual' }, { id: 'anio', label: 'Anual' }];
const money = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtCant = (n) => (Number(n) % 1 === 0 ? String(Number(n)) : Number(n).toFixed(2));

function Kpi({ label, value, sub, theme, color }) {
    const { card, bdr, cardSh, txt, mut } = theme;
    return (
        <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, padding: '14px 16px', boxShadow: cardSh }}>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.18em', color: color || mut }}>{label}</p>
            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', color: txt, lineHeight: 1.1, marginTop: 4 }}>{value}</p>
            {sub && <p style={{ fontFamily: "'Outfit'", fontSize: '.74rem', color: mut, marginTop: 2 }}>{sub}</p>}
        </div>
    );
}

export default function ProformasTab({ theme }) {
    const { txt, txtSf, mut, bdr, card, cardSh, SKY, SKY_DEEP, SKY_PALE } = theme;
    const [periodo, setPeriodo] = useState('mes');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/estadisticas/proformas?periodo=${periodo}&limit=10`);
            setData(data);
        } catch { toast.error('Error al cargar las estadísticas de proformas.'); }
        finally { setLoading(false); }
    }, [periodo]);

    useEffect(() => { cargar(); }, [cargar]);

    const sinDatos = !data || data.resumen.proformas === 0;
    const grupos = (data?.por_grupo || []).map(g => ({ ...g, nombre: g.etiqueta }));

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, maxWidth: 720 }}>
                    Proformas aprobadas o convertidas a orden de trabajo, con el precio histórico de cada ítem. Valores de línea antes de descuento e IVA.
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
            ) : sinDatos ? (
                <div style={{ padding: 60, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>No existen datos suficientes para este período</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginTop: 4 }}>Aprueba o convierte proformas para ver este análisis.</p>
                </div>
            ) : (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 18 }}>
                        <Kpi theme={theme} label="PROFORMAS APROBADAS" value={data.resumen.proformas} sub={`${data.resumen.mecanica} mecánica · ${data.resumen.colisiones} colisiones`} color={SKY_DEEP} />
                        <Kpi theme={theme} label="TOTAL FACTURADO" value={money(data.resumen.total_facturado)} sub={`Con IVA ${money(data.resumen.iva)} · descuentos ${money(data.resumen.descuentos)}`} color={SKY_DEEP} />
                        <Kpi theme={theme} label="TOTAL PRODUCTOS E INSUMOS" value={money(data.resumen.total_productos)} color="#f97316" />
                        <Kpi theme={theme} label="TOTAL SERVICIOS, MANO DE OBRA Y PINTURA" value={money(data.resumen.total_servicios)} color="#10b981" />
                    </div>

                    <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, padding: '18px 14px 8px', marginBottom: 20 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: SKY_DEEP, margin: '0 0 8px 6px' }}>VALOR POR TIPO DE ÍTEM</p>
                        <div style={{ height: 260 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={grupos} layout="vertical" margin={{ top: 4, right: 90, left: 10, bottom: 4 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={bdr} horizontal={false} />
                                    <XAxis type="number" tick={{ fontFamily: 'Outfit', fontSize: 11, fill: mut }} tickFormatter={v => `$${v}`} />
                                    <YAxis type="category" dataKey="nombre" width={150} tick={{ fontFamily: 'Outfit', fontSize: 12, fill: txtSf }} />
                                    <Tooltip contentStyle={{ background: card, border: `1px solid ${bdr}`, borderRadius: 10, fontFamily: 'Outfit', fontSize: 12 }}
                                        formatter={(v, _n, p) => [`${money(v)} · ${p.payload.lineas} línea(s) · ${p.payload.porcentaje}%`, 'Valor']} />
                                    <Bar dataKey="valor" fill={SKY_DEEP} radius={[0, 6, 6, 0]} barSize={22}>
                                        <LabelList dataKey="valor" position="right" formatter={money} style={{ fontFamily: 'Outfit', fontSize: 11, fill: txtSf }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
                        <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh, overflowX: 'auto' }}>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: SKY_DEEP, padding: '14px 16px 6px' }}>PRODUCTOS UTILIZADOS (SALIDAS POR PROFORMA)</p>
                            {data.productos_utilizados.length === 0 ? (
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, padding: '6px 16px 16px' }}>Aún no se ha confirmado el uso de materiales de ninguna proforma en este período.</p>
                            ) : (
                                <table className="graf-table">
                                    <thead><tr style={{ background: SKY_PALE }}>
                                        {['Producto', 'Inventario', 'Cantidad', 'Valor (precio histórico)', 'Proformas'].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {data.productos_utilizados.map(p => (
                                            <tr key={p.id} style={{ borderColor: bdr }}>
                                                <td style={{ color: txt, fontWeight: 600 }}>{p.nombre} <span style={{ color: mut, fontWeight: 400 }}>({p.codigo})</span></td>
                                                <td style={{ color: txtSf }}>{p.area === 'colisiones' ? 'Colisiones / Pintura' : 'Mecánica'}</td>
                                                <td style={{ color: txtSf }}>{fmtCant(p.cantidad)} {p.unidad_medida}</td>
                                                <td style={{ color: txtSf }}>{money(p.valor)}</td>
                                                <td style={{ color: txtSf }}>{p.proformas}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh, overflowX: 'auto' }}>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: SKY_DEEP, padding: '14px 16px 6px' }}>SERVICIOS, MANO DE OBRA Y PINTURA VENDIDOS</p>
                            {data.servicios_vendidos.length === 0 ? (
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, padding: '6px 16px 16px' }}>Sin servicios en este período.</p>
                            ) : (
                                <table className="graf-table">
                                    <thead><tr style={{ background: SKY_PALE }}>
                                        {['Servicio', 'Tipo', 'Veces', 'Valor'].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {data.servicios_vendidos.map((s, i) => (
                                            <tr key={`${s.nombre}-${i}`} style={{ borderColor: bdr }}>
                                                <td style={{ color: txt, fontWeight: 600 }}>{s.nombre}</td>
                                                <td style={{ color: txtSf }}>{s.grupo}</td>
                                                <td style={{ color: txtSf }}>{s.veces}</td>
                                                <td style={{ color: txtSf }}>{money(s.valor)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
