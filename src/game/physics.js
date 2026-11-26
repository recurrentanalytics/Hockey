// Circle collisions for the puck. Bodies have { pos, vel, radius }.

function bounce(b, nx, ny, e) {
  const vn = b.vel.x * nx + b.vel.y * ny;
  if (vn < 0) {
    b.vel.x -= (1 + e) * vn * nx;
    b.vel.y -= (1 + e) * vn * ny;
    return -vn;
  }
  return 0;
}

/** Circle vs line segment. Returns the impact speed (0 if no contact). */
export function hitSegment(b, ax, ay, bx, by, e) {
  const abx = bx - ax, aby = by - ay;
  const t = Math.max(0, Math.min(1, ((b.pos.x - ax) * abx + (b.pos.y - ay) * aby) / (abx * abx + aby * aby || 1)));
  const qx = ax + abx * t, qy = ay + aby * t;
  let dx = b.pos.x - qx, dy = b.pos.y - qy;
  let d = Math.hypot(dx, dy);
  if (d >= b.radius) return 0;
  if (d < 1e-6) { dx = -aby; dy = abx; d = Math.hypot(dx, dy); }
  const nx = dx / d, ny = dy / d;
  b.pos.x = qx + nx * b.radius;
  b.pos.y = qy + ny * b.radius;
  return bounce(b, nx, ny, e) || 1e-3;
}

/** Circle vs fixed circle (post, skater body). `ov` = obstacle velocity. */
export function hitCircle(b, cx, cy, r, e, ov = null) {
  const dx = b.pos.x - cx, dy = b.pos.y - cy;
  const min = b.radius + r, d = Math.hypot(dx, dy);
  if (d >= min || d < 1e-6) return 0;
  const nx = dx / d, ny = dy / d;
  b.pos.x = cx + nx * min;
  b.pos.y = cy + ny * min;
  if (ov) {
    b.vel.x -= ov.x; b.vel.y -= ov.y;
    const s = bounce(b, nx, ny, e);
    b.vel.x += ov.x; b.vel.y += ov.y;
    return s || 1e-3;
  }
  return bounce(b, nx, ny, e) || 1e-3;
}

/** Keep a circle inside the rounded-rectangle boards. */
export function hitBoards(b, core, e) {
  const cx = Math.max(-core.halfX, Math.min(core.halfX, b.pos.x));
  const cy = Math.max(-core.halfY, Math.min(core.halfY, b.pos.y));
  const dx = b.pos.x - cx, dy = b.pos.y - cy;
  const d = Math.hypot(dx, dy);
  const limit = core.radius - b.radius;
  if (d <= limit) return 0;
  const nx = dx / d, ny = dy / d;
  b.pos.x = cx + nx * limit;
  b.pos.y = cy + ny * limit;
  return bounce(b, -nx, -ny, e) || 1e-3;
}
