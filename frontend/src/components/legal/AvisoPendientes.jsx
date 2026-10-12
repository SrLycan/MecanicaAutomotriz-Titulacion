/**
 * SS SWAP - Aviso de documentos o contrato pendientes de aceptación (panel del personal)
 *
 * Solo para quien representa a la empresa (permiso empresa:editar). Es un
 * AVISO, no un bloqueo: el resto del sistema sigue disponible.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function AvisoPendientes() {
    const { puede, empresa, soporte } = useAuth();
    const [pend, setPend] = useState(null);
    const representa = Boolean(empresa) && !soporte && puede('empresa', 'editar');

    useEffect(() => {
        if (!representa) { setPend(null); return; }
        api.get('/legal/pendientes').then(({ data }) => setPend(data)).catch(() => setPend(null));
    }, [representa]);

    if (!pend || (!pend.documentos.length && !pend.contratos.length)) return null;
    const texto = pend.contratos.length
        ? 'Hay un contrato del servicio pendiente de aceptación.'
        : `Hay ${pend.documentos.length} documento(s) de la plataforma con una versión nueva por aceptar.`;
    return (
        <div role="status" style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap',
            padding: '10px 14px', marginBottom: 16, borderRadius: 11, border: '1px solid rgba(139,92,246,.45)', background: 'rgba(139,92,246,.10)',
            fontFamily: "'Outfit'", fontSize: '.84rem' }}>
            <span><strong style={{ color: '#7c3aed' }}>CONTRATACIÓN · </strong>{texto}</span>
            <Link to="/dashboard/contratacion" style={{ color: '#7c3aed', fontWeight: 600 }}>Revisar y aceptar →</Link>
        </div>
    );
}
