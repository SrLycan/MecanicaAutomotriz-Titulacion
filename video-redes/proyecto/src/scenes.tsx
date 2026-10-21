import React from "react";
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, theme } from "./theme";
import { BgMesh, Dot, Exit, In, KenBurns, Kicker, Pill, Words } from "./components";

const C = theme.colors;
const B = theme.beat;
const display: React.CSSProperties = { fontFamily: theme.fonts.display, fontWeight: 800, color: C.text, letterSpacing: "-0.03em", lineHeight: 1.04 };

// ───────────────────────── 1. HOOK: video real del taller ─────────────────────────
export const Hook: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, dur], [1.18, 1.05], { ...clamp, easing: theme.ease.out });
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <AbsoluteFill style={{ transform: `scale(${z})` }}>
        <OffthreadVideo src={staticFile("media/video1.mp4")} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.85) contrast(1.1) brightness(0.8)" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(6,10,17,0.2) 0%, rgba(6,10,17,0.35) 40%, rgba(6,10,17,0.92) 78%)" }} />
      <Exit at={dur - 10}>
        <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 80px 520px" }}>
          <In delay={2}><Pill><Dot />Ponciano Alto · Quito</Pill></In>
          <div style={{ height: 34 }} />
          <Words text="Restauramos vehículos." delay={4} style={{ ...display, fontSize: 118 }} />
          <Words text="Reforzamos confianza." delay={22} hero={["confianza."]} style={{ ...display, fontSize: 118, marginTop: 6 }} />
        </AbsoluteFill>
      </Exit>
    </AbsoluteFill>
  );
};

// ───────────────────────── 2. Logo ─────────────────────────
export const Logo: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const p = spring({ frame: f, fps, config: theme.spring.bouncy });
  const breathe = 1 + Math.sin(f / 18) * 0.012;
  const sweep = interpolate(f, [8, 34], [-120, 220], { ...clamp, easing: theme.ease.inOut });
  return (
    <AbsoluteFill>
      <BgMesh />
      <Exit at={dur - 10}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 54 }}>
          <div style={{ position: "relative", width: 820, transform: `scale(${interpolate(p, [0, 1], [0.6, 1]) * breathe}) rotate(${interpolate(p, [0, 1], [-6, 0])}deg)`, opacity: p,
            filter: `drop-shadow(0 0 60px ${C.glow})` }}>
            <Img src={staticFile("media/logo.png")} style={{ width: "100%" }} />
            {/* destello que recorre el logo */}
            <div style={{ position: "absolute", inset: 0, WebkitMaskImage: `url(${staticFile("media/logo.png")})`, WebkitMaskSize: "100% 100%",
              background: `linear-gradient(105deg, transparent ${sweep - 30}%, rgba(111,211,255,0.95) ${sweep}%, transparent ${sweep + 30}%)` }} />
          </div>
          <In delay={14}><div style={{ fontFamily: theme.fonts.body, fontSize: 44, color: C.textDim, letterSpacing: 2, textAlign: "center" }}>
            Mecánica <span style={{ color: C.primary }}>·</span> Colisiones <span style={{ color: C.primary }}>·</span> Pintura
          </div></In>
          <In delay={22}><Pill>Más de 10 años de experiencia</Pill></In>
        </AbsoluteFill>
      </Exit>
    </AbsoluteFill>
  );
};

// ───────────────────────── 3. La web en el celular ─────────────────────────
const PANTALLAS = [
  { src: "media/v-h-00.png", txt: "Tu taller, ahora en línea" },
  { src: "media/v-s-01.png", txt: "Servicios con precio claro" },
  { src: "media/v-s-02.png", txt: "Diagnóstico computarizado" },
  { src: "media/v-s-04.png", txt: "De la cita a la entrega" },
  { src: "media/v-h-08.png", txt: "Sigue tu auto desde tu cuenta" },
];
export const Web: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const inicio = 20; // el celular entra y luego empieza el "scroll"
  const tramo = Math.floor((dur - inicio - 12) / PANTALLAS.length);
  const W = 560, H = Math.round((W - 28) * 844 / 390) + 28;
  const ph = spring({ frame: f - 4, fps, config: theme.spring.smooth });
  const tilt = Math.sin(f / 40) * 1.2;
  // posición de "scroll": cada tramo avanza una pantalla con easing (sostener → mover)
  let pos = 0;
  for (let i = 1; i < PANTALLAS.length; i++) pos += interpolate(f, [inicio + i * tramo - 12, inicio + i * tramo], [0, 1], { ...clamp, easing: theme.ease.inOut });
  const actual = Math.min(PANTALLAS.length - 1, Math.max(0, Math.floor((f - inicio + 6) / tramo)));
  const screenH = H - 28;
  return (
    <AbsoluteFill>
      <BgMesh />
      <Exit at={dur - 10}>
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 210 }}>
          <In delay={0}><Kicker>Nuestra web</Kicker></In>
          <div style={{ height: 18 }} />
          <Words text="Agenda tu servicio en línea" delay={3} hero={["línea"]} style={{ ...display, fontSize: 80, justifyContent: "center", textAlign: "center", width: 800 }} />
        </AbsoluteFill>
        {/* celular */}
        <AbsoluteFill style={{ alignItems: "center", top: 470 }}>
          <div style={{ width: W, height: H, borderRadius: 78, padding: 14, background: "linear-gradient(145deg, #2A3442, #0B1018 60%, #1D2632)",
            boxShadow: `0 60px 120px -30px rgba(0,0,0,0.85), 0 0 0 2px rgba(255,255,255,0.08), 0 0 90px ${C.primary}30`,
            opacity: ph, transform: `perspective(1800px) translateY(${interpolate(ph, [0, 1], [380, 0])}px) rotateX(${interpolate(ph, [0, 1], [18, 0])}deg) rotateZ(${tilt}deg)` }}>
            <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 64, overflow: "hidden", background: C.bg }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 0, transform: `translateY(${-pos * screenH}px)` }}>
                {PANTALLAS.map((p) => <Img key={p.src} src={staticFile(p.src)} style={{ display: "block", width: "100%", height: screenH, objectFit: "cover", objectPosition: "top" }} />)}
              </div>
              {/* isla */}
              <div style={{ position: "absolute", top: 18, left: "50%", width: 150, height: 40, marginLeft: -75, borderRadius: 30, background: "#000" }} />
              {/* reflejo */}
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, rgba(255,255,255,0.10), transparent 35%)" }} />
            </div>
          </div>
        </AbsoluteFill>
        {/* leyenda que cambia con cada pantalla */}
        <AbsoluteFill style={{ alignItems: "center", top: 1270 }}>
          {PANTALLAS.map((p, i) => {
            const t0 = inicio + i * tramo - (i === 0 ? 0 : 4);
            const q = spring({ frame: f - t0, fps, config: theme.spring.snappy });
            const out = i < PANTALLAS.length - 1 ? interpolate(f, [inicio + (i + 1) * tramo - 12, inicio + (i + 1) * tramo - 4], [1, 0], clamp) : 1;
            if (i !== actual && out === 1 && q < 0.01) return null;
            return <div key={p.src} style={{ position: "absolute", opacity: Math.min(q, out), transform: `translateY(${interpolate(q, [0, 1], [30, 0]) - (1 - out) * 30}px) scale(${interpolate(q, [0, 1], [0.9, 1])})` }}>
              <Pill strong={false} style={{ fontSize: 40, padding: "20px 38px", boxShadow: "0 20px 50px rgba(0,0,0,0.6)" }}>
                <span style={{ color: C.primary, fontWeight: 800 }}>✓</span>{p.txt}
              </Pill>
            </div>;
          })}
        </AbsoluteFill>
      </Exit>
    </AbsoluteFill>
  );
};

// ───────────────────────── 4. Trabajo real (fotos del taller) ─────────────────────────
const FOTOS = ["media/pintura2.jpeg", "media/colisiones.jpg", "media/pintura4.jpeg", "media/llantas-pintura.jpeg", "media/pintura1.jpeg"];
export const Trabajo: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const cada = Math.floor(dur / FOTOS.length);
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {FOTOS.map((src, i) => (
        <Sequence key={src} from={i * cada} durationInFrames={i === FOTOS.length - 1 ? dur - i * cada : cada + 6}>
          <FotoCorte src={src} dur={cada + 6} zoomIn={i % 2 === 0} />
        </Sequence>
      ))}
      <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(6,10,17,0.7) 0%, transparent 25%, rgba(6,10,17,0.35) 45%, rgba(6,10,17,0.94) 66%, rgba(6,10,17,0.98) 100%)" }} />
      <Exit at={dur - 10}>
        <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 80px 430px" }}>
          <In delay={2}><Kicker>Nuestra especialidad</Kicker></In>
          <div style={{ height: 22 }} />
          <Words text="Enderezada y pintura" delay={5} hero={["pintura"]} style={{ ...display, fontSize: 104, textShadow: "0 6px 30px rgba(0,0,0,0.7)" }} />
          <div style={{ height: 34 }} />
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            {["Garantía escrita", "Repuestos OEM", "Fotos del proceso"].map((t, i) => {
              const q = spring({ frame: f - 26 - i * 5, fps, config: theme.spring.snappy });
              return <div key={t} style={{ opacity: q, transform: `translateY(${interpolate(q, [0, 1], [24, 0])}px)` }}><Pill style={{ fontSize: 32 }}>{t}</Pill></div>;
            })}
          </div>
        </AbsoluteFill>
      </Exit>
    </AbsoluteFill>
  );
};
const FotoCorte: React.FC<{ src: string; dur: number; zoomIn: boolean }> = ({ src, dur, zoomIn }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 6], [0, 1], { ...clamp, easing: theme.ease.out });
  const flash = interpolate(f, [0, 2, 7], [0, 0.35, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: o }}>
      <KenBurns src={src} dur={dur} zoomIn={zoomIn} style={{ filter: "saturate(0.9) contrast(1.08)" }} />
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

// ───────────────────────── 5. El panel por dentro ─────────────────────────
const PANEL = [
  { src: "shots/d-panel.png", txt: "Dinero, trabajo y avisos en vivo", fx: 0.62, fy: 0.85 },
  { src: "shots/d-inventario.png", txt: "Inventario con alertas de stock", fx: 0.62, fy: 0.62 },
  { src: "shots/d-ordenes.png", txt: "Órdenes de trabajo al día", fx: 0.3, fy: 0.42 },
  { src: "shots/d-caja.png", txt: "Caja diaria y cierres", fx: 0.42, fy: 0.3 },
  { src: "shots/d-graficas.png", txt: "Gráficas de ventas y servicios", fx: 0.45, fy: 0.45 },
];
export const Panel: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const inicio = 24;
  const tramo = Math.floor((dur - inicio - 10) / PANEL.length);
  const card = spring({ frame: f - 8, fps, config: theme.spring.smooth });
  const actual = Math.min(PANEL.length - 1, Math.max(0, Math.floor((f - inicio) / tramo)));
  return (
    <AbsoluteFill>
      <BgMesh tint={0.3} />
      <Exit at={dur - 10}>
        <AbsoluteFill style={{ alignItems: "center", paddingTop: 200 }}>
          <In><Kicker>Y por dentro</Kicker></In>
          <div style={{ height: 18 }} />
          <Words text="Todo el taller en un solo panel" delay={3} hero={["panel"]} style={{ ...display, fontSize: 80, justifyContent: "center", textAlign: "center", width: 860 }} />
        </AbsoluteFill>
        <AbsoluteFill style={{ alignItems: "center", top: 590 }}>
          <div style={{ width: 980, height: 820, borderRadius: 34, overflow: "hidden", position: "relative", background: C.bgAlt,
            border: `1.5px solid ${C.line}`, boxShadow: `0 50px 110px -30px rgba(0,0,0,0.9), 0 0 80px ${C.primary}22`,
            opacity: card, transform: `perspective(2000px) translateY(${interpolate(card, [0, 1], [200, 0])}px) rotateX(${interpolate(card, [0, 1], [22, 4]) + Math.sin(f / 35)}deg)` }}>
            {/* barra de ventana */}
            <div style={{ height: 46, display: "flex", alignItems: "center", gap: 12, padding: "0 22px", background: "#0A111B", borderBottom: `1px solid ${C.line}` }}>
              {["#FF5F57", "#FEBC2E", "#28C840"].map(c => <span key={c} style={{ width: 15, height: 15, borderRadius: 99, background: c }} />)}
              <span style={{ marginLeft: 18, fontFamily: theme.fonts.body, fontSize: 22, color: C.textDim }}>Panel SS SWAP</span>
            </div>
            <div style={{ position: "relative", height: 774, overflow: "hidden" }}>
              {PANEL.map((p, i) => {
                const t0 = inicio + i * tramo;
                const local = f - t0;
                if (local < -8 || local > tramo + 8) return null;
                const enter = i === 0 ? 1 : interpolate(local, [-8, 4], [0, 1], { ...clamp, easing: theme.ease.out });
                const z = interpolate(local, [0, tramo], [1.45, 1.9], { ...clamp, easing: theme.ease.inOut });
                return (
                  <AbsoluteFill key={p.src} style={{ opacity: enter, transform: `translateX(${(1 - enter) * 120}px)` }}>
                    <Img src={staticFile(p.src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: `${p.fx * 100}% ${p.fy * 100}%`,
                      transformOrigin: `${p.fx * 100}% ${p.fy * 100}%`, transform: `scale(${z})` }} />
                  </AbsoluteFill>
                );
              })}
            </div>
          </div>
        </AbsoluteFill>
        {/* etiqueta + indicador de progreso */}
        <AbsoluteFill style={{ alignItems: "center", top: 1450 }}>
          {PANEL.map((p, i) => {
            const q = spring({ frame: f - (inicio + i * tramo - 4), fps, config: theme.spring.snappy });
            const out = i < PANEL.length - 1 ? interpolate(f, [inicio + (i + 1) * tramo - 14, inicio + (i + 1) * tramo - 6], [1, 0], clamp) : 1;
            if (q < 0.01 || out <= 0) return null;
            return <div key={p.src} style={{ position: "absolute", opacity: Math.min(q, out), transform: `translateY(${interpolate(q, [0, 1], [30, 0])}px)` }}>
              <Pill style={{ fontSize: 40, padding: "20px 38px" }}><span style={{ color: C.primary, fontWeight: 800 }}>{String(i + 1).padStart(2, "0")}</span>{p.txt}</Pill>
            </div>;
          })}
          <div style={{ position: "absolute", top: 120, display: "flex", gap: 14 }}>
            {PANEL.map((p, i) => <div key={p.src} style={{ width: i === actual ? 60 : 16, height: 16, borderRadius: 99, background: i === actual ? C.primary : "rgba(255,255,255,0.2)" }} />)}
          </div>
        </AbsoluteFill>
      </Exit>
    </AbsoluteFill>
  );
};

// ───────────────────────── 6. CTA ─────────────────────────
export const Cta: React.FC<{ dur: number }> = ({ dur }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const btn = spring({ frame: f - 22, fps, config: theme.spring.bouncy });
  const pulse = 1 + Math.sin(f / 7) * 0.02;
  const fade = interpolate(f, [dur - 8, dur], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <BgMesh />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", paddingBottom: 120 }}>
        <In><Img src={staticFile("media/logo.png")} style={{ width: 560, filter: `drop-shadow(0 0 40px rgba(59,169,238,0.25))` }} /></In>
        <div style={{ height: 60 }} />
        <Words text="¿Tu auto necesita taller?" delay={6} style={{ ...display, fontSize: 84, justifyContent: "center", textAlign: "center", width: 940 }} />
        <div style={{ height: 56 }} />
        <div style={{ opacity: btn, transform: `scale(${interpolate(btn, [0, 1], [0.7, 1]) * pulse})` }}>
          <div style={{ padding: "34px 70px", borderRadius: 999, background: `linear-gradient(180deg, ${C.accent}, ${C.primary})`, color: "#04111D",
            fontFamily: theme.fonts.display, fontWeight: 800, fontSize: 52, letterSpacing: "-0.01em",
            boxShadow: `0 0 60px ${C.primary}88, 0 0 140px ${C.primary}44` }}>Agenda tu servicio →</div>
        </div>
        <div style={{ height: 50 }} />
        <In delay={32}><div style={{ display: "flex", gap: 18, alignItems: "center", fontFamily: theme.fonts.body, fontSize: 40, color: C.text }}>
          <WhatsIcon /> 096 386 3847 <span style={{ color: C.textDim }}>· respuesta en 30 min</span>
        </div></In>
        <div style={{ height: 22 }} />
        <In delay={38}><div style={{ fontFamily: theme.fonts.body, fontSize: 34, color: C.textDim, letterSpacing: 1 }}>Ponciano Alto · Quito · Ecuador</div></In>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
const WhatsIcon: React.FC = () => (
  <svg width="46" height="46" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill={C.ok} />
    <path d="M8.2 6.9c.3-.3.7-.3.9.1l.9 1.9c.1.3 0 .6-.2.8l-.6.6c.6 1.2 1.5 2.1 2.7 2.7l.6-.6c.2-.2.5-.3.8-.2l1.9.9c.4.2.4.6.1.9l-.9 1c-.5.5-1.3.6-2 .3-2.3-1-4.1-2.8-5.1-5.1-.3-.7-.2-1.5.3-2z" fill="#04111D" /></svg>
);
