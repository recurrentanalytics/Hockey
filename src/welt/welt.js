// World view of a place: the official aerial photo on the ground, the real building footprints as
// volumes, streets, paths, trees and the court from locations/<ort>/geo (tools/ort/geodaten.py).
// Same 3D stack as the intro (CesiumJS from the CDN). With the club's Cesium ion token on this
// device the Google photorealistic 3D tiles can be switched on as well; without it the view
// stands on the aerial photo alone. An inspection view, not gameplay yet.
import { fromUtm32, toUtm32 } from './utm.js';
import { placeLibrary, usable, frameImages } from './bibliothek.js';
import { hain, kronenkarte, baumbilder, pflanze, LICHT } from './baeume.js';
import { createEnvironment, weatherPanel } from '../intro/environment.js';
import { surfaceFor, setSurface } from '../game/surface.js';
import { starte } from './spieler.js';
import { pixelboden } from './pixelboden.js';
import { baueHindernisse, davor } from './hindernisse.js';
import { ladeLuftbild, rechteck, ausschnitt } from './luftbild.js';
import { platzmeter } from './baeume.js';
import { baueHaeuser } from './haeuser.js';

const CESIUM_VERSION = '1.147.0';    // keep in step with src/intro/photoreal.js
const GOOGLE_3D_TILES = 2275207;     // Cesium ion asset, as in the intro
const TOKEN_KEY = 'boniCesiumToken'; // stored by the intro (src/intro/main.js)
const LGLN = 'https://opendata.lgln.niedersachsen.de/doorman/noauth/';
const FALLBACK_HEIGHT = 10;          // metres, for footprints without any height information
const GAME_VIEW = { heading: 118.2, tilt: 60 }; // the game camera: looking A → B, 60° from vertical
// The houses of haeuser.js wait for the owner's approval: ?haeuser=probe shows the houses dressed in the
// SpriteCook façade kit (assets/welt/haeuser/bausatz.json names them), ?haeuser=neu also draws every other
// house by rule; without it every footprint stays the plain volume it was.

const Q = new URLSearchParams(location.search);
const ort = Q.get('ort') || 'boni';
const base = new URL(`../../locations/${ort}/geo/`, import.meta.url);
const load = (name) => fetch(new URL(name, base)).then((r) => { if (!r.ok) throw new Error(`${name}: ${r.status}`); return r.json(); });
const $ = (id) => document.getElementById(id);
const status = (text) => { $('status').textContent = text; };

function loadCesium(dir) {
  window.CESIUM_BASE_URL = dir;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = `${dir}Widgets/widgets.css`;
  document.head.appendChild(css);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = `${dir}Cesium.js`; s.onload = () => res(window.Cesium); s.onerror = () => rej(new Error('CesiumJS konnte nicht geladen werden (Netz?)'));
    document.head.appendChild(s);
  });
}

const LAYERS = [
  { id: 'luftbild', name: 'Luftbild (eigene Kopie, 0,5 m)', on: true },
  { id: 'luftbildlive', name: 'Luftbild live vom LGLN (0,2 m)', on: true },
  { id: 'pixelboden', name: 'Pixel-Boden um den Platz', on: true },
  { id: 'google', name: 'Google-3D-Kacheln', on: false },
  { id: 'nutzung', name: 'Straßen, Wege, Flächen (ALKIS)', on: false },
  { id: 'gebaeude', name: 'Gebäude als Volumen (ALKIS)', on: true },
  { id: 'wege', name: 'Wegelinien (OSM)', on: false },
  { id: 'baeume', name: 'Bäume mit Schatten (OSM-Standorte)', on: true },
  { id: 'einfriedungen', name: 'Zäune, Mauern (OSM)', on: true },
  { id: 'platz', name: 'Bolzplatz: Zaun und Tore (Modell des Intros)', on: true },
  { id: 'platzmarken', name: 'Platz-Ecken und Achsen (Prüfung)', on: false },
  { id: 'bibliothek', name: 'Art-Bibliothek (SpriteCook)', on: true },
];
const USE_COLOR = { 'Straßenverkehr': '#8d8a85', 'Weg': '#d9c79a', 'Wohnbaufläche': '#e8dcc0', 'Sport-, Freizeit- und Erholungsfläche': '#8fbf6a' };

async function main() {
  status('Lade Geodaten …');
  const [frame, gebaeude, nutzung, wege, baeume, einfriedungen, platz, ausstattung, flaechen] = await Promise.all(
    ['rahmen.json', 'gebaeude.geojson', 'nutzung.geojson', 'wege.geojson', 'baeume.geojson', 'einfriedungen.geojson', 'platz.geojson', 'ausstattung.geojson', 'flaechen.geojson'].map(load));
  // The art library: sprites stand where their manifest entry binds them (see bibliothek.js)
  const manifest = await fetch(new URL('../../assets/manifest.json', import.meta.url)).then((r) => (r.ok ? r.json() : { assets: [] })).catch(() => ({ assets: [] }));
  const preview = Q.get('preview') === 'art';
  const geo = { baeume, ausstattung, einfriedungen, wege, platz };
  // The grove: size from the canopy survey where it reaches, species and mirroring by the tree's id (baeume.js)
  const ASSETS = new URL('../../assets/', import.meta.url);
  const baumArten = usable(manifest, preview).filter((a) => a.place.layer === 'baeume');
  // mapped trees, plus the crowns the canopy survey shows where OSM has no tree (not on the court itself)
  const krKarte = await kronenkarte(new URL('intro/boni_schatten_hoehen.png', ASSETS).href);
  const baumListe = hain(baeume.features, frame, baumArten, krKarte,
    { sperre: (a, b) => Math.abs(a) < 13.4 && Math.abs(b) < 9.8 });
  const baumBilder = Object.fromEntries(await Promise.all(baumArten.map(async (a) => [a.id, await baumbilder(a, ASSETS)])));
  const figur = manifest.assets.find((a) => a.id === 'character.skater.stride' && (a.approved || preview));
  const figurBilder = figur ? { rechts: await frameImages(figur), links: await frameImages(figur, true), seiten: figur.frame.w / figur.frame.h } : null;
  const foto = await ladeLuftbild(ASSETS).catch(() => null); // the place's own aerial photo; the world stands on it
  let grove = { baeume: baumListe, zeige() {} };
  const hindernisse = baueHindernisse({ gebaeude, einfriedungen, platz, frame });
  const haeuser = []; // drawn building volumes, so the ones hiding the player can turn see-through
  const hausArt = Q.get('haeuser') ?? 'alt'; // 'alt' plain volumes, 'probe' the houses of the sprite kit, 'neu' every house
  let viertelHaeuser = null;                 // the houses of haeuser.js
  const satz = (Q.get('bausatz') ?? '').replace(/[^a-z0-9]/g, ''); // ?bausatz=b: another kit for the same houses, to compare
  const bausatz = hausArt === 'alt' ? null : await fetch(new URL(`welt/haeuser/bausatz${satz ? '-' + satz : ''}.json`, ASSETS)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  let spieler = null;
  status('Lade 3D-Ansicht …');
  const Cesium = await loadCesium(Q.get('cesiumBase') || `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`);
  Cesium.Ion.defaultAccessToken = undefined; // nothing here needs Cesium ion unless the Google layer is switched on

  const [E0, N0] = frame.ursprung_utm32, A = frame.achse_a, B = frame.achse_b;
  const around = (de, dn) => fromUtm32(E0 + de, N0 + dn);
  // The aerial photo: LGLN's open WMS, asked for in Web Mercator tiles (plain x/y order, no axis ambiguity)
  const luftbild = new Cesium.ImageryLayer(new Cesium.UrlTemplateImageryProvider({
    url: `${LGLN}dop_wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS=ni_dop20&STYLES=&CRS=EPSG:3857&BBOX={westProjected},{southProjected},{eastProjected},{northProjected}&WIDTH=256&HEIGHT=256&FORMAT=image/jpeg`,
    tilingScheme: new Cesium.WebMercatorTilingScheme(), maximumLevel: 21,
    rectangle: Cesium.Rectangle.fromDegrees(...around(-1500, -1500), ...around(1500, 1500)), // 3 km round the place; nothing is asked for outside
    credit: new Cesium.Credit('Luftbild und ALKIS © GeoBasis-DE / LGLN, CC BY 4.0', true),
  }));
  const viewer = new Cesium.Viewer('cesium', {
    baseLayer: false, animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
    sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false, selectionIndicator: false,
    scene3DOnly: true, // renders every frame: with request-render mode the volumes built in the background never appeared until the camera moved
  });
  const { scene, camera } = viewer;
  // ground: the own copy first, the live service on top while it answers (sharper); it switches itself off when it fails
  let lokal = null;
  if (foto) {
    const r = rechteck(frame.ursprung_utm32, 595), kante = 2380;
    lokal = viewer.imageryLayers.addImageryProvider(new Cesium.SingleTileImageryProvider({ url: ausschnitt(foto, r, kante).toDataURL('image/jpeg', 0.9),
      rectangle: Cesium.Rectangle.fromDegrees(r.west, r.south, r.east, r.north), tileWidth: kante, tileHeight: kante, credit: new Cesium.Credit('Luftbild © GeoBasis-DE / LGLN, CC BY 4.0', true) }));
  }
  viewer.imageryLayers.add(luftbild);
  let ausfaelle = 0;
  luftbild.imageryProvider.errorEvent.addEventListener(() => {
    if (++ausfaelle !== 6) return;
    luftbild.show = false; LAYERS.find((l) => l.id === 'luftbildlive').on = false;
    const haken = $('ebenen').querySelectorAll('input[type=checkbox]')[LAYERS.findIndex((l) => l.id === 'luftbildlive')];
    if (haken) haken.checked = false;
    status('LGLN-Dienst antwortet nicht: es gilt die eigene Kopie des Luftbilds');
  });
  scene.globe.baseColor = Cesium.Color.fromCssColorString('#3a4038');
  scene.globe.depthTestAgainstTerrain = false;
  scene.skyAtmosphere.show = false; scene.fog.enabled = false;
  viewer.creditDisplay.addStaticCredit(new Cesium.Credit('Wege, Bäume, Höhen © OpenStreetMap-Mitwirkende, ODbL', true));

  // ---- the pixel ground: the aerial photo round the court as pixel art, dissolving into the real photo (pixelboden.js)
  const inMetern = (ring) => ring.map((p) => platzmeter(frame, p));
  const nah = (ring) => ring.some((p) => Math.hypot(...p) < 75);
  const platzFlaeche = flaechen.features.find((f) => f.properties.leisure === 'playground' && f.geometry.type === 'Polygon' && f.geometry.coordinates[0].some((p) => Math.hypot(...platzmeter(frame, p)) < 30));
  const umrisse = [
    ...platz.features.filter((f) => f.properties.art === 'zaun').map((f) => inMetern(f.geometry.coordinates[0])),
    ...flaechen.features.filter((f) => f.properties.leisure === 'playground' && f.geometry.type === 'Polygon').map((f) => inMetern(f.geometry.coordinates[0])),
    ...nutzung.features.filter((f) => f.properties.nutzart === 'Weg' && f.geometry.type === 'Polygon').map((f) => inMetern(f.geometry.coordinates[0])),
  ].filter(nah);
  let pixelLayer = null;
  if (foto) pixelboden({ frame, foto, baeume: baumListe, linien: umrisse, platzRing: platzFlaeche ? inMetern(platzFlaeche.geometry.coordinates[0]) : null }).then((b) => {
    pixelLayer = new Cesium.ImageryLayer(new Cesium.SingleTileImageryProvider({ url: b.url, rectangle: Cesium.Rectangle.fromDegrees(b.west, b.south, b.east, b.north), tileWidth: b.px, tileHeight: b.px }),
      { magnificationFilter: Cesium.TextureMagnificationFilter.NEAREST, minificationFilter: Cesium.TextureMinificationFilter.NEAREST });
    pixelLayer.show = LAYERS.find((l) => l.id === 'pixelboden').on;
    viewer.imageryLayers.add(pixelLayer);
  }).catch((e) => status('Pixel-Boden nicht erzeugt: ' + e.message));

  // ---- geometry: UTM metres → positions on the globe. `ground` is the height everything stands on:
  // 0 on the plain aerial photo (the globe is the ellipsoid, no terrain model), the measured street
  // level once the Google tiles are shown.
  let ground = 0;
  const centre = fromUtm32(E0, N0);
  const pos = ([e, n], h = 0) => { const [lon, lat] = fromUtm32(e, n); return Cesium.Cartesian3.fromDegrees(lon, lat, ground + h); };
  const ring = (r, h) => r.slice(0, -1).map((p) => pos(p, h));
  const hierarchy = (poly, h) => new Cesium.PolygonHierarchy(ring(poly[0], h), poly.slice(1).map((r) => new Cesium.PolygonHierarchy(ring(r, h))));
  const polygons = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
  const css = (c, a = 1) => Cesium.Color.fromCssColorString(c).withAlpha(a);
  const sources = {};
  const describe = (name, p) => `${name}\n` + Object.entries(p).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');

  function build() {
    for (const s of Object.values(sources)) viewer.dataSources.remove(s, true);
    const layer = (id) => { const s = new Cesium.CustomDataSource(id); s.show = LAYERS.find((l) => l.id === id).on; sources[id] = s; viewer.dataSources.add(s); return s.entities; };

    const use = layer('nutzung');
    for (const f of nutzung.features) for (const poly of polygons(f.geometry)) {
      use.add({ polygon: { hierarchy: hierarchy(poly, 0.05), perPositionHeight: true, material: css(USE_COLOR[f.properties.nutzart] || '#c9b8d8', 0.38),
        outline: true, outlineColor: css('#1d1a16', 0.55) }, properties: { text: describe('Nutzung (ALKIS)', f.properties) } });
    }
    const blocks = layer('gebaeude');
    haeuser.length = 0;
    if (hausArt !== 'alt' && scene.context.webgl2) {           // drawn houses: built once; ground, cover and records follow here
      viertelHaeuser ??= baueHaeuser({ Cesium, scene, gebaeude, wege, frame, pos, bausatz, basis: new URL('welt/haeuser/', ASSETS), nur: hausArt === 'probe' ? (h) => !!bausatz?.haeuser.includes(h.adresse) : null });
      viertelHaeuser.stelle(); viertelHaeuser.licht(LICHT); viertelHaeuser.deckung(google.on ? 0.45 : 1); viertelHaeuser.sichtbar(LAYERS.find((l) => l.id === 'gebaeude').on); viertelHaeuser.verzeichne(blocks);
    }
    for (const f of gebaeude.features) {
      if (viertelHaeuser?.hat(f.properties.oid)) continue;
      const p = f.properties, part = p.art === 'Bauteil';      // passages and arcades: open at street level
      const h = p.hoehe_m ?? (part ? 4 : FALLBACK_HEIGHT), known = p.hoehe_m != null;
      const colour = part ? '#b9a48f' : p.name ? '#a8452f' : known ? '#c8664d' : '#d9b9a8';
      for (const poly of polygons(f.geometry)) {
        const haus = blocks.add({ polygon: { hierarchy: hierarchy(poly, part ? 3.2 : 0), perPositionHeight: true, extrudedHeight: ground + (part ? Math.max(h, 7) : h), material: css(colour, google.on ? 0.45 : 1),
          outline: true, outlineColor: css('#2a1d1a') }, properties: { text: describe(known ? 'Gebäude (ALKIS)' : 'Gebäude (ALKIS), Höhe unbekannt: angenommen', { ...p, dargestellte_hoehe_m: h }) } });
        haeuser.push({ id: p.oid, colour, haus, durch: false });
      }
    }
    const lines = layer('wege');
    for (const f of wege.features) {
      const foot = ['footway', 'path', 'steps', 'pedestrian', 'cycleway'].includes(f.properties.highway);
      lines.add({ polyline: { positions: f.geometry.coordinates.map((p) => pos(p, 0.25)), width: foot ? 2 : 3,
        material: foot ? new Cesium.PolylineDashMaterialProperty({ color: css('#7a4a12'), dashLength: 10 }) : css('#f4f1e8') },
        properties: { text: describe('Weg (OSM)', f.properties) } });
    }
    const trees = layer('baeume');
    for (const f of baeume.features) if (f.geometry.type !== 'Point') trees.add({ polyline: { positions: f.geometry.coordinates.map((p) => pos(p, 0.3)), width: 4, material: css('#2f7d32') }, properties: { text: describe('Baumreihe (OSM)', f.properties) } });
    // on the aerial photo the real cast shadows are already in the picture: contact shadows only (see schatten())
    pflanze({ Cesium, entities: trees, baeume: baumListe, bilder: baumBilder, frame, pos, fotoBoden: (lokal?.show || luftbild.show) && !google.on }).then((g) => { grove = g; });
    const fences = layer('einfriedungen');
    for (const f of einfriedungen.features) {
      if (f.geometry.type === 'LineString') fences.add({ wall: { positions: f.geometry.coordinates.map((p) => pos(p, 1.4)), minimumHeights: f.geometry.coordinates.map(() => ground), material: css('#7a1fa2', 0.7) }, properties: { text: describe('Einfriedung (OSM), Höhe angenommen 1,4 m', f.properties) } });
      else fences.add({ position: pos(f.geometry.coordinates, 0.6), point: { pixelSize: 6, color: css('#7a1fa2') }, properties: { text: describe('Einfriedung (OSM)', f.properties) } });
    }
    const court = layer('platzmarken');
    stelleModell();
    for (const f of platz.features) {
      const p = f.properties;
      if (p.art === 'zaun') court.add({ polyline: { positions: f.geometry.coordinates[0].map((q) => pos(q, 0.35)), width: 4, material: css('#e00000') }, properties: { text: describe('Bolzplatz: Zaun (Verein, ±1 m)', p) } });
      if (p.art === 'ecke') court.add({ position: pos(f.geometry.coordinates, 0.4), point: { pixelSize: 7, color: css('#e00000'), outlineColor: css('#ffffff'), outlineWidth: 1 },
        label: { text: p.name, font: 'bold 14px sans-serif', fillColor: css('#ffffff'), outlineColor: css('#000000'), outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(10, -10), disableDepthTestDistance: Infinity } });
      if (p.art === 'achse') court.add({ polyline: { positions: f.geometry.coordinates.map((q) => pos(q, 0.4)), width: 3, material: new Cesium.PolylineArrowMaterialProperty(css(p.name === 'a' ? '#ffd23f' : '#3fd2ff')) } });
    }
    const library = layer('bibliothek');
    placeLibrary({ Cesium, entities: library, manifest, geo, frame, pos, preview, skip: (a) => a.place.layer === 'baeume' || a.id === figur?.id }).then((n) => { $('bibliothek').textContent = `${n} Sprites aus der Art-Bibliothek` + (preview ? ' (mit wartenden)' : ''); });
    scene.requestRender();
  }

  // The court as the intro shows it at its end: fence, football goals and street-hockey goals
  // (assets/intro/boni_platz.glb, tools/intro/court_glb.py), set on the same fence rectangle.
  let platzModell = null;
  function modellMatrix() {
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(pos([E0, N0], 0)), inv = Cesium.Matrix4.inverse(enu, new Cesium.Matrix4());
    const lokal = (en) => Cesium.Matrix4.multiplyByPoint(inv, pos(en, 0), new Cesium.Cartesian3());
    const o = lokal([E0, N0]), pa = lokal([E0 + 10 * A[0], N0 + 10 * A[1]]), pb = lokal([E0 + 10 * B[0], N0 + 10 * B[1]]);
    const u = { x: (pa.x - o.x) / 10, y: (pa.y - o.y) / 10 }, v = { x: (pb.x - o.x) / 10, y: (pb.y - o.y) / 10 };
    return Cesium.Matrix4.multiply(enu, new Cesium.Matrix4(u.x, v.x, 0, o.x, u.y, v.y, 0, o.y, 0, 0, 1, 0.03, 0, 0, 0, 1), new Cesium.Matrix4());
  }
  function stelleModell() { if (platzModell) platzModell.modelMatrix = modellMatrix(); }
  Cesium.Model.fromGltfAsync({ url: new URL('intro/boni_platz.glb', ASSETS).href, modelMatrix: modellMatrix(), forwardAxis: Cesium.Axis.X })
    .then((m) => { platzModell = scene.primitives.add(m); platzModell.show = LAYERS.find((l) => l.id === 'platz').on; })
    .catch((e) => status('Platzmodell nicht geladen: ' + e.message));

  function zeigeHaeuser(ids) {
    viertelHaeuser?.zeige(ids);
    for (const h of haeuser) { const durch = ids.has(h.id); if (durch !== h.durch) { h.durch = durch; h.haus.polygon.material = css(h.colour, durch ? 0.2 : google.on ? 0.45 : 1); } }
  }

  // ---- Google photorealistic 3D tiles (the intro's 3D context), only with the club's token
  const google = LAYERS.find((l) => l.id === 'google');
  let tiles = null;
  let token = Q.get('token') || (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
  google.available = !!token;
  async function showGoogle(on) {
    if (on && !tiles) {
      status('Lade Google-3D-Kacheln …');
      const ep = await (await fetch(`https://api.cesium.com/v1/assets/${GOOGLE_3D_TILES}/endpoint?access_token=${encodeURIComponent(token)}`)).json();
      if (!ep.options?.url) throw new Error(ep.message || 'Cesium ion: kein Zugriff');
      tiles = await Cesium.Cesium3DTileset.fromUrl(ep.options.url, { showCreditsOnScreen: true });
      scene.primitives.add(tiles);
      for (const a of ep.attributions ?? []) viewer.creditDisplay.addStaticCredit(new Cesium.Credit(a.html, true));
    }
    if (tiles) tiles.show = on;
    scene.globe.show = !on; // the tiles carry their own ground; the flat globe would cut through it
    ground = 0;
    if (on) {
      await new Promise((r) => setTimeout(r, 1500)); // let the first tiles arrive before measuring
      try { const [c] = await scene.sampleHeightMostDetailed([Cesium.Cartographic.fromDegrees(centre[0], centre[1])]); ground = Number.isFinite(c?.height) ? c.height : 97.9; } catch { ground = 97.9; }
    }
    build(); view(current); status(on ? `Google-3D-Kacheln an, Boden bei ${ground.toFixed(1)} m (Ellipsoid)` : 'bereit');
  }

  // ---- camera: orbit round the court centre; presets as on the buttons
  let current = 'schraeg';
  const VIEWS = {
    oben: { heading: 0, pitch: -90, range: 520 },
    schraeg: { heading: 25, pitch: -38, range: 330 },
    spiel: { heading: GAME_VIEW.heading, pitch: -(90 - GAME_VIEW.tilt), range: 75 },
    fahren: null, // the camera follows the player (spieler.js)
    platz: { heading: frame.kompassrichtung_b_grad, pitch: -90, range: 60 },
  };
  function view(name) {
    current = name;
    spieler?.folge(name === 'fahren');
    if (name === 'fahren') { status(spieler ? 'Losfahren: Pfeiltasten oder WASD, oder auf den Boden tippen' : 'Kein freigegebener Spieler in der Art-Bibliothek'); return; }
    const v = VIEWS[name];
    camera.lookAt(pos([E0, N0], 0), new Cesium.HeadingPitchRange(Cesium.Math.toRadians(v.heading), Cesium.Math.toRadians(v.pitch), v.range));
    camera.lookAtTransform(Cesium.Matrix4.IDENTITY); // free the camera again: drag, zoom and tilt as usual
    scene.requestRender();
  }

  // ---- panel
  const list = $('ebenen');
  for (const l of LAYERS) {
    const label = document.createElement('label');
    const usable = l.id !== 'google' || google.available;
    label.innerHTML = `<input type="checkbox" ${l.on ? 'checked' : ''} ${usable ? '' : 'disabled'}> ${l.name}${usable ? '' : ' <small>(braucht den Cesium-Token des Vereins)</small>'}`;
    label.querySelector('input').onchange = async (ev) => {
      l.on = ev.target.checked;
      if (l.id === 'pixelboden') { if (pixelLayer) pixelLayer.show = l.on; }
      else if (l.id === 'platz') { if (platzModell) platzModell.show = l.on; }
      else if (l.id === 'luftbild') { if (lokal) lokal.show = l.on; build(); }
      else if (l.id === 'luftbildlive') { luftbild.show = l.on; build(); } // the shadow rule depends on the ground
      else if (l.id === 'google') { try { await showGoogle(l.on); } catch (e) { l.on = false; ev.target.checked = false; status('Google-3D nicht geladen: ' + e.message + (/token|401|403|invalid|Zugriff/i.test(e.message) ? ' – Token prüfen: ?token=… an die Adresse hängen oder die Website-Daten löschen und neu einfügen.' : '')); scene.globe.show = true; } }
      else { sources[l.id].show = l.on; if (l.id === 'gebaeude') viertelHaeuser?.sichtbar(l.on); }
      scene.requestRender();
    };
    list.append(label);
  }
  // The token: always visible whether one is stored. It can be pasted right here, stays on this device
  // (same place the intro keeps it) and is only ever sent to Cesium ion when the Google layer is switched on.
  const tokenBox = document.createElement('div');
  list.append(tokenBox);
  const googleCheck = list.querySelectorAll('input[type=checkbox]')[LAYERS.indexOf(google)];
  function tokenUi(edit) {
    if (token && !edit) {
      tokenBox.innerHTML = '<small>Cesium-Token: auf diesem Gerät gespeichert ✓</small> <button>ändern</button>';
      tokenBox.querySelector('button').onclick = () => tokenUi(true);
      return;
    }
    tokenBox.innerHTML = '<small>Cesium-Token: keiner gespeichert</small><input type="password" autocomplete="off" placeholder="Cesium-Token hier einfügen" style="width:100%;box-sizing:border-box;margin:4px 0;font:inherit"><button>Token speichern</button>';
    tokenBox.querySelector('button').onclick = () => {
      const value = tokenBox.querySelector('input').value.trim();
      if (!value) return;
      try { localStorage.setItem(TOKEN_KEY, value); } catch { /* private window: kept until the page closes */ }
      token = value; google.available = true;
      googleCheck.disabled = false; googleCheck.parentElement.querySelector('small')?.remove();
      tokenUi(false);
      status('Token gespeichert. Jetzt „Google-3D-Kacheln“ anhaken.');
    };
  }
  tokenUi(false);
  for (const b of document.querySelectorAll('[data-sicht]')) b.onclick = () => view(b.dataset.sicht);

  // ---- pointer: position in the grid and in court metres; click shows what is there
  const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
  const groundPoint = (p) => {
    const ray = camera.getPickRay(p);
    const hit = ray && (scene.globe.show ? scene.globe.pick(ray, scene) : Cesium.IntersectionTests.rayPlane(ray, Cesium.Plane.fromPointNormal(pos([E0, N0], 0), Cesium.Cartesian3.normalize(pos([E0, N0], 0), new Cesium.Cartesian3())), new Cesium.Cartesian3()));
    if (!hit) return null;
    const c = Cesium.Cartographic.fromCartesian(hit);
    return toUtm32(Cesium.Math.toDegrees(c.longitude), Cesium.Math.toDegrees(c.latitude));
  };
  handler.setInputAction((m) => {
    const en = groundPoint(m.endPosition);
    if (!en) return;
    const de = en[0] - E0, dn = en[1] - N0;
    $('lage').textContent = `Ost ${en[0].toFixed(1)}  Nord ${en[1].toFixed(1)}\nPlatz a ${(de * A[0] + dn * A[1]).toFixed(1)} m, b ${(de * B[0] + dn * B[1]).toFixed(1)} m`;
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  handler.setInputAction((m) => {
    if (spieler?.tippe(m.position)) return;
    const hit = scene.pick(m.position);
    $('info').textContent = hit?.id?.properties?.text ? hit.id.properties.text.getValue() : 'Kein Objekt an dieser Stelle.';
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // ---- the match on the court, in this same scene (no page change): the game draws its figures through this
  // camera onto a see-through canvas, exactly as it does at the end of the intro (globalThis.BONI_3D.toCss).
  const SPIELFOV = Cesium.Math.toRadians(20), FREIFOV = camera.frustum.fov, platzEcken = [[-12.6, -9], [12.6, -9], [12.6, 9], [-12.6, 9], [0, 0]];
  let imSpiel = false, spielGeladen = false, spielMatrix = null;
  scene.postRender.addEventListener(() => {
    if (!imSpiel) return;
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(pos([E0, N0], 0)), inv = Cesium.Matrix4.inverse(enu, new Cesium.Matrix4());
    const lokal = (en) => Cesium.Matrix4.multiplyByPoint(inv, pos(en, 0), new Cesium.Cartesian3());
    const o = lokal([E0, N0]), pa = lokal([E0 + 10 * A[0], N0 + 10 * A[1]]), pb = lokal([E0 + 10 * B[0], N0 + 10 * B[1]]);
    const u = { x: (pa.x - o.x) / 10, y: (pa.y - o.y) / 10 }, v = { x: (pb.x - o.x) / 10, y: (pb.y - o.y) / 10 };
    // game metres: x along the court (axis a), y towards the camera (against axis b), z up
    const m = Cesium.Matrix4.multiply(camera.frustum.projectionMatrix, camera.viewMatrix, new Cesium.Matrix4());
    Cesium.Matrix4.multiply(m, enu, m);
    spielMatrix = Cesium.Matrix4.multiply(m, new Cesium.Matrix4(u.x, -v.x, 0, o.x, u.y, -v.y, 0, o.y, 0, 0, 1, 0, 0, 0, 0, 1), m);
  });
  const toCss = (x, y, z) => {
    const m = spielMatrix, cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    return { x: ((cx / cw + 1) / 2) * scene.canvas.clientWidth, y: ((1 - cy / cw) / 2) * scene.canvas.clientHeight };
  };
  function spielkamera() { // the fixed game camera of the intro's end: the court fills the width, seen 60° from the vertical
    const aspekt = scene.canvas.clientWidth / Math.max(1, scene.canvas.clientHeight), breite = 25.2 / (aspekt >= 1 ? 0.78 : 0.95);
    camera.frustum.fov = aspekt >= 1 ? SPIELFOV : 2 * Math.atan(Math.tan(SPIELFOV / 2) / aspekt);
    const kurs = Cesium.Math.toRadians(GAME_VIEW.heading), hub = breite * 0.025;
    const ziel = platzmeterZuGitter([0, hub]); // a little beyond the centre, so the court sits just below the middle
    camera.lookAt(pos(ziel, 0), new Cesium.HeadingPitchRange(kurs, Cesium.Math.toRadians(-(90 - GAME_VIEW.tilt)), breite / (2 * Math.tan(SPIELFOV / 2))));
    camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  }
  const platzmeterZuGitter = ([a, b]) => [E0 + a * A[0] + b * B[0], N0 + a * A[1] + b * B[1]];
  async function betrete() {
    if (imSpiel) return;
    imSpiel = true;
    spieler?.spielt(true);
    document.body.classList.add('imspiel');
    spielkamera();
    // trees and houses between this camera and the court step aside for as long as the match runs
    grove.zeigeMehrere?.(platzEcken, [0, 1]);
    zeigeHaeuser(new Set(platzEcken.flatMap((p) => [...davor(p, hindernisse)])));
    for (let i = 0; i < 2; i++) { scene.render(); await new Promise((r) => setTimeout(r, 30)); } // camera drawn → matrix ready
    globalThis.BONI_3D.pausiert = false;
    if (!spielGeladen) {
      status('Lade das Spiel …');
      await import('../main.js');
      spielGeladen = true;
    }
    $('screen').focus({ preventScroll: true });
    status('Spiel läuft – „Platz verlassen“ bringt dich zurück ins Viertel');
  }
  function verlasse() {
    if (!imSpiel) return;
    imSpiel = false;
    if (globalThis.BONI_3D) globalThis.BONI_3D.pausiert = true; // the match sleeps where it was
    try { window.app?.audio?.setAmbient?.(false); } catch { /* no sound running */ }
    document.body.classList.remove('imspiel');
    camera.frustum.fov = FREIFOV;
    spieler?.spielt(false);
    view('fahren');
  }
  // ---- sun, weather and season: the intro's own module with the intro's own rules (src/intro/environment.js).
  // Colour grade, rain and snow, live weather, the weather panel; and passed on from here: the figures' sun
  // shadow and tree shade, the court's grip and wind for the physics, the direction and depth of the tree shadows.
  globalThis.BONI_3D = { toCss, pausiert: true }; // before any game module loads: it reads this once
  let umwelt = null, neuZeichnen = null;
  const beiUmwelt = (st) => {
    const v = st.visuals, az = (v.sun.az * Math.PI) / 180;
    if (v.sunlit < 0.04 || v.sun.alt < 1) globalThis.BONI_3D.shadow = null;
    else {
      const k = Math.min(4, 1 / Math.tan((Math.max(v.sun.alt, 8) * Math.PI) / 180)), dE = -Math.sin(az), dN = -Math.cos(az); // away from the sun
      const a = dE * A[0] + dN * A[1], b = dE * B[0] + dN * B[1], steigung = Math.tan((v.sun.alt * Math.PI) / 180);
      globalThis.BONI_3D.shadow = {
        x: a * k, y: -b * k, alpha: 0.22 + 0.33 * v.sunlit, leaf: v.leaf,
        /** 0 in the shade of a tree or house … 1 in full sun, for a figure at game position (x, y): a ray towards the sun through the canopy survey */
        lit(x, y) {
          let treffer = 0;
          for (let t = 0.5; t < 45; t += 0.5) if (krKarte.roh(x - a * t, -y - b * t) > 0.9 + t * steigung && ++treffer > 1) break;
          const laub = this.leaf ?? 0.85;
          return treffer > 1 ? Math.max(0, 1 - laub * 1.1) : treffer ? 1 - laub * 0.5 : 1;
        },
      };
    }
    const hin = ((st.air.windDir + 180) * Math.PI) / 180, wE = Math.sin(hin), wN = Math.cos(hin);
    const belag = surfaceFor({ look: st.look, temp: st.air.temp, wind: st.air.wind, windTo: { x: wE * A[0] + wN * A[1], y: -(wE * B[0] + wN * B[1]) }, leaves: st.air.leaves, amount: st.air.amount });
    setSurface(belag);
    if (umwelt) umwelt.surfaceLabel = belag.label;
    $('surface').textContent = belag.label;
    LICHT.azimut = v.sun.az; LICHT.hoehe = Math.max(v.sun.alt, 8); LICHT.staerke = Math.min(1, v.sunlit * 1.2);
    viertelHaeuser?.licht(LICHT); // the houses take the light at once: three numbers, nothing is rebuilt
    clearTimeout(neuZeichnen); neuZeichnen = setTimeout(() => { if (sources.baeume) build(); }, 400); // tree shadows turn with the sun
  };
  try {
    umwelt = createEnvironment({ Cesium, viewer, ground: {}, onChange: beiUmwelt });
    weatherPanel(umwelt);
    $('wxBtn').hidden = false; $('surface').hidden = false;
  } catch (e) { status('Wetter nicht verfügbar: ' + e.message); }

  window.addEventListener('resize', () => { if (imSpiel) spielkamera(); });
  $('spielstart').addEventListener('click', (e) => { e.preventDefault(); betrete().catch((err) => { status('Spiel nicht geladen: ' + err.message); verlasse(); }); });
  $('verlassen').addEventListener('click', verlasse);

  build();
  if (figurBilder) {
    const eigene = new Cesium.CustomDataSource('spieler'); // kept apart from the layers build() replaces
    viewer.dataSources.add(eigene);
    spieler = starte({ Cesium, viewer, entities: eigene.entities, frame, pos, bilder: figurBilder, hoehe: figur.worldHeight ?? 1.4, hain: () => grove, bodenpunkt: groundPoint, welt: hindernisse, zeigeHaeuser,
      aufPlatz: (drin) => { $('spielstart').style.display = drin ? 'block' : 'none'; } });
  }
  view(Q.get('sicht') in VIEWS ? Q.get('sicht') : 'schraeg');
  status('bereit');
  window.welt = { get umwelt() { return umwelt; }, viewer, Cesium, frame, view, LAYERS, sources, pos, fromUtm32, toUtm32, betrete, verlasse, toCss, get imSpiel() { return imSpiel; }, get spieler() { return spieler; }, get hain() { return grove; }, get haeuser() { return viertelHaeuser; } }; // for the console and tests
}

main().catch((e) => { status('Fehler: ' + e.message); console.error(e); });
