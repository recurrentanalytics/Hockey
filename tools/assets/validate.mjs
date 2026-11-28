#!/usr/bin/env node
// Checks every art asset against assets/manifest.json: naming, size, transparency,
// animation frames and file hash. Run with `npm run assets:check`.
// The rules are described in docs/art/README.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decodePng } from './png.mjs';
import { ladeSchema, pruefeSchema } from './schema.mjs';

export const KINDS = { character: 'characters', equipment: 'equipment', prop: 'props', world: 'world', ui: 'ui', tile: 'tiles' };
const SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_FRAME = 128;        // px of the image, at either density
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
    if (a.density !== undefined && a.density !== 1 && a.density !== 2) err('density must be 1 or 2');
    // ---- a tree's pictures of the other seasons: the same frame, the same foot, each with its hash
    for (const [zeit, j] of Object.entries(a.jahreszeiten ?? {})) {
      if (!['fruehling', 'herbst', 'winter'].includes(zeit)) { err(`jahreszeiten: unknown season "${zeit}" (fruehling, herbst, winter; the asset's own file is the summer)`); continue; }
      if (frames !== 1) { err('jahreszeiten: only for still sprites'); continue; }
      if (typeof j?.file !== 'string') { err(`jahreszeiten.${zeit}: needs a file`); continue; }
      files.add(j.file);
      const voll = path.join(root, j.file);
      if (!fs.existsSync(voll)) { err(`jahreszeiten.${zeit}: file not found: ${j.file}`); continue; }
      const roh = fs.readFileSync(voll), hash = crypto.createHash('sha256').update(roh).digest('hex').slice(0, 12);
      if (j.sha12 !== hash) err(`jahreszeiten.${zeit}: sha12 is ${j.sha12 ?? 'missing'} but the file hashes to ${hash}`);
      let bild;
      try { bild = decodePng(roh); } catch (e) { err(`jahreszeiten.${zeit}: ${e.message}`); continue; }
      if (bild.width !== fw || bild.height !== fh) { err(`jahreszeiten.${zeit}: image is ${bild.width}x${bild.height}, the asset's frame is ${fw}x${fh}`); continue; }
      const st = frameStats(bild, fw, fh, 1)[0];
      if (st.count === 0) err(`jahreszeiten.${zeit}: the picture is empty`);
      else if (Math.abs(st.bottom - stats[0].bottom) > 1) err(`jahreszeiten.${zeit}: stands on row ${st.bottom}, the summer picture on row ${stats[0].bottom}: the tree would jump`);
      let halb = 0; for (let i = 3; i < bild.data.length; i += 4) if (bild.data[i] > 0 && bild.data[i] < 255) halb++;
      if (halb) err(`jahreszeiten.${zeit}: ${halb} half-transparent pixels (pixel art has none)`);
      if (!j.source) warn(`jahreszeiten.${zeit}: no "source" recorded`);
    }
    if (!a.approved) warn('waiting for the owner\'s approval: the game does not use it yet');
    else if (typeof a.approved.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.approved.date)) err('approved needs a date (YYYY-MM-DD)');
    if (!a.source) warn('no "source" recorded (SpriteCook asset_id, model and prompt id, or "hand-drawn")');
  }

  // Only the art library's own folders are policed; assets/ also holds app icons, fonts, intro data and voice.
  const library = new Set(Object.values(KINDS));
  for (const f of listPngs(root)) if (library.has(f.split('/')[0]) && !files.has(f)) errors.push(`${f}: PNG is not listed in manifest.json`);
  return { errors, warnings, checked: assets.length };
}

const ARTEN = ['fenster', 'schaufenster', 'tuer'];

/**
 * The world view's kits under `root/welt`: the house kits (haeuser/bausaetze.json) and the ground
 * (boden/boden.json). Every picture is there, as large as its entry says and unchanged (sha12); every
 * pixel size is the one world scale (welt/massstab.json); the façade parts (doors, windows, cornices)
 * lie in the picture and in their storey; the house kits fit schema/bausatz.schema.json. Rules: docs/art/HAEUSER.md.
 */
export function validateWelt(root) {
  const errors = [], warnings = [], dir = path.join(root, 'welt');
  const lies = (rel) => { try { return JSON.parse(fs.readFileSync(path.join(dir, rel), 'utf8')); } catch (e) { errors.push(`welt/${rel}: ${fs.existsSync(path.join(dir, rel)) ? 'not valid JSON: ' + e.message : 'missing'}`); return null; } };
  const massstab = lies('massstab.json'), haus = lies('haeuser/bausaetze.json'), boden = lies('boden/boden.json');
  if (!massstab || !haus || !boden) return { errors, warnings, checked: 0 };
  const schemaFehler = pruefeSchema(ladeSchema('bausatz.schema.json'), haus);
  for (const e of schemaFehler) errors.push(`welt/haeuser/bausaetze.json${e} (schema/bausatz.schema.json)`);
  if (schemaFehler.length) return { errors, warnings, checked: 0 }; // the finer checks below rely on the shape
  const px = massstab.px_je_m, gelistet = new Set();
  if (!(px > 0)) errors.push('welt/massstab.json: px_je_m is missing');
  /** A picture of a kit: present, the size its entry says, the hash it was checked in with. */
  const bild = (ordner, tag, e) => {
    const rel = `${ordner}/${e.datei}`, voll = path.join(dir, rel), err = (m) => errors.push(`welt/${rel} (${tag}): ${m}`);
    gelistet.add(rel);
    if (!fs.existsSync(voll)) { err('file not found'); return null; }
    const bytes = fs.readFileSync(voll), sha12 = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 12);
    if (e.sha12 !== sha12) err(`sha12 is ${e.sha12 ?? 'missing'} but the file hashes to ${sha12}`);
    let img; try { img = decodePng(bytes); } catch (x) { err(x.message); return null; }
    if (img.width !== e.breite || img.height !== e.hoehe) err(`image is ${img.width}x${img.height}, the entry says ${e.breite}x${e.hoehe}`);
    if (!e.asset_id) warnings.push(`welt/${rel} (${tag}): no SpriteCook asset_id recorded`);
    return img;
  };
  const mass = (tag, wert) => { if (Math.abs(wert / px - 1) > 0.05) errors.push(`${tag}: ${wert.toFixed(2)} px per metre, the world scale is ${px} (welt/massstab.json)`); };

  // ---- houses
  mass('welt/haeuser ziegel', haus.ziegel.px_je_m); mass('welt/haeuser putz', haus.putz.px_je_m); mass('welt/haeuser teile', haus.teile.px_je_m);
  bild('haeuser', 'ziegel', haus.ziegel); bild('haeuser', 'putz', haus.putz);
  for (const [name, t] of Object.entries(haus.teile)) if (t && typeof t === 'object') bild('haeuser', name, t);
  for (const f of haus.fassaden) {
    const tag = `welt/haeuser ${f.id}`, err = (m) => errors.push(`${tag}: ${m}`);
    bild('haeuser', f.id, f);
    mass(tag, f.hoehe / haus.hoehe_m);
    const z = f.zeilen;
    if (z?.length !== haus.geschosse + 1 || z[0] !== 0 || z.at(-1) !== f.hoehe) err(`zeilen must run from 0 to ${f.hoehe} in ${haus.geschosse} storeys`);
    for (const [a, b] of [f.links, ...f.achsen, ...(f.achsenRechts ?? []), f.mitte, f.rechts]) if (!(a >= 0 && b <= f.breite && b > a)) err(`piece [${a}, ${b}] does not lie in the picture`);
    if (!f.oeffnungen) { err('no parts measured (oeffnungen): run node tools/assets/fassaden-vermessen.mjs --schreiben'); continue; }
    const drin = ([x, y, b, h]) => x >= 0 && y >= 0 && b > 0 && h > 0 && x + b <= f.breite && y + h <= f.hoehe;
    for (const o of f.oeffnungen) {
      const r = haus.geschosse - 1 - o.geschoss, wo = `${o.art} at ${o.x},${o.y}`;
      if (!ARTEN.includes(o.art)) err(`${wo}: art must be one of ${ARTEN.join(', ')}`);
      if (!drin([o.x, o.y, o.b, o.h])) err(`${wo}: does not lie in the picture`);
      else if (!(r >= 0 && r < haus.geschosse && o.y >= z[r] && o.y + o.h <= z[r + 1])) err(`${wo}: does not lie in storey ${o.geschoss} (rows ${z[r]}–${z[r + 1]})`);
      if (o.glas && (!drin(o.glas) || o.glas[0] < o.x || o.glas[1] < o.y || o.glas[0] + o.glas[2] > o.x + o.b || o.glas[1] + o.glas[3] > o.y + o.h)) err(`${wo}: the glass is not inside the window`);
    }
    const tueren = f.oeffnungen.filter((o) => o.art === 'tuer');
    if (tueren.length !== 1) err(`${tueren.length} doors, a kit has one`);
    else if (tueren[0].x + tueren[0].b <= f.mitte[0] || tueren[0].x >= f.mitte[1]) err('the door is not in the middle piece (mitte)');
    if (!f.oeffnungen.some((o) => o.art !== 'tuer')) err('no windows');
    if ((f.gesimse ?? []).some(([a, b], i, g) => !(a >= 0 && b <= f.hoehe && b > a && (i === 0 || a >= g[i - 1][1])))) err('gesimse must be ascending bands inside the picture');
  }
  // ---- ground
  mass('welt/boden', boden.px_je_m);
  for (const [name, t] of Object.entries(boden.texturen)) bild('boden', name, t);

  for (const ordner of ['haeuser', 'boden']) for (const f of listPngs(path.join(dir, ordner))) if (!gelistet.has(`${ordner}/${f}`)) errors.push(`welt/${ordner}/${f}: PNG is not listed in its kit`);
  if (!/freigegeben am/i.test(haus.stand)) warnings.push('welt/haeuser: waiting for the owner\'s approval (stand)');
  if (!/freigegeben am/i.test(boden.stand)) warnings.push('welt/boden: waiting for the owner\'s approval (stand)');
  return { errors, warnings, checked: gelistet.size };
}

/** Pixels per metre of every placed sprite of the art library, against the stage scale (buehne_px_je_m). */
export function massstabBericht(root) {
  const mass = JSON.parse(fs.readFileSync(path.join(root, 'welt/massstab.json'), 'utf8')), px = mass.buehne_px_je_m ?? mass.px_je_m;
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
  return manifest.assets.filter((a) => a.worldHeight && a.frame).map((a) => ({ id: a.id, pxJeM: a.frame.h / a.worldHeight, faktor: a.frame.h / a.worldHeight / px }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? 'assets');
  if (process.argv.includes('--massstab')) {
    for (const z of massstabBericht(root)) console.log(`${z.id.padEnd(42)} ${z.pxJeM.toFixed(1).padStart(6)} px/m  ${z.faktor.toFixed(1)}× die Bühne`);
    process.exit(0);
  }
  const bib = validate(root), welt = fs.existsSync(path.join(root, 'welt/massstab.json')) ? validateWelt(root) : { errors: [], warnings: [], checked: 0 };
  const errors = [...bib.errors, ...welt.errors], warnings = [...bib.warnings, ...welt.warnings], checked = bib.checked + welt.checked;
  for (const w of warnings) console.log(`warning  ${w}`);
  for (const e of errors) console.log(`error    ${e}`);
  console.log(`${checked} asset${checked === 1 ? '' : 's'} checked: ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`);
  process.exit(errors.length ? 1 : 0);
}
