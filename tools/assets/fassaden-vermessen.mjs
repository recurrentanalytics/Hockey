#!/usr/bin/env node
// Measures where the windows, doors, shop windows and cornices of every façade kit are
// (assets/welt/haeuser/bausaetze.json) and writes them into the kit as pixel rectangles.
// The façades are pictures; this makes them know their parts, so later steps (lit windows at night,
// real window recesses, other renderers) need not guess. See docs/art/HAEUSER.md, "Bauteile".
//
//   node tools/assets/fassaden-vermessen.mjs                 print what it finds
//   node tools/assets/fassaden-vermessen.mjs --schreiben     write it into bausaetze.json
//   node tools/assets/fassaden-vermessen.mjs --bild out.png  draw the found parts over the façades, for checking
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, encodePng } from './png.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const KITS = path.join(ROOT, 'assets/welt/haeuser/bausaetze.json');

const lum = (d, i) => 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
/** Window glass: dark, or mid-dark and clearly bluer than a shadow on the blue wall; never brick, wood or a green shop front. */
const glas = (d, i) => d[i + 3] > 0 && d[i + 2] >= d[i + 1] - 4 && ((lum(d, i) < 80 && d[i + 2] >= d[i] - 6) || (lum(d, i) < 125 && d[i + 2] >= 1.3 * d[i]));

/** Connected patches of `ist` pixels inside a box; each as [x0, y0, x1, y1, count] (x1, y1 exclusive). */
function flecken(bild, [bx0, by0, bx1, by1], ist) {
  const { width: w, data: d } = bild, seen = new Uint8Array(w * bild.height), aus = [];
  for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) {
    const p = y * w + x;
    if (seen[p] || !ist(d, p * 4)) continue;
    const st = [p]; seen[p] = 1; let n = 0, x0 = x, x1 = x, y0 = y, y1 = y;
    while (st.length) {
      const q = st.pop(), qx = q % w, qy = (q - qx) / w; n++;
      x0 = Math.min(x0, qx); x1 = Math.max(x1, qx); y0 = Math.min(y0, qy); y1 = Math.max(y1, qy);
      for (const [nx, ny] of [[qx - 1, qy], [qx + 1, qy], [qx, qy - 1], [qx, qy + 1]]) {
        if (nx < bx0 || nx >= bx1 || ny < by0 || ny >= by1) continue;
        const r = ny * w + nx;
        if (!seen[r] && ist(d, r * 4)) { seen[r] = 1; st.push(r); }
      }
    }
    aus.push([x0, y0, x1 + 1, y1 + 1, n]);
  }
  return aus;
}
const vereint = (fl) => fl.length ? [Math.min(...fl.map((f) => f[0])), Math.min(...fl.map((f) => f[1])), Math.max(...fl.map((f) => f[2])), Math.max(...fl.map((f) => f[3]))] : null;

/** Grow a glass box outward by its light frame (at most 3 pixels a side). */
function rahmen(bild, [x0, y0, x1, y1], zelle) {
  const { width: w, data: d } = bild, hell = (x, y) => lum(d, (y * w + x) * 4) > 165;
  const anteil = (xs, ys) => { let n = 0, k = 0; for (const y of ys) for (const x of xs) { k++; if (hell(x, y)) n++; } return n / k; };
  const r = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
  for (let i = 0; i < 3 && x0 > zelle[0] && anteil([x0 - 1], r(y0, y1)) > 0.6; i++) x0--;
  for (let i = 0; i < 3 && x1 < zelle[2] && anteil([x1], r(y0, y1)) > 0.6; i++) x1++;
  for (let i = 0; i < 3 && y0 > zelle[1] && anteil(r(x0, x1), [y0 - 1]) > 0.6; i++) y0--;
  for (let i = 0; i < 3 && y1 < zelle[3] && anteil(r(x0, x1), [y1]) > 0.6; i++) y1++;
  return [x0, y0, x1, y1];
}

const box = ([x0, y0, x1, y1]) => [x0, y0, x1 - x0, y1 - y0]; // stored as x, y, width, height

/** The parts of one façade, in picture pixels over its whole width (edge and door pieces included). */
export function vermesse(bild, f) {
  const { data: d, width: w } = bild, z = f.zeilen, unten = z.length - 2;
  const wand = f.wand.match(/\w\w/g).map((h) => parseInt(h, 16)), weg = (i) => Math.abs(d[i] - wand[0]) + Math.abs(d[i + 1] - wand[1]) + Math.abs(d[i + 2] - wand[2]);
  const oeffnungen = [];
  const runs = (zahl, von, bis, min, spalt) => { const aus = []; let a = -1, leer = 0;
    for (let i = von; i <= bis; i++) { const ja = i < bis && zahl(i) >= min;
      if (ja) { if (a < 0) a = i; leer = 0; } else if (a >= 0 && (++leer > spalt || i === bis)) { aus.push([a, i - leer + 1]); a = -1; leer = 0; } }
    return aus; };
  const laengster = (r) => r.sort((p, q) => (q[1] - q[0]) - (p[1] - p[0]))[0];
  // the door: in the middle piece of the ground floor, the columns that are dark and not wall for half the
  // storey, then the rows that are so across them
  const [ma, mb] = f.mitte, gy0 = z[unten], gy1 = z[unten + 1];
  const tuerig = (x, y) => { const i = (y * w + x) * 4; return d[i + 3] > 0 && lum(d, i) < 125 && weg(i) > 60; };
  const tx = laengster(runs((x) => { let n = 0; for (let y = gy0; y < gy1; y++) if (tuerig(x, y)) n++; return n; }, ma, mb, 0.45 * (gy1 - gy0), 2));
  const ty = tx && laengster(runs((y) => { let n = 0; for (let x = tx[0]; x < tx[1]; x++) if (tuerig(x, y)) n++; return n; }, gy0, gy1, 0.5 * (tx[1] - tx[0]), 2));
  const tuer = tx && ty && ty[1] - ty[0] >= 0.4 * (gy1 - gy0) ? rahmen(bild, [tx[0], ty[0], tx[1], ty[1]], [ma, gy0, mb, gy1]) : null;
  // windows. The window axes of the upper storeys are one grid: the columns that hold glass, counted over all
  // upper storeys (so a curtain, a light pane or a balcony in one of them hides nothing), joined over the bars.
  // The ground floor (shops, the door, a different rhythm) has its own. Per storey and axis, the rows of glass
  // give the window, grown by its light frame.
  const ist = (x, y) => glas(d, (y * w + x) * 4) && !(tuer && y >= gy0 && x >= tuer[0] && x < tuer[2]);
  const zaehleX = (x, ya, yb) => { let n = 0; for (let y = ya; y < yb; y++) if (ist(x, y)) n++; return n; };
  // the axes: columns with glass, joined over the bars; one far wider than the others (a balcony railing in
  // front) is cut down with a stricter count, a narrow one (the dark edge of the house) is no window
  function spalten(r0, r1, min) {
    let a = runs((x) => zaehleX(x, z[r0], z[r1]), 0, w, min, 2).filter(([p, q]) => q - p >= 4);
    const median = () => [...a].map(([p, q]) => q - p).sort((p, q) => p - q)[Math.floor(a.length / 2)];
    for (let k = 0; k < 8 && a.some(([p, q]) => q - p > 1.5 * median()); k++) {
      const m = median();
      a = a.flatMap(([p, q]) => q - p > 1.5 * m ? runs((x) => zaehleX(x, z[r0], z[r1]), p, q, min * (k + 2), 2).filter(([u, v]) => v - u >= 4) : [[p, q]]);
    }
    const m = median();
    a = a.filter(([p, q]) => q - p >= 0.6 * m && q - p <= 1.5 * m);
    // windows hidden by curtains on every storey: fill the regular rhythm of the axes (gaps of two or three
    // spacings, and one more at either end inside the front); whether a window is there is checked per storey
    // two axes closer than two window widths are one window and something in front of it (a balcony): keep the wider
    a = a.filter(([p, q], i) => !a.some(([u, v], j) => j !== i && Math.abs((u + v) / 2 - (p + q) / 2) < 2 * m && (v - u > q - p || (v - u === q - p && j < i))));
    // the spacing: the smallest step between the axes left (gaps are multiples of it)
    let mitten = a.map(([p, q]) => (p + q) / 2);
    const abst = Math.min(...mitten.slice(1).map((c, i) => c - mitten[i]));
    if (!Number.isFinite(abst)) return a;
    mitten = a.map(([p, q]) => (p + q) / 2);
    const neu = [], halb = (q) => [Math.round(q - m / 2), Math.round(q - m / 2) + m];
    for (let i = 1; i < mitten.length; i++) { const k = Math.round((mitten[i] - mitten[i - 1]) / abst); if (k >= 2 && k <= 3 && Math.abs((mitten[i] - mitten[i - 1]) / k - abst) < 0.2 * abst) for (let j = 1; j < k; j++) neu.push(halb(mitten[i - 1] + j * (mitten[i] - mitten[i - 1]) / k)); }
    for (const q of [mitten[0] - abst, mitten.at(-1) + abst]) { const [p2, q2] = halb(q); if (p2 >= f.links[0] && q2 <= f.rechts[1]) neu.push([p2, q2]); }
    return [...a.map((x) => [...x, true]), ...neu.map((x) => [...x, false])].sort((p, q) => p[0] - q[0]);
  }
  const raster = [[0, unten, spalten(0, unten, 2 * unten)], [unten, unten + 1, spalten(unten, unten + 1, 3)]];
  for (const [r0, r1, achsen] of raster) for (let r = r0; r < r1; r++) {
    const y0 = z[r], y1 = z[r + 1];
    // the storey's window height, from the glass of all its axes together
    const zeile = (y) => achsen.filter(([a, e]) => { for (let x = a; x < e; x++) if (ist(x, y)) return true; return false; }).length;
    const hoch = laengster(runs(zeile, y0, y1, Math.max(1, 0.3 * achsen.length), 3));
    if (!hoch || hoch[1] - hoch[0] < 6) continue;
    const gemessen = achsen.filter((x) => x[2]), breit = gemessen.map(([a, e]) => e - a).sort((p, q) => p - q)[Math.floor(gemessen.length / 2)];
    const keineWand = (a, e) => { let n = 0; for (let y = hoch[0]; y < hoch[1]; y++) for (let x = a; x < e; x++) if (weg((y * w + x) * 4) > 35) n++; return n / ((e - a) * (hoch[1] - hoch[0])); };
    const hell = (x) => { if (x < 0 || x >= w) return false; let n = 0; for (let y = hoch[0]; y < hoch[1]; y++) if (lum(d, (y * w + x) * 4) > 165) n++; return n >= 0.7 * (hoch[1] - hoch[0]); };
    for (let [a, e, sicher] of achsen) {
      if (tuer && r === unten && a < tuer[2] && e > tuer[0]) continue; // the door's place
      if (sicher && e - a < 0.85 * breit) { // a curtain hides a pane: open the axis to the light frames that give the usual width
        let best = [a, e];
        for (let L = a - 1; L >= a - 1.3 * breit; L--) if (L === a - 1 || hell(L)) for (let R = e; R <= e + 1.3 * breit; R++) if (R === e || hell(R))
          if (Math.abs(R - L - 1 - breit) < Math.abs(best[1] - best[0] - breit)) best = [L + 1, R];
        [a, e] = best;
      }
      let n = 0; for (let y = hoch[0]; y < hoch[1]; y++) for (let x = a; x < e; x++) if (ist(x, y)) n++;
      // a window: glass, or (curtains, a blind) a box that is not wall; else this axis has none in this storey
      if (n < 0.15 * (e - a) * (hoch[1] - hoch[0]) && keineWand(a, e) < 0.6) continue;
      const laden = r === unten && f.fuer.includes('laden');
      const g = [a, hoch[0], e, hoch[1]], art = !laden ? 'fenster' : e - a < 0.75 * Math.max(...gemessen.map(([p, q]) => q - p)) ? 'ladentuer' : 'schaufenster';
      oeffnungen.push({ art, geschoss: unten - r, ...teile(box(rahmen(bild, g, [0, y0, w, y1])), box(g)) });
    }
  }
  if (tuer) oeffnungen.push({ art: 'tuer', geschoss: 0, ...teile(box(tuer), null) });
  // cornices: bands of rows that run across the front in trim, light and neither wall nor glass
  const [l, rr] = [f.links[0], f.rechts[1]], gesimse = [];
  const zier = (i) => d[i + 3] > 0 && lum(d, i) > 140 && weg(i) > 45 && !glas(d, i);
  let von = -1, luecke = 0;
  for (let y = 0; y <= f.hoehe; y++) {
    let n = 0; if (y < f.hoehe) for (let x = l; x < rr; x++) if (zier((y * w + x) * 4)) n++;
    const ja = y < f.hoehe && n / (rr - l) > 0.85;
    if (ja) { if (von < 0) von = y; luecke = 0; }
    else if (von >= 0 && ++luecke > 1) { gesimse.push([von, y - luecke + 1]); von = -1; luecke = 0; }
  }
  return { oeffnungen, gesimse };
}
function teile([x, y, b, h], g) { return g ? { x, y, b, h, glas: g } : { x, y, b, h }; }

/** bausaetze.json in its readable shape: one line per façade field group, one line per part. */
export function formatiere(saetze) {
  const j = (v) => JSON.stringify(v);
  const fass = saetze.fassaden.map((f) => {
    const { oeffnungen, gesimse, ...rest } = f, felder = Object.entries(rest).map(([k, v]) => `${j(k)}: ${j(v)}`);
    const zeilen = [`      ${felder.join(', ')}`];
    if (gesimse) zeilen.push(`      "gesimse": ${j(gesimse)}`);
    if (oeffnungen) zeilen.push(`      "oeffnungen": [\n${oeffnungen.map((o) => `        ${j(o)}`).join(',\n')}\n      ]`);
    return `    {\n${zeilen.join(',\n')}\n    }`;
  });
  const oben = Object.entries(saetze).map(([k, v]) => k === 'fassaden' ? `  "fassaden": [\n${fass.join(',\n')}\n  ]` : `  ${j(k)}: ${j(v)}`);
  return `{\n${oben.join(',\n')}\n}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), saetze = JSON.parse(fs.readFileSync(KITS, 'utf8'));
  const bilder = saetze.fassaden.map((f) => decodePng(fs.readFileSync(path.join(path.dirname(KITS), f.datei))));
  saetze.fassaden.forEach((f, i) => {
    const m = vermesse(bilder[i], f), zahl = (a) => m.oeffnungen.filter((o) => o.art === a).length;
    console.log(`${f.id.padEnd(11)} Fenster ${zahl('fenster')}, Schaufenster ${zahl('schaufenster')}, Tür ${zahl('tuer')}, Gesimse ${m.gesimse.map((g) => g.join('–')).join(' ')}`);
    Object.assign(f, m);
  });
  if (args.includes('--schreiben')) { fs.writeFileSync(KITS, formatiere(saetze)); console.log('geschrieben:', path.relative(ROOT, KITS)); }
  const bildPfad = args.includes('--bild') ? args[args.indexOf('--bild') + 1] : null;
  if (bildPfad) { // every façade side by side, 3× enlarged, parts outlined: windows cyan, shop windows yellow, shop doors orange, doors magenta, cornices red
    const S = 3, B = Math.max(...bilder.map((b) => b.width)) + 4, W = B * bilder.length * S, H = Math.max(...bilder.map((b) => b.height)) * S, out = new Uint8Array(W * H * 4).fill(255);
    const setze = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H) out.set(c, (y * W + x) * 4); };
    bilder.forEach((b, k) => {
      for (let y = 0; y < b.height * S; y++) for (let x = 0; x < b.width * S; x++) { const s = (Math.floor(y / S) * b.width + Math.floor(x / S)) * 4; if (b.data[s + 3]) setze(k * B * S + x, y, [b.data[s], b.data[s + 1], b.data[s + 2], 255]); }
      const f = saetze.fassaden[k], rechteck = (x, y, w, h, c) => { for (let t = 0; t < 2; t++) { for (let i = 0; i < w * S; i++) { setze(k * B * S + x * S + i, y * S + t, c); setze(k * B * S + x * S + i, (y + h) * S - 1 - t, c); } for (let i = 0; i < h * S; i++) { setze(k * B * S + x * S + t, y * S + i, c); setze(k * B * S + (x + w) * S - 1 - t, y * S + i, c); } } };
      const farbe = { fenster: [0, 220, 255, 255], schaufenster: [255, 220, 0, 255], tuer: [255, 0, 255, 255], ladentuer: [255, 140, 0, 255] };
      for (const o of f.oeffnungen) rechteck(o.x, o.y, o.b, o.h, farbe[o.art]);
      for (const [a, e] of f.gesimse) rechteck(f.links[1], a, f.rechts[0] - f.links[1], e - a, [255, 40, 40, 255]);
    });
    fs.writeFileSync(bildPfad, encodePng(W, H, out)); console.log('Bild:', bildPfad);
  }
}
