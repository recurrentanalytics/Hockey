// Walls of the playable neighbourhood (src/welt/hindernisse.js), built from the real geodata.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { baueHindernisse, loese, davor, oeffne, imHaus, aufDemPlatz, KOERPER } from '../src/welt/hindernisse.js';
import { schritt } from '../src/welt/spieler.js';

const json = (n) => JSON.parse(fs.readFileSync(`locations/boni/geo/${n}`, 'utf8'));
const frame = json('rahmen.json');
const welt = baueHindernisse({ gebaeude: json('gebaeude.geojson'), einfriedungen: json('einfriedungen.geojson'), platz: json('platz.geojson'), frame });
const gehe = (von, richtung, sekunden) => { const z = { ab: von, tasten: richtung, ziel: null, rechts: true, faehrt: false, phase: 0 }; for (let i = 0; i < sekunden * 60; i++) { schritt(z, 1 / 60, [], welt); assert.ok(!welt.haeuser.some((h) => imHaus(z.ab, h)), `inside a building at ${z.ab}`); } return z.ab; };

test('obstacles: a gate cuts an opening into a fence, nothing else does', () => {
  assert.deepEqual(oeffne([0, 0, 10, 0], []), [[0, 0, 10, 0]]);
  const offen = oeffne([0, 0, 10, 0], [[5, 0.3]]);
  assert.equal(offen.length, 2);
  assert.ok(Math.abs(offen[0][2] - 3.5) < 1e-9 && Math.abs(offen[1][0] - 6.5) < 1e-9);
  assert.deepEqual(oeffne([0, 0, 10, 0], [[5, 4]]), [[0, 0, 10, 0]], 'a gate four metres away is not on this fence');
});

test('obstacles: the court fence holds on the long sides and lets the player out at the entrances', () => {
  assert.ok(welt.segmente.length > 1000 && welt.haeuser.length > 200);
  const lang = gehe([0, 0], [0, 1], 4);                       // the middle of a long side is closed
  assert.ok(lang[1] < 9 - KOERPER + 0.4, `went through the fence: b = ${lang[1]}`);
  const hippo = gehe([0, 0], [0, -1], 4);                      // also towards the hippo
  assert.ok(hippo[1] > -9 + KOERPER - 0.4, `went through the hippo side: b = ${hippo[1]}`);
  const kurz = gehe([0, 0], [-1, 0], 4);                      // the short sides hold the goals: closed
  assert.ok(kurz[0] > -12.6 + KOERPER - 0.4, `went through the goal end: a = ${kurz[0]}`);
  assert.ok(aufDemPlatz([0, 0]) && !aufDemPlatz([14, 0]));
  // out through each real entrance: hippo side right end, opposite side both ends
  for (const [a, richtung] of [[10.9, -1], [-10.9, 1], [10.9, 1]]) {
    const raus = gehe([a, 0], [0, richtung], 4);
    assert.ok(Math.abs(raus[1]) > 10.5, `stopped at the entrance at a = ${a}: b = ${raus[1]}`);
  }
  const zu = gehe([-10.9, 0], [0, -1], 4);                    // the hippo side's left end is closed
  assert.ok(zu[1] > -9 + KOERPER - 0.4, `went through the closed end: b = ${zu[1]}`);
});

test('obstacles: buildings stop the player from every side', () => {
  const haus = welt.haeuser.find((h) => h.box[2] - h.box[0] > 12 && h.box[3] - h.box[1] > 12);
  let innen = null;
  for (let x = haus.box[0]; x < haus.box[2] && !innen; x += 1) for (let y = haus.box[1]; y < haus.box[3]; y += 1) if (imHaus([x, y], haus)) { innen = [x, y]; break; }
  assert.ok(innen);
  assert.deepEqual(loese(innen, [haus.box[0] - 5, haus.box[1] - 5], welt), [haus.box[0] - 5, haus.box[1] - 5], 'a step into a building is refused');
  for (const richtung of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1]]) gehe([0, 0], richtung, 25); // 137 m each way: never inside a house
});

test('obstacles: a building between the camera and the player is found, one behind the player is not', () => {
  const haus = welt.haeuser.find((h) => h.box[2] - h.box[0] > 12 && h.hoehe >= 10);
  const mitte = (haus.box[0] + haus.box[2]) / 2;
  assert.ok(davor([mitte, haus.box[3] + 3], welt).has(haus.id), 'player right behind the building, camera in front');
  assert.ok(!davor([mitte, haus.box[1] - 3], welt).has(haus.id), 'player in front of the building');
});
