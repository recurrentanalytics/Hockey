// Sprite API for the world: detailed skater and goalie figures (world/figures.js),
// hair colours for player looks, and a plain shadow.
import { PAL } from '../engine/palette.js';
import { Surface, rgba } from '../engine/raster.js';

export { skaterFigures, goalieFigures, SK_W, SK_H, SK_AX, SK_AY, GK_W, GK_H, GK_AX, GK_AY } from './figures.js';

export const HAIR = ['#5a3b2e', '#2a1f3d', '#f2c14e', '#c4632e', '#8a5a44', '#ff9fc4'];

function ellipse(s, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) s.set(x, y, color);
    }
  }
}

let shadowCanvas = null;
export function shadowSprite() {
  if (shadowCanvas) return shadowCanvas;
  const s = new Surface(16, 5);
  ellipse(s, 8, 2.5, 7.5, 2.3, rgba(PAL.ink, 70));
  ellipse(s, 8, 2.5, 5, 1.4, rgba(PAL.ink, 95));
  shadowCanvas = s.toCanvas();
  return shadowCanvas;
}
