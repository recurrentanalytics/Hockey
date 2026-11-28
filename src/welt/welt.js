// World view of a place: the official aerial photo on the ground, the real building footprints as
// volumes, streets, paths, trees and the court from locations/<ort>/geo (tools/ort/geodaten.py).
// Same 3D stack as the intro (CesiumJS from the CDN). With the club's Cesium ion token on this
// device the Google photorealistic 3D tiles can be switched on as well; without it the view
// stands on the aerial photo alone. An inspection view, not gameplay yet.
import ORT from '../../locations/boni/ort.js';
import { RELIEF } from '../bau/haus.js';
import { fromUtm32, toUtm32 } from './utm.js';
import { placeLibrary, usable, frameImages, fahrbahnen, vomFahrdamm } from './bibliothek.js';
import { hain, haltAbstand, kronenkarte, baumbilder, pflanze, schattenwerfer, LICHT } from './baeume.js';
import { createEnvironment, weatherPanel } from '../intro/environment.js';
import { surfaceFor, setSurface } from '../game/surface.js';
import { starte } from './spieler.js';
import { pixelboden } from './pixelboden.js';
import { starteAnflug } from './anflug.js';
import { baueHindernisse, davor } from './hindernisse.js';
import { ladeLuftbild, rechteck, ausschnitt } from './luftbild.js';
import { platzmeter } from './baeume.js';
import { baueHaeuser } from './haeuser.js';
import { bodenplan, bodenKacheln } from './boden.js';
import { ladeBild } from './bild.js';

const CESIUM_VERSION = '1.147.0';    // keep in step with tools/android/build.sh and package.json
const GOOGLE_3D_TILES = 2275207;     // Cesium ion asset, as in the intro
const TOKEN_KEY = 'boniCesiumToken'; // the Cesium ion token on this device
const LGLN = 'https://opendata.lgln.niedersachsen.de/doorman/noauth/';
const FALLBACK_HEIGHT = 10;          // metres, for footprints without any height information
const GAME_VIEW = { heading: ORT.blick.richtung, tilt: ORT.blick.neigung }; // the game camera: looking A → B, 60° from vertical (locations/boni/ort.js)
// The houses of haeuser.js wait for the owner's approval: ?haeuser=neu shows the whole quarter dressed in the
// SpriteCook façade kits (assets/welt/haeuser/bausaetze.json); without it every footprint stays the plain volume it was.

const Q = new URLSearchParams(location.search);
// ?fassadenschatten=0 … 1: how strong the shade painted on the façades is (cornices, sills, reveals); 0 shows the flat pictures
const FASSADENSCHATTEN = Q.has('fassadenschatten') ? Math.min(1, Math.max(0, Number(Q.get('fassadenschatten')) || 0)) : 1;
// distance haze on the Google tiles and coarser far tiles (see showGoogle). ?dunst=0 off; ?dunst=a,b,s tunes it:
// clear up to a metres beyond the edge of the drawn quarter, full strength s (0–1) from b metres beyond it
const DUNST = Q.get('dunst') !== '0';
const DUNST_WERTE = (() => { const v = (Q.get('dunst') ?? '').split(',').map(Number); return v.length === 3 && v.every(Number.isFinite) ? v : [0, 1500, 0.8]; })();
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
  { id: 'relief', name: 'Fassaden-Relief (3D, um den Platz)', on: Q.get('relief') !== '0' },
  { id: 'wurf', name: 'Schlagschatten der Häuser (bei Sonne)', on: Q.get('schlagschatten') !== '0' },
  { id: 'wege', name: 'Wegelinien (OSM)', on: false },
  { id: 'baeume', name: 'Bäume mit Schatten (OSM-Standorte)', on: true },
  { id: 'einfriedungen', name: 'Zäune, Mauern (OSM)', on: true },
  { id: 'platz', name: 'Bolzplatz: Zaun und Tore (Platzmodell)', on: true },
  { id: 'platzmarken', name: 'Platz-Ecken und Achsen (Prüfung)', on: false },
  { id: 'bibliothek', name: 'Art-Bibliothek (SpriteCook)', on: true },
];
const USE_COLOR = { 'Straßenverkehr': '#8d8a85', 'Weg': '#d9c79a', 'Wohnbaufläche': '#e8dcc0', 'Sport-, Freizeit- und Erholungsfläche': '#8fbf6a' };

async function main() {
  // The game reads this once when its modules load (config.js, projection.js): it marks the real court.
  // Set before anything from the game is imported; toCss and the rest follow once the scene exists.
  globalThis.BONI_3D = { pausiert: true };
  // ?relieftiefe=3 makes the façade relief that many times deeper: a trial switch for comparing looks
  // (docs/art/HAEUSER.md, Relief). Without it the measured depths of haus.js apply.
  { const k = Number(Q.get('relieftiefe')); if (k > 0 && k !== 1) for (const teil of ['rahmen', 'bank', 'gesims']) RELIEF[teil] *= Math.min(k, 8); }
  // The panel folds to its button, and the layer list folds on its own; both remembered on this device.
  // A small screen starts with the panel folded, so the world is what you see.
  {
    const merke = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { /* private window */ } return null; };
    const knopf = $('tafelKnopf'), klappe = $('ebenenKlappe');
    const setze = (zu) => { document.body.classList.toggle('tafelzu', zu); knopf.setAttribute('aria-expanded', String(!zu)); };
    setze((merke('boni.tafel') ?? (Math.min(innerWidth, innerHeight) <= 640 ? 'zu' : 'auf')) === 'zu');
    knopf.onclick = () => { const zu = !document.body.classList.contains('tafelzu'); setze(zu); merke('boni.tafel', zu ? 'zu' : 'auf'); };
    klappe.open = merke('boni.ebenen') === 'auf';
    klappe.ontoggle = () => merke('boni.ebenen', klappe.open ? 'auf' : 'zu');
  }
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
  // … and no tree grows into a house: too wide for its place it is drawn smaller, or left out (baeume.js, haltAbstand)
  const hausRinge = gebaeude.features.flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []).map((v) => v[0]));
  const baumListe = haltAbstand(hain(baeume.features, frame, baumArten, krKarte,
    { sperre: (a, b) => Math.abs(a) < 13.4 && Math.abs(b) < 9.8 }), hausRinge, (art) => { const a = baumArten.find((x) => x.id === art); return a ? a.frame.w / a.frame.h : 0.8; }, frame);
  // nothing of the art library stands on a carriageway: such a mapped point moves behind the kerb (bibliothek.js, vomFahrdamm)
  const fahrdamm = fahrbahnen(nutzung);
  const baumBilder = Object.fromEntries(await Promise.all(baumArten.map(async (a) => [a.id, await baumbilder(a, ASSETS)])));
  const figur = manifest.assets.find((a) => a.id === 'character.skater.stride' && (a.approved || preview));
  // The roaming figure is the art library's skater (the 32 px chibi in the club's jersey), at stage scale.
  const figurBilder = figur ? { rechts: await frameImages(figur), links: await frameImages(figur, true), seiten: figur.frame.w / figur.frame.h } : null;
  const { TEAMS } = await import('../config.js');
  const einstellungen = await import('../settings.js');
  // the opponent for a match on the court: chosen at the court, remembered like in the game's own settings
  const gegnerWahl = $('gegner');
  for (const [key, t] of Object.entries(TEAMS)) if (!t.hidden && key !== 'borstentiere') gegnerWahl.add(new Option(t.name, key, false, key === einstellungen.settings.awayTeam));
  for (const ev of ['click', 'pointerdown']) gegnerWahl.addEventListener(ev, (e) => e.stopPropagation());
  const foto = await ladeLuftbild(ASSETS).catch(() => null); // the place's own aerial photo; the world stands on it
  let grove = { baeume: baumListe, zeige() {} };
  let baumwerfer = []; // the faces the trees cast their shadows with (they follow the sun: rebuilt with the grove)
  let flug = null;
  const hindernisse = baueHindernisse({ gebaeude, einfriedungen, platz, frame });
  const haeuser = []; // drawn building volumes, so the ones hiding the player can turn see-through
  const hausArt = Q.get('haeuser') ?? 'neu'; // every house dressed in the façade kits; ?haeuser=alt shows plain volumes
  let viertelHaeuser = null;                 // the houses of haeuser.js
  const saetze = hausArt === 'alt' ? null : await fetch(new URL('welt/haeuser/bausaetze.json', ASSETS)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  // measured roofs and heights (LoD2 of the LGLN, tools/ort/lod2.py); without them the rules estimate from OSM
  const daecher = hausArt === 'alt' ? null : await load('daecher.json').catch(() => null);
  // the drawn ground belongs to the same review: streets, pavements and yards in SpriteCook textures (boden.js)
  const bodenRegeln = hausArt === 'alt' ? null : await fetch(new URL('welt/boden/boden.json', ASSETS)).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  if (bodenRegeln) LAYERS.splice(LAYERS.findIndex((l) => l.id === 'pixelboden') + 1, 0, { id: 'boden', name: 'Gezeichneter Boden im Viertel (SpriteCook)', on: true });
  let bodenLayer = null;
  const bodenAn = () => !!bodenLayer?.show;
  let spieler = null;
  status('Lade 3D-Ansicht …');
  // inside the Android app CesiumJS comes from the copy bundled in the APK (tools/android/build.sh)
  const Cesium = await loadCesium(Q.get('cesiumBase') || (location.host === 'appassets.androidplatform.net' ? 'vendor/cesium/' : `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`));
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
    scene3DOnly: true,
    // draw only when something changes (camera, figure, weather, loading): a still view costs nothing.
    // Things that change without the camera moving ask for a frame themselves (anstossen, spieler.js, haeuser.js).
    requestRenderMode: true, maximumRenderTimeChange: Infinity,
    msaaSamples: 1, // pixel art needs no smoothed edges
  });
  const { scene, camera } = viewer;
  // the whole planet for the approach: the Natural Earth picture that ships with CesiumJS (needs no account)
  Cesium.TileMapServiceImageryProvider.fromUrl(Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII')).then((p) => viewer.imageryLayers.addImageryProvider(p, 0)).catch(() => {});
  // a short burst of frames after loading or any input, and until the houses are built in the background
  let bisWann = performance.now() + 8000;
  const anstossen = (ms = 1500) => { bisWann = Math.max(bisWann, performance.now() + ms); };
  scene.preUpdate.addEventListener(() => {
    for (const [id, c] of Object.entries(buendel)) { const an = sources[id]?.show ?? true; if (c.show !== an) { c.show = an; scene.requestRender(); } }
    const haus = viertelHaeuser?.primitive;
    if (performance.now() < bisWann || (haus && !haus.ready)) scene.requestRender();
  });
  for (const ev of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'change']) addEventListener(ev, () => anstossen(ev === 'pointermove' ? 300 : 1500), { passive: true });
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
  // Cast shadows only as far as is looked at, so the shadow map's pixels go where they are seen: close to the ground
  // (a match, a ride through the streets) a short range and crisp shadows, down to a fence post's; from high up the
  // whole quarter. Four times the camera's height covers what a camera tilted like the game's sees.
  scene.shadowMap.maximumDistance = 1500;
  scene.preRender.addEventListener(() => { scene.shadowMap.maximumDistance = Math.min(1500, Math.max(120, 4 * (camera.positionCartographic.height - ground))); });
  // ---- the sky: once landed, CesiumJS's atmosphere stands over the quarter, lit by the clock's sun (blue at noon, warm
  // at dusk, dark at night, then with the stars), greyer and dimmer under clouds. With the Google tiles and their
  // haze the sky stays the haze colour (dunstAn); during the approach from space the sky is the approach's own.
  const HIMMEL = { grau: 0, tag: 1, dunstig: false };
  function himmel() {
    if (document.body.classList.contains('anflug')) return;
    const atm = scene.skyAtmosphere;
    scene.atmosphere.dynamicLighting = Cesium.DynamicAtmosphereLightingType.SUNLIGHT;
    atm.show = !HIMMEL.dunstig;
    atm.saturationShift = -0.75 * HIMMEL.grau; atm.brightnessShift = -0.2 * HIMMEL.grau;
    if (scene.skyBox && !HIMMEL.dunstig) scene.skyBox.show = HIMMEL.tag < 0.3;
    scene.requestRender();
  }
  viewer.creditDisplay.addStaticCredit(new Cesium.Credit('Wege, Bäume, Höhen © OpenStreetMap-Mitwirkende, ODbL', true));
  if (daecher) viewer.creditDisplay.addStaticCredit(new Cesium.Credit(`Dächer und Gebäudehöhen ${daecher.quelle.split(':')[0]}`, true)); // © GeoBasis-DE / LGLN (Jahr), dl-de/by-2-0

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
    if (bodenLayer) viewer.imageryLayers.raiseToTop(bodenLayer); // the drawn ground lies over it; only the court shows through
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
  const buendel = {}; // BillboardCollections by layer id (see build)
  const describe = (name, p) => `${name}\n` + Object.entries(p).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join('\n');

  function build() {
    anstossen(4000);
    for (const s of Object.values(sources)) viewer.dataSources.remove(s, true);
    for (const c of Object.values(buendel)) scene.primitives.remove(c);
    const layer = (id) => { const s = new Cesium.CustomDataSource(id); s.show = LAYERS.find((l) => l.id === id).on; sources[id] = s; viewer.dataSources.add(s); return s.entities; };
    // still sprites of a layer in one collection (drawn together, nothing evaluated per frame); it follows the layer's switch
    const gebuendelt = (id) => { const c = scene.primitives.add(new Cesium.BillboardCollection({ scene })); c.show = sources[id]?.show ?? true; buendel[id] = c; return c; };

    const use = layer('nutzung');
    for (const f of nutzung.features) for (const poly of polygons(f.geometry)) {
      use.add({ polygon: { hierarchy: hierarchy(poly, 0.05), perPositionHeight: true, material: css(USE_COLOR[f.properties.nutzart] || '#c9b8d8', 0.38),
        outline: true, outlineColor: css('#1d1a16', 0.55) }, properties: { text: describe('Nutzung (ALKIS)', f.properties) } });
    }
    const blocks = layer('gebaeude');
    haeuser.length = 0;
    if (hausArt !== 'alt' && scene.context.webgl2) {           // drawn houses: built once; ground, cover and records follow here
      viertelHaeuser ??= baueHaeuser({ Cesium, scene, gebaeude, wege, daecher, frame, pos, saetze, basis: new URL('welt/haeuser/', ASSETS), schatten: FASSADENSCHATTEN, wurf: LAYERS.find((l) => l.id === 'wurf').on, mitAnbauten: Q.get('anbauten') !== '0', wandern: Q.get('wandern') !== '0' }); // ?anbauten=0: the plain bodies, without eaves, balconies and bay windows
      viertelHaeuser.stelle(); viertelHaeuser.licht(LICHT); viertelHaeuser.deckung(google.on && !rundum ? 0.45 : 1); viertelHaeuser.sichtbar(LAYERS.find((l) => l.id === 'gebaeude').on); viertelHaeuser.relief(LAYERS.find((l) => l.id === 'relief').on); viertelHaeuser.verzeichne(blocks);
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
    // With cast shadows on and a drawn ground, the trees throw their own outline (baeume.js, schattenwerfer) instead of
    // the drawn ellipse: on the sand, the streets, the houses and the court alike.
    const fotoBoden = (lokal?.show || luftbild.show) && (!google.on || rundum) && !bodenAn();
    const baumWurf = LAYERS.find((l) => l.id === 'wurf').on && sources.baeume.show && !fotoBoden && Q.get('baumschatten') !== '0';
    const wirft = (t) => baumWurf && !!t.art && !!baumBilder[t.art]?.bild;
    for (const p of baumwerfer) scene.primitives.remove(p);
    baumwerfer = baumWurf ? schattenwerfer({ Cesium, scene, baeume: baumListe, bilder: baumBilder, frame, pos, licht: LICHT, welche: wirft }) : [];
    pflanze({ Cesium, entities: trees, billboards: gebuendelt('baeume'), scene, baeume: baumListe, bilder: baumBilder, frame, pos, fotoBoden, wirft }).then((g) => { grove = g; });
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
    placeLibrary({ Cesium, entities: library, billboards: gebuendelt('bibliothek'), manifest, geo, frame, pos, preview, skip: (a) => a.place.layer === 'baeume' || a.id === figur?.id, stelle: (en) => vomFahrdamm(en, fahrdamm, hausRinge) }).then((n) => { $('bibliothek').textContent = `${n} Sprites aus der Art-Bibliothek` + (preview ? ' (mit wartenden)' : ''); });
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
    .then((m) => {
      platzModell = scene.primitives.add(m); platzModell.show = LAYERS.find((l) => l.id === 'platz').on;
      // the court's own shadows, as they were in the first intro: posts and goal frames throw them, the chain-link
      // mesh and the nets (see-through) do not, or they would lie on the court as dark sheets
      platzModell.shadows = Cesium.ShadowMode.ENABLED;
      platzModell.customShader = new Cesium.CustomShader({ fragmentShaderText: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
        #ifdef SHADOW_MAP
        material.alpha = 0.0;
        #endif
      }` });
    })
    .catch((e) => status('Platzmodell nicht geladen: ' + e.message));

  function zeigeHaeuser(ids) {
    viertelHaeuser?.zeige(ids);
    for (const h of haeuser) { const durch = ids.has(h.id); if (durch !== h.durch) { h.durch = durch; h.haus.polygon.material = css(h.colour, durch ? 0.2 : google.on ? 0.45 : 1); } }
  }

  // ---- Google photorealistic 3D tiles (the intro's 3D context), only with the club's token
  const google = LAYERS.find((l) => l.id === 'google');
  let tiles = null;
  // the Android app keeps the token itself (shared by its live and bundled copy)
  let token = Q.get('token') || window.BoniAndroid?.token?.() || (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })();
  google.available = !!token;
  // With the drawn houses the quarter stays ours when the tiles are on: they are cut away over it and lowered to the
  // aerial photo's level, and the globe (photo, pixel ground) is drawn only inside the cut. Google's city round the
  // quarter, nothing of Google and nothing see-through inside it. Without the drawn houses it is as it was.
  let rundum = false, googleBoden = null, schnitt = null;
  // Haze round the quarter ("fog of war"), painted into the Google tiles themselves: our own pixel world (aerial
  // photo, pixel ground, houses, trees, sprites) is never touched. Clear up to the edge of the cut, misting over
  // with distance from it (not from the camera), so the coarse far tiles read as distance, not as missing detail.
  // Only with the Google tiles; ?dunst=0 off. The sky becomes the haze colour, so the horizon melts into it.
  const DUNST_FARBE = Cesium.Color.fromBytes(204, 214, 219);
  const dunstShader = DUNST ? new Cesium.CustomShader({
    uniforms: {
      u_ecToEnu: { type: Cesium.UniformType.MAT4, value: new Cesium.Matrix4() },
      u_halb: { type: Cesium.UniformType.VEC2, value: new Cesium.Cartesian2() }, // half size of the clear area, metres
      u_dunst: { type: Cesium.UniformType.VEC3, value: new Cesium.Cartesian3(...DUNST_WERTE) },
      u_farbe: { type: Cesium.UniformType.VEC3, value: new Cesium.Cartesian3(DUNST_FARBE.red, DUNST_FARBE.green, DUNST_FARBE.blue) },
    },
    fragmentShaderText: `void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
      vec2 q = (u_ecToEnu * vec4(fsInput.attributes.positionEC, 1.0)).xy;
      float d = length(max(abs(q) - u_halb, 0.0)); // metres outside the clear rectangle
      material.diffuse = mix(material.diffuse, czm_srgbToLinear(u_farbe), u_dunst.z * smoothstep(u_dunst.x, u_dunst.y, d));
    }`,
  }) : undefined;
  let dunstEnu = null;
  function dunstGebiet() { // ENU frame at the centre of the clear area and its half size
    let lon = centre[0], lat = centre[1], halb = [0, 0];
    if (schnitt) {
      const r = schnitt.rechteck, m = Cesium.Rectangle.center(r);
      lon = Cesium.Math.toDegrees(m.longitude); lat = Cesium.Math.toDegrees(m.latitude);
      const enu = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(lon, lat, 0)), inv = Cesium.Matrix4.inverseTransformation(enu, new Cesium.Matrix4());
      const ne = Cesium.Matrix4.multiplyByPoint(inv, Cesium.Cartesian3.fromRadians(r.east, r.north, 0), new Cesium.Cartesian3());
      halb = [Math.abs(ne.x), Math.abs(ne.y)];
    }
    dunstEnu = Cesium.Matrix4.inverseTransformation(Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(lon, lat, rundum ? 0 : googleBoden ?? 0)), new Cesium.Matrix4());
    dunstShader.setUniform('u_halb', new Cesium.Cartesian2(...halb));
  }
  if (dunstShader) scene.preRender.addEventListener(() => {
    if (!tiles?.show || !dunstEnu) return;
    dunstShader.setUniform('u_ecToEnu', Cesium.Matrix4.multiply(dunstEnu, scene.camera.inverseViewMatrix, new Cesium.Matrix4()));
  });
  function dunstAn(an) {
    if (!dunstShader) return;
    if (an) dunstGebiet();
    if (scene.skyBox) scene.skyBox.show = !an;
    scene.backgroundColor = an ? DUNST_FARBE : Cesium.Color.BLACK;
    HIMMEL.dunstig = an; himmel();
  }
  function viertelSchnitt() {
    // one rectangle round the data's cutout and every house that reaches beyond it: a single cut is the cheapest to draw
    const p = [...gebaeude.features.filter((f) => viertelHaeuser.hat(f.properties.oid)).flatMap((f) => polygons(f.geometry).flatMap((poly) => poly[0])), ...(frame.ausschnitt_utm32 ? [frame.ausschnitt_utm32.slice(0, 2), frame.ausschnitt_utm32.slice(2)] : [])];
    const w = Math.min(...p.map((q) => q[0])), s = Math.min(...p.map((q) => q[1])), e = Math.max(...p.map((q) => q[0])), n = Math.max(...p.map((q) => q[1]));
    const ecken = [[w, s], [e, s], [e, n], [w, n]].map((q) => fromUtm32(...q)), lon = ecken.map((q) => q[0]), lat = ecken.map((q) => q[1]);
    const rechteck = Cesium.Rectangle.fromDegrees(Math.min(...lon), Math.min(...lat), Math.max(...lon), Math.max(...lat));
    const vieleck = new Cesium.ClippingPolygon({ positions: Cesium.Cartesian3.fromRadiansArray([rechteck.west, rechteck.south, rechteck.east, rechteck.south, rechteck.east, rechteck.north, rechteck.west, rechteck.north]) });
    return { rechteck, vielecke: new Cesium.ClippingPolygonCollection({ polygons: [vieleck] }) };
  }
  function ganzerGlobus() { scene.globe.show = true; scene.globe.cartographicLimitRectangle = Cesium.Rectangle.MAX_VALUE; }
  async function showGoogle(on) {
    if (on && !tiles) {
      status('Lade Google-3D-Kacheln …');
      const ep = await (await fetch(`https://api.cesium.com/v1/assets/${GOOGLE_3D_TILES}/endpoint?access_token=${encodeURIComponent(token)}`)).json();
      if (!ep.options?.url) throw new Error(ep.message || 'Cesium ion: kein Zugriff');
      // the photoreal surroundings stay, but thriftier: a little coarser detail (most of it is far away
      // round the drawn quarter), even less at the horizon, and a bounded memory cache. The "dynamic" error
      // is Cesium's own distance fog for detail: full detail near the camera, ever coarser tiles further off.
      // Its default only bites after kilometres; with DUNST it bites at our scale (from about 500 m on).
      tiles = await Cesium.Cesium3DTileset.fromUrl(ep.options.url, {
        showCreditsOnScreen: true, maximumScreenSpaceError: 20, dynamicScreenSpaceError: true,
        ...(DUNST ? { dynamicScreenSpaceErrorDensity: 1.5e-3, dynamicScreenSpaceErrorFactor: 24 } : {}),
        foveatedScreenSpaceError: true, cullRequestsWhileMoving: true, cacheBytes: 256 * 1024 * 1024,
        customShader: dunstShader,
      });
      scene.primitives.add(tiles);
      for (const a of ep.attributions ?? []) viewer.creditDisplay.addStaticCredit(new Cesium.Credit(a.html, true));
    }
    if (tiles) tiles.show = on;
    rundum =on && !!viertelHaeuser && Cesium.ClippingPolygonCollection.isSupported(scene);
    ganzerGlobus();
    scene.globe.show = !on; // the tiles carry their own ground; the flat globe would cut through it
    ground = 0;
    if (on && googleBoden == null) {
      await new Promise((r) => setTimeout(r, 1500)); // let the first tiles arrive before measuring
      try { const [c] = await scene.sampleHeightMostDetailed([Cesium.Cartographic.fromDegrees(centre[0], centre[1])]); googleBoden = Number.isFinite(c?.height) ? c.height : 97.9; } catch { googleBoden = 97.9; }
    }
    if (rundum) {
      schnitt ??= viertelSchnitt();
      if (tiles.clippingPolygons !== schnitt.vielecke) tiles.clippingPolygons = schnitt.vielecke;
      const hoch = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(pos([E0, N0], 0), new Cesium.Cartesian3());
      tiles.modelMatrix = Cesium.Matrix4.fromTranslation(Cesium.Cartesian3.multiplyByScalar(hoch, -googleBoden, hoch));
      scene.globe.show = true; scene.globe.cartographicLimitRectangle = schnitt.rechteck;
    } else if (on) ground = googleBoden;
    dunstAn(on);
    build(); view(current);
    status(!on ? 'bereit' : rundum ? `Google-3D-Kacheln rund um das Viertel, um ${googleBoden.toFixed(1)} m auf die Höhe des Luftbilds gesenkt` : `Google-3D-Kacheln an, Boden bei ${ground.toFixed(1)} m (Ellipsoid)`);
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
      else if (l.id === 'boden') { if (bodenLayer) bodenLayer.show = l.on; build(); } // the trees' shadows depend on the ground
      else if (l.id === 'platz') { if (platzModell) platzModell.show = l.on; }
      else if (l.id === 'relief') { viertelHaeuser?.relief(l.on); }
      else if (l.id === 'wurf') { viertelHaeuser?.wurf?.(l.on); build(); } // the trees' shadows follow the same switch
      else if (l.id === 'luftbild') { if (lokal) lokal.show = l.on; build(); }
      else if (l.id === 'luftbildlive') { luftbild.show = l.on; build(); } // the shadow rule depends on the ground
      else if (l.id === 'google') { try { await showGoogle(l.on); } catch (e) { l.on = false; ev.target.checked = false; status('Google-3D nicht geladen: ' + e.message + (/token|401|403|invalid|Zugriff/i.test(e.message) ? ' – Token prüfen: ?token=… an die Adresse hängen oder die Website-Daten löschen und neu einfügen.' : '')); rundum = false; ganzerGlobus(); } }
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
      try { window.BoniAndroid?.saveToken?.(value); } catch { /* not in the app */ }
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
    const aspekt = scene.canvas.clientWidth / Math.max(1, scene.canvas.clientHeight), breite = ORT.zaun.laenge / (aspekt >= 1 ? 0.78 : 0.95);
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
      rinkModul = await import('../scenes/rink.js');
      globalThis.BONI_3D.start = neuesMatch;      // main.js calls this instead of showing title and menus
      globalThis.BONI_3D.zurWelt = () => { matchVorbei = true; verlasse(); };
      await import('../main.js');
      spielGeladen = true;
    } else if (matchVorbei) neuesMatch(window.app);
    $('screen').focus({ preventScroll: true });
    status('Spiel läuft – „Platz verlassen“ bringt dich zurück ins Viertel');
  }
  // A match on the court: straight to the face-off, Borstentiere against the chosen opponent, under the
  // rules set in the game's settings. Leaving the court pauses it; after the final whistle (or "Spiel
  // beenden" in its pause menu) the next visit starts a new one.
  let rinkModul = null, matchVorbei = false;
  function neuesMatch(app) {
    const gegner = $('gegner').value;
    if (gegner) { einstellungen.settings.awayTeam = gegner; einstellungen.saveSettings(); }
    app.scenes.length = 0;
    app.push(new rinkModul.RinkScene(app, { title: 'AUF DEM BONI', mode: 'ai', humans: [{ controller: 'any', side: 'home' }],
      teams: { home: 'borstentiere', away: einstellungen.settings.awayTeam }, onFinish: () => { matchVorbei = true; verlasse(); } }));
    matchVorbei = false;
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
  Object.assign(globalThis.BONI_3D, { toCss });
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
    HIMMEL.grau = { clouds: 1, rain: 1, fog: 1, snow: 0.9, partly: 0.3 }[st.look] ?? 0; HIMMEL.tag = v.day; himmel();
    clearTimeout(neuZeichnen); neuZeichnen = setTimeout(() => { if (sources.baeume) build(); }, 400); // tree shadows turn with the sun
  };
  try {
    umwelt = createEnvironment({ Cesium, viewer, ground: {}, onChange: beiUmwelt });
    weatherPanel(umwelt);
    $('wxBtn').hidden = false; $('surface').hidden = false;
  } catch (e) { status('Wetter nicht verfügbar: ' + e.message); }

  // Cast shadows cost a second pass over the houses. Where the view runs slowly with them (60 frames in a row at
  // under about 33 a second), they are taken away for a trial of 60 frames: if the view is then at least a fifth
  // faster they stay off and the panel says so (the layer list turns them back on); if not, they were not the
  // reason (a slow display, a throttled tab) and come back. One trial per visit.
  {
    let zuletzt = 0, summe = 0, n = 0, stand = 'messen', mit = 0, warten = 0;
    const seit = performance.now(), ebene = LAYERS.find((l) => l.id === 'wurf');
    scene.postRender.addEventListener(() => {
      const jetzt = performance.now(), dt = jetzt - zuletzt;
      zuletzt = jetzt;
      if (stand === 'fertig') return;
      if (!ebene.on || !scene.shadowMap.enabled || jetzt - seit < 15000 || dt > 120 || document.body.classList.contains('anflug')) { summe = 0; n = 0; return; }
      if (warten > 0) { warten--; return; }
      summe += dt;
      if (++n < 60) return;
      const schnitt = summe / n;
      summe = 0; n = 0;
      if (stand === 'messen') {
        if (schnitt <= 30) return;
        mit = schnitt; stand = 'probe'; warten = 10; viertelHaeuser?.wurf?.(false);
      } else {
        stand = 'fertig';
        if (schnitt < mit * 0.8) {
          ebene.on = false; setTimeout(build, 0); // the trees' cast shadows go with the houses'
          const haken = $('ebenen').querySelectorAll('input[type=checkbox]')[LAYERS.indexOf(ebene)];
          if (haken) haken.checked = false;
          status('Schlagschatten der Häuser aus: dieses Gerät zeichnet damit zu langsam (Ebenen schaltet sie wieder ein)');
        } else viertelHaeuser?.wurf?.(true);
      }
    });
  }
  window.addEventListener('resize', () => { if (imSpiel) spielkamera(); });
  $('spielstart').addEventListener('click', (e) => { e.preventDefault(); betrete().catch((err) => { status('Spiel nicht geladen: ' + err.message); verlasse(); }); });
  $('verlassen').addEventListener('click', verlasse);

  if (bodenRegeln) try { // the drawn ground: painted tile by tile as the view asks for it
    const bilder = Object.fromEntries(await Promise.all(Object.entries(bodenRegeln.texturen).map(async ([name, t]) => [name, await ladeBild(new URL('welt/boden/' + t.datei, ASSETS).href)])));
    bodenLayer = new Cesium.ImageryLayer(bodenKacheln({ Cesium, plan: bodenplan({ nutzung, flaechen, wege, platz }, bodenRegeln), frame, bilder, pxJeM: bodenRegeln.px_je_m }), { magnificationFilter: Cesium.TextureMagnificationFilter.NEAREST });
    viewer.imageryLayers.add(bodenLayer);
  } catch (e) { console.error(e); bodenLayer = null; }
  build();
  if (figurBilder) {
    const eigene = new Cesium.CustomDataSource('spieler'); // kept apart from the layers build() replaces
    viewer.dataSources.add(eigene);
    spieler = starte({ Cesium, viewer, entities: eigene.entities, frame, pos, bilder: figurBilder, hoehe: figur.worldHeight ?? 1.4, hain: () => grove, bodenpunkt: groundPoint, welt: hindernisse, zeigeHaeuser,
      aufPlatz: (drin) => { $('spielstart').style.display = drin ? 'block' : 'none'; } });
  }
  // ---- how the world opens: with the approach from space (the default), or straight in with ?sicht=…
  if (Q.has('sicht') || Q.has('ohneanflug')) view(Q.get('sicht') in VIEWS ? Q.get('sicht') : 'schraeg');
  else {
    document.body.classList.add('anflug');
    scene.skyAtmosphere.show = true; scene.atmosphere.dynamicLighting = Cesium.DynamicAtmosphereLightingType.NONE;
    scene.skyAtmosphere.saturationShift = 0; scene.skyAtmosphere.brightnessShift = 0; if (scene.skyBox) scene.skyBox.show = true;
    flug = starteAnflug({
      setze: (k) => {
        anstossen(400); // drawing on demand: the flight asks for the next frame itself
        camera.lookAt(pos([E0, N0], 0), new Cesium.HeadingPitchRange(Cesium.Math.toRadians(k.richtung), Cesium.Math.toRadians(k.neigung - 90), k.weite));
        camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      },
      untertitel: $('untertitel'), stimmen: new URL('voice/', ASSETS), renderEreignis: scene.preUpdate,
      amEnde: () => { document.body.classList.remove('anflug'); document.body.classList.add('gelandet'); himmel(); current = 'spiel'; status('bereit'); },
    });
    // "a country … a city": Germany's outline and Hannover light up while the story names them (as in the intro)
    const marken = new Cesium.CustomDataSource('anflug');
    viewer.dataSources.add(marken);
    const hoch = () => camera.positionCartographic.height;
    fetch(new URL('intro/deutschland.json', ASSETS)).then((r) => r.json()).then((de) => {
      for (const ring of de.rings) marken.entities.add({ polyline: { positions: Cesium.Cartesian3.fromDegreesArray(ring.flat()), width: 3, material: css('#ffd23f'), clampToGround: false,
        show: new Cesium.CallbackProperty(() => hoch() > 2.5e5 && hoch() < 1.2e7, false) } });
    }).catch(() => {});
    const stadt = new Cesium.CallbackProperty(() => hoch() > 6000 && hoch() < 3.5e6, false);
    marken.entities.add({ position: Cesium.Cartesian3.fromDegrees(centre[0], centre[1], 0), point: { pixelSize: 9, color: css('#e8243c'), outlineColor: css('#ffffff'), outlineWidth: 2, show: stadt },
      label: { text: 'Hannover', font: "700 20px 'Pixelify Sans', sans-serif", fillColor: css('#ffffff'), outlineColor: css('#000000'), outlineWidth: 4, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -22), show: stadt } });
    $('ueberspringen').onclick = () => flug.ueberspringe();
    addEventListener('keydown', () => { if (flug && !flug.fertig) flug.ueberspringe(); });
    const los = (spiel) => { document.body.classList.remove('gelandet'); view('fahren'); if (spiel) betrete().catch((err) => { status('Spiel nicht geladen: ' + err.message); verlasse(); }); };
    $('los').onclick = () => los(false);
    $('losSpiel').onclick = () => los(true);
  }
  status('bereit');
  window.welt = { get flug() { return flug; }, get umwelt() { return umwelt; }, viewer, Cesium, frame, view, LAYERS, sources, pos, fromUtm32, toUtm32, betrete, verlasse, toCss, get imSpiel() { return imSpiel; }, get spieler() { return spieler; }, get hain() { return grove; }, get haeuser() { return viertelHaeuser; }, get boden() { return bodenLayer; } }; // for the console and tests
}

main().catch((e) => {
  console.error(e);
  // without the 3D library (offline, CDN unreachable) the world cannot start: the arena game still can
  if (/CesiumJS/.test(e.message)) { status('Keine 3D-Ansicht möglich – Hallen-Version startet'); setTimeout(() => location.replace('index.html'), 1800); }
  else status('Fehler: ' + e.message);
});
