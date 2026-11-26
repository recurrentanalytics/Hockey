// Hand-made pixel-art skater, recoloured per team. Facing right; left is mirrored.
import { PAL } from '../engine/palette.js';
import { Surface, rgba, makeCanvas } from '../engine/raster.js';

// Legend: o outline · H/h helmet · c cage · s/S skin · J/j jersey · T trim · G glove
//         P/p pants · L sock · K boot · k boot highlight · F frame · W wheel
const UPPER = [
  '.....oooo.....',
  '....oHHHHo....',
  '...oHHHHHHo...',
  '...ohHHHHcco..',
  '...ohhHHscco..',
  '....oohssco...',
  '...ooJJJJoo...',
  '..oJJJJJJJJo..',
  '.oJJJJJJJJJJo.',
  '.oJjJJJJJJGGGo',
  '.oJjTTTTTJGGGo',
  '.oJjJJJJJJoGo.',
  '.ojjJJJJJJo...',
  '.ojTTTTTTTo...',
  '..oPPPPPPPo...',
  '.oPPPPPPPPPo..',
  '.opPPPPPPPPo..',
];

const LEGS = {
  glide: [
    '.oppPo.oPPPo..',
    '..oLLo..oLLo..',
    '..oLLo...oLLo.',
    '.oLLo....oLLo.',
    '.oKKo....oKKo.',
    'oKkKKo..oKkKKo',
    'oooooo..oooooo',
    '.FFFF....FFFF.',
    '.WWWW....WWWW.',
  ],
  pushA: [
    '.oppPo.oPPPo..',
    '.oLLo...oLLo..',
    'oLLo.....oLLo.',
    'LLo......oLLo.',
    'Ko.......oKKo.',
    'kKo.....oKkKKo',
    'oo......oooooo',
    'F........FFFF.',
    'W........WWWW.',
  ],
  pushB: [
    '.oppPo.oPPPo..',
    '..oLLo..oLLo..',
    '..oLLo...oLLo.',
    '..oLLo....oLLo',
    '..oKKo....oKKo',
    '.oKkKKo..oKkKK',
    '.oooooo..ooooo',
    '..FFFF....FFFF',
    '..WWWW....WWWW',
  ],
};

export const SPRITE_W = 22;
export const SPRITE_H = 26;
export const ANCHOR_X = 7;   // between the skates
export const ANCHOR_Y = 25;  // wheel contact row

function paletteFor(team) {
  return {
    o: PAL.ink, c: PAL.mist, s: PAL.skin, S: PAL.skinShade,
    H: team.helmet, h: team.helmetShade, J: team.main, j: team.shade, T: team.trim,
    G: team.shade, P: team.pants, p: team.pantsShade, L: team.main,
    K: PAL.shadow, k: PAL.steel, F: PAL.mist, W: PAL.yellow,
  };
}

function bakeFrame(team, legs) {
  const s = new Surface(SPRITE_W, SPRITE_H);
  const pal = paletteFor(team);
  const colors = Object.fromEntries(Object.entries(pal).map(([k, v]) => [k, rgba(v)]));
  const rows = [...UPPER, ...LEGS[legs]];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = colors[row[x]];
      if (c) s.set(x, y, c);
    }
  });
  // The stick is drawn live by the skater so it can aim, wind up and poke.
  // Re-draw the glove over the shaft so the hands hold it.
  s.set(11, 10, colors.G); s.set(12, 10, colors.G);
  return s.toCanvas();
}

function mirror(canvas) {
  const m = makeCanvas(canvas.width, canvas.height);
  const g = m.getContext('2d');
  g.translate(canvas.width, 0);
  g.scale(-1, 1);
  g.drawImage(canvas, 0, 0);
  return m;
}

const cache = new Map();

/** Animation frames: [glide, pushA, glide, pushB] for both facings. */
export function skaterSprites(team) {
  let s = cache.get(team);
  if (s) return s;
  const right = [bakeFrame(team, 'glide'), bakeFrame(team, 'pushA'), bakeFrame(team, 'glide'), bakeFrame(team, 'pushB')];
  s = { right, left: right.map(mirror) };
  cache.set(team, s);
  return s;
}

let shadowCanvas = null;
export function shadowSprite() {
  if (shadowCanvas) return shadowCanvas;
  const s = new Surface(14, 5);
  const c = rgba(PAL.ink, 90);
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 14; x++) {
      const dx = (x + 0.5 - 7) / 7, dy = (y + 0.5 - 2.5) / 2.5;
      if (dx * dx + dy * dy <= 1) s.set(x, y, c);
    }
  }
  shadowCanvas = s.toCanvas();
  return shadowCanvas;
}

// ---------------------------------------------------------------- goalie
// D = leg pad, d = pad stripe (team colour), B = blocker, G = catch glove, M = mask
const GOALIE = [
  '......oooo.......',
  '.....oMMMMo......',
  '....oMMMMMMo.....',
  '....oMMMccco.....',
  '....ohMMccco.....',
  '...ooJJJJJoo.....',
  '..oJJJJJJJJJo....',
  '.oJJJJJJJJJJJo...',
  'oBBoJJTTTTJoGGGo.',
  'oBBoJjJJJJJoGGGGo',
  'oBBoJjJJJJJoGGGo.',
  '.oo.oJJJJJo..ooo.',
  '...oPPPPPPPo.....',
  '..oDDDoooDDDo....',
  '..oDdDo.oDdDo....',
  '.oDDdDo.oDdDDo...',
  '.oDDdDo.oDdDDo...',
  '.oDDdDo.oDdDDo...',
  '.oDDDDo.oDDDDo...',
  '.oKKKKo.oKKKKo...',
  '.oooooo.oooooo...',
  '..FFFF...FFFF....',
  '..WWWW...WWWW....',
];
// Butterfly: knees down, pads flared flat along the floor.
const GOALIE_DOWN = [
  '', '', '', '', '', '', '',           // dropped 7 px lower than standing
  ...GOALIE.slice(0, 12),
  '...oPPPPPPPo.....',
  'oDDdDDDoDDDdDDDo.',
  'oDDdDDDoDDDdDDDo.',
  'oooooooooooooooo.',                  // row 22 = floor, same anchor as standing
];
export const GOALIE_W = 18;
export const GOALIE_ANCHOR_X = 7;
export const GOALIE_ANCHOR_Y = 22;

const goalieCache = new Map();

export function goalieSprites(team) {
  let s = goalieCache.get(team);
  if (s) return s;
  const pal = {
    ...paletteFor(team),
    M: PAL.white, D: PAL.white, d: team.main, B: PAL.cloud, G: team.shade,
  };
  const colors = Object.fromEntries(Object.entries(pal).map(([k, v]) => [k, rgba(v)]));
  const bake = (rows, stick) => {
    const surf = new Surface(GOALIE_W, 24);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const c = colors[row[x]];
        if (c) surf.set(x, y, c);
      }
    });
    const shaft = rgba(PAL.wood), blade = rgba(PAL.ink);
    stick(surf, shaft, blade);
    return surf.toCanvas();
  };
  // Stand-up: paddle down in front of the pads. Butterfly: paddle flat across the five-hole.
  const right = bake(GOALIE, (s, shaft, blade) => { s.line(2, 11, 3, 19, shaft); s.rect(3, 20, 7, 2, blade); });
  const down = bake(GOALIE_DOWN, (s, shaft, blade) => { s.line(2, 15, 5, 19, shaft); s.rect(5, 20, 7, 1, blade); });
  s = { right, left: mirror(right), downRight: down, downLeft: mirror(down) };
  goalieCache.set(team, s);
  return s;
}
