// Sprites from the art library (assets/manifest.json) in the world view. An asset says in the
// manifest where it belongs (`place`) and how tall it stands (`worldHeight`, metres); nothing is
// positioned by hand. `place.layer` + `place.match` puts it on every matching point of a geodata
// layer (a tree on every mapped tree), `place.court` at court metres. Only assets the owner has
// approved are used, unless the page runs with ?preview=art.
const ASSETS = new URL('../../assets/', import.meta.url);
// The Borstentiere kit (docs/art/README.md) for sprites that carry team colours
export const KIT = { main: '#1b4a2e', shade: '#0d2c1b', trim: '#ecd9a4', trimShade: '#b8460f', helmet: '#245a38', helmetShade: '#12331f', pants: '#2e2118', pantsShade: '#1a120c' };

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

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

/** Frames of an asset as image URLs: recoloured to the kit, enlarged with hard pixels. */
export async function frameImages(asset, mirror = false) {
  const img = new Image();
  img.src = new URL(asset.file, ASSETS).href;
  await img.decode();
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

/** Add every usable asset to `entities`; returns how many sprites stand in the world. */
export async function placeLibrary({ Cesium, entities, manifest, geo, frame, pos, preview, skip = () => false }) {
  let count = 0;
  for (const asset of usable(manifest, preview)) {
    if (skip(asset)) continue; // trees and the player have systems of their own
    const frames = await frameImages(asset);
    const h = asset.worldHeight, w = (h * asset.frame.w) / asset.frame.h;
    const image = frames.length > 1 ? new Cesium.CallbackProperty(() => frames[Math.floor(performance.now() / 110) % frames.length], false) : frames[0];
    const text = `${asset.id}\n${asset.approved ? 'freigegeben am ' + asset.approved.date : 'wartet auf Freigabe (nur mit ?preview=art sichtbar)'}\n${w.toFixed(2)} × ${h} m in der Welt`;
    for (const en of spots(asset, geo, frame)) {
      entities.add({ position: pos(en, 0), billboard: { image, sizeInMeters: true, width: w, height: h, verticalOrigin: Cesium.VerticalOrigin.BOTTOM }, properties: { text } });
      count++;
    }
  }
  return count;
}
