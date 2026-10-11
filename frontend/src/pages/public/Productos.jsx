/**
 * SS SWAP - Catálogo Público de Repuestos y Productos
 * Explora productos disponibles para venta con filtros por categoría, rango de precio,
 * indicador de stock y sistema de reserva/solicitud de compra para clientes.
 */
import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Navbar from '../../components/public/Navbar';
import Footer from '../../components/public/Footer';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import './Productos.css';

const GOLD   = '#3b7bab';
const GOLD_L = '#7fabce';
const ITEMS_PER_PAGE = 12;

const ESTADO_SOLICITUD_LABELS = {
    pendiente: { label: 'Pendiente', color: '#f59e0b', bg: 'rgba(245,158,11,.12)', bdr: 'rgba(245,158,11,.25)' },
    atendida:  { label: 'Atendida',  color: '#10b981', bg: 'rgba(16,185,129,.12)', bdr: 'rgba(16,185,129,.25)' },
    cancelada: { label: 'Cancelada', color: '#ef4444', bg: 'rgba(239,68,68,.12)',  bdr: 'rgba(239,68,68,.25)'  },
};

/* ═══════════════════════════════════════════════════════════════
   PARTÍCULAS DE FONDO — canvas, tonalidad azul de la marca
   ═══════════════════════════════════════════════════════════════ */
function ShopParticles() {
    const ref = useRef(null);
    const raf = useRef(null);
    useEffect(() => {
        const c = ref.current; if (!c) return;
        const ctx = c.getContext('2d');
        const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight; };
        resize();
        const ro = new ResizeObserver(resize); ro.observe(c);
        const clr = [59, 123, 171];
        const pts = Array.from({ length: 32 }, () => ({
            x: Math.random() * c.width, y: Math.random() * c.height,
            r: Math.random() * 1.5 + 0.3, vx: (Math.random() - .5) * .2, vy: -(Math.random() * .26 + .05),
            o: Math.random() * .4 + .06, life: Math.random(),
        }));
        const draw = () => {
            ctx.clearRect(0, 0, c.width, c.height);
            pts.forEach(p => {
                p.x += p.vx; p.y += p.vy; p.life += .004;
                if (p.life > 1) { p.life = 0; p.x = Math.random() * c.width; p.y = c.height + 4; }
                const f = p.life < .2 ? p.life / .2 : p.life > .72 ? 1 - (p.life - .72) / .28 : 1;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${clr[0]},${clr[1]},${clr[2]},${p.o * f})`; ctx.fill();
            });
            raf.current = requestAnimationFrame(draw);
        };
        draw();
        return () => { cancelAnimationFrame(raf.current); ro.disconnect(); };
    }, []);
    return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />;
}

/* ═══════════════════════════════════════════════════════════════
   SLIDER DE PRECIO — solo desktop
   ═══════════════════════════════════════════════════════════════ */
function PriceRangeSlider({ min, max, value, onChange }) {
    const trackRef = useRef(null);
    const pct = v => max === min ? 0 : ((v - min) / (max - min)) * 100;
    const handleDrag = (thumb, e) => {
        e.preventDefault();
        const track = trackRef.current;
        const move = cx => {
            const r = track.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (cx - r.left) / r.width));
            const raw = Math.round(min + ratio * (max - min));
            if (thumb === 'low') onChange([Math.min(raw, value[1] - 1), value[1]]);
            else                 onChange([value[0], Math.max(raw, value[0] + 1)]);
        };
        const onMove = ev => move(ev.clientX);
        const onUp   = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
        window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
    };
    return (
        <div style={{ padding: '4px 0' }}>
            <div ref={trackRef} style={{ position: 'relative', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', margin: '18px 8px' }}>
                <div style={{ position: 'absolute', height: '100%', borderRadius: '2px', background: `linear-gradient(90deg, ${GOLD}, ${GOLD_L})`, left: `${pct(value[0])}%`, right: `${100 - pct(value[1])}%` }} />
                {['low', 'high'].map((t, i) => (
                    <div key={t} onMouseDown={e => handleDrag(t, e)} style={{ position: 'absolute', top: '50%', left: `${pct(value[i])}%`, transform: 'translate(-50%,-50%)', width: '18px', height: '18px', borderRadius: '50%', background: '#0e0e0e', border: `2px solid ${GOLD_L}`, boxShadow: `0 0 0 3px rgba(127,171,206,0.22)`, cursor: 'grab', zIndex: 2, transition: 'box-shadow .15s' }}
                        onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 0 5px rgba(127,171,206,0.35)'}
                        onMouseLeave={e => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(127,171,206,0.22)'}
                    />
                ))}
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                {[value[0], value[1]].map((v, i) => (
                    <div key={i} style={{ flex: 1, textAlign: 'center', background: 'rgba(59,123,171,0.08)', border: `1px solid rgba(59,123,171,0.22)`, borderRadius: '8px', padding: '7px 6px', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.05rem', letterSpacing: '.06em', color: GOLD_L }}>${v}</div>
                ))}
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   INPUTS DE PRECIO — solo mobile
   ═══════════════════════════════════════════════════════════════ */
function PriceInputs({ min, max, value, onChange }) {
    const [localMin, setLocalMin] = useState(String(value[0]));
    const [localMax, setLocalMax] = useState(String(value[1]));
    useEffect(() => { setLocalMin(String(value[0])); }, [value[0]]);
    useEffect(() => { setLocalMax(String(value[1])); }, [value[1]]);

    const apply = (a, b) => {
        const lo = Math.max(min, Math.min(Number(a) || min, max));
        const hi = Math.max(min, Math.min(Number(b) || max, max));
        onChange([Math.min(lo, hi), Math.max(lo, hi)]);
    };

    const inp = {
        width: '100%', boxSizing: 'border-box', padding: '14px 14px 14px 28px',
        background: 'rgba(59,123,171,0.08)', border: `1.5px solid rgba(59,123,171,0.25)`,
        borderRadius: '10px', color: GOLD_L,
        fontFamily: "'Bebas Neue', sans-serif", fontSize: '1.2rem', letterSpacing: '.06em',
        outline: 'none', textAlign: 'center', transition: 'border-color .2s',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                {[['Mínimo', localMin, setLocalMin], ['Máximo', localMax, setLocalMax]].map(([lbl, val, set]) => (
                    <div key={lbl} style={{ flex: 1 }}>
                        <label style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 300, fontSize: '.78rem', color: 'rgba(127,171,206,0.65)', display: 'block', marginBottom: '6px', letterSpacing: '.06em' }}>{lbl}</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontFamily: "'Bebas Neue', sans-serif", fontSize: '1rem', color: 'rgba(127,171,206,0.4)', pointerEvents: 'none' }}>$</span>
                            <input
                                type="number" inputMode="numeric"
                                value={val}
                                onChange={e => set(e.target.value)}
                                onBlur={() => apply(localMin, localMax)}
                                onKeyDown={e => e.key === 'Enter' && apply(localMin, localMax)}
                                style={inp}
                                onFocus={e => e.target.style.borderColor = 'rgba(127,171,206,0.55)'}
                                onBlurCapture={e => e.target.style.borderColor = 'rgba(59,123,171,0.25)'}
                            />
                        </div>
                    </div>
                ))}
            </div>
            <button onClick={() => apply(localMin, localMax)} style={{ width: '100%', padding: '15px', background: `linear-gradient(135deg, ${GOLD}, ${GOLD_L})`, border: 'none', borderRadius: '10px', color: '#fff', fontFamily: "'Bebas Neue', sans-serif", fontSize: '.9rem', letterSpacing: '.16em', cursor: 'pointer', transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(127,171,206,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
            >Aplicar precio</button>
            {(value[0] > min || value[1] < max) && (
                <button onClick={() => { setLocalMin(String(min)); setLocalMax(String(max)); onChange([min, max]); }} style={{ width: '100%', padding: '11px', background: 'transparent', border: `1px solid rgba(255,255,255,.12)`, borderRadius: '10px', color: 'rgba(255,255,255,.55)', fontFamily: "'Outfit', sans-serif", fontWeight: 300, fontSize: '.85rem', cursor: 'pointer', transition: 'all .2s' }}>
                    Restablecer precio
                </button>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   CHECKBOXES — desktop (compacto) / mobile (táctil)
   ═══════════════════════════════════════════════════════════════ */
function CbD({ checked, onChange, label, accentColor }) {
    const acc = accentColor || GOLD_L;
    return (
        <button onClick={onChange} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: '7px 0', textAlign: 'left', width: '100%', transition: 'padding-left .18s' }}
            onMouseEnter={e => e.currentTarget.style.paddingLeft = '5px'}
            onMouseLeave={e => e.currentTarget.style.paddingLeft = '0'}
        >
            <div style={{ width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0, border: `1.5px solid ${checked ? acc : 'rgba(255,255,255,.18)'}`, background: checked ? acc : 'transparent', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {checked && <div style={{ width: '6px', height: '6px', background: '#0a0a0a', borderRadius: '1px' }} />}
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 300, fontSize: '.85rem', color: checked ? acc : 'rgba(255,255,255,.6)', transition: 'color .15s' }}>{label}</span>
        </button>
    );
}

function CbM({ checked, onChange, label, accentColor }) {
    const acc = accentColor || GOLD_L;
    return (
        <button onClick={onChange} style={{ display: 'flex', alignItems: 'center', gap: '14px', background: checked ? (accentColor ? 'rgba(239,68,68,0.07)' : 'rgba(59,123,171,0.1)') : 'transparent', border: `1.5px solid ${checked ? acc : 'rgba(255,255,255,.14)'}`, borderRadius: '10px', cursor: 'pointer', padding: '13px 14px', textAlign: 'left', width: '100%', transition: 'all .18s', boxSizing: 'border-box' }}>
            <div style={{ width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0, border: `2px solid ${checked ? acc : 'rgba(255,255,255,.18)'}`, background: checked ? acc : 'transparent', transition: 'all .15s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {checked && <div style={{ width: '8px', height: '8px', background: '#0a0a0a', borderRadius: '2px' }} />}
            </div>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 300, fontSize: '1rem', color: checked ? acc : 'rgba(255,255,255,.68)', transition: 'color .15s', lineHeight: 1.3 }}>{label}</span>
        </button>
    );
}

/* ═══════════════════════════════════════════════════════════════
   SECCIONES COLAPSABLES — desktop / mobile
   ═══════════════════════════════════════════════════════════════ */
function SS({ title, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ marginBottom: '4px' }}>
            <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: open ? '10px' : '0' }}>
                <span className="mono" style={{ fontSize: '.6rem', letterSpacing: '.26em', color: GOLD_L, fontWeight: 500 }}>{title}</span>
                <IconChevronDown size={12} style={{ color: GOLD, transition: 'transform .2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
            </button>
            {open && <div>{children}</div>}
        </div>
    );
}

function SSM({ title, children, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ marginBottom: '6px' }}>
            <button onClick={() => setOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 0', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: open ? '14px' : '0' }}>
                <span className="mono" style={{ fontSize: '.75rem', letterSpacing: '.22em', color: GOLD_L, fontWeight: 500 }}>{title}</span>
                <IconChevronDown size={16} style={{ color: GOLD, transition: 'transform .2s', transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', flexShrink: 0 }} />
            </button>
            {open && <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{children}</div>}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   PANEL DE FILTROS — desktop / mobile
   (Categoría en lista simple de checkboxes — sin iconos/tarjetas arriba)
   ═══════════════════════════════════════════════════════════════ */
function FPD({ categorias, categoria, setCategoria, sortBy, setSortBy, priceRange, setPriceRange, priceMin, priceMax, pocasUnidades, setPocasUnidades, activeFilters, clearAll }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <SS title="ORDENAR">
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,.1)', borderRadius: '9px', color: '#fff', fontFamily: "'Outfit', sans-serif", fontWeight: 300, fontSize: '.85rem', outline: 'none', cursor: 'pointer', transition: 'border-color .2s' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(59,123,171,.5)'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,.1)'}>
                    <option value="name_asc">Nombre A–Z</option>
                    <option value="price_asc">Precio ↑ menor a mayor</option>
                    <option value="price_desc">Precio ↓ mayor a menor</option>
                    <option value="stock_desc">Más stock disponible</option>
                </select>
            </SS>
            <SS title="CATEGORÍA">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <CbD checked={categoria === 'Todos'} onChange={() => setCategoria('Todos')} label="Todas" />
                    {categorias.filter(c => c !== 'Todos').map(c => (
                        <CbD key={c} checked={categoria === c} onChange={() => setCategoria(categoria === c ? 'Todos' : c)} label={c} />
                    ))}
                </div>
            </SS>
            <SS title="PRECIO">
                {priceMax > priceMin
                    ? <PriceRangeSlider min={priceMin} max={priceMax} value={priceRange} onChange={setPriceRange} />
                    : <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 300, fontSize: '.78rem', color: 'rgba(255,255,255,.5)' }}>Cargando...</p>}
            </SS>
            <SS title="OPCIONES">
                <CbD checked={pocasUnidades} onChange={() => setPocasUnidades(v => !v)} label="Pocas unidades" accentColor="#f59e0b" />
            </SS>
            {activeFilters.length > 0 && (
                <button onClick={clearAll} style={{ marginTop: '6px', width: '100%', padding: '10px', borderRadius: '9px', background: 'rgba(59,123,171,0.1)', border: '1px solid rgba(59,123,171,.4)', color: GOLD_L, fontFamily: "'Bebas Neue', sans-serif", fontSize: '.72rem', letterSpacing: '.14em', cursor: 'pointer', transition: 'all .2s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(59,123,171,0.18)'; e.currentTarget.style.boxShadow = '0 2px 14px rgba(59,123,171,.28)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(59,123,171,0.1)'; e.currentTarget.style.boxShadow = 'none'; }}
                >Limpiar filtros ({activeFilters.length})</button>
            )}
        </div>
    );
}

function FPM({ categorias, categoria, setCategoria, sortBy, setSortBy, priceRange, setPriceRange, priceMin, priceMax, pocasUnidades, setPocasUnidades, activeFilters, clearAll }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <SSM title="ORDENAR POR">
                <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: '100%', padding: '13px 14px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,.1)', borderRadius: '10px', color: '#fff', fontFamily: "'Outfit', sans-serif", fontWeight: 300, fontSize: '1rem', outline: 'none', cursor: 'pointer' }}>
                    <option value="name_asc">Nombre A–Z</option>
                    <option value="price_asc">Precio: menor a mayor</option>
                    <option value="price_desc">Precio: mayor a menor</option>
                    <option value="stock_desc">Más stock disponible</option>
                </select>
            </SSM>
            <SSM title="CATEGORÍA">
                <CbM checked={categoria === 'Todos'} onChange={() => setCategoria('Todos')} label="Todas las categorías" />
                {categorias.filter(c => c !== 'Todos').map(c => (
                    <CbM key={c} checked={categoria === c} onChange={() => setCategoria(categoria === c ? 'Todos' : c)} label={c} />
                ))}
            </SSM>
            <SSM title="RANGO DE PRECIO">
                {priceMax > priceMin
                    ? <PriceInputs min={priceMin} max={priceMax} value={priceRange} onChange={setPriceRange} />
                    : <p style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 300, fontSize: '.9rem', color: 'rgba(255,255,255,.5)', padding: '8px 0' }}>Cargando precios…</p>}
            </SSM>
            <SSM title="OPCIONES">
                <CbM checked={pocasUnidades} onChange={() => setPocasUnidades(v => !v)} label="Solo pocas unidades" accentColor="#f59e0b" />
            </SSM>
            {activeFilters.length > 0 && (
                <button onClick={clearAll} style={{ marginTop: '10px', width: '100%', padding: '15px', borderRadius: '10px', background: 'rgba(59,123,171,0.1)', border: '1.5px solid rgba(59,123,171,.4)', color: GOLD_L, fontFamily: "'Bebas Neue', sans-serif", fontSize: '.85rem', letterSpacing: '.14em', cursor: 'pointer' }}>
                    Limpiar todos los filtros ({activeFilters.length})
                </button>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   PRODUCTO — vista GRID (tarjeta) y LIST (fila)
   ═══════════════════════════════════════════════════════════════ */
function ProductoCard({ p, onVer }) {
    const pocasUnidades = p.stock_actual <= 3;
    return (
        <div className="pr-card sp-card" onClick={onVer}>
            {p.imagen_url ? (
                <div style={{ width: '100%', height: 150, borderRadius: 10, overflow: 'hidden', marginBottom: 14, background: '#111' }}>
                    <img src={p.imagen_url} alt={p.nombre} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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

function ProductoRow({ p, onVer }) {
    const pocasUnidades = p.stock_actual <= 3;
    return (
        <div className="pr-row sp-card" onClick={onVer}>
            <div style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', background: 'rgba(59,123,171,.08)', border: '1px solid rgba(59,123,171,.15)', flexShrink: 0 }}>
                {p.imagen_url
                    ? <img src={p.imagen_url} alt={p.nombre} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(127,171,206,.4)' }}><IconBox /></div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.9rem', color: '#fff', marginBottom: 3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{p.nombre}</p>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: 'rgba(255,255,255,.5)' }}>{p.categoria_nombre || ''}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                <span style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: pocasUnidades ? '#f59e0b' : '#10b981', background: pocasUnidades ? 'rgba(245,158,11,.1)' : 'rgba(16,185,129,.1)', border: `1px solid ${pocasUnidades ? 'rgba(245,158,11,.25)' : 'rgba(16,185,129,.25)'}`, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap' }}>
                    {pocasUnidades ? `¡Solo ${p.stock_actual}!` : `Stock: ${p.stock_actual}`}
                </span>
                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.15rem', letterSpacing: '.03em', color: GOLD, minWidth: 66, textAlign: 'right' }}>${parseFloat(p.precio_venta).toFixed(2)}</p>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ═══════════════════════════════════════════════════════════════ */
export default function Productos() {
    const navigate = useNavigate();
    const { usuario } = useAuth();
    const esCliente = usuario?.rol === 'cliente';

    const [productos, setProductos]   = useState([]);
    const [cargando, setCargando]     = useState(true);
    const [q, setQ]                   = useState('');
    const [categoria, setCategoria]   = useState('Todos');
    const [productoActivo, setProductoActivo] = useState(null);

    const [sortBy, setSortBy]                   = useState('name_asc');
    const [priceMin, setPriceMin]                = useState(0);
    const [priceMax, setPriceMax]                = useState(500);
    const [priceRange, setPriceRange]            = useState([0, 500]);
    const [pocasUnidades, setPocasUnidades]      = useState(false);
    const [viewMode, setViewMode]                = useState('grid');
    const [sidebarVisible, setSidebarVisible]    = useState(true);
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    const [showBackToTop, setShowBackToTop]      = useState(false);
    const [currentPage, setCurrentPage]          = useState(1);

    const [solicitudes, setSolicitudes] = useState([]);

    useEffect(() => {
        api.get('/inventory/publico')
            .then(r => {
                const lista = r.data.repuestos || [];
                setProductos(lista);
                if (lista.length) {
                    const precios = lista.map(p => parseFloat(p.precio_venta) || 0);
                    const mn = Math.floor(Math.min(...precios));
                    const mx = Math.ceil(Math.max(...precios));
                    setPriceMin(mn); setPriceMax(mx); setPriceRange([mn, mx]);
                }
            })
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

    useEffect(() => {
        const fn = () => setShowBackToTop(window.scrollY > 500);
        window.addEventListener('scroll', fn, { passive: true });
        return () => window.removeEventListener('scroll', fn);
    }, []);

    const categorias = useMemo(() => {
        const set = new Set(productos.map(p => p.categoria_nombre).filter(Boolean));
        return ['Todos', ...Array.from(set).sort()];
    }, [productos]);

    const limpiarFiltros = () => {
        setQ(''); setCategoria('Todos'); setPocasUnidades(false);
        setSortBy('name_asc'); setPriceRange([priceMin, priceMax]);
    };

    const productosFiltrados = useMemo(() => {
        let list = productos;
        if (categoria !== 'Todos') list = list.filter(p => p.categoria_nombre === categoria);
        if (q.trim()) {
            const t = q.toLowerCase();
            list = list.filter(p => p.nombre.toLowerCase().includes(t) || (p.descripcion || '').toLowerCase().includes(t));
        }
        list = list.filter(p => {
            const precio = parseFloat(p.precio_venta) || 0;
            return precio >= priceRange[0] && precio <= priceRange[1];
        });
        if (pocasUnidades) list = list.filter(p => p.stock_actual <= 3);

        list = [...list];
        if (sortBy === 'price_asc')       list.sort((a, b) => parseFloat(a.precio_venta) - parseFloat(b.precio_venta));
        else if (sortBy === 'price_desc') list.sort((a, b) => parseFloat(b.precio_venta) - parseFloat(a.precio_venta));
        else if (sortBy === 'stock_desc') list.sort((a, b) => b.stock_actual - a.stock_actual);
        else                              list.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

        return list;
    }, [productos, categoria, q, priceRange, pocasUnidades, sortBy]);

    useEffect(() => { setCurrentPage(1); }, [q, categoria, priceRange, pocasUnidades, sortBy]);

    const totalPages = Math.ceil(productosFiltrados.length / ITEMS_PER_PAGE) || 1;
    const paginatedProductos = productosFiltrados.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

    const activeFilters = [
        categoria !== 'Todos' && categoria,
        pocasUnidades && 'Pocas unidades',
        (priceRange[0] > priceMin || priceRange[1] < priceMax) && `$${priceRange[0]}–$${priceRange[1]}`,
    ].filter(Boolean);

    const pocasUnidadesCount = useMemo(() => productos.filter(p => p.stock_actual <= 3).length, [productos]);

    const cancelarSolicitud = async (id) => {
        try {
            const { data } = await api.patch(`/solicitudes/productos/${id}/cancelar`);
            setSolicitudes(prev => prev.map(s => s.id === id ? { ...s, estado: data.solicitud.estado } : s));
            toast.success('Solicitud cancelada.');
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo cancelar la solicitud.');
        }
    };

    const fp = { categorias, categoria, setCategoria, sortBy, setSortBy, priceRange, setPriceRange, priceMin, priceMax, pocasUnidades, setPocasUnidades, activeFilters, clearAll: limpiarFiltros };

    return (
        <div style={{ background: '#050505', minHeight: '100vh', color: '#fff' }}>

            <Navbar />

            {productoActivo ? (
                <section style={{ padding: '150px 28px 100px', maxWidth: 1200, margin: '0 auto' }}>
                    <ProductoDetalle
                        producto={productoActivo}
                        esCliente={esCliente}
                        estaLogueado={!!usuario}
                        onVolver={() => setProductoActivo(null)}
                        onIrALogin={() => navigate('/auth?modo=login')}
                        onPedidoRegistrado={(sol) => setSolicitudes(prev => [sol, ...prev])}
                    />
                </section>
            ) : (
                <>
                    <div style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,.06)', paddingTop: 64 }}>
                        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(rgba(59,123,171,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(59,123,171,0.05) 1px, transparent 1px)', backgroundSize: '52px 52px', maskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, black 0%, transparent 100%)', WebkitMaskImage: 'radial-gradient(ellipse 100% 100% at 50% 0%, black 0%, transparent 100%)' }} />
                        <div style={{ position: 'absolute', top: '-30%', left: '-5%', width: '50vw', height: '50vw', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,123,171,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
                        <ShopParticles />
                        <div className="reveal in-view" style={{ maxWidth: 1200, margin: '0 auto', padding: '54px 28px 40px', position: 'relative', zIndex: 2, textAlign: 'center' }}>
                            <p className="mono" style={{ fontSize: '.7rem', letterSpacing: '.3em', color: GOLD, marginBottom: 14, fontWeight: 500 }}>// NUESTROS PRODUCTOS</p>
                            <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(2.6rem, 5.5vw, 4.2rem)', letterSpacing: '.02em', lineHeight: 1, marginBottom: 16 }}>
                                <span className="grad-text-rainbow">Repuestos</span><span className="grad-text-white"> y </span><span className="grad-text-rainbow">accesorios</span><span className="grad-text-white"> para tu vehículo.</span>
                            </h1>
                            <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '1rem', color: 'rgba(255,255,255,.55)', maxWidth: 560, margin: '0 auto 30px', lineHeight: 1.7 }}>
                                Encuentra piezas certificadas para el mantenimiento y reparación de tu auto.
                            </p>

                            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                                {[
                                    { n: cargando ? '…' : productos.length, label: 'Productos' },
                                    { n: cargando ? '…' : Math.max(categorias.length - 1, 0), label: 'Categorías' },
                                    { n: cargando ? '…' : pocasUnidadesCount, label: 'Pocas unidades' },
                                ].map(({ n, label }) => (
                                    <div key={label} className="pr-stat">
                                        <span key={n} className="sp-cnt-anim" style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.03em', lineHeight: 1, color: GOLD_L }}>{n}</span>
                                        <span style={{ fontFamily: "'Outfit'", fontWeight: 200, fontSize: '.55rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>{label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', overflow: 'hidden', borderBottom: '1px solid rgba(255,255,255,.06)', background: 'rgba(59,123,171,0.02)', padding: '10px 0' }}>
                        {[0, 1].map(k => (
                            <div key={k} className="pr-marquee-track">
                                {['Piezas Certificadas', 'Diagnóstico Gratuito', 'Garantía Escrita', 'Repuestos Originales', 'Atención Técnica'].map((t, i) => (
                                    <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '14px', padding: '0 28px', whiteSpace: 'nowrap', fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.24em', color: 'rgba(127,171,206,.35)' }}>
                                        {t}<span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(127,171,206,.4)', flexShrink: 0 }} />
                                    </span>
                                ))}
                            </div>
                        ))}
                    </div>

                    <div className="pr-toolbar-sticky">
                        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 24px' }}>
                            <div className="pr-toolbar-inner" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                <button className={`pr-tog${sidebarVisible ? ' on' : ''}`} onClick={() => setSidebarVisible(v => !v)} title="Mostrar/ocultar filtros">
                                    <IconSliders />
                                </button>
                                <div style={{ position: 'relative', flex: 1, minWidth: 180, maxWidth: 420 }}>
                                    <IconSearch style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,.35)', pointerEvents: 'none' }} />
                                    <input type="text" placeholder="Buscar productos..." value={q} onChange={e => setQ(e.target.value)} className="pr-search-in" />
                                    {q && (
                                        <button onClick={() => setQ('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.5)', display: 'flex' }}>
                                            <IconX />
                                        </button>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                    <button className={`pr-vbtn${viewMode === 'grid' ? ' on' : ''}`} onClick={() => setViewMode('grid')} title="Vista cuadrícula"><IconGrid /></button>
                                    <button className={`pr-vbtn${viewMode === 'list' ? ' on' : ''}`} onClick={() => setViewMode('list')} title="Vista lista"><IconList /></button>
                                </div>
                                <select className="pr-sort-sel" value={sortBy} onChange={e => setSortBy(e.target.value)}>
                                    <option value="name_asc">Nombre A–Z</option>
                                    <option value="price_asc">Precio ↑</option>
                                    <option value="price_desc">Precio ↓</option>
                                    <option value="stock_desc">Más stock</option>
                                </select>
                                <button className="pr-mob-filter-btn" onClick={() => setMobileFiltersOpen(o => !o)} style={{ marginLeft: 'auto', background: mobileFiltersOpen ? 'rgba(59,123,171,.14)' : 'rgba(255,255,255,.04)', borderColor: mobileFiltersOpen ? 'rgba(59,123,171,.45)' : 'rgba(255,255,255,.1)', color: mobileFiltersOpen ? GOLD_L : 'rgba(255,255,255,.6)' }}>
                                    <IconFilter />Filtros
                                    {activeFilters.length > 0 && <span style={{ background: GOLD, color: '#fff', borderRadius: '50%', width: 20, height: 20, fontSize: '.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit'", fontWeight: 500 }}>{activeFilters.length}</span>}
                                </button>
                            </div>
                            {activeFilters.length > 0 && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                                    <span style={{ fontFamily: "'Outfit'", fontWeight: 200, fontSize: '.68rem', letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)' }}>Activos:</span>
                                    {activeFilters.map(f => <span key={f} className="pr-tag">{f}</span>)}
                                    <button onClick={limpiarFiltros} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.7rem', color: 'rgba(255,255,255,.5)', textDecoration: 'underline' }}>Limpiar todo</button>
                                </div>
                            )}
                        </div>
                    </div>

                    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 24px 80px', display: 'flex', gap: 22, alignItems: 'flex-start' }}>

                        <aside className={`pr-side${!sidebarVisible ? ' hidden' : ''}`}>
                            <FPD {...fp} />
                        </aside>

                        <div className={`pr-overlay${mobileFiltersOpen ? ' open' : ''}`} onClick={() => setMobileFiltersOpen(false)} />
                        <div className={`pr-drawer${mobileFiltersOpen ? ' open' : ''}`}>
                            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 6px', flexShrink: 0 }}>
                                <div style={{ width: 48, height: 5, borderRadius: 3, background: 'rgba(59,123,171,.35)' }} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 14px', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 16, flexShrink: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <IconSliders style={{ color: GOLD_L }} />
                                    <span style={{ fontFamily: "'Bebas Neue'", fontSize: '1rem', letterSpacing: '.2em', color: '#fff' }}>Filtros</span>
                                    {activeFilters.length > 0 && <span style={{ background: GOLD, color: '#fff', borderRadius: '50%', width: 22, height: 22, fontSize: '.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit'", fontWeight: 500 }}>{activeFilters.length}</span>}
                                </div>
                                <button onClick={() => setMobileFiltersOpen(false)} style={{ background: 'rgba(59,123,171,.1)', border: '1.5px solid rgba(255,255,255,.1)', borderRadius: 8, cursor: 'pointer', color: 'rgba(255,255,255,.6)', display: 'flex', padding: 8 }}>
                                    <IconX size={20} />
                                </button>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 20 }}>
                                <FPM {...fp} />
                            </div>
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button onClick={() => setPocasUnidades(v => !v)} className="pr-pill" style={{ borderColor: pocasUnidades ? 'rgba(245,158,11,.45)' : 'rgba(255,255,255,.1)', background: pocasUnidades ? 'rgba(245,158,11,.08)' : 'rgba(255,255,255,.025)', color: pocasUnidades ? '#f59e0b' : 'rgba(255,255,255,.6)' }}>
                                        <IconZap size={11} /> Pocas unidades
                                    </button>
                                </div>
                                {!cargando && (
                                    <span style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.75rem', letterSpacing: '.04em', color: 'rgba(255,255,255,.5)', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)', padding: '5px 12px', borderRadius: 6 }}>
                                        <IconZap size={11} style={{ color: GOLD_L }} /> <span key={productosFiltrados.length} className="sp-cnt-anim">{productosFiltrados.length}</span> resultado{productosFiltrados.length !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>

                            {cargando ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
                                    {Array.from({ length: 8 }).map((_, i) => <div key={i} className="pr-sk" style={{ aspectRatio: '.82' }} />)}
                                </div>
                            ) : productos.length === 0 ? (
                                <div className="pr-empty reveal in-view">
                                    <div className="pr-empty-icon"><IconBox /></div>
                                    <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', letterSpacing: '.02em', marginBottom: 12 }}>Aún no tenemos productos publicados</h2>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.92rem', color: 'rgba(255,255,255,.5)', maxWidth: 460, margin: '0 auto 28px', lineHeight: 1.7 }}>
                                        Estamos preparando nuestro catálogo de repuestos y accesorios. Mientras tanto, nuestro equipo puede asesorarte y conseguir la pieza exacta que necesitas.
                                    </p>
                                    <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
                                        <a href="/servicios" className="ps-btn-primary"><span>Agendar Servicio</span></a>
                                        <a href="/nosotros" className="ps-btn-outline">Hablar con un técnico</a>
                                    </div>
                                </div>
                            ) : productosFiltrados.length === 0 ? (
                                <div className="pr-empty reveal in-view">
                                    <div className="pr-empty-icon"><IconBox /></div>
                                    <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', letterSpacing: '.02em', marginBottom: 12 }}>No encontramos productos con esos filtros</h2>
                                    <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.92rem', color: 'rgba(255,255,255,.5)', maxWidth: 460, margin: '0 auto 28px', lineHeight: 1.7 }}>
                                        Intenta ajustar tu búsqueda, el rango de precio o selecciona otra categoría.
                                    </p>
                                    <button type="button" className="ps-btn-outline" onClick={limpiarFiltros}><IconX /> Limpiar filtros</button>
                                </div>
                            ) : viewMode === 'grid' ? (
                                <div className="pr-grid">
                                    {paginatedProductos.map(p => (
                                        <ProductoCard key={p.id} p={p} onVer={() => setProductoActivo(p)} />
                                    ))}
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {paginatedProductos.map(p => (
                                        <ProductoRow key={p.id} p={p} onVer={() => setProductoActivo(p)} />
                                    ))}
                                </div>
                            )}

                            {!cargando && totalPages > 1 && (() => {
                                const PAGES_PER_WINDOW = 5;
                                const windowStart = Math.floor((currentPage - 1) / PAGES_PER_WINDOW) * PAGES_PER_WINDOW + 1;
                                const windowEnd   = Math.min(windowStart + PAGES_PER_WINDOW - 1, totalPages);
                                const pageNumbers = Array.from({ length: windowEnd - windowStart + 1 }, (_, i) => windowStart + i);
                                const goTo = n => { setCurrentPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
                                return (
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 30, marginBottom: 8, flexWrap: 'wrap' }}>
                                        <button className="pr-page-btn" onClick={() => goTo(Math.max(1, currentPage - 1))} disabled={currentPage === 1}>‹</button>
                                        {windowStart > 1 && (<>
                                            <button className="pr-page-btn" onClick={() => goTo(1)}>1</button>
                                            <span style={{ color: 'rgba(255,255,255,.4)', fontFamily: "'Outfit'" }}>…</span>
                                        </>)}
                                        {pageNumbers.map(n => (
                                            <button key={n} className={`pr-page-btn${currentPage === n ? ' active' : ''}`} onClick={() => goTo(n)}>{n}</button>
                                        ))}
                                        {windowEnd < totalPages && (<>
                                            <span style={{ color: 'rgba(255,255,255,.4)', fontFamily: "'Outfit'" }}>…</span>
                                            <button className="pr-page-btn" onClick={() => goTo(totalPages)}>{totalPages}</button>
                                        </>)}
                                        <button className="pr-page-btn" onClick={() => goTo(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}>›</button>
                                        <span style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.72rem', color: 'rgba(255,255,255,.5)', marginLeft: 4 }}>Pág {currentPage} de {totalPages}</span>
                                    </div>
                                );
                            })()}

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
                                                        <p style={{ fontFamily: "'Outfit'", fontSize: '.75rem', color: 'rgba(255,255,255,.5)' }}>Pedido #{s.id} · ${(parseFloat(s.precio_unitario) * s.cantidad).toFixed(2)} · {new Date(s.created_at).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })}</p>
                                                        {s.estado === 'cancelada' && s.motivo_cancelacion && <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: '#f87171' }}>Motivo: {s.motivo_cancelacion}</p>}
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
                        </div>
                    </div>

                    {showBackToTop && (
                        <button className="pr-btt" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
                            <IconArrowUp />
                        </button>
                    )}
                </>
            )}

            <Footer />
        </div>
    );
}

/* Detalle + solicitud */
function ProductoDetalle({ producto, esCliente, estaLogueado, onVolver, onIrALogin, onPedidoRegistrado }) {
    const [cantidad, setCantidad] = useState(1);
    const [notas, setNotas]       = useState('');
    const [enviando, setEnviando] = useState(false);

    const cambiarCantidad = (delta) => {
        setCantidad(c => Math.max(1, Math.min(producto.stock_actual, c + delta)));
    };

    // 1) Registra el pedido en el sistema (el taller lo ve en "Pedidos de la
    //    tienda" y lo entrega descontando el inventario); 2) abre WhatsApp con
    //    el numero de pedido para coordinar pago y entrega.
    const solicitar = async () => {
        // La ventana se abre antes del await para que el navegador no la bloquee.
        // (con 'noopener' window.open devuelve null, por eso se corta el opener a mano)
        const ventana = window.open('', '_blank');
        if (ventana) ventana.opener = null;
        setEnviando(true);
        let numero = null;
        try {
            const { data } = await api.post('/solicitudes/productos', { repuesto_id: producto.id, cantidad, notas: notas.trim() || undefined });
            numero = data.solicitud.id;
            onPedidoRegistrado?.({ ...data.solicitud, repuesto_nombre: producto.nombre });
            toast.success(`Pedido #${numero} registrado. El taller lo verá enseguida.`);
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo registrar el pedido; igual puedes coordinarlo por WhatsApp.');
        } finally { setEnviando(false); }
        const detalle = `Hola, quiero comprar este producto:%0A%0A${numero ? `*Pedido #${numero}*%0A` : ''}*${encodeURIComponent(producto.nombre)}*%0ACódigo: ${producto.codigo || 'N/A'}%0ACantidad: ${cantidad}%0APrecio referencial: $${Number(producto.precio_venta || 0).toFixed(2)}${notas.trim() ? `%0AConsulta: ${encodeURIComponent(notas.trim())}` : ''}`;
        const url = `https://wa.me/593963863847?text=${detalle}`;
        if (ventana) ventana.location.href = url; else window.open(url, '_blank', 'noopener,noreferrer');
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
                                <button className="ps-btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={onIrALogin}><span>Iniciar sesión</span></button>
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

                                <button className="ps-btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: enviando ? .6 : 1 }} onClick={solicitar} disabled={enviando}>
                                    <span>{enviando ? 'Registrando pedido...' : 'Pedir y coordinar por WhatsApp'}</span>
                                </button>
                                <p style={{ fontFamily: "'Outfit'", fontSize: '.72rem', color: 'rgba(255,255,255,.3)', marginTop: 10, textAlign: 'center' }}>
                                    Tu pedido queda registrado en el taller y se abrirá WhatsApp con su número para coordinar el pago y la entrega. Puedes ver su estado abajo en "Mis solicitudes".
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
function IconSearch(props)  { return <svg {...props} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>; }
function IconX(props)       { return <svg {...props} width={props.size||14} height={props.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconBox()     { return <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>; }
function IconBack()    { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>; }
function IconMinus()   { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconPlus()    { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>; }
function IconSliders(props) { return <svg {...props} width={props.size||14} height={props.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>; }
function IconGrid()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>; }
function IconList()    { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>; }
function IconFilter()  { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>; }
function IconChevronDown(props) { return <svg {...props} width={props.size||14} height={props.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>; }
function IconZap(props) { return <svg {...props} width={props.size||14} height={props.size||14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>; }
function IconArrowUp() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>; }