/**
 * SS SWAP - Plataforma: migraciones aplicadas y errores técnicos recientes.
 */
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { usePaleta, bebas, outfit, Pildora } from '../../components/common/PanelUI';
import '../Usuarios.css';

export default function Sistema() {
    const p = usePaleta();
    const [migraciones, setMigraciones] = useState(null);
    const [errores, setErrores] = useState(null);

    useEffect(() => {
        api.get('/plataforma/migraciones').then(r => setMigraciones(r.data.migraciones)).catch(() => toast.error('No se pudieron cargar las migraciones.'));
        api.get('/plataforma/errores').then(r => setErrores(r.data.errores)).catch(() => toast.error('No se pudieron cargar los errores.'));
    }, []);

    const caja = { background: p.card, border: `1px solid ${p.bdr}`, borderRadius: 14, boxShadow: p.cardSh, overflowX: 'auto', marginBottom: 22 };
    const th = { padding: '11px 14px', textAlign: 'left', ...bebas('.62rem', '.2em'), color: p.SKY_DEEP, whiteSpace: 'nowrap' };
    const td = { padding: '10px 14px', ...outfit('.8rem'), color: p.txtSf, verticalAlign: 'top' };
    const titulo = (t) => <h2 style={{ ...bebas('1.3rem', '.05em'), color: p.txt, margin: '6px 0 10px' }}>{t}</h2>;

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1400 }}>
            <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span>PLATAFORMA · SUPERADMINISTRADOR</span></div>
            <h1 style={{ ...bebas('2.6rem', '.04em'), color: p.txt, lineHeight: 1, marginBottom: 18 }}>Migraciones y errores</h1>

            {titulo('Migraciones de datos')}
            <div style={caja}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                    <thead><tr style={{ background: p.SKY_PALE }}>{['Fecha', 'Versión', 'Descripción', 'Resultado', 'Verificaciones'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                        {(migraciones || []).map(m => (
                            <tr key={m.id} style={{ borderTop: `1px solid ${p.bdr}` }}>
                                <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(m.aplicada_at).toLocaleString('es-EC')}</td>
                                <td style={td}>{m.version}</td>
                                <td style={td}>{m.descripcion}</td>
                                <td style={td}><Pildora color={m.resultado === 'exito' ? '#10b981' : '#ef4444'}>{m.resultado.toUpperCase()}</Pildora></td>
                                <td style={{ ...td, maxWidth: 420 }}>
                                    {m.detalle?.filas_ss_swap ? `${Object.keys(m.detalle.filas_ss_swap).length} tablas asociadas a SS SWAP (${Object.values(m.detalle.filas_ss_swap).reduce((s, n) => s + n, 0)} filas)` : ''}
                                </td>
                            </tr>
                        ))}
                        {migraciones && migraciones.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center' }}>Sin registros.</td></tr>}
                    </tbody>
                </table>
            </div>

            {titulo('Errores técnicos recientes (respuestas 500)')}
            <div style={caja}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
                    <thead><tr style={{ background: p.SKY_PALE }}>{['Fecha', 'Empresa', 'Petición', 'Estado', 'Mensaje'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                    <tbody>
                        {(errores || []).map(e => (
                            <tr key={e.id} style={{ borderTop: `1px solid ${p.bdr}` }}>
                                <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(e.created_at).toLocaleString('es-EC')}</td>
                                <td style={td}>{e.empresa_nombre || '—'}</td>
                                <td style={{ ...td, wordBreak: 'break-all' }}>{e.metodo} {e.ruta}</td>
                                <td style={td}>{e.estado_http}</td>
                                <td style={td}>{e.mensaje}</td>
                            </tr>
                        ))}
                        {errores && errores.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#10b981' }}>Sin errores registrados.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
