/**
 * SS SWAP - "Registrado por" (Sprint 28)
 * Línea pequeña con el usuario que creó un registro y, opcionalmente, la
 * fecha. Si el registro es anterior a que se guardara el creador, lo dice.
 */
import React from 'react';

const fecha = (v) => {
    if (!v) return '';
    const d = new Date(String(v).length === 10 ? `${v}T00:00:00` : v);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('es-EC');
};

export default function RegistradoPor({ nombre, fechaRegistro, sinNombre = 'Registro anterior (sin usuario)', prefijo = 'Registrado por', color, style }) {
    const f = fecha(fechaRegistro);
    return (
        <span style={{ display: 'block', fontFamily: "'Outfit'", fontSize: '.74rem', color: color || 'inherit', opacity: color ? 1 : 0.75, marginTop: 3, ...style }}>
            {nombre ? <>{prefijo} <b style={{ fontWeight: 600 }}>{nombre}</b></> : sinNombre}
            {f && <> · {f}</>}
        </span>
    );
}
