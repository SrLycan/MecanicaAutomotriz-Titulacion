/**
 * SS SWAP - PDF de una factura de compra RECIBIDA
 *
 * Representación legible del comprobante electrónico que emitió el
 * proveedor (datos del XML autorizado / cargado), con el estado verificado
 * en el SRI y, si la compra ya se registró, cómo ingresó al inventario.
 * No sustituye al RIDE del emisor: lo dice en el pie de cada página.
 * Si la factura no está AUTORIZADA (anulada, no autorizada o sin verificar)
 * lleva una marca de agua visible.
 */
const PDFDocument = require('pdfkit');
const bwipjs = require('bwip-js');
const path = require('path');
const fs = require('fs');
const { TARIFAS_IVA, FORMAS_PAGO, TIPOS_IDENTIFICACION } = require('../sri/catalogos');

const FUENTE_REGULAR = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FUENTE_NEGRITA = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');
const UNICODE = fs.existsSync(FUENTE_REGULAR) && fs.existsSync(FUENTE_NEGRITA);
const F = { n: UNICODE ? 'FC-Regular' : 'Helvetica', b: UNICODE ? 'FC-Bold' : 'Helvetica-Bold' };

const M = 36;
const AZUL = '#0b4f7c';
const AZUL_CLARO = '#0284c7';
const TXT = '#0f172a';
const MUT = '#64748b';
const BORDE = '#d7e1ea';
const FONDO = '#f3f7fb';
const VERDE = '#059669';
const ROJO = '#dc2626';
const AMBAR = '#d97706';
const PIE = 36; // espacio reservado al pie de página

const ESTADOS_SRI = {
    AUTORIZADO: { texto: 'AUTORIZADA EN EL SRI', color: VERDE },
    'NO AUTORIZADO': { texto: 'NO AUTORIZADA', color: ROJO, marca: 'NO AUTORIZADA' },
    ANULADO: { texto: 'ANULADA EN EL SRI', color: ROJO, marca: 'ANULADA' },
    'PENDIENTE DE ANULAR': { texto: 'PENDIENTE DE ANULAR', color: ROJO, marca: 'EN ANULACIÓN' },
    NO_ENCONTRADO: { texto: 'NO ENCONTRADA EN EL SRI', color: ROJO, marca: 'NO VERIFICADA' },
    SIN_VERIFICAR: { texto: 'SIN VERIFICAR CON EL SRI', color: AMBAR, marca: 'NO VERIFICADA' },
};
const ORIGEN = { sri: 'XML autorizado descargado del SRI', xml: 'XML entregado por el proveedor', manual: 'Ingreso manual (no verificado)' };
const AREA = { mecanica: 'Mecánica', colisiones: 'Colisiones / Pintura' };

const limpio = (v) => String(v ?? '').normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
const dinero = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const cant = (v) => { const n = Number(v || 0); return n % 1 === 0 ? String(n) : n.toLocaleString('en-US', { maximumFractionDigits: 4 }); };
const precio = (v) => { const n = Number(v || 0); return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: n % 0.01 ? 4 : 2 })}`; };
const fecha = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v instanceof Date ? v.toISOString() : String(v || '')); return m ? `${m[3]}/${m[2]}/${m[1]}` : '—'; };
const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');

/**
 * @param {object} f        factura (facturasCompra.service.obtener)
 * @param {object} extra    { cabeceraXml (leerFactura().cabecera | null), empresa: { nombre, logo } }
 * @returns {Promise<Buffer>}
 */
async function generarFacturaCompraPdf(f, { cabeceraXml = null, empresa = {} } = {}) {
    const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true,
        info: { Title: `Factura ${f.numero} - ${limpio(f.emisor_razon_social)}`, Author: limpio(empresa.nombre) || 'SS SWAP', Subject: 'Factura de compra recibida' } });
    if (UNICODE) { doc.registerFont('FC-Regular', FUENTE_REGULAR); doc.registerFont('FC-Bold', FUENTE_NEGRITA); }
    const partes = [];
    doc.on('data', (c) => partes.push(c));
    const fin = new Promise((ok, mal) => { doc.on('end', () => ok(Buffer.concat(partes))); doc.on('error', mal); });

    const W = doc.page.width - M * 2;
    const altoPagina = () => doc.page.height - M - PIE;
    const est = ESTADOS_SRI[f.estado_sri] || ESTADOS_SRI.SIN_VERIFICAR;
    const x = cabeceraXml || {};

    // ── Encabezado ──
    doc.rect(0, 0, doc.page.width, 7).fill(AZUL);
    let y = M;
    let xIzq = M;
    if (empresa.logo) {
        try { doc.image(empresa.logo, M, y, { fit: [62, 40] }); xIzq = M + 72; } catch { /* logo ilegible */ }
    }
    doc.font(F.b).fontSize(9).fillColor(TXT).text(limpio(empresa.nombre) || 'SS SWAP', xIzq, y + 6, { width: 250 });
    doc.font(F.n).fontSize(7.5).fillColor(MUT).text('Registro de facturas de compra', xIzq, doc.y + 1, { width: 250 });

    doc.font(F.b).fontSize(24).fillColor(AZUL).text('FACTURA', M, y - 2, { width: W, align: 'right' });
    doc.font(F.b).fontSize(11).fillColor(TXT).text(`No. ${limpio(f.numero)}`, M, doc.y, { width: W, align: 'right' });
    // Chip del estado en el SRI
    doc.font(F.b).fontSize(7);
    const chip = est.texto;
    const anchoChip = doc.widthOfString(chip) + 16;
    const yChip = doc.y + 4;
    doc.roundedRect(M + W - anchoChip, yChip, anchoChip, 15, 7.5).fill(est.color);
    doc.fillColor('#ffffff').text(chip, M + W - anchoChip, yChip + 4, { width: anchoChip, align: 'center' });
    y = Math.max(yChip + 24, M + 52);
    doc.moveTo(M, y).lineTo(M + W, y).lineWidth(1).strokeColor(BORDE).stroke();
    y += 12;

    // ── Tarjetas: emisor | comprobante ──
    const colW = (W - 12) / 2;
    const filasEmisor = [
        ['', limpio(f.emisor_razon_social) || '—', 'titulo'],
        ['', limpio(f.emisor_nombre_comercial), 'sub'],
        ['RUC', limpio(f.emisor_ruc)],
        ['Dirección matriz', limpio(x.dirMatriz)],
        ['Establecimiento', limpio(f.emisor_direccion && f.emisor_direccion !== x.dirMatriz ? f.emisor_direccion : '')],
        ['Obligado a llevar contabilidad', x.obligadoContabilidad ? (x.obligadoContabilidad === 'SI' ? 'Sí' : 'No') : ''],
        ['Contribuyente especial', limpio(x.contribuyenteEspecial)],
    ].filter(r => r[1]);
    const filasComp = [
        ['Fecha de emisión', fecha(f.fecha_emision)],
        ['Autorización', f.fecha_autorizacion ? fechaHora(f.fecha_autorizacion) : '—'],
        ['Ambiente', Number(f.ambiente) === 2 ? 'Producción' : 'Pruebas (sin validez tributaria)'],
        ['Número de autorización', limpio(f.numero_autorizacion) || (f.estado_sri === 'AUTORIZADO' ? limpio(f.clave_acceso) : '—'), 'apilado'],
    ];
    const medir = (filas, ancho) => filas.reduce((h, [et, val, tipo]) => {
        if (tipo === 'titulo') return h + doc.font(F.b).fontSize(11).heightOfString(val, { width: ancho }) + 3;
        if (tipo === 'sub') return h + doc.font(F.n).fontSize(8.5).heightOfString(val, { width: ancho }) + 6;
        if (tipo === 'apilado') return h + 10 + doc.font(F.n).fontSize(6.9).heightOfString(val, { width: ancho }) + 6;
        return h + Math.max(doc.font(F.n).fontSize(8.5).heightOfString(val, { width: ancho - 112 }),
            doc.font(F.b).fontSize(7.2).heightOfString(et.toUpperCase(), { width: 108 })) + 5;
    }, 0);
    const pintarFilas = (filas, x0, y0, ancho) => {
        let yy = y0;
        for (const [et, val, tipo] of filas) {
            if (tipo === 'titulo') { doc.font(F.b).fontSize(11).fillColor(TXT).text(val, x0, yy, { width: ancho }); yy = doc.y + 3; continue; }
            if (tipo === 'sub') { doc.font(F.n).fontSize(8.5).fillColor(MUT).text(val, x0, yy, { width: ancho }); yy = doc.y + 6; continue; }
            if (tipo === 'apilado') {
                doc.font(F.b).fontSize(7.2).fillColor(MUT).text(et.toUpperCase(), x0, yy + 1, { width: ancho });
                doc.font(F.n).fontSize(6.9).fillColor(TXT).text(val, x0, yy + 11, { width: ancho });
                yy = doc.y + 6;
                continue;
            }
            doc.font(F.b).fontSize(7.2).fillColor(MUT).text(et.toUpperCase(), x0, yy + 1, { width: 108 });
            const yEtiqueta = doc.y;
            doc.font(F.n).fontSize(8.5).fillColor(TXT).text(val, x0 + 112, yy, { width: ancho - 112 });
            yy = Math.max(doc.y, yEtiqueta, yy + 10) + 5;
        }
        return yy;
    };
    const interno = colW - 24;
    const altoBarras = f.clave_acceso ? 58 : 0;
    const altoTarj = Math.max(medir(filasEmisor, interno), medir(filasComp, interno) + altoBarras) + 34;
    const tarjeta = (x0, titulo) => {
        doc.roundedRect(x0, y, colW, altoTarj, 8).fill(FONDO);
        doc.rect(x0, y + 10, 3, 14).fill(AZUL_CLARO);
        doc.font(F.b).fontSize(7.5).fillColor(AZUL_CLARO).text(titulo, x0 + 12, y + 13, { width: colW - 24, characterSpacing: 1 });
    };
    tarjeta(M, 'PROVEEDOR (EMISOR)');
    tarjeta(M + colW + 12, 'COMPROBANTE');
    pintarFilas(filasEmisor, M + 12, y + 30, interno);
    let yComp = pintarFilas(filasComp, M + colW + 24, y + 30, interno);
    if (f.clave_acceso) {
        doc.font(F.b).fontSize(7.2).fillColor(MUT).text('CLAVE DE ACCESO', M + colW + 24, yComp + 2);
        try {
            const png = await bwipjs.toBuffer({ bcid: 'code128', text: f.clave_acceso, scale: 2, height: 8, includetext: false });
            doc.image(png, M + colW + 24, yComp + 13, { width: interno, height: 26 });
        } catch { /* el código de barras es opcional */ }
        doc.font(F.n).fontSize(6.4).fillColor(TXT).text(f.clave_acceso, M + colW + 24, yComp + 42, { width: interno, align: 'center', lineBreak: false });
    }
    y += altoTarj + 10;

    // ── Adquirente ──
    const tipoId = TIPOS_IDENTIFICACION[f.comprador_tipo_identificacion] || 'Identificación';
    doc.roundedRect(M, y, W, 30, 8).lineWidth(0.8).strokeColor(BORDE).stroke();
    doc.font(F.b).fontSize(7.5).fillColor(AZUL_CLARO).text('ADQUIRENTE', M + 12, y + 11, { characterSpacing: 1 });
    doc.font(F.b).fontSize(9).fillColor(TXT).text(limpio(f.comprador_razon_social) || '—', M + 90, y + 10, { width: W - 290, lineBreak: false, ellipsis: true });
    doc.font(F.n).fontSize(8.5).fillColor(MUT).text(f.comprador_identificacion ? `${tipoId}: ${f.comprador_identificacion}` : '', M + W - 200, y + 10.5, { width: 188, align: 'right' });
    y += 42;

    // ── Detalle ──
    const cols = [
        { t: 'CÓDIGO', w: 74, a: 'left' }, { t: 'DESCRIPCIÓN', w: 0, a: 'left' }, { t: 'CANT.', w: 46, a: 'right' },
        { t: 'P. UNIT.', w: 64, a: 'right' }, { t: 'DESC.', w: 50, a: 'right' }, { t: 'TOTAL', w: 66, a: 'right' },
    ];
    cols[1].w = W - cols.reduce((s, c) => s + c.w, 0);
    const cabeceraTabla = (titulo) => {
        if (titulo) { doc.font(F.b).fontSize(8).fillColor(AZUL).text(titulo, M, y, { characterSpacing: 1 }); y = doc.y + 4; }
        doc.roundedRect(M, y, W, 20, 5).fill(AZUL);
        let xx = M;
        for (const c of cols) { doc.font(F.b).fontSize(7).fillColor('#ffffff').text(c.t, xx + 6, y + 7, { width: c.w - 12, align: c.a, characterSpacing: 0.5 }); xx += c.w; }
        y += 22;
    };
    const saltar = (alto, repetir) => {
        if (y + alto <= altoPagina()) return false;
        doc.addPage();
        y = M;
        if (repetir) repetir();
        return true;
    };
    cabeceraTabla('DETALLE DE LA FACTURA');
    (f.detalles || []).forEach((d, i) => {
        const desc = limpio(d.descripcion);
        const sub = [d.codigo_auxiliar && `Cód. aux. ${limpio(d.codigo_auxiliar)}`, d.unidad_medida && limpio(d.unidad_medida)].filter(Boolean).join(' · ');
        const hDesc = doc.font(F.n).fontSize(8.3).heightOfString(desc, { width: cols[1].w - 12 }) + (sub ? 10 : 0);
        const hCod = doc.font(F.n).fontSize(7.5).heightOfString(limpio(d.codigo_principal) || '—', { width: cols[0].w - 12 });
        const alto = Math.max(hDesc, hCod, 10) + 12;
        saltar(alto, () => cabeceraTabla('DETALLE DE LA FACTURA (CONT.)'));
        if (i % 2 === 0) doc.rect(M, y, W, alto).fill(FONDO);
        let xx = M;
        const vals = [limpio(d.codigo_principal) || '—', desc, cant(d.cantidad), precio(d.precio_unitario),
            Number(d.descuento) ? dinero(d.descuento) : '—', dinero(d.precio_total_sin_impuesto)];
        vals.forEach((v, k) => {
            const c = cols[k];
            doc.font(k === 5 ? F.b : F.n).fontSize(k === 0 ? 7.5 : 8.3).fillColor(k === 0 ? MUT : TXT)
                .text(v, xx + 6, y + 6, { width: c.w - 12, align: c.a });
            if (k === 1 && sub) doc.font(F.n).fontSize(7).fillColor(MUT).text(sub, xx + 6, doc.y + 1, { width: c.w - 12 });
            xx += c.w;
        });
        y += alto;
    });
    doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.8).strokeColor(BORDE).stroke();
    y += 12;

    // ── Totales (derecha) | pagos e info adicional (izquierda) ──
    const tot = Array.isArray(f.totales_impuestos) ? f.totales_impuestos : [];
    const lineasTot = [];
    for (const t of tot.filter(t => t.codigo === '2')) {
        const nombre = (TARIFAS_IVA[t.codigoPorcentaje] || {}).nombre || 'IVA';
        lineasTot.push([`Subtotal ${nombre.replace(/^IVA /, '')}`, t.baseImponible]);
    }
    if (!lineasTot.length) lineasTot.push(['Subtotal sin impuestos', f.total_sin_impuestos]);
    else if (lineasTot.length > 1) lineasTot.push(['Subtotal sin impuestos', f.total_sin_impuestos]);
    if (Number(f.total_descuento)) lineasTot.push(['Descuento', f.total_descuento]);
    for (const t of tot.filter(t => t.codigo === '2' && Number(t.valor) > 0)) {
        lineasTot.push([(TARIFAS_IVA[t.codigoPorcentaje] || {}).nombre || 'IVA', t.valor]);
    }
    if (!tot.some(t => t.codigo === '2' && Number(t.valor) > 0) && Number(f.total_iva)) lineasTot.push(['IVA', f.total_iva]);
    const anchoTot = 210;
    const altoTot = lineasTot.length * 16 + 34;
    const izqW = W - anchoTot - 16;
    const pagos = (x.pagos || []).filter(p => p.formaPago);
    const info = x.infoAdicional || [];
    const altoIzq = (pagos.length ? 22 + pagos.length * 13 : 0) + (info.length ? 22 + info.reduce((s, c) => s + doc.font(F.n).fontSize(7.8).heightOfString(`${c.nombre}: ${c.valor}`, { width: izqW - 24 }) + 3, 0) : 0);
    saltar(Math.max(altoTot, altoIzq) + 6);

    const yBloque = y;
    let xt = M + W - anchoTot;
    let yt = y;
    doc.roundedRect(xt, yt, anchoTot, altoTot, 8).lineWidth(0.8).strokeColor(BORDE).stroke();
    yt += 8;
    for (const [et, v] of lineasTot) {
        doc.font(F.n).fontSize(8.5).fillColor(MUT).text(et, xt + 12, yt, { width: anchoTot - 110 });
        doc.font(F.n).fontSize(8.5).fillColor(TXT).text(et === 'Descuento' ? `-${dinero(v)}` : dinero(v), xt + anchoTot - 100, yt, { width: 88, align: 'right' });
        yt += 16;
    }
    doc.roundedRect(xt + 6, yt + 2, anchoTot - 12, 22, 6).fill(AZUL);
    doc.font(F.b).fontSize(9).fillColor('#ffffff').text('VALOR TOTAL', xt + 16, yt + 9);
    doc.font(F.b).fontSize(11).fillColor('#ffffff').text(dinero(f.importe_total), xt + anchoTot - 112, yt + 7.5, { width: 94, align: 'right' });

    let yi = yBloque;
    if (pagos.length) {
        doc.font(F.b).fontSize(7.5).fillColor(AZUL_CLARO).text('FORMA DE PAGO', M, yi, { characterSpacing: 1 });
        yi = doc.y + 5;
        for (const p of pagos) {
            const plazo = p.plazo ? ` · ${Number(p.plazo)} ${limpio(p.unidadTiempo || '')}` : '';
            doc.font(F.n).fontSize(8).fillColor(TXT).text(`${FORMAS_PAGO[p.formaPago] || `Código ${p.formaPago}`}${plazo}`, M, yi, { width: izqW - 80 });
            doc.font(F.b).fontSize(8).text(dinero(p.total), M + izqW - 80, yi, { width: 80, align: 'right' });
            yi += 13;
        }
        yi += 9;
    }
    if (info.length) {
        doc.font(F.b).fontSize(7.5).fillColor(AZUL_CLARO).text('INFORMACIÓN ADICIONAL', M, yi, { characterSpacing: 1 });
        yi = doc.y + 5;
        for (const c of info) {
            doc.font(F.b).fontSize(7.8).fillColor(MUT).text(`${limpio(c.nombre)}: `, M, yi, { continued: true, width: izqW })
                .font(F.n).fillColor(TXT).text(limpio(c.valor));
            yi = doc.y + 3;
        }
    }
    y = Math.max(yBloque + altoTot, yi) + 16;

    // ── Ingreso al inventario (si la compra ya se registró) ──
    if (f.estado === 'registrada') {
        const filas = (f.detalles || []);
        const colsI = [{ t: '#', w: 24 }, { t: 'PRODUCTO INTERNO', w: 0 }, { t: 'INVENTARIO', w: 92 }, { t: 'INGRESÓ', w: 54 }, { t: 'COSTO UNIT.', w: 62 }, { t: 'STOCK', w: 78 }];
        colsI[1].w = W - colsI.reduce((s, c) => s + c.w, 0);
        const credito = f.forma_pago === 'credito';
        const resumen = `Compra #${f.compra_id} registrada por ${limpio(f.registrada_por_nombre) || '—'} el ${fechaHora(f.registrada_at)}`
            + ` · ${credito ? `crédito, vence ${fecha(f.fecha_vencimiento)}` : 'contado'} · saldo pendiente ${dinero(f.saldo)}`;
        let primera = true;
        const cabI = () => {
            doc.font(F.b).fontSize(8).fillColor(VERDE).text(primera ? 'INGRESO AL INVENTARIO' : 'INGRESO AL INVENTARIO (CONT.)', M, y, { characterSpacing: 1 });
            if (primera) doc.font(F.n).fontSize(7.4).fillColor(MUT).text(resumen, M, doc.y + 2, { width: W });
            primera = false;
            y = doc.y + 5;
            doc.roundedRect(M, y, W, 18, 5).fill('#e7f6ef');
            let xx = M;
            for (const c of colsI) { doc.font(F.b).fontSize(6.8).fillColor(VERDE).text(c.t, xx + 6, y + 6, { width: c.w - 12 }); xx += c.w; }
            y += 20;
        };
        saltar(60, null);
        cabI();
        for (const d of filas) {
            const producto = d.repuesto_id ? `${limpio(d.repuesto_codigo)} · ${limpio(d.repuesto_nombre)}` : 'No ingresa al inventario (servicio, flete u otro)';
            const alto = Math.max(doc.font(F.n).fontSize(8).heightOfString(producto, { width: colsI[1].w - 12 }), 10) + 10;
            saltar(alto, cabI);
            const vals = [String(d.linea), producto, d.area ? (AREA[d.area] || d.area) : '—', d.movimiento_id ? `+${cant(d.movimiento_cantidad)}` : '—',
                d.costo_unitario != null && d.repuesto_id ? dinero(d.costo_unitario) : '—', d.movimiento_id ? `${cant(d.stock_anterior)} → ${cant(d.stock_nuevo)}` : '—'];
            let xx = M;
            vals.forEach((v, k) => {
                doc.font(k === 1 && d.repuesto_id ? F.b : F.n).fontSize(8).fillColor(d.repuesto_id || k === 0 ? TXT : MUT).text(v, xx + 6, y + 5, { width: colsI[k].w - 12 });
                xx += colsI[k].w;
            });
            y += alto;
            doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor(BORDE).stroke();
        }
        y += 10;
    }

    // ── Marca de agua y pie en cada página ──
    const rango = doc.bufferedPageRange();
    const generado = fechaHora(new Date());
    for (let i = rango.start; i < rango.start + rango.count; i++) {
        doc.switchToPage(i);
        if (est.marca) {
            doc.save();
            doc.rotate(-32, { origin: [doc.page.width / 2, doc.page.height / 2] });
            doc.font(F.b).fontSize(70).fillColor(est.color).opacity(0.09)
                .text(est.marca, 0, doc.page.height / 2 - 40, { width: doc.page.width, align: 'center', lineBreak: false });
            doc.restore();
            doc.opacity(1);
        }
        const yPie = doc.page.height - M - 26;
        const margenOriginal = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.moveTo(M, yPie).lineTo(M + W, yPie).lineWidth(0.6).strokeColor(BORDE).stroke();
        const verif = f.verificado_sri_at ? `Verificado con el SRI el ${fechaHora(f.verificado_sri_at)}` : 'No verificado con el SRI';
        doc.font(F.n).fontSize(6.6).fillColor(MUT)
            .text(`Representación del comprobante electrónico recibido; no sustituye al RIDE del emisor. Origen de los datos: ${ORIGEN[f.origen_datos] || '—'}. ${verif}`,
                M, yPie + 6, { width: W - 130 });
        doc.text(`Página ${i - rango.start + 1} de ${rango.count}`, M + W - 125, yPie + 6, { width: 125, align: 'right' });
        doc.text(`Generado ${generado}`, M + W - 125, yPie + 15, { width: 125, align: 'right', lineBreak: false });
        doc.page.margins.bottom = margenOriginal;
    }
    doc.end();
    return fin;
}

module.exports = { generarFacturaCompraPdf };
