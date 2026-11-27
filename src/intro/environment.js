// Weather and time of day at the Boni: live from Open-Meteo (free, no key), picked by hand, or the
// real weather of any past date and hour. Drives the sun position (dappled light on the asphalt
// moves and fades with it), the colour grade of the whole 3D view, wet or snowy ground, falling
// rain or snow, and a matching tint on the game's pixel figures.
const LAT = 52.389, LON = 9.7446;
const KEY = 'boniWeather';
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

/** Sun altitude and azimuth (degrees, azimuth clockwise from north) for a date at the Boni. */
export function sunPosition(date, lat = LAT, lon = LON) {
  const r = Math.PI / 180, d = date.getTime() / 86400000 - 10957.5;
  const g = (357.529 + 0.98560028 * d) * r, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * r, e = (23.439 - 0.00000036 * d) * r;
  const ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const h = (gmst * 15 + lon) * r - ra;
  const alt = Math.asin(Math.sin(lat * r) * Math.sin(dec) + Math.cos(lat * r) * Math.cos(dec) * Math.cos(h));
  const az = Math.atan2(-Math.sin(h), Math.tan(dec) * Math.cos(lat * r) - Math.sin(lat * r) * Math.cos(h));
  return { alt: alt / r, az: ((az / r) + 360) % 360 };
}

/** WMO weather code → one of our looks. */
export function lookOf(code) {
  if (code <= 1) return 'sun';
  if (code === 2) return 'partly';
  if (code === 3) return 'clouds';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 51) return 'rain';
  return 'clouds';
}
/** A plausible temperature for a picked season, weather and hour (°C). */
function guessTemp(season, look, hour) {
  const base = { fruehling: 13, sommer: 24, herbst: 12, winter: 1 }[season] ?? 15;
  const day = Math.cos(((hour - 15) / 24) * 2 * Math.PI) * (look === 'sun' ? 5 : 2.5);  // warmest mid afternoon
  const t = base + day + ({ rain: -3, clouds: -1.5, fog: -2, snow: -4 }[look] ?? 0);
  return look === 'snow' ? Math.min(t, -1) : t;
}

/** Seasons to pick by hand: a typical day of each. */
export const SEASONS = {
  fruehling: { name: 'Frühling', day: [4, 8] }, sommer: { name: 'Sommer', day: [5, 21] },
  herbst: { name: 'Herbst', day: [9, 26] }, winter: { name: 'Winter', day: [0, 20] },
};
export const LOOKS = { sun: '☀️ Sonne', partly: '🌤️ Heiter', clouds: '☁️ Wolken', rain: '🌧️ Regen', snow: '❄️ Schnee', fog: '🌫️ Nebel' };

/** The trees through the year: leaf cover (0 bare … 1 full), autumn colour, bare branches. */
export function season(date) {
  const doy = (date - new Date(date.getFullYear(), 0, 1)) / 86400000;
  const out = smooth(100, 140, doy), fall = 1 - smooth(288, 322, doy);      // leaves out mid April–May, down mid Oct–mid Nov
  const foliage = out * fall;
  return {
    foliage,
    autumn: smooth(255, 292, doy) * (1 - smooth(318, 334, doy)),          // yellow, orange, brown
    bare: 1 - foliage,
    fresh: out * (1 - smooth(140, 175, doy)),                               // light May green
  };
}

/** All visual parameters for a look at a moment. */
export function visuals(look, date, amount = 1) {
  const s = sunPosition(date);
  const yr = season(date);
  const day = smooth(-9, 5, s.alt);                         // 0 night … 1 day
  const golden = day * (1 - smooth(3, 20, s.alt));          // low sun: warm light
  const through = { sun: 1, partly: 0.6, clouds: 0.1, rain: 0.03, snow: 0.08, fog: 0.08 }[look];
  const sunlit = through * smooth(1, 22, s.alt);            // strength of the dappled light
  const dim = { sun: 1, partly: 0.97, clouds: 0.9, rain: 0.8, snow: 1.03, fog: 0.93 }[look];
  const exposure = mix(0.5, 1, day) * dim;
  const night = [0.62, 0.72, 1.0], warm = [1.14, 0.96, 0.76], cool = { rain: [0.92, 0.97, 1.05], snow: [0.96, 0.99, 1.05], fog: [0.97, 0.98, 1.0] }[look] ?? [1, 1, 1];
  const tint = [0, 1, 2].map((i) => mix(night[i], mix(cool[i], warm[i], golden * 0.75), day));
  const sat = mix(0.7, 1, day) * ({ clouds: 0.78, rain: 0.72, snow: 0.72, fog: 0.62 }[look] ?? 1);
  const fog = { fog: 0.42, rain: 0.12, snow: 0.18 }[look] ?? 0;
  const fogColor = [0, 1, 2].map((i) => mix([0.2, 0.24, 0.32][i], [0.78, 0.8, 0.83][i], day));
  return {
    sun: s, day, golden, sunlit, exposure, season: yr,
    // share of the sun the crowns hold back: dense leaves in summer, only branches in winter
    leaf: 0.2 + 0.68 * yr.foliage, tint, sat, fog, fogColor,
    vignette: mix(0.5, 0.12, day),
    wet: look === 'rain' ? 1 : look === 'snow' ? 0.3 : 0,
    snow: look === 'snow' ? 0.85 : 0,
    precip: look === 'rain' || look === 'snow' ? clamp01(0.35 + amount * 0.4) : 0,
    falling: look === 'snow' ? 'snow' : look === 'rain' ? 'rain' : null,
  };
}


/** GLSL: how much sun reaches a point of the court (court metres a, b, z). The ray towards the sun is
 * traced through the crown height map from the LGLN surface model (tools/intro/shadow_casters.py):
 * roofs block it, crowns let light through their gaps (sun flecks), more at thin crown edges and more
 * as the leaves fall. Needs the uniforms of treeUniforms(). */
export const TREE_LIGHT = `
      float treeLight(vec3 p) {
        if (u_sunDir.z < 0.03) return 1.0;
        vec2 d = u_sunDir.xy / u_sunDir.z;                  // horizontal metres per metre of height
        float dh = clamp(0.7 / max(length(d), 0.01), 0.3, 1.0);
        float thick = 0.0, roof = 0.0;
        for (int i = 0; i < 48; i++) {
          float h = 0.6 + float(i) * dh;
          if (h > 30.0) break;
          vec2 q = p.xy + d * (h - p.z);
          vec2 t = vec2(((q.x + 46.0) * 2.0 + 0.5) / 185.0, ((q.y + 41.4) * 2.0 + 0.5) / 167.0);
          if (t.x < 0.0 || t.y < 0.0 || t.x > 1.0 || t.y > 1.0) break;
          vec4 s = texture(u_crowns, t);
          float top = s.r * 51.0;
          if (h > p.z && h < top && h > top * 0.35) { thick += dh; roof = max(roof, s.g); }
        }
        if (roof > 0.5) return 0.0;
        if (thick <= 0.0) return 1.0;
        // gaps between leaf clusters (~0.4 m) inside branch clumps, looked up where the ray passes
        // through the crowns (a fixed height keeps it smooth); evenly spread noise, so the threshold
        // is the share of sun held back, less at thin crown edges
        vec2 m = p.xy + d * (8.0 - p.z);
        float n = texture(u_noise, m * 0.09 + (texture(u_noise, m * 0.014).r - 0.5) * 0.6).r;
        float hold = u_leaf * (0.72 + 0.28 * smoothstep(0.0, 8.0, thick));
        return smoothstep(hold, hold + 0.06, n);
      }`;
/** The uniforms TREE_LIGHT needs (each shader gets its own set; update them with setTreeUniforms). */
export function treeUniforms(Cesium) {
  const tex = (name) => ({ type: Cesium.UniformType.SAMPLER_2D, value: new Cesium.TextureUniform({ url: new URL(`../../assets/intro/${name}`, import.meta.url).href, repeat: name === 'laub.png' }) });
  return {
    u_ecToCourt: { type: Cesium.UniformType.MAT4, value: new Cesium.Matrix4() },
    u_crowns: tex('boni_schatten_hoehen.png'),
    u_noise: tex('laub.png'),
    u_sunDir: { type: Cesium.UniformType.VEC3, value: new Cesium.Cartesian3(0, 0, 1) },
    u_leaf: { type: Cesium.UniformType.FLOAT, value: 0.85 },
    u_shade: { type: Cesium.UniformType.FLOAT, value: 1 },
  };
}

// ------------------------------------------------------------------ weather data (Open-Meteo)
async function fetchWeather(date = null) {
  const base = `latitude=${LAT}&longitude=${LON}&timezone=Europe%2FBerlin`;
  if (!date) {
    const j = await (await fetch(`https://api.open-meteo.com/v1/forecast?${base}&current=temperature_2m,weather_code,precipitation,snowfall,cloud_cover,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`)).json();
    const c = j.current;
    return { code: c.weather_code, temp: c.temperature_2m, wind: c.wind_speed_10m ?? 0, windDir: c.wind_direction_10m ?? 240, amount: Math.max(c.precipitation ?? 0, c.snowfall ?? 0), when: new Date() };
  }
  const day = date.toISOString().slice(0, 10);
  const recent = Date.now() - date.getTime() < 60 * 86400000;
  const host = recent ? 'https://api.open-meteo.com/v1/forecast' : 'https://archive-api.open-meteo.com/v1/archive';
  const j = await (await fetch(`${host}?${base}&start_date=${day}&end_date=${day}&hourly=temperature_2m,weather_code,precipitation,snowfall,wind_speed_10m,wind_direction_10m&wind_speed_unit=ms`)).json();
  const h = Math.min(23, date.getHours());
  const H = j.hourly;
  return { code: H.weather_code[h], temp: H.temperature_2m[h], wind: H.wind_speed_10m?.[h] ?? 0, windDir: H.wind_direction_10m?.[h] ?? 240, amount: Math.max(H.precipitation[h] ?? 0, H.snowfall[h] ?? 0), when: date };
}

// ------------------------------------------------------------------ the environment
export function createEnvironment({ Cesium, viewer, ground, onChange }) {
  const { scene } = viewer;
  // colour grade of the whole 3D view
  const grade = scene.postProcessStages.add(new Cesium.PostProcessStage({
    fragmentShader: `
      uniform sampler2D colorTexture; in vec2 v_textureCoordinates;
      uniform float u_exposure; uniform vec3 u_tint; uniform float u_sat; uniform float u_fog; uniform vec3 u_fogColor; uniform float u_vignette;
      void main() {
        vec4 c = texture(colorTexture, v_textureCoordinates);
        vec3 col = c.rgb * u_exposure * u_tint;
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(l), col, u_sat);
        col = mix(col, u_fogColor, u_fog);
        vec2 d = v_textureCoordinates - 0.5;
        col *= 1.0 - u_vignette * dot(d, d) * 2.2;
        out_FragColor = vec4(col, c.a);
      }`,
    uniforms: { u_exposure: 1, u_tint: new Cesium.Cartesian3(1, 1, 1), u_sat: 1, u_fog: 0, u_fogColor: new Cesium.Cartesian3(0.8, 0.8, 0.8), u_vignette: 0.12 },
  }));
  // the court floor: dappled light by sun and clouds, wet or snowy
  const floor = new Cesium.CustomShader({
    uniforms: {
      u_sun: { type: Cesium.UniformType.FLOAT, value: 1 },
      u_leaves: { type: Cesium.UniformType.FLOAT, value: 0 },
      u_warm: { type: Cesium.UniformType.FLOAT, value: 0 },
      u_wet: { type: Cesium.UniformType.FLOAT, value: 0 },
      u_snow: { type: Cesium.UniformType.FLOAT, value: 0 },
      u_night: { type: Cesium.UniformType.FLOAT, value: 0 },
      ...treeUniforms(Cesium),
    },
    fragmentShaderText: `${TREE_LIGHT}
      void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
        vec2 uv = fsInput.attributes.texCoord_0;
        vec3 c = material.diffuse;
        // sun and shade: trees and houses (traced), sun flecks between the leaves, warm low sun
        vec3 pc = (u_ecToCourt * vec4(fsInput.attributes.positionEC, 1.0)).xyz;
        float lit = treeLight(vec3(pc.xy, 0.0));
        c *= mix(1.0, 0.86, u_sun) * mix(u_shade, 1.0, lit) * mix(vec3(1.0), vec3(1.1, 0.98, 0.85), u_warm * u_sun * lit);
        // autumn: fallen leaves on the asphalt, single leaves in loose drifts, piled up along the fence
        float edge = min(12.6 - abs(pc.x), 9.0 - abs(pc.y));
        float drift = smoothstep(0.35, 0.85, texture(u_noise, pc.xy * 0.045).r);
        float lay = u_leaves * (0.04 + 0.3 * drift + 0.55 * (1.0 - smoothstep(0.0, 1.8, edge)));
        float leafN = texture(u_noise, pc.xy * 0.85 + 0.13).r;
        if (leafN < lay * 0.45) {
          float k = texture(u_noise, pc.xy * 0.31 + 0.71).r;
          vec3 leafC = k < 0.4 ? vec3(0.42, 0.2, 0.05) : k < 0.75 ? vec3(0.5, 0.33, 0.06) : vec3(0.3, 0.17, 0.07);
          c = mix(c, leafC * mix(0.6, 1.0, lit), smoothstep(0.0, 0.08, lay * 0.45 - leafN) * 0.9);
        }
        // at night two street lamps by the fence light the court in warm pools
        vec2 q = vec2(uv.x * 1.4, uv.y);
        vec2 l1 = q - vec2(0.38, 0.95), l2 = q - vec2(1.02, 0.95);
        float pool = (exp(-dot(l1, l1) * 20.0) + exp(-dot(l2, l2) * 20.0)) * u_night;
        c = c * (1.0 + pool * 3.5) + vec3(1.0, 0.7, 0.35) * pool * 0.5;
        c = mix(c, c * 0.58 + vec3(0.05, 0.06, 0.08), u_wet);
        float n = fract(sin(dot(floor(uv * 420.0), vec2(12.9898, 78.233))) * 43758.5453);
        c = mix(c, vec3(0.93, 0.95, 0.98) - n * 0.07, u_snow);
        material.diffuse = c;
      }`,
  });
  ground.customShader = floor;

  // falling rain or snow over everything (3D view and game)
  const fx = document.getElementById('weatherFx');
  const fctx = fx.getContext('2d');
  let drops = [], falling = null, amount = 0, last = performance.now();
  const sizeFx = () => { fx.width = innerWidth; fx.height = innerHeight; };
  addEventListener('resize', sizeFx); sizeFx();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    fctx.clearRect(0, 0, fx.width, fx.height);
    if (falling) {
      const want = Math.round((falling === 'rain' ? 260 : 170) * amount * (fx.width * fx.height) / (1280 * 720));
      while (drops.length < want) drops.push({ x: Math.random() * fx.width, y: Math.random() * fx.height, v: 0.6 + Math.random() * 0.8, p: Math.random() * 6 });
      drops.length = Math.min(drops.length, want);
      fctx.strokeStyle = 'rgba(200,215,235,0.55)'; fctx.fillStyle = 'rgba(255,255,255,0.9)'; fctx.lineWidth = 1.2;
      fctx.beginPath();
      for (const d of drops) {
        if (falling === 'rain') { d.y += 900 * d.v * dt; d.x += 160 * d.v * dt; fctx.moveTo(d.x, d.y); fctx.lineTo(d.x - 4 * d.v, d.y - 18 * d.v); }
        else { d.p += dt * 1.5; d.y += 55 * d.v * dt; d.x += Math.sin(d.p) * 18 * dt; fctx.moveTo(d.x + 1.8 * d.v, d.y); fctx.arc(d.x, d.y, 1.8 * d.v, 0, Math.PI * 2); }
        if (d.y > fx.height + 20) { d.y = -20; d.x = Math.random() * fx.width; }
        if (d.x > fx.width + 20) d.x = -20;
      }
      if (falling === 'rain') fctx.stroke(); else fctx.fill();
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  let state = { mode: 'live', look: 'sun', hour: 15, date: null, info: '' };
  try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* defaults */ }

  let lastAir = null;
  function apply(look, date, amt = 0, air = {}) {
    const v = visuals(look, date, amt);
    viewer.clock.currentTime = Cesium.JulianDate.fromDate(date);
    const u = grade.uniforms;
    u.u_exposure = v.exposure; u.u_tint = new Cesium.Cartesian3(...v.tint); u.u_sat = v.sat;
    u.u_fog = v.fog; u.u_fogColor = new Cesium.Cartesian3(...v.fogColor); u.u_vignette = v.vignette;
    floor.setUniform('u_sun', v.sunlit);
    floor.setUniform('u_leaves', v.snow ? 0 : Math.min(1, v.season.autumn * 0.7 + v.season.bare * v.season.autumn * 2));
    floor.setUniform('u_warm', v.golden);
    floor.setUniform('u_wet', v.wet);
    floor.setUniform('u_snow', v.snow);
    floor.setUniform('u_night', 1 - v.day);
    // shadows: crisp and deep in sunshine, gone under clouds and at night
    // shade depth: deep in sunshine, none under clouds and at night (fence and goals: shadow map)
    // (the shaders work in linear light: 0.3 there looks like about half as bright on screen)
    const shade = 1 - 0.45 * Math.min(1, v.sunlit * 1.2);
    floor.setUniform('u_shade', 1 - 0.7 * Math.min(1, v.sunlit * 1.2));
    viewer.shadows = v.sunlit > 0.04;
    viewer.scene.shadowMap.darkness = shade;
    falling = v.falling; amount = v.precip;
    // the pixel figures get the same light
    const screen = document.getElementById('screen');
    if (screen) screen.style.filter = `brightness(${(0.25 + v.exposure * 0.75).toFixed(2)}) saturate(${v.sat.toFixed(2)}) sepia(${(v.golden * 0.3).toFixed(2)})`;
    scene.requestRender();
    // the air for the game's physics (temperature, wind) and the leaves lying on the court
    const leaves = v.snow ? 0 : Math.min(1, v.season.autumn * 0.7 + v.season.bare * v.season.autumn * 2);
    lastAir = { temp: 15, wind: 2, windDir: 240, amount: amt, leaves, ...air };
    onChange?.({ ...state, look, date, visuals: v, air: lastAir });
  }

  async function refresh() {
    try {
      if (state.mode === 'pick') {
        // picked by hand: a midsummer day, so noon has high sun and the evening golden light
        const [mo, dd] = SEASONS[state.season ?? 'sommer'].day;
        const d = new Date(new Date().getFullYear(), mo, dd, Math.floor(state.hour), Math.round((state.hour % 1) * 60));
        const air = { temp: state.temp ?? guessTemp(state.season ?? 'sommer', state.look, state.hour), wind: state.wind ?? { sun: 2, partly: 3, clouds: 4, rain: 6, snow: 5, fog: 1 }[state.look], windDir: 240 };
        state.info = `${SEASONS[state.season ?? 'sommer'].name} · ${LOOKS[state.look]} · ${Math.round(air.temp)} °C · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} Uhr`;
        apply(state.look, d, state.look === 'rain' || state.look === 'snow' ? 1 : 0, air);
      } else {
        const when = state.mode === 'hist' && state.date ? new Date(`${state.date}T${String(Math.floor(state.hour)).padStart(2, '0')}:00`) : null;
        const w = await fetchWeather(when);
        const look = lookOf(w.code);
        const t = w.when;
        state.info = `${state.mode === 'live' ? 'Live' : t.toLocaleDateString('de-DE')} · ${LOOKS[look]} · ${Math.round(w.temp)} °C · ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')} Uhr`;
        apply(look, t, w.amount, { temp: w.temp, wind: w.wind, windDir: w.windDir });
      }
    } catch {
      state.info = 'Wetterdaten nicht erreichbar – Sonne';
      apply('sun', new Date(new Date().setHours(15, 0, 0, 0)));
    }
    try { localStorage.setItem(KEY, JSON.stringify({ mode: state.mode, look: state.look, hour: state.hour, date: state.date, season: state.season, temp: state.temp, wind: state.wind })); } catch { /* ignore */ }
  }
  setInterval(() => { if (state.mode === 'live') refresh(); }, 10 * 60 * 1000);
  refresh();
  return { floor, surfaceLabel: '', get air() { return lastAir; }, get state() { return state; }, set(p) { Object.assign(state, p); return refresh(); } };
}

/** The little weather panel (button ⛅ top left). */
export function weatherPanel(env) {
  const btn = document.getElementById('wxBtn'), box = document.getElementById('wx');
  const $ = (id) => document.getElementById(id);
  const render = () => {
    const s = env.state;
    for (const b of box.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === s.mode);
    for (const b of box.querySelectorAll('[data-look]')) b.classList.toggle('on', b.dataset.look === s.look);
    for (const b of box.querySelectorAll('[data-season]')) b.classList.toggle('on', b.dataset.season === (s.season ?? 'sommer'));
    $('wxPick').hidden = s.mode !== 'pick'; $('wxHist').hidden = s.mode !== 'hist';
    $('wxHour').value = s.hour; $('wxHour2').value = s.hour;
    const air = env.air ?? {};
    if (air.temp != null) { $('wxTemp').value = Math.round(air.temp); $('wxTempLbl').textContent = `${Math.round(air.temp)} °C`; }
    if (air.wind != null) { $('wxWind').value = Math.round(air.wind); $('wxWindLbl').textContent = `${Math.round(air.wind * 3.6)} km/h`; }
    $('wxSurf').textContent = env.surfaceLabel ? `Platz: ${env.surfaceLabel}` : '';
    $('wxHourLbl').textContent = $('wxHourLbl2').textContent = `${String(Math.floor(s.hour)).padStart(2, '0')}:${String(Math.round((s.hour % 1) * 60)).padStart(2, '0')}`;
    if (s.date) $('wxDate').value = s.date;
    $('wxInfo').textContent = s.info;
  };
  btn.addEventListener('click', () => { box.hidden = !box.hidden; render(); });
  box.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-mode]')?.dataset.mode, l = e.target.closest('[data-look]')?.dataset.look, y = e.target.closest('[data-season]')?.dataset.season;
    if (y) await env.set({ season: y, temp: null, wind: null });
    if (m) { if (m === 'hist' && !env.state.date) env.state.date = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10); await env.set({ mode: m }); }
    if (l) await env.set({ look: l, temp: null, wind: null });
    render();
  });
  $('wxHour').addEventListener('input', (e) => { env.set({ hour: +e.target.value }).then(render); render(); });
  $('wxHour2').addEventListener('change', (e) => { env.set({ hour: +e.target.value }).then(render); });
  $('wxHour2').addEventListener('input', (e) => { env.state.hour = +e.target.value; render(); });
  // temperature and wind by hand (picked weather)
  $('wxTemp').addEventListener('input', (e) => { env.set({ temp: +e.target.value }).then(render); render(); });
  $('wxWind').addEventListener('input', (e) => { env.set({ wind: +e.target.value }).then(render); render(); });
  $('wxDate').addEventListener('change', (e) => { env.set({ date: e.target.value }).then(render); });
  setInterval(render, 2000);
  btn.hidden = false;
}
