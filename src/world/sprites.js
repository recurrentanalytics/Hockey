// Cute chibi skaters and goalies, drawn from round shapes with an automatic outline.
// Everything is baked once per team into small canvases.
import { PAL } from '../engine/palette.js';
import { Surface, rgba, makeCanvas } from '../engine/raster.js';

export const SPRITE_W = 24;
export const SPRITE_H = 30;
export const ANCHOR_X = 11;   // between the skates
export const ANCHOR_Y = 29;   // wheel contact row

// ------------------------------------------------------------------ drawing helpers

function ellipse(s, cx, cy, rx, ry, color) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) s.set(x, y, typeof color === 'function' ? color(x, y, dx, dy) : color);
    }
  }
}

function rect(s, x, y, w, h, c) {
  s.rect(x, y, w, h, c);
}

/** 1px outline around everything opaque (4-neighbour), drawn into empty pixels. */
function outline(s, color) {
  const out = [];
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      if (s.get(x, y)) continue;
      if (s.get(x - 1, y) || s.get(x + 1, y) || s.get(x, y - 1) || s.get(x, y + 1)) out.push([x, y]);
    }
  }
  for (const [x, y] of out) s.set(x, y, color);
}

function mirror(canvas) {
  const m = makeCanvas(canvas.width, canvas.height);
  const g = m.getContext('2d');
  g.translate(canvas.width, 0);
  g.scale(-1, 1);
  g.drawImage(canvas, 0, 0);
  return m;
}

function colorsFor(team) {
  const c = (hex) => rgba(hex);
  return {
    ink: c(PAL.ink), white: c(PAL.white), skin: c(PAL.skin), skinShade: c(PAL.skinShade), blush: c(PAL.pink),
    main: c(team.main), shade: c(team.shade), trim: c(team.trim), helmet: c(team.helmet), helmetShade: c(team.helmetShade),
    pants: c(team.pants), pantsShade: c(team.pantsShade ?? team.pants), boot: c(PAL.white), bootShade: c(PAL.cloud), wheel: c(team.wheel ?? PAL.yellow), frame: c(PAL.mist),
    highlight: c('#ffffff'),
    stripe: c(team.stripe ?? team.trim),
    fur: c('#8a5a34'), furDark: c('#5e3b20'), furLight: c('#b07a48'), snout: c('#e8b48f'), tusk: c('#fff3dc'),
  };
}

// ------------------------------------------------------------------ team animals

/** 3×3 chest emblems: a tiny version of each team's animal. */
const EMBLEMS = {
  boar: { rows: ['a.a', 'aaa', '.b.'], a: '#8a5a34', b: '#e8b48f' },
  boarGlasses: { rows: ['aaa', 'bab', '.a.'], a: '#8a5a34', b: '#2a1f3d' },
  fox: { rows: ['a.a', 'aaa', '.b.'], a: '#ff9b52', b: '#fffaf4' },
  seal: { rows: ['.a.', 'aba', 'a.a'], a: '#c9d4e6', b: '#2a1f3d' },
  snake: { rows: ['aa.', '.a.', '.aa'], a: '#b6f07a', b: '#2a1f3d' },
  owl: { rows: ['a.a', 'bab', '.a.'], a: '#c98b52', b: '#fffaf4' },
};

function emblem(s, team, x, y) {
  const e = EMBLEMS[team.animal];
  if (!e) return;
  e.rows.forEach((row, j) => { for (let i = 0; i < 3; i++) if (row[i] !== '.') s.set(x + i, y + j, rgba(e[row[i]])); });
}

export const HAIR = ['#5a3b2e', '#2a1f3d', '#f2c14e', '#c4632e', '#8a5a44', '#ff9fc4'];

// ------------------------------------------------------------------ face

/** Eyes: 'normal' sparkly dots, 'happy' ^ ^, 'dizzy' x x, 'blink' lines. */
function face(s, C, ex, ey, mood) {
  for (const x of [ex, ex + 4]) {
    if (mood === 'happy') {
      s.set(x, ey + 1, C.ink); s.set(x + 1, ey, C.ink); s.set(x + 2, ey + 1, C.ink);
    } else if (mood === 'dizzy') {
      s.set(x, ey, C.ink); s.set(x + 1, ey, C.ink); s.set(x + 1, ey + 1, C.ink); s.set(x, ey + 1, C.white);
    } else if (mood === 'blink') {
      s.set(x, ey + 1, C.ink); s.set(x + 1, ey + 1, C.ink);
    } else if (mood === 'effort') {
      // squeezed shut: > <
      if (x === ex) { s.set(x, ey, C.ink); s.set(x + 1, ey + 1, C.ink); }
      else { s.set(x + 1, ey, C.ink); s.set(x, ey + 1, C.ink); }
    } else if (mood === 'sad') {
      // droopy eyes looking down
      s.set(x, ey + 1, C.ink); s.set(x + 1, ey + 1, C.ink); s.set(x + (x === ex ? 1 : 0), ey + 2, C.ink);
    } else {
      rect(s, x, ey, 2, 2, C.ink);
      s.set(x, ey, C.white); // sparkle
    }
  }
  // Rosy cheeks and a tiny mouth
  s.set(ex - 1, ey + 3, C.blush); s.set(ex + 6, ey + 3, C.blush);
  if (mood === 'happy') {
    rect(s, ex + 2, ey + 3, 2, 2, C.ink);
    s.set(ex + 2, ey + 4, C.blush);
  } else if (mood === 'dizzy') {
    s.set(ex + 2, ey + 4, C.ink); s.set(ex + 3, ey + 3, C.ink);
  } else if (mood === 'effort') {
    // gritted teeth
    rect(s, ex + 1, ey + 3, 3, 2, C.ink);
    rect(s, ex + 1, ey + 3, 3, 1, C.white);
  } else if (mood === 'sad') {
    // little frown and a tear
    s.set(ex + 1, ey + 4, C.ink); s.set(ex + 2, ey + 3, C.ink); s.set(ex + 3, ey + 4, C.ink);
    s.set(ex - 1, ey + 2, rgba(PAL.sky)); s.set(ex - 1, ey + 3, rgba(PAL.sky));
  } else {
    s.set(ex + 2, ey + 4, C.skinShade); s.set(ex + 3, ey + 4, C.skinShade);
  }
}

/** Big round head: helmet on top, face below, ear guards, a little brim toward the front. */
function head(s, C, cx, cy, mood, { helmet = C.helmet, helmetShade = C.helmetShade, cage = false } = {}) {
  const r = 7.2;
  ellipse(s, cx, cy, r, r * 0.95, (x, y, dx, dy) => {
    const inFace = dy > -0.08 && Math.abs(dx) < 0.84 && dy < 0.98;
    if (inFace) return dx < -0.62 ? C.skinShade : C.skin;
    if (dy > -0.05 && dy < 0.12) return helmetShade;            // rim
    if (dx > 0.25 && dy < -0.35 && dx * dx + dy * dy > 0.45) return C.highlight; // shine
    return dx < -0.5 ? helmetShade : helmet;
  });
  // Brim sticking out toward the front
  rect(s, Math.round(cx + 4), Math.round(cy) - 1, 4, 1, helmetShade);
  face(s, C, Math.round(cx) - 2, Math.round(cy) + 1, mood);
  if (cage) {
    // One thin cage bar under the eyes: enough to read as a goalie mask.
    for (let x = Math.round(cx) - 4; x <= Math.round(cx) + 5; x++) s.set(x, Math.round(cy) + 4, rgba(PAL.steel));
  }
}

/** Hair peeking out under the helmet: a fringe and a tuft at the back. */
function hair(s, cx, cy, color) {
  const c = rgba(color);
  cx = Math.round(cx); cy = Math.round(cy);
  for (const x of [cx - 3, cx - 2, cx, cx + 1]) s.set(x, cy + 1, c);
  s.set(cx - 2, cy + 2, c);
  for (const [x, y] of [[cx - 7, cy + 1], [cx - 7, cy + 2], [cx - 6, cy + 3], [cx - 7, cy + 3], [cx - 6, cy + 4]]) s.set(x, y, c);
}

/** Balding Borstis: shiny bald dome, a fringe of hair round the sides, round glasses. */
function baldHead(s, C, cx, cy, mood, fringe) {
  const r = 7.2, f = rgba(fringe);
  ellipse(s, cx, cy, r, r * 0.95, (x, y, dx, dy) => {
    if (dy > -0.15 && Math.abs(dx) > 0.78) return f;                 // side hair
    if (dx > 0.2 && dy < -0.35 && dx * dx + dy * dy > 0.4) return C.highlight; // shine
    return dx < -0.6 ? C.skinShade : C.skin;
  });
  face(s, C, Math.round(cx) - 2, Math.round(cy) + 1, mood);
  // Glasses: thin rims around each eye and a bridge
  const rim = rgba(PAL.slate);
  const ex = Math.round(cx) - 3, ey = Math.round(cy);
  for (const gx of [ex, ex + 4]) {
    for (let i = 0; i < 4; i++) s.set(gx + i, ey, rim);
    s.set(gx, ey + 1, rim); s.set(gx + 3, ey + 1, rim); s.set(gx, ey + 2, rim); s.set(gx + 3, ey + 2, rim);
  }
}

/** Bonny: a little wild boar from the Eilenriede (no helmet, bristly crest, pig snout, tusks). */
function boarHead(s, C, cx, cy, mood) {
  cx = Math.round(cx); cy = Math.round(cy);
  const r = 7;
  ellipse(s, cx, cy + 0.5, r, r * 0.9, (x, y, dx, dy) => {
    if (dy > 0.15 && Math.abs(dx) < 0.62) return C.furLight;          // lighter muzzle
    return dx < -0.5 ? C.furDark : C.fur;
  });
  // Pointy ears on top, a bristly crest between them
  for (const [ex, dir] of [[cx - 5, -1], [cx + 4, 1]]) {
    s.rect(ex, cy - 7, 2, 2, C.fur);
    s.set(ex + (dir > 0 ? 1 : 0), cy - 8, C.furDark);
    s.set(ex + (dir > 0 ? 0 : 1), cy - 6, C.snout);                  // pink inner ear
  }
  for (const x of [cx - 2, cx, cx + 2]) { s.set(x, cy - 7, C.furDark); s.set(x - 1, cy - 8, C.furDark); }
  // Eyes higher up, then a big snout in the middle of the face
  face(s, C, cx - 2, cy - 2, mood);
  ellipse(s, cx + 1, cy + 3, 3.4, 2.1, C.snout);
  s.set(cx, cy + 3, C.furDark); s.set(cx + 2, cy + 3, C.furDark);    // nostrils
  s.set(cx - 3, cy + 4, C.tusk); s.set(cx - 3, cy + 3, C.tusk);       // tusks
  s.set(cx + 5, cy + 4, C.tusk); s.set(cx + 5, cy + 3, C.tusk);
}

// ------------------------------------------------------------------ skater

// Skater frames are baked on a slightly larger canvas than the body needs, so raised
// arms, kicks and lunges fit. Body coordinates below are drawn with an offset (OX, OY).
const OX = 2, OY = 4;

/** A view of a Surface shifted by (OX, OY): the drawing helpers only need set/get/rect. */
function shifted(s) {
  return {
    w: s.w, h: s.h,
    set: (x, y, c) => s.set(x + OX, y + OY, c),
    get: (x, y) => s.get(x + OX, y + OY),
    rect: (x, y, w, h, c) => s.rect(x + OX, y + OY, w, h, c),
  };
}

/** Thick limb from (x0,y0) to (x1,y1). */
function limb(s, x0, y0, x1, y1, w, c) {
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    s.rect(Math.round(x - w / 2), Math.round(y - w / 2), w, w, c);
  }
}

/**
 * One skater frame, facing right. All values in pixels.
 *   bob     upper body lowered (knee bend)          lean   upper body forward
 *   headDy  extra head drop (head hanging)          far / near  skates: {x, y, lift}
 *   free    the free glove, relative to the chest   stick  the stick glove, relative to the chest
 * Returns the canvas and the stick hand position relative to the anchor.
 */
function bakeSkater(team, pose, mood, look = {}) {
  const base = new Surface(SPRITE_W, SPRITE_H);
  const s = shifted(base);
  const C = colorsFor(team);
  const bob = pose.bob ?? 0, lean = pose.lean ?? 0;
  const far = { x: 6, y: 0, lift: 0, ...pose.far }, near = { x: 9, y: 0, lift: 0, ...pose.near };
  // Chest centre: everything above the hips hangs off this point.
  const cx = 10 + Math.round(lean * 0.6), cy = 16 + bob;
  const hipY = 19 + bob;

  const skate = (k, front) => {
    const x = Math.round(k.x), y = Math.round(22 - k.lift + k.y);
    rect(s, x, y, 5, 2, C.boot);
    rect(s, x, y + 1, 5, 1, C.bootShade);
    s.set(x + (front ? 4 : 0), y, C.bootShade);
    s.set(x + 1, y + 2, C.wheel); s.set(x + 3, y + 2, C.wheel);
    s.set(x + 2, y + 2, C.frame);
  };
  const leg = (k, hipX, color) => {
    const fx = Math.round(k.x) + 2, fy = Math.round(22 - k.lift + k.y) - 1;
    limb(s, hipX, Math.min(hipY, fy - 1), fx, fy, 3, color);
  };
  // Far leg first (in the shade), then the near leg over it.
  leg(far, cx - 2, C.pantsShade);
  skate(far, false);
  leg(near, cx + 1, C.pants);
  skate(near, true);

  // Free arm behind the body
  const free = { x: -5.5, y: -0.5, ...pose.free }, stick = { x: 5.5, y: 0.5, ...pose.stick };
  const fgx = cx + free.x, fgy = cy + free.y;
  limb(s, cx - 3, cy - 2, fgx, fgy, 2, C.shade);
  ellipse(s, fgx, fgy, 1.6, 1.6, C.shade);

  // Body: round jersey with team stripes and the team animal on the chest
  ellipse(s, cx, cy, 5.2, 4.2, (x, y, dx, dy) => {
    const row = y + 0.5 - (cy + 2);
    if (Math.abs(row) < 0.6) return C.trim;
    if (Math.abs(row - 1) < 0.6 && team.stripe) return C.stripe;
    return dx < -0.45 || dy > 0.6 ? C.shade : C.main;
  });
  emblem(s, team, cx, cy - 3);

  // Head (leans a little further than the body)
  const hx = 10 + lean + (pose.headX ?? 0), hy = 7.5 + bob + (pose.headDy ?? 0);
  if (look.kind === 'boar') boarHead(s, C, hx, hy, mood);
  else if (look.kind === 'bald') baldHead(s, C, hx, hy, mood, look.hair ?? HAIR[0]);
  else {
    head(s, C, hx, hy, mood);
    if (look.hair) hair(s, hx, hy, look.hair);
  }

  // Stick arm in front of the body
  const sgx = cx + stick.x, sgy = cy + stick.y;
  limb(s, cx + 2, cy - 2, sgx, sgy, 2, C.main);
  ellipse(s, sgx, sgy, 1.7, 1.7, C.shade);
  outline(base, C.ink);
  return {
    canvas: base.toCanvas(),
    hand: { x: Math.round(sgx) + OX - ANCHOR_X, y: Math.round(sgy) + OY - ANCHOR_Y },
  };
}

// ------------------------------------------------------------------ poses

/** One leg through a stride: push back and out, then lift and swing forward again. */
function strideLeg(phase, baseX, side, reach, liftMax) {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.5) {
    const u = p / 0.5;
    return { x: baseX - reach * u, y: side * Math.round(Math.sin(Math.PI * u) * 1.2), lift: 0 };
  }
  const u = (p - 0.5) / 0.5;
  return { x: baseX - reach * (1 - u), y: 0, lift: Math.round(Math.sin(Math.PI * u) * liftMax) };
}

function stridePose(i, n, { lean = 1, reach = 5, lift = 2 } = {}) {
  const ph = i / n;
  const far = strideLeg(ph, 6, -1, reach, lift);
  const near = strideLeg(ph + 0.5, 9, 1, reach, lift);
  // Lowest when a leg is fully extended; the free arm swings against the legs.
  const bob = Math.round((1 + Math.cos(4 * Math.PI * ph)) / 2);
  return {
    bob, lean, far, near,
    free: { x: -5.5 + Math.cos(2 * Math.PI * ph) * 2, y: -0.5 + Math.sin(2 * Math.PI * ph) },
    stick: { x: 5.5, y: 0.5 + (bob ? 0.5 : 0) },
  };
}

const POSES = {
  glide: { bob: 1, lean: 1, far: { x: 6 }, near: { x: 9 } },
  idleA: { bob: 0, lean: 0, far: { x: 5 }, near: { x: 10 } },
  idleB: { bob: 0, lean: 0, headDy: 1, far: { x: 5 }, near: { x: 10 }, free: { y: 0.5 } },
  // Out of breath: bent over, hands down at the knees
  tiredA: { bob: 2, lean: 2, headDy: 1, far: { x: 5 }, near: { x: 10 }, free: { x: -1, y: 3 }, stick: { x: 3, y: 3 } },
  tiredB: { bob: 3, lean: 2, headDy: 1, far: { x: 5 }, near: { x: 10 }, free: { x: -1, y: 3 }, stick: { x: 3, y: 2.5 } },
  // Crossovers: the outside skate steps over the inside one
  cross0: { bob: 1, lean: 1, far: { x: 6 }, near: { x: 10 } },
  cross1: { bob: 0, lean: 1, far: { x: 5, y: 1 }, near: { x: 8, y: -1, lift: 2 } },
  cross2: { bob: 1, lean: 1, far: { x: 3, y: 1 }, near: { x: 6, y: -2 } },
  cross3: { bob: 0, lean: 1, far: { x: 7, lift: 2 }, near: { x: 7, y: -1 } },
  // Hockey stop: low, leaning back, skates wide, free arm out for balance
  stop: { bob: 2, lean: -2, far: { x: 3 }, near: { x: 12, y: 1 }, free: { x: -6.5, y: -3 }, stick: { x: 6, y: 1 } },
  // Shot: wind up with both hands high and back, then fire through and kick the back leg up
  windup: { bob: 1, lean: -1, far: { x: 4 }, near: { x: 11 }, free: { x: -3, y: -4 }, stick: { x: -1.5, y: -6 } },
  release: { bob: 1, lean: 3, far: { x: 2, lift: 3 }, near: { x: 11 }, free: { x: 3, y: -2 }, stick: { x: 6.5, y: -4 } },
  passOut: { bob: 1, lean: 2, far: { x: 4, lift: 1 }, near: { x: 10 }, free: { x: -5, y: -1 }, stick: { x: 7, y: 0.5 } },
  // Poke check: a long lunge, stick arm fully out
  lunge: { bob: 2, lean: 3, far: { x: 1 }, near: { x: 13 }, free: { x: -6.5, y: -2.5 }, stick: { x: 7.5, y: 1.5 } },
  // Falling: stumble forward with flailing arms, sprawl on the floor, back on one knee, up again
  stumble: { bob: 1, lean: 3, far: { x: 3, lift: 3 }, near: { x: 10 }, free: { x: -6, y: -7 }, stick: { x: 5, y: -8 } },
  sprawl: { bob: 0, lean: 0, far: { x: 2, lift: 1 }, near: { x: 12 }, free: { x: -7, y: -6 }, stick: { x: 6.5, y: -6 } },
  kneel: { bob: 5, lean: 2, far: { x: 2 }, near: { x: 10 }, free: { x: 2, y: 3 }, stick: { x: 5, y: 2 } },
  rise: { bob: 3, lean: 2, far: { x: 4 }, near: { x: 10 }, free: { x: -3, y: 2 }, stick: { x: 5, y: 1 } },
  // Celebration: fist pumps with the stick in the air
  cheerA: { bob: 0, lean: 0, far: { x: 5 }, near: { x: 10, lift: 2 }, free: { x: -5, y: -1 }, stick: { x: 4, y: -11 } },
  cheerB: { bob: 1, lean: 0, far: { x: 5 }, near: { x: 10 }, free: { x: -6, y: -9 }, stick: { x: 5, y: -10 } },
  // Beaten: head down, arms hanging
  sad: { bob: 2, lean: 1, headDy: 1, far: { x: 6 }, near: { x: 9 }, free: { x: -4, y: 2 }, stick: { x: 4, y: 2.5 } },
  // Face-off: deep crouch over the dot, both hands low on the stick
  draw: { bob: 3, lean: 3, far: { x: 3 }, near: { x: 12 }, free: { x: 3, y: 1.5 }, stick: { x: 6, y: 3 } },
  ready: { bob: 2, lean: 1, far: { x: 4 }, near: { x: 11 } },
};
for (let i = 0; i < 8; i++) {
  POSES[`stride${i}`] = stridePose(i, 8);
  POSES[`sprint${i}`] = stridePose(i, 8, { lean: 2, reach: 6, lift: 3 });
}

const cache = new Map();

/**
 * All frames of one skater look, baked lazily.
 * look: { kind: 'human' | 'boar' | 'bald', hair: '#rrggbb' }
 * frame(pose, mood) → { right, left, hand } (hand relative to the anchor, facing right)
 */
export function skaterSprites(team, look = {}) {
  const key = `${team.key}|${look.kind ?? 'human'}|${look.hair ?? ''}`;
  let s = cache.get(key);
  if (s) return s;
  const frames = new Map();
  const frame = (pose, mood = 'normal') => {
    const k = `${pose}|${mood}`;
    let f = frames.get(k);
    if (!f) {
      const b = bakeSkater(team, POSES[pose] ?? POSES.glide, mood, look);
      f = { right: b.canvas, left: mirror(b.canvas), hand: b.hand };
      frames.set(k, f);
    }
    return f;
  };
  s = {
    frame,
    // Celebration frames for the video wall
    get happyRight() { return frame('cheerA', 'happy').right; },
    get happyLeft() { return frame('cheerB', 'happy').left; },
  };
  cache.set(key, s);
  return s;
}

let shadowCanvas = null;
export function shadowSprite() {
  if (shadowCanvas) return shadowCanvas;
  const s = new Surface(16, 5);
  ellipse(s, 8, 2.5, 7.5, 2.3, rgba(PAL.ink, 70));
  ellipse(s, 8, 2.5, 5, 1.4, rgba(PAL.ink, 95));
  shadowCanvas = s.toCanvas();
  return shadowCanvas;
}

// ------------------------------------------------------------------ goalie

export const GOALIE_W = 24;
export const GOALIE_ANCHOR_X = 11;
export const GOALIE_ANCHOR_Y = 26;

/**
 * Goalie frame, facing right. pose: { down, sway, step, glove: 'set'|'high'|'cover', blocker: 'set'|'out' }
 */
function bakeGoalie(team, pose = {}) {
  const s = new Surface(GOALIE_W, 28);
  const C = colorsFor(team);
  const pad = rgba(PAL.white), padShade = rgba(PAL.cloud);
  const down = !!pose.down;
  const drop = (down ? 5 : 0) + (pose.sway ?? 0);
  // Leg pads with two team-coloured bands
  const legPad = (x, y, w, h, horizontal) => {
    rect(s, x, y, w, h, pad);
    rect(s, x, y + h - 1, w, 1, padShade);
    if (horizontal) { rect(s, x + 2, y, 1, h, C.main); rect(s, x + w - 3, y, 1, h, C.main); }
    else { rect(s, x, y + 2, w, 1, C.main); rect(s, x, y + h - 4, w, 1, C.main); }
  };
  if (down) { legPad(1, 22, 10, 4, true); legPad(13, 22, 10, 4, true); }
  else {
    // Shuffling: one pad pushes, the other slides along a step behind.
    const st = pose.step ?? 0;
    legPad(5 - st, 17 + (pose.sway ?? 0) - Math.abs(st), 6, 9 - (pose.sway ?? 0) + Math.abs(st), false);
    legPad(13 + st, 17 + (pose.sway ?? 0), 6, 9 - (pose.sway ?? 0), false);
  }
  // Chest protector
  ellipse(s, 12, 15 + drop, 7.2, 5.2, (x, y, dx, dy) => (dx < -0.5 || dy > 0.6 ? C.shade : C.main));
  rect(s, 6, 17 + drop, 13, 1, C.trim);
  // Blocker (back side): kept in, or punched out to deflect
  if (pose.blocker === 'out') ellipse(s, 1.5, 10 + drop, 2.2, 3.2, C.shade);
  else ellipse(s, 3, 14.5 + drop, 2.4, 3, C.shade);
  // Catch glove (front side): set, snapped up high, or covering the puck on the floor
  const gl = pose.glove === 'high' ? [21, 4 + drop] : pose.glove === 'cover' ? [17, 22] : [21, 14 + drop];
  if (pose.glove === 'high') ellipse(s, 19.5, 8 + drop, 1.2, 2.5, C.main); // forearm
  ellipse(s, gl[0], gl[1], 2.8, 2.8, C.shade);
  s.set(gl[0], gl[1] - 1, C.trim);
  // Stick paddle in front of the pads
  rect(s, 5, down ? 21 : 25, 8, 1, rgba(PAL.woodDark));
  // White mask with a team stripe over the top only
  if (team.animal === 'boarGlasses') {
    // Keiler mask: brown with tusks
    head(s, C, 12, 6.5 + drop, 'normal', { helmet: C.fur, helmetShade: C.furDark, cage: true });
    s.set(8, 11 + drop, C.tusk); s.set(16, 11 + drop, C.tusk);
  } else {
    head(s, C, 12, 6.5 + drop, 'normal', { helmet: rgba(PAL.white), helmetShade: rgba(PAL.cloud), cage: true });
    for (let y = drop; y < 4 + drop; y++) rect(s, 11, y, 2, 1, C.main);
  }
  if (team.animal === 'boar') {
    // little boar ears on the mask
    rect(s, 6, drop, 2, 2, C.fur); rect(s, 16, drop, 2, 2, C.fur);
  }
  emblem(s, team, 11, 13 + drop);
  outline(s, C.ink);
  return s.toCanvas();
}

const GOALIE_POSES = {
  stance: {},
  breathe: { sway: 1 },
  shuffleA: { step: 1 },
  shuffleB: { step: -1, sway: 1 },
  butterfly: { down: true },
  glove: { glove: 'high', step: 1 },
  blocker: { blocker: 'out', step: -1 },
  cover: { down: true, glove: 'cover' },
};

const goalieCache = new Map();
export function goalieSprites(team) {
  let s = goalieCache.get(team);
  if (s) return s;
  s = {};
  for (const [name, pose] of Object.entries(GOALIE_POSES)) {
    const c = bakeGoalie(team, pose);
    s[name] = { right: c, left: mirror(c) };
  }
  // Older names
  s.right = s.stance.right; s.left = s.stance.left;
  s.downRight = s.butterfly.right; s.downLeft = s.butterfly.left;
  goalieCache.set(team, s);
  return s;
}
