// Regression: AI skaters must be able to collect a puck resting against the boards.
//
// The bug: the chasers of both teams skated to a point a metre inside the boards instead of
// to the puck, met there head-on and pinned each other, sticks pointing along the boards.
// Neither blade reached the puck, so it lay dead, sometimes for minutes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, seed, run, openPlay } from './helpers/headless.mjs';

// tx/ty: direction along the boards at that spot; nx/ny: direction into the rink.
const D = Math.SQRT1_2;
const SPOTS = [
  { name: 'far side board',            x: 0, y: -14.9,        tx: 1, ty: 0,  nx: 0, ny: 1 },
  { name: 'near side board',           x: 0, y: 14.9,         tx: 1, ty: 0,  nx: 0, ny: -1 },
  { name: 'near side board, end zone', x: -17, y: 14.9,       tx: 1, ty: 0,  nx: 0, ny: -1 },
  { name: 'end board',                 x: 29.9, y: 5.5,       tx: 0, ty: 1,  nx: -1, ny: 0 },
  { name: 'corner',                    x: 27.73, y: 12.73,    tx: D, ty: -D, nx: -D, ny: -D },
  { name: 'opposite corner',           x: -27.73, y: -12.73,  tx: D, ty: -D, nx: D, ny: D },
];
// One chaser per team, already at the puck and facing each other along the boards.
// Offsets are in metres from the puck: `along` the boards, `inward` into the rink.
// The first pairing is the stand-off recorded in a simulated match (ISHD, hard, seed 1008).
const STANDOFFS = [
  [{ along: -0.41, inward: 0.69 }, { along: 0.30, inward: 1.05 }],
  [{ along: -0.45, inward: 0.9 },  { along: 0.45, inward: 0.9 }],
  [{ along: -0.9, inward: 0.9 },   { along: 0.9, inward: 0.9 }],
  [{ along: -1.5, inward: 0.9 },   { along: 1.5, inward: 0.9 }],
  [{ along: 0.70, inward: 1.25 },  { along: -0.01, inward: 0.89 }],
];

for (const spot of SPOTS) {
  test(`two opposing AI chasers do not strand a puck on the boards: ${spot.name}`, () => {
    const failed = [];
    STANDOFFS.forEach((pair, i) => {
      seed(7 + i);
      // No referee: this checks the AI itself, not the dead-puck whistle.
      const m = openPlay(new Match({
        home: { team: 'blazers', skaters: 1 }, away: { team: 'waves', skaters: 1 },
        humans: [], ai: ['home', 'away'], rules: null,
      }));
      m.puck.reset(spot.x, spot.y);
      const along = Math.atan2(spot.ty, spot.tx);
      m.skaters.forEach((s, k) => {
        const o = pair[k];
        // Each faces the other one, i.e. along the boards and away from the puck.
        s.place(spot.x + spot.tx * o.along + spot.nx * o.inward, spot.y + spot.ty * o.along + spot.ny * o.inward,
          o.along < pair[1 - k].along ? along : along + Math.PI);
      });
      if (!run(m, 6, () => !!m.puck.carrier)) {
        failed.push(`stand-off ${i}: skaters end at ` + m.skaters.map((s) => `(${s.pos.x.toFixed(2)}, ${s.pos.y.toFixed(2)})`).join(' and '));
      }
    });
    assert.deepEqual(failed, [], `puck not collected within 6 s in ${failed.length} of ${STANDOFFS.length} stand-offs`);
  });
}

test('a lone AI skater collects a puck on the boards from any direction', () => {
  const failed = [];
  for (const spot of SPOTS) {
    for (let k = 0; k < 8; k++) {
      seed(40 + k);
      const m = openPlay(new Match({
        home: { team: 'blazers', skaters: 1 }, away: { team: 'waves', skaters: 0 },
        humans: [], ai: ['home'], rules: null,
      }));
      const s = m.skaters[0];
      m.puck.reset(spot.x, spot.y);
      // Starts beyond the boards are pushed back onto the rink by the first step.
      s.place(spot.x + 6 * Math.cos(k * Math.PI / 4), spot.y + 6 * Math.sin(k * Math.PI / 4), k);
      if (!run(m, 5, () => m.puck.carrier === s)) failed.push(`${spot.name}, start direction ${k * 45}°`);
    }
  }
  assert.deepEqual(failed, []);
});
