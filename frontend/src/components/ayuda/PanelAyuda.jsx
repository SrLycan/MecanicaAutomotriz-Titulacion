/**
 * SS SWAP - Centro de ayuda contextual: panel lateral con la guía de la sección (Sprint 27)
 *
 * Presentación únicamente: el contenido vive en src/ayuda/guias/*.json.
 * Secciones: descripción, funciones, paso a paso (con capturas reales
 * numeradas e indicador de paso), resultado esperado, advertencias y
 * solución de problemas. Teclado: Esc cierra, ← / → cambia de paso.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTemaPanel } from '../finanzas/tema';
import { urlImagenAyuda } from '../../ayuda/resolver';

function IconX() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>; }
function IconLupa() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>; }

/** Imagen de la guía con estado de carga, error ("pendiente") y ampliación. */
function ImagenAyuda({ imagen, onAmpliar, theme }) {
    const { bdr, mut, inputBg } = theme;
    const [estado, setEstado] = useState('cargando');
    useEffect(() => { setEstado('cargando'); }, [imagen.archivo]);
    if (estado === 'error') {
        return (
            <div role="img" aria-label={imagen.alt} style={{ border: `1px dashed ${bdr}`, borderRadius: 10, padding: '28px 16px', textAlign: 'center', fontFamily: "'Outfit'", fontSize: '.84rem', color: mut, background: inputBg }}>
                Imagen no disponible todavía (captura pendiente). Siga los pasos escritos.
            </div>
        );
    }
    return (
        <figure style={{ margin: 0 }}>
            <button type="button" onClick={onAmpliar} aria-label={`Ampliar imagen: ${imagen.alt}`}
                style={{ position: 'relative', display: 'block', width: '100%', padding: 0, border: `1px solid ${bdr}`, borderRadius: 10, overflow: 'hidden', cursor: 'zoom-in', background: inputBg, minHeight: estado === 'cargando' ? 120 : undefined }}>
                <img src={urlImagenAyuda(imagen.archivo)} alt={imagen.alt} loading="lazy"
                    onLoad={() => setEstado('ok')} onError={() => setEstado('error')}
                    style={{ display: 'block', width: '100%', height: 'auto', opacity: estado === 'ok' ? 1 : 0, transition: 'opacity .2s' }} />
                {estado === 'cargando' && <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit'", fontSize: '.82rem', color: mut }}>Cargando imagen…</span>}
                <span style={{ position: 'absolute', right: 8, bottom: 8, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(15,23,42,.78)', color: '#fff', borderRadius: 7, padding: '4px 8px', fontFamily: "'Outfit'", fontSize: '.74rem' }}><IconLupa /> Ampliar</span>
            </button>
            <figcaption style={{ fontFamily: "'Outfit'", fontSize: '.76rem', color: mut, marginTop: 5 }}>
                {imagen.tipo === 'esquema' ? 'Esquema ilustrativo (no es una captura).' : 'Captura real de la interfaz.'}
            </figcaption>
        </figure>
    );
}

export default function PanelAyuda({ guia, onClose }) {
    const theme = useTemaPanel();
    const { txt, txtSf, mut, bdr, boxBg, SKY_DEEP, SKY_PALE, inputBg } = theme;
    const [paso, setPaso] = useState(0);
    const [ampliada, setAmpliada] = useState(null);
    const panel = useRef(null);
    const pasos = guia.pasos || [];
    const actual = pasos[paso];

    const cambiarPaso = useCallback((d) => setPaso(p => Math.min(Math.max(p + d, 0), pasos.length - 1)), [pasos.length]);

    useEffect(() => { setPaso(0); }, [guia.id]);
    useEffect(() => {
        const previo = document.activeElement;
        panel.current?.focus();
        return () => { if (previo && previo.focus) previo.focus(); };
    }, []);
    useEffect(() => {
        const tecla = (e) => {
            if (ampliada) { if (e.key === 'Escape') { e.stopPropagation(); setAmpliada(null); } return; }
            if (e.key === 'Escape') onClose();
            const enCampo = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '');
            if (!enCampo && e.key === 'ArrowRight') cambiarPaso(1);
            if (!enCampo && e.key === 'ArrowLeft') cambiarPaso(-1);
        };
        window.addEventListener('keydown', tecla);
        return () => window.removeEventListener('keydown', tecla);
    }, [ampliada, onClose, cambiarPaso]);

    const Seccion = ({ titulo, children }) => (
        <section style={{ marginTop: 20 }}>
            <h3 style={{ fontFamily: "'Bebas Neue'", fontSize: '1.05rem', letterSpacing: '.08em', color: SKY_DEEP, marginBottom: 8 }}>{titulo}</h3>
            {children}
        </section>
    );
    const texto = { fontFamily: "'Outfit'", fontSize: '.92rem', lineHeight: 1.55, color: txtSf };
    const btnNav = (activo) => ({ fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.86rem', padding: '8px 14px', borderRadius: 9, border: `1px solid ${bdr}`, background: activo ? SKY_PALE : 'transparent', color: activo ? txt : mut, cursor: activo ? 'pointer' : 'not-allowed' });

    return (
        <div className="ayuda-fondo" onClick={e => e.target === e.currentTarget && onClose()}>
            <aside ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ayuda-titulo" className="ayuda-panel"
                style={{ background: boxBg, borderLeft: `1px solid ${bdr}`, color: txt }}>
                <header style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '18px 20px', borderBottom: `1px solid ${bdr}`, position: 'sticky', top: 0, background: boxBg, zIndex: 1 }}>
                    <div style={{ minWidth: 0 }}>
                        <p style={{ fontFamily: "'Bebas Neue'", fontSize: '.8rem', letterSpacing: '.2em', color: SKY_DEEP }}>AYUDA · {guia.grupo}</p>
                        <h2 id="ayuda-titulo" style={{ fontFamily: "'Bebas Neue'", fontSize: '1.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1.1 }}>{guia.titulo}</h2>
                    </div>
                    <button type="button" onClick={onClose} aria-label="Cerrar la ayuda" style={{ background: 'none', border: `1px solid ${bdr}`, borderRadius: 9, padding: 7, cursor: 'pointer', color: mut, display: 'flex', flexShrink: 0 }}><IconX /></button>
                </header>

                <div style={{ padding: '4px 20px 24px' }}>
                    <Seccion titulo="¿Para qué sirve?"><p style={texto}>{guia.descripcion}</p></Seccion>

                    {guia.funciones?.length > 0 && (
                        <Seccion titulo="Qué puede hacer aquí">
                            <ul style={{ ...texto, paddingLeft: 20, margin: 0 }}>{guia.funciones.map((f, i) => <li key={i} style={{ marginBottom: 3 }}>{f}</li>)}</ul>
                        </Seccion>
                    )}

                    {actual && (
                        <Seccion titulo="Paso a paso">
                            <div style={{ border: `1px solid ${bdr}`, borderRadius: 12, padding: 14, background: inputBg }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                                    <p aria-live="polite" style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: '.86rem', color: SKY_DEEP }}>Paso {paso + 1} de {pasos.length}</p>
                                    <div role="tablist" aria-label="Pasos de la guía" style={{ display: 'flex', gap: 5 }}>
                                        {pasos.map((p, i) => (
                                            <button key={i} type="button" role="tab" aria-selected={i === paso} aria-label={`Paso ${i + 1}: ${p.titulo}`} onClick={() => setPaso(i)}
                                                style={{ width: i === paso ? 22 : 10, height: 10, borderRadius: 999, border: 'none', cursor: 'pointer', background: i === paso ? SKY_DEEP : bdr, transition: 'width .15s', padding: 0 }} />
                                        ))}
                                    </div>
                                </div>
                                <h4 style={{ fontFamily: "'Outfit'", fontWeight: 700, fontSize: '1rem', color: txt, marginBottom: 6 }}>{actual.titulo}</h4>
                                {(Array.isArray(actual.texto) ? actual.texto : [actual.texto]).map((t, i) => <p key={i} style={{ ...texto, marginBottom: 6 }}>{t}</p>)}
                                {actual.imagen && <div style={{ marginTop: 10 }}><ImagenAyuda imagen={actual.imagen} theme={theme} onAmpliar={() => setAmpliada(actual.imagen)} /></div>}
                                {actual.marcas?.length > 0 && (
                                    <ol style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', display: 'grid', gap: 6 }}>
                                        {actual.marcas.map((m, i) => (
                                            <li key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', ...texto, fontSize: '.88rem' }}>
                                                <span aria-hidden="true" style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: '#e11d48', color: '#fff', fontWeight: 700, fontSize: '.78rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                                                <span><span className="sr-only">Marca {i + 1}: </span>{typeof m === 'string' ? m : m.texto}</span>
                                            </li>
                                        ))}
                                    </ol>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 14 }}>
                                    <button type="button" onClick={() => cambiarPaso(-1)} disabled={paso === 0} style={btnNav(paso > 0)}>← Anterior</button>
                                    <button type="button" onClick={() => cambiarPaso(1)} disabled={paso === pasos.length - 1} style={btnNav(paso < pasos.length - 1)}>Siguiente →</button>
                                </div>
                            </div>
                        </Seccion>
                    )}

                    {guia.resultado && <Seccion titulo="Resultado esperado"><p style={texto}>{guia.resultado}</p></Seccion>}

                    {guia.advertencias?.length > 0 && (
                        <Seccion titulo="Advertencias">
                            <ul role="note" style={{ ...texto, margin: 0, padding: '10px 14px 10px 32px', borderRadius: 10, background: '#f59e0b14', border: '1px solid #f59e0b55' }}>
                                {guia.advertencias.map((a, i) => <li key={i} style={{ marginBottom: 4 }}>{a}</li>)}
                            </ul>
                        </Seccion>
                    )}

                    {guia.problemas?.length > 0 && (
                        <Seccion titulo="Solución de problemas">
                            {guia.problemas.map((p, i) => (
                                <details key={i} style={{ border: `1px solid ${bdr}`, borderRadius: 10, padding: '9px 12px', marginBottom: 8 }}>
                                    <summary style={{ cursor: 'pointer', fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.9rem', color: txt }}>{p.problema}</summary>
                                    <p style={{ ...texto, marginTop: 6 }}>{p.solucion}</p>
                                </details>
                            ))}
                        </Seccion>
                    )}

                    <p style={{ fontFamily: "'Outfit'", fontSize: '.76rem', color: mut, marginTop: 22, borderTop: `1px solid ${bdr}`, paddingTop: 10 }}>
                        Guía «{guia.id}» · versión {guia.version} · actualizada {guia.actualizada}. Atajos: Esc cierra · ← → cambia de paso.
                    </p>
                </div>
            </aside>

            {ampliada && (
                <div className="ayuda-zoom" role="dialog" aria-modal="true" aria-label={`Imagen ampliada: ${ampliada.alt}`} onClick={() => setAmpliada(null)}>
                    <img src={urlImagenAyuda(ampliada.archivo)} alt={ampliada.alt} />
                    <button type="button" onClick={() => setAmpliada(null)} aria-label="Cerrar imagen ampliada" className="ayuda-zoom-cerrar"><IconX /></button>
                </div>
            )}
        </div>
    );
}
