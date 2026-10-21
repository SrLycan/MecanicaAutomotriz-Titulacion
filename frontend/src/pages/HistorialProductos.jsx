/**
 * SS SWAP - Historial de productos creados (Sprint 28)
 *
 * Subseccion de Inventario: lista cada producto que se dio de alta, del mas
 * reciente al mas antiguo, con su ORIGEN:
 *  - Creado a mano desde Inventario (quien lo creo y con que stock inicial).
 *  - Creado al registrar una factura de compra del proveedor (numero de
 *    factura, proveedor y cantidad ingresada).
 * Endpoint: GET /api/inventory/historial-creacion (mismo permiso de lectura
 * del inventario; cada usuario ve solo las areas que tiene permitidas).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { useTemaPanel, dinero, VERDE, VIOLETA } from '../components/finanzas/tema';
import { NombreEmpresa } from '../components/common/MarcaEmpresa';

const POR_PAGINA = 25;
const FILTROS_VACIOS = { q: '', origen: '', area: '', fecha_inicio: '', fecha_fin: '' };
const AREA_LABEL = { mecanica: 'Mecánica', colisiones: 'Colisiones / Pintura' };
export const ORIGEN_CREACION = {
    manual:         { label: 'CREADO A MANO',        color: '#0ea5e9' },
    factura_compra: { label: 'FACTURA DE PROVEEDOR', color: VERDE },
    importacion:    { label: 'IMPORTACIÓN',          color: VIOLETA },
};
const fmtCant = (n) => (n == null ? '—' : Number(n) % 1 === 0 ? String(Number(n)) : Number(n).toFixed(2));

/** Numeros de pagina con elipsis (1 … 4 5 6 … 20). */
function paginas(actual, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (actual <= 4) return [1, 2, 3, 4, 5, '…', total];
    if (actual >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
    return [1, '…', actual - 1, actual, actual + 1, '…', total];
}

function IconSearch() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }

export default function HistorialProductos() {
    const { isDark, txt, txtSf, mut, bdr, card, cardSh, inputBg, SKY, SKY_DEEP, SKY_PALE } = useTemaPanel();
    const headBg = isDark ? 'rgba(14,165,233,0.06)' : 'rgba(14,165,233,0.12)';
    const [filtros, setFiltros] = useState(FILTROS_VACIOS);
    const [datos, setDatos] = useState({ productos: [], total: 0, totalPages: 1, page: 1, resumen: {} });
    const [loading, setLoading] = useState(true);
    const debounceRef = useRef(null);

    const cargar = useCallback(async (f, pg) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            Object.entries(f).forEach(([k, v]) => { if (v) params.set(k, v); });
            params.set('page', pg);
            params.set('limit', POR_PAGINA);
            const { data } = await api.get(`/inventory/historial-creacion?${params}`);
            setDatos({ productos: data.productos || [], total: data.total || 0, totalPages: data.totalPages || 1, page: data.page || pg, resumen: data.resumen || {} });
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cargar el historial de productos.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { cargar(FILTROS_VACIOS, 1); }, [cargar]);
    useEffect(() => () => clearTimeout(debounceRef.current), []);

    // Texto con espera corta; selects y fechas al instante.
    const cambiar = (campo, valor, inmediato = false) => {
        const nuevos = { ...filtros, [campo]: valor };
        setFiltros(nuevos);
        clearTimeout(debounceRef.current);
        if (inmediato) cargar(nuevos, 1); else debounceRef.current = setTimeout(() => cargar(nuevos, 1), 350);
    };
    const limpiar = () => { setFiltros(FILTROS_VACIOS); cargar(FILTROS_VACIOS, 1); };
    const hayFiltros = Object.values(filtros).some(Boolean);

    const { productos, total, totalPages, page, resumen } = datos;
    const desde = total === 0 ? 0 : (page - 1) * POR_PAGINA + 1;
    const hasta = Math.min(total, (page - 1) * POR_PAGINA + productos.length);

    const selSt = { padding: '10px 12px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none' };
    const etiq  = { fontFamily: "'Bebas Neue'", fontSize: '.76rem', letterSpacing: '.2em', color: mut, display: 'block', marginBottom: 4 };
    const th    = { padding: '13px 16px', textAlign: 'left', fontFamily: "'Bebas Neue'", fontSize: '.74rem', letterSpacing: '.22em', color: SKY_DEEP, whiteSpace: 'nowrap' };
    const td    = { padding: '13px 16px', fontFamily: "'Outfit'", fontSize: '.84rem', color: txtSf, verticalAlign: 'top', borderBottom: `1px solid ${bdr}` };
    const btnPag = (activo, deshabilitado) => ({
        minWidth: 34, height: 34, borderRadius: 9, padding: '0 8px', cursor: deshabilitado ? 'not-allowed' : 'pointer',
        border: activo ? 'none' : `1px solid ${bdr}`, opacity: deshabilitado ? 0.35 : 1,
        background: activo ? `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})` : 'transparent',
        color: activo ? '#fff' : txt, fontFamily: "'Outfit'", fontWeight: activo ? 700 : 500, fontSize: '.82rem',
    });

    const tarjetas = [
        { k: '', label: 'Productos creados', valor: (resumen.manual || 0) + (resumen.factura_compra || 0) + (resumen.importacion || 0), color: SKY },
        { k: 'manual', label: 'Creados a mano', valor: resumen.manual || 0, color: ORIGEN_CREACION.manual.color },
        { k: 'factura_compra', label: 'Por factura de proveedor', valor: resumen.factura_compra || 0, color: ORIGEN_CREACION.factura_compra.color },
    ];

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500 }}>
            <div style={{ marginBottom: 18 }}>
                <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span><NombreEmpresa /> · INVENTARIO · HISTORIAL</span></div>
                <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Historial de productos</h1>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.88rem', color: mut, marginTop: 6 }}>
                    Cada producto que se creó en el inventario: a mano desde Inventario o al registrar una factura de compra del proveedor, con quién lo creó y cuándo.
                </p>
            </div>

            {/* Resumen por origen (respeta los filtros de texto, inventario y fechas) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                {tarjetas.map(t => {
                    const activa = filtros.origen === t.k;
                    return (
                        <button key={t.label} type="button" onClick={() => cambiar('origen', t.k, true)}
                            style={{ textAlign: 'left', cursor: 'pointer', background: card, borderRadius: 14, padding: '14px 16px', boxShadow: cardSh,
                                border: `1px solid ${activa ? t.color : bdr}`, outline: activa ? `2px solid ${t.color}33` : 'none' }}>
                            <span style={{ ...etiq, marginBottom: 6 }}>{t.label}</span>
                            <span style={{ fontFamily: "'Bebas Neue'", fontSize: '2rem', color: t.color, lineHeight: 1 }}>{t.valor}</span>
                        </button>
                    );
                })}
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end', marginBottom: 14 }}>
                <label style={{ flex: '1 1 240px' }}>
                    <span style={etiq}>Buscar</span>
                    <span style={{ position: 'relative', display: 'block' }}>
                        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: mut, display: 'flex' }}><IconSearch /></span>
                        <input value={filtros.q} onChange={e => cambiar('q', e.target.value)} placeholder="Nombre, referencia o código del proveedor"
                            style={{ ...selSt, width: '100%', boxSizing: 'border-box', paddingLeft: 32 }} />
                    </span>
                </label>
                <label>
                    <span style={etiq}>Origen</span>
                    <select value={filtros.origen} onChange={e => cambiar('origen', e.target.value, true)} style={selSt}>
                        <option value="">Todos</option>
                        <option value="manual">Creado a mano</option>
                        <option value="factura_compra">Factura de proveedor</option>
                    </select>
                </label>
                <label>
                    <span style={etiq}>Inventario</span>
                    <select value={filtros.area} onChange={e => cambiar('area', e.target.value, true)} style={selSt}>
                        <option value="">Todos</option>
                        <option value="mecanica">Mecánica</option>
                        <option value="colisiones">Colisiones / Pintura</option>
                    </select>
                </label>
                <label>
                    <span style={etiq}>Desde</span>
                    <input type="date" value={filtros.fecha_inicio} onChange={e => cambiar('fecha_inicio', e.target.value, true)} style={selSt} />
                </label>
                <label>
                    <span style={etiq}>Hasta</span>
                    <input type="date" value={filtros.fecha_fin} onChange={e => cambiar('fecha_fin', e.target.value, true)} style={selSt} />
                </label>
                {hayFiltros && (
                    <button type="button" onClick={limpiar} style={{ ...selSt, cursor: 'pointer', fontFamily: "'Bebas Neue'", letterSpacing: '.14em', color: mut }}>LIMPIAR</button>
                )}
            </div>

            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 18, overflow: 'hidden', boxShadow: cardSh }}>
                {loading ? (
                    <p style={{ padding: 60, textAlign: 'center', fontFamily: "'Outfit'", color: mut }}>Cargando historial…</p>
                ) : productos.length === 0 ? (
                    <p style={{ padding: 60, textAlign: 'center', fontFamily: "'Outfit'", color: mut }}>
                        {hayFiltros ? 'No hay productos con esos filtros.' : 'Todavía no se ha creado ningún producto.'}
                    </p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
                            <thead>
                                <tr style={{ background: headBg, borderBottom: `1px solid ${bdr}` }}>
                                    {['Fecha', 'Producto', 'Origen', 'Detalle', 'Creado por', 'Stock hoy', ''].map(h => <th key={h} style={th}>{h}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {productos.map(p => {
                                    const o = ORIGEN_CREACION[p.origen] || ORIGEN_CREACION.manual;
                                    return (
                                        <tr key={p.id}>
                                            <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                                {p.created_at ? new Date(p.created_at).toLocaleDateString('es-EC') : '—'}
                                                <div style={{ fontSize: '.75rem', color: mut }}>{p.created_at ? new Date(p.created_at).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' }) : ''}</div>
                                            </td>
                                            <td style={td}>
                                                <div style={{ color: txt, fontWeight: 600 }}>{p.nombre}</div>
                                                <div style={{ fontSize: '.75rem', color: mut, marginTop: 2 }}>
                                                    <span style={{ fontFamily: 'monospace', color: SKY_DEEP }}>{p.codigo}</span>
                                                    {p.codigo_proveedor && <> · Prov.: {p.codigo_proveedor}</>}
                                                    {' · '}{AREA_LABEL[p.area] || p.area}
                                                    {p.categoria_nombre && <> · {p.categoria_nombre}</>}
                                                </div>
                                                {!p.activo && <span style={{ display: 'inline-block', marginTop: 4, fontSize: '.68rem', fontFamily: "'Bebas Neue'", letterSpacing: '.14em', color: '#ef4444' }}>DADO DE BAJA</span>}
                                            </td>
                                            <td style={td}>
                                                <span style={{ display: 'inline-block', whiteSpace: 'nowrap', fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em',
                                                    color: o.color, background: `${o.color}1a`, border: `1px solid ${o.color}55`, borderRadius: 999, padding: '3px 10px' }}>{o.label}</span>
                                            </td>
                                            <td style={td}>
                                                {p.origen === 'factura_compra' ? (
                                                    <>
                                                        <div>Factura <b style={{ color: txt }}>{p.factura_numero || '—'}</b></div>
                                                        <div style={{ fontSize: '.78rem', color: mut }}>
                                                            {p.proveedor_nombre || 'Proveedor'}{p.cantidad_ingresada != null && <> · ingresó {fmtCant(p.cantidad_ingresada)} {p.unidad_medida}</>}
                                                            {p.costo_unitario != null && <> · costo {dinero(p.costo_unitario)}</>}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div style={{ fontSize: '.8rem', color: mut }}>
                                                        Desde Inventario · P. venta {dinero(p.precio_venta)}
                                                    </div>
                                                )}
                                            </td>
                                            <td style={td}>{p.usuario_nombre || <span style={{ color: mut }}>Registro anterior (sin usuario)</span>}</td>
                                            <td style={{ ...td, whiteSpace: 'nowrap' }}><b style={{ color: txt }}>{fmtCant(p.stock_actual)}</b> <span style={{ color: mut }}>{p.unidad_medida}</span></td>
                                            <td style={{ ...td, whiteSpace: 'nowrap' }}>
                                                <Link to={`/dashboard/movimientos?repuesto_id=${p.id}`} style={{ color: SKY_DEEP, fontSize: '.78rem', fontWeight: 600 }}>
                                                    Ver movimientos
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Paginacion (siempre visible) */}
                {!loading && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '14px 18px', borderTop: `1px solid ${bdr}`, background: headBg }}>
                        <span style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: txtSf }}>
                            Mostrando <b style={{ color: txt }}>{desde}–{hasta}</b> de <b style={{ color: txt }}>{total}</b>
                            <span style={{ color: mut }}> · Página {page} de {totalPages}</span>
                        </span>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} role="navigation" aria-label="Paginación del historial">
                            <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => cargar(filtros, page - 1)} style={btnPag(false, page <= 1)}>‹</button>
                            {paginas(page, totalPages).map((n, i) => n === '…'
                                ? <span key={`e${i}`} style={{ color: mut, padding: '0 4px' }}>…</span>
                                : <button key={n} type="button" aria-current={n === page ? 'page' : undefined} onClick={() => n !== page && cargar(filtros, n)}
                                    style={{ ...btnPag(n === page, false), ...(n === page ? {} : { background: 'transparent' }) }}
                                    onMouseEnter={e => { if (n !== page) e.currentTarget.style.background = SKY_PALE; }}
                                    onMouseLeave={e => { if (n !== page) e.currentTarget.style.background = 'transparent'; }}>{n}</button>)}
                            <button type="button" aria-label="Página siguiente" disabled={page >= totalPages} onClick={() => cargar(filtros, page + 1)} style={btnPag(false, page >= totalPages)}>›</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
