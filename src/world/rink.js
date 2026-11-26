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
  floorA: rgba(PAL.floorA),
  floorB: rgba(PAL.floorB),
  red: rgba(PAL.red),
  blue: rgba(PAL.blue),
  crease: rgba('#9cc7ea'),
  board: rgba(PAL.white),
  boardShade: rgba(PAL.cloud),
  rail: rgba('#ffffff'),
  outline: rgba(PAL.slate),
  kick: rgba(PAL.yellow),
  sep: rgba(PAL.mist),
  concourseA: rgba(PAL.shadow),
  concourseB: rgba('#20253d'),
  stepEdge: rgba(PAL.slate),
  skin: rgba(PAL.skin),
};
const ADS = [rgba(PAL.blue), rgba(PAL.red), rgba(PAL.green), rgba(PAL.orange), rgba(PAL.purple)];
const SHIRTS = [PAL.red, PAL.blue, PAL.white, PAL.yellow, PAL.green, PAL.orange, PAL.purple, PAL.mist, PAL.sky].map((c) => rgba(c));
const STAND_BG = [rgba('#2a3050'), rgba('#262b48'), rgba('#22263f'), rgba('#1e2238'), rgba('#1a1d31')];

const STANDS_TOP = -HW * PROJ.y - WALL; // first crowd row sits right above the far boards

function floorColor(wx, wy, sx) {
  if (Math.abs(sx) <= 2.5) return C.red;                                   // centre line
  if (Math.abs(Math.abs(sx) - RINK.goalLineX * PROJ.x) <= 0.5) return C.red; // goal lines
  const spot = (cx, cy, r) => (wx - cx) ** 2 + (wy - cy) ** 2 < r * r;
  if (spot(0, 0, 0.35)) return C.blue;
  const e = RINK.endCircle;
  for (const sx2 of [-e.x, e.x]) for (const sy2 of [-e.y, e.y]) if (spot(sx2, sy2, 0.35)) return C.red;
  const dx = Math.abs(wx) - RINK.goalLineX;
  if (dx < 0 && dx * dx + wy * wy < RINK.creaseRadius ** 2) return C.crease;
  return (Math.floor(wx) + Math.floor(wy)) & 1 ? C.floorA : C.floorB;
}

function farWall(wx, h) {
  if (h > WALL - 1) return C.outline;
  if (h > WALL - 3) return C.rail;
  if (h > WALL - 4) return C.boardShade;
  if (h < 2) return C.kick;
  const u = (wx + HL) / 5;
  if (u - Math.floor(u) < 0.012) return C.sep;
  const p = Math.floor(u);
  return p % 2 ? ADS[(p >> 1) % ADS.length] : C.board;
}

function stands(bx, sy) {
  const up = STANDS_TOP - sy;                // pixels above the first row's base
  const row = Math.floor(up / 6);
  const local = up - row * 6;                // 0 = step edge, 5 = top of row
  const bg = STAND_BG[Math.min(STAND_BG.length - 1, row >> 1)];
  if (local < 1) return C.stepEdge;
  const cellX = Math.floor((bx + row * 2) / 3);
  const inCell = (bx + row * 2) - cellX * 3;
  const seated = hash2(cellX, row) < 0.78 - row * 0.03;
  if (!seated || inCell === 2) return bg;
  if (local < 3) return SHIRTS[Math.floor(hash2(cellX + 77, row) * SHIRTS.length)];
  if (local < 4) return C.skin;
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
      if (has[bx] && sy >= tops[bx] && sy <= bots[bx]) c = floorColor(wx, sy / PROJ.y, sx);
      else if (has[bx] && sy < tops[bx] && sy >= tops[bx] - WALL) c = farWall(wx, tops[bx] - sy);
      else if (sy < STANDS_TOP) c = stands(bx, sy);
      else c = (bx >> 1) + (by >> 1) & 1 ? C.concourseA : C.concourseB;
      bg.px[by * w + bx] = c;

      // Near boards: overlay, partially transparent so skaters stay readable behind them.
      if (has[bx] && sy <= bots[bx] && sy > bots[bx] - WALL) {
        const hh = bots[bx] - sy;
        let f;
        if (hh > WALL - 1) f = C.outline;
        else if (hh > WALL - 3) f = C.rail;
        else if (hh < 2) f = rgba(PAL.yellow, 170);
        else f = rgba(PAL.white, 120);
        fg.px[by * w + bx] = f;
      }
    }
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

  // Circles and crease outlines.
  plotEllipse(bg, 0, 0, RINK.centerCircleRadius, C.blue);
  const e = RINK.endCircle;
  for (const cx of [-e.x, e.x]) for (const cy of [-e.y, e.y]) plotEllipse(bg, cx, cy, e.r, C.red);
  plotEllipse(bg, -RINK.goalLineX, 0, RINK.creaseRadius, C.red, -Math.PI / 2, Math.PI / 2);
  plotEllipse(bg, RINK.goalLineX, 0, RINK.creaseRadius, C.red, Math.PI / 2, Math.PI * 1.5);

  return { background: bg.toCanvas(), foreground: fg.toCanvas(), x0, y0 };
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
