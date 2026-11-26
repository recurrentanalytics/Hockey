// The referee: game clock, periods, stoppages, penalties, power plays,
// penalty shots, overtime and the shootout. Reads its numbers from a ruleset.
import { RINK, TEAMS } from '../config.js';

const END_SPOT = { x: RINK.endCircle.x, y: RINK.endCircle.y };
const TEAM_NAME = (m, side) => TEAMS[m.sides[side].team].name;
const ATTEMPT_TIME = 9;

export class Referee {
  constructor(match, rules) {
    this.m = match;
    this.r = rules;
    this.phase = 'regulation';   // 'regulation' | 'overtime' | 'shootout' | 'final'
    this.period = 1;
    this.clock = rules.periodSeconds;
    this.box = [];               // { skater, side, t, foul, active }
    this.pending = null;         // delayed penalty { offender, side, foul }
    this.attempt = null;         // live penalty shot / shootout attempt
    this.so = null;              // shootout tally
    this.result = null;
    this.timeoutsLeft = { home: this.timeoutQuota(), away: this.timeoutQuota() };
    this.timeoutRequest = { home: false, away: false };
  }

  // ------------------------------------------------------------------ time-outs

  timeoutQuota() {
    return this.r.timeouts ? 1 : 0;
  }

  timeoutAllowed(side) {
    if (this.timeoutsLeft[side] <= 0 || this.phase === 'shootout' || this.phase === 'final') return false;
    if (this.phase === 'overtime' && !this.r.timeouts?.inOvertime) return false;
    return true;
  }

  /** Ask for a time-out; it is taken at the next stoppage of play. */
  requestTimeout(side) {
    if (!this.timeoutAllowed(side)) return false;
    this.timeoutRequest[side] = true;
    this.m.events.push({ type: 'timeoutRequested', side });
    return true;
  }

  /** Called at every stoppage: take a requested time-out (AI teams decide here too). */
  stoppage() {
    const m = this.m;
    for (const side of ['home', 'away']) {
      if (!m.humans.some((h) => h.side === side) && this.aiWantsTimeout(side)) this.timeoutRequest[side] = true;
      if (!this.timeoutRequest[side] || !this.timeoutAllowed(side)) { this.timeoutRequest[side] = false; continue; }
      this.timeoutRequest[side] = false;
      this.timeoutsLeft[side] -= 1;
      for (const s of m.roster) if (s.sideKey === side) s.fatigue = (s.fatigue ?? 0) * 0.3;
      m.events.push({ type: 'timeout', side, seconds: this.r.timeouts.seconds });
      const spot = m.nextSpot;
      this.breakThen(`TIME-OUT ${TEAM_NAME(m, side)}`, () => m.faceoff(spot ?? undefined));
      return true;
    }
    return false;
  }

  aiWantsTimeout(side) {
    const m = this.m;
    if (!this.timeoutAllowed(side)) return false;
    const other = side === 'home' ? 'away' : 'home';
    const behind = m.score[other] - m.score[side];
    const late = this.phase === 'regulation' && this.period === this.r.periods && this.clock < 120;
    const team = m.roster.filter((s) => s.sideKey === side);
    const tired = team.reduce((a, s) => a + (s.fatigue ?? 0), 0) / team.length > 0.6;
    return (late && behind >= 1 && behind <= 2) || tired;
  }

  // ------------------------------------------------------------------ labels for the HUD

  get periodLabel() {
    if (this.phase === 'shootout') return 'SHOOTOUT';
    if (this.phase === 'overtime') return 'OT';
    if (this.phase === 'final') return 'FINAL';
    return `${this.period}/${this.r.periods}`;
  }

  get clockText() {
    if (this.phase === 'shootout' || this.phase === 'final') return '';
    const s = Math.max(0, Math.ceil(this.clock));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /** Active penalties per side, for the power-play indicator. */
  penaltiesOf(side) {
    return this.box.filter((b) => b.side === side && b.active);
  }

  // ------------------------------------------------------------------ per step

  clockRuns() {
    const st = this.m.state;
    if (this.phase === 'shootout' || this.phase === 'final' || this.attempt) return false;
    if (st === 'play') return true;
    return this.r.clock === 'running' && (st === 'whistle' || st === 'goal' || st === 'faceoff');
  }

  update(dt) {
    const m = this.m;
    if (this.clockRuns()) {
      this.clock -= dt;
      for (const b of this.box) if (b.active) b.t -= dt;
      this.releaseExpired();
      if (this.clock <= 0) { this.clock = 0; this.endPeriod(); return; }
    }

    // Delayed penalty: blow the whistle once the offending team touches the puck.
    if (this.pending && m.state === 'play') {
      const p = m.puck;
      const owner = p.carrier?.sideKey ?? p.holder?.sideKey;
      if (owner === this.pending.side) this.whistle('PENALTY');
    }

    if (this.attempt && m.state === 'play') this.watchAttempt(dt);
  }

  releaseExpired() {
    for (const b of this.box) {
      if (b.active && b.t <= 0) this.release(b);
    }
  }

  release(b) {
    b.active = false;
    this.box.splice(this.box.indexOf(b), 1);
    const A = this.m.sides[b.side].attack;
    this.m.onIce(b.skater, -A * 2, -RINK.width / 2 + 1.5);
    this.m.events.push({ type: 'release', skater: b.skater, side: b.side });
    this.activateQueued(b.side);
  }

  activateQueued(side) {
    const onIce = this.m.skaters.filter((s) => s.sideKey === side).length;
    const queued = this.box.find((b) => b.side === side && !b.active);
    if (queued && onIce > this.r.minSkaters) {
      queued.active = true;
      this.m.stats[side === 'home' ? 'away' : 'home'].ppOpp += 1;
      this.m.offIce(queued.skater);
    }
  }

  // ------------------------------------------------------------------ stoppages

  /** Stop play; the face-off spot depends on why. */
  whistle(reason, spot = null) {
    const m = this.m;
    if (m.state !== 'play') return;
    if (this.attempt) { this.endAttempt(false); return; }
    let at = spot;
    if (this.pending) {
      const pen = this.pending;
      this.pending = null;
      this.assess(pen);
      const A = m.sides[pen.side].attack;
      at = { x: -A * END_SPOT.x, y: (m.puck.pos.y >= 0 ? 1 : -1) * END_SPOT.y };
    }
    m.state = 'whistle';
    m.timer = 1.4;
    m.nextSpot = at ?? { x: 0, y: 0 };
    m.events.push({ type: 'whistle', reason });
  }

  /** Goalie covered the puck: face-off at the nearest end-zone spot. */
  covered(goalie) {
    const x = Math.sign(goalie.pos.x) * END_SPOT.x;
    const y = (this.m.puck.pos.y >= 0 ? 1 : -1) * END_SPOT.y;
    this.whistle('COVERED', { x, y });
  }

  /** Skaters a side may have on the ice right now (overtime can be 3 on 3). */
  strengthCap() {
    return this.phase === 'overtime' ? this.r.overtime?.skaters ?? this.r.skaters : this.r.skaters;
  }

  // ------------------------------------------------------------------ penalties

  foul(offender, victim, name, severity = 'minor') {
    const m = this.m;
    if (m.state !== 'play' || this.attempt || this.phase === 'shootout') return;
    if (this.pending || offender.offIce) return;
    m.events.push({ type: 'foul', offender, victim, name });

    // Fouling a player on a clear breakaway earns a penalty shot instead.
    const A = m.sides[victim.sideKey].attack;
    const vX = A * victim.pos.x;
    const clear = victim.hasPuck && vX > 0 &&
      m.skaters.every((s) => s.sideKey === victim.sideKey || s === offender || A * s.pos.x < vX - 0.5);
    if (clear) {
      m.events.push({ type: 'penaltyShot', shooter: victim, offender, name });
      this.whistleForPenaltyShot(victim);
      return;
    }
    this.pending = { offender, side: offender.sideKey, foul: name, major: severity === 'major' };
    const owner = m.puck.carrier?.sideKey ?? m.puck.holder?.sideKey;
    if (owner === offender.sideKey || !owner) this.whistle('PENALTY');
  }

  assess(pen) {
    const minutes = pen.major ? this.r.major : this.r.minor;
    const seconds = Math.round(minutes * 60 * this.r.penaltyScale);
    const entry = { skater: pen.offender, side: pen.side, t: seconds, total: seconds, foul: pen.foul, major: pen.major, active: false };
    this.box.push(entry);
    const st = this.m.stats;
    st[pen.side].pim += seconds;
    const onIce = this.m.skaters.filter((s) => s.sideKey === pen.side).length;
    if (onIce > this.r.minSkaters) {
      entry.active = true;
      this.m.offIce(pen.offender);
      st[pen.side === 'home' ? 'away' : 'home'].ppOpp += 1;
    }
    this.m.events.push({ type: 'penalty', skater: pen.offender, side: pen.side, foul: pen.foul, seconds, major: pen.major });
  }

  onGoal(scorer) {
    const m = this.m;
    if (this.attempt) { this.endAttempt(true); return false; }
    // A goal by the side that was fouled cancels the delayed minor.
    if (this.pending && this.pending.side !== scorer) this.pending = null;
    // Power-play goal releases the earliest minor of the short-handed side.
    if (this.r.ppGoalEndsMinor) {
      const other = scorer === 'home' ? 'away' : 'home';
      const mine = m.skaters.filter((s) => s.sideKey === scorer).length;
      const theirs = m.skaters.filter((s) => s.sideKey === other).length;
      // Majors are always served in full.
      const pen = this.penaltiesOf(other).find((p) => !p.major);
      if (mine > theirs) m.stats[scorer].ppGoals += 1;
      if (pen && mine > theirs) this.release(pen);
    }
    if (this.phase === 'overtime' && this.r.overtime?.suddenDeath) {
      this.finish(scorer, 'OT');
      return true;
    }
    return false;
  }

  // ------------------------------------------------------------------ periods

  endPeriod() {
    const m = this.m;
    this.pending = null;
    const tied = m.score.home === m.score.away;
    if (this.phase === 'regulation' && this.period < this.r.periods) {
      this.breakThen(`END OF ${this.r.periodName} ${this.period}`, () => {
        this.period += 1;
        this.clock = this.r.periodSeconds;
        if (this.r.timeouts?.per === 'period') this.timeoutsLeft = { home: 1, away: 1 };
        for (const s of m.roster) s.fatigue = (s.fatigue ?? 0) * 0.3; // intermission
        if (this.r.switchEnds) m.switchEnds();
        m.faceoff();
      });
      return;
    }
    if (!tied) return this.finish(m.score.home > m.score.away ? 'home' : 'away', this.phase === 'overtime' ? 'OT' : '');
    if (this.phase === 'regulation' && this.r.overtime) {
      this.breakThen('OVERTIME', () => {
        this.phase = 'overtime';
        if (this.r.timeouts?.per === 'period') this.timeoutsLeft = { home: 1, away: 1 };
        this.clock = this.r.overtimeSeconds;
        if (this.r.overtime.switchEnds) m.switchEnds();
        m.faceoff();
      });
      return;
    }
    if (this.r.shootout) {
      this.breakThen('SHOOTOUT', () => this.startShootout());
      return;
    }
    this.finish(null, '');
  }

  breakThen(text, next) {
    const m = this.m;
    m.state = 'break';
    m.timer = 3;
    m.afterBreak = next;
    m.events.push({ type: 'break', text });
  }

  finish(winner, how) {
    const m = this.m;
    this.phase = 'final';
    this.result = { winner, how };
    m.state = 'final';
    m.events.push({ type: 'final', winner, how });
  }

  // ------------------------------------------------------------------ penalty shots & shootout

  whistleForPenaltyShot(shooter) {
    const m = this.m;
    m.state = 'whistle';
    m.timer = 1.4;
    m.nextSpot = null;
    m.afterWhistle = () => this.startAttempt(shooter, 'penaltyShot');
    m.events.push({ type: 'whistle', reason: 'PENALTY SHOT' });
  }

  startAttempt(shooter, kind) {
    const m = this.m;
    m.isolate(shooter);
    this.attempt = { shooter, side: shooter.sideKey, kind, t: ATTEMPT_TIME, shot: false };
    m.state = 'faceoff';
    m.timer = 1.0;
  }

  watchAttempt(dt) {
    const a = this.attempt, m = this.m, p = m.puck;
    a.t -= dt;
    if (p.shot) a.shot = true;
    const A = m.sides[a.side].attack;
    const loose = !p.carrier;
    const stalled = loose && (p.holder || (a.shot && !p.shot) || (p.speed < 0.6 && a.t < ATTEMPT_TIME - 1) || A * p.vel.x < -1);
    if (a.t <= 0 || stalled) this.endAttempt(false);
  }

  endAttempt(scored) {
    const m = this.m, a = this.attempt;
    this.attempt = null;
    m.events.push({ type: 'attempt', side: a.side, scored, kind: a.kind });
    m.restore();
    if (a.kind === 'shootout') {
      this.so.taken[a.side] += 1;
      if (scored) this.so.goals[a.side] += 1;
      this.so.log[a.side].push(scored);
      m.state = 'whistle';
      m.timer = 1.6;
      m.nextSpot = null;
      m.afterWhistle = () => this.nextShootoutAttempt();
      return;
    }
    // Penalty shot over: back to normal play from centre.
    m.state = 'whistle';
    m.timer = scored ? 2.4 : 1.4;
    m.nextSpot = { x: 0, y: 0 };
  }

  startShootout() {
    this.phase = 'shootout';
    const first = Math.random() < 0.5 ? 'home' : 'away'; // coin toss
    this.so = { rounds: this.r.shootout.rounds, first, taken: { home: 0, away: 0 }, goals: { home: 0, away: 0 }, log: { home: [], away: [] }, next: { home: 0, away: 0 } };
    this.nextShootoutAttempt();
  }

  /** Winner once the shootout can no longer be caught, then sudden death by pairs. */
  decided() {
    const { taken, goals, rounds } = this.so;
    if (taken.home <= rounds && taken.away <= rounds) {
      const left = (side) => rounds - taken[side];
      if (goals.home > goals.away + left('away')) return 'home';
      if (goals.away > goals.home + left('home')) return 'away';
      if (taken.home < rounds || taken.away < rounds) return null;
    }
    if (taken.home === taken.away && goals.home !== goals.away) return goals.home > goals.away ? 'home' : 'away';
    return null;
  }

  nextShootoutAttempt() {
    const m = this.m;
    const winner = this.decided();
    if (winner) {
      m.score[winner] += 1; // the shootout winner is credited one goal
      this.finish(winner, 'SO');
      return;
    }
    const other = (s) => (s === 'home' ? 'away' : 'home');
    const n = this.so.taken.home + this.so.taken.away;
    const round = Math.floor(n / 2);
    let lead = this.so.first;
    if (round >= this.so.rounds && this.r.shootout.reverseSuddenDeath) lead = other(lead);
    const side = n % 2 === 0 ? lead : other(lead);
    // Players with a penalty still running may not shoot.
    const roster = m.roster.filter((s) => s.sideKey === side && !this.box.some((b) => b.skater === s));
    const shooter = roster[this.so.next[side] % roster.length];
    this.so.next[side] += 1;
    this.startAttempt(shooter, 'shootout');
  }
}
