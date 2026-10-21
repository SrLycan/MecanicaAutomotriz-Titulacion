/**
 * SS SWAP - RIDE (Representación Impresa del Documento Electrónico)
 *
 * Distribución según el Anexo 2 de la Ficha Técnica v2.34:
 *  - Izquierda: logo, razón social, nombre comercial, dirección matriz y del
 *    establecimiento, contribuyente especial, obligado a llevar contabilidad,
 *    agente de retención y leyenda RIMPE.
 *  - Derecha: R.U.C., tipo y número de comprobante, número de autorización
 *    (= clave de acceso), fecha y hora de autorización, ambiente, emisión y
 *    clave de acceso con código de barras (opcional según 9.20; se incluye en
 *    CODE-128).
 *  - Comprador, detalle, información adicional, forma de pago y subtotales
 *    (solo los que tienen valor, como permite la nota del anexo).
 *
 * El RIDE refleja SIEMPRE los datos guardados del comprobante (la instantánea
 * firmada), nunca datos actuales del cliente o del inventario. Si el
 * comprobante no está AUTORIZADO, el documento lleva una marca de agua que lo
 * dice: un borrador o un comprobante de pruebas nunca parece una factura válida.
 */
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const path = require('path');
const fs = require('fs');
const { Writable } = require('stream');
const { TARIFAS_IVA, FORMAS_PAGO, REGIMENES, NOMBRE_DOC, AMBIENTES } = require('./catalogos');

const FUENTE_REGULAR = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FUENTE_NEGRITA = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');
const UNICODE = fs.existsSync(FUENTE_REGULAR) && fs.existsSync(FUENTE_NEGRITA);
const F = { n: UNICODE ? 'R-Regular' : 'Helvetica', b: UNICODE ? 'R-Bold' : 'Helvetica-Bold' };
const M = 28;
const BORDE = '#94a3b8';
const MUTED = '#475569';

const dinero = (v) => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cantidad = (v) => {
    const n = Number(v || 0);
    return n % 1 === 0 ? n.toFixed(2) : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
};
const fechaDMA = (iso) => {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};
const fechaHora = (v) => {
    if (!v) return '';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    const ec = new Date(d.getTime() - 5 * 3600 * 1000).toISOString();
    return `${ec.slice(8, 10)}/${ec.slice(5, 7)}/${ec.slice(0, 4)} ${ec.slice(11, 19)}`;
};
const limpio = (v) => String(v ?? '').normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

async function codigoBarras(clave) {
    return bwipjs.toBuffer({ bcid: 'code128', text: clave, scale: 2, height: 9, includetext: false });
}

/**
 * Genera el RIDE en un Buffer PDF.
 * @param {object} c  comprobante (fila de comprobantes_electronicos + detalles + emisor snapshot)
 * @param {object} opciones { logo: rutaLogo|null }
 */
async function generarRide(c, { logo = null } = {}) {
    const doc = new PDFDocument({ size: 'A4', margin: M, info: { Title: `${NOMBRE_DOC[c.cod_doc]} ${numeroDoc(c)}`, Producer: 'SS SWAP' } });
    if (UNICODE) { doc.registerFont('R-Regular', FUENTE_REGULAR); doc.registerFont('R-Bold', FUENTE_NEGRITA); }
    const partes = [];
    const salida = new Writable({ write(chunk, _e, cb) { partes.push(chunk); cb(); } });
    doc.pipe(salida);

    const e = c.emisor || {};
    const ancho = doc.page.width - M * 2;
    const mitad = (ancho - 10) / 2;
    const autorizado = c.estado === 'autorizado' || c.estado === 'anulacion_solicitada' || c.estado === 'anulado';

    // ── Bloque izquierdo: emisor ──
    let y = M;
    if (logo && fs.existsSync(logo)) {
        try { doc.image(logo, M + 10, y, { fit: [mitad - 20, 70], align: 'center' }); } catch { /* logo ilegible: se omite */ }
    }
    const yCajaIzq = y + 80;
    const lineasEmisor = [
        [null, limpio(e.razonSocial).toUpperCase(), true],
        [null, limpio(e.nombreComercial), false],
        ['Dirección Matriz:', limpio(e.dirMatriz)],
        ['Dirección Sucursal:', limpio(e.dirEstablecimiento)],
        e.contribuyenteEspecial ? ['Contribuyente Especial Nro.', limpio(e.contribuyenteEspecial)] : null,
        ['OBLIGADO A LLEVAR CONTABILIDAD', e.obligadoContabilidad ? 'SI' : 'NO'],
        e.agenteRetencion ? ['Agente de Retención Resolución No.', limpio(e.agenteRetencion)] : null,
        REGIMENES[e.regimen]?.leyenda ? [null, REGIMENES[e.regimen].leyenda, true] : null,
    ].filter(Boolean);
    doc.fontSize(8);
    let yy = yCajaIzq + 8;
    for (const [et, val, negrita] of lineasEmisor) {
        if (!val) continue;
        if (et) {
            doc.font(F.b).text(et, M + 8, yy, { width: 95 });
            const h1 = doc.heightOfString(et, { width: 95 });
            doc.font(F.n).text(val, M + 106, yy, { width: mitad - 114 });
            yy += Math.max(h1, doc.heightOfString(val, { width: mitad - 114 })) + 5;
        } else {
            doc.font(negrita ? F.b : F.n).text(val, M + 8, yy, { width: mitad - 16 });
            yy += doc.heightOfString(val, { width: mitad - 16 }) + 5;
        }
    }
    const altoIzq = yy - yCajaIzq + 4;

    // ── Bloque derecho: comprobante ──
    const xd = M + mitad + 10;
    let yd = y + 8;
    const fila = (et, val, { negrita = false, tam = 8 } = {}) => {
        doc.font(F.b).fontSize(tam).text(et, xd + 8, yd, { width: 110 });
        doc.font(negrita ? F.b : F.n).fontSize(tam).text(val || '', xd + 120, yd, { width: mitad - 128 });
        yd += Math.max(doc.heightOfString(et, { width: 110 }), doc.heightOfString(val || ' ', { width: mitad - 128 })) + 6;
    };
    fila('R.U.C.:', e.ruc, { negrita: true, tam: 10 });
    doc.font(F.b).fontSize(12).text(NOMBRE_DOC[c.cod_doc] || 'COMPROBANTE', xd + 8, yd); yd += 18;
    fila('No.', numeroDoc(c), { negrita: true });
    doc.font(F.b).fontSize(8).text('NÚMERO DE AUTORIZACIÓN', xd + 8, yd); yd += 11;
    doc.font(F.n).fontSize(7.5).text(autorizado ? (c.numero_autorizacion || c.clave_acceso) : 'PENDIENTE — comprobante no autorizado', xd + 8, yd, { width: mitad - 16 }); yd += 14;
    fila('FECHA Y HORA DE AUTORIZACIÓN:', autorizado ? fechaHora(c.fecha_autorizacion) : '—');
    fila('AMBIENTE:', AMBIENTES[c.ambiente] || '');
    fila('EMISIÓN:', 'NORMAL');
    doc.font(F.b).fontSize(8).text('CLAVE DE ACCESO', xd + 8, yd); yd += 11;
    if (c.clave_acceso) {
        try {
            const png = await codigoBarras(c.clave_acceso);
            doc.image(png, xd + 8, yd, { width: mitad - 16, height: 32 });
        } catch { /* sin código de barras: es opcional (9.20) */ }
        yd += 35;
        doc.font(F.n).fontSize(7).text(c.clave_acceso, xd + 8, yd, { width: mitad - 16, align: 'center' }); yd += 12;
    } else {
        doc.font(F.n).fontSize(8).text('Sin clave (borrador)', xd + 8, yd); yd += 12;
    }
    const altoDer = yd - y + 4;
    const altoCabecera = Math.max(altoDer, yCajaIzq - y + altoIzq);
    doc.lineWidth(0.8).strokeColor(BORDE);
    doc.roundedRect(M, yCajaIzq, mitad, y + altoCabecera - yCajaIzq, 6).stroke();
    doc.roundedRect(xd, y, mitad, altoCabecera, 6).stroke();
    y += altoCabecera + 10;

    // ── Comprador ──
    const comp = c.comprador || {};
    const yComp = y;
    doc.fontSize(8);
    const parComp = (et, val, x, w) => {
        doc.font(F.b).text(et, x, y, { continued: true }).font(F.n).text(` ${limpio(val)}`, { width: w });
    };
    parComp('Razón Social / Nombres y Apellidos:', comp.razon_social, M + 6, ancho - 12); y = doc.y + 3;
    const y0 = y;
    parComp('Identificación:', comp.identificacion, M + 6, ancho / 2 - 12);
    y = y0;
    if (c.vehiculo?.placa) parComp('Placa / Matrícula:', c.vehiculo.placa, M + ancho / 2, ancho / 2 - 12);
    y = Math.max(doc.y, y0 + 10) + 3;
    parComp('Fecha Emisión:', fechaDMA(c.fecha_emision), M + 6, ancho / 2 - 12); y = doc.y + 3;
    if (comp.direccion) { parComp('Dirección:', comp.direccion, M + 6, ancho - 12); y = doc.y + 3; }
    if (c.cod_doc === '04' && c.sustento) {
        parComp('Comprobante que se modifica:', `FACTURA ${c.sustento.numero}`, M + 6, ancho / 2 - 12); y = doc.y + 3;
        parComp('Fecha emisión (comprobante a modificar):', fechaDMA(c.sustento.fechaEmision), M + 6, ancho - 12); y = doc.y + 3;
        parComp('Razón de modificación:', c.motivo_nc, M + 6, ancho - 12); y = doc.y + 3;
    }
    doc.roundedRect(M, yComp - 4, ancho, y - yComp + 6, 4).stroke();
    y += 10;

    // ── Detalle ──
    const cols = [
        ['Cod. Principal', 62, 'left'], ['Cant.', 46, 'right'], ['Descripción', 0, 'left'],
        ['Detalle Adicional', 82, 'left'], ['Precio Unitario', 62, 'right'], ['Descuento', 52, 'right'], ['Precio Total', 60, 'right'],
    ];
    const fijo = cols.reduce((s, cdef) => s + cdef[1], 0);
    cols[2][1] = ancho - fijo;
    const encabezado = () => {
        let x = M;
        doc.font(F.b).fontSize(7);
        const h = Math.max(...cols.map(([t, w]) => doc.heightOfString(t, { width: w - 6 }))) + 10;
        doc.rect(M, y, ancho, h).fillAndStroke('#e2e8f0', BORDE);
        doc.fillColor('#0f172a');
        for (const [t, w, al] of cols) { doc.text(t, x + 3, y + 6, { width: w - 6, align: al }); x += w; }
        y += h;
    };
    encabezado();
    doc.font(F.n).fontSize(7.5);
    for (const l of c.detalles || []) {
        const adicional = (l.detalles_adicionales || []).map(d => `${d.nombre}: ${d.valor}`).join('; ');
        const valores = [l.codigo_principal || '', cantidad(l.cantidad), limpio(l.descripcion), limpio(adicional),
            cantidad(l.precio_unitario), dinero(l.descuento), dinero(l.precio_total_sin_impuesto)];
        const h = Math.max(...valores.map((v, i) => doc.heightOfString(String(v), { width: cols[i][1] - 6 }))) + 8;
        if (y + h > doc.page.height - M - 20) { doc.addPage(); y = M; encabezado(); doc.font(F.n).fontSize(7.5); }
        let x = M;
        valores.forEach((v, i) => {
            doc.rect(x, y, cols[i][1], h).stroke();
            doc.text(String(v), x + 3, y + 4, { width: cols[i][1] - 6, align: cols[i][2] });
            x += cols[i][1];
        });
        y += h;
    }
    y += 8;

    // ── Información adicional + forma de pago (izq.) y subtotales (der.) ──
    if (y + 170 > doc.page.height - M) { doc.addPage(); y = M; }
    const anchoIzq = ancho * 0.55;
    const xTot = M + anchoIzq + 10;
    const anchoTot = ancho - anchoIzq - 10;
    let yi = y;
    const info = (c.info_adicional || []).filter(x => x && x.nombre && x.valor);
    if (info.length) {
        doc.font(F.b).fontSize(8).text('Información Adicional', M, yi, { width: anchoIzq, align: 'center' }); yi += 12;
        const yIni = yi;
        doc.fontSize(7.5);
        for (const x of info) {
            doc.font(F.b).text(limpio(x.nombre), M + 5, yi, { width: 100 });
            doc.font(F.n).text(limpio(x.valor), M + 108, yi, { width: anchoIzq - 113 });
            yi += Math.max(doc.heightOfString(limpio(x.valor), { width: anchoIzq - 113 }), 9) + 3;
        }
        doc.rect(M, yIni - 3, anchoIzq, yi - yIni + 3).stroke();
        yi += 8;
    }
    if (c.cod_doc === '01' && (c.pagos || []).length) {
        doc.font(F.b).fontSize(8);
        doc.rect(M, yi, anchoIzq * 0.7, 14).stroke().text('Forma de pago', M + 4, yi + 3, { width: anchoIzq * 0.7 - 8, align: 'center' });
        doc.rect(M + anchoIzq * 0.7, yi, anchoIzq * 0.3, 14).stroke().text('Valor', M + anchoIzq * 0.7 + 4, yi + 3, { width: anchoIzq * 0.3 - 8, align: 'center' });
        yi += 14;
        doc.font(F.n).fontSize(7.5);
        for (const p of c.pagos) {
            const t = `${p.formaPago} - ${(FORMAS_PAGO[p.formaPago] || '').toUpperCase()}${p.plazo ? ` (${p.plazo} ${p.unidadTiempo || 'días'})` : ''}`;
            const h = doc.heightOfString(t, { width: anchoIzq * 0.7 - 8 }) + 6;
            doc.rect(M, yi, anchoIzq * 0.7, h).stroke().text(t, M + 4, yi + 3, { width: anchoIzq * 0.7 - 8 });
            doc.rect(M + anchoIzq * 0.7, yi, anchoIzq * 0.3, h).stroke().text(dinero(p.total), M + anchoIzq * 0.7 + 4, yi + 3, { width: anchoIzq * 0.3 - 8, align: 'right' });
            yi += h;
        }
    }

    const filasTot = [];
    for (const g of c.totales_impuestos || []) {
        const t = TARIFAS_IVA[g.codigoPorcentaje];
        const etiqueta = g.codigoPorcentaje === '6' ? 'SUBTOTAL NO OBJETO DE IVA'
            : g.codigoPorcentaje === '7' ? 'SUBTOTAL EXENTO DE IVA'
                : `SUBTOTAL ${t ? t.tarifa : g.tarifa}%`;
        filasTot.push([etiqueta, g.base]);
    }
    filasTot.push(['SUBTOTAL SIN IMPUESTOS', c.total_sin_impuestos]);
    filasTot.push(['TOTAL DESCUENTO', c.total_descuento]);
    for (const g of c.totales_impuestos || []) {
        if (Number(g.tarifa) > 0) filasTot.push([`IVA ${g.tarifa}%`, g.valor]);
    }
    if (Number(c.propina) > 0) filasTot.push(['PROPINA', c.propina]);
    filasTot.push([c.cod_doc === '04' ? 'VALOR TOTAL (MODIFICACIÓN)' : 'VALOR TOTAL', c.importe_total]);
    let yt = y;
    doc.fontSize(7.5);
    filasTot.forEach(([et, val], i) => {
        const ultima = i === filasTot.length - 1;
        doc.font(ultima ? F.b : F.n);
        doc.rect(xTot, yt, anchoTot * 0.68, 13).stroke().text(et, xTot + 4, yt + 3, { width: anchoTot * 0.68 - 8 });
        doc.rect(xTot + anchoTot * 0.68, yt, anchoTot * 0.32, 13).stroke().text(dinero(val), xTot + anchoTot * 0.68 + 4, yt + 3, { width: anchoTot * 0.32 - 8, align: 'right' });
        yt += 13;
    });

    // ── Avisos ──
    let yAviso = Math.max(yi, yt) + 14;
    doc.font(F.n).fontSize(7).fillColor(MUTED);
    if (Number(c.ambiente) === 1) {
        doc.text('Comprobante emitido en AMBIENTE DE PRUEBAS del SRI: no tiene validez tributaria.', M, yAviso, { width: ancho, align: 'center' });
        yAviso += 10;
    }
    if (c.estado === 'anulado') doc.text('Este comprobante fue ANULADO en el SRI.', M, yAviso, { width: ancho, align: 'center' });
    doc.fillColor('black');

    if (!autorizado || Number(c.ambiente) === 1 || c.estado === 'anulado') {
        const marca = c.estado === 'anulado' ? 'ANULADO' : !autorizado ? 'NO AUTORIZADO' : 'PRUEBAS - SIN VALIDEZ';
        doc.save();
        doc.rotate(-35, { origin: [doc.page.width / 2, doc.page.height / 2] });
        doc.font(F.b).fontSize(54).fillColor('#dc2626').opacity(0.12)
            .text(marca, 0, doc.page.height / 2 - 30, { width: doc.page.width, align: 'center' });
        doc.restore();
        doc.opacity(1).fillColor('black');
    }

    doc.end();
    await new Promise((ok) => salida.on('finish', ok));
    return Buffer.concat(partes);
}

function numeroDoc(c) {
    return c.secuencial ? `${c.establecimiento}-${c.punto_emision}-${c.secuencial}` : 'BORRADOR';
}

module.exports = { generarRide, numeroDoc };
