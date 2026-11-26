// Intro flight: from 1.2 km above Hannover-List down onto the Boni court, turning so the court
// lies sideways and tilting into the game's camera angle. The whole district is real 3D:
// a terrain mesh displaced by the LGLN surface model (DOM1: every house and tree, 1 m grid,
// tools/intro/height.py), textured with the LGLN aerial photo (DOP20, smoothed by
// tools/intro/enhance.py); ALKIS footprints (tools/intro/buildings.py) tell houses from trees. WebGL2, mipmaps, anisotropic filtering, depth buffer.

// ------------------------------------------------------------------ geodata
// All rasters come from the same WMS bounding boxes, so they line up exactly.
// Positions are in pixels of the 0.2 m reference image (docs/ort/boni_luftbild_lgln.jpg).
const M_PER_PX = 0.2;
const OUTER = { x0: -2176, y0: -2395.7, x1: 3944, y1: 3732.9 };
const PARK = { x0: 0, y0: 0, x1: 1870, y1: 1560 };
const PLATZ = { x0: 780, y0: 520, x1: 1080, y1: 820 };
const IMAGES = { outer: 'assets/intro/boni_umgebung.jpg', park: 'assets/intro/boni_park.jpg', platz: 'assets/intro/boni_platz.jpg', height: 'assets/intro/boni_hoehe.png', buildings: 'assets/intro/boni_gebaeude.png' };
const HEIGHT_STEP = 0.15; // metres per height-map unit
// Fence rectangle of the court (docs/BONI_ORT.md), corners A (north), B (east), C (south), D (west).
const COURT = { A: [888.6, 591.5], B: [967.9, 634.1], C: [908.2, 745.3], D: [828.9, 702.7] };
const CENTER = [(COURT.A[0] + COURT.C[0]) / 2, (COURT.A[1] + COURT.C[1]) / 2];

/** Reference-image pixel → ground metres (x east, y north, origin = court centre). */
const toWorld = ([px, py]) => [(px - CENTER[0]) * M_PER_PX, -(py - CENTER[1]) * M_PER_PX];
/** Rectangle in reference pixels → [west, south, width, height] in metres. */
const rectWorld = (r) => { const [w, n] = toWorld([r.x0, r.y0]), [e, s] = toWorld([r.x1, r.y1]); return [w, s, e - w, n - s]; };

// Game camera: the court's long side (A→D) runs left→right on screen; the camera stands on that
// side (towards the hippo sandpit) looking at B/C. Heading = view direction, clockwise from north.
const AB = [COURT.B[0] - COURT.A[0], -(COURT.B[1] - COURT.A[1])];
const FINAL_HEADING = Math.atan2(AB[0], AB[1]);          // ≈ 118°
const FINAL_TILT = Math.PI / 3;                          // 60° from vertical: ground squashed 2:1 like PROJ {x:16, y:8}
const COURT_LONG = Math.hypot(COURT.D[0] - COURT.A[0], COURT.D[1] - COURT.A[1]) * M_PER_PX;
const FENCE_HEIGHT = 4;
// Cut-away plane along the near fence (A–D), rising towards the camera at half the final view slope.
const CUT = (() => {
  const a = toWorld(COURT.A), b = toWorld(COURT.B), l = Math.hypot(a[0] - b[0], a[1] - b[1]);
  return { p: a, n: [(a[0] - b[0]) / l, (a[1] - b[1]) / l], k: Math.tan(Math.PI / 2 - FINAL_TILT) * 0.5 };
})();

// ------------------------------------------------------------------ timeline
const T = { zoom: [0.2, 9.0], turn: [2.8, 7.6], tilt: [5.6, 9.2], fence: [8.6, 9.8], title: 9.4, button: 10.2 };
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10)); // smootherstep
const phase = (t, [a, b]) => ease((t - a) / (b - a));

// ------------------------------------------------------------------ small matrix helpers (column-major)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
}
function lookAt(eye, target, up) {
  const z = norm(sub(eye, target)), x = norm(cross(up, z)), y = cross(z, x);
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
}
function mul(a, b) {
  const o = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return o;
}

// ------------------------------------------------------------------ camera
// The field of view narrows while tilting (a slow dolly zoom), so the end looks almost
// like the game's parallel projection.
const FOV_START = (40 * Math.PI) / 180, FOV_END = (16 * Math.PI) / 180;
function camera(t, aspect) {
  // visible ground width at the target, interpolated in log space for an even zoom speed
  const wStart = 1150 * Math.min(1, aspect);
  const wEnd = COURT_LONG / (aspect >= 1 ? 0.5 : 0.86);
  const width = Math.exp(Math.log(wStart) + (Math.log(wEnd) - Math.log(wStart)) * phase(t, T.zoom));
  const heading = FINAL_HEADING * phase(t, T.turn);
  const tilt = FINAL_TILT * phase(t, T.tilt);
  const fovx = FOV_START + (FOV_END - FOV_START) * phase(t, T.tilt);
  const fovy = 2 * Math.atan(Math.tan(fovx / 2) / aspect);
  const dist = width / (2 * Math.tan(fovx / 2));
  const fwd = [Math.sin(heading), Math.cos(heading), 0];
  const view = [Math.sin(tilt) * fwd[0], Math.sin(tilt) * fwd[1], -Math.cos(tilt)];
  const up = [Math.cos(tilt) * fwd[0], Math.cos(tilt) * fwd[1], Math.sin(tilt)];
  // once tilted, keep the court a little below the middle, leaving room for the title
  const lift = width * 0.06 * phase(t, T.tilt);
  const target = [-fwd[0] * lift, -fwd[1] * lift, 0];
  const eye = [target[0] - view[0] * dist, target[1] - view[1] * dist, target[2] - view[2] * dist];
  return { mvp: mul(perspective(fovy, aspect, dist * 0.02, dist * 40), lookAt(eye, target, up)), eye, dist };
}

// ------------------------------------------------------------------ WebGL setup
const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
if (!gl) { document.getElementById('title').classList.add('on'); throw new Error('WebGL2 nicht verfügbar'); }
const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
const HMAX = (255 * HEIGHT_STEP).toFixed(3);

const TERRAIN_VS = `#version 300 es
in vec2 aPos;
uniform mat4 uMVP; uniform sampler2D uH; uniform vec4 uHRect;
uniform vec2 uCutP, uCutN; uniform float uCutK;
out vec2 vW; out vec3 vP;
void main() {
  float h = textureLod(uH, vec2((aPos.x - uHRect.x) / uHRect.z, 1.0 - (aPos.y - uHRect.y) / uHRect.w), 0.0).r * ${HMAX};
  // sight-line cut-away: between the camera and the near fence nothing may rise above the line
  // of sight onto the court, so houses and trees there are lowered (they stay in the photo)
  float s = dot(aPos - uCutP, uCutN) + 3.0;   // starts 3 m inside the fence, past the court's blurred edge
  if (s > 0.0) h *= smoothstep(1.0, 0.75, h / (s * uCutK + 0.01)); // too tall: the tree or house sinks away
  vW = aPos; vP = vec3(aPos, h); gl_Position = uMVP * vec4(aPos, h, 1.0);
}`;

const TERRAIN_FS = `#version 300 es
precision highp float;
in vec2 vW; in vec3 vP;
uniform sampler2D uOuter, uPark, uPlatz, uH, uB;
uniform vec4 uROuter, uRPark, uRPlatz, uHRect;
uniform vec3 uEye; uniform float uFogDist;
out vec4 o;
vec2 uvOf(vec4 r, vec2 w) { return vec2((w.x - r.x) / r.z, 1.0 - (w.y - r.y) / r.w); }
float edge(vec2 uv, float f) { float e = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)); return smoothstep(0.0, f, e); }
float h(vec2 w) { return texture(uH, uvOf(uHRect, w)).r * ${HMAX}; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 a = uvOf(uRPark, vW), b = uvOf(uRPlatz, vW);
  vec3 c = texture(uOuter, uvOf(uROuter, vW)).rgb;
  c = mix(c, texture(uPark, a).rgb, edge(a, 0.05));
  c = mix(c, texture(uPlatz, b).rgb, edge(b, 0.12));
  // surface normal from the height map (1 m texels)
  vec3 n = normalize(vec3(h(vW - vec2(1.0, 0.0)) - h(vW + vec2(1.0, 0.0)), h(vW - vec2(0.0, 1.0)) - h(vW + vec2(0.0, 1.0)), 2.0));
  float steep = smoothstep(0.25, 0.8, 1.0 - n.z);
  vec3 sun = normalize(vec3(0.35, -0.75, 0.55));
  float building = smoothstep(0.25, 0.6, texture(uB, uvOf(uHRect, vW)).r);

  // facades: the aerial photo only shows roofs, so walls get plaster or brick with window rows
  vec2 hn = length(n.xy) > 0.01 ? normalize(n.xy) : vec2(1.0, 0.0);
  float roof = h(vW - hn * 1.5);
  vec2 cell = floor(vW / 14.0);
  float k = hash(cell);
  vec3 plaster = k < 0.3 ? vec3(0.86, 0.80, 0.68) : k < 0.5 ? vec3(0.80, 0.64, 0.45) : k < 0.75 ? vec3(0.62, 0.34, 0.26) : k < 0.9 ? vec3(0.78, 0.77, 0.73) : vec3(0.88, 0.84, 0.60);
  float along = dot(vW, vec2(-hn.y, hn.x));
  float floorY = mod(vP.z - 0.8, 3.3), col = mod(along, 2.6);
  float win = step(0.9, floorY) * step(floorY, 2.5) * step(0.7, col) * step(col, 1.9) * step(1.5, vP.z) * step(vP.z, roof - 1.6);
  vec3 facade = mix(plaster, vec3(0.16, 0.19, 0.24), win * 0.85);
  facade *= 0.55 + 0.6 * max(dot(vec3(hn, 0.0), sun.xyz), 0.0) + 0.1;
  c = mix(c, facade, steep * building);

  // trees: the photo is a winter picture, the surface model has summer crowns; shade them as foliage
  float tree = (1.0 - building) * smoothstep(1.5, 3.5, vP.z);
  vec2 lp = vW + vec2(0.7, -0.5) * vP.z;   // varies with height too, so flanks are not streaked
  float leaf = noise(lp * 1.3) * 0.6 + noise(lp * 4.1) * 0.4;
  vec3 foliage = mix(vec3(0.20, 0.27, 0.13), vec3(0.42, 0.50, 0.24), leaf);
  foliage = mix(foliage, c * vec3(0.9, 1.0, 0.8), 0.25);
  foliage *= 0.55 + 0.6 * max(dot(n, sun), 0.0);
  c = mix(c, foliage, tree);

  // remaining flanks (sheds, walls without footprint): shade by the low winter sun
  float grey = dot(c, vec3(0.3, 0.59, 0.11));
  c = mix(c, mix(vec3(grey), c, 0.6) * (0.5 + 0.65 * max(dot(n, sun), 0.0)), steep * (1.0 - building) * (1.0 - tree));
  // contact shadow at the foot of walls and trees
  c *= mix(0.75, 1.0, smoothstep(0.0, 2.5, vP.z + steep * 3.0));
  // light haze with distance
  float fog = smoothstep(uFogDist * 0.6, uFogDist * 2.2, distance(uEye, vP));
  o = vec4(mix(c, vec3(0.70, 0.76, 0.84), fog * 0.55), 1.0);
}`;

const FLAT_VS = `#version 300 es
in vec3 aPos; uniform mat4 uMVP; void main() { gl_Position = uMVP * vec4(aPos, 1.0); }`;
const FLAT_FS = `#version 300 es
precision highp float; uniform vec4 uColor; out vec4 o; void main() { o = uColor; }`;

function program(vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const name = gl.getActiveUniform(p, i).name; u[name] = gl.getUniformLocation(p, name); }
  return { p, u };
}
const terrain = program(TERRAIN_VS, TERRAIN_FS);
const flat = program(FLAT_VS, FLAT_FS);

/** Regular grid of [x, y] vertices (metres) over rect, optionally leaving out a hole. */
function grid([x, y, w, h], step, hole) {
  const nx = Math.ceil(w / step) + 1, ny = Math.ceil(h / step) + 1;
  const pos = new Float32Array(nx * ny * 2);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    pos[(j * nx + i) * 2] = x + Math.min(w, i * step);
    pos[(j * nx + i) * 2 + 1] = y + Math.min(h, j * step);
  }
  const idx = [];
  for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const k = j * nx + i;
    if (hole) {
      const px = pos[k * 2], py = pos[k * 2 + 1];
      if (px >= hole[0] && px + step <= hole[0] + hole[2] && py >= hole[1] && py + step <= hole[1] + hole[3]) continue;
    }
    idx.push(k, k + 1, k + nx, k + 1, k + nx + 1, k + nx); // counter-clockwise seen from above
  }
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, pos, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(terrain.p, 'aPos');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
  return { vao, count: idx.length };
}

function texture(img, { mono = false } = {}) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  if (mono) gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, gl.RED, gl.UNSIGNED_BYTE, img);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  if (mono) { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); return t; }
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  return t;
}

// ------------------------------------------------------------------ fence: yellow court line + see-through mesh walls
const corners = [COURT.A, COURT.B, COURT.C, COURT.D].map(toWorld);
function fenceGeometry() {
  const line = [], walls = [], rails = [];
  const quad = (arr, p, q, z0, z1) => arr.push(p[0], p[1], z0, q[0], q[1], z0, q[0], q[1], z1, p[0], p[1], z0, q[0], q[1], z1, p[0], p[1], z1);
  for (let i = 0; i < 4; i++) {
    const p = corners[i], q = corners[(i + 1) % 4];
    const d = norm([q[0] - p[0], q[1] - p[1], 0]), n = [-d[1] * 0.18, d[0] * 0.18];
    // court line on the ground
    line.push(p[0] - n[0], p[1] - n[1], 0.15, q[0] - n[0], q[1] - n[1], 0.15, q[0] + n[0], q[1] + n[1], 0.15,
      p[0] - n[0], p[1] - n[1], 0.15, q[0] + n[0], q[1] + n[1], 0.15, p[0] + n[0], p[1] + n[1], 0.15);
    quad(walls, p, q, 0, FENCE_HEIGHT);
    // posts every ~2.5 m, a top rail and a kick rail
    const len = Math.hypot(q[0] - p[0], q[1] - p[1]), n2 = Math.round(len / 2.5);
    for (let k = 0; k <= n2; k++) {
      const s = (len * k) / n2, x = p[0] + d[0] * s, y = p[1] + d[1] * s, w = 0.07;
      quad(rails, [x - d[0] * w, y - d[1] * w], [x + d[0] * w, y + d[1] * w], 0, FENCE_HEIGHT);
    }
    for (const z of [FENCE_HEIGHT - 0.1, 0.9]) quad(rails, p, q, z, z + 0.1);
  }
  const make = (arr) => {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(flat.p, 'aPos');
    gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    return { vao, count: arr.length / 3 };
  };
  return { line: make(line), walls: make(walls), rails: make(rails) };
}

// ------------------------------------------------------------------ load and run
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src; });
const img = Object.fromEntries(await Promise.all(Object.entries(IMAGES).map(async ([k, s]) => [k, await load(s)])));
const tex = { outer: texture(img.outer), park: texture(img.park), platz: texture(img.platz), height: texture(img.height, { mono: true }), buildings: texture(img.buildings, { mono: true }) };
const R = { outer: rectWorld(OUTER), park: rectWorld(PARK), platz: rectWorld(PLATZ) };
const parkHole = [R.park[0] + 8, R.park[1] + 8, R.park[2] - 16, R.park[3] - 16];
const meshes = [grid(R.outer, 4, parkHole), grid(R.park, 1)];
const fence = fenceGeometry();

const title = document.getElementById('title'), go = document.getElementById('go');
const END = T.button + 0.2;
let start = performance.now(), skip = false, fixedT = null;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}

function drawFlat(mesh, mvp, rgba) {
  gl.uniformMatrix4fv(flat.u.uMVP, false, mvp);
  gl.uniform4fv(flat.u.uColor, rgba);
  gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
}

function frame(now) {
  resize();
  const t = fixedT ?? (skip ? END : (now - start) / 1000);
  const cam = camera(t, canvas.width / canvas.height);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.70, 0.76, 0.84, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);

  const { u } = terrain;
  gl.useProgram(terrain.p);
  gl.uniformMatrix4fv(u.uMVP, false, cam.mvp);
  gl.uniform3fv(u.uEye, cam.eye);
  gl.uniform1f(u.uFogDist, cam.dist);
  gl.uniform2fv(u.uCutP, CUT.p); gl.uniform2fv(u.uCutN, CUT.n); gl.uniform1f(u.uCutK, CUT.k);
  gl.uniform4fv(u.uROuter, R.outer); gl.uniform4fv(u.uRPark, R.park); gl.uniform4fv(u.uRPlatz, R.platz); gl.uniform4fv(u.uHRect, R.outer);
  [['uOuter', tex.outer], ['uPark', tex.park], ['uPlatz', tex.platz], ['uH', tex.height], ['uB', tex.buildings]].forEach(([name, t2], i) => {
    gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, t2); gl.uniform1i(u[name], i);
  });
  for (const m of meshes) { gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.count, gl.UNSIGNED_INT, 0); }

  const f = phase(t, T.fence);
  if (f > 0) {
    gl.useProgram(flat.p);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    drawFlat(fence.line, cam.mvp, [1, 0.82, 0.25, f]);
    drawFlat(fence.walls, cam.mvp, [0.16, 0.2, 0.18, 0.22 * f]);
    drawFlat(fence.rails, cam.mvp, [0.12, 0.14, 0.13, 0.85 * f]);
    gl.depthMask(true);
  }
  title.classList.toggle('on', t >= T.title);
  go.classList.toggle('on', t >= T.button);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const restart = () => { start = performance.now(); skip = false; fixedT = null; };
window.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') restart();
  else if (e.key === 'Enter' && skip) location.href = 'index.html';
  else skip = true;
});
canvas.addEventListener('pointerdown', () => { skip = true; });
go.addEventListener('click', () => { location.href = 'index.html'; });

// hooks for automated previews (tools/intro/record.cjs)
window.introDebug = {
  duration: END,
  /** Freeze the flight at time s (seconds) and resolve after that frame is drawn. */
  freeze: (s) => new Promise((res) => { fixedT = s; requestAnimationFrame(() => requestAnimationFrame(res)); }),
};
window.introReady = true;
