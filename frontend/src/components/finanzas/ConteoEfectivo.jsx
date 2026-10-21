/**
 * SS SWAP - Conteo de efectivo por billetes y monedas (caja diaria).
 * Se usa al abrir y al cerrar la caja: se escribe cuantos billetes/monedas
 * hay de cada valor y se calcula el total de fracciones.
 */
import React from 'react';
import { dinero } from './tema';

export const BILLETES = ['100', '50', '20', '10', '5', '1'];
export const MONEDAS  = ['1', '0.5', '0.25', '0.10', '0.05', '0.01'];
// Las claves de monedas llevan prefijo para no chocar con el billete de $1.
const claveMoneda = (m) => (m === '1' ? 'm1' : m);

/** Total en dolares de un conteo { "20": 4, "m1": 2, "0.25": 8 } (redondeado a centavos). */
export function totalConteo(conteo) {
    let centavos = 0;
    for (const b of BILLETES) centavos += (parseInt(conteo[b], 10) || 0) * Math.round(Number(b) * 100);
    for (const m of MONEDAS) centavos += (parseInt(conteo[claveMoneda(m)], 10) || 0) * Math.round(Number(m) * 100);
    return centavos / 100;
}

/** Conteo para el backend: { "1": billetes+monedas de $1, "0.25": 8, ... } solo con cantidades > 0. */
export function conteoParaBackend(conteo) {
    const out = {};
    const sumar = (k, n) => { if (n > 0) out[k] = (out[k] || 0) + n; };
    for (const b of BILLETES) sumar(b, parseInt(conteo[b], 10) || 0);
    for (const m of MONEDAS) sumar(m, parseInt(conteo[claveMoneda(m)], 10) || 0);
    return out;
}

export const conteoVacio = (conteo) => Object.values(conteo).every(v => !(parseInt(v, 10) > 0));

export default function ConteoEfectivo({ theme, conteo, onChange }) {
    const { txt, txtSf, bdr, inputBg, SKY_PALE, SKY_DEEP } = theme;
    const total = totalConteo(conteo);
    const celda = { padding: '7px 10px', borderTop: `1px solid ${bdr}`, fontFamily: "'Outfit'", fontSize: '.9rem', color: txtSf };
    const th = { padding: '10px', fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', color: SKY_DEEP, background: SKY_PALE, textAlign: 'left' };
    const input = { width: '100%', minWidth: 54, boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8, border: `1px solid ${bdr}`, background: inputBg, color: txt, fontFamily: "'Outfit'", fontSize: '.95rem', textAlign: 'center', outline: 'none' };
    const set = (k, v) => onChange({ ...conteo, [k]: v.replace(/[^0-9]/g, '') });

    return (
        <div style={{ border: `1px solid ${bdr}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr><th style={th}>Billetes</th><th style={th}>Cantidad</th><th style={{ ...th, borderLeft: `1px solid ${bdr}` }}>Monedas</th><th style={th}>Cantidad</th></tr>
                </thead>
                <tbody>
                    {BILLETES.map((b, i) => {
                        const m = MONEDAS[i];
                        return (
                            <tr key={b}>
                                <td style={celda}>${b}</td>
                                <td style={celda}><input inputMode="numeric" aria-label={`Billetes de ${b}`} value={conteo[b] || ''} onChange={e => set(b, e.target.value)} style={input} /></td>
                                <td style={{ ...celda, borderLeft: `1px solid ${bdr}` }}>{m === '1' ? '$1' : `${Math.round(Number(m) * 100)}¢`}</td>
                                <td style={celda}><input inputMode="numeric" aria-label={`Monedas de ${m}`} value={conteo[claveMoneda(m)] || ''} onChange={e => set(claveMoneda(m), e.target.value)} style={input} /></td>
                            </tr>
                        );
                    })}
                    <tr>
                        <td colSpan={2} style={{ ...celda, fontWeight: 600, color: txt, background: SKY_PALE }}>Total fracciones</td>
                        <td colSpan={2} style={{ ...celda, borderLeft: `1px solid ${bdr}`, background: SKY_PALE, fontFamily: "'Bebas Neue'", fontSize: '1.4rem', color: txt, letterSpacing: '.03em' }}>{dinero(total)}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
