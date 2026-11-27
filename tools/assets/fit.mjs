#!/usr/bin/env node
// Local steps between a generated image and a game-ready sprite. No packages needed.
//
//   node tools/assets/fit.mjs shrink   <in.png> <out.png> <factor>          nearest-neighbour downscale by a whole factor
//   node tools/assets/fit.mjs frame    <in.png> <out.png> <w> <h> [colors]  trim, centre on the bottom edge of a w×h frame, reduce colours
//   node tools/assets/fit.mjs strip    <in.png> <out.png> <frames> <w> <h> [colors] [pick]
//                                      cut a horizontal sheet into frames, put every frame on the same ground line;
//                                      pick = comma-separated frame numbers to keep, e.g. 0,2,4,6
//   node tools/assets/fit.mjs preview  <out.png> <scale> <in.png>...        contact sheet on a light and a dark background
//   node tools/assets/fit.mjs sheet    <folder> [scale]                     numbered selection sheet (sheet.png) of a candidates folder
import fs from 'node:fs';
import { decodePng, encodePng } from './png.mjs';

const read = (f) => decodePng(fs.readFileSync(f));
const write = (f, im) => fs.writeFileSync(f, encodePng(im.width, im.height, im.data));
const blank = (width, height) => ({ width, height, data: new Uint8Array(width * height * 4) });
const at = (im, x, y) => (y * im.width + x) * 4;

/** Bounding box of the visible pixels, or null for an empty image. */
export function bounds(im, x0 = 0, x1 = im.width) {
  let minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
  for (let y = 0; y < im.height; y++) for (let x = x0; x < x1; x++) {
    if (im.data[at(im, x, y) + 3] > 0) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  }
  return maxX < 0 ? null : { minX, maxX, minY, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Copy a rectangle of `src` into `dst` at (dx, dy); transparent pixels are skipped. */
export function blit(dst, src, sx, sy, w, h, dx, dy) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = dx + x, Y = dy + y;
    if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
    const s = at(src, sx + x, sy + y);
    if (src.data[s + 3] > 0) dst.data.set(src.data.subarray(s, s + 4), at(dst, X, Y));
  }
}

/** Nearest-neighbour downscale by a whole factor, sampling the middle of each block. */
export function shrink(im, f) {
  const out = blank(Math.floor(im.width / f), Math.floor(im.height / f));
  const mid = Math.floor(f / 2);
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) {
    const s = at(im, x * f + mid, y * f + mid);
    out.data.set(im.data.subarray(s, s + 4), at(out, x, y));
  }
  return out;
}

/** Hard alpha, then merge the most similar colours until at most `max` remain (no dithering). */
export function reduceColors(im, max) {
  const count = new Map();
  for (let i = 0; i < im.data.length; i += 4) {
    im.data[i + 3] = im.data[i + 3] >= 128 ? 255 : 0;
    if (!im.data[i + 3]) { im.data[i] = im.data[i + 1] = im.data[i + 2] = 0; continue; }
    const k = (im.data[i] << 16) | (im.data[i + 1] << 8) | im.data[i + 2];
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  let cols = [...count].map(([k, n]) => ({ r: k >> 16, g: (k >> 8) & 255, b: k & 255, n, from: [k] }));
  const dist = (a, b) => (a.r - b.r) ** 2 * 2 + (a.g - b.g) ** 2 * 4 + (a.b - b.b) ** 2 * 3;
  while (cols.length > max) {
    // Merge the two most similar colours; the more common one keeps its exact value.
    let bi = 0, bj = 1, bd = Infinity;
    for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) {
      const d = dist(cols[i], cols[j]);
      if (d < bd) { bd = d; bi = i; bj = j; }
    }
    const [keep, drop] = cols[bi].n >= cols[bj].n ? [cols[bi], cols[bj]] : [cols[bj], cols[bi]];
    keep.n += drop.n;
    keep.from.push(...drop.from);
    cols.splice(cols.indexOf(drop), 1);
  }
  const map = new Map();
  for (const c of cols) for (const k of c.from) map.set(k, c);
  for (let i = 0; i < im.data.length; i += 4) {
    if (!im.data[i + 3]) continue;
    const c = map.get((im.data[i] << 16) | (im.data[i + 1] << 8) | im.data[i + 2]);
    im.data[i] = c.r; im.data[i + 1] = c.g; im.data[i + 2] = c.b;
  }
  return im;
}

/** Trim and stand the sprite centred on the bottom edge of a w×h frame. */
export function frame(im, w, h) {
  const b = bounds(im);
  if (!b) throw new Error('image is empty');
  if (b.w > w || b.h > h) throw new Error(`content is ${b.w}x${b.h}, larger than the ${w}x${h} frame`);
  const out = blank(w, h);
  blit(out, im, b.minX, b.minY, b.w, b.h, Math.floor((w - b.w) / 2), h - b.h);
  return out;
}

/**
 * Cut a horizontal sheet into `frames` equal cells and rebuild it as a strip of w×h frames
 * that all stand on the bottom edge. Horizontal placement keeps the sheet's own motion:
 * every frame is shifted by the same amount, taken from the centre of all frames together.
 */
export function strip(im, frames, w, h, pick = null) {
  const cw = im.width / frames;
  if (!Number.isInteger(cw)) throw new Error(`sheet width ${im.width} does not divide into ${frames} frames`);
  const keep = pick ?? Array.from({ length: frames }, (_, i) => i);
  const boxes = keep.map((f) => bounds(im, f * cw, (f + 1) * cw));
  if (boxes.some((b) => !b)) throw new Error('a frame is empty');
  const left = Math.min(...boxes.map((b, i) => b.minX - keep[i] * cw)), right = Math.max(...boxes.map((b, i) => b.maxX - keep[i] * cw));
  const tall = Math.max(...boxes.map((b) => b.h));
  if (right - left + 1 > w || tall > h) throw new Error(`frames need ${right - left + 1}x${tall}, larger than ${w}x${h}`);
  const shift = Math.floor((w - (right - left + 1)) / 2) - left;
  const out = blank(w * keep.length, h);
  boxes.forEach((b, i) => blit(out, im, b.minX, b.minY, b.w, b.h, i * w + (b.minX - keep[i] * cw) + shift, h - b.h));
  return out;
}

/** Contact sheet at `scale`× on a light and a dark background. */
export function preview(images, scale) {
  const pad = 6, rowH = Math.max(...images.map((i) => i.height)) * scale + pad;
  const out = blank(images.reduce((a, i) => a + i.width * scale + pad, pad), rowH * 2 + pad);
  const bgs = [[236, 230, 214], [40, 44, 66]];
  for (let y = 0; y < out.height; y++) for (let x = 0; x < out.width; x++) out.data.set([...bgs[y < rowH + pad / 2 ? 0 : 1], 255], at(out, x, y));
  let ox = pad;
  for (const im of images) {
    for (let r = 0; r < 2; r++) for (let y = 0; y < im.height * scale; y++) for (let x = 0; x < im.width * scale; x++) {
      const s = at(im, Math.floor(x / scale), Math.floor(y / scale));
      if (im.data[s + 3] > 0) out.data.set([im.data[s], im.data[s + 1], im.data[s + 2], 255], at(out, ox + x, pad + r * rowH + y));
    }
    ox += im.width * scale + pad;
  }
  return out;
}

const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];

/**
 * Numbered selection sheet for a folder of candidates: every image at `scale`× on a light
 * and a dark background, with its number above it, plus a row at native size.
 */
export function sheet(images, scale) {
  const pad = 8, label = 14, cell = Math.max(...images.map((i) => i.width)) * scale + pad;
  const tall = Math.max(...images.map((i) => i.height));
  const rowH = tall * scale + pad, nativeH = tall + pad;
  const out = blank(cell * images.length + pad, label + rowH * 2 + nativeH + pad);
  const fill = (x0, y0, w, h, c) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) out.data.set([...c, 255], at(out, x, y)); };
  fill(0, 0, out.width, label + rowH, [236, 230, 214]);
  fill(0, label + rowH, out.width, rowH, [40, 44, 66]);
  fill(0, label + rowH * 2, out.width, nativeH + pad, [150, 160, 176]);
  images.forEach((im, n) => {
    const x0 = pad + n * cell;
    [...String(n + 1)].forEach((ch, k) => {
      for (let i = 0; i < 15; i++) if (DIGITS[+ch][i] === '1') fill(x0 + k * 8 + (i % 3) * 2, 3 + Math.floor(i / 3) * 2, 2, 2, [42, 29, 26]);
    });
    for (let r = 0; r < 2; r++) for (let y = 0; y < im.height * scale; y++) for (let x = 0; x < im.width * scale; x++) {
      const s = at(im, Math.floor(x / scale), Math.floor(y / scale));
      if (im.data[s + 3] > 0) out.data.set([im.data[s], im.data[s + 1], im.data[s + 2], 255], at(out, x0 + x, label + r * rowH + (tall - im.height) * scale + y));
    }
    blit(out, im, 0, 0, im.width, im.height, x0, label + rowH * 2 + pad / 2 + tall - im.height);
  });
  return out;
}

if (process.argv[1]?.endsWith('fit.mjs')) {
  const [cmd, a, b, ...rest] = process.argv.slice(2);
  const n = rest.map(Number);
  if (cmd === 'shrink') write(b, shrink(read(a), n[0]));
  else if (cmd === 'frame') { const im = frame(read(a), n[0], n[1]); write(b, n[2] ? reduceColors(im, n[2]) : im); }
  else if (cmd === 'strip') { const im = strip(read(a), n[0], n[1], n[2], rest[4] ? rest[4].split(',').map(Number) : null); write(b, n[3] ? reduceColors(im, n[3]) : im); }
  else if (cmd === 'preview') write(a, preview(rest.slice(0).map(read), Number(b)));
  else if (cmd === 'sheet') {
    // sheet <folder> [scale]: numbers the PNGs of a candidates folder in name order and writes sheet.png there
    const files = fs.readdirSync(a).filter((f) => f.endsWith('.png') && f !== 'sheet.png').sort();
    write(`${a}/sheet.png`, sheet(files.map((f) => read(`${a}/${f}`)), Number(b) || 4));
    files.forEach((f, i) => console.log(`${i + 1}  ${f}`));
  }
  else { console.error('usage: fit.mjs shrink|frame|strip|preview … (see the header of this file)'); process.exit(2); }
}
