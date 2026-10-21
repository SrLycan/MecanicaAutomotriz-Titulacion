/**
 * SS SWAP - Aparición suave de bloques al desplazarse (solo web pública).
 * Marca con `w-visible` cada elemento `.w-rev` dentro de `raiz` cuando entra en
 * pantalla. Si el navegador no tiene IntersectionObserver o el usuario pidió
 * reducir el movimiento, todo se muestra de inmediato: nunca queda oculto.
 * `deps` permite volver a observar cuando llegan datos de la API.
 * Terminada la aparición se quita la clase `w-rev` para que el elemento recupere
 * sus propias transiciones (hover sin el retraso escalonado de la entrada).
 */
import { useEffect } from 'react';

export default function useRevelar(raiz, deps = []) {
    useEffect(() => {
        const nodo = raiz.current;
        if (!nodo) return undefined;
        const elementos = Array.from(nodo.querySelectorAll('.w-rev:not(.w-visible)'));
        const reducir = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reducir || typeof IntersectionObserver === 'undefined') {
            elementos.forEach(el => el.classList.add('w-visible'));
            return undefined;
        }
        const temporizadores = [];
        const io = new IntersectionObserver((entradas) => {
            entradas.forEach(e => {
                if (!e.isIntersecting) return;
                const el = e.target;
                el.classList.add('w-visible');
                io.unobserve(el);
                const retraso = parseFloat(getComputedStyle(el).getPropertyValue('--w-retraso')) || 0;
                temporizadores.push(setTimeout(() => el.classList.remove('w-rev', 'w-rev-img'), 1500 + retraso));
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        elementos.forEach(el => io.observe(el));
        return () => { io.disconnect(); temporizadores.forEach(clearTimeout); };
    }, deps); // deps: lo decide quien llama (p. ej. datos recién cargados)
}
