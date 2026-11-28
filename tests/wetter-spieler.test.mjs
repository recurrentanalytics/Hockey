// Weather for goalies and passes (src/game/surface.js): passes are played firmer where the court brakes the
// ball, so they still arrive; goalies push off slower and misread more on wet, snowy or icy ground.
import test from 'node:test';
import assert from 'node:assert/strict';
import './helpers/boni.mjs';
import { Match, resolveRules, seed, DT } from './helpers/headless.mjs';

const { surfaceFor, setSurface } = await import('../src/game/surface.js');
const { Goalie } = await import('../src/game/goalie.js');

const WETTER = {
  trocken: { look: 'sun', temp: 18 }, regen: { look: 'rain', temp: 12, amount: 2 }, schnee: { look: 'snow', temp: -2, amount: 1 },
  glaette: { look: 'clouds', temp: -3 }, laub: { look: 'rain', temp: 9, leaves: 0.8, amount: 1 },
};

/** A pass of `dist` metres to a standing teammate: how far the ball gets and how fast it is there. */
function pass(dist) {
  const m = new Match({ home: { team: 'borstentiere', skaters: 2 }, away: { team: 'blazers', skaters: 2 }, humans: [], ai: [], rules: resolveRules('worldskate', 5), ball: true });
  m.goalies = [];
  const [a, b] = m.skaters.filter((s) => s.sideKey === 'home');
  m.skaters = [a, b];
  // across the court at centre ice, away from goals and boards
  a.pos.x = 0; a.pos.y = -dist / 2; a.dir = Math.PI / 2; a.vel.x = a.vel.y = 0;
  b.pos.x = 0; b.pos.y = dist / 2; b.vel.x = b.vel.y = 0;
  const p = m.puck; p.reset(0, a.pos.y); p.carrier = a; a.hasPuck = true;
  m.pass(a);
  let t = 0;
  do { m.stepPuck(DT); t += DT; } while (p.speed > 0.05 && p.pos.y < b.pos.y - 1 && t < 10); // a metre before the receiver
  return { weg: p.pos.y - a.pos.y + 1, tempo: p.speed };
}

/** How far a goalie gets across in 0.35 s towards a shot heading for the post (m). */
function seitwaerts() {
  const g = new Goalie({ team: 'blazers', side: -1, sideKey: 'home' });
  const shot = { loose: true, pos: { x: g.pos.x + 6, y: 0.6 }, vel: { x: -14, y: 0 }, z: 0, vz: 0, shot: { charge: 1, dist: 6 } };
  let t = 0;
  while (t < 0.35) { g.update(DT, shot); t += DT; }
  return Math.abs(g.pos.y); // how far across in the first 0.35 s
}

test('weather: a 12 m pass arrives about as fast in every weather, because it is played firmer where the court brakes the ball', () => {
  const tempo = {};
  for (const [name, w] of Object.entries(WETTER)) {
    setSurface(surfaceFor(w)); seed(7);
    const r = pass(12);
    assert.ok(r.weg >= 11.9, `${name}: the pass arrives (${r.weg.toFixed(1)} m)`);
    tempo[name] = r.tempo;
  }
  setSurface(surfaceFor({}));
  for (const name of Object.keys(WETTER)) assert.ok(tempo[name] >= 0.9 * tempo.trocken, `${name}: ${tempo[name].toFixed(1)} m/s at the receiver, dry ${tempo.trocken.toFixed(1)}`);
});

test('weather: goalies slide across slower on snow, ice and a wet court than on a dry one', () => {
  const zeit = {};
  for (const [name, w] of Object.entries(WETTER)) { setSurface(surfaceFor(w)); seed(7); zeit[name] = seitwaerts(); }
  setSurface(surfaceFor({}));
  for (const name of ['regen', 'schnee', 'glaette']) assert.ok(zeit[name] < zeit.trocken, `${name} ${zeit[name].toFixed(2)} m vs dry ${zeit.trocken.toFixed(2)} m`);
  assert.ok(zeit.schnee < zeit.regen, 'snow is the slowest push');
});
