// Crisp primitive helpers for the low-res canvases (no anti-aliasing).

export function fillCircle(ctx, cx, cy, r) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let dy = -r; dy <= r; dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy + r * 0.8));
    ctx.fillRect(cx - w, cy + dy, w * 2 + 1, 1);
  }
}

export function strokeCircle(ctx, cx, cy, r) {
  cx = Math.round(cx); cy = Math.round(cy);
  for (let dy = -r - 1; dy <= r + 1; dy++) {
    for (let dx = -r - 1; dx <= r + 1; dx++) {
      if (Math.abs(Math.hypot(dx, dy) - r) < 0.55) ctx.fillRect(cx + dx, cy + dy, 1, 1);
    }
  }
}

export function panel(ctx, x, y, w, h, { fill = '#171a2b', border = '#57608a', alpha = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  if (border) {
    ctx.fillStyle = border;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h);
    ctx.fillRect(x + w - 1, y, 1, h);
  }
}

export function dim(ctx, w, h, alpha = 0.55, color = '#0e0f1a') {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** 1px Bresenham line with fillRect (crisp on the low-res layers). */
export function pixelLine(ctx, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let n = 0; n < 400; n++) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
