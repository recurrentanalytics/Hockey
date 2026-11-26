// A controllable skater. Phase 1: skating + board/goal/skater collisions only.
import { SKATE, TEAMS } from '../config.js';
import { RINK_CORE, goalBox } from './rink.js';
import { project } from './projection.js';
import { skaterSprites, shadowSprite, ANCHOR_X, ANCHOR_Y, SPRITE_W } from './sprites.js';
import { drawText } from '../engine/font.js';

export class Skater {
  constructor({ team, x = 0, y = 0, facing = 1, tag = null, tagColor = '#f4c24f' }) {
    this.team = TEAMS[team];
    this.teamId = team;
    this.pos = { x, y };
    this.vel = { x: 0, y: 0 };
    this.radius = SKATE.radius;
    this.facing = facing;
    this.anim = 0;
    this.pushing = false;
    this.tag = tag;
    this.tagColor = tagColor;
    this.sprites = skaterSprites(this.team);
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.y);
  }

  update(dt, { move = { x: 0, y: 0 }, sprint = false } = {}) {
    const mlen = Math.hypot(move.x, move.y);
    const max = sprint ? SKATE.sprintSpeed : SKATE.maxSpeed;
    if (mlen > 0.05) {
      this.vel.x += move.x * SKATE.accel * dt;
      this.vel.y += move.y * SKATE.accel * dt;
      if (Math.abs(move.x) > 0.25) this.facing = Math.sign(move.x);
    }
    const drag = mlen > 0.05 ? SKATE.glideDrag : SKATE.brakeDrag;
    const k = Math.exp(-drag * dt);
    this.vel.x *= k;
    this.vel.y *= k;
    const sp = this.speed;
    if (sp > max) {
      // Ease down to the cap instead of snapping, so ending a sprint feels smooth.
      const target = Math.max(max, sp - 12 * dt);
      this.vel.x *= target / sp;
      this.vel.y *= target / sp;
    }
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    this.collideBoards();
    for (const side of [-1, 1]) this.collideBox(goalBox(side));

    this.pushing = mlen > 0.05 && this.speed > 0.6;
    if (this.pushing) this.anim += dt * (2.2 + this.speed * 0.45);
  }

  collideBoards() {
    const { halfX, halfY, radius } = RINK_CORE;
    const cx = Math.max(-halfX, Math.min(halfX, this.pos.x));
    const cy = Math.max(-halfY, Math.min(halfY, this.pos.y));
    const dx = this.pos.x - cx, dy = this.pos.y - cy;
    const d = Math.hypot(dx, dy);
    const limit = radius - this.radius;
    if (d > limit) {
      const nx = dx / d, ny = dy / d;
      this.pos.x = cx + nx * limit;
      this.pos.y = cy + ny * limit;
      const vn = this.vel.x * nx + this.vel.y * ny;
      if (vn > 0) {
        this.vel.x -= (1 + SKATE.boardBounce) * vn * nx;
        this.vel.y -= (1 + SKATE.boardBounce) * vn * ny;
      }
    }
  }

  collideBox(b) {
    const qx = Math.max(b.minX, Math.min(b.maxX, this.pos.x));
    const qy = Math.max(b.minY, Math.min(b.maxY, this.pos.y));
    let dx = this.pos.x - qx, dy = this.pos.y - qy;
    let d = Math.hypot(dx, dy);
    if (d >= this.radius) return;
    if (d < 1e-6) { dx = this.pos.x < (b.minX + b.maxX) / 2 ? -1 : 1; dy = 0; d = 1; }
    const nx = dx / d, ny = dy / d;
    this.pos.x = qx + nx * this.radius;
    this.pos.y = qy + ny * this.radius;
    const vn = this.vel.x * nx + this.vel.y * ny;
    if (vn < 0) { this.vel.x -= 1.2 * vn * nx; this.vel.y -= 1.2 * vn * ny; }
  }

  /** Equal-mass bump between two skaters. */
  static collide(a, b) {
    const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y;
    const min = a.radius + b.radius, d = Math.hypot(dx, dy);
    if (d >= min || d < 1e-6) return;
    const nx = dx / d, ny = dy / d, push = (min - d) / 2;
    a.pos.x -= nx * push; a.pos.y -= ny * push;
    b.pos.x += nx * push; b.pos.y += ny * push;
    const vn = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny;
    if (vn < 0) {
      const j = -1.3 * vn / 2;
      a.vel.x -= j * nx; a.vel.y -= j * ny;
      b.vel.x += j * nx; b.vel.y += j * ny;
    }
  }

  // ---- rendering (ox/oy convert world pixels → layer pixels)

  get sortY() { return this.pos.y; }

  screenPos() { return project(this.pos.x, this.pos.y); }

  drawShadow(ctx, ox, oy) {
    const p = this.screenPos();
    ctx.drawImage(shadowSprite(), Math.round(p.x + ox - 7), Math.round(p.y + oy - 2));
  }

  draw(ctx, ox, oy) {
    const p = this.screenPos();
    const frame = this.pushing ? Math.floor(this.anim) % 4 : 0;
    const right = this.facing >= 0;
    const img = (right ? this.sprites.right : this.sprites.left)[frame];
    const ax = right ? ANCHOR_X : SPRITE_W - 1 - ANCHOR_X;
    const x = Math.round(p.x + ox - ax), y = Math.round(p.y + oy - ANCHOR_Y);
    ctx.drawImage(img, x, y);
    if (this.tag) {
      const tx = Math.round(p.x + ox), ty = y - 9;
      drawText(ctx, this.tag, tx, ty, { color: this.tagColor, align: 'center', shadow: '#0e0f1a' });
      ctx.fillStyle = this.tagColor;
      ctx.fillRect(tx - 1, ty + 6, 3, 1);
      ctx.fillRect(tx, ty + 7, 1, 1);
    }
  }
}
