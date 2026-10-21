/**
 * SS SWAP - Finanzas del taller (panel admin)
 * Cuanto dinero hay, de donde entra y en que se va: resumen, movimientos
 * de dinero, nomina de empleados y cuentas (caja / bancos).
 * Lee los cobros, pagos a proveedores, gastos y caja que ya registra el
 * sistema; no hay que registrar nada dos veces.
 */
import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import useParamUrl from '../hooks/useParamUrl';
import api from '../services/api';
import { useTemaPanel } from '../components/finanzas/tema';
import { ModalMovimiento, ModalTransferencia, ModalPagoEmpleado } from '../components/finanzas/Modales';
import ResumenTab from '../components/finanzas/ResumenTab';
import FlujoTab from '../components/finanzas/FlujoTab';
import NominaTab from '../components/finanzas/NominaTab';
import CuentasTab from '../components/finanzas/CuentasTab';
import './Proveedores.css';

import { NombreEmpresa } from '../components/common/MarcaEmpresa';
const TABS = [
    { id: 'resumen', label: 'RESUMEN' },
    { id: 'movimientos', label: 'MOVIMIENTOS DE DINERO' },
    { id: 'nomina', label: 'NÓMINA' },
    { id: 'cuentas', label: 'CUENTAS' },
];

export default function Finanzas() {
    const theme = useTemaPanel();
    const { txt, mut, bdr, SKY_DEEP } = theme;
    const [tab, setTab] = useParamUrl('tab', 'resumen', TABS.map(t => t.id));
    const [cuentas, setCuentas] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [empleados, setEmpleados] = useState([]);
    const [version, setVersion] = useState(0);     // sube cada vez que algo cambia -> las pestañas recargan
    const [accion, setAccion] = useState(null);     // modal abierto desde el resumen
    const [cuentaFiltro, setCuentaFiltro] = useState(null);

    const cargarBase = useCallback(async () => {
        try {
            const [c, cat] = await Promise.all([api.get('/finanzas/cuentas'), api.get('/finanzas/categorias')]);
            setCuentas(c.data.cuentas || []);
            setCategorias(cat.data.categorias || []);
        } catch (err) { toast.error(err.response?.data?.error || 'Error al cargar las cuentas.'); }
    }, []);

    useEffect(() => { cargarBase(); }, [cargarBase, version]);

    const huboCambio = () => setVersion(v => v + 1);
    const irA = (destino, cuentaId = null) => { setCuentaFiltro(cuentaId); setTab(destino); };

    const abrirAccion = async (tipo) => {
        if (tipo === 'pago_empleado') {
            try { const { data } = await api.get('/finanzas/empleados'); setEmpleados(data.empleados || []); }
            catch { /* el modal muestra la lista vacia */ }
        }
        setAccion(tipo);
    };

    return (
        <div style={{ animation: 'fadeIn .35s ease', maxWidth: 1500, '--prov-bdr': bdr, '--prov-mut': mut, '--prov-sky': SKY_DEEP }}>
            <div style={{ marginBottom: 20 }}>
                <div className="ssswap-chip" style={{ marginBottom: 8 }}>
                    <span className="dot" />
                    <span><NombreEmpresa /> · ADMIN · FINANZAS</span>
                </div>
                <h1 style={{ fontFamily: "'Bebas Neue'", fontSize: '2.6rem', letterSpacing: '.04em', color: txt, lineHeight: 1 }}>Finanzas del taller</h1>
                <p style={{ fontFamily: "'Outfit'", fontWeight: 400, fontSize: '.85rem', color: mut, marginTop: 6 }}>
                    Cuánto dinero hay, de dónde entra y en qué se va: cobros, compras, gastos, sueldos y caja en un solo lugar.
                </p>
            </div>

            <div className="prov-tabs">
                {TABS.map(t => (
                    <button key={t.id} className={`prov-tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => irA(t.id)}>{t.label}</button>
                ))}
            </div>

            {tab === 'resumen' && <ResumenTab theme={theme} version={version} onAccion={abrirAccion} irA={irA} />}
            {tab === 'movimientos' && (
                <FlujoTab key={cuentaFiltro || 'todas'} theme={theme} categorias={categorias} cuentas={cuentas}
                    version={version} onCambio={huboCambio} cuentaInicial={cuentaFiltro} onAccion={abrirAccion} />
            )}
            {tab === 'nomina' && <NominaTab theme={theme} cuentas={cuentas} version={version} onCambio={huboCambio} />}
            {tab === 'cuentas' && <CuentasTab theme={theme} cuentas={cuentas} onCambio={huboCambio} onTransferir={() => abrirAccion('transferencia')} irA={irA} />}

            {(accion === 'ingreso' || accion === 'egreso') && (
                <ModalMovimiento theme={theme} tipo={accion} categorias={categorias} cuentas={cuentas} onClose={() => setAccion(null)} onGuardado={huboCambio} />
            )}
            {accion === 'transferencia' && <ModalTransferencia theme={theme} cuentas={cuentas} onClose={() => setAccion(null)} onGuardado={huboCambio} />}
            {accion === 'pago_empleado' && (
                <ModalPagoEmpleado theme={theme} empleados={empleados} cuentas={cuentas} onClose={() => setAccion(null)} onGuardado={huboCambio} />
            )}
        </div>
    );
}
