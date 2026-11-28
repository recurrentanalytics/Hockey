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
