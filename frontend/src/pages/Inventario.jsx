import React, { useState, useEffect, useCallback, useRef } from 'react';
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
            setRepuestos(data.repuestos);
        } catch { toast.error('Error al cargar repuestos.'); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        cargarRepuestos();
        api.get('/inventory/categorias').then(r => setCategorias(r.data.categorias)).catch(() => {});
    }, [cargarRepuestos]);

    const handleBusqueda = (e) => {
        const val = e.target.value;
        setBusqueda(val);
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => cargarRepuestos(val, filtroCateg, soloAlerta), 300);
    };

    const handleFiltroCateg = (e) => { setFiltroCateg(e.target.value); cargarRepuestos(busqueda, e.target.value, soloAlerta); };
    const handleSoloAlerta  = (e) => { setSoloAlerta(e.target.checked); cargarRepuestos(busqueda, filtroCateg, e.target.checked); };

    const exportCSV = () => {
        const rows = [['Codigo','Nombre','Categoria','Stock Actual','Stock Minimo','Precio Compra','Precio Venta']];
        repuestos.forEach(r => rows.push([r.codigo, r.nombre, r.categoria_nombre || '', r.stock_actual, r.stock_minimo, r.precio_compra, r.precio_venta]));
        const csv = rows.map(r => r.join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
        a.download = `inventario_${new Date().toISOString().slice(0,10)}.csv`;
        a.click();
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

    return (
        <div>
            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
                <div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.28em', color: isDark ? 'rgba(168,85,247,.5)' : 'rgba(124,58,237,.55)', marginBottom: 4 }}>SSWAP · Almacen</p>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.4rem', letterSpacing: '.06em', color: txt, lineHeight: 1 }}>Inventario</h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut, marginTop: 4 }}>{repuestos.length} repuesto{repuestos.length !== 1 ? 's' : ''} en catalogo</p>
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
                        <input type="checkbox" checked={soloAlerta} onChange={handleSoloAlerta} style={{ accentColor: '#a855f7', width: 14, height: 14 }} />
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

            {/* ── Tabla ── */}
            <div style={{ background: card, border: `1px solid ${bdr}`, borderRadius: 14, overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: 60, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', border: `2px solid ${bdr}`, borderTopColor: '#a855f7', animation: 'spin 1s linear infinite' }} />
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.85rem', color: mut }}>Cargando inventario...</p>
                    </div>
                ) : repuestos.length === 0 ? (
                    <div style={{ padding: 80, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                        <div style={{ width: 60, height: 60, borderRadius: 16, background: 'rgba(168,85,247,.08)', border: `1px solid ${bdr}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a855f7' }}><IconPkg /></div>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.06em', color: isDark ? 'rgba(168,85,247,.2)' : 'rgba(124,58,237,.2)' }}>Sin repuestos</p>
                        {esAdmin && <button className="btn-primary" onClick={() => setModalRep({ open: true, data: null })}><span><IconPlus /> Crear primero</span></button>}
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                            <thead>
                                <tr style={{ borderBottom: `1px solid ${bdr}`, background: isDark ? 'rgba(168,85,247,.03)' : 'rgba(124,58,237,.025)' }}>
                                    {['Codigo','Nombre','Categoria','Stock','P. Venta','Estado','Acciones'].map(h => (
                                        <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontFamily: "'Bebas Neue'", fontSize: '.6rem', letterSpacing: '.2em', color: isDark ? 'rgba(168,85,247,.55)' : 'rgba(124,58,237,.6)', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {repuestos.map(r => {
                                    const bajo = r.stock_actual <= r.stock_minimo;
                                    return (
                                        <tr key={r.id} style={{ borderBottom: `1px solid ${bdr}`, transition: 'background .12s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = isDark ? 'rgba(168,85,247,0.04)' : 'rgba(124,58,237,0.03)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                            <td style={{ padding: '10px 16px' }}>
                                                <code style={{ fontFamily: 'monospace', fontSize: '.78rem', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(100,30,180,0.07)', padding: '2px 7px', borderRadius: 5, color: isDark ? 'rgba(168,85,247,.8)' : 'rgba(124,58,237,.8)' }}>{r.codigo}</code>
                                            </td>
                                            <td style={{ padding: '10px 16px', maxWidth: 220 }}>
                                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.9rem', letterSpacing: '.04em', color: txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nombre}</p>
                                                {r.descripcion && <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.68rem', color: mut, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.descripcion}</p>}
                                            </td>
                                            <td style={{ padding: '10px 16px', fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.82rem', color: mut, whiteSpace: 'nowrap' }}>{r.categoria_nombre || '—'}</td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.1rem', letterSpacing: '.04em', color: bajo ? '#ef4444' : r.stock_actual < 20 ? '#f59e0b' : '#22c55e' }}>{r.stock_actual}</span>
                                                {bajo && <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.62rem', color: '#ef4444', marginTop: 1 }}>min. {r.stock_minimo}</p>}
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1.05rem', letterSpacing: '.04em', color: '#a855f7' }}>${parseFloat(r.precio_venta).toFixed(2)}</span>
                                            </td>
                                            <td style={{ padding: '10px 16px' }}>
                                                <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.1em', padding: '3px 9px', borderRadius: 20, background: r.activo ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)', color: r.activo ? '#22c55e' : '#ef4444', border: `1px solid ${r.activo ? 'rgba(34,197,94,.2)' : 'rgba(239,68,68,.2)'}` }}>
                                                    {r.activo ? 'ACTIVO' : 'INACTIVO'}
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
