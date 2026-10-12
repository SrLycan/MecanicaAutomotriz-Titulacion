/**
 * SS SWAP - Utilidades compartidas de las pantallas de facturación electrónica
 *
 * Estados con nombres comprensibles: un comprobante solo se muestra como
 * "AUTORIZADA" cuando el SRI lo autorizó; los demás estados dicen claramente
 * qué falta o qué pasó.
 */
import api from '../../services/api';
import toast from 'react-hot-toast';

export const ESTADOS = {
    borrador:             { etiqueta: 'Borrador', color: '#64748b', ayuda: 'Aún no tiene número ni se envió al SRI. Se puede editar o descartar.' },
    firmado:              { etiqueta: 'Firmada · por enviar', color: '#0ea5e9', ayuda: 'Tiene número y firma electrónica; el sistema la está enviando al SRI.' },
    recibida:             { etiqueta: 'Recibida por el SRI', color: '#0ea5e9', ayuda: 'El SRI la recibió y la está validando. La autorización puede tardar.' },
    en_procesamiento:     { etiqueta: 'En procesamiento (SRI)', color: '#f59e0b', ayuda: 'El SRI aún no responde la autorización (puede tardar hasta 24 h). El sistema consulta solo cada pocos minutos.' },
    pendiente_reintento:  { etiqueta: 'Sin respuesta · reintentando', color: '#f59e0b', ayuda: 'No hubo respuesta del SRI. Antes de reenviar se consulta si ya la tiene: nunca se emite otro número.' },
    devuelta:             { etiqueta: 'Devuelta — corregir', color: '#ef4444', ayuda: 'El SRI la devolvió por un error de datos o estructura. Corríjala y vuelva a emitirla: conserva su número.' },
    no_autorizado:        { etiqueta: 'No autorizada — corregir', color: '#ef4444', ayuda: 'El SRI no la autorizó. Corrija el motivo indicado y vuelva a emitirla con el mismo número.' },
    autorizado:           { etiqueta: 'AUTORIZADA', color: '#10b981', ayuda: 'Autorizada por el SRI: comprobante válido (si es del ambiente de producción).' },
    anulacion_solicitada: { etiqueta: 'Anulación en trámite', color: '#8b5cf6', ayuda: 'Se registró que la anulación se solicitó en SRI en Línea. Se marcará anulada cuando el SRI lo confirme.' },
    anulado:              { etiqueta: 'Anulada', color: '#475569', ayuda: 'Anulada en el SRI. Se conserva como historial.' },
    descartado:           { etiqueta: 'Descartado', color: '#94a3b8', ayuda: 'Borrador descartado (nunca se emitió).' },
};

export const TIPO_DOC = { '01': 'Factura', '04': 'Nota de crédito' };
export const EDITABLES = ['borrador', 'devuelta', 'no_autorizado'];
export const EN_CURSO = ['firmado', 'recibida', 'en_procesamiento', 'pendiente_reintento', 'anulacion_solicitada'];

export const dinero = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fechaCorta = (v) => {
    const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};
export const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/** Descarga un archivo protegido (con el token) y lo guarda con su nombre. */
export async function descargar(ruta, nombre) {
    try {
        const { data, headers } = await api.get(ruta, { responseType: 'blob' });
        const disp = headers['content-disposition'] || '';
        const sugerido = (disp.match(/filename="([^"]+)"/) || [])[1];
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = sugerido || nombre;
        document.body.appendChild(a); a.click(); a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        let msg = 'No se pudo descargar el archivo.';
        try { msg = JSON.parse(await err.response.data.text()).error || msg; } catch { /* respuesta no JSON */ }
        toast.error(msg);
    }
}

/** Abre el RIDE en una pestaña nueva (PDF con el token, sin exponerlo en la URL). */
export async function verPdf(ruta) {
    const ventana = window.open('', '_blank');
    try {
        const { data } = await api.get(ruta, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
        if (ventana) ventana.location.href = url; else window.location.href = url;
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch {
        if (ventana) ventana.close();
        toast.error('No se pudo generar el RIDE.');
    }
}

/** Mensajes del SRI (último) como lista legible. */
export function mensajesSri(ultimo) {
    if (!ultimo) return [];
    const lista = Array.isArray(ultimo) ? ultimo : [ultimo];
    return lista.map(m => ({
        tipo: m.tipo || (m.incierto ? 'SIN RESPUESTA' : 'INFO'),
        texto: [m.identificador ? `[${m.identificador}]` : null, m.mensaje || m.error, m.informacionAdicional].filter(Boolean).join(' '),
    })).filter(m => m.texto);
}
