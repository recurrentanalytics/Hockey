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

/**
 * One skater frame, facing right.
 * pose: { bob, back: {dx, lift}, front: {dx, lift} }
 */
function bakeSkater(team, pose, mood, look = {}) {
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
  // Body: round jersey with team stripes and the team animal on the chest
  ellipse(s, 10, 16 + bob, 5.2, 4.2, (x, y, dx, dy) => {
    const row = y + 0.5 - (18 + bob);
    if (Math.abs(row) < 0.6) return C.trim;
    if (Math.abs(row - 1) < 0.6 && team.stripe) return C.stripe;
    return dx < -0.45 || dy > 0.6 ? C.shade : C.main;
  });
  emblem(s, team, 10, 13 + bob);
  // Front glove, holding the stick
  ellipse(s, 15.5, 16.5 + bob, 1.7, 1.7, C.shade);
  if (look.kind === 'boar') boarHead(s, C, 10, 7.5 + bob, mood);
  else if (look.kind === 'bald') baldHead(s, C, 10, 7.5 + bob, mood, look.hair ?? HAIR[0]);
  else {
    head(s, C, 10, 7.5 + bob, mood);
    if (look.hair) hair(s, 10, 7.5 + bob, look.hair);
  }
  outline(s, C.ink);
  return s.toCanvas();
}

const POSES = {
  glide: { bob: 0, back: { dx: 0 }, front: { dx: 0 } },
  pushA: { bob: 1, back: { dx: -3, lift: 1 }, front: { dx: 1 } },
  pushB: { bob: 0, back: { dx: -1 }, front: { dx: 2, lift: 1 } },
};

const cache = new Map();

/**
 * Frames: right/left[0..3] skating, plus happy, dizzy and blink variants.
 * look: { kind: 'human' | 'boar' | 'bald', hair: '#rrggbb' }
 */
export function skaterSprites(team, look = {}) {
  const key = `${team.key}|${look.kind ?? 'human'}|${look.hair ?? ''}`;
  let s = cache.get(key);
  if (s) return s;
  const bake = (pose, mood) => bakeSkater(team, pose, mood, look);
  const right = [bake(POSES.glide, 'normal'), bake(POSES.pushA, 'normal'), bake(POSES.glide, 'normal'), bake(POSES.pushB, 'normal')];
  const extra = { happy: bake(POSES.glide, 'happy'), dizzy: bake(POSES.glide, 'dizzy'), blink: bake(POSES.glide, 'blink') };
  s = {
    right,
    left: right.map(mirror),
    happyRight: extra.happy, happyLeft: mirror(extra.happy),
    dizzyRight: extra.dizzy, dizzyLeft: mirror(extra.dizzy),
    blinkRight: extra.blink, blinkLeft: mirror(extra.blink),
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
