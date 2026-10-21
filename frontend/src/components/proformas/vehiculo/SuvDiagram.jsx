/**
 * SS SWAP - Pictograma Suv (envoltorio de VehicleDiagram).
 * La geometria se define por parametros en vehiculoDiagramas.js -> CARROCERIAS.suv.
 */
import React from 'react';
import VehicleDiagram from './VehicleDiagram';

export default function SuvDiagram(props) {
    return <VehicleDiagram {...props} tipo="suv" />;
}
