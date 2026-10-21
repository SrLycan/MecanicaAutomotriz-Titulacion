import { Easing } from "remotion";
import { loadFont as loadSora } from "@remotion/google-fonts/Sora";
import { loadFont as loadOutfit } from "@remotion/google-fonts/Outfit";

const sora = loadSora("normal", { weights: ["600", "700", "800"], subsets: ["latin", "latin-ext"] });
const outfit = loadOutfit("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin", "latin-ext"] });

// Paleta de la web pública de SS SWAP: fondo casi negro, azul de marca como color héroe.
export const theme = {
  colors: {
    bg: "#060A11",
    bgAlt: "#0D1520",
    primary: "#3BA9EE",
    primaryDeep: "#1C6FB5",
    accent: "#6FD3FF",
    text: "#F2F6FA",
    textDim: "#9AABBD",
    line: "rgba(255,255,255,0.10)",
    glow: "rgba(59,169,238,0.45)",
    ok: "#34D399",
  },
  fonts: { display: sora.fontFamily, body: outfit.fontFamily },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
  },
  // 120 BPM a 30 fps = 15 cuadros por tiempo. Todos los cortes caen en múltiplos.
  beat: 15,
} as const;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
