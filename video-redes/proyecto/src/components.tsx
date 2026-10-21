import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, theme } from "./theme";

const C = theme.colors;

export const BgMesh: React.FC<{ tint?: number }> = ({ tint = 1 }) => {
  const f = useCurrentFrame();
  const d1 = Math.sin(f / 55) * 60, d2 = Math.cos(f / 70) * 50;
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${C.bg} 0%, ${C.bgAlt} 55%, ${C.bg} 100%)` }}>
      <div style={{ position: "absolute", width: 1400, height: 1400, borderRadius: "50%", top: -560, left: -420 + d1, filter: "blur(60px)",
        background: `radial-gradient(circle, ${C.primary}${tint > 0.5 ? "38" : "22"}, transparent 62%)` }} />
      <div style={{ position: "absolute", width: 1100, height: 1100, borderRadius: "50%", bottom: -420, right: -380 - d2, filter: "blur(80px)",
        background: `radial-gradient(circle, ${C.primaryDeep}40, transparent 65%)` }} />
      {/* rejilla técnica muy tenue */}
      <AbsoluteFill style={{ opacity: 0.06, backgroundImage: `linear-gradient(${C.text} 1px, transparent 1px), linear-gradient(90deg, ${C.text} 1px, transparent 1px)`,
        backgroundSize: "90px 90px", backgroundPosition: `0 ${(f * 0.6) % 90}px`, maskImage: "radial-gradient(ellipse at center, black 20%, transparent 75%)" }} />
    </AbsoluteFill>
  );
};

export const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill style={{ backgroundColor: C.primaryDeep, mixBlendMode: "soft-light", opacity: 0.2 }} />
    <AbsoluteFill style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.25), transparent 22%, transparent 78%, rgba(0,0,0,0.35))" }} />
  </AbsoluteFill>
);

export const Grain: React.FC = () => {
  const f = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return <AbsoluteFill style={{ pointerEvents: "none", backgroundImage: noise, backgroundSize: "220px",
    backgroundPosition: `${(f * 7) % 220}px ${(f * 13) % 220}px`, opacity: 0.07, mixBlendMode: "overlay" }} />;
};

export const Vignette: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none", background: "radial-gradient(ellipse at center, transparent 52%, rgba(0,0,0,0.5) 100%)" }} />
);

/** Entrada: opacidad + subida + escala con resorte. */
export const In: React.FC<{ delay?: number; y?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ delay = 0, y = 40, children, style }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  const p = spring({ frame: f - delay, fps, config: theme.spring.smooth });
  return <div style={{ opacity: p, transform: `translateY(${interpolate(p, [0, 1], [y, 0])}px) scale(${interpolate(p, [0, 1], [0.94, 1])})`, ...style }}>{children}</div>;
};

/** Salida del bloque completo, más rápida que la entrada. */
export const Exit: React.FC<{ at: number; children: React.ReactNode; dir?: number }> = ({ at, children, dir = -1 }) => {
  const f = useCurrentFrame();
  const t = interpolate(f, [at, at + 10], [0, 1], { ...clamp, easing: theme.ease.in });
  return <AbsoluteFill style={{ opacity: 1 - t, transform: `translateY(${dir * 70 * t}px) scale(${1 + 0.06 * t})`, filter: `blur(${t * 8}px)` }}>{children}</AbsoluteFill>;
};

export const Words: React.FC<{ text: string; delay?: number; per?: number; style?: React.CSSProperties; hero?: string[] }> = ({ text, delay = 0, per = 3, style, hero = [] }) => {
  const f = useCurrentFrame(); const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", columnGap: 22, ...style }}>
      {text.split(" ").map((w, i) => {
        const p = spring({ frame: f - delay - i * per, fps, config: theme.spring.snappy });
        const esHero = hero.includes(w);
        return <span key={i} style={{ display: "inline-block", opacity: p, color: esHero ? C.primary : undefined,
          textShadow: esHero ? `0 0 50px ${C.glow}` : undefined,
          transform: `translateY(${interpolate(p, [0, 1], [50, 0])}px) rotate(${interpolate(p, [0, 1], [4, 0])}deg)` }}>{w}</span>;
      })}
    </div>
  );
};

export const KenBurns: React.FC<{ src: string; dur: number; zoomIn?: boolean; pos?: string; style?: React.CSSProperties }> = ({ src, dur, zoomIn = true, pos = "center", style }) => {
  const f = useCurrentFrame();
  const s = interpolate(f, [0, dur], zoomIn ? [1, 1.12] : [1.12, 1], { ...clamp, easing: theme.ease.inOut });
  const x = interpolate(f, [0, dur], [0, zoomIn ? -24 : 24], { ...clamp, easing: theme.ease.inOut });
  return <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: pos, transform: `scale(${s}) translateX(${x}px)`, ...style }} />;
};

export const Pill: React.FC<{ children: React.ReactNode; strong?: boolean; style?: React.CSSProperties }> = ({ children, strong, style }) => (
  <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "14px 28px", borderRadius: 999,
    background: strong ? C.primary : "rgba(13,21,32,0.72)", color: strong ? "#04111D" : C.text,
    border: `1.5px solid ${strong ? C.primary : "rgba(111,211,255,0.28)"}`, backdropFilter: "blur(10px)",
    fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 34, letterSpacing: 0.4, ...style }}>{children}</div>
);

export const Dot: React.FC<{ color?: string }> = ({ color = C.ok }) => {
  const f = useCurrentFrame();
  return <span style={{ width: 16, height: 16, borderRadius: 99, background: color, boxShadow: `0 0 ${12 + 6 * Math.sin(f / 6)}px ${color}` }} />;
};

export const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 18, fontFamily: theme.fonts.body, fontWeight: 600, fontSize: 30,
    letterSpacing: 7, textTransform: "uppercase", color: C.accent }}>
    <span style={{ width: 54, height: 3, background: C.accent, borderRadius: 3 }} />{children}
  </div>
);
