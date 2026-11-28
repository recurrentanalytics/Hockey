// The drawn ground of the quarter (src/welt/boden.js): which area takes which SpriteCook texture.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { bodenplan } from '../src/welt/boden.js';
import { decodePng } from '../tools/assets/png.mjs';

const lies = (name) => JSON.parse(fs.readFileSync(`locations/boni/geo/${name}`, 'utf8'));
const daten = { nutzung: lies('nutzung.geojson'), flaechen: lies('flaechen.geojson'), wege: lies('wege.geojson'), platz: lies('platz.geojson') };
const regeln = JSON.parse(fs.readFileSync('assets/welt/boden/boden.json', 'utf8'));
const flaeche = (ring) => Math.abs(ring.reduce((s, p, i) => { const q = ring[(i + 1) % ring.length]; return s + p[0] * q[1] - q[0] * p[1]; }, 0)) / 2;
const drin = ([x, y], ring) => { let d = false; for (let i = 0; i + 1 < ring.length; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[i + 1]; if ((y1 > y) !== (y2 > y) && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) d = !d; } return d; };

test('ground: every texture the rules name exists in the size they say, at the pixel size of the house fronts', () => {
  const haeuser = JSON.parse(fs.readFileSync('assets/welt/haeuser/bausaetze.json', 'utf8'));
  assert.equal(regeln.px_je_m, haeuser.hoehe_m ? haeuser.fassaden[0].hoehe / haeuser.hoehe_m : regeln.px_je_m, 'one pixel size for fronts and ground');
  for (const [name, t] of Object.entries(regeln.texturen)) { const b = decodePng(fs.readFileSync(`assets/welt/boden/${t.datei}`)); assert.deepEqual([b.width, b.height], [t.breite, t.hoehe], name); assert.match(t.asset_id, /^[0-9a-f-]{36}$/, `${name}: a SpriteCook asset`); }
  const genannt = [...Object.values(regeln.nutzung), ...Object.values(regeln.osm_flaechen), ...Object.values(regeln.belag), ...Object.values(regeln.osm_wege).map((r) => r.textur), regeln.bordstein.farbe_von];
  for (const name of genannt) assert.ok(regeln.texturen[name], `texture ${name} exists`);
});

test('ground: the whole surveyed quarter is covered, carriageways are streets, the court stays free', () => {
  const plan = bodenplan(daten, regeln), flaechen = plan.schritte.filter((s) => s.art === 'flaeche'), linien = plan.schritte.filter((s) => s.art === 'linie');
  for (const s of plan.schritte) { if (s.textur) assert.ok(regeln.texturen[s.textur], `step paints with ${s.textur}`); else assert.ok(s.art === 'loch' || regeln.texturen[s.farbeVon]); }
  // every land-use polygon of the survey is painted exactly once
  const gemalt = new Set(flaechen.flatMap((s) => s.vielecke).map((v) => v[0]));
  for (const f of daten.nutzung.features) assert.ok(gemalt.has(f.geometry.coordinates[0]), `${f.properties.nutzart} ${f.properties.oid} is painted`);
  const jeTextur = {}; for (const s of flaechen) jeTextur[s.textur] = (jeTextur[s.textur] ?? 0) + s.vielecke.reduce((a, v) => a + flaeche(v[0]), 0);
  for (const name of ['asphalt', 'gehweg', 'hof', 'platz', 'rasen']) assert.ok(jeTextur[name] > 1000, `${name} covers ground (${Math.round(jeTextur[name] ?? 0)} m²)`);
  // carriageways: the survey's street areas without the verges, about 4.5 hectares, a few metres wide
  const bahn = plan.fahrbahn.reduce((a, v) => a + flaeche(v[0]), 0);
  assert.ok(bahn > 40000 && bahn < 50000, `carriageway ${Math.round(bahn)} m²`);
  // order: blocks first, streets after the pavements, cobbles inside the carriageway only, kerbs last but for the court
  const ordnung = plan.schritte.map((s) => (s.art === 'flaeche' ? s.textur : s.art === 'linie' ? `linie:${s.textur ?? 'bordstein'}` : 'loch'));
  assert.ok(ordnung.indexOf('hof') < ordnung.indexOf('gehweg') && ordnung.lastIndexOf('gehweg') < ordnung.indexOf('asphalt'), ordnung.join(' '));
  const pflaster = linien.find((s) => s.textur === 'kopfstein' && s.in === 'fahrbahn');
  assert.ok(pflaster && pflaster.linien.length >= 10, 'the cobbled streets keep their cobbles');
  assert.ok(ordnung.indexOf('linie:kopfstein') > ordnung.indexOf('asphalt'));
  assert.deepEqual(ordnung.slice(-2), ['linie:bordstein', 'loch']);
  // kerbs follow the carriageway but never the straight cut of the data
  const [w, s, e, n] = plan.rahmen, bord = linien.at(-1), rand = ([x, y]) => Math.abs(x - w) < 0.05 || Math.abs(x - e) < 0.05 || Math.abs(y - s) < 0.05 || Math.abs(y - n) < 0.05;
  assert.ok(bord.linien.length > 20);
  for (const l of bord.linien) for (let i = 0; i + 1 < l.length; i++) assert.ok(!(rand(l[i]) && rand(l[i + 1])), 'no kerb along the edge of the data');
  // the court: a hole round the fence, wider than it, with the origin inside
  const loch = plan.schritte.at(-1).vielecke[0][0], zaun = daten.platz.features.find((f) => f.properties.art === 'zaun').geometry.coordinates[0];
  assert.ok(flaeche(loch.slice(0, -1)) > flaeche(zaun.slice(0, -1)) * 1.1);
  for (const p of zaun) assert.ok(drin(p, loch), 'the fence lies inside the hole');
  assert.deepEqual(JSON.stringify(bodenplan(daten, regeln)), JSON.stringify(plan), 'the same plan from the same data');
});
