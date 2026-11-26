// Ink toolkit for the comic look: parts are vector shapes drawn in two passes.
//   1. silhouette: every part stroked with a thick ink line → a strong outer contour
//   2. parts back to front: thin ink line, flat colour, one hard shadow tone, details
// Units are "figure units" (≈ old sprite pixels); the caller scales the context.

import { STYLE } from '../../art/bible.js';

export const INK = STYLE.line.ink;

/** A filled shape. shadeDir: offset of the lit area (light from the upper left). */
export function shape(build, fill, { shade = null, shadeOffset = 1.6, lw = 0.6, details = null, noOutline = false } = {}) {
  const path = new Path2D();
  build(path);
  return { kind: 'shape', path, build, fill, shade, shadeOffset, lw, details, noOutline };
}

/** A limb: a thick stroke along points (rubbery tube). */
export function tube(points, width, fill, { shade = null, lw = 0.6, details = null } = {}) {
  return { kind: 'tube', points, width, fill, shade, lw, details };
}

/** Free drawing step (no silhouette), e.g. eyes, numbers, stripes on top of earlier parts. */
export function draw(fn) {
  return { kind: 'draw', fn };
}

function tubePath(points) {
  const p = new Path2D();
  p.moveTo(points[0].x, points[0].y);
  if (points.length === 3) {
    // pass through the middle point with a soft rubber-hose bend
    const [a, b, c] = points;
    const cx = 2 * b.x - (a.x + c.x) / 2, cy = 2 * b.y - (a.y + c.y) / 2;
    p.quadraticCurveTo(cx, cy, c.x, c.y);
  } else {
    for (let i = 1; i < points.length; i++) p.lineTo(points[i].x, points[i].y);
  }
  return p;
}

/** Render a list of parts. outer: silhouette line width (figure units). */
export function render(ctx, parts, { outer = 1.3, uniform = null, flat = false } = {}) {
  // Ligne claire: one line weight everywhere and flat colour (no cel shadows).
  if (uniform != null) outer = uniform / 2;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // 1. silhouette
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  for (const p of parts) {
    if (p.kind === 'shape' && !p.noOutline) {
      ctx.lineWidth = outer * 2;
      ctx.stroke(p.path);
      ctx.fill(p.path);
    } else if (p.kind === 'tube') {
      ctx.lineWidth = p.width + outer * 2;
      ctx.stroke(p.tp ??= tubePath(p.points));
    }
  }
  // 2. parts
  for (const p of parts) {
    if (p.kind === 'draw') { ctx.save(); p.fn(ctx); ctx.restore(); continue; }
    if (p.kind === 'shape') {
      if (!p.noOutline) {
        ctx.strokeStyle = INK;
        ctx.lineWidth = uniform ?? p.lw * 2;
        ctx.stroke(p.path);
      }
      ctx.fillStyle = p.fill;
      ctx.fill(p.path);
      if (p.shade && !flat) {
        // hard cel shadow: shade everything, then the lit copy shifted up-left
        ctx.save();
        ctx.clip(p.path);
        ctx.fillStyle = p.shade;
        ctx.fill(p.path);
        ctx.translate(-p.shadeOffset, -p.shadeOffset);
        ctx.fillStyle = p.fill;
        ctx.fill(p.path);
        ctx.restore();
      }
      if (p.details) { ctx.save(); ctx.clip(p.path); p.details(ctx); ctx.restore(); }
    } else if (p.kind === 'tube') {
      const tp = p.tp ??= tubePath(p.points);
      ctx.strokeStyle = INK;
      ctx.lineWidth = p.width + (uniform ?? p.lw * 2);
      ctx.stroke(tp);
      ctx.strokeStyle = p.fill;
      ctx.lineWidth = p.width;
      ctx.stroke(tp);
      if (p.shade && !flat) {
        // shadow line along the lower right inside of the tube
        ctx.save();
        ctx.translate(p.width * 0.22, p.width * 0.26);
        ctx.strokeStyle = p.shade;
        ctx.lineWidth = p.width * 0.42;
        ctx.stroke(tp);
        ctx.restore();
      }
      if (p.details) { ctx.save(); p.details(ctx); ctx.restore(); }
    }
  }
  ctx.restore();
}

// ------------------------------------------------------------------ small helpers

export const P = (x, y) => ({ x, y });
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

export function ellipse(path, cx, cy, rx, ry, rot = 0) {
  path.ellipse(cx, cy, rx, ry, rot, 0, Math.PI * 2);
}

export function poly(path, pts, close = true) {
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
  if (close) path.closePath();
}

/** Smooth closed blob through points (Catmull-Rom → Bézier). */
export function blob(path, pts) {
  const n = pts.length;
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    path.bezierCurveTo(p1.x + (p2.x - p0.x) / 6, p1.y + (p2.y - p0.y) / 6, p2.x - (p3.x - p1.x) / 6, p2.y - (p3.y - p1.y) / 6, p2.x, p2.y);
  }
  path.closePath();
}

/** Two-bone IK: the middle joint for a limb from a to c, bending to side `bend` (+1/−1). */
export function ik(a, c, l1, l2, bend) {
  let dx = c.x - a.x, dy = c.y - a.y;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.01;
  if (d > max) { c = { x: a.x + (dx / d) * max, y: a.y + (dy / d) * max }; dx = c.x - a.x; dy = c.y - a.y; d = max; }
  d = Math.max(d, Math.abs(l1 - l2) + 0.01);
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const ang = Math.atan2(dy, dx) - bend * Math.acos(Math.max(-1, Math.min(1, cos)));
  return { j: { x: a.x + Math.cos(ang) * l1, y: a.y + Math.sin(ang) * l1 }, end: c };
}

/** Comic lettering: bold outlined text (used for numbers and sound words). */
export function letter(ctx, text, x, y, size, { fill = '#f3e3b5', ink = INK, outline = 0.9, align = 'center', rot = 0, font = 'Bangers, "Arial Black", Impact, sans-serif' } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.font = `900 ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ink;
  ctx.lineWidth = outline * 2;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = fill;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}
