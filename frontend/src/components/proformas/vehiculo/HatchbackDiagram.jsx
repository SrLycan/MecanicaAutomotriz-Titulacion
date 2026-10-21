/**
 * SS SWAP - Pictograma Hatchback (envoltorio de VehicleDiagram).
 * La geometria se define por parametros en vehiculoDiagramas.js -> CARROCERIAS.hatchback.
 */
import React from 'react';
import VehicleDiagram from './VehicleDiagram';

export default function HatchbackDiagram(props) {
    return <VehicleDiagram {...props} tipo="hatchback" />;
}
