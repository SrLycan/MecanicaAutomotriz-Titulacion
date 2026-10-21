/**
 * SS SWAP - Seccion "Daños del vehículo" de la proforma de Colisiones
 *
 * Flujo: 1) elegir tipo de vehiculo [PICKUP][HATCHBACK][SEDAN][SUV]
 *        2) aparece el pictograma correspondiente
 *        3) el usuario marca/desmarca MANUALMENTE las zonas dañadas
 *        4) agrega observaciones de los daños
 *
 * Es un componente controlado: el formulario padre guarda
 * { carroceria_tipo, carroceria_puertas, zonas_danadas, danos_observaciones }
 * y los envia tal cual al backend (que vuelve a validar las zonas).
 */
import React from 'react';
import toast from 'react-hot-toast';
import { DIAGRAMAS, SiluetaVehiculo, CARROCERIAS, TIPOS_CARROCERIA, etiquetaZona, zonasValidas, normalizarPuertas } from './vehiculo';

const ETIQUETA_PUERTAS = { pickup: { 2: 'Cabina simple', 4: 'Cabina doble' }, hatchback: { 3: '3 puertas', 5: '5 puertas' } };

export default function PictogramaColisiones({ theme, isDark, valor, onChange }) {
    const { txt, mut, bdr, inputSt, labelSt, SKY_DEEP, SKY_PALE } = theme;
    const { carroceria_tipo: tipo, carroceria_puertas: puertas, zonas_danadas: zonas = [], danos_observaciones: obs = '' } = valor;
    const Diagrama = tipo ? DIAGRAMAS[tipo] : null;

    const cambiar = (parcial) => onChange({ ...valor, ...parcial });

    const elegirTipo = (nuevo) => {
        if (nuevo === tipo) return;
        // Al cambiar de carroceria las zonas anteriores dejan de tener sentido
        // (otra geometria / otras piezas): se limpian y se avisa.
        if (zonas.length) toast(`Se limpiaron ${zonas.length} zona(s) marcadas del vehículo anterior.`, { icon: 'ℹ️' });
        cambiar({ carroceria_tipo: nuevo, carroceria_puertas: CARROCERIAS[nuevo].puertasDefecto, zonas_danadas: [] });
    };

    const elegirPuertas = (n) => {
        const validas = new Set(zonasValidas(tipo, n));
        const quedan = zonas.filter(z => validas.has(z));
        if (quedan.length !== zonas.length) toast(`Se quitaron ${zonas.length - quedan.length} zona(s) que no existen en esta versión.`, { icon: 'ℹ️' });
        cambiar({ carroceria_puertas: n, zonas_danadas: quedan });
    };

    const toggle = (codigo) => cambiar({
        zonas_danadas: zonas.includes(codigo) ? zonas.filter(z => z !== codigo) : [...zonas, codigo],
    });

    return (
        <div>
            <p style={{ ...labelSt, marginBottom: 10 }}>TIPO DE VEHÍCULO</p>
            <div className="vd-tipo-grid" style={{ '--pf-bdr': bdr, '--pf-sky': SKY_DEEP, '--pf-sky-pale': SKY_PALE, marginBottom: 16 }}>
                {TIPOS_CARROCERIA.map(t => (
                    <button key={t} type="button" className={`vd-tipo-btn${tipo === t ? ' activo' : ''}`} onClick={() => elegirTipo(t)}
                        aria-pressed={tipo === t}>
                        <SiluetaVehiculo tipo={t} isDark={isDark} />
                        <span style={{ fontFamily: "'Bebas Neue'", fontSize: '.95rem', letterSpacing: '.12em', color: tipo === t ? SKY_DEEP : txt }}>
                            {CARROCERIAS[t].etiqueta.toUpperCase()}
                        </span>
                    </button>
                ))}
            </div>

            {!tipo && (
                <p style={{ fontFamily: "'Outfit'", fontSize: '.84rem', color: mut, padding: '18px 0', textAlign: 'center', border: `1px dashed ${bdr}`, borderRadius: 12 }}>
                    Selecciona el tipo de vehículo para ver el pictograma y marcar las zonas dañadas.
                </p>
            )}

            {tipo && (
                <>
                    {CARROCERIAS[tipo].puertas.length > 1 && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut }}>Versión:</span>
                            {CARROCERIAS[tipo].puertas.map(n => {
                                const activo = normalizarPuertas(tipo, puertas) === n;
                                return (
                                    <button key={n} type="button" onClick={() => elegirPuertas(n)}
                                        style={{ fontFamily: "'Outfit'", fontSize: '.8rem', padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
                                            border: `1px solid ${activo ? SKY_DEEP : bdr}`, background: activo ? SKY_PALE : 'none', color: activo ? SKY_DEEP : txt }}>
                                        {ETIQUETA_PUERTAS[tipo]?.[n] || `${n} puertas`}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    <p style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut, marginBottom: 6 }}>
                        Haz clic sobre cada zona dañada para marcarla en rojo; vuelve a hacer clic para quitar la marca.
                    </p>
                    <div style={{ border: `1px solid ${bdr}`, borderRadius: 12, padding: 10 }}>
                        <Diagrama puertas={puertas} seleccion={zonas} onToggle={toggle} isDark={isDark} />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 0 8px', gap: 10, flexWrap: 'wrap' }}>
                        <p style={{ ...labelSt, marginBottom: 0 }}>ZONAS AFECTADAS ({zonas.length})</p>
                        {zonas.length > 0 && (
                            <button type="button" onClick={() => cambiar({ zonas_danadas: [] })}
                                style={{ fontFamily: "'Outfit'", fontSize: '.76rem', background: 'none', border: 'none', color: mut, cursor: 'pointer', textDecoration: 'underline' }}>
                                Quitar todas
                            </button>
                        )}
                    </div>
                    {zonas.length === 0
                        ? <p style={{ fontFamily: "'Outfit'", fontSize: '.8rem', color: mut }}>Ninguna zona marcada todavía.</p>
                        : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {zonas.map(z => (
                                    <span key={z} className="vd-chip">
                                        {etiquetaZona(z)}
                                        <button type="button" onClick={() => toggle(z)} aria-label={`Quitar ${etiquetaZona(z)}`}>×</button>
                                    </span>
                                ))}
                            </div>
                        )}

                    <div style={{ marginTop: 14 }}>
                        <label style={labelSt}>OBSERVACIONES DE LOS DAÑOS</label>
                        <textarea value={obs || ''} onChange={e => cambiar({ danos_observaciones: e.target.value })} rows={3}
                            placeholder="Ej: golpe frontal lado conductor, faro izquierdo roto, rayón profundo en puerta..."
                            style={{ ...inputSt, resize: 'vertical' }} />
                    </div>
                </>
            )}
        </div>
    );
}
