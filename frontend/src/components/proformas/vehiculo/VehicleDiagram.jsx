/**
 * SS SWAP - Pictograma vehicular INTERACTIVO (SVG)
 *
 * El usuario marca MANUALMENTE las zonas dañadas: clic (o Enter/Espacio
 * con teclado) sobre una zona la marca en rojo; otro clic la desmarca. No
 * hay deteccion automatica de daños.
 *
 * La geometria NO esta dibujada a mano en este componente: sale de
 * vehiculoDiagramas.js (misma fuente que usa el backend para el PDF). Cada
 * zona es un <path> identificable por su codigo (ej. "puerta_del_izq"); una
 * misma zona puede aparecer en varias vistas (ej. el parachoques se ve en
 * la lateral, la superior y la frontal) y se resalta en todas a la vez.
 *
 * Props:
 *  - tipo: 'pickup' | 'hatchback' | 'sedan' | 'suv'
 *  - puertas: numero de puertas (hatchback 3/5, pickup 2/4)
 *  - seleccion: string[] con los codigos de zona marcados
 *  - onToggle(codigo): si se omite, el pictograma es de solo lectura
 *  - isDark: tema oscuro
 */
import React, { useMemo, useState } from 'react';
import { construirDiagrama, etiquetaZona } from './vehiculoDiagramas';
import './VehicleDiagram.css';

export function variablesTema(isDark) {
    return isDark ? {
        '--vd-body': '#1e293b', '--vd-body-dark': '#475569', '--vd-glass': 'rgba(56,189,248,0.28)',
        '--vd-wheel': '#020617', '--vd-zone': '#0f172a', '--vd-zone-hover': 'rgba(239,68,68,0.28)',
        '--vd-stroke': '#94a3b8', '--vd-stroke-soft': '#475569', '--vd-text': 'rgba(241,245,249,0.6)', '--vd-focus': '#38bdf8',
    } : {
        '--vd-body': '#e2e8f0', '--vd-body-dark': '#94a3b8', '--vd-glass': '#bae6fd',
        '--vd-wheel': '#1e293b', '--vd-zone': '#f8fafc', '--vd-zone-hover': '#fecaca',
        '--vd-stroke': '#475569', '--vd-stroke-soft': '#94a3b8', '--vd-text': '#64748b', '--vd-focus': '#0284c7',
    };
}

export default function VehicleDiagram({ tipo, puertas, seleccion = [], onToggle, isDark = false, titulo }) {
    const diagrama = useMemo(() => construirDiagrama(tipo, puertas), [tipo, puertas]);
    const [hover, setHover] = useState(null);
    if (!diagrama) return null;
    const marcadas = new Set(seleccion);
    const editable = typeof onToggle === 'function';

    const onKey = (e, codigo) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(codigo); }
    };

    return (
        <div className="vd-wrap" style={variablesTema(isDark)}>
            <svg className={`vd-svg${editable ? ' editable' : ''}`} viewBox={`0 0 ${diagrama.ancho} ${diagrama.alto}`}
                role="group" aria-label={titulo || `Pictograma de daños del vehículo (${tipo})`}>
                {diagrama.decor.filter(d => !d.sobre).map((d, i) => <path key={`d${i}`} d={d.d} className={`vd-decor ${d.clase}`} />)}
                {diagrama.zonas.map((z, i) => {
                    const danada = marcadas.has(z.codigo);
                    const etiqueta = etiquetaZona(z.codigo);
                    return (
                        <path key={`z${i}`} d={z.d} data-zona={z.codigo}
                            className={`vd-zona${danada ? ' danada' : ''}${hover === z.codigo ? ' hover' : ''}`}
                            {...(editable ? {
                                role: 'button', tabIndex: 0, 'aria-pressed': danada, 'aria-label': `${etiqueta}${danada ? ' (dañada)' : ''}`,
                                onClick: () => onToggle(z.codigo), onKeyDown: (e) => onKey(e, z.codigo),
                                onMouseEnter: () => setHover(z.codigo), onMouseLeave: () => setHover(null),
                            } : {})}>
                            <title>{etiqueta}{danada ? ' — dañada' : ''}</title>
                        </path>
                    );
                })}
                {diagrama.decor.filter(d => d.sobre).map((d, i) => <path key={`s${i}`} d={d.d} className={`vd-decor ${d.clase}`} />)}
                {diagrama.textos.map((t, i) => <text key={`t${i}`} x={t.x} y={t.y} textAnchor={t.anchor} className="vd-texto">{t.texto}</text>)}
            </svg>
        </div>
    );
}

/** Silueta lateral pequeña (para los botones de seleccion de tipo). */
export function SiluetaVehiculo({ tipo, puertas, isDark }) {
    const diagrama = useMemo(() => construirDiagrama(tipo, puertas), [tipo, puertas]);
    if (!diagrama) return null;
    // Recorta solo la vista lateral izquierda (franja superior del diagrama).
    return (
        <svg viewBox="180 6 460 160" className="vd-svg" style={variablesTema(isDark)} aria-hidden="true">
            {diagrama.decor.filter(d => !d.sobre).map((d, i) => <path key={i} d={d.d} className={`vd-decor ${d.clase}`} />)}
            {diagrama.zonas.map((z, i) => <path key={`z${i}`} d={z.d} className="vd-zona" />)}
            {diagrama.decor.filter(d => d.sobre).map((d, i) => <path key={`s${i}`} d={d.d} className={`vd-decor ${d.clase}`} />)}
        </svg>
    );
}
