/**
 * SS SWAP - Registro de las guías del centro de ayuda (Sprint 27)
 * Una guía por sección (archivo JSON en esta carpeta). La prueba
 * src/ayuda/__tests__/guias.test.js verifica que todos los JSON estén
 * registrados aquí, que sus rutas existan, que sus imágenes existan y que
 * los controles que señalan sigan existiendo en el código.
 */
import citas from './citas.json';
import clientes from './clientes.json';
import inventario from './inventario.json';
import movimientosHistorial from './movimientos-historial.json';
import movimientosRegistrar from './movimientos-registrar.json';
import ordenes from './ordenes.json';
import pagare from './pagare.json';
import panel from './panel.json';
import pedidos from './pedidos.json';
import proformaDetalle from './proforma-detalle.json';
import proformaFormulario from './proforma-formulario.json';
import proformas from './proformas.json';
import vehiculos from './vehiculos.json';

export const GUIAS = [
    citas,
    clientes,
    inventario,
    movimientosHistorial,
    movimientosRegistrar,
    ordenes,
    pagare,
    panel,
    pedidos,
    proformaDetalle,
    proformaFormulario,
    proformas,
    vehiculos,
];
