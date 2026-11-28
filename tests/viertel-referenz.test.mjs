// The built quarter must not change unnoticed: what the engine-neutral rules (src/bau/haus.js) make of every
// house of the real data, compared with tests/referenz/viertel.json. The same file is the yardstick for any
// later generator. Rewrite it on purpose with UPDATE_REFERENZ=1.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { baueReferenz, DATEI } from '../tools/test/viertel-referenz.mjs';

test('quarter: every house is built exactly as in the reference (body, roof, colours, kits, wall runs, mesh)', () => {
  const haeuser = baueReferenz();
  if (process.env.UPDATE_REFERENZ) {
    fs.writeFileSync(DATEI, JSON.stringify({ stand: 'Referenz des gebauten Viertels (tools/test/viertel-referenz.mjs)', haeuser }).replace(/},{"schluessel"/g, '},\n{"schluessel"') + '\n');
    return;
  }
  const ref = JSON.parse(fs.readFileSync(DATEI, 'utf8')).haeuser;
  assert.equal(haeuser.length, ref.length, 'as many houses');
  const nach = new Map(ref.map((h) => [h.schluessel, h]));
  for (const h of haeuser) assert.deepEqual(h, nach.get(h.schluessel), `house ${h.schluessel}`);
});

test('quarter: the rules of a house are engine-neutral (no CesiumJS, no DOM, nothing of the 3D view)', () => {
  for (const f of fs.readdirSync('src/bau')) {
    const code = fs.readFileSync(path.join('src/bau', f), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const verboten of [/\bCesium\b/, /\bdocument\b/, /\bwindow\b/, /\bImageData\b/, /from ['"]\.\.\/welt\//, /from ['"]\.\.\/(scenes|world|game)\//]) assert.doesNotMatch(code, verboten, `${f} uses ${verboten}`);
  }
});
