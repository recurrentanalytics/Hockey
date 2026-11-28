// The place description of the Boni (locations/boni/ort.js, Roadmap 0.6): one source for its numbers and references.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import ORT from '../locations/boni/ort.js';

const ORDNER = 'locations/boni';

test('place: every file the description points to exists', () => {
  for (const [name, pfad] of Object.entries({ rahmen: ORT.geo.rahmen, ...ORT.daten })) assert.ok(fs.existsSync(path.join(ORDNER, pfad)), `${name}: ${pfad}`);
});

test('place: the tools see the same corners and camera as the game (tools/ort/boni.json)', () => {
  const werkzeug = JSON.parse(fs.readFileSync('tools/ort/boni.json', 'utf8'));
  assert.deepEqual(ORT.geo.ecken_wgs84, werkzeug.ecken_wgs84);
  assert.equal(ORT.blick.richtung, werkzeug.geodaten.erwartet.blickrichtung_grad);
  assert.deepEqual([ORT.zaun.breite, ORT.zaun.laenge], [werkzeug.geodaten.erwartet.quer_m, werkzeug.geodaten.erwartet.laengs_m]);
});

test('place: the court of the game is the court of the place', async () => {
  globalThis.BONI_3D = true; // as the world view sets it before loading the game
  const { RINK, GOAL } = await import(`../src/config.js?boni=${Date.now()}`);
  const F = ORT.spielflaeche.inline;
  assert.deepEqual([RINK.length, RINK.width, RINK.goalLineX, RINK.cornerRadius], [F.laenge, F.breite, F.torlinie, F.eckradius]);
  assert.deepEqual([GOAL.width, GOAL.height, GOAL.depth], [F.tor.breite, F.tor.hoehe, F.tor.tiefe]);
  assert.ok(F.laenge < ORT.zaun.laenge && F.breite <= ORT.zaun.breite, 'the court lies inside the fence');
});

test('place: Python reads the same description (tools/ort/ort.py)', () => {
  const py = JSON.parse(execFileSync('python3', ['tools/ort/ort.py', 'boni'], { encoding: 'utf8' }));
  assert.deepEqual(py, JSON.parse(JSON.stringify(ORT)));
});
