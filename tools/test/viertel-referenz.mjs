#!/usr/bin/env node
// The built quarter as data: for every house of locations/boni/geo/gebaeude.geojson what the rules make of it
// with the measured roofs (daecher.json) as in the world view (body, storeys, roof, colours, kit, every wall run with its columns and rows, roof parts) and a hash of its mesh.
// This is the engine-neutral result of src/bau/haus.js. tests/viertel-referenz.test.mjs compares it with
// tests/referenz/viertel.json, so moving or rewriting the rules cannot change a single house unnoticed; the same
// file is the yardstick for any later generator (glTF, Godot). Rewrite the file on purpose with
//   UPDATE_REFERENZ=1 node --test tests/viertel-referenz.test.mjs   (or: node tools/test/viertel-referenz.mjs --schreiben)
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { viertel, kleideViertel, packe, netz } from '../../src/bau/haus.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DATEI = path.join(ROOT, 'tests/referenz/viertel.json');
const r = (v, n = 3) => Math.round(v * 10 ** n) / 10 ** n;

/** Hash of a mesh, rounded so that floating-point noise of a different machine does not count. */
function netzHash(m) {
  const h = crypto.createHash('sha256');
  for (const [name, werte, n] of [['p', m.positionen, 4], ['n', m.normalen, 4], ['w', m.wand, 4], ['b', m.bau, 4], ['f', m.farbe, 4], ['i', m.indizes, 0]]) h.update(name + Array.from(werte, (v) => r(v, n)).join(','));
  return h.digest('hex').slice(0, 16);
}

/** The quarter as the rules build it today, one plain object per house. */
export function baueReferenz() {
  const j = (n) => JSON.parse(fs.readFileSync(path.join(ROOT, 'locations/boni/geo', n), 'utf8'));
  const saetze = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/welt/haeuser/bausaetze.json'), 'utf8'));
  const liste = kleideViertel(viertel(j('gebaeude.geojson'), j('rahmen.json'), { wege: j('wege.geojson'), daecher: j('daecher.json') }), saetze), blatt = packe(saetze);
  return liste.map((h) => {
    h.kleid.lage = blatt.lage;
    const m = netz(h), k = h.kleid;
    return {
      schluessel: h.schluessel, oid: h.oid, art: h.art, eg: h.eg, flaeche: r(h.flaeche, 2),
      etagen: h.etagen, traufe: r(h.traufe), first: r(h.first), egHoehe: r(h.egHoehe),
      dach: { form: h.dach.form, hoehe: r(h.dach.hoehe ?? 0), farbe: h.dach.farbe ?? null },
      wand: h.wand, nachbarn: [...h.nachbarn].length, durchfahrten: h.durchfahrten.length,
      satz: k?.satz?.id ?? null,
      laeufe: (k?.laeufe ?? []).map((l) => ({ art: l.art, laenge: r(l.laenge), satz: l.satz?.id ?? null, spalten: l.bild?.spalten ?? null, zeilen: l.zeilen, gestreckt: l.bild?.gestreckt ?? null })),
      aufbauten: (k?.aufbauten ?? []).map((a) => ({ art: a.art, mitte: a.mitte.map((v) => r(v, 2)) })),
      netz: { ecken: m.positionen.length / 3, dreiecke: m.indizes.length / 3, hash: netzHash(m) },
    };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const haeuser = baueReferenz();
  if (process.argv.includes('--schreiben')) { fs.writeFileSync(DATEI, JSON.stringify({ stand: 'Referenz des gebauten Viertels (tools/test/viertel-referenz.mjs)', haeuser }, null, 0).replace(/},{"schluessel"/g, '},\n{"schluessel"') + '\n'); console.log('geschrieben:', path.relative(ROOT, DATEI), haeuser.length, 'Häuser'); }
  else console.log(haeuser.length, 'Häuser');
}
