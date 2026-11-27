// A skater: movement, aiming, stamina, and the live-drawn stick.
// Gameplay decisions (shooting, passing, pickups) live in game/match.js.
import { SKATE, TEAMS, RES } from '../config.js';
import { PAL } from '../engine/palette.js';
import { pixelLine } from '../engine/draw.js';
import { drawText } from '../engine/font.js';
import { RINK_CORE, goalBox } from './rink.js';
import { FIXED } from './projection.js';
import { project } from './projection.js';
import { skaterFigures, SK_W, SK_AX, SK_AY } from './sprites.js';

export const REACH = 0.72;      // body centre → blade, metres
export const POKE_TIME = 0.24;
const TURN_RATE = 9;            // rad/s
const CARRY_TURN_RATE = 7;

function turnToward(a, b, max) {
  const TAU = Math.PI * 2;
  const d = ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  return a + Math.max(-max, Math.min(max, d));
}

/** Draw in full world-layer resolution (undoes the layer's RES scale). */
function hd(ctx, fn) {
  ctx.save();
  ctx.scale(1 / RES, 1 / RES);
  fn();
  ctx.restore();
}

let shadowCanvas = null;
/** Soft oval shadow under the skates, full resolution. */
function softShadow() {
  if (shadowCanvas) return shadowCanvas;
  const c = document.createElement('canvas');
  c.width = 30; c.height = 8;
  const g = c.getContext('2d');
  for (let y = 0; y < 8; y++) for (let x = 0; x < 30; x++) {
    const dx = (x + 0.5 - 15) / 15, dy = (y + 0.5 - 4) / 4, r = dx * dx + dy * dy;
    if (r > 1) continue;
    g.fillStyle = `rgba(42,31,61,${r < 0.45 ? 0.38 : 0.24})`;
    g.fillRect(x, y, 1, 1);
  }
  shadowCanvas = c;
  return c;
}

const rings = new Map();
/** Pixel ellipse ring (19×7) with a darker back half, cached per colour. */
function ringSprite(color) {
  let c = rings.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = 19; c.height = 7;
  const g = c.getContext('2d');
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 19; x++) {
      const dx = (x + 0.5 - 9.5) / 9, dy = (y + 0.5 - 3.5) / 3;
      const r = dx * dx + dy * dy;
      if (r <= 1 && r > 0.45) {
        g.globalAlpha = y < 3 ? 0.55 : 1;
        g.fillStyle = color;
        g.fillRect(x, y, 1, 1);
      }
    }
  }
  rings.set(color, c);
  return c;
}

export class Skater {
  constructor({ team, x = 0, y = 0, facing = 1, number = 0, look = {} }) {
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
    this.look = look;
    this.sprites = skaterFigures(this.team, look);
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
    // Knocked down: no skating until back on the wheels.
    this.downT = Math.max(0, (this.downT ?? 0) - dt);
    this.celebrateT = Math.max(0, (this.celebrateT ?? 0) - dt);
    this.happyT = Math.max(0, (this.happyT ?? 0) - dt);
    this.sadT = Math.max(0, (this.sadT ?? 0) - dt);
    this.releaseT = Math.max(0, (this.releaseT ?? 0) - dt);
    this.brakeT = Math.max(0, (this.brakeT ?? 0) - dt);
    this.crossT = Math.max(0, (this.crossT ?? 0) - dt);
    this.t = (this.t ?? Math.random() * 10) + dt;
    if (this.downT > 0) {
      move = { x: 0, y: 0 };
      sprint = false;
      this.noPickup = Math.max(this.noPickup, 0.1);
    }
    const mlen = Math.hypot(move.x, move.y);
    this.sprinting = sprint && mlen > 0.2 && this.stamina > 0.02;
    let max = this.sprinting ? SKATE.sprintSpeed : SKATE.maxSpeed;
    max *= limit;
    // Fatigue builds with hard skating and costs up to 15% top speed; time-outs and breaks restore it.
    this.fatigue = this.fatigue ?? 0;
    max *= 1 - 0.15 * this.fatigue;
    if (this.hasPuck) max *= 0.92;
    if (this.charging) max *= 0.8;
    this.stamina = Math.max(0, Math.min(1, this.stamina + (this.sprinting ? -0.28 : 0.16) * dt));

    if (mlen > 0.05) {
      const accel = SKATE.accel * (this.sprinting ? 1.15 : 1);
      this.vel.x += move.x * accel * dt;
      this.vel.y += move.y * accel * dt;
      // grip: sideways drift (relative to where the player steers) dies away quickly, so turns bite
      const ux = move.x / mlen, uy = move.y / mlen;
      const along = this.vel.x * ux + this.vel.y * uy;
      const g = Math.exp(-SKATE.grip * dt);
      this.vel.x = along * ux + (this.vel.x - along * ux) * g;
      this.vel.y = along * uy + (this.vel.y - along * uy) * g;
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
    this.hitCd = Math.max(0, (this.hitCd ?? 0) - dt);

    const effort = (this.speed / SKATE.maxSpeed) ** 2;
    this.fatigue = Math.min(1, Math.max(0, this.fatigue + (0.004 * effort + (this.sprinting ? 0.006 : 0) - (this.speed < 2 ? 0.01 : 0)) * dt));

    this.pushing = mlen > 0.05 && this.speed > 0.6;
    if (this.pushing) this.anim += dt * (2.2 + this.speed * 0.45);
    // Stickhandling: the puck dances from side to side on the blade.
    if (this.hasPuck) this.dribble = (this.dribble ?? 0) + dt * (6 + this.speed * 0.6);

    // Body language read from the motion: hockey stops and crossovers.
    const v = this.speed;
    if (v > 3.5 && this.downT <= 0) {
      const ux = this.vel.x / v, uy = this.vel.y / v;
      const against = mlen > 0.05 && (move.x * ux + move.y * uy) / mlen < -0.5;
      if (mlen <= 0.05 || against) this.brakeT = 0.15;
      const heading = Math.atan2(uy, ux);
      if (this.heading != null && mlen > 0.05) {
        let dh = heading - this.heading;
        dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        if (Math.abs(dh) / dt > 1.4 && !against) this.crossT = 0.2;
      }
      this.heading = heading;
    } else {
      this.heading = null;
    }
  }

  poke() {
    if (this.pokeCd > 0) return false;
    this.pokeT = POKE_TIME;
    this.pokeCd = 0.65;
    return true;
  }

  bladeReach() {
    if (this.celebrateT > 0) return 0.25;
    if (this.pokeT > 0) return REACH + 0.65 * Math.sin(Math.PI * (1 - this.pokeT / POKE_TIME));
    if (this.charging) return REACH - 0.45 * this.charge;
    if (this.followT > 0) return REACH + 0.3;
    return REACH;
  }

  bladeHeight() {
    if (this.celebrateT > 0) return 2.3;
    if (this.charging) return 0.55 * this.charge;
    if (this.followT > 0) return 0.45;
    return 0;
  }

  bladePoint() {
    let r = this.bladeReach();
    const c = Math.cos(this.dir), sn = Math.sin(this.dir);
    let side = 0;
    if (this.hasPuck && !this.charging && this.pokeT <= 0) {
      // Stickhandling: side to side across the body, with a little toe drag in and out.
      const d = this.dribble ?? 0;
      side = Math.sin(d) * 0.17;
      r += Math.cos(d * 2) * 0.05;
    }
    return { x: this.pos.x + c * r - sn * side, y: this.pos.y + sn * r + c * side };
  }

  /** Where the blade is drawn (shot wind-ups and follow-throughs go well off the ice). */
  stickPoint() {
    const c = Math.cos(this.dir), sn = Math.sin(this.dir);
    const at = (r, z) => ({ x: this.pos.x + c * r, y: this.pos.y + sn * r, z });
    if (this.celebrateT > 0) return at(0.25, 2.3);
    if (this.charging) {
      // Wind-up: the blade swings back behind the skates and up over the shoulder.
      const k = this.charge;
      return at(0.45 - 1.55 * k, 0.15 + 1.45 * k);
    }
    if (this.releaseT > 0 && this.releaseKind === 'shot') {
      // Follow-through: blade sweeps through the puck and finishes high toward the target.
      const u = 1 - this.releaseT / 0.38;
      return at(REACH + 0.35 * Math.min(1, u * 2), Math.max(0, (u - 0.15) * 1.6) * (0.5 + this.releaseCharge));
    }
    if (this.stance === 'draw') return at(0.62, 0);
    if (this.sadT > 0 && this.speed < 3) return at(0.5, 0);
    const b = this.bladePoint();
    return { ...b, z: this.bladeHeight() };
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
    hd(ctx, () => {
      const sun = FIXED && globalThis.BONI_3D?.shadow;
      // in sunshine (not under the trees): checked a few times a second, eased so it never flickers
      if (sun && (this.litAt = (this.litAt ?? 0) - 1) <= 0) { this.litAt = 8; this.litGoal = sun.lit(this.pos.x, this.pos.y); }
      this.lit = sun ? (this.lit ?? 1) + ((this.litGoal ?? 1) - (this.lit ?? 1)) * 0.2 : 0;
      if (sun && this.lit > 0.02) {
        // on the real court: a shadow thrown away from the sun, as long as the sun is low
        const e = project(this.pos.x + sun.x * 1.25, this.pos.y + sun.y * 1.25);
        const dx = (e.x - p.x) * RES, dy = (e.y - p.y) * RES, len = Math.hypot(dx, dy);
        ctx.save(); ctx.globalAlpha = sun.alpha * this.lit;
        ctx.translate(Math.round((p.x + ox) * RES), Math.round((p.y + oy) * RES)); ctx.rotate(Math.atan2(dy, dx));
        ctx.drawImage(softShadow(), -4, -5, len + 10, 10);
        ctx.restore();
      }
      ctx.drawImage(softShadow(), Math.round((p.x + ox) * RES) - 15, Math.round((p.y + oy) * RES) - 4);
    });
    // Controlled player: a ring in the player's colour round the skates.
    if (this.human) ctx.drawImage(ringSprite(this.human.color), Math.round(p.x + ox - 9), Math.round(p.y + oy - 3));
  }

  /** Stick in full resolution: shaft from the top hand through the bottom hand to a taped blade. */
  drawStick(ctx, X, Y, fr) {
    const f = this.facing;
    const hx = X + f * fr.hand.x, hy = Y + fr.hand.y;
    const b = this.stickPoint();
    const bp = project(b.x, b.y, b.z);
    const bx = Math.round((bp.x + this.ox) * RES), by = Math.round((bp.y + this.oy) * RES);
    const wood = PAL.wood, dark = PAL.woodDark;
    if (fr.top) {
      const tx = X + f * fr.top.x, ty = Y + fr.top.y;
      // butt end sticks out a little past the top hand
      const dx = tx - hx, dy = ty - hy, d = Math.hypot(dx, dy) || 1;
      ctx.fillStyle = dark;
      pixelLine(ctx, hx, hy + 1, Math.round(tx + (dx / d) * 3), Math.round(ty + (dy / d) * 3) + 1);
      ctx.fillStyle = wood;
      pixelLine(ctx, hx, hy, Math.round(tx + (dx / d) * 3), Math.round(ty + (dy / d) * 3));
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(Math.round(tx + (dx / d) * 3) - 1, Math.round(ty + (dy / d) * 3) - 1, 2, 2);
    }
    ctx.fillStyle = dark;
    pixelLine(ctx, hx, hy + 1, bx, by);
    ctx.fillStyle = wood;
    pixelLine(ctx, hx, hy, bx, by - 1);
    // The blade points the way the stick swings: back during a wind-up.
    let toward = Math.abs(Math.cos(this.dir)) > 0.15 ? Math.sign(Math.cos(this.dir)) : f;
    if (bx * toward < hx * toward) toward = -toward;
    const x0 = toward > 0 ? bx - 1 : bx - 8;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(x0 - 1, by - 2, 11, 4);
    ctx.fillStyle = '#2a2438';
    ctx.fillRect(x0, by - 1, 9, 2);
    ctx.fillStyle = PAL.white;               // white tape on the blade
    ctx.fillRect(x0 + (toward > 0 ? 2 : 3), by - 1, 4, 2);
  }

  /** Jersey number on the back, drawn upright after mirroring so it always reads right. */
  drawNumber(ctx, X, Y, fr) {
    if (this.number == null || !fr.num) return;
    const text = String(this.number);
    const w = text.length * 4 - 1;
    const nx = X + this.facing * fr.num.x - Math.floor(w / 2), ny = Y + Math.round(fr.num.y) - 2;
    drawText(ctx, text, nx, ny, { color: this.team.stripe ?? this.team.trim });
  }

  /** Which pose to show, from what the skater is doing right now. */
  pose() {
    const t = this.t ?? 0;
    const happy = this.happyT > 0, sad = this.sadT > 0;
    let mood = happy ? 'happy' : sad ? 'sad' : 'normal';
    if (this.downT > 0) {
      const f = this.downT / (this.downMax || 1);
      if (f > 0.82) return { pose: 'stumble', mood: 'dizzy' };
      if (f > 0.34) return { pose: 'sprawl', mood: 'dizzy', lying: true };
      if (f > 0.14) return { pose: 'kneel', mood: 'dizzy' };
      return { pose: 'rise', mood: 'normal' };
    }
    if (this.celebrateT > 0) return { pose: Math.floor(t * 5) % 2 ? 'cheerB' : 'cheerA', mood: 'happy', hop: true };
    if (this.stance === 'draw') return { pose: 'draw', mood };
    if (this.stance === 'ready') return { pose: 'ready', mood };
    if (this.charging) return { pose: 'windup', mood: this.charge > 0.55 ? 'effort' : mood };
    if (this.releaseT > 0) {
      if (this.releaseKind === 'shot') return { pose: 'release', mood: this.releaseCharge > 0.5 ? 'effort' : mood };
      return { pose: 'passOut', mood };
    }
    if (this.pokeT > 0) return { pose: 'lunge', mood: 'effort' };
    if (sad && this.speed < 3) return { pose: 'sad', mood: 'sad' };
    if (this.brakeT > 0) return { pose: 'stop', mood };
    if (this.crossT > 0) return { pose: `cross${Math.floor(this.anim * 2) % 4}`, mood };
    if (this.pushing) return { pose: `${this.sprinting ? 'sprint' : 'stride'}${Math.floor(this.anim * 2) % 8}`, mood, hop: happy };
    // Blink now and then while gliding or standing.
    this.blinkT = (this.blinkT ?? Math.random() * 4) - 1 / 60;
    if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 4;
    if (mood === 'normal' && this.blinkT < 0) mood = 'blink';
    if (this.speed > 0.6) return { pose: 'glide', mood, hop: happy };
    if ((this.fatigue ?? 0) > 0.5 || this.stamina < 0.25) return { pose: Math.floor(t * 3) % 2 ? 'tiredB' : 'tiredA', mood: mood === 'normal' ? 'effort' : mood };
    // Breathing while standing still
    return { pose: Math.floor(t / 1.1) % 2 ? 'idleB' : 'idleA', mood, hop: happy };
  }

  draw(ctx, ox, oy) {
    const st = this.pose();
    // Jump for joy after a goal
    if (st.hop) oy -= Math.abs(Math.sin((this.t ?? 0) * 9)) * 3;
    const p = project(this.pos.x, this.pos.y);
    this.ox = ox; this.oy = oy;
    const right = this.facing >= 0;
    const fr = this.sprites.frame(st.pose, st.mood);
    const img = right ? fr.right : fr.left;
    const X = Math.round((p.x + ox) * RES), Y = Math.round((p.y + oy) * RES);
    const ax = right ? SK_AX : SK_W - 1 - SK_AX;
    hd(ctx, () => {
      if (st.lying) {
        // On the floor: the sprawled figure turned 90° (exact quarter turns stay pixel-crisp).
        ctx.save();
        ctx.translate(X, Y);
        ctx.rotate(right ? Math.PI / 2 : -Math.PI / 2);
        ctx.drawImage(img, -ax, -SK_AY + 8);
        ctx.restore();
        const tt = performance.now() / 180;
        const hx = X + (right ? 30 : -30), hy = Y - 12;
        for (let i = 0; i < 3; i++) {
          const a = tt + (i * Math.PI * 2) / 3;
          ctx.fillStyle = i === 1 ? PAL.white : PAL.yellow;
          ctx.fillRect(hx + Math.round(Math.cos(a) * 9), hy + Math.round(Math.sin(a) * 4), 2, 2);
        }
      } else if (this.downT > 0) {
        ctx.drawImage(img, X - ax, Y - SK_AY);
      } else {
        const behind = this.stickPoint().y < this.pos.y - 0.05;
        if (behind) this.drawStick(ctx, X, Y, fr);
        ctx.drawImage(img, X - ax, Y - SK_AY);
        this.drawNumber(ctx, X, Y, fr);
        if (!behind) this.drawStick(ctx, X, Y, fr);
      }
    });
    const y = (Y + fr.headTop) / RES - 6;

    const h = this.human;
    if (!h) return;
    const tx = Math.round(p.x + ox), ty = Math.round(y);
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
