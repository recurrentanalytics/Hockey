#!/usr/bin/env node
// The art library's front door: takes a generated image and does everything up to the game.
//
//   node tools/assets/library.mjs add <image.png> <id> [options]   fit, name, file, manifest entry (waiting for approval)
//   node tools/assets/library.mjs set <id> [options]               change placement or source of an entry
//   node tools/assets/library.mjs approve <id>...                  the owner's yes: the game uses it from now on
//   node tools/assets/library.mjs list                             what is in the library, and where it appears
//
// Options: --frame 84x84   frame size (default: the trimmed image, sides rounded up to even)
//          --frames 8      animation strip of that many frames (image = frames side by side)
//          --colors 32     colour limit            --density 2   pixels per world pixel (1 or 2)
//          --height 9      height in the world in metres
//          --place baeume:natural=tree    stand on every matching point of locations/<ort>/geo/<layer>.geojson
//          --court 1.2,0.5                stand at these court metres (axis a, axis b)
//          --asset <SpriteCook asset id>  --model <name>  --prompt docs/art/prompts/<file>.md
//
// The id decides folder and file name: kind.subject[.variant] → assets/<kind folder>/<subject>[/<variant>].png.
// Generation itself runs through the SpriteCook tools in a Claude session; from the download on it is this one command.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './png.mjs';
import { bounds, frame, strip, reduceColors } from './fit.mjs';
import { KINDS, validate } from './validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets');
const MANIFEST = path.join(ROOT, 'manifest.json');

export function fileFor(id) {
  const [kind, ...rest] = id.split('.');
  if (!KINDS[kind] || !rest.length) throw new Error(`id "${id}" must start with one of ${Object.keys(KINDS).join(', ')} and name a subject`);
  return `${KINDS[kind]}/${rest.join('/')}.png`;
}

export function parsePlace(opt) {
  if (opt.court) { const [a, b] = opt.court.split(',').map(Number); return { court: [a, b] }; }
  if (!opt.place) return undefined;
  const [layer, cond] = opt.place.split(':');
  return { layer, match: Object.fromEntries((cond ?? '').split(',').filter(Boolean).map((kv) => kv.split('='))) };
}

/** Fit `image` for the library and return { png, entry } without touching the disk. */
export function prepare(image, id, opt = {}) {
  const frames = Number(opt.frames ?? 1), density = Number(opt.density ?? 2), colors = Number(opt.colors ?? 32);
  let w, h;
  if (opt.frame) [w, h] = opt.frame.split('x').map(Number);
  else {
    const cw = image.width / frames;
    const boxes = Array.from({ length: frames }, (_, f) => bounds(image, f * cw, (f + 1) * cw));
    if (boxes.some((b) => !b)) throw new Error('the image (or one of its frames) is empty');
    w = Math.max(...boxes.map((b) => b.w)); h = Math.max(...boxes.map((b) => b.h));
    w += w % 2; h += h % 2;
  }
  const fitted = reduceColors(frames > 1 ? strip(image, frames, w, h) : frame(image, w, h), colors);
  const png = encodePng(fitted.width, fitted.height, fitted.data);
  const [kind] = id.split('.');
  const entry = { id, kind, file: fileFor(id), frame: { w, h }, frames, density, anchor: { x: Math.floor(w / 2), y: h - 1 } };
  if (opt.height) entry.worldHeight = Number(opt.height);
  const place = parsePlace(opt);
  if (place) entry.place = place;
  entry.source = opt.asset ? { asset_id: opt.asset, ...(opt.model && { model: opt.model }), ...(opt.prompt && { prompt: opt.prompt }) } : 'hand-drawn';
  entry.sha12 = crypto.createHash('sha256').update(png).digest('hex').slice(0, 12);
  return { png, entry };
}

const readManifest = () => JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const writeManifest = (m) => fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + '\n');
function options(args) {
  const opt = {}, rest = [];
  for (let i = 0; i < args.length; i++) (args[i].startsWith('--') ? (opt[args[i].slice(2)] = args[++i]) : rest.push(args[i]));
  return [opt, rest];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  const [opt, rest] = options(args);
  const m = readManifest();
  const find = (id) => { const a = m.assets.find((x) => x.id === id); if (!a) throw new Error(`no asset "${id}" in the manifest`); return a; };
  if (cmd === 'add') {
    const [src, id] = rest;
    const { png, entry } = prepare(decodePng(fs.readFileSync(src)), id, opt);
    const target = path.join(ROOT, entry.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, png);
    const at = m.assets.findIndex((x) => x.id === id);
    if (at >= 0) m.assets[at] = entry; else m.assets.push(entry); // a changed picture always loses its approval
    writeManifest(m);
    console.log(`${id}: ${entry.frame.w}x${entry.frame.h}${entry.frames > 1 ? ` x ${entry.frames}` : ''} → assets/${entry.file}, waiting for approval`);
  } else if (cmd === 'set') {
    const a = find(rest[0]);
    if (opt.height) a.worldHeight = Number(opt.height);
    const place = parsePlace(opt);
    if (place) a.place = place;
    if (opt.asset || opt.model || opt.prompt) a.source = { ...(typeof a.source === 'object' ? a.source : {}), ...(opt.asset && { asset_id: opt.asset }), ...(opt.model && { model: opt.model }), ...(opt.prompt && { prompt: opt.prompt }) };
    writeManifest(m);
    console.log(`${a.id}: updated`);
  } else if (cmd === 'approve') {
    const date = opt.date ?? new Date().toISOString().slice(0, 10);
    for (const id of rest) { find(id).approved = { date }; console.log(`${id}: approved ${date}`); }
    writeManifest(m);
  } else if (cmd === 'list') {
    for (const a of m.assets) {
      const where = a.place ? (a.place.court ? `court ${a.place.court.join(' / ')} m` : `${a.place.layer} where ${Object.entries(a.place.match).map((kv) => kv.join('=')).join(', ') || 'any'}`) : 'not placed';
      console.log(`${a.id.padEnd(36)} ${`${a.frame.w}x${a.frame.h}${a.frames > 1 ? ' x' + a.frames : ''}`.padEnd(11)} ${(a.approved ? 'approved ' + a.approved.date : 'waiting').padEnd(20)} ${where}${a.worldHeight ? `, ${a.worldHeight} m tall` : ''}`);
    }
  } else { console.error('usage: library.mjs add|set|approve|list … (see the header of this file)'); process.exit(2); }
  if (cmd !== 'list') {
    const { errors } = validate(ROOT);
    for (const e of errors) console.log('error    ' + e);
    if (errors.length) process.exit(1);
  }
}
