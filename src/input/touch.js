// On-screen controls: floating stick on the left, action buttons on the right.
import { PAL } from '../engine/palette.js';
import { fillCircle, strokeCircle } from '../engine/draw.js';
import { drawText } from '../engine/font.js';

const STICK_R = 24;
const EDGE = 8; // keep clear of rounded screen corners and notches

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
    const r = W - EDGE, b = H - EDGE;
    return {
      stickHome: { x: EDGE + 38, y: b - 36 },
      pause: { x: W - 35, y: 13, r: 9 },
      buttons: [
        { action: 'shoot', label: 'SHOOT', x: r - 22, y: b - 26, r: 19, color: PAL.red },
        { action: 'pass', label: 'PASS', x: r - 62, y: b - 14, r: 14, color: PAL.blue },
        { action: 'check', label: 'CHECK', x: r - 58, y: b - 52, r: 14, color: PAL.orange },
        { action: 'switch', label: 'SWAP', x: r - 18, y: b - 70, r: 12, color: PAL.green },
        { action: 'sprint', label: 'BOOST', x: r - 98, y: b - 34, r: 14, color: PAL.purple },
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
      if (Math.hypot(p.x - L.pause.x, p.y - L.pause.y) <= L.pause.r + 4) {
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
      if (len > 0.12) this.move = { x: dx, y: dy };
    }
  }

  draw(ctx, W, H) {
    const L = this.layout(W, H);
    ctx.save();
    // Stick: shown at its home spot until a thumb lands anywhere on the left half.
    const base = this.stick ? { x: this.stick.ox, y: this.stick.oy } : L.stickHome;
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = PAL.ink;
    fillCircle(ctx, base.x, base.y, STICK_R);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = PAL.white;
    strokeCircle(ctx, base.x, base.y, STICK_R);
    ctx.fillStyle = this.stick ? PAL.yellow : PAL.cloud;
    fillCircle(ctx, base.x + this.move.x * STICK_R, base.y + this.move.y * STICK_R, 10);
    if (!this.stick) drawText(ctx, 'MOVE', base.x, base.y - STICK_R - 8, { color: PAL.white, align: 'center', shadow: PAL.ink });

    for (const b of L.buttons) {
      const on = this.down[b.action];
      ctx.globalAlpha = on ? 0.95 : 0.7;
      ctx.fillStyle = on ? PAL.yellow : b.color;
      fillCircle(ctx, b.x, b.y, b.r);
      ctx.globalAlpha = 1;
      ctx.fillStyle = PAL.white;
      strokeCircle(ctx, b.x, b.y, b.r);
      drawText(ctx, b.label, b.x, b.y - 2, { color: on ? PAL.ink : PAL.white, align: 'center', shadow: on ? null : PAL.ink });
    }

    ctx.globalAlpha = 0.75;
    ctx.fillStyle = PAL.ink;
    fillCircle(ctx, L.pause.x, L.pause.y, L.pause.r);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.mist;
    strokeCircle(ctx, L.pause.x, L.pause.y, L.pause.r);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(L.pause.x - 3, L.pause.y - 3, 2, 7);
    ctx.fillRect(L.pause.x + 1, L.pause.y - 3, 2, 7);
    ctx.restore();
  }
}
