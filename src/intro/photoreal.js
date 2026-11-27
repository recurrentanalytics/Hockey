// Photorealistic intro flight: Google Photorealistic 3D Tiles via Cesium ion (free Community
// account, token from the club), rendered with CesiumJS. From the whole planet in space down to
// Germany, Hannover, the List and onto the Boni court, told in short spoken lines, then turning so
// the court lies sideways and tilting into the game's camera angle (60° from vertical).

const CESIUM_VERSION = '1.147.0';
const GOOGLE_3D_TILES = 2275207; // Cesium ion asset: Google Photorealistic 3D Tiles

// Court (docs/BONI_ORT.md): centre and fence corners A (north), B (east), C (south), D (west)
const COURT = {
  center: [9.7446424, 52.3890003],
  corners: [[9.7446135, 52.3891383], [9.7448468, 52.3890619], [9.7446712, 52.3888623], [9.7444379, 52.3889387]],
  long: 25.2, // metres, side A–D
};
const Q = new URLSearchParams(location.search);
// ?quick: test mode, no flight and no tap: straight into the game on the real court
const QUICK = Q.has('quick');
const FINAL_HEADING = ((+Q.get('heading') || 118.2) * Math.PI) / 180; // view direction A→B, clockwise from north
const FINAL_TILT = ((+Q.get('tilt') || 60) * Math.PI) / 180;            // 60° from vertical, like PROJ {x:16, y:8}

// ------------------------------------------------------------------ the story
// One continuous camera move. The visible ground width follows keyframes (smooth monotone curve
// in log space, never stopping), slowing down where a line is told.
const STORY = [
  { at: 0.8, until: 6.6, text: 'Ganz weit draußen, im großen, dunklen Weltall … schwebt eine kleine blaue Kugel.' },
  { at: 7.0, until: 10.2, text: 'Auf dieser Kugel gibt es ein Land.' },
  { at: 10.6, until: 14.6, text: 'In diesem Land eine Stadt.' },
  { at: 15.4, until: 20.0, text: 'Und in dieser Stadt … einen kleinen Platz unter großen Bäumen.' },
  { at: 20.4, until: 25.9, text: 'Hier rollt eine noch viel kleinere Kugel. Ein roter Ball. Klein wie eine Kinderfaust …' },
  { at: 26.2, until: 30.2, text: '… und für uns das Größte auf der ganzen Welt.' },
];
export const GAME_TITLE = { name: 'BORSTENBOOM!', sub: 'Ein Inlinehockey-Abenteuer der Boni Borstentiere' };
const ZOOM = [[0, 'planet'], [6.6, 'drift'], [10.2, 1.25e6], [13.8, 1.4e5], [19.2, 3.6e3], [23.2, 230], [26.2, 'end']];
const T = { turn: [13.8, 23.4], tilt: [20.0, 26.2], germany: [6.6, 11.2], city: [10.6, 14.8], fade: [22.2, 26.6], rink: [23.2, 26.6], title: 26.2, button: 30.4 };
const END = T.button + 0.4;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10));
const phase = (t, [a, b]) => ease((t - a) / (b - a));
const clamp01 = (x) => Math.max(0, Math.min(1, x));
/** Fade in, hold, fade out over [a, b]. */
const window01 = (t, [a, b], f = 0.8) => clamp01(Math.min((t - a) / f, (b - t) / f));
const FOV = (20 * Math.PI) / 180; // fixed: changing it mid-flight makes the camera lurch

/** Monotone cubic (Fritsch–Carlson) through points [[x, y]], evaluated at x. */
function monotone(pts, x) {
  const n = pts.length;
  if (x <= pts[0][0]) return pts[0][1];
  if (x >= pts[n - 1][0]) return pts[n - 1][1];
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  m[0] = 0; m[n - 1] = 0; // start and land softly
  for (let i = 1; i < n - 1; i++) {
    const h0 = pts[i][0] - pts[i - 1][0], h1 = pts[i + 1][0] - pts[i][0];
    m[i] = d[i - 1] * d[i] <= 0 ? 0 : (3 * (h0 + h1)) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
  }
  let k = 0;
  while (x > pts[k + 1][0]) k++;
  const h = pts[k + 1][0] - pts[k][0], t = (x - pts[k][0]) / h;
  const t2 = t * t, t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * pts[k][1] + (t3 - 2 * t2 + t) * h * m[k] + (-2 * t3 + 3 * t2) * pts[k + 1][1] + (t3 - t2) * h * m[k + 1];
}

// Performance: phones and tablets fly at reduced resolution and coarser tiles; once landed, the
// view is drawn once at full resolution and then only when something changes (request render
// mode), so the game on top runs at full speed.
const MOBILE = !!window.BoniAndroid || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
// one setting for the whole flight and the landed view: no visible jump in sharpness at the end
const FLIGHT = { res: MOBILE ? 0.8 : 1, sse: MOBILE ? 14 : 8, msaa: MOBILE ? 1 : 4 };
const STILL = FLIGHT;
const RECORD_MODE = new URLSearchParams(location.search).has('record');

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
  // the whole planet (12 700 km) fits the screen height at the start
  const planet = 16.5e6 * Math.max(1, aspect);
  const wEnd = COURT.long / (aspect >= 1 ? 0.78 : 0.95);
  const keys = ZOOM.map(([kt, w]) => [kt, Math.log(w === 'planet' ? planet : w === 'drift' ? planet * 0.55 : w === 'end' ? wEnd : w)]);
  const width = Math.exp(monotone(keys, t));
  const k = phase(t, T.tilt);
  return {
    heading: FINAL_HEADING * phase(t, T.turn),
    tilt: FINAL_TILT * k,
    fovx: FOV,
    range: width / (2 * Math.tan(FOV / 2)),
    lift: width * 0.025 * k, // court sits a little below the middle at the end
  };
}

export async function run({ token, cesiumBase }) {
  const cover = document.getElementById('cover');
  const coverText = document.getElementById('coverText'), coverBar = document.getElementById('coverBar');
  const say = (s) => { coverText.textContent = s; };
  cover.classList.add('on');
  say('Lade den Boni …');
  document.getElementById('gl').style.display = 'none';

  const Cesium = await loadCesium(cesiumBase || `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`);
  const viewer = new Cesium.Viewer('cesium', {
    globe: false, baseLayer: false, animation: false, timeline: false, baseLayerPicker: false, geocoder: false,
    homeButton: false, sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false,
    infoBox: false, selectionIndicator: false, msaaSamples: FLIGHT.msaa, useBrowserRecommendedResolution: false,
  });
  const { scene, camera } = viewer;
  scene.skyAtmosphere.show = true;
  // fixed early-summer afternoon light for the court model (the Google mesh has its light baked in)
  viewer.clock.currentTime = Cesium.JulianDate.fromIso8601('2026-06-12T13:30:00Z');
  viewer.clock.shouldAnimate = false;
  scene.screenSpaceCameraController.enableInputs = false;
  viewer.resolutionScale = FLIGHT.res; // on top of devicePixelRatio

  // Google tiles through the club's Cesium ion account (the endpoint hands out a session key)
  const url = `https://api.cesium.com/v1/assets/${GOOGLE_3D_TILES}/endpoint${token ? `?access_token=${encodeURIComponent(token)}` : ''}`;
  const ep = await (await fetch(url)).json();
  if (!ep.options?.url) throw new Error(ep.message || 'Cesium ion: kein Zugriff');
  const tileset = await Cesium.Cesium3DTileset.fromUrl(ep.options.url, { showCreditsOnScreen: true, maximumScreenSpaceError: FLIGHT.sse });
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

  let fixedT = null, start = null, skip = false, started = false;
  const now = () => (fixedT ?? (skip ? END : start === null ? 0 : (performance.now() - start) / 1000));
  const place = (t) => {
    const aspect = scene.canvas.clientWidth / Math.max(1, scene.canvas.clientHeight);
    const c = cameraAt(t, aspect);
    camera.frustum.fov = aspect >= 1 ? c.fovx : 2 * Math.atan(Math.tan(c.fovx / 2) / aspect);
    camera.frustum.near = Math.max(1, c.range * 0.02);
    camera.lookAt(target(c.lift, c.heading), new Cesium.HeadingPitchRange(c.heading, c.tilt - Math.PI / 2, c.range));
    camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
  };

  // ---------------------------------------------------------------- court frame (local metres)
  // ENU frame at the court centre on the ground: x east, y north, z up. Rebuilt once the real
  // ground height is known.
  let frame;
  const buildFrame = () => {
    const enu = Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(COURT.center[0], COURT.center[1], ground));
    const inv = Cesium.Matrix4.inverse(enu, new Cesium.Matrix4());
    const local = ([lo, la]) => Cesium.Matrix4.multiplyByPoint(inv, Cesium.Cartesian3.fromDegrees(lo, la, ground), new Cesium.Cartesian3());
    const [A, B, , D] = COURT.corners.map(local);
    const C = COURT.corners.map(local).reduce((m, p) => ({ x: m.x + p.x / 4, y: m.y + p.y / 4 }), { x: 0, y: 0 });
    const lu = Math.hypot(D.x - A.x, D.y - A.y), lv = Math.hypot(B.x - A.x, B.y - A.y);
    const u = { x: (D.x - A.x) / lu, y: (D.y - A.y) / lu }, v = { x: (B.x - A.x) / lv, y: (B.y - A.y) / lv };
    // rink coordinates (a along the long side, b across, z up) → Cartesian3
    const at = (a, b, z = 0) => Cesium.Matrix4.multiplyByPoint(enu, new Cesium.Cartesian3(C.x + a * u.x + b * v.x, C.y + a * u.y + b * v.y, z), new Cesium.Cartesian3());
    frame = { enu, inv, C, u, v, halfLong: lu / 2, halfShort: lv / 2, at };
  };
  buildFrame();

  // ---------------------------------------------------------------- the real court, fading in
  // assets/intro/boni_platz.glb (tools/intro/court_glb.py): asphalt with markings and dappled
  // light, double-rod fence, football goals, street-hockey goals. Local axes: a (long side A→D),
  // b (across A→B), up; glTF is Y-up, Cesium turns it Z-up.
  const courtMatrix = () => {
    const { u, v, C } = frame;
    const local = new Cesium.Matrix4(u.x, v.x, 0, C.x, u.y, v.y, 0, C.y, 0, 0, 1, 0.03, 0, 0, 0, 1);
    return Cesium.Matrix4.multiply(frame.enu, local, new Cesium.Matrix4());
  };
  const court = await Cesium.Model.fromGltfAsync({ url: new URL('../../assets/intro/boni_platz.glb', import.meta.url).href, modelMatrix: courtMatrix(), show: false, forwardAxis: Cesium.Axis.X });
  scene.primitives.add(court);
  let rinkAlpha = 0;

  // ---------------------------------------------------------------- see-through trees
  // Every fragment of the Google mesh that hides part of the rink from the camera (it sits above
  // the ground and the ray through it lands on the court) becomes see-through at the end.
  const seeThrough = new Cesium.CustomShader({
    uniforms: {
      u_ecToEnu: { type: Cesium.UniformType.MAT4, value: new Cesium.Matrix4() },
      u_rect: { type: Cesium.UniformType.VEC4, value: new Cesium.Cartesian4() },
      u_axis: { type: Cesium.UniformType.VEC2, value: new Cesium.Cartesian2(1, 0) },
      u_fade: { type: Cesium.UniformType.FLOAT, value: 0 },
    },
    // screen-door transparency: a growing share of the occluding pixels is left out in an ordered
    // dither, the rest stays opaque (true alpha blending would turn the whole mesh see-through)
    translucencyMode: Cesium.CustomShaderTranslucencyMode.OPAQUE,
    fragmentShaderText: `
      // 8x8 ordered (Bayer) dither: 64 steps, so the trees thin out smoothly
      float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
      float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
      float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
        if (u_fade <= 0.0) return;
        vec3 p = (u_ecToEnu * vec4(fsInput.attributes.positionEC, 1.0)).xyz;
        vec3 cam = (u_ecToEnu * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec3 d = p - cam;
        if (p.z < 0.06 || d.z > -0.001) return;
        vec2 hit = (cam + d * (-cam.z / d.z)).xy - u_rect.xy;
        vec2 ay = vec2(-u_axis.y, u_axis.x);
        vec2 q = abs(vec2(dot(hit, u_axis), dot(hit, ay)));
        // only where the ray lands on the rink floor, so the holes always show our court
        // fence rectangle as a signed distance
        vec2 k = q - (u_rect.zw - vec2(0.1));
        float sd = length(max(k, 0.0)) + min(max(k.x, k.y), 0.0);
        float inside = 1.0 - smoothstep(0.3, 3.2, sd);   // fully open over the court, soft over the mulch apron
        if (u_fade * inside > bayer8(gl_FragCoord.xy)) discard;
      }`,
  });
  const ecToEnu = new Cesium.Matrix4();
  tileset.customShader = seeThrough;

  // ---------------------------------------------------------------- map markings
  const glow = (a) => Cesium.Color.fromCssColorString('#ffd23f').withAlpha(a);
  let germanyA = 0, cityA = 0, boniA = 0;
  const de = await (await fetch(new URL('../../assets/intro/deutschland.json', import.meta.url))).json();
  const lineMat = new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.22, color: new Cesium.CallbackProperty(() => glow(germanyA), false) });
  const germany = de.rings.map((r) => viewer.entities.add({
    polyline: { positions: Cesium.Cartesian3.fromDegreesArray([...r, r[0]].flat()), width: 7, material: lineMat, depthFailMaterial: lineMat, arcType: Cesium.ArcType.GEODESIC },
  }));
  const pin = (lon, lat, text, alpha, size = 26) => viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(lon, lat, 0),
    point: { pixelSize: 14, color: new Cesium.CallbackProperty(() => glow(alpha()), false), outlineColor: new Cesium.CallbackProperty(() => Cesium.Color.fromCssColorString('#16110d').withAlpha(alpha()), false), outlineWidth: 3, disableDepthTestDistance: Number.POSITIVE_INFINITY },
    label: { text, font: `bold ${size}px Arial, sans-serif`, style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineWidth: 5, outlineColor: new Cesium.CallbackProperty(() => Cesium.Color.fromCssColorString('#16110d').withAlpha(alpha()), false),
      fillColor: new Cesium.CallbackProperty(() => Cesium.Color.WHITE.withAlpha(alpha()), false), pixelOffset: new Cesium.Cartesian2(0, -30), verticalOrigin: Cesium.VerticalOrigin.BOTTOM, disableDepthTestDistance: Number.POSITIVE_INFINITY },
  });
  const pins = [
    pin(10.45, 51.16, 'Deutschland', () => germanyA, 30),
    pin(9.7320, 52.3759, 'Hannover', () => cityA),
    pin(COURT.center[0], COURT.center[1], 'Boni', () => boniA),
  ];

  // ---------------------------------------------------------------- narration
  const caption = document.getElementById('caption'), titleName = document.getElementById('titleName'), titleSub = document.getElementById('titleSub');
  titleName.innerHTML = '<img class="logo" src="assets/pixel/logo.png" alt="BORSTENBOOM!" /><img class="bonny" src="assets/pixel/bonny_jubel.png" alt="Bonny" />'; titleSub.textContent = GAME_TITLE.sub;
  const voice = {
    warned: false,
    el: null,
    /** Narration line i: Thorsten's recording (assets/voice), the device or browser voice as a fallback. */
    line(i, text) {
      this.el?.pause();
      const a = new Audio(new URL(`../../assets/voice/intro-${i}.mp3`, import.meta.url).href);
      a.play().then(() => { this.el = a; }).catch(() => this.speak(text));
    },
    speak(text) {
      // 1. the app's device voice, 2. the browser's voice, 3. a visible hint once
      const app = window.BoniAndroid;
      if (app?.speak && app.speak(text) !== false) return;
      if ('speechSynthesis' in window) {
        const voices = speechSynthesis.getVoices();
        const v = voices.find((x) => x.lang?.toLowerCase().startsWith('de'));
        if (v || !voices.length) {
          const u = new SpeechSynthesisUtterance(text);
          u.lang = 'de-DE'; u.rate = 0.88; u.pitch = 1.12;
          if (v) u.voice = v;
          speechSynthesis.cancel(); speechSynthesis.speak(u);
          return;
        }
      }
      if (!this.warned) {
        this.warned = true;
        const why = app?.speechProblem?.() || 'Keine deutsche Stimme gefunden';
        const hint = document.getElementById('voiceHint');
        hint.textContent = `🔇 ${why} – Handy-Einstellungen › Sprachausgabe (Text-in-Sprache) › Deutsch installieren`;
        hint.classList.add('on');
        setTimeout(() => hint.classList.remove('on'), 9000);
      }
    },
    stop() { this.el?.pause(); window.BoniAndroid?.stopSpeaking?.(); window.speechSynthesis?.cancel(); },
  };
  let told = -1;
  const narrate = (t) => {
    const i = STORY.findIndex((l) => t >= l.at && t < l.until);
    const line = STORY[i];
    caption.classList.toggle('on', !!line && !skip && !started);
    if (line && i !== told) { told = i; caption.textContent = line.text; if (!skip && !RECORD_MODE) voice.line(i, line.text); }
  };

  const title = document.getElementById('title'), go = document.getElementById('go');
  scene.preRender.addEventListener(() => {
    const t = now();
    place(t);
    germanyA = window01(t, T.germany, 1.2);
    cityA = window01(t, T.city, 1.0);
    boniA = window01(t, [15.2, 20.2], 1.0);
    for (const e of germany) e.show = germanyA > 0;
    pins[0].show = germanyA > 0; pins[1].show = cityA > 0; pins[2].show = boniA > 0;
    narrate(t);
    const fade = phase(t, T.fade);
    rinkAlpha = phase(t, T.rink);
    court.show = rinkAlpha > 0;
    court.color = Cesium.Color.WHITE.withAlpha(rinkAlpha);
    // the see-through shader stays attached all the time (switching it recompiles every tile and
    // stutters); it does nothing while u_fade is 0
    if (fade > 0) {
      Cesium.Matrix4.multiply(frame.inv, camera.inverseViewMatrix, ecToEnu);
      seeThrough.setUniform('u_ecToEnu', ecToEnu);
      seeThrough.setUniform('u_rect', new Cesium.Cartesian4(frame.C.x, frame.C.y, frame.halfLong, frame.halfShort));
      seeThrough.setUniform('u_axis', new Cesium.Cartesian2(frame.u.x, frame.u.y));
      seeThrough.setUniform('u_fade', fade);
    }
    else seeThrough.setUniform('u_fade', 0);
    title.classList.toggle('on', t >= T.title && !started);
    go.classList.toggle('on', t >= T.button && !started);
    document.getElementById('skip').classList.toggle('on', t < T.title && !skip && !started);
  });

  const loaded = (timeout = 25000) => new Promise((res) => {
    const t0 = performance.now();
    const check = () => (tileset.tilesLoaded || performance.now() - t0 > timeout ? res() : setTimeout(check, 100));
    setTimeout(check, 200);
  });

  // measure the ground at the court, then warm the tile cache along the whole flight path, so the
  // flight itself streams from memory instead of loading tiles on the way
  tileset.cacheBytes = MOBILE ? 384 * 1024 * 1024 : 768 * 1024 * 1024;
  fixedT = END; await loaded();
  try {
    const [p] = await scene.sampleHeightMostDetailed([Cesium.Cartographic.fromDegrees(...COURT.center)]);
    if (Number.isFinite(p?.height)) { ground = p.height; buildFrame(); court.modelMatrix = courtMatrix(); }
  } catch { /* keep the estimate */ }
  await loaded();
  const stops = QUICK ? [] : [23.2, 19.2, 13.8, 10.2, 0];
  for (let i = 0; i < stops.length; i++) {
    say(`Lade den Boni … ${Math.round(((i + 1) / stops.length) * 100)} %`);
    coverBar.style.width = `${Math.round(((i + 1) / stops.length) * 100)}%`;
    fixedT = stops[i];
    await loaded(i === stops.length - 1 ? 20000 : 8000);
  }
  // preloading happened behind the cover; the flight starts at its first frame, after a tap or a
  // button press (browsers only allow speech after a user gesture)
  fixedT = 0;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  if (!RECORD_MODE && !QUICK) {
    say('▶  Antippen oder Taste drücken');
    cover.classList.add('ready');
    await new Promise((res) => {
      const done = () => { window.removeEventListener('pointerdown', done); window.removeEventListener('keydown', done); clearInterval(poll); res(); };
      window.addEventListener('pointerdown', done); window.addEventListener('keydown', done);
      const poll = setInterval(() => { for (const g of navigator.getGamepads?.() ?? []) if (g?.buttons.some((b) => b.pressed)) done(); }, 80);
    });
    if ('speechSynthesis' in window && !window.BoniAndroid?.speak) speechSynthesis.speak(new SpeechSynthesisUtterance(' ')); // unlock
  }
  cover.classList.remove('on');

  window.introDebug = {
    duration: END,
    ground: () => ground,
    /** Freeze the flight at time s and resolve once that view's tiles are loaded and drawn. */
    freeze: async (s) => { fixedT = s; await new Promise((r) => requestAnimationFrame(() => r())); await loaded(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); },
  };
  // ---------------------------------------------------------------- the game on the real court
  // Metres in game coordinates (x along the court, y towards the camera, z up) → window CSS px,
  // through the very same camera that draws the photorealistic view.
  let gameMatrix = null;
  scene.postRender.addEventListener(() => {
    const { u, v, C } = frame;
    const local = new Cesium.Matrix4(u.x, -v.x, 0, C.x, u.y, -v.y, 0, C.y, 0, 0, 1, 0, 0, 0, 0, 1);
    const m = Cesium.Matrix4.multiply(camera.frustum.projectionMatrix, camera.viewMatrix, new Cesium.Matrix4());
    Cesium.Matrix4.multiply(m, frame.enu, m);
    gameMatrix = Cesium.Matrix4.multiply(m, local, m);
  });
  const toCss = (x, y, z) => {
    const m = gameMatrix;
    const cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    return { x: (cx / cw + 1) / 2 * scene.canvas.clientWidth, y: (1 - cy / cw) / 2 * scene.canvas.clientHeight };
  };
  const startGame = async () => {
    if (started) return;
    started = true; skip = true; fixedT = END;
    title.classList.remove('on'); go.classList.remove('on'); voice.stop();
    document.getElementById('skip').style.display = 'none';
    document.getElementById('hint').style.display = 'none';
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); // final view drawn → matrix ready
    globalThis.BONI_3D = { toCss };
    document.getElementById('screen').style.display = 'block';
    await import('../main.js');
  };
  window.introDebug.startGame = startGame;

  // settle into request-render mode once the flight is over (and wake up again for a replay)
  const RECORD = new URLSearchParams(location.search).has('record');
  let settled = null;
  const settle = () => {
    const s = now() >= END;
    if (s !== settled) {
      settled = s;
      viewer.resolutionScale = s ? STILL.res : FLIGHT.res;
      tileset.maximumScreenSpaceError = s ? STILL.sse : FLIGHT.sse;
      scene.requestRenderMode = s && !RECORD;
      scene.maximumRenderTimeChange = Infinity;
      scene.requestRender();
    }
  };
  setInterval(settle, 200);
  window.addEventListener('resize', () => scene.requestRender());

  if (new URLSearchParams(location.search).has('record')) { window.introReady = true; return; }
  if (QUICK) { skip = true; fixedT = END; window.introReady = true; startGame(); return; }
  fixedT = null; start = performance.now();
  window.introReady = true;

  const skipIntro = () => { if (!skip) { skip = true; voice.stop(); caption.classList.remove('on'); } };
  window.addEventListener('keydown', (e) => {
    if (started) return;
    if (e.key === 'r' || e.key === 'R') { start = performance.now(); skip = false; told = -1; }
    else if (e.key === 'Enter' && skip) startGame();
    else skipIntro();
  });
  scene.canvas.addEventListener('pointerdown', skipIntro);
  document.getElementById('skip').addEventListener('click', skipIntro);
  // gamepads: any button skips the flight, then A/Start starts the game
  let padHeld = true;
  setInterval(() => {
    if (started) return;
    const down = (navigator.getGamepads?.() ?? []).some((g) => g?.buttons.some((b) => b.pressed));
    if (down && !padHeld) { if (skip && now() >= T.button) startGame(); else skipIntro(); }
    padHeld = down;
  }, 60);
  go.addEventListener('click', startGame);
}
