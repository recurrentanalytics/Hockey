// Rink geometry and the one-time bake of the rink art into canvases.
//  background: floor, markings, far boards, stands (drawn under everything)
//  foreground: near boards (drawn over skaters, partly see-through)
import { RINK, GOAL, PROJ } from '../config.js';
import { PAL } from '../engine/palette.js';
import { Surface, rgba, hash2 } from '../engine/raster.js';
import { project } from './projection.js';

const HL = RINK.length / 2;
const HW = RINK.width / 2;
const R = RINK.cornerRadius;
const WALL = Math.round(RINK.boardHeight * PROJ.z);

/** Area of world-pixel space covered by the baked canvases. */
export const BAKE = { x0: -528, y0: -216, w: 1056, h: 384 };

/** Far (top) and near (bottom) board positions in metres at a given x, or null off the rink. */
export function rinkExtentAt(x) {
  const ax = Math.abs(x);
  if (ax > HL) return null;
  if (ax <= HL - R) return { top: -HW, bottom: HW };
  const dx = ax - (HL - R);
  const dy = Math.sqrt(Math.max(0, R * R - dx * dx));
  return { top: -(HW - R) - dy, bottom: HW - R + dy };
}

/** Rink as an inflated rectangle: the core the rounded boards are R metres away from. */
export const RINK_CORE = { halfX: HL - R, halfY: HW - R, radius: R };

export function goalBox(side) {
  const gx = side * RINK.goalLineX;
  const bx = gx + side * GOAL.depth;
  return { minX: Math.min(gx, bx), maxX: Math.max(gx, bx), minY: -GOAL.width / 2, maxY: GOAL.width / 2 };
}

const C = {
  red: rgba(PAL.red),
  redSoft: rgba('#ffc2cf'),
  blue: rgba(PAL.blue),
  blueSoft: rgba('#cfe0ff'),
  crease: rgba('#b5ecff'),
  creaseEdge: rgba('#8fdcf7'),
  board: rgba(PAL.white),
  boardShade: rgba('#efe8fb'),
  rail: rgba('#c9b8f2'),
  railLight: rgba('#e6dcff'),
  outline: rgba(PAL.slate),
  kick: rgba(PAL.yellow),
  sep: rgba('#d8cff0'),
  ink: rgba(PAL.ink),
  white: rgba(PAL.white),
  concourseA: rgba('#3a2d57'),
  concourseB: rgba('#34284f'),
  skin: rgba(PAL.skin),
};
// Floor: three tones blended with ordered dithering for soft arena lighting.
const FLOOR = [rgba('#b6c4ec'), rgba('#c4d1f3'), rgba('#d2ddf8'), rgba('#e2eafc')];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const ADS = [
  { bg: rgba(PAL.pink), icon: 'heart' },
  { bg: rgba(PAL.sky), icon: 'star' },
  { bg: rgba(PAL.yellow), icon: 'smile' },
  { bg: rgba('#b9f2cf'), icon: 'puck' },
  { bg: rgba('#d7c4ff'), icon: 'star' },
];
const ICONS = {
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  star: ['...#...', '..###..', '#######', '.#####.', '.##.##.', '#.....#'],
  smile: ['.#####.', '#.#.#.#', '#######', '#.###.#', '##...##', '.#####.'],
  puck: ['.#####.', '#######', '#######', '.#####.', '.......', '.......'],
};
const STAND_BG = [rgba('#4a3a6e'), rgba('#43345f'), rgba('#3c2f57'), rgba('#36294e'), rgba('#302446')];

const STANDS_TOP = -HW * PROJ.y - WALL; // first crowd row sits right above the far boards

/** Soft light pools over the playing surface (0..1). */
function lightAt(wx, wy) {
  let l = 0;
  for (const lx of [-17, 0, 17]) l += Math.exp(-(((wx - lx) / 9) ** 2) - (((wy + 1) / 7) ** 2));
  return Math.min(1, l * 0.85 + (wy + HW) / RINK.width * 0.15);
}

function floorColor(wx, wy, sx, sy, bx, by) {
  if (Math.abs(sx) <= 2.5) return C.red;                                   // centre line
  if (Math.abs(Math.abs(sx) - RINK.goalLineX * PROJ.x) <= 0.5) return C.red; // goal lines
  const dist = (cx, cy) => Math.hypot(wx - cx, wy - cy);
  if (dist(0, 0) < 0.35) return C.blue;
  const e = RINK.endCircle;
  for (const ex of [-e.x, e.x]) {
    for (const ey of [-e.y, e.y]) {
      const d = dist(ex, ey);
      if (d < 0.4) return C.red;
      if (d < e.r - 0.15 && (bx + by) % 2 === 0) return C.redSoft;           // tinted circle
    }
  }
  if (dist(0, 0) < RINK.centerCircleRadius - 0.15 && (bx + by) % 2 === 0) return C.blueSoft;
  const dx = Math.abs(wx) - RINK.goalLineX;
  if (dx < 0 && dx * dx + wy * wy < RINK.creaseRadius ** 2) return C.crease;
  // Lit floor: quantise light into 4 tones with a Bayer dither; faint 1 m tiles.
  const tile = (Math.floor(wx) + Math.floor(wy)) & 1 ? 0.06 : 0;
  const v = lightAt(wx, wy) * 2.6 + tile;
  const base = Math.floor(v), frac = v - base;
  const idx = Math.min(3, base + (frac > BAYER[(by & 3) * 4 + (bx & 3)] ? 1 : 0));
  return FLOOR[idx];
}

function farWall(wx, h, bx) {
  if (h > WALL - 1) return C.outline;
  if (h > WALL - 2) return C.railLight;
  if (h > WALL - 4) return C.rail;
  if (h < 2) return C.kick;
  const u = (wx + HL) / 5;
  if (u - Math.floor(u) < 0.012) return C.sep;
  const p = Math.floor(u);
  return p % 2 ? ADS[(p >> 1) % ADS.length].bg : C.board;
}

function stands(bx, sy) {
  const up = STANDS_TOP - sy;
  const row = Math.floor(up / 6);
  const local = up - row * 6;
  const bg = STAND_BG[Math.min(STAND_BG.length - 1, row >> 1)];
  if (local < 1) return C.outline;          // step edge
  if (local < 2 && (bx & 1)) return STAND_BG[0]; // seat backs
  return bg;
}

function plotEllipse(s, cx, cy, r, color, from = 0, to = Math.PI * 2) {
  const steps = 900;
  for (let i = 0; i <= steps; i++) {
    const t = from + ((to - from) * i) / steps;
    const p = project(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
    s.set(p.x - BAKE.x0, p.y - BAKE.y0, color);
  }
}

function stamp(s, rows, x, y, color) {
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === '#') s.set(x + i, y + j, color); });
}

/** Centre-court mascot: a smiling puck with a star. */
function mascot(s) {
  const cx = -BAKE.x0, cy = -BAKE.y0;
  const body = rgba('#a98bff'), bodyShade = rgba('#8a6be6'), top = rgba('#c9b6ff');
  for (let y = -10; y <= 10; y++) {
    for (let x = -22; x <= 22; x++) {
      const d = (x / 21) ** 2 + (y / 9.5) ** 2;
      if (d > 1) continue;
      let c = y < -2 ? top : body;
      if (y > 4 && d > 0.55) c = bodyShade;
      if (d > 0.86) c = C.ink;
      s.set(cx + x, cy + y, c);
    }
  }
  // eyes with sparkles, rosy cheeks, smile
  for (const ex of [-8, 5]) {
    s.rect(cx + ex, cy - 3, 3, 4, C.ink);
    s.set(cx + ex, cy - 3, C.white);
    s.set(cx + ex + (ex < 0 ? -3 : 5), cy + 2, rgba(PAL.pink));
    s.set(cx + ex + (ex < 0 ? -2 : 4), cy + 2, rgba(PAL.pink));
  }
  for (let x = -3; x <= 3; x++) s.set(cx + x - 1, cy + 3 + (Math.abs(x) < 2 ? 1 : 0), C.ink);
  stamp(s, ICONS.star, cx + 14, cy - 14, rgba(PAL.yellow));
}

export function bakeRink() {
  const { w, h, x0, y0 } = BAKE;
  const bg = new Surface(w, h);
  const fg = new Surface(w, h);

  const tops = new Float32Array(w), bots = new Float32Array(w), has = new Uint8Array(w);
  for (let bx = 0; bx < w; bx++) {
    const ext = rinkExtentAt((bx + x0 + 0.5) / PROJ.x);
    if (ext) { has[bx] = 1; tops[bx] = ext.top * PROJ.y; bots[bx] = ext.bottom * PROJ.y; }
  }

  for (let by = 0; by < h; by++) {
    const sy = by + y0 + 0.5;
    for (let bx = 0; bx < w; bx++) {
      const sx = bx + x0 + 0.5;
      const wx = sx / PROJ.x;
      let c;
      if (has[bx] && sy >= tops[bx] && sy <= bots[bx]) c = floorColor(wx, sy / PROJ.y, sx, sy, bx, by);
      else if (has[bx] && sy < tops[bx] && sy >= tops[bx] - WALL) c = farWall(wx, tops[bx] - sy, bx);
      else if (sy < STANDS_TOP) c = stands(bx, sy);
      else c = ((bx >> 2) + (by >> 2)) & 1 ? C.concourseA : C.concourseB;
      bg.px[by * w + bx] = c;

      // Near boards: see-through glass with a bright rail.
      if (has[bx] && sy <= bots[bx] && sy > bots[bx] - WALL) {
        const hh = bots[bx] - sy;
        let f;
        if (hh > WALL - 1) f = C.outline;
        else if (hh > WALL - 2) f = C.railLight;
        else if (hh > WALL - 4) f = C.rail;
        else if (hh < 2) f = rgba(PAL.yellow, 190);
        else f = (bx + by) % 7 === 0 ? rgba('#ffffff', 170) : rgba('#f3eeff', 95);
        fg.px[by * w + bx] = f;
      }
    }
  }

  // Icons on the coloured ad panels of the far boards.
  for (let p = 0; p * 5 < RINK.length; p++) {
    if (p % 2 === 0) continue;
    const ad = ADS[(p >> 1) % ADS.length];
    const wx = -HL + p * 5 + 2.5;
    const ext = rinkExtentAt(wx);
    if (!ext || ext.top > -HW + 0.01) continue;
    const sx = Math.round(wx * PROJ.x) - x0 - 3, sy = Math.round(ext.top * PROJ.y - WALL / 2) - y0 - 3;
    stamp(bg, ICONS[ad.icon], sx, sy, C.white);
  }

  // End boards are seen edge-on: draw them as a thin strip.
  for (const side of [-1, 1]) {
    const sx = side * HL * PROJ.x;
    const top = -(HW - R) * PROJ.y - WALL, bottom = (HW - R) * PROJ.y;
    for (let sy = Math.floor(top); sy <= bottom; sy++) {
      bg.set(sx - x0 - (side > 0 ? 1 : 0), sy - y0, C.rail);
      bg.set(sx - x0 - (side > 0 ? 0 : 1), sy - y0, C.outline);
    }
  }

  // Lines and markings.
  plotEllipse(bg, 0, 0, RINK.centerCircleRadius, C.blue);
  const e = RINK.endCircle;
  for (const cx of [-e.x, e.x]) for (const cy of [-e.y, e.y]) plotEllipse(bg, cx, cy, e.r, C.red);
  plotEllipse(bg, -RINK.goalLineX, 0, RINK.creaseRadius, C.creaseEdge, -Math.PI / 2, Math.PI / 2);
  plotEllipse(bg, RINK.goalLineX, 0, RINK.creaseRadius, C.creaseEdge, Math.PI / 2, Math.PI * 1.5);
  mascot(bg);

  return { background: bg.toCanvas(), foreground: fg.toCanvas(), x0, y0, crowd: bakeCrowd() };
}

/**
 * The crowd on its own layer so it can move: two idle frames (half the fans bob)
 * and two cheering frames (arms up, scarves waving).
 */
function bakeCrowd() {
  const { w, x0, y0 } = BAKE;
  const h = Math.ceil(STANDS_TOP - y0);
  const hair = ['#5a3b2e', '#2a1f3d', '#f2c14e', '#c4632e', '#8a5a44', '#e8e2d8', '#ff9fc4'].map((c) => rgba(c));
  const shirts = [PAL.red, PAL.blue, PAL.white, PAL.yellow, PAL.green, PAL.orange, PAL.purple, PAL.sky, PAL.pink].map((c) => rgba(c));
  const frames = [];
  for (let f = 0; f < 4; f++) {
    const s = new Surface(w, h);
    const cheering = f >= 2;
    for (let row = 0; row * 6 + 6 <= h; row++) {
      const base = Math.floor(STANDS_TOP - y0) - row * 6;   // row baseline (bake coords)
      for (let cell = 0; cell * 4 < w; cell++) {
        const seed = hash2(cell, row);
        if (seed > 0.8 - row * 0.02) continue;              // empty seat
        const x = cell * 4 + (row & 1) * 2;
        const bob = (f % 2 === 1 && (cell + row) % 2 === 0) || (cheering && (cell + row + f) % 2 === 0) ? 1 : 0;
        const y = base - 5 - bob;
        const shirt = shirts[Math.floor(hash2(cell + 9, row) * shirts.length)];
        const hc = hair[Math.floor(hash2(cell + 3, row) * hair.length)];
        // body, head (hair on top), face
        s.rect(x, y + 3, 3, 2, shirt);
        s.rect(x, y, 3, 1, hc);
        s.rect(x, y + 1, 3, 2, C.skin);
        s.set(x, y + 1, hc);
        if (cheering && (cell + f) % 3 !== 0) { s.set(x - 1, y - 1, C.skin); s.set(x + 3, y - 1, C.skin); }
        if (cheering && hash2(cell, row + 50) < 0.12) s.rect(x - 1, y - 3, 5, 1, shirts[(cell + f) % shirts.length]); // scarf
      }
    }
    frames.push(s.toCanvas());
  }
  return { frames, y0, x0 };
}

/** Bake one goal as a sprite. side = -1 (left) or +1 (right); the net opens toward centre. */
export function bakeGoal(side) {
  const gx = side * RINK.goalLineX;
  const bx = gx + side * GOAL.depth;
  const tx = gx + side * GOAL.depth * 0.45;
  const hw = GOAL.width / 2, H = GOAL.height;
  const P = {
    FB: project(gx, -hw, 0), FT: project(gx, -hw, H),
    NB: project(gx, hw, 0), NT: project(gx, hw, H),
    BF: project(bx, -hw, 0), BN: project(bx, hw, 0),
    TF: project(tx, -hw, H * 0.92), TN: project(tx, hw, H * 0.92),
  };
  const all = Object.values(P);
  const ox = Math.floor(Math.min(...all.map((p) => p.x))) - 2;
  const oy = Math.floor(Math.min(...all.map((p) => p.y))) - 2;
  const w = Math.ceil(Math.max(...all.map((p) => p.x))) - ox + 3;
  const h = Math.ceil(Math.max(...all.map((p) => p.y))) - oy + 3;
  const L = {};
  for (const [k, p] of Object.entries(P)) L[k] = { x: p.x - ox, y: p.y - oy };

  const s = new Surface(w, h);
  const meshDark = rgba(PAL.mist, 200), meshLight = rgba(PAL.white, 210), frame = rgba(PAL.red), frameDark = rgba(PAL.redDark);
  const mesh = (c) => (x, y) => ((x + y) % 3 === 0 || ((x - y) % 3 + 3) % 3 === 0 ? c : 0);
  const dark = rgba(PAL.shadow, 110);

  s.poly([L.TF, L.TN, L.BN, L.BF], (x, y) => mesh(meshDark)(x, y) || dark);  // back
  s.poly([L.FB, L.FT, L.TF, L.BF], mesh(meshDark));                            // far side
  s.poly([L.FT, L.NT, L.TN, L.TF], mesh(meshLight));                           // top
  // Base frame on the floor
  s.line(L.FB.x, L.FB.y, L.BF.x, L.BF.y, frameDark);
  s.line(L.BF.x, L.BF.y, L.BN.x, L.BN.y, frameDark);
  s.line(L.BN.x, L.BN.y, L.NB.x, L.NB.y, frameDark);
  // Far post + crossbar
  s.line(L.FB.x, L.FB.y, L.FT.x, L.FT.y, frame);
  s.line(L.FB.x + side * -1, L.FB.y, L.FT.x + side * -1, L.FT.y, frameDark);
  s.line(L.FT.x, L.FT.y, L.NT.x, L.NT.y, frame);
  s.line(L.FT.x, L.FT.y - 1, L.NT.x, L.NT.y - 1, frame);
  s.poly([L.NB, L.NT, L.TN, L.BN], mesh(meshLight));                           // near side
  // Near post
  s.line(L.NB.x, L.NB.y, L.NT.x, L.NT.y, frame);
  s.line(L.NB.x + side * -1, L.NB.y, L.NT.x + side * -1, L.NT.y, frame);

  return { canvas: s.toCanvas(), x: ox, y: oy, sortY: 0 };
}
