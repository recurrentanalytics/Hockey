// A skater: movement, aiming, stamina, and the live-drawn stick.
// Gameplay decisions (shooting, passing, pickups) live in game/match.js.
import { SKATE, TEAMS } from '../config.js';
import { PAL } from '../engine/palette.js';
import { pixelLine } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { RINK_CORE, goalBox } from './rink.js';
import { project } from './projection.js';
import { skaterSprites, shadowSprite, ANCHOR_X, ANCHOR_Y, SPRITE_W } from './sprites.js';

export const REACH = 0.72;      // body centre → blade, metres
export const POKE_TIME = 0.24;
const TURN_RATE = 9;            // rad/s
const CARRY_TURN_RATE = 7;

function turnToward(a, b, max) {
  const TAU = Math.PI * 2;
  const d = ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return a + Math.max(-max, Math.min(max, d));
}

export class Skater {
  constructor({ team, x = 0, y = 0, facing = 1, number = 0 }) {
    this.team = TEAMS[team];
    this.teamId = team;
    this.number = number;
    this.pos = { x, y };
    this.vel = { x: 0, y: 0 };
    this.radius = SKATE.radius;
    this.dir = facing > 0 ? 0 : Math.PI; // aim / stick direction
    this.facing = facing;                 // sprite flip
    this.anim = 0;
    this.pushing = false;
    this.stamina = 1;
    this.sprinting = false;
    this.hasPuck = false;
    this.charging = false;
    this.charge = 0;
    this.pokeT = 0;
    this.pokeCd = 0;
    this.followT = 0;
    this.noPickup = 0;
    this.human = null;  // set when a player controls this skater
    this.sideKey = null;
    this.sprites = skaterSprites(this.team);
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.y);
  }

  place(x, y, dir) {
    this.pos.x = x; this.pos.y = y;
    this.vel.x = 0; this.vel.y = 0;
    this.dir = dir;
    this.facing = Math.cos(dir) >= 0 ? 1 : -1;
    this.charging = false; this.charge = 0;
    this.pokeT = 0; this.followT = 0; this.noPickup = 0;
  }

  update(dt, { move = { x: 0, y: 0 }, sprint = false, limit = 1 } = {}) {
    const mlen = Math.hypot(move.x, move.y);
    this.sprinting = sprint && mlen > 0.2 && this.stamina > 0.02;
    let max = this.sprinting ? SKATE.sprintSpeed : SKATE.maxSpeed;
    max *= limit;
    if (this.hasPuck) max *= 0.92;
    if (this.charging) max *= 0.8;
    this.stamina = Math.max(0, Math.min(1, this.stamina + (this.sprinting ? -0.28 : 0.16) * dt));

    if (mlen > 0.05) {
      const accel = SKATE.accel * (this.sprinting ? 1.15 : 1);
      this.vel.x += move.x * accel * dt;
      this.vel.y += move.y * accel * dt;
      const rate = (this.hasPuck ? CARRY_TURN_RATE : TURN_RATE) * dt;
      this.dir = turnToward(this.dir, Math.atan2(move.y, move.x), rate);
    }
    const c = Math.cos(this.dir);
    if (c > 0.2) this.facing = 1;
    else if (c < -0.2) this.facing = -1;

    const drag = mlen > 0.05 ? SKATE.glideDrag : SKATE.brakeDrag;
    const k = Math.exp(-drag * dt);
    this.vel.x *= k;
    this.vel.y *= k;
    const sp = this.speed;
    if (sp > max) {
      const target = Math.max(max, sp - 12 * dt);
      this.vel.x *= target / sp;
      this.vel.y *= target / sp;
    }
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    this.collideBoards();
    for (const side of [-1, 1]) this.collideBox(goalBox(side));

    this.pokeT = Math.max(0, this.pokeT - dt);
    this.pokeCd = Math.max(0, this.pokeCd - dt);
    this.followT = Math.max(0, this.followT - dt);
    this.noPickup = Math.max(0, this.noPickup - dt);
    this.protectT = Math.max(0, (this.protectT ?? 0) - dt);

    this.pushing = mlen > 0.05 && this.speed > 0.6;
    if (this.pushing) this.anim += dt * (2.2 + this.speed * 0.45);
  }

  poke() {
    if (this.pokeCd > 0) return false;
    this.pokeT = POKE_TIME;
    this.pokeCd = 0.65;
    return true;
  }

  bladeReach() {
    if (this.pokeT > 0) return REACH + 0.65 * Math.sin(Math.PI * (1 - this.pokeT / POKE_TIME));
    if (this.charging) return REACH - 0.45 * this.charge;
    if (this.followT > 0) return REACH + 0.3;
    return REACH;
  }

  bladeHeight() {
    if (this.charging) return 0.55 * this.charge;
    if (this.followT > 0) return 0.45;
    return 0;
  }

  bladePoint() {
    const r = this.bladeReach();
    return { x: this.pos.x + Math.cos(this.dir) * r, y: this.pos.y + Math.sin(this.dir) * r };
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

  /** Push this skater out of an immovable circle (e.g. a goalie). */
  collideStatic(o, r) {
    const dx = this.pos.x - o.x, dy = this.pos.y - o.y;
    const min = this.radius + r, d = Math.hypot(dx, dy);
    if (d >= min || d < 1e-6) return;
    const nx = dx / d, ny = dy / d;
    this.pos.x = o.x + nx * min;
    this.pos.y = o.y + ny * min;
    const vn = this.vel.x * nx + this.vel.y * ny;
    if (vn < 0) { this.vel.x -= 1.3 * vn * nx; this.vel.y -= 1.3 * vn * ny; }
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

  drawShadow(ctx, ox, oy) {
    const p = project(this.pos.x, this.pos.y);
    ctx.drawImage(shadowSprite(), Math.round(p.x + ox - 7), Math.round(p.y + oy - 2));
  }

  drawStick(ctx, p, ox, oy) {
    const hx = Math.round(p.x + ox + this.facing * 5), hy = Math.round(p.y + oy - 15);
    const b = this.bladePoint();
    const bp = project(b.x, b.y, this.bladeHeight());
    const bx = Math.round(bp.x + ox), by = Math.round(bp.y + oy);
    ctx.fillStyle = PAL.woodDark;
    pixelLine(ctx, hx - this.facing, hy, bx - this.facing, by - 1);
    ctx.fillStyle = PAL.wood;
    pixelLine(ctx, hx, hy, bx, by - 1);
    const toward = Math.abs(Math.cos(this.dir)) > 0.15 ? Math.sign(Math.cos(this.dir)) : this.facing;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(toward > 0 ? bx : bx - 3, by, 4, 1);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(toward > 0 ? bx + 1 : bx - 2, by, 2, 1);
  }

  draw(ctx, ox, oy) {
    const p = project(this.pos.x, this.pos.y);
    const frame = this.pushing ? Math.floor(this.anim) % 4 : 0;
    const right = this.facing >= 0;
    const img = (right ? this.sprites.right : this.sprites.left)[frame];
    const ax = right ? ANCHOR_X : SPRITE_W - 1 - ANCHOR_X;
    const x = Math.round(p.x + ox - ax), y = Math.round(p.y + oy - ANCHOR_Y);
    const behind = this.bladePoint().y < this.pos.y - 0.05;
    if (behind) this.drawStick(ctx, p, ox, oy);
    ctx.drawImage(img, x, y);
    if (!behind) this.drawStick(ctx, p, ox, oy);

    const h = this.human;
    if (!h) return;
    const tx = Math.round(p.x + ox), ty = y - 9;
    drawText(ctx, h.tag, tx, ty, { color: h.color, align: 'center', shadow: PAL.ink });
    ctx.fillStyle = h.color;
    ctx.fillRect(tx - 1, ty + 6, 3, 1);
    ctx.fillRect(tx, ty + 7, 1, 1);
    if (this.charging) {
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(tx - 7, ty - 4, 14, 3);
      ctx.fillStyle = this.charge >= 1 ? PAL.red : PAL.yellow;
      ctx.fillRect(tx - 6, ty - 3, Math.max(1, Math.round(12 * this.charge)), 1);
    }
    if (this.stamina < 0.98) {
      const w = Math.round(12 * this.stamina);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(tx - 7, Math.round(p.y + oy) + 3, 14, 3);
      ctx.fillStyle = this.stamina < 0.25 ? PAL.red : PAL.green;
      ctx.fillRect(tx - 6, Math.round(p.y + oy) + 4, w, 1);
    }
  }
}
