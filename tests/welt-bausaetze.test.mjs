// The world view's kits in the asset check (tools/assets/validate.mjs, validateWelt): one world scale,
// every picture present and unchanged, the measured façade parts (tools/assets/fassaden-vermessen.mjs)
// inside their picture and storey.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateWelt } from '../tools/assets/validate.mjs';
import { vermesse } from '../tools/assets/fassaden-vermessen.mjs';
import { decodePng } from '../tools/assets/png.mjs';

const KIT = 'assets/welt/haeuser/bausaetze.json';

test('world kits: the checked-in houses and ground pass the asset check', () => {
  const { errors, checked } = validateWelt('assets');
  assert.deepEqual(errors, []);
  assert.ok(checked >= 18, `${checked} pictures checked`);
});

test('world kits: every façade has one door in its middle piece, windows on every storey, and its parts are what the tool measures', () => {
  const saetze = JSON.parse(fs.readFileSync(KIT, 'utf8'));
  for (const f of saetze.fassaden) {
    const art = (a) => f.oeffnungen.filter((o) => o.art === a);
    assert.equal(art('tuer').length, 1, `${f.id}: one door`);
    for (let g = 0; g < saetze.geschosse; g++) assert.ok(f.oeffnungen.some((o) => o.geschoss === g && o.art !== 'tuer'), `${f.id}: windows in storey ${g}`);
    if (f.fuer.includes('laden')) assert.ok(art('schaufenster').length >= 2, `${f.id}: shop windows`);
    // the stored parts come from the pictures: changing a picture or the tool shows here
    assert.deepEqual(vermesse(decodePng(fs.readFileSync(path.join(path.dirname(KIT), f.datei))), f), { oeffnungen: f.oeffnungen, gesimse: f.gesimse }, `${f.id}: measured again, the same`);
  }
});

/** A copy of assets/welt with one change, checked. */
function geaendert(aendern) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'welt-'));
  fs.cpSync('assets/welt', path.join(root, 'welt'), { recursive: true });
  aendern(path.join(root, 'welt'));
  const r = validateWelt(root);
  fs.rmSync(root, { recursive: true, force: true });
  return r.errors;
}
const json = (p, f) => { const d = JSON.parse(fs.readFileSync(p, 'utf8')); f(d); fs.writeFileSync(p, JSON.stringify(d)); };

test('world kits: the check finds a wrong scale, a changed picture, a stray picture and a part outside its storey', () => {
  assert.match(geaendert((w) => json(path.join(w, 'boden/boden.json'), (d) => { d.px_je_m = 16; })).join('\n'), /welt\/boden: 16\.00 px per metre, the world scale is 12\.5/);
  assert.match(geaendert((w) => fs.copyFileSync(path.join(w, 'haeuser/gaube.png'), path.join(w, 'haeuser/dachfenster.png'))).join('\n'), /dachfenster\.png.*(sha12|image is)/);
  assert.match(geaendert((w) => fs.copyFileSync(path.join(w, 'haeuser/gaube.png'), path.join(w, 'haeuser/neu.png'))).join('\n'), /neu\.png: PNG is not listed/);
  assert.match(geaendert((w) => json(path.join(w, 'haeuser/bausaetze.json'), (d) => { d.fassaden[0].oeffnungen[0].y = 60; })).join('\n'), /stuck: fenster at .*does not lie in storey 3/);
  assert.match(geaendert((w) => json(path.join(w, 'haeuser/bausaetze.json'), (d) => { d.fassaden[1].oeffnungen = d.fassaden[1].oeffnungen.filter((o) => o.art !== 'tuer'); })).join('\n'), /jugendstil: 0 doors/);
});

test('world kits: the house shader draws edges, corners and ridges on the scenery scale', async () => {
  // src/welt/haeuser.js needs a browser to draw, but its scale is a plain constant: read it from the source
  const PX = Number(fs.readFileSync('src/welt/haeuser.js', 'utf8').match(/export const PX = ([\d.]+)/)[1]);
  assert.equal(PX, JSON.parse(fs.readFileSync('assets/welt/massstab.json', 'utf8')).px_je_m);
});

test('world kits: the house kits follow schema/bausatz.schema.json, and the check names what breaks it', () => {
  assert.match(geaendert((w) => json(path.join(w, 'haeuser/bausaetze.json'), (d) => { delete d.fassaden[2].zeilen; })).join('\n'), /fassaden\/2: "zeilen" is missing \(schema\/bausatz\.schema\.json\)/);
  assert.match(geaendert((w) => json(path.join(w, 'haeuser/bausaetze.json'), (d) => { d.fassaden[0].oeffnungen[0].art = 'erker'; })).join('\n'), /oeffnungen\/0\/art: "erker" is not one of fenster, schaufenster, tuer/);
  assert.match(geaendert((w) => json(path.join(w, 'haeuser/bausaetze.json'), (d) => { d.fassaden[3].fenster = 7; })).join('\n'), /"fenster" is not part of the schema/);
});

test('façade shade: under cornices and sills, in the reveals and at the foot, and nowhere when switched off', async () => {
  const { schattenkarte, SCHATTEN } = await import('../src/bau/haus.js');
  const saetze = JSON.parse(fs.readFileSync(KIT, 'utf8'));
  for (const f of saetze.fassaden) {
    const karte = schattenkarte(f), bei = (x, y) => karte[y * f.breite + x];
    assert.equal(karte.length, f.breite * f.hoehe, `${f.id}: one number per pixel`);
    assert.ok(schattenkarte(f, 0).every((v) => v === 255), `${f.id}: strength 0 leaves the picture as drawn`);
    const anteil = karte.filter((v) => v < 255).length / karte.length;
    assert.ok(anteil > 0.05 && anteil < 0.3, `${f.id}: ${(anteil * 100).toFixed(1)} % shaded: shade, not a darker picture`);
    assert.equal(bei(0, f.hoehe - 1), Math.round(255 * SCHATTEN.fuss[0]), `${f.id}: the wall's foot is darkest in its last row`);
    // the deepest shade lies directly under a broad cornice and at the top of a reveal
    const band = f.gesimse.find(([a, b]) => b - a >= 3 && b < f.hoehe - 10);
    if (band) assert.ok(karte.slice(band[1] * f.breite, (band[1] + 1) * f.breite).every((v) => v <= Math.round(255 * SCHATTEN.gesims[0])), `${f.id}: a full row of shadow under the cornice at ${band[1]}`);
    const fenster = f.oeffnungen.find((o) => o.art === 'fenster' && o.glas);
    assert.ok(bei(fenster.glas[0] + 2, fenster.glas[1]) <= Math.round(255 * SCHATTEN.laibung[0]), `${f.id}: the lintel's shadow on the glass`);
    assert.ok(bei(fenster.x + 2, fenster.y + fenster.h) <= Math.round(255 * SCHATTEN.bank[0]), `${f.id}: the sill's shadow on the wall`);
  }
  // half strength is half as dark
  const f = saetze.fassaden[0], voll = schattenkarte(f), halb = schattenkarte(f, 0.5);
  for (let i = 0; i < voll.length; i += 97) assert.ok(Math.abs((255 - halb[i]) * 2 - (255 - voll[i])) <= 2);
});

test('façade heights: cornices, frames and sills stand out as deep as the relief, wall and glass do not', async () => {
  const { tiefenkarte, schattenkarte, RELIEF, SCHATTEN } = await import('../src/bau/haus.js');
  const saetze = JSON.parse(fs.readFileSync(KIT, 'utf8')), mm = (m) => Math.round(m * 1000);
  for (const f of saetze.fassaden) {
    const karte = tiefenkarte(f), bei = (x, y) => karte[y * f.breite + x];
    assert.equal(karte.length, f.breite * f.hoehe);
    assert.ok(karte.every((v) => [0, mm(RELIEF.rahmen), mm(RELIEF.bank), mm(RELIEF.gesims)].includes(v)), `${f.id}: only the relief's depths`);
    for (const o of f.oeffnungen.filter((x) => x.glas)) {
      const [gx, gy, gb, gh] = o.glas;
      assert.equal(bei(gx + (gb >> 1), gy + (gh >> 1)), 0, `${f.id}: glass lies in the wall`);
      if (gx > o.x) assert.equal(bei(o.x, gy + 1), mm(RELIEF.rahmen), `${f.id}: the jamb stands out`);
      if (o.y + o.h > gy + gh) assert.equal(bei(gx + 1, o.y + o.h - 1), mm(o.art === 'tuer' ? RELIEF.rahmen : RELIEF.bank), `${f.id}: the sill stands out further`);
    }
    // a cornice band stands out wherever no opening crosses it
    const band = f.gesimse.find(([a, b]) => b - a >= 1), frei = [...Array(f.breite).keys()].find((x) => !f.oeffnungen.some((o) => x >= o.x && x < o.x + o.b && band[0] < o.y + o.h && band[1] > o.y));
    assert.equal(bei(frei, band[0]), mm(RELIEF.gesims), `${f.id}: the cornice at row ${band[0]}`);
    // the foot of the wall alone: the last rows, nothing else
    const fuss = schattenkarte(f, 1, { nurFuss: true });
    assert.ok(fuss.slice(0, f.breite * (f.hoehe - SCHATTEN.fuss.length)).every((v) => v === 255) && fuss[fuss.length - 1] === Math.round(255 * SCHATTEN.fuss[0]), `${f.id}: only the foot`);
  }
});
