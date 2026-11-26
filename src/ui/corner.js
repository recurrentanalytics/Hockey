// Small round buttons pinned to the top corners: fullscreen (right) and back (left, touch only).
import { PAL } from '../engine/palette.js';
import { fillCircle, strokeCircle } from '../engine/draw.js';

export const FS_BUTTON = (W) => ({ x: W - 13, y: 13, r: 9 });
export const BACK_BUTTON = { x: 13, y: 13, r: 9 };

export function hit(btn, p, pad = 5) {
  return Math.hypot(p.x - btn.x, p.y - btn.y) <= btn.r + pad;
}

function base(ctx, b) {
  ctx.save();
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = PAL.ink;
  fillCircle(ctx, b.x, b.y, b.r);
  ctx.globalAlpha = 1;
  ctx.fillStyle = PAL.mist;
  strokeCircle(ctx, b.x, b.y, b.r);
  ctx.restore();
}

/** Four corner brackets; pointing inward when already fullscreen. */
export function drawFullscreenButton(ctx, W, active) {
  const b = FS_BUTTON(W);
  base(ctx, b);
  ctx.fillStyle = PAL.white;
  for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    if (!active) {
      // expand: brackets in the corners, arms pointing toward the centre
      const cx = b.x + dx * 4, cy = b.y + dy * 4;
      ctx.fillRect(dx < 0 ? cx : cx - 2, cy, 3, 1);
      ctx.fillRect(cx, dy < 0 ? cy : cy - 2, 1, 3);
    } else {
      // exit: brackets near the centre, arms pointing outward
      const cx = b.x + dx * 2, cy = b.y + dy * 2;
      ctx.fillRect(dx < 0 ? cx - 2 : cx, cy, 3, 1);
      ctx.fillRect(cx, dy < 0 ? cy - 2 : cy, 1, 3);
    }
  }
}

export function drawBackButton(ctx) {
  const b = BACK_BUTTON;
  base(ctx, b);
  ctx.fillStyle = PAL.white;
  // left-pointing arrow
  for (let i = 0; i < 4; i++) ctx.fillRect(b.x - 3 + i, b.y - i, 1, i * 2 + 1);
  ctx.fillRect(b.x + 1, b.y - 1, 3, 3);
}
