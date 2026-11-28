// The drawn ground of the quarter: streets, pavements, paths, yards and green from the geodata, filled with
// SpriteCook textures instead of the aerial photo (and its parked cars). Which area takes which texture is
// written down in assets/welt/boden/boden.json; this file only follows it.
//
// The surveyed land use (ALKIS) already separates carriageway, pavement and block, so the kerb is simply
// the outline of the carriageway. OpenStreetMap adds what the survey does not know: which street is
// cobbled, where lawns and gardens lie, the drives into the yards and the paths across the square.
import { fromUtm32 } from './utm.js';

const wert = (regeln, schluessel) => regeln[schluessel] ?? null;

/**
 * What to paint, in order, in UTM metres. Steps:
 *   { art: 'flaeche', textur, vielecke: [[outer ring, hole, …], …] }
 *   { art: 'linie', textur | farbeVon, breite, linien: [[p, …], …], in: 'fahrbahn' | null, kappe }
 *   { art: 'loch', vielecke }   (the ground below shows again: the court keeps its own)
 * and `fahrbahn`: the carriageway polygons, the area a street's own surface may cover.
 */
export function bodenplan({ nutzung, flaechen, wege, platz }, regeln) {
  const vieleck = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
  const nach = new Map();
  const lege = (textur, v) => { if (!nach.has(textur)) nach.set(textur, []); nach.get(textur).push(...v); };
  const fahrbahn = [], schritte = [];
  // 1. the survey's land use: every square metre of the quarter belongs to exactly one of these
  const gruppen = { block: new Map(), weg: new Map(), strasse: new Map() };
  for (const f of nutzung.features) {
    const p = f.properties, genau = `${p.nutzart}/${p.bezeichnung ?? ''}`, textur = wert(regeln.nutzung, genau) ?? wert(regeln.nutzung, p.nutzart) ?? regeln.nutzung['*'];
    const gruppe = p.nutzart === 'Straßenverkehr' ? 'strasse' : p.nutzart === 'Weg' ? 'weg' : 'block';
    if (!gruppen[gruppe].has(textur)) gruppen[gruppe].set(textur, []);
    gruppen[gruppe].get(textur).push(...vieleck(f.geometry));
    if (genau === 'Straßenverkehr/') fahrbahn.push(...vieleck(f.geometry));
  }
  const flaeche = (gruppe) => { for (const [textur, vielecke] of gruppe) schritte.push({ art: 'flaeche', textur, vielecke }); };
  flaeche(gruppen.block);
  // 2. lawns, gardens and beds inside the blocks and on the square (OpenStreetMap)
  for (const f of flaechen.features) for (const [k, v] of Object.entries(f.properties)) { const textur = wert(regeln.osm_flaechen, `${k}=${v}`); if (textur) lege(textur, vieleck(f.geometry)); }
  for (const [textur, vielecke] of nach) schritte.push({ art: 'flaeche', textur, vielecke });
  // 3. drives and paths the survey does not show as their own area; where it does, that area is painted over them
  const belag = (p, sonst) => wert(regeln.belag, p.surface) ?? sonst;
  for (const [art, r] of Object.entries(regeln.osm_wege)) {
    const jeTextur = new Map();
    for (const f of wege.features) if (f.properties.highway === art && f.geometry.type === 'LineString') { const t = belag(f.properties, r.textur); if (!jeTextur.has(t)) jeTextur.set(t, []); jeTextur.get(t).push(f.geometry.coordinates); }
    for (const [textur, linien] of jeTextur) schritte.push({ art: 'linie', textur, breite: r.breite, linien, in: null, kappe: 'round' });
  }
  flaeche(gruppen.weg);
  flaeche(gruppen.strasse);
  // 4. a street keeps its own surface (cobbles) inside the carriageway
  const strassen = new Map();
  for (const f of wege.features) if (regeln.fahrbahn.arten.includes(f.properties.highway) && f.geometry.type === 'LineString') {
    const t = belag(f.properties, regeln.nutzung['Straßenverkehr']);
    if (t !== regeln.nutzung['Straßenverkehr']) { if (!strassen.has(t)) strassen.set(t, []); strassen.get(t).push(f.geometry.coordinates); }
  }
  for (const [textur, linien] of strassen) schritte.push({ art: 'linie', textur, breite: regeln.fahrbahn.breite, linien, in: 'fahrbahn', kappe: 'butt' });
  // 5. kerbs: the outline of the carriageway, without the edges that are only the cut of the data
  const alle = nutzung.features.flatMap((f) => vieleck(f.geometry).flatMap((v) => v[0]));
  const w = Math.min(...alle.map((q) => q[0])), s = Math.min(...alle.map((q) => q[1])), e = Math.max(...alle.map((q) => q[0])), n = Math.max(...alle.map((q) => q[1]));
  const amRand = ([x, y]) => Math.abs(x - w) < 0.05 || Math.abs(x - e) < 0.05 || Math.abs(y - s) < 0.05 || Math.abs(y - n) < 0.05;
  const kanten = [];
  for (const v of fahrbahn) for (const ring of v) {
    let lauf = null;
    for (let i = 0; i + 1 < ring.length; i++) {
      if (amRand(ring[i]) && amRand(ring[i + 1])) { lauf = null; continue; }
      if (!lauf) kanten.push(lauf = [ring[i]]);
      lauf.push(ring[i + 1]);
    }
  }
  schritte.push({ art: 'linie', farbeVon: regeln.bordstein.farbe_von, hell: regeln.bordstein.hell, breite: regeln.bordstein.breite, linien: kanten, in: null, kappe: 'butt' });
  // 6. the court keeps the ground it has: the fence rectangle, a little wider
  const zaun = platz.features.find((f) => f.properties.art === 'zaun');
  if (zaun) {
    const ring = zaun.geometry.coordinates[0], m = [0, 1].map((k) => ring.slice(0, -1).reduce((sum, p) => sum + p[k], 0) / (ring.length - 1));
    schritte.push({ art: 'loch', vielecke: [[ring.map((p) => { const d = [p[0] - m[0], p[1] - m[1]], l = Math.hypot(...d); return [p[0] + (d[0] / l) * regeln.platz_rand, p[1] + (d[1] / l) * regeln.platz_rand]; })]] });
  }
  return { schritte, fahrbahn, rahmen: [w, s, e, n] };
}

/**
 * The plan as map tiles, painted when Cesium asks for them: a square round the place, cut into 256-pixel tiles;
 * on the finest level one pixel is 1 / pxJeM metres, the pixel size of the house fronts. Returns an imagery provider.
 */
export function bodenKacheln({ Cesium, plan, frame, bilder, pxJeM = 12.5, kachel = 256, stufen = 5 }) {
  const seite = kachel * 2 ** stufen, halb = seite / pxJeM / 2;
  const [lon, lat] = fromUtm32(...frame.ursprung_utm32), dLat = halb / 111320, dLon = halb / (111320 * Math.cos((lat * Math.PI) / 180));
  const west = lon - dLon, east = lon + dLon, south = lat - dLat, north = lat + dLat;
  const zuBild = ([e, n]) => { const [lo, la] = fromUtm32(e, n); return [((lo - west) / (east - west)) * seite, ((north - la) / (north - south)) * seite]; };
  const leinwand = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const probe = leinwand(1, 1).getContext('2d', { willReadFrequently: true });
  const muster = Object.fromEntries(Object.entries(bilder).map(([name, bild]) => [name, probe.createPattern(bild, 'repeat')]));
  const mittel = (bild, hell) => { const c = leinwand(bild.width, bild.height), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bild, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data, s = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) s[k] += d[i + k]; return `rgb(${s.map((v) => Math.min(255, Math.round((v / (d.length / 4)) * hell))).join(',')})`; };
  // every shape once, in pixels of the finest level, with its box so a tile only paints what touches it
  const form = (ringe, zu) => {
    const pfad = new Path2D(), box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const ring of ringe) { ring.forEach((p, i) => { const [x, y] = zuBild(p); i ? pfad.lineTo(x, y) : pfad.moveTo(x, y); box[0] = Math.min(box[0], x); box[1] = Math.min(box[1], y); box[2] = Math.max(box[2], x); box[3] = Math.max(box[3], y); }); if (zu) pfad.closePath(); }
    return { pfad, box };
  };
  const fahrbahn = form(plan.fahrbahn.flat(), true).pfad;
  const schritte = plan.schritte.map((s) => ({ ...s, stil: s.textur ? muster[s.textur] : s.farbeVon ? mittel(bilder[s.farbeVon], s.hell ?? 1) : null,
    formen: s.art === 'linie' ? s.linien.map((l) => form([l], false)) : s.vielecke.map((v) => form(v, true)) }));
  function male(g, x0, y0, x1, y1) {
    for (const s of schritte) {
      const rand = s.art === 'linie' ? (s.breite * pxJeM) / 2 + 1 : 0, sichtbar = s.formen.filter((f) => f.box[2] + rand >= x0 && f.box[0] - rand <= x1 && f.box[3] + rand >= y0 && f.box[1] - rand <= y1);
      if (!sichtbar.length) continue;
      g.save();
      if (s.art === 'linie') {
        if (s.in === 'fahrbahn') g.clip(fahrbahn, 'evenodd');
        g.strokeStyle = s.stil; g.lineWidth = s.breite * pxJeM; g.lineJoin = 'round'; g.lineCap = s.kappe;
        for (const f of sichtbar) g.stroke(f.pfad);
      } else {
        if (s.art === 'loch') g.globalCompositeOperation = 'destination-out';
        g.fillStyle = s.art === 'loch' ? '#000' : s.stil;
        for (const f of sichtbar) g.fill(f.pfad, 'evenodd');
      }
      g.restore();
    }
  }
  const rectangle = Cesium.Rectangle.fromDegrees(west, south, east, north);
  return {
    tilingScheme: new Cesium.GeographicTilingScheme({ rectangle, numberOfLevelZeroTilesX: 1, numberOfLevelZeroTilesY: 1 }),
    rectangle, tileWidth: kachel, tileHeight: kachel, minimumLevel: 0, maximumLevel: stufen, hasAlphaChannel: true,
    tileDiscardPolicy: undefined, errorEvent: new Cesium.Event(), credit: undefined, proxy: undefined,
    getTileCredits: () => undefined, pickFeatures: () => undefined,
    requestImage(x, y, level) {
      const c = leinwand(kachel, kachel), g = c.getContext('2d'), s = 2 ** (level - stufen);
      g.imageSmoothingEnabled = s < 1; // far away the textures are averaged, close up every pixel stays whole
      g.setTransform(s, 0, 0, s, -x * kachel, -y * kachel);
      male(g, (x * kachel) / s, (y * kachel) / s, ((x + 1) * kachel) / s, ((y + 1) * kachel) / s);
      return Promise.resolve(c);
    },
    male, seite, zuBild,
  };
}
