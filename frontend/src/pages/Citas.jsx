import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTheme } from '../context/ThemeContext';

const ESTADOS = { pendiente: '#d97706', confirmada: '#0284c7', completada: '#059669', cancelada: '#dc2626' };
const NOMBRES = { pendiente: 'Pendiente', confirmada: 'Confirmada', completada: 'Completada', cancelada: 'Cancelada' };
const SKY = '#0ea5e9';

export default function Citas() {
    const { isDark } = useTheme();
    const [citas, setCitas] = useState([]);       // SIEMPRE todas (el filtro se aplica del lado del cliente)
    const [estado, setEstado] = useState('pendiente');
    const [orden, setOrden] = useState('fecha_asc');
    const [cargando, setCargando] = useState(true);
    const bg = isDark ? '#0b1220' : '#fff', text = isDark ? '#f1f5f9' : '#0f172a', muted = isDark ? '#94a3b8' : '#64748b', border = isDark ? '#223047' : '#e2e8f0';
    const card2 = isDark ? '#111c2e' : '#f8fafc';

    // Se pide siempre 'todas' al backend: asi las tarjetas de KPI pueden mostrar
    // el conteo real de cada estado sin depender de cual este seleccionado.
    const cargar = () => { setCargando(true); api.get('/citas', { params: { estado: 'todas', orden } }).then(r => setCitas(r.data.citas || [])).catch(() => toast.error('No se pudieron cargar las citas.')).finally(() => setCargando(false)); };
    useEffect(cargar, [orden]);
    useEffect(() => { const id = setInterval(cargar, 30000); return () => clearInterval(id); }, [orden]);

    const cambiar = async (id, nuevo) => { try { await api.patch(`/citas/${id}/estado`, { estado: nuevo }); toast.success(nuevo === 'confirmada' ? 'Cita confirmada. El cliente ya puede verla.' : 'Cita actualizada.'); cargar(); } catch (e) { toast.error(e.response?.data?.error || 'No se pudo actualizar la cita.'); } };

    const stats = useMemo(() => ({
        total:      citas.length,
        pendiente:  citas.filter(c => c.estado === 'pendiente').length,
        confirmada: citas.filter(c => c.estado === 'confirmada').length,
        completada: citas.filter(c => c.estado === 'completada').length,
        cancelada:  citas.filter(c => c.estado === 'cancelada').length,
    }), [citas]);

    const visibles = useMemo(() => estado === 'todas' ? citas : citas.filter(c => c.estado === estado), [citas, estado]);

    const kpis = [
        { val: 'todas',      label: 'Total',       n: stats.total,      color: SKY },
        { val: 'pendiente',  label: 'Pendientes',  n: stats.pendiente,  color: ESTADOS.pendiente },
        { val: 'confirmada', label: 'Confirmadas', n: stats.confirmada, color: ESTADOS.confirmada },
        { val: 'completada', label: 'Completadas', n: stats.completada, color: ESTADOS.completada },
        { val: 'cancelada',  label: 'Canceladas',  n: stats.cancelada,  color: ESTADOS.cancelada },
    ];

    return <div className="appointments-page">
        <div className="appointments-hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', flexWrap: 'wrap', gap: 16, marginBottom: 22, padding: '20px 22px', borderRadius: 18, background: isDark ? 'linear-gradient(135deg, #101b2c, #0b1220)' : 'linear-gradient(135deg, #eff8ff, #fff)', border: `1px solid ${border}` }}>
            <div style={{ position: 'relative', zIndex: 1 }}><p style={{ color: '#3b7bab', fontSize: '.72rem', fontWeight: 800, letterSpacing: '.16em' }}>AGENDA DE SERVICIOS</p><h1 style={{ color: text, margin: '5px 0', fontSize: 'clamp(1.35rem, 4vw, 1.8rem)' }}>Citas y solicitudes</h1><p style={{ color: muted, margin: 0, fontSize: '.86rem' }}>Gestiona la agenda y confirma solicitudes en pocos segundos.</p></div>
            <button className="btn-ghost" onClick={cargar} style={{ position: 'relative', zIndex: 1 }}>↻ Actualizar</button>
        </div>

        {/* KPIs — clic filtra la lista de abajo por ese estado */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
            {kpis.map(k => {
                const activo = estado === k.val;
                return (
                    <button key={k.val} onClick={() => setEstado(k.val)} className="appointments-kpi"
                        style={{
                            textAlign: 'left', cursor: 'pointer', padding: 16,
                            background: activo ? `${k.color}14` : card2,
                            border: `1px solid ${activo ? k.color : border}`,
                            borderRadius: 14, position: 'relative', overflow: 'hidden',
                            transition: 'all .15s',
                        }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: 3, height: '100%', background: `linear-gradient(180deg, ${k.color}, transparent)` }} />
                        <p style={{ fontSize: '.62rem', fontWeight: 800, letterSpacing: '.14em', color: muted, margin: 0, textTransform: 'uppercase' }}>{k.label}</p>
                        <p style={{ fontSize: '1.7rem', fontWeight: 800, color: k.color, margin: '4px 0 0', lineHeight: 1 }}>{k.n}</p>
                    </button>
                );
            })}
        </div>

        <div className="appointments-toolbar" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 }}>
            <select className="appointments-select" aria-label="Filtrar por estado" value={estado} onChange={e => setEstado(e.target.value)} style={control(bg, text, border)}><option value="pendiente">Pendientes</option><option value="confirmada">Confirmadas</option><option value="completada">Completadas</option><option value="todas">Todas</option><option value="cancelada">Canceladas</option></select>
            <select className="appointments-select" aria-label="Ordenar citas" value={orden} onChange={e => setOrden(e.target.value)} style={control(bg, text, border)}><option value="fecha_asc">Fecha de cita: próxima primero</option><option value="fecha_desc">Fecha de cita: más reciente primero</option><option value="registro_desc">Registro: más reciente primero</option><option value="registro_asc">Registro: más antiguo primero</option></select>
        </div>
        {cargando ? <p style={{ color: muted }}>Cargando agenda…</p> : visibles.length === 0 ? <div className="SS SWAP-card" style={card(bg, border)}><p style={{ color: muted, margin: 0 }}>No hay citas con este filtro.</p></div> : <div style={{ display: 'grid', gap: 12 }}>{visibles.map((c, index) => <div key={c.id} className="appointments-card" style={{ ...card(bg, border), animationDelay: `${index * 45}ms` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}><div><div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><strong style={{ color: text }}>{c.servicio_nombre}</strong><span className="appointments-status" style={{ color: ESTADOS[c.estado], fontWeight: 800, fontSize: '.72rem' }}>{NOMBRES[c.estado]}</span></div><p style={{ color: muted, margin: '6px 0 0', fontSize: '.85rem' }}>{c.cliente_nombre} {c.cliente_telefono ? `· ${c.cliente_telefono}` : ''}{c.placa ? ` · ${c.placa}` : ''}</p></div><div style={{ textAlign: 'right', color: text, fontSize: '.86rem' }}>{new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-EC')}<br/><span style={{ color: '#3b7bab', fontWeight: 700 }}>{c.hora_inicio?.slice(0,5)} – {c.hora_fin?.slice(0,5)}</span></div></div>
            <p style={{ color: muted, fontSize: '.8rem', margin: '12px 0 0' }}>{c.sucursal_nombre} · Registrada: {new Date(c.created_at).toLocaleString('es-EC')}</p>{c.notas && <p style={{ color: muted, fontSize: '.8rem', fontStyle: 'italic', margin: '7px 0 0' }}>“{c.notas}”</p>}
            {c.estado === 'pendiente' && <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}><button className="appointments-action" onClick={() => cambiar(c.id, 'confirmada')} style={action('#059669')}>✓ Aceptar cita</button><button className="appointments-action" onClick={() => cambiar(c.id, 'cancelada')} style={action('#dc2626')}>Cancelar</button></div>}
        </div>)}</div>}
    </div>;
}
const control = (bg, color, border) => ({ background: bg, color, border: `1px solid ${border}`, borderRadius: 8, padding: '9px 11px' });
const card = (background, border) => ({ background, border: `1px solid ${border}`, borderRadius: 12, padding: '17px 18px' });
const action = color => ({ border: 0, borderRadius: 7, padding: '8px 12px', background: color, color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: '.8rem' });
