/**
 * SS SWAP - Reglas de alerta de stock bajo.
 * El inventario de Colisiones / Pintura no genera alertas de stock bajo
 * (se maneja por consumo); solo Mecanica avisa cuando un producto llega a
 * su stock minimo. Debe coincidir con AREAS_SIN_ALERTA del backend.
 */
export const AREAS_SIN_ALERTA = ['colisiones'];

export const areaConAlerta = (area) => !AREAS_SIN_ALERTA.includes(area);

export const stockBajo = (r) => areaConAlerta(r.area) && Number(r.stock_actual) <= Number(r.stock_minimo);
