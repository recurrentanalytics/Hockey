// The rules of a house, engine-neutral: every ALKIS footprint becomes a house with eaves, a roof, a wall colour,
// storeys, window axes, a shop front or a gateway, dressed with the façade kits (assets/welt/haeuser/bausaetze.json),
// and a mesh of plain arrays (netz). Everything follows from the geodata and fixed rules, so the same data always
// gives the same street, in any tool. No CesiumJS, no DOM: this runs in Node, the browser and any later adapter
// (glTF, Godot). The CesiumJS drawing is src/welt/haeuser.js; tests/referenz/viertel.json holds what these rules
// build for the real quarter (tools/test/viertel-referenz.mjs).
//
// Units: metres in the place's grid, relative to the court centre (east, north, up). Walls and roofs
// carry their own coordinates in metres.
import { streuung } from './streuung.js';

export const ETAGE = 3.2, DACHETAGE = 2.8;     // as tools/ort/geodaten.py estimated the heights
export const ERDGESCHOSS = 3.6, DURCHFAHRT = 3.2, ACHSE = 1.7; // ground floor, clear height of a gateway, width of a window axis
export const KONTUR = '#2a1d1a';
/** Wall and roof colours of the List: few, warm, and each with a name the click text can show. */
export const PUTZ = [['Cremeweiß', '#efe2c4'], ['Sand', '#e3cf9f'], ['Ocker', '#d9b56e'], ['Altrosa', '#d9a79a'], ['Salbei', '#b5c2a0'],
  ['Taubenblau', '#9fb1c4'], ['Hellgrau', '#d8d4cc'], ['Elfenbein', '#f1e9d6'], ['Lachs', '#dfae8c']];
export const KLINKER = [['Klinkerrot', '#a84a32'], ['Gelbklinker', '#c9a468']];
export const NEBENBAU = [['Graubraun', '#b9a48f'], ['Putzgrau', '#c4bdb0'], ['Backstein', '#a8684f']];
export const ZIEGEL = [['Ziegelrot', '#b9553a'], ['Ziegel dunkel', '#a24a35'], ['Ziegel hell', '#c46544'], ['Braun', '#8f5b45'], ['Schiefer', '#5a5a60']];
export const FLACHDACH = [['Bitumen', '#5d5a57'], ['Kies', '#8f8b86']];

// what a surface is; 0 to 6 are drawn by rule, 7 to 11 show sprites: a façade picture, a cut-out part, plaster, roof tiles, a flat roof;
// 12 is a railing of iron bars, drawn by rule and open between the bars
const ARTEN = { strasse: 0, hof: 1, brandwand: 2, tunnel: 3, ziegel: 4, flachdach: 5, untersicht: 6, bild: 7, teil: 8, putz: 9, ziegelbild: 10, flachbild: 11, gelaender: 12 };
const ECKE_L = 16, ECKE_R = 32, KLINKER_BIT = 64, OFFEN = 128;
const EG = { wohnen: 0, laden: 1, schule: 2, neben: 3 };
const DACHFORM = { gabled: 'sattel', hipped: 'walm', quadruple_saltbox: 'walm', flat: 'flach' };

// ------------------------------------------------------------------ plane geometry

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const kreuz = (a, b) => a[0] * b[1] - a[1] * b[0];
const mal = (a, b) => a[0] * b[0] + a[1] * b[1];
const gleich = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

/** Signed area of an open ring: positive when it runs counter-clockwise. */
export const flaeche = (ring) => { let s = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length]; s += p[0] * q[1] - q[0] * p[1]; } return s / 2; };

/** An open ring without doubled points, running counter-clockwise (or clockwise for a hole). */
export function saeubere(ring, gegenUhr = true) {
  const r = [];
  for (const p of ring) { const q = r[r.length - 1]; if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.01) r.push([p[0], p[1]]); }
  if (r.length > 1 && Math.hypot(r[0][0] - r[r.length - 1][0], r[0][1] - r[r.length - 1][1]) <= 0.01) r.pop();
  if ((flaeche(r) > 0) !== gegenUhr) r.reverse();
  return r;
}

export const imRing = ([x, y], ring) => { let d = false; for (let i = 0; i < ring.length; i++) { const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length]; if ((y1 > y) !== (y2 > y) && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) d = !d; } return d; };

/** The smallest rectangle round a ring: centre, unit axis `u` along its long side, `v` across, half sizes. */
export function rechteck(ring) {
  let best = null;
  const probe = (ux, uy) => {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const q of ring) { const x = q[0] * ux + q[1] * uy, y = -q[0] * uy + q[1] * ux; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const a = (x1 - x0) * (y1 - y0);
    if (!best || a < best.a - 1e-9) best = { a, ux, uy, x0, x1, y0, y1 };
  };
  for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l > 0.5) probe((q[0] - p[0]) / l, (q[1] - p[1]) / l); }
  if (!best) probe(1, 0);
  const { ux, uy, x0, x1, y0, y1 } = best, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
  const mitte = [mx * ux - my * uy, mx * uy + my * ux];
  return x1 - x0 >= y1 - y0 ? { mitte, u: [ux, uy], v: [-uy, ux], halb: [(x1 - x0) / 2, (y1 - y0) / 2] } : { mitte, u: [-uy, ux], v: [-ux, -uy], halb: [(y1 - y0) / 2, (x1 - x0) / 2] };
}

/**
 * Triangles of a polygon with holes (ear clipping; holes are joined to the outline by a bridge first).
 * `aussen` runs counter-clockwise, holes clockwise. Returns { punkte, dreiecke } with index triples.
 */
export function trianguliere(aussen, loecher = []) {
  const punkte = [...aussen];
  let folge = aussen.map((_, i) => i);
  const offen = loecher.map((l) => { const start = punkte.length; punkte.push(...l); return l.map((_, i) => start + i); })
    .sort((a, b) => Math.max(...b.map((i) => punkte[i][0])) - Math.max(...a.map((i) => punkte[i][0])));
  const kreuzt = (p, q, a, b) => kreuz(sub(q, p), sub(a, p)) * kreuz(sub(q, p), sub(b, p)) < -1e-12 && kreuz(sub(b, a), sub(p, a)) * kreuz(sub(b, a), sub(q, a)) < -1e-12;
  while (offen.length) {
    const loch = offen.shift();
    let best = null;
    for (let hi = 0; hi < loch.length; hi++) for (let fi = 0; fi < folge.length; fi++) {
      const p = punkte[loch[hi]], q = punkte[folge[fi]], d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
      if (best && d >= best.d) continue;
      const verstellt = [folge, loch, ...offen].some((r) => r.some((i, k) => { const j = r[(k + 1) % r.length]; return !gleich(punkte[i], p) && !gleich(punkte[j], p) && !gleich(punkte[i], q) && !gleich(punkte[j], q) && kreuzt(p, q, punkte[i], punkte[j]); }));
      if (!verstellt) best = { d, hi, fi };
    }
    if (best) folge = [...folge.slice(0, best.fi + 1), ...loch.slice(best.hi), ...loch.slice(0, best.hi + 1), ...folge.slice(best.fi)];
  }
  const dreiecke = [], v = [...folge], P = (i) => punkte[v[(i + v.length) % v.length]];
  const drin = (p, a, b, c) => kreuz(sub(b, a), sub(p, a)) >= -1e-10 && kreuz(sub(c, b), sub(p, b)) >= -1e-10 && kreuz(sub(a, c), sub(p, c)) >= -1e-10;
  for (let wache = v.length * v.length + 10; v.length > 3 && wache > 0; wache--) {
    let ohr = -1;
    for (let i = 0; i < v.length && ohr < 0; i++) {
      const a = P(i - 1), b = P(i), c = P(i + 1);
      if (kreuz(sub(b, a), sub(c, b)) <= 1e-9) continue; // reflex or straight: no ear
      let frei = true;
      for (let j = 0; j < v.length && frei; j++) { const p = P(j); if (!gleich(p, a) && !gleich(p, b) && !gleich(p, c) && drin(p, a, b, c)) frei = false; }
      if (frei) ohr = i;
    }
    if (ohr < 0) { // nothing to clip (straight runs, touching points): drop the flattest corner and go on
      let m = 0, klein = Infinity;
      for (let i = 0; i < v.length; i++) { const k = Math.abs(kreuz(sub(P(i), P(i - 1)), sub(P(i + 1), P(i)))); if (k < klein) { klein = k; m = i; } }
      v.splice(m, 1);
      continue;
    }
    dreiecke.push([v[(ohr + v.length - 1) % v.length], v[ohr], v[(ohr + 1) % v.length]]);
    v.splice(ohr, 1);
  }
  if (v.length === 3 && kreuz(sub(P(1), P(0)), sub(P(2), P(1))) > 1e-9) dreiecke.push([v[0], v[1], v[2]]);
  return { punkte, dreiecke };
}

/** The part of a convex polygon on one side of the line a·x + b·y = c (`seite` 1: at or beyond it, -1: before it). */
export function schneide(poly, [a, b, c], seite) {
  const aus = [], g = (p) => seite * (a * p[0] + b * p[1] - c);
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], gp = g(p), gq = g(q);
    if (gp >= 0) aus.push(p);
    if ((gp > 0 && gq < 0) || (gp < 0 && gq > 0)) { const t = gp / (gp - gq); aus.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
  }
  return aus;
}

// ------------------------------------------------------------------ walls: edges, neighbours, pieces

const kantenVon = (ring) => ring.map((a, i) => {
  const b = ring[(i + 1) % ring.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]), d = [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
  return { a, b, l, d, n: [d[1], -d[0]], geteilt: [], muendung: [], stuecke: [] }; // n points out of the house
});
const auf = (k, t) => [k.a[0] + k.d[0] * t, k.a[1] + k.d[1] * t];

/** Where edge `f` runs along edge `e`: [t0, t1] in metres from e's start, or null. */
export function entlang(e, f, tol = 0.3, mindest = 0.4) {
  if (Math.abs(kreuz(e.d, f.d)) > 0.06) return null;
  if (Math.abs(kreuz(sub(f.a, e.a), e.d)) > tol || Math.abs(kreuz(sub(f.b, e.a), e.d)) > tol) return null;
  const s0 = mal(sub(f.a, e.a), e.d), s1 = mal(sub(f.b, e.a), e.d), t0 = Math.max(0, Math.min(s0, s1)), t1 = Math.min(e.l, Math.max(s0, s1));
  return t1 - t0 > mindest ? [t0, t1] : null;
}

const kasten = (ring) => { const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
const nah = (a, b, rand = 0.5) => a[0] <= b[2] + rand && b[0] <= a[2] + rand && a[1] <= b[3] + rand && b[1] <= a[3] + rand;

/** Who a building touches (all its parts together, without the building itself): its colour and kit differ from these. */
function umgebung(h, haeuser, nach) {
  const teile = h.teilVon ? haeuser.filter((o) => o.oid === h.oid) : [h];
  return [...new Set(teile.flatMap((t) => [...t.nachbarn]))].map((n) => nach.get(n)).filter((o) => o && o.oid !== h.oid);
}

/** Party walls: marks on every edge where a neighbouring house stands against it, and who the neighbours are. */
export function nachbarschaft(haeuser) {
  for (let i = 0; i < haeuser.length; i++) for (let j = i + 1; j < haeuser.length; j++) {
    const A = haeuser[i], B = haeuser[j];
    if (!nah(A.kasten, B.kasten)) continue;
    for (const e of A.kanten) for (const f of B.kanten) {
      const ab = entlang(e, f), ba = ab && entlang(f, e);
      if (ab) { e.geteilt.push(ab); A.nachbarn.add(B.schluessel); }
      if (ba) { f.geteilt.push(ba); B.nachbarn.add(A.schluessel); }
    }
  }
}

const abstandLinie = (p, linie) => {
  let best = Infinity;
  for (let i = 0; i + 1 < linie.length; i++) {
    const a = linie[i], d = sub(linie[i + 1], a), l2 = mal(d, d), t = l2 ? Math.max(0, Math.min(1, mal(sub(p, a), d) / l2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - a[0] - d[0] * t, p[1] - a[1] - d[1] * t));
  }
  return best;
};

/** Cut every edge into pieces: party wall, gateway mouth, street front or yard front; mark corners and the front door. */
function stueckle(h, strassen) {
  const ecke = (d1, d2) => Math.abs(kreuz(d1, d2)) > 0.42; // more than about 25°
  const alle = h.kanten, proRing = h.kantenRinge;
  let start = 0;
  for (const anzahl of proRing) {
    for (let i = 0; i < anzahl; i++) {
      const k = alle[start + i], vor = alle[start + (i + anzahl - 1) % anzahl], nach = alle[start + (i + 1) % anzahl];
      const marken = [...new Set([0, k.l, ...[...k.geteilt, ...k.muendung].flat()].map((t) => Math.round(Math.max(0, Math.min(k.l, t)) * 1000) / 1000))].sort((a, b) => a - b);
      const roh = [];
      for (let m = 0; m + 1 < marken.length; m++) {
        const t0 = marken[m], t1 = marken[m + 1], mitte = (t0 + t1) / 2, in_ = (liste) => liste.some(([a, b]) => mitte > a && mitte < b);
        const geteilt = in_(k.geteilt), muendung = !geteilt && in_(k.muendung), letzt = roh[roh.length - 1];
        if (letzt && (t1 - t0 < 0.3 || (letzt.geteilt === geteilt && letzt.muendung === muendung))) letzt.t1 = t1; // slivers join their neighbour
        else roh.push({ t0, t1, geteilt, muendung });
      }
      if (roh.length > 1 && roh[0].t1 - roh[0].t0 < 0.3) { roh[1].t0 = roh[0].t0; roh.shift(); }
      roh[0].t0 = 0; roh[roh.length - 1].t1 = k.l; // exactly the edge's ends, whatever the rounding of the marks did
      k.stuecke = roh.map((s) => {
        const mitte = auf(k, (s.t0 + s.t1) / 2), davor = [mitte[0] + k.n[0] * 7, mitte[1] + k.n[1] * 7];
        const anStrasse = !s.geteilt && strassen.some((l) => abstandLinie(davor, l) < 7.5);
        return { t0: s.t0, t1: s.t1, art: h.art !== 'haus' ? 'brandwand' : s.geteilt ? 'brandwand' : anStrasse ? 'strasse' : 'hof', muendung: s.muendung,
          eckeL: s.t0 === 0 && ecke(vor.d, k.d), eckeR: s.t1 === k.l && ecke(k.d, nach.d), tuer: -1 };
      });
    }
    start += anzahl;
  }
  // one front door, on the longest street front, at an axis the house's id picks
  if (h.eg === 'wohnen' || h.eg === 'laden') {
    let lang = null;
    for (const k of alle) for (const s of k.stuecke) if (s.art === 'strasse' && !s.muendung && s.t1 - s.t0 >= 2.2 && (!lang || s.t1 - s.t0 > lang.t1 - lang.t0 + 1e-9)) lang = s;
    if (lang) lang.tuer = Math.floor(streuung(h.oid, 'tuer') * achsen(lang.t1 - lang.t0));
  }
}

/** Window axes on a wall piece of this length. */
export const achsen = (l) => (l < 1.3 ? 0 : Math.max(1, Math.floor(l / ACHSE + 0.5)));

/**
 * Gateways (ALKIS "Bauteil": Durchfahrt im Gebäude) lie inside the footprint of the house they pass through.
 * Where one meets a free outer wall the wall opens up to DURCHFAHRT; its other sides become the tunnel's walls.
 */
function durchfahrten(haeuser, bauteile) {
  for (const teil of bauteile) {
    const mitte = [teil.ring.reduce((s, p) => s + p[0], 0) / teil.ring.length, teil.ring.reduce((s, p) => s + p[1], 0) / teil.ring.length];
    const innen = (p) => haeuser.find((h) => h.art === 'haus' && imRing(p, h.ring) && !h.loecher.some((l) => imRing(p, l)));
    const wirt = innen(mitte) ?? teil.ring.map(innen).find(Boolean);
    if (!wirt) continue;
    const kanten = kantenVon(teil.ring);
    for (const e of wirt.kanten) for (const f of kanten) { const t = entlang(e, f, 0.3, 0.6); if (t) e.muendung.push(t); }
    wirt.durchfahrten.push({ oid: teil.p.oid, ring: teil.ring, kanten, waende: [] });
  }
}

/** After the pieces are known: the tunnel walls are whatever of the gateway's outline is not an open mouth. */
function tunnelwaende(h) {
  const muender = h.kanten.flatMap((k) => k.stuecke.filter((s) => s.muendung).map((s) => { const a = auf(k, s.t0), b = auf(k, s.t1); return { a, b, l: s.t1 - s.t0, d: k.d }; }));
  h.durchfahrten = h.durchfahrten.filter((df) => {
    let offen = 0;
    for (const g of df.kanten) {
      const frei = muender.map((m) => entlang(g, m, 0.3, 0.3)).filter(Boolean).sort((a, b) => a[0] - b[0]);
      let t = 0;
      for (const [a, b] of [...frei, [g.l, g.l]]) { if (a - t > 0.15) df.waende.push([auf(g, a), auf(g, t)]); t = Math.max(t, b); } // reversed: facing into the tunnel
      offen += frei.length;
    }
    return offen > 0; // a gateway that reaches no free wall cannot be seen
  });
}

// ------------------------------------------------------------------ description of one house

const zahl = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/**
 * Eaves height, storeys, the height left for the roof, and where they come from. Measured roofs (`lod2`, from the
 * LGLN's LoD2 building model, locations/<place>/geo/daecher.json) give eaves and ridge above the ground directly;
 * the storeys then come from OSM where they fit the height (2.6 to 4.2 m each), else from tall old-building storeys
 * of 3.7 m. Without them a storey is never taller than 3.9 m: what a height has beyond that belongs to the roof.
 * Footprints without any height are low yard buildings by their size.
 */
export function hoehen(p, m2, lod2 = null) {
  const etagenOsm = zahl(p.osm_building_levels), dachEtagen = zahl(p.osm_roof_levels), rund = (v) => Math.round(v * 100) / 100;
  if (lod2 && lod2.traufe_m > 1.5) {
    const traufe = lod2.traufe_m, passt = etagenOsm && traufe / etagenOsm >= 2.6 && traufe / etagenOsm <= 4.2;
    return { traufe: rund(traufe), etagen: Math.max(1, passt ? etagenOsm : Math.round(traufe / 3.7)), dach: rund(Math.max(0, lod2.first_m - traufe)), quelle: 'gemessen (LoD2, LGLN)' };
  }
  if (p.hoehe_m != null) {
    let traufe = p.hoehe_m - (dachEtagen ?? 0) * DACHETAGE;
    if (etagenOsm) traufe = Math.min(traufe, etagenOsm * 3.9);
    traufe = Math.max(2.6, p.hoehe_m * 0.4, traufe);
    let etagen = Math.max(1, Math.round(etagenOsm ?? traufe / ETAGE));
    if (traufe / etagen < 2.4) etagen = Math.max(1, Math.round(traufe / 3));
    return { traufe: rund(traufe), etagen, dach: rund(Math.max(0, p.hoehe_m - traufe)), quelle: p.hoehe_quelle ?? 'Daten' };
  }
  const traufe = m2 < 40 ? 3 : m2 < 120 ? 4.2 : m2 < 250 ? 6.6 : 10;
  return { traufe, etagen: Math.max(1, Math.round(traufe / ETAGE)), dach: 0, quelle: 'angenommen nach Grundfläche' };
}

function grundlage(teil, nummer) {
  const p = teil.p, lod2 = teil.lod2 ?? null, m2 = Math.abs(flaeche(teil.ring)) - teil.loecher.reduce((s, l) => s + Math.abs(flaeche(l)), 0);
  const dach = /Überdachung/.test(p.funktion ?? '');
  const hh = dach ? { traufe: 3, etagen: 1, dach: 0, quelle: 'angenommen (Überdachung)' } : hoehen(p, m2, lod2);
  const fn = p.funktion ?? '';
  const eg = dach ? 'neben' : /Schule|öffentliche|Turnhalle/.test(fn) ? 'schule' : /Handel/.test(fn) ? 'laden'
    : (p.hoehe_m == null && !lod2) || (/Wirtschaft|Versorgung/.test(fn) && zahl(p.osm_building_levels) == null) ? 'neben' : 'wohnen';
  const ringe = [teil.ring, ...teil.loecher], kanten = ringe.flatMap(kantenVon);
  return {
    oid: p.oid, schluessel: nummer ? `${p.oid}#${nummer}` : p.oid, ...(teil.teilVon && { teilVon: teil.teilVon }), art: dach ? 'ueberdachung' : 'haus', funktion: fn, name: p.name ?? null, adresse: p.adresse ?? null,
    ring: teil.ring, loecher: teil.loecher, flaeche: Math.round(m2 * 10) / 10, kasten: kasten(teil.ring), kanten, kantenRinge: ringe.map((r) => r.length), nachbarn: new Set(), durchfahrten: [],
    traufe: hh.traufe, etagen: hh.etagen, dachHoehe: hh.dach, hoeheQuelle: hh.quelle, eg, sockel: dach ? hh.traufe - 0.3 : 0,
    egHoehe: Math.round((hh.etagen === 1 ? hh.traufe : Math.min(ERDGESCHOSS, (hh.traufe / hh.etagen) * 1.15)) * 100) / 100,
    dachWunsch: dach ? 'flach' : lod2?.form ?? DACHFORM[p.osm_roof_shape] ?? 'flach', dachAngabe: lod2?.form ? `${lod2.dachform} (LoD2)` : p.osm_roof_shape ?? null,
    firstRichtung: lod2?.form && lod2.first ? lod2.first : null, // measured ridge direction (east, north)
    stil: Math.floor(streuung(p.oid, 'stil') * 4), saat: streuung(p.oid, 'saat'),
  };
}

/** Width of the footprint along a line across the ridge direction, at `s` metres from the rectangle's centre. */
function breite(ringe, o, u, v, s) {
  const xs = [];
  for (const ring of ringe) for (let i = 0; i < ring.length; i++) {
    const a = sub(ring[i], o), b = sub(ring[(i + 1) % ring.length], o), sa = mal(a, v) - s, sb = mal(b, v) - s;
    if ((sa > 0) !== (sb > 0)) { const t = sa / (sa - sb); xs.push(mal(a, u) + t * (mal(b, u) - mal(a, u))); }
  }
  xs.sort((p, q) => p - q);
  let w = 0;
  for (let i = 0; i + 1 < xs.length; i += 2) w += xs[i + 1] - xs[i];
  return w;
}

/**
 * The roof. A saddle or hipped roof spans the house's main body: the strip across the ridge where the
 * footprint is widest (rear wings stay flat at eaves height). The ridge runs along the free fronts and
 * square to the party walls. A footprint without a usable main body gets a flat roof: simple but right.
 */
function bedache(h) {
  const r = rechteck(h.ring);
  let { u, v } = r, [hu, hv] = r.halb;
  const d = { form: 'flach', gewuenscht: h.dachWunsch, rueckfall: false, o: r.mitte, u, v, ya: -hv, yr: 0, yb: hv, xa: -hu, xb: hu, hoehe: 0, steigung: 0, gipfel: 0 };
  h.dach = d;
  if (h.dachWunsch === 'flach') return;
  if (h.firstRichtung) { // measured: the ridge runs along u, the rectangle side nearer to it
    if (Math.abs(mal(h.firstRichtung, v)) > Math.abs(mal(h.firstRichtung, u))) { [u, v] = [v, [-u[0], -u[1]]]; [hu, hv] = [hv, hu]; }
  } else if (h.dachWunsch === 'sattel') {
    let su = 0, sv = 0;
    for (const k of h.kanten) for (const s of k.stuecke) { // eaves face the street: a street front counts three times
      const l = (s.t1 - s.t0) * (s.art === 'strasse' ? 3 : 1), cu = Math.abs(mal(k.d, u)), cv = Math.abs(mal(k.d, v));
      if (s.art === 'brandwand') { su += l * cv; sv += l * cu; } else { su += l * cu; sv += l * cv; }
    }
    if (sv > su * 1.15) { [u, v] = [v, [-u[0], -u[1]]]; [hu, hv] = [hv, hu]; }
  }
  const ringe = [h.ring, ...h.loecher], profil = [];
  for (let s = -hv + 0.25; s < hv; s += 0.5) profil.push([s, breite(ringe, r.mitte, u, v, s)]);
  const grenze = 0.72 * Math.max(...profil.map((x) => x[1]));
  let lauf = null, best = null;
  for (const [s, w] of [...profil, [0, -1]]) {
    if (w >= grenze) { lauf ??= { ya: s - 0.25, yb: s, summe: 0 }; lauf.yb = s + 0.25; lauf.summe += w * 0.5; } else if (lauf) { if (!best || lauf.summe > best.summe) best = lauf; lauf = null; }
  }
  const quer = h.ring.map((p) => mal(sub(p, r.mitte), v));
  const raste = (y) => (Math.abs(Math.abs(y) - hv) < 0.8 ? Math.sign(y) * hv : quer.reduce((b, q) => (Math.abs(q - y) < Math.abs(b - y) ? q : b), Infinity)), ein = (y) => { const q = raste(y); return Math.abs(q - y) < 0.8 ? q : y; };
  const ya = best ? ein(best.ya) : 0, yb = best ? ein(best.yb) : 0, tiefe = yb - ya;
  if (!best || tiefe < Math.min(4, 2 * hv * 0.9) || best.summe < 0.4 * h.flaeche) { d.rueckfall = true; return; }
  const halb = tiefe / 2, laengs = h.ring.filter((p) => { const s = mal(sub(p, r.mitte), v); return s > ya - 0.3 && s < yb + 0.3; }).map((p) => mal(sub(p, r.mitte), u));
  // as high as the data leaves room for, within what a roof of this depth can be (about 19° to 50°)
  const hoehe = Math.round(Math.min(h.firstRichtung ? 9 : 7.5, Math.max(halb * 0.35, Math.min(halb * 1.2, h.dachHoehe > 0.5 ? h.dachHoehe : halb * 0.6))) * 100) / 100;
  Object.assign(d, { form: h.dachWunsch, u, v, ya, yb, yr: (ya + yb) / 2, xa: Math.min(...laengs), xb: Math.max(...laengs), hoehe, steigung: hoehe / halb });
  d.gipfel = d.form === 'walm' ? d.steigung * Math.min(halb, (d.xb - d.xa) / 2) : hoehe;
}

/** Height of the roof above the eaves at a point. */
export function dachhoehe(d, p) {
  if (d.form === 'flach') return 0;
  const r = sub(p, d.o), s = mal(r, d.v);
  let m = Math.min(s - d.ya, d.yb - s);
  if (d.form === 'walm') { const t = mal(r, d.u); m = Math.min(m, t - d.xa, d.xb - t); }
  return Math.max(0, m) * d.steigung;
}

/** The lines along which the roof folds, as a·x + b·y = c: between two of them the roof is one plane. */
export function dachlinien(d) {
  if (d.form === 'flach') return [];
  const linie = (n, c) => [n[0], n[1], c + mal(n, d.o)], plus = [d.v[0] + d.u[0], d.v[1] + d.u[1]], minus = [d.v[0] - d.u[0], d.v[1] - d.u[1]];
  const l = [linie(d.v, d.ya), linie(d.v, d.yr), linie(d.v, d.yb)];
  if (d.form === 'walm') l.push(linie(d.u, d.xa), linie(d.u, (d.xa + d.xb) / 2), linie(d.u, d.xb), linie(minus, d.ya - d.xa), linie(plus, d.ya + d.xb), linie(plus, d.yb + d.xa), linie(minus, d.yb - d.xb));
  return l;
}

/** Colours by the house's id; a house never wears the wall colour of a neighbour it touches. */
function faerbe(haeuser) {
  const nach = new Map(haeuser.map((h) => [h.schluessel, h]));
  const wahl = (liste, id, salz, versuch = 0) => liste[Math.floor(streuung(id, salz + (versuch || '')) * liste.length)];
  for (const h of haeuser) {
    const flach = wahl(FLACHDACH, h.oid, 'flachdach');
    if (h.art !== 'haus' || h.eg === 'neben') {
      const [name, farbe] = wahl(NEBENBAU, h.oid, 'wand');
      h.wand = { name, farbe, material: name === 'Backstein' ? 'klinker' : 'putz' };
    } else if (h.eg === 'schule') {
      h.wand = { name: 'Cremeweiß', farbe: PUTZ[0][1], material: 'putz' };
    } else {
      const belegt = new Set(umgebung(h, haeuser, nach).map((o) => o.wand?.farbe));
      for (let versuch = 0; versuch < 8; versuch++) {
        const klinker = streuung(h.oid, 'material' + (versuch || '')) < 0.2, [name, farbe] = wahl(klinker ? KLINKER : PUTZ, h.oid, 'wand', versuch);
        h.wand = { name, farbe, material: klinker ? 'klinker' : 'putz' };
        if (!belegt.has(farbe)) break;
      }
    }
    const [dn, df] = h.dach.form === 'flach' ? flach : h.eg === 'schule' ? ZIEGEL[0] : wahl(ZIEGEL, h.oid, 'dach');
    Object.assign(h.dach, { name: dn, farbe: df, flachFarbe: flach[1] });
  }
}

/**
 * All houses of a place, described. `gebaeude` is the ALKIS layer, `wege` the OSM ways (streets decide which
 * fronts get shop windows and doors), `daecher` the measured roofs (locations/<place>/geo/daecher.json, LoD2 of
 * the LGLN, by ALKIS id): form, eaves and ridge height, ridge direction. Sorted by id, and independent of the
 * order of the input.
 */
export function viertel(gebaeude, frame, { wege = null, daecher = null } = {}) {
  const [E0, N0] = frame.ursprung_utm32, lokal = (p) => [p[0] - E0, p[1] - N0];
  const teile = [];
  for (const f of gebaeude.features) {
    const lod2 = daecher?.haeuser?.[f.properties.oid] ?? null;
    // a building the LoD2 model knows in parts (front house, wing, stair tower): every part its own body with its
    // own heights and roof, on the part's footprint; colour and kit stay the building's, the door goes to the largest
    if (lod2?.teile_einzeln?.length > 1 && f.properties.art !== 'Bauteil') {
      lod2.teile_einzeln.forEach((t, nummer) => {
        const ring = saeubere(t.grundriss.map(lokal), true);
        if (ring.length >= 3 && flaeche(ring) > 0.5) teile.push({ p: f.properties, lod2: t, nummer: nummer + 1, ring, loecher: [], teilVon: f.properties.oid });
      });
      continue;
    }
    const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    polys.forEach((poly, nummer) => {
      const ring = saeubere(poly[0].map(lokal), true);
      if (ring.length >= 3 && flaeche(ring) > 0.5) teile.push({ p: f.properties, lod2, nummer, ring, loecher: poly.slice(1).map((r) => saeubere(r.map(lokal), false)).filter((r) => r.length >= 3) });
    });
  }
  const haeuser = teile.filter((t) => t.p.art !== 'Bauteil').map((t) => grundlage(t, t.nummer)).sort((a, b) => (a.schluessel < b.schluessel ? -1 : 1));
  const groesster = new Map(); // the largest part of a building in parts carries its door
  for (const h of haeuser) if (h.teilVon && (!groesster.get(h.oid) || h.flaeche > groesster.get(h.oid).flaeche)) groesster.set(h.oid, h);
  for (const h of haeuser) if (h.teilVon && groesster.get(h.oid) !== h) h.tuer = false;
  nachbarschaft(haeuser.filter((h) => h.art === 'haus'));
  durchfahrten(haeuser, teile.filter((t) => t.p.art === 'Bauteil').sort((a, b) => (a.p.oid < b.p.oid ? -1 : 1)));
  const strassen = (wege?.features ?? []).filter((f) => f.geometry.type === 'LineString' && ['residential', 'tertiary', 'secondary', 'unclassified', 'living_street', 'pedestrian'].includes(f.properties.highway)).map((f) => f.geometry.coordinates.map(lokal));
  for (const h of haeuser) { stueckle(h, strassen); tunnelwaende(h); bedache(h); h.first = h.traufe + h.dach.gipfel; }
  faerbe(haeuser);
  return haeuser;
}

/** What a click on a house tells. */
export function steckbrief(h) {
  const dach = { sattel: 'Satteldach', walm: 'Walmdach', flach: 'Flachdach' }[h.dach.form] + (h.dach.rueckfall ? ` (angegeben: ${h.dach.gewuenscht}, Grundriss zu verwinkelt)` : h.dachAngabe ? '' : ' (keine Angabe)');
  const eg = { wohnen: 'Wohnen', laden: 'Laden', schule: 'Schule oder öffentlich', neben: 'Nebengebäude' }[h.eg];
  return [`${h.art === 'ueberdachung' ? 'Überdachung' : 'Gebäude'} (ALKIS)${h.name ? ' – ' + h.name : ''}`, `oid: ${h.oid}`, h.adresse && `adresse: ${h.adresse}`, `funktion: ${h.funktion}`, `flaeche_m2: ${h.flaeche}`,
    `Traufe ${h.traufe} m, First ${Math.round(h.first * 10) / 10} m (${h.hoeheQuelle})`, `${h.etagen} Geschoss${h.etagen > 1 ? 'e' : ''}, Erdgeschoss: ${eg}`, `Dach: ${dach}, ${h.dach.name}`, `Wand: ${h.wand.name}${h.wand.material === 'klinker' && h.wand.name !== 'Klinker' ? ' (Klinker)' : ''}`,
    h.kleid && `Gezeichnet: ${h.kleid.satz ? `SpriteCook-Bausatz „${h.kleid.satz.id}“` : 'Putz (SpriteCook)'}, nicht freigegeben`,
    h.kleid?.lage && (() => { const was = [['erker', 'Erker'], ['balkon', 'Balkone']].filter(([art]) => anbauten(h, { nur: [art] }).indizes.length).map((x) => x[1]); return was.length ? `Angebaut nach Regel, nicht vermessen: ${was.join(', ')}` : null; })(),
    h.durchfahrten.length && `Durchfahrten: ${h.durchfahrten.length}`, h.nachbarn.size && `Brandwände zu ${h.nachbarn.size} Nachbarn`].filter(Boolean).join('\n');
}

// ------------------------------------------------------------------ mesh of one house

/**
 * Triangles of a house: walls up to the roof, roof planes, gateway tunnels. Per corner: position (east, north, up),
 * normal, `wand` (u, v, w, kind), `bau` (piece length, eaves, storeys + ground floor / 8, ground-floor code), `farbe` (r, g, b, seed).
 * Walls: u along the piece, v above ground, w below the wall's top. Roofs: u along the eaves, v up the slope, w below the ridge.
 * A dressed house (h.kleid) shows sprites instead: on a façade cell or a roof part `wand` is the place in the picture atlas
 * in pixels, and `farbe` is the tint, the wanted colour divided by the picture's own.
 */
/** Storey lines of a house, from the ground to the eaves: where each drawn storey of a façade is stretched to. */
export function geschosslinien(h) {
  const T = h.traufe, etagen = h.etagen;
  return [0, ...Array.from({ length: etagen }, (_, e) => (e === etagen - 1 ? T : h.egHoehe + (e * (T - h.egHoehe)) / (etagen - 1)))];
}

export function netz(h) {
  const P = [], N = [], W = [], B = [], F = [], I = [];
  let n = 0;
  const ecke = (x, y, z, nx, ny, nz, wand, bau, farbe) => { P.push(x, y, z); N.push(nx, ny, nz); W.push(...wand); B.push(...bau); F.push(...farbe); return n++; };
  const T = h.traufe, d = h.dach, linien = dachlinien(d), K = h.kleid ?? null, ohne = [0, T, 0, 0];
  const wandfarbe = [...rgb(h.wand.farbe), h.saat], klinker = h.wand.material === 'klinker' ? KLINKER_BIT : 0, bauZ = h.etagen + h.egHoehe / 8;
  const wand = (a, b, unten, ha, hb, nx, ny, ua, ub, bau, code, farbe) => {
    const i = ecke(a[0], a[1], unten, nx, ny, 0, [ua, unten, ha - unten, code], bau, farbe);
    ecke(b[0], b[1], unten, nx, ny, 0, [ub, unten, hb - unten, code], bau, farbe);
    ecke(b[0], b[1], hb, nx, ny, 0, [ub, hb, 0, code], bau, farbe);
    ecke(a[0], a[1], ha, nx, ny, 0, [ua, ha, 0, code], bau, farbe);
    I.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  // four corners in space, counter-clockwise seen from outside, each with its place (x, y) in the atlas or on a texture
  const viereck = (p, nrm, wo, art, ton, w = 0, bau = ohne) => {
    const i = n;
    p.forEach((q, m) => ecke(q[0], q[1], q[2], nrm[0], nrm[1], nrm[2], [wo[m][0], wo[m][1], w, art], bau, ton));
    I.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  // storey lines of a dressed house, from the ground to the eaves
  const stock = geschosslinien(h);
  for (const k of h.kanten) for (const s of k.stuecke) {
    const L = s.t1 - s.t0, p0 = auf(k, s.t0), p1 = auf(k, s.t1), unten = s.muendung ? Math.min(DURCHFAHRT, T - 0.5) : h.sockel;
    const lauf = K && s.lauf != null ? K.laeufe[s.lauf] : null;
    const code = (K ? ARTEN.putz : ARTEN[s.art] + (s.eckeL ? ECKE_L : 0) + (s.eckeR ? ECKE_R : 0) + klinker) + (s.muendung ? OFFEN : 0);
    const bau = K ? ohne : [L, T, bauZ, EG[h.eg] + 4 * h.stil + 16 * (s.tuer + 1)], farbe = K ? (s.art === 'brandwand' ? K.ton.brandwand : K.ton.wand) : wandfarbe;
    const schnitte = [0, 1];
    for (const [a, b, c] of linien) { const g0 = a * p0[0] + b * p0[1] - c, g1 = a * p1[0] + b * p1[1] - c; if (g0 * g1 < 0) schnitte.push(g0 / (g0 - g1)); }
    schnitte.sort((x, y) => x - y);
    for (let i = 0; i + 1 < schnitte.length; i++) {
      const ta = schnitte[i], tb = schnitte[i + 1];
      if (tb - ta < 1e-6) continue;
      const a = [p0[0] + (p1[0] - p0[0]) * ta, p0[1] + (p1[1] - p0[1]) * ta], b = [p0[0] + (p1[0] - p0[0]) * tb, p0[1] + (p1[1] - p0[1]) * tb];
      const ha = T + dachhoehe(d, a), hb = T + dachhoehe(d, b);
      if (!lauf) { if (Math.max(ha, hb) - unten > 0.02) wand(a, b, unten, ha, hb, k.n[0], k.n[1], ta * L, tb * L, bau, code, farbe); continue; }
      // a front in sprites: every window axis of the run's picture in its place, storey by storey up to the eaves; a gable above is plaster
      const ua = s.u0 + ta * L, ub = s.u0 + tb * L, [ox, oy] = K.lage[lauf.satz.id], g = lauf.grenzen, schmal = lauf.bild.gestreckt;
      lauf.bild.spalten.forEach(([sx0, sx1], c) => {
        const ca = Math.max(ua, g[c]), cb = Math.min(ub, g[c + 1]);
        if (cb - ca < 1e-4) return;
        const fx = (u) => ox + (schmal ? sx0 + 0.5 : sx0 + ((u - g[c]) / (g[c + 1] - g[c])) * (sx1 - sx0)), rand = schmal ? 0 : 0.02;
        const pa = auf(k, s.t0 + ca - s.u0), pb = auf(k, s.t0 + cb - s.u0);
        lauf.zeilen.forEach(([y0, y1], e) => {
          const zu = Math.max(stock[e], unten), zo = stock[e + 1];
          if (zo - zu < 1e-3) return;
          const fy = (z) => oy + y1 - ((z - stock[e]) / (stock[e + 1] - stock[e])) * (y1 - y0);
          viereck([[pa[0], pa[1], zu], [pb[0], pb[1], zu], [pb[0], pb[1], zo], [pa[0], pa[1], zo]], [k.n[0], k.n[1], 0],
            [[fx(ca) + rand, fy(zu) - 0.02], [fx(cb) - rand, fy(zu) - 0.02], [fx(cb) - rand, fy(zo) + 0.02], [fx(ca) + rand, fy(zo) + 0.02]], ARTEN.bild, lauf.ton, 0, [ox + sx0, oy + y0, ox + (schmal ? sx0 + 1 : sx1), oy + y1]); // with the cell's box in the atlas
        });
      });
      if (Math.max(ha, hb) > T + 0.02) wand(a, b, T, ha, hb, k.n[0], k.n[1], ta * L, tb * L, ohne, ARTEN.putz, K.ton.brandwand);
    }
  }
  // roof: the footprint's triangles, cut along the fold lines, lifted onto the roof planes
  const { punkte, dreiecke } = trianguliere(h.ring, h.loecher);
  const dachfarbe = K ? K.ton.dach : [...rgb(d.farbe), h.saat], flachfarbe = K ? K.ton.flach : [...rgb(d.form === 'flach' ? d.farbe : d.flachFarbe), h.saat];
  for (const [i, j, k] of dreiecke) {
    let stuecke = [[punkte[i], punkte[j], punkte[k]]];
    for (const linie of linien) stuecke = stuecke.flatMap((s) => [schneide(s, linie, 1), schneide(s, linie, -1)]).filter((s) => s.length >= 3 && Math.abs(flaeche(s)) > 1e-7);
    for (const s of stuecke) {
      const q = s.map((p) => [p[0], p[1], T + dachhoehe(d, p)]);
      let nx = 0, ny = 0, nz = 0; // Newell: the normal of a plane polygon
      for (let m = 0; m < q.length; m++) { const a = q[m], b = q[(m + 1) % q.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const hang = Math.hypot(nx, ny), erste = n;
      for (const p of q) {
        if (hang < 0.02) ecke(p[0], p[1], p[2], 0, 0, 1, [mal(p, d.u), mal(p, d.v), 99, K ? ARTEN.flachbild : ARTEN.flachdach], ohne, flachfarbe);
        else ecke(p[0], p[1], p[2], nx, ny, nz, [(-p[0] * ny + p[1] * nx) / hang, (p[2] - T) / hang, (T + d.gipfel - p[2]) / hang, K ? ARTEN.ziegelbild : ARTEN.ziegel], ohne, dachfarbe);
      }
      for (let m = 1; m + 1 < q.length; m++) I.push(erste, erste + m, erste + m + 1);
    }
  }
  // what stands on the roof of a dressed house: chimneys as small boxes, roof windows lying in the slope, dormers with cheeks and a little roof
  const weiss = [1, 1, 1, h.saat];
  const teil = (p, nrm, [x, y, w, hh]) => viereck(p, nrm, [[x + 0.02, y + hh - 0.02], [x + w - 0.02, y + hh - 0.02], [x + w - 0.02, y + 0.02], [x + 0.02, y + 0.02]], ARTEN.teil, weiss);
  for (const a of K?.aufbauten ?? []) {
    const [x, y] = a.mitte, z = T + dachhoehe(d, a.mitte), [ox, oy] = K.lage[a.art], r = [ox, oy, a.px[0], a.px[1]];
    if (a.art === 'schornstein') {
      const bu = [(d.u[0] * a.breite) / 2, (d.u[1] * a.breite) / 2], bv = [(d.v[0] * a.tiefe) / 2, (d.v[1] * a.tiefe) / 2], z0 = z - 0.35, z1 = z0 + a.hoehe;
      const eck = (su, sv, zz) => [x + su * bu[0] + sv * bv[0], y + su * bu[1] + sv * bv[1], zz];
      const schmal = [r[0] + r[2] * 0.25, r[1], r[2] * 0.5, r[3]], deckel = [r[0] + r[2] * 0.3, r[1] + r[3] * 0.24, r[2] * 0.4, 1];
      teil([eck(1, 1, z0), eck(-1, 1, z0), eck(-1, 1, z1), eck(1, 1, z1)], [d.v[0], d.v[1], 0], r);
      teil([eck(-1, -1, z0), eck(1, -1, z0), eck(1, -1, z1), eck(-1, -1, z1)], [-d.v[0], -d.v[1], 0], r);
      teil([eck(1, -1, z0), eck(1, 1, z0), eck(1, 1, z1), eck(1, -1, z1)], [d.u[0], d.u[1], 0], schmal);
      teil([eck(-1, 1, z0), eck(-1, -1, z0), eck(-1, -1, z1), eck(-1, 1, z1)], [-d.u[0], -d.u[1], 0], schmal);
      const zd = z1 - a.hoehe * 0.2; // the cap closes the stack below the pots
      teil([eck(-1, -1, zd), eck(1, -1, zd), eck(1, 1, zd), eck(-1, 1, zd)], [0, 0, 1], deckel);
    } else if (a.art === 'dachfenster') {
      const k = d.steigung, c = 1 / Math.hypot(1, k), ax = [(-a.seite * d.u[0] * a.breite) / 2, (-a.seite * d.u[1] * a.breite) / 2], g = [((-a.seite * d.v[0] * a.hoehe) / 2) * c, ((-a.seite * d.v[1] * a.hoehe) / 2) * c];
      const eck = (sa, sg) => { const q = [x + sa * ax[0] + sg * g[0], y + sa * ax[1] + sg * g[1]]; return [q[0], q[1], T + dachhoehe(d, q) + 0.06]; };
      teil([eck(-1, -1), eck(1, -1), eck(1, 1), eck(-1, 1)], [a.seite * d.v[0] * k * c, a.seite * d.v[1] * k * c, c], r);
    } else { // a dormer: its drawn front stands upright in the slope; behind it two cheeks and a small saddle roof run back into the roof
      const k = d.steigung, aus = [a.seite * d.v[0], a.seite * d.v[1]], quer = [-aus[1], aus[0]], b = a.breite / 2, schulter = a.hoehe * 0.62;
      const ort = (sq, zurueck, zz) => [x + quer[0] * sq * b - aus[0] * zurueck, y + quer[1] * sq * b - aus[1] * zurueck, zz];
      teil([ort(-1, 0, z), ort(1, 0, z), ort(1, 0, z + a.hoehe), ort(-1, 0, z + a.hoehe)], [aus[0], aus[1], 0], r);
      const tief = schulter / k, first = a.hoehe / k, zs = z + schulter, zf = z + a.hoehe, wange = (sq) => {
        const p = [ort(sq, 0, z), ort(sq, 0, zs), ort(sq, tief, zs)], erste = n;
        (sq < 0 ? p : [p[0], p[2], p[1]]).forEach((q, m) => ecke(q[0], q[1], q[2], quer[0] * sq, quer[1] * sq, 0, [m * 0.7, q[2] - z, 0, ARTEN.putz], ohne, K.ton.gaube));
        I.push(erste, erste + 1, erste + 2);
      };
      wange(-1); wange(1);
      for (const sq of [-1, 1]) { // one side of the little roof: from the front's shoulder and peak back to where they meet the slope
        const p = [ort(sq, 0, zs), ort(0, 0, zf), ort(0, first, zf), ort(sq, tief, zs)], steil = (a.hoehe - schulter) / b, l = Math.hypot(1, steil);
        const nrm = [(quer[0] * sq * steil) / l, (quer[1] * sq * steil) / l, 1 / l], wo = [[0, 0], [0, b * l], [first, b * l], [tief, 0]];
        viereck(sq < 0 ? p : [p[0], p[3], p[2], p[1]], nrm, sq < 0 ? wo : [wo[0], wo[3], wo[2], wo[1]], ARTEN.ziegelbild, dachfarbe, -1); // w = -1: not part of the roof proper
      }
    }
  }
  // undersides: of a canopy, and of the house above each gateway; and the tunnel walls
  const dunkel = [...rgb(h.wand.farbe), h.saat];
  const unterseite = (ring, z) => { const t = trianguliere(ring), erste = n; for (const p of t.punkte) ecke(p[0], p[1], z, 0, 0, -1, [p[0], p[1], 99, ARTEN.untersicht], ohne, dunkel); for (const [a, b, c] of t.dreiecke) I.push(erste + a, erste + c, erste + b); };
  if (h.sockel > 0) unterseite(h.ring, h.sockel);
  const hoch = Math.min(DURCHFAHRT, T - 0.5);
  for (const df of h.durchfahrten) {
    unterseite(df.ring, hoch);
    for (const [a, b] of df.waende) { const l = Math.hypot(b[0] - a[0], b[1] - a[1]); wand(a, b, 0, hoch, hoch, (b[1] - a[1]) / l, -(b[0] - a[0]) / l, 0, l, [l, T, bauZ, EG.neben], ARTEN.tunnel, dunkel); }
  }
  return { positionen: new Float64Array(P), normalen: new Float32Array(N), wand: new Float32Array(W), bau: new Float32Array(B), farbe: new Float32Array(F), indizes: n < 65536 ? new Uint16Array(I) : new Uint32Array(I) };
}

// ------------------------------------------------------------------ additions: eaves, balconies, bay windows

/**
 * What is added to a house's plain body, in metres. The eaves are a fact of every pitched roof; balconies and bay
 * windows are in no geodata (ALKIS, LoD2 and OSM know footprints, heights and roofs): they are set by rule and by
 * the house's id, on the street fronts of the houses within `umkreis` metres of the court, as such houses have them.
 */
export const ANBAU = { ueberstand: 0.45, dicke: 0.12, attika: { vor: 0.18, hoch: 0.28 }, balkon: { tiefe: 1.05, platte: 0.16, gelaender: 1.0, rand: 0.15 },
  erker: { tiefe: 0.9, rand: 0.12, dach: 0.5 }, umkreis: 130, eisen: '#2b2d33', stein: '#d8d2c4' };

/**
 * The additions of a dressed house: a third mesh in the format of `netz`.
 * - Eaves: along every wall the roof slopes down to, the roof runs on over the wall by ANBAU.ueberstand, with a soffit
 *   and a gutter board; a flat roof gets a small coping instead. This is on every house.
 * - A bay window on some street fronts: one column of the front stands out over the upper storeys (not the top one),
 *   showing that column of the façade picture, with pier strips on its sides and a small pent roof.
 * - Balconies on others: a slab and an iron railing in front of one or two window columns of the upper storeys.
 * `nur` limits it to some of the three (for looking at one alone).
 */
export function anbauten(h, { umkreis = ANBAU.umkreis, nur = null } = {}) {
  const P = [], N = [], W = [], B = [], F = [], I = [];
  let n = 0;
  const fertig = () => ({ positionen: new Float64Array(P), normalen: new Float32Array(N), wand: new Float32Array(W), bau: new Float32Array(B), farbe: new Float32Array(F), indizes: n < 65536 ? new Uint16Array(I) : new Uint32Array(I) });
  const K = h.kleid;
  if (!K?.lage || h.art !== 'haus') return fertig();
  const T = h.traufe, d = h.dach, ohne = [0, T, 0, 0], will = (was) => !nur || nur.includes(was);
  // a flat polygon of three or four corners with their places (texture or atlas), turned so that it faces `nrm`
  const flach = (p, wo, nrm, art, ton, w = 0, box = ohne) => {
    const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], v = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...c) < 1e-9) return;
    const reihe = p.map((_, m) => m), i = n;
    if (c[0] * nrm[0] + c[1] * nrm[1] + c[2] * nrm[2] < 0) reihe.reverse();
    for (const m of reihe) { P.push(...p[m]); N.push(...nrm); W.push(wo[m][0], wo[m][1], typeof w === 'function' ? w(p[m]) : w, art); B.push(...box); F.push(...ton); n++; }
    for (let m = 1; m + 1 < p.length; m++) I.push(i, i + m, i + m + 1);
  };
  const einheit = (v) => { const l = Math.hypot(...v) || 1; return v.map((x) => x / l); };
  const wandton = K.ton.wand, dunkel = [...rgb(h.wand.farbe), h.saat];
  // a plain colour on plaster: the tint is the wanted colour divided by the plaster picture's own, as everywhere on a dressed house
  const tonFuer = (hex) => { const a = rgb(hex), w = rgb(h.wand.farbe); return [(a[0] / w[0]) * wandton[0], (a[1] / w[1]) * wandton[1], (a[2] / w[2]) * wandton[2], h.saat]; };

  // ---- eaves and copings
  if (will('traufe')) {
    const U = ANBAU.ueberstand, D = ANBAU.dicke;
    let start = 0;
    for (const anzahl of h.kantenRinge) {
      for (let i = 0; i < anzahl; i++) {
        const k = h.kanten[start + i], vor = h.kanten[start + (i + anzahl - 1) % anzahl], nach = h.kanten[start + (i + 1) % anzahl];
        k.stuecke.forEach((st, nr) => {
          if (st.art === 'brandwand' || st.t1 - st.t0 < 0.6) return;
          const a = auf(k, st.t0), b = auf(k, st.t1), m = auf(k, (st.t0 + st.t1) / 2), innen = (t) => dachhoehe(d, [m[0] - k.n[0] * t, m[1] - k.n[1] * t]);
          if (dachhoehe(d, a) > 0.05 || dachhoehe(d, b) > 0.05) return; // a gable: no eaves along it
          const h1 = innen(0.6), h2 = innen(1.2);
          // the overhang goes on round a real corner of the house, but not across to a neighbour that shares the next wall
          const frei = (andere, erstes) => { const s = erstes ? andere.stuecke[0] : andere.stuecke.at(-1); return s && s.art !== 'brandwand'; };
          const la = nr === 0 && st.eckeL && kreuz(vor.d, k.d) > 0 && frei(vor, false) ? 1 : 0, lb = nr === k.stuecke.length - 1 && st.eckeR && kreuz(k.d, nach.d) > 0 && frei(nach, true) ? 1 : 0;
          if (h1 > 0.08) { // the roof slopes down to this wall: it runs on over it
            const steil = Math.min(1.2, Math.max(0.25, (h2 - h1) / 0.6, h1 / 0.6)), nrm = einheit([k.n[0] * steil, k.n[1] * steil, 1]), hang = Math.hypot(nrm[0], nrm[1]);
            const ort = (q, t, z) => [q[0] + k.n[0] * t, q[1] + k.n[1] * t, z], a0 = [a[0] - k.d[0] * U * la, a[1] - k.d[1] * U * la], b0 = [b[0] + k.d[0] * U * lb, b[1] + k.d[1] * U * lb], zu = T - U * steil;
            const oben = [ort(a0, 0, T), ort(a0, U, zu), ort(b0, U, zu), ort(b0, 0, T)];
            const ziegel = (q) => [(-q[0] * nrm[1] + q[1] * nrm[0]) / hang, (q[2] - T) / hang];
            flach(oben, oben.map(ziegel), nrm, ARTEN.ziegelbild, K.ton.dach, (q) => (T + d.gipfel - q[2]) / hang);
            const unten = oben.map((q) => [q[0], q[1], q[2] - D]);
            flach(unten, unten.map((q) => [q[0], q[1]]), [-nrm[0], -nrm[1], -nrm[2]], ARTEN.untersicht, dunkel, 99);
            const brett = [ort(a0, U, zu - D), ort(b0, U, zu - D), ort(b0, U, zu), ort(a0, U, zu)], lang = Math.hypot(b0[0] - a0[0], b0[1] - a0[1]);
            flach(brett, [[0, 0], [lang, 0], [lang, D], [0, D]], [k.n[0], k.n[1], 0], ARTEN.putz, K.ton.gaube);
          } else if (h.eg !== 'neben' && st.t1 - st.t0 >= 1.5) { // a flat roof: a coping that stands a little proud of the wall
            const { vor: V, hoch: H } = ANBAU.attika, ort = (q, t, z) => [q[0] + k.n[0] * t, q[1] + k.n[1] * t, z], lang = st.t1 - st.t0, hell = tonFuer(ANBAU.stein);
            flach([ort(a, V, T - H), ort(b, V, T - H), ort(b, V, T + 0.04), ort(a, V, T + 0.04)], [[0, 0], [lang, 0], [lang, H], [0, H]], [k.n[0], k.n[1], 0], ARTEN.putz, hell);
            flach([ort(a, 0, T + 0.04), ort(a, V, T + 0.04), ort(b, V, T + 0.04), ort(b, 0, T + 0.04)], [[0, 0], [0, V], [lang, V], [lang, 0]], [0, 0, 1], ARTEN.putz, hell);
            const u = [ort(a, 0, T - H), ort(a, V, T - H), ort(b, V, T - H), ort(b, 0, T - H)];
            flach(u, u.map((q) => [q[0], q[1]]), [0, 0, -1], ARTEN.untersicht, dunkel, 99);
          }
        });
      }
      start += anzahl;
    }
  }

  // ---- bay windows and balconies: on the street fronts round the court
  const [x0k, y0k, x1k, y1k] = h.kasten;
  const nah = Math.hypot(Math.max(0, Math.abs((x0k + x1k) / 2) - (x1k - x0k) / 2), Math.max(0, Math.abs((y0k + y1k) / 2) - (y1k - y0k) / 2)) <= umkreis;
  if (K.satz && nah && h.etagen >= 3 && (h.eg === 'wohnen' || h.eg === 'laden')) {
    const stock = geschosslinien(h), stuecke = new Map();
    for (const k of h.kanten) for (const st of k.stuecke) if (st.lauf != null) (stuecke.get(st.lauf) ?? stuecke.set(st.lauf, []).get(st.lauf)).push({ k, st });
    const wahl = streuung(h.oid, 'anbau'), eisen = [...rgb(ANBAU.eisen), h.saat], stein = tonFuer(ANBAU.stein);
    const front = K.laeufe.map((l, nr) => ({ l, nr })).filter(({ l }) => l.art === 'strasse' && !l.bild.gestreckt && l.bild.spalten.length >= 4).sort((p, q) => q.l.laenge - p.l.laenge || p.nr - q.nr)[0];
    if (front) {
      const { l: lauf, nr } = front, satz = lauf.satz, [ox, oy] = K.lage[satz.id], g = lauf.grenzen, sp = lauf.bild.spalten, teile = stuecke.get(nr) ?? [];
      const stueckBei = (u) => teile.find(({ st }) => u >= st.u0 - 1e-6 && u <= st.u0 + (st.t1 - st.t0) + 1e-6);
      const innere = sp.map((_, c) => c).slice(1, -1), mitte = sp.findIndex((x) => x === satz.mitte), oberstes = h.etagen >= 4 ? h.etagen - 2 : h.etagen - 1;
      // the wall behind a column, if the column lies on one straight piece: a point at `u` along the run, `t` in front of the wall, height z
      const stelle = (c) => { const A = stueckBei(g[c] + 0.01), Bs = stueckBei(g[c + 1] - 0.01); if (!A || A !== Bs || A.st.muendung) return null; const { k, st } = A; return { k, ort: (u, t, z) => { const q = auf(k, st.t0 + u - st.u0); return [q[0] + k.n[0] * t, q[1] + k.n[1] * t, z]; } }; };
      // a bay belongs to a front with mouldings; a plain post-war front (hardly a cornice) has none
      const erker = wahl < 0.4 && innere.length >= 3 && (satz.gesimse ?? []).length > 3 ? (mitte > 0 ? mitte : innere[Math.floor(innere.length / 2)]) : -1;
      if (erker >= 0 && will('erker')) {
        const w = stelle(erker);
        if (w) {
          const { k, ort } = w, E = ANBAU.erker, ua = g[erker] + E.rand, ub = g[erker + 1] - E.rand, [sx0, sx1] = sp[erker], nrm = [k.n[0], k.n[1], 0], px = ox + satz.pfeiler + 0.5;
          for (let e = 1; e <= oberstes; e++) {
            const zu = stock[e], zo = stock[e + 1], [y0, y1] = lauf.zeilen[e], box = [ox + sx0, oy + y0, ox + sx1, oy + y1];
            // the front shows the column's own cell of the picture; the sides the pier between two windows
            flach([ort(ua, E.tiefe, zu), ort(ub, E.tiefe, zu), ort(ub, E.tiefe, zo), ort(ua, E.tiefe, zo)], [[ox + sx0 + 0.02, oy + y1 - 0.02], [ox + sx1 - 0.02, oy + y1 - 0.02], [ox + sx1 - 0.02, oy + y0 + 0.02], [ox + sx0 + 0.02, oy + y0 + 0.02]], nrm, ARTEN.bild, lauf.ton, 0, box);
            const pbox = [ox + satz.pfeiler, oy + y0, ox + satz.pfeiler + 1, oy + y1], seite = (u, s) => flach([ort(u, 0, zu), ort(u, E.tiefe, zu), ort(u, E.tiefe, zo), ort(u, 0, zo)], [[px, oy + y1 - 0.02], [px, oy + y1 - 0.02], [px, oy + y0 + 0.02], [px, oy + y0 + 0.02]], [k.d[0] * s, k.d[1] * s, 0], ARTEN.bild, lauf.ton, 0, pbox);
            seite(ua, -1); seite(ub, 1);
          }
          const zb = stock[1], zt = stock[oberstes + 1], boden = [ort(ua, 0, zb), ort(ua, E.tiefe, zb), ort(ub, E.tiefe, zb), ort(ub, 0, zb)];
          flach(boden, boden.map((q) => [q[0], q[1]]), [0, 0, -1], ARTEN.untersicht, dunkel, 99);
          // a small pent roof in the roof's tiles, closed at its sides
          const steil = E.dach / E.tiefe, dn = einheit([k.n[0] * steil, k.n[1] * steil, 1]), hang = Math.hypot(dn[0], dn[1]), dach = [ort(ua, E.tiefe, zt), ort(ub, E.tiefe, zt), ort(ub, 0, zt + E.dach), ort(ua, 0, zt + E.dach)];
          flach(dach, dach.map((q) => [(-q[0] * dn[1] + q[1] * dn[0]) / hang, (q[2] - zt) / hang]), dn, ARTEN.ziegelbild, K.ton.dach, 5);
          for (const [u, s] of [[ua, -1], [ub, 1]]) flach([ort(u, 0, zt), ort(u, E.tiefe, zt), ort(u, 0, zt + E.dach)], [[0, 0], [E.tiefe, 0], [0, E.dach]], [k.d[0] * s, k.d[1] * s, 0], ARTEN.putz, K.ton.gaube);
        }
      }
      if (will('balkon') && wahl < 0.85 && innere.length >= 2) {
        // beside a bay window on both sides; else one column, or a pair on a wide front (never the door's column)
        const frei = innere.filter((c) => c !== mitte && c !== erker);
        const spalten = erker >= 0 ? [erker - 1, erker + 1].filter((c) => frei.includes(c)) : frei.length >= 4 ? [frei[1], frei[frei.length - 2]] : frei.length ? [frei[Math.floor(frei.length / 2)]] : [];
        const bis = streuung(h.oid, 'balkon oben') < 0.5 ? oberstes : h.etagen - 1, Bk = ANBAU.balkon;
        for (const c of spalten) {
          const w = stelle(c);
          if (!w) continue;
          const { k, ort } = w, ua = g[c] + Bk.rand, ub = g[c + 1] - Bk.rand, breit = ub - ua, nrm = [k.n[0], k.n[1], 0];
          if (breit < 1) continue;
          for (let e = 1; e <= bis; e++) {
            const zo = stock[e] + 0.02, zu = zo - Bk.platte, zg = zo + Bk.gelaender;
            // the slab: front, two sides, top, underside
            flach([ort(ua, Bk.tiefe, zu), ort(ub, Bk.tiefe, zu), ort(ub, Bk.tiefe, zo), ort(ua, Bk.tiefe, zo)], [[0, 0], [breit, 0], [breit, Bk.platte], [0, Bk.platte]], nrm, ARTEN.putz, stein);
            for (const [u, s] of [[ua, -1], [ub, 1]]) flach([ort(u, 0, zu), ort(u, Bk.tiefe, zu), ort(u, Bk.tiefe, zo), ort(u, 0, zo)], [[0, 0], [Bk.tiefe, 0], [Bk.tiefe, Bk.platte], [0, Bk.platte]], [k.d[0] * s, k.d[1] * s, 0], ARTEN.putz, stein);
            const deckel = [ort(ua, 0, zo), ort(ua, Bk.tiefe, zo), ort(ub, Bk.tiefe, zo), ort(ub, 0, zo)];
            flach(deckel, [[0, 0], [0, Bk.tiefe], [breit, Bk.tiefe], [breit, 0]], [0, 0, 1], ARTEN.putz, stein);
            flach(deckel.map((q) => [q[0], q[1], zu]), deckel.map((q) => [q[0], q[1]]), [0, 0, -1], ARTEN.untersicht, dunkel, 99);
            // the railing: iron bars, seen from outside and from the balcony (u along it, v above the slab; w is its height)
            const gitter = (p0, p1, lang, aussen) => { for (const s of [1, -1]) flach([[...p0.slice(0, 2), zo], [...p1.slice(0, 2), zo], [...p1.slice(0, 2), zg], [...p0.slice(0, 2), zg]], [[0, 0], [lang, 0], [lang, Bk.gelaender], [0, Bk.gelaender]], aussen.map((x) => x * s), ARTEN.gelaender, eisen, Bk.gelaender); };
            const t = Bk.tiefe - 0.04;
            gitter(ort(ua, t, 0), ort(ub, t, 0), breit, nrm);
            gitter(ort(ua, 0, 0), ort(ua, t, 0), t, [-k.d[0], -k.d[1], 0]);
            gitter(ort(ub, 0, 0), ort(ub, t, 0), t, [k.d[0], k.d[1], 0]);
          }
        }
      }
    }
  }
  return fertig();
}

// ------------------------------------------------------------------ relief: the façade's parts stand out of the wall

/**
 * How far the parts of a drawn façade stand out of the wall (metres), and where there is relief: the street sides
 * of the houses within `umkreis` metres of the court, what the game camera and a ride through the streets see.
 * The whole quarter with its yards would be some 1.6 million corners, this about 130 000.
 */
export const RELIEF = { rahmen: 0.08, bank: 0.14, gesims: 0.18, hof: false, umkreis: 100 };

/**
 * The relief of a dressed house: a second mesh, in the format of `netz`, that lifts the parts its façade kit knows
 * (bausaetze.json: `oeffnungen`, `gesimse`) out of the flat, drawn wall. Window and door frames stand out with
 * their reveals running back to the glass, which stays in the wall; the bottom of a frame stands out further as a
 * sill; cornice bands run along the whole front. Every face shows the façade's own pixels: front faces the same
 * place of the sheet as the flat wall behind them, sides the pixel row or column at their edge, stretched. A part
 * gets relief only where it lies wholly in one cell (one cut piece, one storey) of the wall; party walls, plain
 * walls and houses without a kit get none. `hof: false` leaves the yard sides flat; `umkreis` (metres round the
 * court centre) limits the relief to the houses that reach into it.
 */
export function relief(h, { hof = RELIEF.hof, umkreis = RELIEF.umkreis } = {}) {
  const P = [], N = [], W = [], B = [], F = [], I = [];
  let n = 0;
  const leer = { positionen: new Float64Array(0), normalen: new Float32Array(0), wand: new Float32Array(0), bau: new Float32Array(0), farbe: new Float32Array(0), indizes: new Uint16Array(0) };
  const K = h.kleid;
  if (!K?.satz || !K.lage) return leer;
  const [x0k, y0k, x1k, y1k] = h.kasten; // only houses that reach into the circle round the court
  if (Math.hypot(Math.max(0, Math.abs((x0k + x1k) / 2) - (x1k - x0k) / 2), Math.max(0, Math.abs((y0k + y1k) / 2) - (y1k - y0k) / 2)) > umkreis) return leer;
  const stock = geschosslinien(h);
  // Every part carries the bearing of the wall it sits on (third number of `wand`, negative so that it is no height:
  // -(10 + angle)). A drawing with cast shadows gives a part its wall's shade: a sill of 14 cm is far too small for a
  // shadow map to tell whether it is lit.
  let wandwinkel = 0;
  // a quad: four corners in space with their places on the sheet; turned so that it faces `nrm`
  const flaeche4 = (p, wo, nrm, box, ton) => {
    const u = [p[1][0] - p[0][0], p[1][1] - p[0][1], p[1][2] - p[0][2]], v = [p[2][0] - p[0][0], p[2][1] - p[0][1], p[2][2] - p[0][2]];
    const c = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    if (Math.hypot(...c) < 1e-9) return;
    const ordnung = c[0] * nrm[0] + c[1] * nrm[1] + c[2] * nrm[2] >= 0 ? [0, 1, 2, 3] : [0, 3, 2, 1], i = n;
    for (const m of ordnung) { P.push(...p[m]); N.push(...nrm); W.push(wo[m][0], wo[m][1], wandwinkel, ARTEN.bild); B.push(...box); F.push(...ton); n++; }
    I.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  // the pieces of every run along the house's edges
  const stuecke = new Map();
  for (const k of h.kanten) for (const st of k.stuecke) if (st.lauf != null) (stuecke.get(st.lauf) ?? stuecke.set(st.lauf, []).get(st.lauf)).push({ k, st });
  K.laeufe.forEach((lauf, nr) => {
    if (lauf.bild.gestreckt || (!hof && lauf.art !== 'strasse')) return;
    const satz = lauf.satz, [ox, oy] = K.lage[satz.id], g = lauf.grenzen, teile = stuecke.get(nr) ?? [];
    // a place along the run (u, metres) → the edge piece it lies on
    const stueckBei = (u) => teile.find(({ st }) => u >= st.u0 - 1e-6 && u <= st.u0 + (st.t1 - st.t0) + 1e-6);
    lauf.bild.spalten.forEach(([sx0, sx1], c) => {
      const ua = g[c], ub = g[c + 1], X = (x) => ua + ((x - sx0) / (sx1 - sx0)) * (ub - ua);
      lauf.zeilen.forEach(([y0, y1], e) => {
        const zu = stock[e], zo = stock[e + 1], Z = (y) => zu + ((y1 - y) / (y1 - y0)) * (zo - zu);
        const box = [ox + sx0, oy + y0, ox + sx1, oy + y1];
        // a box standing out of the wall over the picture rectangle [xa, xb] × [ya, yb], `tief` deep; `seiten`: which
        // sides to close (o, u, l, r); `innen` turns the sides into a reveal (facing into the box: a hole's walls)
        const kasten = (xa, xb, ya, yb, tief, seiten = 'oulr', innen = false) => {
          const A = stueckBei(X(xa)), Bst = stueckBei(X(xb));
          if (!A || A !== Bst) return false; // across a corner of the house: no relief
          const { k, st } = A, nx = k.n[0], ny = k.n[1];
          wandwinkel = -(10 + Math.atan2(ny, nx));
          const ort = (x, y, t) => { const q = auf(k, st.t0 + X(x) - st.u0); return [q[0] + nx * t, q[1] + ny * t, Z(y)]; };
          const at = (x, y) => [ox + x, oy + y];
          if (!innen) flaeche4([ort(xa, yb, tief), ort(xb, yb, tief), ort(xb, ya, tief), ort(xa, ya, tief)], [at(xa, yb), at(xb, yb), at(xb, ya), at(xa, ya)], [nx, ny, 0], box, lauf.ton);
          const s = innen ? -1 : 1, r = 0.5; // sides show the pixel line just inside their edge
          if (seiten.includes('o')) flaeche4([ort(xa, ya, 0), ort(xb, ya, 0), ort(xb, ya, tief), ort(xa, ya, tief)], [at(xa, ya + r * s), at(xb, ya + r * s), at(xb, ya + r * s), at(xa, ya + r * s)], [0, 0, s], box, lauf.ton);
          if (seiten.includes('u')) flaeche4([ort(xa, yb, 0), ort(xb, yb, 0), ort(xb, yb, tief), ort(xa, yb, tief)], [at(xa, yb - r * s), at(xb, yb - r * s), at(xb, yb - r * s), at(xa, yb - r * s)], [0, 0, -s], box, lauf.ton);
          if (seiten.includes('l')) flaeche4([ort(xa, ya, 0), ort(xa, yb, 0), ort(xa, yb, tief), ort(xa, ya, tief)], [at(xa + r * s, ya), at(xa + r * s, yb), at(xa + r * s, yb), at(xa + r * s, ya)], [-k.d[0] * s, -k.d[1] * s, 0], box, lauf.ton);
          if (seiten.includes('r')) flaeche4([ort(xb, ya, 0), ort(xb, yb, 0), ort(xb, yb, tief), ort(xb, ya, tief)], [at(xb - r * s, ya), at(xb - r * s, yb), at(xb - r * s, yb), at(xb - r * s, ya)], [k.d[0] * s, k.d[1] * s, 0], box, lauf.ton);
          return true;
        };
        for (const o of satz.oeffnungen ?? []) {
          if (o.x < sx0 || o.x + o.b > sx1 || o.y < y0 || o.y + o.h > y1) continue; // not wholly in this cell
          if (o.art === 'tuer' && !lauf.bild.spalten.includes(satz.mitte)) continue; // the door piece is not on this wall
          const [x0, y0o, x1, y1o] = [o.x, o.y, o.x + o.b, o.y + o.h];
          const [gx0, gy0, gx1, gy1] = o.glas ? [o.glas[0], o.glas[1], o.glas[0] + o.glas[2], o.glas[1] + o.glas[3]] : [x0 + 1, y0o + 1, x1 - 1, y1o]; // a door: a frame one pixel wide, open at the threshold
          if (gx1 - gx0 < 1 || gy1 - gy0 < 1) continue;
          const T = RELIEF.rahmen;
          // the frame: four bars round the glass, each a box; the glass behind stays in the wall
          // (the frame's narrow outer sides are left out: 8 cm, hardly ever seen, and the most faces)
          if (gy0 > y0o) kasten(x0, x1, y0o, gy0, T, 'o');                            // lintel, with its top
          if (gx0 > x0) kasten(x0, gx0, gy0, gy1, T, '');                             // left jamb
          if (x1 > gx1) kasten(gx1, x1, gy0, gy1, T, '');                             // right jamb
          if (y1o > gy1) kasten(x0, x1, gy1, y1o, o.art === 'tuer' ? T : RELIEF.bank, o.art === 'tuer' ? '' : 'ou'); // sill (deeper, a ledge) or threshold
          // the reveal: from the frame's inner edge back to the glass
          kasten(gx0, gx1, gy0, gy1, T, o.art === 'tuer' ? 'olr' : 'oulr', true);
        }
        // cornices: bands across the cell, broken where a door or window crosses them (a plinth band does not run
        // over the front door); closed at the ends of the run and at every break
        const letzte = lauf.bild.spalten.length - 1;
        for (const [ga, gb] of satz.gesimse ?? []) {
          if (ga < y0 || gb > y1 || gb - ga < 1) continue;
          const luecken = (satz.oeffnungen ?? []).filter((o) => o.y < gb && o.y + o.h > ga && o.x < sx1 && o.x + o.b > sx0).map((o) => [Math.max(sx0, o.x), Math.min(sx1, o.x + o.b)]).sort((p, q) => p[0] - q[0]);
          let von = sx0, offenL = c === 0;
          for (const [la, lb] of [...luecken, [sx1, sx1]]) {
            if (la - von >= 1) kasten(von, la, ga, gb, RELIEF.gesims, 'ou' + (offenL ? 'l' : '') + (la < sx1 || c === letzte ? 'r' : ''));
            von = Math.max(von, lb); offenL = true;
          }
        }
      });
    });
  });
  return { positionen: new Float64Array(P), normalen: new Float32Array(N), wand: new Float32Array(W), bau: new Float32Array(B), farbe: new Float32Array(F), indizes: n < 65536 ? new Uint16Array(I) : new Uint32Array(I) };
}

// ------------------------------------------------------------------ dressing the houses in sprites (façade kits)
//
// A kit is one drawn façade (SpriteCook) cut into window axes (a left and a right edge, plain axes, a middle piece
// with the door) and into storeys. For a wall of any length the axes are set side by side again, pixel for pixel,
// and for a house of any height the storeys are stacked again; footprint, eaves and roof stay what the geodata says.
// Kits whose wall is one colour are tinted to the house's colour. See assets/welt/haeuser/bausaetze.json.

const weite = ([a, b]) => b - a;

/**
 * The columns of a façade picture for a wall of `laenge` metres: [[x0, x1], …] of the kit's picture, left to right.
 * A wall too short for both edges gets the plain pier between two windows, stretched (`gestreckt`).
 */
export function fuege(f, laenge, pxJeM, mitMitte = false, saat = 0) {
  const ziel = laenge * pxJeM, rand = weite(f.links) + weite(f.rechts);
  if (ziel < Math.max(rand, 12) * 0.9) return { spalten: [[f.pfeiler, f.pfeiler + 1]], breite: 4, gestreckt: true };
  const mitte = mitMitte && ziel >= rand + weite(f.mitte) * 0.9 ? [f.mitte] : [];
  const achse = f.achsen.reduce((s, a) => s + weite(a), 0) / f.achsen.length, rechte = f.achsenRechts ?? f.achsen;
  const n = Math.max(0, Math.round((ziel - rand - mitte.reduce((s, a) => s + weite(a), 0)) / achse)), halb = Math.ceil(n / 2);
  const reihe = (aus, wieviele, salz) => { const start = Math.floor(saat * aus.length) + salz; return Array.from({ length: wieviele }, (_, i) => aus[(start + i) % aus.length]); };
  const spalten = [f.links, ...reihe(f.achsen, halb, 0), ...mitte, ...reihe(rechte, n - halb, halb), f.rechts], breite = spalten.reduce((s, a) => s + weite(a), 0);
  if (Math.abs(breite / ziel - 1) > 0.25) return { spalten: [[f.pfeiler, f.pfeiler + 1]], breite: 4, gestreckt: true }; // rather a plain wall than a squeezed window
  return { spalten, breite, gestreckt: false };
}

/** The rows of a façade picture for a house of `etagen` storeys, from the ground floor up: [[top, bottom], …] in the picture. */
export function schichte(f, etagen) {
  const reihen = f.zeilen.slice(0, -1).map((z, i) => [z, f.zeilen[i + 1]]), eg = reihen.at(-1), ober = reihen.slice(0, -1).reverse();
  if (etagen <= 1 || !ober.length) return [eg];
  const mitte = ober.slice(1, -1);
  return [eg, ...Array.from({ length: etagen - 1 }, (_, i) => (i === etagen - 2 ? ober.at(-1) : i === 0 ? ober[0] : mitte.length ? mitte[(i - 1) % mitte.length] : ober[0]))];
}

/** Which pixels of a façade picture are the wall itself (and so take the house's colour): the wall colour, grown into its shades, small specks left out. */
export function wandmaske(bild, f) {
  const { width: w, height: h, data: d } = bild, maske = new Uint8Array(w * h);
  if (!f.faerbbar) return maske;
  const [R, G, B] = rgb(f.wand).map((v) => v * 255), nah = (i, tol) => d[i + 3] > 0 && Math.abs(d[i] - R) + Math.abs(d[i + 1] - G) + Math.abs(d[i + 2] - B) < tol;
  const schatten = (i) => { if (!d[i + 3]) return false; const r = d[i] / R, g = d[i + 1] / G, b = d[i + 2] / B, s = (r + g + b) / 3; return s > 0.5 && s < 1.15 && Math.abs(r - s) < 0.07 && Math.abs(g - s) < 0.07 && Math.abs(b - s) < 0.07; };
  const nachbarn = (p) => { const x = p % w; return [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w].filter((q) => q >= 0 && q < w * h); };
  // patches of the plain wall colour; a patch of only a few pixels is a glint on glass, not wall
  const gruppe = new Int32Array(w * h).fill(-1);
  for (let p = 0, nr = 0; p < w * h; p++) {
    if (gruppe[p] >= 0 || !nah(p * 4, 28)) continue;
    const stapel = [p], alle = [p]; gruppe[p] = nr;
    while (stapel.length) for (const q of nachbarn(stapel.pop())) if (gruppe[q] < 0 && nah(q * 4, 28)) { gruppe[q] = nr; stapel.push(q); alle.push(q); }
    if (alle.length >= 10) for (const q of alle) maske[q] = 1;
    nr++;
  }
  const stapel = []; for (let p = 0; p < w * h; p++) if (maske[p]) stapel.push(p);
  while (stapel.length) for (const q of nachbarn(stapel.pop())) if (!maske[q] && (nah(q * 4, 28) || schatten(q * 4))) { maske[q] = 1; stapel.push(q); }
  return maske;
}

/** Chimneys, roof windows and (on a steep roof) dormers of a saddle roof, sized by their sprites. */
function dachaufbauten(h, saetze) {
  const d = h.dach, aus = [], t = saetze.teile;
  if (d.form !== 'sattel') return aus;
  let seite = 0; // which side of the ridge looks at the street
  for (const k of h.kanten) for (const s of k.stuecke) if (s.art === 'strasse') seite += mal(k.n, d.v) * (s.t1 - s.t0);
  const vorn = seite >= 0 ? 1 : -1, lang = d.xb - d.xa, halb = (d.yb - d.ya) / 2;
  const ort = (u, s) => [d.o[0] + d.u[0] * u + d.v[0] * s, d.o[1] + d.u[1] * u + d.v[1] * s], drin = (p) => imRing(p, h.ring) && !h.loecher.some((l) => imRing(p, l));
  const mass = (name) => ({ art: name, px: [t[name].breite, t[name].hoehe], breite: t[name].breite / t.px_je_m, hoehe: t[name].hoehe / t.px_je_m });
  if (halb < 2.5 || lang < 4) return aus;
  for (const u of lang > 9 ? [d.xa + 1.8, d.xb - 1.8] : [(d.xa + d.xb) / 2]) { const p = ort(u, d.yr - vorn * 1.1); if (drin(p)) aus.push({ ...mass('schornstein'), mitte: p, tiefe: 0.7 }); }
  const steil = d.steigung >= 0.7, art = steil ? 'gaube' : 'dachfenster', anzahl = Math.max(1, Math.round(lang / (steil ? 4.5 : 6)));
  // dormers stand near the eaves of the street side, roof windows lie half way up
  for (let i = 0; i < anzahl; i++) { const p = ort(d.xa + ((i + 0.5) * lang) / anzahl, steil ? d.yr + vorn * (halb - 0.9) : d.yr + vorn * halb * 0.5); if (drin(p)) aus.push({ ...mass(art), mitte: p, seite: vorn }); }
  return aus;
}

/**
 * Dress one house: its free walls are grouped into runs (a front that goes on round a slight bend is one run), every
 * run gets its kit, its columns and its storeys; the roof gets its parts. `strasse` is the kit of the street fronts
 * (null: a yard building, plastered all round), `hof` the plain kit of the yard fronts.
 */
export function kleide(h, saetze, strasse, hof) {
  const laeufe = [], ton = (ziel, von) => { const a = rgb(ziel), b = rgb(von); return [a[0] / b[0], a[1] / b[1], a[2] / b[2], h.saat]; };
  let start = 0;
  for (const anzahl of h.kantenRinge) {
    let lauf = null;
    for (let i = 0; i < anzahl; i++) {
      const k = h.kanten[start + i];
      for (const s of k.stuecke) {
        s.lauf = null;
        if (s.art === 'brandwand' || !strasse) { lauf = null; continue; }
        const weiter = lauf && lauf.art === s.art && lauf.amEnde && s.t0 === 0 && Math.abs(kreuz(lauf.d, k.d)) < 0.2 && mal(lauf.d, k.d) > 0;
        if (!weiter) { lauf = { art: s.art, laenge: 0 }; laeufe.push(lauf); }
        s.lauf = laeufe.indexOf(lauf); s.u0 = lauf.laenge;
        lauf.laenge += s.t1 - s.t0; lauf.d = k.d; lauf.amEnde = Math.abs(s.t1 - k.l) < 1e-9;
      }
    }
    start += anzahl;
  }
  const front = laeufe.filter((l) => l.art === 'strasse').sort((a, b) => b.laenge - a.laenge)[0];
  for (const l of laeufe) {
    const satz = l.art === 'strasse' ? strasse : hof ?? strasse, wandton = strasse.klinker ? h.wand.hofFarbe : h.wand.farbe; // behind a brick front the yard is rendered
    l.satz = satz;
    l.bild = fuege(satz, l.laenge, satz.hoehe / saetze.hoehe_m, l === front && h.tuer !== false, h.saat);
    l.grenzen = l.bild.spalten.reduce((g, sp) => [...g, g.at(-1) + (weite(sp) * l.laenge) / (l.bild.gestreckt ? 1 : l.bild.breite)], [0]);
    l.zeilen = schichte(satz, h.etagen);
    l.ton = satz.faerbbar ? ton(l.art === 'strasse' ? h.wand.farbe : wandton, satz.wand) : [1, 1, 1, h.saat];
    delete l.d; delete l.amEnde;
  }
  h.kleid = { satz: strasse, laeufe, aufbauten: strasse ? dachaufbauten(h, saetze) : [], lage: null,
    ton: { wand: ton(h.wand.farbe, saetze.putz.farbe), brandwand: ton('#b3a898', saetze.putz.farbe), dach: ton(h.dach.farbe, saetze.ziegel.farbe), flach: ton(h.dach.form === 'flach' ? h.dach.farbe : h.dach.flachFarbe, saetze.putz.farbe), gaube: ton('#5b5f6a', saetze.putz.farbe) } };
  return h.kleid;
}

/**
 * Dress the whole quarter. A house takes a kit that fits its ground floor (shop, home, school) and its material,
 * picked by its id, and not the kit of a neighbour it touches if there is another. Yard buildings and canopies get plaster.
 */
export function kleideViertel(haeuser, saetze) {
  const nach = new Map(haeuser.map((h) => [h.schluessel, h])), fuer = (was) => saetze.fassaden.filter((f) => f.fuer.includes(was)), hof = saetze.fassaden.find((f) => f.id === saetze.hof) ?? null;
  for (const h of haeuser) {
    let satz = null;
    if (h.art === 'haus' && h.eg !== 'neben') {
      const klinker = h.wand.material === 'klinker';
      let wahl = fuer(h.eg).filter((f) => !!f.klinker === klinker);
      if (!wahl.length) wahl = fuer(h.eg);
      if (!wahl.length) wahl = fuer('wohnen');
      const lose = wahl.flatMap((f) => Array(f.gewicht ?? 1).fill(f)), belegt = new Set(umgebung(h, haeuser, nach).map((o) => o.kleid?.satz?.id));
      for (let versuch = 0; versuch < 6; versuch++) { satz = lose[Math.floor(streuung(h.oid, 'satz' + (versuch || '')) * lose.length)]; if (!belegt.has(satz.id) || new Set(lose).size < 2) break; }
      // the wall's name follows what the house really wears: a brick kit is brick, a rendered kit takes a render colour
      const putz = PUTZ[Math.floor(streuung(h.oid, 'putz') * PUTZ.length)];
      if (satz.klinker) h.wand = { name: 'Klinker', farbe: satz.wand, material: 'klinker', hofFarbe: PUTZ[1][1] };
      else if (klinker) h.wand = { name: putz[0], farbe: putz[1], material: 'putz' };
    }
    kleide(h, saetze, satz, hof);
  }
  return haeuser;
}

/**
 * Places for the kit's pictures on one sheet (shelves, a few pixels apart): every façade and every roof part once.
 * Returns the sheet's size, where each picture goes, and `lage`: id → [x, y].
 */
export function packe(saetze, breite = 1024) {
  const bilder = [], lage = {};
  let x = 2, y = 2, zeile = 0;
  const platz = (id, datei, art, w, h, satz = null) => { if (x + w + 2 > breite) { x = 2; y += zeile + 4; zeile = 0; } lage[id] = [x, y]; bilder.push({ id, datei, art, satz, nach: [x, y, w, h] }); x += w + 4; zeile = Math.max(zeile, h); };
  for (const f of saetze.fassaden) platz(f.id, f.datei, 'fassade', f.breite, f.hoehe, f);
  for (const [name, t] of Object.entries(saetze.teile)) if (t?.datei) platz(name, t.datei, 'teil', t.breite, t.hoehe);
  let hoehe = 64;
  while (hoehe < y + zeile + 2) hoehe *= 2;
  return { breite, hoehe, bilder, lage };
}

/** How dark the shade painted on a façade is at its deepest (share of the light that stays), and how far it runs in pixels. */
export const SCHATTEN = { gesims: [0.62, 0.78, 0.9], bank: [0.7, 0.86], laibung: [0.55, 0.76], seite: 0.74, rahmen: 0.86, fuss: [0.8, 0.88, 0.95] };

/**
 * The shade a façade's own parts throw on it, as one number per pixel of its picture (255 = full light). The picture
 * is drawn flat; its measured parts (bausaetze.json: `gesimse`, `oeffnungen`) say what stands out and what lies back,
 * so the shade can be painted where it belongs, with the light from the upper left as in the sprites themselves:
 * a stepped shadow under every cornice band and window sill, the top and the left of every reveal dark on the glass,
 * a thin shadow to the right of each frame, and the foot of the wall a little darker. Pixel rows and columns, no blur.
 * `staerke` 0 … 1 scales all of it (0: no shade at all).
 */
export function schattenkarte(f, staerke = 1, { nurFuss = false } = {}) {
  const w = f.breite, h = f.hoehe, karte = new Uint8Array(w * h).fill(255);
  if (!(staerke > 0)) return karte;
  const dunkel = (x, y, anteil) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const v = Math.round(255 * (1 - (1 - anteil) * staerke)), i = y * w + x; if (v < karte[i]) karte[i] = v; };
  const zeile = (x0, x1, y, anteil) => { for (let x = x0; x < x1; x++) dunkel(x, y, anteil); };
  const oeffnungen = nurFuss ? [] : f.oeffnungen ?? [];
  // cornices: the band ends at row gb; a thin one throws a shorter shadow. Not below the plinth at the wall's foot
  for (const [ga, gb] of nurFuss ? [] : f.gesimse ?? []) {
    if (gb - ga < 1 || gb >= h - SCHATTEN.fuss.length) continue;
    const stufen = gb - ga >= 3 ? SCHATTEN.gesims : SCHATTEN.gesims.slice(1);
    stufen.forEach((anteil, k) => zeile(0, w, gb + k, anteil));
  }
  for (const o of oeffnungen) {
    const [gx, gy, gb, gh] = o.glas ?? [o.x + 1, o.y + 1, o.b - 2, o.h - 1]; // a door: the leaf inside its frame
    if (gb < 1 || gh < 1) continue;
    // the reveal: the lintel's shadow on the glass, and the left jamb's
    SCHATTEN.laibung.forEach((anteil, k) => { if (k < gh) zeile(gx, gx + gb, gy + k, anteil); });
    for (let y = gy; y < gy + gh; y++) dunkel(gx, y, SCHATTEN.seite);
    // the frame stands out: a line of shadow on the wall to its right
    for (let y = o.y + 1; y < o.y + o.h; y++) dunkel(o.x + o.b, y, SCHATTEN.rahmen);
    // the sill is a ledge: its shadow falls on the wall below, a pixel to the right
    if (o.art !== 'tuer') SCHATTEN.bank.forEach((anteil, k) => zeile(o.x + 1, o.x + o.b + 1, o.y + o.h + k, anteil));
  }
  // the foot of the wall, where the street's light does not reach
  SCHATTEN.fuss.forEach((anteil, k) => zeile(0, w, h - 1 - k, anteil));
  return karte;
}

/**
 * How far every pixel of a façade's picture stands out of the wall, in millimetres (0 … 255): the same parts and
 * depths as the relief (RELIEF): cornice bands, the frames round the glass, the sills. Wall and glass are 0. With
 * this a drawing can let the shade of the parts follow the sun (a pixel is in shade when, on the way to the sun,
 * something stands higher than the ray): what `schattenkarte` paints once, for one light, moves.
 */
export function tiefenkarte(f) {
  const w = f.breite, h = f.hoehe, karte = new Uint8Array(w * h);
  const feld = (x0, y0, x1, y1, m) => { const v = Math.round(m * 1000); for (let y = Math.max(0, y0); y < Math.min(h, y1); y++) for (let x = Math.max(0, x0); x < Math.min(w, x1); x++) if (v > karte[y * w + x]) karte[y * w + x] = v; };
  for (const [ga, gb] of f.gesimse ?? []) if (gb - ga >= 1) feld(0, ga, w, gb, RELIEF.gesims);
  for (const o of f.oeffnungen ?? []) {
    const [gx, gy, gb, gh] = o.glas ?? [o.x + 1, o.y + 1, o.b - 2, o.h - 1], x1 = o.x + o.b, y1 = o.y + o.h;
    if (gb < 1 || gh < 1) continue;
    for (let y = o.y; y < y1; y++) for (let x = o.x; x < x1; x++) karte[y * w + x] = 0; // an opening breaks a cornice
    feld(o.x, o.y, x1, gy, RELIEF.rahmen); feld(o.x, gy, gx, gy + gh, RELIEF.rahmen); feld(gx + gb, gy, x1, gy + gh, RELIEF.rahmen); // lintel and jambs
    if (y1 > gy + gh) feld(o.x, gy + gh, x1, y1, o.art === 'tuer' ? RELIEF.rahmen : RELIEF.bank); // sill or threshold
  }
  return karte;
}

/** Unit vector towards the sun in the grid (east, north, up) from a compass bearing and an elevation in degrees. */
export function lichtvektor(azimut, hoehe, konvergenz = 0) {
  const a = ((azimut - konvergenz) * Math.PI) / 180, e = (hoehe * Math.PI) / 180;
  return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
}
