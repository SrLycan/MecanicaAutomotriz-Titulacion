/**
 * SS SWAP - Indicador de carga mientras llega el codigo de una pagina
 * cargada bajo demanda (React.lazy). Ligero a proposito: solo un spinner.
 */
import React from 'react';

export default function CargandoPagina() {
    return (
        <div style={{ minHeight: '40vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(59,123,171,.25)', borderTopColor: '#3b7bab', animation: 'spin .8s linear infinite' }} />
        </div>
    );
}
