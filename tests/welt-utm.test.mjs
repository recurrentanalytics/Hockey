// The world view (welt.html) places the Phase 1 geodata on the globe with src/welt/utm.js.
// It has to agree with the Python projection the data was built with (tools/ort/utm.py).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { toUtm32, fromUtm32 } from '../src/welt/utm.js';

const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

test('world view: the JavaScript projection matches the pipeline at the court', () => {
  const corners = json('tools/ort/boni.json').ecken_wgs84;
  const built = Object.fromEntries(json('locations/boni/geo/platz.geojson').features.filter((f) => f.properties.art === 'ecke').map((f) => [f.properties.name, f.geometry.coordinates]));
  for (const [name, [lon, lat]] of Object.entries(corners)) {
    const [e, n] = toUtm32(lon, lat);
    assert.ok(Math.hypot(e - built[name][0], n - built[name][1]) < 0.01, `corner ${name} is off by more than a centimetre`);
  }
});

test('world view: grid → globe → grid returns to the same millimetre across the area', () => {
  const [w, s, e, n] = json('locations/boni/geo/rahmen.json').ausschnitt_utm32;
  for (const p of [[w, s], [e, s], [e, n], [w, n], [(w + e) / 2, (s + n) / 2]]) {
    const back = toUtm32(...fromUtm32(...p));
    assert.ok(Math.hypot(back[0] - p[0], back[1] - p[1]) < 0.001);
  }
});
