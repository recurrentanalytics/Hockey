// Rink geometry and the one-time bake of the rink art into canvases.
//  background: floor, markings, far boards, stands (drawn under everything)
//  foreground: near boards (drawn over skaters, partly see-through)
import { RINK, GOAL, PROJ } from '../config.js';
import { PAL } from '../engine/palette.js';
import { Surface, rgba, hash2 } from '../engine/raster.js';
import { project } from './projection.js';
import { drawText } from '../engine/font.js';

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

// Bonifatiusplatz ("der Boni"): outdoor asphalt pitch with wooden boards, grass and trees.
const ASPHALT = [rgba('#868aa0'), rgba('#9094a9'), rgba('#9a9eb2'), rgba('#a6aabd')];
const GRASS = [rgba('#76c276'), rgba('#6ab56c'), rgba('#83cc80'), rgba('#5fa863')];
const BONI = {
  plank: rgba('#c08a55'), plankDark: rgba('#99683c'), plankTop: rgba('#e0b07c'),
  crack: rgba('#787c90'), speck: rgba('#b4b8c8'), speckDark: rgba('#7d8195'),
  red: rgba('#ee7183'), blue: rgba('#6d9ae8'), crease: rgba('#a9dcf2'),
  flower: [rgba('#fffaf4'), rgba('#ffd35c'), rgba('#ff9fc4')],
  trunk: rgba('#7a5030'), leaf: [rgba('#4f9e5a'), rgba('#5fb468'), rgba('#3f8a4c'), rgba('#7cc876')],
  sand: rgba('#ecd9a8'), sandDark: rgba('#d9c28a'), hippo: rgba('#b8a6d9'), hippoDark: rgba('#9584bd'),
};
let venue = 'arena';

const STANDS_TOP = -HW * PROJ.y - WALL; // first crowd row sits right above the far boards

/** Soft light pools over the playing surface (0..1). */
function lightAt(wx, wy) {
  let l = 0;
  for (const lx of [-17, 0, 17]) l += Math.exp(-(((wx - lx) / 9) ** 2) - (((wy + 1) / 7) ** 2));
  return Math.min(1, l * 0.85 + (wy + HW) / RINK.width * 0.15);
}

function floorColor(wx, wy, sx, sy, bx, by) {
  const out = venue === 'boni';
  const red = out ? BONI.red : C.red;
  if (Math.abs(sx) <= 2.5) return red;                                     // centre line
  if (Math.abs(Math.abs(sx) - RINK.goalLineX * PROJ.x) <= 0.5) return red; // goal lines
  if (out) {
    // Painted asphalt: no tinted circles, speckles of grit, light from the sky
    const dx2 = Math.abs(wx) - RINK.goalLineX;
    if (dx2 < 0 && dx2 * dx2 + wy * wy < RINK.creaseRadius ** 2) return BONI.crease;
    const n = hash2(bx * 3 + 1, by * 7 + 2);
    if (n < 0.018) return BONI.speckDark;
    if (n > 0.985) return BONI.speck;
    const v = 1.2 + lightAt(wx, wy) * 1.6;
    const base = Math.floor(v), frac = v - base;
    return ASPHALT[Math.min(3, base + (frac > BAYER[(by & 3) * 4 + (bx & 3)] ? 1 : 0))];
  }
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
  if (venue === 'boni') {
    if (h > WALL - 1) return C.outline;
    if (h > WALL - 3) return BONI.plankTop;
    if (Math.floor(h) % 4 === 0) return BONI.plankDark;                    // gaps between planks
    return (Math.floor((wx + HL) * 1.3) % 9 === 0) ? BONI.plankDark : BONI.plank;
  }
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

function grass(bx, by) {
  const n = hash2(bx, by);
  if (n < 0.012) return BONI.flower[Math.floor(n * 1000) % 3];
  return GRASS[(((bx >> 1) + (by >> 1)) & 1) + (n > 0.6 ? 2 : 0)];
}

/** A round tree crown with a trunk (top-down-ish, like the rest of the scene). */
function tree(s, x, y, r) {
  s.rect(x - 1, y, 3, Math.round(r * 0.8), BONI.trunk);
  for (let j = -r; j <= r; j++) {
    for (let i = -r; i <= r; i++) {
      const d = (i * i) / (r * r) + (j * j) / (r * r * 0.7);
      if (d > 1) continue;
      let c = BONI.leaf[1];
      if (d > 0.82) c = C.ink;
      else if (j < -r * 0.3 && i > -r * 0.2) c = BONI.leaf[3];
      else if (j > r * 0.3 || i < -r * 0.4) c = BONI.leaf[2];
      if (d <= 0.82 && hash2(x + i, y + j) < 0.12) c = BONI.leaf[0];
      s.set(x + i, y - Math.round(r * 0.4) + j, c);
    }
  }
}

/** The hippo from the playground next to the Boni, in a sand pit. */
function hippo(s, x, y) {
  for (let j = -9; j <= 9; j++) for (let i = -24; i <= 24; i++) if ((i / 24) ** 2 + (j / 9) ** 2 <= 1) s.set(x + i, y + j, (i + j) % 5 === 0 ? BONI.sandDark : BONI.sand);
  const body = (i, j) => (i / 13) ** 2 + (j / 7) ** 2 <= 1;
  for (let j = -8; j <= 8; j++) for (let i = -14; i <= 14; i++) if (body(i, j)) s.set(x - 3 + i, y - 4 + j, j > 3 ? BONI.hippoDark : BONI.hippo);
  for (let j = -6; j <= 6; j++) for (let i = -7; i <= 7; i++) if ((i / 7) ** 2 + (j / 6) ** 2 <= 1) s.set(x + 11 + i, y - 6 + j, BONI.hippo);
  s.rect(x + 13, y - 4, 6, 4, BONI.hippoDark);                                   // muzzle
  s.set(x + 15, y - 3, C.ink); s.set(x + 17, y - 3, C.ink);                       // nostrils
  s.rect(x + 9, y - 9, 2, 2, C.ink); s.set(x + 9, y - 9, C.white);                // eye
  s.rect(x + 7, y - 13, 2, 2, BONI.hippoDark); s.rect(x + 13, y - 13, 2, 2, BONI.hippoDark); // ears
  for (const lx of [-12, -5, 2, 8]) s.rect(x - 3 + lx, y + 3, 3, 3, BONI.hippoDark); // legs
}

/** Centre logo for Borstentiere games: Bonny's face. */
function boarMascot(s) {
  const cx = -BAKE.x0, cy = -BAKE.y0;
  const fur = rgba('#8a5a34'), furDark = rgba('#5e3b20'), furLight = rgba('#b07a48'), snout = rgba('#e8b48f'), green = rgba('#2d4a2b'), cream = rgba('#f7e9c0');
  // green badge with a cream ring
  for (let y = -13; y <= 13; y++) for (let x = -28; x <= 28; x++) {
    const d = (x / 27) ** 2 + (y / 12.5) ** 2;
    if (d > 1) continue;
    s.set(cx + x, cy + y, d > 0.9 ? C.ink : d > 0.78 ? cream : green);
  }
  // ears, face, crest
  for (const ex of [-11, 7]) { s.rect(cx + ex, cy - 11, 5, 4, furDark); s.rect(cx + ex + 1, cy - 10, 3, 2, snout); }
  for (let y = -8; y <= 8; y++) for (let x = -13; x <= 13; x++) {
    const d = (x / 13) ** 2 + (y / 8) ** 2;
    if (d > 1) continue;
    s.set(cx + x, cy + y, d > 0.85 ? C.ink : y > 1 && Math.abs(x) < 8 ? furLight : x < -7 ? furDark : fur);
  }
  for (let x = -4; x <= 4; x += 2) s.set(cx + x, cy - 9, furDark);
  for (const ex of [-7, 4]) { s.rect(cx + ex, cy - 3, 3, 3, C.ink); s.set(cx + ex, cy - 3, C.white); }
  for (let y = -2; y <= 2; y++) for (let x = -5; x <= 5; x++) if ((x / 5) ** 2 + (y / 2.6) ** 2 <= 1) s.set(cx + x, cy + 3 + y, snout);
  s.set(cx - 2, cy + 3, furDark); s.set(cx + 2, cy + 3, furDark);
  s.set(cx - 7, cy + 4, C.white); s.set(cx + 7, cy + 4, C.white);
  s.set(cx - 9, cy + 1, rgba(PAL.pink)); s.set(cx + 9, cy + 1, rgba(PAL.pink));
}

export function bakeRink({ venue: v = 'arena', logo = 'puck' } = {}) {
  venue = v;
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
      else if (venue === 'boni') c = grass(bx, by);
      else if (sy < STANDS_TOP) c = stands(bx, sy);
      else c = ((bx >> 2) + (by >> 2)) & 1 ? C.concourseA : C.concourseB;
      bg.px[by * w + bx] = c;

      // Near boards: see-through glass with a bright rail.
      if (has[bx] && sy <= bots[bx] && sy > bots[bx] - WALL) {
        const hh = bots[bx] - sy;
        let f;
        if (hh > WALL - 1) f = C.outline;
        else if (venue === 'boni') f = hh > WALL - 3 ? BONI.plankTop : rgba('#c08a55', Math.floor(hh) % 4 === 0 ? 200 : 140);
        else if (hh > WALL - 2) f = C.railLight;
        else if (hh > WALL - 4) f = C.rail;
        else if (hh < 2) f = rgba(PAL.yellow, 190);
        else f = (bx + by) % 7 === 0 ? rgba('#ffffff', 170) : rgba('#f3eeff', 95);
        fg.px[by * w + bx] = f;
      }
    }
  }

  // Icons on the coloured ad panels of the far boards.
  for (let p = 0; p * 5 < RINK.length && venue !== 'boni'; p++) {
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
  if (logo === 'boar') boarMascot(bg); else mascot(bg);

  if (venue === 'boni') {
    // Eilenriede trees behind the pitch and around the corners, the playground hippo top right.
    for (let i = 0; i < 26; i++) {
      const x = i * 44 + Math.floor(hash2(i, 1) * 20);
      if (x > 830 && x < 930) continue; // room for the playground
      tree(bg, x, 34 + Math.floor(hash2(i, 2) * 22), 13 + Math.floor(hash2(i, 3) * 8));
    }
    for (const [x, y, r] of [[40, 150, 16], [70, 300, 18], [1010, 140, 15], [990, 310, 17], [20, 360, 14], [1040, 360, 13]]) tree(bg, x, y, r);
    hippo(bg, 880, 58);
  }

  const canvas = bg.toCanvas();
  if (venue === 'boni') {
    // A sign on the boards
    const g = canvas.getContext('2d');
    const sx = -x0 - 40, sy = Math.round(-HW * PROJ.y - WALL) - y0 + 3;
    g.fillStyle = PAL.ink; g.fillRect(sx - 1, sy - 1, 82, 9);
    g.fillStyle = '#2d4a2b'; g.fillRect(sx, sy, 80, 7);
    drawText(g, 'BONIFATIUSPLATZ', sx + 40, sy + 1, { color: '#f7e9c0', align: 'center' });
  }
  return { background: canvas, foreground: fg.toCanvas(), x0, y0, crowd: bakeCrowd(venue === 'boni' ? 0.25 : 1) };
}

/**
 * The crowd on its own layer so it can move: two idle frames (half the fans bob)
 * and two cheering frames (arms up, scarves waving).
 */
function bakeCrowd(density = 1) {
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
        if (seed > (0.8 - row * 0.02) * density || (density < 1 && row > 1)) continue; // empty seat / no stands outdoors
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
