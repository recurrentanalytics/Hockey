// Figurenstudio: model sheet for the comic characters, drawn with the game's own renderer.
import { POSES, sideParts, frontParts, backParts, drawFigure } from '../world/toon/bonny.js';
import { letter, INK } from '../world/toon/ink.js';

const cv = document.getElementById('sheet');
const ctx = cv.getContext('2d');
const W = cv.width, H = cv.height;

function paper() {
  ctx.fillStyle = '#efe6d2';
  ctx.fillRect(0, 0, W, H);
  // faint paper grain
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(120,90,50,0.05)' : 'rgba(255,255,255,0.08)';
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
  }
}

function label(text, x, y, size = 22) {
  letter(ctx, text, x, y, size, { fill: INK, ink: '#efe6d2', outline: 0, font: 'Bangers, "Arial Black", Impact, sans-serif' });
}

function groundLine(x0, x1, y) {
  ctx.strokeStyle = 'rgba(26,18,12,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
}

/** Asphalt of the Boni court under the trees: dark grit in leaf shade, round sun flecks. */
function asphalt(x, y, w, h, seed = 7) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // sun flecks through the canopy: many small, a few large, soft edged
  const spots = Array.from({ length: 140 }, () => {
    const big = rnd() < 0.15;
    return { x: rnd() * w, y: rnd() * h, r: big ? 18 + rnd() * 26 : 4 + rnd() * 10, sq: 0.45 + rnd() * 0.2 };
  });
  const light = new Float32Array(w * h);
  for (const p of spots) {
    const r = p.r, ry = r * p.sq;
    for (let j = Math.max(0, Math.floor(p.y - ry)); j < Math.min(h, p.y + ry); j++) {
      for (let i = Math.max(0, Math.floor(p.x - r)); i < Math.min(w, p.x + r); i++) {
        const q = ((i - p.x) / r) ** 2 + ((j - p.y) / ry) ** 2;
        if (q < 1) light[j * w + i] = Math.max(light[j * w + i], Math.min(1, (1 - q) * 2.2));
      }
    }
  }
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      let v = 58 + (rnd() - 0.5) * 24;                            // fine grit in shade
      if (rnd() < 0.025) v += 30 * (rnd() - 0.2);                 // light stones
      v += Math.sin(i * 0.011 + j * 0.017) * 3 + Math.sin(i * 0.003 - j * 0.009) * 5;
      const l = light[j * w + i];
      const k = (j * w + i) * 4;
      d[k] = v + l * 70; d[k + 1] = v + 2 + l * 66; d[k + 2] = v + 6 + l * 52; d[k + 3] = 255;   // sunlight is warm
    }
  }
  ctx.putImageData(img, x, y);
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = '#e6e4dc';
  ctx.lineWidth = 5;
  ctx.setLineDash([70, 4, 26, 5]);
  ctx.beginPath(); ctx.moveTo(x, y + h * 0.78); ctx.lineTo(x + w, y + h * 0.5); ctx.stroke();
  ctx.restore();
}

/** Soft contact shadow: the toon stands on a real surface. */
function contactShadow(x, y, rx) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, 'rgba(10,10,14,0.55)');
  g.addColorStop(1, 'rgba(10,10,14,0)');
  ctx.save(); ctx.scale(1, 0.28); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y / 0.28, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

/** Dappled light falling on the toon (Roger-Rabbit style integration): light patches over the figure. */
function dapple(x, y, w, h) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = 'rgba(255,240,200,0.22)';
  for (const [dx, dy, r] of [[0.2, 0.3, 0.18], [0.65, 0.55, 0.14], [0.4, 0.8, 0.12]]) { ctx.beginPath(); ctx.ellipse(x + dx * w, y + dy * h, r * w, r * h * 0.6, 0.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = 'rgba(20,30,20,0.18)';
  ctx.beginPath(); ctx.ellipse(x + 0.8 * w, y + 0.25 * h, 0.25 * w, 0.2 * h, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

paper();
letter(ctx, 'BONNY – CHARAKTERSTUDIE', W / 2, 46, 46, { fill: '#1f5a33', ink: INK, outline: 2.2 });
letter(ctx, 'BONI BORSTENTIERE · #61 · DAS KLEINE WILDSCHWEIN AUS DER EILENRIEDE', W / 2, 88, 20, { fill: '#d2642a', ink: INK, outline: 1 });

// Row 1: turnaround
const S1 = 4.4, base1 = 470;
groundLine(60, 1000, base1);
drawFigure(ctx, frontParts('happy'), 190, base1, S1);
drawFigure(ctx, sideParts(POSES.idle), 480, base1, S1);
drawFigure(ctx, backParts(), 820, base1, S1);
label('VORNE', 190, base1 + 34); label('SEITE', 500, base1 + 34); label('HINTEN', 820, base1 + 34);

// Mood sheet: heads in profile
const moods = [['normal', 'NORMAL'], ['happy', 'FROH'], ['effort', 'VOLLE KRAFT'], ['sad', 'TRAURIG'], ['dizzy', 'BENOMMEN'], ['blink', 'BLINZELN']];
moods.forEach(([m, name], i) => {
  const x = 1110 + (i % 2) * 230, y = 260 + Math.floor(i / 2) * 150;
  ctx.save();
  ctx.beginPath(); ctx.rect(x - 110, y - 135, 220, 140); ctx.clip();
  drawFigure(ctx, sideParts({ ...POSES.idle, mood: m }), x - 40, y + 140, 3.4);
  ctx.restore();
  label(name, x, y + 14, 18);
});
letter(ctx, 'MIMIK', 1225, 150, 26, { fill: INK, ink: '#efe6d2', outline: 0 });

// Row 2: action poses
const S2 = 3.3, base2 = 830;
groundLine(40, W - 40, base2);
const row = [['idle', 'STAND'], ['skate', 'LAUFEN'], ['sprint', 'SPRINT'], ['windup', 'AUSHOLEN'], ['shot', 'SCHUSS'], ['cheer', 'JUBEL'], ['fall', 'STURZ']];
row.forEach(([k, name], i) => {
  const x = 120 + i * 222;
  drawFigure(ctx, sideParts(POSES[k]), x, base2, S2);
  label(name, x + 10, base2 + 30);
});

// Row 3: in the game – drawn character on the real Boni asphalt
const bx = 60, by = 900, bw = W - 120, bh = 250;
asphalt(bx, by, bw, bh);
ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(bx, by, bw, bh);
const gameScale = 2.1;   // ≈ in-game size at 1080p
[[260, 1110, 'skate', false], [560, 1080, 'shot', false], [880, 1120, 'idle', true], [1180, 1095, 'cheer', false], [1420, 1128, 'fall', false]].forEach(([x, y, k, flip]) => {
  contactShadow(x, y, 46);
  const parts = sideParts(POSES[k]);
  const off = document.createElement('canvas');
  off.width = 260; off.height = 260;
  const o = off.getContext('2d');
  drawFigure(o, parts, 130, 220, gameScale, { flip });
  const oc = ctx;
  // dapple only on the figure: draw it to its own canvas first
  const fig = off;
  const fctx = fig.getContext('2d');
  fctx.save();
  fctx.globalCompositeOperation = 'source-atop';
  // the figure stands in the leaf shade: slightly darker, with one warm fleck of sun
  fctx.fillStyle = 'rgba(10,25,15,0.18)';
  fctx.fillRect(0, 0, 260, 260);
  fctx.fillStyle = 'rgba(255,226,150,0.32)';
  fctx.beginPath(); fctx.ellipse(118, 118, 16, 10, 0.3, 0, Math.PI * 2); fctx.fill();
  fctx.restore();
  oc.drawImage(fig, x - 130, y - 220);
});
letter(ctx, 'IM SPIEL: GEZEICHNETE FIGUR AUF ECHTEM BONI-ASPHALT (SPIELGRÖSSE 1080P)', W / 2, by + 24, 18, { fill: '#ffffff', ink: INK, outline: 1.2 });
void dapple;
window.studioReady = true;
