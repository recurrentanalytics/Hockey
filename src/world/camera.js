// Smooth follow camera in world-pixel space.
import { BAKE } from './rink.js';

export class Camera {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  snap(x, y, viewW, viewH) {
    this.x = x;
    this.y = y;
    this.clamp(viewW, viewH);
  }

  follow(tx, ty, dt, viewW, viewH, stiffness = 5) {
    const k = 1 - Math.exp(-stiffness * dt);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
    this.clamp(viewW, viewH);
  }

  /** Keep the view inside the baked arena where possible. */
  clamp(viewW, viewH) {
    const minX = BAKE.x0 + 12, maxX = BAKE.x0 + BAKE.w - 12;
    const minY = BAKE.y0 + 4, maxY = BAKE.y0 + BAKE.h - 4;
    this.x = viewW >= maxX - minX ? (minX + maxX) / 2 : Math.max(minX + viewW / 2, Math.min(maxX - viewW / 2, this.x));
    this.y = viewH >= maxY - minY ? (minY + maxY) / 2 : Math.max(minY + viewH / 2, Math.min(maxY - viewH / 2, this.y));
  }
}
