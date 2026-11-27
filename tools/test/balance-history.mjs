#!/usr/bin/env node
// Runs tools/test/balance.mjs against the game as it was at several commits and prints one comparison
// table, to find when a balance number moved. Nothing in the working tree is touched: every commit's
// src/ is unpacked with `git archive` into the temp folder.
//
//   node tools/test/balance-history.mjs [--games 18] [--jobs 4] <commit> <commit> ...
//   node tools/test/balance-history.mjs --games 18 1733f5b 2b32f8c HEAD
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2), opt = {}, commits = [];
for (let i = 0; i < argv.length; i++) argv[i].startsWith('--') ? (opt[argv[i].slice(2)] = argv[++i]) : commits.push(argv[i]);
const GAMES = opt.games ?? '18', JOBS = Number(opt.jobs ?? 4);
const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BALANCE = path.join(REPO, 'tools/test/balance.mjs');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'borstenboom-balance-'));
const git = (...a) => execFileSync('git', a, { cwd: REPO, encoding: 'utf8' }).trim();

function unpack(rev) {
  const sha = git('rev-parse', '--short=7', rev), dir = path.join(TMP, sha);
  fs.mkdirSync(dir, { recursive: true });
  const tar = execFileSync('git', ['archive', '--format=tar', rev, 'src'], { cwd: REPO, maxBuffer: 1 << 28 });
  execFileSync('tar', ['-x', '-C', dir], { input: tar });
  return { rev, sha, dir, subject: git('log', '-1', '--format=%ad %s', '--date=short', rev).slice(0, 70) };
}

const run = (c) => new Promise((resolve) => {
  const p = spawn(process.execPath, [BALANCE, '--root', c.dir, '--games', GAMES, '--json'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = '', err = '';
  p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
  p.on('close', (code) => { try { resolve({ ...c, report: JSON.parse(out) }); } catch { resolve({ ...c, error: (err || out).split('\n').filter((l) => /Error|Cannot|SyntaxError/.test(l))[0] ?? `exit ${code}` }); } });
});

const units = commits.map(unpack), results = [], queue = [...units];
await Promise.all(Array.from({ length: Math.min(JOBS, units.length) }, async () => { while (queue.length) results.push(await run(queue.shift())); }));
results.sort((a, b) => units.findIndex((u) => u.sha === a.sha) - units.findIndex((u) => u.sha === b.sha));

const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
console.log(`balance across commits: ${GAMES} seeded games each (same seeds), arena rink\n`);
console.log('commit   goals/g  ±se   g/10min  SoG/g  conv.   save%  pass  | change');
for (const r of results) {
  if (r.error) { console.log(`${r.sha}  could not run: ${r.error}   | ${r.subject}`); continue; }
  const o = r.report.overall;
  console.log(`${r.sha}  ${f(o.goalsPerGame).padStart(6)} ${f(o.goalsSe).padStart(5)}  ${f(o.goalsPer10Play).padStart(6)}  ${f(o.shotsOnGoalPerGame, 1).padStart(5)}  ${f(o.conversion * 100, 1).padStart(5)}%  ${f(o.savePct * 100, 1).padStart(5)}%  ${f(o.passCompletion * 100, 0).padStart(3)}%  | ${r.subject}`);
}
fs.rmSync(TMP, { recursive: true, force: true });
