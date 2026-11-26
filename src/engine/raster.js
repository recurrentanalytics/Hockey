// Tiny software rasteriser used to bake crisp pixel art into canvases.

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** '#rrggbb' → packed little-endian RGBA for Uint32 ImageData views. */
export function rgba(hex, alpha = 255) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return ((alpha << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export class Surface {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.image = new ImageData(w, h);
    this.px = new Uint32Array(this.image.data.buffer);
  }

  set(x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }

  get(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[y * this.w + x];
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  /** Fill a convex polygon (pixel coords). `shade(x, y)` returns a colour, or 0 to skip. */
  poly(points, shade) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const n = points.length;
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        const cx = x + 0.5, cy = y + 0.5;
        let pos = false, neg = false;
        for (let i = 0; i < n; i++) {
          const a = points[i], b = points[(i + 1) % n];
          const cross = (b.x - a.x) * (cy - a.y) - (b.y - a.y) * (cx - a.x);
          if (cross > 0) pos = true; else if (cross < 0) neg = true;
        }
        if (pos && neg) continue;
        const c = shade(x, y);
        if (c) this.set(x, y, c);
      }
    }
  }

  toCanvas() {
    const c = makeCanvas(this.w, this.h);
    c.getContext('2d').putImageData(this.image, 0, 0);
    return c;
  }
}

/** Deterministic hash → [0, 1). */
export function hash2(a, b) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
