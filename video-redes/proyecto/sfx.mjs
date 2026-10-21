// Sintetiza la música y los efectos del reel como WAV 16-bit (determinista, sin descargas).
import fs from 'node:fs';
const SR = 44100;
fs.mkdirSync('public/sfx', { recursive: true });

function wav(nombre, muestras) {
  const n = muestras.length, buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  let pico = 0; for (const s of muestras) pico = Math.max(pico, Math.abs(s));
  const g = pico > 0.95 ? 0.95 / pico : 1;
  muestras.forEach((s, i) => buf.writeInt16LE(Math.round(s * g * 32767), 44 + i * 2));
  fs.writeFileSync(`public/sfx/${nombre}.wav`, buf);
}
let semilla = 7; const ruido = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647) * 2 - 1;

// Efectos
const seg = (s) => new Float32Array(Math.round(s * SR));
{ // whoosh: ruido filtrado con envolvente en campana y barrido
  const a = seg(0.45); let lp = 0;
  for (let i = 0; i < a.length; i++) { const t = i / a.length; const k = 0.02 + 0.25 * Math.sin(Math.PI * t); lp += k * (ruido() - lp); a[i] = lp * Math.sin(Math.PI * t) ** 2 * 1.6; }
  wav('whoosh', a);
}
{ // hit: bombo grave + golpe de ruido
  const a = seg(0.7);
  for (let i = 0; i < a.length; i++) { const t = i / SR; const f = 45 + 110 * Math.exp(-t * 18); a[i] = Math.sin(2 * Math.PI * f * t) * Math.exp(-t * 5) + ruido() * Math.exp(-t * 40) * 0.3; }
  wav('hit', a);
}
{ // pop: caída de tono corta
  const a = seg(0.18);
  for (let i = 0; i < a.length; i++) { const t = i / SR; a[i] = Math.sin(2 * Math.PI * (900 * Math.exp(-t * 25) + 300) * t) * Math.exp(-t * 28) * 0.7; }
  wav('pop', a);
}
{ // riser: ruido que sube 1.2 s
  const a = seg(1.2); let lp = 0;
  for (let i = 0; i < a.length; i++) { const t = i / a.length; lp += (0.01 + 0.3 * t * t) * (ruido() - lp); a[i] = lp * t * t * 1.4 + Math.sin(2 * Math.PI * (200 + 600 * t * t) * i / SR) * t * 0.15; }
  wav('riser', a);
}

// Música: 120 BPM (15 cuadros por tiempo a 30 fps), 31 s
const BPM = 120, beat = 60 / BPM, dur = 31, m = seg(dur);
const notas = [55, 55, 43.65, 49]; // La, La, Fa, Sol (bajo), un acorde por compás
const acordes = [[220, 261.6, 329.6], [220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7]];
for (let i = 0; i < m.length; i++) {
  const t = i / SR, b = t / beat, nb = Math.floor(b), fb = (b - nb) * beat, compas = Math.floor(nb / 4) % 4;
  const intro = Math.min(1, t / 2), cierre = Math.min(1, (dur - t) / 1.5);
  let s = 0;
  // bombo (desde el compás 1), con hueco en el tiempo 4 de cada 4 compases
  if (nb >= 4 && !(nb % 16 === 15)) { const f = 50 + 90 * Math.exp(-fb * 30); s += Math.sin(2 * Math.PI * f * fb) * Math.exp(-fb * 7) * 0.9; }
  // hi-hat a contratiempo
  const fh = ((b + 0.5) % 1) * beat; if (nb >= 8) s += ruido() * Math.exp(-fh * 60) * 0.12;
  // clap en 2 y 4
  if (nb >= 8 && nb % 2 === 1) s += ruido() * Math.exp(-fb * 22) * 0.18;
  // bajo con sidechain
  const duck = 1 - 0.7 * Math.exp(-fb * 9);
  s += Math.sin(2 * Math.PI * notas[compas] * t) * 0.32 * duck * (nb >= 4 ? 1 : 0.4);
  // pad
  for (const f of acordes[compas]) s += (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 1.003 * t)) * 0.045 * duck;
  m[i] = s * intro * cierre;
}
wav('musica', m);
console.log('sfx listos');
