// Regression: seeded AI-vs-AI matches across all rulesets and difficulty levels.
// Every match must finish, stay numerically sane and never leave the puck dead for long.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, resolveRules, seed, DT, INPUT, puckResting } from './helpers/headless.mjs';

const GAMES = Number(process.env.SIM_GAMES ?? 36);
const MAX_REST = 6;          // seconds; the dead-puck whistle comes at 5
const RULESETS = ['worldskate', 'usars', 'ishd'];
const LEVELS = ['easy', 'normal', 'hard'];

test(`${GAMES} seeded AI matches: all finish, no dead puck beyond ${MAX_REST} s`, () => {
  const sum = { goals: 0, shots: 0, playMin: 0, restSpells: 0, longestRest: 0, deadWhistles: 0 };
  for (let g = 0; g < GAMES; g++) {
    seed(1000 + g);
    const ruleset = RULESETS[Math.floor(g / 3) % 3], difficulty = LEVELS[g % 3];
    const tag = `game ${g} (${ruleset}/${difficulty}, seed ${1000 + g})`;
    const m = new Match({
      home: { team: 'blazers', skaters: 4 }, away: { team: 'waves', skaters: 4 },
      humans: [], ai: ['home', 'away'], difficulty, rules: resolveRules(ruleset, 5),
    });
    let rest = 0, steps = 0;
    const endRest = () => {
      if (rest * DT > 4) { sum.restSpells++; sum.longestRest = Math.max(sum.longestRest, rest * DT); }
      rest = 0;
    };
    while (m.state !== 'final' && steps < 40 * 60 * 60) {
      m.update(DT, INPUT);
      steps++;
      if (m.state === 'play') sum.playMin += DT / 60;
      for (const e of m.events) if (e.type === 'whistle' && e.reason === 'DEAD PUCK') sum.deadWhistles++;
      const p = m.puck;
      const nums = [p.pos.x, p.pos.y, p.z, p.vel.x, p.vel.y, ...m.roster.flatMap((s) => [s.pos.x, s.pos.y, s.vel.x, s.vel.y])];
      assert.ok(nums.every(Number.isFinite), `${tag}: non-finite position or speed at step ${steps}`);
      if (puckResting(m)) {
        rest++;
        assert.ok(rest * DT <= MAX_REST, `${tag}: puck dead for more than ${MAX_REST} s at (${p.pos.x.toFixed(2)}, ${p.pos.y.toFixed(2)})`);
      } else endRest();
    }
    endRest();
    assert.equal(m.state, 'final', `${tag}: match did not finish`);
    assert.ok(m.ref.result, `${tag}: no result`);
    sum.goals += m.score.home + m.score.away;
    sum.shots += m.shots.home + m.shots.away;
  }
  const per = (n) => (n / GAMES).toFixed(2);
  console.log(`simulation: ${GAMES} games, ${sum.playMin.toFixed(0)} min of play, goals/game ${per(sum.goals)}, shots/game ${per(sum.shots)}, ` +
    `rest spells >4 s: ${sum.restSpells} (longest ${sum.longestRest.toFixed(1)} s), dead-puck whistles: ${sum.deadWhistles}`);
  // Sanity corridor around today's balance (about 7.5 goals and 42 shots per game).
  assert.ok(sum.goals / GAMES > 4 && sum.goals / GAMES < 12, `goals per game ${per(sum.goals)}`);
  assert.ok(sum.shots / GAMES > 25 && sum.shots / GAMES < 60, `shots per game ${per(sum.shots)}`);
});
