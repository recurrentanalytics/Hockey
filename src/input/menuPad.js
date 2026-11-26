// On-screen menu controls for touch devices: d-pad on the left, OK / BACK on the right.
import { PAL } from '../engine/palette.js';
import { fillCircle, strokeCircle } from '../engine/draw.js';
import { drawText } from '../engine/font.js';

const EDGE = 8;
const ARM = 16;   // distance from d-pad centre to each arrow
const KEY = 6;    // half-size of an arrow key

export class MenuPad {
  constructor() {
    this.enabled = false;
    this.held = { up: false, down: false, left: false, right: false };
    this.confirm = false;
    this.back = false;
    this.dirId = null;
    this.okId = null;
    this.backId = null;
  }

  layout(W, H) {
    const cx = EDGE + 30, cy = H - EDGE - 30;
    return {
      pad: { x: cx, y: cy, r: 29 },
      arms: { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] },
      ok: { x: W - EDGE - 22, y: H - EDGE - 22, r: 16, label: 'OK' },
      back: { x: W - EDGE - 60, y: H - EDGE - 12, r: 12, label: 'ZURÜCK' },
    };
  }

  poll(pointers, display) {
    this.confirm = false;
    this.back = false;
    if (!this.enabled) {
      this.held = { up: false, down: false, left: false, right: false };
      this.dirId = this.okId = this.backId = null;
      return;
    }
    const L = this.layout(display.width, display.height);
    const near = (p, b, pad) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r + pad;
    for (const p of pointers.downs) {
      if (p.claimed) continue;
      if (near(p, L.ok, 5)) { this.confirm = true; this.okId = p.id; p.claimed = true; }
      else if (near(p, L.back, 5)) { this.back = true; this.backId = p.id; p.claimed = true; }
      else if (near(p, L.pad, 6)) { this.dirId = p.id; p.claimed = true; }
    }
    if (this.okId != null && !pointers.active.has(this.okId)) this.okId = null;
    if (this.backId != null && !pointers.active.has(this.backId)) this.backId = null;
    if (this.dirId != null && !pointers.active.has(this.dirId)) this.dirId = null;

    this.held = { up: false, down: false, left: false, right: false };
    if (this.dirId != null) {
      const p = pointers.active.get(this.dirId);
      const dx = p.x - L.pad.x, dy = p.y - L.pad.y;
      if (Math.hypot(dx, dy) > 5) {
        if (Math.abs(dx) > Math.abs(dy)) this.held[dx > 0 ? 'right' : 'left'] = true;
        else this.held[dy > 0 ? 'down' : 'up'] = true;
      }
    }
  }

  draw(ctx, W, H) {
    const L = this.layout(W, H);
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = PAL.ink;
    fillCircle(ctx, L.pad.x, L.pad.y, L.pad.r);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.mist;
    strokeCircle(ctx, L.pad.x, L.pad.y, L.pad.r);
    for (const [dir, [ax, ay]] of Object.entries(L.arms)) {
      const x = L.pad.x + ax * ARM, y = L.pad.y + ay * ARM;
      const on = this.held[dir];
      ctx.fillStyle = on ? PAL.yellow : PAL.slate;
      ctx.fillRect(x - KEY, y - KEY, KEY * 2 + 1, KEY * 2 + 1);
      ctx.fillStyle = on ? PAL.ink : PAL.white;
      // arrow head pointing along (ax, ay)
      for (let i = 0; i < 4; i++) {
        const len = i * 2 + 1;
        if (ax) ctx.fillRect(x + ax * (2 - i) - (ax < 0 ? 0 : 0), y - i, 1, len);
        else ctx.fillRect(x - i, y + ay * (2 - i), len, 1);
      }
    }
    for (const [b, color, on] of [[L.ok, PAL.green, this.okId != null], [L.back, PAL.red, this.backId != null]]) {
      ctx.globalAlpha = on ? 0.95 : 0.75;
      ctx.fillStyle = on ? PAL.yellow : color;
      fillCircle(ctx, b.x, b.y, b.r);
      ctx.globalAlpha = 1;
      ctx.fillStyle = PAL.white;
      strokeCircle(ctx, b.x, b.y, b.r);
      drawText(ctx, b.label, b.x, b.y - 2, { color: on ? PAL.ink : PAL.white, align: 'center', shadow: on ? null : PAL.ink });
    }
    ctx.restore();
  }
}
