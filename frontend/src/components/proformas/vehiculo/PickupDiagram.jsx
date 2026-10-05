/**
 * SS SWAP - Pictograma Pickup (envoltorio de VehicleDiagram).
 * La geometria se define por parametros en vehiculoDiagramas.js -> CARROCERIAS.pickup.
 */
import React from 'react';
import VehicleDiagram from './VehicleDiagram';

export default function PickupDiagram(props) {
    return <VehicleDiagram {...props} tipo="pickup" />;
}
