// Shared UI bits: title header, button hint bar, toasts.
import { PAL } from '../engine/palette.js';
import { drawText, textWidth, drawTextOutlined } from '../engine/font.js';
import { panel } from '../engine/draw.js';

export function header(ctx, W, title, subtitle) {
  drawTextOutlined(ctx, title, W / 2, 16, { color: PAL.white, scale: 2, align: 'center', big: true });
  ctx.fillStyle = PAL.yellow;
  const w = textWidth(title, 2, true);
  ctx.fillRect(Math.round(W / 2 - w / 2), 34, w, 1);
  if (subtitle) drawTextOutlined(ctx, subtitle, W / 2, 41, { color: PAL.cloud, align: 'center' });
}

/** pairs: [[buttonLabel, actionText], ...]; null labels are skipped. */
export function hintBar(ctx, W, H, pairs) {
  const parts = pairs.filter(([k]) => k);
  if (!parts.length) return;
  const gap = 10;
  const widths = parts.map(([k, t]) => textWidth(k) + 4 + 4 + textWidth(t));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
  let x = Math.round(W / 2 - total / 2);
  const y = H - 11;
  panel(ctx, x - 5, y - 4, total + 10, 13, { fill: PAL.ink, border: null, alpha: 0.7 });
  parts.forEach(([k, t], i) => {
    const kw = textWidth(k) + 4;
    ctx.fillStyle = PAL.cloud;
    ctx.fillRect(x, y - 1, kw, 7);
    drawText(ctx, k, x + 2, y, { color: PAL.ink });
    drawText(ctx, t, x + kw + 4, y, { color: PAL.cloud, shadow: PAL.ink });
    x += widths[i] + gap;
  });
}

export class Toasts {
  constructor() {
    this.items = [];
  }

  push(text, seconds = 2.6) {
    this.items.push({ text, t: seconds });
    if (this.items.length > 3) this.items.shift();
  }

  update(dt) {
    for (const it of this.items) it.t -= dt;
    this.items = this.items.filter((it) => it.t > 0);
  }

  draw(ctx, W, H) {
    this.items.forEach((it, i) => {
      const w = textWidth(it.text) + 10;
      const x = Math.round(W / 2 - w / 2), y = H - 32 - i * 12;
      panel(ctx, x, y, w, 10, { fill: PAL.ink, border: PAL.yellow, alpha: 0.9 });
      drawText(ctx, it.text, x + 5, y + 3, { color: PAL.white });
    });
  }
}
