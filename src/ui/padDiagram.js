// A pixel drawing of an SNES-style pad (8BitDo SN30 Pro): d-pad, four face buttons,
// shoulders, select/start and two sticks. Used by the guided setup.
import { PAL } from '../engine/palette.js';
import { fillCircle, strokeCircle } from '../engine/draw.js';
import { drawText } from '../engine/font.js';

/** Where each physical control sits, relative to the pad centre. */
export function padParts(cx, cy) {
  return {
    l: { x: cx - 36, y: cy - 21, w: 22, h: 4 },
    zl: { x: cx - 34, y: cy - 25, w: 16, h: 3 },
    r: { x: cx + 14, y: cy - 21, w: 22, h: 4 },
    zr: { x: cx + 18, y: cy - 25, w: 16, h: 3 },
    up: { x: cx - 31, y: cy - 12, w: 5, h: 6 },
    down: { x: cx - 31, y: cy - 1, w: 5, h: 6 },
    left: { x: cx - 37, y: cy - 6, w: 6, h: 5 },
    right: { x: cx - 26, y: cy - 6, w: 6, h: 5 },
    north: { x: cx + 30, y: cy - 11, r: 4 },
    west: { x: cx + 22, y: cy - 4, r: 4 },
    east: { x: cx + 38, y: cy - 4, r: 4 },
    south: { x: cx + 30, y: cy + 3, r: 4 },
    select: { x: cx - 10, y: cy - 8, w: 7, h: 3 },
    start: { x: cx + 3, y: cy - 8, w: 7, h: 3 },
    stickUp: { x: cx - 11, y: cy + 8, r: 5 },
    stickLeft: { x: cx - 11, y: cy + 8, r: 5 },
    stickR: { x: cx + 11, y: cy + 8, r: 5 },
  };
}

/**
 * @param letters   printed face-button letters, e.g. { north:'X', west:'Y', east:'A', south:'B' }
 * @param highlight physical part to light up
 * @param done      parts already assigned (drawn green)
 */
export function drawPad(ctx, cx, cy, { letters, highlight = null, done = new Set() } = {}) {
  const P = padParts(cx, cy);
  const color = (k, base) => (k === highlight ? PAL.yellow : done.has(k) ? PAL.green : base);
  // Shoulders sit behind the body.
  for (const k of ['zl', 'zr', 'l', 'r']) {
    const p = P[k];
    ctx.fillStyle = color(k, k.startsWith('z') ? PAL.steel : PAL.mist);
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // Body: rounded bar with two grips.
  ctx.fillStyle = PAL.ink;
  fillCircle(ctx, cx - 34, cy, 19);
  fillCircle(ctx, cx + 34, cy, 19);
  ctx.fillRect(cx - 34, cy - 19, 68, 39);
  ctx.fillStyle = PAL.cloud;
  fillCircle(ctx, cx - 34, cy, 18);
  fillCircle(ctx, cx + 34, cy, 18);
  ctx.fillRect(cx - 34, cy - 18, 68, 37);
  // D-pad
  ctx.fillStyle = PAL.ink;
  ctx.fillRect(cx - 37, cy - 6, 17, 5);
  ctx.fillRect(cx - 31, cy - 12, 5, 17);
  for (const k of ['up', 'down', 'left', 'right']) {
    const p = P[k];
    if (k === highlight || done.has(k)) { ctx.fillStyle = color(k, PAL.ink); ctx.fillRect(p.x, p.y, p.w, p.h); }
  }
  // Select / start
  for (const k of ['select', 'start']) {
    const p = P[k];
    ctx.fillStyle = color(k, PAL.steel);
    ctx.fillRect(p.x, p.y, p.w, p.h);
  }
  // Sticks
  for (const k of ['stickUp', 'stickR']) {
    const p = P[k];
    ctx.fillStyle = PAL.ink;
    fillCircle(ctx, p.x, p.y, p.r);
    const left = k === 'stickUp';
    const lit = left ? highlight === 'stickUp' || highlight === 'stickLeft' : highlight === k;
    const set = left ? done.has('stickUp') || done.has('stickLeft') : done.has(k);
    ctx.fillStyle = lit ? PAL.yellow : set ? PAL.green : PAL.slate;
    fillCircle(ctx, p.x, p.y, p.r - 2);
  }
  // Face buttons with their printed letters
  for (const k of ['north', 'west', 'east', 'south']) {
    const p = P[k];
    ctx.fillStyle = color(k, PAL.purple);
    fillCircle(ctx, p.x, p.y, p.r);
    ctx.fillStyle = PAL.ink;
    strokeCircle(ctx, p.x, p.y, p.r);
    const t = letters?.[k] ?? '';
    if (t.length === 1) drawText(ctx, t, p.x - 1, p.y - 2, { color: k === highlight ? PAL.ink : PAL.white });
  }
}
