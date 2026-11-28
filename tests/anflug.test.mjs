// The approach flight of the world view (src/welt/anflug.js): one move from the planet onto the court.
import test from 'node:test';
import assert from 'node:assert/strict';
import { kamera, zeile, GESCHICHTE, ENDE } from '../src/welt/anflug.js';

test('approach: starts above the whole planet, never backs off, and lands in the game camera', () => {
  const a = kamera(0), z = kamera(ENDE);
  assert.ok(a.weite > 1.2e7 && a.richtung === 0 && a.neigung === 0, 'straight down on the planet at the start');
  assert.ok(Math.abs(z.richtung - 118.2) < 1e-9 && Math.abs(z.neigung - 60) < 1e-9 && z.weite < 80);
  let zuvor = Infinity, drehung = -1, neigung = -1;
  for (let t = 0; t <= ENDE; t += 0.1) {
    const k = kamera(t);
    assert.ok(k.weite <= zuvor + 1e-6, `backs off at ${t}`); zuvor = k.weite;
    assert.ok(k.richtung >= drehung - 1e-9 && k.neigung >= neigung - 1e-9, `turns back at ${t}`); drehung = k.richtung; neigung = k.neigung;
  }
  assert.deepEqual(kamera(-5), kamera(0));
  assert.deepEqual(kamera(ENDE + 5), kamera(ENDE));
});

test('approach: every line of the story is told once, in order, and the flight outlasts the last one', () => {
  assert.equal(GESCHICHTE.length, 6);
  for (let i = 0; i < GESCHICHTE.length; i++) {
    assert.equal(zeile((GESCHICHTE[i].at + GESCHICHTE[i].until) / 2), i);
    if (i) assert.ok(GESCHICHTE[i].at >= GESCHICHTE[i - 1].until);
  }
  assert.equal(zeile(0), -1);
  assert.ok(ENDE >= GESCHICHTE.at(-1).until);
});
