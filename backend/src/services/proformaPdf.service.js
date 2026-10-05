/**
 * SS SWAP - Generacion de PDF de Proformas
 *
 * Se usa pdfkit (documento generado con control de coordenadas, no una
 * conversion de HTML) precisamente para evitar los problemas que pidio
 * evitar el usuario: texto cortado, columnas desbordadas, tablas partidas
 * mal, encabezados aislados. Cada tabla se dibuja con dibujarTabla(), que
 * mide el espacio restante en la pagina ANTES de dibujar cada fila y crea
 * una pagina nueva (repitiendo el encabezado de la tabla) si no alcanza.
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { construirDiagrama, etiquetaZona, CARROCERIAS } = require('../shared/vehiculoDiagramas');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');
const MARGIN = 40;
const COLOR_TXT = '#0f172a';
const COLOR_MUT = '#64748b';
const COLOR_SKY = '#0284c7';
const COLOR_BORDE = '#cbd5e1';
const COLOR_HEAD_BG = '#e0f2fe';

const money = (v) => `$${Number(v || 0).toFixed(2)}`;
const fecha = (v) => v ? new Date(v).toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }) : '—';

/**
 * Asegura espacio en la pagina actual; si no alcanza, dibuja el pie de
 * pagina de la pagina que se esta abandonando (usando doc.__piePagina,
 * fijado por generarProformaPdf) y recien ahi crea la siguiente.
 *
 * NOTA TECNICA: se dibuja el pie ANTES de pasar de pagina, en vez del
 * patron habitual de pdfkit (bufferPages + bufferedPageRange +
 * switchToPage al final para volver atras). Ese patron se probo primero
 * pero en este entorno el conteo de bufferedPageRange() quedaba
 * desincronizado del total real de paginas del archivo final (se
 * verifico generando PDFs de mas de una pagina y confirmando con
 * PyMuPDF que el pie aparecia en las paginas equivocadas). Dibujar el
 * pie al momento de abandonar cada pagina es inmune a ese problema
 * porque nunca necesita "volver" a una pagina ya cerrada.
 */
function asegurarEspacio(doc, alturaNecesaria, onNuevaPagina) {
    const limite = doc.page.height - doc.page.margins.bottom;
    if (doc.y + alturaNecesaria > limite) {
        if (doc.__piePagina) doc.__piePagina();
        doc.addPage();
        if (onNuevaPagina) onNuevaPagina();
    }
}

/** Dibuja una tabla con encabezado repetido automaticamente al cambiar de pagina. */
function dibujarTabla(doc, { columnas, filas, tituloSeccion, filaTotal }) {
    const anchoTotal = columnas.reduce((s, c) => s + c.ancho, 0);
    const x0 = doc.page.margins.left;

    const dibujarEncabezadoSeccion = () => {
        if (tituloSeccion) {
            doc.font('Helvetica-Bold').fontSize(10).fillColor('#fff');
            const y = doc.y;
            doc.rect(x0, y, anchoTotal, 18).fill(COLOR_SKY);
            doc.fillColor('#fff').text(tituloSeccion, x0 + 6, y + 4, { width: anchoTotal - 12 });
            doc.y = y + 18;
        }
        const y = doc.y;
        doc.rect(x0, y, anchoTotal, 16).fill(COLOR_HEAD_BG);
        let x = x0;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR_SKY);
        columnas.forEach(c => {
            doc.text(c.titulo, x + 4, y + 4, { width: c.ancho - 8, align: c.align || 'left' });
            x += c.ancho;
        });
        doc.y = y + 16;
    };

    // Titulo (18) + encabezado (16) + al menos una fila (16): evita dejar un
    // titulo de seccion "huerfano" al pie de la pagina.
    asegurarEspacio(doc, 56, null);
    dibujarEncabezadoSeccion();

    doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_TXT);
    filas.forEach((fila, i) => {
        asegurarEspacio(doc, 18, dibujarEncabezadoSeccion);
        const y = doc.y;
        if (i % 2 === 1) doc.rect(x0, y, anchoTotal, 16).fill('#f8fafc');
        doc.fillColor(COLOR_TXT);
        let x = x0;
        columnas.forEach(c => {
            const val = fila[c.campo] !== undefined && fila[c.campo] !== null ? String(fila[c.campo]) : '';
            doc.text(val, x + 4, y + 4, { width: c.ancho - 8, align: c.align || 'left', ellipsis: true });
            x += c.ancho;
        });
        doc.y = y + 16;
    });

    // Linea inferior de la tabla
    doc.moveTo(x0, doc.y).lineTo(x0 + anchoTotal, doc.y).strokeColor(COLOR_BORDE).lineWidth(0.5).stroke();

    if (filaTotal) {
        asegurarEspacio(doc, 20, dibujarEncabezadoSeccion);
        const y = doc.y;
        doc.rect(x0, y, anchoTotal, 18).fill('#f1f5f9');
        doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TXT);
        doc.text(filaTotal.etiqueta, x0 + 6, y + 4, { width: anchoTotal - 100 - 12 });
        doc.text(filaTotal.valor, x0 + anchoTotal - 100, y + 4, { width: 94, align: 'right' });
        doc.y = y + 18;
    }
    doc.moveDown(0.6);
}

function dibujarEncabezado(doc, proforma) {
    const anchoUtil = doc.page.width - MARGIN * 2;
    let logoAlto = 0;
    if (fs.existsSync(LOGO_PATH)) {
        try { doc.image(LOGO_PATH, MARGIN, doc.y, { width: 70 }); logoAlto = 55; } catch { /* logo opcional */ }
    }

    const empresaX = MARGIN + (logoAlto ? 84 : 0);
    const empresaAncho = anchoUtil - (logoAlto ? 84 : 0) - 180;
    const yInicio = doc.y;

    doc.font('Helvetica-Bold').fontSize(13).fillColor(COLOR_TXT)
        .text(proforma.sucursal_nombre || 'SS SWAP — Mecánica Automotriz', empresaX, yInicio, { width: empresaAncho });
    doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_MUT);
    if (proforma.sucursal_direccion) doc.text(proforma.sucursal_direccion, empresaX, doc.y + 2, { width: empresaAncho });
    const contacto = [proforma.sucursal_telefono, proforma.sucursal_email].filter(Boolean).join('  ·  ');
    if (contacto) doc.text(contacto, empresaX, doc.y + 1, { width: empresaAncho });

    // Caja de numero/fecha a la derecha
    const cajaAncho = 170;
    const cajaX = MARGIN + anchoUtil - cajaAncho;
    doc.rect(cajaX, yInicio, cajaAncho, 62).fillAndStroke(COLOR_HEAD_BG, COLOR_BORDE);
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLOR_SKY).text(proforma.numero, cajaX, yInicio + 8, { width: cajaAncho, align: 'center' });
    doc.font('Helvetica').fontSize(8).fillColor(COLOR_TXT);
    doc.text(`Emisión: ${fecha(proforma.fecha_emision)}`, cajaX + 8, yInicio + 30, { width: cajaAncho - 16 });
    doc.text(`Validez: ${fecha(proforma.fecha_validez)}`, cajaX + 8, yInicio + 44, { width: cajaAncho - 16 });

    doc.y = Math.max(yInicio + Math.max(logoAlto, 62) + 10, doc.y + 10);
    doc.moveTo(MARGIN, doc.y).lineTo(MARGIN + anchoUtil, doc.y).strokeColor(COLOR_SKY).lineWidth(1.5).stroke();
    doc.moveDown(0.8);
}

function dibujarBloqueClienteVehiculo(doc, proforma) {
    const anchoUtil = doc.page.width - MARGIN * 2;
    const colAncho = anchoUtil / 2 - 8;
    const yInicio = doc.y;

    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_SKY).text('CLIENTE', MARGIN, yInicio);
    doc.font('Helvetica').fontSize(9).fillColor(COLOR_TXT);
    doc.text(proforma.cliente_nombre || '—', MARGIN, doc.y + 3, { width: colAncho });
    if (proforma.cliente_ruc) doc.text(`RUC/CI: ${proforma.cliente_ruc}`, MARGIN, doc.y + 1, { width: colAncho });
    if (proforma.cliente_direccion) doc.text(proforma.cliente_direccion, MARGIN, doc.y + 1, { width: colAncho });
    const contactoCli = [proforma.cliente_telefono, proforma.cliente_email].filter(Boolean).join('  ·  ');
    if (contactoCli) doc.text(contactoCli, MARGIN, doc.y + 1, { width: colAncho });
    const yFinIzq = doc.y;

    const xDer = MARGIN + colAncho + 16;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_SKY).text('VEHÍCULO', xDer, yInicio);
    doc.font('Helvetica').fontSize(9).fillColor(COLOR_TXT);
    const veh = [proforma.vehiculo_marca, proforma.vehiculo_modelo].filter(Boolean).join(' ') || '—';
    doc.text(veh, xDer, doc.y === yInicio ? yInicio + 14 : yInicio + 14, { width: colAncho });
    doc.y = yInicio + 14 + 12;
    const linea2 = [proforma.vehiculo_tipo, proforma.vehiculo_color, proforma.vehiculo_anio ? `Año ${proforma.vehiculo_anio}` : null].filter(Boolean).join('  ·  ');
    if (linea2) doc.text(linea2, xDer, doc.y, { width: colAncho });
    const linea3 = [proforma.vehiculo_placa ? `Placa: ${proforma.vehiculo_placa}` : null, proforma.vehiculo_vin ? `VIN: ${proforma.vehiculo_vin}` : null].filter(Boolean).join('  ·  ');
    if (linea3) doc.text(linea3, xDer, doc.y + 1, { width: colAncho });
    const yFinDer = doc.y;

    doc.y = Math.max(yFinIzq, yFinDer) + 10;
    doc.moveTo(MARGIN, doc.y).lineTo(doc.page.width - MARGIN, doc.y).strokeColor(COLOR_BORDE).lineWidth(0.5).stroke();
    doc.moveDown(0.7);
}

// Colores del pictograma en el PDF (misma paleta que el SVG del frontend).
const COLOR_DECOR = {
    carroceria: '#e2e8f0', 'carroceria-oscura': '#94a3b8', vidrio: '#bae6fd',
    rueda: '#1e293b', llanta: '#94a3b8', faro: '#fde68a', parrilla: '#475569', stop: '#f87171',
};
const COLOR_ZONA = '#f8fafc';
const COLOR_ZONA_DANADA = '#ef4444';

/**
 * Pictograma vectorial de daños (proformas de Colisiones / Pintura). Usa
 * EXACTAMENTE los mismos paths SVG que el frontend (shared/vehiculoDiagramas)
 * dibujados con doc.path(): nitido a cualquier zoom, sin imagenes. Respeta
 * la paginacion: si no entra en la pagina actual, pasa a la siguiente con
 * el mismo mecanismo de pie de pagina (asegurarEspacio).
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
    doc.rect(x0, y, anchoUtil, 18).fill(COLOR_SKY);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#fff')
        .text(`DAÑOS REPORTADOS — TIPO DE VEHÍCULO: ${etiquetaVeh.toUpperCase()}`, x0 + 6, y + 4, { width: anchoUtil - 12 });
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
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR_MUT);
    diagrama.textos.forEach(t => {
        const ancho = 220;
        const tx = t.anchor === 'middle' ? t.x - ancho / 2 : t.anchor === 'end' ? t.x - ancho : t.x;
        doc.text(t.texto, tx, t.y - 10, { width: ancho, align: t.anchor === 'middle' ? 'center' : t.anchor === 'end' ? 'right' : 'left', lineBreak: false });
    });
    doc.restore();
    doc.y = y + altoDiagrama + 6;

    // Leyenda + lista de zonas afectadas (2 columnas)
    asegurarEspacio(doc, 30, null);
    doc.rect(x0, doc.y + 2, 8, 8).fill(COLOR_ZONA_DANADA);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLOR_TXT)
        .text(`Zonas afectadas (${zonas.length})`, x0 + 13, doc.y + 1, { width: anchoUtil - 13 });
    doc.moveDown(0.3);
    if (!zonas.length) {
        doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_MUT).text('No se marcaron zonas en el pictograma.', x0, doc.y, { width: anchoUtil });
    } else {
        const etiquetas = zonas.map(etiquetaZona);
        const mitad = Math.ceil(etiquetas.length / 2);
        const colAncho = anchoUtil / 2 - 8;
        for (let i = 0; i < mitad; i++) {
            asegurarEspacio(doc, 13, null);
            const yFila = doc.y;
            doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_TXT);
            doc.text(`•  ${etiquetas[i]}`, x0 + 4, yFila, { width: colAncho, lineBreak: false, ellipsis: true });
            if (etiquetas[i + mitad]) doc.text(`•  ${etiquetas[i + mitad]}`, x0 + anchoUtil / 2 + 4, yFila, { width: colAncho, lineBreak: false, ellipsis: true });
            doc.y = yFila + 12;
        }
    }
    if (proforma.danos_observaciones) {
        doc.moveDown(0.3);
        asegurarEspacio(doc, 30, null);
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR_TXT).text('Observaciones de los daños:', x0, doc.y);
        doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_MUT).text(proforma.danos_observaciones, x0, doc.y + 2, { width: anchoUtil });
    }
    doc.moveDown(0.8);
}

function dibujarResumenTotales(doc, proforma) {
    const anchoUtil = doc.page.width - MARGIN * 2;
    const cajaAncho = 230;
    const x0 = MARGIN + anchoUtil - cajaAncho;

    asegurarEspacio(doc, 160, null);
    const y0 = doc.y;

    const lineas = [];
    if (proforma.tipo === 'mecanica') {
        if (Number(proforma.subtotal_productos)) lineas.push(['Subtotal productos', proforma.subtotal_productos]);
        if (Number(proforma.subtotal_servicios)) lineas.push(['Subtotal servicios', proforma.subtotal_servicios]);
    } else {
        if (Number(proforma.subtotal_mano_obra)) lineas.push(['Total mano de obra', proforma.subtotal_mano_obra]);
        if (Number(proforma.subtotal_pintura)) lineas.push(['Total pintura', proforma.subtotal_pintura]);
        if (Number(proforma.subtotal_repuestos)) lineas.push(['Total repuestos', proforma.subtotal_repuestos]);
        if (Number(proforma.subtotal_insumos)) lineas.push(['Total insumos', proforma.subtotal_insumos]);
    }
    lineas.push(['Subtotal', proforma.subtotal]);
    if (Number(proforma.descuento)) lineas.push(['Descuento', -proforma.descuento]);
    lineas.push([`IVA (${Number(proforma.iva_porcentaje)}%)`, proforma.iva_valor]);

    const altoCaja = 26 + lineas.length * 15 + 42;
    doc.rect(x0, y0, cajaAncho, altoCaja).fillAndStroke('#f8fafc', COLOR_BORDE);

    let y = y0 + 10;
    doc.font('Helvetica').fontSize(9).fillColor(COLOR_TXT);
    lineas.forEach(([label, val]) => {
        doc.text(label, x0 + 12, y, { width: cajaAncho - 110 });
        doc.text(money(val), x0 + 12, y, { width: cajaAncho - 24, align: 'right' });
        y += 15;
    });

    doc.rect(x0, y + 2, cajaAncho, 22).fill(COLOR_SKY);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#fff');
    doc.text('TOTAL', x0 + 12, y + 8, { width: cajaAncho - 110 });
    doc.text(money(proforma.total), x0 + 12, y + 8, { width: cajaAncho - 24, align: 'right' });
    y += 28;

    doc.font('Helvetica').fontSize(9).fillColor(COLOR_TXT);
    doc.text('Anticipo', x0 + 12, y, { width: cajaAncho - 110 });
    doc.text(money(proforma.anticipo), x0 + 12, y, { width: cajaAncho - 24, align: 'right' });
    y += 15;
    doc.font('Helvetica-Bold');
    doc.text('Saldo pendiente', x0 + 12, y, { width: cajaAncho - 110 });
    doc.text(money(proforma.saldo), x0 + 12, y, { width: cajaAncho - 24, align: 'right' });

    doc.y = y0 + altoCaja + 14;
}

function dibujarNotasYFirma(doc, proforma) {
    const anchoUtil = doc.page.width - MARGIN * 2;
    asegurarEspacio(doc, 120, null);

    if (proforma.tipo === 'pintura' && (proforma.garantia || proforma.tiempo_estimado)) {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR_TXT);
        if (proforma.garantia) { doc.text(`Garantía: ${proforma.garantia}`, MARGIN, doc.y, { width: anchoUtil }); doc.moveDown(0.3); }
        if (proforma.tiempo_estimado) { doc.text(`Tiempo estimado de trabajo: ${proforma.tiempo_estimado}`, MARGIN, doc.y, { width: anchoUtil }); doc.moveDown(0.3); }
        doc.font('Helvetica');
    }
    if (proforma.observaciones) {
        doc.font('Helvetica-Bold').fontSize(8.5).text('Observaciones:', MARGIN, doc.y);
        doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_MUT).text(proforma.observaciones, MARGIN, doc.y + 2, { width: anchoUtil });
        doc.moveDown(0.4);
    }
    if (proforma.condiciones) {
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR_TXT).text('Forma de pago / condiciones:', MARGIN, doc.y);
        doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_MUT).text(proforma.condiciones, MARGIN, doc.y + 2, { width: anchoUtil });
        doc.moveDown(0.6);
    }

    asegurarEspacio(doc, 70, null);
    doc.moveDown(1.5);
    const yFirma = doc.y;
    const mitad = anchoUtil / 2 - 20;
    doc.strokeColor(COLOR_BORDE).lineWidth(0.6);
    doc.moveTo(MARGIN, yFirma).lineTo(MARGIN + mitad, yFirma).stroke();
    doc.moveTo(MARGIN + anchoUtil - mitad, yFirma).lineTo(MARGIN + anchoUtil, yFirma).stroke();
    doc.font('Helvetica').fontSize(8).fillColor(COLOR_MUT);
    doc.text(`Preparado por: ${proforma.usuario_nombre || ''}`, MARGIN, yFirma + 4, { width: mitad, align: 'center' });
    doc.text('Firma del cliente', MARGIN + anchoUtil - mitad, yFirma + 4, { width: mitad, align: 'center' });
}

/** Genera el PDF y lo escribe en `res` (stream). `proforma` debe incluir `items`. */
function generarProformaPdf(proforma, res) {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
    doc.pipe(res);

    // Pie de pagina incremental (ver nota tecnica en asegurarEspacio): no
    // conocemos el total de paginas de antemano, asi que se numera solo
    // "Página N" (sin "de Y") — evita depender de mecanismos de pdfkit que
    // resultaron poco fiables en este entorno para documentos largos.
    let numeroPagina = 1;
    doc.__piePagina = () => {
        const y = doc.page.height - 26;
        // El pie va DEBAJO de margins.bottom a proposito (fuera del area de
        // contenido). Escribir ahi con el margen activo hace que pdfkit
        // piense que el texto no entra y cree una pagina nueva el solo
        // (bug detectado generando PDFs de varias paginas: aparecian el
        // doble de paginas de las esperadas, con el pie en las pares). Se
        // anula el margen inferior solo durante este texto puntual.
        const margenOriginal = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.font('Helvetica').fontSize(7.5).fillColor(COLOR_MUT)
            .text(`${proforma.numero}  ·  Página ${numeroPagina}`, MARGIN, y, { width: doc.page.width - MARGIN * 2, align: 'center', lineBreak: false });
        doc.page.margins.bottom = margenOriginal;
        numeroPagina++;
    };

    dibujarEncabezado(doc, proforma);

    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLOR_TXT)
        .text(proforma.tipo === 'pintura' ? 'PROFORMA — COLISIONES / PINTURA Y CARROCERÍA' : 'PROFORMA — SERVICIO MECÁNICO', MARGIN, doc.y);
    const ordenRef = proforma.orden_generada_id || proforma.orden_id;
    if (ordenRef) {
        doc.font('Helvetica').fontSize(8.5).fillColor(COLOR_MUT)
            .text(`Orden de trabajo: OT-${String(ordenRef).padStart(6, '0')}`, MARGIN, doc.y + 2);
    }
    doc.moveDown(0.6);

    dibujarBloqueClienteVehiculo(doc, proforma);
    dibujarPictograma(doc, proforma);

    const itemsPorCategoria = (cat) => (proforma.items || []).filter(i => i.categoria === cat);
    const filasDe = (items) => items.map((it, i) => ({
        item: i + 1, descripcion: it.descripcion, cantidad: Number(it.cantidad) % 1 === 0 ? Number(it.cantidad) : Number(it.cantidad).toFixed(2),
        precio: money(it.precio_unitario), subtotal: money(it.subtotal),
    }));

    const colCantPrecio = [
        { titulo: '#', campo: 'item', ancho: 24, align: 'center' },
        { titulo: 'DESCRIPCIÓN', campo: 'descripcion', ancho: 250 },
        { titulo: 'CANT.', campo: 'cantidad', ancho: 50, align: 'center' },
        { titulo: 'P. UNIT.', campo: 'precio', ancho: 65, align: 'right' },
        { titulo: 'SUBTOTAL', campo: 'subtotal', ancho: 70, align: 'right' },
    ];
    const colSimple = [
        { titulo: 'ITEM', campo: 'item', ancho: 30, align: 'center' },
        { titulo: 'DESCRIPCIÓN', campo: 'descripcion', ancho: 379 },
        { titulo: 'VALOR', campo: 'precio', ancho: 100, align: 'right' },
    ];

    if (proforma.tipo === 'mecanica') {
        const productos = itemsPorCategoria('producto');
        if (productos.length) {
            dibujarTabla(doc, { tituloSeccion: 'PRODUCTOS / REPUESTOS', columnas: colCantPrecio, filas: filasDe(productos), filaTotal: { etiqueta: 'TOTAL PRODUCTOS', valor: money(proforma.subtotal_productos) } });
        }
        const servicios = itemsPorCategoria('servicio');
        if (servicios.length) {
            dibujarTabla(doc, { tituloSeccion: 'SERVICIOS / MANO DE OBRA', columnas: colCantPrecio, filas: filasDe(servicios), filaTotal: { etiqueta: 'TOTAL SERVICIOS', valor: money(proforma.subtotal_servicios) } });
        }
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
            const usaCantPrecio = cat === 'repuesto' || cat === 'insumo';
            dibujarTabla(doc, {
                tituloSeccion: titulo,
                columnas: usaCantPrecio ? colCantPrecio : colSimple,
                filas: usaCantPrecio ? filasDe(items) : items.map((it, i) => ({ item: i + 1, descripcion: it.descripcion, precio: money(it.subtotal) })),
                filaTotal: { etiqueta: `TOTAL ${titulo.split(' / ')[0]}`, valor: money(tot) },
            });
        });
    }

    dibujarResumenTotales(doc, proforma);
    dibujarNotasYFirma(doc, proforma);

    // La ultima pagina nunca pasa por asegurarEspacio->addPage (no hay una
    // pagina siguiente que la "abandone"), asi que se dibuja aqui aparte.
    doc.__piePagina();

    doc.end();
}

module.exports = { generarProformaPdf };
