/**
 * SS SWAP - PDF y Excel de caja (con el token, sin exponerlo en la URL).
 */
import toast from 'react-hot-toast';
import api from '../../services/api';

async function mensajeError(err, porDefecto) {
    try { return JSON.parse(await err.response.data.text()).error || porDefecto; } catch { return porDefecto; }
}

/** Descarga un archivo protegido y lo guarda con el nombre que manda el servidor. */
export async function descargarArchivo(ruta, nombre) {
    try {
        const { data, headers } = await api.get(ruta, { responseType: 'blob' });
        const sugerido = ((headers['content-disposition'] || '').match(/filename="([^"]+)"/) || [])[1];
        const url = window.URL.createObjectURL(data);
        const a = document.createElement('a');
        a.href = url;
        a.download = sugerido || nombre;
        document.body.appendChild(a); a.click(); a.remove();
        window.URL.revokeObjectURL(url);
    } catch (err) {
        toast.error(await mensajeError(err, 'No se pudo descargar el archivo.'));
    }
}

/** Abre el PDF de cierre de una caja en otra pestaña (para verlo o imprimirlo). */
export async function abrirPdfCaja(id) {
    const ventana = window.open('', '_blank');
    try {
        const { data } = await api.get(`/caja/sesiones/${id}/pdf?ver=1`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
        if (ventana) ventana.location.href = url; else window.location.href = url;
        setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (err) {
        if (ventana) ventana.close();
        toast.error(await mensajeError(err, 'No se pudo generar el PDF de la caja.'));
    }
}

/** Imprime el PDF de cierre sin salir del panel (iframe oculto). */
export async function imprimirPdfCaja(id) {
    try {
        const { data } = await api.get(`/caja/sesiones/${id}/pdf?ver=1`, { responseType: 'blob' });
        const url = window.URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
        const marco = document.createElement('iframe');
        marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
        marco.src = url;
        marco.onload = () => {
            try { marco.contentWindow.focus(); marco.contentWindow.print(); }
            catch { window.open(url, '_blank'); }
            setTimeout(() => { marco.remove(); window.URL.revokeObjectURL(url); }, 60000);
        };
        document.body.appendChild(marco);
    } catch (err) {
        toast.error(await mensajeError(err, 'No se pudo preparar la impresión.'));
    }
}
