/**
 * SS SWAP - Control de cajas (Sprint 29)
 * Todas las cajas (abiertas y cerradas) con buscador, filtros, paginación y
 * Excel. Por fila: ver el reporte, descargar el PDF, imprimirlo y, en la
 * última caja cerrada, reabrirla (permiso caja:reabrir) con un motivo.
 */
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { dinero, VERDE, AMBAR, VIOLETA } from '../finanzas/tema';
import { Badge, Modal } from '../finanzas/Modales';
import Paginador from '../proveedores/Paginador';
import ReporteCaja from './ReporteCaja';
import { descargarArchivo, imprimirPdfCaja } from './archivos';
import { fechaHora, Diferencia } from './comunes';

const POR_PAGINA = 20;

function Icono({ d }) {
    return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
}
const ICONOS = {
    ver: <Icono d={<><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>} />,
    pdf: <Icono d={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 18 15 15" /></>} />,
    imprimir: <Icono d={<><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></>} />,
    reabrir: <Icono d={<><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></>} />,
};

function ModalReabrir({ theme, sesion, onClose, onHecho }) {
    const { labelSt, inputSt, txtSf, bdr, mut, btnPrim } = theme;
    const [motivo, setMotivo] = useState('');
    const [saving, setSaving] = useState(false);
    const submit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post(`/caja/sesiones/${sesion.id}/reabrir`, { motivo: motivo.trim() });
            toast.success(`Caja #${sesion.id} reabierta.`);
            onHecho(); onClose();
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo reabrir la caja.'); }
        finally { setSaving(false); }
    };
    return (
        <Modal theme={theme} etiqueta="CAJA · REABRIR" titulo={`Reabrir caja #${sesion.id}`} onClose={onClose} ancho={500}>
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: txtSf }}>
                    La caja vuelve a quedar abierta para corregir el cierre. El ajuste por {Number(sesion.diferencia) > 0 ? 'sobrante' : 'faltante'} del
                    cierre ({dinero(Math.abs(Number(sesion.diferencia) || 0))}) se anula y el cierre anterior queda en el historial de la caja.
                </p>
                <div>
                    <label style={labelSt}>MOTIVO *</label>
                    <input value={motivo} onChange={e => setMotivo(e.target.value)} style={inputSt} required minLength={3} maxLength={255} autoFocus placeholder="Ej: Faltó registrar un cobro" />
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 14, borderTop: `1px solid ${bdr}` }}>
                    <button type="button" onClick={onClose} style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut }}>CANCELAR</button>
                    <button type="submit" disabled={saving} style={{ ...btnPrim, background: `linear-gradient(135deg, #6d28d9, ${VIOLETA})`, opacity: saving ? .6 : 1 }}>{saving ? 'REABRIENDO...' : 'REABRIR CAJA'}</button>
                </div>
            </form>
        </Modal>
    );
}

export default function ControlCajas({ theme, onCambio, recarga }) {
    const { txt, txtSf, mut, bdr, card, cardSh, inputSt, SKY_PALE, SKY_DEEP, btnSec } = theme;
    const { puede } = useAuth();
    const puedeReabrir = puede('caja', 'reabrir');
    const [filtros, setFiltros] = useState({ q: '', estado: '', desde: '', hasta: '', cajero_id: '' });
    const [busqueda, setBusqueda] = useState('');
    const [pagina, setPagina] = useState(1);
    const [datos, setDatos] = useState({ sesiones: [], total: 0 });
    const [cajeros, setCajeros] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [viendo, setViendo] = useState(null);
    const [reabriendo, setReabriendo] = useState(null);

    // La búsqueda por texto espera a que se deje de escribir.
    useEffect(() => {
        const t = setTimeout(() => { setFiltros(f => (f.q === busqueda ? f : { ...f, q: busqueda })); setPagina(1); }, 350);
        return () => clearTimeout(t);
    }, [busqueda]);

    useEffect(() => { api.get('/caja/opciones').then(({ data }) => setCajeros(data.cajeros || [])).catch(() => {}); }, []);

    const consulta = useCallback((extra = {}) => {
        const p = new URLSearchParams();
        Object.entries({ ...filtros, ...extra }).forEach(([k, v]) => { if (v !== '' && v !== undefined && v !== null) p.set(k, v); });
        return p.toString();
    }, [filtros]);

    const cargar = useCallback(async () => {
        setCargando(true);
        try {
            const { data } = await api.get(`/caja/sesiones?${consulta({ page: pagina, limit: POR_PAGINA })}`);
            setDatos(data);
        } catch (err) { toast.error(err.response?.data?.error || 'No se pudo cargar el listado de cajas.'); }
        finally { setCargando(false); }
    }, [consulta, pagina]);

    useEffect(() => { cargar(); }, [cargar, recarga]);

    const setFiltro = (k, v) => { setFiltros(f => ({ ...f, [k]: v })); setPagina(1); };
    const limpiar = () => { setBusqueda(''); setFiltros({ q: '', estado: '', desde: '', hasta: '', cajero_id: '' }); setPagina(1); };
    const hayFiltros = Object.values(filtros).some(Boolean);
    const boton = (color) => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 30, borderRadius: 8, border: `1px solid ${color}55`, background: `${color}14`, color, cursor: 'pointer' });

    return (
        <div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
                <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por #, cajero, sucursal o nota..." aria-label="Buscar cajas" style={{ ...inputSt, flex: '1 1 240px', width: 'auto' }} />
                <select value={filtros.estado} onChange={e => setFiltro('estado', e.target.value)} aria-label="Estado" style={{ ...inputSt, width: 'auto', flex: '0 0 auto' }}>
                    <option value="">Todas</option><option value="abierta">Abiertas</option><option value="cerrada">Cerradas</option>
                </select>
                <select value={filtros.cajero_id} onChange={e => setFiltro('cajero_id', e.target.value)} aria-label="Cajero" style={{ ...inputSt, width: 'auto', flex: '0 0 auto' }}>
                    <option value="">Todos los cajeros</option>
                    {cajeros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Outfit'", fontSize: '.8rem', color: mut }}>
                    Desde <input type="date" value={filtros.desde} onChange={e => setFiltro('desde', e.target.value)} style={{ ...inputSt, width: 'auto' }} />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Outfit'", fontSize: '.8rem', color: mut }}>
                    Hasta <input type="date" value={filtros.hasta} onChange={e => setFiltro('hasta', e.target.value)} style={{ ...inputSt, width: 'auto' }} />
                </label>
                {hayFiltros && <button type="button" style={btnSec} onClick={limpiar}>LIMPIAR</button>}
                <button type="button" style={{ ...btnSec, marginLeft: 'auto' }} onClick={() => descargarArchivo(`/caja/sesiones/excel?${consulta()}`, 'cajas.xlsx')}>EXCEL</button>
            </div>

            <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                <table className="prov-table">
                    <thead><tr style={{ background: SKY_PALE }}>
                        {['#', 'Sucursal', 'Cajero', 'Apertura', 'Cierre', 'Estado', 'Inicial', 'Esperado', 'Contado', 'Diferencia', 'Acciones'].map(h => (
                            <th key={h} style={{ color: SKY_DEEP, textAlign: ['Inicial', 'Esperado', 'Contado', 'Diferencia'].includes(h) ? 'right' : h === 'Acciones' ? 'center' : 'left' }}>{h}</th>
                        ))}
                    </tr></thead>
                    <tbody>
                        {cargando && datos.sesiones.length === 0 && <tr><td colSpan={11} style={{ color: mut, textAlign: 'center' }}>Cargando...</td></tr>}
                        {!cargando && datos.sesiones.length === 0 && <tr><td colSpan={11} style={{ color: mut, textAlign: 'center', fontStyle: 'italic' }}>{hayFiltros ? 'Ninguna caja coincide con los filtros.' : 'Aún no hay cajas registradas.'}</td></tr>}
                        {datos.sesiones.map(s => (
                            <tr key={s.id}>
                                <td style={{ color: txt, fontWeight: 700 }}>{s.id}</td>
                                <td style={{ color: txtSf }}>{s.sucursal_nombre || 'General'}</td>
                                <td style={{ color: txt }}>{s.cajero_nombre}{s.usuario_apertura_nombre !== s.cajero_nombre && <div style={{ fontSize: '.7rem', color: mut }}>Abrió: {s.usuario_apertura_nombre}</div>}</td>
                                <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fechaHora(s.fecha_apertura)}</td>
                                <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{s.fecha_cierre ? fechaHora(s.fecha_cierre) : '—'}{s.usuario_cierre_nombre && s.usuario_cierre_nombre !== s.cajero_nombre && <div style={{ fontSize: '.7rem', color: mut }}>Cerró: {s.usuario_cierre_nombre}</div>}</td>
                                <td>
                                    <Badge color={s.estado === 'abierta' ? VERDE : AMBAR}>{s.estado === 'abierta' ? 'ABIERTA' : 'CERRADA'}</Badge>
                                    {Number(s.veces_reabierta) > 0 && <div style={{ fontSize: '.68rem', color: VIOLETA, marginTop: 3 }}>Reabierta {s.veces_reabierta}×</div>}
                                </td>
                                <td style={{ color: txtSf, textAlign: 'right' }}>{dinero(s.monto_apertura)}</td>
                                <td style={{ color: txtSf, textAlign: 'right' }}>{s.monto_cierre_esperado != null ? dinero(s.monto_cierre_esperado) : '—'}</td>
                                <td style={{ color: txt, fontWeight: 600, textAlign: 'right' }}>{s.monto_cierre_real != null ? dinero(s.monto_cierre_real) : '—'}</td>
                                <td style={{ textAlign: 'right' }}>{s.estado === 'cerrada' ? <Diferencia valor={s.diferencia} /> : '—'}</td>
                                <td>
                                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                                        <button type="button" title="Ver reporte" aria-label={`Ver reporte de la caja ${s.id}`} style={boton('#0ea5e9')} onClick={() => setViendo(s.id)}>{ICONOS.ver}</button>
                                        <button type="button" title="Descargar PDF" aria-label={`Descargar PDF de la caja ${s.id}`} style={boton('#ef4444')} onClick={() => descargarArchivo(`/caja/sesiones/${s.id}/pdf`, `cierre-caja-${s.id}.pdf`)}>{ICONOS.pdf}</button>
                                        <button type="button" title="Imprimir" aria-label={`Imprimir la caja ${s.id}`} style={boton('#2563eb')} onClick={() => imprimirPdfCaja(s.id)}>{ICONOS.imprimir}</button>
                                        {puedeReabrir && s.puede_reabrir && (
                                            <button type="button" title="Reabrir caja" aria-label={`Reabrir la caja ${s.id}`} style={boton(VIOLETA)} onClick={() => setReabriendo(s)}>{ICONOS.reabrir}</button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Paginador pagina={pagina} setPagina={setPagina} total={datos.total} porPagina={POR_PAGINA} theme={theme} />
            {datos.total > 0 && datos.total <= POR_PAGINA && (
                <p style={{ fontFamily: "'Outfit'", fontSize: '.76rem', color: mut, textAlign: 'center', marginTop: 12 }}>{datos.total} caja{datos.total === 1 ? '' : 's'}</p>
            )}

            {viendo && <ReporteCaja theme={theme} sesionId={viendo} onClose={() => setViendo(null)} />}
            {reabriendo && <ModalReabrir theme={theme} sesion={reabriendo} onClose={() => setReabriendo(null)} onHecho={() => { cargar(); onCambio?.(); }} />}
        </div>
    );
}
