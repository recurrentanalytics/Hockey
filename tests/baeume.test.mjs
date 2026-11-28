// The grove's rules (src/welt/baeume.js) and the player's step (src/welt/spieler.js): same data, same trees;
// trunks stop the player, canopies in front of the player are detected, shadows follow one light.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hain, kronengipfel, ausweichen, verdeckt, schatten, streuung, LICHT } from '../src/welt/baeume.js';
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

test('grove: crowns the survey shows without a mapped tree become derived trees, except near mapped trees and on the court', () => {
  // three crowns: one free (20, 20), one on the court (2, 1), one right at the first mapped tree
  const erster = hain(features.slice(0, 1), frame, arten)[0].ab;
  const huegel = [[20, 20, 12], [2, 1, 11], [erster[0] + 1, erster[1], 13]];
  const karte = (a, b) => Math.max(0, ...huegel.map(([ha, hb, h]) => h - 1.5 * Math.hypot(a - ha, b - hb)));
  const bereich = { a: [-46, 46], b: [-41.4, 41.6], schritt: 0.5 };
  const gipfel = kronengipfel(karte, bereich);
  assert.ok(gipfel.some(([a, b]) => Math.hypot(a - 20, b - 20) < 0.5) && gipfel.some(([a, b]) => Math.hypot(a - 2, b - 1) < 0.5));
  const alle = hain(features.slice(0, 1), frame, arten, karte, { bereich, sperre: (a, b) => Math.abs(a) < 13.4 && Math.abs(b) < 9.8 });
  const neu = alle.filter((t) => t.standort === 'abgeleitet');
  assert.equal(neu.length, 1, 'only the free crown becomes a tree');
  assert.ok(Math.hypot(neu[0].ab[0] - 20, neu[0].ab[1] - 20) < 0.5 && neu[0].hoeheQuelle === 'Oberflächenmodell' && neu[0].id.startsWith('dom/'));
  assert.deepEqual(alle, hain(features.slice(0, 1), frame, arten, karte, { bereich, sperre: (a, b) => Math.abs(a) < 13.4 && Math.abs(b) < 9.8 }));
});

test('trees: the faces that cast the shadow face the sun, keep the tree\'s size, and turn with it', async () => {
  const { schattenflaechen } = await import('../src/welt/baeume.js');
  const t = { hoehe: 12, krone: 4, ab: [0, 0], spiegeln: false }, bild = { seiten: 0.8, grenze: 0.6 };
  const sonne = (azimut, hoehe) => { const a = (azimut * Math.PI) / 180, h = (hoehe * Math.PI) / 180; return [Math.sin(a) * Math.cos(h), Math.cos(a) * Math.cos(h), Math.sin(h)]; };
  for (const [azimut, hoehe] of [[73, 45], [180, 60], [250, 20], [300, 85]]) {
    const [stamm, krone] = schattenflaechen(t, bild, { azimut, hoehe }), L = sonne(azimut, hoehe);
    assert.equal(stamm.teil, 'stamm'); assert.equal(krone.teil, 'krone');
    // the crown's face is square to the rays: both its edges are at right angles to the sun's direction
    const kante = (f, i, j) => f.ecken[j].map((v, k) => v - f.ecken[i][k]), mal = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    assert.ok(Math.abs(mal(kante(krone, 0, 1), L)) < 1e-9 && Math.abs(mal(kante(krone, 1, 2), L)) < 1e-9, `sun at ${azimut}°/${hoehe}°: the crown looks at it`);
    assert.ok(Math.abs(Math.hypot(...kante(krone, 0, 1)) - 12 * 0.8) < 1e-9 && Math.abs(Math.hypot(...kante(krone, 1, 2)) - 12 * 0.6) < 1e-9, 'as wide and as high as the crown in the sprite');
    // the trunk stands upright on its foot, turned to the sun's bearing, up to where the crown begins
    assert.ok(stamm.ecken.every((p) => Math.abs(p[0] * L[0] + p[1] * L[1]) < 1e-9), 'the trunk is turned to the sun');
    assert.deepEqual(stamm.ecken.map((p) => +p[2].toFixed(6)), [0, 0, 4.8, 4.8]);
    // the crown's middle stays over the trunk, at the crown's height
    const mitte = [0, 1, 2].map((k) => krone.ecken.reduce((s, p) => s + p[k], 0) / 4);
    assert.ok(Math.abs(mitte[0]) < 1e-9 && Math.abs(mitte[1]) < 1e-9 && Math.abs(mitte[2] - (12 - 3.6)) < 1e-9);
    // the sprite: the crown takes its upper part, the trunk the rest
    assert.deepEqual(krone.st.map((s) => s[1]), [0.6, 0.6, 0, 0]); assert.deepEqual(stamm.st.map((s) => s[1]), [1, 1, 0.6, 0.6]);
  }
  // a mirrored tree casts a mirrored shadow
  assert.deepEqual(schattenflaechen({ ...t, spiegeln: true }, bild)[1].st.map((s) => s[0]), [1, 0, 0, 1]);
  // a low sun is taken as 8°, like everywhere the light is used: no face lying flat on its side, no endless shadow
  assert.deepEqual(schattenflaechen(t, bild, { azimut: 90, hoehe: 1 }), schattenflaechen(t, bild, { azimut: 90, hoehe: 8 }));

});

const platzmeterVon = (en) => { const de = en[0] - frame.ursprung_utm32[0], dn = en[1] - frame.ursprung_utm32[1]; return [de * frame.achse_a[0] + dn * frame.achse_a[1], de * frame.achse_b[0] + dn * frame.achse_b[1]].map((x) => Math.round(x * 100) / 100); };

test('trees: none grows into a house: drawn smaller where the wall is near, left out where even a small one does not fit', async () => {
  const { haltAbstand, BAUMGRENZE } = await import('../src/welt/baeume.js');
  const haus = [[0, 0], [10, 0], [10, 10], [0, 10]], baum = (id, x, y, hoehe = 12) => ({ id, en: [x, y], ab: [x, y], hoehe, krone: 3.8, stamm: 0.42, art: 'a' });
  const fern = baum('fern', 30, 5), nah = baum('nah', 13, 5), eng = baum('eng', 11.5, 5), drin = baum('drin', 5, 5), klein = baum('klein', 13, 8, 5);
  const aus = haltAbstand([fern, nah, eng, drin, klein], [haus], () => 0.8);
  assert.deepEqual(aus.map((t) => t.id), ['fern', 'nah', 'klein'], 'the one in the house and the one against the wall are left out');
  assert.equal(aus[0], fern, 'a tree with room stays exactly as it is');
  assert.equal(aus[2], klein, 'so does a small one that fits');
  // 3 m from the wall, 0.3 m of air: half the picture's width may be 2.7 m, the picture is 0.8 wide by its height
  const t = aus[1];
  assert.ok(Math.abs((t.hoehe * 0.8) / 2 - (3 - BAUMGRENZE.luft)) < 0.05, `drawn ${t.hoehe} m high`);
  assert.ok(Math.abs(t.gestutzt - 2.7 / 4.8) < 0.01 && Math.abs(t.krone / 3.8 - t.gestutzt) < 0.02 && Math.abs(t.stamm / 0.42 - t.gestutzt) < 0.03, 'height, crown and trunk shrink together');
  assert.deepEqual(nah.hoehe, 12, 'the grove\'s own record is not changed');
  // a tree derived from the canopy survey has only an estimated trunk: it is moved away from the wall instead
  const geschaetzt = { ...baum('dom/1', 11.5, 5), standort: 'abgeleitet' }, imHaus = { ...baum('dom/2', 9.5, 5), standort: 'abgeleitet' }, tief = { ...baum('dom/3', 5, 5), standort: 'abgeleitet' };
  assert.deepEqual(haltAbstand([geschaetzt, imHaus, tief], [haus], () => 0.8).map((t) => t.id), [], 'without the frame nothing can be moved');
  const gerueckt = haltAbstand([geschaetzt, imHaus, tief], [haus], () => 0.8, frame);
  assert.deepEqual(gerueckt.map((t) => t.id), ['dom/1', 'dom/2'], 'the two near the wall are moved, the one deep in the house is left out');
  for (const t of gerueckt) {
    assert.ok(Math.abs(t.en[0] - (10 + 1.6 + BAUMGRENZE.luft + 0.1)) < 0.02 && t.en[1] === 5, `${t.id}: straight out from the wall to where the smallest tree fits (${t.en})`);
    assert.ok(t.gerueckt > 0 && t.gerueckt <= BAUMGRENZE.ruecken && Math.abs(t.hoehe - BAUMGRENZE.kleinste) < 0.3, `${t.id}: moved ${t.gerueckt} m, now ${t.hoehe} m high`);
    assert.deepEqual(t.ab, platzmeterVon(t.en), 'its court metres follow');
  }
  // the real quarter: after the rule no crown reaches a footprint, and most trees are untouched
  const geb = json('locations/boni/geo/gebaeude.geojson'), ringe = geb.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((p) => p[0]));
  const alle = hain(features, frame, [{ id: 'a' }]), stehen = haltAbstand(alle, ringe, () => 0.8);
  const abstand = ([x, y], ring) => Math.min(...ring.map((a, i) => { const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - dx * k, y - a[1] - dy * k); }));
  for (const b of stehen) assert.ok((b.hoehe * 0.8) / 2 <= Math.min(...ringe.map((r) => abstand(b.en, r))) - BAUMGRENZE.luft + 0.06, `${b.id}: its crown clears the nearest wall`);
  assert.ok(stehen.length >= alle.length - 6 && stehen.filter((b) => !b.gestutzt).length > alle.length * 0.7, `${stehen.length} of ${alle.length} trees stand, most as mapped`);
  assert.ok(stehen.every((b) => b.hoehe >= BAUMGRENZE.kleinste - 0.05), 'none smaller than the smallest tree');
});
