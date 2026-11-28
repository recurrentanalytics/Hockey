// Sprites from the art library (assets/manifest.json) in the world view. An asset says in the
// manifest where it belongs (`place`) and how tall it stands (`worldHeight`, metres); nothing is
// positioned by hand. `place.layer` + `place.match` puts it on every matching point of a geodata
// layer (a tree on every mapped tree), `place.court` at court metres. Only assets the owner has
// approved are used, unless the page runs with ?preview=art.
const ASSETS = new URL('../../assets/', import.meta.url);
// The Borstentiere kit (docs/art/README.md) for sprites that carry team colours
export const KIT = { main: '#1b4a2e', shade: '#0d2c1b', trim: '#ecd9a4', trimShade: '#b8460f', helmet: '#245a38', helmetShade: '#12331f', pants: '#2e2118', pantsShade: '#1a120c' };
import { ladeBild } from './bild.js';

export const usable = (manifest, preview) => manifest.assets.filter((a) => (a.approved || preview) && a.place && a.worldHeight);

/** The grid positions an asset stands on. */
export function spots(asset, geo, frame) {
  const p = asset.place;
  if (p.court) {
    const [e0, n0] = frame.ursprung_utm32, a = frame.achse_a, b = frame.achse_b;
    return [[e0 + p.court[0] * a[0] + p.court[1] * b[0], n0 + p.court[0] * a[1] + p.court[1] * b[1]]];
  }
  return (geo[p.layer]?.features ?? [])
    .filter((f) => f.geometry.type === 'Point' && Object.entries(p.match ?? {}).every(([k, v]) => String(f.properties[k]) === String(v)))
    .map((f) => f.geometry.coordinates);
}

const imRing = ([x, y], ring) => { let d = false; for (let i = 0; i < ring.length; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length]; if ((y1 > y) !== (y2 > y) && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) d = !d; } return d; };
const imVieleck = (p, [aussen, ...loecher]) => imRing(p, aussen) && !loecher.some((l) => imRing(p, l));

/** The carriageways of a place: the survey's land use "Straßenverkehr" without a closer name (as the drawn ground takes them, boden.js). */
export const fahrbahnen = (nutzung) => (nutzung?.features ?? []).filter((f) => f.properties.nutzart === 'Straßenverkehr' && !f.properties.bezeichnung)
  .flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []));

/**
 * Nothing stands on a carriageway. A mapped point that lies on one (a lamp hung over the middle of the street, a
 * bicycle stand in the parking lane) is moved to the nearest spot `abstand` metres behind the kerb that is neither
 * carriageway nor house; if there is none within `weit` metres, the point is left out (null). A point that stands
 * off the carriageway stays where it is mapped.
 * `fahrbahn`: polygons (outer ring, holes), `haeuser`: outer rings of the footprints, all in grid metres.
 */
export function vomFahrdamm(en, fahrbahn, haeuser = [], abstand = 0.7, weit = 12) {
  if (!fahrbahn.some((v) => imVieleck(en, v))) return en;
  const frei = (p) => !fahrbahn.some((v) => imVieleck(p, v)) && !haeuser.some((r) => imRing(p, r));
  const ziele = [];
  for (const v of fahrbahn) for (const ring of v) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((en[0] - a[0]) * dx + (en[1] - a[1]) * dy) / l2)) : 0, q = [a[0] + dx * t, a[1] + dy * t], d = Math.hypot(q[0] - en[0], q[1] - en[1]);
    if (d <= weit && d > 1e-6) ziele.push([d, q]);
  }
  ziele.sort((x, y) => x[0] - y[0]);
  for (const [d, q] of ziele) {
    const p = [q[0] + ((q[0] - en[0]) / d) * abstand, q[1] + ((q[1] - en[1]) / d) * abstand];
    if (frei(p)) return [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100];
  }
  return null;
}

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Frames of an asset as image URLs: recoloured to the kit, enlarged with hard pixels. */
export async function frameImages(asset, mirror = false) {
  const img = await ladeBild(new URL(asset.file, ASSETS).href);
  const { w, h } = asset.frame, n = asset.frames ?? 1, scale = Math.max(1, Math.round(256 / h));
  const sheet = Object.assign(document.createElement('canvas'), { width: w * n, height: h });
  const g = sheet.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  if (asset.teamColors) {
    const swap = new Map(Object.entries(asset.teamColors).map(([from, to]) => [hex(from).join(), hex(KIT[to] ?? KIT[to.replace(/Shade$/, '')])]));
    const data = g.getImageData(0, 0, sheet.width, sheet.height), d = data.data;
    for (let i = 0; i < d.length; i += 4) { const to = d[i + 3] && swap.get(`${d[i]},${d[i + 1]},${d[i + 2]}`); if (to) [d[i], d[i + 1], d[i + 2]] = to; }
    g.putImageData(data, 0, 0);
  }
  return Array.from({ length: n }, (_, f) => {
    const c = Object.assign(document.createElement('canvas'), { width: w * scale, height: h * scale });
    const cg = c.getContext('2d');
    cg.imageSmoothingEnabled = false;
    if (mirror) { cg.translate(c.width, 0); cg.scale(-1, 1); }
    cg.drawImage(sheet, f * w, 0, w, h, 0, 0, c.width, c.height);
    return c.toDataURL(); // a URL, so the 3D library keeps one texture per frame instead of one per swap
  });
}

/** A billboard's id in the shape of an entity, so clicking it shows its text like any other object of the world view. */
export const klickInfo = (text) => ({ properties: { text: { getValue: () => text } } });

/**
 * Add every usable asset to the world; returns how many sprites stand in it. Still sprites go into `billboards`
 * (one BillboardCollection: drawn together, nothing evaluated per frame); animated ones stay `entities`.
 * `stelle(en)` may move a mapped point or drop it (null): see vomFahrdamm.
 */
export async function placeLibrary({ Cesium, entities, billboards = null, manifest, geo, frame, pos, preview, skip = () => false, stelle = (en) => en }) {
  let count = 0;
  for (const asset of usable(manifest, preview)) {
    if (skip(asset)) continue; // trees and the player have systems of their own
    const frames = await frameImages(asset);
    const h = asset.worldHeight, w = (h * asset.frame.w) / asset.frame.h;
    const image = frames.length > 1 ? new Cesium.CallbackProperty(() => frames[Math.floor(performance.now() / 110) % frames.length], false) : frames[0];
    const text = `${asset.id}\n${asset.approved ? 'freigegeben am ' + asset.approved.date : 'wartet auf Freigabe (nur mit ?preview=art sichtbar)'}\n${w.toFixed(2)} × ${h} m in der Welt`;
    for (const mapped of spots(asset, geo, frame)) {
      const en = asset.place.court ? mapped : stelle(mapped); // a mapped thing may be moved off the carriageway, or left out (welt.js)
      if (!en) continue;
      if (billboards && frames.length === 1) billboards.add({ position: pos(en, 0), image, sizeInMeters: true, width: w, height: h, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, id: klickInfo(text) });
      else entities.add({ position: pos(en, 0), billboard: { image, sizeInMeters: true, width: w, height: h, verticalOrigin: Cesium.VerticalOrigin.BOTTOM }, properties: { text } });
      count++;
    }
  }
  return count;
}
