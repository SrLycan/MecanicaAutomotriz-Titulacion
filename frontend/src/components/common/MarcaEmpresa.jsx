/**
 * SS SWAP - Identidad de la empresa activa en el panel
 *
 * Todo sale de la sesión (AuthContext.empresa, que envía el servidor y se
 * refresca cada minuto): al cambiar el logo o el nombre en "Configuración
 * de la empresa" se actualiza en todas las pantallas sin tocar cada una.
 *  - LogoEmpresa: el logo sin deformarse (object-fit: contain) o, si la
 *    empresa no tiene, un espacio con su inicial y, para quien puede editar
 *    la empresa, el acceso para subirlo.
 *  - ChipSeccion / useNombreEmpresa: la etiqueta "EMPRESA · SECCIÓN".
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { resolveImagenSrc } from '../../utils/imagen';

/** Nombre a mostrar de la empresa de la sesión (comercial si existe). */
export function useNombreEmpresa() {
    const { empresa, plataforma } = useAuth();
    if (empresa) return empresa.nombre_comercial || empresa.nombre;
    return plataforma ? 'SS SWAP · Plataforma' : 'SS SWAP';
}

/** Nombre de la empresa de la sesión en mayúsculas (para las etiquetas "EMPRESA · SECCIÓN"). */
export function NombreEmpresa() {
    const { empresa } = useAuth();
    return <>{(empresa?.nombre || 'SS SWAP').toUpperCase()}</>;
}

/** Chip de encabezado de las páginas: "<EMPRESA> · <partes>". */
export function ChipSeccion({ partes = [], style }) {
    const { empresa } = useAuth();
    const nombre = (empresa?.nombre || 'SS SWAP').toUpperCase();
    return (
        <div className="ssswap-chip" style={{ marginBottom: 8, ...style }}>
            <span className="dot" /><span>{[nombre, ...partes].join(' · ')}</span>
        </div>
    );
}

/**
 * Logo de una empresa (por defecto la de la sesión).
 * props: empresa? ({ nombre, logo_url }), alto (px), fondo, conSubida (muestra
 * el enlace "Subir logo" si no hay logo y el usuario puede editar la empresa).
 */
export function LogoEmpresa({ empresa: propia, alto = 56, ancho = '100%', fondo = 'transparent', conSubida = false, radio = 12, colorTexto = '#0284c7' }) {
    const auth = useAuth();
    const empresa = propia || auth.empresa;
    const [error, setError] = useState(false);
    const src = empresa?.logo_url ? resolveImagenSrc(empresa.logo_url) : '';
    useEffect(() => { setError(false); }, [src]);

    const caja = { width: ancho, height: alto, borderRadius: radio, background: fondo, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 };
    if (src && !error) {
        return (
            <div style={caja}>
                <img src={src} alt={`Logo de ${empresa?.nombre || 'la empresa'}`} onError={() => setError(true)}
                    style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }} />
            </div>
        );
    }
    const inicial = String(empresa?.nombre || 'S').trim().charAt(0).toUpperCase();
    const puedeSubir = conSubida && !propia && auth.puede?.('empresa', 'editar');
    return (
        <div style={{ ...caja, flexDirection: 'column', gap: 6, border: `1.5px dashed ${colorTexto}55` }} aria-label="Empresa sin logo">
            <span style={{ fontFamily: "'Bebas Neue'", fontSize: Math.max(18, Math.min(alto * 0.42, 64)), color: colorTexto, lineHeight: 1 }}>{inicial}</span>
            {puedeSubir && alto >= 90 && (
                <Link to="/dashboard/empresa" style={{ fontFamily: "'Bebas Neue'", fontSize: '.72rem', letterSpacing: '.14em', color: colorTexto, textDecoration: 'none', padding: '5px 12px', borderRadius: 999, border: `1px solid ${colorTexto}55` }}>
                    + SUBIR LOGO
                </Link>
            )}
        </div>
    );
}
