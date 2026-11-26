// Runs inside headless Chromium: renders asset jobs with the game's own renderer and
// measures the result for quality control. Driven by tools/art/build.cjs.
import { POSES, sideParts, frontParts, backParts, drawFigure, stridePose, stickParts } from '../../src/world/toon/bonny.js';
import { render } from '../../src/world/toon/ink.js';
import { drawCourtScene, sceneSize } from '../../src/art/scene.js';
import { STYLE, CHARACTERS } from '../../src/art/bible.js';

const hexRgb = (h) => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const PALETTE = Object.values(STYLE.palette).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).map(hexRgb);
const INK = hexRgb(STYLE.line.ink);

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** Figure parts for a character view or pose. */
function partsFor(spec) {
  if (spec.view === 'front') return frontParts(spec.mood ?? 'happy');
  if (spec.view === 'back') return backParts();
  if (spec.view === 'stride') return sideParts(stridePose(spec.frame, spec.frames));
  if (spec.view === 'stick') return stickParts();
  return sideParts({ ...POSES[spec.pose ?? 'idle'], ...(spec.mood ? { mood: spec.mood } : {}) });
}

function drawParts(ctx, parts, x, y, scale) {
  drawFigure(ctx, parts, x, y, scale);
}

// ------------------------------------------------------------------ quality measurements

function measure(c, { transparent = true } = {}) {
  const { width: W, height: H } = c;
  const d = c.getContext('2d').getImageData(0, 0, W, H).data;
  let minX = W, minY = H, maxX = -1, maxY = -1, opaque = 0, partial = 0, any = 0, borderHits = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const a = d[(y * W + x) * 4 + 3];
    if (!a) continue;
    any++;
    if (a === 255) opaque++; else partial++;
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) borderHits++;
  }
  // palette conformity: opaque pixels near a palette colour or an ink/colour anti-alias blend
  let onPalette = 0, sampled = 0;
  const segDist = (p, a, b) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]];
    const L = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1;
    const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L));
    return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t);
  };
  const step = Math.max(1, Math.floor(Math.sqrt((W * H) / 60000)));
  const counts = new Map();
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
    const i = (y * W + x) * 4;
    if (d[i + 3] !== 255) continue;
    const p = [d[i], d[i + 1], d[i + 2]];
    sampled++;
    let best = Infinity, bi = -1;
    for (let k = 0; k < PALETTE.length; k++) { const q = PALETTE[k]; const e = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); if (e < best) { best = e; bi = k; } }
    if (best < 14) { onPalette++; counts.set(bi, (counts.get(bi) ?? 0) + 1); continue; }
    // blend between ink and a colour, or between two colours (anti-aliased borders)
    let ok = false;
    for (const q of PALETTE) if (segDist(p, INK, q) < 12) { ok = true; break; }
    if (ok) onPalette++;
  }
  // outline: pixels on the silhouette edge must be ink-dark
  let edge = 0, edgeDark = 0;
  if (transparent) {
    for (let y = 1; y < H - 1; y += 1) for (let x = 1; x < W - 1; x += 1) {
      const i = (y * W + x) * 4;
      if (d[i + 3] < 200) continue;
      const out = d[i + 3 - 4] < 40 || d[i + 3 + 4] < 40 || d[i + 3 - W * 4] < 40 || d[i + 3 + W * 4] < 40;
      if (!out) continue;
      edge++;
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (lum < 70) edgeDark++;
    }
  }
  // edge density: how much drawn detail there is (for scenes)
  let edges = 0;
  for (let y = 0; y < H - 1; y += 2) for (let x = 0; x < W - 1; x += 2) {
    const i = (y * W + x) * 4, j = i + 4, k = i + W * 4;
    if (Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i] - d[k]) > 90) edges++;
  }
  const hist = {};
  const names = Object.keys(STYLE.palette).filter((n) => /^#[0-9a-f]{6}$/i.test(STYLE.palette[n]));
  for (const [k, v] of counts) hist[names[k]] = v / Math.max(1, sampled);
  return {
    width: W, height: H,
    bbox: maxX >= 0 ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null,
    coverage: any / (W * H),
    partialRatio: any ? partial / any : 0,
    borderHits,
    paletteConformity: sampled ? onPalette / sampled : 1,
    outlineDarkRatio: edge ? edgeDark / edge : 1,
    edgeDensity: edges / ((W * H) / 4),
    hist,
  };
}

/** Silhouette mask (downsampled) for frame-to-frame comparison. */
function mask(c, s = 4) {
  const { width: W, height: H } = c;
  const d = c.getContext('2d').getImageData(0, 0, W, H).data;
  const w = Math.floor(W / s), h = Math.floor(H / s);
  const m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) m[y * w + x] = d[((y * s) * W + x * s) * 4 + 3] > 128 ? 1 : 0;
  return m;
}
function iou(a, b) { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { if (a[k] && b[k]) i++; if (a[k] || b[k]) u++; } return u ? i / u : 1; }

// ------------------------------------------------------------------ jobs

const out = (c) => ({ png: c.toDataURL('image/png'), webp: c.toDataURL('image/webp', 0.92) });

window.ArtPipeline = {
  style: STYLE,
  characters: CHARACTERS,

  /** Single figure or prop on a transparent canvas, anchored on the ground. */
  figure(spec) {
    const c = canvas(spec.w, spec.h);
    drawParts(c.getContext('2d'), partsFor(spec), spec.anchor[0], spec.anchor[1], spec.scale);
    return { ...out(c), qa: measure(c) };
  },

  /** Sprite sheet: frames side by side with a shared anchor; plus frame stability data. */
  sheet(spec) {
    const n = spec.frames;
    const sheet = canvas(spec.w * n, spec.h);
    const g = sheet.getContext('2d');
    const masks = [], frames = [], grounds = [];
    for (let i = 0; i < n; i++) {
      const c = canvas(spec.w, spec.h);
      drawParts(c.getContext('2d'), partsFor({ ...spec, frame: i }), spec.anchor[0], spec.anchor[1], spec.scale);
      g.drawImage(c, i * spec.w, 0);
      const q = measure(c);
      masks.push(mask(c));
      grounds.push(q.bbox ? q.bbox.y + q.bbox.h : 0);
      frames.push({ x: i * spec.w, y: 0, w: spec.w, h: spec.h, bbox: q.bbox, borderHits: q.borderHits });
    }
    const iouNext = masks.map((m, i) => iou(m, masks[(i + 1) % n]));
    return { ...out(sheet), qa: { ...measure(sheet), frames, iouNext, groundSpread: Math.max(...grounds) - Math.min(...grounds) } };
  },

  /** Background scene, opaque. */
  scene(spec) {
    const { w, h } = sceneSize(spec.scale);
    const c = canvas(w, h);
    drawCourtScene(c.getContext('2d'), { S: spec.scale, seed: spec.seed ?? 61 });
    return { ...out(c), qa: measure(c, { transparent: false }) };
  },

  /** Character placed into the scene (preview for the gallery). */
  composite(spec) {
    const { w, h } = sceneSize(spec.scale);
    const c = canvas(w, h);
    const g = c.getContext('2d');
    const sc = drawCourtScene(g, { S: spec.scale, seed: spec.seed ?? 61 });
    for (const f of spec.figures) {
      const p = sc.px(f.x, f.y);
      g.fillStyle = STYLE.shading.groundShadow;
      g.beginPath(); g.ellipse(p.x, p.y, 16 * spec.scale, 4 * spec.scale, 0, 0, Math.PI * 2); g.fill();
      const parts = f.view === 'stride' ? sideParts(stridePose(f.frame ?? 0, 8)) : sideParts({ ...POSES[f.pose], ...(f.mood ? { mood: f.mood } : {}) });
      drawFigure(g, parts, p.x, p.y, f.scale ?? spec.scale * 1.05, { flip: !!f.flip });
    }
    return { ...out(c), qa: measure(c, { transparent: false }) };
  },
};
void render;
window.artReady = true;
