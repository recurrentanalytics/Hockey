// The place's own copy of the aerial photo (assets/welt/boni_umgebung.jpg, 1.2 km round the court at
// 0.5 m per pixel, with its extent in boni_umgebung.json). The world stands on this copy, so it does not
// depend on the LGLN service answering; the live service only sharpens it while it is reachable.
import { fromUtm32 } from './utm.js';
import { ladeBild } from './bild.js';

export async function ladeLuftbild(assets) {
  const meta = await (await fetch(new URL('welt/boni_umgebung.json', assets))).json();
  return { img: await ladeBild(new URL('welt/' + meta.datei, assets).href), meta };
}

/** Longitude/latitude rectangle of `halb` metres round a grid position. */
export function rechteck([e, n], halb) {
  const [lon, lat] = fromUtm32(e, n), dLat = halb / 111320, dLon = halb / (111320 * Math.cos((lat * Math.PI) / 180));
  return { west: lon - dLon, east: lon + dLon, south: lat - dLat, north: lat + dLat };
}

/** Where the photo's grid corners fall in a px × px picture of the rectangle: [top-left, top-right, bottom-left]. */
export function ecken(meta, { west, south, east, north }, px) {
  const [uw, us, ue, un] = meta.utm32;
  return [[uw, un], [ue, un], [uw, us]].map(([e, n]) => { const [lo, la] = fromUtm32(e, n); return [((lo - west) / (east - west)) * px, ((north - la) / (north - south)) * px]; });
}

/** The part of the photo that covers the rectangle, as a canvas of px × px (north up in longitude/latitude). */
export function ausschnitt({ img, meta }, rect, px, filter = 'none') {
  const [t0, t1, t2] = ecken(meta, rect, px), W = meta.pixel[0], H = meta.pixel[1];
  const c = Object.assign(document.createElement('canvas'), { width: px, height: px }), g = c.getContext('2d', { willReadFrequently: true });
  g.filter = filter; g.imageSmoothingQuality = 'high';
  // the photo is north-up in the grid, the picture north-up on the globe: half a degree apart here, so it is turned, not just cropped
  g.setTransform((t1[0] - t0[0]) / W, (t1[1] - t0[1]) / W, (t2[0] - t0[0]) / H, (t2[1] - t0[1]) / H, t0[0], t0[1]);
  g.drawImage(img, 0, 0);
  g.setTransform(1, 0, 0, 1, 0, 0); g.filter = 'none';
  return c;
}
