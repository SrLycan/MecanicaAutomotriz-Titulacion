/**
 * SS SWAP - Finanzas · Movimientos de dinero
 * Lista unificada de TODO lo que entra y sale (cobros, pagos a proveedores,
 * gastos, caja, nomina, otros), con filtros y totales del filtro.
 * Solo los movimientos creados en Finanzas o Nomina se anulan desde aqui;
 * el resto se corrige en su propio modulo.
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import Paginador from '../proveedores/Paginador';
import { Badge, Monto, ModalAnular } from './Modales';
import { dinero, fechaCorta, ORIGEN_LABEL, VERDE, ROJO } from './tema';
import { useAuth } from '../../context/AuthContext';

const POR_PAGINA = 25;
const VACIO = { desde: '', hasta: '', tipo: '', categoria: '', cuenta_id: '', origen: '', q: '' };
const MODULO_DE = {
    pago_cliente: 'Clientes › Pagaré / Cartera', pago_proveedor: 'Proveedores › Pagos / Historial',
    gasto: 'Proveedores › Gastos', caja: 'Caja diaria',
};

export default function FlujoTab({ theme, categorias, cuentas, version, onCambio, cuentaInicial, onAccion }) {
    const { puede } = useAuth();
    const { txt, txtSf, mut, bdr, card, cardSh, inputSt, labelSt, SKY_DEEP, SKY_PALE, btnPrim, btnSec } = theme;
    const [filtros, setFiltros] = useState({ ...VACIO, cuenta_id: cuentaInicial ? String(cuentaInicial) : '' });
    const [q, setQ] = useState('');
    const [pagina, setPagina] = useState(1);
    const [data, setData] = useState({ movimientos: [], total: 0, totales: { ingresos: 0, egresos: 0, neto: 0 } });
    const [loading, setLoading] = useState(true);
    const [anulando, setAnulando] = useState(null);

    // Busqueda con espera (no consulta en cada tecla)
    useEffect(() => { const t = setTimeout(() => setFiltros(f => ({ ...f, q })), 350); return () => clearTimeout(t); }, [q]);
    useEffect(() => { setPagina(1); }, [filtros]);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(filtros).forEach(([k, v]) => { if (v) params.set(k, v); });
            params.set('page', String(pagina));
            params.set('limit', String(POR_PAGINA));
            const { data } = await api.get(`/finanzas/flujo?${params}`);
            setData(data);
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cargar los movimientos.'); }
        finally { setLoading(false); }
    }, [filtros, pagina]);

    useEffect(() => { cargar(); }, [cargar, version]);

    const anular = async (motivo) => {
        const m = anulando;
        if (m.origen === 'pago_empleado') await api.post(`/finanzas/pagos-empleados/${m.origen_id}/anular`, { motivo });
        else await api.post(`/finanzas/movimientos/${m.origen_id}/anular`, { motivo });
        toast.success(m.categoria === 'transferencia' ? 'Transferencia anulada (ambos lados).' : 'Movimiento anulado.');
        onCambio();
    };

    const sel = { ...inputSt, padding: '8px 10px', fontSize: '.8rem' };
    const set = (k, v) => setFiltros(f => ({ ...f, [k]: v }));
    const hayFiltros = Object.values(filtros).some(Boolean);

    return (
        <div>
            {onAccion && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', marginBottom: 14 }}>
                    {puede('finanzas', 'crear') && <button style={{ ...btnPrim, background: `linear-gradient(135deg, #059669, ${VERDE})` }} onClick={() => onAccion('ingreso')}>+ INGRESO</button>}
                    {puede('finanzas', 'crear') && <button style={{ ...btnPrim, background: `linear-gradient(135deg, #dc2626, ${ROJO})` }} onClick={() => onAccion('egreso')}>− EGRESO</button>}
                    {puede('finanzas', 'crear') && <button style={btnSec} onClick={() => onAccion('transferencia')}>⇄ TRANSFERIR</button>}
                </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10, alignItems: 'end', marginBottom: 14 }}>
                <div style={{ gridColumn: 'span 2' }}>
                    <label style={labelSt}>BUSCAR</label>
                    <input style={sel} value={q} onChange={e => setQ(e.target.value)} placeholder="Descripción, cliente, proveedor, empleado..." />
                </div>
                <div>
                    <label style={labelSt}>TIPO</label>
                    <select style={sel} value={filtros.tipo} onChange={e => set('tipo', e.target.value)}>
                        <option value="">Todos</option><option value="ingreso">Ingresos</option><option value="egreso">Egresos</option>
                    </select>
                </div>
                <div>
                    <label style={labelSt}>CATEGORIA</label>
                    <select style={sel} value={filtros.categoria} onChange={e => set('categoria', e.target.value)}>
                        <option value="">Todas</option>
                        {categorias.map(c => <option key={c.codigo} value={c.codigo}>{c.nombre}</option>)}
                    </select>
                </div>
                <div>
                    <label style={labelSt}>CUENTA</label>
                    <select style={sel} value={filtros.cuenta_id} onChange={e => set('cuenta_id', e.target.value)}>
                        <option value="">Todas</option>
                        {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                </div>
                <div>
                    <label style={labelSt}>ORIGEN</label>
                    <select style={sel} value={filtros.origen} onChange={e => set('origen', e.target.value)}>
                        <option value="">Todos</option>
                        {Object.entries(ORIGEN_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                <div>
                    <label style={labelSt}>DESDE</label>
                    <input type="date" style={sel} value={filtros.desde} onChange={e => set('desde', e.target.value)} />
                </div>
                <div>
                    <label style={labelSt}>HASTA</label>
                    <input type="date" style={sel} value={filtros.hasta} onChange={e => set('hasta', e.target.value)} />
                </div>
            </div>

            <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'center', fontFamily: "'Outfit'", fontSize: '.82rem', color: mut, marginBottom: 12 }}>
                <span>{data.total} movimiento{data.total !== 1 ? 's' : ''}</span>
                <span>Entró <strong style={{ color: VERDE }}>{dinero(data.totales.ingresos)}</strong></span>
                <span>Salió <strong style={{ color: ROJO }}>{dinero(data.totales.egresos)}</strong></span>
                <span>Neto <strong style={{ color: data.totales.neto >= 0 ? VERDE : ROJO }}>{dinero(data.totales.neto)}</strong></span>
                {hayFiltros && <button onClick={() => { setQ(''); setFiltros(VACIO); }} style={{ background: 'none', border: 'none', color: SKY_DEEP, cursor: 'pointer', fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.8rem' }}>Limpiar filtros ×</button>}
            </div>

            {loading ? (
                <p style={{ fontFamily: "'Outfit'", color: mut, padding: 40, textAlign: 'center' }}>Cargando movimientos...</p>
            ) : data.movimientos.length === 0 ? (
                <div style={{ padding: 60, textAlign: 'center', background: card, border: `1px solid ${bdr}`, borderRadius: 14 }}>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.2rem', color: txt }}>No hay movimientos para estos filtros</p>
                </div>
            ) : (
                <div className="prov-table-wrap" style={{ background: card, border: `1px solid ${bdr}`, boxShadow: cardSh }}>
                    <table className="prov-table">
                        <thead>
                            <tr style={{ background: SKY_PALE }}>
                                {['Fecha', 'Detalle', 'Categoría', 'Cuenta', 'Origen', 'Monto', ''].map(h => <th key={h} style={{ color: SKY_DEEP }}>{h}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {data.movimientos.map(m => {
                                const anulable = m.origen === 'pago_empleado' || (m.origen === 'movimiento' && m.categoria !== 'ajuste_caja');
                                return (
                                    <tr key={m.origen + m.origen_id}>
                                        <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{fechaCorta(m.fecha)}</td>
                                        <td style={{ color: txt, minWidth: 200, maxWidth: 320 }}>
                                            {m.descripcion}
                                            {(m.tercero || m.referencia) && <div style={{ fontSize: '.72rem', color: mut, marginTop: 2 }}>{[m.tercero, m.referencia && `Ref. ${m.referencia}`].filter(Boolean).join(' · ')}</div>}
                                        </td>
                                        <td><Badge color={m.color}>{m.categoria_nombre}</Badge></td>
                                        <td style={{ color: txtSf, whiteSpace: 'nowrap' }}>{m.cuenta_nombre || '—'}</td>
                                        <td style={{ color: mut, fontSize: '.78rem', whiteSpace: 'nowrap' }}>{ORIGEN_LABEL[m.origen] || m.origen}</td>
                                        <td><Monto tipo={m.tipo} monto={m.monto} /></td>
                                        <td style={{ textAlign: 'right' }}>
                                            {anulable ? (
                                                puede('finanzas', 'eliminar') && <button className="prov-icon-btn" style={{ color: ROJO, fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.12em', padding: '5px 9px' }} onClick={() => setAnulando(m)}>ANULAR</button>
                                            ) : MODULO_DE[m.origen] ? (
                                                <span title={`Se corrige en ${MODULO_DE[m.origen]}`} style={{ fontSize: '.7rem', color: mut, cursor: 'help' }}>ⓘ</span>
                                            ) : null}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <Paginador pagina={pagina} setPagina={setPagina} total={data.total} porPagina={POR_PAGINA} theme={theme} />

            {anulando && (
                <ModalAnular theme={theme} titulo="Anular movimiento" onClose={() => setAnulando(null)} onConfirmar={anular}
                    detalle={`${anulando.descripcion} — ${dinero(anulando.monto)}. El registro queda en el historial pero deja de contar en los saldos.${anulando.categoria === 'transferencia' ? ' Se anulan ambos lados de la transferencia.' : ''}`} />
            )}
        </div>
    );
}
