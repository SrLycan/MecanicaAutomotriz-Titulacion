/**
 * SS SWAP - Pictograma Sedan (envoltorio de VehicleDiagram).
 * La geometria se define por parametros en vehiculoDiagramas.js -> CARROCERIAS.sedan.
 */
import React from 'react';
import VehicleDiagram from './VehicleDiagram';

export default function SedanDiagram(props) {
    return <VehicleDiagram {...props} tipo="sedan" />;
}
