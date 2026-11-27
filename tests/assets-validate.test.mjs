// The asset validator (tools/assets/validate.mjs) on small synthetic sprites.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validate } from '../tools/assets/validate.mjs';
import { encodePng, decodePng } from '../tools/assets/png.mjs';

const W = 8, H = 10;
/** A strip of `frames` frames, each a 4x6 block standing on row `bottom[f]`. */
function strip(frames = 1, { bottom = [], alpha = 255, background = 0, empty = -1, colors = 2 } = {}) {
  const px = new Uint8Array(W * frames * H * 4);
  for (let i = 0; i < px.length; i += 4) { px[i] = 250; px[i + 1] = 0; px[i + 2] = 250; px[i + 3] = background; }
  for (let f = 0; f < frames; f++) {
    if (f === empty) continue;
    const b = bottom[f] ?? H - 1;
    for (let y = b - 5; y <= b; y++) for (let x = 2; x < 6; x++) {
      const i = (y * W * frames + f * W + x) * 4, c = (x + y * 4) % colors;
      px[i] = 40 + c * 3; px[i + 1] = 30 + c; px[i + 2] = 20; px[i + 3] = alpha;
    }
  }
  return encodePng(W * frames, H, px);
}
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 12);

/** Write a library with one asset; `entry` overrides manifest fields. */
function library(png, entry = {}, extraFiles = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'assets-'));
  const asset = { id: 'character.skater.skate', kind: 'character', file: 'characters/skater/skate.png', frame: { w: W, h: H }, frames: 1, anchor: { x: 4, y: 9 }, sha12: sha(png), source: 'hand-drawn', ...entry };
  for (const [file, buf] of Object.entries({ [asset.file]: png, ...extraFiles })) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), buf);
  }
  fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify({ version: 1, assets: [asset] }));
  return root;
}
const errorsOf = (png, entry, extra) => validate(library(png, entry, extra)).errors;

test('PNG round trip keeps every pixel', () => {
  const px = new Uint8Array(3 * 2 * 4).map((_, i) => (i * 37) % 256);
  const img = decodePng(encodePng(3, 2, px));
  assert.equal(img.width, 3);
  assert.equal(img.height, 2);
  assert.deepEqual([...img.data], [...px]);
});

test('a clean still and a clean animation strip pass', () => {
  assert.deepEqual(validate(library(strip(1))), { errors: [], warnings: [], checked: 1 });
  assert.deepEqual(errorsOf(strip(4), { frames: 4 }), []);
});

const BAD = [
  ['wrong image size', strip(3), { frames: 4 }, /expected 32x10/],
  ['background not removed', strip(1, { background: 255 }), {}, /no transparent pixels/],
  ['half-transparent pixels', strip(1, { alpha: 128 }), {}, /half-transparent/],
  ['an empty frame', strip(4, { empty: 2 }), { frames: 4 }, /frame 2 is empty/],
  ['a ground line that jumps', strip(4, { bottom: [9, 9, 6, 9] }), { frames: 4 }, /ground line jumps/],
  ['too many colours', strip(1, { colors: 20 }), { maxColors: 16 }, /20 colours, limit is 16/],
  ['a stale hash', strip(1), { sha12: '000000000000' }, /sha12/],
  ['a badly named file', strip(1), { file: 'characters/Skater/Skate_01.png' }, /kebab-case/],
  ['the wrong folder for its kind', strip(1), { file: 'props/skater/skate.png' }, /belongs in characters\//],
  ['a badly formed id', strip(1), { id: 'Skater' }, /id must look like/],
  ['a missing anchor', strip(1), { anchor: undefined }, /anchor/],
  ['an oversized frame', strip(1), { frame: { w: 200, h: H } }, /engine limit/],
];
for (const [what, png, entry, pattern] of BAD) {
  test(`rejects ${what}`, () => {
    const errors = errorsOf(png, entry);
    assert.ok(errors.some((e) => pattern.test(e)), `errors: ${JSON.stringify(errors)}`);
  });
}

test('rejects a PNG that is not in the manifest', () => {
  const errors = errorsOf(strip(1), {}, { 'props/stray.png': strip(1) });
  assert.deepEqual(errors, ['props/stray.png: PNG is not listed in manifest.json']);
});

test('rejects a file listed in the manifest but missing on disk', () => {
  const root = library(strip(1));
  fs.rmSync(path.join(root, 'characters/skater/skate.png'));
  assert.match(validate(root).errors[0], /file not found/);
});

test('the project asset library is valid', () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');
  const { errors } = validate(root);
  assert.deepEqual(errors, []);
});
