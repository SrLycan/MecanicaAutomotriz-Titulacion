/**
 * SS SWAP - Estado sincronizado con un parametro de la URL (?tab=, ?rol=, ?area=)
 *
 * Permite que el menu lateral abra una pagina directamente en una pestaña o
 * filtro concreto (ej. /dashboard/proveedores?tab=compras) y que, al cambiar
 * de pestaña dentro de la pagina, la URL se actualice (se puede recargar o
 * compartir el enlace y se abre en el mismo lugar).
 *
 * @param {string} nombre      nombre del parametro
 * @param {string} porDefecto  valor cuando no viene en la URL (no se escribe en la URL)
 * @param {string[]} [validos] valores aceptados; cualquier otro se trata como porDefecto
 * @param {string[]} [limpiar] otros parametros a quitar al cambiar el valor
 */
import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function useParamUrl(nombre, porDefecto, validos, limpiar = []) {
    const [searchParams, setSearchParams] = useSearchParams();
    const crudo = searchParams.get(nombre);
    const valor = crudo && (!validos || validos.includes(crudo)) ? crudo : porDefecto;

    const setValor = useCallback((nuevo) => {
        setSearchParams(prev => {
            const p = new URLSearchParams(prev);
            if (!nuevo || nuevo === porDefecto) p.delete(nombre); else p.set(nombre, nuevo);
            limpiar.forEach(k => p.delete(k));
            return p;
        });
        // eslint-disable-next-line
    }, [nombre, porDefecto, setSearchParams, limpiar.join(',')]);

    return [valor, setValor];
}
