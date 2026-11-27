// Rules of the pixel ground (src/welt/pixelboden.js): where the photo turns into pixel art, with which colours.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, ASPHALT, naechste, schwelle, abstandPlatz, maske, markierung, imVieleck } from '../src/welt/pixelboden.js';

test('pixel ground: colours come from the palette only, dither thresholds cover the cell evenly', () => {
  for (const rgb of [[0, 0, 0], [255, 255, 255], [120, 140, 90], [200, 80, 60]]) assert.ok(PALETTE.includes(naechste(...rgb)));
  assert.ok(ASPHALT.includes(naechste(90, 160, 40, ASPHALT)), 'on the court even a green pixel becomes an asphalt tone');
  const t = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) t.push(schwelle(x, y));
  assert.equal(new Set(t).size, 16);
  assert.ok(Math.min(...t) > 0 && Math.max(...t) < 1);
  assert.equal(schwelle(5, 6), schwelle(1, 2));
});

test('pixel ground: full pixel art on and next to the court, none far away, further out on the square', () => {
  assert.equal(abstandPlatz(0, 0), 0);
  assert.equal(abstandPlatz(12.6, 9), 0);
  assert.ok(Math.abs(abstandPlatz(15.6, 13) - 5) < 1e-9);
  assert.equal(maske(0, false), 1);
  assert.equal(maske(6, false), 1);
  assert.equal(maske(26, false), 0);
  assert.ok(maske(26, true) > 0.5, 'the square keeps the style where the street has already lost it');
  assert.equal(maske(62, true), 0);
  let last = 1; for (let d = 0; d <= 70; d += 2) { const m = maske(d, true); assert.ok(m <= last + 1e-12, 'falls monotonically'); last = m; }
});

test('pixel ground: the game markings sit on the play area, symmetric about both axes', () => {
  assert.equal(markierung(5, 3), null);
  assert.deepEqual(markierung(0, 4), markierung(0, -4));          // centre line
  assert.ok(markierung(0, 4));
  assert.deepEqual(markierung(9.2, 2), markierung(-9.2, -2));     // goal lines
  assert.ok(markierung(11.4, 0) && markierung(0.1, 8.6));         // edge of the play area
  assert.equal(markierung(12.4, 0), null);                        // between play area and fence
  assert.ok(imVieleck([1, 1], [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]) && !imVieleck([5, 1], [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]]));
});
