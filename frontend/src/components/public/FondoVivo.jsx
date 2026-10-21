/**
 * SS SWAP - Fondo vivo de la web pública.
 * Capa fija detrás del contenido (z-index -1 dentro de .web) con luces difusas,
 * líneas de luz y algunas partículas. Las luces se desplazan a distinta velocidad
 * al hacer scroll (parallax) y los elementos [data-w-parallax] de la página se
 * mueven con su factor. Todo con transform en un único requestAnimationFrame.
 * Con "reducir movimiento" o en pantallas táctiles pequeñas queda estático.
 * Decorativo: aria-hidden y pointer-events: none (ver styles/web-publica.css).
 */
import React, { useEffect, useRef } from 'react';

// Posiciones fijas (no aleatorias) para que el fondo no "salte" entre visitas.
const PARTICULAS = [
    [8, 18, 3], [17, 64, 2], [26, 34, 2], [34, 82, 3], [43, 12, 2], [51, 56, 2],
    [59, 28, 3], [66, 74, 2], [74, 44, 2], [82, 16, 3], [89, 62, 2], [94, 88, 2],
];

const RECORRIDO = 2400;

export default function FondoVivo() {
    const raiz = useRef(null);

    useEffect(() => {
        const nodo = raiz.current;
        if (!nodo) return undefined;
        const reducir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const tactilPequeno = window.matchMedia && window.matchMedia('(max-width: 768px) and (pointer: coarse)').matches;
        if (reducir || tactilPequeno) return undefined;

        const capas = Array.from(nodo.querySelectorAll('[data-vel]'));
        const pagina = nodo.closest('.web');
        let elementos = [];
        // Posición de cada elemento con parallax respecto al documento (se mide solo al cambiar el tamaño).
        const medir = () => {
            elementos = pagina ? Array.from(pagina.querySelectorAll('[data-w-parallax]')).map(el => {
                el.style.transform = '';
                const r = el.getBoundingClientRect();
                return { el, f: parseFloat(el.dataset.wParallax) || 0, centro: r.top + window.scrollY + r.height / 2 };
            }) : [];
        };

        let raf = null;
        const pintar = () => {
            raf = null;
            const y = window.scrollY;
            const alto = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
            const avance = Math.min(y / alto, 1);
            // Recorrido acotado: de arriba a abajo de la página cada capa se mueve
            // como máximo vel × RECORRIDO px, así nunca sale de la pantalla.
            capas.forEach(c => {
                const v = parseFloat(c.dataset.vel);
                const dx = parseFloat(c.dataset.dx || 0) * avance;
                c.style.transform = `translate3d(${dx}vw, ${-avance * v * RECORRIDO}px, 0)`;
            });
            const mitad = y + window.innerHeight / 2;
            elementos.forEach(({ el, f, centro }) => {
                el.style.transform = `translate3d(0, ${(mitad - centro) * f}px, 0)`;
            });
        };
        const alScroll = () => { if (raf === null) raf = requestAnimationFrame(pintar); };
        const alCambiar = () => { medir(); alScroll(); };

        medir();
        pintar();
        window.addEventListener('scroll', alScroll, { passive: true });
        window.addEventListener('resize', alCambiar);
        // El contenido que llega de la API cambia la altura: se vuelve a medir.
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(alCambiar) : null;
        if (ro && pagina) ro.observe(pagina);
        return () => {
            window.removeEventListener('scroll', alScroll);
            window.removeEventListener('resize', alCambiar);
            if (ro) ro.disconnect();
            if (raf !== null) cancelAnimationFrame(raf);
            elementos.forEach(({ el }) => { el.style.transform = ''; });
        };
    }, []);

    return (
        <div className="w-fondo" ref={raiz} aria-hidden="true">
            <div className="w-fondo-luz w-fondo-luz--1" data-vel="0.06" data-dx="-6" />
            <div className="w-fondo-luz w-fondo-luz--2" data-vel="0.12" data-dx="8" />
            <div className="w-fondo-luz w-fondo-luz--3" data-vel="0.035" />
            <div className="w-fondo-rejilla" data-vel="0.02" />
            <div className="w-fondo-linea w-fondo-linea--1" data-vel="0.09" />
            <div className="w-fondo-linea w-fondo-linea--2" data-vel="0.16" />
            <div className="w-fondo-particulas" data-vel="0.05">
                {PARTICULAS.map(([x, y, t], i) => (
                    <span key={i} style={{ left: `${x}%`, top: `${y}%`, width: t, height: t, animationDelay: `${(i % 6) * -2.3}s` }} />
                ))}
            </div>
        </div>
    );
}
