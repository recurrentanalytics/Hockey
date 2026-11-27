// Who is on the ice after the first face-off. The hall plays 4 on 4; the real Boni court is meant to be
// 3 on 3 (RinkScene: N = FIXED ? 3 : 4; the menu says "3 GEGEN 3").
import test from 'node:test';
import assert from 'node:assert/strict';
import { Match, resolveRules, seed } from './helpers/headless.mjs';

const lineup = (perLine, ruleset = 'worldskate') => {
  seed(7);
  const m = new Match({
    home: { team: 'blazers', skaters: perLine, lines: 2 }, away: { team: 'waves', skaters: perLine, lines: 2 },
    humans: [], ai: ['home', 'away'], rules: resolveRules(ruleset, 5),
  });
  const onIce = (k) => m.skaters.filter((s) => s.sideKey === k).length;
  return { roster: m.roster.filter((s) => s.sideKey === 'home').length, home: onIce('home'), away: onIce('away') };
};

for (const ruleset of ['worldskate', 'usars', 'ishd']) {
  test(`lineup: hall, ${ruleset}: 4 per line, 4 on the ice, 8 on the roster`, () => {
    assert.deepEqual(lineup(4, ruleset), { roster: 8, home: 4, away: 4 });
  });
}

// KNOWN BUG, found by the browser smoke test of test.html: with 3 per line the referee's strength cap (4)
// lets applyStrength() fetch a fourth skater from the bench at the first face-off, so the "3 on 3" court
// plays 4 on 4. Gameplay is not changed by the QA work; this TODO documents the intended behaviour.
for (const ruleset of ['worldskate', 'usars', 'ishd']) {
  test(`lineup: Boni court, ${ruleset}: 3 per line means 3 on the ice`, { todo: 'applyStrength() tops up to the ruleset strength of 4 (match.js)' }, () => {
    assert.deepEqual(lineup(3, ruleset), { roster: 6, home: 3, away: 3 });
  });
}
