/**
 * SS SWAP - PDF del reporte de cierre de caja (Sprint 29)
 *
 * Una caja (abierta o cerrada) con: cuadre de efectivo (fondo inicial +
 * entradas - salidas = esperado, contra lo entregado), ingresos del sistema
 * por forma de pago, cuadre por forma de pago contra lo declarado por el
 * cajero, documentos, vendedores, movimientos manuales, ventas, ventas a
 * credito, recaudaciones, anticipos, reaperturas y firmas.
 * Una caja ABIERTA lleva la marca de agua "PRELIMINAR".
 */
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { NOMBRE_METODO } = require('./caja.service');

const FUENTE_REGULAR = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf');
const FUENTE_NEGRITA = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf');
const UNICODE = fs.existsSync(FUENTE_REGULAR) && fs.existsSync(FUENTE_NEGRITA);
const F = { n: UNICODE ? 'CJ-Regular' : 'Helvetica', b: UNICODE ? 'CJ-Bold' : 'Helvetica-Bold' };

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
const PIE = 36;

const limpio = (v) => String(v ?? '').normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
const dinero = (v) => (v === null || v === undefined ? '—'
    : `${Number(v) < 0 ? '-' : ''}$${Math.abs(Number(v)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const conSigno = (v) => (Number(v) > 0 ? `+${dinero(v)}` : dinero(v));
const fechaHora = (v) => (v ? new Date(v).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
/** Fecha corta para las tablas: 17/10/26 12:35 */
const fechaTabla = (v) => (v ? new Date(v).toLocaleString('es-EC', { timeZone: 'America/Guayaquil', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '') : '—');
const forma = (k) => NOMBRE_METODO[k] || limpio(k);
/** Texto y color de una diferencia de caja: sobrante, faltante o cuadra. */
function resultado(dif) {
    if (dif === null || dif === undefined) return { texto: '—', color: MUT };
    if (Math.abs(dif) < 0.005) return { texto: 'Cuadra', color: VERDE };
    return dif > 0 ? { texto: `Sobrante ${dinero(dif)}`, color: AMBAR } : { texto: `Faltante ${dinero(-dif)}`, color: ROJO };
}

/**
 * @param {object} r        reporte de caja.service.reporteSesion
 * @param {object} extra    { empresa: { nombre, logo, ruc, direccion } }
 * @returns {Promise<Buffer>}
 */
async function generarCajaPdf(r, { empresa = {} } = {}) {
    const s = r.sesion;
    const doc = new PDFDocument({ size: 'A4', margin: M, bufferPages: true,
        info: { Title: `Cierre de caja ${s.id}`, Author: limpio(empresa.nombre) || 'SS SWAP', Subject: 'Reporte de cierre de caja' } });
    if (UNICODE) { doc.registerFont('CJ-Regular', FUENTE_REGULAR); doc.registerFont('CJ-Bold', FUENTE_NEGRITA); }
    const partes = [];
    doc.on('data', (c) => partes.push(c));
    const fin = new Promise((ok, mal) => { doc.on('end', () => ok(Buffer.concat(partes))); doc.on('error', mal); });

    const W = doc.page.width - M * 2;
    const altoPagina = () => doc.page.height - M - PIE;
    let y = M;
    const saltar = (alto, repetir) => {
        if (y + alto <= altoPagina()) return false;
        doc.addPage();
        y = M;
        if (repetir) repetir();
        return true;
    };

    // ── Encabezado ──
    doc.rect(0, 0, doc.page.width, 7).fill(AZUL);
    let xIzq = M;
    if (empresa.logo) {
        try { doc.image(empresa.logo, M, y, { fit: [62, 40] }); xIzq = M + 72; } catch { /* logo ilegible */ }
    }
    doc.font(F.b).fontSize(9).fillColor(TXT).text(limpio(empresa.nombre) || 'SS SWAP', xIzq, y + 4, { width: 250 });
    const subEmpresa = [empresa.ruc && `RUC ${limpio(empresa.ruc)}`, limpio(empresa.direccion)].filter(Boolean).join(' · ');
    doc.font(F.n).fontSize(7.5).fillColor(MUT).text(subEmpresa || 'Control de cajas', xIzq, doc.y + 1, { width: 250 });

    doc.font(F.b).fontSize(20).fillColor(AZUL).text('CIERRE DE CAJA', M, y - 2, { width: W, align: 'right' });
    doc.font(F.b).fontSize(11).fillColor(TXT).text(`No. ${s.id}`, M, doc.y, { width: W, align: 'right' });
    const chip = r.cerrada ? 'CERRADA' : 'ABIERTA · PRELIMINAR';
    doc.font(F.b).fontSize(7);
    const anchoChip = doc.widthOfString(chip) + 16;
    const yChip = doc.y + 4;
    doc.roundedRect(M + W - anchoChip, yChip, anchoChip, 15, 7.5).fill(r.cerrada ? VERDE : AMBAR);
    doc.fillColor('#ffffff').text(chip, M + W - anchoChip, yChip + 4, { width: anchoChip, align: 'center' });
    y = Math.max(yChip + 24, M + 52);
    doc.moveTo(M, y).lineTo(M + W, y).lineWidth(1).strokeColor(BORDE).stroke();
    y += 10;

    // ── Datos de la caja ──
    const datos = [
        ['Sucursal', limpio(s.sucursal_nombre) || 'General'], ['Cajero', limpio(s.cajero_nombre)],
        ['Apertura', `${fechaHora(s.fecha_apertura)} · ${limpio(s.usuario_apertura_nombre)}`],
        ['Cierre', r.cerrada ? `${fechaHora(s.fecha_cierre)} · ${limpio(s.usuario_cierre_nombre) || '—'}` : 'Sin cerrar'],
    ];
    const colDato = (W - 12) / 2;
    datos.forEach(([et, val], i) => {
        const x0 = M + (i % 2) * (colDato + 12);
        const y0 = y + Math.floor(i / 2) * 16;
        doc.font(F.b).fontSize(7.2).fillColor(MUT).text(et.toUpperCase(), x0, y0 + 1, { width: 60 });
        doc.font(F.n).fontSize(8.5).fillColor(TXT).text(val, x0 + 62, y0, { width: colDato - 62, lineBreak: false, ellipsis: true });
    });
    y += 36;

    // ── Tarjetas: cuadre de efectivo | ingresos del sistema ──
    const e = r.efectivo;
    const res = resultado(e.diferencia);
    const filasEfectivo = [
        ['Fondo inicial (efectivo)', dinero(e.apertura)],
        ['(+) Entradas de efectivo', dinero(e.ingresos), VERDE],
        ['(−) Salidas de efectivo', dinero(e.egresos), ROJO],
        ['(=) ESPERADO EN CAJA', dinero(e.esperado), TXT, true],
        ['Efectivo entregado (contado)', r.cerrada ? dinero(e.contado) : 'Pendiente'],
        ['Diferencia', r.cerrada ? res.texto : '—', res.color, true],
    ];
    const filasIngresos = r.ingresos_sistema.length
        ? r.ingresos_sistema.map(f => [`${f.nombre}${f.cantidad ? ` (${f.cantidad})` : ''}`, dinero(f.total), f.forma === 'credito' ? ROJO : TXT])
        : [['Sin cobros ni anticipos', '']];
    filasIngresos.push(['TOTAL', dinero(r.ingresos_sistema.reduce((a, f) => a + f.total, 0)), TXT, true]);
    const colW = (W - 12) / 2;
    const altoTarj = Math.max(filasEfectivo.length, filasIngresos.length) * 16 + 38;
    saltar(altoTarj);
    const tarjeta = (x0, titulo, filas) => {
        doc.roundedRect(x0, y, colW, altoTarj, 8).fill(FONDO);
        doc.rect(x0, y + 10, 3, 14).fill(AZUL_CLARO);
        doc.font(F.b).fontSize(7.5).fillColor(AZUL_CLARO).text(titulo, x0 + 12, y + 13, { width: colW - 24, characterSpacing: 1 });
        let yy = y + 32;
        for (const [et, val, color, fuerte] of filas) {
            if (fuerte) doc.moveTo(x0 + 12, yy - 3).lineTo(x0 + colW - 12, yy - 3).lineWidth(0.5).strokeColor(BORDE).stroke();
            doc.font(fuerte ? F.b : F.n).fontSize(8.3).fillColor(TXT).text(et, x0 + 12, yy, { width: colW - 24 - 92, height: 11, lineBreak: false, ellipsis: true });
            doc.font(F.b).fontSize(8.6).fillColor(color || TXT).text(val, x0 + colW - 12 - 90, yy, { width: 90, align: 'right', height: 11, lineBreak: false });
            yy += 16;
        }
    };
    tarjeta(M, 'CIERRE FINAL (EFECTIVO)', filasEfectivo);
    tarjeta(M + colW + 12, 'INGRESOS DEL SISTEMA', filasIngresos);
    y += altoTarj + 14;

    // ── Tabla genérica con salto de página y cabecera repetida ──
    function tabla(titulo, cols, filas, { vacio = 'Sin registros.', total = null, colorTitulo = AZUL } = {}) {
        const libres = cols.filter(c => !c.w).length;
        const fijo = cols.reduce((a, c) => a + (c.w || 0), 0);
        cols.forEach(c => { if (!c.w) c.w = (W - fijo) / libres; });
        let primera = true;
        const cabecera = () => {
            doc.font(F.b).fontSize(8).fillColor(colorTitulo).text(primera ? titulo : `${titulo} (CONT.)`, M, y, { characterSpacing: 1 });
            primera = false;
            y = doc.y + 4;
            doc.roundedRect(M, y, W, 18, 5).fill(AZUL);
            let xx = M;
            for (const c of cols) { doc.font(F.b).fontSize(6.8).fillColor('#ffffff').text(c.t, xx + 6, y + 6, { width: c.w - 12, align: c.a || 'left' }); xx += c.w; }
            y += 20;
        };
        saltar(60);
        cabecera();
        if (!filas.length) {
            doc.font(F.n).fontSize(8).fillColor(MUT).text(vacio, M + 6, y + 4, { width: W - 12 });
            y = doc.y + 10;
            return;
        }
        filas.forEach((fila, i) => {
            const celdas = fila.celdas || fila;
            const alto = Math.max(...celdas.map((v, k) => doc.font(F.n).fontSize(7.9).heightOfString(limpio(v) || ' ', { width: cols[k].w - 12 })), 9) + 9;
            saltar(alto, cabecera);
            if (i % 2 === 0) doc.rect(M, y, W, alto).fill(FONDO);
            let xx = M;
            celdas.forEach((v, k) => {
                const c = cols[k];
                const color = (fila.colores && fila.colores[k]) || (fila.tachado ? MUT : TXT);
                doc.font(c.b ? F.b : F.n).fontSize(7.9).fillColor(color).text(limpio(v), xx + 6, y + 5, { width: c.w - 12, align: c.a || 'left', strike: Boolean(fila.tachado) });
                xx += c.w;
            });
            y += alto;
        });
        if (total) {
            saltar(20);
            doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.8).strokeColor(BORDE).stroke();
            doc.font(F.b).fontSize(8.2).fillColor(TXT).text(total[0], M + 6, y + 6, { width: W - 130, align: 'right' });
            doc.text(total[1], M + W - 118, y + 6, { width: 112, align: 'right' });
            y += 22;
        } else {
            doc.moveTo(M, y).lineTo(M + W, y).lineWidth(0.8).strokeColor(BORDE).stroke();
            y += 8;
        }
        y += 6;
    }

    // ── Cuadre por forma de pago ──
    tabla('CUADRE POR FORMA DE PAGO (SISTEMA vs. CAJERO)',
        [{ t: 'FORMA DE PAGO' }, { t: 'SISTEMA', w: 90, a: 'right' }, { t: 'DECLARADO', w: 90, a: 'right' }, { t: 'DIFERENCIA', w: 110, a: 'right' }],
        [
            ...r.formas.filter(f => f.codigo === 'efectivo' || f.sistema || f.declarado).map(f => {
                const d = resultado(f.diferencia);
                return { celdas: [f.nombre, dinero(f.sistema), r.cerrada ? dinero(f.declarado) : '—', r.cerrada ? d.texto : '—'], colores: [null, null, null, d.color] };
            }),
            ...r.retenciones.filter(x => x.declarado).map(x => [`${x.nombre} (documentos recibidos)`, '—', dinero(x.declarado), 'Informativo']),
        ]);

    // ── Apertura y conteo de efectivo (billetes y monedas) ──
    {
        const ap = new Map(r.apertura.conteo.map(c => [c.valor, c]));
        const ci = new Map((r.conteo_cierre || []).map(c => [c.valor, c]));
        const valores = [...new Set([...ap.keys(), ...ci.keys()])].sort((a, b) => b - a);
        const nombre = (v) => (v >= 1 ? `${v}` : `${Math.round(v * 100)} ctvs.`);
        const nota = r.apertura.contada ? '' : ` (monto de apertura escrito a mano: ${dinero(r.apertura.monto)})`;
        tabla(`APERTURA Y CONTEO DE EFECTIVO${nota}`,
            [{ t: 'BILLETE / MONEDA' }, { t: 'APERTURA (CANT.)', w: 90, a: 'right' }, { t: 'APERTURA', w: 80, a: 'right' }, { t: 'CIERRE (CANT.)', w: 90, a: 'right' }, { t: 'CIERRE', w: 80, a: 'right' }],
            valores.map(v => [nombre(v), ap.get(v) ? String(ap.get(v).cantidad) : '—', ap.get(v) ? dinero(ap.get(v).subtotal) : '—',
                ci.get(v) ? String(ci.get(v).cantidad) : '—', ci.get(v) ? dinero(ci.get(v).subtotal) : '—']),
            { vacio: `Apertura de ${dinero(r.apertura.monto)} en efectivo, sin conteo de billetes y monedas.`,
              total: valores.length ? [`APERTURA ${dinero(r.apertura.monto)} · ENTREGADO AL CIERRE`, r.cerrada ? dinero(r.efectivo.contado) : 'Pendiente'] : null });
    }

    // ── Documentos y vendedores ──
    tabla('RESUMEN POR DOCUMENTOS', [{ t: 'DOCUMENTO' }, { t: 'CANT.', w: 70, a: 'right' }, { t: 'VALOR', w: 110, a: 'right' }],
        r.documentos.map(d => [d.tipo, String(d.cantidad), dinero(d.total)]),
        { vacio: 'No hubo ventas en esta caja.', total: r.documentos.length ? ['TOTAL VENTAS', dinero(r.totales.ventas)] : null });
    tabla('RESUMEN POR VENDEDOR', [{ t: 'VENDEDOR' }, { t: 'VENTAS', w: 70, a: 'right' }, { t: 'VALOR', w: 110, a: 'right' }],
        r.por_vendedor.map(v => [v.vendedor, String(v.cantidad), dinero(v.total)]), { vacio: 'No hubo ventas en esta caja.' });

    // ── Movimientos manuales ──
    tabla('MOVIMIENTOS MANUALES DE CAJA',
        [{ t: 'FECHA', w: 80 }, { t: 'TIPO', w: 58 }, { t: 'DETALLE' }, { t: 'REGISTRÓ', w: 100 }, { t: 'VALOR', w: 74, a: 'right', b: true }],
        r.movimientos_manuales.map(m => ({
            celdas: [fechaTabla(m.created_at), m.anulado_at ? 'ANULADO' : m.tipo === 'ingreso' ? 'INGRESO' : 'EGRESO',
                `${m.concepto}${m.anulado_at ? ` — ${m.motivo_anulacion || ''}` : ''}`,
                limpio(m.usuario_nombre) || '—', `${m.tipo === 'ingreso' ? '+' : '-'}${dinero(m.monto)}`],
            colores: [null, m.anulado_at ? MUT : m.tipo === 'ingreso' ? VERDE : ROJO, null, null, m.anulado_at ? MUT : m.tipo === 'ingreso' ? VERDE : ROJO],
            tachado: Boolean(m.anulado_at),
        })),
        { vacio: 'No hubo entradas ni salidas manuales.', total: r.movimientos_manuales.length
            ? ['NETO (sin anulados)', conSigno(r.totales.manuales_ingresos - r.totales.manuales_egresos)] : null });

    // ── Por cobrar: ventas de esta caja que todavia tienen saldo ──
    tabla('POR COBRAR (VENTAS DE ESTA CAJA CON SALDO)',
        [{ t: 'FECHA', w: 80 }, { t: 'CLIENTE' }, { t: 'DOCUMENTO', w: 120 }, { t: 'TOTAL', w: 62, a: 'right' }, { t: 'ABONADO', w: 62, a: 'right' }, { t: 'POR COBRAR', w: 70, a: 'right', b: true }],
        r.por_cobrar.map(v => ({ celdas: [fechaTabla(v.momento), v.cliente, `${v.numero}
${v.referencia || ''}`, dinero(v.total), dinero(v.pagado || 0), dinero(v.pendiente)],
                                 colores: [null, null, null, null, null, ROJO] })),
        { vacio: 'Todo lo vendido en esta caja está cobrado.', colorTitulo: r.por_cobrar.length ? ROJO : AZUL,
          total: r.por_cobrar.length ? ['TOTAL POR COBRAR', dinero(r.totales.por_cobrar)] : null });

    // ── Ingresos y egresos del periodo (todas las formas de pago) ──
    tabla('INGRESOS Y EGRESOS DEL PERIODO POR FORMA DE PAGO',
        [{ t: 'FORMA DE PAGO' }, { t: 'INGRESOS', w: 90, a: 'right' }, { t: 'EGRESOS', w: 90, a: 'right' }, { t: 'NETO', w: 90, a: 'right', b: true }],
        r.resumen_dinero.map(x => ({ celdas: [x.nombre, x.ingresos ? `+${dinero(x.ingresos)}` : dinero(0), x.egresos ? `-${dinero(x.egresos)}` : dinero(0), dinero(x.ingresos - x.egresos)], colores: [null, VERDE, ROJO, null] })),
        { vacio: 'No entró ni salió dinero en este periodo.',
          total: r.resumen_dinero.length ? [`INGRESOS ${dinero(r.totales.ingresos_periodo)} · EGRESOS ${dinero(r.totales.egresos_periodo)} · NETO`, dinero(r.totales.ingresos_periodo - r.totales.egresos_periodo)] : null });
    if (r.movimientos_dinero.length) {
        tabla('DETALLE DE INGRESOS Y EGRESOS',
            [{ t: 'FECHA', w: 80 }, { t: 'TIPO', w: 58 }, { t: 'DETALLE' }, { t: 'CATEGORÍA', w: 96 }, { t: 'FORMA', w: 70 }, { t: 'VALOR', w: 66, a: 'right', b: true }],
            r.movimientos_dinero.map(m => ({
                celdas: [fechaTabla(m.momento), m.tipo === 'ingreso' ? 'INGRESO' : 'EGRESO', `${m.descripcion}${m.tercero ? `
${m.tercero}` : ''}`, m.categoria, forma(m.forma),
                    `${m.tipo === 'ingreso' ? '+' : '-'}${dinero(m.monto)}`],
                colores: [null, m.tipo === 'ingreso' ? VERDE : ROJO, null, MUT, null, m.tipo === 'ingreso' ? VERDE : ROJO],
            })));
    }

    // ── Ventas del periodo ──
    tabla('VENTAS DE LA CAJA',
        [{ t: 'FECHA', w: 80 }, { t: 'CLIENTE' }, { t: 'DOCUMENTO', w: 108 }, { t: 'TOTAL', w: 62, a: 'right', b: true }, { t: 'PAGOS / PENDIENTE', w: 112 }, { t: 'VENDEDOR', w: 76 }],
        r.ventas.map(v => {
            const pagos = v.pagos.map(p => `${forma(p.forma)}: ${dinero(p.monto)}`).join('\n');
            const pend = v.pendiente > 0 ? `${pagos ? '\n' : ''}Pendiente: ${dinero(v.pendiente)}` : '';
            return { celdas: [fechaTabla(v.momento), v.cliente, `${v.tipo}\n${v.numero}`, dinero(v.total), (pagos + pend) || (v.pendiente === null ? '—' : 'Pagado'), v.vendedor],
                     colores: [null, null, null, v.total < 0 ? ROJO : null, v.pendiente > 0 ? ROJO : null, null] };
        }),
        { vacio: 'No hubo ventas en esta caja.', total: r.ventas.length ? ['TOTAL FACTURADO', dinero(r.totales.ventas)] : null });

    tabla('VENTAS 100 % A CRÉDITO (SIN ABONO)',
        [{ t: 'FECHA', w: 80 }, { t: 'VENCE', w: 70 }, { t: 'CLIENTE' }, { t: 'DOCUMENTO', w: 120 }, { t: 'VENDEDOR', w: 90 }, { t: 'TOTAL', w: 66, a: 'right' }],
        r.ventas_credito.map(v => [fechaTabla(v.momento), v.vencimiento || '—', v.cliente, v.numero, v.vendedor, dinero(v.total)]),
        { vacio: 'No hubo ventas a crédito puro.', total: r.ventas_credito.length ? ['SUBTOTAL CRÉDITO PURO', dinero(r.totales.credito_puro)] : null });

    tabla('RECAUDACIONES (COBROS DE DEUDAS ANTERIORES)',
        [{ t: 'FECHA COBRO', w: 80 }, { t: 'CLIENTE' }, { t: 'DOCUMENTO', w: 130 }, { t: 'TOTAL DOC.', w: 64, a: 'right' }, { t: 'FORMA', w: 70 }, { t: 'COBRADO', w: 64, a: 'right', b: true }],
        r.recaudaciones.map(x => [fechaTabla(x.momento), x.cliente, x.documento, dinero(x.total_documento), forma(x.forma), dinero(x.cobrado)]),
        { vacio: 'No hubo recaudaciones de deudas anteriores.', total: r.recaudaciones.length ? ['TOTAL RECAUDADO', dinero(r.totales.recaudado)] : null });

    tabla('ANTICIPOS DE CLIENTES',
        [{ t: 'FECHA', w: 80 }, { t: 'DETALLE' }, { t: 'FORMA', w: 90 }, { t: 'VALOR', w: 80, a: 'right', b: true }],
        r.anticipos.map(a => [fechaTabla(a.momento), a.descripcion, forma(a.forma), dinero(a.monto)]),
        { vacio: 'No hubo anticipos registrados en esta caja.', total: r.anticipos.length ? ['TOTAL ANTICIPOS', dinero(r.totales.anticipos)] : null });

    if (r.reaperturas.length) {
        tabla('REAPERTURAS', [{ t: 'REABIERTA', w: 80 }, { t: 'POR', w: 110 }, { t: 'MOTIVO' }, { t: 'DIFERENCIA ANTERIOR', w: 110, a: 'right' }],
            r.reaperturas.map(x => [fechaTabla(x.reabierta_at), x.reabierta_por_nombre || `Usuario #${x.reabierta_por}`, x.motivo, resultado(x.cierre?.diferencia == null ? null : Number(x.cierre.diferencia)).texto]),
            { colorTitulo: AMBAR });
    }

    if (s.notas_cierre || s.notas_apertura) {
        saltar(40);
        doc.font(F.b).fontSize(8).fillColor(AZUL).text('NOTAS', M, y, { characterSpacing: 1 });
        y = doc.y + 3;
        if (s.notas_apertura) { doc.font(F.n).fontSize(8).fillColor(TXT).text(`Apertura: ${limpio(s.notas_apertura)}`, M, y, { width: W }); y = doc.y + 2; }
        if (s.notas_cierre) { doc.font(F.n).fontSize(8).fillColor(TXT).text(`Cierre: ${limpio(s.notas_cierre)}`, M, y, { width: W }); y = doc.y + 2; }
        y += 8;
    }

    // ── Firmas ──
    saltar(80);
    y += 40;
    const anchoFirma = (W - 60) / 2;
    for (const [i, et, nombre] of [[0, 'Aprobado por', ''], [1, 'Cajero / Entregado', limpio(s.cajero_nombre)]]) {
        const x0 = M + i * (anchoFirma + 60);
        doc.moveTo(x0, y).lineTo(x0 + anchoFirma, y).lineWidth(0.8).strokeColor(TXT).stroke();
        doc.font(F.b).fontSize(8).fillColor(TXT).text(et, x0, y + 5, { width: anchoFirma, align: 'center' });
        if (nombre) doc.font(F.n).fontSize(7.5).fillColor(MUT).text(nombre, x0, doc.y + 1, { width: anchoFirma, align: 'center' });
    }

    // ── Marca de agua (caja abierta) y pie en cada página ──
    const rango = doc.bufferedPageRange();
    const generado = fechaHora(new Date());
    for (let i = rango.start; i < rango.start + rango.count; i++) {
        doc.switchToPage(i);
        if (!r.cerrada) {
            doc.save();
            doc.rotate(-32, { origin: [doc.page.width / 2, doc.page.height / 2] });
            doc.font(F.b).fontSize(70).fillColor(AMBAR).opacity(0.09)
                .text('PRELIMINAR', 0, doc.page.height / 2 - 40, { width: doc.page.width, align: 'center', lineBreak: false });
            doc.restore();
            doc.opacity(1);
        }
        const yPie = doc.page.height - M - 26;
        const margenOriginal = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        doc.moveTo(M, yPie).lineTo(M + W, yPie).lineWidth(0.6).strokeColor(BORDE).stroke();
        doc.font(F.n).fontSize(6.6).fillColor(MUT)
            .text(r.cerrada ? 'El cuadre muestra los valores registrados al cerrar la caja.' : 'Caja abierta: los valores pueden cambiar hasta el cierre.', M, yPie + 6, { width: W - 130 });
        doc.text(`Página ${i - rango.start + 1} de ${rango.count}`, M + W - 125, yPie + 6, { width: 125, align: 'right' });
        doc.text(`Generado ${generado}`, M + W - 125, yPie + 15, { width: 125, align: 'right', lineBreak: false });
        doc.page.margins.bottom = margenOriginal;
    }
    doc.end();
    return fin;
}

module.exports = { generarCajaPdf };
