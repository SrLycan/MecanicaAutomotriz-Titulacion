/**
 * SS SWAP - Generacion de PDF de Proformas
 *
 * Se usa pdfkit (documento generado con control de coordenadas, no una
 * conversion de HTML) para evitar texto cortado, columnas desbordadas,
 * tablas partidas mal o encabezados aislados. Cada tabla se dibuja con
 * dibujarTabla(), que mide el espacio restante en la pagina ANTES de cada
 * fila y crea una pagina nueva (repitiendo el encabezado) si no alcanza.
 *
 * Sprint 20 (rediseño):
 *  - Fuente Unicode incrustada (DejaVu Sans, licencia libre en
 *    assets/fonts). Las fuentes estandar de pdfkit (Helvetica) solo
 *    codifican Latin-1: cualquier caracter fuera de ese juego (tildes
 *    "descompuestas" al copiar/pegar, comillas tipograficas, emojis...)
 *    salia como basura ilegible, p. ej. en los datos del vehiculo.
 *    Ademas todo texto pasa por limpiarTexto() (NFC + sin caracteres de
 *    control/ancho cero).
 *  - Encabezado con el nombre comercial "SS Swap - Sarango Sosa
 *    Intercambio Inteligente" y el logotipo original; numero de proforma
 *    destacado sin recuadros.
 *  - Tablas con el CODIGO DE REFERENCIA INTERNO del inventario (nunca el
 *    codigo del proveedor/fabricante).
 *  - Resumen economico con las reglas de reglasPago.js: anticipo requerido
 *    solo cuando aplica (70% en colisiones), total pagado real (pagos
 *    registrados en el pagare) y saldo pendiente.
 *  - Pie con "Pagina N de M" (dos pasadas: la primera solo cuenta paginas).
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { Writable } = require('stream');
const { construirDiagrama, etiquetaZona, CARROCERIAS } = require('../shared/vehiculoDiagramas');
const { porcentajeAnticipo, resumenDeuda } = require('./reglasPago');

// Nombre, RUC y logo salen de la empresa dueña de la proforma (marcaEmpresa.js).
const { marcaDe } = require('./marcaEmpresa');
const FUENTE_REGULAR = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FUENTE_NEGRITA = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');
const MARGIN = 40;
const COLOR_TXT = '#0f172a';
const COLOR_MUT = '#64748b';
const COLOR_AZUL = '#0b4f7c';      // azul corporativo (titulos y separadores)
const COLOR_AZUL_MEDIO = '#0284c7';
const COLOR_BORDE = '#cbd5e1';
const COLOR_HEAD_BG = '#e8f1f8';
const COLOR_PANEL = '#f8fafc';

// Si las fuentes Unicode no estan (instalacion incompleta) se cae a las
// estandar para no romper la descarga.
const FUENTES_UNICODE = fs.existsSync(FUENTE_REGULAR) && fs.existsSync(FUENTE_NEGRITA);
const F = { normal: FUENTES_UNICODE ? 'SS-Regular' : 'Helvetica', negrita: FUENTES_UNICODE ? 'SS-Bold' : 'Helvetica-Bold' };

const money = (v) => `$${Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fecha = (v) => {
    if (!v) return '—';
    const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return new Date(v).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
};
/** Normaliza texto para el PDF: NFC, sin caracteres de control ni de ancho cero. */
function limpiarTexto(v) {
    if (v === null || v === undefined) return '';
    return String(v).normalize('NFC')
        .replace(/[​-‍⁠﻿]/g, '')
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
        .replace(/[ \t]+/g, ' ')
        .trim();
}
const cant = (n) => (Number(n) % 1 === 0 ? String(Number(n)) : Number(n).toFixed(2));

/**
 * Asegura espacio en la pagina actual; si no alcanza, dibuja el pie de la
 * pagina que se abandona (doc.__piePagina) y recien ahi crea la siguiente.
 * (Dibujar el pie al abandonar cada pagina evita depender de
 * bufferedPageRange/switchToPage, que resultaron poco fiables aqui.)
 */
function asegurarEspacio(doc, alturaNecesaria, onNuevaPagina) {
    const limite = doc.page.height - doc.page.margins.bottom;
    if (doc.y + alturaNecesaria > limite) {
        if (doc.__piePagina) doc.__piePagina();
        doc.addPage();
        if (doc.__encabezadoContinuacion) doc.__encabezadoContinuacion();
        if (onNuevaPagina) onNuevaPagina();
    }
}

/** Alto real de un texto con el ancho dado (para filas de altura variable). */
function altoTexto(doc, texto, ancho, fuente, tam) {
    doc.font(fuente).fontSize(tam);
    return doc.heightOfString(texto || ' ', { width: ancho });
}

/** Tabla con encabezado repetido al cambiar de pagina y filas de alto variable. */
function dibujarTabla(doc, { columnas, filas, tituloSeccion, filaTotal }) {
    const anchoTotal = columnas.reduce((s, c) => s + c.ancho, 0);
    const x0 = doc.page.margins.left;

    const dibujarEncabezadoSeccion = () => {
        if (tituloSeccion) {
            const y = doc.y;
            doc.rect(x0, y, anchoTotal, 18).fill(COLOR_AZUL);
            doc.font(F.negrita).fontSize(8.5).fillColor('#fff').text(tituloSeccion, x0 + 8, y + 5, { width: anchoTotal - 16, lineBreak: false });
            doc.y = y + 18;
        }
        const y = doc.y;
        doc.rect(x0, y, anchoTotal, 16).fill(COLOR_HEAD_BG);
        let x = x0;
        doc.font(F.negrita).fontSize(7).fillColor(COLOR_AZUL);
        columnas.forEach(c => {
            doc.text(c.titulo, x + 5, y + 5, { width: c.ancho - 10, align: c.align || 'left', lineBreak: false });
            x += c.ancho;
        });
        doc.y = y + 16;
    };

    // Titulo + encabezado + al menos una fila: evita un titulo "huerfano".
    asegurarEspacio(doc, 60, null);
    dibujarEncabezadoSeccion();

    filas.forEach((fila, i) => {
        // La descripcion puede ocupar varias lineas: se mide antes de dibujar.
        const altos = columnas.map(c => altoTexto(doc, limpiarTexto(fila[c.campo]), c.ancho - 10, F.normal, 8));
        const altoFila = Math.max(16, Math.max(...altos) + 8);
        asegurarEspacio(doc, altoFila + 2, dibujarEncabezadoSeccion);
        const y = doc.y;
        if (i % 2 === 1) doc.rect(x0, y, anchoTotal, altoFila).fill(COLOR_PANEL);
        let x = x0;
        columnas.forEach(c => {
            doc.font(c.negrita ? F.negrita : F.normal).fontSize(8).fillColor(c.color || COLOR_TXT)
                .text(limpiarTexto(fila[c.campo]), x + 5, y + 4, { width: c.ancho - 10, align: c.align || 'left' });
            x += c.ancho;
        });
        doc.y = y + altoFila;
    });

    doc.moveTo(x0, doc.y).lineTo(x0 + anchoTotal, doc.y).strokeColor(COLOR_BORDE).lineWidth(0.5).stroke();

    if (filaTotal) {
        asegurarEspacio(doc, 20, dibujarEncabezadoSeccion);
        const y = doc.y;
        doc.font(F.negrita).fontSize(8.5).fillColor(COLOR_TXT);
        doc.text(filaTotal.etiqueta, x0 + 8, y + 5, { width: anchoTotal - 130, lineBreak: false });
        doc.text(filaTotal.valor, x0 + anchoTotal - 120, y + 5, { width: 114, align: 'right', lineBreak: false });
        doc.y = y + 20;
    }
    doc.moveDown(0.7);
}

/** Encabezado de la primera pagina: logo + nombre comercial + numero de proforma. */
function dibujarEncabezado(doc, proforma) {
    const anchoUtil = doc.page.width - MARGIN * 2;
    const yInicio = MARGIN;
    const marca = marcaDe(proforma);
    let logoAncho = 0;
    if (marca.logo) {
        try { doc.image(marca.logo, MARGIN, yInicio, { fit: [78, 56] }); logoAncho = 90; } catch { /* logo opcional */ }
    }

    const bloqueDerAncho = 170;
    const empresaX = MARGIN + logoAncho;
    const empresaAncho = anchoUtil - logoAncho - bloqueDerAncho - 12;

    doc.font(F.negrita).fontSize(13).fillColor(COLOR_AZUL)
        .text(limpiarTexto(marca.nombre), empresaX, yInicio + 2, { width: empresaAncho });
    let y = doc.y + 3;
    doc.font(F.normal).fontSize(7.8).fillColor(COLOR_MUT);
    if (marca.razonSocial && marca.razonSocial !== marca.nombre) { doc.text(limpiarTexto(marca.razonSocial), empresaX, y, { width: empresaAncho }); y = doc.y + 1; }
    if (marca.ruc) { doc.text(`RUC: ${limpiarTexto(marca.ruc)}`, empresaX, y, { width: empresaAncho }); y = doc.y + 1; }
    const sucursal = limpiarTexto(proforma.sucursal_nombre);
    if (sucursal) { doc.text(`Sucursal: ${sucursal}`, empresaX, y, { width: empresaAncho }); y = doc.y + 1; }
    // Direccion y contacto: los de la sucursal; si no tiene, los de la empresa.
    const direccion = proforma.sucursal_direccion || marca.direccion;
    if (direccion) { doc.text(limpiarTexto(direccion), empresaX, y, { width: empresaAncho }); y = doc.y + 1; }
    const contacto = [proforma.sucursal_telefono || marca.telefono, proforma.sucursal_email || marca.email].map(limpiarTexto).filter(Boolean).join('   ·   ');
    if (contacto) { doc.text(contacto, empresaX, y, { width: empresaAncho }); y = doc.y; }
    const yFinEmpresa = doc.y;

    // Bloque derecho: tipo de documento, numero y fechas (sin recuadros).
    const bx = MARGIN + anchoUtil - bloqueDerAncho;
    doc.font(F.negrita).fontSize(7.5).fillColor(COLOR_MUT).text('PROFORMA N.º', bx, yInicio + 2, { width: bloqueDerAncho, align: 'right' });
    doc.font(F.negrita).fontSize(15).fillColor(COLOR_AZUL).text(limpiarTexto(proforma.numero), bx, doc.y + 1, { width: bloqueDerAncho, align: 'right' });
    doc.font(F.normal).fontSize(8).fillColor(COLOR_TXT);
    doc.text(`Fecha de emisión: ${fecha(proforma.fecha_emision)}`, bx, doc.y + 4, { width: bloqueDerAncho, align: 'right' });
    if (proforma.fecha_validez) doc.text(`Válida hasta: ${fecha(proforma.fecha_validez)}`, bx, doc.y + 1, { width: bloqueDerAncho, align: 'right' });
    const ordenRef = proforma.orden_generada_id || proforma.orden_id;
    if (ordenRef) doc.text(`Orden de trabajo: OT-${String(ordenRef).padStart(6, '0')}`, bx, doc.y + 1, { width: bloqueDerAncho, align: 'right' });
    const yFinDer = doc.y;

    doc.y = Math.max(yInicio + 58, yFinEmpresa, yFinDer) + 10;
    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + anchoUtil, doc.y).strokeColor(COLOR_AZUL).lineWidth(1.6).stroke();
    doc.y += 10;

    // Titulo del tipo de trabajo
    doc.font(F.negrita).fontSize(10.5).fillColor(COLOR_TXT)
        .text(proforma.tipo === 'pintura' ? 'PROFORMA — COLISIONES / PINTURA Y CARROCERÍA' : 'PROFORMA — MECÁNICA GENERAL', MARGIN, doc.y, { width: anchoUtil });
    doc.moveDown(0.6);
}

/** Encabezado reducido de las paginas siguientes. */
function dibujarEncabezadoContinuacion(doc, proforma) {
    const anchoUtil = doc.page.width - MARGIN * 2;
    const y = MARGIN - 6;
    doc.font(F.negrita).fontSize(8).fillColor(COLOR_AZUL).text(limpiarTexto(marcaDe(proforma).nombre), MARGIN, y, { width: anchoUtil / 2, lineBreak: false });
    doc.font(F.normal).fontSize(8).fillColor(COLOR_MUT).text(`${limpiarTexto(proforma.numero)} (continuación)`, MARGIN + anchoUtil / 2, y, { width: anchoUtil / 2, align: 'right', lineBreak: false });
    doc.moveTo(MARGIN, y + 13).lineTo(MARGIN + anchoUtil, y + 13).strokeColor(COLOR_BORDE).lineWidth(0.6).stroke();
    doc.y = y + 22;
}

/** Panel con titulo y filas "Etiqueta: valor". Devuelve la altura usada. */
function dibujarPanelDatos(doc, { x, y, ancho, titulo, filas, dibujar = true, altoFijo = null }) {
    const etiquetaAncho = 62;
    let alto = 22;
    const medidas = filas.map(([, v]) => altoTexto(doc, v, ancho - etiquetaAncho - 20, F.normal, 8.3));
    alto += medidas.reduce((s, h) => s + h + 3, 0) + 6;
    if (!dibujar) return alto;
    if (altoFijo) alto = altoFijo;
    doc.roundedRect(x, y, ancho, alto, 4).fillAndStroke(COLOR_PANEL, COLOR_BORDE);
    doc.font(F.negrita).fontSize(8).fillColor(COLOR_AZUL).text(titulo, x + 10, y + 7, { width: ancho - 20, lineBreak: false });
    let yy = y + 22;
    filas.forEach(([k, v], i) => {
        doc.font(F.negrita).fontSize(7.6).fillColor(COLOR_MUT).text(k, x + 10, yy + 0.5, { width: etiquetaAncho, lineBreak: false });
        doc.font(F.normal).fontSize(8.3).fillColor(COLOR_TXT).text(v, x + 10 + etiquetaAncho, yy, { width: ancho - etiquetaAncho - 20 });
        yy += medidas[i] + 3;
    });
    return alto;
}

function dibujarBloqueClienteVehiculo(doc, proforma) {
    const anchoUtil = doc.page.width - MARGIN * 2;
    const colAncho = (anchoUtil - 12) / 2;
    const L = limpiarTexto;

    // Solo se muestran los datos que existen (no se inventa informacion).
    const filasCliente = [
        ['Nombre', L(proforma.cliente_nombre) || '—'],
        ['RUC / C.I.', L(proforma.cliente_ruc)],
        ['Teléfono', L(proforma.cliente_telefono)],
        ['Correo', L(proforma.cliente_email)],
        ['Dirección', L(proforma.cliente_direccion)],
    ].filter(([k, v]) => k === 'Nombre' || v);
    const filasVehiculo = [
        ['Marca', L(proforma.vehiculo_marca) || '—'],
        ['Modelo', L(proforma.vehiculo_modelo)],
        ['Tipo', L(proforma.vehiculo_tipo)],
        ['Color', L(proforma.vehiculo_color)],
        ['Año', proforma.vehiculo_anio ? String(proforma.vehiculo_anio) : ''],
        ['Placa', L(proforma.vehiculo_placa)],
        ['VIN', L(proforma.vehiculo_vin)],
    ].filter(([k, v]) => k === 'Marca' || v);

    const alto = Math.max(
        dibujarPanelDatos(doc, { ancho: colAncho, titulo: 'CLIENTE', filas: filasCliente, dibujar: false }),
        dibujarPanelDatos(doc, { ancho: colAncho, titulo: 'VEHÍCULO', filas: filasVehiculo, dibujar: false })
    );
    asegurarEspacio(doc, alto + 10, null);
    const y = doc.y;
    // Ambos paneles con la misma altura para que queden alineados.
    dibujarPanelDatos(doc, { x: MARGIN, y, ancho: colAncho, titulo: 'CLIENTE', filas: filasCliente, altoFijo: alto });
    dibujarPanelDatos(doc, { x: MARGIN + colAncho + 12, y, ancho: colAncho, titulo: 'VEHÍCULO', filas: filasVehiculo, altoFijo: alto });
    doc.y = y + alto + 14;
}

// Colores del pictograma en el PDF (misma paleta que el SVG del frontend).
const COLOR_DECOR = {
    carroceria: '#e2e8f0', 'carroceria-oscura': '#94a3b8', vidrio: '#bae6fd',
    rueda: '#1e293b', llanta: '#94a3b8', faro: '#fde68a', parrilla: '#475569', stop: '#f87171',
};
const COLOR_ZONA = '#f8fafc';
const COLOR_ZONA_DANADA = '#ef4444';

/**
 * Pictograma vectorial de daños (Colisiones / Pintura). Usa los mismos
 * paths SVG que el frontend (shared/vehiculoDiagramas). Las zonas dañadas
 * van en rojo a proposito: es la leyenda del diagrama, no un resaltado.
 */
function dibujarPictograma(doc, proforma) {
    if (proforma.tipo !== 'pintura' || !proforma.carroceria_tipo) return;
    const diagrama = construirDiagrama(proforma.carroceria_tipo, proforma.carroceria_puertas);
    if (!diagrama) return;
    const zonas = proforma.zonas_danadas || [];
    const seleccion = new Set(zonas);
    const anchoUtil = doc.page.width - MARGIN * 2;
    const escala = anchoUtil / diagrama.ancho;
    const altoDiagrama = diagrama.alto * escala;

    asegurarEspacio(doc, 18 + altoDiagrama + 10, null);
    const x0 = MARGIN;
    let y = doc.y;
    const etiquetaVeh = `${CARROCERIAS[proforma.carroceria_tipo].etiqueta}${proforma.carroceria_tipo === 'hatchback' || proforma.carroceria_tipo === 'pickup' ? ` · ${diagrama.puertas} puertas` : ''}`;
    doc.rect(x0, y, anchoUtil, 18).fill(COLOR_AZUL);
    doc.font(F.negrita).fontSize(8.5).fillColor('#fff')
        .text(`DAÑOS REPORTADOS — TIPO DE VEHÍCULO: ${etiquetaVeh.toUpperCase()}`, x0 + 8, y + 5, { width: anchoUtil - 16, lineBreak: false });
    y += 22;

    doc.save();
    doc.translate(x0, y);
    doc.scale(escala);
    const trazo = 0.9 / escala * 0.6;
    diagrama.decor.filter(d => !d.sobre).forEach(d => {
        doc.path(d.d).lineWidth(trazo).fillColor(COLOR_DECOR[d.clase] || '#e2e8f0').strokeColor('#64748b').fillAndStroke();
    });
    diagrama.zonas.forEach(z => {
        const danada = seleccion.has(z.codigo);
        doc.path(z.d).lineWidth(trazo * (danada ? 1.6 : 1)).fillColor(danada ? COLOR_ZONA_DANADA : COLOR_ZONA)
            .strokeColor(danada ? '#991b1b' : '#475569').fillAndStroke();
    });
    diagrama.decor.filter(d => d.sobre).forEach(d => {
        doc.path(d.d).lineWidth(trazo).fillColor(COLOR_DECOR[d.clase] || '#334155').strokeColor('#334155').fillAndStroke();
    });
    doc.font(F.negrita).fontSize(11).fillColor(COLOR_MUT);
    diagrama.textos.forEach(t => {
        const ancho = 220;
        const tx = t.anchor === 'middle' ? t.x - ancho / 2 : t.anchor === 'end' ? t.x - ancho : t.x;
        doc.text(t.texto, tx, t.y - 10, { width: ancho, align: t.anchor === 'middle' ? 'center' : t.anchor === 'end' ? 'right' : 'left', lineBreak: false });
    });
    doc.restore();
    doc.y = y + altoDiagrama + 6;

    asegurarEspacio(doc, 30, null);
    doc.rect(x0, doc.y + 2, 8, 8).fill(COLOR_ZONA_DANADA);
    doc.font(F.negrita).fontSize(8.5).fillColor(COLOR_TXT)
        .text(`Zonas afectadas (${zonas.length})`, x0 + 13, doc.y + 1, { width: anchoUtil - 13 });
    doc.moveDown(0.3);
    if (!zonas.length) {
        doc.font(F.normal).fontSize(8).fillColor(COLOR_MUT).text('No se marcaron zonas en el pictograma.', x0, doc.y, { width: anchoUtil });
    } else {
        const etiquetas = zonas.map(etiquetaZona);
        const mitad = Math.ceil(etiquetas.length / 2);
        const colAncho = anchoUtil / 2 - 8;
        for (let i = 0; i < mitad; i++) {
            asegurarEspacio(doc, 13, null);
            const yFila = doc.y;
            doc.font(F.normal).fontSize(8).fillColor(COLOR_TXT);
            doc.text(`•  ${etiquetas[i]}`, x0 + 4, yFila, { width: colAncho, lineBreak: false, ellipsis: true });
            if (etiquetas[i + mitad]) doc.text(`•  ${etiquetas[i + mitad]}`, x0 + anchoUtil / 2 + 4, yFila, { width: colAncho, lineBreak: false, ellipsis: true });
            doc.y = yFila + 12;
        }
    }
    if (proforma.danos_observaciones) {
        doc.moveDown(0.3);
        asegurarEspacio(doc, 30, null);
        doc.font(F.negrita).fontSize(8).fillColor(COLOR_TXT).text('Observaciones de los daños:', x0, doc.y);
        doc.font(F.normal).fontSize(8).fillColor(COLOR_MUT).text(limpiarTexto(proforma.danos_observaciones), x0, doc.y + 2, { width: anchoUtil });
    }
    doc.moveDown(0.8);
}

/** Resumen economico (totales) + condiciones de pago a la izquierda. */
function dibujarResumenTotales(doc, proforma) {
    const anchoUtil = doc.page.width - MARGIN * 2;
    const cajaAncho = 250;
    const x0 = MARGIN + anchoUtil - cajaAncho;

    const lineas = [];
    if (proforma.tipo === 'mecanica') {
        if (Number(proforma.subtotal_productos)) lineas.push(['Productos / repuestos', proforma.subtotal_productos]);
        if (Number(proforma.subtotal_servicios)) lineas.push(['Servicios / mano de obra', proforma.subtotal_servicios]);
    } else {
        if (Number(proforma.subtotal_mano_obra)) lineas.push(['Mano de obra / enderezado', proforma.subtotal_mano_obra]);
        if (Number(proforma.subtotal_pintura)) lineas.push(['Pintura', proforma.subtotal_pintura]);
        if (Number(proforma.subtotal_repuestos)) lineas.push(['Repuestos', proforma.subtotal_repuestos]);
        if (Number(proforma.subtotal_insumos)) lineas.push(['Insumos', proforma.subtotal_insumos]);
    }
    lineas.push(['Subtotal', proforma.subtotal, true]);
    if (Number(proforma.descuento)) lineas.push(['Descuento', -Number(proforma.descuento)]);
    if (Number(proforma.iva_porcentaje) || Number(proforma.iva_valor)) lineas.push([`IVA (${Number(proforma.iva_porcentaje)}%)`, proforma.iva_valor]);

    // Condiciones de pago con valores reales (reglasPago): el anticipo es
    // REQUERIDO; lo "pagado" son solo los pagos registrados en el pagare.
    const pct = porcentajeAnticipo(proforma.tipo);
    const deuda = resumenDeuda({
        montoTotal: proforma.total,
        montoPagado: proforma.pagare ? proforma.pagare.monto_pagado : 0,
        anticipoRequerido: proforma.anticipo,
    });
    const pagos = [];
    if (deuda.anticipo_requerido > 0) {
        pagos.push([pct ? `Anticipo requerido (${pct}%)` : 'Anticipo requerido', deuda.anticipo_requerido]);
        pagos.push([pct ? `Saldo restante (${100 - pct}%)` : 'Saldo después del anticipo', deuda.saldo_despues_anticipo]);
    }
    pagos.push(['Total pagado', deuda.pagado]);
    pagos.push(['Saldo pendiente de pago', deuda.saldo, true]);

    const altoTotales = 12 + lineas.length * 15 + 28;
    const altoPagos = 26 + pagos.length * 15 + 8;
    asegurarEspacio(doc, altoTotales + altoPagos + 20, null);
    const y0 = doc.y;

    // Caja de totales
    doc.roundedRect(x0, y0, cajaAncho, altoTotales, 4).fillAndStroke(COLOR_PANEL, COLOR_BORDE);
    let y = y0 + 9;
    lineas.forEach(([label, val, fuerte]) => {
        doc.font(fuerte ? F.negrita : F.normal).fontSize(8.5).fillColor(COLOR_TXT);
        doc.text(label, x0 + 12, y, { width: cajaAncho - 120, lineBreak: false });
        doc.text(money(val), x0 + 12, y, { width: cajaAncho - 24, align: 'right', lineBreak: false });
        y += 15;
    });
    doc.rect(x0, y + 1, cajaAncho, 24).fill(COLOR_AZUL);
    doc.font(F.negrita).fontSize(10.5).fillColor('#fff');
    doc.text('TOTAL', x0 + 12, y + 7, { width: cajaAncho - 120, lineBreak: false });
    doc.text(money(proforma.total), x0 + 12, y + 7, { width: cajaAncho - 24, align: 'right', lineBreak: false });

    // Caja de condiciones de pago
    const yp = y0 + altoTotales + 8;
    doc.roundedRect(x0, yp, cajaAncho, altoPagos, 4).fillAndStroke('#ffffff', COLOR_BORDE);
    doc.font(F.negrita).fontSize(7.8).fillColor(COLOR_AZUL)
        .text(pct ? 'CONDICIONES DE PAGO — COLISIONES' : 'CONDICIONES DE PAGO — MECÁNICA GENERAL', x0 + 12, yp + 8, { width: cajaAncho - 24, lineBreak: false });
    let yy = yp + 24;
    pagos.forEach(([label, val, fuerte]) => {
        doc.font(fuerte ? F.negrita : F.normal).fontSize(8.5).fillColor(COLOR_TXT);
        doc.text(label, x0 + 12, yy, { width: cajaAncho - 120, lineBreak: false });
        doc.text(money(val), x0 + 12, yy, { width: cajaAncho - 24, align: 'right', lineBreak: false });
        yy += 15;
    });

    // Nota aclaratoria a la izquierda de las cajas
    const notaAncho = anchoUtil - cajaAncho - 18;
    const nota = pct
        ? `Trabajo de colisiones: se requiere un anticipo del ${pct}% (${money(deuda.anticipo_requerido)}) para iniciar y el ${100 - pct}% restante (${money(deuda.saldo_despues_anticipo)}) a la entrega. El anticipo figura como pagado únicamente cuando se registra el pago.`
        : (deuda.anticipo_requerido > 0
            ? `Mecánica general: anticipo acordado de ${money(deuda.anticipo_requerido)}. El valor pagado corresponde solo a pagos registrados.`
            : 'Mecánica general: no se exige anticipo para iniciar el trabajo. El valor pagado corresponde solo a pagos registrados.');
    doc.font(F.normal).fontSize(7.8).fillColor(COLOR_MUT).text(nota, MARGIN, y0 + 4, { width: notaAncho });

    doc.y = Math.max(yp + altoPagos, doc.y) + 14;
}

function dibujarNotasYFirma(doc, proforma) {
    const anchoUtil = doc.page.width - MARGIN * 2;
    const bloques = [];
    if (proforma.tipo === 'pintura' && proforma.garantia) bloques.push(['Garantía', proforma.garantia]);
    if (proforma.tipo === 'pintura' && proforma.tiempo_estimado) bloques.push(['Tiempo estimado de trabajo', proforma.tiempo_estimado]);
    if (proforma.observaciones) bloques.push(['Observaciones', proforma.observaciones]);
    if (proforma.condiciones) bloques.push(['Forma de pago / condiciones', proforma.condiciones]);

    bloques.forEach(([titulo, texto]) => {
        const t = limpiarTexto(texto);
        asegurarEspacio(doc, altoTexto(doc, t, anchoUtil, F.normal, 8) + 20, null);
        doc.font(F.negrita).fontSize(8).fillColor(COLOR_TXT).text(`${titulo}:`, MARGIN, doc.y, { width: anchoUtil });
        doc.font(F.normal).fontSize(8).fillColor(COLOR_MUT).text(t, MARGIN, doc.y + 1, { width: anchoUtil });
        doc.moveDown(0.5);
    });

    asegurarEspacio(doc, 70, null);
    doc.moveDown(2);
    const yFirma = doc.y;
    const mitad = anchoUtil / 2 - 30;
    doc.strokeColor(COLOR_TXT).lineWidth(0.6);
    doc.moveTo(MARGIN, yFirma).lineTo(MARGIN + mitad, yFirma).stroke();
    doc.moveTo(MARGIN + anchoUtil - mitad, yFirma).lineTo(MARGIN + anchoUtil, yFirma).stroke();
    doc.font(F.normal).fontSize(7.8).fillColor(COLOR_MUT);
    doc.text(`Elaborado por: ${limpiarTexto(proforma.usuario_nombre)}`, MARGIN, yFirma + 4, { width: mitad, align: 'center' });
    doc.text('Firma y aceptación del cliente', MARGIN + anchoUtil - mitad, yFirma + 4, { width: mitad, align: 'center' });
    doc.y = yFirma + 20;
}

/** Dibuja el documento completo sobre `stream`. Devuelve el total de paginas. */
function renderizar(proforma, stream, totalPaginas) {
    const doc = new PDFDocument({
        size: 'A4', margin: MARGIN, bufferPages: false,
        info: { Title: `${proforma.numero} - ${marcaDe(proforma).nombre}`, Author: marcaDe(proforma).nombre, Subject: 'Proforma' },
    });
    if (FUENTES_UNICODE) {
        doc.registerFont(F.normal, FUENTE_REGULAR);
        doc.registerFont(F.negrita, FUENTE_NEGRITA);
    }
    doc.pipe(stream);

    let numeroPagina = 1;
    doc.__piePagina = () => {
        const y = doc.page.height - 28;
        const anchoUtil = doc.page.width - MARGIN * 2;
        // El pie va debajo de margins.bottom: se anula el margen solo para
        // este texto (si no, pdfkit crea una pagina nueva el solo).
        const margenOriginal = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.moveTo(MARGIN, y - 6).lineTo(MARGIN + anchoUtil, y - 6).strokeColor(COLOR_BORDE).lineWidth(0.5).stroke();
        doc.font(F.normal).fontSize(7).fillColor(COLOR_MUT);
        doc.text(`${limpiarTexto(marcaDe(proforma).nombre)}  ·  ${limpiarTexto(proforma.numero)}`, MARGIN, y, { width: anchoUtil * 0.7, lineBreak: false });
        doc.text(totalPaginas ? `Página ${numeroPagina} de ${totalPaginas}` : `Página ${numeroPagina}`, MARGIN + anchoUtil * 0.7, y, { width: anchoUtil * 0.3, align: 'right', lineBreak: false });
        doc.page.margins.bottom = margenOriginal;
        numeroPagina++;
    };
    doc.__encabezadoContinuacion = () => dibujarEncabezadoContinuacion(doc, proforma);

    dibujarEncabezado(doc, proforma);
    dibujarBloqueClienteVehiculo(doc, proforma);
    dibujarPictograma(doc, proforma);

    const itemsPorCategoria = (cat) => (proforma.items || []).filter(i => i.categoria === cat);
    // Solo el codigo de referencia INTERNO del inventario (nunca el del proveedor).
    const codigoInterno = (it) => (it.referencia_tipo === 'repuesto' && it.repuesto_codigo ? it.repuesto_codigo : '—');
    const filasDe = (items) => items.map((it, i) => ({
        item: i + 1, codigo: codigoInterno(it), descripcion: it.descripcion, cantidad: cant(it.cantidad),
        precio: money(it.precio_unitario), subtotal: money(it.subtotal),
    }));

    // Ancho util A4 = 515pt
    const colDetalle = [
        { titulo: '#', campo: 'item', ancho: 24, align: 'center' },
        { titulo: 'CÓDIGO', campo: 'codigo', ancho: 72 },
        { titulo: 'DESCRIPCIÓN', campo: 'descripcion', ancho: 211 },
        { titulo: 'CANT.', campo: 'cantidad', ancho: 44, align: 'center' },
        { titulo: 'P. UNITARIO', campo: 'precio', ancho: 78, align: 'right' },
        { titulo: 'SUBTOTAL', campo: 'subtotal', ancho: 86, align: 'right', negrita: true },
    ];
    const colSimple = [
        { titulo: '#', campo: 'item', ancho: 24, align: 'center' },
        { titulo: 'DESCRIPCIÓN', campo: 'descripcion', ancho: 405 },
        { titulo: 'VALOR', campo: 'precio', ancho: 86, align: 'right', negrita: true },
    ];

    if (proforma.tipo === 'mecanica') {
        const productos = itemsPorCategoria('producto');
        if (productos.length) dibujarTabla(doc, { tituloSeccion: 'PRODUCTOS / REPUESTOS', columnas: colDetalle, filas: filasDe(productos), filaTotal: { etiqueta: 'Total productos', valor: money(proforma.subtotal_productos) } });
        const servicios = itemsPorCategoria('servicio');
        if (servicios.length) dibujarTabla(doc, { tituloSeccion: 'SERVICIOS / MANO DE OBRA', columnas: colDetalle, filas: filasDe(servicios), filaTotal: { etiqueta: 'Total servicios', valor: money(proforma.subtotal_servicios) } });
    } else {
        const secciones = [
            ['mano_obra', 'MANO DE OBRA / ENDEREZADO', proforma.subtotal_mano_obra],
            ['pintura', 'PINTURA', proforma.subtotal_pintura],
            ['repuesto', 'REPUESTOS', proforma.subtotal_repuestos],
            ['insumo', 'INSUMOS', proforma.subtotal_insumos],
        ];
        secciones.forEach(([cat, titulo, tot]) => {
            const items = itemsPorCategoria(cat);
            if (!items.length) return;
            const detalle = cat === 'repuesto' || cat === 'insumo';
            dibujarTabla(doc, {
                tituloSeccion: titulo,
                columnas: detalle ? colDetalle : colSimple,
                filas: detalle ? filasDe(items) : items.map((it, i) => ({ item: i + 1, descripcion: it.descripcion, precio: money(it.subtotal) })),
                filaTotal: { etiqueta: `Total ${titulo.split(' / ')[0].toLowerCase()}`, valor: money(tot) },
            });
        });
    }

    dibujarResumenTotales(doc, proforma);
    dibujarNotasYFirma(doc, proforma);

    // La ultima pagina no pasa por asegurarEspacio->addPage: su pie va aqui.
    doc.__piePagina();
    doc.end();
    return numeroPagina - 1;
}

/** Stream que descarta todo (primera pasada: solo cuenta paginas). */
const streamNulo = () => new Writable({ write(_c, _e, cb) { cb(); } });

/** Genera el PDF y lo escribe en `res` (stream). `proforma` debe incluir `items`. */
function generarProformaPdf(proforma, res) {
    const totalPaginas = renderizar(proforma, streamNulo(), null);
    renderizar(proforma, res, totalPaginas);
}

module.exports = { generarProformaPdf, limpiarTexto };
