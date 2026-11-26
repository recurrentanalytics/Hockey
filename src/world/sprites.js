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

function bakeFrame(team, legs, stickDrop = 0) {
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
  // Stick: from the glove down to the blade on the floor.
  const shaft = rgba(PAL.wood), shaftDark = rgba(PAL.woodDark), blade = rgba(PAL.ink), tape = rgba(PAL.white);
  s.line(12, 11, 16, 22 + stickDrop, shaftDark);
  s.line(13, 11, 17, 22 + stickDrop, shaft);
  s.line(17, 23, 17, 24, blade);
  s.line(17, 25, 21, 25, blade);
  s.set(19, 25, tape);
  s.set(20, 25, tape);
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
