// Wetterphysik auf dem Boni (src/game/surface.js): deterministische Sonden je Wetterlage.
// Ball rollt aus, Ball fällt und springt, Spieler fährt an, bremst, wendet, rutscht bei harten Wenden aus.
// 1. Die Wetterlagen müssen sich in die physikalisch erwartete Richtung unterscheiden.
// 2. Die genauen Werte müssen der Referenz tests/referenz/wetter.json entsprechen. Wer die Physik
//    absichtlich ändert, erneuert sie mit UPDATE_REFERENZ=1 npm test (und prüft den Unterschied im Diff).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import './helpers/boni.mjs';
import { Match, resolveRules, seed, DT } from './helpers/headless.mjs';

const { SURF, surfaceFor, setSurface } = await import('../src/game/surface.js');
const { Skater } = await import('../src/world/skater.js');
const { RINK, GOAL, SKATE } = await import('../src/config.js');

const WETTER = {
  trocken: { look: 'sun', temp: 18 },
  regen: { look: 'rain', temp: 12, amount: 2 },
  schnee: { look: 'snow', temp: -2, amount: 1 },
  glaette: { look: 'clouds', temp: -3 },
  hitze: { look: 'sun', temp: 32 },
  wind: { look: 'sun', temp: 15, wind: 10, windTo: { x: 1, y: 0 } },
};
const REF = new URL('./referenz/wetter.json', import.meta.url);
const r3 = (x) => Math.round(x * 1000) / 1000;

function sonden() {
  const m = new Match({
    home: { team: 'borstentiere', skaters: 3 }, away: { team: 'blazers', skaters: 3 },
    humans: [], ai: ['home', 'away'], rules: resolveRules('worldskate', 5), ball: true,   // the red ball, as on the Boni
  });
  m.skaters = []; m.goalies = [];          // the ball alone on the court
  const p = m.puck;
  const out = { feld: { laenge: RINK.length, breite: RINK.width, torlinie: RINK.goalLineX, tor: GOAL.width, eckradius: RINK.cornerRadius }, wetter: {} };
  for (const [name, w] of Object.entries(WETTER)) {
    setSurface(surfaceFor(w));
    seed(4711);
    const r = {};
    // ball rolls from the far side towards the camera at 5 m/s
    p.reset(0, -6); p.vel.y = 5;
    let t = 0;
    while ((p.speed > 0 || p.z > 0) && t < 20) { m.stepPuck(DT); t += DT; }
    r.ballWeg = r3(p.pos.y + 6); r.ballZeit = r3(t); r.ballDrift = r3(p.pos.x);
    // ball dropped from 1 m: highest rebound
    p.reset(0, 0); p.z = 1;
    let up = 0, prev = 1, rising = false;
    for (let i = 0; i < 240; i++) { m.stepPuck(DT); if (p.z > prev) rising = true; if (rising) up = Math.max(up, p.z); prev = p.z; }
    r.ballSprung = r3(up);
    // skater: start to 90 % of top speed, stop without input, reverse to 2 m/s the other way
    const s = new Skater({ team: 'blazers' });
    let k = 0;
    while (s.speed < SKATE.maxSpeed * 0.9 * SURF.speed && k < 600) { s.update(DT, { move: { x: 1, y: 0 } }); k++; }
    r.anfahrenS = r3(k * DT);
    const x0 = s.pos.x; k = 0;
    while (s.speed > 0.1 && k < 600) { s.update(DT, {}); k++; }
    r.bremswegM = r3(s.pos.x - x0);
    for (let i = 0; i < 90; i++) s.update(DT, { move: { x: 1, y: 0 } });
    k = 0;
    while (s.vel.x > -2 && k < 600) { s.update(DT, { move: { x: -1, y: 0 } }); k++; }
    r.wendenS = r3(k * DT);
    // 200 hard reversals at full speed: how often does the skater fall?
    let falls = 0;
    for (let n = 0; n < 200; n++) {
      const q = new Skater({ team: 'blazers' });
      for (let i = 0; i < 90; i++) q.update(DT, { move: { x: 1, y: 0 } });
      for (let i = 0; i < 30; i++) { q.update(DT, { move: { x: -1, y: 0 } }); if (q.slipped) { falls++; break; } }
    }
    r.stuerzeVon200 = falls;
    out.wetter[name] = r;
  }
  setSurface(surfaceFor({ look: 'sun', temp: 15 }));
  return out;
}

const werte = sonden();
const W = werte.wetter;

test('Boni-Maße kommen an (nicht die Halle)', () => {
  assert.deepEqual(werte.feld, { laenge: 22.8, breite: 17.2, torlinie: 9.2, tor: 1.37, eckradius: 1 });
});

test('Wetter wirkt in die erwartete Richtung', () => {
  assert.equal(W.trocken.stuerzeVon200, 0, 'trocken rutscht niemand aus');
  assert.ok(W.regen.ballWeg < W.trocken.ballWeg && W.schnee.ballWeg < W.regen.ballWeg, 'Ball rollt bei Regen kürzer, bei Schnee am kürzesten');
  assert.ok(W.regen.ballSprung < W.trocken.ballSprung && W.schnee.ballSprung < W.trocken.ballSprung, 'Ball springt bei Nässe und Schnee weniger');
  assert.ok(W.regen.stuerzeVon200 > 0 && W.glaette.stuerzeVon200 > W.regen.stuerzeVon200, 'Ausrutschen bei Regen, mehr bei Glätte');
  assert.ok(W.schnee.anfahrenS > W.trocken.anfahrenS, 'Anfahren dauert bei Schnee länger');
  assert.ok(W.glaette.bremswegM > W.trocken.bremswegM, 'Bremsweg bei Glätte länger');
  assert.ok(Math.abs(W.wind.ballDrift) > 0.01 && W.trocken.ballDrift === 0, 'Wind treibt den Ball seitlich ab');
});

test('Sondenwerte entsprechen der Referenz', (t) => {
  if (process.env.UPDATE_REFERENZ) { fs.writeFileSync(REF, JSON.stringify(werte, null, 1) + '\n'); t.diagnostic('Referenz neu geschrieben'); return; }
  const ref = JSON.parse(fs.readFileSync(REF, 'utf8'));
  assert.deepEqual(werte, ref, 'Physik hat sich geändert. Absichtlich? Dann UPDATE_REFERENZ=1 npm test');
});
