// The grove's rules (src/welt/baeume.js) and the player's step (src/welt/spieler.js): same data, same trees;
// trunks stop the player, canopies in front of the player are detected, shadows follow one light.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hain, ausweichen, verdeckt, schatten, streuung, LICHT } from '../src/welt/baeume.js';
import { schritt, TEMPO } from '../src/welt/spieler.js';

const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const frame = json('locations/boni/geo/rahmen.json');
const features = json('locations/boni/geo/baeume.geojson').features;
const arten = [{ id: 'world.a' }, { id: 'world.b' }];

test('grove: one tree per mapped tree, identical on every run and independent of input order', () => {
  const a = hain(features, frame, arten), b = hain([...features].reverse(), frame, arten);
  assert.equal(a.length, features.filter((f) => f.geometry.type === 'Point').length);
  assert.deepEqual(a, b);
  assert.ok(new Set(a.map((t) => t.art)).size === 2, 'both species are used');
  for (const t of a) { assert.ok(t.hoehe >= 9 && t.hoehe <= 16); assert.equal(t.hoeheQuelle, 'angenommen'); assert.ok(t.krone >= 2 && t.stamm >= 0.2); }
  assert.equal(streuung('node/1'), streuung('node/1'));
});

test('grove: a surveyed canopy height replaces the assumed one', () => {
  const [t] = hain(features.slice(0, 1), frame, arten, () => 17.4);
  assert.equal(t.hoehe, 17.4);
  assert.equal(t.hoeheQuelle, 'Oberflächenmodell');
});

test('collision: the player cannot stand inside a trunk or its roots, and slides round it', () => {
  const t = { ab: [0, 0], stamm: 0.4, krone: 4, hoehe: 12 };
  const [a, b] = ausweichen([0.1, 0.2], [t]);
  assert.ok(Math.hypot(a, b) >= 0.4 + 0.35 + 0.3 - 1e-9);
  assert.deepEqual(ausweichen([5, 5], [t]), [5, 5]);
  const z = { ab: [-3, 0.2], tasten: [1, 0], ziel: null, rechts: true, faehrt: false, phase: 0 };
  for (let i = 0; i < 120; i++) { schritt(z, 1 / 60, [t]); assert.ok(Math.hypot(...z.ab) >= 1.05 - 1e-6, 'inside the trunk'); }
  assert.ok(z.ab[0] > 3, 'got past the tree');                  // 2 s at 5.5 m/s, deflected but not stopped
  assert.ok(TEMPO > 0);
});

test('occlusion: a canopy hides what stands behind it in the camera direction, not beside or in front', () => {
  const t = { ab: [0, 0], krone: 4, hoehe: 12 }, blick = [0, 1];
  assert.equal(verdeckt([0, 5], t, blick), true);
  assert.equal(verdeckt([0, -5], t, blick), false);   // in front of the tree
  assert.equal(verdeckt([6, 5], t, blick), false);    // beside it
  assert.equal(verdeckt([0, 40], t, blick), false);   // far behind: the canopy no longer reaches
});

test('shadows: one light for all; on the aerial photo only a contact shadow, on drawn ground a cast shadow', () => {
  const t = { ab: [2, 3], krone: 4, hoehe: 12 };
  const foto = schatten(t, frame, true), gezeichnet = schatten(t, frame, false);
  assert.deepEqual(foto.mitte, t.ab);
  assert.ok(foto.deckung < gezeichnet.deckung);
  const wurf = Math.hypot(gezeichnet.mitte[0] - 2, gezeichnet.mitte[1] - 3);
  assert.ok(Math.abs(wurf - (12 * 0.6) / Math.tan((LICHT.hoehe * Math.PI) / 180)) < 1e-3);
  const other = schatten({ ab: [50, -20], krone: 3, hoehe: 9 }, frame, false);
  assert.ok(Math.abs(other.richtung[0] - gezeichnet.richtung[0]) < 1e-12 && Math.abs(other.richtung[1] - gezeichnet.richtung[1]) < 1e-12);
});
