/**
 * SS SWAP - Generacion de Excel de Proformas (ExcelJS)
 *
 * Usa formulas reales (SUM, multiplicacion cantidad*precio) en vez de
 * valores calculados en JS, para que el archivo se recalcule solo si el
 * usuario edita una celda en Excel/LibreOffice — tal como pidio el prompt.
 */
const ExcelJS = require('exceljs');
const { etiquetaZona, CARROCERIAS } = require('../shared/vehiculoDiagramas');
const { porcentajeAnticipo, resumenDeuda } = require('./reglasPago');

const NOMBRE_COMERCIAL = 'SS Swap - SSarango Sosa Intercambio Inteligente';

const FONT = 'Calibri';
const AZUL = 'FF0284C7';
const AZUL_CLARO = 'FFE0F2FE';
const GRIS = 'FFF1F5F9';
const BORDE = { style: 'thin', color: { argb: 'FFCBD5E1' } };
const bordeCelda = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };

function fecha(v) { return v ? new Date(v).toLocaleDateString('es-EC', { timeZone: 'UTC' }) : ''; }

function estiloEncabezadoSeccion(cell, texto) {
    cell.value = texto;
    cell.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    cell.alignment = { vertical: 'middle' };
}

function estiloEncabezadoTabla(cell, texto) {
    cell.value = texto;
    cell.font = { name: FONT, bold: true, size: 9, color: { argb: AZUL } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } };
    cell.border = bordeCelda;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
}

/**
 * Tabla de items #/Codigo/Descripcion/Cantidad/Precio/Subtotal con fila de total (formula SUM).
 * Codigo = referencia INTERNA del inventario; nunca el codigo del proveedor.
 */
function escribirTablaCantPrecio(sheet, filaInicio, colInicio, items, tituloTotal) {
    let fila = filaInicio;
    const c = colInicio;
    ['#', 'Código', 'Descripción', 'Cant.', 'P. Unit.', 'Subtotal'].forEach((h, i) => estiloEncabezadoTabla(sheet.getCell(fila, c + i), h));
    fila++;
    const filaInicioItems = fila;
    items.forEach((it, i) => {
        sheet.getCell(fila, c).value = i + 1;
        sheet.getCell(fila, c + 1).value = it.referencia_tipo === 'repuesto' && it.repuesto_codigo ? it.repuesto_codigo : '—';
        sheet.getCell(fila, c + 2).value = it.descripcion;
        sheet.getCell(fila, c + 3).value = Number(it.cantidad);
        sheet.getCell(fila, c + 4).value = Number(it.precio_unitario);
        sheet.getCell(fila, c + 4).numFmt = '$#,##0.00';
        const colCant = sheet.getColumn(c + 3).letter, colPrecio = sheet.getColumn(c + 4).letter;
        sheet.getCell(fila, c + 5).value = { formula: `${colCant}${fila}*${colPrecio}${fila}` };
        sheet.getCell(fila, c + 5).numFmt = '$#,##0.00';
        for (let k = 0; k < 6; k++) sheet.getCell(fila, c + k).border = bordeCelda;
        fila++;
    });
    const filaFinItems = fila - 1;
    const colSub = sheet.getColumn(c + 5).letter;
    const totalCell = sheet.getCell(fila, c);
    sheet.mergeCells(fila, c, fila, c + 4);
    totalCell.value = tituloTotal;
    totalCell.font = { name: FONT, bold: true, size: 9 };
    totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
    totalCell.alignment = { horizontal: 'right' };
    const totalValor = sheet.getCell(fila, c + 5);
    totalValor.value = filaFinItems >= filaInicioItems ? { formula: `SUM(${colSub}${filaInicioItems}:${colSub}${filaFinItems})` } : 0;
    totalValor.numFmt = '$#,##0.00';
    totalValor.font = { name: FONT, bold: true, size: 9 };
    totalValor.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
    for (let k = 0; k < 6; k++) sheet.getCell(fila, c + k).border = bordeCelda;
    return { filaSiguiente: fila + 2, filaTotal: fila, colTotal: colSub };
}

/** Tabla simple Item/Descripcion/Valor (mano de obra, pintura) con fila de total. */
function escribirTablaSimple(sheet, filaInicio, colInicio, items, tituloTotal) {
    let fila = filaInicio;
    const c = colInicio;
    ['Item', 'Descripción', 'Valor'].forEach((h, i) => estiloEncabezadoTabla(sheet.getCell(fila, c + i), h));
    sheet.mergeCells(fila, c + 1, fila, c + 1);
    fila++;
    const filaInicioItems = fila;
    items.forEach((it, i) => {
        sheet.getCell(fila, c).value = i + 1;
        sheet.getCell(fila, c + 1).value = it.descripcion;
        sheet.getCell(fila, c + 2).value = Number(it.subtotal);
        sheet.getCell(fila, c + 2).numFmt = '$#,##0.00';
        for (let k = 0; k < 3; k++) sheet.getCell(fila, c + k).border = bordeCelda;
        fila++;
    });
    const filaFinItems = fila - 1;
    const colVal = sheet.getColumn(c + 2).letter;
    sheet.mergeCells(fila, c, fila, c + 1);
    const totalCell = sheet.getCell(fila, c);
    totalCell.value = tituloTotal;
    totalCell.font = { name: FONT, bold: true, size: 9 };
    totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
    totalCell.alignment = { horizontal: 'right' };
    const totalValor = sheet.getCell(fila, c + 2);
    totalValor.value = filaFinItems >= filaInicioItems ? { formula: `SUM(${colVal}${filaInicioItems}:${colVal}${filaFinItems})` } : 0;
    totalValor.numFmt = '$#,##0.00';
    totalValor.font = { name: FONT, bold: true, size: 9 };
    totalValor.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };
    for (let k = 0; k < 3; k++) sheet.getCell(fila, c + k).border = bordeCelda;
    return { filaSiguiente: fila + 2, filaTotal: fila, colTotal: colVal };
}

async function generarProformaExcel(proforma) {
    const wb = new ExcelJS.Workbook();
    wb.creator = NOMBRE_COMERCIAL;
    wb.created = new Date();
    const sheet = wb.addWorksheet('Proforma', { pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 } });
    sheet.properties.defaultRowHeight = 16;
    for (let i = 1; i <= 12; i++) sheet.getColumn(i).width = 14;

    // ── Encabezado ──
    sheet.mergeCells('A1:F1');
    estiloEncabezadoSeccion(sheet.getCell('A1'), NOMBRE_COMERCIAL);
    sheet.getCell('A1').font = { name: FONT, bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).height = 26;
    sheet.mergeCells('G1:L1');
    estiloEncabezadoSeccion(sheet.getCell('G1'), `PROFORMA  ${proforma.numero}`);
    sheet.getCell('G1').alignment = { horizontal: 'right', vertical: 'middle' };

    sheet.getCell('A2').value = `${proforma.tipo === 'pintura' ? 'Proforma — Colisiones / Pintura y Carrocería' : 'Proforma — Mecánica General'}${proforma.sucursal_nombre ? `  ·  Sucursal: ${proforma.sucursal_nombre}` : ''}`;
    sheet.getCell('A2').font = { name: FONT, italic: true, size: 10, color: { argb: 'FF64748B' } };
    sheet.mergeCells('A2:F2');
    sheet.getCell('G2').value = `Emisión: ${fecha(proforma.fecha_emision)}   Validez: ${fecha(proforma.fecha_validez)}`;
    sheet.getCell('G2').alignment = { horizontal: 'right' };
    sheet.mergeCells('G2:L2');

    // ── Cliente / Vehiculo ──
    let fila = 4;
    sheet.mergeCells(`A${fila}:F${fila}`);
    estiloEncabezadoTabla(sheet.getCell(`A${fila}`), 'DATOS DEL CLIENTE');
    sheet.mergeCells(`G${fila}:L${fila}`);
    estiloEncabezadoTabla(sheet.getCell(`G${fila}`), 'DATOS DEL VEHÍCULO');
    fila++;

    const filasCliente = [
        ['Razón Social / Nombre:', proforma.cliente_nombre], ['RUC / CI:', proforma.cliente_ruc],
        ['Dirección:', proforma.cliente_direccion], ['Teléfono:', proforma.cliente_telefono], ['Email:', proforma.cliente_email],
    ];
    const filasVehiculo = [
        ['Marca:', proforma.vehiculo_marca], ['Modelo:', proforma.vehiculo_modelo], ['Tipo:', proforma.vehiculo_tipo],
        ['Año:', proforma.vehiculo_anio], ['Color:', proforma.vehiculo_color], ['Placa:', proforma.vehiculo_placa], ['VIN / Chasis:', proforma.vehiculo_vin],
    ];
    const filasMax = Math.max(filasCliente.length, filasVehiculo.length);
    for (let i = 0; i < filasMax; i++) {
        const f = fila + i;
        if (filasCliente[i]) {
            sheet.getCell(f, 1).value = filasCliente[i][0];
            sheet.getCell(f, 1).font = { name: FONT, bold: true, size: 9 };
            sheet.mergeCells(f, 2, f, 6);
            sheet.getCell(f, 2).value = filasCliente[i][1] || '';
            sheet.getCell(f, 2).font = { name: FONT, size: 9 };
        }
        if (filasVehiculo[i]) {
            sheet.getCell(f, 7).value = filasVehiculo[i][0];
            sheet.getCell(f, 7).font = { name: FONT, bold: true, size: 9 };
            sheet.mergeCells(f, 8, f, 12);
            sheet.getCell(f, 8).value = filasVehiculo[i][1] || '';
            sheet.getCell(f, 8).font = { name: FONT, size: 9 };
        }
    }
    fila += filasMax + 1;

    // ── Sprint 14: daños del pictograma (solo Colisiones / Pintura) ──
    // Se escribe ANTES de las tablas; todas las formulas de abajo usan la
    // variable `fila`, asi que siguen apuntando a sus celdas correctas.
    if (proforma.tipo === 'pintura' && proforma.carroceria_tipo) {
        const zonas = proforma.zonas_danadas || [];
        sheet.mergeCells(`A${fila}:L${fila}`);
        estiloEncabezadoSeccion(sheet.getCell(`A${fila}`), 'DAÑOS REPORTADOS (PICTOGRAMA)');
        fila++;
        const carroceria = CARROCERIAS[proforma.carroceria_tipo];
        const puertas = proforma.carroceria_puertas ? ` · ${proforma.carroceria_puertas} puertas` : '';
        const filasDanos = [
            ['Tipo de vehículo:', `${carroceria ? carroceria.etiqueta : proforma.carroceria_tipo}${puertas}`],
            ['Zonas afectadas:', zonas.length ? `${zonas.length} zona(s)` : 'Ninguna marcada'],
        ];
        filasDanos.forEach(([k, v]) => {
            sheet.getCell(fila, 1).value = k;
            sheet.getCell(fila, 1).font = { name: FONT, bold: true, size: 9 };
            sheet.mergeCells(fila, 2, fila, 12);
            sheet.getCell(fila, 2).value = v;
            sheet.getCell(fila, 2).font = { name: FONT, size: 9 };
            fila++;
        });
        // Una zona por celda (2 columnas) para poder filtrar/contar en Excel.
        const mitad = Math.ceil(zonas.length / 2);
        for (let i = 0; i < mitad; i++) {
            sheet.mergeCells(fila, 2, fila, 6);
            sheet.getCell(fila, 2).value = `• ${etiquetaZona(zonas[i])}`;
            sheet.getCell(fila, 2).font = { name: FONT, size: 9, color: { argb: 'FFB91C1C' } };
            if (zonas[i + mitad]) {
                sheet.mergeCells(fila, 8, fila, 12);
                sheet.getCell(fila, 8).value = `• ${etiquetaZona(zonas[i + mitad])}`;
                sheet.getCell(fila, 8).font = { name: FONT, size: 9, color: { argb: 'FFB91C1C' } };
            }
            fila++;
        }
        if (proforma.danos_observaciones) {
            sheet.getCell(fila, 1).value = 'Observaciones:';
            sheet.getCell(fila, 1).font = { name: FONT, bold: true, size: 9 };
            sheet.mergeCells(fila, 2, fila, 12);
            sheet.getCell(fila, 2).value = proforma.danos_observaciones;
            sheet.getCell(fila, 2).font = { name: FONT, size: 9 };
            sheet.getCell(fila, 2).alignment = { wrapText: true, vertical: 'top' };
            sheet.getRow(fila).height = Math.min(90, 16 * Math.ceil(proforma.danos_observaciones.length / 140));
            fila++;
        }
        fila++;
    }

    // ── Tablas de items (segun tipo) ──
    const porCategoria = (cat) => (proforma.items || []).filter(i => i.categoria === cat);
    const totalesCeldas = [];

    if (proforma.tipo === 'mecanica') {
        const productos = porCategoria('producto');
        if (productos.length) {
            sheet.mergeCells(`A${fila}:F${fila}`);
            estiloEncabezadoSeccion(sheet.getCell(`A${fila}`), 'PRODUCTOS / REPUESTOS');
            fila++;
            const r = escribirTablaCantPrecio(sheet, fila, 1, productos, 'TOTAL PRODUCTOS');
            totalesCeldas.push(['Subtotal productos', `${r.colTotal}${r.filaTotal}`]);
            fila = r.filaSiguiente;
        }
        const servicios = porCategoria('servicio');
        if (servicios.length) {
            sheet.mergeCells(`A${fila}:F${fila}`);
            estiloEncabezadoSeccion(sheet.getCell(`A${fila}`), 'SERVICIOS / MANO DE OBRA');
            fila++;
            const r = escribirTablaCantPrecio(sheet, fila, 1, servicios, 'TOTAL SERVICIOS');
            totalesCeldas.push(['Subtotal servicios', `${r.colTotal}${r.filaTotal}`]);
            fila = r.filaSiguiente;
        }
    } else {
        // Mano de obra (izq) + Pintura (der), lado a lado — igual que la plantilla original
        sheet.mergeCells(`A${fila}:E${fila}`);
        estiloEncabezadoSeccion(sheet.getCell(`A${fila}`), 'MANO DE OBRA / ENDEREZADO');
        sheet.mergeCells(`G${fila}:L${fila}`);
        estiloEncabezadoSeccion(sheet.getCell(`G${fila}`), 'PINTURA');
        const filaTablas = fila + 1;
        const rMano = escribirTablaSimple(sheet, filaTablas, 1, porCategoria('mano_obra'), 'TOTAL MANO DE OBRA');
        const rPintura = escribirTablaSimple(sheet, filaTablas, 7, porCategoria('pintura'), 'TOTAL PINTURA');
        totalesCeldas.push(['Total mano de obra', `${rMano.colTotal}${rMano.filaTotal}`], ['Total pintura', `${rPintura.colTotal}${rPintura.filaTotal}`]);
        fila = Math.max(rMano.filaSiguiente, rPintura.filaSiguiente);

        // Repuestos (izq) + Insumos (der)
        sheet.mergeCells(`A${fila}:F${fila}`);
        estiloEncabezadoSeccion(sheet.getCell(`A${fila}`), 'REPUESTOS');
        sheet.mergeCells(`G${fila}:L${fila}`);
        estiloEncabezadoSeccion(sheet.getCell(`G${fila}`), 'INSUMOS');
        const filaTablas2 = fila + 1;
        const rRep = escribirTablaCantPrecio(sheet, filaTablas2, 1, porCategoria('repuesto'), 'TOTAL REPUESTOS');
        const rIns = escribirTablaCantPrecio(sheet, filaTablas2, 7, porCategoria('insumo'), 'TOTAL INSUMOS');
        totalesCeldas.push(['Total repuestos', `${rRep.colTotal}${rRep.filaTotal}`], ['Total insumos', `${rIns.colTotal}${rIns.filaTotal}`]);
        fila = Math.max(rRep.filaSiguiente, rIns.filaSiguiente);
    }

    // ── Resumen de totales (con formulas que suman las celdas de arriba) ──
    fila += 1;
    sheet.mergeCells(`H${fila}:I${fila}`);
    estiloEncabezadoSeccion(sheet.getCell(`H${fila}`), 'RESUMEN');
    fila++;
    const filaSubtotal = fila;
    totalesCeldas.forEach(([label, ref]) => {
        sheet.getCell(fila, 8).value = label;
        sheet.getCell(fila, 8).font = { name: FONT, size: 9 };
        sheet.getCell(fila, 9).value = { formula: ref };
        sheet.getCell(fila, 9).numFmt = '$#,##0.00';
        sheet.getCell(fila, 9).font = { name: FONT, size: 9 };
        fila++;
    });
    const primeraRefSubtotal = filaSubtotal, ultimaRefSubtotal = fila - 1;

    sheet.getCell(fila, 8).value = 'Subtotal';
    sheet.getCell(fila, 8).font = { name: FONT, bold: true, size: 9 };
    sheet.getCell(fila, 9).value = { formula: `SUM(I${primeraRefSubtotal}:I${ultimaRefSubtotal})` };
    sheet.getCell(fila, 9).numFmt = '$#,##0.00';
    sheet.getCell(fila, 9).font = { name: FONT, bold: true, size: 9 };
    const filaSubtotalFinal = fila;
    fila++;

    sheet.getCell(fila, 8).value = 'Descuento';
    sheet.getCell(fila, 8).font = { name: FONT, size: 9 };
    sheet.getCell(fila, 9).value = Number(proforma.descuento || 0);
    sheet.getCell(fila, 9).numFmt = '$#,##0.00';
    const filaDescuento = fila;
    fila++;

    sheet.getCell(fila, 8).value = `IVA (${Number(proforma.iva_porcentaje)}%)`;
    sheet.getCell(fila, 8).font = { name: FONT, size: 9 };
    sheet.getCell(fila, 9).value = { formula: `(I${filaSubtotalFinal}-I${filaDescuento})*${Number(proforma.iva_porcentaje) || 0}/100` };
    sheet.getCell(fila, 9).numFmt = '$#,##0.00';
    const filaIva = fila;
    fila++;

    sheet.getCell(fila, 8).value = 'TOTAL';
    sheet.getCell(fila, 8).font = { name: FONT, bold: true, size: 11 };
    sheet.getCell(fila, 8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    sheet.getCell(fila, 8).font = { name: FONT, bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    sheet.getCell(fila, 9).value = { formula: `I${filaSubtotalFinal}-I${filaDescuento}+I${filaIva}` };
    sheet.getCell(fila, 9).numFmt = '$#,##0.00';
    sheet.getCell(fila, 9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    sheet.getCell(fila, 9).font = { name: FONT, bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    const filaTotal = fila;
    fila++;

    // Condiciones de pago (reglasPago): el anticipo es REQUERIDO; lo pagado
    // son solo los pagos registrados en el pagare de la proforma.
    const pct = porcentajeAnticipo(proforma.tipo);
    const deuda = resumenDeuda({ montoTotal: proforma.total, montoPagado: proforma.pagare ? proforma.pagare.monto_pagado : 0, anticipoRequerido: proforma.anticipo });
    const lineaPago = (label, valor, negrita) => {
        sheet.getCell(fila, 8).value = label;
        sheet.getCell(fila, 8).font = { name: FONT, size: 9, bold: !!negrita };
        sheet.getCell(fila, 9).value = valor;
        sheet.getCell(fila, 9).numFmt = '$#,##0.00';
        sheet.getCell(fila, 9).font = { name: FONT, size: 9, bold: !!negrita };
        fila++;
    };
    if (deuda.anticipo_requerido > 0) {
        lineaPago(pct ? `Anticipo requerido (${pct}%)` : 'Anticipo requerido', deuda.anticipo_requerido);
        lineaPago(pct ? `Saldo restante (${100 - pct}%)` : 'Saldo después del anticipo', { formula: `I${filaTotal}-${deuda.anticipo_requerido}` });
    }
    const filaPagado = fila;
    lineaPago('Total pagado', deuda.pagado);
    lineaPago('Saldo pendiente de pago', { formula: `MAX(I${filaTotal}-I${filaPagado},0)` }, true);
    fila += 1;

    // ── Notas ──
    if (proforma.tipo === 'pintura' && proforma.garantia) {
        sheet.mergeCells(`A${fila}:L${fila}`);
        sheet.getCell(`A${fila}`).value = `Garantía: ${proforma.garantia}`;
        sheet.getCell(`A${fila}`).font = { name: FONT, size: 9, bold: true };
        fila++;
    }
    if (proforma.tipo === 'pintura' && proforma.tiempo_estimado) {
        sheet.mergeCells(`A${fila}:L${fila}`);
        sheet.getCell(`A${fila}`).value = `Tiempo estimado de trabajo: ${proforma.tiempo_estimado}`;
        sheet.getCell(`A${fila}`).font = { name: FONT, size: 9, bold: true };
        fila++;
    }
    if (proforma.observaciones) {
        sheet.mergeCells(`A${fila}:L${fila}`);
        sheet.getCell(`A${fila}`).value = `Observaciones: ${proforma.observaciones}`;
        sheet.getCell(`A${fila}`).font = { name: FONT, size: 9 };
        fila++;
    }
    if (proforma.condiciones) {
        sheet.mergeCells(`A${fila}:L${fila}`);
        sheet.getCell(`A${fila}`).value = `Forma de pago / condiciones: ${proforma.condiciones}`;
        sheet.getCell(`A${fila}`).font = { name: FONT, size: 9 };
        fila++;
    }
    fila += 2;
    sheet.getCell(`A${fila}`).value = `Elaborado por: ${proforma.usuario_nombre || ''}`;
    sheet.getCell(`A${fila}`).font = { name: FONT, size: 8, color: { argb: 'FF64748B' } };
    sheet.getCell(`H${fila}`).value = 'Firma del cliente: ______________________________';
    sheet.getCell(`H${fila}`).font = { name: FONT, size: 8, color: { argb: 'FF64748B' } };

    return wb.xlsx.writeBuffer();
}

module.exports = { generarProformaExcel };
