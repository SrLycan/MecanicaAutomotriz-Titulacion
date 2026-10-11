/**
 * SS SWAP - Plataforma: auditoría global (todas las empresas y la plataforma).
 */
import React from 'react';
import Auditoria from '../Auditoria';

export default function AuditoriaGlobal() {
    return <Auditoria endpoint="/plataforma/auditoria" global />;
}
