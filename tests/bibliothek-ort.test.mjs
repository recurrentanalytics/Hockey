// Where the art library's sprites stand (src/welt/bibliothek.js): on their mapped points, but never on a carriageway.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fahrbahnen, vomFahrdamm, spots, usable } from '../src/welt/bibliothek.js';

const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

test('sprites: a point on a carriageway moves behind the nearest kerb; off it, it stays as mapped', () => {
  const strasse = [[[0, 0], [100, 0], [100, 8], [0, 8]]]; // a street 8 m wide, running east
  const mitte = [50, 3], neben = [50, 12];
  assert.equal(vomFahrdamm(neben, [strasse]), neben, 'on the pavement: the mapped point itself');
  assert.deepEqual(vomFahrdamm(mitte, [strasse]), [50, -0.7], 'from the carriageway to 0.7 m behind the nearer kerb');
  assert.deepEqual(vomFahrdamm([50, 5], [strasse]), [50, 8.7], 'the other kerb when that is nearer');
  // a house stands right behind the nearer kerb: the other side of the street
  const haus = [[40, -6], [60, -6], [60, -0.2], [40, -0.2]];
  assert.deepEqual(vomFahrdamm(mitte, [strasse], [haus]), [50, 8.7]);
  // houses behind both kerbs and no free spot within reach: left out
  const drueben = [[40, 8.2], [60, 8.2], [60, 14], [40, 14]];
  assert.equal(vomFahrdamm(mitte, [strasse], [haus, drueben], 0.7, 6), null);
  // a crossing: two carriageways side by side; the shared edge is no kerb
  const quer = [[[100, 0], [108, 0], [108, 8], [100, 8]]];
  const p = vomFahrdamm([99, 4], [strasse, quer]);
  assert.ok(p && (p[1] < 0 || p[1] > 8), `off both carriageways (${p})`);
  // an island in the street is ground like any other
  const mitInsel = [[[0, 0], [100, 0], [100, 8], [0, 8]], [[48, 3], [52, 3], [52, 5], [48, 5]]];
  assert.deepEqual(vomFahrdamm([50, 4], [mitInsel]), [50, 4], 'a point on the island stays');
});

test('sprites: in the real quarter nothing of the library stands on a carriageway or in a house', () => {
  const geo = { ausstattung: json('locations/boni/geo/ausstattung.geojson') }, frame = json('locations/boni/geo/rahmen.json');
  const bahn = fahrbahnen(json('locations/boni/geo/nutzung.geojson')), geb = json('locations/boni/geo/gebaeude.geojson');
  const ringe = geb.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((p) => p[0]));
  const imRing = ([x, y], ring) => { let d = false; for (let i = 0; i < ring.length; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length]; if ((y1 > y) !== (y2 > y) && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) d = !d; } return d; };
  assert.ok(bahn.length >= 10, `${bahn.length} carriageway polygons`);
  let bewegt = 0, stehen = 0, weg = 0;
  for (const asset of usable(json('assets/manifest.json'), false)) {
    if (!asset.place.layer || asset.place.layer === 'baeume') continue;
    for (const en of spots(asset, geo, frame)) {
      const p = vomFahrdamm(en, bahn, ringe);
      if (!p) { weg++; continue; }
      stehen++; if (p !== en) { bewegt++; assert.ok(Math.hypot(p[0] - en[0], p[1] - en[1]) <= 12.8, `${asset.id}: moved at most across a street`); }
      assert.ok(!bahn.some((v) => imRing(p, v[0]) && !v.slice(1).some((l) => imRing(p, l))), `${asset.id}: not on a carriageway`);
      if (p !== en) assert.ok(!ringe.some((r) => imRing(p, r)), `${asset.id}: not moved into a house`);
    }
  }
  assert.ok(bewegt > 40 && weg <= 3, `${bewegt} sprites moved off the carriageway, ${weg} left out, ${stehen} stand`);
});
