/**
 * Procedural textures for the studio, drawn on canvases once and cached.
 * No image files: the room works offline and the art can later be swapped
 * for an artist's textures object by object.
 */
import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();

function make(key: string, w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, opts?: { repeat?: [number, number]; srgb?: boolean }) {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 4;
  if (opts?.srgb !== false) tex.colorSpace = THREE.SRGBColorSpace;
  if (opts?.repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(...opts.repeat);
  }
  cache.set(key, tex);
  return tex;
}

/** Deterministic noise so textures look the same every launch. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Warm oak floorboards with grain, seams and slight per-board tone. */
export function floorTexture() {
  return make("floor", 1024, 1024, (c, w, h) => {
    const r = rng(7);
    const boards = 8;
    const bw = w / boards;
    for (let i = 0; i < boards; i++) {
      const base = 0.85 + r() * 0.3;
      for (let seg = 0; seg < 3; seg++) {
        const y0 = (seg * h) / 3 + (i % 2) * (h / 6);
        const tone = base * (0.92 + r() * 0.16);
        c.fillStyle = `rgb(${Math.round(112 * tone)},${Math.round(72 * tone)},${Math.round(44 * tone)})`;
        c.fillRect(i * bw, y0, bw, h / 3);
        c.fillRect(i * bw, y0 - h, bw, h / 3);
      }
      // grain
      for (let g = 0; g < 40; g++) {
        const x = i * bw + r() * bw;
        c.strokeStyle = `rgba(40,22,10,${0.05 + r() * 0.12})`;
        c.lineWidth = 0.6 + r() * 1.6;
        c.beginPath();
        c.moveTo(x, 0);
        for (let y = 0; y <= h; y += 32) c.lineTo(x + Math.sin(y / (40 + r() * 60) + g) * 3, y);
        c.stroke();
      }
      // seams
      c.fillStyle = "rgba(20,10,4,0.65)";
      c.fillRect(i * bw, 0, 3, h);
    }
    for (let k = 0; k < 24; k++) {
      c.fillStyle = "rgba(20,10,4,0.55)";
      const i = Math.floor(r() * boards);
      c.fillRect(i * bw, Math.floor(r() * 6) * (h / 6), bw, 2);
    }
  }, { repeat: [2, 2] });
}

/** Plastered wall in deep warm green with soft mottling. */
export function wallTexture(seed = 3, base: [number, number, number] = [44, 52, 44]) {
  return make(`wall-${seed}`, 512, 512, (c, w, h) => {
    const r = rng(seed);
    c.fillStyle = `rgb(${base.join(",")})`;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const x = r() * w, y = r() * h, s = 4 + r() * 40;
      c.fillStyle = `rgba(${r() > 0.5 ? "255,240,220" : "0,0,0"},${0.012 + r() * 0.02})`;
      c.beginPath();
      c.arc(x, y, s, 0, Math.PI * 2);
      c.fill();
    }
  }, { repeat: [2, 1] });
}

/** Acoustic foam panel (pyramids). */
export function foamTexture() {
  return make("foam", 256, 256, (c, w, h) => {
    c.fillStyle = "#2a2522";
    c.fillRect(0, 0, w, h);
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = i * s, y = j * s;
        const g = c.createLinearGradient(x, y, x + s, y + s);
        g.addColorStop(0, "#3d3631");
        g.addColorStop(1, "#191513");
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(x + s / 2, y + 2);
        c.lineTo(x + s - 2, y + s / 2);
        c.lineTo(x + s / 2, y + s - 2);
        c.lineTo(x + 2, y + s / 2);
        c.closePath();
        c.fill();
      }
  });
}

/** Amp grille cloth: woven basket weave in oxblood and gold fleck. */
export function grilleTexture() {
  return make("grille", 512, 512, (c, w, h) => {
    c.fillStyle = "#4a1714";
    c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 6)
      for (let x = 0; x < w; x += 6) {
        const odd = ((x + y) / 6) % 2 === 0;
        c.fillStyle = odd ? "rgba(140,52,40,0.55)" : "rgba(20,4,4,0.45)";
        c.fillRect(x, y, 5, 5);
      }
    const r = rng(11);
    for (let i = 0; i < 400; i++) {
      c.fillStyle = `rgba(220,170,90,${r() * 0.18})`;
      c.fillRect(r() * w, r() * h, 1.5, 1.5);
    }
  });
}

/** Black tolex with a pebbled look. */
export function tolexTexture() {
  return make("tolex", 512, 512, (c, w, h) => {
    c.fillStyle = "#151211";
    c.fillRect(0, 0, w, h);
    const r = rng(5);
    for (let i = 0; i < 6000; i++) {
      const v = Math.floor(10 + r() * 30);
      c.fillStyle = `rgba(${v},${v - 2},${v - 3},0.55)`;
      c.beginPath();
      c.arc(r() * w, r() * h, 1 + r() * 2.2, 0, Math.PI * 2);
      c.fill();
    }
  }, { repeat: [2, 2] });
}

/** Sunburst guitar top. */
export function sunburstTexture() {
  return make("sunburst", 512, 512, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, w * 0.62);
    g.addColorStop(0, "#f2b45a");
    g.addColorStop(0.45, "#d17a2a");
    g.addColorStop(0.75, "#6e2a12");
    g.addColorStop(1, "#1e0b05");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    const r = rng(9);
    for (let i = 0; i < 70; i++) {
      c.strokeStyle = `rgba(60,25,8,${0.04 + r() * 0.07})`;
      c.lineWidth = 1 + r() * 2;
      const x = r() * w;
      c.beginPath();
      c.moveTo(x, 0);
      c.lineTo(x + (r() - 0.5) * 8, h);
      c.stroke();
    }
  });
}

/** Rug: woven kilim in amp red, amber and cream. */
export function rugTexture() {
  return make("rug", 1024, 640, (c, w, h) => {
    c.fillStyle = "#5b1c16";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#e8a54b";
    c.lineWidth = 14;
    c.strokeRect(28, 28, w - 56, h - 56);
    c.strokeStyle = "#e9d9b8";
    c.lineWidth = 5;
    c.strokeRect(54, 54, w - 108, h - 108);
    const cx = w / 2, cy = h / 2;
    for (let k = 0; k < 4; k++) {
      const s = 230 - k * 52;
      c.fillStyle = ["#e8a54b", "#3a120e", "#e9d9b8", "#86b092"][k];
      c.beginPath();
      c.moveTo(cx, cy - s * 0.62);
      c.lineTo(cx + s, cy);
      c.lineTo(cx, cy + s * 0.62);
      c.lineTo(cx - s, cy);
      c.closePath();
      c.fill();
    }
    for (let x = 90; x < w - 90; x += 70) {
      c.fillStyle = "#e8a54b";
      c.beginPath();
      c.moveTo(x, 80);
      c.lineTo(x + 18, 100);
      c.lineTo(x, 120);
      c.lineTo(x - 18, 100);
      c.fill();
      c.beginPath();
      c.moveTo(x, h - 80);
      c.lineTo(x + 18, h - 100);
      c.lineTo(x, h - 120);
      c.lineTo(x - 18, h - 100);
      c.fill();
    }
    const r = rng(13);
    for (let i = 0; i < 9000; i++) {
      c.fillStyle = `rgba(0,0,0,${r() * 0.08})`;
      c.fillRect(r() * w, r() * h, 2, 2);
    }
  });
}

/** Text on a transparent canvas (labels, logo plates, sheet music titles). */
export function textTexture(key: string, lines: { text: string; font: string; color: string; y: number; align?: CanvasTextAlign }[], w = 512, h = 256, bg?: string) {
  return make(`text-${key}`, w, h, (c) => {
    if (bg) {
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);
    }
    for (const l of lines) {
      c.font = l.font;
      c.fillStyle = l.color;
      c.textAlign = l.align ?? "center";
      c.textBaseline = "middle";
      c.fillText(l.text, l.align === "left" ? 24 : w / 2, l.y);
    }
  });
}

/** Neon tube text: a bright core over a wide glow (the glow lives in the texture). */
export function neonTexture(text: string, color: string, family: string) {
  return make(`neon-${text}`, 1024, 384, (c, w, h) => {
    c.font = `900 150px ${family}`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const [blur, alpha] of [[60, 0.55], [30, 0.7], [12, 0.9]] as const) {
      c.shadowColor = color;
      c.shadowBlur = blur;
      c.globalAlpha = alpha;
      c.strokeStyle = color;
      c.lineWidth = 10;
      c.strokeText(text, w / 2, h / 2);
    }
    c.globalAlpha = 1;
    c.shadowBlur = 8;
    c.strokeStyle = "#fff4e6";
    c.lineWidth = 4;
    c.strokeText(text, w / 2, h / 2);
  });
}

/** Sheet music: staves and chord boxes on cream paper. */
export function sheetTexture(chords: string[]) {
  return make(`sheet-${chords.join("")}`, 512, 660, (c, w, h) => {
    c.fillStyle = "#efe4cc";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#2a1d14";
    c.font = "700 34px Georgia, serif";
    c.textAlign = "center";
    c.fillText("My Song", w / 2, 60);
    c.font = "18px monospace";
    c.fillText("KEY G · CAPO 2", w / 2, 92);
    for (let row = 0; row < 5; row++) {
      const y0 = 140 + row * 100;
      c.strokeStyle = "rgba(42,29,20,0.55)";
      c.lineWidth = 1.5;
      for (let l = 0; l < 5; l++) {
        c.beginPath();
        c.moveTo(40, y0 + l * 9);
        c.lineTo(w - 40, y0 + l * 9);
        c.stroke();
      }
      c.font = "700 24px monospace";
      c.fillStyle = "#8a2d1c";
      c.textAlign = "left";
      chords.forEach((ch, i) => c.fillText(ch, 48 + i * ((w - 96) / chords.length), y0 - 16));
    }
  });
}

/** Vinyl label for records on the wall (gold when earned). */
export function recordLabelTexture(label: string, gold: boolean) {
  return make(`rec-${label}-${gold}`, 256, 256, (c, w, h) => {
    c.fillStyle = gold ? "#f2c260" : "#c9452f";
    c.beginPath();
    c.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = gold ? "#5a3b08" : "#f3ead8";
    c.font = "800 64px Arial, sans-serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText(label, w / 2, h / 2 - 10);
    c.font = "600 22px monospace";
    c.fillText(gold ? "MASTERED" : "· · ·", w / 2, h / 2 + 46);
    c.fillStyle = "#111";
    c.beginPath();
    c.arc(w / 2, h / 2, 9, 0, Math.PI * 2);
    c.fill();
  });
}
