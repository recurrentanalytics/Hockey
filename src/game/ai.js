// Team AI for every skater no human controls.
//
// Each team reads the situation (we have the puck / they have it / it's loose)
// and gives every AI skater a job:
//   loose   – the closest skater chases, the rest hold a formation shifted with the puck
//   offence – the carrier drives, shoots or passes; the others find open ice to receive
//   defence – the closest skater pressures the carrier and pokes, the rest mark men goal-side
import { RINK, GOAL, SHOT } from '../config.js';
// positions below were tuned for the 60 m arena; they scale with the rink in use
const K = RINK.length / 60, KY = RINK.width / 30;
import { RINK_CORE } from '../world/rink.js';

const HW = GOAL.width / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// speed: share of top speed · react: seconds between decisions
// poke: chance to poke when in range · shotErr: aim error (m) · pass: chance to pass under pressure
const LEVELS = {
  easy:   { speed: 0.82, react: 0.38, poke: 0.18, shotErr: 0.4, pass: 0.45, read: 0.6 },
  normal: { speed: 0.92, react: 0.24, poke: 0.3, shotErr: 0.26, pass: 0.65, read: 0.35 },
  hard:   { speed: 1.0,  react: 0.14, poke: 0.45, shotErr: 0.15, pass: 0.85, read: 0.2 },
};

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Distance from point p to segment a→b. */
function segDist(p, a, b) {
  const abx = b.x - a.x, aby = b.y - a.y;
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1), 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

/** Keep a target on the rink and out of both creases. */
function legal(x, y) {
  const m = 1.0;
  // the rink shrunk by m: works for big rounded corners (arena) and near-square ones (Boni court)
  const shrink = Math.max(0, m - RINK_CORE.radius);
  const hx = RINK_CORE.halfX - shrink, hy = RINK_CORE.halfY - shrink, r = Math.max(0, RINK_CORE.radius - m);
  const cx = clamp(x, -hx, hx), cy = clamp(y, -hy, hy);
  const dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy);
  if (d > r) { x = cx + (d ? (dx / d) * r : 0); y = cy + (d ? (dy / d) * r : 0); }
  for (const side of [-1, 1]) {
    const gx = side * RINK.goalLineX;
    const ddx = x - gx, dd = Math.hypot(ddx, y);
    if (dd < RINK.creaseRadius + 0.4) {
      const k = (RINK.creaseRadius + 0.4) / (dd || 1);
      x = gx + (ddx || -side * 0.1) * k;
      y = y * k;
    }
    // stay out of the net itself
    if (side * x > RINK.goalLineX - 0.2 && side * x < RINK.goalLineX + GOAL.depth + 0.6 && Math.abs(y) < HW + 0.6) {
      y = Math.sign(y || 1) * (HW + 0.7);
    }
  }
  return { x, y };
}

export class AI {
  /**
   * @param match       the Match
   * @param sides       which sides the AI plays for ('home', 'away')
   * @param difficulty  level for teams with no human on them
   */
  constructor(match, { sides = ['home', 'away'], difficulty = 'normal' } = {}) {
    this.m = match;
    this.sides = new Set(sides);
    this.levels = {};
    for (const key of ['home', 'away']) {
      const hasHuman = match.humans.some((h) => h.side === key);
      // Teammates of human players play at normal level; opponents follow the difficulty.
      this.levels[key] = LEVELS[hasHuman ? 'normal' : difficulty] ?? LEVELS.normal;
    }
    this.controls = new Map();
    this.roleT = 0;
  }

  isAI(s) {
    return !s.human && this.sides.has(s.sideKey);
  }

  think(dt) {
    const m = this.m;
    this.controls.clear();
    if (m.state === 'goal') {
      for (const s of m.skaters) if (!s.human) this.controls.set(s, this.celebrate(s));
      return;
    }
    if (m.state !== 'play') return; // face-off and stoppages: everyone glides
    for (const key of ['home', 'away']) {
      if (!this.sides.has(key)) continue;
      this.thinkTeam(key, dt);
    }
  }

  /**
   * After a goal: the scorer peels away with a fist pump, teammates skate over for the
   * group hug, and the beaten team coasts off with their heads down.
   */
  celebrate(s) {
    const g = this.m.lastGoal;
    if (!g) return {};
    if (s.sideKey !== g.side) return {};
    const scorer = g.by && g.by.sideKey === g.side ? g.by : null;
    if (!scorer) return {};
    if (s === scorer) {
      // Keep gliding the way they were going, curling away a little.
      const v = s.speed;
      if (v < 1) return {};
      const a = Math.atan2(s.vel.y, s.vel.x) + 0.6;
      return { move: { x: Math.cos(a) * 0.5, y: Math.sin(a) * 0.5 }, limit: 0.55 };
    }
    const dx = scorer.pos.x - s.pos.x, dy = scorer.pos.y - s.pos.y, d = Math.hypot(dx, dy);
    if (d < 1.15) {
      s.celebrateT = Math.max(s.celebrateT ?? 0, 0.4); // arrived: arms up together
      return {};
    }
    const k = Math.min(1, (d - 1.1) / 1.5);
    return { move: { x: (dx / d) * k, y: (dy / d) * k }, limit: 0.8 };
  }

  possession() {
    const p = this.m.puck;
    if (p.carrier) return p.carrier.sideKey;
    if (p.holder) return p.holder.sideKey;
    return null;
  }

  thinkTeam(key, dt) {
    const m = this.m, p = m.puck, lv = this.levels[key];
    const A = m.sides[key].attack;
    const team = m.skaters.filter((s) => s.sideKey === key);
    const opps = m.skaters.filter((s) => s.sideKey !== key);
    const ownGoal = { x: -A * RINK.goalLineX, y: 0 };
    if (!team.length) return; // nobody on the ice (penalty shot / shootout)
    const pos = this.possession();
    const targets = new Map();
    for (const s of team) {
      if (!s.ai) s.ai = { decideT: Math.random() * lv.react, charging: false, chargeTo: 0, pokeT: 0 };
    }

    if (pos === key) {
      // ---------------------------------------------------------------- offence
      const carrier = p.carrier ?? p.holder;
      const cX = A * carrier.pos.x, cy = carrier.pos.y;
      const support = team.filter((s) => s !== carrier && this.isAI(s));
      const spots = [];
      if (cX < -10) {
        // Breakout: give the carrier outlets up the boards and through the middle.
        spots.push({ X: cX + 12, y: 9 }, { X: cX + 12, y: -9 }, { X: cX + 18, y: 0 }, { X: cX + 4, y: -Math.sign(cy || 1) * 6 });
      } else {
        const side = Math.sign(cy || 1);
        spots.push(
          { X: 21, y: -side * 4.5 },               // back door
          { X: 15, y: side * 3 },                   // high slot
          { X: clamp(cX - 8, -6, 12), y: -side * 6 }, // point
          { X: clamp(cX - 8, -6, 12), y: side * 6 },
        );
      }
      // Forwards (low slots) take the attacking spots first, D take the rear ones.
      support.sort((a, b) => a.slot - b.slot);
      support.forEach((s, i) => {
        const sp = spots[i % spots.length];
        targets.set(s, legal(A * sp.X, sp.y));
      });
      if (p.carrier && this.isAI(p.carrier)) this.carrierThink(p.carrier, key, lv, dt);
    } else if (pos) {
      // ---------------------------------------------------------------- defence
      const carrier = p.carrier ?? p.holder;
      const presser = this.closest(team, carrier.pos);
      const markers = team.filter((s) => s !== presser);
      if (this.isAI(presser)) {
        if (p.holder) {
          targets.set(presser, legal(p.holder.pos.x + p.holder.out * 3.5, p.holder.pos.y));
        } else {
          // Close the gap goal-side, then go straight for the puck on the stick.
          const g = this.unit(carrier.pos, ownGoal);
          const close = dist(presser.pos, carrier.pos) < 2.5;
          const t = close ? p.pos : { x: carrier.pos.x + g.x * 0.5, y: carrier.pos.y + g.y * 0.5 };
          targets.set(presser, { x: t.x, y: t.y, chase: true, near: carrier.pos });
          this.tryPoke(presser, carrier, lv, dt);
        }
      }
      const free = markers.slice();
      // Slot guard: when the carrier is in our half, one defender blocks the lane to the net.
      if (-A * carrier.pos.x > 0 && free.length) {
        const g = this.unit(ownGoal, carrier.pos);
        const d = Math.min(4, dist(ownGoal, carrier.pos) * 0.45);
        const slot = legal(ownGoal.x + g.x * Math.max(2.4, d), ownGoal.y + g.y * Math.max(2.4, d));
        const guard = this.closest(free, slot);
        free.splice(free.indexOf(guard), 1);
        if (this.isAI(guard)) targets.set(guard, slot);
      }
      // Mark the most dangerous opponents (closest to our net) goal-side.
      const threats = opps.filter((o) => o !== carrier).sort((a, b) => dist(a.pos, ownGoal) - dist(b.pos, ownGoal));
      for (const o of threats) {
        if (!free.length) break;
        const d = this.closest(free, o.pos);
        free.splice(free.indexOf(d), 1);
        if (!this.isAI(d)) continue;
        const g = this.unit(o.pos, ownGoal);
        targets.set(d, legal(o.pos.x + g.x * 1.5, o.pos.y + g.y * 1.5));
      }
      free.forEach((s, i) => {
        if (this.isAI(s)) targets.set(s, legal(-A * 18, i % 2 ? 2.5 : -2.5));
      });
    } else {
      // ---------------------------------------------------------------- loose puck
      const lead = 0.35 + lv.read * 0.3;
      const pp = legal(p.pos.x + p.vel.x * lead, p.pos.y + p.vel.y * lead);
      let chaser = this.closest(team, pp);
      const rcv = p.passTo;
      if (rcv && rcv.sideKey === key) {
        chaser = rcv;
        if (this.isAI(rcv)) {
          // Step into the puck's path rather than chasing it from behind.
          const sp = Math.hypot(p.vel.x, p.vel.y) || 1;
          const ux = p.vel.x / sp, uy = p.vel.y / sp;
          const along = Math.max(0, (rcv.pos.x - p.pos.x) * ux + (rcv.pos.y - p.pos.y) * uy);
          const meet = legal(p.pos.x + ux * along, p.pos.y + uy * along);
          targets.set(rcv, { ...meet, chase: true });
        }
      }
      if (this.isAI(chaser) && !targets.has(chaser)) targets.set(chaser, { ...pp, chase: true });
      const others = team.filter((s) => s !== chaser && this.isAI(s)).sort((a, b) => a.slot - b.slot);
      const pX = A * p.pos.x;
      others.forEach((s) => {
        const fwd = s.slot < 2;
        const X = fwd ? clamp(pX + 4 * K, -12 * K, 18 * K) : clamp(pX - 9 * K, -20 * K, 6 * K);
        const y = (s.slot % 2 ? 1 : -1) * (fwd ? 6 : 4) * KY;
        targets.set(s, legal(A * X, y));
      });
    }

    for (const [s, t] of targets) {
      if (this.controls.has(s)) continue; // carrier already decided
      this.controls.set(s, this.steer(s, t, lv, t.chase));
    }
  }

  closest(list, pt) {
    let best = null, bd = Infinity;
    for (const s of list) {
      const d = dist(s.pos, pt);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  unit(from, to) {
    const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
    return { x: dx / d, y: dy / d };
  }

  steer(s, t, lv, chase = false) {
    const dx = t.x - s.pos.x, dy = t.y - s.pos.y, d = Math.hypot(dx, dy);
    if (d < 0.3 && !chase) return { move: { x: 0, y: 0 }, limit: lv.speed };
    const k = chase ? 1 : Math.min(1, d / 1.6);
    let mx = (dx / (d || 1)) * k, my = (dy / (d || 1)) * k;
    // Separation: spread out from teammates; when not chasing, skate around opponents too.
    for (const o of this.m.skaters) {
      if (o === s) continue;
      const mate = o.sideKey === s.sideKey;
      if (!mate && chase) continue;
      // Opponents closing fast get a wider berth (marking means shadowing, not ramming).
      const rel = mate ? 0 : Math.max(0, Math.hypot(s.vel.x - o.vel.x, s.vel.y - o.vel.y) - 3);
      const range = mate ? 2.2 : 1.6 + rel * 0.2, w = mate ? 0.25 : 0.6;
      const ox = s.pos.x - o.pos.x, oy = s.pos.y - o.pos.y, od = Math.hypot(ox, oy);
      if (od > 0 && od < range) { mx += (ox / od) * (range - od) * w; my += (oy / od) * (range - od) * w; }
    }
    const len = Math.hypot(mx, my);
    if (len > 1) { mx /= len; my /= len; }
    // Ease off when closing on an opponent: contact at speed is a body-checking call.
    let limit = lv.speed;
    // Where checking the carrier is legal (inline-skaterhockey) the AI closes at full speed.
    if (t.near && !this.m.ref?.r.bodyCheck) {
      const dn = dist(s.pos, t.near);
      if (dn < 3) limit *= clamp(dn / 3, 0.45, 1);
    }
    // Racing an opponent to the same spot: real players ease up rather than crash head-on.
    let brace = false;
    for (const o of this.m.skaters) {
      if (o.sideKey === s.sideKey || o.downT > 0) continue;
      const ox = o.pos.x - s.pos.x, oy = o.pos.y - s.pos.y, od = Math.hypot(ox, oy);
      if (od > 3 || od < 1e-6) continue;
      const closing = ((s.vel.x - o.vel.x) * ox + (s.vel.y - o.vel.y) * oy) / od;
      if (closing > (chase ? 5.5 : 3.5)) { limit *= clamp(0.35 + (od / 3) * 0.4, 0.35, 0.75); brace = true; }
    }
    return { move: { x: mx, y: my }, sprint: d > 7 && s.stamina > 0.35 && !t.near && !brace, limit };
  }

  tryPoke(s, carrier, lv, dt) {
    s.ai.pokeT -= dt;
    if (s.ai.pokeT > 0) return;
    s.ai.pokeT = lv.react;
    const b = s.bladePoint();
    if (dist(b, this.m.puck.pos) < 0.8 && Math.random() < lv.poke) s.poke();
  }

  // ------------------------------------------------------------------ puck carrier

  carrierThink(s, key, lv, dt) {
    const m = this.m;
    const A = m.sides[key].attack;
    const gx = A * RINK.goalLineX;
    const X = A * s.pos.x;
    const goalDist = Math.hypot(gx - s.pos.x, s.pos.y);
    const opps = m.skaters.filter((o) => o.sideKey !== key);
    const near = opps.reduce((d, o) => Math.min(d, dist(o.pos, s.pos)), Infinity);

    // Winding up a shot: keep charging, then let it go.
    if (s.ai.charging) {
      s.charging = true;
      s.charge = Math.min(1, s.charge + dt / SHOT.chargeTime);
      this.aimShot(s, key, lv);
      if (s.charge >= s.ai.chargeTo || near < 1.0) {
        s.ai.charging = false;
        m.shoot(s, s.charge);
        this.controls.set(s, { move: { x: 0, y: 0 }, limit: lv.speed });
        return;
      }
      this.controls.set(s, { move: { x: 0, y: 0 }, limit: lv.speed });
      return;
    }

    s.ai.slowT = s.speed < 1.2 ? (s.ai.slowT ?? 0) + dt : 0;
    if (s.ai.slowT > 2) {
      // Pinned with nobody to pass to: chip it ahead along the boards.
      s.ai.slowT = 0;
      s.dir = Math.atan2(-s.pos.y * 0.3, A * 8);
      m.shoot(s, 0.25);
      return;
    }
    s.ai.decideT -= dt;
    if (s.ai.decideT <= 0) {
      s.ai.decideT = lv.react + Math.random() * 0.15;
      const inFront = Math.abs(s.pos.y) < (A * (gx - s.pos.x)) * 0.9 + 1.5;
      if (X > 8 * K && X < RINK.goalLineX - 0.5 && goalDist < 16 * Math.max(K, 0.55) && inFront) {
        let chance = goalDist < 8 ? 0.3 : goalDist < 12 ? 0.18 : 0.08;
        // A defender in the shooting lane: look for a pass or a better angle instead.
        const goal = { x: gx, y: 0 };
        if (opps.some((o) => segDist(o.pos, s.pos, goal) < 0.9)) chance *= 0.25;
        if (Math.random() < chance) {
          s.ai.charging = true;
          s.ai.chargeTo = goalDist < 7 ? Math.random() * 0.3 : 0.3 + Math.random() * 0.6;
          s.charging = true;
          s.charge = 0;
          this.aimShot(s, key, lv);
          this.controls.set(s, { move: { x: 0, y: 0 }, limit: lv.speed });
          return;
        }
      }
      const pick = this.passTarget(s, key, opps);
      if (pick) {
        const { mate, open } = pick;
        const pressured = near < 1.7;
        const better = A * mate.pos.x > X + 5 && open > 3;
        const stuck = s.ai.slowT > 1;
        if (stuck || (pressured && Math.random() < lv.pass) || (better && Math.random() < 0.2)) {
          s.dir = Math.atan2(mate.pos.y - s.pos.y, mate.pos.x - s.pos.x);
          m.pass(s);
          return;
        }
      }
    }

    // Skate: drive toward the slot, swerving around defenders in the way.
    let tx = A * Math.min(X + 6, 19), ty = clamp(s.pos.y * 0.6, -4.5, 4.5);
    if (X > 17) { tx = A * 19; ty = clamp(s.pos.y * 0.4, -3, 3); }
    let t = legal(tx, ty);
    for (const o of opps) {
      const ox = o.pos.x - s.pos.x, oy = o.pos.y - s.pos.y, od = Math.hypot(ox, oy);
      if (od < 3.5 && ox * A > -0.5) {
        const side = oy > 0 ? -1 : 1;
        t = legal(t.x, t.y + side * (3.5 - od) * 1.6);
      }
    }
    const c = this.steer(s, t, lv, true);
    c.sprint = X < 10 && s.stamina > 0.4;
    this.controls.set(s, c);
  }

  aimShot(s, key, lv) {
    const m = this.m;
    const A = m.sides[key].attack;
    const gx = A * RINK.goalLineX;
    const goalie = m.goalies.find((g) => g.sideKey !== key);
    if (s.ai.aimY == null || !s.charging) {
      // Shoot away from the goalie, with an error that depends on difficulty.
      const gy = goalie ? goalie.pos.y : 0;
      const corner = gy > 0 ? -(HW - 0.28) : HW - 0.28;
      s.ai.aimY = corner + (Math.random() * 2 - 1) * lv.shotErr;
    }
    s.dir = Math.atan2(s.ai.aimY - s.pos.y, gx - s.pos.x);
  }

  passTarget(s, key, opps) {
    const A = this.m.sides[key].attack;
    let best = null, bestScore = -Infinity;
    for (const mte of this.m.skaters) {
      if (mte === s || mte.sideKey !== key) continue;
      const d = dist(mte.pos, s.pos);
      if (d < 3 || d > 22) continue;
      // Where the pass will meet the receiver, and how much room defenders have to step into it.
      const lead = d / 14;
      const meet = { x: mte.pos.x + mte.vel.x * lead, y: mte.pos.y + mte.vel.y * lead };
      const lane = opps.reduce((v, o) => Math.min(v, segDist(o.pos, s.pos, meet) - Math.hypot(o.vel.x, o.vel.y) * 0.08), Infinity);
      if (lane < 0.95 + d * 0.035) continue;
      const open = opps.reduce((v, o) => Math.min(v, dist(o.pos, mte.pos)), Infinity);
      const score = A * mte.pos.x * 0.3 + Math.min(open, 5) - d * 0.05;
      if (score > bestScore) { bestScore = score; best = { mate: mte, open }; }
    }
    return best;
  }
}

export { LEVELS as AI_LEVELS };
