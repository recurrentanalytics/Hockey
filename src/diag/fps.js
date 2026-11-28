// Leistungsanzeige für Gerätetests (docs/PERFORMANCE_TEST.md). Wird nur geladen, wenn die Adresse
// „?fps“ enthält (siehe index.html, test.html, welt.html); sonst existiert dieses Modul im Spiel nicht.
//
// Messmethode: ein eigener requestAnimationFrame-Takt misst den Abstand zwischen zwei Bildern, die
// der Browser tatsächlich ausgibt. Das erfasst Spiel-Canvas und 3D-Ansicht zusammen, denn beide
// zeichnen im selben Bildtakt. Die Werte werden in einem Ringpuffer gesammelt und nur einmal pro
// Sekunde als Text angezeigt. Pausen (Tab im Hintergrund, Bildschirm aus) zählen nicht mit.
// Nichts wird gespeichert oder übertragen.

const BUF = 8192;                     // reicht für > 60 s bei 120 Hz
const dts = new Float32Array(BUF);    // Bildabstände in ms
let n = 0;                            // Bilder seit dem letzten Neustart
let total = 0;                        // gemessene Zeit seit dem Neustart (ms)
let last = 0, skipNext = true;        // erstes Bild nach Start oder Pause nicht werten
let pauses = 0;                       // Unterbrechungen durch Hintergrund oder Sperrbildschirm
let secFrames = [];                   // Zeitstempel der Bilder der letzten Sekunde
let cesiumFrames = [], cesiumHooked = false;
let gpu = null;

const box = document.createElement('div');
box.id = 'fpsDiag';
box.setAttribute('aria-live', 'off');
box.style.cssText = [
  // top left below the weather button: away from the touch stick (bottom left) and the score (top centre)
  'position:fixed', 'left:6px', 'top:76px', 'z-index:2147483647', 'max-width:min(70vw,440px)', 'overflow:hidden',
  `font:${innerHeight < 500 ? 10 : 12}px/1.3 ui-monospace,Menlo,Consolas,"Roboto Mono",monospace`, 'color:#e8ffe8',
  'background:rgba(8,10,16,0.82)', 'border:1px solid #3a6', 'border-radius:8px', 'padding:6px 8px',
  'pointer-events:none', 'white-space:pre', 'user-select:none', '-webkit-user-select:none',
].join(';');
const text = document.createElement('div');
text.style.cssText = 'overflow:hidden;text-overflow:ellipsis';
// small screens start with the measurements only; "Details" adds screen, 3D and GPU
let details = innerHeight >= 500;
const button = (label, action) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.style.cssText = 'pointer-events:auto;margin:5px 6px 0 0;font:600 12px system-ui,sans-serif;padding:5px 9px;border-radius:6px;border:1px solid #6c6;background:#1d3a24;color:#fff;touch-action:manipulation';
  // the game listens for pointer and key events on the window: keep the button's taps to itself
  for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'click']) {
    b.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'click') action(b); }, { passive: ev.startsWith('touch') });
  }
  return b;
};
const reset = button('Neu messen', () => { restart(); render(); });
const more = button(details ? 'Weniger' : 'Details', (b) => { details = !details; b.textContent = details ? 'Weniger' : 'Details'; render(); });
box.append(text, reset, more);
const mount = () => (document.body ? document.body.appendChild(box) : requestAnimationFrame(mount));
mount();

function restart() {
  n = 0; total = 0; pauses = 0; skipNext = true; secFrames = []; cesiumFrames = [];
}

document.addEventListener('visibilitychange', () => {
  // a hidden page gets no frames (or very few); the gap until it comes back is not a stutter
  if (document.hidden) pauses++;
  skipNext = true;
});

function frame(now) {
  if (!document.hidden) {
    if (!skipNext) {
      const dt = now - last;
      dts[n % BUF] = dt;
      n++;
      total += dt;
    }
    skipNext = false;
    last = now;
    secFrames.push(now);
    while (secFrames.length && now - secFrames[0] > 1000) secFrames.shift();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ------------------------------------------------------------------ Auswertung

/** Typische Bildwiederholraten von Displays; die gemessene wird auf die nächste gerundet. */
const RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165];
function stats() {
  const m = Math.min(n, BUF);
  if (m < 10) return null;
  const s = dts.slice(0, m).sort();   // typed array: numeric sort, no garbage per value
  const q = (p) => s[Math.min(m - 1, Math.floor(p * (m - 1)))];
  // the display's refresh interval: the fast end of the distribution (10 %), where unhindered frames sit
  const fast = q(0.1);
  const hz = RATES.reduce((b, r) => (Math.abs(1000 / r - fast) < Math.abs(1000 / b - fast) ? r : b), 60);
  // a stutter is a frame clearly longer than the usual beat. The beat is the median, not the display
  // rate: a 120 Hz screen that steadily shows 60 frames is smooth, not stuttering.
  const slot = Math.max(1000 / hz, q(0.5));
  let long = 0, hitch = 0;
  for (let i = 0; i < m; i++) { if (dts[i] > slot * 1.5) long++; if (dts[i] > 100) hitch++; }
  // 1%-Low: the frame rate during the slowest 1 % of frames (their average duration), as benchmarks use it
  const k = Math.max(1, Math.round(m * 0.01));
  let worst = 0;
  for (let i = m - k; i < m; i++) worst += s[i];
  return {
    avg: (n * 1000) / total,
    p99: q(0.99), p50: q(0.5), max: s[m - 1],
    low1: (1000 * k) / worst,
    hz, longShare: long / m, hitch,
  };
}

function gpuName() {
  if (gpu !== null) return gpu;
  gpu = 'nicht auslesbar';
  try {
    // prefer the 3D view's own context; otherwise a throw-away one that is released at once
    const v = window.welt?.viewer;
    let gl = v?.scene?.context?._gl, temp = null;
    if (!gl) { temp = document.createElement('canvas'); gl = temp.getContext('webgl2') || temp.getContext('webgl'); }
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = (ext && gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || gpu;
      if (temp) gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch { /* stays "nicht auslesbar" */ }
  return gpu;
}

function cesiumInfo(now) {
  const v = window.welt?.viewer;
  if (!v?.scene) return null;
  const sc = v.scene;
  if (!cesiumHooked) { sc.postRender.addEventListener(() => cesiumFrames.push(performance.now())); cesiumHooked = true; }
  while (cesiumFrames.length && now - cesiumFrames[0] > 1000) cesiumFrames.shift();
  let tiles = null;
  for (let i = 0; i < sc.primitives.length; i++) {
    const p = sc.primitives.get(i);
    if (p && 'tilesLoaded' in p) { tiles = p; break; }
  }
  const c = sc.canvas;
  return {
    size: `${c.width}×${c.height}`,
    scale: v.resolutionScale,
    mode: sc.requestRenderMode ? 'nur bei Bedarf' : 'durchgehend',
    perSec: cesiumFrames.length,
    shadows: v.shadows ? 'an' : 'aus',
    msaa: sc.msaaSamples ?? '?',
    tiles: tiles ? (tiles.tilesLoaded ? 'geladen' : 'lädt') : '–',
  };
}

const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '–');
const f0 = (x) => (Number.isFinite(x) ? Math.round(x).toString() : '–');
const mmss = (ms) => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

function render() {
  const now = performance.now();
  const st = stats();
  const dpr = window.devicePixelRatio || 1;
  const game = document.getElementById('screen');
  const lines = [];
  lines.push(`FPS ${String(secFrames.length).padStart(3)}   Ø ${st ? f1(st.avg) : '–'}   1%-Low ${st ? f0(st.low1) : '–'}`);
  lines.push(`Bild ${st ? f1(st.p50) : '–'} ms (Median)  99% ${st ? f1(st.p99) : '–'} ms  max ${st ? f0(st.max) : '–'} ms`);
  lines.push(`Ruckler ${st ? (st.longShare * 100).toFixed(1) : '–'} %   Hänger >100 ms: ${st ? st.hitch : 0}   Takt ~${st ? st.hz : '?'} Hz`);
  lines.push(`Messzeit ${mmss(total)}   Bilder ${n}${pauses ? `   Pausen ${pauses}` : ''}`);
  if (!details) { text.textContent = lines.join('\n'); return; }
  lines.push(`Bildschirm ${screen.width}×${screen.height}  Fenster ${innerWidth}×${innerHeight}  DPR ${+dpr.toFixed(2)}`);
  if (game) lines.push(`Spiel-Canvas ${game.width}×${game.height}${game.style.display === 'none' ? ' (verborgen)' : ''}`);
  const ce = cesiumInfo(now);
  if (ce) {
    lines.push(`3D ${ce.size}  Faktor ${ce.scale}  MSAA ${ce.msaa}  Schatten ${ce.shadows}`);
    lines.push(`3D zeichnet ${ce.mode}: ${ce.perSec}/s   Kacheln ${ce.tiles}`);
  } else if (location.pathname.endsWith('welt.html')) lines.push('3D noch nicht gestartet');
  lines.push(`GPU ${gpuName()}`);
  const scene = window.app?.top?.constructor?.name;
  const surf = document.getElementById('surface')?.textContent;
  if (scene || surf) lines.push(`${scene ? `Szene ${scene}` : ''}${surf ? `  Platz: ${surf}` : ''}`);
  text.textContent = lines.join('\n');
}
setInterval(render, 1000);
render();
