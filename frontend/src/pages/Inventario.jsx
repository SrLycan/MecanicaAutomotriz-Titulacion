import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import ModalRepuesto from '../components/inventory/ModalRepuesto';
import ModalMovimiento from '../components/inventory/ModalMovimiento';

function IconSearch() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconPlus()   { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconDownload(){ return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>; }
function IconEdit()   { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function IconTrash()  { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>; }
function IconArrows() { return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>; }
function IconPkg()    { return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>; }
function IconImage()  { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>; }

const getApiHost = () => {
    const base = process.env.REACT_APP_API_URL || '/api';
    if (/^https?:\/\//i.test(base)) return base.replace(/\/api\/?$/i, '').replace(/\/$/, '');
    return window.location.origin;
};

const resolveImagenSrc = (value = '') => {
    const src = String(value || '').trim();
    if (!src) return '';
    if (/^(data:image\/|blob:|https?:\/\/)/i.test(src)) return src;
    if (src.startsWith('/')) return `${getApiHost()}${src}`;
    return `${getApiHost()}/${src.replace(/^\/+/, '')}`;
};

const getImagenSrc = (repuesto = {}) => resolveImagenSrc(repuesto.imagen_url || repuesto.imagen || repuesto.foto_url || repuesto.foto || '');
const normalizarTexto = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const numero = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const precio = (value) => numero(value).toFixed(2);

export default function Inventario() {
    const { tieneRol }  = useAuth();
    const { isDark }    = useTheme();
    const [repuestos,   setRepuestos]   = useState([]);
    const [categorias,  setCategorias]  = useState([]);
    const [loading,     setLoading]     = useState(true);
    const [busqueda,    setBusqueda]    = useState('');
    const [filtroCateg, setFiltroCateg] = useState('');
    const [soloAlerta,  setSoloAlerta]  = useState(false);
    const [modalRep,    setModalRep]    = useState({ open: false, data: null });
    const [modalMov,    setModalMov]    = useState({ open: false, repuesto: null });
    const [sortConfig,  setSortConfig]  = useState({ key: 'nombre', direction: 'asc' });
    const [seleccionados, setSeleccionados] = useState([]);
    const [bulkCategoria, setBulkCategoria] = useState('');
    const [bulkBusy, setBulkBusy] = useState(false);
    const debounceRef = useRef(null);

    const esAdmin  = tieneRol('administrador');
    const puedeMov = tieneRol('administrador', 'tecnico');

    const txt  = isDark ? '#e2dff0' : '#160830';
    const mut  = isDark ? 'rgba(226,223,240,0.42)' : 'rgba(55,10,120,0.55)';
    const bdr  = isDark ? 'rgba(147,51,234,0.13)'  : 'rgba(100,30,180,0.16)';
    const card = isDark ? 'rgba(255,255,255,0.025)' : 'rgba(255,255,255,0.92)';
    const inputBg = isDark ? '#0a0a14' : '#f5f0ff';

    const cargarRepuestos = useCallback(async (q = '', catId = '', alerta = false) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (q)      params.set('q', q);
            if (catId)  params.set('categoria_id', catId);
            if (alerta) params.set('bajo_stock', 'true');
            const { data } = await api.get(`/inventory/repuestos?${params}`);
            setRepuestos(data.repuestos || []);
            setSeleccionados([]);
        } catch { toast.error('Error al cargar repuestos.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        cargarRepuestos();
        api.get('/inventory/categorias').then(r => setCategorias(r.data.categorias || [])).catch(() => {});
    }, [cargarRepuestos]);

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
        debounceRef.current = setTimeout(() => cargarRepuestos(val, filtroCateg, soloAlerta), 300);
    };

    const handleFiltroCateg = (e) => { setFiltroCateg(e.target.value); cargarRepuestos(busqueda, e.target.value, soloAlerta); };
    const handleSoloAlerta  = (e) => { setSoloAlerta(e.target.checked); cargarRepuestos(busqueda, filtroCateg, e.target.checked); };

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
        activo: repuesto.activo !== false,
        imagen_url: getImagenSrc(repuesto),
        ...overrides,
    });

    const rowsCSV = (items) => {
        const rows = [['Codigo','Nombre','Categoria','Stock Actual','Stock Minimo','Precio Compra','Precio Venta','Estado']];
        items.forEach(r => rows.push([
            r.codigo,
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
            cargarRepuestos(busqueda, filtroCateg, soloAlerta);
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
        if (!window.confirm(`Eliminar ${seleccionadosData.length} repuesto${seleccionadosData.length !== 1 ? 's' : ''} seleccionado${seleccionadosData.length !== 1 ? 's' : ''}?`)) return;
        setBulkBusy(true);
        try {
            await Promise.all(seleccionadosData.map(r => api.delete(`/inventory/repuestos/${r.id}`)));
            toast.success('Seleccion eliminada.');
            setSeleccionados([]);
            cargarRepuestos(busqueda, filtroCateg, soloAlerta);
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
            cargarRepuestos(busqueda, filtroCateg, soloAlerta);
        } catch (err) { toast.error(err.response?.data?.error || 'Error al guardar.'); }
    };

    const handleEliminar = async (id, nombre) => {
        if (!window.confirm(`Eliminar "${nombre}"?`)) return;
        try { await api.delete(`/inventory/repuestos/${id}`); toast.success('Repuesto eliminado.'); cargarRepuestos(busqueda, filtroCateg, soloAlerta); }
        catch (err) { toast.error(err.response?.data?.error || 'Error al eliminar.'); }
    };

    const inputStyle = { padding: '8px 12px 8px 32px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 9, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none', width: 210 };
    const selStyle   = { padding: '8px 12px', background: inputBg, border: `1px solid ${bdr}`, borderRadius: 9, color: txt, fontFamily: "'Outfit'", fontSize: '.85rem', outline: 'none' };
    const thStyle    = { padding: '12px 16px', textAlign: 'left', fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.2em', color: isDark ? 'rgba(168,85,247,.55)' : 'rgba(124,58,237,.6)', whiteSpace: 'nowrap' };
    const checkboxStyle = { accentColor: '#a855f7', width: 14, height: 14, cursor: 'pointer' };

    const sortableHeader = (label, key) => (
        <th key={key} style={thStyle} aria-sort={sortConfig.key === key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
            <button type="button" onClick={() => handleSort(key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', padding: 0, color: 'inherit', font: 'inherit', letterSpacing: 'inherit', cursor: 'pointer' }}>
                {label}
                <span style={{ fontFamily: "'Outfit'", fontSize: '.62rem', color: sortConfig.key === key ? '#a855f7' : mut }}>
                    {sortConfig.key === key ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                </span>
            </button>
        </th>
    );

    return (
        <div>
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.28em', color: isDark ? 'rgba(168,85,247,.5)' : 'rgba(124,58,237,.55)', marginBottom: 4 }}>SSWAP · Almacen</p>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.4rem', letterSpacing: '.06em', color: txt, lineHeight: 1 }}>Inventario</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut, marginTop: 4 }}>{repuestosOrdenados.length} repuesto{repuestosOrdenados.length !== 1 ? 's' : ''} en catalogo</p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    {/* Busqueda */}
                    <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: mut, display: 'flex' }}><IconSearch /></span>
                        <input placeholder="Buscar repuesto..." value={busqueda} onChange={handleBusqueda} style={inputStyle}
                            onFocus={e => e.target.style.borderColor = '#a855f7'} onBlur={e => e.target.style.borderColor = bdr} />
                    </div>
                    {/* Categoria */}
                    <select value={filtroCateg} onChange={handleFiltroCateg} style={selStyle}
                        onFocus={e => e.target.style.borderColor = '#a855f7'} onBlur={e => e.target.style.borderColor = bdr}>
                        <option value="">Todas las categorias</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                    {/* Bajo stock toggle */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.82rem', color: mut }}>
                        <input type="checkbox" checked={soloAlerta} onChange={handleSoloAlerta} style={checkboxStyle} />
                        Solo bajo stock
                    </label>
                    {/* Export */}
                    <button className="btn-ghost" onClick={exportCSV}><IconDownload /> Exportar CSV</button>
                    {/* Nuevo */}
                    {esAdmin && (
                        <button className="btn-primary" onClick={() => setModalRep({ open: true, data: null })}>
                            <span><IconPlus /> Nuevo Repuesto</span>
                        </button>
                    )}
                </div>
            </div>
            <div style={{ height: 1, marginBottom: 24, background: `linear-gradient(90deg, ${isDark ? 'rgba(168,85,247,.25)' : 'rgba(124,58,237,.2)'}, transparent)` }} />

            {/* ── Acciones en lote ── */}
            {seleccionados.length > 0 && (
                <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 13, border: `1px solid ${isDark ? 'rgba(168,85,247,.22)' : 'rgba(124,58,237,.18)'}`, background: isDark ? 'rgba(168,85,247,.055)' : 'rgba(124,58,237,.05)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: "'Bebas Neue'", letterSpacing: '.12em', fontSize: '.78rem', color: '#a855f7' }}>
                        {seleccionados.length} seleccionado{seleccionados.length !== 1 ? 's' : ''}
                    </span>
                    <button className="btn-ghost" disabled={bulkBusy} onClick={exportSeleccion}><IconDownload /> Exportar seleccion</button>

                    {esAdmin && (
                        <>
                            <button className="btn-ghost" disabled={bulkBusy} onClick={() => handleBulkActivo(true)}>Activar</button>
                            <button className="btn-ghost" disabled={bulkBusy} onClick={() => handleBulkActivo(false)}>Desactivar</button>
                            <select value={bulkCategoria} onChange={e => setBulkCategoria(e.target.value)} style={selStyle} disabled={bulkBusy}>
                                <option value="">Cambiar categoria...</option>
                                <option value="__none__">Sin categoria</option>
                                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                            <button className="btn-ghost" disabled={bulkBusy} onClick={handleBulkCategoria}>Aplicar categoria</button>
                            <button className="btn-ghost" disabled={bulkBusy} onClick={handleBulkEliminar} style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,.25)' }}><IconTrash /> Eliminar</button>
                        </>
                    )}
                    <button className="btn-ghost" disabled={bulkBusy} onClick={() => setSeleccionados([])}>Limpiar seleccion</button>
                </div>
            )}

            {/* ── Tabla ── */}
            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${bdr}`, borderTopColor: '#a855f7', animation: 'spin 1s linear infinite' }} />
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.85rem', color: mut }}>Cargando inventario...</p>
                    </div>
                ) : repuestosOrdenados.length === 0 ? (
                    <div style={{ padding: 80, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(168,85,247,.08)', border: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}><IconPkg /></div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.06em', color: isDark ? 'rgba(168,85,247,.2)' : 'rgba(124,58,237,.2)' }}>Sin repuestos</p>
                        {esAdmin && <button className="btn-primary" onClick={() => setModalRep({ open: true, data: null })}><span><IconPlus /> Crear primero</span></button>}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${bdr}`, background: isDark ? 'rgba(168,85,247,.03)' : 'rgba(124,58,237,.025)' }}>
                                    <th style={{ ...thStyle, width: 38 }}>
                                        <input type="checkbox" checked={todosSeleccionados} onChange={toggleSeleccionVisible} style={checkboxStyle} aria-label="Seleccionar repuestos visibles" />
                                    </th>
                                    <th style={{ ...thStyle, width: 68 }}>Imagen</th>
                                    <th style={thStyle}>Codigo</th>
                                    {sortableHeader('Nombre', 'nombre')}
                                    <th style={thStyle}>Categoria</th>
                                    {sortableHeader('Stock', 'stock')}
                                    {sortableHeader('P. Venta', 'precio')}
                                    <th style={thStyle}>Estado</th>
                                    <th style={thStyle}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {repuestosOrdenados.map(r => {
                                    const bajo = numero(r.stock_actual) <= numero(r.stock_minimo);
                                    const imagen = getImagenSrc(r);
                                    const activo = r.activo !== false;
                                    const seleccionado = seleccionados.includes(r.id);
                                    return (
                                        <tr key={r.id} style={{ borderBottom: `1px solid ${bdr}`, transition: 'background .12s', background: seleccionado ? (isDark ? 'rgba(168,85,247,.08)' : 'rgba(124,58,237,.06)') : 'transparent' }}
                                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(168,85,247,0.04)' : 'rgba(124,58,237,0.03)'}
                                            onMouseLeave={e => e.currentTarget.style.background = seleccionado ? (isDark ? 'rgba(168,85,247,.08)' : 'rgba(124,58,237,.06)') : 'transparent'}>
                                            <td style={{ padding: '10px 16px' }}>
                                                <input type="checkbox" checked={seleccionado} onChange={() => toggleSeleccion(r.id)} style={checkboxStyle} aria-label={`Seleccionar ${r.nombre}`} />
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                {imagen ? (
                                                    <img src={imagen} alt={r.nombre} style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 10, border: `1px solid ${bdr}`, display: 'block' }} />
                                                ) : (
                                                    <div style={{ width: 44, height: 44, borderRadius: 10, border: `1px solid ${bdr}`, background: isDark ? 'rgba(255,255,255,.03)' : 'rgba(124,58,237,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: mut }}>
                                                        <IconImage />
                                                    </div>
                                                )}
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <code style={{ fontFamily: 'monospace', fontSize: '.78rem', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(100,30,180,0.07)', padding: '2px 7px', borderRadius: 5, color: isDark ? 'rgba(168,85,247,.8)' : 'rgba(124,58,237,.8)' }}>{r.codigo}</code>
                                            </td>
                                            <td style={{ padding: '10px 16px', maxWidth: 220 }}>
                                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.9rem', letterSpacing: '.04em', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</p>
                                                {r.descripcion && <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.68rem', color: mut, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descripcion}</p>}
                                            </td>
                                            <td style={{ padding: '10px 16px', fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut, whiteSpace: 'nowrap' }}>{r.categoria_nombre || '—'}</td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.04em', color: bajo ? '#ef4444' : numero(r.stock_actual) < 20 ? '#f59e0b' : '#22c55e' }}>{r.stock_actual}</span>
                                                {bajo && <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.62rem', color: '#ef4444', marginTop: 1 }}>min. {r.stock_minimo}</p>}
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.05rem', letterSpacing: '.04em', color: '#a855f7' }}>${precio(r.precio_venta)}</span>
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.1em', padding: '3px 9px', borderRadius: 20, background: activo ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: activo ? '#22c55e' : '#ef4444', border: `1px solid ${activo ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}` }}>
                                                    {activo ? 'ACTIVO' : 'INACTIVO'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    {puedeMov && (
                                                        <button className="btn-icon" style={{ color: '#a855f7' }}
                                                            onClick={() => setModalMov({ open: true, repuesto: r })}
                                                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(168,85,247,.1)'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                            title="Registrar movimiento">
                                                            <IconArrows />
                                                        </button>
                                                    )}
                                                    {esAdmin && (
                                                        <>
                                                            <button className="btn-icon" style={{ color: '#a855f7' }}
                                                                onClick={() => setModalRep({ open: true, data: r })}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(168,85,247,.1)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                                title="Editar">
                                                                <IconEdit />
                                                            </button>
                                                            <button className="btn-icon" style={{ color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}
                                                                onClick={() => handleEliminar(r.id, r.nombre)}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.1)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                                title="Eliminar">
                                                                <IconTrash />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modales */}
            {modalRep.open && <ModalRepuesto repuesto={modalRep.data} categorias={categorias} onGuardar={handleGuardar} onCerrar={() => setModalRep({ open: false, data: null })} />}
            {modalMov.open && <ModalMovimiento repuesto={modalMov.repuesto} onGuardado={() => { setModalMov({ open: false, repuesto: null }); cargarRepuestos(busqueda, filtroCateg, soloAlerta); toast.success('Movimiento registrado.'); }} onCerrar={() => setModalMov({ open: false, repuesto: null })} />}
        </div>
    );
}
