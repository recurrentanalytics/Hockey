// Regression: the DEAD PUCK whistle (safety net for an unplayable puck).
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, resolveRules, seed, run, openPlay, DT, INPUT } from './helpers/headless.mjs';

/** A full match with a referee. `ai: []` leaves every skater standing, so nobody plays the puck. */
function match({ ai = [], ruleset = 'worldskate' } = {}) {
  seed(11);
  return new Match({
    home: { team: 'blazers', skaters: 4 }, away: { team: 'waves', skaters: 4 },
    humans: [], ai, rules: resolveRules(ruleset, 5),
  });
}

/** Run and collect the reasons of every whistle. */
function whistles(m, seconds, until) {
  const out = [];
  run(m, seconds, () => {
    for (const e of m.events) if (e.type === 'whistle') out.push(e.reason);
    return until?.(m);
  });
  return out;
}

const SPOT = { x: 20, y: 14.9 }; // on the boards, away from every skater

test('a loose puck that rests for 5 s in open play is whistled dead', () => {
  const m = openPlay(match());
  m.puck.reset(SPOT.x, SPOT.y);
  assert.deepEqual(whistles(m, 4.9), [], 'not before 5 s');
  assert.deepEqual(whistles(m, 0.3), ['DEAD PUCK']);
  assert.equal(m.state, 'whistle');
  assert.deepEqual(m.nextSpot, { x: 19, y: 7 }, 'face-off at the nearest end-zone spot');
  // Play resumes with a normal face-off at that spot.
  run(m, 10, () => m.state === 'faceoff');
  assert.equal(m.state, 'faceoff');
  assert.deepEqual(m.draw.spot, { x: 19, y: 7 });
  run(m, 3, () => m.state === 'play');
  assert.equal(m.state, 'play');
});

test('a dead puck in the neutral zone is faced off at centre', () => {
  const m = openPlay(match());
  m.puck.reset(4, -14.9);
  assert.deepEqual(whistles(m, 5.2), ['DEAD PUCK']);
  assert.deepEqual(m.nextSpot, { x: 0, y: 0 });
});

test('the game clock keeps running until the whistle and stops with it', () => {
  const m = openPlay(match());
  m.puck.reset(SPOT.x, SPOT.y);
  const start = m.ref.clock;
  whistles(m, 6, () => m.state === 'whistle');
  const atWhistle = m.ref.clock;
  assert.ok(Math.abs(start - atWhistle - 5) < 0.1, `clock ran ${(start - atWhistle).toFixed(2)} s`);
  run(m, 1);
  assert.equal(m.ref.clock, atWhistle);
});

for (const state of ['faceoff', 'break', 'whistle', 'goal']) {
  test(`no dead-puck whistle while the game is stopped: ${state}`, () => {
    const m = match();
    m.puck.reset(SPOT.x, SPOT.y);
    m.state = state;
    m.timer = 60;       // hold the stoppage far longer than the dead-puck limit
    m.draw = null;
    assert.deepEqual(whistles(m, 12), []);
    assert.equal(m.state, state);
  });
}

test('no dead-puck whistle while a skater has the puck', () => {
  const m = openPlay(match());
  m.gainPossession(m.skaters[0]);
  assert.deepEqual(whistles(m, 12), []);
  assert.equal(m.state, 'play');
});

test('no dead-puck whistle while the puck is moving', () => {
  const m = openPlay(match());
  m.puck.reset(0, 10);
  // Keep the puck sliding: it never rests.
  const out = [];
  run(m, 12, () => { m.puck.vel.x = 3 * Math.sign(-m.puck.pos.x || 1); for (const e of m.events) if (e.type === 'whistle') out.push(e.reason); });
  assert.deepEqual(out, []);
});

test('no dead-puck whistle during a penalty shot', () => {
  const m = openPlay(match());
  const shooter = m.skaters.find((s) => s.sideKey === 'home');
  m.ref.startAttempt(shooter, 'penaltyShot');
  // Nobody controls the shooter: he stands with the puck until the attempt times out.
  const seen = whistles(m, 14, () => !m.ref.attempt && m.state === 'play');
  assert.ok(!seen.includes('DEAD PUCK'), `whistles: ${seen}`);
  assert.equal(m.ref.attempt, null);
  assert.equal(m.skaters.length, 8, 'everyone is back on the rink after the attempt');
});

test('no dead-puck whistle during a penalty shot even with the puck lying loose', () => {
  const m = openPlay(match());
  const shooter = m.skaters.find((s) => s.sideKey === 'home');
  m.ref.startAttempt(shooter, 'penaltyShot');
  run(m, 1.2, () => m.state === 'play');
  m.release(shooter);                 // puck dropped, motionless
  m.ref.attempt.t = 1e9;              // keep the attempt alive artificially
  const stalled = m.ref.watchAttempt; // silence the attempt's own stall rule for this check
  m.ref.watchAttempt = () => {};
  shooter.noPickup = 1e9;
  assert.deepEqual(whistles(m, 12), []);
  assert.ok(m.ref.attempt, 'the attempt is still running');
  assert.equal(m.state, 'play');
  m.ref.watchAttempt = stalled;
});

test('no dead-puck whistle during a shootout', () => {
  for (const ruleset of ['worldskate', 'usars', 'ishd']) {
    const m = openPlay(match({ ai: ['home', 'away'], ruleset }));
    m.ref.startShootout();
    const seen = whistles(m, 600, () => m.state === 'final');
    assert.equal(m.state, 'final', `${ruleset}: shootout finishes`);
    assert.ok(!seen.includes('DEAD PUCK'), `${ruleset}: ${seen}`);
  }
});

test('a dead-puck whistle assesses a delayed penalty exactly once', () => {
  const m = openPlay(match());
  const offender = m.skaters.find((s) => s.sideKey === 'away');
  m.puck.reset(SPOT.x, SPOT.y);
  m.ref.pending = { offender, side: 'away', foul: 'TRIPPING', major: false };
  assert.deepEqual(whistles(m, 5.2), ['DEAD PUCK']);
  assert.equal(m.ref.pending, null);
  assert.equal(m.ref.box.length, 1);
  assert.equal(m.ref.box[0].skater, offender);
  assert.ok(offender.offIce);
  // Face-off in the offending team's end, as after any penalty.
  assert.equal(Math.sign(m.nextSpot.x), -m.sides.away.attack);
  const t = m.ref.box[0].t;
  run(m, 10, () => m.state === 'play');
  assert.equal(m.state, 'play');
  assert.equal(m.ref.box.length, 1, 'still one penalty');
  assert.equal(m.ref.box[0].t, t, 'penalty time does not run during the stoppage');
  assert.equal(m.skaters.filter((s) => s.sideKey === 'away').length, 3);
});

test('a dead-puck whistle leaves a running penalty untouched', () => {
  const m = openPlay(match());
  const offender = m.skaters.find((s) => s.sideKey === 'home');
  m.ref.assess({ offender, side: 'home', foul: 'SLASHING', major: false });
  const entry = m.ref.box[0];
  const total = entry.t;
  m.puck.reset(SPOT.x, SPOT.y);
  assert.deepEqual(whistles(m, 5.2), ['DEAD PUCK']);
  assert.equal(m.ref.box.length, 1);
  assert.equal(m.ref.box[0], entry);
  assert.ok(entry.active);
  assert.ok(Math.abs(total - entry.t - 5) < 0.1, 'the penalty ran only while play was live');
  assert.equal(m.score.home + m.score.away, 0);
});

test('the timer restarts after every interruption', () => {
  const m = openPlay(match());
  m.puck.reset(SPOT.x, SPOT.y);
  assert.deepEqual(whistles(m, 4), []);
  m.puck.vel.x = -2;                 // somebody moves it
  assert.deepEqual(whistles(m, 0.1), []);
  m.puck.vel.x = 0; m.puck.vel.y = 0;
  assert.deepEqual(whistles(m, 4.5), [], 'counts from zero again');
  assert.deepEqual(whistles(m, 0.7), ['DEAD PUCK']);
});

test('only one whistle per dead puck', () => {
  const m = openPlay(match());
  m.puck.reset(SPOT.x, SPOT.y);
  let n = 0;
  for (let i = 0; i < 20 / DT; i++) {
    m.update(DT, INPUT);
    n += m.events.filter((e) => e.type === 'whistle').length;
    if (m.state === 'faceoff') break;
  }
  assert.equal(n, 1);
});
