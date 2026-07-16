import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const GOLD = '#3b7bab';

const ESTADO_SOLICITUD_LABELS = {
    pendiente: { label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,.12)', bdr: 'rgba(245,158,11,.25)' },
    atendida:  { label: 'Atendida',  color: '#10b981', bg: 'rgba(16,185,129,.12)', bdr: 'rgba(16,185,129,.25)' },
    cancelada: { label: 'Cancelada', color: '#ef4444', bg: 'rgba(239,68,68,.12)',  bdr: 'rgba(239,68,68,.25)'  },
};

export default function Productos() {
    const navigate = useNavigate();
    const { usuario } = useAuth();
    const esCliente = usuario?.rol === 'cliente';

    const [productos, setProductos]   = useState([]);
    const [cargando, setCargando]     = useState(true);
    const [q, setQ]                   = useState('');
    const [categoria, setCategoria]   = useState('Todos');
    const [productoActivo, setProductoActivo] = useState(null);

    const [solicitudes, setSolicitudes] = useState([]);

    useEffect(() => {
        api.get('/inventory/publico')
            .then(r => setProductos(r.data.repuestos || []))
            .catch(() => toast.error('No se pudo cargar el catalogo de productos.'))
            .finally(() => setCargando(false));
    }, []);

    useEffect(() => {
        if (esCliente) {
            api.get('/solicitudes/mias').then(r => setSolicitudes(r.data.solicitudes || [])).catch(() => {});
        } else {
            setSolicitudes([]);
        }
    }, [esCliente]);

    useEffect(() => {
        const els = document.querySelectorAll('.reveal');
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) { e.target.classList.add('in-view'); io.unobserve(e.target); }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        els.forEach(el => io.observe(el));
        return () => io.disconnect();
    }, [cargando, productoActivo]);

    const categorias = useMemo(() => {
        const set = new Set(productos.map(p => p.categoria_nombre).filter(Boolean));
        return ['Todos', ...Array.from(set).sort()];
    }, [productos]);

    const limpiarFiltros = () => { setQ(''); setCategoria('Todos'); };

    const productosFiltrados = useMemo(() => {
        let list = productos;
        if (categoria !== 'Todos') list = list.filter(p => p.categoria_nombre === categoria);
        if (q.trim()) {
            const t = q.toLowerCase();
            list = list.filter(p => p.nombre.toLowerCase().includes(t) || (p.descripcion || '').toLowerCase().includes(t));
        }
        return list;
    }, [productos, categoria, q]);

    const refrescarSolicitudes = async () => {
        try {
            const { data } = await api.get('/solicitudes/mias');
            setSolicitudes(data.solicitudes || []);
        } catch { /* no-op */ }
    };

    const cancelarSolicitud = async (id) => {
        try {
            const { data } = await api.patch(`/solicitudes/productos/${id}/cancelar`);
            setSolicitudes(prev => prev.map(s => s.id === id ? { ...s, estado: data.solicitud.estado } : s));
            toast.success('Solicitud cancelada.');
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo cancelar la solicitud.');
        }
    };

    return (
        <div style={{ background: '#050505', minHeight: '100vh', color: '#fff' }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
                * { box-sizing: border-box; }
                body { background: #050505; }

                .mono { font-family: 'JetBrains Mono', monospace; }
                .grad-text-gold { background: linear-gradient(135deg, #3b7bab 0%, #7fabce 50%, #3b7bab 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
                .grad-text-white { background: linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,.65) 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }

                .reveal { opacity: 0; transform: translateY(24px); transition: opacity .6s cubic-bezier(.4,0,.2,1), transform .6s cubic-bezier(.4,0,.2,1); }
                .reveal.in-view { opacity: 1; transform: none; }

                .ps-btn-primary { display: inline-flex; align-items: center; gap: 10px; font-family: 'Outfit', sans-serif; font-weight: 700; font-size: .92rem; color: #fff; background: linear-gradient(135deg, #2b5c85, #3b7bab); border: none; border-radius: 999px; padding: 15px 32px; cursor: pointer; text-decoration: none; transition: all .25s cubic-bezier(.4,0,.2,1); box-shadow: 0 8px 24px -6px rgba(59,123,171,.5); }
                .ps-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 14px 36px -8px rgba(59,123,171,.7); }
                .ps-btn-primary:disabled { opacity: .5; cursor: not-allowed; transform: none; }
                .ps-btn-outline { display: inline-flex; align-items: center; gap: 10px; font-family: 'Outfit', sans-serif; font-weight: 600; font-size: .92rem; color: #fff; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.18); border-radius: 999px; padding: 14px 32px; cursor: pointer; text-decoration: none; transition: all .25s; }
                .ps-btn-outline:hover { border-color: #3b7bab; color: #3b7bab; background: rgba(59,123,171,.08); transform: translateY(-2px); }

                .pr-toolbar { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; justify-content: space-between; background: linear-gradient(180deg, #141414 0%, #0e0e0e 100%); border: 1px solid rgba(255,255,255,.08); border-radius: 18px; padding: 16px 18px; margin-bottom: 34px; }
                .pr-search { position: relative; flex: 1 1 260px; max-width: 360px; }
                .pr-search svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,.32); }
                .pr-search input { width: 100%; padding: 11px 14px 11px 40px; border-radius: 10px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.03); color: #fff; font-family: 'Outfit', sans-serif; font-size: .88rem; outline: none; transition: border-color .2s; }
                .pr-search input:focus { border-color: rgba(59,123,171,.5); }
                .pr-search input::placeholder { color: rgba(255,255,255,.25); }
                .pr-chips { display: flex; gap: 8px; flex-wrap: wrap; }
                .pr-chip { font-family: 'Outfit', sans-serif; font-size: .78rem; font-weight: 600; padding: 8px 15px; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); background: rgba(255,255,255,.02); color: rgba(255,255,255,.6); cursor: pointer; transition: all .2s; white-space: nowrap; }
                .pr-chip:hover { color: #fff; border-color: rgba(59,123,171,.4); }
                .pr-chip.active { background: rgba(59,123,171,.14); border-color: rgba(59,123,171,.45); color: #7fabce; }

                .pr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr)); gap: 16px; }
                .pr-card { background: linear-gradient(180deg, #141414 0%, #0e0e0e 100%); border: 1px solid rgba(255,255,255,.08); border-radius: 16px; padding: 18px 20px; cursor: pointer; transition: all .25s cubic-bezier(.4,0,.2,1); }
                .pr-card:hover { transform: translateY(-4px); border-color: rgba(59,123,171,.4); box-shadow: 0 20px 40px -18px rgba(0,0,0,.7); }

                .pr-empty { text-align: center; padding: 70px 20px; background: linear-gradient(180deg, #141414 0%, #0e0e0e 100%); border: 1px solid rgba(255,255,255,.07); border-radius: 20px; }
                .pr-empty-icon { width: 68px; height: 68px; border-radius: 18px; background: rgba(59,123,171,.1); border: 1px solid rgba(59,123,171,.25); display: flex; align-items: center; justify-content: center; color: #7fabce; margin: 0 auto 22px; }

                .pr-qty-btn { width: 32px; height: 32px; border-radius: 8px; border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.03); color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all .18s; }
                .pr-qty-btn:hover:not(:disabled) { border-color: #3b7bab; color: #7fabce; }
                .pr-qty-btn:disabled { opacity: .3; cursor: not-allowed; }
                .pr-input { width: 100%; padding: 11px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,.1); background: rgba(255,255,255,.03); color: #fff; font-family: 'Outfit', sans-serif; font-size: .87rem; outline: none; transition: border-color .2s; box-sizing: border-box; }
                .pr-input:focus { border-color: rgba(59,123,171,.5); }
                .pr-input::placeholder { color: rgba(255,255,255,.25); }
                .pr-label { display: block; margin-bottom: 6px; font-family: 'Outfit', sans-serif; font-weight: 500; font-size: .72rem; color: rgba(255,255,255,.45); text-transform: uppercase; letter-spacing: .06em; }

                @media (max-width: 640px) {
                    .pr-toolbar { flex-direction: column; align-items: stretch; }
                    .pr-detail-grid { grid-template-columns: 1fr !important; }
                }
            `}</style>

            <Navbar />

            <section style={{ padding: '150px 28px 100px', maxWidth: 1200, margin: '0 auto' }}>
                <div className="reveal in-view" style={{ textAlign: 'center', marginBottom: 44 }}>
                    <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 14, fontWeight: 500 }}>// NUESTROS PRODUCTOS</p>
                    <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.6rem, 5.5vw, 4.2rem)', letterSpacing: '.02em', lineHeight: 1, marginBottom: 16 }}>
                        <span className="grad-text-white">Repuestos y accesorios </span>
                        <span className="grad-text-gold">para tu vehiculo.</span>
                    </h1>
                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.55)', maxWidth: 560, margin: '0 auto', lineHeight: 1.7 }}>
                        Encuentra piezas certificadas para el mantenimiento y reparacion de tu auto.
                    </p>
                </div>

                {productoActivo ? (
                    <ProductoDetalle
                        producto={productoActivo}
                        esCliente={esCliente}
                        estaLogueado={!!usuario}
                        onVolver={() => setProductoActivo(null)}
                        onIrALogin={() => navigate('/auth?modo=login')}
                    />
                ) : (
                    <>
                        <div className="pr-toolbar reveal in-view">
                            <div className="pr-search">
                                <IconSearch />
                                <input type="text" placeholder="Buscar productos..." value={q} onChange={e => setQ(e.target.value)} />
                            </div>
                            <div className="pr-chips">
                                {categorias.map(c => (
                                    <button key={c} type="button" className={`pr-chip${categoria === c ? ' active' : ''}`} onClick={() => setCategoria(c)}>
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {cargando ? (
                            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,.5)', fontFamily: "'Outfit'", padding: '40px 0' }}>Cargando productos…</p>
                        ) : productos.length === 0 ? (
                            <div className="pr-empty reveal in-view">
                                <div className="pr-empty-icon"><IconBox /></div>
                                <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', letterSpacing: '.02em', marginBottom: 12 }}>Aun no tenemos productos publicados</h2>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.92rem', color: 'rgba(255,255,255,.5)', maxWidth: 460, margin: '0 auto 28px', lineHeight: 1.7 }}>
                                    Estamos preparando nuestro catalogo de repuestos y accesorios. Mientras tanto, nuestro equipo puede asesorarte y conseguir la pieza exacta que necesitas.
                                </p>
                                <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                                    <a href="/servicios" className="ps-btn-primary">Agendar Servicio</a>
                                    <a href="/nosotros" className="ps-btn-outline">Hablar con un tecnico</a>
                                </div>
                            </div>
                        ) : productosFiltrados.length === 0 ? (
                            <div className="pr-empty reveal in-view">
                                <div className="pr-empty-icon"><IconBox /></div>
                                <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', letterSpacing: '.02em', marginBottom: 12 }}>No encontramos productos con esos filtros</h2>
                                <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.92rem', color: 'rgba(255,255,255,.5)', maxWidth: 460, margin: '0 auto 28px', lineHeight: 1.7 }}>
                                    Intenta ajustar tu busqueda o selecciona otra categoria.
                                </p>
                                <button type="button" className="ps-btn-outline" onClick={limpiarFiltros}><IconX /> Limpiar filtros</button>
                            </div>
                        ) : (
                            <div className="pr-grid reveal in-view">
                                {productosFiltrados.map(p => (
                                    <ProductoCard key={p.id} p={p} onVer={() => setProductoActivo(p)} />
                                ))}
                            </div>
                        )}

                        {esCliente && solicitudes.length > 0 && (
                            <div style={{ marginTop: 50 }}>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.65rem', letterSpacing: '.25em', color: GOLD, marginBottom: 14 }}>MIS SOLICITUDES</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {solicitudes.map(s => {
                                        const est = ESTADO_SOLICITUD_LABELS[s.estado] || ESTADO_SOLICITUD_LABELS.pendiente;
                                        return (
                                            <div key={s.id} style={{ background: 'linear-gradient(180deg, #141414 0%, #0e0e0e 100%)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                                                <div>
                                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 600, color: '#fff', fontSize: '.88rem' }}>{s.repuesto_nombre} <span style={{ color: 'rgba(255,255,255,.5)', fontWeight: 400 }}>× {s.cantidad}</span></p>
                                                    <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: 'rgba(255,255,255,.5)' }}>${(parseFloat(s.precio_unitario) * s.cantidad).toFixed(2)} · {new Date(s.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}</p>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.58rem', letterSpacing: '.14em', padding: '3px 9px', borderRadius: 999, background: est.bg, color: est.color, border: `1px solid ${est.bdr}` }}>{est.label}</span>
                                                    {s.estado === 'pendiente' && (
                                                        <button className="ps-btn-outline" style={{ padding: '6px 14px', fontSize: '.75rem' }} onClick={() => cancelarSolicitud(s.id)}>Cancelar</button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </section>

            <Footer />
        </div>
    );
}

/* Card de producto */
function ProductoCard({ p, onVer }) {
    const pocasUnidades = p.stock_actual <= 3;
    return (
        <div className="pr-card" onClick={onVer}>
            {p.imagen_url ? (
                <div style={{ width: '100%', height: 150, borderRadius: 10, overflow: 'hidden', marginBottom: 14, background: '#111' }}>
                    <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
            ) : (
                <div style={{ width: '100%', height: 150, borderRadius: 10, marginBottom: 14, background: 'rgba(59,123,171,.06)', border: '1px solid rgba(59,123,171,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(127,171,206,.4)' }}>
                    <IconBox />
                </div>
            )}
            <p style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.93rem', color: '#fff', marginBottom: 4, lineHeight: 1.3 }}>{p.nombre}</p>
            {p.categoria_nombre && <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: 'rgba(255,255,255,.5)', marginBottom: 10 }}>{p.categoria_nombre}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.3rem', color: GOLD, lineHeight: 1 }}>${parseFloat(p.precio_venta).toFixed(2)}</p>
                    <p style={{ fontFamily: "'Outfit'", fontSize: '.7rem', color: 'rgba(255,255,255,.5)' }}>por {p.unidad_medida}</p>
                </div>
                <span style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: pocasUnidades ? '#f59e0b' : '#10b981', background: pocasUnidades ? 'rgba(245,158,11,.1)' : 'rgba(16,185,129,.1)', border: `1px solid ${pocasUnidades ? 'rgba(245,158,11,.25)' : 'rgba(16,185,129,.25)'}`, padding: '4px 10px', borderRadius: 999 }}>
                    {pocasUnidades ? `¡Solo ${p.stock_actual}!` : `Stock: ${p.stock_actual}`}
                </span>
            </div>
        </div>
    );
}

/* Detalle + solicitud */
function ProductoDetalle({ producto, esCliente, estaLogueado, onVolver, onIrALogin }) {
    const [cantidad, setCantidad] = useState(1);
    const [notas, setNotas]       = useState('');

    const cambiarCantidad = (delta) => {
        setCantidad(c => Math.max(1, Math.min(producto.stock_actual, c + delta)));
    };

    const solicitar = () => {
        const detalle = `Hola, quiero comprar este producto:%0A%0A*${producto.nombre}*%0ACódigo: ${producto.codigo || 'N/A'}%0ACantidad: ${cantidad}%0APrecio referencial: $${Number(producto.precio_venta || 0).toFixed(2)}${notas.trim() ? `%0AConsulta: ${encodeURIComponent(notas.trim())}` : ''}`;
        window.open(`https://wa.me/593999999999?text=${detalle}`, '_blank', 'noopener,noreferrer');
    };

    return (
        <div className="reveal in-view">
            <button className="ps-btn-outline" onClick={onVolver} style={{ marginBottom: 24, padding: '10px 20px' }}><IconBack /> Volver a productos</button>
            <div className="pr-detail-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: 32 }}>
                <div>
                    {producto.imagen_url ? (
                        <div style={{ width: '100%', aspectRatio: '1', borderRadius: 18, overflow: 'hidden', background: '#111' }}>
                            <img src={producto.imagen_url} alt={producto.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                    ) : (
                        <div style={{ width: '100%', aspectRatio: '1', borderRadius: 18, background: 'rgba(59,123,171,.06)', border: '1px solid rgba(59,123,171,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(127,171,206,.4)' }}>
                            <span style={{ transform: 'scale(2.6)' }}><IconBox /></span>
                        </div>
                    )}
                </div>

                <div>
                    {producto.categoria_nombre && <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: GOLD, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>{producto.categoria_nombre}</p>}
                    <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.9rem', letterSpacing: '.02em', color: '#fff', marginBottom: 10, lineHeight: 1.1 }}>{producto.nombre}</h2>
                    {producto.codigo && <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: 'rgba(255,255,255,.5)', marginBottom: 14 }}>Código: <code style={{ color: '#fff' }}>{producto.codigo}</code></p>}
                    {producto.descripcion && <p style={{ fontFamily: "'Outfit'", fontSize: '.9rem', color: 'rgba(255,255,255,.6)', lineHeight: 1.7, marginBottom: 18 }}>{producto.descripcion}</p>}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 22 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '2.1rem', color: GOLD, lineHeight: 1 }}>${parseFloat(producto.precio_venta).toFixed(2)}</p>
                        <span style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: 'rgba(255,255,255,.5)' }}>por {producto.unidad_medida} · {producto.stock_actual} disponibles</span>
                    </div>

                    <div style={{ background: 'linear-gradient(180deg, #141414 0%, #0e0e0e 100%)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 16, padding: '22px 24px' }}>
                        {!estaLogueado ? (
                            <>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: 'rgba(255,255,255,.6)', marginBottom: 16, lineHeight: 1.6 }}>
                                    Inicia sesión con tu cuenta de cliente para solicitar este producto y coordinar su entrega con el taller.
                                </p>
                                <button className="ps-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onIrALogin}>Iniciar sesión</button>
                            </>
                        ) : !esCliente ? (
                            <p style={{ fontFamily: "'Outfit'", fontSize: '.85rem', color: 'rgba(255,255,255,.6)', lineHeight: 1.6 }}>
                                Las solicitudes de producto están disponibles solo para cuentas de cliente.
                            </p>
                        ) : (
                            <>
                                <p className="pr-label">Cantidad</p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                                    <button className="pr-qty-btn" onClick={() => cambiarCantidad(-1)} disabled={cantidad <= 1}><IconMinus /></button>
                                    <span style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: '1rem', color: '#fff', minWidth: 24, textAlign: 'center' }}>{cantidad}</span>
                                    <button className="pr-qty-btn" onClick={() => cambiarCantidad(1)} disabled={cantidad >= producto.stock_actual}><IconPlus /></button>
                                    <span style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: 'rgba(255,255,255,.5)', marginLeft: 'auto' }}>Subtotal: <strong style={{ color: GOLD }}>${(parseFloat(producto.precio_venta) * cantidad).toFixed(2)}</strong></span>
                                </div>

                                <p className="pr-label">Notas para el taller (opcional)</p>
                                <textarea className="pr-input" style={{ resize: 'vertical', minHeight: 64, marginBottom: 18 }} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Ej. lo necesito para el viernes" maxLength={300} />

                                <button className="ps-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={solicitar}>
                                    Comprar por WhatsApp
                                </button>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: 'rgba(255,255,255,.3)', marginTop: 10, textAlign: 'center' }}>
                                    Se abrirá WhatsApp con el producto y la cantidad seleccionada para coordinar la compra directamente con el taller.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* Iconos */
function IconSearch()  { return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconX()       { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconBox()     { return <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>; }
function IconBack()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>; }
function IconMinus()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconPlus()    { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
