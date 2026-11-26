// Goalie: holds an arc in front of the net, tracks the puck, reacts to shots.
import { RINK, GOAL, TEAMS } from '../config.js';
import { project } from '../world/projection.js';
import { goalieSprites, shadowSprite, GOALIE_W, GOALIE_ANCHOR_X, GOALIE_ANCHOR_Y } from '../world/sprites.js';

// react: seconds before moving on a shot · err: how far off the read can be (m)
const SKILL = {
  easy:   { react: 0.3,  speed: 2.2, dive: 2.4, err: 0.45 },
  normal: { react: 0.25, speed: 2.5, dive: 2.9, err: 0.35 },
  hard:   { react: 0.19, speed: 2.9, dive: 3.6, err: 0.24 },
};
const HW = GOAL.width / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Goalie {
  constructor({ team, side, sideKey, difficulty = 'normal' }) {
    this.team = TEAMS[team];
    this.sideKey = sideKey;
    this.side = side;                    // -1 = left net
    this.gx = side * RINK.goalLineX;
    this.out = -side;                    // direction the goalie faces
    this.radius = 0.5;                   // body vs skaters
    this.skill = SKILL[difficulty] ?? SKILL.normal;
    this.sprites = goalieSprites(this.team);
    this.pos = { x: 0, y: 0 };
    this.vel = { x: 0, y: 0 };
    this.reset();
  }

  reset() {
    this.pos.x = this.gx + this.out * 0.8;
    this.pos.y = 0;
    this.vel.x = 0; this.vel.y = 0;
    this.holdT = 0;
    this.reactT = 0;
    this.diving = false;
  }

  /** Blocking radius; high pucks find more gaps between glove, blocker and shoulders. */
  blockRadius(z = 0) {
    const r = this.diving ? 0.44 : 0.36;
    return z > 0.8 ? r * 0.8 : r;
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
        if (this.reactT >= this.skill.react + quick) {
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
    const img = right ? this.sprites.right : this.sprites.left;
    const ax = right ? GOALIE_ANCHOR_X : GOALIE_W - 1 - GOALIE_ANCHOR_X;
    ctx.drawImage(img, Math.round(p.x + ox - ax), Math.round(p.y + oy - GOALIE_ANCHOR_Y + (this.diving ? 2 : 0)));
  }
}
