/**
 * SS SWAP - Paginador reutilizable (Fase 7)
 * Mismo patron visual que el Paginador de Bitacora.jsx, extraido aqui para
 * que Gastos/Compras/Historial de Proveedores no dupliquen el componente.
 */
import React from 'react';

export default function Paginador({ pagina, setPagina, total, porPagina, theme }) {
    const { txt, mut, bdr } = theme;
    const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
    if (totalPaginas <= 1) return null;

    const btnStyle = (disabled) => ({
        padding: '6px 12px', borderRadius: 8, border: `1px solid ${bdr}`,
        background: 'none', color: disabled ? mut : txt, cursor: disabled ? 'default' : 'pointer',
        fontFamily: "'Outfit'", fontWeight: 600, fontSize: '.78rem', opacity: disabled ? .4 : 1,
    });

    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
            <button style={btnStyle(pagina <= 1)} disabled={pagina <= 1} onClick={() => setPagina(p => p - 1)}>← Anterior</button>
            <span style={{ fontFamily: "'Outfit'", fontSize: '.78rem', color: mut }}>Página {pagina} de {totalPaginas} · {total} registros</span>
            <button style={btnStyle(pagina >= totalPaginas)} disabled={pagina >= totalPaginas} onClick={() => setPagina(p => p + 1)}>Siguiente →</button>
        </div>
    );
}
