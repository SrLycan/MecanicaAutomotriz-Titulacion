/**
 * SS SWAP - PDF de la Orden de Trabajo
 *
 * Documento de taller (no tributario) con la identidad de la empresa DUEÑA
 * de la orden (marcaEmpresa.js: copia guardada al crear la orden o, en las
 * órdenes anteriores al Sprint 24, los datos actuales de su empresa), el
 * cliente, el vehículo, el trabajo solicitado y quién la registró.
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { marcaDe } = require('./marcaEmpresa');

const FUENTE_REGULAR = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FUENTE_NEGRITA = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');
const FUENTES_UNICODE = fs.existsSync(FUENTE_REGULAR) && fs.existsSync(FUENTE_NEGRITA);
const F = { normal: FUENTES_UNICODE ? 'SS-Regular' : 'Helvetica', negrita: FUENTES_UNICODE ? 'SS-Bold' : 'Helvetica-Bold' };
const MARGIN = 40;
const AZUL = '#0b4f7c';
const TXT = '#0f172a';
const MUT = '#64748b';
const BORDE = '#cbd5e1';
const PANEL = '#f8fafc';

const ESTADOS = { pendiente: 'Pendiente', en_progreso: 'En progreso', completado: 'Completado', cancelado: 'Cancelado' };

const texto = (v) => (v === null || v === undefined ? '' : String(v).normalize('NFC')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim());
const fecha = (v) => {
    if (!v) return '—';
    const m = String(v instanceof Date ? v.toISOString() : v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};
const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const money = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const numeroOrden = (o) => texto(o.numero) || `OT-${String(o.id).padStart(6, '0')}`;

/** Genera el PDF y devuelve un Buffer. `orden` incluye cliente, vehículo, usuarios y empresa (ver ordenes.controller). */
function generarOrdenPdf(orden) {
    return new Promise((resolve, reject) => {
        const marca = marcaDe(orden);
        const doc = new PDFDocument({ size: 'A4', margin: MARGIN,
            info: { Title: `${numeroOrden(orden)} - ${marca.nombre}`, Author: marca.nombre, Subject: 'Orden de trabajo' } });
        if (FUENTES_UNICODE) { doc.registerFont(F.normal, FUENTE_REGULAR); doc.registerFont(F.negrita, FUENTE_NEGRITA); }
        const partes = [];
        doc.on('data', c => partes.push(c));
        doc.on('end', () => resolve(Buffer.concat(partes)));
        doc.on('error', reject);

        const ancho = doc.page.width - MARGIN * 2;

        // ── Encabezado: logo + empresa | número y fechas ──
        let logoAncho = 0;
        if (marca.logo) {
            try { doc.image(marca.logo, MARGIN, MARGIN, { fit: [78, 56] }); logoAncho = 90; } catch { /* logo ilegible: se omite */ }
        }
        const derAncho = 170;
        const ex = MARGIN + logoAncho;
        const eAncho = ancho - logoAncho - derAncho - 12;
        doc.font(F.negrita).fontSize(13).fillColor(AZUL).text(texto(marca.nombre), ex, MARGIN + 2, { width: eAncho });
        doc.font(F.normal).fontSize(7.8).fillColor(MUT);
        for (const linea of [
            marca.razonSocial && marca.razonSocial !== marca.nombre ? marca.razonSocial : null,
            marca.ruc ? `RUC: ${marca.ruc}` : null,
            marca.direccion,
            [marca.telefono, marca.email].filter(Boolean).join('   ·   ') || null,
        ].filter(Boolean)) doc.text(texto(linea), ex, doc.y + 1, { width: eAncho });
        const yEmpresa = doc.y;

        const bx = MARGIN + ancho - derAncho;
        doc.font(F.negrita).fontSize(7.5).fillColor(MUT).text('ORDEN DE TRABAJO N.º', bx, MARGIN + 2, { width: derAncho, align: 'right' });
        doc.font(F.negrita).fontSize(15).fillColor(AZUL).text(numeroOrden(orden), bx, doc.y + 1, { width: derAncho, align: 'right' });
        doc.font(F.normal).fontSize(8).fillColor(TXT);
        doc.text(`Ingreso: ${fecha(orden.fecha_ingreso)}`, bx, doc.y + 4, { width: derAncho, align: 'right' });
        if (orden.fecha_salida) doc.text(`Salida: ${fecha(orden.fecha_salida)}`, bx, doc.y + 1, { width: derAncho, align: 'right' });
        doc.text(`Estado: ${ESTADOS[orden.estado] || texto(orden.estado)}`, bx, doc.y + 1, { width: derAncho, align: 'right' });
        const yDer = doc.y;

        doc.y = Math.max(MARGIN + 58, yEmpresa, yDer) + 10;
        doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + ancho, doc.y).strokeColor(AZUL).lineWidth(1.6).stroke();
        doc.y += 12;

        // ── Cliente | Vehículo ──
        const mitad = (ancho - 12) / 2;
        const bloque = (x, y, titulo, filas) => {
            doc.rect(x, y, mitad, 16).fill('#e8f1f8');
            doc.font(F.negrita).fontSize(8).fillColor(AZUL).text(titulo, x + 8, y + 4, { width: mitad - 16 });
            let yy = y + 22;
            for (const [k, v] of filas) {
                doc.font(F.negrita).fontSize(8).fillColor(MUT).text(k, x + 8, yy, { width: 80 });
                doc.font(F.normal).fontSize(8.5).fillColor(TXT).text(texto(v) || '—', x + 90, yy, { width: mitad - 98 });
                yy = Math.max(doc.y, yy + 11) + 2;
            }
            return yy;
        };
        const yBloques = doc.y;
        const y1 = bloque(MARGIN, yBloques, 'CLIENTE', [
            ['Nombre:', orden.cliente_nombre], ['Cédula / RUC:', orden.cliente_cedula],
            ['Teléfono:', orden.cliente_telefono], ['Correo:', orden.cliente_email], ['Dirección:', orden.cliente_direccion],
        ]);
        const y2 = bloque(MARGIN + mitad + 12, yBloques, 'VEHÍCULO', [
            ['Placa:', orden.placa], ['Marca / modelo:', [orden.marca, orden.modelo].filter(Boolean).join(' ')],
            ['Año / color:', [orden.anio, orden.color].filter(Boolean).join(' · ')], ['VIN:', orden.vin],
            ['Kilometraje:', orden.kilometraje != null ? `${Number(orden.kilometraje).toLocaleString('es-EC')} km` : null],
        ]);
        doc.y = Math.max(y1, y2) + 10;

        // ── Trabajo ──
        const seccion = (titulo, cuerpo) => {
            if (!texto(cuerpo)) return;
            if (doc.y > doc.page.height - 140) doc.addPage();
            doc.font(F.negrita).fontSize(9).fillColor(AZUL).text(titulo, MARGIN, doc.y, { width: ancho });
            const y = doc.y + 3;
            doc.font(F.normal).fontSize(9).fillColor(TXT);
            const alto = doc.heightOfString(texto(cuerpo), { width: ancho - 16 }) + 12;
            doc.rect(MARGIN, y, ancho, alto).fillAndStroke(PANEL, BORDE);
            doc.fillColor(TXT).text(texto(cuerpo), MARGIN + 8, y + 6, { width: ancho - 16 });
            doc.y = y + alto + 10;
        };
        seccion('TRABAJO SOLICITADO', orden.descripcion);
        seccion('DIAGNÓSTICO', orden.diagnostico);
        seccion('AVANCE / NOTAS DEL TALLER', orden.notas_progreso);

        // ── Proformas relacionadas ──
        if ((orden.proformas || []).length) {
            seccion('PROFORMAS RELACIONADAS', orden.proformas.map(p => `${texto(p.numero)} · ${money(p.total)} · ${texto(p.estado)}`).join('\n'));
        }

        // ── Responsables ──
        if (doc.y > doc.page.height - 150) doc.addPage();
        doc.font(F.negrita).fontSize(9).fillColor(AZUL).text('RESPONSABLES', MARGIN, doc.y, { width: ancho });
        doc.font(F.normal).fontSize(8.5).fillColor(TXT);
        doc.text(`Registrada por: ${texto(orden.usuario_nombre) || '—'}  ·  ${fechaHora(orden.created_at)}`, MARGIN, doc.y + 3, { width: ancho });
        doc.text(`Técnico asignado: ${texto(orden.tecnico_nombre) || 'Sin asignar'}`, MARGIN, doc.y + 1, { width: ancho });
        if (orden.ultima_modificacion) {
            doc.text(`Última modificación: ${texto(orden.ultima_modificacion.usuario_nombre) || '—'}  ·  ${fechaHora(orden.ultima_modificacion.created_at)}`, MARGIN, doc.y + 1, { width: ancho });
        }

        // ── Firmas ──
        const yFirma = Math.max(doc.y + 50, doc.page.height - 120);
        const anchoFirma = (ancho - 40) / 2;
        doc.moveTo(MARGIN, yFirma).lineTo(MARGIN + anchoFirma, yFirma).strokeColor(BORDE).lineWidth(0.8).stroke();
        doc.moveTo(MARGIN + ancho - anchoFirma, yFirma).lineTo(MARGIN + ancho, yFirma).stroke();
        doc.font(F.normal).fontSize(8).fillColor(MUT);
        doc.text(`Recibido por: ${texto(orden.usuario_nombre)}`, MARGIN, yFirma + 4, { width: anchoFirma, align: 'center' });
        doc.text('Firma del cliente', MARGIN + ancho - anchoFirma, yFirma + 4, { width: anchoFirma, align: 'center' });

        doc.font(F.normal).fontSize(7).fillColor(MUT)
            .text(`${texto(marca.nombre)}  ·  ${numeroOrden(orden)}  ·  Documento interno de taller, no válido como comprobante de venta.`,
                MARGIN, doc.page.height - 50, { width: ancho, align: 'center', lineBreak: false });
        doc.end();
    });
}

module.exports = { generarOrdenPdf, numeroOrden };
