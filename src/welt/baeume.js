// Trees of a place: every mapped tree becomes a trunk and a canopy with a ground shadow, a size,
// a species and a collision circle. Everything follows from the geodata and fixed rules, so the
// same data always gives the same grove. Pure rules first (tested under Node), drawing below.

/** One light for the whole world. Compass direction the sun shines from, and its elevation.
 *  Chosen so that in the game camera (looking 118°) light comes from the upper left, as in the art. */
export const LICHT = { azimut: 73, hoehe: 45 };
/** The game camera's tilt from the vertical: a canopy hides the ground this far behind its trunk. */
export const KAMERA = { richtung: 118.2, neigung: 60 };

/** Stable pseudo-random number in [0, 1) from a string (FNV-1a): same tree, same result, every run. */
export function streuung(text, salz = '') {
  let h = 0x811c9dc5;
  for (const ch of salz + text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) / 4294967296;
}

/** Court metres of a grid position. */
export const platzmeter = (frame, [e, n]) => {
  const de = e - frame.ursprung_utm32[0], dn = n - frame.ursprung_utm32[1];
  return [de * frame.achse_a[0] + dn * frame.achse_a[1], de * frame.achse_b[0] + dn * frame.achse_b[1]];
};

/**
 * The grove: one record per mapped tree, sorted by id.
 * `kronenhoehe(a, b)` returns the measured canopy height at court metres, or null outside the survey.
 * Size: the measured canopy height where the survey covers the tree, otherwise 9 to 16 m by the tree's id.
 * Species: the mapped one if the data has it, otherwise one of `arten` by the tree's id.
 */
export function hain(features, frame, arten = [], kronenhoehe = () => null) {
  return features.filter((f) => f.geometry.type === 'Point' && f.properties.natural === 'tree').map((f) => {
    const id = f.properties.osm, ab = platzmeter(frame, f.geometry.coordinates);
    let gemessen = 0;
    for (let da = -2.5; da <= 2.5; da += 0.5) for (let db = -2.5; db <= 2.5; db += 0.5) gemessen = Math.max(gemessen, kronenhoehe(ab[0] + da, ab[1] + db) ?? 0);
    const hoehe = gemessen >= 4 ? gemessen : 9 + 7 * streuung(id, 'hoehe');
    const benannt = arten.find((a) => a.species && [f.properties.species, f.properties.genus, f.properties['species:de']].includes(a.species));
    const art = benannt ?? (arten.length ? arten[Math.floor(streuung(id, 'art') * arten.length)] : null);
    return {
      id, en: f.geometry.coordinates, ab, hoehe: Math.round(hoehe * 10) / 10, hoeheQuelle: gemessen >= 4 ? 'Oberflächenmodell' : 'angenommen',
      krone: Math.round(Math.min(6.5, Math.max(2, 0.32 * hoehe)) * 10) / 10,   // crown radius, m
      stamm: Math.round(Math.min(0.6, Math.max(0.2, 0.035 * hoehe)) * 100) / 100, // trunk radius, m
      art: art?.id ?? null, artQuelle: benannt ? 'kartiert' : art ? 'zugeteilt' : null, spiegeln: streuung(id, 'spiegel') < 0.5,
    };
  }).sort((x, y) => (x.id < y.id ? -1 : 1));
}

/** Collision: trunk plus root flare. Returns the position pushed out of every trunk it touches. */
export function ausweichen([a, b], baeume, koerper = 0.3) {
  for (const t of baeume) {
    const r = t.stamm + 0.35 + koerper, da = a - t.ab[0], db = b - t.ab[1], d = Math.hypot(da, db);
    if (d < r) { const k = d > 1e-6 ? r / d : 0; a = t.ab[0] + (d > 1e-6 ? da * k : r); b = t.ab[1] + db * k; }
  }
  return [a, b];
}

/** Is the point hidden behind this tree's canopy for a camera looking along `blick` (unit vector in court metres)? */
export function verdeckt([a, b], t, blick, neigung = KAMERA.neigung) {
  const da = a - t.ab[0], db = b - t.ab[1];
  const hinten = da * blick[0] + db * blick[1], seitlich = Math.abs(-da * blick[1] + db * blick[0]);
  return hinten > 0.3 && hinten < t.hoehe * Math.tan((neigung * Math.PI) / 180) && seitlich < t.krone;
}

/**
 * Ground shadow of a tree as an ellipse: centre offset from the trunk, half-axes along and across the light.
 * On the aerial photo the real trees' cast shadows are already in the picture, so only a contact shadow
 * under the canopy is drawn there; on a drawn ground the full cast shadow follows LICHT.
 */
export function schatten(t, frame, fotoBoden, licht = LICHT) {
  const weg = ((licht.azimut + 180) * Math.PI) / 180;            // direction the shadow falls, as a compass bearing
  const ost = Math.sin(weg), nord = Math.cos(weg);
  const richtung = [ost * frame.achse_a[0] + nord * frame.achse_a[1], ost * frame.achse_b[0] + nord * frame.achse_b[1]];
  if (fotoBoden) return { mitte: t.ab, richtung, laengs: t.krone * 0.85, quer: t.krone * 0.85, deckung: 0.2 };
  const wurf = (t.hoehe * 0.6) / Math.tan((licht.hoehe * Math.PI) / 180);
  return { mitte: [t.ab[0] + richtung[0] * wurf, t.ab[1] + richtung[1] * wurf], richtung, laengs: t.krone * 1.35, quer: t.krone, deckung: 0.32 };
}

// ------------------------------------------------------------------ drawing (browser, CesiumJS)

/** Canopy heights from the place's survey raster (red = height in 0.2 m steps; 0.5 m cells in court metres). */
export async function kronenkarte(url, a0 = -46, b0 = -41.4, zelle = 0.5) {
  try {
    const img = new Image(); img.src = url; await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    return (a, b) => { const i = Math.round((a - a0) / zelle), j = Math.round((b - b0) / zelle); return i < 0 || j < 0 || i >= c.width || j >= c.height ? null : (d[(j * c.width + i) * 4 + 1] > 128 ? 0 : d[(j * c.width + i) * 4] * 0.2); }; // green = roof, not a tree
  } catch { return () => null; }
}

/** Split a tree sprite into trunk and canopy pictures of the full frame: the canopy starts where the outline widens. */
export async function baumbilder(asset, base) {
  const img = new Image(); img.src = new URL(asset.file, base).href; await img.decode();
  const { w, h } = asset.frame, scale = Math.max(1, Math.round(256 / h));
  const src = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const sg = src.getContext('2d', { willReadFrequently: true }); sg.drawImage(img, 0, 0);
  const d = sg.getImageData(0, 0, w, h).data;
  const breite = (y) => { let l = w, r = -1; for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) { l = Math.min(l, x); r = x; } return r < 0 ? 0 : r - l + 1; };
  const fuss = [...Array(Math.max(2, Math.round(h * 0.12))).keys()].map((k) => breite(h - 3 - k)).sort((x, y) => x - y);
  const stammBreite = fuss[fuss.length >> 1] || 1;
  let grenze = Math.round(h * 0.6);                              // row where the canopy ends, counted from the top
  for (let y = h - 3; y > 0; y--) if (breite(y) > stammBreite * 2.2) { grenze = y + 1; break; }
  const teil = (y0, y1, spiegeln) => {
    const c = Object.assign(document.createElement('canvas'), { width: w * scale, height: h * scale });
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    if (spiegeln) { g.translate(c.width, 0); g.scale(-1, 1); }
    g.drawImage(src, 0, y0, w, y1 - y0, 0, y0 * scale, w * scale, (y1 - y0) * scale);
    return c.toDataURL();
  };
  return { seiten: w / h, grenze: grenze / h, krone: [teil(0, grenze, false), teil(0, grenze, true)], stamm: [teil(grenze, h, false), teil(grenze, h, true)] };
}

/**
 * Put the grove into the scene. Returns { baeume, zeige(point) }: call zeige with the player's court
 * metres every frame and canopies between the camera and the player turn see-through.
 */
export async function pflanze({ Cesium, entities, baeume, bilder, frame, pos, fotoBoden }) {
  const zuGitter = ([a, b]) => [frame.ursprung_utm32[0] + a * frame.achse_a[0] + b * frame.achse_b[0], frame.ursprung_utm32[1] + a * frame.achse_a[1] + b * frame.achse_b[1]];
  const kronen = [];
  for (const t of baeume) {
    const s = schatten(t, frame, fotoBoden), quer = [-s.richtung[1], s.richtung[0]];
    const rand = Array.from({ length: 20 }, (_, k) => { const w = (k / 20) * 2 * Math.PI, l = Math.cos(w) * s.laengs, q = Math.sin(w) * s.quer; return pos(zuGitter([s.mitte[0] + s.richtung[0] * l + quer[0] * q, s.mitte[1] + s.richtung[1] * l + quer[1] * q]), 0.12); });
    entities.add({ polygon: { hierarchy: rand, perPositionHeight: true, material: Cesium.Color.fromCssColorString('#10160f').withAlpha(s.deckung) } });
    const text = `Baum ${t.id}\nHöhe ${t.hoehe} m (${t.hoeheQuelle}), Krone ${t.krone} m, Stamm ${t.stamm} m\nArt: ${t.art ?? 'ohne Sprite'}${t.artQuelle ? ' (' + t.artQuelle + ')' : ''}`;
    const b = t.art && bilder[t.art];
    if (b) {
      const seite = t.spiegeln ? 1 : 0, mass = { sizeInMeters: true, width: t.hoehe * b.seiten, height: t.hoehe, verticalOrigin: Cesium.VerticalOrigin.BOTTOM };
      entities.add({ position: pos(t.en, 0), billboard: { image: b.stamm[seite], ...mass }, properties: { text } });
      const krone = entities.add({ position: pos(t.en, 0), billboard: { image: b.krone[seite], ...mass, color: Cesium.Color.WHITE }, properties: { text } });
      kronen.push([t, (durch) => { krone.billboard.color = Cesium.Color.WHITE.withAlpha(durch ? 0.3 : 1); }]);
    } else { // no approved sprite: a plain trunk and cone of the same size, so collision, shadow and depth still hold
      entities.add({ position: pos(t.en, t.hoehe * 0.2), cylinder: { length: t.hoehe * 0.4, topRadius: t.stamm, bottomRadius: t.stamm * 1.3, material: Cesium.Color.fromCssColorString('#6b5137') }, properties: { text } });
      const krone = entities.add({ position: pos(t.en, t.hoehe * 0.68), ellipsoid: { radii: new Cesium.Cartesian3(t.krone, t.krone, t.hoehe * 0.34), material: Cesium.Color.fromCssColorString('#3f8f3a').withAlpha(0.9) }, properties: { text } });
      kronen.push([t, (durch) => { krone.ellipsoid.material = Cesium.Color.fromCssColorString('#3f8f3a').withAlpha(durch ? 0.25 : 0.9); }]);
    }
  }
  const zustand = new Map();
  return {
    baeume,
    zeige(punkt, blick) { for (const [t, setze] of kronen) { const durch = verdeckt(punkt, t, blick); if (zustand.get(t) !== durch) { zustand.set(t, durch); setze(durch); } } },
  };
}
