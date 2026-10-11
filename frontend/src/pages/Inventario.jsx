/**
 * SS SWAP - Módulo de Inventario de Repuestos
 * Gestión completa del catálogo de repuestos: búsqueda multi-criterio, filtros por categoría
 * y nivel de stock, exportación a CSV, creación/edición de repuestos con foto comprimida
 * y registro de movimientos de entrada/salida directamente desde la ficha del repuesto.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import useParamUrl from '../hooks/useParamUrl';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import ModalRepuesto from '../components/inventory/ModalRepuesto';
import ModalMovimiento from '../components/inventory/ModalMovimiento';
import ModalCategorias from '../components/inventory/ModalCategorias';
import { useConfirm } from '../components/common/ConfirmDialog';
import { stockBajo, areaConAlerta } from '../utils/stock';
import './Inventario.css';

function IconSearch() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconPlus()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconDownload(){ return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>; }
function IconEdit()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconTrash()  { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>; }
function IconArrows() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>; }
function IconPkg()    { return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>; }
function IconBox()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>; }
function IconAlert()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function IconCash()   { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>; }
function IconTag()    { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>; }
function IconAlertTri() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>; }
function IconXSm()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }

/* ── Modal de alerta de stock bajo (dismissible) ── */
function StockAlertModal({ repuestos, onCerrar, onIrAAlertas, isDark }) {
    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onCerrar()}>
            <div style={{
                maxWidth: 520, width: '92%',
                background: isDark ? '#0a0f1c' : '#ffffff',
                border: '1px solid ' + (isDark ? 'rgba(239,68,68,.25)' : 'rgba(239,68,68,.18)'),
                borderRadius: 18, padding: 28,
                position: 'relative', overflow: 'hidden',
                boxShadow: isDark
                    ? '0 20px 60px -16px rgba(0,0,0,0.7), 0 0 0 1px rgba(239,68,68,.1) inset'
                    : '0 20px 60px -16px rgba(15,23,42,0.25), 0 0 0 1px rgba(239,68,68,.08) inset',
                animation: 'fadeIn .25s ease',
            }}>
                {/* Accent line */}
                <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: 'linear-gradient(90deg, transparent, #ef4444, #dc2626, #ef4444, transparent)',
                    borderRadius: '18px 18px 0 0',
                }} />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 44, height: 44, borderRadius: 12,
                            background: 'rgba(239,68,68,.1)',
                            border: '1px solid rgba(239,68,68,.2)',
                            color: '#ef4444',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            animation: 'alertPulse 2s ease-in-out infinite',
                        }}>
                            <IconAlertTri />
                        </div>
                        <div>
                            <p style={{
                                fontFamily: "'Bebas Neue', sans-serif",
                                fontSize: '1.1rem', letterSpacing: '.04em',
                                color: isDark ? '#f1f5f9' : '#0f172a',
                                lineHeight: 1,
                            }}>Stock Bajo Detectado</p>
                            <p style={{
                                fontFamily: "'Outfit', sans-serif",
                                fontSize: '.78rem', color: isDark ? 'rgba(241,245,249,.55)' : '#64748b',
                                marginTop: 4,
                            }}>
                                {repuestos.length} repuesto{repuestos.length !== 1 ? 's' : ''} necesita{repuestos.length === 1 ? '' : 'n'} atencion
                            </p>
                        </div>
                    </div>
                    <button onClick={onCerrar}
                        style={{
                            background: 'none', border: '1px solid ' + (isDark ? 'rgba(148,163,184,.18)' : '#b6c3d3'),
                            borderRadius: 8, padding: 6, cursor: 'pointer',
                            color: isDark ? 'rgba(241,245,249,.55)' : '#64748b',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all .15s', flexShrink: 0,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = isDark ? 'rgba(241,245,249,.55)' : '#64748b'; e.currentTarget.style.borderColor = isDark ? 'rgba(148,163,184,.18)' : '#b6c3d3'; }}>
                        <IconXSm />
                    </button>
                </div>

                {/* List of low stock products */}
                <div style={{ maxHeight: 260, overflowY: 'auto', marginBottom: 18 }}>
                    {repuestos.map((r, i) => (
                        <div key={r.id} style={{
                            display: 'flex', alignItems: 'center', gap: 12,
                            padding: '10px 12px', borderRadius: 10,
                            background: i % 2 === 0 ? (isDark ? 'rgba(255,255,255,.02)' : 'rgba(239,68,68,.02)') : 'transparent',
                            marginBottom: 4,
                        }}>
                            <code style={{
                                fontFamily: 'monospace', fontSize: '.72rem', fontWeight: 600,
                                background: isDark ? 'rgba(14,165,233,.1)' : 'rgba(14,165,233,.05)',
                                padding: '2px 8px', borderRadius: 5,
                                color: '#0284c7', border: '1px solid ' + (isDark ? 'rgba(56,189,248,.22)' : 'rgba(14,165,233,0.35)'),
                                flexShrink: 0,
                            }}>{r.codigo}</code>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{
                                    fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: '.82rem',
                                    color: isDark ? '#f1f5f9' : '#0f172a',
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}>{r.nombre}</p>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', color: '#ef4444', lineHeight: 1 }}>{r.stock_actual}</p>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.62rem', color: isDark ? 'rgba(241,245,249,.4)' : '#94a3b8' }}>min {r.stock_minimo}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid ' + (isDark ? 'rgba(148,163,184,.12)' : '#b6c3d3'), paddingTop: 16 }}>
                    <button onClick={onCerrar}
                        style={{
                            fontFamily: "'Bebas Neue'", fontSize: '.7rem', letterSpacing: '.14em',
                            background: 'none', border: '1px solid ' + (isDark ? 'rgba(148,163,184,.18)' : '#b6c3d3'),
                            borderRadius: 9, padding: '9px 18px', cursor: 'pointer',
                            color: isDark ? 'rgba(241,245,249,.55)' : '#64748b',
                            transition: 'all .18s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(56,189,248,.25)' : 'rgba(14,165,233,.25)'; e.currentTarget.style.color = isDark ? '#f1f5f9' : '#0f172a'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(148,163,184,.18)' : '#b6c3d3'; e.currentTarget.style.color = isDark ? 'rgba(241,245,249,.55)' : '#64748b'; }}>
                        IGNORAR
                    </button>
                    <button onClick={onIrAAlertas}
                        style={{
                            fontFamily: "'Bebas Neue'", fontSize: '.75rem', letterSpacing: '.14em',
                            background: 'linear-gradient(135deg, #dc2626, #ef4444)',
                            border: 'none', borderRadius: 9, padding: '9px 20px', cursor: 'pointer',
                            color: '#fff',
                            boxShadow: '0 6px 18px -6px rgba(239,68,68,.55)',
                            transition: 'all .2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 10px 24px -8px rgba(239,68,68,.65)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 6px 18px -6px rgba(239,68,68,.55)'; }}>
                        VER ALERTAS
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Inventario() {
    const confirm = useConfirm();
    const { puede }  = useAuth();
    const { isDark }    = useTheme();

    // Helpers de formato y normalización de texto/imagen
    const normalizarTexto = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const numero = (v) => parseFloat(v) || 0;
    const getImagenSrc = (r = {}) => {
        const src = r.imagen_url || r.imagen || r.foto_url || r.foto || '';
        if (!src) return '';
        if (/^(data:image\/|blob:|https?:\/\/)/i.test(src)) return src;
        const base = (process.env.REACT_APP_API_URL || '/api').replace(/\/api\/?$/i, '').replace(/\/$/, '') || window.location.origin;
        return src.startsWith('/') ? `${base}${src}` : `${base}/${src.replace(/^\/+/, '')}`;
    };
    const [repuestos,   setRepuestos]   = useState([]);
    const [categorias,  setCategorias]  = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [busqueda,    setBusqueda]    = useState('');
    const [filtroCateg, setFiltroCateg] = useState('');
    const [soloAlerta,  setSoloAlerta]  = useState(false);
    const [modalRep,    setModalRep]    = useState({ open: false, data: null });
    const [modalMov,    setModalMov]    = useState({ open: false, repuesto: null });
    const [modalCat,    setModalCat]    = useState(false);
    const [sortConfig,  setSortConfig]  = useState({ key: 'nombre', direction: 'asc' });
    const [seleccionados, setSeleccionados] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [bulkCategoria, setBulkCategoria] = useState('');
    const [bulkBusy, setBulkBusy] = useState(false);
    const debounceRef = useRef(null);
    // Sprint 14: dos inventarios sobre el mismo catalogo (columna repuestos.area)
    // El area se lee de la URL (?area=colisiones): el submenu Inventario >
    // Colisiones / Pintura abre directamente ese inventario.
    const [areaUrl, setAreaUrl] = useParamUrl('area', 'mecanica', ['mecanica', 'colisiones']);
    const [area, setArea] = useState(areaUrl);
    const areaRef = useRef(areaUrl);

    // Permisos del AREA que se esta viendo (inventario_mecanica / inventario_colisiones).
    // Solo deciden que botones se muestran: el backend valida cada operacion.
    const moduloArea   = (a) => (a === 'colisiones' ? 'inventario_colisiones' : 'inventario_mecanica');
    const puedeCrear    = puede(moduloArea(area), 'crear');
    const puedeEditar   = puede(moduloArea(area), 'editar');
    const puedeEliminar = puede(moduloArea(area), 'eliminar');
    const puedeMov      = puede('registros_inventario', 'crear');
    const areasVisibles = ['mecanica', 'colisiones'].filter(a => puede(moduloArea(a), 'ver'));
    const [showAlertModal, setShowAlertModal] = useState(false);
    const [bajoStockList, setBajoStockList] = useState([]);
    const alertaInicialRef = useRef(false);

    // ── Paleta celeste / blanco / negro ──
    const SKY      = '#0ea5e9';   // sky-500 (acento principal)
    const SKY_DEEP = '#0284c7';   // sky-600
    const SKY_SOFT = '#7dd3fc';   // sky-300
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.12)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.35)';

    const txt     = isDark ? '#f1f5f9'                    : '#0f172a';
    const txtSoft = isDark ? '#cbd5e1'                    : '#334155';
    const mut     = isDark ? 'rgba(241,245,249,0.55)'     : '#64748b';
    const faint   = isDark ? 'rgba(241,245,249,0.38)'     : '#94a3b8';
    const bdr     = isDark ? 'rgba(148,163,184,0.18)'     : '#b6c3d3';
    const card    = isDark ? 'rgba(255,255,255,0.025)'    : '#ffffff';
    const cardSh  = isDark
        ? '0 1px 0 rgba(255,255,255,0.04) inset, 0 10px 40px -16px rgba(0,0,0,0.55)'
        : '0 1px 2px rgba(15,23,42,0.06), 0 8px 22px -8px rgba(15,23,42,0.20)';
    const inputBg = isDark ? '#0b1220'                    : '#fafcff';
    const rowHov  = isDark ? 'rgba(14,165,233,0.06)'      : 'rgba(14,165,233,0.04)';
    const headBg  = isDark ? 'rgba(14,165,233,0.06)'      : 'rgba(14,165,233,0.12)';

    const cargarRepuestos = useCallback(async (q = '', catId = '', alerta = false, pg = 1) => {
        setLoading(true);
        setPage(pg);
        try {
            const params = new URLSearchParams();
            if (q)      params.set('q', q);
            if (catId)  params.set('categoria_id', catId);
            if (alerta) params.set('bajo_stock', 'true');
            params.set('area', areaRef.current);
            params.set('page', pg);
            params.set('limit', 15);
            const { data } = await api.get(`/inventory/repuestos?${params}`);
            setRepuestos(data.repuestos || []);
            setTotalPages(data.totalPages || 1);
            setSeleccionados([]);
        } catch { toast.error('Error al cargar repuestos.'); }
        finally { setLoading(false); }
    }, []);

    const cargarCategorias = useCallback((a) => {
        api.get(`/inventory/categorias?area=${a}`).then(r => setCategorias(r.data.categorias || [])).catch(() => {});
    }, []);

    useEffect(() => {
        cargarRepuestos();
        cargarCategorias(areaRef.current);
    }, [cargarRepuestos, cargarCategorias]);

    useEffect(() => {
        if (areasVisibles.length && !areasVisibles.includes(areaUrl)) setAreaUrl(areasVisibles[0]);
        // eslint-disable-next-line
    }, [areaUrl, areasVisibles.join(',')]);

    // Si la URL cambia (menu lateral o boton), se aplica el area
    useEffect(() => {
        if (areaUrl !== areaRef.current) cambiarArea(areaUrl);
        // eslint-disable-next-line
    }, [areaUrl]);

    const cambiarArea = (nueva) => {
        if (nueva === areaRef.current) return;
        areaRef.current = nueva;
        setArea(nueva);
        setFiltroCateg('');
        setBulkCategoria('');
        cargarCategorias(nueva);
        // Colisiones/Pintura no tiene alertas de stock: se quita el filtro "Solo bajo stock".
        const alerta = soloAlerta && areaConAlerta(nueva);
        if (!alerta) setSoloAlerta(false);
        cargarRepuestos(busqueda, '', alerta, 1);
    };

    // Show low stock alert modal only on initial page load
    useEffect(() => {
        if (!loading && repuestos.length > 0 && !alertaInicialRef.current) {
            const bajos = repuestos.filter(stockBajo);
            if (bajos.length > 0) {
                setBajoStockList(bajos);
                setShowAlertModal(true);
                alertaInicialRef.current = true;
            }
        }
    }, [loading, repuestos]);

    const repuestosOrdenados = useMemo(() => {
        const lista = [...repuestos];
        if (!sortConfig.key) return lista;

        const getters = {
            nombre: (r) => normalizarTexto(r.nombre),
            stock:  (r) => numero(r.stock_actual),
            precio: (r) => numero(r.precio_venta),
        };

        lista.sort((a, b) => {
            const aVal = getters[sortConfig.key]?.(a);
            const bVal = getters[sortConfig.key]?.(b);
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
            return normalizarTexto(a.nombre).localeCompare(normalizarTexto(b.nombre));
        });

        return lista;
    }, [repuestos, sortConfig]);

    const idsVisibles = useMemo(() => repuestosOrdenados.map(r => r.id), [repuestosOrdenados]);
    const seleccionadosData = useMemo(() => repuestos.filter(r => seleccionados.includes(r.id)), [repuestos, seleccionados]);
    const todosSeleccionados = idsVisibles.length > 0 && idsVisibles.every(id => seleccionados.includes(id));

    const handleBusqueda = (e) => {
        const val = e.target.value;
        setBusqueda(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => cargarRepuestos(val, filtroCateg, soloAlerta, 1), 300);
    };

    const handleFiltroCateg = (e) => { setFiltroCateg(e.target.value); cargarRepuestos(busqueda, e.target.value, soloAlerta, 1); };
    const handleSoloAlerta  = (e) => { setSoloAlerta(e.target.checked); cargarRepuestos(busqueda, filtroCateg, e.target.checked, 1); };
    const limpiarFiltros    = () => { setBusqueda(''); setFiltroCateg(''); setSoloAlerta(false); cargarRepuestos('', '', false, 1); };
    const hayFiltros = Boolean(busqueda || filtroCateg || soloAlerta);
    const nombreCateg = categorias.find(c => String(c.id) === String(filtroCateg))?.nombre;

    const handleSort = (key) => {
        setSortConfig(prev => ({
            key,
            direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const toggleSeleccion = (id) => {
        setSeleccionados(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
    };

    const toggleSeleccionVisible = () => {
        setSeleccionados(prev => {
            if (todosSeleccionados) return prev.filter(id => !idsVisibles.includes(id));
            return Array.from(new Set([...prev, ...idsVisibles]));
        });
    };

    const buildPayloadRepuesto = (repuesto, overrides = {}) => ({
        codigo: repuesto.codigo || '',
        nombre: repuesto.nombre || '',
        descripcion: repuesto.descripcion || '',
        categoria_id: repuesto.categoria_id || '',
        precio_compra: repuesto.precio_compra ?? 0,
        precio_venta: repuesto.precio_venta ?? 0,
        stock_actual: repuesto.stock_actual ?? 0,
        stock_minimo: repuesto.stock_minimo ?? 0,
        unidad_medida: repuesto.unidad_medida || 'unidad',
        area: repuesto.area || areaRef.current,
        activo: repuesto.activo !== false,
        imagen_url: getImagenSrc(repuesto),
        ...overrides,
    });

    const rowsCSV = (items) => {
        const rows = [['Referencia interna','Codigo proveedor','Nombre','Categoria','Stock Actual','Stock Minimo','Precio Compra','Precio Venta','Estado']];
        items.forEach(r => rows.push([
            r.codigo,
            r.codigo_proveedor || '',
            r.nombre,
            r.categoria_nombre || '',
            r.stock_actual,
            r.stock_minimo,
            r.precio_compra,
            r.precio_venta,
            r.activo !== false ? 'Activo' : 'Inactivo',
        ]));
        return rows.map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    };

    const descargarCSV = (items, nombreArchivo) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([rowsCSV(items)], { type: 'text/csv;charset=utf-8;' }));
        a.download = nombreArchivo;
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const exportCSV = () => {
        descargarCSV(repuestosOrdenados, `inventario_${new Date().toISOString().slice(0,10)}.csv`);
    };

    const exportSeleccion = () => {
        if (seleccionadosData.length === 0) return;
        descargarCSV(seleccionadosData, `inventario_seleccion_${new Date().toISOString().slice(0,10)}.csv`);
    };

    const ejecutarBulkUpdate = async (overridesFactory, mensaje) => {
        if (seleccionadosData.length === 0) return;
        setBulkBusy(true);
        try {
            await Promise.all(seleccionadosData.map(r => api.put(`/inventory/repuestos/${r.id}`, buildPayloadRepuesto(r, overridesFactory(r)))));
            toast.success(mensaje);
            setSeleccionados([]);
            setBulkCategoria('');
            cargarRepuestos(busqueda, filtroCateg, soloAlerta, page);
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo aplicar la accion en lote.');
        } finally {
            setBulkBusy(false);
        }
    };

    const handleBulkActivo = (activo) => ejecutarBulkUpdate(() => ({ activo }), activo ? 'Repuestos activados.' : 'Repuestos desactivados.');

    const handleBulkCategoria = () => {
        if (!bulkCategoria) { toast.error('Selecciona una categoria para aplicar.'); return; }
        const categoria_id = bulkCategoria === '__none__' ? '' : bulkCategoria;
        ejecutarBulkUpdate(() => ({ categoria_id }), 'Categoria actualizada para la seleccion.');
    };

    const handleBulkEliminar = async () => {
        if (seleccionadosData.length === 0) return;
        if (!(await confirm({ message: `Eliminar ${seleccionadosData.length} repuesto${seleccionadosData.length !== 1 ? 's' : ''} seleccionado${seleccionadosData.length !== 1 ? 's' : ''}?` }))) return;
        setBulkBusy(true);
        try {
            await Promise.all(seleccionadosData.map(r => api.delete(`/inventory/repuestos/${r.id}`)));
            toast.success('Seleccion eliminada.');
            setSeleccionados([]);
            cargarRepuestos(busqueda, filtroCateg, soloAlerta, page);
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo eliminar la seleccion.');
        } finally {
            setBulkBusy(false);
        }
    };

    const handleGuardar = async (formData) => {
        try {
            if (modalRep.data) { await api.put(`/inventory/repuestos/${modalRep.data.id}`, formData); toast.success('Repuesto actualizado.'); }
            else                { await api.post('/inventory/repuestos', formData); toast.success('Repuesto creado.'); }
            setModalRep({ open: false, data: null });
            cargarRepuestos(busqueda, filtroCateg, soloAlerta, page);
        } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar.'); }
    };

    const handleEliminar = async (id, nombre) => {
        if (!(await confirm({ message: `Eliminar "${nombre}"?` }))) return;
        try { await api.delete(`/inventory/repuestos/${id}`); toast.success('Repuesto eliminado.'); cargarRepuestos(busqueda, filtroCateg, soloAlerta, page); }
        catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar.'); }
    };

    const handleToggleVenta = async (id) => {
        try {
            const { data } = await api.patch(`/inventory/repuestos/${id}/en-venta`);
            toast.success(data.en_venta ? '¡Puesto en venta!' : 'Quitado de venta.');
            cargarRepuestos(busqueda, filtroCateg, soloAlerta, page);
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cambiar estado.'); }
    };

    // ── KPIs computados ──
    const stats = useMemo(() => {
        const total      = repuestos.length;
        const bajo       = repuestos.filter(stockBajo).length;
        const valor      = repuestos.reduce((s, r) => s + (r.stock_actual * parseFloat(r.precio_venta || 0)), 0);
        const unidades   = repuestos.reduce((s, r) => s + (parseInt(r.stock_actual) || 0), 0);
        return { total, bajo, valor, unidades };
    }, [repuestos]);

    const inputStyle = { padding: '9px 12px 9px 32px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none', width: 220, transition: 'border-color .18s, box-shadow .18s' };
    const selStyle   = { padding: '9px 12px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 10, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none', transition: 'border-color .18s, box-shadow .18s' };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500, '--sky-bdr': SKY_BDR }}>
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 10px', borderRadius: 999, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, marginBottom: 8 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: SKY, boxShadow: `0 0 8px ${SKY}` }} />
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.24em', color: SKY_DEEP }}>SS SWAP · ALMACEN</p>
                    </div>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Inventario</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.85rem', color: mut, marginTop: 6 }}>Catalogo de repuestos y control de stock en tiempo real</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {puedeEditar && (
                    <button onClick={() => setModalCat(true)}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em',
                            color: SKY_DEEP, background: SKY_PALE, border: `1px solid ${SKY_BDR}`,
                            borderRadius: 11, padding: '11px 22px', cursor: 'pointer',
                        }}>
                        CATEGORÍAS
                    </button>
                )}
                {puedeCrear && (
                    <button onClick={() => setModalRep({ open: true, data: null })}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em',
                            color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`,
                            border: 'none', borderRadius: 11, padding: '11px 22px', cursor: 'pointer',
                            transition: 'all .22s', boxShadow: `0 6px 18px -6px ${SKY}`,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 10px 26px -8px ${SKY}`; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 6px 18px -6px ${SKY}`; }}>
                        <IconPlus /> NUEVO REPUESTO
                    </button>
                )}
                </div>
            </div>

            {/* ── Selector de inventario (Sprint 14) ── */}
            <div role="tablist" aria-label="Tipo de inventario" style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
                {[{ v: 'mecanica', t: 'Inventario Mecánica', d: 'Repuestos, filtros, baterías, eléctricos...' },
                  { v: 'colisiones', t: 'Inventario Colisiones / Pintura', d: 'Pinturas, masillas, lijas, primer, barniz...' }].filter(op => areasVisibles.includes(op.v)).map(op => {
                    const activo = area === op.v;
                    return (
                        <button key={op.v} role="tab" aria-selected={activo} onClick={() => setAreaUrl(op.v)}
                            style={{ flex: '1 1 260px', textAlign: 'left', cursor: 'pointer', borderRadius: 14, padding: '14px 18px',
                                border: `2px solid ${activo ? SKY_DEEP : bdr}`, background: activo ? SKY_PALE : card, boxShadow: activo ? 'none' : cardSh,
                                transition: 'border-color .15s, background .15s' }}>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.05rem', letterSpacing: '.08em', color: activo ? SKY_DEEP : txt }}>{op.t.toUpperCase()}</p>
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginTop: 2 }}>{op.d}</p>
                        </button>
                    );
                })}
            </div>

            {/* ── KPI Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 14, marginBottom: 20 }}>
                <KpiCard label="Total Repuestos" value={stats.total} icon={<IconBox />}      color={SKY}      bg={card} bdr={bdr} mut={mut} txt={txt} shadow={cardSh} />
                {areaConAlerta(area) && <KpiCard label="Bajo Stock"      value={stats.bajo}  icon={<IconAlert />}    color={stats.bajo > 0 ? '#ef4444' : '#10b981'} bg={card} bdr={bdr} mut={mut} txt={txt} shadow={cardSh} sub={stats.bajo > 0 ? 'Requiere atencion' : 'Todo en orden'} />}
                <KpiCard label="Unidades Totales" value={stats.unidades.toLocaleString()} icon={<IconTag />} color={SKY_DEEP} bg={card} bdr={bdr} mut={mut} txt={txt} shadow={cardSh} />
                <KpiCard label="Valor Inventario" value={`$${stats.valor.toLocaleString('en-US', { maximumFractionDigits: 0 })}`} icon={<IconCash />} color={SKY} bg={card} bdr={bdr} mut={mut} txt={txt} shadow={cardSh} sub="Precio de venta" />
            </div>

            {/* ── Toolbar ── */}
            <div style={{
                padding: 16, marginBottom: 16,
                background: card, border: `1px solid ${bdr}`, borderRadius: 14, boxShadow: cardSh,
            }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: faint, display: 'flex' }}><IconSearch /></span>
                        <input className="inv-input" placeholder="Buscar por nombre, referencia o código de proveedor..." value={busqueda} onChange={handleBusqueda} style={inputStyle} />
                    </div>
                    <select className="inv-input" value={filtroCateg} onChange={handleFiltroCateg} style={selStyle}>
                        <option value="">Todas las categorias</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    {areaConAlerta(area) && (
                    <label style={{
                        display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                        fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.82rem', color: soloAlerta ? '#ef4444' : txtSoft,
                        padding: '9px 14px', borderRadius: 10,
                        background: soloAlerta ? 'rgba(239,68,68,0.08)' : 'transparent',
                        border: `1px solid ${soloAlerta ? 'rgba(239,68,68,0.25)' : bdr}`,
                        transition: 'all .18s',
                    }}>
                        <input type="checkbox" checked={soloAlerta} onChange={handleSoloAlerta} style={{ accentColor: '#ef4444', width: 14, height: 14 }} />
                        Solo bajo stock
                    </label>
                    )}
                    <div style={{ flex: 1 }} />
                    <button onClick={exportCSV}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: 7,
                            fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em',
                            background: card, border: `1px solid ${bdr}`, borderRadius: 10,
                            padding: '9px 16px', cursor: 'pointer', color: txtSoft, transition: 'all .18s',
                            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = SKY_BDR; e.currentTarget.style.color = SKY_DEEP; e.currentTarget.style.background = SKY_PALE; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = bdr; e.currentTarget.style.color = txtSoft; e.currentTarget.style.background = card; }}>
                        <IconDownload /> EXPORTAR CSV
                    </button>
                </div>

                {/* Chips de filtros activos */}
                {hayFiltros && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${bdr}`, flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.22em', color: mut }}>FILTROS ACTIVOS</span>
                        {busqueda && (
                            <FilterChip label={`"${busqueda}"`} onRemove={() => { setBusqueda(''); cargarRepuestos('', filtroCateg, soloAlerta); }} color={SKY_DEEP} bg={SKY_PALE} bdr={SKY_BDR} />
                        )}
                        {filtroCateg && (
                            <FilterChip label={nombreCateg || 'Categoria'} onRemove={() => { setFiltroCateg(''); cargarRepuestos(busqueda, '', soloAlerta); }} color={SKY_DEEP} bg={SKY_PALE} bdr={SKY_BDR} />
                        )}
                        {soloAlerta && (
                            <FilterChip label="Bajo stock" onRemove={() => { setSoloAlerta(false); cargarRepuestos(busqueda, filtroCateg, false); }} color="#ef4444" bg="rgba(239,68,68,0.08)" bdr="rgba(239,68,68,0.25)" />
                        )}
                        <button onClick={limpiarFiltros}
                            style={{
                                marginLeft: 'auto',
                                fontFamily: "'Bebas Neue'", fontSize: '.66rem', letterSpacing: '.16em',
                                background: 'transparent', border: 'none', cursor: 'pointer',
                                color: mut, transition: 'color .15s',
                                display: 'inline-flex', alignItems: 'center', gap: 5,
                            }}
                            onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                            onMouseLeave={e => e.currentTarget.style.color = mut}>
                            LIMPIAR TODO ×
                        </button>
                    </div>
                )}
            </div>

            {/* Contador de resultados */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, paddingLeft: 4 }}>
                <span style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.82rem', color: txtSoft }}>
                    {repuestos.length} <span style={{ color: mut, fontWeight: 400 }}>repuesto{repuestos.length !== 1 ? 's' : ''}</span>
                </span>
                {!loading && totalPages > 1 && (
                    <span style={{ fontFamily: "'Outfit'", fontSize: '.76rem', color: faint }}>
                        · Pagina {page} de {totalPages}
                    </span>
                )}
                {hayFiltros && <span style={{ fontFamily: "'Outfit'", fontSize: '.76rem', color: faint }}>· filtrado</span>}
            </div>

            {/* ── Acciones en lote ── */}
            {seleccionados.length > 0 && (
                <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 13, border: `1px solid ${isDark ? 'rgba(168,85,247,.22)' : 'rgba(124,58,237,.18)'}`, background: isDark ? 'rgba(168,85,247,.055)' : 'rgba(124,58,237,.05)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'Bebas Neue'", letterSpacing: '.12em', fontSize: '.78rem', color: '#a855f7' }}>
                        {seleccionados.length} seleccionado{seleccionados.length !== 1 ? 's' : ''}
                    </span>
                    <button className="btn-ghost" disabled={bulkBusy} onClick={exportSeleccion}><IconDownload /> Exportar seleccion</button>

                    {puedeEditar && (
                        <>
                            <button className="btn-ghost" disabled={bulkBusy} onClick={() => handleBulkActivo(true)}>Activar</button>
                            <button className="btn-ghost" disabled={bulkBusy} onClick={() => handleBulkActivo(false)}>Desactivar</button>
                            <select value={bulkCategoria} onChange={e => setBulkCategoria(e.target.value)} style={selStyle} disabled={bulkBusy}>
                                <option value="">Cambiar categoria...</option>
                                <option value="__none__">Sin categoria</option>
                                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                            <button className="btn-ghost" disabled={bulkBusy} onClick={handleBulkCategoria}>Aplicar categoria</button>
                            {puedeEliminar && <button className="btn-ghost" disabled={bulkBusy} onClick={handleBulkEliminar} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,.25)' }}><IconTrash /> Eliminar</button>}
                        </>
                    )}
                    <button className="btn-ghost" disabled={bulkBusy} onClick={() => setSeleccionados([])}>Limpiar seleccion</button>
                </div>
            )}

            {/* ── Tabla ── */}
            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, overflow: 'hidden', boxShadow: cardSh }}>
                {loading ? (
                    <div style={{ padding: 80, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 38, height: 38, borderRadius: '50%', border: `2px solid ${bdr}`, borderTopColor: SKY, animation: 'spin 1s linear infinite' }} />
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.85rem', color: mut }}>Cargando inventario...</p>
                    </div>
                ) : repuestos.length === 0 ? (
                    <div style={{ padding: 90, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                        <div style={{ width: 72, height: 72, borderRadius: 20, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: SKY }}><IconPkg /></div>
                        <div>
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.06em', color: txt }}>Sin repuestos</p>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut, marginTop: 4 }}>No se encontraron resultados con los filtros aplicados</p>
                        </div>
                        {puedeCrear && (
                            <button onClick={() => setModalRep({ open: true, data: null })}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Bebas Neue'", fontSize: '.75rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 20px', cursor: 'pointer', boxShadow: `0 6px 18px -6px ${SKY}` }}>
                                <IconPlus /> CREAR PRIMERO
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 880 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${bdr}`, background: headBg }}>
                                    {['Referencia','Repuesto','Categoria','Stock','P. Venta','Estado','Acciones'].map(h => (
                                        <th key={h} style={{
                                            padding: '13px 18px', textAlign: 'left',
                                            fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em',
                                            color: SKY_DEEP, whiteSpace: 'nowrap',
                                        }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {repuestos.map((r, idx) => {
                                    const conAlerta = areaConAlerta(r.area);
                                    const bajo  = stockBajo(r);
                                    const medio = conAlerta && r.stock_actual < r.stock_minimo * 2;
                                    const limit = Math.max(r.stock_minimo * 4, 50);
                                    const pct   = Math.min(100, Math.round((r.stock_actual / limit) * 100));
                                    const stockColor = bajo ? '#ef4444' : medio ? '#f59e0b' : '#10b981';
                                    return (
                                        <tr key={r.id} className="inv-row"
                                            style={{ borderBottom: `1px solid ${bdr}`, transition: 'background .15s', animationDelay: `${Math.min(idx * 18, 240)}ms` }}
                                            onMouseEnter={e => e.currentTarget.style.background = rowHov}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '13px 18px' }}>
                                                <code style={{
                                                    fontFamily: 'monospace', fontSize: '.76rem', fontWeight: 600,
                                                    background: SKY_PALE, padding: '3px 9px', borderRadius: 6,
                                                    color: SKY_DEEP, border: `1px solid ${SKY_BDR}`,
                                                }}>{r.codigo}</code>
                                                {r.codigo_proveedor && <span title="Código de proveedor / fabricante" style={{ display: 'block', marginTop: 4, fontFamily: "'Outfit'", fontSize: '.68rem', color: mut }}>Prov.: {r.codigo_proveedor}</span>}
                                            </td>
                                            <td style={{ padding: '13px 18px', maxWidth: 260 }}>
                                                <p style={{ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.92rem', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '.005em' }}>{r.nombre}</p>
                                                {r.descripcion && <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.72rem', color: mut, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descripcion}</p>}
                                            </td>
                                            <td style={{ padding: '13px 18px', whiteSpace: 'nowrap' }}>
                                                {r.categoria_nombre
                                                    ? <span style={{ fontFamily: "'Outfit'", fontWeight: 500, fontSize: '.76rem', color: txtSoft, padding: '3px 10px', borderRadius: 999, background: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)', border: `1px solid ${bdr}` }}>{r.categoria_nombre}</span>
                                                    : <span style={{ color: mut, fontSize: '.8rem' }}>—</span>}
                                            </td>
                                            <td style={{ padding: '13px 18px', minWidth: 150 }}>
                                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.25rem', letterSpacing: '.02em', color: stockColor, lineHeight: 1 }}>{r.stock_actual}</span>
                                                    <span style={{ fontFamily: "'Outfit'", fontSize: '.68rem', color: mut, fontWeight: 400 }}>/ min {r.stock_minimo}</span>
                                                </div>
                                                <div style={{ marginTop: 5, height: 4, background: isDark ? 'rgba(148,163,184,0.12)' : '#b6c3d3', borderRadius: 999, overflow: 'hidden' }}>
                                                    <div className="inv-stock-bar" style={{
                                                        width: `${pct}%`, height: '100%',
                                                        background: bajo
                                                            ? 'linear-gradient(90deg, #dc2626, #ef4444)'
                                                            : medio
                                                                ? 'linear-gradient(90deg, #d97706, #f59e0b)'
                                                                : `linear-gradient(90deg, ${SKY_DEEP}, ${SKY})`,
                                                        borderRadius: 999,
                                                    }} />
                                                </div>
                                            </td>
                                            <td style={{ padding: '13px 18px', whiteSpace: 'nowrap' }}>
                                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.03em', color: SKY_DEEP }}>${parseFloat(r.precio_venta).toFixed(2)}</span>
                                            </td>
                                            <td style={{ padding: '13px 18px' }}>
                                                {bajo ? (
                                                    <span className="inv-alert-dot" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.14em', padding: '4px 10px', borderRadius: 999, background: 'rgba(239,68,68,.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,.25)' }}>
                                                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444' }} /> ALERTA
                                                    </span>
                                                ) : r.activo ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.14em', padding: '4px 10px', borderRadius: 999, background: 'rgba(16,185,129,.08)', color: '#10b981', border: '1px solid rgba(16,185,129,.22)' }}>
                                                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} /> ACTIVO
                                                    </span>
                                                ) : (
                                                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.14em', padding: '4px 10px', borderRadius: 999, background: 'rgba(148,163,184,.1)', color: mut, border: `1px solid ${bdr}` }}>INACTIVO</span>
                                                )}
                                                {r.en_venta && (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 4, fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.12em', padding: '3px 8px', borderRadius: 999, background: 'rgba(201,162,39,.1)', color: '#c9a227', border: '1px solid rgba(201,162,39,.28)' }}>
                                                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                                                        EN VENTA
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '13px 18px' }}>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {puedeMov && (
                                                        <ActionBtn color={SKY} hoverBg={SKY_PALE} bdr={bdr} title="Registrar movimiento"
                                                            onClick={() => setModalMov({ open: true, repuesto: r })}>
                                                            <IconArrows />
                                                        </ActionBtn>
                                                    )}
                                                    {puedeEditar && (
                                                        <ActionBtn color={SKY_DEEP} hoverBg={SKY_PALE} bdr={bdr} title="Editar"
                                                            onClick={() => setModalRep({ open: true, data: r })}>
                                                            <IconEdit />
                                                        </ActionBtn>
                                                    )}
                                                    {puedeEliminar && (
                                                        <ActionBtn color="#ef4444" hoverBg="rgba(239,68,68,.1)" bdr={bdr} title="Eliminar"
                                                            onClick={() => handleEliminar(r.id, r.nombre)}>
                                                            <IconTrash />
                                                        </ActionBtn>
                                                    )}
                                                    {puedeEditar && (
                                                        <ActionBtn
                                                            color={r.en_venta ? '#10b981' : mut}
                                                            hoverBg={r.en_venta ? 'rgba(16,185,129,.1)' : 'rgba(255,255,255,.06)'}
                                                            bdr={bdr}
                                                            title={r.en_venta ? 'Quitar de venta' : 'Poner en venta'}
                                                            onClick={() => handleToggleVenta(r.id)}>
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                                                        </ActionBtn>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>

                        {/* ── Paginacion ── */}
                        {totalPages > 1 && (
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: 6, padding: '16px 18px',
                                borderTop: `1px solid ${bdr}`,
                                background: headBg,
                            }}>
                                <PageBtn
                                    disabled={page <= 1}
                                    onClick={() => cargarRepuestos(busqueda, filtroCateg, soloAlerta, page - 1)}
                                    bdr={bdr} txtSoft={txtSoft} mut={mut}
                                    isDark={isDark} SKY={SKY} SKY_BDR={SKY_BDR} SKY_PALE={SKY_PALE}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
                                </PageBtn>

                                {generarPaginas(page, totalPages).map((p, i) =>
                                    p === '...' ? (
                                        <span key={`e${i}`} style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, padding: '0 4px' }}>...</span>
                                    ) : (
                                        <PageNumBtn
                                            key={p}
                                            active={p === page}
                                            onClick={() => cargarRepuestos(busqueda, filtroCateg, soloAlerta, p)}
                                            isDark={isDark} SKY={SKY} SKY_DEEP={SKY_DEEP} SKY_PALE={SKY_PALE} txt={txt} mut={mut} bdr={bdr}
                                        >
                                            {p}
                                        </PageNumBtn>
                                    )
                                )}

                                <PageBtn
                                    disabled={page >= totalPages}
                                    onClick={() => cargarRepuestos(busqueda, filtroCateg, soloAlerta, page + 1)}
                                    bdr={bdr} txtSoft={txtSoft} mut={mut}
                                    isDark={isDark} SKY={SKY} SKY_BDR={SKY_BDR} SKY_PALE={SKY_PALE}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
                                </PageBtn>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modales */}
            {modalCat && <ModalCategorias onCambio={() => { cargarCategorias(areaRef.current); cargarRepuestos(busqueda, filtroCateg, soloAlerta, page); }} onCerrar={() => setModalCat(false)} />}
            {modalRep.open && <ModalRepuesto repuesto={modalRep.data} categorias={categorias} areaInicial={area} onGuardar={handleGuardar} onCerrar={() => setModalRep({ open: false, data: null })} />}
            {modalMov.open && <ModalMovimiento repuesto={modalMov.repuesto} onGuardado={() => {            setModalMov({ open: false, repuesto: null }); cargarRepuestos(busqueda, filtroCateg, soloAlerta, page); toast.success('Movimiento registrado.'); }} onCerrar={() => setModalMov({ open: false, repuesto: null })} />}
            {showAlertModal && bajoStockList.length > 0 && (
                <StockAlertModal
                    repuestos={bajoStockList}
                    onCerrar={() => setShowAlertModal(false)}
                    onIrAAlertas={() => { setShowAlertModal(false); setSoloAlerta(true); cargarRepuestos('', '', true, 1); }}
                    isDark={isDark}
                />
            )}
        </div>
    );
}

// ── Subcomponentes ──
function KpiCard({ label, value, icon, color, bg, bdr, mut, txt, sub, shadow }) {
    return (
        <div className="inv-kpi" style={{
            padding: 18, background: bg, border: `1px solid ${bdr}`, borderRadius: 14,
            display: 'flex', alignItems: 'center', gap: 14, position: 'relative', overflow: 'hidden',
            boxShadow: shadow,
        }}>
            <div style={{
                position: 'absolute', top: 0, left: 0, width: 3, height: '100%',
                background: `linear-gradient(180deg, ${color}, transparent)`,
            }} />
            <div style={{
                width: 44, height: 44, borderRadius: 11, flexShrink: 0,
                background: `${color}14`, color: color, border: `1px solid ${color}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{icon}</div>
            <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.56rem', letterSpacing: '.22em', color: mut, marginBottom: 4 }}>{label}</p>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.02em', color: txt, lineHeight: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</p>
                {sub && <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.7rem', color, marginTop: 4, opacity: .85 }}>{sub}</p>}
            </div>
        </div>
    );
}

function FilterChip({ label, onRemove, color, bg, bdr }) {
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 4px 4px 11px', borderRadius: 999,
            background: bg, border: `1px solid ${bdr}`, color,
            fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.74rem',
            animation: 'bounceIn .25s ease',
        }}>
            {label}
            <button onClick={onRemove}
                style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
                    color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.12)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
        </span>
    );
}

/* ── Generador de numeros de pagina (con elipsis) ── */
function generarPaginas(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    if (current <= 3) {
        for (let i = 1; i <= Math.min(5, total); i++) pages.push(i);
        if (total > 5) { pages.push('...'); pages.push(total); }
    } else if (current >= total - 2) {
        pages.push(1); pages.push('...');
        for (let i = Math.max(total - 4, 2); i <= total; i++) pages.push(i);
    } else {
        pages.push(1); pages.push('...');
        pages.push(current - 1); pages.push(current); pages.push(current + 1);
        pages.push('...'); pages.push(total);
    }
    return pages;
}

/* ── Boton de pagina anterior/siguiente ── */
function PageBtn({ disabled, onClick, bdr, txtSoft, mut, isDark, SKY, SKY_BDR, SKY_PALE, children }) {
    return (
        <button disabled={disabled} onClick={onClick}
            style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 34, height: 34, borderRadius: 9,
                background: 'transparent', border: `1px solid ${bdr}`,
                color: disabled ? mut : txtSoft, cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.35 : 1,
                transition: 'all .18s',
            }}
            onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = SKY_BDR; e.currentTarget.style.color = SKY; e.currentTarget.style.background = SKY_PALE; } }}
            onMouseLeave={e => { if (!disabled) { e.currentTarget.style.borderColor = bdr; e.currentTarget.style.color = txtSoft; e.currentTarget.style.background = 'transparent'; } }}>
            {children}
        </button>
    );
}

/* ── Boton de numero de pagina ── */
function PageNumBtn({ active, onClick, isDark, SKY, SKY_DEEP, SKY_PALE, txt, mut, bdr, children }) {
    return (
        <button onClick={onClick}
            style={{
                minWidth: 34, height: 34, borderRadius: 9,
                background: active ? `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})` : 'transparent',
                border: active ? 'none' : `1px solid ${bdr}`,
                color: active ? '#fff' : txt,
                fontFamily: "'Outfit'", fontWeight: active ? 700 : 500, fontSize: '.82rem',
                cursor: 'pointer', padding: '0 8px',
                boxShadow: active ? `0 4px 12px -4px ${SKY}` : 'none',
                transition: 'all .18s',
            }}
            onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = SKY + '55'; e.currentTarget.style.background = SKY_PALE; } }}
            onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = bdr; e.currentTarget.style.background = 'transparent'; } }}>
            {children}
        </button>
    );
}

function ActionBtn({ color, hoverBg, bdr, title, onClick, children }) {
    return (
        <button onClick={onClick} title={title}
            style={{
                background: 'none', border: `1px solid ${bdr}`, borderRadius: 8,
                padding: 6, cursor: 'pointer', color, display: 'flex',
                alignItems: 'center', justifyContent: 'center', transition: 'all .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = hoverBg; e.currentTarget.style.borderColor = color + '55'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = bdr; e.currentTarget.style.transform = 'none'; }}>
            {children}
        </button>
    );
}

