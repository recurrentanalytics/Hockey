// The Boni court (Bonifatiusplatz, Hannover-List) as a Ligne-claire scene, drawn in the
// game's own oblique projection so the scene lines up with the simulation.
//   world metres → scene pixels:  x * 16 * S,  y * 8 * S,  z * 14 * S   (S = scene scale)
import { STYLE } from './bible.js';
import { RINK, GOAL } from '../config.js';

const PAL = STYLE.palette;
const INK = STYLE.line.ink;

export function sceneSize(S = 2) {
  return { w: Math.round(RINK.length * 16 * S + 120 * S), h: Math.round(500 * S) };
}

/** Smooth closed curve through points. */
function smooth(path, pts) {
  const n = pts.length;
  path.moveTo((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
  for (let i = 1; i <= n; i++) { const a = pts[i % n], b = pts[(i + 1) % n]; path.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
  path.closePath();
}

/** Seeded random numbers, so the scene is identical on every build. */
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function drawCourtScene(ctx, { S = 2, seed = 61 } = {}) {
  const { w, h } = sceneSize(S);
  const R = rng(seed);
  const ox = w / 2, oy = h * 0.66;                      // rink centre on the canvas
  const px = (x, y, z = 0) => ({ x: ox + x * 16 * S, y: oy + y * 8 * S - z * 14 * S });
  const lw = STYLE.line.width * S * 1.6;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const fillStroke = (path, fill) => { ctx.fillStyle = fill; ctx.fill(path); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke(path); };
  const rect = (x, y, ww, hh, fill) => { const p = new Path2D(); p.rect(x, y, ww, hh); fillStroke(p, fill); return p; };

  // ---- sky
  ctx.fillStyle = PAL.sky; ctx.fillRect(0, 0, w, h);

  // ---- the school across the street: white Gründerzeit facade, red tiled roof, dormers
  const farY = px(0, -RINK.width / 2).y;              // far board line
  const baseY = farY - 46 * S;                         // street level behind the fence
  const bx0 = 40 * S, bx1 = w - 40 * S, roofY = baseY - 210 * S, eaves = baseY - 150 * S;
  const roof = new Path2D(); roof.moveTo(bx0 - 10 * S, eaves); roof.lineTo(bx0 + 70 * S, roofY); roof.lineTo(bx1 - 70 * S, roofY); roof.lineTo(bx1 + 10 * S, eaves); roof.closePath();
  fillStroke(roof, PAL.roof);
  ctx.strokeStyle = PAL.roofDark; ctx.lineWidth = S * 0.8;
  for (let y = roofY + 9 * S; y < eaves; y += 9 * S) { ctx.beginPath(); ctx.moveTo(bx0, y); ctx.lineTo(bx1, y); ctx.stroke(); }
  for (let x = bx0 + 120 * S; x < bx1 - 100 * S; x += 230 * S) {
    // semicircular dormer windows
    const d = new Path2D(); d.moveTo(x - 20 * S, roofY + 46 * S); d.arc(x, roofY + 46 * S, 20 * S, Math.PI, 0); d.closePath(); fillStroke(d, PAL.wall);
    const g = new Path2D(); g.moveTo(x - 13 * S, roofY + 46 * S); g.arc(x, roofY + 46 * S, 13 * S, Math.PI, 0); g.closePath(); fillStroke(g, PAL.window);
  }
  rect(bx0, eaves, bx1 - bx0, baseY - eaves, PAL.wall);
  ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(bx0, eaves + 12 * S); ctx.lineTo(bx1, eaves + 12 * S); ctx.stroke(); // cornice
  for (let x = bx0 + 24 * S; x < bx1 - 40 * S; x += 58 * S) {
    for (const y of [eaves + 26 * S, eaves + 82 * S]) {
      rect(x, y, 30 * S, 40 * S, PAL.window);
      ctx.strokeStyle = PAL.wall; ctx.lineWidth = 2 * S;
      ctx.beginPath(); ctx.moveTo(x + 15 * S, y + 1 * S); ctx.lineTo(x + 15 * S, y + 39 * S); ctx.moveTo(x + 1 * S, y + 14 * S); ctx.lineTo(x + 29 * S, y + 14 * S); ctx.stroke();
      ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.strokeRect(x, y, 30 * S, 40 * S);
    }
  }

  // ---- street with parked cars
  rect(0, baseY - 6 * S, w, 30 * S, '#9a9b98');
  for (let x = 30 * S; x < w - 60 * S; x += (110 + R() * 70) * S) {
    const c = R() < 0.3 ? PAL.car : R() < 0.5 ? PAL.carGrey : '#3f4a5c';
    const body = new Path2D(); body.roundRect(x, baseY - 8 * S, 78 * S, 20 * S, 6 * S); fillStroke(body, c);
    const cab = new Path2D(); cab.roundRect(x + 16 * S, baseY - 22 * S, 42 * S, 16 * S, 6 * S); fillStroke(cab, c);
    const win = new Path2D(); win.roundRect(x + 21 * S, baseY - 19 * S, 32 * S, 10 * S, 3 * S); fillStroke(win, PAL.window);
    for (const wx of [x + 16 * S, x + 62 * S]) { const wh = new Path2D(); wh.arc(wx, baseY + 12 * S, 7 * S, 0, Math.PI * 2); fillStroke(wh, '#2a2a2e'); }
  }

  // ---- linden trees: trunks and clean, outlined leaf clusters
  const tree = (x, gy, size) => {
    const t = new Path2D(); t.moveTo(x - 9 * S, gy); t.lineTo(x - 5 * S, gy - size * 0.9); t.lineTo(x + 5 * S, gy - size * 0.9); t.lineTo(x + 9 * S, gy); t.closePath(); fillStroke(t, PAL.trunk);
    const clusters = [];
    for (let i = 0; i < 9; i++) clusters.push({ x: x + (R() - 0.5) * size * 1.3, y: gy - size * (0.95 + R() * 0.75), r: size * (0.26 + R() * 0.2) });
    clusters.sort((a, b) => a.y - b.y);
    for (const c of clusters) {
      // scalloped crown: a ring of small arcs reads as foliage with one clean line
      const p = new Path2D();
      const n = 11;
      const pts = [];
      for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; pts.push({ x: c.x + Math.cos(a) * c.r, y: c.y + Math.sin(a) * c.r * 0.8 }); }
      p.moveTo(pts[0].x, pts[0].y);
      for (let k = 0; k < n; k++) {
        const a = pts[k], b = pts[(k + 1) % n];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const ox = mx - c.x, oy = my - c.y, l = Math.hypot(ox, oy) || 1;
        const bulge = c.r * (0.22 + R() * 0.12);
        p.quadraticCurveTo(mx + (ox / l) * bulge, my + (oy / l) * bulge, b.x, b.y);
      }
      p.closePath();
      fillStroke(p, c.y < gy - size * 1.3 ? PAL.leaf : PAL.leafDark);
      // a few leaf-vein ticks for detail
      ctx.strokeStyle = PAL.leafDark; ctx.lineWidth = lw * 0.6;
      for (let k = 0; k < 3; k++) { const a = R() * Math.PI * 2, rr = c.r * 0.5 * R(); const q = { x: c.x + Math.cos(a) * rr, y: c.y + Math.sin(a) * rr * 0.8 }; ctx.beginPath(); ctx.arc(q.x, q.y, c.r * 0.18, Math.PI * 1.1, Math.PI * 1.7); ctx.stroke(); }
    }
  };
  for (let x = 60 * S; x < w; x += (170 + R() * 90) * S) tree(x, farY - 20 * S, (110 + R() * 50) * S);

  // ---- the tall bar-mesh fence with a built-in steel football goal
  const fTop = farY - 150 * S, fBot = farY - 10 * S;
  ctx.strokeStyle = PAL.fence; ctx.lineWidth = 1.1 * S;
  for (let x = 0; x < w; x += 7 * S) { ctx.beginPath(); ctx.moveTo(x, fTop); ctx.lineTo(x, fBot); ctx.stroke(); }
  for (let y = fTop; y < fBot; y += 16 * S) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
  for (let x = 0; x < w; x += 125 * S) rect(x, fTop - 4 * S, 5 * S, fBot - fTop + 4 * S, PAL.fence);
  const gx = w * 0.27;
  ctx.strokeStyle = INK; ctx.lineWidth = lw;
  const goalFrame = new Path2D(); goalFrame.rect(gx, fBot - 88 * S, 200 * S, 88 * S);
  ctx.strokeStyle = '#7c847e'; ctx.lineWidth = 6 * S; ctx.stroke(goalFrame); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.stroke(goalFrame);

  // ---- court floor: asphalt inside the mobile boards
  const HL = RINK.length / 2, HW = RINK.width / 2, CR = RINK.cornerRadius;
  const rinkPath = (inset = 0) => {
    const p = new Path2D();
    const a = px(-HL + inset, -HW + inset), b = px(HL - inset, HW - inset);
    p.roundRect(a.x, a.y, b.x - a.x, b.y - a.y, [ (CR - inset) * 16 * S ]);
    return p;
  };
  // the ground around the boards (asphalt outside, worn)
  ctx.fillStyle = PAL.asphalt; ctx.fillRect(0, fBot, w, h - fBot);
  fillStroke(rinkPath(), PAL.asphalt);
  // flat leaf shadows on the court (Ligne claire: flat darker shapes, no blur)
  ctx.save(); ctx.clip(rinkPath());
  ctx.fillStyle = '#5d6064';
  for (let i = 0; i < 40; i++) {
    const c = px((R() - 0.5) * 2 * HL, (R() - 0.5) * 2 * HW);
    const rr = (18 + R() * 40) * S;
    const pts = [];
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; const f = 0.75 + R() * 0.35; pts.push({ x: c.x + Math.cos(a) * rr * f, y: c.y + Math.sin(a) * rr * 0.42 * f }); }
    const p = new Path2D(); smooth(p, pts); ctx.fill(p);
  }
  // grit specks and a few cracks
  for (let i = 0; i < 1600; i++) { const c = px((R() - 0.5) * 2 * HL, (R() - 0.5) * 2 * HW); ctx.fillStyle = R() < 0.5 ? PAL.asphaltLight : '#55585c'; ctx.fillRect(c.x, c.y, 1.2 * S, 1.2 * S); }
  ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.7;
  for (let i = 0; i < 5; i++) {
    let c = px((R() - 0.5) * 1.6 * HL, (R() - 0.5) * 1.6 * HW);
    ctx.beginPath(); ctx.moveTo(c.x, c.y);
    for (let k = 0; k < 5; k++) { c = { x: c.x + (R() - 0.3) * 30 * S, y: c.y + (R() - 0.5) * 10 * S }; ctx.lineTo(c.x, c.y); }
    ctx.stroke();
  }
  // painted lines: centre line, face-off circles and spots, goal lines, creases
  const paint = (p, color = PAL.line, width = 2.2 * S) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(p); };
  const ell = (x, y, r) => { const c = px(x, y); const p = new Path2D(); p.ellipse(c.x, c.y, r * 16 * S, r * 8 * S, 0, 0, Math.PI * 2); return p; };
  const line = (x0, y0, x1, y1) => { const a = px(x0, y0), b = px(x1, y1); const p = new Path2D(); p.moveTo(a.x, a.y); p.lineTo(b.x, b.y); return p; };
  paint(line(0, -HW, 0, HW), '#d8303c', 3 * S);
  paint(ell(0, 0, RINK.centerCircleRadius), PAL.line);
  for (const sx of [-1, 1]) {
    paint(line(sx * RINK.goalLineX, -HW + 2, sx * RINK.goalLineX, HW - 2), '#d8303c', 2 * S);
    for (const sy of [-1, 1]) {
      paint(ell(sx * RINK.endCircle.x, sy * RINK.endCircle.y, RINK.endCircle.r));
      const d = px(sx * RINK.endCircle.x, sy * RINK.endCircle.y); ctx.fillStyle = '#d8303c'; ctx.beginPath(); ctx.ellipse(d.x, d.y, 5 * S, 2.5 * S, 0, 0, Math.PI * 2); ctx.fill();
    }
    const c = px(sx * RINK.goalLineX, 0);
    const cr = new Path2D(); cr.ellipse(c.x, c.y, RINK.creaseRadius * 16 * S, RINK.creaseRadius * 8 * S, 0, sx > 0 ? Math.PI / 2 : -Math.PI / 2, sx > 0 ? Math.PI * 1.5 : Math.PI / 2); cr.closePath();
    ctx.fillStyle = '#a8cde0'; ctx.fill(cr); paint(cr, PAL.line, 1.6 * S);
  }
  ctx.restore();

  // ---- mobile boards: far side (seen from the inside) and ends
  const boardH = RINK.boardHeight;
  const boardRing = (side) => {
    // a band from floor to board top along the far (side=-1) or near (side=+1) half of the oval
    const p = new Path2D();
    const steps = 80;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = -HL + t * 2 * HL;
      const ax = Math.abs(x);
      let y = HW;
      if (ax > HL - CR) { const dx = ax - (HL - CR); y = HW - CR + Math.sqrt(Math.max(0, CR * CR - dx * dx)); }
      pts.push({ x, y: side * y });
    }
    pts.forEach((q, i) => { const a = px(q.x, q.y, 0); i ? p.lineTo(a.x, a.y) : p.moveTo(a.x, a.y); });
    for (let i = pts.length - 1; i >= 0; i--) { const a = px(pts[i].x, pts[i].y, boardH); p.lineTo(a.x, a.y); }
    p.closePath();
    return { p, pts };
  };
  const far = boardRing(-1);
  fillStroke(far.p, PAL.board);
  // green top rail, panel joints and club panels on the far boards
  ctx.save(); ctx.clip(far.p);
  ctx.strokeStyle = PAL.boardTrim; ctx.lineWidth = 5 * S;
  ctx.beginPath(); far.pts.forEach((q, i) => { const a = px(q.x, q.y, boardH); i ? ctx.lineTo(a.x, a.y) : ctx.moveTo(a.x, a.y); }); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.7;
  for (let x = -HL + 2; x < HL; x += 2) {
    const ax = Math.abs(x); let y = HW; if (ax > HL - CR) { const dx = ax - (HL - CR); y = HW - CR + Math.sqrt(Math.max(0, CR * CR - dx * dx)); }
    const a = px(x, -y, 0), b = px(x, -y, boardH); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const x of [-14, 14]) {
    // club panels: BONI BORSTENTIERE
    const a = px(x - 5, -HW, boardH * 0.78), b = px(x + 5, -HW, boardH * 0.12);
    const pan = new Path2D(); pan.rect(a.x, a.y, b.x - a.x, b.y - a.y); fillStroke(pan, PAL.jersey);
    ctx.fillStyle = PAL.cream; ctx.font = `900 ${10 * S}px "Arial Black", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('BONI BORSTENTIERE', (a.x + b.x) / 2, (a.y + b.y) / 2);
  }
  ctx.restore();

  // ---- end boards (seen edge-on at both short ends)
  for (const sx of [-1, 1]) {
    const yy = HW - CR;
    const a = px(sx * HL, -yy, 0), b = px(sx * HL, yy, 0), c = px(sx * HL, yy, boardH), d = px(sx * HL, -yy, boardH);
    const t = 6 * S;   // board thickness on screen
    const p = new Path2D();
    p.moveTo(d.x - sx * t, d.y); p.lineTo(d.x, d.y); p.lineTo(b.x, b.y); p.lineTo(b.x - sx * t, b.y); p.closePath();
    fillStroke(p, PAL.board);
    ctx.strokeStyle = PAL.boardTrim; ctx.lineWidth = 4 * S;
    ctx.beginPath(); ctx.moveTo(d.x - sx * t / 2, d.y); ctx.lineTo(c.x - sx * t / 2, c.y); ctx.stroke();
    void a;
  }

  // ---- red Bauer goals with white nets
  for (const sx of [-1, 1]) {
    // drawn a little larger than life so the goal reads at game size
    const k = 1.35;
    const gx0 = sx * RINK.goalLineX, gx1 = gx0 + sx * GOAL.depth * k, hw = (GOAL.width / 2) * k, gh = GOAL.height * k;
    const P = (x, y, z) => px(x, y, z);
    const quad = (pts) => { const p = new Path2D(); pts.forEach((q, i) => (i ? p.lineTo(q.x, q.y) : p.moveTo(q.x, q.y))); p.closePath(); return p; };
    const mesh = (p) => {
      ctx.save(); ctx.clip(p);
      ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill(p);
      ctx.strokeStyle = PAL.net; ctx.lineWidth = 0.9 * S;
      const b = p.bounds ?? null; void b;
      for (let i = -60; i < 60; i++) { const o = P(gx0, 0, 0); ctx.beginPath(); ctx.moveTo(o.x - 80 * S + i * 5 * S, o.y - 80 * S); ctx.lineTo(o.x + i * 5 * S, o.y + 20 * S); ctx.stroke(); ctx.beginPath(); ctx.moveTo(o.x + 80 * S + i * 5 * S, o.y - 80 * S); ctx.lineTo(o.x + i * 5 * S, o.y + 20 * S); ctx.stroke(); }
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.8; ctx.stroke(p);
    };
    // back, far side and top of the net
    mesh(quad([P(gx1, -hw, 0), P(gx1, -hw, gh * 0.7), P(gx1, hw, gh * 0.7), P(gx1, hw, 0)]));
    mesh(quad([P(gx0, -hw, 0), P(gx0, -hw, gh), P(gx1, -hw, gh * 0.7), P(gx1, -hw, 0)]));
    mesh(quad([P(gx0, -hw, gh), P(gx0, hw, gh), P(gx1, hw, gh * 0.7), P(gx1, -hw, gh * 0.7)]));
    const frame = (pts) => { ctx.strokeStyle = INK; ctx.lineWidth = 6.4 * S; ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke(); ctx.strokeStyle = PAL.goalRed; ctx.lineWidth = 3.8 * S; ctx.stroke(); };
    frame([P(gx0, -hw, 0), P(gx1, -hw, 0), P(gx1, hw, 0), P(gx0, hw, 0)]);
    frame([P(gx0, -hw, 0), P(gx0, -hw, gh), P(gx0, hw, gh), P(gx0, hw, 0)]);
    // near side net in front
    mesh(quad([P(gx0, hw, 0), P(gx0, hw, gh), P(gx1, hw, gh * 0.7), P(gx1, hw, 0)]));
    frame([P(gx0, hw, 0), P(gx0, hw, gh)]);
  }

  // ---- near boards (foreground), with a club panel in the middle
  const near = boardRing(1);
  fillStroke(near.p, PAL.board);
  ctx.save(); ctx.clip(near.p);
  ctx.strokeStyle = PAL.boardTrim; ctx.lineWidth = 5 * S;
  ctx.beginPath(); near.pts.forEach((q, i) => { const a = px(q.x, q.y, boardH); i ? ctx.lineTo(a.x, a.y) : ctx.moveTo(a.x, a.y); }); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.7;
  for (let x = -HL + 2; x < HL; x += 2) {
    const ax = Math.abs(x); let y = HW; if (ax > HL - CR) { const dx = ax - (HL - CR); y = HW - CR + Math.sqrt(Math.max(0, CR * CR - dx * dx)); }
    const a = px(x, y, 0), b = px(x, y, boardH); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  const a = px(-6, HW, boardH * 0.78), b = px(6, HW, boardH * 0.12);
  const pan = new Path2D(); pan.rect(a.x, a.y, b.x - a.x, b.y - a.y); fillStroke(pan, PAL.orange);
  ctx.fillStyle = PAL.cream; ctx.font = `900 ${11 * S}px "Arial Black", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('LOS BORSTENTIERE!', (a.x + b.x) / 2, (a.y + b.y) / 2);
  ctx.restore();
  return { origin: { x: ox, y: oy }, scale: S, px };
}
