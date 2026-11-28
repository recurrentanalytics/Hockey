#!/usr/bin/env node
// Reproducible balance report: seeded AI-vs-AI matches, headless, and what happens in them.
// It only measures; it never changes the game.
//
//   node tools/test/balance.mjs [--games 36] [--periods 5] [--seed 1000] [--ruleset all|worldskate|usars|ishd]
//                               [--level all|easy|normal|hard] [--skaters 4] [--home blazers] [--away waves]
//                               [--root <dir holding src/>] [--json]
//
// --root points at another checkout's src/ (e.g. an old commit unpacked with `git archive`), so the same
// numbers can be compared across the history. Games use the same seeds as tests/simulation.test.mjs.
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith('--') ? [...a, [v.slice(2), all[i + 1]?.startsWith('--') || all[i + 1] === undefined ? true : all[i + 1]]] : a), []));
const GAMES = Number(args.games ?? 36), PERIODS = Number(args.periods ?? 5), SEED = Number(args.seed ?? 1000), SKATERS = Number(args.skaters ?? 4);
const HOME = args.home ?? 'blazers', AWAY = args.away ?? 'waves';
const ALL_RULES = ['worldskate', 'usars', 'ishd'], ALL_LEVELS = ['easy', 'normal', 'hard'];
const RULES = args.ruleset && args.ruleset !== 'all' ? [args.ruleset] : ALL_RULES;
const LEVELS = args.level && args.level !== 'all' ? [args.level] : ALL_LEVELS;
const ROOT = path.resolve(args.root ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const DT = 1 / 60;

// canvas/DOM stand-ins (as in tests/helpers/headless.mjs) and a seedable Math.random (mulberry32)
const noop = () => {};
const pixels = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h) * 4) });
const calls = { getImageData: (x, y, w, h) => pixels(w, h), createImageData: (w, h) => pixels(w, h), measureText: () => ({ width: 0 }) };
const ctx = new Proxy({}, { get: (_, k) => calls[k] ?? noop, set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
globalThis.window ??= { addEventListener: noop };
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } };
globalThis.localStorage ??= { getItem: () => null, setItem: noop };
let rng = 1;
Math.random = () => { rng = (rng + 0x6D2B79F5) | 0; let t = Math.imul(rng ^ (rng >>> 15), 1 | rng); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

const load = (f) => import(pathToFileURL(path.join(ROOT, f)).href);
const { Match } = await load('src/game/match.js');
const { resolveRules } = await load('src/game/rules.js');
const INPUT = { controller: () => null };

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))); };
const BINS = [[0, 6], [6, 10], [10, 14], [14, 99]];

function playGame(g) {
  const ruleset = RULES[Math.floor(g / 3) % RULES.length], level = LEVELS[g % LEVELS.length];
  rng = (SEED + g) | 0;
  const m = new Match({
    home: { team: HOME, skaters: SKATERS }, away: { team: AWAY, skaters: SKATERS },
    humans: [], ai: ['home', 'away'], difficulty: level, rules: resolveRules(ruleset, PERIODS),
  });
  const r = { ruleset, level, goals: 0, attempts: 0, onGoal: 0, saves: 0, passes: 0, passDone: 0, steals: 0, hits: 0, penalties: 0, whistles: {}, posts: 0,
    playS: 0, totalS: 0, shotDist: [], goalDist: [] };
  let lastShot = null, lastPass = null;
  for (let steps = 0; m.state !== 'final' && steps < 40 * 60 * 60; steps++) {
    m.update(DT, INPUT);
    r.totalS += DT;
    if (m.state === 'play') r.playS += DT;
    for (const e of m.events) {
      if (e.type === 'shot') { r.attempts++; lastShot = { dist: m.puck.shot?.dist ?? null, t: r.totalS }; if (lastShot.dist != null) r.shotDist.push(lastShot.dist); }
      else if (e.type === 'save') { r.saves++; r.onGoal++; }
      else if (e.type === 'goal' && !e.shootout) { r.goals++; r.onGoal++; if (lastShot && r.totalS - lastShot.t < 4 && lastShot.dist != null) r.goalDist.push(lastShot.dist); }
      else if (e.type === 'pass') { r.passes++; lastPass = { side: e.by.sideKey, t: r.totalS }; }
      else if (e.type === 'pickup') { if (lastPass && r.totalS - lastPass.t < 4) { if (e.side === lastPass.side) r.passDone++; lastPass = null; } }
      else if (e.type === 'steal') r.steals++;
      else if (e.type === 'hit') r.hits++;
      else if (e.type === 'penalty') r.penalties++;
      else if (e.type === 'post') r.posts++;
      else if (e.type === 'whistle') r.whistles[e.reason] = (r.whistles[e.reason] ?? 0) + 1;
    }
  }
  r.finished = m.state === 'final';
  r.how = m.ref?.result?.how ?? '';
  return r;
}

const t0 = Date.now();
const games = Array.from({ length: GAMES }, (_, g) => playGame(g));
const sum = (k, rows = games) => rows.reduce((a, r) => a + r[k], 0);

function block(rows) {
  const playMin = sum('playS', rows) / 60, n = rows.length;
  const goals = rows.map((r) => r.goals);
  return {
    games: n, playMinPerGame: playMin / n, goalsPerGame: mean(goals), goalsSd: sd(goals), goalsSe: sd(goals) / Math.sqrt(n),
    goalsPer10Play: (sum('goals', rows) / playMin) * 10, shotsOnGoalPerGame: sum('onGoal', rows) / n, attemptsPerGame: sum('attempts', rows) / n,
    conversion: sum('goals', rows) / (sum('onGoal', rows) || 1), savePct: sum('saves', rows) / ((sum('saves', rows) + sum('goals', rows)) || 1),
    passCompletion: sum('passDone', rows) / (sum('passes', rows) || 1), passesPerGame: sum('passes', rows) / n,
    stealsPerGame: sum('steals', rows) / n, hitsPerGame: sum('hits', rows) / n, penaltiesPerGame: sum('penalties', rows) / n, postsPerGame: sum('posts', rows) / n,
    playShare: sum('playS', rows) / (sum('totalS', rows) || 1), unfinished: rows.filter((r) => !r.finished).length,
  };
}
const groupBy = (key) => Object.fromEntries([...new Set(games.map((r) => r[key]))].map((k) => [k, block(games.filter((r) => r[key] === k))]));
const dist = BINS.map(([a, b]) => {
  const shots = games.flatMap((r) => r.shotDist).filter((d) => d >= a && d < b).length, goals = games.flatMap((r) => r.goalDist).filter((d) => d >= a && d < b).length;
  return { range: `${a}-${b === 99 ? '+' : b} m`, shots, goals, goalsPerShot: goals / (shots || 1) };
});
const report = { root: ROOT, games: GAMES, periodsMinutes: PERIODS, seedStart: SEED, skaters: SKATERS, teams: [HOME, AWAY], seconds: (Date.now() - t0) / 1000,
  overall: block(games), byRuleset: groupBy('ruleset'), byLevel: groupBy('level'), shotDistance: dist,
  endings: games.reduce((a, r) => ({ ...a, [r.how || 'regulation']: (a[r.how || 'regulation'] ?? 0) + 1 }), {}),
  whistles: games.reduce((a, r) => { for (const [k, v] of Object.entries(r.whistles)) a[k] = (a[k] ?? 0) + v; return a; }, {}) };

if (args.json) { console.log(JSON.stringify(report, null, 2)); process.exit(0); }
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const row = (name, b) => `${name.padEnd(11)} ${String(b.games).padStart(3)}  ${f(b.playMinPerGame, 1).padStart(5)}  ${f(b.goalsPerGame).padStart(5)} ±${f(b.goalsSe).padStart(4)}  ${f(b.goalsPer10Play).padStart(5)}  ${f(b.shotsOnGoalPerGame, 1).padStart(5)}  ${f(b.conversion * 100, 1).padStart(5)}%  ${f(b.savePct * 100, 1).padStart(5)}%  ${f(b.passCompletion * 100, 0).padStart(4)}%  ${f(b.penaltiesPerGame, 1).padStart(4)}`;
console.log(`Balance report: ${GAMES} seeded games (seed ${SEED}+), ${SKATERS} skaters, ${HOME} vs ${AWAY}, periods ${PERIODS} min, root ${ROOT}`);
console.log(`node ${process.version}, ${f(report.seconds, 0)} s\n`);
console.log('group        n   play   goals/game (±se)  g/10min  SoG/g   conv.   save%   pass   pen/g');
console.log(row('overall', report.overall));
for (const [k, b] of Object.entries(report.byRuleset)) console.log(row(k, b));
for (const [k, b] of Object.entries(report.byLevel)) console.log(row(k, b));
console.log('\nshot distance (m)   shots  goals  goals/shot');
for (const d of dist) console.log(`${d.range.padEnd(16)} ${String(d.shots).padStart(7)} ${String(d.goals).padStart(6)}  ${f(d.goalsPerShot, 3)}`);
console.log(`\nattempts/game ${f(report.overall.attemptsPerGame, 1)}, posts/game ${f(report.overall.postsPerGame, 1)}, steals/game ${f(report.overall.stealsPerGame, 1)}, hits/game ${f(report.overall.hitsPerGame, 1)}, passes/game ${f(report.overall.passesPerGame, 1)}`);
console.log(`play share of the clock ${f(report.overall.playShare * 100, 0)}%, unfinished games ${report.overall.unfinished}`);
console.log(`endings ${JSON.stringify(report.endings)}, whistles ${JSON.stringify(report.whistles)}`);
