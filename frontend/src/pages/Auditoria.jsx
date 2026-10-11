/**
 * SS SWAP - Auditoría de seguridad (solo SUPERADMINISTRADOR)
 *
 * Consulta de la tabla auditoria_seguridad: altas y cambios de cuentas,
 * permisos concedidos/revocados, cambios de rol y estado, inicios de sesión
 * del personal y accesos denegados. Es de solo lectura: la base de datos no
 * permite modificar ni borrar estos registros.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import './Usuarios.css';

const ACCIONES = [
    { val: '', label: 'Todas las acciones' },
    { val: 'permisos.actualizar', label: 'Permisos modificados' },
    { val: 'usuario.', label: 'Cambios de cuentas (todas)' },
    { val: 'usuario.crear', label: 'Cuenta creada' },
    { val: 'usuario.cambiar_rol', label: 'Rol cambiado' },
    { val: 'usuario.desactivar', label: 'Cuenta desactivada' },
    { val: 'usuario.activar', label: 'Cuenta activada' },
    { val: 'usuario.restablecer_acceso', label: 'Acceso restablecido' },
    { val: 'acceso.denegado', label: 'Accesos denegados' },
    { val: 'sesion.inicio', label: 'Inicios de sesión del personal' },
    { val: 'superadmin.', label: 'Gestión de superadministradores' },
];
const ETIQUETA = Object.fromEntries(ACCIONES.filter(a => a.val && !a.val.endsWith('.')).map(a => [a.val, a.label]));
Object.assign(ETIQUETA, {
    'usuario.editar': 'Datos modificados', 'usuario.cerrar_sesiones': 'Sesiones cerradas', 'usuario.eliminar': 'Cuenta eliminada',
    'superadmin.conceder': 'Promovido a superadministrador', 'superadmin.revocar': 'Dejó de ser superadministrador', 'superadmin.crear': 'Superadministrador creado',
});
const COLOR_RESULTADO = { exito: '#10b981', denegado: '#ef4444', error: '#f59e0b' };

/** Resumen legible del detalle JSON (sin datos sensibles: el backend ya los filtró). */
function resumenDetalle(d) {
    if (!d) return '';
    const partes = [];
    if (d.otorgados?.length) partes.push(`+ ${d.otorgados.join(', ')}`);
    if (d.revocados?.length) partes.push(`− ${d.revocados.join(', ')}`);
    if (typeof d.antes === 'string' && typeof d.despues === 'string') partes.push(`${d.antes} → ${d.despues}`);
    if (d.cambios) partes.push(Object.entries(d.cambios).map(([k, v]) => `${k}: ${v.antes ?? '—'} → ${v.despues ?? '—'}`).join(' · '));
    if (d.requiere) partes.push(`requiere ${d.requiere}`);
    if (d.rol && !d.antes) partes.push(`rol ${d.rol}`);
    if (d.permisos_otorgados) partes.push(`${d.permisos_otorgados.length} permiso(s) inicial(es)`);
    return partes.join(' | ');
}

export default function Auditoria() {
    const { isDark } = useTheme();
    const [searchParams] = useSearchParams();
    const [filtros, setFiltros] = useState({
        accion: '', resultado: '', q: '', desde: '', hasta: '',
        usuario_id: searchParams.get('usuario_id') || '',
    });
    const [datos, setDatos] = useState({ registros: [], total: 0, page: 1, limit: 50 });
    const [loading, setLoading] = useState(true);

    const SKY = '#0ea5e9'; const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.12)';
    const txt = isDark ? '#f1f5f9' : '#0f172a';
    const txtSf = isDark ? '#cbd5e1' : '#334155';
    const mut = isDark ? 'rgba(241,245,249,0.55)' : '#64748b';
    const bdr = isDark ? 'rgba(148,163,184,0.18)' : '#b6c3d3';
    const card = isDark ? 'rgba(255,255,255,0.025)' : '#ffffff';
    const cardSh = isDark ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)' : '0 1px 2px rgba(15,23,42,0.06), 0 8px 22px -8px rgba(15,23,42,0.20)';
    const inputBg = isDark ? '#0b1220' : '#fafcff';
    const ctrl = { padding: '10px 12px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none' };

    const cargar = useCallback(async (page = 1) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ page, limit: 50 });
            Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
            const { data } = await api.get(`/users/auditoria?${params}`);
            setDatos(data);
        } catch (err) {
            toast.error(err.response?.data?.error || 'Error al cargar la auditoría.');
        } finally { setLoading(false); }
    }, [filtros]);

    useEffect(() => {
        const t = setTimeout(() => cargar(1), 250);
        return () => clearTimeout(t);
    }, [cargar]);

    const set = (k) => (e) => setFiltros(f => ({ ...f, [k]: e.target.value }));
    const paginas = Math.max(1, Math.ceil(datos.total / datos.limit));

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500 }}>
            <div style={{ marginBottom: 20 }}>
                <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>SS SWAP · SUPERADMIN · SEGURIDAD</span></div>
                <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Auditoría de seguridad</h1>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: mut, marginTop: 6, maxWidth: 680 }}>
                    Quién creó o modificó cuentas, concedió o revocó permisos y qué accesos fueron rechazados.
                    Estos registros no se pueden editar ni borrar.
                </p>
            </div>

            <div style={{ padding: 16, marginBottom: 16, background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <select aria-label="Acción" className="u-input" value={filtros.accion} onChange={set('accion')} style={ctrl}>
                    {ACCIONES.map(a => <option key={a.val} value={a.val}>{a.label}</option>)}
                </select>
                <select aria-label="Resultado" className="u-input" value={filtros.resultado} onChange={set('resultado')} style={ctrl}>
                    <option value="">Cualquier resultado</option>
                    <option value="exito">Éxito</option>
                    <option value="denegado">Denegado</option>
                    <option value="error">Error</option>
                </select>
                <input aria-label="Buscar" className="u-input" placeholder="Buscar correo o detalle..." value={filtros.q} onChange={set('q')} style={{ ...ctrl, flex: '1 1 200px' }} />
                <label style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, display: 'flex', alignItems: 'center', gap: 6 }}>Desde <input type="date" className="u-input" value={filtros.desde} onChange={set('desde')} style={ctrl} /></label>
                <label style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, display: 'flex', alignItems: 'center', gap: 6 }}>Hasta <input type="date" className="u-input" value={filtros.hasta} onChange={set('hasta')} style={ctrl} /></label>
                {filtros.usuario_id && (
                    <button onClick={() => setFiltros(f => ({ ...f, usuario_id: '' }))} style={{ ...ctrl, cursor: 'pointer', color: SKY_DEEP }}>Cuenta #{filtros.usuario_id} ×</button>
                )}
            </div>

            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh, overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                    <thead>
                        <tr style={{ borderBottom: `1px solid ${bdr}`, background: SKY_PALE }}>
                            {['Fecha y hora', 'Responsable', 'Acción', 'Recurso', 'Resultado', 'Detalle'].map(h => (
                                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP, whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', fontFamily: "'Outfit'", color: mut }}>Cargando...</td></tr>
                        ) : datos.registros.length === 0 ? (
                            <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', fontFamily: "'Outfit'", color: mut }}>Sin registros con estos filtros.</td></tr>
                        ) : datos.registros.map(r => (
                            <tr key={r.id} className="u-row" style={{ borderBottom: `1px solid ${bdr}` }}>
                                <td style={{ padding: '10px 16px', fontFamily: "'Outfit'", fontSize: '.78rem', color: txtSf, whiteSpace: 'nowrap' }}>{new Date(r.created_at).toLocaleString('es-EC')}</td>
                                <td style={{ padding: '10px 16px', fontFamily: "'Outfit'", fontSize: '.8rem', color: txt }}>
                                    {r.actor_email || 'sistema'}
                                    {r.actor_rol && <span style={{ display: 'block', fontSize: '.7rem', color: mut }}>{r.actor_rol}{r.ip ? ` · ${r.ip}` : ''}</span>}
                                </td>
                                <td style={{ padding: '10px 16px', fontFamily: "'Outfit'", fontSize: '.82rem', fontWeight: 600, color: txt }}>{ETIQUETA[r.accion] || r.accion}</td>
                                <td style={{ padding: '10px 16px', fontFamily: "'Outfit'", fontSize: '.78rem', color: txtSf }}>
                                    {r.recurso_tipo === 'usuario' ? (r.recurso_email || `Cuenta #${r.recurso_id}`) : (r.recurso_id || '—')}
                                </td>
                                <td style={{ padding: '10px 16px' }}>
                                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.14em', color: COLOR_RESULTADO[r.resultado] || mut }}>{r.resultado.toUpperCase()}</span>
                                </td>
                                <td style={{ padding: '10px 16px', fontFamily: "'Outfit'", fontSize: '.74rem', color: mut, maxWidth: 420, wordBreak: 'break-word' }}>{resumenDetalle(r.detalle)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontFamily: "'Outfit'", fontSize: '.8rem', color: mut, flexWrap: 'wrap', gap: 8 }}>
                <span>{datos.total} registro(s)</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button disabled={datos.page <= 1 || loading} onClick={() => cargar(datos.page - 1)} style={{ ...ctrl, cursor: 'pointer', opacity: datos.page <= 1 ? .5 : 1 }}>‹ Anterior</button>
                    <span>Página {datos.page} de {paginas}</span>
                    <button disabled={datos.page >= paginas || loading} onClick={() => cargar(datos.page + 1)} style={{ ...ctrl, cursor: 'pointer', opacity: datos.page >= paginas ? .5 : 1, color: SKY }}>Siguiente ›</button>
                </div>
            </div>
        </div>
    );
}
