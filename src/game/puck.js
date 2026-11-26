// The puck: position on the floor plus height (z) so shots can be lifted.
import { PAL } from '../engine/palette.js';
import { project } from '../world/projection.js';

export const PUCK = {
  radius: 0.1,          // enlarged from the real 3.8 cm for playability
  gravity: 9.8,
  drag: 0.22,           // per second, while sliding
  friction: 0.55,       // m/s² rolling resistance on sport tiles
  boardBounce: 0.6,
  postBounce: 0.55,
  netBounce: 0.1,
  bodyBounce: 0.25,
  groundBounce: 0.3,
};

// Red low-bounce inline hockey ball (hard plastic, ~7 cm): rolls further than a puck,
// pings off the boards a little more, but is made not to bounce much on the floor.
export const BALL = {
  ...PUCK,
  drag: 0.14,
  friction: 0.32,
  boardBounce: 0.68,
  postBounce: 0.62,
  netBounce: 0.15,
  bodyBounce: 0.32,
  groundBounce: 0.38,
};

// Bright "knallrot" like the real thing
const RED = '#ff2a2a', RED_DARK = '#b3121d', RED_LIGHT = '#ff8a7a', PEG = '#fffaf4';

export class Puck {
  constructor(ball = false) {
    this.ball = ball;
    this.phys = ball ? BALL : PUCK;
    this.radius = PUCK.radius;
    this.pos = { x: 0, y: 0 };
    this.vel = { x: 0, y: 0 };
    this.z = 0;
    this.vz = 0;
    this.carrier = null;   // skater with the puck on the stick
    this.holder = null;    // goalie covering it
    this.lastTouch = null;
    this.shot = null;      // { by, side } while a shot is live
  }

  reset(x = 0, y = 0) {
    this.pos.x = x; this.pos.y = y;
    this.vel.x = 0; this.vel.y = 0;
    this.z = 0; this.vz = 0;
    this.carrier = null; this.holder = null;
    this.lastTouch = null; this.shot = null;
    this.passTo = null;
    this.chain = [];       // skaters of one team who handled it in turn (for assists)
  }

  get loose() {
    return !this.carrier && !this.holder;
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.y);
  }

  get sortY() { return this.pos.y; }

  drawShadow(ctx, ox, oy) {
    if (this.z < 0.03 && !this.ball) return;
    const p = project(this.pos.x, this.pos.y);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(Math.round(p.x + ox - 3), Math.round(p.y + oy - 1), 6, 2);
    ctx.restore();
  }

  draw(ctx, ox, oy, ghost = false) {
    const p = project(this.pos.x, this.pos.y, this.z);
    const x = Math.round(p.x + ox), y = Math.round(p.y + oy);
    // Distance rolled, for the spinning seam and pegs.
    const sp = this.speed;
    if (!ghost) this.roll = ((this.roll ?? 0) + sp / 60 / 0.035) % (Math.PI * 2);
    const px = (dx, dy, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + dx, y + dy, w, h); };
    if (this.ball) {
      // 5×5 ball with an ink outline, shading and a shine; a dark seam spot rolls round it.
      px(-1, -6, 3, 1, PAL.ink); px(-1, 0, 3, 1, PAL.ink);
      px(-2, -5, 1, 1, PAL.ink); px(2, -5, 1, 1, PAL.ink); px(-2, -1, 1, 1, PAL.ink); px(2, -1, 1, 1, PAL.ink);
      px(-3, -4, 1, 3, PAL.ink); px(3, -4, 1, 3, PAL.ink);
      px(-1, -5, 3, 5, RED); px(-2, -4, 5, 3, RED);
      px(1, -2, 2, 1, RED_DARK); px(-1, -1, 3, 1, RED_DARK); px(2, -3, 1, 1, RED_DARK);
      px(-1, -4, 1, 1, PEG); px(0, -5, 1, 1, RED_LIGHT);
      if (sp > 0.3) {
        const a = this.roll;
        const sx = Math.round(Math.cos(a) * 1.5), sy = Math.round(Math.sin(a) * 1.5);
        if (Math.sin(a) > -0.6) px(sx, -3 + sy, 1, 1, RED_DARK);
      }
      return;
    }
    // Roller puck: red disc (top + rim) with white glide pegs along the edge.
    px(-3, -4, 7, 1, PAL.ink); px(-3, 0, 7, 1, PAL.ink);
    px(-4, -3, 1, 3, PAL.ink); px(4, -3, 1, 3, PAL.ink);
    px(-3, -3, 7, 2, RED); px(-2, -3, 3, 1, RED_LIGHT);
    px(-3, -1, 7, 1, RED_DARK);
    const shift = Math.floor(this.roll * 2) % 2;
    for (let i = -3 + shift; i <= 3; i += 2) px(i, -1, 1, 1, PEG);
  }
}
