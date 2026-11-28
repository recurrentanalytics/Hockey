// Houses of the neighbourhood: every ALKIS footprint becomes a house with eaves, a roof, a wall colour,
// storeys, window axes, a shop front or a gateway. Everything follows from the geodata and fixed rules,
// so the same data always gives the same street. Pure rules first (tested under Node), drawing below.
//
// Units: metres in the place's grid, relative to the court centre (east, north, up). Walls and roofs
// carry their own coordinates in metres, and the shader draws on them at PX art pixels per metre.
import { streuung } from './baeume.js';
import { ladeBild } from './bild.js';

export const PX = 16;                          // art pixels per metre on walls and roofs
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

// what a surface is; 0 to 6 are drawn by rule, 7 to 11 show sprites: a façade picture, a cut-out part, plaster, roof tiles, a flat roof
const ARTEN = { strasse: 0, hof: 1, brandwand: 2, tunnel: 3, ziegel: 4, flachdach: 5, untersicht: 6, bild: 7, teil: 8, putz: 9, ziegelbild: 10, flachbild: 11 };
const ECKE_L = 16, ECKE_R = 32, KLINKER_BIT = 64, OFFEN = 128;
const EG = { wohnen: 0, laden: 1, schule: 2, neben: 3 };
const DACHFORM = { gabled: 'sattel', hipped: 'walm', quadruple_saltbox: 'walm', flat: 'flach' };

// ------------------------------------------------------------------ plane geometry

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const kreuz = (a, b) => a[0] * b[1] - a[1] * b[0];
const mal = (a, b) => a[0] * b[0] + a[1] * b[1];
const gleich = (a, b) => Math.abs(a[0] - b[0]) < 1e-9 && Math.abs(a[1] - b[1]) < 1e-9;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);

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
 * Eaves height, storeys, the height left for the roof, and where they come from. A storey is never taller than
 * 3.9 m: what a measured height has beyond that belongs to the roof. Footprints without any height are low
 * yard buildings by their size.
 */
export function hoehen(p, m2) {
  const etagenOsm = zahl(p.osm_building_levels), dachEtagen = zahl(p.osm_roof_levels), rund = (v) => Math.round(v * 100) / 100;
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
  const p = teil.p, m2 = Math.abs(flaeche(teil.ring)) - teil.loecher.reduce((s, l) => s + Math.abs(flaeche(l)), 0);
  const dach = /Überdachung/.test(p.funktion ?? '');
  const hh = dach ? { traufe: 3, etagen: 1, dach: 0, quelle: 'angenommen (Überdachung)' } : hoehen(p, m2);
  const fn = p.funktion ?? '';
  const eg = dach ? 'neben' : /Schule|öffentliche|Turnhalle/.test(fn) ? 'schule' : /Handel/.test(fn) ? 'laden'
    : p.hoehe_m == null || (/Wirtschaft|Versorgung/.test(fn) && zahl(p.osm_building_levels) == null) ? 'neben' : 'wohnen';
  const ringe = [teil.ring, ...teil.loecher], kanten = ringe.flatMap(kantenVon);
  return {
    oid: p.oid, schluessel: nummer ? `${p.oid}#${nummer}` : p.oid, art: dach ? 'ueberdachung' : 'haus', funktion: fn, name: p.name ?? null, adresse: p.adresse ?? null,
    ring: teil.ring, loecher: teil.loecher, flaeche: Math.round(m2 * 10) / 10, kasten: kasten(teil.ring), kanten, kantenRinge: ringe.map((r) => r.length), nachbarn: new Set(), durchfahrten: [],
    traufe: hh.traufe, etagen: hh.etagen, dachHoehe: hh.dach, hoeheQuelle: hh.quelle, eg, sockel: dach ? hh.traufe - 0.3 : 0,
    egHoehe: Math.round((hh.etagen === 1 ? hh.traufe : Math.min(ERDGESCHOSS, (hh.traufe / hh.etagen) * 1.15)) * 100) / 100,
    dachWunsch: dach ? 'flach' : DACHFORM[p.osm_roof_shape] ?? 'flach', dachAngabe: p.osm_roof_shape ?? null,
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
  if (h.dachWunsch === 'sattel') {
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
  const hoehe = Math.round(Math.min(7.5, Math.max(halb * 0.35, Math.min(halb * 1.2, h.dachHoehe > 0.5 ? h.dachHoehe : halb * 0.6))) * 100) / 100;
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
      const belegt = new Set([...h.nachbarn].map((n) => nach.get(n)?.wand?.farbe));
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
 * fronts get shop windows and doors). Sorted by id, and independent of the order of the input.
 */
export function viertel(gebaeude, frame, { wege = null } = {}) {
  const [E0, N0] = frame.ursprung_utm32, lokal = (p) => [p[0] - E0, p[1] - N0];
  const teile = [];
  for (const f of gebaeude.features) {
    const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    polys.forEach((poly, nummer) => {
      const ring = saeubere(poly[0].map(lokal), true);
      if (ring.length >= 3 && flaeche(ring) > 0.5) teile.push({ p: f.properties, nummer, ring, loecher: poly.slice(1).map((r) => saeubere(r.map(lokal), false)).filter((r) => r.length >= 3) });
    });
  }
  const haeuser = teile.filter((t) => t.p.art !== 'Bauteil').map((t) => grundlage(t, t.nummer)).sort((a, b) => (a.schluessel < b.schluessel ? -1 : 1));
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
  const etagen = h.etagen, stock = [0, ...Array.from({ length: etagen }, (_, e) => (e === etagen - 1 ? T : h.egHoehe + (e * (T - h.egHoehe)) / (etagen - 1)))];
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
    l.bild = fuege(satz, l.laenge, satz.hoehe / saetze.hoehe_m, l === front, h.saat);
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
      const lose = wahl.flatMap((f) => Array(f.gewicht ?? 1).fill(f)), belegt = new Set([...h.nachbarn].map((s) => nach.get(s)?.kleid?.satz?.id));
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

/** Unit vector towards the sun in the grid (east, north, up) from a compass bearing and an elevation in degrees. */
export function lichtvektor(azimut, hoehe, konvergenz = 0) {
  const a = ((azimut - konvergenz) * Math.PI) / 180, e = (hoehe * Math.PI) / 180;
  return [Math.sin(a) * Math.cos(e), Math.cos(a) * Math.cos(e), Math.sin(e)];
}

// ------------------------------------------------------------------ drawing (browser, CesiumJS)

/** How much of a house stays when it stands between the camera and the player: a screen of pixels, not glass. */
export const DURCHSICHT = 0.2;

const VS = `
in vec3 position3DHigh;
in vec3 position3DLow;
in vec3 normal;
in vec4 wand;
in vec4 bau;
in vec4 farbe;
in vec4 color;
in float batchId;
out vec3 v_normale;
out vec4 v_wand;
out vec4 v_bau;
out vec4 v_farbe;
out vec4 v_ton;
void main() {
  vec4 p = czm_computePosition();
  v_normale = normal;
  v_wand = wand;
  v_bau = bau;
  v_farbe = farbe;
  v_ton = color;
  gl_Position = czm_modelViewProjectionRelativeToEye * p;
}`;

// Everything is drawn on a grid of PX art pixels per metre of wall or roof: flat colours, one shade step,
// a dark outline at the wall's foot, top and corners. Three steps of light by the side the sun is on.
// Far away the fine lines go first and the windows last, so nothing flickers.
const FS = `
in vec3 v_normale;
in vec4 v_wand;
in vec4 v_bau;
in vec4 v_farbe;
in vec4 v_ton;
uniform vec3 u_licht;
uniform float u_staerke;
uniform float u_deckung;
uniform sampler2D u_atlas;   // façade pictures and cut-out parts of the dressed houses
uniform sampler2D u_ziegel;  // roof tiles, repeating
uniform sampler2D u_putz;    // plaster of party walls, repeating
uniform vec2 u_atlasMass;    // size of the atlas in pixels
uniform vec2 u_ziegelMass;   // metres one repeat of the tiles covers
uniform vec2 u_putzMass;

const float PX = ${PX.toFixed(1)};
const float ACHSE = ${ACHSE.toFixed(2)};
const float DURCHFAHRT = ${DURCHFAHRT.toFixed(2)};
const vec3 KONTUR = vec3(0.165, 0.114, 0.102);
const vec3 PAPIER = vec3(0.969, 0.937, 0.863);
const vec3 GLAS = vec3(0.235, 0.286, 0.369);
const vec3 GLANZ = vec3(0.447, 0.529, 0.624);
const vec3 VORHANG = vec3(0.87, 0.85, 0.78);

float zufall(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float raster2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float raster4(vec2 a) { return raster2(0.5 * a) * 0.25 + raster2(a); }
float bit(float wert, float stelle) { return mod(floor(wert / stelle), 2.0); }

// doors, shop signs and awnings: dark green, oxblood, navy, ochre, anthracite
vec3 schildfarbe(float h) {
  return h < 0.2 ? vec3(0.165, 0.29, 0.22) : h < 0.4 ? vec3(0.45, 0.16, 0.14) : h < 0.6 ? vec3(0.17, 0.23, 0.36) : h < 0.8 ? vec3(0.72, 0.5, 0.16) : vec3(0.22, 0.2, 0.21);
}

// a window: frame, transom and mullion, a glint on the glass, now and then a curtain. p: art pixel in the opening, g: its size
vec3 fenster(vec2 p, vec2 g, vec3 rahmen, float h) {
  float kaempfer = floor(g.y * 0.66), mitte = floor(g.x * 0.5);
  if (p.x < 1.0 || p.x >= g.x - 1.0 || p.y < 1.0 || p.y >= g.y - 1.0 || p.y == kaempfer || (p.x == mitte && p.y < kaempfer)) return rahmen;
  if (h < 0.36 && p.y < kaempfer && (h < 0.18 ? p.x < mitte - 1.0 : p.x > mitte + 1.0)) return VORHANG;
  float s = p.x + p.y - g.y * 0.7;
  return s > 0.0 && s < 4.0 ? GLANZ : GLAS;
}

void main() {
  vec2 breite = fwidth(v_wand.xy) * PX;
  float f = max(breite.x, breite.y);                       // art pixels per screen pixel
  float code = floor(v_wand.w + 0.5), art = mod(code, 16.0);
  // the sprites, looked up before anything is thrown away: on façade cells and roof parts v_wand.xy is the place in the atlas in pixels
  // never a pixel of the neighbouring cell: with multisampling a fragment on a quad's edge is shaded a little beyond it
  vec2 ort = art > 6.5 && art < 7.5 ? clamp(v_wand.xy, v_bau.xy + 0.01, v_bau.zw - 0.01) : v_wand.xy;
  vec4 bild = texture(u_atlas, vec2(ort.x, u_atlasMass.y - ort.y) / u_atlasMass);
  vec3 ziegelbild = texture(u_ziegel, v_wand.xy / u_ziegelMass).rgb, putzbild = texture(u_putz, v_wand.xy / u_putzMass).rgb;
  if (v_ton.a * u_deckung <= raster4(gl_FragCoord.xy * 0.5)) discard;

  vec3 grund = v_farbe.rgb, fein = grund, grob = grund, mittel = grund;
  vec2 t = floor(v_wand.xy * PX);
  vec3 nn = normalize(v_normale);
  float d = dot(nn, u_licht), stufe = 0.8;

  if (art > 6.5) {                                         // dressed in sprites: the picture is the drawing, only the light is added
    stufe = nn.z > 0.5 ? (d > 0.72 ? 1.0 : d > 0.45 ? 0.93 : 0.84) : (d > 0.3 ? 1.0 : d > -0.15 ? 0.92 : 0.82);
    // v_farbe is the tint: the wanted colour divided by the picture's own. On a façade only the wall takes it (the atlas marks wall pixels with half alpha)
    if (art < 7.5) grund = mix(bild.rgb, min(bild.rgb * v_farbe.rgb, vec3(1.0)), clamp((1.0 - bild.a) * 2.0, 0.0, 1.0));
    else if (art < 8.5) { if (bild.a < 0.25) discard; grund = bild.rgb; }
    else if (art < 10.5 && art > 9.5) grund = min(ziegelbild * v_farbe.rgb, vec3(1.0));
    else grund = min(putzbild * v_farbe.rgb, vec3(1.0));
    fein = grund; grob = grund; mittel = grund;
    f = 0.0;                                               // the texture's own mip levels look after the distance
  } else if (art < 2.5) {                                  // a wall: street front, yard front or party wall
    stufe = d > 0.3 ? 1.0 : d > -0.15 ? 0.89 : 0.76;
    float L = v_bau.x, T = v_bau.y, S = floor(v_bau.z), egH = fract(v_bau.z) * 8.0;
    float bcode = floor(v_bau.w + 0.5), eg = mod(bcode, 4.0), stil = mod(floor(bcode / 4.0), 4.0), tuer = floor(bcode / 16.0) - 1.0;
    bool strasse = art < 0.5, brand = art > 1.5, offen = bit(code, 128.0) > 0.5;
    if (brand) { grund = mix(grund, vec3(0.66, 0.62, 0.57), 0.5); fein = grund; grob = grund; mittel = grund; }
    vec3 hell = mix(grund, PAPIER, 0.6), dunkel = grund * vec3(0.78, 0.76, 0.8);
    // mouldings: light on a coloured wall, a shade darker on a pale one. And the drawn line round openings, softer than the silhouette
    vec3 zier = dot(grund, vec3(0.3, 0.59, 0.11)) > 0.76 ? grund * vec3(0.87, 0.84, 0.8) : mix(grund, PAPIER, 0.72);
    vec3 strich = mix(KONTUR, grund, strasse ? 0.25 : 0.5);
    float hh = fract(v_farbe.a * 7.31);                    // one number for the whole house
    if (bit(code, 64.0) > 0.5) {                           // brick: a few courses show
      float reihe = floor(t.y / 2.0);
      if (mod(t.y, 2.0) < 1.0 && zufall(vec2(floor((t.x + reihe * 3.0) / 6.0), reihe)) < 0.3) fein = grund * 0.9;
    }
    float y = v_wand.y, Tt = floor(T * PX), egT = floor(egH * PX);
    if (!brand && y < T) {
      if (t.y < 8.0 && eg < 2.5) { fein = dunkel; grob = dunkel; } // plinth
      float n = L < 1.3 ? 0.0 : max(1.0, floor(L / ACHSE + 0.5));
      if (n > 0.5 && eg < 2.5) {
        mittel = mix(grund, GLAS, 0.2);
        float aw = L / n, i = clamp(floor(v_wand.x / aw), 0.0, n - 1.0);
        float x0 = floor(i * aw * PX + 0.5), cw = floor((i + 1.0) * aw * PX + 0.5) - x0, cx = t.x - x0;
        float k = 0.0, basis = 0.0, sh = egT;
        if (y >= egH) {
          float sH = (T - egH) / max(1.0, S - 1.0);
          k = 1.0 + clamp(floor((y - egH) / sH), 0.0, max(0.0, S - 2.0));
          basis = floor((egH + (k - 1.0) * sH) * PX); sh = floor(sH * PX);
        }
        float cy = t.y - basis, h1 = zufall(vec2(i + floor(v_farbe.a * 251.0), k * 7.0 + floor(L * 3.0)));
        bool laden = strasse && eg > 0.5 && eg < 1.5 && k < 0.5;
        float typ = 1.0, bw = 16.0, bh = 0.0, by = 14.0;   // 1 window, 2 door, 3 shop window, 4 shop door
        if (k > 0.5) { bw = strasse ? (fract(v_farbe.a * 3.7) < 0.5 ? 16.0 : 18.0) : 14.0; bh = min(strasse ? 28.0 : 24.0, sh - 22.0); }
        else if (!strasse) { by = 18.0; bw = 14.0; bh = min(22.0, sh - 24.0); }
        else if (i == tuer) { typ = laden ? 4.0 : 2.0; by = 0.0; bw = 18.0; bh = min(40.0, sh - 17.0); }
        else if (eg < 0.5) { by = 20.0; bh = min(26.0, sh - 28.0); }
        else if (eg < 1.5) { typ = 3.0; by = 9.0; bw = cw - 6.0; bh = sh - 26.0; }
        else { by = 16.0; bw = 18.0; bh = min(34.0, sh - 24.0); }
        bw = min(bw, cw - 6.0);
        vec2 g = vec2(bw, bh), p = vec2(cx - floor((cw - bw) * 0.5), cy - by);
        if (bw >= 6.0 && bh >= 8.0 && !(offen && k < 0.5)) {
          bool innen = p.x >= 0.0 && p.x < g.x && p.y >= 0.0 && p.y < g.y, rand = p.x < 1.0 || p.x >= g.x - 1.0 || p.y < 1.0 || p.y >= g.y - 1.0;
          bool um = !innen && p.x >= -1.0 && p.x <= g.x && p.y >= -1.0 && p.y <= g.y;                       // the line round the opening
          bool quer = p.x >= -3.0 && p.x < g.x + 3.0;
          vec3 schild = schildfarbe(hh);
          if (typ < 1.5) {
            if (innen) { fein = fenster(p, g, strasse ? PAPIER : hell, h1); grob = mix(GLAS, GLANZ, 0.25); }
            else if (um) fein = strich;
            else if (quer && p.y == -2.0) fein = strasse ? PAPIER : hell;                                    // sill
            else if (quer && p.y == -3.0) fein = dunkel;
            else if (strasse && stil > 1.5 && quer && p.y >= -1.0 && p.y <= g.y + 2.0) fein = zier;          // surround
            else if (strasse && mod(stil, 2.0) > 0.5 && quer && p.y > g.y + 1.0 && p.y < g.y + 4.0) fein = zier; // head moulding
            else if (strasse && mod(stil, 2.0) > 0.5 && quer && p.y == g.y + 4.0) fein = strich;
          } else if (typ < 2.5) {
            if (innen) {
              grob = schild;
              if (p.x < 1.0 || p.x >= g.x - 1.0 || p.y >= g.y - 1.0 || p.y == g.y - 9.0) fein = PAPIER;
              else if (p.y > g.y - 9.0) fein = GLAS;                                                        // fanlight
              else if (p.x == floor(g.x * 0.5)) fein = schild * 0.7;
              else if (mod(p.y, 13.0) < 1.0 && p.y > 2.0) fein = schild * 0.82;                             // panels
              else fein = schild;
            } else if (um && p.y >= 0.0) fein = strich;
            else if (quer && p.y >= 0.0 && p.y <= g.y + 2.0) fein = zier;                                   // the door's frame in stone
          } else {
            if (innen) {
              grob = mix(GLAS, vec3(0.8, 0.72, 0.5), 0.22);
              float s = p.x + p.y - g.y * 0.8;
              if (rand) fein = schild;
              else if (typ < 3.5 && p.y < 7.0) fein = vec3(0.62, 0.5, 0.36);                                // goods in the window
              else if (typ > 3.5 && p.x == floor(g.x * 0.5)) fein = schild;
              else fein = s > 0.0 && s < 5.0 ? GLANZ : grob;
            }
          }
        }
        if (laden && !offen) {                              // the shop's sign, and for some an awning
          vec3 schild = schildfarbe(hh);
          if (cy >= sh - 13.0 && cy < sh - 4.0) {
            fein = schild; grob = schild;
            if (zufall(vec2(i, floor(v_farbe.a * 97.0))) < 0.6 && cy >= sh - 11.0 && cy < sh - 7.0 && cx >= 5.0 && cx < cw - 5.0 && mod(cx - 5.0, 3.0) < 2.0
                && zufall(vec2(floor((cx - 5.0) / 3.0) + i * 13.0, floor(cy * 0.5) + floor(hh * 31.0))) < 0.7) fein = PAPIER;   // a name, too small to read
          } else if (fract(hh * 5.0) < 0.5 && i != tuer && cy >= sh - 19.0 && cy < sh - 13.0) {
            fein = mod(floor(t.x / 3.0), 2.0) < 0.5 ? schild : PAPIER; grob = mix(schild, PAPIER, 0.5);
          }
        }
      }
      if (strasse && S > 1.5 && t.y >= egT - 3.0 && t.y < egT) { fein = zier; grob = zier; }      // string course over the ground floor
      if (strasse && S > 1.5 && t.y == egT - 4.0) fein = dunkel;
      if (strasse && t.y >= Tt - 4.0) { fein = zier; grob = zier; }                               // cornice under the eaves
      if (t.y == Tt - (strasse ? 5.0 : 3.0)) fein = dunkel;
    }
    float unten = offen ? floor((y - min(DURCHFAHRT, T - 0.5)) * PX) : t.y;
    if (offen && unten < 3.0) fein = hell;                                       // head of the gateway
    if (unten < 1.0 && (offen || t.y < 1.0)) fein = KONTUR;                      // foot of the wall
    if (v_wand.z * PX < 1.0) fein = KONTUR;                                      // top of the wall: eaves and verge
    if ((bit(code, 16.0) > 0.5 && t.x < 1.0) || (bit(code, 32.0) > 0.5 && t.x >= floor(L * PX) - 1.0)) fein = KONTUR; // corners
  } else if (art < 3.5) {                                  // inside a gateway
    grund *= 0.5; fein = grund; grob = grund; mittel = grund;
  } else if (art < 4.5) {                                  // roof tiles
    stufe = d > 0.72 ? 1.0 : d > 0.45 ? 0.9 : 0.78;
    float reihe = floor(t.y / 4.0);
    if (mod(t.y, 4.0) < 1.0) fein = grund * 0.86;
    else if (mod(t.x + reihe * 2.0, 4.0) < 1.0 && zufall(vec2(floor(t.x / 4.0), reihe)) < 0.3) fein = grund * 0.92;
    else if (zufall(vec2(floor(t.x / 4.0) + 7.0, reihe)) < 0.07) fein = grund * 1.08;
    if (v_wand.z * PX < 2.0) fein = grund * 1.18;                                // ridge tiles
    if (t.y < 1.0) fein = KONTUR;                                                // eaves
  } else if (art < 5.5) {                                  // flat roof
    stufe = d > 0.72 ? 1.0 : d > 0.45 ? 0.9 : 0.78;
    if (zufall(t) < 0.04) fein = grund * 0.9;
  } else {                                                 // underside
    grund *= 0.42; fein = grund; grob = grund; mittel = grund;
  }

  vec3 c = mix(grob, fein, 1.0 - smoothstep(0.9, 2.0, f));
  c = mix(mittel, c, 1.0 - smoothstep(5.0, 11.0, f));
  c *= mix(0.9, stufe, u_staerke);
  if (stufe < 0.8) c *= mix(vec3(1.0), vec3(0.95, 0.97, 1.06), u_staerke);       // shade is a little cooler
  out_FragColor = czm_gammaCorrect(vec4(c * v_ton.rgb, 1.0));
}`;

/**
 * Put the houses into the scene: one primitive for all of them, one pickable instance per house.
 * `nur(haus)` limits it to some houses; `saetze` (the façade kits, with `basis` as the folder of their pictures) dresses
 * them in sprites. Returns the handle the world view works with; nothing in it rebuilds geometry.
 */
export function baueHaeuser({ Cesium, scene, gebaeude, wege = null, frame, pos, nur = null, saetze = null, basis = null }) {
  const liste = viertel(gebaeude, frame, { wege }).filter((h) => !nur || nur(h));
  // with façade kits every house is dressed in sprites; where each picture lies on the sheet is known before one of them has loaded
  const blatt = saetze ? packe(saetze) : null;
  if (saetze) for (const h of kleideViertel(liste, saetze)) h.kleid.lage = blatt.lage;
  const eintraege = [], nachOid = new Map(), eigene = new Set(), instanzen = [];
  const attribut = (werte, n, typ = Cesium.ComponentDatatype.FLOAT) => new Cesium.GeometryAttribute({ componentDatatype: typ, componentsPerAttribute: n, values: werte });
  let ecken = 0, dreiecke = 0;
  for (const h of liste) {
    const m = netz(h);
    if (!m.indizes.length) continue;
    // the record of a house: what a click shows, and the id the picked instance carries
    const eintrag = new Cesium.Entity({ id: `haus/${h.schluessel}`, name: h.name ?? h.adresse ?? h.funktion, properties: { text: steckbrief(h), oid: h.oid } });
    eintraege.push(eintrag);
    (nachOid.get(h.oid) ?? nachOid.set(h.oid, []).get(h.oid)).push(eintrag);
    eigene.add(h.oid);
    for (const df of h.durchfahrten) eigene.add(df.oid);
    ecken += m.positionen.length / 3; dreiecke += m.indizes.length / 3;
    instanzen.push(new Cesium.GeometryInstance({
      id: eintrag,
      geometry: new Cesium.Geometry({
        attributes: { position: attribut(m.positionen, 3, Cesium.ComponentDatatype.DOUBLE), normal: attribut(m.normalen, 3), wand: attribut(m.wand, 4), bau: attribut(m.bau, 4), farbe: attribut(m.farbe, 4) },
        indices: m.indizes, primitiveType: Cesium.PrimitiveType.TRIANGLES, boundingSphere: Cesium.BoundingSphere.fromVertices(m.positionen),
      }),
      attributes: { color: new Cesium.ColorGeometryInstanceAttribute(1, 1, 1, 1) },
    }));
  }
  const konvergenz = frame.meridiankonvergenz_grad ?? 0;
  const erscheinung = new Cesium.Appearance({ translucent: false, closed: true, vertexShaderSource: VS, fragmentShaderSource: FS,
    renderState: { depthTest: { enabled: true }, cull: { enabled: true, face: Cesium.CullFace.BACK } } });
  // sprites: crisp pixels up close, the texture's own smaller levels far away
  const textur = (quelle, wiederholt) => {
    const wickel = wiederholt ? Cesium.TextureWrap.REPEAT : Cesium.TextureWrap.CLAMP_TO_EDGE;
    const t = new Cesium.Texture({ context: scene.context, source: quelle, sampler: new Cesium.Sampler({ wrapS: wickel, wrapT: wickel,
      minificationFilter: Cesium.TextureMinificationFilter.LINEAR_MIPMAP_LINEAR, magnificationFilter: Cesium.TextureMagnificationFilter.NEAREST }) });
    t.generateMipmap();
    return t;
  };
  const leinwand = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
  const leer = leinwand(2, 2), lg = leer.getContext('2d');
  lg.fillStyle = '#888888'; lg.fillRect(0, 0, 2, 2);
  const platzhalter = textur(leer, true);
  erscheinung.uniforms = { u_licht: new Cesium.Cartesian3(...lichtvektor(73, 45, konvergenz)), u_staerke: 1, u_deckung: 1,
    u_atlas: platzhalter, u_ziegel: platzhalter, u_putz: platzhalter, u_atlasMass: new Cesium.Cartesian2(2, 2), u_ziegelMass: new Cesium.Cartesian2(1, 1), u_putzMass: new Cesium.Cartesian2(1, 1) };
  const primitive = instanzen.length ? scene.primitives.add(new Cesium.Primitive({ geometryInstances: instanzen, appearance: erscheinung, asynchronous: false, compressVertices: false })) : null;

  /**
   * Load the kits' pictures and lay them on one sheet, pixel for pixel. A façade's wall pixels get half alpha (the shader
   * tints only those), transparent margins take the wall colour, roof parts keep their cut-out. No geometry changes.
   */
  async function male() {
    const lade = (datei) => ladeBild(new URL(datei, basis).href);
    const pixel = (img) => { const c = leinwand(img.width, img.height), g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height); };
    const [ziegel, putz, ...bilder] = await Promise.all([lade(saetze.ziegel.datei), lade(saetze.putz.datei), ...blatt.bilder.map((b) => lade(b.datei))]);
    const W = blatt.breite, H = blatt.hoehe, atlas = new Uint8ClampedArray(W * H * 4);
    blatt.bilder.forEach((b, nr) => {
      const q = pixel(bilder[nr]), [x0, y0, w, h] = b.nach, maske = b.satz ? wandmaske(q, b.satz) : null, wandfarbe = b.satz ? rgb(b.satz.wand).map((v) => Math.round(v * 255)) : null;
      for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) { // one pixel beyond every edge repeats the edge, for the far-away levels
        const sx = Math.min(w - 1, Math.max(0, x)), sy = Math.min(h - 1, Math.max(0, y)), s = (sy * q.width + sx) * 4, z = ((y0 + y) * W + x0 + x) * 4, klar = q.data[s + 3] < 128;
        if (b.satz) { for (let k = 0; k < 3; k++) atlas[z + k] = klar ? wandfarbe[k] : q.data[s + k]; atlas[z + 3] = klar || maske[sy * q.width + sx] ? 128 : 255; }
        else { for (let k = 0; k < 3; k++) atlas[z + k] = q.data[s + k]; atlas[z + 3] = klar ? 0 : 255; }
      }
    });
    const u = erscheinung.uniforms, m = (t) => new Cesium.Cartesian2(t.breite / t.px_je_m, t.hoehe / t.px_je_m);
    u.u_atlas = textur({ width: W, height: H, arrayBufferView: new Uint8Array(atlas.buffer) }, false); u.u_atlasMass = new Cesium.Cartesian2(W, H);
    u.u_ziegel = textur(ziegel, true); u.u_ziegelMass = m(saetze.ziegel);
    u.u_putz = textur(putz, true); u.u_putzMass = m(saetze.putz);
    const c = leinwand(W, H); // the sheet as a picture, for looking at it
    c.getContext('2d').putImageData(new ImageData(atlas, W, H), 0, 0);
    return c;
  }
  const gemalt = blatt && primitive ? male() : Promise.resolve(null);

  let durch = new Set(), wunsch = null;
  const setze = (oid, anteil) => { for (const e of nachOid.get(oid) ?? []) { const a = primitive.getGeometryInstanceAttributes(e); if (a) a.color = [255, 255, 255, Math.round(anteil * 255)]; } };
  const zeige = (ids) => {
    if (!primitive) return;
    if (!primitive.ready) { wunsch = ids; return; }
    let geaendert = false;
    for (const oid of durch) if (!ids.has(oid)) { setze(oid, 1); geaendert = true; }
    for (const oid of ids) if (!durch.has(oid) && nachOid.has(oid)) { setze(oid, DURCHSICHT); geaendert = true; }
    durch = new Set([...ids].filter((oid) => nachOid.has(oid)));
    if (geaendert) scene.requestRender(); // see-through houses are a change the camera does not report
  };
  if (primitive) { const fertig = scene.postRender.addEventListener(() => { if (primitive.ready) { fertig(); if (wunsch) zeige(wunsch); } }); }

  return {
    liste, eintraege, primitive, anzahl: liste.length, ecken, dreiecke,
    /** Resolves when the sprites of the dressed houses are in (with the sheet they were set together on), or with null. */
    gemalt, gekleidet: liste.filter((h) => h.kleid).length,
    /** Is this ALKIS object (a house, or a gateway of one) drawn here? */
    hat: (oid) => eigene.has(oid),
    /** Put the houses on the ground `pos` describes (it changes with the 3D tiles). */
    stelle() {
      if (!primitive) return;
      const [E0, N0] = frame.ursprung_utm32, o = pos([E0, N0], 0), C = Cesium.Cartesian3;
      const ost = C.multiplyByScalar(C.subtract(pos([E0 + 100, N0], 0), o, new C()), 0.01, new C()), nord = C.multiplyByScalar(C.subtract(pos([E0, N0 + 100], 0), o, new C()), 0.01, new C());
      const auf = Cesium.Ellipsoid.WGS84.geodeticSurfaceNormal(o, new C());
      primitive.modelMatrix = new Cesium.Matrix4(ost.x, nord.x, auf.x, o.x, ost.y, nord.y, auf.y, o.y, ost.z, nord.z, auf.z, o.z, 0, 0, 0, 1);
    },
    /** The houses with these ids stand between camera and player: they thin out to a screen of pixels. */
    zeige,
    /** All houses thinned out by this much (1: solid), as over the 3D tiles. */
    deckung(anteil) { erscheinung.uniforms.u_deckung = anteil; },
    /** The sun: compass bearing it shines from, elevation, strength 0..1. Changes three numbers, no geometry. */
    licht({ azimut, hoehe, staerke = 1 }) { erscheinung.uniforms.u_licht = new Cesium.Cartesian3(...lichtvektor(azimut, hoehe, konvergenz)); erscheinung.uniforms.u_staerke = staerke; },
    sichtbar(an) { if (primitive) primitive.show = an; },
    /** Enter the houses' records in a layer's entity list (they carry the click text and are the pick ids). */
    verzeichne(entities) { for (const e of eintraege) { if (e.entityCollection && e.entityCollection !== entities) e.entityCollection.remove(e); if (!entities.contains(e)) entities.add(e); } },
  };
}
