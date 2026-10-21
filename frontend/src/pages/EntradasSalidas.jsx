/**
 * SS SWAP - "Entradas y salidas" de inventario (Sprint 27)
 *
 * Une en un solo lugar lo que antes eran dos páginas y dos entradas de menú:
 *  - HISTORIAL: los registros de entradas y salidas (antes /dashboard/movimientos).
 *  - REGISTRAR: el registro paso a paso de una entrada o salida manual
 *    (antes /dashboard/registrar, que ahora redirige aquí).
 * Cada pestaña conserva su componente, su endpoint y su permiso
 * (registros_inventario:ver / registros_inventario:crear).
 */
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useTemaPanel } from '../components/finanzas/tema';
import useParamUrl from '../hooks/useParamUrl';
import { NombreEmpresa } from '../components/common/MarcaEmpresa';
import Movimientos from './Movimientos';
import RegistrarMovimiento from './RegistrarMovimiento';
import './Proveedores.css';

export default function EntradasSalidas() {
    const { puede } = useAuth();
    const { txt, mut, bdr, SKY_DEEP } = useTemaPanel();
    const tabs = [
        ...(puede('registros_inventario', 'ver') ? [{ id: 'historial', label: 'HISTORIAL DE ENTRADAS Y SALIDAS', ayuda: 'movimientos.tab-historial' }] : []),
        ...(puede('registros_inventario', 'crear') ? [{ id: 'registrar', label: 'REGISTRAR MOVIMIENTO', ayuda: 'movimientos.tab-registrar' }] : []),
    ];
    // Se conserva ?repuesto_id= (historial de un producto) al cambiar de pestaña solo cuando aplica.
    const [tabUrl, setTab] = useParamUrl('tab', tabs[0]?.id || 'historial', tabs.map(t => t.id), ['repuesto_id']);
    const tab = tabs.some(t => t.id === tabUrl) ? tabUrl : tabs[0]?.id;

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500 }}>
            <div style={{ marginBottom: 14 }}>
                <div className="ssswap-chip" style={{ marginBottom: 8 }}><span className="dot" /><span><NombreEmpresa /> · INVENTARIO · TRAZABILIDAD</span></div>
                <h1 data-ayuda="movimientos.titulo" style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Entradas y salidas</h1>
                <p style={{ fontFamily: "'Outfit'", fontSize: '.88rem', color: mut, marginTop: 6 }}>
                    Registre una entrada o salida manual y consulte qué pasó con cada producto: compras, ajustes, devoluciones, ventas y salidas por proforma.
                </p>
            </div>
            {tabs.length > 1 && (
                <div className="prov-tabs" role="tablist" style={{ '--prov-bdr': bdr, '--prov-mut': mut, '--prov-sky': SKY_DEEP }}>
                    {tabs.map(t => (
                        <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} data-ayuda={t.ayuda}
                            className={`prov-tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
                    ))}
                </div>
            )}
            {tab === 'historial' && <Movimientos embebido />}
            {tab === 'registrar' && <RegistrarMovimiento embebido />}
        </div>
    );
}
