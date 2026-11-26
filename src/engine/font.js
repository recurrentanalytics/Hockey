// 3×5 bitmap font. Glyph rows are separated by '/', '#' = pixel.
import { makeCanvas } from './raster.js';

const GLYPHS = {
  A: '###/#.#/###/#.#/#.#', B: '##./#.#/##./#.#/##.', C: '.##/#../#../#../.##', D: '##./#.#/#.#/#.#/##.',
  E: '###/#../##./#../###', F: '###/#../##./#../#..', G: '.##/#../#.#/#.#/.##', H: '#.#/#.#/###/#.#/#.#',
  I: '###/.#./.#./.#./###', J: '..#/..#/..#/#.#/.#.', K: '#.#/#.#/##./#.#/#.#', L: '#../#../#../#../###',
  M: '#.#/###/###/#.#/#.#', N: '##./#.#/#.#/#.#/#.#', O: '.#./#.#/#.#/#.#/.#.', P: '##./#.#/##./#../#..',
  Q: '.#./#.#/#.#/##./.##', R: '##./#.#/##./#.#/#.#', S: '.##/#../.#./..#/##.', T: '###/.#./.#./.#./.#.',
  U: '#.#/#.#/#.#/#.#/###', V: '#.#/#.#/#.#/.#./.#.', W: '#.#/#.#/###/###/#.#', X: '#.#/#.#/.#./#.#/#.#',
  Y: '#.#/#.#/.#./.#./.#.', Z: '###/..#/.#./#../###',
  0: '###/#.#/#.#/#.#/###', 1: '.#./##./.#./.#./###', 2: '##./..#/.#./#../###', 3: '##./..#/.#./..#/##.',
  4: '#.#/#.#/###/..#/..#', 5: '###/#../##./..#/##.', 6: '.##/#../###/#.#/###', 7: '###/..#/.#./.#./.#.',
  8: '###/#.#/###/#.#/###', 9: '###/#.#/###/..#/##.',
  '.': '.../.../.../.../.#.', ',': '.../.../.../.#./#..', ':': '.../.#./.../.#./...', ';': '.../.#./.../.#./#..',
  '-': '.../.../###/.../...', '+': '.../.#./###/.#./...', '/': '..#/..#/.#./#../#..', '!': '.#./.#./.#./.../.#.',
  '?': '##./..#/.#./.../.#.', "'": '.#./.#./.../.../...', '"': '#.#/#.#/.../.../...', '(': '..#/.#./.#./.#./..#',
  ')': '#../.#./.#./.#./#..', '[': '##./#../#../#../##.', ']': '.##/..#/..#/..#/.##', '<': '..#/.#./#../.#./..#',
  '>': '#../.#./..#/.#./#..', '=': '.../###/.../###/...', '%': '#.#/..#/.#./#../#.#', '_': '.../.../.../.../###',
  '#': '#.#/###/#.#/###/#.#', '*': '.../#.#/.#./#.#/...', '^': '.#./#.#/.../.../...', '&': '.#./#.#/.#./#.#/.##',
  '|': '.#./.#./.#./.#./.#.', '~': '.../.#./#.#/.../...',
};

const CHARS = Object.keys(GLYPHS);
const INDEX = new Map(CHARS.map((c, i) => [c, i]));
const atlases = new Map();

function atlas(color) {
  let a = atlases.get(color);
  if (a) return a;
  a = makeCanvas(CHARS.length * 3, 5);
  const g = a.getContext('2d');
  g.fillStyle = color;
  CHARS.forEach((ch, i) => {
    GLYPHS[ch].split('/').forEach((row, y) => {
      for (let x = 0; x < 3; x++) if (row[x] === '#') g.fillRect(i * 3 + x, y, 1, 1);
    });
  });
  atlases.set(color, a);
  return a;
}

export const LINE_HEIGHT = 6;
const ADVANCE = 4;

export function textWidth(text, scale = 1) {
  const n = String(text).length;
  return n ? (n * ADVANCE - 1) * scale : 0;
}

function run(ctx, text, x, y, color, scale) {
  const a = atlas(color);
  for (let i = 0; i < text.length; i++) {
    const idx = INDEX.get(text[i]);
    if (idx !== undefined) ctx.drawImage(a, idx * 3, 0, 3, 5, x + i * ADVANCE * scale, y, 3 * scale, 5 * scale);
  }
}

/** Draw text at integer pixel positions. Returns its width. */
export function drawText(ctx, text, x, y, { color = '#f5f6fb', scale = 1, align = 'left', shadow = null } = {}) {
  text = String(text).toUpperCase();
  const w = textWidth(text, scale);
  let sx = align === 'center' ? x - Math.floor(w / 2) : align === 'right' ? x - w : x;
  sx = Math.round(sx);
  y = Math.round(y);
  if (shadow) run(ctx, text, sx + scale, y + scale, shadow, scale);
  run(ctx, text, sx, y, color, scale);
  return w;
}

/** Truncate text to fit a pixel width. */
export function fitText(text, maxWidth, scale = 1) {
  text = String(text);
  while (text.length > 1 && textWidth(text, scale) > maxWidth) text = text.slice(0, -1);
  return text;
}
