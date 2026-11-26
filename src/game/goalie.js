// Goalie: holds an arc in front of the net, tracks the puck, reacts to shots.
import { RINK, GOAL, TEAMS } from '../config.js';
import { project } from '../world/projection.js';
import { goalieSprites, shadowSprite, GOALIE_W, GOALIE_ANCHOR_X, GOALIE_ANCHOR_Y } from '../world/sprites.js';

// react: seconds before moving on a shot · err: how far off the read can be (m)
const SKILL = {
  easy:   { react: 0.28, speed: 3.0, dive: 2.6, err: 0.4 },
  normal: { react: 0.22, speed: 3.8, dive: 3.0, err: 0.28 },
  hard:   { react: 0.17, speed: 4.4, dive: 3.6, err: 0.2 },
};
const HW = GOAL.width / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Goalie {
  constructor({ team, side, sideKey, difficulty = 'normal' }) {
    this.team = TEAMS[team];
    this.sideKey = sideKey;
    this.setSide(side);
    this.radius = 0.5;                   // body vs skaters
    this.skill = SKILL[difficulty] ?? SKILL.normal;
    this.sprites = goalieSprites(this.team);
    this.pos = { x: 0, y: 0 };
    this.vel = { x: 0, y: 0 };
    this.reset();
  }

  /** Which net to guard: -1 = left, +1 = right. */
  setSide(side) {
    this.side = side;
    this.gx = side * RINK.goalLineX;
    this.out = -side;                    // direction the goalie faces
    if (this.pos) this.reset();
  }

  reset() {
    this.pos.x = this.gx + this.out * 0.8;
    this.pos.y = 0;
    this.vel.x = 0; this.vel.y = 0;
    this.holdT = 0;
    this.reactT = 0;
    this.diving = false;
  }

  /** Blocking radius by puck height. */
  blockRadius(z = 0) {
    const r = this.diving ? 0.45 : 0.38;
    if (z < 0.3) return r + 0.1;   // butterfly: pads seal the bottom of the net
    return z > 0.8 ? r * 0.8 : r;   // top corners are the way in
  }

  update(dt, puck) {
    const dxOut = (puck.pos.x - this.gx) * this.out;
    const ang = clamp(Math.atan2(puck.pos.y, Math.max(0.2, dxOut)), -1.2, 1.2);
    let tx = this.gx + this.out * Math.cos(ang) * 0.85;
    let ty = clamp(Math.sin(ang) * 0.85, -HW - 0.1, HW + 0.1);
    let speed = this.skill.speed;
    this.diving = false;

    // Read a shot heading for the net and slide across to meet it.
    const towardNet = -puck.vel.x * this.out;
    if (puck.loose && towardNet > 5) {
      const t = (this.pos.x - puck.pos.x) / puck.vel.x;
      const yHit = puck.pos.y + puck.vel.y * t;
      if (t > 0 && t < 1.2 && Math.abs(yHit) < HW + 0.5) {
        this.reactT += dt;
        // Hold the stance while reading the shot, then push across.
        tx = this.pos.x;
        ty = this.pos.y;
        speed = 0;
        // Quick wrist shots are harder to read than wound-up slap shots.
        const quick = puck.shot ? 0.16 * (1 - (puck.shot.charge ?? 1)) : 0;
        // Goalies square up to shooters in close, so they react sooner to short-range shots.
        const near = Math.max(0.7, Math.min(1, 0.55 + (puck.shot?.dist ?? 10) * 0.06));
        if (this.reactT >= (this.skill.react + quick) * near) {
          if (this.guess == null) this.guess = (Math.random() * 2 - 1) * this.skill.err;
          tx = this.pos.x;
          ty = clamp(yHit + this.guess, -HW - 0.15, HW + 0.15);
          speed = this.skill.dive;
          this.diving = true;
        }
      }
    } else {
      this.reactT = 0;
      this.guess = null;
    }

    const dx = tx - this.pos.x, dy = ty - this.pos.y, d = Math.hypot(dx, dy);
    const step = Math.min(d, speed * dt);
    this.vel.x = d > 1e-6 ? (dx / d) * step / dt : 0;
    this.vel.y = d > 1e-6 ? (dy / d) * step / dt : 0;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
  }

  /** Where a covered puck sits: on the ice just in front of the pads. */
  holdPoint() {
    return { x: this.pos.x + this.out * 0.35, y: this.pos.y + 0.05 };
  }

  get sortY() { return this.pos.y; }

  drawShadow(ctx, ox, oy) {
    const p = project(this.pos.x, this.pos.y);
    ctx.drawImage(shadowSprite(), Math.round(p.x + ox - 7), Math.round(p.y + oy - 2));
  }

  draw(ctx, ox, oy) {
    const p = project(this.pos.x, this.pos.y);
    const right = this.out > 0;
    const down = this.diving || this.holdT > 0;
    const img = down ? (right ? this.sprites.downRight : this.sprites.downLeft) : (right ? this.sprites.right : this.sprites.left);
    const ax = right ? GOALIE_ANCHOR_X : GOALIE_W - 1 - GOALIE_ANCHOR_X;
    ctx.drawImage(img, Math.round(p.x + ox - ax), Math.round(p.y + oy - GOALIE_ANCHOR_Y));
  }
}
