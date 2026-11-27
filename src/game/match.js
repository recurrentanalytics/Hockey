// On-ice game state: skaters, goalies, the puck, possession, shots, passes and goals.
// Skaters nobody controls are played by the team AI (game/ai.js) on sides where it
// is switched on; elsewhere (practice) they stand still and take passes.
import { RINK, GOAL, SHOT, TEAMS } from '../config.js';
import { HAIR } from '../world/sprites.js';
import { AI } from './ai.js';
import { Referee } from './referee.js';
import { RINK_CORE } from '../world/rink.js';
import { Skater } from '../world/skater.js';
import { Goalie } from './goalie.js';
import { Puck } from './puck.js';
import { hitSegment, hitCircle, hitBoards } from './physics.js';

const PASS = { min: 9, max: 19 };
const PICKUP_RANGE = 0.5;
const PICKUP_MAX_REL_SPEED = 17;
const HW = GOAL.width / 2;
const lerp = (a, b, t) => a + (b - a) * t;
const angleDiff = (a, b) => Math.abs(((((b - a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI);

/** Skater start spots for the home side (defends the left net); away is mirrored. */
// Slots 0–1 are forwards (0 takes the draw), 2–3 defence.
const NUMBERS = [9, 17, 4, 44, 11, 22, 7, 33];
const SPOTS = [{ x: -1.3, y: 0 }, { x: -5, y: 5 }, { x: -10, y: -4 }, { x: -10, y: 4 }];

export class Match {
  /**
   * @param home/away  { team, skaters: n, goalie: bool }
   * @param humans     [{ controller, side: 'home'|'away', tag, color }]
   * @param ai         sides the AI plays for, e.g. ['home', 'away']
   * @param rules      resolved ruleset (game/rules.js), or null for endless practice
   */
  constructor({ home, away, humans, difficulty = 'normal', ai = [], rules = null, ball = null }) {
    this.sides = {
      home: { key: 'home', team: home.team, attack: 1 },
      away: { key: 'away', team: away.team, attack: -1 },
    };
    // Ball or puck: the player's choice, else what the rulebook says.
    this.puck = new Puck(ball ?? !!rules?.ball);
    this.skaters = [];
    this.goalies = [];
    for (const [key, cfg] of [['home', home], ['away', away]]) {
      const lines = cfg.lines ?? 1;
      for (let i = 0; i < cfg.skaters * lines; i++) {
        const t = TEAMS[cfg.team];
        const number = (t.numbers ?? NUMBERS)[i] ?? 50 + i;
        // Bonny (#61) plays for the Borstentiere; the Balding Borstis are... balding.
        const look = cfg.team.startsWith('borstentiere') && number === 61 ? { kind: 'boar' }
          : t.bald ? { kind: 'bald', hair: HAIR[(number * 7) % 3] }
          : { hair: HAIR[(number * 5 + i) % HAIR.length], skin: (number * 3 + i) % 5 === 0 ? 2 : (number + i) % 3 === 0 ? 1 : 0 };
        const s = new Skater({ team: cfg.team, number, look });
        s.sideKey = key;
        s.slot = i % cfg.skaters;              // role in the line: 0-1 forwards, 2-3 defence
        s.line = Math.floor(i / cfg.skaters);
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
    const blank = () => ({ ppGoals: 0, ppOpp: 0, pim: 0, faceoffs: 0, hits: 0 });
    this.stats = { home: blank(), away: blank() };
    this.difficulty = difficulty;
    this.lastGoal = null;
    this.roster = [...this.skaters];   // everyone; this.skaters = on the ice right now
    // Only the first line starts on the ice.
    for (const s of this.roster) if (s.line > 0) { this.offIce(s); s.benched = true; }
    this.ai = new AI(this, { sides: ai, difficulty });
    this.ref = rules ? new Referee(this, rules) : null;
    this.faceoff();
  }

  get entities() {
    return [...this.skaters, ...this.goalies, this.puck];
  }

  /** Face-off at a spot (centre by default); line-ups are shifted to it and kept on the rink. */
  faceoff(at = { x: 0, y: 0 }) {
    if (this.ref) { this.lineChanges(); this.applyStrength(); }
    this.puck.reset(at.x, at.y);
    const team = { home: 0, away: 0 };
    for (const s of this.skaters) {
      const spot = SPOTS[team[s.sideKey]++] ?? SPOTS[0];
      const m = this.sides[s.sideKey].attack;
      const x = Math.max(-RINK.goalLineX + 2.5, Math.min(RINK.goalLineX - 2.5, at.x + spot.x * m));
      const y = Math.max(-RINK.width / 2 + 2, Math.min(RINK.width / 2 - 2, at.y + spot.y * m));
      s.place(x, y, m > 0 ? 0 : Math.PI);
      s.hasPuck = false;
      if (s.ai) s.ai.charging = false;
    }
    for (const g of this.goalies) g.reset();
    this.state = 'faceoff';
    this.timer = 1.2;
    // The first skater lined up for each side takes the draw; humans get control of their centre.
    const centers = {};
    for (const s of this.skaters) centers[s.sideKey] ??= s;
    for (const side of ['home', 'away']) {
      const h = this.humans.find((x) => x.side === side);
      const c = centers[side];
      if (h && c && h.skater !== c && !c.human) this.giveControl(h, c);
    }
    const react = { easy: 0.36, normal: 0.26, hard: 0.18 }[this.difficulty] ?? 0.26;
    this.draw = {
      spot: { ...at }, centers, live: false, t: 0, early: {},
      press: {
        home: centers.home?.human ? null : react * (0.6 + Math.random() * 0.9),
        away: centers.away?.human ? null : react * (0.6 + Math.random() * 0.9),
      },
    };
  }

  /** Face-off draw: whoever reacts first to the drop wins it back to a teammate. */
  updateDraw(dt, input) {
    const d = this.draw;
    if (!d?.live) return;
    d.t += dt;
    for (const side of ['home', 'away']) {
      const c = d.centers[side];
      if (!c?.human || d.press[side] != null) continue;
      const ctl = input.controller(c.human.controller);
      if (ctl && (ctl.pressed.shoot || ctl.pressed.pass)) d.press[side] = d.early[side] ? Infinity : d.t;
    }
    const ph = d.press.home ?? Infinity, pa = d.press.away ?? Infinity;
    const done = (d.press.home != null && d.press.away != null) || d.t > 0.7;
    if (!done) return;
    d.live = false;
    if (ph === Infinity && pa === Infinity) return; // nobody won it cleanly: loose puck
    const side = ph < pa ? 'home' : pa < ph ? 'away' : (Math.random() < 0.5 ? 'home' : 'away');
    const win = d.centers[side];
    if (!win) return;
    this.stats[side].faceoffs += 1;
    // Pull it back toward a teammate behind the draw.
    const A = this.sides[side].attack;
    const mates = this.skaters.filter((s) => s.sideKey === side && s !== win);
    const back = mates.sort((a, b) => A * a.pos.x - A * b.pos.x)[0];
    const p = this.puck;
    const tx = back ? back.pos.x : p.pos.x - A * 4, ty = back ? back.pos.y : p.pos.y;
    const dx = tx - p.pos.x, dy = ty - p.pos.y, dd = Math.hypot(dx, dy) || 1;
    const speed = Math.min(9, 4 + dd * 0.6);
    p.vel.x = (dx / dd) * speed;
    p.vel.y = (dy / dd) * speed;
    p.lastTouch = win;
    win.noPickup = 0.3;
    this.events.push({ type: 'faceoffWon', side, by: win });
  }

  // ------------------------------------------------------------------ update

  update(dt, input) {
    this.events.length = 0;
    if (this.state === 'final') return;
    this.ref?.update(dt);
    // Lined up for a face-off: centres crouch over the dot, the others get ready.
    const lined = this.state === 'faceoff' || (this.draw?.live ?? false);
    for (const s of this.skaters) s.stance = lined ? (this.draw?.centers[s.sideKey] === s ? 'draw' : 'ready') : null;
    if (this.state === 'faceoff' || this.state === 'break') {
      for (const g of this.goalies) g.update(dt, this.puck);
      // Moving early on a face-off loses the draw.
      if (this.state === 'faceoff' && this.draw) {
        for (const side of ['home', 'away']) {
          const c = this.draw.centers[side];
          const ctl = c?.human && input.controller(c.human.controller);
          if (ctl && (ctl.pressed.shoot || ctl.pressed.pass) && !this.draw.early[side]) {
            this.draw.early[side] = true;
            this.events.push({ type: 'faceoffEarly', side });
          }
        }
      }
      this.timer -= dt;
      if (this.timer <= 0) {
        if (this.state === 'faceoff') { this.state = 'play'; if (this.draw) { this.draw.live = true; this.draw.t = 0; } }
        else { const next = this.afterBreak; this.afterBreak = null; next?.(); }
      }
      return;
    }

    const live = this.state === 'play';
    if (live) this.updateDraw(dt, input);
    const drawing = !!this.draw?.live;
    for (const h of this.humans) {
      const c = input.controller(h.controller);
      const s = h.skater;
      s.update(dt, live && c ? { move: c.move, sprint: c.down.sprint } : this.state === 'goal' ? this.ai.celebrate(s) : {});
      if (live && c && !drawing) this.actions(h, c, dt);
    }
    // Fatigue recovers during stoppages, and faster on the bench.
    if (!live) for (const s of this.skaters) s.fatigue = Math.max(0, (s.fatigue ?? 0) - 0.03 * dt);
    for (const s of this.roster) if (s.benched) s.fatigue = Math.max(0, (s.fatigue ?? 0) - 0.02 * dt);
    this.ai.think(dt);
    for (const s of this.skaters) if (!s.human) s.update(dt, this.ai.controls.get(s) ?? {});

    for (let i = 0; i < this.skaters.length; i++) {
      for (let j = i + 1; j < this.skaters.length; j++) {
        const a = this.skaters[i], b = this.skaters[j];
        if (live && a.sideKey !== b.sideKey) this.contact(a, b);
        Skater.collide(a, b);
      }
    }
    for (const g of this.goalies) {
      g.update(dt, this.puck);
      for (const s of this.skaters) s.collideStatic(g.pos, g.radius);
    }

    this.pokes();
    this.stepPuck(dt);

    if (this.state === 'goal' || this.state === 'whistle') {
      this.timer -= dt;
      if (this.timer <= 0) {
        const after = this.afterWhistle;
        this.afterWhistle = null;
        if (after) after();
        else if (!this.ref?.stoppage()) this.faceoff(this.state === 'whistle' ? this.nextSpot ?? undefined : undefined);
      }
    }
  }

  // ------------------------------------------------------------------ body contact & fouls

  /** Hard contact between opponents: a check (where legal) or a body-checking foul. */
  contact(a, b) {
    const dx = b.pos.x - a.pos.x, dy = b.pos.y - a.pos.y, d = Math.hypot(dx, dy);
    if (d > a.radius + b.radius + 0.05 || d < 1e-6) return;
    const nx = dx / d, ny = dy / d;
    const va = a.vel.x * nx + a.vel.y * ny, vb = -(b.vel.x * nx + b.vel.y * ny);
    const approach = va + vb;
    if (approach < 3.2 || (a.hitCd ?? 0) > 0 || (b.hitCd ?? 0) > 0) return;
    const [hitter, victim, sx, sy] = va >= vb ? [a, b, nx, ny] : [b, a, -nx, -ny];
    const drive = Math.max(va, vb); // how hard the hitter skated into the other player
    a.hitCd = b.hitCd = 0.8;
    const p = this.puck;
    // A fair check hits the carrier from the front or side; from behind it is always a foul.
    const fx = Math.cos(victim.dir), fy = Math.sin(victim.dir);
    const fromBehind = sx * fx + sy * fy > 0.5;
    const legalCheck = this.ref?.r.bodyCheck && victim.hasPuck && !fromBehind;
    if (victim.hasPuck && (legalCheck || Math.random() < 0.5)) {
      p.carrier = null;
      victim.hasPuck = false;
      victim.charging = false;
      victim.noPickup = 0.6;
      p.vel.x = victim.vel.x * 0.5 + sx * 3;
      p.vel.y = victim.vel.y * 0.5 + sy * 3;
      p.lastTouch = victim;
    }
    victim.vel.x += sx * approach * 0.35;
    victim.vel.y += sy * approach * 0.35;
    // Knocked off the skates: by a real check, a hard human hit, or a genuine high-speed crash.
    // Ordinary bumps in puck battles only stagger (the push above).
    const down = legalCheck ? approach > 4.5 : hitter.human ? approach > 7 : approach > 10;
    if (down) { victim.downT = victim.downMax = 1.3; victim.charging = false; }
    // Count real checks only: legal checks, knockdowns and hard human hits (not incidental bumps).
    if (legalCheck || down || (hitter.human && approach > 5)) this.stats[hitter.sideKey].hits += 1;
    this.events.push({ type: 'hit', hitter, victim, approach });
    if (!this.ref || legalCheck) return;
    // Only a deliberate, hard hit is called: the hitter must drive through at speed.
    // The AI steers around opponents, so its contact is incidental; human hits can be called.
    if (!hitter.human || drive < 5 || approach < 6) return;
    // Racing for a loose puck is a puck battle, not a penalty.
    if (p.loose && Math.hypot(p.pos.x - victim.pos.x, p.pos.y - victim.pos.y) < 2.5) return;
    const chance = Math.min(0.7, (approach - 6) / 4 + 0.15);
    if (fromBehind) this.ref.foul(hitter, victim, 'CHECK VON HINTEN', this.ref.r.fromBehind);
    else if (Math.random() < chance) this.ref.foul(hitter, victim, this.ref.r.hitFoul);
  }

  // ------------------------------------------------------------------ who is on the ice

  /** Take a skater off the ice (penalty box, shootout). */
  offIce(s) {
    const i = this.skaters.indexOf(s);
    if (i < 0) return;
    this.skaters.splice(i, 1);
    s.offIce = true;
    if (this.puck.carrier === s) { this.puck.carrier = null; this.puck.lastTouch = s; }
    s.hasPuck = false;
    s.charging = false;
    s.charge = 0;
    if (s.human) {
      const h = s.human;
      const mates = this.skaters.filter((k) => k.sideKey === s.sideKey && !k.human);
      if (mates.length) {
        const p = this.puck;
        mates.sort((x, y) => Math.hypot(x.pos.x - p.pos.x, x.pos.y - p.pos.y) - Math.hypot(y.pos.x - p.pos.x, y.pos.y - p.pos.y));
        this.giveControl(h, mates[0]);
      }
    }
  }

  onIce(s, x, y) {
    if (this.skaters.includes(s)) return;
    this.skaters.push(s);
    s.offIce = false;
    s.place(x, y, this.sides[s.sideKey].attack > 0 ? 0 : Math.PI);
  }

  /** Penalty shot / shootout: only the shooter skates. */
  isolate(shooter) {
    this.draw = null;
    this.saved = this.skaters.filter((s) => s !== shooter);
    for (const s of this.saved) this.offIce(s);
    if (!this.skaters.includes(shooter)) this.onIce(shooter, 0, 0);
    const team = this.humans.filter((h) => h.side === shooter.sideKey);
    if (team.length && !shooter.human) this.giveControl(team[0], shooter);
    const A = this.sides[shooter.sideKey].attack;
    shooter.place(-A * 2, 0, A > 0 ? 0 : Math.PI);
    for (const g of this.goalies) g.reset();
    this.puck.reset(shooter.pos.x, shooter.pos.y);
    this.gainPossession(shooter);
  }

  restore() {
    for (const s of this.saved ?? []) {
      if (this.ref?.box.some((b) => b.skater === s && b.active) || s.benched) continue;
      this.onIce(s, s.pos.x, s.pos.y);
    }
    this.saved = null;
    // Every human needs someone on the ice.
    for (const h of this.humans) {
      if (this.skaters.includes(h.skater)) continue;
      const mate = this.skaters.find((k) => k.sideKey === h.side && !k.human);
      if (mate) this.giveControl(h, mate);
    }
  }

  /** At a stoppage a tired line goes off for the rested one on the bench. */
  lineChanges() {
    for (const side of ['home', 'away']) {
      const boxed = (s) => this.ref.box.some((b) => b.skater === s);
      const bench = this.roster.filter((s) => s.sideKey === side && s.benched && !boxed(s));
      const on = this.skaters.filter((s) => s.sideKey === side);
      if (!bench.length || !on.length) continue;
      const avg = (list) => list.reduce((a, s) => a + (s.fatigue ?? 0), 0) / list.length;
      if (avg(on) < 0.3 || avg(bench) > avg(on) - 0.15) continue;
      const n = on.length;
      for (const s of on) { this.offIce(s); s.benched = true; }
      bench.sort((a, b) => (a.fatigue ?? 0) - (b.fatigue ?? 0));
      for (const s of bench.slice(0, n)) { s.benched = false; this.onIce(s, 0, 0); }
      this.events.push({ type: 'lineChange', side });
    }
  }

  /** Line changes at a stoppage: fit each side to the allowed strength (e.g. 3 on 3 in overtime). */
  applyStrength() {
    const cap = this.ref.strengthCap();
    for (const side of ['home', 'away']) {
      const boxed = this.ref.penaltiesOf(side).length;
      const want = Math.max(this.ref.r.minSkaters, cap - boxed);
      const on = this.skaters.filter((s) => s.sideKey === side);
      // Bench extras, keeping human-controlled skaters on.
      on.sort((a, b) => (a.human ? -1 : 0) - (b.human ? -1 : 0));
      for (const s of on.slice(want)) { this.offIce(s); s.benched = true; }
      const bench = this.roster.filter((s) => s.sideKey === side && s.benched);
      for (const s of bench.slice(0, Math.max(0, want - Math.min(on.length, want)))) { s.benched = false; this.onIce(s, 0, 0); }
    }
  }

  /** Teams change ends between periods. */
  switchEnds() {
    for (const side of Object.values(this.sides)) side.attack *= -1;
    for (const g of this.goalies) g.setSide(-g.side);
  }

  actions(h, c, dt) {
    let s = h.skater;
    const p = this.puck;
    // Snappy switching: a pass to a teammate hands control to the receiver at once; without the
    // ball, control jumps to the teammate clearly closest to it (the switch button still works).
    if (!s.hasPuck) {
      h.autoT = (h.autoT ?? 0) - dt;
      const rcv = p.passTo;
      if (rcv && rcv.sideKey === h.side && rcv !== s && !rcv.human) { this.giveControl(h, rcv); h.autoT = 0.6; }
      else if (h.autoT <= 0 && !(p.carrier && p.carrier.sideKey === h.side)) {
        const d = (t) => Math.hypot(t.pos.x - p.pos.x, t.pos.y - p.pos.y);
        let best = null;
        for (const t of this.skaters) if (t.sideKey === h.side && !t.human && (!best || d(t) < d(best))) best = t;
        if (best && d(best) < d(s) - 2.2) { this.giveControl(h, best); h.autoT = 0.7; }
      }
      s = h.skater;
    }
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
    p.shot = { by: s, side: s.sideKey, charge, dist: Math.hypot(goalX - s.pos.x, s.pos.y) };
    p.passTo = null;
    s.followT = 0.22;
    s.releaseT = 0.38; s.releaseKind = 'shot'; s.releaseCharge = charge;
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
    s.releaseT = 0.2; s.releaseKind = 'pass';
    p.passTo = best;
    this.events.push({ type: 'pass', by: s, to: best });
  }

  pokes() {
    const p = this.puck;
    for (const s of this.skaters) {
      if (s.pokeT <= 0) { s.pokeChecked = false; continue; }
      const tip = s.bladePoint();
      if (this.ref && !s.pokeChecked && Math.hypot(tip.x - p.pos.x, tip.y - p.pos.y) > 0.6) {
        const body = this.skaters.find((o) => o.sideKey !== s.sideKey && Math.hypot(tip.x - o.pos.x, tip.y - o.pos.y) < 0.42);
        if (body) {
          s.pokeChecked = true;
          if (Math.random() < 0.3) this.ref.foul(s, body, Math.random() < 0.5 ? 'BEINSTELLEN' : 'STOCKSCHLAG');
        }
      }
      if (!p.carrier || p.carrier.sideKey === s.sideKey || p.carrier.protectT > 0) continue;
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
    p.passTo = null;
    p.z = 0;
    p.vz = 0;
    s.hasPuck = true;
    s.protectT = 0.45; // a moment to settle the puck before it can be poked away
    // Possession chain for assists: reset when the other team gets it.
    const chain = p.chain ?? (p.chain = []);
    if (chain.length && chain[chain.length - 1].sideKey !== s.sideKey) chain.length = 0;
    if (chain[chain.length - 1] !== s) chain.push(s);
    this.events.push({ type: 'pickup', by: s, side: s.sideKey });
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
      if (this.ref && g.holdT < 0.6) {
        this.ref.covered(g);
        return;
      }
      if (g.holdT <= 0) {
        // Outlet pass to an open teammate, otherwise play it out toward a corner.
        let ang = (g.out > 0 ? 0 : Math.PI) + (Math.random() < 0.5 ? -1 : 1) * (0.7 + Math.random() * 0.4);
        let speed = 11;
        const opps = this.skaters.filter((s) => s.sideKey !== g.sideKey);
        let best = null, bd = 16;
        for (const s of this.skaters) {
          if (s.sideKey !== g.sideKey) continue;
          const d = Math.hypot(s.pos.x - p.pos.x, s.pos.y - p.pos.y);
          const open = opps.every((o) => Math.hypot(o.pos.x - s.pos.x, o.pos.y - s.pos.y) > 3);
          if (open && d > 2.5 && d < bd) { bd = d; best = s; }
        }
        if (best) {
          ang = Math.atan2(best.pos.y - p.pos.y, best.pos.x - p.pos.x);
          speed = Math.max(9, Math.min(16, 7 + bd * 0.6));
        }
        p.holder = null;
        p.vel.x = Math.cos(ang) * speed;
        p.vel.y = Math.sin(ang) * speed;
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
      p.vz -= p.phys.gravity * h;
      if (p.z <= 0) {
        p.z = 0;
        p.vz = p.vz < -1.2 ? -p.vz * p.phys.groundBounce : 0;
      }
      const bump = hitBoards(p, RINK_CORE, p.phys.boardBounce);
      if (bump > 2) this.events.push({ type: 'boards', speed: bump });
      this.collideNets(p);
      if (p.z < 1.7) {
        for (const s of this.skaters) {
          if (s.noPickup > 0.2 && p.lastTouch === s) continue; // just released it
          if (hitCircle(p, s.pos.x, s.pos.y, s.radius * 0.8, p.phys.bodyBounce, s.vel)) {
            p.lastTouch = s;
            p.shot = null;
          }
        }
      }
      if (this.goalieContact()) return;
      if (this.checkGoal()) break;
    }

    if (p.z === 0) {
      const k = Math.exp(-p.phys.drag * dt);
      p.vel.x *= k; p.vel.y *= k;
      const sp = p.speed;
      const ns = Math.max(0, sp - p.phys.friction * dt);
      if (sp > 0) { p.vel.x *= ns / sp; p.vel.y *= ns / sp; }
      if (ns < 0.05) { p.vel.x = 0; p.vel.y = 0; }
    }
    for (const g of this.goalies) g.clearT = Math.max(0, (g.clearT ?? 0) - dt);

    if (this.state !== 'faceoff' && !this.draw?.live && p.z < 0.45) this.pickups();
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
        const ring = hitCircle(p, gx, py, 0.06, p.phys.postBounce);
        if (ring > 2) this.events.push({ type: 'post', speed: ring });
      }
      hitSegment(p, gx, -HW, bx, -HW, p.phys.netBounce);
      hitSegment(p, gx, HW, bx, HW, p.phys.netBounce);
      hitSegment(p, bx, -HW, bx, HW, p.phys.netBounce);
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
      // Show the save that stopped it.
      g.saveT = 0.5;
      g.saveKind = p.z < 0.35 ? 'butterfly' : (p.pos.y - g.pos.y) * g.out >= 0 ? 'glove' : 'blocker';
      if (shot) {
        g.saves = (g.saves ?? 0) + 1;
        if (p.shot.by) p.shot.by.sog = (p.shot.by.sog ?? 0) + 1;
        this.shots[p.shot.side] += 1;
        this.events.push({ type: 'save', goalie: g, speed: p.speed, dist: p.shot.dist });
      }
      p.shot = null;
      return !!p.holder;
    }
    return false;
  }

  pickups() {
    const p = this.puck;
    let best = null, bd = Infinity;
    for (const s of this.skaters) {
      if (s.noPickup > 0) continue;
      const b = s.bladePoint();
      const d = Math.hypot(p.pos.x - b.x, p.pos.y - b.y);
      const rel = Math.hypot(p.vel.x - s.vel.x, p.vel.y - s.vel.y);
      // The intended receiver reaches out with the stick for a pass.
      const range = s === p.passTo ? PICKUP_RANGE + 0.3 : PICKUP_RANGE;
      if (d < Math.min(bd, range) && rel < PICKUP_MAX_REL_SPEED) { bd = d; best = s; }
    }
    if (best) this.gainPossession(best);
  }

  checkGoal() {
    if (this.state !== 'play') return false;
    const p = this.puck;
    p.mouth ??= {};
    for (const side of [-1, 1]) {
      const depth = side * p.pos.x;
      // Only a ball that enters through the goal mouth counts: remember whether it last came from
      // in front of the goal line between the posts, or from beside or behind the net.
      const ay = Math.abs(p.pos.y);
      if (depth <= RINK.goalLineX && ay < HW + 0.3) p.mouth[side] = true;
      else if (depth > RINK.goalLineX && (ay >= HW || depth >= RINK.goalLineX + GOAL.depth)) p.mouth[side] = false;
      if (p.mouth[side] && depth > RINK.goalLineX + p.radius && depth < RINK.goalLineX + GOAL.depth && ay < HW && p.z < GOAL.height) {
        // The team shooting at this net scores (teams change ends between periods).
        const scorer = this.sides.home.attack === side ? 'home' : 'away';
        const counts = this.ref?.phase !== 'shootout';
        if (counts) {
          this.score[scorer] += 1;
          this.shots[scorer] += 1;
        }
        const by = p.carrier ?? p.lastTouch;
        // Credit: scorer plus up to two teammates who handled it before them.
        let assists = [];
        if (by && by.sideKey === scorer && by.number != null) {
          const before = (p.chain ?? []).filter((x) => x.sideKey === scorer && x !== by);
          assists = [...new Set(before.reverse())].slice(0, 2);
          if (counts) {
            by.g = (by.g ?? 0) + 1;
            by.sog = (by.sog ?? 0) + 1;
            for (const a of assists) a.a = (a.a ?? 0) + 1;
          }
        }
        const beaten = this.goalies.find((g) => g.sideKey !== scorer);
        if (beaten && counts) beaten.ga = (beaten.ga ?? 0) + 1;
        if (p.chain) p.chain.length = 0;
        if (p.carrier) { p.carrier.hasPuck = false; p.carrier = null; }
        p.shot = null;
        this.lastGoal = { side: scorer, by };
        this.nextSpot = null;
        if (by && by.sideKey === scorer) by.celebrateT = 2.5;
        for (const s of this.roster) {
          if (s.sideKey === scorer) s.happyT = 2.6;
          else if (counts) s.sadT = 2.6;
        }
        this.state = 'goal';
        this.timer = 2.6;
        this.events.push({ type: 'goal', side: scorer, by, assists, shootout: !counts });
        this.ref?.onGoal(scorer);
        return true;
      }
    }
    return false;
  }
}
