// Photorealistic intro flight: Google Photorealistic 3D Tiles via Cesium ion (free Community
// account, token from the club), rendered with CesiumJS. Same camera path as the aerial version:
// from 1.2 km above Hannover-List down onto the Boni court, turning so the court lies sideways,
// tilting into the game's camera angle (60° from vertical) and stopping at the fixed game view.

const CESIUM_VERSION = '1.147.0';
const GOOGLE_3D_TILES = 2275207; // Cesium ion asset: Google Photorealistic 3D Tiles

// Court (docs/BONI_ORT.md): centre and fence corners A (north), B (east), C (south), D (west)
const COURT = {
  center: [9.7446424, 52.3890003],
  corners: [[9.7446135, 52.3891383], [9.7448468, 52.3890619], [9.7446712, 52.3888623], [9.7444379, 52.3889387]],
  long: 25.2, // metres, side A–D
};
const Q = new URLSearchParams(location.search);
const FINAL_HEADING = ((+Q.get('heading') || 118.2) * Math.PI) / 180; // view direction A→B, clockwise from north
const FINAL_TILT = ((+Q.get('tilt') || 60) * Math.PI) / 180;            // 60° from vertical, like PROJ {x:16, y:8}

const T = { zoom: [0.6, 9.4], turn: [3.2, 8.0], tilt: [6.0, 9.6], line: [9.2, 10.2], title: 9.8, button: 10.6 };
const END = T.button + 0.2;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10));
const phase = (t, [a, b]) => ease((t - a) / (b - a));
const FOV_START = (40 * Math.PI) / 180, FOV_END = (18 * Math.PI) / 180;

function loadCesium(base) {
  window.CESIUM_BASE_URL = base;
  const css = document.createElement('link');
  css.rel = 'stylesheet'; css.href = `${base}Widgets/widgets.css`;
  document.head.appendChild(css);
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = `${base}Cesium.js`; s.onload = () => res(window.Cesium); s.onerror = () => rej(new Error('CesiumJS konnte nicht geladen werden'));
    document.head.appendChild(s);
  });
}

/** Camera state at time t (seconds) for a canvas of the given aspect ratio. */
function cameraAt(t, aspect) {
  const wStart = 1150 * Math.min(1, aspect);
  const wEnd = COURT.long / (aspect >= 1 ? 0.5 : 0.86);
  const width = Math.exp(Math.log(wStart) + (Math.log(wEnd) - Math.log(wStart)) * phase(t, T.zoom));
  const fovx = FOV_START + (FOV_END - FOV_START) * phase(t, T.tilt);
  return {
    heading: FINAL_HEADING * phase(t, T.turn),
    tilt: FINAL_TILT * phase(t, T.tilt),
    fovx,
    range: width / (2 * Math.tan(fovx / 2)),
    lift: width * 0.06 * phase(t, T.tilt), // court sits a little below the middle at the end
  };
}

export async function run({ token, cesiumBase }) {
  const status = document.getElementById('status');
  const say = (s) => { status.textContent = s; status.style.opacity = s ? 1 : 0; };
  say('Lade den Boni …');
  document.getElementById('gl').style.display = 'none';

  const Cesium = await loadCesium(cesiumBase || `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`);
  const viewer = new Cesium.Viewer('cesium', {
    globe: false, baseLayer: false, animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
    homeButton: false, sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false,
    infoBox: false, selectionIndicator: false, msaaSamples: 4, useBrowserRecommendedResolution: false,
  });
  const { scene, camera } = viewer;
  scene.skyAtmosphere.show = true;
  scene.screenSpaceCameraController.enableInputs = false;
  viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 2);

  // Google tiles through the club's Cesium ion account (the endpoint hands out a session key)
  const url = `https://api.cesium.com/v1/assets/${GOOGLE_3D_TILES}/endpoint${token ? `?access_token=${encodeURIComponent(token)}` : ''}`;
  const ep = await (await fetch(url)).json();
  if (!ep.options?.url) throw new Error(ep.message || 'Cesium ion: kein Zugriff');
  const tileset = await Cesium.Cesium3DTileset.fromUrl(ep.options.url, { showCreditsOnScreen: true, maximumScreenSpaceError: 8 });
  scene.primitives.add(tileset);
  for (const a of ep.attributions ?? []) viewer.creditDisplay.addStaticCredit(new Cesium.Credit(a.html, true));

  // ground height of the court (ellipsoid metres); Hannover ≈ 54 m above sea level + 44 m geoid
  let ground = 98;
  const target = (lift, heading) => {
    const c = Cesium.Cartesian3.fromDegrees(COURT.center[0], COURT.center[1], ground);
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(c);
    const off = new Cesium.Cartesian3(-Math.sin(heading) * lift, -Math.cos(heading) * lift, 0);
    return Cesium.Matrix4.multiplyByPoint(enu, off, new Cesium.Cartesian3());
  };

  let fixedT = null, start = null, skip = false;
  const now = () => (fixedT ?? (skip ? END : start === null ? 0 : (performance.now() - start) / 1000));
  const place = (t) => {
    const aspect = scene.canvas.clientWidth / Math.max(1, scene.canvas.clientHeight);
    const c = cameraAt(t, aspect);
    camera.frustum.fov = aspect >= 1 ? c.fovx : 2 * Math.atan(Math.tan(c.fovx / 2) / aspect);
    camera.frustum.near = Math.max(1, c.range * 0.02);
    camera.lookAt(target(c.lift, c.heading), new Cesium.HeadingPitchRange(c.heading, c.tilt - Math.PI / 2, c.range));
    camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  };

  // yellow court outline, 20 cm above the ground, fades in at the end
  let lineAlpha = 0;
  const lineColor = new Cesium.CallbackProperty(() => Cesium.Color.fromCssColorString('#ffd23f').withAlpha(lineAlpha), false);
  const pts = () => Cesium.Cartesian3.fromDegreesArrayHeights([...COURT.corners, COURT.corners[0]].flatMap(([lo, la]) => [lo, la, ground + 0.2]));
  const lineMat = new Cesium.ColorMaterialProperty(lineColor);
  // drawn through the tree crowns as well: in the game the rink is painted over this spot anyway
  const line = viewer.entities.add({ polyline: { positions: new Cesium.CallbackProperty(pts, false), width: 4, material: lineMat, depthFailMaterial: lineMat } });

  const title = document.getElementById('title'), go = document.getElementById('go');
  scene.preRender.addEventListener(() => {
    const t = now();
    place(t);
    lineAlpha = phase(t, T.line);
    line.show = lineAlpha > 0;
    title.classList.toggle('on', t >= T.title);
    go.classList.toggle('on', t >= T.button);
  });

  const loaded = (timeout = 25000) => new Promise((res) => {
    const t0 = performance.now();
    const check = () => (tileset.tilesLoaded || performance.now() - t0 > timeout ? res() : setTimeout(check, 100));
    setTimeout(check, 200);
  });

  // measure the ground at the court, then warm the tile cache at the end view and the start view
  fixedT = END; await loaded();
  try {
    const [p] = await scene.sampleHeightMostDetailed([Cesium.Cartographic.fromDegrees(...COURT.center)]);
    if (Number.isFinite(p?.height)) ground = p.height;
  } catch { /* keep the estimate */ }
  await loaded();
  fixedT = 0; await loaded();
  say('');

  window.introDebug = {
    duration: END,
    ground: () => ground,
    /** Freeze the flight at time s and resolve once that view's tiles are loaded and drawn. */
    freeze: async (s) => { fixedT = s; await new Promise((r) => requestAnimationFrame(() => r())); await loaded(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); },
  };
  if (new URLSearchParams(location.search).has('record')) { window.introReady = true; return; }
  fixedT = null; start = performance.now();
  window.introReady = true;

  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') { start = performance.now(); skip = false; }
    else if (e.key === 'Enter' && skip) location.href = 'index.html';
    else skip = true;
  });
  scene.canvas.addEventListener('pointerdown', () => { skip = true; });
  go.addEventListener('click', () => { location.href = 'index.html'; });
}
