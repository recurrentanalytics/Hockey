// The ground round the court as pixel art, made from the real aerial photo: the place's own copy, laid on a world-fixed pixel grid, reduced to the BORSTENBOOM palette
// with ordered dithering, outlined along the real mapped edges, and dissolved into the untouched
// photo with a dithered mask that follows the court and the square. Geometry is never moved: the
// picture keeps the photo's own georeference, outlines are the survey's own lines.
import { ausschnitt } from './luftbild.js';
import { toUtm32, fromUtm32 } from './utm.js';

/** Warm palette of the art standard (docs/art/README.md), plus the greys and browns the square needs. */
export const PALETTE = ['#2a1d1a', '#f7efdc', '#d9c79a', '#b9b3a4', '#8f8b86', '#7d7868', '#5d5a57', '#4b4a52', '#8fbf6a', '#6f9e4c', '#3f6b3a', '#2c4a2a', '#e2a742', '#a8763f', '#6b4a2f', '#c8553d', '#8a3324']
  .map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered-dither threshold in (0, 1) for a grid cell. */
export const schwelle = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

export function naechste(r, g, b, palette = PALETTE) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < palette.length; i++) { const p = palette[i], d = (r - p[0]) ** 2 * 2 + (g - p[1]) ** 2 * 4 + (b - p[2]) ** 2 * 3; if (d < bd) { bd = d; best = i; } }
  return palette[best];
}

/** Distance in metres from a point (court metres) to the fenced court; 0 inside. */
export function abstandPlatz(a, b, halbA = 12.6, halbB = 9) { return Math.hypot(Math.max(0, Math.abs(a) - halbA), Math.max(0, Math.abs(b) - halbB)); }

/** How much pixel art (0..1) at a distance from the court: all of it up to 6 m, then a soft fall; it reaches further on the square itself. */
export function maske(abstand, aufDemPlatz) {
  const weit = aufDemPlatz ? 62 : 26, t = Math.min(1, Math.max(0, (abstand - 6) / (weit - 6)));
  return 1 - t * t * (3 - 2 * t);
}

/** Asphalt tones for the court floor: the photo's light and dark survive, its colour noise does not. */
/** How much of the aerial photo's light and shade stays on the court's asphalt (0: one flat tone, 1: as photographed). */
export const PLATZ_FOTO = 0.35;
export const ASPHALT = ['#b9b3a4', '#9a958c', '#8f8b86', '#7d7868', '#5d5a57'].map((h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)));
const LINIE = { weiss: [247, 239, 220] };
/**
 * The court's real floor markings in court metres, as reconstructed from the club's photos for the intro's
 * court model (tools/intro/court_glb.py): a white frame half a metre inside the fence, centre line,
 * centre circle of 3 m and arcs of 6 m in front of both goals. Returns a colour or null.
 */
export function markierung(a, b, zelle = 0.25, feld = { halbA: 12.1, halbB: 8.5, kreis: 3, bogen: 6 }) {
  const aa = Math.abs(a), bb = Math.abs(b), w = zelle * 0.75;
  if (aa > feld.halbA + w || bb > feld.halbB + w) return null;
  if (aa > feld.halbA - w || bb > feld.halbB - w) return LINIE.weiss;        // frame
  if (aa < w) return LINIE.weiss;                                             // centre line
  if (Math.abs(Math.hypot(a, b) - feld.kreis) < w) return LINIE.weiss;        // centre circle
  if (Math.abs(Math.hypot(aa - feld.halbA, b) - feld.bogen) < w) return LINIE.weiss; // arcs in front of the goals
  return null;
}

export function imVieleck([x, y], ring) {
  let drin = false;
  for (let i = 0; i < ring.length - 1; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[i + 1]; if ((y1 > y) !== (y2 > y) && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) drin = !drin; }
  return drin;
}

/**
 * Build the pixel ground. `linien`: rings/lines in court metres to outline; `platzRing`: the square's outline in court metres.
 * Returns { url, west, south, east, north, px } for a single image laid on the globe.
 */
export async function pixelboden({ frame, foto, linien = [], platzRing = null, baeume = [], halb = 130, px = 1040 }) {
  const [e0, n0] = frame.ursprung_utm32, A = frame.achse_a, B = frame.achse_b;
  const [lon, lat] = fromUtm32(e0, n0), dLat = halb / 111320, dLon = halb / (111320 * Math.cos((lat * Math.PI) / 180));
  const west = lon - dLon, east = lon + dLon, south = lat - dLat, north = lat + dLat;
  // edge simplification: small detail goes before the palette does
  const c = ausschnitt(foto, { west, south, east, north }, px, 'blur(0.8px)'), g = c.getContext('2d', { willReadFrequently: true });
  const bild = g.getImageData(0, 0, px, px), d = bild.data;
  // court metres of a pixel: exact at the four corners, linear in between (millimetres over this window)
  const ab = (lo, la) => { const [e, n] = toUtm32(lo, la); return [(e - e0) * A[0] + (n - n0) * A[1], (e - e0) * B[0] + (n - n0) * B[1]]; };
  const nw = ab(west, north), ne = ab(east, north), sw = ab(west, south), se = ab(east, south);
  const ort = (x, y) => { const u = (x + 0.5) / px, v = (y + 0.5) / px; return [(nw[0] * (1 - u) + ne[0] * u) * (1 - v) + (sw[0] * (1 - u) + se[0] * u) * v, (nw[1] * (1 - u) + ne[1] * u) * (1 - v) + (sw[1] * (1 - u) + se[1] * u) * v]; };
  const zuBild = ([a, b]) => { const [lo, la] = fromUtm32(e0 + a * A[0] + b * B[0], n0 + a * A[1] + b * B[1]); return [((lo - west) / (east - west)) * px, ((north - la) / (north - south)) * px]; };
  // outlines of the real mapped edges, drawn hard (no anti-aliasing survives the threshold)
  const lc = Object.assign(document.createElement('canvas'), { width: px, height: px }), lg = lc.getContext('2d', { willReadFrequently: true });
  lg.strokeStyle = '#000'; lg.lineWidth = 1.6; lg.lineJoin = 'round';
  for (const linie of linien) { lg.beginPath(); linie.forEach((p, i) => { const [x, y] = zuBild(p); i ? lg.lineTo(x, y) : lg.moveTo(x, y); }); lg.stroke(); }
  const kante = lg.getImageData(0, 0, px, px).data;
  // The photo shows the real trees as bare crowns and shadows on the ground. Where a drawn tree stands,
  // that patch is replaced by the ground colour found just outside its crown, so no tree lies under the tree.
  const kronen = baeume.filter((t) => Math.abs(t.ab[0]) < halb * 1.5 && Math.abs(t.ab[1]) < halb * 1.5).map((t) => {
    const r = t.krone * 1.05, c = [0, 0, 0]; let n = 0;
    for (const f of [1.25, 1.55]) for (let k = 0; k < 16; k++) {
      const [x, y] = zuBild([t.ab[0] + Math.cos((k / 16) * 2 * Math.PI) * r * f, t.ab[1] + Math.sin((k / 16) * 2 * Math.PI) * r * f]).map(Math.round);
      if (x < 0 || y < 0 || x >= px || y >= px) continue;
      const i = (y * px + x) * 4; c[0] += d[i]; c[1] += d[i + 1]; c[2] += d[i + 2]; n++;
    }
    return n ? { a: t.ab[0], b: t.ab[1], r, c: c.map((v) => v / n) } : null;
  }).filter(Boolean);
  // On the court the photo's own light is taken back: the shadows the real trees threw when it was taken would lie
  // there for good, under the cast shadows that move with the sun. PLATZ_FOTO of the photo's contrast stays, as the
  // asphalt's wear; the rest is the court's mean tone.
  const mittel = [0, 0, 0]; let anzahl = 0;
  for (let y = 0; y < px; y += 2) for (let x = 0; x < px; x += 2) { const [a, b] = ort(x, y); if (Math.abs(a) <= 12.6 && Math.abs(b) <= 9) { const i = (y * px + x) * 4; mittel[0] += d[i]; mittel[1] += d[i + 1]; mittel[2] += d[i + 2]; anzahl++; } }
  if (anzahl) for (let k = 0; k < 3; k++) mittel[k] /= anzahl;
  const umriss = PALETTE[0];
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    const i = (y * px + x) * 4, [a, b] = ort(x, y);
    const m = maske(abstandPlatz(a, b), platzRing ? imVieleck([a, b], platzRing) : false);
    // the dissolve is itself dithered, on 2 x 2 cells so the stipple reads as pixels, not as noise
    if (m <= schwelle(x >> 1, y >> 1)) { d[i + 3] = 0; continue; }
    if (kante[i + 3] > 110 && m > 0.45) { d[i] = umriss[0]; d[i + 1] = umriss[1]; d[i + 2] = umriss[2]; d[i + 3] = 255; continue; }
    for (const k of kronen) {
      const weg = Math.hypot(a - k.a, b - k.b);
      if (weg < k.r) { const w = Math.min(1, (k.r - weg) / (k.r * 0.35)); d[i] += (k.c[0] - d[i]) * w; d[i + 1] += (k.c[1] - d[i + 1]) * w; d[i + 2] += (k.c[2] - d[i + 2]) * w; }
    }
    const t = (schwelle(x, y) - 0.5) * 26;      // ordered dither between neighbouring palette colours
    const aufPlatz = Math.abs(a) <= 12.6 && Math.abs(b) <= 9;
    if (aufPlatz && anzahl) for (let k = 0; k < 3; k++) d[i + k] = mittel[k] + (d[i + k] - mittel[k]) * PLATZ_FOTO;
    const strich = aufPlatz ? markierung(a, b, (2 * halb) / px) : null;
    // inside the fence: asphalt tones only, and the court's real markings on top
    const [r, gr, bl] = strich ?? (aufPlatz ? naechste(d[i] + t, d[i + 1] + t, d[i + 2] + t, ASPHALT) : naechste(d[i] + t, d[i + 1] + t, d[i + 2] + t));
    d[i] = r; d[i + 1] = gr; d[i + 2] = bl; d[i + 3] = 255;
  }
  g.putImageData(bild, 0, 0);
  return { url: c.toDataURL('image/png'), west, south, east, north, px };
}
