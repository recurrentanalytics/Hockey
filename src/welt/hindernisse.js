// What stops the player, taken straight from the place's geodata (court metres): building walls,
// mapped walls, fences and hedges with their gates, and the court fence with its entrances.
// Passages through buildings (ALKIS "Bauteil": Durchfahrt, Arkade) stay open. Pure rules, tested under Node.
import { platzmeter } from './baeume.js';

export const KOERPER = 0.3;          // the player's radius, m
export const TORBREITE = 3;          // opening left at a mapped gate, m
/** Entrances of the court fence. Not in any dataset and not on the intro's court model: assumed in the
 *  middle of both long sides. The short sides carry the football goals. */
export const PLATZ_EINGAENGE = [[0, -9], [0, 9]];
const ZELLE = 8;

/** Cut an opening of TORBREITE into a segment where a gate lies on it. Returns the remaining pieces. */
export function oeffne([ax, ay, bx, by], tore, breite = TORBREITE) {
  const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy);
  if (l < 1e-6) return [];
  let stuecke = [[0, 1]];
  for (const [gx, gy] of tore) {
    const t = ((gx - ax) * dx + (gy - ay) * dy) / (l * l);
    if (t < -0.02 || t > 1.02 || Math.hypot(ax + t * dx - gx, ay + t * dy - gy) > 1.2) continue;
    const h = breite / 2 / l;
    stuecke = stuecke.flatMap(([s, e]) => [[s, Math.min(e, t - h)], [Math.max(s, t + h), e]].filter(([u, v]) => v - u > 1e-6));
  }
  return stuecke.map(([s, e]) => [ax + s * dx, ay + s * dy, ax + e * dx, ay + e * dy]);
}

/** Collect walls (segments in a grid) and building outlines (for the inside test and for hiding). */
export function baueHindernisse({ gebaeude, einfriedungen, platz, frame }) {
  const m = (p) => platzmeter(frame, p), segmente = [], haeuser = [];
  const ringe = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
  for (const f of gebaeude.features) {
    if (f.properties.art === 'Bauteil') continue;                       // passage or arcade: open at street level
    for (const poly of ringe(f.geometry)) {
      const r = poly.map((ring) => ring.map(m));
      for (const ring of r) for (let i = 0; i < ring.length - 1; i++) segmente.push([...ring[i], ...ring[i + 1]]);
      const xs = r[0].map((p) => p[0]), ys = r[0].map((p) => p[1]);
      haeuser.push({ id: f.properties.oid, ringe: r, hoehe: f.properties.hoehe_m ?? 10, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
    }
  }
  const tore = einfriedungen.features.filter((f) => f.geometry.type === 'Point' && ['gate', 'entrance', 'lift_gate', 'swing_gate'].includes(f.properties.barrier)).map((f) => m(f.geometry.coordinates));
  for (const f of einfriedungen.features) {
    if (f.geometry.type !== 'LineString') continue;
    const l = f.geometry.coordinates.map(m);
    for (let i = 0; i < l.length - 1; i++) segmente.push(...oeffne([...l[i], ...l[i + 1]], tore));
  }
  const zaun = platz.features.find((f) => f.properties.art === 'zaun');
  if (zaun) { const l = zaun.geometry.coordinates[0].map(m); for (let i = 0; i < l.length - 1; i++) segmente.push(...oeffne([...l[i], ...l[i + 1]], PLATZ_EINGAENGE)); }
  const gitter = new Map();
  segmente.forEach(([ax, ay, bx, by], k) => {
    for (let gx = Math.floor(Math.min(ax, bx) / ZELLE); gx <= Math.floor(Math.max(ax, bx) / ZELLE); gx++)
      for (let gy = Math.floor(Math.min(ay, by) / ZELLE); gy <= Math.floor(Math.max(ay, by) / ZELLE); gy++) { const key = gx + ',' + gy; (gitter.get(key) ?? gitter.set(key, []).get(key)).push(k); }
  });
  return { segmente, gitter, haeuser };
}

const imRing = ([x, y], ring) => { let d = false; for (let i = 0; i < ring.length - 1; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[i + 1]; if ((y1 > y) !== (y2 > y) && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) d = !d; } return d; };
export const imHaus = (p, h) => p[0] >= h.box[0] && p[0] <= h.box[2] && p[1] >= h.box[1] && p[1] <= h.box[3] && imRing(p, h.ringe[0]) && !h.ringe.slice(1).some((r) => imRing(p, r));

/** Move to `nach` unless a wall is in the way: pushed back to KOERPER from every wall nearby; never ends inside a building. */
export function loese(nach, vorher, welt, r = KOERPER) {
  let [x, y] = nach;
  for (let runde = 0; runde < 3; runde++) {
    let beruehrt = false;
    const gx = Math.floor(x / ZELLE), gy = Math.floor(y / ZELLE), gesehen = new Set();
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const k of welt.gitter.get(gx + i + ',' + (gy + j)) ?? []) {
      if (gesehen.has(k)) continue; gesehen.add(k);
      const [ax, ay, bx, by] = welt.segmente[k], dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
      const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(x - px, y - py);
      if (d < r) {
        if (d > 1e-6) { x = px + ((x - px) / d) * r; y = py + ((y - py) / d) * r; } else { x = vorher[0]; y = vorher[1]; }
        beruehrt = true;
      }
    }
    if (!beruehrt) break;
  }
  return welt.haeuser.some((h) => imHaus([x, y], h)) ? vorher : [x, y];
}

/** Ids of the buildings that stand between the game camera and the point, so they can be drawn see-through. */
export function davor(punkt, welt, blick = [0, 1], neigung = 60) {
  const ids = new Set(), k = Math.tan((neigung * Math.PI) / 180);
  for (let s = 1; s <= 60; s += 1.5) {
    const p = [punkt[0] - blick[0] * s, punkt[1] - blick[1] * s];
    for (const h of welt.haeuser) if (!ids.has(h.id) && s < h.hoehe * k && imHaus(p, h)) ids.add(h.id);
  }
  return ids;
}

export const aufDemPlatz = ([a, b]) => Math.abs(a) < 12.3 && Math.abs(b) < 8.7;
