// The houses of the neighbourhood (src/bau/haus.js): description and mesh from the footprints alone.
// Roof forms, storeys, shop fronts, gateways, party walls, colours; and the whole real dataset without a gap.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { viertel, netz, relief, RELIEF, trianguliere, rechteck, flaeche, saeubere, dachhoehe, achsen, steckbrief, lichtvektor, hoehen, fuege, schichte, wandmaske, kleideViertel, packe, PUTZ, KLINKER, DURCHFAHRT, ACHSE } from '../src/bau/haus.js';
import { decodePng } from '../tools/assets/png.mjs';

const json = (n) => JSON.parse(fs.readFileSync(`locations/boni/geo/${n}`, 'utf8'));
const frame = json('rahmen.json'), gebaeude = json('gebaeude.geojson'), wege = json('wege.geojson');
const [E0, N0] = frame.ursprung_utm32;

/** A footprint as ALKIS would deliver it: metres round the court centre, closed ring. */
const haus = (oid, ring, p = {}) => ({ type: 'Feature', properties: { oid, art: 'Gebäude', funktion: 'Wohngebäude', hoehe_m: 15.6, hoehe_quelle: 'geschätzt aus OSM-Geschossen', osm_building_levels: '4', osm_roof_levels: '1', osm_roof_shape: 'gabled', ...p },
  geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]].map(([x, y]) => [E0 + x, N0 + y])] } });
const kiste = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const baue = (features, w = null) => viertel({ features }, frame, { wege: w });
const strasse = (y) => ({ features: [{ type: 'Feature', properties: { highway: 'residential' }, geometry: { type: 'LineString', coordinates: [[E0 - 100, N0 + y], [E0 + 100, N0 + y]] } }] });

/** Facts about a mesh that must hold for every house. */
function pruefe(h, m) {
  const P = m.positionen, N = m.normalen, W = m.wand;
  assert.ok(m.indizes.length > 0 && m.indizes.length % 3 === 0, `${h.oid}: triangles`);
  assert.equal(P.length / 3, N.length / 3);
  assert.equal(P.length / 3, W.length / 4);
  for (const v of P) assert.ok(Number.isFinite(v), `${h.oid}: finite positions`);
  let dach = 0, boden = 0;
  for (let i = 0; i < m.indizes.length; i += 3) {
    const [a, b, c] = [0, 1, 2].map((k) => m.indizes[i + k]), p = (j) => [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]];
    const A = p(a), B = p(b), C = p(c), u = B.map((x, k) => x - A[k]), v = C.map((x, k) => x - A[k]);
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n);
    if (l < 1e-9) continue; // a wall running out to nothing under a gable
    const dot = (n[0] * N[a * 3] + n[1] * N[a * 3 + 1] + n[2] * N[a * 3 + 2]) / l;
    assert.ok(dot > 0.99, `${h.oid}: a triangle faces the way its normal says (${dot.toFixed(3)})`);
    const art = W[a * 4 + 3] % 16;
    if ([4, 5, 10, 11].includes(art) && W[a * 4 + 2] >= 0) dach += n[2] / 2; // a dormer's little roof (w < 0) lies over the roof proper
    if (art === 6) boden += -n[2] / 2;
    for (const q of [A, B, C]) assert.ok(q[2] >= -1e-9 && q[2] <= h.first + (art === 8 ? 3 : 1e-6), `${h.oid}: between ground and ridge (chimneys a little above)`);
  }
  assert.ok(Math.abs(dach - h.flaeche) < Math.max(0.05, h.flaeche * 1e-4), `${h.oid}: the roof covers the footprint exactly (${dach.toFixed(2)} of ${h.flaeche} m²)`);
  return { dach, boden };
}
const arten = (m) => new Set(Array.from({ length: m.wand.length / 4 }, (_, i) => m.wand[i * 4 + 3] % 16));
const hoechste = (m) => Math.max(...Array.from({ length: m.positionen.length / 3 }, (_, i) => m.positionen[i * 3 + 2]));

test('houses: a flat roof stays at the eaves', () => {
  const [h] = baue([haus('flach', kiste(0, 0, 14, 10), { osm_roof_shape: 'flat', osm_roof_levels: '0', hoehe_m: 12.8 })]);
  assert.equal(h.dach.form, 'flach');
  assert.equal(h.traufe, 12.8);
  assert.equal(h.first, 12.8);
  const m = netz(h);
  pruefe(h, m);
  assert.ok(arten(m).has(5) && !arten(m).has(4), 'flat roof surface, no tiles');
  assert.ok(Math.abs(hoechste(m) - 12.8) < 1e-6);
});

test('houses: a saddle roof has eaves on the long sides, a ridge along them and gables at the ends', () => {
  const [h] = baue([haus('sattel', kiste(0, 0, 20, 10))]);
  assert.equal(h.dach.form, 'sattel');
  assert.equal(h.traufe, 12.8, 'four storeys of 3.2 m');
  assert.equal(h.etagen, 4);
  assert.ok(Math.abs(Math.abs(h.dach.u[0]) - 1) < 1e-9, 'ridge along the long side');
  assert.ok(Math.abs(h.first - 15.6) < 1e-9, 'one roof storey of 2.8 m');
  assert.ok(Math.abs(dachhoehe(h.dach, [10, 5]) - 2.8) < 1e-9, 'ridge in the middle');
  assert.ok(dachhoehe(h.dach, [10, 0]) < 1e-9 && dachhoehe(h.dach, [10, 10]) < 1e-9, 'eaves at both long sides');
  assert.ok(Math.abs(dachhoehe(h.dach, [0, 5]) - 2.8) < 1e-9, 'the gable end reaches the ridge');
  const m = netz(h);
  pruefe(h, m);
  assert.ok(arten(m).has(4));
  assert.ok(Math.abs(hoechste(m) - 15.6) < 1e-6);
});

test('houses: a hipped roof slopes on all four sides', () => {
  const [h] = baue([haus('walm', kiste(0, 0, 20, 10), { osm_roof_shape: 'hipped' })]);
  assert.equal(h.dach.form, 'walm');
  for (const p of [[10, 0], [10, 10], [0, 5], [20, 5]]) assert.ok(dachhoehe(h.dach, p) < 1e-9, `eaves at ${p}`);
  assert.ok(Math.abs(dachhoehe(h.dach, [10, 5]) - 2.8) < 1e-9);
  assert.ok(Math.abs(dachhoehe(h.dach, [2.5, 5]) - 1.4) < 1e-9, 'the hip rises from the short side');
  const m = netz(h);
  pruefe(h, m);
  const waende = Array.from({ length: m.wand.length / 4 }, (_, i) => i).filter((i) => m.wand[i * 4 + 3] % 16 < 4);
  for (const i of waende) assert.ok(m.positionen[i * 3 + 2] <= h.traufe + 1e-6, 'no wall rises above the eaves');
});

test('houses: a rear wing stays flat, a footprint without a main body falls back to a flat roof', () => {
  // front house 12 m deep along the street, a narrow wing behind it
  const [l] = baue([haus('fluegel', [[0, 0], [16, 0], [16, 12], [5, 12], [5, 22], [0, 22]])], strasse(-8));
  assert.equal(l.dach.form, 'sattel');
  assert.ok(Math.abs(l.dach.yb - l.dach.ya - 12) < 0.01, `the roof spans the front house only (${(l.dach.yb - l.dach.ya).toFixed(2)} m)`);
  assert.ok(dachhoehe(l.dach, [2.5, 18]) < 1e-9, 'flat over the wing');
  assert.ok(dachhoehe(l.dach, [8, 6]) > 2, 'ridge over the front house');
  pruefe(l, netz(l));
  // a cross: no strip holds most of it
  const kreuzform = [[8, 0], [11, 0], [11, 8], [19, 8], [19, 11], [11, 11], [11, 19], [8, 19], [8, 11], [0, 11], [0, 8], [8, 8]];
  const [x] = baue([haus('kreuz', kreuzform)]);
  assert.equal(x.dach.form, 'flach');
  assert.equal(x.dach.rueckfall, true);
  assert.equal(x.first, x.traufe);
  pruefe(x, netz(x));
  assert.match(steckbrief(x), /Flachdach \(angegeben: sattel/);
});

test('houses: a gateway opens the wall up to its clear height and gets tunnel walls and a ceiling', () => {
  const wirt = haus('wirt', kiste(0, 0, 20, 12)), durch = haus('durch', kiste(8, 0, 12, 12), { art: 'Bauteil', funktion: 'Durchfahrt im Gebäude' });
  const liste = baue([wirt, durch], strasse(-8));
  assert.equal(liste.length, 1, 'the gateway is part of its house, not a house');
  const [h] = liste, muender = h.kanten.flatMap((k) => k.stuecke.filter((s) => s.muendung));
  assert.equal(muender.length, 2, 'open to the street and to the yard');
  for (const s of muender) assert.ok(Math.abs(s.t1 - s.t0 - 4) < 0.01);
  assert.equal(h.durchfahrten.length, 1);
  assert.equal(h.durchfahrten[0].waende.length, 2, 'two tunnel walls');
  const m = netz(h), { boden } = pruefe(h, m);
  assert.ok(Math.abs(boden - 48) < 0.01, `ceiling of the passage (${boden.toFixed(2)} m²)`);
  assert.ok(arten(m).has(3) && arten(m).has(6));
  // nothing of the outer wall stands in the opening below the clear height
  for (let i = 0; i < m.indizes.length; i += 3) {
    const e = [0, 1, 2].map((k) => m.indizes[i + k]);
    if (m.wand[e[0] * 4 + 3] % 16 > 1) continue;
    const xs = e.map((j) => m.positionen[j * 3]), ys = e.map((j) => m.positionen[j * 3 + 1]), zs = e.map((j) => m.positionen[j * 3 + 2]);
    if (ys.every((y) => Math.abs(y) < 1e-6) && Math.min(...xs) > 8 - 1e-6 && Math.max(...xs) < 12 + 1e-6) assert.ok(Math.min(...zs) >= DURCHFAHRT - 1e-6, 'the street wall is open under the gateway');
  }
  assert.match(steckbrief(h), /Durchfahrten: 1/);
});

test('houses: a shop is on the ground floor of the street front only, with one door', () => {
  const [h] = baue([haus('laden', kiste(0, 0, 17, 12), { funktion: 'Wohngebäude mit Handel und Dienstleistungen' })], strasse(-8));
  assert.equal(h.eg, 'laden');
  const stuecke = h.kanten.flatMap((k) => k.stuecke);
  assert.deepEqual(stuecke.map((s) => s.art).sort(), ['hof', 'hof', 'hof', 'strasse']);
  const front = stuecke.find((s) => s.art === 'strasse');
  assert.equal(achsen(front.t1 - front.t0), 10, '17 m of front give ten window axes');
  assert.ok(front.tuer >= 0 && front.tuer < 10, 'a door at one of the axes');
  assert.ok(stuecke.filter((s) => s.tuer >= 0).length === 1);
  const m = netz(h);
  pruefe(h, m);
  assert.ok([...m.bau].some((v, i) => i % 4 === 3 && v % 4 === 1), 'the mesh carries the shop code');
  assert.equal(baue([haus('wohn', kiste(0, 0, 17, 12))], strasse(-8))[0].eg, 'wohnen');
  assert.equal(baue([haus('schule', kiste(0, 0, 40, 20), { funktion: 'Allgemein bildende Schule' })])[0].eg, 'schule');
});

test('houses: storeys and eaves follow the data; footprints without a height are low yard buildings', () => {
  const [fuenf] = baue([haus('fuenf', kiste(0, 0, 14, 12), { osm_building_levels: '5', osm_roof_levels: '2', hoehe_m: 21.6 })]);
  assert.equal(fuenf.etagen, 5);
  assert.equal(fuenf.traufe, 16);
  assert.equal(fuenf.egHoehe, 3.6);
  assert.ok(Math.abs(fuenf.first - 21.6) < 1e-9, 'two roof storeys');
  assert.deepEqual(hoehen({ hoehe_m: 9, hoehe_quelle: 'OSM height' }, 100), { traufe: 9, etagen: 3, dach: 0, quelle: 'OSM height' });
  assert.deepEqual(hoehen({ hoehe_m: 8, hoehe_quelle: 'OSM height', osm_building_levels: '1', osm_roof_levels: '1' }, 70), { traufe: 3.9, etagen: 1, dach: 4.1, quelle: 'OSM height' }, 'one storey is not 5 m tall: the rest is roof');
  const [schuppen] = baue([haus('schuppen', kiste(0, 0, 5, 4), { funktion: 'Gebäude für Wirtschaft oder Gewerbe', hoehe_m: undefined, osm_building_levels: undefined, osm_roof_levels: undefined, osm_roof_shape: undefined })]);
  assert.deepEqual([schuppen.traufe, schuppen.etagen, schuppen.eg, schuppen.dach.form], [3, 1, 'neben', 'flach']);
  assert.match(schuppen.hoeheQuelle, /angenommen/);
  const [dach] = baue([haus('carport', kiste(0, 0, 6, 5), { art: 'Sonstiges Bauwerk oder sonstige Einrichtung', funktion: 'Überdachung', hoehe_m: undefined, osm_roof_shape: undefined })]);
  assert.equal(dach.art, 'ueberdachung');
  const m = netz(dach), { boden } = pruefe(dach, m);
  assert.ok(Math.abs(boden - 30) < 0.01, 'a canopy has an underside');
  assert.ok(Math.min(...Array.from({ length: m.positionen.length / 3 }, (_, i) => m.positionen[i * 3 + 2])) > 2.5, 'and stands open below');
});

test('houses: a wall shared with a neighbour is a party wall without windows; the ridge runs square to it', () => {
  // three houses in a row, each deeper than wide: without the neighbours the ridge would run front to back
  const reihe = [haus('a', kiste(0, 0, 10, 14)), haus('b', kiste(10, 0, 20, 14)), haus('c', kiste(20, 2, 30, 14))];
  const [a, b, c] = baue(reihe, strasse(-8));
  assert.deepEqual([...a.nachbarn], ['b']);
  assert.deepEqual([...b.nachbarn].sort(), ['a', 'c']);
  const wand = (h, i) => h.kanten[i].stuecke.map((s) => `${s.art}:${(s.t1 - s.t0).toFixed(1)}`);
  assert.deepEqual(wand(a, 1), ['brandwand:14.0'], 'east wall of a');
  assert.deepEqual(wand(b, 3), ['brandwand:14.0'], 'west wall of b');
  assert.deepEqual(wand(b, 1), ['hof:2.0', 'brandwand:12.0'], 'c starts two metres further back: that much of b stays free');
  assert.deepEqual(wand(b, 0), ['strasse:10.0']);
  assert.deepEqual(wand(b, 2), ['hof:10.0']);
  for (const h of [a, b, c]) assert.ok(Math.abs(Math.abs(h.dach.u[0]) - 1) < 1e-9, `${h.oid}: ridge along the street`);
  const [allein] = baue([reihe[1]]);
  assert.ok(Math.abs(Math.abs(allein.dach.u[1]) - 1) < 1e-9, 'a house standing alone, off any street, turns its ridge along its long side');
  const [anStrasse] = baue([reihe[1]], strasse(-8));
  assert.ok(Math.abs(Math.abs(anStrasse.dach.u[0]) - 1) < 1e-9, 'on a street its eaves face the street');
  for (const h of [a, b, c]) pruefe(h, netz(h));
});

test('houses: colours come from the id alone, the same on every run, and neighbours differ', () => {
  const reihe = Array.from({ length: 12 }, (_, i) => haus(`haus-${i}`, kiste(i * 10, 0, i * 10 + 10, 12)));
  const eins = baue(reihe), zwei = baue([...reihe].reverse());
  assert.deepEqual(eins.map((h) => [h.oid, h.wand, h.dach.farbe, h.stil]), zwei.map((h) => [h.oid, h.wand, h.dach.farbe, h.stil]));
  const palette = new Set([...PUTZ, ...KLINKER].map((f) => f[1]));
  for (const h of eins) {
    assert.ok(palette.has(h.wand.farbe), `${h.oid}: a colour of the palette`);
    for (const n of h.nachbarn) assert.notEqual(eins.find((x) => x.oid === n).wand.farbe, h.wand.farbe, `${h.oid} and ${n} share a wall, not a colour`);
  }
  assert.ok(new Set(eins.map((h) => h.wand.farbe)).size >= 4, 'a street of several colours');
  assert.deepEqual(Array.from(netz(eins[3]).farbe), Array.from(netz(zwei[3]).farbe));
});

test('houses: the whole Bonifatiusplatz dataset becomes houses without a gap', () => {
  const liste = viertel(gebaeude, frame, { wege });
  const roh = gebaeude.features, bauteile = roh.filter((f) => f.properties.art === 'Bauteil');
  assert.equal(liste.length, roh.length - bauteile.length, 'one house per footprint; gateways belong to their house');
  assert.deepEqual(viertel({ features: [...roh].reverse() }, frame, { wege }).map((h) => [h.oid, h.wand.farbe, h.dach.form, h.first]), liste.map((h) => [h.oid, h.wand.farbe, h.dach.form, h.first]));
  let ecken = 0, dreiecke = 0;
  for (const h of liste) { const m = netz(h); pruefe(h, m); ecken += m.positionen.length / 3; dreiecke += m.indizes.length / 3; assert.ok(steckbrief(h).includes(h.oid)); }
  const zaehle = (fn) => liste.filter(fn).length, angabe = (...formen) => roh.filter((f) => f.properties.art !== 'Bauteil' && formen.includes(f.properties.osm_roof_shape)).length;
  // roof forms as the data names them (the gateways repeat their house's roof and do not count)
  assert.equal(zaehle((h) => h.dach.gewuenscht === 'sattel'), angabe('gabled'));
  assert.equal(zaehle((h) => h.dach.gewuenscht === 'walm'), angabe('hipped', 'quadruple_saltbox'));
  assert.ok(angabe('gabled') > 150 && zaehle((h) => h.dach.form === 'sattel') >= angabe('gabled') - 5, `nearly every saddle roof is built as one (${zaehle((h) => h.dach.form === 'sattel')} of ${angabe('gabled')})`);
  assert.ok(zaehle((h) => h.dach.rueckfall) <= 5, `few fall back to a flat roof (${zaehle((h) => h.dach.rueckfall)})`);
  assert.equal(zaehle((h) => h.eg === 'laden'), roh.filter((f) => /Handel/.test(f.properties.funktion)).length);
  assert.equal(liste.reduce((s, h) => s + h.durchfahrten.length, 0), bauteile.length, 'every gateway opens a free wall of its house');
  assert.ok(zaehle((h) => h.nachbarn.size) > 150, 'a quarter of terraced houses');
  assert.ok(zaehle((h) => h.kanten.some((k) => k.stuecke.some((s) => s.art === 'strasse'))) > 120, 'street fronts are found');
  for (const h of liste) assert.ok(h.first <= 30 && h.traufe >= 2.6 && h.first >= h.traufe, `${h.oid}: plausible heights`);
  assert.ok(ecken < 120000 && dreiecke < 80000, `a mesh a tablet can draw (${ecken} corners, ${dreiecke} triangles)`);
});

test('houses: façade kits are cut into axes and storeys that fit any wall, and know which pixels are wall', () => {
  const saetze = JSON.parse(fs.readFileSync('assets/welt/haeuser/bausaetze.json', 'utf8')), lies = (t) => decodePng(fs.readFileSync(`assets/welt/haeuser/${t.datei}`));
  for (const t of [saetze.ziegel, saetze.putz, saetze.teile.schornstein, saetze.teile.gaube, saetze.teile.dachfenster]) { const b = lies(t); assert.deepEqual([b.width, b.height], [t.breite, t.hoehe], `${t.datei}: the size the kit says`); }
  assert.ok(saetze.fassaden.some((f) => f.id === saetze.hof), 'the yard kit exists');
  for (const f of saetze.fassaden) {
    const bild = lies(f), pxJeM = f.hoehe / saetze.hoehe_m, stuecke = [f.links, ...f.achsen, ...(f.achsenRechts ?? []), f.mitte, f.rechts];
    assert.deepEqual([bild.width, bild.height], [f.breite, f.hoehe], `${f.id}: the size the kit says`);
    assert.ok(pxJeM > 11 && pxJeM < 17, `${f.id}: the coarse pixel size the owner chose (${pxJeM.toFixed(1)} px per metre)`);
    for (const [a, b] of stuecke) assert.ok(a >= 0 && b <= f.breite && b > a, `${f.id}: columns lie in the picture`);
    assert.deepEqual([f.zeilen[0], f.zeilen.at(-1), f.zeilen.length], [0, f.hoehe, saetze.geschosse + 1], `${f.id}: rows from top to bottom`);
    assert.deepEqual(f.zeilen, [...f.zeilen].sort((a, b) => a - b));
    // a front of 18 m: both edges, the door piece once, no column that is not a piece of the kit, close to the true length
    const lang = fuege(f, 18, pxJeM, true, 0.4);
    assert.deepEqual([lang.spalten[0], lang.spalten.at(-1), lang.gestreckt], [f.links, f.rechts, false]);
    assert.equal(lang.spalten.filter((s) => s === f.mitte).length, 1);
    for (const s of lang.spalten) assert.ok(stuecke.includes(s), `${f.id}: column ${s} is a piece of the kit`);
    assert.ok(Math.abs(lang.breite / (18 * pxJeM) - 1) < 0.12, `${f.id}: within 12 % of the true length (${lang.breite} px for ${(18 * pxJeM).toFixed(0)})`);
    assert.deepEqual(fuege(f, 18, pxJeM, true, 0.4), lang, 'the same wall, the same façade');
    assert.equal(fuege(f, 12, pxJeM, false).spalten.includes(f.mitte), false, 'no door where none is asked for');
    assert.equal(fuege(f, 0.6, pxJeM, true).gestreckt, true, 'a very short wall is the pier between two windows');
    // storeys: the ground floor below, the top row (with the cornice) above, for any height
    for (let etagen = 1; etagen <= 6; etagen++) {
      const reihen = schichte(f, etagen);
      assert.equal(reihen.length, etagen);
      assert.deepEqual(reihen[0], [f.zeilen.at(-2), f.zeilen.at(-1)], 'ground floor');
      if (etagen > 1) assert.deepEqual(reihen.at(-1), [f.zeilen[0], f.zeilen[1]], 'top storey with the cornice');
    }
    // the wall mask: a good part of a rendered façade, nothing of a brick one; a window pane is never wall
    const maske = wandmaske(bild, f), anteil = maske.reduce((s, v) => s + v, 0) / maske.length;
    if (f.faerbbar) assert.ok(anteil > 0.2 && anteil < 0.85, `${f.id}: wall share ${anteil.toFixed(2)}`); else assert.equal(anteil, 0);
  }
});

test('houses: the whole quarter is dressed: every house a kit that fits it, neighbours differ, nothing is drawn by rule', () => {
  const saetze = JSON.parse(fs.readFileSync('assets/welt/haeuser/bausaetze.json', 'utf8')), ids = saetze.fassaden.map((f) => f.id);
  const liste = kleideViertel(viertel(gebaeude, frame, { wege }), saetze), blatt = packe(saetze);
  const kaesten = blatt.bilder.map((b) => b.nach);
  for (const [x, y, w, h] of kaesten) assert.ok(x >= 1 && y >= 1 && x + w < blatt.breite && y + h < blatt.hoehe, 'every picture lies on the sheet');
  for (let i = 0; i < kaesten.length; i++) for (let j = i + 1; j < kaesten.length; j++) { const [a, b] = [kaesten[i], kaesten[j]]; assert.ok(a[0] + a[2] < b[0] || b[0] + b[2] < a[0] || a[1] + a[3] < b[1] || b[1] + b[3] < a[1], 'pictures do not overlap'); }
  let ecken = 0, dreiecke = 0, gleich = 0, paare = 0;
  const getragen = new Map(), nach = new Map(liste.map((h) => [h.schluessel, h]));
  for (const h of liste) {
    h.kleid.lage = blatt.lage;
    const m = netz(h), satz = h.kleid.satz;
    pruefe(h, m);
    ecken += m.positionen.length / 3; dreiecke += m.indizes.length / 3;
    for (const art of arten(m)) assert.ok([3, 6, 7, 8, 9, 10, 11].includes(art), `${h.oid}: kind ${art} would be drawn by rule`);
    if (h.art !== 'haus' || h.eg === 'neben') { assert.equal(satz, null, 'yard buildings and canopies are plastered'); continue; }
    assert.ok(ids.includes(satz.id) && satz.fuer.includes(h.eg), `${h.oid}: a ${h.eg} house wears ${satz.id}`);
    getragen.set(satz.id, (getragen.get(satz.id) ?? 0) + 1);
    const front = h.kleid.laeufe.filter((l) => l.art === 'strasse');
    assert.ok(h.kleid.laeufe.filter((l) => l.bild.spalten.includes(l.satz.mitte)).length <= 1, 'at most one door piece');
    for (const l of front) assert.equal(l.satz, satz);
    for (const l of h.kleid.laeufe) { assert.equal(l.zeilen.length, h.etagen); assert.ok(Math.abs(l.grenzen.at(-1) - l.laenge) < 1e-6, 'the columns fill the run'); for (const t of l.ton.slice(0, 3)) assert.ok(t > 0.2 && t < 3); }
    for (const n of h.nachbarn) { const o = nach.get(n); if (o?.kleid?.satz) { paare++; if (o.kleid.satz.id === satz.id) gleich++; } }
  }
  for (const id of ids) assert.ok(getragen.get(id) > 3, `kit ${id} is worn (${getragen.get(id) ?? 0} houses)`);
  assert.ok(gleich / paare < 0.2, `neighbours seldom wear the same kit (${gleich / 2} of ${paare / 2} pairs)`);
  assert.ok(liste.filter((h) => h.kleid.aufbauten.some((a) => a.art === 'gaube')).length > 5, 'steep roofs carry dormers');
  assert.ok(liste.filter((h) => h.kleid.aufbauten.some((a) => a.art === 'schornstein')).length > 100, 'saddle roofs carry chimneys');
  assert.deepEqual(kleideViertel(viertel({ features: [...gebaeude.features].reverse() }, frame, { wege }), saetze).map((h) => [h.oid, h.kleid.satz?.id ?? null, h.wand.farbe]), liste.map((h) => [h.oid, h.kleid.satz?.id ?? null, h.wand.farbe]), 'the same quarter from the same data');
  assert.ok(ecken < 400000 && dreiecke < 200000, `a mesh a tablet can draw (${ecken} corners, ${dreiecke} triangles)`);
});

test('houses: triangles fill a footprint with a yard exactly; the rectangle and the light are right', () => {
  const aussen = saeubere(kiste(0, 0, 20, 16)), hof = saeubere(kiste(6, 5, 14, 11), false);
  const { punkte, dreiecke } = trianguliere(aussen, [hof]);
  const summe = dreiecke.reduce((s, t) => s + flaeche(t.map((i) => punkte[i])), 0);
  assert.ok(Math.abs(summe - (320 - 48)) < 1e-9, `area ${summe}`);
  for (const t of dreiecke) assert.ok(flaeche(t.map((i) => punkte[i])) > 0);
  const [h] = baue([{ ...haus('hofhaus', kiste(0, 0, 20, 16)), geometry: { type: 'Polygon', coordinates: [[...kiste(0, 0, 20, 16), [0, 0]], [...kiste(6, 5, 14, 11), [6, 5]]].map((r) => r.map(([x, y]) => [E0 + x, N0 + y])) } }]);
  assert.equal(h.flaeche, 272);
  pruefe(h, netz(h));
  const r = rechteck(saeubere([[0, 0], [3, 4], [-1, 7], [-4, 3]]));
  assert.ok(Math.abs(r.halb[0] - 2.5) < 1e-9 && Math.abs(r.halb[1] - 2.5) < 1e-9);
  const l = lichtvektor(90, 45);
  assert.ok(Math.abs(l[0] - Math.SQRT1_2) < 1e-9 && Math.abs(l[1]) < 1e-9 && Math.abs(l[2] - Math.SQRT1_2) < 1e-9, 'sun in the east, half way up');
  assert.equal(achsen(1), 0);
  assert.equal(achsen(ACHSE * 3), 3);
});

test('houses: measured roofs (LoD2) set eaves, ridge, form and ridge direction; without them the rules estimate', () => {
  const ring = kiste(-8, -5, 8, 5), lang = baue([haus('L1', ring)])[0]; // 16 × 10 m: the rules put the ridge along the long side (east)
  assert.equal(lang.dach.form, 'sattel');
  assert.ok(Math.abs(lang.dach.u[0]) > 0.99, 'estimated ridge along the long side');
  const daecher = { haeuser: { L1: { form: 'sattel', dachform: 'Satteldach', traufe_m: 18.4, first_m: 22.9, first: [0, 1] }, W1: { form: 'walm', dachform: 'Walmdach', traufe_m: 9, first_m: 12 } } };
  const [h, w] = viertel({ features: [haus('L1', ring), haus('W1', kiste(30, -5, 46, 5))] }, frame, { daecher });
  assert.deepEqual([h.traufe, h.dach.form, h.hoeheQuelle], [18.4, 'sattel', 'gemessen (LoD2, LGLN)']);
  assert.deepEqual([w.dach.form, w.dachAngabe], ['walm', 'Walmdach (LoD2)'], 'the measured form wins over OSM');
  assert.ok(Math.abs(h.dach.u[1]) > 0.99, 'the measured ridge runs north, across the rules\' choice');
  assert.equal(h.etagen, 5, 'storeys of an old building: 18.4 m are five, not the four of OSM');
  assert.ok(Math.abs(h.first - 22.9) < 0.6, `ridge near the measured 22.9 m (${h.first})`);
  const ohne = viertel({ features: [haus('L1', ring)] }, frame, { daecher: { haeuser: {} } })[0];
  assert.equal(ohne.hoeheQuelle, lang.hoeheQuelle, 'a house without a measured roof keeps the estimate');
});

test('houses: a building the LoD2 model knows in parts is built part by part, but stays one building', () => {
  const saetze = JSON.parse(fs.readFileSync('assets/welt/haeuser/bausaetze.json', 'utf8')), daecher = json('daecher.json');
  const liste = kleideViertel(viertel(gebaeude, frame, { wege, daecher }), saetze);
  const nach = new Map();
  for (const h of liste) (nach.get(h.oid) ?? nach.set(h.oid, []).get(h.oid)).push(h);
  let geteilt = 0, stufen = 0;
  for (const [oid, teile] of nach) {
    if (teile.length < 2 || !teile[0].teilVon) continue;
    geteilt++;
    assert.equal(new Set(teile.map((h) => h.wand.farbe)).size, 1, `${oid}: one colour`);
    assert.equal(new Set(teile.map((h) => h.kleid.satz?.id ?? null)).size, 1, `${oid}: one kit`);
    const tueren = teile.reduce((n, h) => n + h.kleid.laeufe.filter((l) => l.bild.spalten.includes(l.satz.mitte)).length, 0);
    assert.ok(tueren <= 1, `${oid}: at most one door (${tueren})`);
    const traufen = teile.map((h) => h.traufe);
    if (Math.max(...traufen) - Math.min(...traufen) > 3) stufen++;
  }
  assert.ok(geteilt >= 80, `${geteilt} buildings in parts`);
  assert.ok(stufen >= 10, `${stufen} of them with parts of clearly different height`);
});

test('houses: the façade relief lifts frames, sills and cornices out of the wall, in the façade\'s own pixels', () => {
  const saetze = JSON.parse(fs.readFileSync('assets/welt/haeuser/bausaetze.json', 'utf8')), blatt = packe(saetze);
  const liste = kleideViertel(viertel(gebaeude, frame, { wege, daecher: json('daecher.json') }), saetze);
  const tiefste = Math.max(RELIEF.rahmen, RELIEF.bank, RELIEF.gesims);
  /** Distance of a point from the footprint's outline (metres). */
  const abstand = ([x, y], ring) => Math.min(...ring.map((a, i) => { const b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy); }));
  let ecken = 0, mitRelief = 0, tiefen = new Set();
  for (const h of liste) {
    h.kleid.lage = blatt.lage;
    const m = relief(h), P = m.positionen, N = m.normalen, W = m.wand, B = m.bau;
    if (!h.kleid.satz) { assert.equal(m.indizes.length, 0, `${h.oid}: no kit, no relief`); continue; }
    if (!m.indizes.length) continue;
    mitRelief++; ecken += P.length / 3;
    for (let i = 0; i < m.indizes.length; i += 3) { // every triangle faces the way its normal says
      const [a, b, c] = [0, 1, 2].map((k) => m.indizes[i + k]), p = (j) => [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]];
      const A = p(a), u = p(b).map((x, k) => x - A[k]), v = p(c).map((x, k) => x - A[k]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(...n);
      if (l > 1e-9) assert.ok((n[0] * N[a * 3] + n[1] * N[a * 3 + 1] + n[2] * N[a * 3 + 2]) / l > 0.99, `${h.oid}: a relief face looks the way its normal says`);
    }
    for (let j = 0; j < P.length / 3; j++) {
      const q = [P[j * 3], P[j * 3 + 1], P[j * 3 + 2]], d = abstand(q, h.ring);
      assert.ok(q[2] >= -1e-6 && q[2] <= h.traufe + 1e-6, `${h.oid}: relief between the ground and the eaves`);
      assert.ok(d <= tiefste + 1e-6, `${h.oid}: relief at most ${tiefste} m in front of the wall (${d.toFixed(3)})`);
      if (d > 0.01) tiefen.add(Math.round(d * 100) / 100);
      // every face shows pixels of its own cell of the façade sheet (the flat wall's cell)
      assert.ok(W[j * 4] >= B[j * 4] - 0.51 && W[j * 4] <= B[j * 4 + 2] + 0.51 && W[j * 4 + 1] >= B[j * 4 + 1] - 0.51 && W[j * 4 + 1] <= B[j * 4 + 3] + 0.51, `${h.oid}: relief pixels inside their cell`);
    }
  }
  for (const t of [RELIEF.rahmen, RELIEF.bank, RELIEF.gesims]) assert.ok(tiefen.has(t), `parts stand out ${t} m (frames, sills, cornices)`);
  assert.ok(mitRelief > 40, `${mitRelief} houses round the court have relief`);
  assert.ok(ecken < 160000, `a relief a tablet can draw (${ecken} corners)`);
  // a yard building and a house far from the court stay flat
  const fern = liste.find((h) => h.kleid.satz && Math.hypot((h.kasten[0] + h.kasten[2]) / 2, (h.kasten[1] + h.kasten[3]) / 2) > RELIEF.umkreis + 60);
  assert.equal(relief(fern).indizes.length, 0, 'beyond the circle round the court: no relief');
  assert.ok(relief(fern, { umkreis: Infinity, hof: true }).indizes.length > 0, 'but it has relief when asked for');
});
