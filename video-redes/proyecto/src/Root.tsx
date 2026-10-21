import React from "react";
import { AbsoluteFill, Audio, Composition, Sequence, staticFile } from "remotion";
import { theme } from "./theme";
import { Grade, Grain, Vignette } from "./components";
import { Cta, Hook, Logo, Panel, Trabajo, Web } from "./scenes";

const B = theme.beat; // 15 cuadros = 1 tiempo a 120 BPM
// Escenas en tiempos de música (cada corte cae en un tiempo).
const ESCENAS = [
  { C: Hook, beats: 6 },     // 0–3 s
  { C: Logo, beats: 5 },     // 3–5.5 s
  { C: Web, beats: 18 },     // 5.5–14.5 s
  { C: Trabajo, beats: 10 }, // 14.5–19.5 s
  { C: Panel, beats: 16 },   // 19.5–27.5 s
  { C: Cta, beats: 9 },      // 27.5–32 s
];
const desde = ESCENAS.map((_, i) => ESCENAS.slice(0, i).reduce((a, e) => a + e.beats * B, 0));
export const TOTAL = ESCENAS.reduce((a, e) => a + e.beats * B, 0);

const Sfx: React.FC<{ at: number; src: string; vol?: number }> = ({ at, src, vol = 0.6 }) => (
  <Sequence from={Math.max(0, at)} durationInFrames={45}><Audio src={staticFile(`sfx/${src}.wav`)} volume={vol} /></Sequence>
);

const Reel: React.FC = () => (
  <AbsoluteFill style={{ background: theme.colors.bg }}>
    {ESCENAS.map(({ C, beats }, i) => (
      <Sequence key={i} from={desde[i]} durationInFrames={beats * B}><C dur={beats * B} /></Sequence>
    ))}
    <Grade />
    <Grain />
    <Vignette />
    <Audio src={staticFile("sfx/musica.wav")} volume={0.55} />
    {/* golpe en cada corte, whoosh 3 cuadros antes */}
    {desde.slice(1).map((d) => <React.Fragment key={d}><Sfx at={d - 6} src="whoosh" vol={0.5} /><Sfx at={d} src="hit" vol={0.45} /></React.Fragment>)}
    <Sfx at={desde[1] - 36} src="riser" vol={0.35} />
    <Sfx at={desde[5] - 36} src="riser" vol={0.35} />
    <Sfx at={desde[5] + 20} src="pop" vol={0.6} />
  </AbsoluteFill>
);

export const Root: React.FC = () => (
  <Composition id="Reel" component={Reel} durationInFrames={TOTAL} fps={30} width={1080} height={1920} />
);
