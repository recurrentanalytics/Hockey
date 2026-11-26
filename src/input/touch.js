// On-screen controls: floating stick on the left, action buttons on the right.
import { PAL } from '../engine/palette.js';
import { fillCircle, strokeCircle } from '../engine/draw.js';
import { drawText } from '../engine/font.js';

const STICK_R = 22;

export class TouchController {
  constructor() {
    this.enabled = false;
    this.stick = null;            // { id, ox, oy }
    this.buttonPointers = new Map();
    this.down = {};
    this.move = { x: 0, y: 0 };
    this.pausePressed = false;
  }

  layout(W, H) {
    return {
      stickHome: { x: 40, y: H - 42 },
      pause: { x: W - 12, y: 12, r: 8 },
      buttons: [
        { action: 'shoot', label: 'SHOOT', x: W - 30, y: H - 32, r: 16 },
        { action: 'pass', label: 'PASS', x: W - 66, y: H - 20, r: 12 },
        { action: 'check', label: 'CHECK', x: W - 60, y: H - 58, r: 12 },
        { action: 'switch', label: 'SWAP', x: W - 26, y: H - 70, r: 11 },
        { action: 'sprint', label: 'BOOST', x: W - 98, y: H - 38, r: 12 },
      ],
    };
  }

  poll(pointers, display) {
    this.pausePressed = false;
    if (!this.enabled) {
      this.stick = null;
      this.buttonPointers.clear();
      this.down = {};
      this.move = { x: 0, y: 0 };
      return;
    }
    const L = this.layout(display.width, display.height);
    for (const p of pointers.downs) {
      if (p.claimed) continue;
      if (Math.hypot(p.x - L.pause.x, p.y - L.pause.y) <= L.pause.r + 5) {
        this.pausePressed = true;
        p.claimed = true;
        continue;
      }
      const b = L.buttons.find((b) => Math.hypot(p.x - b.x, p.y - b.y) <= b.r + 5);
      if (b) {
        this.buttonPointers.set(p.id, b.action);
        p.claimed = true;
        continue;
      }
      if (p.x < display.width * 0.5 && !this.stick) {
        this.stick = { id: p.id, ox: p.x, oy: p.y };
        p.claimed = true;
      }
    }
    for (const id of [...this.buttonPointers.keys()]) if (!pointers.active.has(id)) this.buttonPointers.delete(id);
    if (this.stick && !pointers.active.has(this.stick.id)) this.stick = null;

    this.down = {};
    for (const a of this.buttonPointers.values()) this.down[a] = true;

    this.move = { x: 0, y: 0 };
    if (this.stick) {
      const p = pointers.active.get(this.stick.id);
      let dx = (p.x - this.stick.ox) / STICK_R, dy = (p.y - this.stick.oy) / STICK_R;
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      if (len > 0.15) this.move = { x: dx, y: dy };
    }
  }

  draw(ctx, W, H) {
    const L = this.layout(W, H);
    ctx.save();
    const base = this.stick ? { x: this.stick.ox, y: this.stick.oy } : L.stickHome;
    ctx.globalAlpha = this.stick ? 0.5 : 0.28;
    ctx.fillStyle = PAL.ink;
    fillCircle(ctx, base.x, base.y, STICK_R);
    ctx.fillStyle = PAL.cloud;
    strokeCircle(ctx, base.x, base.y, STICK_R);
    ctx.globalAlpha = this.stick ? 0.85 : 0.4;
    fillCircle(ctx, base.x + this.move.x * STICK_R, base.y + this.move.y * STICK_R, 9);

    for (const b of L.buttons) {
      const on = this.down[b.action];
      ctx.globalAlpha = on ? 0.8 : 0.45;
      ctx.fillStyle = on ? PAL.yellow : PAL.ink;
      fillCircle(ctx, b.x, b.y, b.r);
      ctx.fillStyle = PAL.cloud;
      strokeCircle(ctx, b.x, b.y, b.r);
      ctx.globalAlpha = 0.95;
      drawText(ctx, b.label, b.x, b.y - 2, { color: on ? PAL.ink : PAL.white, align: 'center' });
    }

    ctx.globalAlpha = 0.6;
    ctx.fillStyle = PAL.ink;
    fillCircle(ctx, L.pause.x, L.pause.y, L.pause.r);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(L.pause.x - 3, L.pause.y - 3, 2, 7);
    ctx.fillRect(L.pause.x + 1, L.pause.y - 3, 2, 7);
    ctx.restore();
  }
}
