/**
 * SS SWAP - Excel del listado de cajas (Sprint 29)
 * Una fila por caja con fondo inicial, esperado, contado y diferencia
 * (sobrante en verde, faltante en rojo) y una fila de totales con formulas.
 */
const ExcelJS = require('exceljs');

const FONT = 'Calibri';
const AZUL = 'FF0284C7';
const AZUL_CLARO = 'FFE0F2FE';
const BORDE = { style: 'thin', color: { argb: 'FFCBD5E1' } };
const bordeCelda = { top: BORDE, left: BORDE, bottom: BORDE, right: BORDE };
const MONEDA = '"$"#,##0.00;[Red]-"$"#,##0.00';

const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const num = (v) => (v === null || v === undefined ? null : Number(v));

/** @param {object[]} sesiones filas del listado (caja.controller SELECT_LISTADO) */
async function generarCajasExcel(sesiones) {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'SS SWAP';
    const ws = wb.addWorksheet('Cajas', { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.columns = [
        { header: '#', key: 'id', width: 8 },
        { header: 'Sucursal', key: 'sucursal', width: 20 },
        { header: 'Cajero', key: 'cajero', width: 24 },
        { header: 'Abrió', key: 'abrio', width: 22 },
        { header: 'Apertura', key: 'apertura', width: 18 },
        { header: 'Cierre', key: 'cierre', width: 18 },
        { header: 'Estado', key: 'estado', width: 10 },
        { header: 'Fondo inicial', key: 'inicial', width: 14 },
        { header: 'Esperado', key: 'esperado', width: 14 },
        { header: 'Contado', key: 'contado', width: 14 },
        { header: 'Diferencia', key: 'diferencia', width: 14 },
        { header: 'Resultado', key: 'resultado', width: 12 },
        { header: 'Reaperturas', key: 'reaperturas', width: 12 },
        { header: 'Notas de cierre', key: 'notas', width: 40 },
    ];
    ws.getRow(1).eachCell(c => {
        c.font = { name: FONT, bold: true, size: 10, color: { argb: AZUL } };
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL_CLARO } };
        c.border = bordeCelda;
        c.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    for (const s of sesiones) {
        const dif = num(s.diferencia);
        const fila = ws.addRow({
            id: s.id, sucursal: s.sucursal_nombre || '—', cajero: s.cajero_nombre, abrio: s.usuario_apertura_nombre,
            apertura: fechaHora(s.fecha_apertura), cierre: fechaHora(s.fecha_cierre),
            estado: s.estado === 'abierta' ? 'Abierta' : 'Cerrada',
            inicial: num(s.monto_apertura), esperado: num(s.monto_cierre_esperado), contado: num(s.monto_cierre_real), diferencia: dif,
            resultado: dif === null ? '' : Math.abs(dif) < 0.005 ? 'Cuadra' : dif > 0 ? 'Sobrante' : 'Faltante',
            reaperturas: Number(s.veces_reabierta) || 0, notas: s.notas_cierre || '',
        });
        fila.eachCell({ includeEmpty: true }, c => { c.font = { name: FONT, size: 10 }; c.border = bordeCelda; });
        for (const k of ['inicial', 'esperado', 'contado', 'diferencia']) fila.getCell(k).numFmt = MONEDA;
        if (dif !== null && Math.abs(dif) >= 0.005) {
            const color = dif > 0 ? 'FF059669' : 'FFDC2626';
            fila.getCell('diferencia').font = { name: FONT, size: 10, bold: true, color: { argb: color } };
            fila.getCell('resultado').font = { name: FONT, size: 10, bold: true, color: { argb: color } };
        }
    }

    if (sesiones.length) {
        const fin = sesiones.length + 1;
        const total = ws.addRow({ id: 'TOTAL' });
        for (const [k, col] of [['inicial', 'H'], ['esperado', 'I'], ['contado', 'J'], ['diferencia', 'K']]) {
            total.getCell(k).value = { formula: `SUM(${col}2:${col}${fin})` };
            total.getCell(k).numFmt = MONEDA;
        }
        total.eachCell({ includeEmpty: true }, c => { c.font = { name: FONT, size: 10, bold: true }; c.border = bordeCelda; });
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
}

module.exports = { generarCajasExcel };
