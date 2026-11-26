// Detailed skaters and goalies with realistic proportions.
//
// Each frame is posed on a small skeleton (hips, knees, ankles, shoulders, elbows, hands),
// drawn with vector shapes at the world layer's full resolution, then snapped to crisp
// pixels and outlined. Facing right; left-facing frames are mirrored.
// Coordinates are sprite pixels relative to the anchor (ground point between the skates),
// with y negative upward.
import { PAL } from '../engine/palette.js';
import { makeCanvas } from '../engine/raster.js';

// ------------------------------------------------------------------ colour helpers

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
/** Mix toward white (k > 0) or toward a deep, slightly purple shadow (k < 0). */
export function tint(hex, k) {
  const [r, g, b] = hexRgb(hex);
  if (k >= 0) return rgbHex([r + (255 - r) * k, g + (255 - g) * k, b + (255 - b) * k]);
  const s = -k, sh = [42, 24, 58];
  return rgbHex([r + (sh[0] - r) * s, g + (sh[1] - g) * s, b + (sh[2] - b) * s]);
}
/** Three tones of one material: light, mid, dark. */
const tones = (hex) => ({ l: tint(hex, 0.28), m: hex, d: tint(hex, -0.38) });

const SKINS = [
  { m: '#f6c9a4', d: '#d89a78', l: '#ffe2c8' },
  { m: '#e0a77f', d: '#b97a57', l: '#f2c3a0' },
  { m: '#a86f4c', d: '#7f4f33', l: '#c58d68' },
];

function palette(team, look) {
  const skinIdx = look.skin ?? 0;
  return {
    jersey: tones(team.main),
    trim: tones(team.trim),
    stripe: tones(team.stripe ?? team.trim),
    helmet: tones(team.helmet),
    pants: tones(team.pants),
    glove: tones(team.shade),
    sock: tones(team.main),
    wheel: tones(team.wheel ?? PAL.yellow),
    boot: { l: '#4a4560', m: '#2c2840', d: '#1a1628' },
    bootTrim: '#e8e4f0',
    frame: { l: '#e6ebf5', m: '#aeb6c8', d: '#7b8296' },
    skin: SKINS[skinIdx % SKINS.length],
    hair: look.hair ?? '#5a3b2e',
    visor: 'rgba(190,235,255,0.85)',
    ink: '#1c1428',
    fur: { l: '#b07a48', m: '#8a5a34', d: '#5e3b20' },
    snout: '#e8b48f',
    tusk: '#fff3dc',
  };
}

// ------------------------------------------------------------------ geometry helpers

const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
const lerpP = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** Two-bone IK: joint between a and c with bone lengths l1, l2, bending toward `bend` (+1/-1). */
function ik(a, c, l1, l2, bend) {
  let dx = c.x - a.x, dy = c.y - a.y;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.01;
  if (d > max) { c = { x: a.x + (dx / d) * max, y: a.y + (dy / d) * max }; dx = c.x - a.x; dy = c.y - a.y; d = max; }
  d = Math.max(d, Math.abs(l1 - l2) + 0.01);
  const cos = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const ang = Math.atan2(dy, dx) - bend * Math.acos(Math.max(-1, Math.min(1, cos)));
  return { j: { x: a.x + Math.cos(ang) * l1, y: a.y + Math.sin(ang) * l1 }, end: c };
}

class Painter {
  constructor(w, h, ax, ay) {
    this.c = makeCanvas(w, h);
    // read back once per frame for the pixel snap: keep it on the CPU
    this.g = this.c.getContext('2d', { willReadFrequently: true });
    this.ax = ax; this.ay = ay;
  }
  P(p) { return [this.ax + p.x, this.ay + p.y]; }

  circle(p, r, color) {
    const g = this.g;
    g.fillStyle = color;
    g.beginPath();
    g.arc(...this.P(p), r, 0, Math.PI * 2);
    g.fill();
  }

  ellipse(p, rx, ry, rot, color) {
    const g = this.g;
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(...this.P(p), rx, ry, rot, 0, Math.PI * 2);
    g.fill();
  }

  poly(points, color) {
    const g = this.g;
    g.fillStyle = color;
    g.beginPath();
    points.forEach((p, i) => (i ? g.lineTo(...this.P(p)) : g.moveTo(...this.P(p))));
    g.closePath();
    g.fill();
  }

  /** Tapered limb from a (radius r1) to b (radius r2). */
  capsule(a, b, r1, r2, color) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d;
    this.poly([
      { x: a.x + nx * r1, y: a.y + ny * r1 }, { x: b.x + nx * r2, y: b.y + ny * r2 },
      { x: b.x - nx * r2, y: b.y - ny * r2 }, { x: a.x - nx * r1, y: a.y - ny * r1 },
    ], color);
    this.circle(a, r1, color);
    this.circle(b, r2, color);
  }

  /** Limb with light from the upper left: dark base, mid body, a light rim. */
  shaded(a, b, r1, r2, t) {
    this.capsule(a, b, r1, r2, t.d);
    const o = { x: -0.5, y: -0.6 };
    this.capsule(add(a, o), add(b, o), r1 * 0.78, r2 * 0.78, t.m);
    const o2 = { x: -0.9, y: -1.1 };
    this.capsule(add(a, o2), add(b, o2), Math.max(0.5, r1 * 0.3), Math.max(0.5, r2 * 0.3), t.l);
  }

  line(a, b, w, color) {
    const g = this.g;
    g.strokeStyle = color;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(...this.P(a));
    g.lineTo(...this.P(b));
    g.stroke();
  }

  px(p, color, w = 1, h = 1) {
    this.g.fillStyle = color;
    this.g.fillRect(Math.round(this.ax + p.x), Math.round(this.ay + p.y), w, h);
  }

  /** Snap to crisp pixels (no half-transparent edges) and draw a dark outline round it. */
  finish(ink) {
    const { c, g } = this;
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data, W = c.width, H = c.height;
    const solid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) {
      const a = d[i * 4 + 3];
      if (a >= 120) { d[i * 4 + 3] = 255; solid[i] = 1; } else d[i * 4 + 3] = 0;
    }
    const [ir, ig, ib] = hexRgb(ink);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (solid[i]) continue;
        const n = (x > 0 && solid[i - 1]) || (x < W - 1 && solid[i + 1]) || (y > 0 && solid[i - W]) || (y < H - 1 && solid[i + W]);
        if (n) { d[i * 4] = ir; d[i * 4 + 1] = ig; d[i * 4 + 2] = ib; d[i * 4 + 3] = 255; }
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  }
}

function mirror(canvas) {
  const m = makeCanvas(canvas.width, canvas.height);
  const g = m.getContext('2d');
  g.translate(canvas.width, 0);
  g.scale(-1, 1);
  g.drawImage(canvas, 0, 0);
  return m;
}

// ------------------------------------------------------------------ skater

export const SK_W = 72, SK_H = 80, SK_AX = 34, SK_AY = 76;
const THIGH = 12, SHIN = 12, UPPER = 8, FORE = 8, TORSO = 15, ANKLE = 5;
const RAISE = 2.5; // poses were authored for a slightly shorter body

/** Inline skate: dark boot with a light tongue and trim, aluminium frame, four wheels. */
function skate(pt, ank, C, far) {
  const dim = far ? 0.18 : 0;
  const ground = { x: ank.x, y: ank.y + ANKLE };
  // frame and wheels
  const wt = { l: tint(C.wheel.l, -dim), m: tint(C.wheel.m, -dim), d: tint(C.wheel.d, -dim) };
  for (let i = 0; i < 4; i++) {
    const w = { x: ground.x - 3.3 + i * 3.1, y: ground.y - 1.6 };
    pt.circle(w, 1.7, wt.d);
    pt.circle({ x: w.x - 0.3, y: w.y - 0.3 }, 1.05, wt.m);
    pt.px({ x: w.x - 0.5, y: w.y - 0.5 }, wt.l);
  }
  pt.poly([{ x: ground.x - 5, y: ground.y - 3.6 }, { x: ground.x + 6.2, y: ground.y - 3.6 }, { x: ground.x + 6.2, y: ground.y - 2.6 }, { x: ground.x - 5, y: ground.y - 2.6 }], C.frame.m);
  // boot
  const b = C.boot;
  pt.poly([
    { x: ank.x - 3, y: ank.y - 3 }, { x: ank.x + 2.4, y: ank.y - 3 }, { x: ank.x + 3, y: ank.y - 0.6 },
    { x: ank.x + 6.6, y: ank.y + 0.4 }, { x: ank.x + 6.8, y: ank.y + 1.6 }, { x: ank.x - 4.2, y: ank.y + 1.6 }, { x: ank.x - 4, y: ank.y - 2 },
  ], far ? b.d : b.m);
  pt.poly([{ x: ank.x - 2.6, y: ank.y - 2.9 }, { x: ank.x + 0.2, y: ank.y - 2.9 }, { x: ank.x - 0.4, y: ank.y + 0.8 }, { x: ank.x - 3, y: ank.y + 0.8 }], far ? b.m : b.l);
  pt.line({ x: ank.x - 4, y: ank.y + 1.2 }, { x: ank.x + 6.4, y: ank.y + 1.2 }, 0.9, far ? tint(C.bootTrim, -0.3) : C.bootTrim);
  pt.line({ x: ank.x + 1.2, y: ank.y - 2.4 }, { x: ank.x + 4, y: ank.y - 0.2 }, 0.7, far ? tint(C.bootTrim, -0.4) : tint(C.bootTrim, -0.15));
}

/** One leg: thigh in the pants, knee, sock with stripes over the shin pad, then the skate. */
function leg(pt, hip, foot, C, far) {
  const ank = { x: foot.x, y: foot.y - ANKLE };
  const { j: knee, end } = ik(hip, ank, THIGH, SHIN, 1);
  const k = far ? -0.22 : 0;
  const sock = { l: tint(C.sock.l, k), m: tint(C.sock.m, k), d: tint(C.sock.d, k) };
  pt.shaded(knee, end, 2.5, 1.9, sock);
  // sock stripes
  for (const t of [0.3, 0.46]) {
    const a = lerpP(knee, end, t), b = lerpP(knee, end, t + 0.06);
    pt.capsule(a, b, 2.1, 2.0, far ? tint(C.stripe.m, -0.3) : C.stripe.m);
  }
  skate(pt, end, C, far);
  // hockey socks run up over the knee to mid-thigh; the short, bulky pants sit above them
  pt.shaded(lerpP(hip, knee, 0.45), knee, 2.8, 2.5, sock);
  const pants = { l: tint(C.pants.l, k), m: tint(C.pants.m, k), d: tint(C.pants.d, k) };
  pt.shaded(hip, lerpP(hip, knee, 0.58), 4.2, 3.7, pants);
  // knee bump
  pt.circle({ x: knee.x + 0.5, y: knee.y + 0.3 }, 2.3, far ? tint(C.sock.d, -0.1) : C.sock.d);
  pt.circle({ x: knee.x + 0.2, y: knee.y }, 1.5, far ? sock.d : sock.m);
  return { knee, ankle: end };
}

/** Arm from the shoulder to a hand target; returns the hand. */
function arm(pt, sh, hand, C, far) {
  const { j: elbow, end } = ik(sh, hand, UPPER, FORE, 1);
  const k = far ? -0.25 : 0;
  const sl = { l: tint(C.jersey.l, k), m: tint(C.jersey.m, k), d: tint(C.jersey.d, k) };
  pt.shaded(sh, elbow, 2.4, 2.0, sl);
  pt.shaded(elbow, lerpP(elbow, end, 0.7), 2.0, 1.8, sl);
  // sleeve stripe near the elbow
  pt.capsule(lerpP(sh, elbow, 0.72), lerpP(sh, elbow, 0.92), 2.2, 2.1, far ? tint(C.stripe.m, -0.3) : C.stripe.m);
  // glove: padded cuff and fist
  const gl = { l: tint(C.glove.l, k), m: tint(C.glove.m, k), d: tint(C.glove.d, k) };
  pt.circle(lerpP(elbow, end, 0.8), 2.0, far ? tint(C.trim.m, -0.3) : C.trim.m);
  pt.circle(end, 2.2, gl.d);
  pt.circle({ x: end.x - 0.4, y: end.y - 0.4 }, 1.5, gl.m);
  pt.px({ x: end.x - 1, y: end.y - 1.5 }, gl.l);
  return { elbow, hand: end };
}

/** Helmet, face and mood. Facing right, slightly toward the camera. */
function head(pt, hc, C, mood, look, tilt) {
  const r = 5.6;
  if (look.kind === 'boar') return boarHead(pt, hc, C, mood);
  // neck
  pt.capsule({ x: hc.x - 1, y: hc.y + 3 }, { x: hc.x - 1.8, y: hc.y + 6.5 }, 2.2, 2.4, C.skin.d);
  // hair at the back of the neck
  if (look.kind !== 'bald') pt.ellipse({ x: hc.x - 3.6, y: hc.y + 2.6 }, 2.4, 2, 0.3, look.hair ?? C.hair);
  else pt.ellipse({ x: hc.x - 3.8, y: hc.y + 2.2 }, 2.2, 1.6, 0.3, '#c8c2b8');
  // face (lower front part of the head)
  pt.ellipse({ x: hc.x + 1.4, y: hc.y + 1.6 }, 4.2, 4.1, 0, C.skin.m);
  pt.ellipse({ x: hc.x + 0.2, y: hc.y + 2.4 }, 2.4, 3, 0, C.skin.d);   // cheek shadow under the helmet edge
  pt.ellipse({ x: hc.x + 2, y: hc.y + 1.4 }, 3.2, 3.2, 0, C.skin.m);
  // nose
  pt.px({ x: hc.x + 5.2, y: hc.y + 1.4 }, C.skin.m, 1, 2);
  pt.px({ x: hc.x + 4.6, y: hc.y + 3 }, C.skin.d);
  // helmet shell over the top and back
  const H = C.helmet;
  pt.g.save();
  pt.g.beginPath();
  pt.g.arc(...pt.P(hc), r, Math.PI * 0.92 + tilt, Math.PI * 2.08 + tilt);
  pt.g.closePath();
  pt.g.fillStyle = H.d; pt.g.fill();
  pt.g.restore();
  pt.ellipse({ x: hc.x - 0.4, y: hc.y - 1.2 }, r - 0.8, r - 1.8, 0, H.m);
  pt.ellipse({ x: hc.x - 1.6, y: hc.y - 3 }, 2.4, 1.2, -0.3, H.l);
  // back of the helmet comes down over the ear
  pt.ellipse({ x: hc.x - 3, y: hc.y + 0.6 }, 2.8, 3.4, 0, H.m);
  pt.circle({ x: hc.x - 2.6, y: hc.y + 1.4 }, 1, H.d);                   // ear hole
  // brim and visor
  pt.line({ x: hc.x + 1.4, y: hc.y - 1.2 }, { x: hc.x + 6, y: hc.y - 0.6 }, 1.2, H.d);
  pt.line({ x: hc.x + 3.4, y: hc.y + 0.2 }, { x: hc.x + 6.3, y: hc.y + 0.6 }, 1, C.visor);
  // chin strap
  pt.line({ x: hc.x - 1.6, y: hc.y + 2 }, { x: hc.x + 2.6, y: hc.y + 5.2 }, 0.7, H.d);
  if (look.kind === 'bald') {
    // Balding Borstis: grey sideburn and round glasses
    pt.px({ x: hc.x - 0.6, y: hc.y + 0.4 }, '#c8c2b8', 1, 3);
    pt.circle({ x: hc.x + 3.4, y: hc.y + 1.1 }, 1.5, '#3c3550');
    pt.circle({ x: hc.x + 3.4, y: hc.y + 1.1 }, 0.8, 'rgba(220,240,255,0.9)');
  }
  face(pt, hc, C, mood);
}

function face(pt, hc, C, mood) {
  const e = { x: hc.x + 3.2, y: hc.y + 0.6 };
  const ink = C.ink;
  switch (mood) {
    case 'blink': pt.px({ x: e.x - 0.5, y: e.y + 0.5 }, ink, 2, 1); break;
    case 'happy': pt.px({ x: e.x - 0.5, y: e.y + 0.4 }, ink, 1, 1); pt.px({ x: e.x + 0.5, y: e.y - 0.4 }, ink); pt.px({ x: e.x + 1.5, y: e.y + 0.4 }, ink); break;
    case 'effort': pt.px({ x: e.x - 0.5, y: e.y }, ink, 2, 1); pt.px({ x: e.x - 1, y: e.y - 1 }, ink, 2, 1); break;
    case 'dizzy': pt.px({ x: e.x - 0.5, y: e.y - 0.5 }, ink); pt.px({ x: e.x + 0.5, y: e.y + 0.5 }, ink); pt.px({ x: e.x + 0.5, y: e.y - 0.5 }, ink); pt.px({ x: e.x - 0.5, y: e.y + 0.5 }, ink); break;
    case 'sad': pt.px({ x: e.x - 0.5, y: e.y + 0.5 }, ink, 2, 1); pt.px({ x: e.x - 1, y: e.y - 0.6 }, ink); break;
    default: pt.px({ x: e.x - 0.5, y: e.y - 0.5 }, ink, 1, 2); pt.px({ x: e.x + 0.5, y: e.y - 0.5 }, '#ffffff');
  }
  // eyebrow
  if (mood !== 'sad') pt.px({ x: e.x - 1, y: e.y - 2 }, C.ink, 2, 1);
  else pt.px({ x: e.x, y: e.y - 2.2 }, C.ink, 2, 1);
  const m = { x: hc.x + 3.6, y: hc.y + 3.6 };
  switch (mood) {
    case 'happy': pt.px({ x: m.x - 1, y: m.y - 0.4 }, ink, 3, 1); pt.px({ x: m.x - 0.5, y: m.y + 0.5 }, '#e0607a', 2, 1); break;
    case 'effort': pt.px({ x: m.x - 1, y: m.y - 0.4 }, '#ffffff', 3, 1); pt.px({ x: m.x - 1, y: m.y + 0.5 }, ink, 3, 1); break;
    case 'sad': pt.px({ x: m.x - 1, y: m.y + 0.4 }, ink); pt.px({ x: m.x, y: m.y - 0.4 }, ink); pt.px({ x: m.x + 1, y: m.y + 0.4 }, ink); break;
    case 'dizzy': pt.px({ x: m.x - 0.5, y: m.y - 0.5 }, ink, 2, 2); break;
    default: pt.px({ x: m.x - 0.5, y: m.y }, C.skin.d, 2, 1);
  }
}

/** Bonny, the club's wild boar: helmet over furry ears, long snout, tusks. */
function boarHead(pt, hc, C, mood) {
  const F = C.fur;
  pt.capsule({ x: hc.x - 1, y: hc.y + 3 }, { x: hc.x - 2, y: hc.y + 6.5 }, 2.6, 2.8, F.d);
  pt.ellipse({ x: hc.x + 0.6, y: hc.y + 1.4 }, 5.2, 4.6, 0, F.m);
  pt.ellipse({ x: hc.x - 1.4, y: hc.y + 2.4 }, 3, 3.4, 0, F.d);
  // snout
  pt.ellipse({ x: hc.x + 5.2, y: hc.y + 2.6 }, 3.4, 2.4, 0.15, F.l);
  pt.ellipse({ x: hc.x + 7.6, y: hc.y + 2.8 }, 1.3, 1.9, 0, C.snout);
  pt.px({ x: hc.x + 7.6, y: hc.y + 2.4 }, F.d);
  pt.px({ x: hc.x + 4.6, y: hc.y + 4.4 }, C.tusk, 1, 2);
  pt.px({ x: hc.x + 5.6, y: hc.y + 3.8 }, C.tusk);
  // ears poking out from under the helmet
  pt.poly([{ x: hc.x - 4.6, y: hc.y - 2 }, { x: hc.x - 6.6, y: hc.y - 6.6 }, { x: hc.x - 2.4, y: hc.y - 4 }], F.m);
  pt.poly([{ x: hc.x - 4.4, y: hc.y - 2.8 }, { x: hc.x - 5.8, y: hc.y - 5.4 }, { x: hc.x - 3.4, y: hc.y - 4 }], C.snout);
  // helmet
  const H = C.helmet;
  pt.ellipse({ x: hc.x - 0.2, y: hc.y - 2 }, 5.2, 3.6, 0, H.d);
  pt.ellipse({ x: hc.x - 0.6, y: hc.y - 2.6 }, 4.4, 2.8, 0, H.m);
  pt.ellipse({ x: hc.x - 1.8, y: hc.y - 3.8 }, 2, 1, -0.3, H.l);
  pt.line({ x: hc.x + 1.6, y: hc.y - 0.6 }, { x: hc.x + 5.4, y: hc.y - 0.2 }, 1.2, H.d);
  // bristly crest at the back
  for (let i = 0; i < 3; i++) pt.px({ x: hc.x - 5 - i * 0.8, y: hc.y + i * 1.4 }, F.d, 1, 1);
  face(pt, { x: hc.x - 0.2, y: hc.y - 0.6 }, { ...C, skin: { m: F.m, d: F.d } }, mood);
}

/** Torso along the spine (hip → neck) with jersey, shoulder pads, hem stripes and the team animal. */
function torso(pt, hip, neck, C, emblemFn) {
  const ux = (neck.x - hip.x) / TORSO, uy = (neck.y - hip.y) / TORSO; // along the spine
  const vx = -uy, vy = ux;                                             // forward (chest side)
  const at = (u, v) => ({ x: hip.x + ux * u + vx * v, y: hip.y + uy * u + vy * v });
  const J = C.jersey;
  // Jersey body: wider at the shoulders (pads), hanging loose at the hem.
  const outline = [at(-3, -5), at(-3, 4.6), at(4, 4.8), at(10, 5.2), at(13.5, 5.2), at(15.5, 3), at(16, 0), at(15.5, -3.6), at(13.5, -5.8), at(9, -5.4), at(4, -5.2)];
  pt.poly(outline, J.d);
  pt.poly([at(-2.4, -3.8), at(-2.4, 3.8), at(4, 4), at(10, 4.4), at(13, 4.4), at(14.8, 2.4), at(15.2, 0), at(14.6, -3), at(13, -4.6), at(9, -4.2), at(4, -4)], J.m);
  // light falls on the upper chest and the shoulder pad
  pt.poly([at(8, 1), at(10.5, 4), at(13, 3.8), at(14.6, 1.4), at(14.6, -0.6), at(12, 0)], J.l);
  // hem stripes
  pt.poly([at(-1, -4.8), at(-1, 4.6), at(0.8, 4.7), at(0.8, -4.9)], C.stripe.m);
  pt.poly([at(1.4, -4.9), at(1.4, 4.7), at(2.4, 4.8), at(2.4, -5)], C.trim.m);
  // collar
  pt.poly([at(14.4, -2.2), at(14.4, 2.2), at(15.6, 1.8), at(15.6, -1.8)], C.trim.m);
  emblemFn?.(at(9.5, 2.2));
  return { at, numberAt: at(9, -2.8) };
}

/** Team animal on the chest as a 3×3 badge. */
const EMBLEMS = {
  boar: { rows: ['a.a', 'aaa', '.b.'], a: '#8a5a34', b: '#e8b48f' },
  boarGlasses: { rows: ['aaa', 'bab', '.a.'], a: '#8a5a34', b: '#2a1f3d' },
  fox: { rows: ['a.a', 'aaa', '.b.'], a: '#ff9b52', b: '#fffaf4' },
  seal: { rows: ['.a.', 'aba', 'a.a'], a: '#c9d4e6', b: '#2a1f3d' },
  snake: { rows: ['aa.', '.a.', '.aa'], a: '#b6f07a', b: '#2a1f3d' },
  owl: { rows: ['a.a', 'bab', '.a.'], a: '#c98b52', b: '#fffaf4' },
};

function emblem(pt, team, p) {
  const e = EMBLEMS[team.animal];
  if (!e) return;
  pt.circle(p, 2.3, team.trim);
  e.rows.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] !== '.') pt.px({ x: p.x - 1.5 + i, y: p.y - 1.5 + j }, e[row[i]]); });
}

/**
 * Bake one skater pose. pose fields (sprite pixels, facing right):
 *   hip {x,y}  lean (rad, forward)  far / near feet {x, y, lift}  freeHand / stickHand {x,y}
 *   topHand: both hands on the stick (free hand goes to the shaft)  headTilt (rad)
 */
function bakeSkater(team, look, pose, mood) {
  const C = palette(team, look);
  const pt = new Painter(SK_W, SK_H, SK_AX, SK_AY);
  const hip0 = pose.hip ?? { x: -1, y: -24 };
  const hip = { x: hip0.x, y: hip0.y - RAISE };
  const up = (h) => h && { x: h.x, y: h.y - RAISE };
  const lean = pose.lean ?? 0.4;
  const neck = { x: hip.x + Math.sin(lean) * TORSO, y: hip.y - Math.cos(lean) * TORSO };
  const foot = (f) => ({ x: f.x, y: (f.y ?? 0) - (f.lift ?? 0) });
  const farFoot = foot(pose.far ?? { x: -4, y: -1 }), nearFoot = foot(pose.near ?? { x: 3 });

  // Far side first (in shade), then the body, then the near side.
  const farHip = { x: hip.x - 1.2, y: hip.y - 0.6 };
  const nearHip = { x: hip.x + 1, y: hip.y + 0.6 };
  // provisional torso frame for shoulder positions
  const ux = (neck.x - hip.x) / TORSO, uy = (neck.y - hip.y) / TORSO;
  const at = (u, v) => ({ x: hip.x + ux * u - uy * v, y: hip.y + uy * u + ux * v });
  const shFar = at(13.2, -3), shNear = at(13.4, 1.2);
  const free = up(pose.freeHand) ?? at(8, 9);
  const stick = up(pose.stickHand) ?? at(4, 12);
  const farArm = arm(pt, shFar, free, C, true);
  leg(pt, farHip, farFoot, C, true);
  const tor = torso(pt, hip, neck, C, (p) => emblem(pt, team, p));
  leg(pt, nearHip, nearFoot, C, false);
  const hc = { x: neck.x + Math.sin(lean * 0.6 + (pose.headTilt ?? 0)) * 6.2 + 1, y: neck.y - Math.cos(lean * 0.6) * 5.4 + (pose.headDrop ?? 0) };
  head(pt, hc, C, mood, look, pose.headTilt ?? 0);
  const nearArm = arm(pt, shNear, stick, C, false);
  const canvas = pt.finish(C.ink);
  return {
    canvas,
    hand: nearArm.hand,
    top: pose.topHand ? farArm.hand : null,
    num: tor.numberAt,
    headTop: hc.y - 6,
    lean,
  };
}

// ------------------------------------------------------------------ poses

const deg = (d) => (d * Math.PI) / 180;

function strideLeg(phase, baseX, side, reach, liftMax) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.5) {
    const u = p / 0.5;
    return { x: baseX - reach * u, y: side * Math.sin(Math.PI * u) * 1.6, lift: 0 };
  }
  const u = (p - 0.5) / 0.5;
  return { x: baseX - reach * (1 - u), y: 0, lift: Math.sin(Math.PI * u) * liftMax };
}

function stridePose(i, n, { lean = deg(30), reach = 11, lift = 4, hipY = -24 } = {}) {
  const ph = i / n;
  const far = strideLeg(ph, 2, -1, reach, lift);
  const near = strideLeg(ph + 0.5, 4, 1.2, reach, lift);
  const bob = (1 + Math.cos(4 * Math.PI * ph)) / 2;
  const hip = { x: -1.5, y: hipY + bob * 1.4 };
  // free arm swings against the legs; stick hand stays out front
  const sw = Math.cos(2 * Math.PI * ph);
  return {
    hip, lean, far, near,
    freeHand: { x: hip.x + 2 + sw * 7, y: hip.y - 6 + Math.abs(sw) * -2 },
    stickHand: { x: hip.x + 11, y: hip.y + 1 + bob },
  };
}

const P = {
  glide: { hip: { x: -1.5, y: -23.5 }, lean: deg(26), far: { x: -3, y: -1 }, near: { x: 4 }, freeHand: { x: 7, y: -26 }, stickHand: { x: 10, y: -21 }, topHand: true },
  idleA: { hip: { x: -0.5, y: -25 }, lean: deg(12), far: { x: -4, y: -1 }, near: { x: 4 }, freeHand: { x: 4, y: -29 }, stickHand: { x: 7, y: -22 }, topHand: true },
  idleB: { hip: { x: -0.5, y: -24.4 }, lean: deg(13), far: { x: -4, y: -1 }, near: { x: 4 }, freeHand: { x: 4, y: -28.6 }, stickHand: { x: 7, y: -21.6 }, topHand: true, headDrop: 0.5 },
  tiredA: { hip: { x: -2, y: -21 }, lean: deg(55), far: { x: -5, y: -1 }, near: { x: 4 }, freeHand: { x: 5, y: -17 }, stickHand: { x: 7, y: -15 }, headDrop: 1 },
  tiredB: { hip: { x: -2, y: -20.4 }, lean: deg(58), far: { x: -5, y: -1 }, near: { x: 4 }, freeHand: { x: 5, y: -16.4 }, stickHand: { x: 7, y: -14.6 }, headDrop: 1.4 },
  cross0: { hip: { x: -1, y: -22 }, lean: deg(30), far: { x: -2, y: -1 }, near: { x: 4, y: 1 }, freeHand: { x: -8, y: -27 }, stickHand: { x: 10, y: -20 } },
  cross1: { hip: { x: -1, y: -23 }, lean: deg(30), far: { x: -3, y: 0 }, near: { x: 1, y: -2, lift: 4 }, freeHand: { x: -8, y: -28 }, stickHand: { x: 10, y: -20 } },
  cross2: { hip: { x: -1, y: -22 }, lean: deg(30), far: { x: -6, y: 1.5 }, near: { x: -1, y: -2.5 }, freeHand: { x: -7, y: -27 }, stickHand: { x: 10, y: -20 } },
  cross3: { hip: { x: -1, y: -23 }, lean: deg(30), far: { x: 1, lift: 3 }, near: { x: 1, y: -1 }, freeHand: { x: -8, y: -28 }, stickHand: { x: 10, y: -20 } },
  stop: { hip: { x: -3, y: -19 }, lean: deg(5), far: { x: -9 }, near: { x: 6, y: 1.5 }, freeHand: { x: -12, y: -26 }, stickHand: { x: 6, y: -18 } },
  windup: { hip: { x: -1, y: -22 }, lean: deg(15), far: { x: -6 }, near: { x: 6 }, freeHand: { x: -4, y: -38 }, stickHand: { x: -1, y: -34 }, topHand: true, headTilt: -0.1 },
  release: { hip: { x: 2, y: -22 }, lean: deg(42), far: { x: -10, lift: 6 }, near: { x: 6 }, freeHand: { x: 12, y: -27 }, stickHand: { x: 16, y: -23 }, topHand: true },
  passOut: { hip: { x: 0, y: -22 }, lean: deg(32), far: { x: -6, lift: 2 }, near: { x: 5 }, freeHand: { x: 9, y: -26 }, stickHand: { x: 15, y: -17 }, topHand: true },
  lunge: { hip: { x: 1, y: -19 }, lean: deg(50), far: { x: -13 }, near: { x: 9 }, freeHand: { x: -11, y: -24 }, stickHand: { x: 19, y: -16 } },
  stumble: { hip: { x: 2, y: -22 }, lean: deg(55), far: { x: -9, lift: 7 }, near: { x: 4 }, freeHand: { x: -6, y: -40 }, stickHand: { x: 12, y: -38 }, headTilt: 0.3 },
  sprawl: { hip: { x: 0, y: -24 }, lean: deg(0), far: { x: -9, lift: 2 }, near: { x: 9 }, freeHand: { x: -12, y: -42 }, stickHand: { x: 12, y: -42 } },
  kneel: { hip: { x: -2, y: -12 }, lean: deg(30), far: { x: -12, lift: 0 }, near: { x: 6 }, freeHand: { x: 7, y: -13 }, stickHand: { x: 10, y: -12 }, headDrop: 1 },
  rise: { hip: { x: -1, y: -17 }, lean: deg(45), far: { x: -6 }, near: { x: 5 }, freeHand: { x: 6, y: -15 }, stickHand: { x: 9, y: -14 } },
  cheerA: { hip: { x: 0, y: -25 }, lean: deg(5), far: { x: -4 }, near: { x: 4, lift: 4 }, freeHand: { x: -7, y: -30 }, stickHand: { x: 6, y: -52 } },
  cheerB: { hip: { x: 0, y: -24 }, lean: deg(8), far: { x: -4 }, near: { x: 4 }, freeHand: { x: -8, y: -48 }, stickHand: { x: 8, y: -50 } },
  sad: { hip: { x: -1, y: -23 }, lean: deg(25), far: { x: -3, y: -1 }, near: { x: 4 }, freeHand: { x: 0, y: -19 }, stickHand: { x: 6, y: -18 }, headDrop: 1.6, headTilt: 0.25 },
  draw: { hip: { x: -3, y: -17 }, lean: deg(55), far: { x: -9 }, near: { x: 7 }, freeHand: { x: 7, y: -22 }, stickHand: { x: 13, y: -13 }, topHand: true },
  ready: { hip: { x: -2, y: -20 }, lean: deg(38), far: { x: -7 }, near: { x: 6 }, freeHand: { x: 6, y: -24 }, stickHand: { x: 11, y: -17 }, topHand: true },
};
for (let i = 0; i < 8; i++) {
  P[`stride${i}`] = stridePose(i, 8);
  P[`sprint${i}`] = stridePose(i, 8, { lean: deg(40), reach: 13, lift: 5, hipY: -22 });
}
export const SKATER_POSES = P;

const cache = new Map();

/**
 * All frames of one skater look, baked lazily.
 * frame(pose, mood) → { right, left, hand, top, num, headTop }
 */
export function skaterFigures(team, look = {}) {
  const key = `${team.key}|${look.kind ?? 'human'}|${look.hair ?? ''}|${look.skin ?? 0}`;
  let s = cache.get(key);
  if (s) return s;
  const frames = new Map();
  const frame = (pose, mood = 'normal') => {
    const k = `${pose}|${mood}`;
    let f = frames.get(k);
    if (!f) {
      const b = bakeSkater(team, look, P[pose] ?? P.glide, mood);
      f = { right: b.canvas, left: mirror(b.canvas), hand: b.hand, top: b.top, num: b.num, headTop: b.headTop };
      frames.set(k, f);
    }
    return f;
  };
  s = {
    frame,
    /** Everyday frames, so nothing has to be baked mid-game. */
    pending: null,
    queue() {
      const q = [];
      for (const pose of Object.keys(P)) q.push([pose, 'normal']);
      for (const pose of ['glide', 'idleA', 'idleB']) q.push([pose, 'blink']);
      for (const pose of ['windup', 'release', 'lunge', 'tiredA', 'tiredB']) q.push([pose, 'effort']);
      for (const pose of ['stumble', 'sprawl', 'kneel']) q.push([pose, 'dizzy']);
      for (const pose of ['cheerA', 'cheerB', 'glide', 'idleA', 'idleB']) q.push([pose, 'happy']);
      for (let i = 0; i < 8; i++) q.push([`stride${i}`, 'happy']);
      q.push(['sad', 'sad'], ['glide', 'sad']);
      return q;
    },
    /** Bake the face-off and skating frames now; the rest goes in a queue for warmStep(). */
    warm() {
      const first = /^(stride|sprint)|^(glide|idleA|idleB|ready|draw)$/;
      this.pending = this.queue().filter(([pose, mood]) => {
        if (mood === 'normal' && first.test(pose)) { frame(pose, mood); return false; }
        return true;
      });
    },
    /** Bake up to n more queued frames; false when all are done. */
    warmStep(n = 2) {
      if (!this.pending) this.pending = this.queue();
      for (let i = 0; i < n && this.pending.length; i++) frame(...this.pending.shift());
      return this.pending.length > 0;
    },
    get happyRight() { return frame('cheerA', 'happy').right; },
    get happyLeft() { return frame('cheerB', 'happy').left; },
  };
  cache.set(key, s);
  return s;
}

// ------------------------------------------------------------------ goalie

export const GK_W = 76, GK_H = 76, GK_AX = 36, GK_AY = 72;

/** Leg pad: tall, thick, white with team-coloured bands and a knee roll. */
function legPad(pt, top, bottom, w, C, far) {
  const k = far ? -0.2 : 0;
  const white = { l: '#ffffff', m: tint('#eef0f8', k), d: tint('#c3c8da', k) };
  pt.capsule(top, bottom, w, w, white.d);
  pt.capsule({ x: top.x - 0.6, y: top.y - 0.6 }, { x: bottom.x - 0.6, y: bottom.y - 0.4 }, w - 1.2, w - 1.2, white.m);
  for (const t of [0.3, 0.62]) pt.capsule(lerpP(top, bottom, t), lerpP(top, bottom, t + 0.09), w + 0.1, w + 0.1, far ? tint(C.jersey.m, -0.25) : C.jersey.m);
  pt.capsule(lerpP(top, bottom, 0.12), lerpP(top, bottom, 0.18), w + 0.3, w + 0.3, white.l);
}

/** Goalie: big pads, chest protector under the jersey, blocker, catch glove, mask with a cage. */
function bakeGoalie(team, pose, mood = 'normal') {
  const C = palette(team, {});
  const pt = new Painter(GK_W, GK_H, GK_AX, GK_AY);
  const down = !!pose.down;
  const sway = pose.sway ?? 0;
  const hip = down ? { x: 0, y: -13 } : { x: 0, y: -24 + sway };
  const step = pose.step ?? 0;
  if (down) {
    // butterfly: knees on the floor, pads flared out sideways along the ice
    legPad(pt, { x: -2, y: -7 }, { x: -15, y: -4 }, 4.2, C, true);
    legPad(pt, { x: 2, y: -6 }, { x: 15, y: -3 }, 4.4, C, false);
    skateMini(pt, { x: -18, y: -3 }, C); skateMini(pt, { x: 18, y: -2 }, C);
  } else {
    legPad(pt, { x: -4 - step, y: hip.y + 9 }, { x: -5 - step, y: -5 - Math.max(0, step) * 2 }, 4.2, C, true);
    skateMini(pt, { x: -5 - step, y: -Math.max(0, step) * 2 }, C);
    legPad(pt, { x: 4 + step, y: hip.y + 9 }, { x: 5 + step, y: -5 }, 4.4, C, false);
    skateMini(pt, { x: 5 + step, y: 0 }, C);
  }
  // pants
  pt.shaded({ x: hip.x - 5, y: hip.y + 1 }, { x: hip.x + 5, y: hip.y + 1 }, 5, 5, C.pants);
  // body: bulky jersey over the chest protector
  const J = C.jersey;
  const top = hip.y - 17;
  pt.poly([{ x: -10, y: hip.y }, { x: 10, y: hip.y }, { x: 12, y: top + 5 }, { x: 9, y: top }, { x: -9, y: top }, { x: -12, y: top + 5 }], J.d);
  pt.poly([{ x: -9, y: hip.y - 1 }, { x: 9, y: hip.y - 1 }, { x: 11, y: top + 5 }, { x: 8.4, y: top + 1 }, { x: -8.4, y: top + 1 }, { x: -11, y: top + 5 }], J.m);
  pt.poly([{ x: -3, y: top + 3 }, { x: 6, y: top + 2 }, { x: 8, y: top + 6 }, { x: -1, y: top + 8 }], J.l);
  pt.poly([{ x: -10, y: hip.y - 3.6 }, { x: 10, y: hip.y - 3.6 }, { x: 10, y: hip.y - 1.8 }, { x: -10, y: hip.y - 1.8 }], C.stripe.m);
  emblem(pt, team, { x: 0, y: top + 7 });
  // blocker arm (back side) and stick paddle in front of the pads
  const blocker = pose.blocker === 'out' ? { x: -17, y: top - 3 } : { x: -12, y: hip.y - 6 };
  pt.shaded({ x: -9, y: top + 3 }, blocker, 3.2, 3, J);
  pt.poly([{ x: blocker.x - 3, y: blocker.y - 4 }, { x: blocker.x + 2, y: blocker.y - 4 }, { x: blocker.x + 2, y: blocker.y + 4 }, { x: blocker.x - 3, y: blocker.y + 4 }], '#f2f2f8');
  pt.poly([{ x: blocker.x - 2.2, y: blocker.y - 3 }, { x: blocker.x + 1.2, y: blocker.y - 3 }, { x: blocker.x + 1.2, y: blocker.y - 1.6 }, { x: blocker.x - 2.2, y: blocker.y - 1.6 }], J.m);
  const paddleY = down ? -3 : -2;
  pt.line({ x: blocker.x + 1, y: blocker.y + 3 }, { x: -6, y: paddleY - 6 }, 1.6, '#8a5a34');
  pt.poly([{ x: -9, y: paddleY - 7 }, { x: 6, y: paddleY - 7 }, { x: 6, y: paddleY - 4.6 }, { x: -9, y: paddleY - 4.6 }], '#7a4b2c');
  pt.poly([{ x: 6, y: paddleY - 2.6 }, { x: 13, y: paddleY - 2.6 }, { x: 13, y: paddleY - 0.8 }, { x: 6, y: paddleY - 0.8 }], '#2a2438');
  // head: mask with cage
  const hc = { x: 1, y: top - 5 };
  pt.circle(hc, 6.2, '#d8dce8');
  pt.circle({ x: hc.x - 0.6, y: hc.y - 0.6 }, 5.4, '#f4f6fb');
  if (team.animal === 'boarGlasses') {
    pt.circle(hc, 5.4, C.fur.m); pt.px({ x: hc.x - 4, y: hc.y + 3 }, C.tusk, 1, 2); pt.px({ x: hc.x + 4, y: hc.y + 3 }, C.tusk, 1, 2);
  } else {
    pt.poly([{ x: hc.x - 1.2, y: hc.y - 6 }, { x: hc.x + 1.2, y: hc.y - 6 }, { x: hc.x + 1.2, y: hc.y - 2 }, { x: hc.x - 1.2, y: hc.y - 2 }], J.m);
  }
  if (team.animal === 'boar') {
    pt.poly([{ x: hc.x - 5, y: hc.y - 3 }, { x: hc.x - 6.5, y: hc.y - 8 }, { x: hc.x - 2.6, y: hc.y - 5 }], C.fur.m);
    pt.poly([{ x: hc.x + 5, y: hc.y - 3 }, { x: hc.x + 6.5, y: hc.y - 8 }, { x: hc.x + 2.6, y: hc.y - 5 }], C.fur.m);
  }
  pt.ellipse({ x: hc.x + 0.5, y: hc.y + 1.6 }, 3.6, 3, 0, C.skin.d);
  pt.px({ x: hc.x - 1.5, y: hc.y + 0.6 }, C.ink); pt.px({ x: hc.x + 2, y: hc.y + 0.6 }, C.ink);
  for (const x of [-3, -1, 1, 3]) pt.line({ x: hc.x + x + 0.5, y: hc.y - 0.6 }, { x: hc.x + x * 0.8 + 0.5, y: hc.y + 4.6 }, 0.6, '#8c93a6');
  pt.line({ x: hc.x - 3.4, y: hc.y + 2.2 }, { x: hc.x + 4.4, y: hc.y + 2.2 }, 0.6, '#8c93a6');
  // catch glove arm (front side)
  const glove = pose.glove === 'high' ? { x: 17, y: top - 6 } : pose.glove === 'cover' ? { x: 9, y: -6 } : { x: 14, y: hip.y - 7 };
  pt.shaded({ x: 9, y: top + 3 }, glove, 3.2, 3, J);
  pt.circle(glove, 5, tint(C.glove.m, -0.2));
  pt.circle({ x: glove.x - 0.6, y: glove.y - 0.6 }, 4, C.glove.m);
  pt.ellipse({ x: glove.x + 0.6, y: glove.y - 1.4 }, 2.2, 1.6, 0.3, C.trim.m);
  pt.px({ x: glove.x - 2, y: glove.y - 3 }, C.glove.l, 2, 1);
  return pt.finish(C.ink);
}

function skateMini(pt, g, C) {
  for (let i = 0; i < 4; i++) pt.circle({ x: g.x - 3.3 + i * 2.6, y: g.y - 1.4 }, 1.4, C.wheel.d);
  pt.poly([{ x: g.x - 4.6, y: g.y - 5.6 }, { x: g.x + 5, y: g.y - 5.6 }, { x: g.x + 5.6, y: g.y - 2.6 }, { x: g.x - 4.6, y: g.y - 2.6 }], C.boot.m);
}

const GOALIE_POSES = {
  stance: {},
  breathe: { sway: 1 },
  shuffleA: { step: 1.6 },
  shuffleB: { step: -1.6, sway: 1 },
  butterfly: { down: true },
  glove: { glove: 'high', step: 1 },
  blocker: { blocker: 'out', step: -1 },
  cover: { down: true, glove: 'cover' },
};

const goalieCache = new Map();
export function goalieFigures(team) {
  let s = goalieCache.get(team);
  if (s) return s;
  s = {};
  for (const [name, pose] of Object.entries(GOALIE_POSES)) {
    const c = bakeGoalie(team, pose);
    s[name] = { right: c, left: mirror(c) };
  }
  s.right = s.stance.right; s.left = s.stance.left;
  s.downRight = s.butterfly.right; s.downLeft = s.butterfly.left;
  goalieCache.set(team, s);
  return s;
}
