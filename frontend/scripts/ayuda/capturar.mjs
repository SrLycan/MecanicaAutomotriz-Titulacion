/**
 * SS SWAP - Capturas REALES para el centro de ayuda (Sprint 27)
 *
 *   npm run ayuda:capturas                       # todas las guías
 *   npm run ayuda:capturas -- --guia inventario  # solo una guía
 *
 * Requisitos: frontend (npm start, por defecto http://localhost:3001) y
 * backend LOCAL con la empresa demo (node scripts/ayuda/preparar-demo.mjs).
 * Para las guías de la plataforma: AYUDA_SUPER_EMAIL / AYUDA_SUPER_PASSWORD.
 *
 * Sin dependencias: abre Edge o Chrome sin ventana y lo maneja con el
 * protocolo DevTools (WebSocket nativo de Node 22+). Por cada paso de guía
 * que tenga "imagen.captura":
 *   1. abre la ruta real, ejecuta las acciones (clics, texto) y espera;
 *   2. oculta correos y teléfonos que pudieran aparecer;
 *   3. dibuja un recuadro numerado sobre cada "marca" (mismo orden que la
 *      leyenda de la guía) y recorta la zona;
 *   4. guarda el PNG en public/ayuda/<archivo> y registra en
 *      public/ayuda/manifiesto.json la ruta, la fecha y el commit.
 * Si un control documentado ya no existe, el paso se reporta como FALLIDO
 * (la guía quedó desactualizada) y el proceso termina con código 1.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(DIR, '../..');
const GUIAS_DIR = path.join(RAIZ, 'src/ayuda/guias');
const SALIDA = path.join(RAIZ, 'public/ayuda');
const BASE = process.env.AYUDA_BASE || 'http://localhost:3001';
const ANCHO = 1366; const ALTO = 860;
const args = process.argv.slice(2);
const soloGuia = args.includes('--guia') ? args[args.indexOf('--guia') + 1] : null;

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) { console.error('Solo se capturan entornos locales.'); process.exit(1); }

const espera = (ms) => new Promise(r => setTimeout(r, ms));

function navegador() {
    const candidatos = [process.env.AYUDA_NAVEGADOR,
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
    const ok = candidatos.find(c => fs.existsSync(c));
    if (!ok) throw new Error('No se encontró Edge ni Chrome. Defina AYUDA_NAVEGADOR.');
    return ok;
}

/** Cliente mínimo del protocolo DevTools. */
async function conectar(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((ok, mal) => { ws.onopen = ok; ws.onerror = mal; });
    let id = 0;
    const pendientes = new Map();
    const oyentes = new Map();
    ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && pendientes.has(m.id)) {
            const { ok, mal } = pendientes.get(m.id); pendientes.delete(m.id);
            if (m.error) mal(new Error(m.error.message)); else ok(m.result);
        } else if (m.method && oyentes.has(m.method)) oyentes.get(m.method).forEach(f => f(m.params));
    };
    const enviar = (method, params = {}) => new Promise((ok, mal) => { const n = ++id; pendientes.set(n, { ok, mal }); ws.send(JSON.stringify({ id: n, method, params })); });
    const una = (method) => new Promise(ok => { const f = (p) => { oyentes.set(method, (oyentes.get(method) || []).filter(x => x !== f)); ok(p); }; oyentes.set(method, [...(oyentes.get(method) || []), f]); });
    return { enviar, una, cerrar: () => ws.close() };
}

async function abrirNavegador() {
    const puerto = 9300 + Math.floor(Math.random() * 500);
    const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'ssswap-ayuda-'));
    const proc = spawn(navegador(), [`--remote-debugging-port=${puerto}`, `--user-data-dir=${perfil}`, '--headless=new', '--no-first-run',
        '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', `--window-size=${ANCHO},${ALTO}`, 'about:blank'], { stdio: 'ignore' });
    let lista = null;
    for (let i = 0; i < 50 && !lista; i++) { await espera(200); try { lista = await (await fetch(`http://127.0.0.1:${puerto}/json/list`)).json(); } catch { /* aún no */ } }
    const pagina = lista?.find(x => x.type === 'page');
    if (!pagina) throw new Error('No se pudo abrir el navegador sin ventana.');
    const cdp = await conectar(pagina.webSocketDebuggerUrl);
    await cdp.enviar('Page.enable'); await cdp.enviar('Runtime.enable');
    await cdp.enviar('Emulation.setDeviceMetricsOverride', { width: ANCHO, height: ALTO, deviceScaleFactor: 1, mobile: false });
    return { cdp, cerrar: () => {
        cdp.cerrar();
        // En Windows proc.kill() deja vivos los procesos hijos del navegador: se cierra el árbol completo.
        if (process.platform === 'win32') {
            try { execSync(`taskkill /PID ${proc.pid} /T /F`, { stdio: 'ignore' }); } catch { /* ya cerrado */ }
            // Edge sin ventana a veces deja procesos fuera del árbol: se cierran los que usan este perfil temporal.
            const nombre = path.basename(perfil);
            try {
                execSync(`powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='msedge.exe' OR Name='chrome.exe'\\" | Where-Object { $_.CommandLine -like '*${nombre}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`, { stdio: 'ignore' });
            } catch { /* nada que cerrar */ }
        }
        else proc.kill();
        // El navegador libera el perfil temporal unos instantes después de cerrarse.
        setTimeout(() => { try { fs.rmSync(perfil, { recursive: true, force: true }); } catch { /* lo limpia el sistema */ } }, 2500);
    } };
}

async function evaluar(cdp, fn, ...params) {
    const r = await cdp.enviar('Runtime.evaluate', { expression: `(${fn})(...${JSON.stringify(params)})`, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
}
async function ir(cdp, url) {
    const carga = cdp.una('Page.loadEventFired');
    await cdp.enviar('Page.navigate', { url });
    await Promise.race([carga, espera(15000)]);
}

// ── Código que corre DENTRO de la página ──
// Busca un control: { ayuda } -> [data-ayuda], { texto } -> elemento cuyo texto propio coincide,
// { placeholder }, { etiqueta } (aria-label/title) o { selector } CSS.
const BUSCAR = `function buscar(o) {
    const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const ambito = document.querySelector('.ayuda-ambito-forzado') || document;
    let lista = [];
    if (o.ayuda) lista = [...ambito.querySelectorAll('[data-ayuda="' + o.ayuda + '"]')];
    else if (o.selector) lista = [...ambito.querySelectorAll(o.selector)];
    else if (o.placeholder) lista = [...ambito.querySelectorAll('[placeholder]')].filter(e => e.placeholder.toLowerCase().includes(o.placeholder.toLowerCase()));
    else if (o.etiqueta) lista = [...ambito.querySelectorAll('[aria-label],[title]')].filter(e => ((e.getAttribute('aria-label') || '') + '|' + (e.getAttribute('title') || '')).toLowerCase().includes(o.etiqueta.toLowerCase()));
    else if (o.contiene) {
        const t = o.contiene.trim().toLowerCase();
        lista = [...ambito.querySelectorAll(o.tag || 'button,a,h1,h2,h3,h4,label,th,p,span,div,li')]
            .filter(e => (e.innerText || '').toLowerCase().replace(/\\s+/g, ' ').includes(t));
        lista.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
    }
    else if (o.texto) {
        const t = o.texto.trim().toLowerCase();
        lista = [...ambito.querySelectorAll(o.tag || 'button,a,h1,h2,h3,h4,label,th,p,span,div,li,select,option')]
            .filter(e => (e.innerText || '').trim().toLowerCase().replace(/\\s+/g, ' ').startsWith(t));
        lista.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length);
    }
    if (o.campo) {
        // Campo de formulario: su etiqueta + el control (el contenedor de ambos).
        const t = o.campo.trim().toLowerCase();
        lista = [...ambito.querySelectorAll('label,p,span')].filter(e => (e.innerText || '').trim().toLowerCase().startsWith(t)).map(e => e.parentElement);
    }
    lista = lista.filter(visible);
    let el = lista[o.indice || 0] || null;
    for (let i = 0; el && i < (o.subir || 0); i++) el = el.parentElement;
    return el;
}`;

async function prepararPagina(cdp, esperarObjetivos) {
    // Espera a que la página termine de cargar sus datos (sin "Cargando…").
    for (let i = 0; i < 40; i++) {
        const listo = await evaluar(cdp, `function(objs) { ${BUSCAR}
            const main = document.querySelector('.main-content-pad') || document.body;
            const cargando = /Cargando/i.test(main.innerText || '');
            return !cargando && objs.every(o => buscar(o));
        }`, esperarObjetivos);
        if (listo) break;
        await espera(300);
    }
    await espera(500);
    await evaluar(cdp, `function() {
        // Aviso emergente de stock bajo: no forma parte de la sección documentada.
        const ign = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'IGNORAR');
        if (ign) ign.click();
        // Los avisos flotantes (toasts) no son parte de la pantalla documentada.
        document.querySelectorAll('[aria-live]').forEach(t => { if (!t.closest('.main-content-pad') && !t.closest('.modal-box')) t.style.visibility = 'hidden'; });
    }`);
}

async function accion(cdp, a) {
    if (a.esperar) return espera(a.esperar);
    return evaluar(cdp, `function(a) { ${BUSCAR}
        const o = a.clic || a.escribir?.objetivo || a.elegir?.objetivo || a.desplazar;
        const e = buscar(o);
        if (!e) throw new Error('No se encontró el control ' + JSON.stringify(o));
        e.scrollIntoView({ block: 'center' });
        if (a.clic) { e.click(); return true; }
        if (a.desplazar) return true;
        const proto = e.tagName === 'SELECT' ? HTMLSelectElement.prototype : e.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(e, a.escribir ? a.escribir.valor : a.elegir.valor);
        e.dispatchEvent(new Event(a.escribir ? 'input' : 'change', { bubbles: true }));
        return true;
    }`, a).then(() => espera(a.pausa ?? 700));
}

/** Oculta datos personales, termina animaciones, numera las marcas y devuelve la zona a recortar. */
async function anotar(cdp, marcas, recorte) {
    return evaluar(cdp, `function(marcas, recorte) { ${BUSCAR}
        document.getAnimations().forEach(x => { try { x.finish(); } catch (e) {} });
        document.querySelectorAll('[aria-live]').forEach(t => { if (!t.closest('.main-content-pad') && !t.closest('.modal-box')) t.style.visibility = 'hidden'; });
        const caminar = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        while (caminar.nextNode()) {
            const n = caminar.currentNode;
            n.nodeValue = n.nodeValue
                .replace(/[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+/g, 'correo@ejemplo.test')
                .replace(/(\\+593[\\s-]?\\d[\\d\\s-]{7,}|\\b09\\d{8}\\b)/g, '09XXXXXXXX');
        }
        document.querySelectorAll('.ayuda-marca').forEach(x => x.remove());
        const rects = [];
        const faltan = [];
        marcas.forEach((m, i) => {
            const e = m.objetivo ? buscar(m.objetivo) : null;
            if (m.objetivo && !e) { faltan.push(JSON.stringify(m.objetivo)); return; }
            if (!e) return;
            if (i === 0) e.scrollIntoView({ block: 'center' });
        });
        marcas.forEach((m, i) => {
            const e = m.objetivo ? buscar(m.objetivo) : null;
            if (!e) return;
            const r = e.getBoundingClientRect();
            rects.push(r);
            const caja = document.createElement('div');
            caja.className = 'ayuda-marca';
            caja.style.cssText = 'position:fixed;z-index:99999;pointer-events:none;border:3px solid #e11d48;border-radius:8px;box-shadow:0 0 0 3px rgba(225,29,72,.25);'
                + 'left:' + (r.left - 5) + 'px;top:' + (r.top - 5) + 'px;width:' + (r.width + 10) + 'px;height:' + (r.height + 10) + 'px;';
            const n = document.createElement('div');
            n.className = 'ayuda-marca';
            n.textContent = String(i + 1);
            const izq = Math.max(r.left - 18, 2), arr = Math.max(r.top - 18, 2);
            n.style.cssText = 'position:fixed;z-index:100000;pointer-events:none;width:26px;height:26px;border-radius:50%;background:#e11d48;color:#fff;'
                + 'font:700 14px/26px system-ui,sans-serif;text-align:center;box-shadow:0 2px 6px rgba(0,0,0,.35);left:' + izq + 'px;top:' + arr + 'px;';
            document.body.append(caja, n);
        });
        const W = innerWidth, H = innerHeight;
        let zona;
        const el = recorte?.selector ? document.querySelector(recorte.selector) : null;
        if (el) { const r = el.getBoundingClientRect(); zona = { x: r.left - 12, y: r.top - 12, w: r.width + 24, h: r.height + 24 }; }
        else if (recorte === 'pantalla' || !rects.length) {
            const m = document.querySelector('.main-content-pad');
            const r = m ? m.getBoundingClientRect() : { left: 0, top: 0, width: W, height: H };
            zona = { x: r.left, y: 0, w: r.width, h: H };
        } else {
            const x1 = Math.min(...rects.map(r => r.left)) - 60, y1 = Math.min(...rects.map(r => r.top)) - 60;
            const x2 = Math.max(...rects.map(r => r.right)) + 60, y2 = Math.max(...rects.map(r => r.bottom)) + 60;
            const w = Math.max(x2 - x1, 760), h = Math.max(y2 - y1, 380);
            zona = { x: x1 - (w - (x2 - x1)) / 2, y: y1 - (h - (y2 - y1)) / 2, w, h };
        }
        zona.x = Math.max(0, zona.x); zona.y = Math.max(0, zona.y);
        zona.w = Math.min(zona.w, W - zona.x); zona.h = Math.min(zona.h, H - zona.y);
        return { zona, faltan };
    }`, marcas, recorte || null);
}

async function sesion(cdp, cred) {
    await ir(cdp, `${BASE}/admin/login`);
    await evaluar(cdp, `function() { localStorage.clear(); localStorage.setItem('SS SWAP_theme', 'light'); }`);
    await ir(cdp, `${BASE}/admin/login`);
    await espera(1200);
    await evaluar(cdp, `function(c) {
        const poner = (e, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(e, v); e.dispatchEvent(new Event('input', { bubbles: true })); };
        poner(document.querySelector('input[type=email]'), c.email);
        poner(document.querySelector('input[type=password]'), c.password);
        document.querySelector('input[type=password]').form.requestSubmit();
    }`, cred);
    for (let i = 0; i < 30; i++) { await espera(300); if (await evaluar(cdp, 'function() { return location.pathname.startsWith("/dashboard"); }')) return; }
    const detalle = await evaluar(cdp, `function() { return location.pathname + ' | ' + Array.from(document.querySelectorAll('[role=status]')).map(t => t.textContent).join(' / ') + ' | inputs=' + document.querySelectorAll('input').length + ' email=' + ((document.querySelector('input[type=email]') || {}).value || '').length; }`);
    throw new Error(`No se pudo iniciar sesión como ${cred.email} (${detalle}).`);
}

function guias() {
    return fs.readdirSync(GUIAS_DIR).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(GUIAS_DIR, f), 'utf8')));
}

async function main() {
    const credDemo = JSON.parse(fs.readFileSync(path.join(DIR, '.demo-credenciales.json'), 'utf8'));
    const credSuper = process.env.AYUDA_SUPER_EMAIL ? { email: process.env.AYUDA_SUPER_EMAIL, password: process.env.AYUDA_SUPER_PASSWORD } : null;
    const manifiestoRuta = path.join(SALIDA, 'manifiesto.json');
    const manifiesto = fs.existsSync(manifiestoRuta) ? JSON.parse(fs.readFileSync(manifiestoRuta, 'utf8')) : { imagenes: {} };
    let commit = 'sin-git';
    try { commit = execSync('git rev-parse --short HEAD', { cwd: RAIZ }).toString().trim(); } catch { /* sin git */ }

    const trabajos = [];
    for (const g of guias()) {
        if (soloGuia && g.id !== soloGuia) continue;
        (g.pasos || []).forEach((p, i) => { if (p.imagen?.captura) trabajos.push({ g, p, i }); });
    }
    const porSesion = { demo: trabajos.filter(t => (t.p.imagen.captura.como || 'demo') === 'demo'), superadmin: trabajos.filter(t => t.p.imagen.captura.como === 'superadmin') };
    const { cdp, cerrar } = await abrirNavegador();
    let fallos = 0;
    try {
        for (const [quien, lista] of Object.entries(porSesion)) {
            if (!lista.length) continue;
            if (quien === 'superadmin' && !credSuper) { console.log(`Omitidas ${lista.length} capturas de plataforma (defina AYUDA_SUPER_EMAIL / AYUDA_SUPER_PASSWORD).`); continue; }
            await sesion(cdp, quien === 'superadmin' ? credSuper : credDemo);
            for (const { g, p, i } of lista) {
                const c = p.imagen.captura;
                try {
                    await ir(cdp, BASE + c.url);
                    await prepararPagina(cdp, c.esperar ? [c.esperar] : []);
                    for (const a of c.acciones || []) await accion(cdp, a);
                    await espera(400);
                    const { zona, faltan } = await anotar(cdp, (p.marcas || []).filter(m => typeof m === 'object'), c.recorte);
                    if (faltan.length) throw new Error(`controles documentados que no aparecen: ${faltan.join(', ')}`);
                    const { data } = await cdp.enviar('Page.captureScreenshot', { format: 'png', clip: { x: zona.x, y: zona.y, width: zona.w, height: zona.h, scale: 1 } });
                    const destino = path.join(SALIDA, p.imagen.archivo);
                    fs.mkdirSync(path.dirname(destino), { recursive: true });
                    fs.writeFileSync(destino, Buffer.from(data, 'base64'));
                    manifiesto.imagenes[p.imagen.archivo] = { guia: g.id, paso: i + 1, url: c.url, version_guia: g.version, capturada: new Date().toISOString(), commit, tema: 'claro', viewport: `${ANCHO}x${ALTO}` };
                    console.log(`  ✓ ${g.id} · paso ${i + 1} → ${p.imagen.archivo}`);
                } catch (e) {
                    fallos++;
                    console.log(`  ✗ ${g.id} · paso ${i + 1}: ${e.message}`);
                }
            }
        }
    } finally { cerrar(); }
    manifiesto.generado = new Date().toISOString();
    fs.writeFileSync(manifiestoRuta, JSON.stringify(manifiesto, null, 2));
    console.log(`${trabajos.length - fallos} captura(s) correctas, ${fallos} con error.`);
    if (fallos) process.exit(1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
