/**
 * SS SWAP - Geometria de los pictogramas vehiculares (proformas de colisiones)
 *
 * FUENTE UNICA de la geometria: el MISMO archivo lo usan
 *  - el frontend (SVG interactivo, components/proformas/vehiculo/)
 *  - el backend  (PDF con PDFKit via doc.path(), proformaPdf.service.js)
 *  - el backend  (validacion de codigos de zona en proformas.controller.js)
 *
 * El frontend tiene una copia identica en
 * frontend/src/components/proformas/vehiculo/vehiculoDiagramas.js (create-
 * react-app no puede importar fuera de src/). La prueba
 * src/shared/__tests__/vehiculoDiagramas.test.js falla si ambas copias se
 * desincronizan.
 *
 * NO hay coordenadas "magicas" dibujadas a mano por zona: cada carroceria se
 * describe con un puñado de PARAMETROS (proporciones a lo largo del vehiculo y
 * alturas), y las zonas se derivan de ellos. Para ajustar un modelo basta con
 * tocar sus parametros en CARROCERIAS.
 *
 * Vista "desplegada" estandar de peritaje de colisiones:
 *   fila 1: lado izquierdo (frente hacia la izquierda)
 *   fila 2: frente | vista superior | posterior
 *   fila 3: lado derecho (frente hacia la derecha)
 */

const ANCHO = 820;
const ALTO = 590;
const L = 440;            // largo MAXIMO del vehiculo en las vistas lateral y superior
const X0 = 190;           // inicio horizontal del area de las vistas lateral/superior
const Y_IZQ = 22;         // origen vertical de la vista lateral izquierda
const Y_SUP = 212;        // origen vertical de la vista superior
const Y_DER = 428;        // origen vertical de la vista lateral derecha
const ALTO_LATERAL = 140; // alto del recuadro lateral (suelo en y=140)
const ANCHO_SUP = 150;    // ancho del vehiculo en la vista superior
const FRENTE_X = 10;      // vista frontal
const POST_X = 690;       // vista posterior
const ANCHO_FP = 120;     // ancho de las vistas frontal/posterior

/*
 * Parametros por carroceria. Fracciones (0 = punta delantera, 1 = punta
 * trasera) y alturas en el recuadro lateral (0 = arriba, 140 = suelo).
 *  w: base del parabrisas · rs/re: inicio/fin del techo · d: base de la
 *  luneta (o fondo de cabina en pickup) · d1/d2/d3: cortes de puertas ·
 *  wf/wr: centro de ruedas · cama: inicio del balde (pickup) ·
 *  largo: largo relativo (1 = L) para que un hatchback se vea mas corto
 *  que un sedan o una pickup.
 */
const CARROCERIAS = {
    sedan: {
        etiqueta: 'Sedán', puertas: [4], puertasDefecto: 4, largo: 0.94,
        roof: 22, belt: 70, sill: 116, hoodF: 78, deck: 72, r: 21,
        w: 0.30, rs: 0.42, re: 0.66, d: 0.80, wf: 0.17, wr: 0.80,
        puertasCortes: { 4: { d1: 0.33, d2: 0.53, d3: 0.72 } },
        trasera: 'maletero',
    },
    hatchback: {
        etiqueta: 'Hatchback', puertas: [3, 5], puertasDefecto: 5, largo: 0.80,
        roof: 20, belt: 68, sill: 116, hoodF: 76, deck: 68, r: 21,
        w: 0.27, rs: 0.41, re: 0.80, d: 0.95, wf: 0.17, wr: 0.82,
        puertasCortes: { 5: { d1: 0.33, d2: 0.55, d3: 0.75 }, 3: { d1: 0.33, d2: 0.67, d3: 0.67 } },
        trasera: 'compuerta',
    },
    suv: {
        etiqueta: 'SUV', puertas: [5], puertasDefecto: 5, largo: 0.92,
        roof: 6, belt: 58, sill: 102, hoodF: 60, deck: 58, r: 28,
        w: 0.25, rs: 0.34, re: 0.93, d: 0.975, wf: 0.17, wr: 0.82,
        puertasCortes: { 5: { d1: 0.31, d2: 0.52, d3: 0.73 } },
        trasera: 'compuerta',
    },
    pickup: {
        etiqueta: 'Pickup', puertas: [2, 4], puertasDefecto: 4, largo: 1,
        roof: 10, belt: 62, sill: 106, hoodF: 64, deck: 62, r: 26,
        w: 0.26, rs: 0.35, re: 0.56, d: 0.60, wf: 0.16, wr: 0.80,
        puertasCortes: {
            4: { d1: 0.29, d2: 0.45, d3: 0.59, re: 0.565, d: 0.59, cama: 0.61 },
            2: { d1: 0.29, d2: 0.465, d3: 0.465, re: 0.445, d: 0.465, cama: 0.485 },
        },
        trasera: 'compuerta',
    },
};

const TIPOS_CARROCERIA = Object.keys(CARROCERIAS);

const ETIQUETAS_ZONA = {
    parachoques_delantero: 'Parachoques delantero',
    frente: 'Parte frontal',
    capo: 'Capó',
    techo: 'Techo',
    maletero: 'Maletero',
    compuerta: 'Compuerta trasera',
    balde: 'Balde / cajón',
    parte_trasera: 'Parte trasera (panel posterior)',
    parachoques_trasero: 'Parachoques trasero',
    guardafango_del_izq: 'Guardafango delantero izquierdo',
    guardafango_del_der: 'Guardafango delantero derecho',
    puerta_del_izq: 'Puerta delantera izquierda',
    puerta_del_der: 'Puerta delantera derecha',
    puerta_tras_izq: 'Puerta trasera izquierda',
    puerta_tras_der: 'Puerta trasera derecha',
    guardafango_tras_izq: 'Guardafango trasero izquierdo',
    guardafango_tras_der: 'Guardafango trasero derecho',
    costado_balde_izq: 'Costado del balde izquierdo',
    costado_balde_der: 'Costado del balde derecho',
    parante_a_izq: 'Parante A izquierdo',
    parante_a_der: 'Parante A derecho',
    parante_b_izq: 'Parante B izquierdo',
    parante_b_der: 'Parante B derecho',
    parante_c_izq: 'Parante C izquierdo',
    parante_c_der: 'Parante C derecho',
    estribo_izq: 'Lateral / estribo izquierdo',
    estribo_der: 'Lateral / estribo derecho',
};

const r1 = (n) => Math.round(n * 10) / 10;
const poligono = (pts) => 'M' + pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join(' L') + ' Z';
const rect = (x1, y1, x2, y2) => poligono([[x1, y1], [x2, y1], [x2, y2], [x1, y2]]);
const circulo = (cx, cy, r) => `M${r1(cx - r)} ${r1(cy)} A${r} ${r} 0 1 0 ${r1(cx + r)} ${r1(cy)} A${r} ${r} 0 1 0 ${r1(cx - r)} ${r1(cy)} Z`;

/** Normaliza la cantidad de puertas a una opcion valida de la carroceria. */
function normalizarPuertas(tipo, puertas) {
    const c = CARROCERIAS[tipo];
    if (!c) return null;
    const n = Number(puertas);
    return c.puertas.includes(n) ? n : c.puertasDefecto;
}

/** Vista lateral. lado: 'izq' (frente a la izquierda) | 'der' (espejo). */
function vistaLateral(p, lado, y0, zonas, decor) {
    const tx = (t) => (lado === 'izq' ? p.Xt + t * p.Lt : p.Xt + (1 - t) * p.Lt);
    const Y = (y) => y0 + y;
    const P = (pts) => poligono(pts.map(([t, y]) => [tx(t), Y(y)]));
    const pw = 8 / p.Lt; // ancho de parante en fraccion
    const bf = 0.04, br = 0.96;
    const topeParachoques = p.sill - 22;
    const add = (codigo, d) => zonas.push({ codigo: `${codigo}_${lado}`, d });
    const addComun = (codigo, d) => zonas.push({ codigo, d });

    // Contorno general (decorativo, debajo de las zonas)
    const contorno = p.esPickup
        ? [[0, p.hoodF + 6], [0.004, p.hoodF], [p.w, p.belt], [p.rs, p.roof], [p.re, p.roof], [p.d, p.belt],
           [0.996, p.belt], [1, p.belt + 4], [1, p.sill - 4], [0.992, p.sill], [0.008, p.sill], [0, p.sill - 4]]
        : [[0, p.hoodF + 6], [0.004, p.hoodF], [p.w, p.belt], [p.rs, p.roof], [p.re, p.roof], [p.d, p.belt],
           [0.996, p.deck], [1, p.deck + 6], [1, p.sill - 4], [0.992, p.sill], [0.008, p.sill], [0, p.sill - 4]];
    decor.push({ clase: 'carroceria', d: P(contorno) });

    // Techo (franja superior, mismo codigo que en la vista superior)
    addComun('techo', P([[p.rs, p.roof - 1], [p.re, p.roof - 1], [p.re, p.roof + 4], [p.rs, p.roof + 4]]));

    // Vidrios (decorativos) + parantes
    const tieneB = p.d2 < p.d - 0.02 && p.d2 > p.rs + 0.02;
    const xb = p.d2;
    if (tieneB) {
        decor.push({ clase: 'vidrio', d: P([[p.w + pw, p.belt], [p.rs + pw, p.roof + 4], [xb - pw / 2, p.roof + 4], [xb - pw / 2, p.belt]]) });
        decor.push({ clase: 'vidrio', d: P([[xb + pw / 2, p.roof + 4], [p.re - pw, p.roof + 4], [p.d - pw, p.belt], [xb + pw / 2, p.belt]]) });
    } else {
        decor.push({ clase: 'vidrio', d: P([[p.w + pw, p.belt], [p.rs + pw, p.roof + 4], [p.re - pw, p.roof + 4], [p.d - pw, p.belt]]) });
    }
    add('parante_a', P([[p.w, p.belt], [p.w + pw, p.belt], [p.rs + pw, p.roof + 4], [p.rs, p.roof + 4]]));
    if (tieneB) add('parante_b', P([[xb - pw / 2, p.roof + 4], [xb + pw / 2, p.roof + 4], [xb + pw / 2, p.belt], [xb - pw / 2, p.belt]]));
    add('parante_c', P([[p.re - pw, p.roof + 4], [p.re, p.roof + 4], [p.d, p.belt], [p.d - pw, p.belt]]));

    // Parachoques delantero
    addComun('parachoques_delantero', P([[0, topeParachoques], [bf, topeParachoques], [bf, p.sill], [0.008, p.sill], [0, p.sill - 4]]));
    // Guardafango delantero (incluye el arco de la rueda)
    add('guardafango_del', P([[0, p.hoodF + 6], [0.004, p.hoodF], [p.w, p.belt], [p.d1, p.belt], [p.d1, p.sill], [bf, p.sill], [bf, topeParachoques], [0, topeParachoques]]));
    // Puertas
    const finPuertas = p.d3;
    add('puerta_del', P([[p.d1 + 0.002, p.belt], [p.d2 - 0.002, p.belt], [p.d2 - 0.002, p.sill - 7], [p.d1 + 0.002, p.sill - 7]]));
    if (p.d3 > p.d2 + 0.01) {
        add('puerta_tras', P([[p.d2 + 0.002, p.belt], [p.d3 - 0.002, p.belt], [p.d3 - 0.002, p.sill - 7], [p.d2 + 0.002, p.sill - 7]]));
    }
    // Estribo / lateral bajo puertas
    add('estribo', P([[p.d1, p.sill - 7], [finPuertas, p.sill - 7], [finPuertas, p.sill], [p.d1, p.sill]]));

    if (p.esPickup) {
        // Separacion cabina-balde (decorativa) + costado del balde
        decor.push({ clase: 'carroceria-oscura', d: P([[p.d3, p.belt], [p.cama, p.belt], [p.cama, p.sill], [p.d3, p.sill]]) });
        add('costado_balde', P([[p.cama, p.belt], [0.996, p.belt], [1, p.belt + 4], [1, topeParachoques], [br, topeParachoques], [br, p.sill], [p.cama, p.sill]]));
    } else {
        add('guardafango_tras', P([[p.d3, p.belt], [p.d, p.belt], [0.996, p.deck], [1, p.deck + 6], [1, topeParachoques], [br, topeParachoques], [br, p.sill], [p.d3, p.sill]]));
    }
    addComun('parachoques_trasero', P([[br, topeParachoques], [1, topeParachoques], [1, p.sill - 4], [0.992, p.sill], [br, p.sill]]));

    // Ruedas (decorativas, dibujadas encima; no capturan clics)
    const cy = Y(ALTO_LATERAL - p.r);
    decor.push({ clase: 'rueda', d: circulo(tx(p.wf), cy, p.r), sobre: true });
    decor.push({ clase: 'rueda', d: circulo(tx(p.wr), cy, p.r), sobre: true });
    decor.push({ clase: 'llanta', d: circulo(tx(p.wf), cy, p.r * 0.45), sobre: true });
    decor.push({ clase: 'llanta', d: circulo(tx(p.wr), cy, p.r * 0.45), sobre: true });
}

/** Vista superior (planta), frente a la izquierda. */
function vistaSuperior(p, zonas, decor) {
    const x = (t) => p.Xt + t * p.Lt;
    const y = (v) => Y_SUP + v;
    const W = ANCHO_SUP;
    const pb = 12 / p.Lt;
    decor.push({ clase: 'carroceria', d: poligono([[x(0), y(14)], [x(0.02), y(2)], [x(0.98), y(2)], [x(1), y(14)], [x(1), y(W - 14)], [x(0.98), y(W - 2)], [x(0.02), y(W - 2)], [x(0), y(W - 14)]]) });
    zonas.push({ codigo: 'parachoques_delantero', d: poligono([[x(0), y(16)], [x(0.012), y(6)], [x(pb), y(6)], [x(pb), y(W - 6)], [x(0.012), y(W - 6)], [x(0), y(W - 16)]]) });
    zonas.push({ codigo: 'capo', d: poligono([[x(pb + 0.004), y(12)], [x(p.w), y(16)], [x(p.w), y(W - 16)], [x(pb + 0.004), y(W - 12)]]) });
    decor.push({ clase: 'vidrio', d: poligono([[x(p.w), y(18)], [x(p.rs), y(24)], [x(p.rs), y(W - 24)], [x(p.w), y(W - 18)]]) });
    zonas.push({ codigo: 'techo', d: rect(x(p.rs), y(24), x(p.re), y(W - 24)) });
    if (p.esPickup) {
        decor.push({ clase: 'vidrio', d: poligono([[x(p.re), y(24)], [x(p.d), y(20)], [x(p.d), y(W - 20)], [x(p.re), y(W - 24)]]) });
        decor.push({ clase: 'carroceria-oscura', d: rect(x(p.d), y(10), x(p.cama), y(W - 10)) });
        zonas.push({ codigo: 'balde', d: rect(x(p.cama + 0.01), y(18), x(1 - 2.6 * pb), y(W - 18)) });
        zonas.push({ codigo: 'compuerta', d: rect(x(1 - 2.4 * pb), y(10), x(1 - pb - 0.002), y(W - 10)) });
    } else {
        decor.push({ clase: 'vidrio', d: poligono([[x(p.re), y(24)], [x(p.d), y(20)], [x(p.d), y(W - 20)], [x(p.re), y(W - 24)]]) });
        zonas.push({ codigo: p.trasera, d: poligono([[x(p.d), y(14)], [x(1 - pb - 0.002), y(12)], [x(1 - pb - 0.002), y(W - 12)], [x(p.d), y(W - 14)]]) });
    }
    zonas.push({ codigo: 'parachoques_trasero', d: poligono([[x(1 - pb), y(6)], [x(0.988), y(6)], [x(1), y(16)], [x(1), y(W - 16)], [x(0.988), y(W - 6)], [x(1 - pb), y(W - 6)]]) });
    // Espejos (decorativos)
    decor.push({ clase: 'carroceria-oscura', d: rect(x(p.w + 0.01), y(-6), x(p.w + 0.035), y(2)) });
    decor.push({ clase: 'carroceria-oscura', d: rect(x(p.w + 0.01), y(W - 2), x(p.w + 0.035), y(W + 6)) });
}

/** Vista frontal (posterior=false) o posterior (posterior=true). */
function vistaFrontalPosterior(p, posterior, zonas, decor) {
    const bx = posterior ? POST_X : FRENTE_X;
    const by = Y_SUP + 4;
    const X = (v) => bx + v;
    const Y = (v) => by + v;
    const A = ANCHO_FP;
    const topeParachoques = p.sill - 22;
    decor.push({ clase: 'carroceria', d: poligono([[X(20), Y(p.roof)], [X(A - 20), Y(p.roof)], [X(A - 8), Y(p.belt)], [X(A - 2), Y(p.belt + 8)], [X(A - 2), Y(p.sill)], [X(2), Y(p.sill)], [X(2), Y(p.belt + 8)], [X(8), Y(p.belt)]]) });
    // Ruedas vistas de frente
    decor.push({ clase: 'rueda', d: rect(X(6), Y(p.sill), X(24), Y(ALTO_LATERAL)), sobre: true });
    decor.push({ clase: 'rueda', d: rect(X(A - 24), Y(p.sill), X(A - 6), Y(ALTO_LATERAL)), sobre: true });
    zonas.push({ codigo: 'techo', d: rect(X(22), Y(p.roof - 1), X(A - 22), Y(p.roof + 4)) });

    if (!posterior) {
        decor.push({ clase: 'vidrio', d: poligono([[X(23), Y(p.roof + 5)], [X(A - 23), Y(p.roof + 5)], [X(A - 11), Y(p.belt - 3)], [X(11), Y(p.belt - 3)]]) });
        zonas.push({ codigo: 'capo', d: poligono([[X(9), Y(p.belt - 2)], [X(A - 9), Y(p.belt - 2)], [X(A - 4), Y(p.belt + 10)], [X(4), Y(p.belt + 10)]]) });
        zonas.push({ codigo: 'frente', d: rect(X(3), Y(p.belt + 11), X(A - 3), Y(topeParachoques)) });
        zonas.push({ codigo: 'parachoques_delantero', d: rect(X(3), Y(topeParachoques + 1), X(A - 3), Y(p.sill)) });
        // Faros y parrilla (decorativos)
        const fy = p.belt + 14;
        decor.push({ clase: 'faro', d: rect(X(8), Y(fy), X(30), Y(fy + 9)), sobre: true });
        decor.push({ clase: 'faro', d: rect(X(A - 30), Y(fy), X(A - 8), Y(fy + 9)), sobre: true });
        decor.push({ clase: 'parrilla', d: rect(X(38), Y(fy), X(A - 38), Y(topeParachoques - 4)), sobre: true });
    } else if (p.esPickup) {
        decor.push({ clase: 'vidrio', d: rect(X(28), Y(p.roof + 7), X(A - 28), Y(p.belt - 8)) });
        decor.push({ clase: 'carroceria-oscura', d: rect(X(10), Y(p.belt - 4), X(A - 10), Y(p.belt + 2)) });
        zonas.push({ codigo: 'compuerta', d: rect(X(3), Y(p.belt + 3), X(A - 3), Y(topeParachoques)) });
        zonas.push({ codigo: 'parachoques_trasero', d: rect(X(3), Y(topeParachoques + 1), X(A - 3), Y(p.sill)) });
        decor.push({ clase: 'stop', d: rect(X(4), Y(p.belt + 8), X(12), Y(p.belt + 24)), sobre: true });
        decor.push({ clase: 'stop', d: rect(X(A - 12), Y(p.belt + 8), X(A - 4), Y(p.belt + 24)), sobre: true });
    } else if (p.trasera === 'maletero') {
        decor.push({ clase: 'vidrio', d: poligono([[X(23), Y(p.roof + 5)], [X(A - 23), Y(p.roof + 5)], [X(A - 12), Y(p.belt - 3)], [X(12), Y(p.belt - 3)]]) });
        zonas.push({ codigo: 'maletero', d: poligono([[X(10), Y(p.belt - 2)], [X(A - 10), Y(p.belt - 2)], [X(A - 4), Y(p.belt + 14)], [X(4), Y(p.belt + 14)]]) });
        zonas.push({ codigo: 'parte_trasera', d: rect(X(3), Y(p.belt + 15), X(A - 3), Y(topeParachoques)) });
        zonas.push({ codigo: 'parachoques_trasero', d: rect(X(3), Y(topeParachoques + 1), X(A - 3), Y(p.sill)) });
        decor.push({ clase: 'stop', d: rect(X(6), Y(p.belt + 18), X(26), Y(p.belt + 26)), sobre: true });
        decor.push({ clase: 'stop', d: rect(X(A - 26), Y(p.belt + 18), X(A - 6), Y(p.belt + 26)), sobre: true });
    } else {
        const finCompuerta = p.belt + 26;
        zonas.push({ codigo: 'compuerta', d: poligono([[X(21), Y(p.roof + 5)], [X(A - 21), Y(p.roof + 5)], [X(A - 8), Y(p.belt)], [X(A - 4), Y(finCompuerta)], [X(4), Y(finCompuerta)], [X(8), Y(p.belt)]]) });
        decor.push({ clase: 'vidrio', d: poligono([[X(27), Y(p.roof + 9)], [X(A - 27), Y(p.roof + 9)], [X(A - 16), Y(p.belt - 4)], [X(16), Y(p.belt - 4)]]), sobre: true });
        zonas.push({ codigo: 'parte_trasera', d: rect(X(3), Y(finCompuerta + 1), X(A - 3), Y(topeParachoques)) });
        zonas.push({ codigo: 'parachoques_trasero', d: rect(X(3), Y(topeParachoques + 1), X(A - 3), Y(p.sill)) });
        decor.push({ clase: 'stop', d: rect(X(6), Y(p.belt + 4), X(20), Y(p.belt + 20)), sobre: true });
        decor.push({ clase: 'stop', d: rect(X(A - 20), Y(p.belt + 4), X(A - 6), Y(p.belt + 20)), sobre: true });
    }
}

/**
 * Construye el pictograma completo de una carroceria.
 * @returns {{tipo, puertas, ancho, alto, zonas: {codigo,d}[], decor: {clase,d,sobre?}[],
 *            textos: {x,y,texto,anchor}[], codigos: string[]}}
 * `zonas` puede repetir un codigo en varias vistas (ej. el parachoques se ve
 * en la lateral, la superior y la frontal): se resaltan juntas.
 */
function construirDiagrama(tipo, puertas) {
    const base = CARROCERIAS[tipo];
    if (!base) return null;
    const nPuertas = normalizarPuertas(tipo, puertas);
    const Lt = L * base.largo;
    const p = { ...base, ...base.puertasCortes[nPuertas], esPickup: tipo === 'pickup', Lt, Xt: X0 + (L - Lt) / 2 };
    const zonas = [];
    const decor = [];
    vistaLateral(p, 'izq', Y_IZQ, zonas, decor);
    vistaSuperior(p, zonas, decor);
    vistaFrontalPosterior(p, false, zonas, decor);
    vistaFrontalPosterior(p, true, zonas, decor);
    vistaLateral(p, 'der', Y_DER, zonas, decor);

    const textos = [
        { x: X0 + L / 2, y: Y_IZQ - 8, texto: 'LADO IZQUIERDO', anchor: 'middle' },
        { x: X0 + L / 2, y: Y_SUP - 10, texto: 'VISTA SUPERIOR', anchor: 'middle' },
        { x: FRENTE_X + ANCHO_FP / 2, y: Y_SUP - 10, texto: 'FRENTE', anchor: 'middle' },
        { x: POST_X + ANCHO_FP / 2, y: Y_SUP - 10, texto: 'POSTERIOR', anchor: 'middle' },
        { x: X0 + L / 2, y: Y_DER - 8, texto: 'LADO DERECHO', anchor: 'middle' },
    ];
    const codigos = [...new Set(zonas.map(z => z.codigo))];
    return { tipo, puertas: nPuertas, ancho: ANCHO, alto: ALTO, zonas, decor, textos, codigos };
}

/** Codigos de zona validos para una carroceria/puertas. */
function zonasValidas(tipo, puertas) {
    const d = construirDiagrama(tipo, puertas);
    return d ? d.codigos : [];
}

const etiquetaZona = (codigo) => ETIQUETAS_ZONA[codigo] || codigo;

export {
    CARROCERIAS, TIPOS_CARROCERIA, ETIQUETAS_ZONA,
    construirDiagrama, zonasValidas, etiquetaZona, normalizarPuertas,
};
