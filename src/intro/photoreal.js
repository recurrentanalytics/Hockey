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

const T = { zoom: [0.6, 9.4], turn: [3.2, 8.0], tilt: [6.0, 9.6], fade: [8.8, 10.6], rink: [9.2, 10.8], title: 10.4, button: 11.2 };
const END = T.button + 0.2;
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10));
const phase = (t, [a, b]) => ease((t - a) / (b - a));
const FOV_START = (40 * Math.PI) / 180, FOV_END = (18 * Math.PI) / 180;

// Performance: phones and tablets fly at reduced resolution and coarser tiles; once landed, the
// view is drawn once at full resolution and then only when something changes (request render
// mode), so the game on top runs at full speed.
const MOBILE = !!window.BoniAndroid || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
const FLIGHT = { res: MOBILE ? 0.6 : 1, sse: MOBILE ? 18 : 10, msaa: MOBILE ? 1 : 4 };
const STILL = { res: 1, sse: 8 };

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
  const wEnd = COURT.long / (aspect >= 1 ? 0.78 : 0.95);
  const width = Math.exp(Math.log(wStart) + (Math.log(wEnd) - Math.log(wStart)) * phase(t, T.zoom));
  const fovx = FOV_START + (FOV_END - FOV_START) * phase(t, T.tilt);
  return {
    heading: FINAL_HEADING * phase(t, T.turn),
    tilt: FINAL_TILT * phase(t, T.tilt),
    fovx,
    range: width / (2 * Math.tan(fovx / 2)),
    lift: width * 0.025 * phase(t, T.tilt), // court sits a little below the middle at the end
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
      float bayer4(vec2 f) {
        int x = int(mod(f.x, 4.0)), y = int(mod(f.y, 4.0));
        float m[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
        return (m[x + y * 4] + 0.5) / 16.0;
      }
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
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
        if (u_fade * inside > bayer4(gl_FragCoord.xy)) discard;
      }`,
  });
  const ecToEnu = new Cesium.Matrix4();

  const title = document.getElementById('title'), go = document.getElementById('go');
  scene.preRender.addEventListener(() => {
    const t = now();
    place(t);
    const fade = phase(t, T.fade);
    rinkAlpha = phase(t, T.rink);
    court.show = rinkAlpha > 0;
    court.color = Cesium.Color.WHITE.withAlpha(rinkAlpha);
    // the see-through shader is only switched on for the end of the flight
    const want = fade > 0 ? seeThrough : undefined;
    if (tileset.customShader !== want) tileset.customShader = want;
    if (want) {
      Cesium.Matrix4.multiply(frame.inv, camera.inverseViewMatrix, ecToEnu);
      seeThrough.setUniform('u_ecToEnu', ecToEnu);
      seeThrough.setUniform('u_rect', new Cesium.Cartesian4(frame.C.x, frame.C.y, frame.halfLong, frame.halfShort));
      seeThrough.setUniform('u_axis', new Cesium.Cartesian2(frame.u.x, frame.u.y));
      seeThrough.setUniform('u_fade', fade);
    }
    title.classList.toggle('on', t >= T.title && !started);
    go.classList.toggle('on', t >= T.button && !started);
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
    if (Number.isFinite(p?.height)) { ground = p.height; buildFrame(); court.modelMatrix = courtMatrix(); }
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
    title.classList.remove('on'); go.classList.remove('on');
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
  fixedT = null; start = performance.now();
  window.introReady = true;

  window.addEventListener('keydown', (e) => {
    if (started) return;
    if (e.key === 'r' || e.key === 'R') { start = performance.now(); skip = false; }
    else if (e.key === 'Enter' && skip) startGame();
    else skip = true;
  });
  scene.canvas.addEventListener('pointerdown', () => { skip = true; });
  go.addEventListener('click', startGame);
}
