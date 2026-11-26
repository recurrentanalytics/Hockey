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

// Inline-skaterhockey ball: rolls further and bounces more.
export const BALL = {
  ...PUCK,
  drag: 0.14,
  friction: 0.32,
  boardBounce: 0.72,
  postBounce: 0.65,
  netBounce: 0.15,
  bodyBounce: 0.35,
  groundBounce: 0.5,
};

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
    if (this.z < 0.03) return;
    const p = project(this.pos.x, this.pos.y);
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(Math.round(p.x + ox - 2), Math.round(p.y + oy - 1), 4, 2);
    ctx.restore();
  }

  draw(ctx, ox, oy) {
    const p = project(this.pos.x, this.pos.y, this.z);
    const x = Math.round(p.x + ox), y = Math.round(p.y + oy);
    if (this.ball) {
      ctx.fillStyle = PAL.orange;
      ctx.fillRect(x - 1, y - 4, 3, 4);
      ctx.fillRect(x - 2, y - 3, 5, 2);
      ctx.fillStyle = PAL.yellow;
      ctx.fillRect(x - 1, y - 3, 1, 1);
      return;
    }
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x - 2, y - 2, 5, 2);
    ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillStyle = PAL.steel;
    ctx.fillRect(x - 1, y - 3, 3, 1);
  }
}
