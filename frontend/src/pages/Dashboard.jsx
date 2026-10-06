/**
 * SS SWAP - Panel de inicio del personal (Dashboard)
 *
 * Responde de un vistazo "¿que pasa hoy en el taller y que tengo que hacer?":
 *  1. Necesita tu atención: tareas pendientes con enlace directo.
 *  2. Indicadores clave segun el rol (dinero solo para quien corresponde).
 *  3. Gráfica de crecimiento (órdenes, clientes y, para el admin, dinero).
 *  4. Taller hoy: órdenes por etapa, órdenes activas y citas del día.
 *  5. Inventario: stock bajo y últimos movimientos.
 * Todos los datos vienen calculados del servidor en una sola llamada
 * (GET /api/dashboard), adaptados al rol del usuario.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import { ESTADO_PROGRESO_MAP } from '../constants/ordenes';
import { dinero, nombreMes } from '../components/finanzas/tema';
import adminImg from '../assets/admin.png';
import techImg from '../assets/tecnico.png';
import './Dashboard.css';

const ROL_META = {
    administrador: { label: 'Administración', sub: 'Así está tu taller hoy: dinero, trabajo, clientes e inventario' },
    tecnico:       { label: 'Taller',         sub: 'Tus vehículos asignados, el avance del taller y el inventario' },
    recepcionista: { label: 'Recepción',      sub: 'Citas, clientes, órdenes de trabajo, cobros y caja' },
};
const NIVEL = { alta: { color: '#ef4444', label: 'URGENTE' }, media: { color: '#f59e0b', label: 'HOY' }, baja: { color: '#0ea5e9', label: 'PENDIENTE' } };
const ORIGEN_MOV = { proforma: 'Proforma', compra: 'Compra', ajuste: 'Ajuste', devolucion: 'Devolución', manual: 'Manual' };

function IconArrowR() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>; }
function IconClock()  { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>; }

const fmtCant = (n) => (Number(n) % 1 === 0 ? String(Number(n)) : Number(n).toFixed(2));
const hora = (h) => String(h || '').slice(0, 5);

export default function Dashboard() {
    const { usuario } = useAuth();
    const { isDark } = useTheme();
    const [d, setD] = useState(null);
    const [error, setError] = useState(false);
    const [meses, setMeses] = useState(12);

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.05)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.18)';
    const txt   = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf = isDark ? '#cbd5e1' : '#334155';
    const mut   = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr   = isDark ? 'rgba(148,163,184,0.16)' : 'rgba(15,23,42,0.07)';
    const card  = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const boxBg = isDark ? '#0a0f1c' : '#ffffff';
    const cardSh = isDark
        ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)'
        : '0 4px 16px -4px rgba(15,23,42,0.08), 0 2px 4px -2px rgba(15,23,42,0.04)';

    const cargar = useCallback(async () => {
        try { const { data } = await api.get(`/dashboard?meses=${meses}`); setD(data); setError(false); }
        catch { setError(true); }
    }, [meses]);

    useEffect(() => { cargar(); }, [cargar]);
    // Se actualiza solo cada 60 s mientras la pantalla esta abierta.
    useEffect(() => { const t = setInterval(cargar, 60000); return () => clearInterval(t); }, [cargar]);

    const rol = usuario?.rol;
    const esAdmin = rol === 'administrador';
    const esTecnico = rol === 'tecnico';
    const meta = ROL_META[rol] || ROL_META.recepcionista;
    const greet = (() => { const h = new Date().getHours(); return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches'; })();
    const fechaHoy = new Date().toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });

    const seccion = { background: card, border: `1px solid ${bdr}`, borderRadius: 16, boxShadow: cardSh, padding: 20 };
    const Titulo = ({ children, to, label = 'VER TODO' }) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.25rem', letterSpacing: '.05em', color: txt, lineHeight: 1 }}>{children}</h2>
            <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${SKY_BDR}, transparent)` }} />
            {to && <Link to={to} style={{ fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.14em', color: SKY_DEEP, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>{label} <IconArrowR /></Link>}
        </div>
    );
    const Vacio = ({ children }) => <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, padding: '10px 2px' }}>{children}</p>;

    // ── Indicadores por rol ────────────────────────────────────
    const kpis = !d ? [] : [
        esAdmin && { label: 'Dinero disponible', val: dinero(d.finanzas.disponible), color: SKY_DEEP, sub: d.finanzas.cuentas.map(c => `${c.nombre}: ${dinero(c.saldo)}`).join(' · '), to: '/dashboard/finanzas' },
        esAdmin && { label: 'Ingresos del mes', val: dinero(d.finanzas.ingresos_mes), color: '#10b981', sub: d.finanzas.variacion_ingresos !== null ? `${d.finanzas.variacion_ingresos >= 0 ? '▲' : '▼'} ${Math.abs(d.finanzas.variacion_ingresos)}% vs mes anterior · gastos ${dinero(d.finanzas.egresos_mes)}` : `Gastos del mes ${dinero(d.finanzas.egresos_mes)}`, to: '/dashboard/finanzas' },
        d.cartera && { label: 'Por cobrar a clientes', val: dinero(d.cartera.por_cobrar), color: '#f59e0b', sub: d.cartera.vencidas ? `${d.cartera.vencidas} vencido(s) · ${dinero(d.cartera.monto_vencido)}` : `Cobrado este mes ${dinero(d.cartera.cobrado_mes)}`, to: '/dashboard/clientes?tab=pagare' },
        rol === 'recepcionista' && { label: 'Caja', val: d.caja.abierta ? dinero(d.caja.saldo) : 'CERRADA', color: d.caja.abierta ? '#10b981' : '#64748b', sub: d.caja.abierta ? `Abierta por ${d.caja.sesion.usuario_nombre}` : 'Ábrela para registrar el efectivo del día', to: '/dashboard/caja' },
        rol === 'recepcionista' && { label: 'Citas de hoy', val: d.citas.hoy.length, color: '#8b5cf6', sub: d.citas.pendientes_confirmar ? `${d.citas.pendientes_confirmar} por confirmar` : 'Todas confirmadas', to: '/dashboard/citas' },
        esTecnico && { label: 'Mis órdenes activas', val: d.taller.mias_activas, color: SKY_DEEP, sub: 'Asignadas a ti', to: '/dashboard/ordenes' },
        esTecnico && { label: 'Listos para entrega', val: d.taller.listas_entrega, color: '#10b981', sub: 'En todo el taller', to: '/dashboard/ordenes' },
        { label: 'Órdenes activas', val: d.taller.activas, color: '#0ea5e9', sub: `${d.taller.pendientes} pendiente(s) · ${d.taller.en_progreso} en progreso · ${d.taller.entregadas_mes} entregada(s) este mes`, to: '/dashboard/ordenes' },
        esTecnico && { label: 'Stock bajo', val: d.inventario.bajo_stock, color: d.inventario.bajo_stock ? '#ef4444' : '#10b981', sub: d.inventario.agotados ? `${d.inventario.agotados} agotado(s)` : 'Inventario en orden', to: '/dashboard/inventario' },
    ].filter(Boolean).slice(0, 4);

    // ── Grafica de crecimiento ─────────────────────────────────
    const serie = (d?.serie || []).map(s => ({ ...s, etiqueta: `${nombreMes(s.mes).slice(0, 3)} ${s.mes.slice(2, 4)}` }));
    const hayDatosSerie = serie.some(s => s.ordenes || s.clientes_nuevos || s.ingresos || s.egresos || s.proformas);
    const totalesSerie = serie.reduce((t, s) => ({ ordenes: t.ordenes + s.ordenes, clientes: t.clientes + s.clientes_nuevos, ingresos: t.ingresos + s.ingresos, egresos: t.egresos + s.egresos }), { ordenes: 0, clientes: 0, ingresos: 0, egresos: 0 });

    // ── Acciones rapidas por rol ───────────────────────────────
    const acciones = [
        { to: '/dashboard/proformas/nueva', label: 'Nueva proforma', sub: 'Cotizar un trabajo', roles: ['administrador', 'tecnico', 'recepcionista'] },
        { to: '/dashboard/ordenes', label: 'Órdenes de trabajo', sub: 'Avance de los vehículos', roles: ['administrador', 'tecnico', 'recepcionista'] },
        { to: '/dashboard/clientes', label: 'Clientes', sub: 'Registrar o buscar', roles: ['administrador', 'recepcionista'] },
        { to: '/dashboard/caja', label: 'Caja diaria', sub: 'Efectivo del día', roles: ['administrador', 'recepcionista'] },
        { to: '/dashboard/registrar', label: 'Registrar movimiento', sub: 'Entrada / salida de stock', roles: ['administrador', 'tecnico', 'recepcionista'] },
        { to: '/dashboard/finanzas', label: 'Finanzas', sub: '¿Cuánto dinero hay?', roles: ['administrador'] },
    ].filter(a => a.roles.includes(rol));

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1400, '--sky-bdr': SKY_BDR }}>
            {/* ── Saludo ── */}
            <div className="dash-hero-grid" style={{ ...(esAdmin || esTecnico ? {} : { gridTemplateColumns: '1fr' }),
                position: 'relative', marginBottom: 22, overflow: 'hidden', boxShadow: cardSh, borderRadius: 22, padding: '26px 30px', minHeight: 170,
                background: isDark ? 'linear-gradient(135deg, #0a0f1c 0%, #0c2237 50%, #0a0f1c 100%)' : 'linear-gradient(135deg, #ffffff 0%, #f0f9ff 60%, #e0f2fe 100%)',
                border: `1px solid ${SKY_BDR}`,
            }}>
                <div className="hero-orb-1" style={{ position: 'absolute', top: -80, right: -40, width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(14,165,233,0.30), transparent)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                    <div className="ssswap-chip" style={{ marginBottom: 10 }}><span className="dot" /><span>SS SWAP · {meta.label.toUpperCase()}</span></div>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '1rem', color: SKY_DEEP, marginBottom: 2 }}>{greet},</p>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '3rem', letterSpacing: '.02em', color: txt, lineHeight: 1 }}>{usuario?.nombre || 'Usuario'}</h1>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.95rem', color: mut, marginTop: 8, maxWidth: 420 }}>{meta.sub}.</p>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 12, padding: '7px 13px', borderRadius: 999, background: isDark ? 'rgba(14,165,233,0.10)' : 'rgba(255,255,255,0.85)', border: `1px solid ${SKY_BDR}`, color: txtSf }}>
                        <IconClock /><span style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.85rem', textTransform: 'capitalize' }}>{fechaHoy}</span>
                    </div>
                </div>
                {(esAdmin || esTecnico) && (
                    <div className="dash-hero-car" style={{ position: 'relative', zIndex: 1, overflow: 'hidden', borderRadius: 16, minHeight: 170 }}>
                        <img src={esAdmin ? adminImg : techImg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }} />
                    </div>
                )}
            </div>

            {error && !d && (
                <div style={{ ...seccion, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                    <p style={{ fontFamily: "'Outfit'", color: '#ef4444' }}>No se pudo cargar el panel. Revisa que el servidor esté encendido.</p>
                    <button onClick={cargar} style={{ fontFamily: "'Bebas Neue'", letterSpacing: '.12em', border: `1px solid ${bdr}`, background: 'none', color: txt, borderRadius: 10, padding: '8px 14px', cursor: 'pointer' }}>REINTENTAR</button>
                </div>
            )}

            {!d ? (!error && (
                <div className="dash-kpi-grid">{Array(4).fill(0).map((_, i) => <div key={i} className="sk-pulse" style={{ height: 120, background: card, border: `1px solid ${bdr}`, borderRadius: 16 }} />)}</div>
            )) : (<>
                {/* ── 1. Necesita tu atencion ── */}
                <div style={{ ...seccion, marginBottom: 22, borderColor: d.atencion.length ? 'rgba(245,158,11,0.35)' : 'rgba(16,185,129,0.35)' }}>
                    <Titulo>{d.atencion.length ? 'Necesita tu atención' : 'Todo en orden'}</Titulo>
                    {d.atencion.length === 0 ? (
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.9rem', color: '#10b981' }}>✔ No hay tareas pendientes. ¡Buen trabajo!</p>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                            {d.atencion.map((a, i) => (
                                <Link key={i} to={a.link} className="quick-action" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 13px', borderRadius: 12, border: `1px solid ${NIVEL[a.nivel].color}33`, background: `${NIVEL[a.nivel].color}0d`, textDecoration: 'none' }}>
                                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.14em', color: NIVEL[a.nivel].color, border: `1px solid ${NIVEL[a.nivel].color}55`, borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>{NIVEL[a.nivel].label}</span>
                                    <span style={{ flex: 1, fontFamily: "'Outfit'", fontSize: '.86rem', color: txt }}>{a.texto}</span>
                                    <span className="qa-arrow" style={{ color: mut }}><IconArrowR /></span>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── 2. Indicadores ── */}
                <div className="dash-kpi-grid">
                    {kpis.map((k, i) => (
                        <Link key={k.label} to={k.to} className="dash-card" style={{ textDecoration: 'none', background: card, border: `1px solid ${bdr}`, borderRadius: 16, padding: '18px 20px', boxShadow: cardSh, animationDelay: `${i * 60}ms` }}>
                            <div className="glow" style={{ background: `radial-gradient(closest-side, ${k.color}, transparent)` }} />
                            <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: `linear-gradient(180deg, ${k.color}, transparent)` }} />
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.66rem', letterSpacing: '.2em', color: mut, marginBottom: 8 }}>{k.label.toUpperCase()}</p>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.3rem', letterSpacing: '.02em', color: k.color, lineHeight: 1 }}>{k.val}</p>
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.74rem', color: mut, marginTop: 8, lineHeight: 1.4 }}>{k.sub}</p>
                        </Link>
                    ))}
                </div>

                {/* ── 3. Crecimiento + etapas del taller ── */}
                <div className="dash-two-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
                    <div style={seccion}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                            <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.25rem', letterSpacing: '.05em', color: txt }}>Crecimiento del taller</h2>
                            <div style={{ display: 'flex', gap: 4, border: `1px solid ${bdr}`, borderRadius: 10, padding: 3 }}>
                                {[6, 12].map(m => (
                                    <button key={m} onClick={() => setMeses(m)} style={{ fontFamily: "'Bebas Neue'", fontSize: '.66rem', letterSpacing: '.1em', padding: '5px 11px', borderRadius: 7, border: 'none', cursor: 'pointer', background: meses === m ? `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})` : 'transparent', color: meses === m ? '#fff' : mut }}>{m} MESES</button>
                                ))}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginBottom: 8 }}>
                            <span>Órdenes: <strong style={{ color: txt }}>{totalesSerie.ordenes}</strong></span>
                            <span>Clientes nuevos: <strong style={{ color: txt }}>{totalesSerie.clientes}</strong></span>
                            {esAdmin && <span>Ingresos: <strong style={{ color: '#10b981' }}>{dinero(totalesSerie.ingresos)}</strong></span>}
                            {esAdmin && <span>Egresos: <strong style={{ color: '#ef4444' }}>{dinero(totalesSerie.egresos)}</strong></span>}
                        </div>
                        {!hayDatosSerie ? <Vacio>Todavía no hay suficiente actividad para mostrar una tendencia.</Vacio> : (
                            <div style={{ height: 280 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={serie} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke={bdr} vertical={false} />
                                        <XAxis dataKey="etiqueta" tick={{ fontFamily: 'Outfit', fontSize: 10, fill: mut }} />
                                        {esAdmin && <YAxis yAxisId="dinero" tick={{ fontFamily: 'Outfit', fontSize: 10, fill: mut }} width={56} />}
                                        <YAxis yAxisId="cant" orientation={esAdmin ? 'right' : 'left'} allowDecimals={false} tick={{ fontFamily: 'Outfit', fontSize: 10, fill: mut }} width={34} />
                                        <Tooltip formatter={(v, n) => (['Ingresos', 'Egresos'].includes(n) ? dinero(v) : v)}
                                            contentStyle={{ background: boxBg, border: `1px solid ${bdr}`, borderRadius: 10, fontFamily: 'Outfit', fontSize: 12, color: txt }} />
                                        <Legend wrapperStyle={{ fontFamily: 'Outfit', fontSize: 12 }} />
                                        {esAdmin && <Bar yAxisId="dinero" dataKey="ingresos" name="Ingresos" fill="#10b981" radius={[4, 4, 0, 0]} />}
                                        {esAdmin && <Bar yAxisId="dinero" dataKey="egresos" name="Egresos" fill="#ef4444" radius={[4, 4, 0, 0]} />}
                                        <Line yAxisId="cant" type="monotone" dataKey="ordenes" name="Órdenes" stroke={SKY} strokeWidth={2.5} dot={{ r: 3 }} />
                                        <Line yAxisId="cant" type="monotone" dataKey="clientes_nuevos" name="Clientes nuevos" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3 }} />
                                        {!esAdmin && <Line yAxisId="cant" type="monotone" dataKey="proformas" name="Proformas" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    <div style={seccion}>
                        <Titulo to="/dashboard/ordenes">{esTecnico ? 'Mis vehículos por etapa' : 'Taller por etapa'}</Titulo>
                        {d.taller.etapas.every(e => !e.total) ? <Vacio>No hay vehículos en el taller ahora mismo.</Vacio> : (() => {
                            const max = Math.max(1, ...d.taller.etapas.map(e => e.total));
                            return d.taller.etapas.filter(e => e.total || e.etapa !== 'sin_etapa').map(e => {
                                const m = ESTADO_PROGRESO_MAP[e.etapa] || { label: 'Sin etapa asignada', color: '#94a3b8' };
                                return (
                                    <div key={e.etapa} style={{ marginBottom: 10 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: "'Outfit'", fontSize: '.8rem', marginBottom: 4 }}>
                                            <span style={{ color: txtSf }}>{m.label}</span><strong style={{ color: e.total ? txt : mut }}>{e.total}</strong>
                                        </div>
                                        <div style={{ height: 7, borderRadius: 99, background: SKY_PALE, overflow: 'hidden' }}>
                                            <div style={{ width: `${(e.total / max) * 100}%`, height: '100%', background: m.color, borderRadius: 99 }} />
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
                            {[
                                ['Clientes', d.clientes.total, `+${d.clientes.nuevos_mes} este mes`],
                                ['Vehículos', d.clientes.vehiculos, 'registrados'],
                                ['Proformas', d.proformas.por_aprobar, 'por aprobar'],
                                ['Entregados', d.taller.entregadas_mes, 'este mes'],
                            ].map(([l, v, s]) => (
                                <div key={l} style={{ background: SKY_PALE, borderRadius: 10, padding: '9px 11px' }}>
                                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.16em', color: mut }}>{l.toUpperCase()}</p>
                                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', color: txt, lineHeight: 1.1 }}>{v}</p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.68rem', color: mut }}>{s}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── 4. Ordenes activas + citas de hoy ── */}
                <div className="dash-two-grid">
                    <div style={seccion}>
                        <Titulo to="/dashboard/ordenes">{esTecnico ? 'Mis órdenes activas' : 'Órdenes en el taller'}</Titulo>
                        {d.taller.ordenes_activas.length === 0 ? <Vacio>{esTecnico ? 'No tienes órdenes asignadas.' : 'No hay órdenes activas.'}</Vacio> : d.taller.ordenes_activas.map(o => {
                            const et = ESTADO_PROGRESO_MAP[o.estado_progreso];
                            return (
                                <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: `1px solid ${bdr}` }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.88rem', color: txt }}>{o.numero} · {[o.marca, o.modelo].filter(Boolean).join(' ') || 'Vehículo'} {o.placa && <span style={{ color: mut, fontWeight: 400 }}>({o.placa})</span>}</p>
                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.74rem', color: mut }}>{o.cliente_nombre} · {o.tecnico_nombre ? `Técnico: ${o.tecnico_nombre}` : 'Sin técnico asignado'} · desde {String(o.fecha_ingreso).slice(0, 10)}</p>
                                    </div>
                                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.1em', padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap', color: et?.color || mut, border: `1px solid ${(et?.color || '#94a3b8')}55`, background: `${et?.color || '#94a3b8'}14` }}>
                                        {(et?.label || 'Pendiente').toUpperCase()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                    <div style={seccion}>
                        <Titulo to="/dashboard/citas">Citas de hoy</Titulo>
                        {d.citas.hoy.length === 0 ? <Vacio>No hay citas agendadas para hoy.</Vacio> : d.citas.hoy.map(c => (
                            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: `1px solid ${bdr}` }}>
                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: SKY_DEEP, minWidth: 52 }}>{hora(c.hora_inicio)}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.86rem', color: txt }}>{c.cliente_nombre}</p>
                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.74rem', color: mut }}>{c.servicio_nombre}{c.placa ? ` · ${c.placa}` : ''}</p>
                                </div>
                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.12em', color: c.estado === 'confirmada' ? '#10b981' : '#f59e0b' }}>{c.estado.toUpperCase()}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ── 5. Inventario ── */}
                <div className="dash-two-grid">
                    <div style={seccion}>
                        <Titulo to="/dashboard/inventario">Stock bajo</Titulo>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginBottom: 6 }}>
                            {d.inventario.productos} productos · valor {dinero(d.inventario.valor_costo)} a costo ({dinero(d.inventario.valor_venta)} a precio de venta)
                        </p>
                        {d.inventario.lista_bajo_stock.length === 0 ? <Vacio>✔ Ningún producto está por debajo de su stock mínimo.</Vacio> : d.inventario.lista_bajo_stock.map(r => (
                            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${bdr}` }}>
                                <code style={{ fontSize: '.75rem', background: SKY_PALE, padding: '2px 7px', borderRadius: 6, color: SKY_DEEP }}>{r.codigo}</code>
                                <span style={{ flex: 1, fontFamily: "'Outfit'", fontSize: '.86rem', color: txt }}>{r.nombre}</span>
                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', color: r.stock_actual <= 0 ? '#ef4444' : '#f59e0b' }}>{fmtCant(r.stock_actual)}</span>
                                <span style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut }}>/ mín {fmtCant(r.stock_minimo)}</span>
                            </div>
                        ))}
                    </div>
                    <div style={seccion}>
                        <Titulo to="/dashboard/movimientos" label="HISTORIAL">Movimientos de inventario</Titulo>
                        <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginBottom: 6 }}>Hoy: {d.inventario.entradas_hoy} entrada(s) · {d.inventario.salidas_hoy} salida(s)</p>
                        {d.inventario.movimientos_recientes.length === 0 ? <Vacio>Aún no hay movimientos de inventario.</Vacio> : d.inventario.movimientos_recientes.map(m => {
                            const ent = m.tipo === 'entrada';
                            return (
                                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderTop: `1px solid ${bdr}` }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.85rem', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.repuesto_nombre}</p>
                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: mut }}>
                                            {new Date(m.created_at).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · {ORIGEN_MOV[m.origen] || m.origen}
                                            {m.proforma_numero && <> · <Link to={`/dashboard/proformas/${m.proforma_id}`} style={{ color: SKY_DEEP }}>{m.proforma_numero}</Link></>} · {m.usuario_nombre}
                                        </p>
                                    </div>
                                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', color: ent ? '#10b981' : '#ef4444', whiteSpace: 'nowrap' }}>{ent ? '+' : '−'}{fmtCant(m.cantidad)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── 6. Accesos rapidos ── */}
                <Titulo>Accesos rápidos</Titulo>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                    {acciones.map(a => (
                        <Link key={a.to} to={a.to} className="quick-action" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, background: card, border: `1px solid ${bdr}`, textDecoration: 'none' }}>
                            <div style={{ flex: 1 }}>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.9rem', color: txt }}>{a.label}</p>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.76rem', color: mut }}>{a.sub}</p>
                            </div>
                            <span className="qa-arrow" style={{ color: mut }}><IconArrowR /></span>
                        </Link>
                    ))}
                </div>
            </>)}
        </div>
    );
}
