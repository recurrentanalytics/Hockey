// The art library's front door (tools/assets/library.mjs) and the rule that puts its sprites into
// the world (src/welt/bibliothek.js): an asset is named, filed and placed by its manifest entry alone.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileFor, parsePlace, prepare } from '../tools/assets/library.mjs';
import { decodePng } from '../tools/assets/png.mjs';
import { spots, usable } from '../src/welt/bibliothek.js';

const json = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const picture = (w, h, fill) => { const data = new Uint8Array(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (fill(x, y)) data.set([200, 60, 40, 255], (y * w + x) * 4); return { width: w, height: h, data }; };

test('library: the id decides folder and file name', () => {
  assert.equal(fileFor('prop.bench'), 'props/bench.png');
  assert.equal(fileFor('world.bonifatiusplatz.plane-tree'), 'world/bonifatiusplatz/plane-tree.png');
  assert.throws(() => fileFor('bench'), /must start with/);
  assert.throws(() => fileFor('thing.bench'), /must start with/);
});

test('library: a picture is trimmed, stood on the bottom edge and entered as waiting', () => {
  const { png, entry } = prepare(picture(40, 40, (x, y) => x >= 10 && x < 21 && y >= 5 && y < 30), 'prop.bench', { height: '0.9', place: 'ausstattung:amenity=bench', asset: 'abc' });
  const out = decodePng(png);
  assert.deepEqual([out.width, out.height], [12, 26]);            // 11 x 25 of content, sides rounded up to even
  assert.ok(out.data[((out.height - 1) * out.width + 5) * 4 + 3]); // stands on the bottom row
  assert.deepEqual(entry.anchor, { x: 6, y: 25 });
  assert.deepEqual(entry.place, { layer: 'ausstattung', match: { amenity: 'bench' } });
  assert.equal(entry.approved, undefined);
  assert.equal(entry.file, 'props/bench.png');
});

test('library: placement options', () => {
  assert.deepEqual(parsePlace({ court: '1.3,0.7' }), { court: [1.3, 0.7] });
  assert.deepEqual(parsePlace({ place: 'baeume:natural=tree' }), { layer: 'baeume', match: { natural: 'tree' } });
  assert.equal(parsePlace({}), undefined);
});

test('world: sprites stand on the mapped objects their manifest entry names', () => {
  const frame = json('locations/boni/geo/rahmen.json');
  const geo = { baeume: json('locations/boni/geo/baeume.geojson'), ausstattung: json('locations/boni/geo/ausstattung.geojson') };
  const manifest = json('assets/manifest.json');
  const tree = manifest.assets.find((a) => a.id === 'world.bonifatiusplatz.plane-tree');
  const mapped = geo.baeume.features.filter((f) => f.geometry.type === 'Point').length;
  assert.equal(spots(tree, geo, frame).length, mapped);
  const [e, n] = spots({ place: { court: [0, 0] } }, geo, frame)[0];
  assert.deepEqual([e, n], frame.ursprung_utm32);
  const [e2, n2] = spots({ place: { court: [10, 0] } }, geo, frame)[0];
  assert.ok(Math.abs(Math.hypot(e2 - e, n2 - n) - 10) < 1e-4); // the frame's axes are stored to six decimals
  // waiting assets stay out unless the owner previews them
  const waiting = manifest.assets.filter((a) => !a.approved && a.place && a.worldHeight).length;
  assert.equal(usable(manifest, true).length - usable(manifest, false).length, waiting);
});
