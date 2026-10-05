/** SS SWAP - Pictogramas vehiculares: un componente por carroceria. */
import PickupDiagram from './PickupDiagram';
import HatchbackDiagram from './HatchbackDiagram';
import SedanDiagram from './SedanDiagram';
import SuvDiagram from './SuvDiagram';

export { default as VehicleDiagram, SiluetaVehiculo } from './VehicleDiagram';
export { PickupDiagram, HatchbackDiagram, SedanDiagram, SuvDiagram };
export { CARROCERIAS, TIPOS_CARROCERIA, etiquetaZona, zonasValidas, normalizarPuertas } from './vehiculoDiagramas';

/** Componente de diagrama por tipo de carroceria. */
export const DIAGRAMAS = { pickup: PickupDiagram, hatchback: HatchbackDiagram, sedan: SedanDiagram, suv: SuvDiagram };
