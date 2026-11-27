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
  // German umlauts: two dots on top of a squeezed letter
  'Ä': '#.#/.#./#.#/###/#.#', 'Ö': '#.#/.../###/#.#/###', 'Ü': '#.#/.../#.#/#.#/###',
};

// 5×7 font for menus, headings and banners.
const BIG = {
  'A': '.###./#...#/#...#/#####/#...#/#...#/#...#',
  'B': '####./#...#/#...#/####./#...#/#...#/####.',
  'C': '.###./#...#/#..../#..../#..../#...#/.###.',
  'D': '####./#...#/#...#/#...#/#...#/#...#/####.',
  'E': '#####/#..../#..../####./#..../#..../#####',
  'F': '#####/#..../#..../####./#..../#..../#....',
  'G': '.###./#...#/#..../#.###/#...#/#...#/.####',
  'H': '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  'I': '.###./..#../..#../..#../..#../..#../.###.',
  'J': '..###/...#./...#./...#./...#./#..#./.##..',
  'K': '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  'L': '#..../#..../#..../#..../#..../#..../#####',
  'M': '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  'N': '#...#/#...#/##..#/#.#.#/#..##/#...#/#...#',
  'O': '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  'P': '####./#...#/#...#/####./#..../#..../#....',
  'Q': '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  'R': '####./#...#/#...#/####./#.#../#..#./#...#',
  'S': '.####/#..../#..../.###./....#/....#/####.',
  'T': '#####/..#../..#../..#../..#../..#../..#..',
  'U': '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  'V': '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  'W': '#...#/#...#/#...#/#.#.#/#.#.#/#.#.#/.#.#.',
  'X': '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  'Y': '#...#/#...#/.#.#./..#../..#../..#../..#..',
  'Z': '#####/....#/...#./..#../.#.../#..../#####',
  '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  '1': '..#../.##../..#../..#../..#../..#../.###.',
  '2': '.###./#...#/....#/...#./..#../.#.../#####',
  '3': '####./....#/....#/.###./....#/....#/####.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
  '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '..##./.#.../#..../####./#...#/#...#/.###.',
  '7': '#####/....#/...#./..#../.#.../.#.../.#...',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
  '9': '.###./#...#/#...#/.####/....#/...#./.##..',
  '.': '...../...../...../...../...../.##../.##..',
  ',': '...../...../...../...../.##../..#../.#...',
  ':': '...../.##../.##../...../.##../.##../.....',
  ';': '...../.##../.##../...../.##../..#../.#...',
  '-': '...../...../...../.###./...../...../.....',
  '!': '..#../..#../..#../..#../..#../...../..#..',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  '/': '....#/...#./...#./..#../.#.../.#.../#....',
  "'": '..#../..#../...../...../...../...../.....',
  '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
  ')': '.#.../..#../...#./...#./...#./..#../.#...',
  '+': '...../..#../..#../#####/..#../..#../.....',
  '<': '...#./..#../.#.../#..../.#.../..#../...#.',
  '>': '.#.../..#../...#./....#/...#./..#../.#...',
  '=': '...../...../#####/...../#####/...../.....',
  '%': '##..#/##.#./...#./..#../.#.../.#.##/#..##',
  '&': '.##../#..#./#.#../.#.../#.#.#/#..#./.##.#',
  '*': '...../#.#.#/.###./#####/.###./#.#.#/.....',
  '#': '.#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.',
  '_': '...../...../...../...../...../...../#####',
  '"': '.#.#./.#.#./...../...../...../...../.....',
  '^': '..#../.#.#./#...#/...../...../...../.....',
  '[': '.###./.#.../.#.../.#.../.#.../.#.../.###.',
  ']': '.###./...#./...#./...#./...#./...#./.###.',
  '|': '..#../..#../..#../..#../..#../..#../..#..',
  '~': '...../...../.#.../#.#.#/...#./...../.....',
  'Ä': '.#.#./...../.###./#...#/#####/#...#/#...#',
  'Ö': '.#.#./...../.###./#...#/#...#/#...#/.###.',
  'Ü': '.#.#./...../#...#/#...#/#...#/#...#/.###.',
};

const CHARS = Object.keys(GLYPHS);
const BIG_CHARS = Object.keys(BIG);
const BIG_INDEX = new Map(BIG_CHARS.map((c, i) => [c, i]));
const INDEX = new Map(CHARS.map((c, i) => [c, i]));
const atlases = new Map();

function bigAtlas(color) {
  const key = 'big:' + color;
  let a = atlases.get(key);
  if (a) return a;
  a = makeCanvas(BIG_CHARS.length * 5, 7);
  const g = a.getContext('2d');
  g.fillStyle = color;
  BIG_CHARS.forEach((ch, i) => {
    BIG[ch].split('/').forEach((row, y) => {
      for (let x = 0; x < 5; x++) if (row[x] === '#') g.fillRect(i * 5 + x, y, 1, 1);
    });
  });
  atlases.set(key, a);
  return a;
}

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

export function textWidth(text, scale = 1, big = false) {
  if (HI?.ctx && measure) return hiresWidth(String(text).toUpperCase(), scale, big);
  const n = String(text).length;
  return n ? (n * (big ? 6 : ADVANCE) - 1) * scale : 0;
}

function run(ctx, text, x, y, color, scale, big) {
  if (big) {
    const a = bigAtlas(color);
    for (let i = 0; i < text.length; i++) {
      const idx = BIG_INDEX.get(text[i]);
      if (idx !== undefined) ctx.drawImage(a, idx * 5, 0, 5, 7, x + i * 6 * scale, y, 5 * scale, 7 * scale);
    }
    return;
  }
  const a = atlas(color);
  for (let i = 0; i < text.length; i++) {
    const idx = INDEX.get(text[i]);
    if (idx !== undefined) ctx.drawImage(a, idx * 3, 0, 3, 5, x + i * ADVANCE * scale, y, 3 * scale, 5 * scale);
  }
}

/** Draw text at integer pixel positions. Returns its width. */
export function drawText(ctx, text, x, y, { color = '#fffaf4', scale = 1, align = 'left', shadow = null, big = false } = {}) {
  text = String(text).toUpperCase();
  if (HI.ctx && ctx === HI.ui) {
    const w = textWidth(text, scale, big);
    const sx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const c = hiresBegin(ctx, scale, big), by = baseline(y, scale, big);
    if (shadow) { c.fillStyle = shadow; c.fillText(text, sx + 0.7 * scale, by + 0.7 * scale); }
    c.fillStyle = color; c.fillText(text, sx, by);
    c.restore();
    return w;
  }
  const w = textWidth(text, scale, big);
  let sx = align === 'center' ? x - Math.floor(w / 2) : align === 'right' ? x - w : x;
  sx = Math.round(sx);
  y = Math.round(y);
  if (shadow) run(ctx, text, sx + scale, y + scale, shadow, scale, big);
  run(ctx, text, sx, y, color, scale, big);
  return w;
}

/** Truncate text to fit a pixel width. */
export function fitText(text, maxWidth, scale = 1, big = false) {
  text = String(text);
  while (text.length > 1 && textWidth(text, scale, big) > maxWidth) text = text.slice(0, -1);
  return text;
}

/** Chunky title text: an outline all around, a drop shadow, then the fill. */
export function drawTextOutlined(ctx, text, x, y, { color = '#fffaf4', outline = '#2a1f3d', shadow = null, scale = 1, align = 'left', big = false } = {}) {
  if (HI.ctx && ctx === HI.ui) {
    text = String(text).toUpperCase();
    const w = textWidth(text, scale, big);
    const sx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    const c = hiresBegin(ctx, scale, big), by = baseline(y, scale, big);
    c.lineJoin = 'round'; c.lineWidth = 2.2 * scale;
    if (shadow) { c.strokeStyle = shadow; c.fillStyle = shadow; c.strokeText(text, sx, by + 1.6 * scale); c.fillText(text, sx, by + 1.6 * scale); }
    c.strokeStyle = outline; c.strokeText(text, sx, by);
    c.fillStyle = color; c.fillText(text, sx, by);
    c.restore();
    return w;
  }
  const o = scale;
  const ring = [[-o, 0], [o, 0], [0, -o], [0, o], [-o, -o], [o, -o], [-o, o], [o, o]];
  // Solid drop shadow: the outlined shape again, a little lower, in the shadow colour.
  if (shadow) for (const [dx, dy] of [[0, 0], ...ring]) drawText(ctx, text, x + dx, y + dy + o * 2, { color: shadow, scale, align, big });
  for (const [dx, dy] of ring) drawText(ctx, text, x + dx, y + dy, { color: outline, scale, align, big });
  return drawText(ctx, text, x, y, { color, scale, align, big });
}

// ------------------------------------------------------------------ high-resolution text
// Text on the UI layer is drawn with real fonts (Fredoka, Luckiest Guy; assets/fonts) on a
// full-resolution canvas laid over the pixel layers, so menus, HUD and banners are crisp and
// playful. Text on other canvases (world layer, baked sprites) keeps the pixel font.
const HI = { ui: null, ctx: null, base: null };
/** Called by Display: the UI layer context, the full-resolution text context and its scale. */
export function setHiresText(uiCtx, textCtx, scale) {
  HI.ui = uiCtx; HI.ctx = textCtx; HI.base = new DOMMatrix().scale(scale, scale);
}
const measure = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
const fontFor = (scale, big) => (big ? `${9.5 * scale}px "Luckiest Guy", Fredoka, sans-serif` : `700 ${7.2 * scale}px Fredoka, sans-serif`);
const hiresOn = () => !!HI.ctx;
function hiresWidth(text, scale, big) { measure.font = fontFor(scale, big); return Math.ceil(measure.measureText(text).width); }
function hiresBegin(ctx, scale, big) {
  const c = HI.ctx;
  c.save();
  c.setTransform(HI.base.multiply(ctx.getTransform()));
  c.globalAlpha = ctx.globalAlpha;
  c.font = fontFor(scale, big);
  c.textBaseline = 'alphabetic';
  return c;
}
const baseline = (y, scale, big) => y + (big ? 7.4 : 5.4) * scale; // pixel glyphs are top-aligned

/** BORSTENBOOM! logo, the same lettering everywhere: yellow BORSTEN over a bigger red BOOM!. */
export function drawLogo(ctx, cx, top, height, { lines = 2 } = {}) {
  if (!hiresOn() || ctx !== HI.ui) return drawText(ctx, 'BORSTENBOOM!', cx, top, { big: true, scale: 2, align: 'center', color: '#ffd23f' });
  const c = HI.ctx;
  c.save();
  c.setTransform(HI.base.multiply(ctx.getTransform()));
  c.globalAlpha = ctx.globalAlpha;
  c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round';
  const draw = (text, x, y, size, fill) => {
    c.font = `${size}px "Luckiest Guy", sans-serif`;
    c.lineWidth = size * 0.2; c.strokeStyle = '#16110d';
    c.fillStyle = '#16110d'; c.fillText(text, x + size * 0.06, y + size * 0.1); // drop shadow
    c.strokeText(text, x + size * 0.06, y + size * 0.1);
    c.strokeText(text, x, y);
    const g = c.createLinearGradient(0, y - size * 0.8, 0, y);
    g.addColorStop(0, fill[0]); g.addColorStop(1, fill[1]);
    c.fillStyle = g; c.fillText(text, x, y);
  };
  c.translate(cx, top + height / 2); c.rotate(-0.045); c.translate(-cx, -(top + height / 2));
  if (lines === 2) {
    draw('BORSTEN', cx, top + height * 0.44, height * 0.42, ['#fff3a8', '#ffc21a']);
    draw('BOOM!', cx, top + height * 0.98, height * 0.56, ['#ff7a6b', '#e8243c']);
  } else {
    draw('BORSTEN', cx - height * 0.95, top + height * 0.86, height * 0.86, ['#fff3a8', '#ffc21a']);
    draw('BOOM!', cx + height * 2.2, top + height * 0.92, height, ['#ff7a6b', '#e8243c']);
  }
  c.restore();
  return 0;
}
