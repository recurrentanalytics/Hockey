// Intro flight: from a 1.2 km aerial view of Hannover-List down onto the Boni court,
// turning so the court lies sideways and tilting into the game's camera angle.
// WebGL2: three georeferenced aerial layers (LGLN DOP20, smoothed by tools/intro/enhance.py)
// on the ground plane, a perspective camera, mipmaps and anisotropic filtering.

// ------------------------------------------------------------------ geodata
// All layers come from the same WMS (ni_dop20), so their bounding boxes line up exactly.
// Positions are in pixels of the 0.2 m reference image (docs/ort/boni_luftbild_lgln.jpg).
const M_PER_PX = 0.2;
const LAYERS = [
  { src: 'assets/intro/boni_umgebung.jpg', x0: -2176, y0: -2395.7, x1: 3944, y1: 3732.9, feather: 0 },
  { src: 'assets/intro/boni_park.jpg', x0: 0, y0: 0, x1: 1870, y1: 1560, feather: 0.06 },
  { src: 'assets/intro/boni_platz.jpg', x0: 780, y0: 520, x1: 1080, y1: 820, feather: 0.12 },
];
// Fence rectangle of the court (docs/BONI_ORT.md), corners A (north), B (east), C (south), D (west).
const COURT = { A: [888.6, 591.5], B: [967.9, 634.1], C: [908.2, 745.3], D: [828.9, 702.7] };
const CENTER = [(COURT.A[0] + COURT.C[0]) / 2, (COURT.A[1] + COURT.C[1]) / 2];

/** Reference-image pixel → ground metres (x east, y north, origin = court centre). */
const toWorld = ([px, py]) => [(px - CENTER[0]) * M_PER_PX, -(py - CENTER[1]) * M_PER_PX];

// Game camera: the court's long side (A→D) runs left→right on screen, the camera stands on
// that side looking towards B/C. Heading = compass direction of the view, clockwise from north.
const AB = [COURT.B[0] - COURT.A[0], -(COURT.B[1] - COURT.A[1])];
const FINAL_HEADING = Math.atan2(AB[0], AB[1]);          // ≈ 118°
const FINAL_TILT = Math.PI / 3;                          // 60° from vertical: ground squashed 2:1 like PROJ {x:16, y:8}
const COURT_LONG = Math.hypot(COURT.D[0] - COURT.A[0], COURT.D[1] - COURT.A[1]) * M_PER_PX;

// ------------------------------------------------------------------ timeline
const T = { zoom: [0.2, 9.0], turn: [2.8, 7.6], tilt: [5.6, 9.2], fence: [8.6, 9.8], title: 9.4, button: 10.2 };
const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10)); // smootherstep
const phase = (t, [a, b]) => ease((t - a) / (b - a));

// ------------------------------------------------------------------ small matrix helpers (column-major)
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
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
  // keep the court centred slightly below the middle once tilted, leaving room for the title
  const target = [-fwd[0] * width * 0.06 * phase(t, T.tilt), -fwd[1] * width * 0.06 * phase(t, T.tilt), 0];
  const eye = [target[0] - view[0] * dist, target[1] - view[1] * dist, target[2] - view[2] * dist];
  return mul(perspective(fovy, aspect, dist * 0.05, dist * 40), lookAt(eye, target, up));
}

// ------------------------------------------------------------------ WebGL
const canvas = document.getElementById('gl');
const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
if (!gl) { document.getElementById('title').classList.add('on'); throw new Error('WebGL2 nicht verfügbar'); }
const aniso = gl.getExtension('EXT_texture_filter_anisotropic');

const VS = `#version 300 es
in vec2 aPos; in vec2 aUV; uniform mat4 uMVP; out vec2 vUV;
void main() { vUV = aUV; gl_Position = uMVP * vec4(aPos, 0.0, 1.0); }`;
const FS = `#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform float uFeather; out vec4 o;
void main() {
  vec4 c = texture(uTex, vUV);
  float e = min(min(vUV.x, 1.0 - vUV.x), min(vUV.y, 1.0 - vUV.y));
  float a = uFeather > 0.0 ? smoothstep(0.0, uFeather, e) : 1.0;
  o = vec4(c.rgb, a);
}`;
const LS = `#version 300 es
precision highp float; uniform vec4 uColor; out vec4 o; void main() { o = uColor; }`;

function program(vs, fs) {
  const p = gl.createProgram();
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  return p;
}
const texProg = program(VS, FS);
const lineProg = program(VS, LS);

function quad(l) {
  const [ax, ay] = toWorld([l.x0, l.y0]), [bx, by] = toWorld([l.x1, l.y1]);
  const data = new Float32Array([ax, ay, 0, 0, bx, ay, 1, 0, ax, by, 0, 1, bx, by, 1, 1]);
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const pos = gl.getAttribLocation(texProg, 'aPos'), uv = gl.getAttribLocation(texProg, 'aUV');
  gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0);
  gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
  return vao;
}
function texture(img) {
  const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  return t;
}

// fence outline as a thin ribbon of triangles (WebGL lines are 1 px only)
const fenceVao = gl.createVertexArray();
const fenceBuf = gl.createBuffer();
function fenceRibbon(halfWidth) {
  const pts = [COURT.A, COURT.B, COURT.C, COURT.D].map(toWorld);
  const v = [];
  for (let i = 0; i <= 4; i++) {
    const p = pts[i % 4], prev = pts[(i + 3) % 4], next = pts[(i + 1) % 4];
    // miter offset towards the outside of the rectangle (corners are right angles)
    const d1 = norm([p[0] - prev[0], p[1] - prev[1], 0]), d2 = norm([next[0] - p[0], next[1] - p[1], 0]);
    const n = norm([d1[1] + d2[1], -(d1[0] + d2[0]), 0]);
    const k = halfWidth * Math.SQRT2;
    v.push(p[0] - n[0] * k, p[1] - n[1] * k, 0, 0, p[0] + n[0] * k, p[1] + n[1] * k, 0, 0);
  }
  gl.bindVertexArray(fenceVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, fenceBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.DYNAMIC_DRAW);
  const pos = gl.getAttribLocation(lineProg, 'aPos');
  gl.enableVertexAttribArray(pos); gl.vertexAttribPointer(pos, 2, gl.FLOAT, false, 16, 0);
}

// ------------------------------------------------------------------ run
const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
const layers = await Promise.all(LAYERS.map(async (l) => ({ ...l, tex: texture(await load(l.src)), vao: quad(l) })));

const title = document.getElementById('title'), go = document.getElementById('go');
const END = T.button + 0.2;
let start = performance.now(), skip = false, fixedT = null;

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
}

function frame(now) {
  resize();
  const t = fixedT ?? (skip ? END : (now - start) / 1000);
  const aspect = canvas.width / canvas.height;
  const mvp = camera(t, aspect);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.055, 0.06, 0.1, 1); gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(texProg);
  gl.uniformMatrix4fv(gl.getUniformLocation(texProg, 'uMVP'), false, mvp);
  for (const l of layers) {
    gl.bindTexture(gl.TEXTURE_2D, l.tex);
    gl.uniform1f(gl.getUniformLocation(texProg, 'uFeather'), l.feather);
    gl.bindVertexArray(l.vao); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  const f = phase(t, T.fence);
  if (f > 0) {
    gl.useProgram(lineProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(lineProg, 'uMVP'), false, mvp);
    fenceRibbon(0.32);
    gl.uniform4f(gl.getUniformLocation(lineProg, 'uColor'), 0.086, 0.067, 0.05, 0.75 * f);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 10);
    fenceRibbon(0.16);
    gl.uniform4f(gl.getUniformLocation(lineProg, 'uColor'), 1, 0.82, 0.25, f);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 10);
  }
  title.classList.toggle('on', t >= T.title);
  go.classList.toggle('on', t >= T.button);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

const restart = () => { start = performance.now(); skip = false; };
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
