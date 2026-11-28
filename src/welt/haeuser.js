// Houses of the neighbourhood, drawn with CesiumJS: the adapter between the engine-neutral rules of a house
// (src/bau/haus.js: body, roof, wall runs, kits, mesh) and the 3D view. Everything here is drawing: the shader,
// the texture sheet of the kits, one Primitive for the whole quarter.
//
// The shader draws edges, corners and ridges on a grid of PX art pixels per metre of wall or roof: the
// coarse scale of the scenery, the same as the façade kits and the ground (assets/welt/massstab.json, px_je_m).
import { ladeBild } from './bild.js';
import { viertel, kleideViertel, packe, netz, steckbrief, wandmaske, lichtvektor, rgb, ACHSE, DURCHFAHRT, KONTUR } from '../bau/haus.js';
export * from '../bau/haus.js'; // the rules stay importable from here, as before

export const PX = 12.5; // art pixels per metre on walls and roofs: the scenery scale, = assets/welt/massstab.json px_je_m (tested)
// ------------------------------------------------------------------ drawing (browser, CesiumJS)

/** How much of a house stays when it stands between the camera and the player: a screen of pixels, not glass. */
export const DURCHSICHT = 0.2;

const VS = `
in vec3 position3DHigh;
in vec3 position3DLow;
in vec3 normal;
in vec4 wand;
in vec4 bau;
in vec4 farbe;
in vec4 color;
in float batchId;
out vec3 v_normale;
out vec4 v_wand;
out vec4 v_bau;
out vec4 v_farbe;
out vec4 v_ton;
void main() {
  vec4 p = czm_computePosition();
  v_normale = normal;
  v_wand = wand;
  v_bau = bau;
  v_farbe = farbe;
  v_ton = color;
  gl_Position = czm_modelViewProjectionRelativeToEye * p;
}`;

// Everything is drawn on a grid of PX art pixels per metre of wall or roof: flat colours, one shade step,
// a dark outline at the wall's foot, top and corners. Three steps of light by the side the sun is on.
// Far away the fine lines go first and the windows last, so nothing flickers.
const FS = `
in vec3 v_normale;
in vec4 v_wand;
in vec4 v_bau;
in vec4 v_farbe;
in vec4 v_ton;
uniform vec3 u_licht;
uniform float u_staerke;
uniform float u_deckung;
uniform sampler2D u_atlas;   // façade pictures and cut-out parts of the dressed houses
uniform sampler2D u_ziegel;  // roof tiles, repeating
uniform sampler2D u_putz;    // plaster of party walls, repeating
uniform vec2 u_atlasMass;    // size of the atlas in pixels
uniform vec2 u_ziegelMass;   // metres one repeat of the tiles covers
uniform vec2 u_putzMass;

const float PX = ${PX.toFixed(1)};
const float ACHSE = ${ACHSE.toFixed(2)};
const float DURCHFAHRT = ${DURCHFAHRT.toFixed(2)};
const vec3 KONTUR = vec3(0.165, 0.114, 0.102);
const vec3 PAPIER = vec3(0.969, 0.937, 0.863);
const vec3 GLAS = vec3(0.235, 0.286, 0.369);
const vec3 GLANZ = vec3(0.447, 0.529, 0.624);
const vec3 VORHANG = vec3(0.87, 0.85, 0.78);

float zufall(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float raster2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float raster4(vec2 a) { return raster2(0.5 * a) * 0.25 + raster2(a); }
float bit(float wert, float stelle) { return mod(floor(wert / stelle), 2.0); }

// doors, shop signs and awnings: dark green, oxblood, navy, ochre, anthracite
vec3 schildfarbe(float h) {
  return h < 0.2 ? vec3(0.165, 0.29, 0.22) : h < 0.4 ? vec3(0.45, 0.16, 0.14) : h < 0.6 ? vec3(0.17, 0.23, 0.36) : h < 0.8 ? vec3(0.72, 0.5, 0.16) : vec3(0.22, 0.2, 0.21);
}

// a window: frame, transom and mullion, a glint on the glass, now and then a curtain. p: art pixel in the opening, g: its size
vec3 fenster(vec2 p, vec2 g, vec3 rahmen, float h) {
  float kaempfer = floor(g.y * 0.66), mitte = floor(g.x * 0.5);
  if (p.x < 1.0 || p.x >= g.x - 1.0 || p.y < 1.0 || p.y >= g.y - 1.0 || p.y == kaempfer || (p.x == mitte && p.y < kaempfer)) return rahmen;
  if (h < 0.36 && p.y < kaempfer && (h < 0.18 ? p.x < mitte - 1.0 : p.x > mitte + 1.0)) return VORHANG;
  float s = p.x + p.y - g.y * 0.7;
  return s > 0.0 && s < 4.0 ? GLANZ : GLAS;
}

void main() {
  vec2 breite = fwidth(v_wand.xy) * PX;
  float f = max(breite.x, breite.y);                       // art pixels per screen pixel
  float code = floor(v_wand.w + 0.5), art = mod(code, 16.0);
  // the sprites, looked up before anything is thrown away: on façade cells and roof parts v_wand.xy is the place in the atlas in pixels
  // never a pixel of the neighbouring cell: with multisampling a fragment on a quad's edge is shaded a little beyond it
  vec2 ort = art > 6.5 && art < 7.5 ? clamp(v_wand.xy, v_bau.xy + 0.01, v_bau.zw - 0.01) : v_wand.xy;
  // the derivatives for the mip levels, taken here in uniform control flow; each branch below then reads only the
  // one texture it needs (textureGrad), instead of all three for every fragment
  vec2 auv = vec2(ort.x, u_atlasMass.y - ort.y) / u_atlasMass, zuv = v_wand.xy / u_ziegelMass, puv = v_wand.xy / u_putzMass;
  vec2 adx = dFdx(auv), ady = dFdy(auv), zdx = dFdx(zuv), zdy = dFdy(zuv), pdx = dFdx(puv), pdy = dFdy(puv);
  if (v_ton.a * u_deckung <= raster4(gl_FragCoord.xy * 0.5)) discard;

  vec3 grund = v_farbe.rgb, fein = grund, grob = grund, mittel = grund;
  vec2 t = floor(v_wand.xy * PX);
  vec3 nn = normalize(v_normale);
  float d = dot(nn, u_licht), stufe = 0.8;

  if (art > 6.5) {                                         // dressed in sprites: the picture is the drawing, only the light is added
    stufe = nn.z > 0.5 ? (d > 0.72 ? 1.0 : d > 0.45 ? 0.93 : 0.84) : (d > 0.3 ? 1.0 : d > -0.15 ? 0.92 : 0.82);
    // v_farbe is the tint: the wanted colour divided by the picture's own. On a façade only the wall takes it (the atlas marks wall pixels with half alpha)
    if (art < 8.5) {
      vec4 bild = textureGrad(u_atlas, auv, adx, ady);
      if (art < 7.5) grund = mix(bild.rgb, min(bild.rgb * v_farbe.rgb, vec3(1.0)), clamp((1.0 - bild.a) * 2.0, 0.0, 1.0));
      else { if (bild.a < 0.25) discard; grund = bild.rgb; }
    }
    else if (art < 10.5 && art > 9.5) grund = min(textureGrad(u_ziegel, zuv, zdx, zdy).rgb * v_farbe.rgb, vec3(1.0));
    else grund = min(textureGrad(u_putz, puv, pdx, pdy).rgb * v_farbe.rgb, vec3(1.0));
    fein = grund; grob = grund; mittel = grund;
    f = 0.0;                                               // the texture's own mip levels look after the distance
  } else if (art < 2.5) {                                  // a wall: street front, yard front or party wall
    stufe = d > 0.3 ? 1.0 : d > -0.15 ? 0.89 : 0.76;
    float L = v_bau.x, T = v_bau.y, S = floor(v_bau.z), egH = fract(v_bau.z) * 8.0;
    float bcode = floor(v_bau.w + 0.5), eg = mod(bcode, 4.0), stil = mod(floor(bcode / 4.0), 4.0), tuer = floor(bcode / 16.0) - 1.0;
    bool strasse = art < 0.5, brand = art > 1.5, offen = bit(code, 128.0) > 0.5;
    if (brand) { grund = mix(grund, vec3(0.66, 0.62, 0.57), 0.5); fein = grund; grob = grund; mittel = grund; }
    vec3 hell = mix(grund, PAPIER, 0.6), dunkel = grund * vec3(0.78, 0.76, 0.8);
    // mouldings: light on a coloured wall, a shade darker on a pale one. And the drawn line round openings, softer than the silhouette
    vec3 zier = dot(grund, vec3(0.3, 0.59, 0.11)) > 0.76 ? grund * vec3(0.87, 0.84, 0.8) : mix(grund, PAPIER, 0.72);
    vec3 strich = mix(KONTUR, grund, strasse ? 0.25 : 0.5);
    float hh = fract(v_farbe.a * 7.31);                    // one number for the whole house
    if (bit(code, 64.0) > 0.5) {                           // brick: a few courses show
      float reihe = floor(t.y / 2.0);
      if (mod(t.y, 2.0) < 1.0 && zufall(vec2(floor((t.x + reihe * 3.0) / 6.0), reihe)) < 0.3) fein = grund * 0.9;
    }
    float y = v_wand.y, Tt = floor(T * PX), egT = floor(egH * PX);
    if (!brand && y < T) {
      if (t.y < 8.0 && eg < 2.5) { fein = dunkel; grob = dunkel; } // plinth
      float n = L < 1.3 ? 0.0 : max(1.0, floor(L / ACHSE + 0.5));
      if (n > 0.5 && eg < 2.5) {
        mittel = mix(grund, GLAS, 0.2);
        float aw = L / n, i = clamp(floor(v_wand.x / aw), 0.0, n - 1.0);
        float x0 = floor(i * aw * PX + 0.5), cw = floor((i + 1.0) * aw * PX + 0.5) - x0, cx = t.x - x0;
        float k = 0.0, basis = 0.0, sh = egT;
        if (y >= egH) {
          float sH = (T - egH) / max(1.0, S - 1.0);
          k = 1.0 + clamp(floor((y - egH) / sH), 0.0, max(0.0, S - 2.0));
          basis = floor((egH + (k - 1.0) * sH) * PX); sh = floor(sH * PX);
        }
        float cy = t.y - basis, h1 = zufall(vec2(i + floor(v_farbe.a * 251.0), k * 7.0 + floor(L * 3.0)));
        bool laden = strasse && eg > 0.5 && eg < 1.5 && k < 0.5;
        float typ = 1.0, bw = 16.0, bh = 0.0, by = 14.0;   // 1 window, 2 door, 3 shop window, 4 shop door
        if (k > 0.5) { bw = strasse ? (fract(v_farbe.a * 3.7) < 0.5 ? 16.0 : 18.0) : 14.0; bh = min(strasse ? 28.0 : 24.0, sh - 22.0); }
        else if (!strasse) { by = 18.0; bw = 14.0; bh = min(22.0, sh - 24.0); }
        else if (i == tuer) { typ = laden ? 4.0 : 2.0; by = 0.0; bw = 18.0; bh = min(40.0, sh - 17.0); }
        else if (eg < 0.5) { by = 20.0; bh = min(26.0, sh - 28.0); }
        else if (eg < 1.5) { typ = 3.0; by = 9.0; bw = cw - 6.0; bh = sh - 26.0; }
        else { by = 16.0; bw = 18.0; bh = min(34.0, sh - 24.0); }
        bw = min(bw, cw - 6.0);
        vec2 g = vec2(bw, bh), p = vec2(cx - floor((cw - bw) * 0.5), cy - by);
        if (bw >= 6.0 && bh >= 8.0 && !(offen && k < 0.5)) {
          bool innen = p.x >= 0.0 && p.x < g.x && p.y >= 0.0 && p.y < g.y, rand = p.x < 1.0 || p.x >= g.x - 1.0 || p.y < 1.0 || p.y >= g.y - 1.0;
          bool um = !innen && p.x >= -1.0 && p.x <= g.x && p.y >= -1.0 && p.y <= g.y;                       // the line round the opening
          bool quer = p.x >= -3.0 && p.x < g.x + 3.0;
          vec3 schild = schildfarbe(hh);
          if (typ < 1.5) {
            if (innen) { fein = fenster(p, g, strasse ? PAPIER : hell, h1); grob = mix(GLAS, GLANZ, 0.25); }
            else if (um) fein = strich;
            else if (quer && p.y == -2.0) fein = strasse ? PAPIER : hell;                                    // sill
            else if (quer && p.y == -3.0) fein = dunkel;
            else if (strasse && stil > 1.5 && quer && p.y >= -1.0 && p.y <= g.y + 2.0) fein = zier;          // surround
            else if (strasse && mod(stil, 2.0) > 0.5 && quer && p.y > g.y + 1.0 && p.y < g.y + 4.0) fein = zier; // head moulding
            else if (strasse && mod(stil, 2.0) > 0.5 && quer && p.y == g.y + 4.0) fein = strich;
          } else if (typ < 2.5) {
            if (innen) {
              grob = schild;
              if (p.x < 1.0 || p.x >= g.x - 1.0 || p.y >= g.y - 1.0 || p.y == g.y - 9.0) fein = PAPIER;
              else if (p.y > g.y - 9.0) fein = GLAS;                                                        // fanlight
              else if (p.x == floor(g.x * 0.5)) fein = schild * 0.7;
              else if (mod(p.y, 13.0) < 1.0 && p.y > 2.0) fein = schild * 0.82;                             // panels
              else fein = schild;
            } else if (um && p.y >= 0.0) fein = strich;
            else if (quer && p.y >= 0.0 && p.y <= g.y + 2.0) fein = zier;                                   // the door's frame in stone
          } else {
            if (innen) {
              grob = mix(GLAS, vec3(0.8, 0.72, 0.5), 0.22);
              float s = p.x + p.y - g.y * 0.8;
              if (rand) fein = schild;
              else if (typ < 3.5 && p.y < 7.0) fein = vec3(0.62, 0.5, 0.36);                                // goods in the window
              else if (typ > 3.5 && p.x == floor(g.x * 0.5)) fein = schild;
              else fein = s > 0.0 && s < 5.0 ? GLANZ : grob;
            }
          }
        }
        if (laden && !offen) {                              // the shop's sign, and for some an awning
          vec3 schild = schildfarbe(hh);
          if (cy >= sh - 13.0 && cy < sh - 4.0) {
            fein = schild; grob = schild;
            if (zufall(vec2(i, floor(v_farbe.a * 97.0))) < 0.6 && cy >= sh - 11.0 && cy < sh - 7.0 && cx >= 5.0 && cx < cw - 5.0 && mod(cx - 5.0, 3.0) < 2.0
                && zufall(vec2(floor((cx - 5.0) / 3.0) + i * 13.0, floor(cy * 0.5) + floor(hh * 31.0))) < 0.7) fein = PAPIER;   // a name, too small to read
          } else if (fract(hh * 5.0) < 0.5 && i != tuer && cy >= sh - 19.0 && cy < sh - 13.0) {
            fein = mod(floor(t.x / 3.0), 2.0) < 0.5 ? schild : PAPIER; grob = mix(schild, PAPIER, 0.5);
          }
        }
      }
      if (strasse && S > 1.5 && t.y >= egT - 3.0 && t.y < egT) { fein = zier; grob = zier; }      // string course over the ground floor
      if (strasse && S > 1.5 && t.y == egT - 4.0) fein = dunkel;
      if (strasse && t.y >= Tt - 4.0) { fein = zier; grob = zier; }                               // cornice under the eaves
      if (t.y == Tt - (strasse ? 5.0 : 3.0)) fein = dunkel;
    }
    float unten = offen ? floor((y - min(DURCHFAHRT, T - 0.5)) * PX) : t.y;
    if (offen && unten < 3.0) fein = hell;                                       // head of the gateway
    if (unten < 1.0 && (offen || t.y < 1.0)) fein = KONTUR;                      // foot of the wall
    if (v_wand.z * PX < 1.0) fein = KONTUR;                                      // top of the wall: eaves and verge
    if ((bit(code, 16.0) > 0.5 && t.x < 1.0) || (bit(code, 32.0) > 0.5 && t.x >= floor(L * PX) - 1.0)) fein = KONTUR; // corners
  } else if (art < 3.5) {                                  // inside a gateway
    grund *= 0.5; fein = grund; grob = grund; mittel = grund;
  } else if (art < 4.5) {                                  // roof tiles
    stufe = d > 0.72 ? 1.0 : d > 0.45 ? 0.9 : 0.78;
    float reihe = floor(t.y / 4.0);
    if (mod(t.y, 4.0) < 1.0) fein = grund * 0.86;
    else if (mod(t.x + reihe * 2.0, 4.0) < 1.0 && zufall(vec2(floor(t.x / 4.0), reihe)) < 0.3) fein = grund * 0.92;
    else if (zufall(vec2(floor(t.x / 4.0) + 7.0, reihe)) < 0.07) fein = grund * 1.08;
    if (v_wand.z * PX < 2.0) fein = grund * 1.18;                                // ridge tiles
    if (t.y < 1.0) fein = KONTUR;                                                // eaves
  } else if (art < 5.5) {                                  // flat roof
    stufe = d > 0.72 ? 1.0 : d > 0.45 ? 0.9 : 0.78;
    if (zufall(t) < 0.04) fein = grund * 0.9;
  } else {                                                 // underside
    grund *= 0.42; fein = grund; grob = grund; mittel = grund;
  }

  vec3 c = mix(grob, fein, 1.0 - smoothstep(0.9, 2.0, f));
  c = mix(mittel, c, 1.0 - smoothstep(5.0, 11.0, f));
  c *= mix(0.9, stufe, u_staerke);
  if (stufe < 0.8) c *= mix(vec3(1.0), vec3(0.95, 0.97, 1.06), u_staerke);       // shade is a little cooler
  out_FragColor = czm_gammaCorrect(vec4(c * v_ton.rgb, 1.0));
}`;

/**
 * Put the houses into the scene: one primitive for all of them, one pickable instance per house.
 * `nur(haus)` limits it to some houses; `saetze` (the façade kits, with `basis` as the folder of their pictures) dresses
 * them in sprites. Returns the handle the world view works with; nothing in it rebuilds geometry.
 */
export function baueHaeuser({ Cesium, scene, gebaeude, wege = null, frame, pos, nur = null, saetze = null, basis = null }) {
  const liste = viertel(gebaeude, frame, { wege }).filter((h) => !nur || nur(h));
  // with façade kits every house is dressed in sprites; where each picture lies on the sheet is known before one of them has loaded
  const blatt = saetze ? packe(saetze) : null;
  if (saetze) for (const h of kleideViertel(liste, saetze)) h.kleid.lage = blatt.lage;
  const eintraege = [], nachOid = new Map(), eigene = new Set(), instanzen = [];
  const attribut = (werte, n, typ = Cesium.ComponentDatatype.FLOAT) => new Cesium.GeometryAttribute({ componentDatatype: typ, componentsPerAttribute: n, values: werte });
  let ecken = 0, dreiecke = 0;
  for (const h of liste) {
    const m = netz(h);
    if (!m.indizes.length) continue;
    // the record of a house: what a click shows, and the id the picked instance carries
    const eintrag = new Cesium.Entity({ id: `haus/${h.schluessel}`, name: h.name ?? h.adresse ?? h.funktion, properties: { text: steckbrief(h), oid: h.oid } });
    eintraege.push(eintrag);
    (nachOid.get(h.oid) ?? nachOid.set(h.oid, []).get(h.oid)).push(eintrag);
    eigene.add(h.oid);
    for (const df of h.durchfahrten) eigene.add(df.oid);
    ecken += m.positionen.length / 3; dreiecke += m.indizes.length / 3;
    instanzen.push(new Cesium.GeometryInstance({
      id: eintrag,
      geometry: new Cesium.Geometry({
        attributes: { position: attribut(m.positionen, 3, Cesium.ComponentDatatype.DOUBLE), normal: attribut(m.normalen, 3), wand: attribut(m.wand, 4), bau: attribut(m.bau, 4), farbe: attribut(m.farbe, 4) },
        indices: m.indizes, primitiveType: Cesium.PrimitiveType.TRIANGLES, boundingSphere: Cesium.BoundingSphere.fromVertices(m.positionen),
      }),
      attributes: { color: new Cesium.ColorGeometryInstanceAttribute(1, 1, 1, 1) },
    }));
  }
  const konvergenz = frame.meridiankonvergenz_grad ?? 0;
  const erscheinung = new Cesium.Appearance({ translucent: false, closed: true, vertexShaderSource: VS, fragmentShaderSource: FS,
    renderState: { depthTest: { enabled: true }, cull: { enabled: true, face: Cesium.CullFace.BACK } } });
  // sprites: crisp pixels up close, the texture's own smaller levels far away
  const textur = (quelle, wiederholt) => {
    const wickel = wiederholt ? Cesium.TextureWrap.REPEAT : Cesium.TextureWrap.CLAMP_TO_EDGE;
    const t = new Cesium.Texture({ context: scene.context, source: quelle, sampler: new Cesium.Sampler({ wrapS: wickel, wrapT: wickel,
      minificationFilter: Cesium.TextureMinificationFilter.LINEAR_MIPMAP_LINEAR, magnificationFilter: Cesium.TextureMagnificationFilter.NEAREST }) });
    t.generateMipmap();
    return t;
  };
  const leinwand = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const leer = leinwand(2, 2), lg = leer.getContext('2d');
  lg.fillStyle = '#888888'; lg.fillRect(0, 0, 2, 2);
  const platzhalter = textur(leer, true);
  erscheinung.uniforms = { u_licht: new Cesium.Cartesian3(...lichtvektor(73, 45, konvergenz)), u_staerke: 1, u_deckung: 1,
    u_atlas: platzhalter, u_ziegel: platzhalter, u_putz: platzhalter, u_atlasMass: new Cesium.Cartesian2(2, 2), u_ziegelMass: new Cesium.Cartesian2(1, 1), u_putzMass: new Cesium.Cartesian2(1, 1) };
  const primitive = instanzen.length ? scene.primitives.add(new Cesium.Primitive({ geometryInstances: instanzen, appearance: erscheinung, asynchronous: false, compressVertices: false })) : null;

  /**
   * Load the kits' pictures and lay them on one sheet, pixel for pixel. A façade's wall pixels get half alpha (the shader
   * tints only those), transparent margins take the wall colour, roof parts keep their cut-out. No geometry changes.
   */
  async function male() {
    const lade = (datei) => ladeBild(new URL(datei, basis).href);
    const pixel = (img) => { const c = leinwand(img.width, img.height), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height); };
    const [ziegel, putz, ...bilder] = await Promise.all([lade(saetze.ziegel.datei), lade(saetze.putz.datei), ...blatt.bilder.map((b) => lade(b.datei))]);
    const W = blatt.breite, H = blatt.hoehe, atlas = new Uint8ClampedArray(W * H * 4);
    blatt.bilder.forEach((b, nr) => {
      const q = pixel(bilder[nr]), [x0, y0, w, h] = b.nach, maske = b.satz ? wandmaske(q, b.satz) : null, wandfarbe = b.satz ? rgb(b.satz.wand).map((v) => Math.round(v * 255)) : null;
      for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) { // one pixel beyond every edge repeats the edge, for the far-away levels
        const sx = Math.min(w - 1, Math.max(0, x)), sy = Math.min(h - 1, Math.max(0, y)), s = (sy * q.width + sx) * 4, z = ((y0 + y) * W + x0 + x) * 4, klar = q.data[s + 3] < 128;
        if (b.satz) { for (let k = 0; k < 3; k++) atlas[z + k] = klar ? wandfarbe[k] : q.data[s + k]; atlas[z + 3] = klar || maske[sy * q.width + sx] ? 128 : 255; }
        else { for (let k = 0; k < 3; k++) atlas[z + k] = q.data[s + k]; atlas[z + 3] = klar ? 0 : 255; }
      }
    });
    const u = erscheinung.uniforms, m = (t) => new Cesium.Cartesian2(t.breite / t.px_je_m, t.hoehe / t.px_je_m);
    u.u_atlas = textur({ width: W, height: H, arrayBufferView: new Uint8Array(atlas.buffer) }, false); u.u_atlasMass = new Cesium.Cartesian2(W, H);
    u.u_ziegel = textur(ziegel, true); u.u_ziegelMass = m(saetze.ziegel);
    u.u_putz = textur(putz, true); u.u_putzMass = m(saetze.putz);
    const c = leinwand(W, H); // the sheet as a picture, for looking at it
    c.getContext('2d').putImageData(new ImageData(atlas, W, H), 0, 0);
    return c;
  }
  const gemalt = blatt && primitive ? male() : Promise.resolve(null);

  let durch = new Set(), wunsch = null;
  const setze = (oid, anteil) => { for (const e of nachOid.get(oid) ?? []) { const a = primitive.getGeometryInstanceAttributes(e); if (a) a.color = [255, 255, 255, Math.round(anteil * 255)]; } };
  const zeige = (ids) => {
    if (!primitive) return;
    if (!primitive.ready) { wunsch = ids; return; }
    let geaendert = false;
    for (const oid of durch) if (!ids.has(oid)) { setze(oid, 1); geaendert = true; }
    for (const oid of ids) if (!durch.has(oid) && nachOid.has(oid)) { setze(oid, DURCHSICHT); geaendert = true; }
    durch = new Set([...ids].filter((oid) => nachOid.has(oid)));
    if (geaendert) scene.requestRender(); // see-through houses are a change the camera does not report
  };
  if (primitive) { const fertig = scene.postRender.addEventListener(() => { if (primitive.ready) { fertig(); if (wunsch) zeige(wunsch); } }); }

  return {
    liste, eintraege, primitive, anzahl: liste.length, ecken, dreiecke,
    /** Resolves when the sprites of the dressed houses are in (with the sheet they were set together on), or with null. */
    gemalt, gekleidet: liste.filter((h) => h.kleid).length,
    /** Is this ALKIS object (a house, or a gateway of one) drawn here? */
    hat: (oid) => eigene.has(oid),
    /** Put the houses on the ground `pos` describes (it changes with the 3D tiles). */
    stelle() {
      if (!primitive) return;
      const [E0, N0] = frame.ursprung_utm32, o = pos([E0, N0], 0), C = Cesium.Cartesian3;
      const ost = C.multiplyByScalar(C.subtract(pos([E0 + 100, N0], 0), o, new C()), 0.01, new C()), nord = C.multiplyByScalar(C.subtract(pos([E0, N0 + 100], 0), o, new C()), 0.01, new C());
      const auf = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(o, new C());
      primitive.modelMatrix = new Cesium.Matrix4(ost.x, nord.x, auf.x, o.x, ost.y, nord.y, auf.y, o.y, ost.z, nord.z, auf.z, o.z, 0, 0, 0, 1);
    },
    /** The houses with these ids stand between camera and player: they thin out to a screen of pixels. */
    zeige,
    /** All houses thinned out by this much (1: solid), as over the 3D tiles. */
    deckung(anteil) { erscheinung.uniforms.u_deckung = anteil; },
    /** The sun: compass bearing it shines from, elevation, strength 0..1. Changes three numbers, no geometry. */
    licht({ azimut, hoehe, staerke = 1 }) { erscheinung.uniforms.u_licht = new Cesium.Cartesian3(...lichtvektor(azimut, hoehe, konvergenz)); erscheinung.uniforms.u_staerke = staerke; },
    sichtbar(an) { if (primitive) primitive.show = an; },
    /** Enter the houses' records in a layer's entity list (they carry the click text and are the pick ids). */
    verzeichne(entities) { for (const e of eintraege) { if (e.entityCollection && e.entityCollection !== entities) e.entityCollection.remove(e); if (!entities.contains(e)) entities.add(e); } },
  };
}
