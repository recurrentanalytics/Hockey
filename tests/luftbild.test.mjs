// The world's own copy of the aerial photo (src/welt/luftbild.js): where it lands on the globe.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { rechteck, ecken } from '../src/welt/luftbild.js';

const meta = JSON.parse(fs.readFileSync('assets/welt/boni_umgebung.json', 'utf8'));
const frame = JSON.parse(fs.readFileSync('locations/boni/geo/rahmen.json', 'utf8'));

test('aerial copy: the stored extent is the 1.2 km reference window at half a metre per pixel', () => {
  const [w, s, e, n] = meta.utm32;
  assert.ok(Math.abs((e - w) / meta.pixel[0] - 0.5) < 0.002 && Math.abs((n - s) / meta.pixel[1] - 0.5) < 0.002);
  assert.ok(fs.statSync('assets/welt/' + meta.datei).size > 500000);
  assert.match(meta.lizenz, /LGLN.*CC BY 4\.0/);
});

test('aerial copy: laid out north-up on the globe it is turned by the grid convergence and keeps its scale', () => {
  const px = 2380, halb = 595, r = rechteck(frame.ursprung_utm32, halb);
  const [t0, t1, t2] = ecken(meta, r, px), jeMeter = px / (2 * halb);
  const breite = Math.hypot(t1[0] - t0[0], t1[1] - t0[1]) / jeMeter, hoehe = Math.hypot(t2[0] - t0[0], t2[1] - t0[1]) / jeMeter;
  assert.ok(Math.abs(breite - (meta.utm32[2] - meta.utm32[0])) < 2.5, `width ${breite} m`);   // within the 0.04 % grid scale and the flat-earth metres of the rectangle
  assert.ok(Math.abs(hoehe - (meta.utm32[3] - meta.utm32[1])) < 2.5, `height ${hoehe} m`);
  const drehung = (Math.atan2(t1[1] - t0[1], t1[0] - t0[0]) * 180) / Math.PI;
  assert.ok(Math.abs(Math.abs(drehung) - frame.meridiankonvergenz_grad) < 0.05, `turned by ${drehung}°`);
  // the rectangle shown lies inside the photo on every side
  assert.ok(t0[0] < 0 && t0[1] < 0 && t1[0] > px && t2[1] > px);
});
