// On-ice game state: skaters, goalies, the puck, possession, shots, passes and goals.
// Phase 2 has no AI yet: skaters nobody controls stand where they are (and still
// receive passes), goalies play on their own.
import { RINK, GOAL } from '../config.js';
import { RINK_CORE } from '../world/rink.js';
import { Skater } from '../world/skater.js';
import { Goalie } from './goalie.js';
import { Puck, PUCK } from './puck.js';
import { hitSegment, hitCircle, hitBoards } from './physics.js';

export const SHOT = { minSpeed: 13, maxSpeed: 32, chargeTime: 0.9, minLift: 0.5, maxLift: 3.6 };
const PASS = { min: 9, max: 19 };
const PICKUP_RANGE = 0.5;
const PICKUP_MAX_REL_SPEED = 17;
const HW = GOAL.width / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const angleDiff = (a, b) => Math.abs(((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);

/** Skater start spots for the home side (defends the left net); away is mirrored. */
const SPOTS = [{ x: -1.3, y: 0 }, { x: -6, y: -5 }, { x: -6, y: 5 }, { x: -11, y: 0 }];

export class Match {
  /**
   * @param home/away  { team, skaters: n, goalie: bool }
   * @param humans     [{ controller, side: 'home'|'away', tag, color }]
   */
  constructor({ home, away, humans, difficulty = 'normal' }) {
    this.sides = {
      home: { key: 'home', team: home.team, attack: 1 },
      away: { key: 'away', team: away.team, attack: -1 },
    };
    this.puck = new Puck();
    this.skaters = [];
    this.goalies = [];
    for (const [key, cfg] of [['home', home], ['away', away]]) {
      for (let i = 0; i < cfg.skaters; i++) {
        const s = new Skater({ team: cfg.team, number: [9, 17, 4, 44][i] });
        s.sideKey = key;
        s.slot = i;
        this.skaters.push(s);
      }
      if (cfg.goalie !== false) {
        this.goalies.push(new Goalie({ team: cfg.team, side: key === 'home' ? -1 : 1, sideKey: key, difficulty }));
      }
    }
    this.humans = humans.map((h) => ({ ...h }));
    for (const h of this.humans) {
      const s = this.skaters.find((k) => k.sideKey === h.side && !k.human);
      h.skater = s;
      s.human = h;
    }
    this.score = { home: 0, away: 0 };
    this.shots = { home: 0, away: 0 };
    this.events = [];
    this.lastGoal = null;
    this.faceoff();
  }

  get entities() {
    return [...this.skaters, ...this.goalies, this.puck];
  }

  faceoff() {
    this.puck.reset(0, 0);
    for (const s of this.skaters) {
      const spot = SPOTS[s.slot] ?? SPOTS[0];
      const m = this.sides[s.sideKey].attack;
      s.place(spot.x * m, spot.y * m, m > 0 ? 0 : Math.PI);
      s.hasPuck = false;
    }
    for (const g of this.goalies) g.reset();
    this.state = 'faceoff';
    this.timer = 1.2;
  }

  // ------------------------------------------------------------------ update

  update(dt, input) {
    this.events.length = 0;
    if (this.state === 'faceoff') {
      for (const g of this.goalies) g.update(dt, this.puck);
      this.timer -= dt;
      if (this.timer <= 0) this.state = 'play';
      return;
    }

    const live = this.state === 'play';
    for (const h of this.humans) {
      const c = input.controller(h.controller);
      const s = h.skater;
      s.update(dt, live && c ? { move: c.move, sprint: c.down.sprint } : {});
      if (live && c) this.actions(h, c, dt);
    }
    for (const s of this.skaters) if (!s.human) s.update(dt, {});

    for (let i = 0; i < this.skaters.length; i++) {
      for (let j = i + 1; j < this.skaters.length; j++) Skater.collide(this.skaters[i], this.skaters[j]);
    }
    for (const g of this.goalies) {
      g.update(dt, this.puck);
      for (const s of this.skaters) s.collideStatic(g.pos, g.radius);
    }

    this.pokes();
    this.stepPuck(dt);

    if (this.state === 'goal') {
      this.timer -= dt;
      if (this.timer <= 0) this.faceoff();
    }
  }

  actions(h, c, dt) {
    const s = h.skater, p = this.puck;
    if (p.carrier === s) {
      if (c.down.shoot) {
        s.charging = true;
        s.charge = Math.min(1, s.charge + dt / SHOT.chargeTime);
      }
      if (c.released.shoot && s.charging) this.shoot(s, s.charge);
      else if (c.pressed.pass && !s.charging) this.pass(s);
      return;
    }
    s.charging = false;
    s.charge = 0;
    if (c.pressed.shoot && this.oneTimer(s)) return;
    if (c.pressed.check || c.pressed.shoot) s.poke();
    if (c.pressed.switch) this.switchPlayer(h);
  }

  // ------------------------------------------------------------------ puck play

  release(s) {
    const p = this.puck;
    p.carrier = null;
    s.hasPuck = false;
    s.charging = false;
    s.charge = 0;
    s.noPickup = 0.3;
    p.lastTouch = s;
  }

  shoot(s, charge) {
    const p = this.puck;
    const side = this.sides[s.sideKey];
    const goalX = side.attack * RINK.goalLineX;
    let ang = s.dir;
    // Aim assist: when roughly facing the net, pick the spot between the posts the stick points at.
    const dx = goalX - s.pos.x;
    if (Math.abs(dx) > 1 && Math.sign(dx) === side.attack && angleDiff(ang, Math.atan2(-s.pos.y, dx)) < 0.55) {
      const yCross = s.pos.y + Math.tan(ang) * dx;
      const yAim = Math.max(-HW + 0.12, Math.min(HW - 0.12, Number.isFinite(yCross) ? yCross : 0));
      ang = Math.atan2(yAim - s.pos.y, dx);
    }
    ang += (Math.random() - 0.5) * (0.04 + 0.1 * charge);
    const speed = lerp(SHOT.minSpeed, SHOT.maxSpeed, charge);
    const b = s.bladePoint();
    p.pos.x = b.x; p.pos.y = b.y;
    this.release(s);
    p.vel.x = Math.cos(ang) * speed + s.vel.x * 0.3;
    p.vel.y = Math.sin(ang) * speed + s.vel.y * 0.3;
    p.z = 0.05;
    p.vz = lerp(SHOT.minLift, SHOT.maxLift, charge) * (0.7 + Math.random() * 0.5);
    p.shot = { by: s, side: s.sideKey, charge };
    s.followT = 0.22;
    this.events.push({ type: 'shot', by: s });
  }

  /** Shoot a loose puck straight off the pass without stopping it. */
  oneTimer(s) {
    const p = this.puck;
    if (!p.loose || p.z > 0.6 || s.noPickup > 0) return false;
    const b = s.bladePoint();
    if (Math.hypot(p.pos.x - b.x, p.pos.y - b.y) > 0.9) return false;
    p.carrier = s;
    s.hasPuck = true;
    this.shoot(s, 0.65);
    return true;
  }

  pass(s) {
    const p = this.puck;
    let best = null, bestScore = -Infinity;
    for (const m of this.skaters) {
      if (m === s || m.sideKey !== s.sideKey) continue;
      const dx = m.pos.x - s.pos.x, dy = m.pos.y - s.pos.y, dist = Math.hypot(dx, dy);
      const diff = angleDiff(s.dir, Math.atan2(dy, dx));
      if (dist < 1.5 || diff > 0.9) continue;
      const score = Math.cos(diff) * 3 - dist * 0.08;
      if (score > bestScore) { bestScore = score; best = m; }
    }
    let ang = s.dir, speed = 14;
    if (best) {
      const dist = Math.hypot(best.pos.x - s.pos.x, best.pos.y - s.pos.y);
      speed = Math.max(PASS.min, Math.min(PASS.max, 8 + dist * 0.5));
      const t = dist / speed;
      ang = Math.atan2(best.pos.y + best.vel.y * t - s.pos.y, best.pos.x + best.vel.x * t - s.pos.x);
    }
    this.release(s);
    p.vel.x = Math.cos(ang) * speed + s.vel.x * 0.2;
    p.vel.y = Math.sin(ang) * speed + s.vel.y * 0.2;
    p.z = 0;
    p.vz = 0;
    s.followT = 0.12;
    this.events.push({ type: 'pass', by: s, to: best });
  }

  pokes() {
    const p = this.puck;
    for (const s of this.skaters) {
      if (s.pokeT <= 0 || !p.carrier || p.carrier.sideKey === s.sideKey) continue;
      const tip = s.bladePoint();
      if (Math.hypot(tip.x - p.pos.x, tip.y - p.pos.y) > 0.5) continue;
      const victim = p.carrier;
      p.carrier = null;
      victim.hasPuck = false;
      victim.charging = false;
      victim.charge = 0;
      victim.noPickup = 0.6;
      const dx = p.pos.x - s.pos.x, dy = p.pos.y - s.pos.y, d = Math.hypot(dx, dy) || 1;
      p.vel.x = victim.vel.x * 0.4 + (dx / d) * 5;
      p.vel.y = victim.vel.y * 0.4 + (dy / d) * 5;
      p.lastTouch = s;
      this.events.push({ type: 'steal', by: s, from: victim });
    }
  }

  switchPlayer(h) {
    const p = this.puck;
    let best = null, bd = Infinity;
    for (const s of this.skaters) {
      if (s.sideKey !== h.side || s.human) continue;
      const d = Math.hypot(s.pos.x - p.pos.x, s.pos.y - p.pos.y);
      if (d < bd) { bd = d; best = s; }
    }
    if (best) this.giveControl(h, best);
  }

  giveControl(h, s) {
    h.skater.human = null;
    h.skater.charging = false;
    h.skater.charge = 0;
    h.skater = s;
    s.human = h;
  }

  gainPossession(s) {
    const p = this.puck;
    const prev = p.lastTouch;
    p.carrier = s;
    p.lastTouch = s;
    p.shot = null;
    p.z = 0;
    p.vz = 0;
    s.hasPuck = true;
    if (!s.human) {
      // Control follows the puck to the teammate who received it.
      const team = this.humans.filter((h) => h.side === s.sideKey);
      const h = team.find((x) => x.skater === prev) ?? (team.length === 1 ? team[0] : null);
      if (h) this.giveControl(h, s);
    }
  }

  stepPuck(dt) {
    const p = this.puck;

    if (p.holder) {
      const g = p.holder;
      const hp = g.holdPoint();
      p.pos.x = hp.x; p.pos.y = hp.y; p.z = 0; p.vel.x = 0; p.vel.y = 0;
      g.holdT -= dt;
      if (g.holdT <= 0) {
        // Play it out toward a corner, away from the net front.
        const ang = (g.out > 0 ? 0 : Math.PI) + (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.4);
        p.holder = null;
        p.vel.x = Math.cos(ang) * 11;
        p.vel.y = Math.sin(ang) * 11;
        g.clearT = 0.5;
      }
      return;
    }

    if (p.carrier) {
      const s = p.carrier;
      const b = s.bladePoint();
      p.pos.x = b.x; p.pos.y = b.y; p.z = 0; p.vz = 0;
      p.vel.x = s.vel.x; p.vel.y = s.vel.y;
      hitBoards(p, RINK_CORE, 0);
      this.collideNets(p);
      this.checkGoal();
      return;
    }

    const speed = Math.max(p.speed, Math.abs(p.vz));
    const n = Math.min(14, Math.max(1, Math.ceil((speed * dt) / 0.08)));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      p.pos.x += p.vel.x * h;
      p.pos.y += p.vel.y * h;
      p.z += p.vz * h;
      p.vz -= PUCK.gravity * h;
      if (p.z <= 0) {
        p.z = 0;
        p.vz = p.vz < -1.2 ? -p.vz * 0.3 : 0;
      }
      if (hitBoards(p, RINK_CORE, PUCK.boardBounce) > 3) this.events.push({ type: 'boards' });
      this.collideNets(p);
      if (p.z < 1.7) {
        for (const s of this.skaters) {
          if (s.noPickup > 0.2 && p.lastTouch === s) continue; // just released it
          if (hitCircle(p, s.pos.x, s.pos.y, s.radius * 0.8, PUCK.bodyBounce, s.vel)) {
            p.lastTouch = s;
            p.shot = null;
          }
        }
      }
      if (this.goalieContact()) return;
      if (this.checkGoal()) break;
    }

    if (p.z === 0) {
      const k = Math.exp(-PUCK.drag * dt);
      p.vel.x *= k; p.vel.y *= k;
      const sp = p.speed;
      const ns = Math.max(0, sp - PUCK.friction * dt);
      if (sp > 0) { p.vel.x *= ns / sp; p.vel.y *= ns / sp; }
      if (ns < 0.05) { p.vel.x = 0; p.vel.y = 0; }
    }
    for (const g of this.goalies) g.clearT = Math.max(0, (g.clearT ?? 0) - dt);

    if (this.state !== 'faceoff' && p.z < 0.45) this.pickups();
  }

  collideNets(p) {
    for (const side of [-1, 1]) {
      const gx = side * RINK.goalLineX, bx = gx + side * GOAL.depth;
      const inBox = side * p.pos.x > RINK.goalLineX - p.radius && side * p.pos.x < RINK.goalLineX + GOAL.depth + p.radius && Math.abs(p.pos.y) < HW + p.radius;
      if (inBox && p.z >= GOAL.height - 0.05) {
        // Landed on the roof of the net.
        if (p.vz < 0) { p.z = GOAL.height; p.vz = 0; }
        continue;
      }
      if (p.z >= GOAL.height) continue;
      for (const py of [-HW, HW]) {
        if (hitCircle(p, gx, py, 0.06, PUCK.postBounce) > 2) this.events.push({ type: 'post' });
      }
      hitSegment(p, gx, -HW, bx, -HW, PUCK.netBounce);
      hitSegment(p, gx, HW, bx, HW, PUCK.netBounce);
      hitSegment(p, bx, -HW, bx, HW, PUCK.netBounce);
    }
  }

  goalieContact() {
    const p = this.puck;
    if (p.z > 1.45 || this.state !== 'play') return false;
    for (const g of this.goalies) {
      if ((g.clearT ?? 0) > 0) continue;
      const r = g.blockRadius(p.z);
      const d = Math.hypot(p.pos.x - g.pos.x, p.pos.y - g.pos.y);
      if (d > r + p.radius) continue;
      const shot = p.shot && p.shot.side !== g.sideKey;
      if (p.speed < 6 && p.z < 0.4) {
        // Smother it.
        p.holder = g;
        p.lastTouch = null;
        g.holdT = 1.1;
        p.vel.x = 0; p.vel.y = 0; p.vz = 0;
      } else {
        hitCircle(p, g.pos.x, g.pos.y, r, 0.3, g.vel);
        // Rebounds scatter a little.
        const sp = p.speed, a = Math.atan2(p.vel.y, p.vel.x) + (Math.random() - 0.5) * 0.8;
        p.vel.x = Math.cos(a) * sp; p.vel.y = Math.sin(a) * sp;
        p.vz = Math.max(p.vz, 0) * 0.3;
      }
      if (shot) {
        this.shots[p.shot.side] += 1;
        this.events.push({ type: 'save', goalie: g });
      }
      p.shot = null;
      return !!p.holder;
    }
    return false;
  }

  pickups() {
    const p = this.puck;
    let best = null, bd = PICKUP_RANGE;
    for (const s of this.skaters) {
      if (s.noPickup > 0) continue;
      const b = s.bladePoint();
      const d = Math.hypot(p.pos.x - b.x, p.pos.y - b.y);
      const rel = Math.hypot(p.vel.x - s.vel.x, p.vel.y - s.vel.y);
      if (d < bd && rel < PICKUP_MAX_REL_SPEED) { bd = d; best = s; }
    }
    if (best) this.gainPossession(best);
  }

  checkGoal() {
    if (this.state !== 'play') return false;
    const p = this.puck;
    for (const side of [-1, 1]) {
      const depth = side * p.pos.x;
      if (depth > RINK.goalLineX + p.radius && depth < RINK.goalLineX + GOAL.depth && Math.abs(p.pos.y) < HW && p.z < GOAL.height) {
        const scorer = side < 0 ? 'away' : 'home';
        this.score[scorer] += 1;
        this.shots[scorer] += 1;
        const by = p.carrier ?? p.lastTouch;
        if (p.carrier) { p.carrier.hasPuck = false; p.carrier = null; }
        p.shot = null;
        this.lastGoal = { side: scorer, by };
        this.state = 'goal';
        this.timer = 2.6;
        this.events.push({ type: 'goal', side: scorer, by });
        return true;
      }
    }
    return false;
  }
}
