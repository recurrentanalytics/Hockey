#!/usr/bin/env node
// Checks every art asset against assets/manifest.json: naming, size, transparency,
// animation frames and file hash. Run with `npm run assets:check`.
// The rules are described in docs/art/README.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodePng } from './png.mjs';

export const KINDS = { character: 'characters', equipment: 'equipment', prop: 'props', world: 'world', ui: 'ui', tile: 'tiles' };
const SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_FRAME = 128;        // px; the game renders at 216 px height
const DEFAULT_MAX_COLORS = 32;

function listPngs(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listPngs(p, base);
    return e.name.toLowerCase().endsWith('.png') ? [path.relative(base, p).split(path.sep).join('/')] : [];
  });
}

/** Per-frame facts of a horizontal strip: opaque pixel count and lowest opaque row. */
function frameStats(img, fw, fh, frames) {
  return Array.from({ length: frames }, (_, f) => {
    let count = 0, bottom = -1;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      if (img.data[(y * img.width + f * fw + x) * 4 + 3] > 0) { count++; bottom = y; }
    }
    return { count, bottom };
  });
}

/** Validate the asset library under `root` (the folder holding manifest.json). */
export function validate(root) {
  const errors = [], warnings = [];
  const file = path.join(root, 'manifest.json');
  if (!fs.existsSync(file)) return { errors: ['manifest.json is missing'], warnings, checked: 0 };
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return { errors: [`manifest.json is not valid JSON: ${e.message}`], warnings, checked: 0 }; }
  const assets = manifest.assets;
  if (!Array.isArray(assets)) return { errors: ['manifest.json needs an "assets" list'], warnings, checked: 0 };

  const ids = new Set(), files = new Set();
  for (const a of assets) {
    const tag = a.id ?? a.file ?? '(unnamed asset)';
    const err = (msg) => errors.push(`${tag}: ${msg}`);
    const warn = (msg) => warnings.push(`${tag}: ${msg}`);

    // ---- naming and folders
    if (typeof a.id !== 'string' || !a.id.split('.').every((s) => SEGMENT.test(s)) || a.id.split('.').length < 2) err('id must look like "kind.subject[.variant]" in lower-case kebab-case');
    else if (ids.has(a.id)) err('duplicate id');
    ids.add(a.id);
    const folder = KINDS[a.kind];
    if (!folder) { err(`kind must be one of ${Object.keys(KINDS).join(', ')}`); }
    if (typeof a.file !== 'string') { err('file is missing'); continue; }
    if (files.has(a.file)) err(`file is used by more than one asset: ${a.file}`);
    files.add(a.file);
    const parts = a.file.split('/');
    const name = parts.at(-1);
    if (!name.endsWith('.png') || !parts.slice(0, -1).every((s) => SEGMENT.test(s)) || !SEGMENT.test(name.slice(0, -4))) err(`file path must be lower-case kebab-case and end in .png: ${a.file}`);
    if (folder && parts[0] !== folder) err(`a ${a.kind} belongs in ${folder}/, not ${parts[0]}/`);
    if (folder && a.id?.split('.')[0] !== a.kind) err(`id must start with its kind "${a.kind}."`);

    // ---- declared geometry
    const fw = a.frame?.w, fh = a.frame?.h, frames = a.frames ?? 1;
    if (!Number.isInteger(fw) || !Number.isInteger(fh) || fw < 1 || fh < 1) { err('frame {w, h} must be whole pixel sizes'); continue; }
    if (!Number.isInteger(frames) || frames < 1) { err('frames must be a whole number of at least 1'); continue; }
    if (fw > MAX_FRAME || fh > MAX_FRAME) err(`frame ${fw}x${fh} is larger than the engine limit of ${MAX_FRAME} px`);
    if (a.anchor && !(a.anchor.x >= 0 && a.anchor.x < fw && a.anchor.y >= 0 && a.anchor.y < fh)) err('anchor lies outside the frame');
    if ((a.kind === 'character' || a.kind === 'world' || a.kind === 'prop') && !a.anchor) err('anchor {x, y} (ground contact point) is required for this kind');

    // ---- the image itself
    const full = path.join(root, a.file);
    if (!fs.existsSync(full)) { err(`file not found: ${a.file}`); continue; }
    const bytes = fs.readFileSync(full);
    const sha12 = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    if (a.sha12 !== sha12) err(`sha12 is ${a.sha12 ?? 'missing'} but the file hashes to ${sha12}`);
    let img;
    try { img = decodePng(bytes); } catch (e) { err(e.message); continue; }
    if (img.width !== fw * frames || img.height !== fh) { err(`image is ${img.width}x${img.height}, expected ${fw * frames}x${fh} (${frames} frame${frames > 1 ? 's' : ''} of ${fw}x${fh} side by side)`); continue; }

    // ---- transparency and colours
    let clear = 0, soft = 0;
    const colors = new Set();
    for (let i = 0; i < img.data.length; i += 4) {
      const al = img.data[i + 3];
      if (al === 0) clear++;
      else { if (al < 255) soft++; colors.add((img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2]); }
    }
    const opaqueKind = a.kind === 'tile' || a.opaque === true;
    if (!opaqueKind) {
      if (clear === 0) err('no transparent pixels: the background was not removed');
      const corners = [0, fw * frames - 1, (fh - 1) * img.width, fh * img.width - 1].filter((i) => img.data[i * 4 + 3] > 0).length;
      if (clear > 0 && corners === 4) err('all four corners are opaque: looks like a leftover background');
    }
    if (soft > 0 && a.softAlpha !== true) err(`${soft} half-transparent pixel${soft > 1 ? 's' : ''}: pixel art needs hard edges (alpha 0 or 255)`);
    const maxColors = a.maxColors ?? DEFAULT_MAX_COLORS;
    if (colors.size > maxColors) err(`${colors.size} colours, limit is ${maxColors}: quantise to the project palette`);

    // ---- animation frames
    const stats = frameStats(img, fw, fh, frames);
    stats.forEach((s, i) => { if (s.count === 0) err(`frame ${i} is empty`); });
    if (frames > 1 && stats.every((s) => s.count > 0)) {
      const bottoms = stats.map((s) => s.bottom);
      if (a.grounded !== false && Math.max(...bottoms) - Math.min(...bottoms) > 1) err(`ground line jumps between frames (lowest rows ${bottoms.join(', ')}): the sprite would bob`);
      const counts = stats.map((s) => s.count), mean = counts.reduce((x, y) => x + y, 0) / frames;
      if (Math.max(...counts) > mean * 1.5 || Math.min(...counts) < mean * 0.6) warn(`frame sizes differ a lot (opaque pixels ${counts.join(', ')}): check for scale drift`);
    }
    if (a.anchor && stats[0].count > 0 && Math.abs(stats[0].bottom - a.anchor.y) > 2) warn(`anchor row ${a.anchor.y} is not at the sprite's lowest row ${stats[0].bottom}`);
    if (!a.source) warn('no "source" recorded (SpriteCook asset_id, model and prompt id, or "hand-drawn")');
  }

  for (const f of listPngs(root)) if (!files.has(f)) errors.push(`${f}: PNG is not listed in manifest.json`);
  return { errors, warnings, checked: assets.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? 'assets');
  const { errors, warnings, checked } = validate(root);
  for (const w of warnings) console.log(`warning  ${w}`);
  for (const e of errors) console.log(`error    ${e}`);
  console.log(`${checked} asset${checked === 1 ? '' : 's'} checked: ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
  process.exit(errors.length ? 1 : 0);
}
