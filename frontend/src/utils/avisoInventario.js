/**
 * SS SWAP - Aviso de lo que paso con el inventario al cambiar el estado de
 * una proforma (respuesta `inventario` del backend):
 *   descontado -> salio material del inventario (queda en Registros)
 *   devuelto   -> el material volvio al inventario
 *   pendiente  -> no se pudo descontar (falta stock); se explica que falta
 */
import toast from 'react-hot-toast';

export function avisarInventario(inventario) {
    if (!inventario) return;
    if (inventario.accion === 'descontado') {
        toast.success(`Inventario: se descontaron ${inventario.productos} producto(s). Ya aparecen en Inventario › Registros.`, { duration: 6000 });
    } else if (inventario.accion === 'devuelto') {
        toast.success(`Inventario: ${inventario.productos} producto(s) volvieron al stock.`, { duration: 6000 });
    } else if (inventario.accion === 'pendiente') {
        const detalle = (inventario.detalle || []).join('\n');
        toast.error(`El inventario NO se descontó: ${inventario.motivo || 'stock insuficiente'}${detalle ? `\n${detalle}` : ''}\nRepón el stock y usa "Confirmar uso de materiales" en la proforma.`, { duration: 9000 });
    }
}
