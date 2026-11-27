// Quick test page (test.html): the real Boni court rules (23 × 17 m, 3 on 3, real goals, same
// physics as intro.html) without the 3D backdrop. A plain 2D drawing of the court from the same
// camera angle replaces it, so the game starts at once.
const back = document.getElementById('flat');
const bctx = back.getContext('2d');
let view = { s: 20, cx: 0, cy: 0 };
const FENCE = { a: 12.6, b: 9.0 };

/** Metres (x along the court, y towards the camera, z up) → CSS px, like the 3D camera (2:1 view). */
const toCss = (x, y, z) => ({ x: view.cx + x * view.s, y: view.cy + y * view.s * 0.5 - z * view.s * 0.87 });

function layout() {
  const W = window.innerWidth, H = window.innerHeight;
  view.s = Math.min((W * 0.94) / (2 * FENCE.a), (H * 0.78) / (FENCE.b + 4.5));
  view.cx = W / 2; view.cy = H * 0.56;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  back.width = Math.round(W * dpr); back.height = Math.round(H * dpr);
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  draw(W, H);
}

function draw(W, H) {
  const c = bctx, P = (x, y, z = 0) => toCss(x, y, z);
  const poly = (pts, fill, stroke, lw = 1) => {
    c.beginPath(); pts.forEach(([x, y, z], i) => { const p = P(x, y, z); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }); c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
  };
  const line = (a, b, color, lw = 1.5) => { const p = P(...a), q = P(...b); c.strokeStyle = color; c.lineWidth = lw; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(q.x, q.y); c.stroke(); };
  c.fillStyle = '#2f3a26'; c.fillRect(0, 0, W, H);
  const A = FENCE.a, B = FENCE.b;
  poly([[-A - 3, -B - 3], [A + 3, -B - 3], [A + 3, B + 3], [-A - 3, B + 3]], '#5a4632');           // mulch
  poly([[-A, -B], [A, -B], [A, B], [-A, B]], '#8a8d91');                                            // asphalt
  // markings
  const white = 'rgba(240,240,236,.85)', m = 0.5;
  poly([[-A + m, -B + m], [A - m, -B + m], [A - m, B - m], [-A + m, B - m]], null, white, 1.5);
  line([0, -B + m], [0, B - m], white);
  const ring = (cx, r, a0, a1) => { c.beginPath(); for (let k = 0; k <= 40; k++) { const t = a0 + ((a1 - a0) * k) / 40; const p = P(cx + r * Math.cos(t), r * Math.sin(t)); k ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); } c.strokeStyle = white; c.lineWidth = 1.5; c.stroke(); };
  ring(0, 3, 0, Math.PI * 2);
  ring(-A + m, 6, -Math.PI / 2, Math.PI / 2);
  ring(A - m, 6, Math.PI / 2, Math.PI * 1.5);
  // football goal cages built into the short sides
  for (const s of [-1, 1]) {
    const xf = s * (A - 1.2), xb = s * A;
    for (const y of [-2.5, 2.5]) { line([xf, y, 0], [xf, y, 2], '#b9bcbf', 2); line([xf, y, 2], [xb, y, 2], '#b9bcbf', 1.5); }
    line([xf, -2.5, 2], [xf, 2.5, 2], '#b9bcbf', 2);
  }
  // street-hockey goals
  for (const s of [-1, 1]) {
    const x = s * 9.2, xb = x + s * 0.6, hw = 0.685, h = 1.12;
    poly([[x, -hw, h], [x, hw, h], [xb, hw, 0], [xb, -hw, 0]], 'rgba(255,255,255,.35)', 'rgba(255,255,255,.7)', 1);
    line([x, -hw, 0], [x, -hw, h], '#e8243c', 3); line([x, hw, 0], [x, hw, h], '#e8243c', 3); line([x, -hw, h], [x, hw, h], '#e8243c', 3);
  }
  // fence: far and side panels, the camera side only as posts
  const fence = 'rgba(70,86,74,.55)';
  for (const [p, q] of [[[-A, -B], [A, -B]], [[-A, -B], [-A, B]], [[A, -B], [A, B]]]) poly([[...p, 0], [...q, 0], [...q, 4], [...p, 4]], 'rgba(70,86,74,.18)', fence, 1.2);
  for (let k = 0; k <= 10; k++) { const x = -A + (2 * A * k) / 10; line([x, B, 0], [x, B, 4], 'rgba(70,86,74,.7)', 1.6); }
  line([-A, B, 4], [A, B, 4], 'rgba(70,86,74,.7)', 1.6);
}

window.addEventListener('resize', layout);
layout();
globalThis.BONI_3D = { toCss };
await import('../main.js');
