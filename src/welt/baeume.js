// Trees of a place: every mapped tree becomes a trunk and a canopy with a ground shadow, a size,
// a species and a collision circle. Everything follows from the geodata and fixed rules, so the
// same data always gives the same grove. Pure rules first (tested under Node), drawing below.
import ORT from '../../locations/boni/ort.js';
import { ladeBild } from './bild.js';

/** One light for the whole world. Compass direction the sun shines from, and its elevation.
 *  Chosen so that in the game camera (looking 118°) light comes from the upper left, as in the art. */
export const LICHT = { azimut: 73, hoehe: 45 };
/** The game camera's tilt from the vertical: a canopy hides the ground this far behind its trunk. */
export const KAMERA = { ...ORT.blick }; // the game camera of the place (locations/boni/ort.js)

export { streuung } from '../bau/streuung.js'; // stable pseudo-random number from a string (FNV-1a)
import { streuung } from '../bau/streuung.js';

/** Court metres of a grid position. */
export const platzmeter = (frame, [e, n]) => {
  const de = e - frame.ursprung_utm32[0], dn = n - frame.ursprung_utm32[1];
  return [de * frame.achse_a[0] + dn * frame.achse_a[1], de * frame.achse_b[0] + dn * frame.achse_b[1]];
};

/** Crown tops in the canopy survey: local maxima of at least `mindest` metres, one per `radius` metres. */
export function kronengipfel(kronenhoehe, bereich = { a: [-46, 46], b: [-41.4, 41.6], schritt: 0.5 }, mindest = 7, radius = 3) {
  const gipfel = [], s = bereich.schritt, n = Math.round(radius / s);
  for (let j = 0; bereich.b[0] + j * s <= bereich.b[1]; j++) for (let i = 0; bereich.a[0] + i * s <= bereich.a[1]; i++) {
    const a = bereich.a[0] + i * s, b = bereich.b[0] + j * s, v = kronenhoehe(a, b) ?? 0;
    if (v < mindest) continue;
    let oben = true;
    for (let dj = -n; dj <= n && oben; dj++) for (let di = -n; di <= n; di++) {
      const u = kronenhoehe(a + di * s, b + dj * s) ?? 0;
      if (u > v || (u === v && (dj < 0 || (dj === 0 && di < 0)))) { oben = false; break; } // ties: the first cell wins
    }
    if (oben) gipfel.push([Math.round(a * 100) / 100, Math.round(b * 100) / 100, v]);
  }
  return gipfel;
}

function eintrag(id, en, ab, gemessen, arten, benannt, standort) {
  const hoehe = gemessen >= 4 ? gemessen : 9 + 7 * streuung(id, 'hoehe');
  const art = benannt ?? (arten.length ? arten[Math.floor(streuung(id, 'art') * arten.length)] : null);
  return {
    id, en, ab, standort, hoehe: Math.round(hoehe * 10) / 10, hoeheQuelle: gemessen >= 4 ? 'Oberflächenmodell' : 'angenommen',
    krone: Math.round(Math.min(6.5, Math.max(2, 0.32 * hoehe)) * 10) / 10,   // crown radius, m
    stamm: Math.round(Math.min(0.6, Math.max(0.2, 0.035 * hoehe)) * 100) / 100, // trunk radius, m
    art: art?.id ?? null, artQuelle: benannt ? 'kartiert' : art ? 'zugeteilt' : null, spiegeln: streuung(id, 'spiegel') < 0.5,
  };
}

/**
 * The grove: one record per mapped tree, plus (with `ableiten`) one per crown top of the canopy survey
 * that has no mapped tree within 5 m. Sorted by id.
 * `kronenhoehe(a, b)` returns the measured canopy height at court metres, or null outside the survey.
 * Size: the measured canopy height where the survey covers the tree, otherwise 9 to 16 m by the tree's id.
 * Species: the mapped one if the data has it, otherwise one of `arten` by the tree's id.
 * `ableiten`: { bereich?, sperre?(a, b) } - sperre keeps derived trees out of places no tree can stand (the court).
 */
export function hain(features, frame, arten = [], kronenhoehe = () => null, ableiten = null) {
  const baeume = features.filter((f) => f.geometry.type === 'Point' && f.properties.natural === 'tree').map((f) => {
    const id = f.properties.osm, ab = platzmeter(frame, f.geometry.coordinates);
    let gemessen = 0;
    for (let da = -2.5; da <= 2.5; da += 0.5) for (let db = -2.5; db <= 2.5; db += 0.5) gemessen = Math.max(gemessen, kronenhoehe(ab[0] + da, ab[1] + db) ?? 0);
    const benannt = arten.find((a) => a.species && [f.properties.species, f.properties.genus, f.properties['species:de']].includes(a.species));
    return eintrag(id, f.geometry.coordinates, ab, gemessen, arten, benannt, 'kartiert');
  });
  if (ableiten) {
    const [e0, n0] = frame.ursprung_utm32, A = frame.achse_a, B = frame.achse_b;
    for (const [a, b, v] of kronengipfel(kronenhoehe, ableiten.bereich)) {
      if (ableiten.sperre?.(a, b) || baeume.some((t) => Math.hypot(t.ab[0] - a, t.ab[1] - b) < 5)) continue;
      const en = [Math.round((e0 + a * A[0] + b * B[0]) * 100) / 100, Math.round((n0 + a * A[1] + b * B[1]) * 100) / 100];
      baeume.push(eintrag(`dom/${a.toFixed(1)}_${b.toFixed(1)}`, en, [a, b], v, arten, null, 'abgeleitet'));
    }
  }
  return baeume.sort((x, y) => (x.id < y.id ? -1 : 1));
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
  const kraft = licht.staerke ?? 1;                                // 0 under clouds and at night, 1 in full sun
  if (fotoBoden) return { mitte: t.ab, richtung, laengs: t.krone * 0.85, quer: t.krone * 0.85, deckung: 0.2 * kraft };
  const wurf = (t.hoehe * 0.6) / Math.tan((licht.hoehe * Math.PI) / 180);
  return { mitte: [t.ab[0] + richtung[0] * wurf, t.ab[1] + richtung[1] * wurf], richtung, laengs: t.krone * 1.35, quer: t.krone, deckung: 0.32 * kraft };
}

/**
 * The two faces a tree throws its cast shadow with, for a sun at `licht`: the trunk upright and turned towards the
 * sun's bearing, the crown square to the sun's rays (so its shadow is as long as a round crown's, at any height of
 * the sun). Each face: four corners as offsets from the foot of the trunk (east, north, up, metres) and their places
 * in the sprite (0 … 1 across, 0 at the top). `seiten` is the sprite's width by height, `grenze` the share of its
 * height the crown takes (baumbilder); `konvergenz` turns the compass bearing into the grid's.
 */
export function schattenflaechen(t, { seiten, grenze }, licht = LICHT, konvergenz = 0) {
  const az = ((licht.azimut - konvergenz) * Math.PI) / 180, hoch = (Math.max(licht.hoehe, 8) * Math.PI) / 180;
  const q = [Math.cos(az), -Math.sin(az), 0], r = [-Math.sin(az) * Math.sin(hoch), -Math.cos(az) * Math.sin(hoch), Math.cos(hoch)]; // across the light; up the face that looks at the sun
  const H = t.hoehe, halb = (H * seiten) / 2, fuss = H * (1 - grenze), mitte = [0, 0, H - (H * grenze) / 2], hk = (H * grenze) / 2;
  const u0 = t.spiegeln ? 1 : 0, u1 = 1 - u0, ecke = (m, a, b, achse) => [m[0] + q[0] * a + achse[0] * b, m[1] + q[1] * a + achse[1] * b, m[2] + q[2] * a + achse[2] * b];
  return [
    { teil: 'stamm', ecken: [ecke([0, 0, 0], -halb, 0, [0, 0, 1]), ecke([0, 0, 0], halb, 0, [0, 0, 1]), ecke([0, 0, 0], halb, fuss, [0, 0, 1]), ecke([0, 0, 0], -halb, fuss, [0, 0, 1])], st: [[u0, 1], [u1, 1], [u1, grenze], [u0, grenze]] },
    { teil: 'krone', ecken: [ecke(mitte, -halb, -hk, r), ecke(mitte, halb, -hk, r), ecke(mitte, halb, hk, r), ecke(mitte, -halb, hk, r)], st: [[u0, grenze], [u1, grenze], [u1, 0], [u0, 0]] },
  ];
}

/**
 * Does this tree's cast shadow reach the court? The court's floor draws the shade of the trees itself, from the
 * canopy survey (environment.js); a second shadow on top would make it too dark. Such a tree keeps its drawn
 * ground shadow and throws no cast shadow.
 */
export function trifftPlatz(t, frame, licht = LICHT, halb = [13.4, 9.8]) {
  const s = schatten(t, frame, false, licht), weit = t.hoehe / Math.tan((Math.max(licht.hoehe, 8) * Math.PI) / 180);
  for (let k = 0; k <= 10; k++) { const a = t.ab[0] + (s.richtung[0] * weit * k) / 10, b = t.ab[1] + (s.richtung[1] * weit * k) / 10; if (Math.abs(a) < halb[0] + t.krone && Math.abs(b) < halb[1] + t.krone) return true; }
  return false;
}

// ------------------------------------------------------------------ drawing (browser, CesiumJS)

/** Canopy heights from the place's survey raster (red = height in 0.2 m steps; 0.5 m cells in court metres). */
export async function kronenkarte(url, a0 = -46, b0 = -41.4, zelle = 0.5) {
  try {
    const img = await ladeBild(url);
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const zelleBei = (a, b) => { const i = Math.round((a - a0) / zelle), j = Math.round((b - b0) / zelle); return i < 0 || j < 0 || i >= c.width || j >= c.height ? -1 : (j * c.width + i) * 4; };
    const krone = (a, b) => { const k = zelleBei(a, b); return k < 0 ? null : d[k + 1] > 128 ? 0 : d[k] * 0.2; }; // green = roof, not a tree
    krone.roh = (a, b) => { const k = zelleBei(a, b); return k < 0 ? 0 : d[k] * 0.2; };                          // crowns and roofs alike: whatever casts shade
    return krone;
  } catch { const leer = () => null; leer.roh = () => 0; return leer; }
}

/** Split a tree sprite into trunk and canopy pictures of the full frame: the canopy starts where the outline widens. */
export async function baumbilder(asset, base) {
  const img = await ladeBild(new URL(asset.file, base).href);
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
  return { bild: img, seiten: w / h, grenze: grenze / h, krone: [teil(0, grenze, false), teil(0, grenze, true)], stamm: [teil(grenze, h, false), teil(grenze, h, true)] };
}

/**
 * Put the grove into the scene. Returns { baeume, zeige(point) }: call zeige with the player's court
 * metres every frame and canopies between the camera and the player turn see-through.
 */
export async function pflanze({ Cesium, entities, billboards = null, scene = null, baeume, bilder, frame, pos, fotoBoden, wirft = () => false }) {
  const zuGitter = ([a, b]) => [frame.ursprung_utm32[0] + a * frame.achse_a[0] + b * frame.achse_b[0], frame.ursprung_utm32[1] + a * frame.achse_a[1] + b * frame.achse_b[1]];
  const kronen = [];
  for (const t of baeume) {
    const s = schatten(t, frame, fotoBoden), quer = [-s.richtung[1], s.richtung[0]];
    const rand = Array.from({ length: 20 }, (_, k) => { const w = (k / 20) * 2 * Math.PI, l = Math.cos(w) * s.laengs, q = Math.sin(w) * s.quer; return pos(zuGitter([s.mitte[0] + s.richtung[0] * l + quer[0] * q, s.mitte[1] + s.richtung[1] * l + quer[1] * q]), 0.12); });
    if (!wirft(t)) entities.add({ polygon: { hierarchy: rand, perPositionHeight: true, material: Cesium.Color.fromCssColorString('#10160f').withAlpha(s.deckung) } }); // a tree that casts a real shadow needs no drawn one
    const text = `Baum ${t.id} (Standort ${t.standort}${t.standort === 'abgeleitet' ? ' aus der Kronenhöhenkarte, Stamm ungefähr' : ''})\nHöhe ${t.hoehe} m (${t.hoeheQuelle}), Krone ${t.krone} m, Stamm ${t.stamm} m\nArt: ${t.art ?? 'ohne Sprite'}${t.artQuelle ? ' (' + t.artQuelle + ')' : ''}`;
    const b = t.art && bilder[t.art];
    if (b) {
      const seite = t.spiegeln ? 1 : 0, mass = { sizeInMeters: true, width: t.hoehe * b.seiten, height: t.hoehe, verticalOrigin: Cesium.VerticalOrigin.BOTTOM };
      if (billboards) { // trunk and crown in one collection, drawn together; the crown turns see-through by its colour
        const id = { properties: { text: { getValue: () => text } } };
        billboards.add({ position: pos(t.en, 0), image: b.stamm[seite], ...mass, id });
        const krone = billboards.add({ position: pos(t.en, 0), image: b.krone[seite], ...mass, color: Cesium.Color.WHITE, id });
        kronen.push([t, (durch) => { krone.color = Cesium.Color.WHITE.withAlpha(durch ? 0.3 : 1); scene?.requestRender(); }]);
      } else {
        entities.add({ position: pos(t.en, 0), billboard: { image: b.stamm[seite], ...mass }, properties: { text } });
        const krone = entities.add({ position: pos(t.en, 0), billboard: { image: b.krone[seite], ...mass, color: Cesium.Color.WHITE }, properties: { text } });
        kronen.push([t, (durch) => { krone.billboard.color = Cesium.Color.WHITE.withAlpha(durch ? 0.3 : 1); }]);
      }
    } else { // no approved sprite: a plain trunk and cone of the same size, so collision, shadow and depth still hold
      entities.add({ position: pos(t.en, t.hoehe * 0.2), cylinder: { length: t.hoehe * 0.4, topRadius: t.stamm, bottomRadius: t.stamm * 1.3, material: Cesium.Color.fromCssColorString('#6b5137') }, properties: { text } });
      const krone = entities.add({ position: pos(t.en, t.hoehe * 0.68), ellipsoid: { radii: new Cesium.Cartesian3(t.krone, t.krone, t.hoehe * 0.34), material: Cesium.Color.fromCssColorString('#3f8f3a').withAlpha(0.9) }, properties: { text } });
      kronen.push([t, (durch) => { krone.ellipsoid.material = Cesium.Color.fromCssColorString('#3f8f3a').withAlpha(durch ? 0.25 : 0.9); }]);
    }
  }
  const zustand = new Map();
  return {
    baeume,
    /** Like zeige, for several points at once (the whole court during a match). */
    zeigeMehrere(punkte, blick) { for (const [t, setze] of kronen) { const durch = punkte.some((p) => verdeckt(p, t, blick)); if (zustand.get(t) !== durch) { zustand.set(t, durch); setze(durch); } } },
    zeige(punkt, blick) { for (const [t, setze] of kronen) { const durch = verdeckt(punkt, t, blick); if (zustand.get(t) !== durch) { zustand.set(t, durch); setze(durch); } } },
  };
}

const WERFER_VS = `
in vec3 position3DHigh;
in vec3 position3DLow;
in vec2 st;
in float batchId;
out vec2 v_st;
void main() {
  vec4 p = czm_computePosition();
  v_st = st;
  gl_Position = czm_modelViewProjectionRelativeToEye * p;
}`;
// Drawn into the shadow map only. Its camera looks along the sun's parallel rays, so its projection has no
// perspective: that is how this shader tells the shadow pass from the view, where nothing of these faces shows.
const WERFER_FS = `
in vec2 v_st;
uniform sampler2D u_bild;
void main() {
  if (czm_projection[3][3] < 0.5) discard;
  if (texture(u_bild, v_st).a < 0.5) discard;
  out_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
}`;

/**
 * Faces that only cast shadows: every tree's sprite, turned to the sun (schattenflaechen), so the trees throw
 * their own outline on the ground, the fences and the houses, and the shadows move with the sun. One Primitive
 * per species (it carries the species' picture). `welche(t)` picks the trees. Returns the Primitives; the caller
 * removes them from the scene when the sun or the grove changes.
 */
export function schattenwerfer({ Cesium, scene, baeume, bilder, frame, pos, licht = LICHT, welche = () => true }) {
  const konvergenz = frame.meridiankonvergenz_grad ?? 0, jeArt = new Map();
  for (const t of baeume) { if (t.art && bilder[t.art]?.bild && welche(t)) (jeArt.get(t.art) ?? jeArt.set(t.art, []).get(t.art)).push(t); }
  const aus = [];
  for (const [art, liste] of jeArt) {
    const b = bilder[art], P = [], S = [], I = [];
    for (const t of liste) for (const f of schattenflaechen(t, b, licht, konvergenz)) {
      const i = P.length / 3;
      f.ecken.forEach(([e, n, z], m) => { const c = pos([t.en[0] + e, t.en[1] + n], Math.max(0.05, z)); P.push(c.x, c.y, c.z); S.push(f.st[m][0], 1 - f.st[m][1]); });
      I.push(i, i + 1, i + 2, i, i + 2, i + 3);
    }
    const positionen = new Float64Array(P);
    const geometrie = new Cesium.Geometry({
      attributes: { position: new Cesium.GeometryAttribute({ componentDatatype: Cesium.ComponentDatatype.DOUBLE, componentsPerAttribute: 3, values: positionen }),
        st: new Cesium.GeometryAttribute({ componentDatatype: Cesium.ComponentDatatype.FLOAT, componentsPerAttribute: 2, values: new Float32Array(S) }) },
      indices: P.length / 3 < 65536 ? new Uint16Array(I) : new Uint32Array(I), primitiveType: Cesium.PrimitiveType.TRIANGLES, boundingSphere: Cesium.BoundingSphere.fromVertices(positionen),
    });
    // the species' picture, pixel for pixel; kept on the picture record, so a new sun does not load it again
    b.textur ??= new Cesium.Texture({ context: scene.context, source: b.bild, sampler: new Cesium.Sampler({ minificationFilter: Cesium.TextureMinificationFilter.NEAREST, magnificationFilter: Cesium.TextureMagnificationFilter.NEAREST }) });
    const erscheinung = new Cesium.Appearance({ translucent: true, closed: false, vertexShaderSource: WERFER_VS, fragmentShaderSource: WERFER_FS,
      renderState: { depthTest: { enabled: true }, depthMask: false, cull: { enabled: false } } });
    erscheinung.uniforms = { u_bild: b.textur };
    aus.push(scene.primitives.add(new Cesium.Primitive({ geometryInstances: new Cesium.GeometryInstance({ geometry: geometrie }), appearance: erscheinung, asynchronous: false, compressVertices: false,
      shadows: Cesium.ShadowMode.CAST_ONLY, allowPicking: false })));
  }
  return aus;
}
