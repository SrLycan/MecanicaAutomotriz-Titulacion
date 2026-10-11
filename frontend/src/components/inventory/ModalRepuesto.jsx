/**
 * SS SWAP - Modal de Creación y Edición de Repuestos
 * Gestiona ficha técnica, imágenes comprimidas en cliente, precios de compra/venta y margen de utilidad.
 * La lógica de imágenes (compresión, resolución de URLs) vive en utils/imagen.js.
 */
import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { useTheme } from '../../context/ThemeContext';
import { resolveImagenSrc, fileToDataUrl, comprimirImagen } from '../../utils/imagen';

const EMPTY = {
    codigo: '',            // referencia interna: la genera el sistema
    codigo_proveedor: '',  // codigo del proveedor / fabricante (manual)
    nombre: '',
    descripcion: '',
    categoria_id: '',
    precio_compra: '',
    precio_venta: '',
    stock_actual: '',
    stock_minimo: '5',
    unidad_medida: 'unidad',
    imagen_url: '',
    en_venta: false,
    area: 'mecanica',
};

function IconX() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconImage() { return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>; }

const getImagenSrc = (repuesto = {}) => resolveImagenSrc(repuesto.imagen_url || repuesto.imagen || repuesto.foto_url || repuesto.foto || '');

export default function ModalRepuesto({ repuesto, categorias, onGuardar, onCerrar, areaInicial = 'mecanica' }) {
    const { isDark } = useTheme();
    const [form, setForm] = useState(EMPTY);
    const [preview, setPreview] = useState('');
    const [saving, setSaving] = useState(false);
    const objectUrlRef = useRef('');
    const esEdicion = Boolean(repuesto);

    // ── Paleta celeste / blanco / negro ──
    const SKY      = '#0ea5e9';
    const SKY_DEEP = '#0284c7';
    const SKY_PALE = isDark ? 'rgba(14,165,233,0.10)' : 'rgba(14,165,233,0.06)';
    const SKY_BDR  = isDark ? 'rgba(56,189,248,0.22)' : 'rgba(14,165,233,0.22)';

    const txt     = isDark ? '#f1f5f9'                : '#0f172a';
    const mut     = isDark ? 'rgba(241,245,249,0.55)' : 'rgba(15,23,42,0.55)';
    const bdr     = isDark ? 'rgba(148,163,184,0.18)' : '#b6c3d3';
    const inputBg = isDark ? '#0b1220'                : '#f8fafc';
    const boxBg   = isDark ? '#0a0f1c'                : '#ffffff';

    const inputSt = {
        width: '100%', boxSizing: 'border-box',
        padding: '10px 13px', borderRadius: 10,
        border: `1px solid ${bdr}`, background: inputBg, color: txt,
        fontFamily: "'Outfit', sans-serif", fontWeight: 400, fontSize: '.88rem',
        outline: 'none', transition: 'border-color .18s, box-shadow .18s',
    };
    const labelSt = {
        display: 'block', marginBottom: 6,
        fontFamily: "'Bebas Neue', sans-serif", fontSize: '.62rem', letterSpacing: '.22em',
        color: SKY_DEEP, WebkitTextFillColor: SKY_DEEP, background: 'none',
    };

    const limpiarObjectUrl = () => {
        if (objectUrlRef.current) {
            URL.revokeObjectURL(objectUrlRef.current);
            objectUrlRef.current = '';
        }
    };

    useEffect(() => () => limpiarObjectUrl(), []);

    useEffect(() => {
        limpiarObjectUrl();

        if (repuesto) {
            const imagen = repuesto.imagen_url || repuesto.imagen || repuesto.foto_url || repuesto.foto || '';
            const nextForm = {
                codigo: repuesto.codigo || '',
                codigo_proveedor: repuesto.codigo_proveedor || '',
                nombre: repuesto.nombre || '',
                descripcion: repuesto.descripcion || '',
                categoria_id: repuesto.categoria_id || '',
                precio_compra: repuesto.precio_compra || '',
                precio_venta: repuesto.precio_venta || '',
                stock_actual: repuesto.stock_actual || '',
                stock_minimo: repuesto.stock_minimo || '5',
                unidad_medida: repuesto.unidad_medida || 'unidad',
                imagen_url: imagen,
                en_venta: Boolean(repuesto.en_venta),
                area: repuesto.area || 'mecanica',
            };
            setForm(nextForm);
            setPreview(resolveImagenSrc(imagen));
        } else {
            setForm({ ...EMPTY, area: areaInicial });
            setPreview('');
        }
    }, [repuesto, areaInicial]);

    const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
    const onFocus = (e) => { e.target.style.borderColor = SKY; e.target.style.boxShadow = `0 0 0 3px rgba(14,165,233,.14)`; };
    const onBlur  = (e) => { e.target.style.borderColor = bdr; e.target.style.boxShadow = 'none'; };

    const handleImagenFile = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const dataUrl = await comprimirImagen(file);
            setForm(f => ({ ...f, imagen_url: dataUrl }));
            setPreview(dataUrl);
        } catch { toast.error('No se pudo procesar la imagen.'); }
    };

    const quitarImagen = () => {
        setForm(f => ({ ...f, imagen_url: '' }));
        setPreview('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        // La referencia interna no se envia: la genera (y la conserva) el servidor.
        const { codigo, ...datos } = form;
        await onGuardar({ ...datos, codigo_proveedor: (form.codigo_proveedor || '').trim(), imagen_url: form.imagen_url || '' });
        setSaving(false);
    };

    const urlValue = form.imagen_url?.startsWith('data:image/') ? '' : form.imagen_url;

    return (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onCerrar()}>
            <div className="modal-box" style={{ maxWidth: 580, background: boxBg, border: `1px solid ${bdr}`, padding: 28 }}>
                {/* Línea de acento superior celeste */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, transparent, ${SKY}, ${SKY_DEEP}, ${SKY}, transparent)`, borderRadius: '20px 20px 0 0' }} />

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '3px 9px', borderRadius: 999, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, marginBottom: 6 }}>
                            <span style={{ width: 5, height: 5, borderRadius: '50%', background: SKY }} />
                            <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.24em', color: SKY_DEEP }}>ADMIN · INVENTARIO</p>
                        </div>
                        <h2 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.7rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>
                            {esEdicion ? 'Editar Repuesto' : 'Nuevo Repuesto'}
                        </h2>
                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.78rem', color: mut, marginTop: 5 }}>
                            {esEdicion ? 'Modifica la informacion del repuesto en catalogo' : 'Registra un nuevo articulo en el inventario'}
                        </p>
                    </div>
                    <button onClick={onCerrar}
                        style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,.1)'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,.25)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = mut; e.currentTarget.style.borderColor = bdr; }}>
                        <IconX />
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 13 }}>
                        {/* Referencia interna (automatica) */}
                        <div>
                            <label style={labelSt}>CÓDIGO DE REFERENCIA INTERNO</label>
                            <input value={esEdicion ? form.codigo : 'Se genera automáticamente'} readOnly disabled
                                title="Lo genera el sistema al guardar; es el único código que aparece en proformas"
                                style={{ ...inputSt, opacity: .6, fontStyle: esEdicion ? 'normal' : 'italic' }} />
                        </div>

                        {/* Codigo del proveedor / fabricante */}
                        <div>
                            <label style={labelSt}>CÓDIGO DE PROVEEDOR / FABRICANTE</label>
                            <input name="codigo_proveedor" value={form.codigo_proveedor} onChange={handleChange}
                                onFocus={onFocus} onBlur={onBlur} maxLength={100}
                                placeholder="Opcional (ej. 90915-YZZE1)"
                                style={inputSt} />
                        </div>

                        {/* Unidad */}
                        <div>
                            <label style={labelSt}>UNIDAD DE MEDIDA</label>
                            <select name="unidad_medida" value={form.unidad_medida} onChange={handleChange}
                                onFocus={onFocus} onBlur={onBlur} style={inputSt}>
                                {['unidad','litro','galon','kg','metro','juego','par','caja','pliego'].map(u => <option key={u}>{u}</option>)}
                            </select>
                        </div>

                        {/* Inventario / area (Sprint 14) */}
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>INVENTARIO</label>
                            <select name="area" value={form.area} onChange={handleChange} onFocus={onFocus} onBlur={onBlur} style={inputSt}>
                                <option value="mecanica">Inventario Mecánica</option>
                                <option value="colisiones">Inventario Colisiones / Pintura</option>
                            </select>
                        </div>

                        {/* Nombre */}
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>NOMBRE *</label>
                            <input name="nombre" value={form.nombre} onChange={handleChange}
                                onFocus={onFocus} onBlur={onBlur}
                                required placeholder="Nombre del repuesto" style={inputSt} />
                        </div>

                        {/* Descripcion */}
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>DESCRIPCION</label>
                            <textarea name="descripcion" value={form.descripcion} onChange={handleChange}
                                onFocus={onFocus} onBlur={onBlur}
                                rows={2} placeholder="Descripcion breve del repuesto..."
                                style={{ ...inputSt, resize: 'vertical', minHeight: 64 }} />
                        </div>

                        {/* Imagen */}
                        <div style={{ gridColumn: '1/-1' }}>
                            <label className="ssswap-label">FOTO DEL REPUESTO</label>
                            <div style={{ display: 'grid', gridTemplateColumns: '108px 1fr', gap: 12, alignItems: 'stretch' }}>
                                <div style={{ minHeight: 108, borderRadius: 14, border: `1px dashed ${bdr}`, background: isDark ? 'rgba(255,255,255,.025)' : 'rgba(124,58,237,.035)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', color: mut }}>
                                    {preview ? (
                                        <img src={preview} alt="Vista previa del repuesto" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setPreview('')} />
                                    ) : (
                                        <div style={{ textAlign: 'center' }}>
                                            <IconImage />
                                            <p style={{ fontFamily: "'Outfit'", fontSize: '.68rem', marginTop: 6 }}>Sin foto</p>
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <input className="ssswap-input" type="file" accept="image/*" onChange={handleImagenFile} style={{ ...inputSt, padding: '9px 12px' }} />
                                    <input className="ssswap-input" name="imagen_url" value={urlValue} onChange={handleChange}
                                        placeholder="O pega una URL/ruta de imagen..." style={inputSt} />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                                        <p style={{ fontFamily: "'Outfit'", fontWeight: 300, fontSize: '.68rem', color: mut }}>
                                            {form.imagen_url?.startsWith('data:image/') ? 'Imagen cargada desde archivo.' : 'Puedes pegar una URL o subir una foto.'}
                                        </p>
                                        {preview && (
                                            <button type="button" className="btn-ghost" onClick={quitarImagen}>
                                                Quitar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Categoria */}
                        <div style={{ gridColumn: '1/-1' }}>
                            <label style={labelSt}>CATEGORIA</label>
                            <select name="categoria_id" value={form.categoria_id} onChange={handleChange}
                                onFocus={onFocus} onBlur={onBlur} style={inputSt}>
                                <option value="">Sin categoria</option>
                                {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                            </select>
                        </div>

                        {/* Precios */}
                        <div>
                            <label style={labelSt}>PRECIO COMPRA (USD)</label>
                            <input type="number" min="0" step="0.01" name="precio_compra"
                                onFocus={onFocus} onBlur={onBlur}
                                value={form.precio_compra} onChange={handleChange} placeholder="0.00" style={inputSt} />
                        </div>
                        <div>
                            <label style={labelSt}>PRECIO VENTA (USD)</label>
                            <input type="number" min="0" step="0.01" name="precio_venta"
                                onFocus={onFocus} onBlur={onBlur}
                                value={form.precio_venta} onChange={handleChange} placeholder="0.00" style={inputSt} />
                        </div>

                        {/* Stock */}
                        <div>
                            <label style={labelSt}>
                                {esEdicion ? 'STOCK ACTUAL (usar Movimientos)' : 'STOCK INICIAL'}
                            </label>
                            <input type="number" min="0" step="0.01" name="stock_actual"
                                onFocus={onFocus} onBlur={onBlur}
                                value={form.stock_actual} onChange={handleChange}
                                disabled={esEdicion}
                                style={{ ...inputSt, opacity: esEdicion ? .45 : 1 }} />
                        </div>
                        <div>
                            <label style={labelSt}>STOCK MINIMO (alerta)</label>
                            <input type="number" min="0" step="0.01" name="stock_minimo"
                                onFocus={onFocus} onBlur={onBlur}
                                value={form.stock_minimo} onChange={handleChange} style={inputSt} />
                        </div>
                    </div>

                    <div style={{ gridColumn: '1/-1', padding: '12px 14px', borderRadius: 12, background: SKY_PALE, border: `1px solid ${SKY_BDR}` }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={Boolean(form.en_venta)}
                                onChange={(e) => setForm(f => ({ ...f, en_venta: e.target.checked }))}
                                style={{ width: 16, height: 16, accentColor: SKY, marginTop: 2 }}
                            />
                            <span>
                                <span style={{ display: 'block', fontFamily: "'Bebas Neue'", fontSize: '.62rem', letterSpacing: '.22em', color: SKY_DEEP }}>MARCAR PARA VENTA</span>
                                <span style={{ display: 'block', fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginTop: 4 }}>
                                    Si está activado, el producto aparecerá en el panel del cliente como disponible para compra.
                                </span>
                            </span>
                        </label>
                    </div>

                    {/* Margen */}
                    {form.precio_compra && form.precio_venta && parseFloat(form.precio_compra) > 0 && (
                        <div style={{ padding: '12px 16px', borderRadius: 12, background: SKY_PALE, border: `1px solid ${SKY_BDR}`, display: 'flex', alignItems: 'center', gap: 24 }}>
                            <div>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.2em', color: SKY_DEEP }}>MARGEN</p>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.04em', color: '#10b981', lineHeight: 1, marginTop: 2 }}>
                                    {((parseFloat(form.precio_venta) - parseFloat(form.precio_compra)) / parseFloat(form.precio_compra) * 100).toFixed(1)}%
                                </p>
                            </div>
                            <div style={{ width: 1, height: 30, background: SKY_BDR }} />
                            <div>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.55rem', letterSpacing: '.2em', color: SKY_DEEP }}>UTILIDAD POR UNIDAD</p>
                                <p style={{ fontFamily: "'Bebas Neue'", fontSize: '1.4rem', letterSpacing: '.04em', color: SKY_DEEP, lineHeight: 1, marginTop: 2 }}>
                                    ${(parseFloat(form.precio_venta) - parseFloat(form.precio_compra)).toFixed(2)}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Footer */}
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 16, borderTop: `1px solid ${bdr}`, marginTop: 4 }}>
                        <button type="button" onClick={onCerrar}
                            style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', background: 'none', border: `1px solid ${bdr}`, borderRadius: 10, padding: '10px 18px', cursor: 'pointer', color: mut, transition: 'all .18s' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = SKY_BDR; e.currentTarget.style.color = txt; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = bdr; e.currentTarget.style.color = mut; }}>
                            CANCELAR
                        </button>
                        <button type="submit" disabled={saving}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: "'Bebas Neue'", fontSize: '.78rem', letterSpacing: '.14em', color: '#fff', background: `linear-gradient(135deg, ${SKY_DEEP}, ${SKY})`, border: 'none', borderRadius: 10, padding: '10px 22px', cursor: saving ? 'not-allowed' : 'pointer', transition: 'all .2s', opacity: saving ? .6 : 1, boxShadow: `0 6px 18px -6px ${SKY}` }}
                            onMouseEnter={e => { if (!saving) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 10px 26px -8px ${SKY}`; } }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = `0 6px 18px -6px ${SKY}`; }}>
                            {saving ? 'GUARDANDO...' : esEdicion ? 'GUARDAR CAMBIOS' : 'CREAR REPUESTO'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
