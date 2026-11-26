// Cute chibi skaters and goalies, drawn from round shapes with an automatic outline.
// Everything is baked once per team into small canvases.
import { PAL } from '../engine/palette.js';
import { Surface, rgba, makeCanvas } from '../engine/raster.js';

export const SPRITE_W = 20;
export const SPRITE_H = 26;
export const ANCHOR_X = 9;    // between the skates
export const ANCHOR_Y = 25;   // wheel contact row
export const HAND = { x: 6, y: -8 };  // front glove, relative to the anchor (facing right)

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
    pants: c(team.pants), boot: c(PAL.white), bootShade: c(PAL.cloud), wheel: c(team.wheel ?? PAL.yellow), frame: c(PAL.mist),
    highlight: c('#ffffff'),
  };
}

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

// ------------------------------------------------------------------ skater

/**
 * One skater frame, facing right.
 * pose: { bob, back: {dx, lift}, front: {dx, lift} }
 */
function bakeSkater(team, pose, mood) {
  const s = new Surface(SPRITE_W, SPRITE_H);
  const C = colorsFor(team);
  const bob = pose.bob ?? 0;
  // Skates: white boots, coloured wheels
  const skate = (x, lift, front) => {
    const y = 22 - lift;
    rect(s, x, y, 5, 2, C.boot);
    rect(s, x, y + 1, 5, 1, C.bootShade);
    s.set(x + (front ? 4 : 0), y, C.bootShade);
    s.set(x + 1, y + 2, C.wheel); s.set(x + 3, y + 2, C.wheel);
    s.set(x + 2, y + 2, C.frame);
  };
  const bx = 4 + (pose.back?.dx ?? 0), fx = 10 + (pose.front?.dx ?? 0);
  // Legs
  rect(s, bx + 1, 19 - (pose.back?.lift ?? 0) + bob, 3, 3 - bob, C.pants);
  rect(s, fx + 1, 19 - (pose.front?.lift ?? 0) + bob, 3, 3 - bob, C.pants);
  skate(bx, pose.back?.lift ?? 0, false);
  skate(fx, pose.front?.lift ?? 0, true);
  // Back glove (behind the body)
  ellipse(s, 4.5, 15.5 + bob, 1.6, 1.6, C.shade);
  // Body: round jersey with a trim stripe
  ellipse(s, 10, 16 + bob, 5.2, 4.2, (x, y, dx, dy) => {
    if (Math.abs(y + 0.5 - (18 + bob)) < 0.6) return C.trim;
    return dx < -0.45 || dy > 0.6 ? C.shade : C.main;
  });
  // Front glove, holding the stick
  ellipse(s, 15.5, 16.5 + bob, 1.7, 1.7, C.shade);
  head(s, C, 10, 7.5 + bob, mood);
  outline(s, C.ink);
  return s.toCanvas();
}

const POSES = {
  glide: { bob: 0, back: { dx: 0 }, front: { dx: 0 } },
  pushA: { bob: 1, back: { dx: -3, lift: 1 }, front: { dx: 1 } },
  pushB: { bob: 0, back: { dx: -1 }, front: { dx: 2, lift: 1 } },
};

const cache = new Map();

/** Frames: right/left[0..3] skating, plus happy, dizzy and blink variants. */
export function skaterSprites(team) {
  let s = cache.get(team);
  if (s) return s;
  const right = [bakeSkater(team, POSES.glide, 'normal'), bakeSkater(team, POSES.pushA, 'normal'), bakeSkater(team, POSES.glide, 'normal'), bakeSkater(team, POSES.pushB, 'normal')];
  const extra = {
    happy: bakeSkater(team, POSES.glide, 'happy'),
    dizzy: bakeSkater(team, POSES.glide, 'dizzy'),
    blink: bakeSkater(team, POSES.glide, 'blink'),
  };
  s = {
    right,
    left: right.map(mirror),
    happyRight: extra.happy, happyLeft: mirror(extra.happy),
    dizzyRight: extra.dizzy, dizzyLeft: mirror(extra.dizzy),
    blinkRight: extra.blink, blinkLeft: mirror(extra.blink),
  };
  cache.set(team, s);
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

function bakeGoalie(team, down) {
  const s = new Surface(GOALIE_W, 28);
  const C = colorsFor(team);
  const pad = rgba(PAL.white), padShade = rgba(PAL.cloud);
  const drop = down ? 5 : 0;
  // Leg pads with two team-coloured bands
  const legPad = (x, y, w, h, horizontal) => {
    rect(s, x, y, w, h, pad);
    rect(s, x, y + h - 1, w, 1, padShade);
    if (horizontal) { rect(s, x + 2, y, 1, h, C.main); rect(s, x + w - 3, y, 1, h, C.main); }
    else { rect(s, x, y + 2, w, 1, C.main); rect(s, x, y + h - 4, w, 1, C.main); }
  };
  if (down) { legPad(1, 22, 10, 4, true); legPad(13, 22, 10, 4, true); }
  else { legPad(5, 17, 6, 9, false); legPad(13, 17, 6, 9, false); }
  // Chest protector
  ellipse(s, 12, 15 + drop, 7.2, 5.2, (x, y, dx, dy) => (dx < -0.5 || dy > 0.6 ? C.shade : C.main));
  rect(s, 6, 17 + drop, 13, 1, C.trim);
  // Blocker (left) and catch glove (right)
  ellipse(s, 3, 14.5 + drop, 2.4, 3, C.shade);
  ellipse(s, 21, 14 + drop, 2.8, 2.8, C.shade);
  s.set(21, 13 + drop, C.trim);
  // Stick paddle in front of the pads
  rect(s, 5, down ? 21 : 25, 8, 1, rgba(PAL.woodDark));
  // White mask with a team stripe over the top only
  head(s, C, 12, 6.5 + drop, 'normal', { helmet: rgba(PAL.white), helmetShade: rgba(PAL.cloud), cage: true });
  for (let y = drop; y < 4 + drop; y++) rect(s, 11, y, 2, 1, C.main);
  outline(s, C.ink);
  return s.toCanvas();
}

const goalieCache = new Map();

export function goalieSprites(team) {
  let s = goalieCache.get(team);
  if (s) return s;
  const right = bakeGoalie(team, false);
  const down = bakeGoalie(team, true);
  s = { right, left: mirror(right), downRight: down, downLeft: mirror(down) };
  goalieCache.set(team, s);
  return s;
}
