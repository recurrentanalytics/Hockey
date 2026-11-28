// The player in the world view: the approved skater sprite, steered with keys or by tapping the
// ground, held out of tree trunks, followed by the game camera. Positions are court metres.
import { ausweichen, KAMERA } from './baeume.js';
import { loese, davor, aufDemPlatz } from './hindernisse.js';

export const TEMPO = 5.5; // metres per second

/** One step of movement: towards the keys' direction or the tapped target, then out of the trunks. */
export function schritt(z, dt, baeume, welt = null) {
  let [ra, rb] = z.tasten;
  if (!ra && !rb && z.ziel) {
    const da = z.ziel[0] - z.ab[0], db = z.ziel[1] - z.ab[1], d = Math.hypot(da, db);
    if (d < 0.25) z.ziel = null; else { ra = da / d; rb = db / d; }
  } else if (ra || rb) { z.ziel = null; const l = Math.hypot(ra, rb); ra /= l; rb /= l; }
  z.faehrt = !!(ra || rb);
  if (z.faehrt) {
    const vor = z.ab;
    z.ab = ausweichen([z.ab[0] + ra * TEMPO * dt, z.ab[1] + rb * TEMPO * dt], baeume);
    if (welt) z.ab = loese(z.ab, vor, welt); // walls, fences, buildings
    if (Math.abs(ra) > 0.05) z.rechts = ra > 0;
    z.phase += dt * 9;
    if (z.ziel && Math.hypot(z.ab[0] - vor[0], z.ab[1] - vor[1]) < TEMPO * dt * 0.15) z.ziel = null; // stuck on a trunk: stop pushing
  }
  return z;
}

export function starte({ Cesium, viewer, entities, frame, pos, bilder, hoehe, hain, bodenpunkt, welt = null, zeigeHaeuser = () => {}, aufPlatz = () => {} }) {
  const z = { ab: [0, 0], tasten: [0, 0], ziel: null, rechts: true, faehrt: false, phase: 0, folgt: false };
  const zuGitter = ([a, b]) => [frame.ursprung_utm32[0] + a * frame.achse_a[0] + b * frame.achse_b[0], frame.ursprung_utm32[1] + a * frame.achse_a[1] + b * frame.achse_b[1]];
  const n = bilder.rechts.length;
  const figur = entities.add({
    position: new Cesium.CallbackProperty(() => pos(zuGitter(z.ab), 0), false),
    billboard: { image: new Cesium.CallbackProperty(() => (z.rechts ? bilder.rechts : bilder.links)[z.faehrt ? Math.floor(z.phase) % n : 0], false),
      sizeInMeters: true, width: hoehe * bilder.seiten, height: hoehe, verticalOrigin: Cesium.VerticalOrigin.BOTTOM },
    properties: { text: 'Spieler\nPfeiltasten oder WASD, oder auf den Boden tippen' },
  });
  // keys: up is away from the game camera (court axis b), right is court axis a
  const gedrueckt = new Set();
  const richtung = () => { z.tasten = [(gedrueckt.has('ArrowRight') || gedrueckt.has('KeyD') ? 1 : 0) - (gedrueckt.has('ArrowLeft') || gedrueckt.has('KeyA') ? 1 : 0), (gedrueckt.has('ArrowUp') || gedrueckt.has('KeyW') ? 1 : 0) - (gedrueckt.has('ArrowDown') || gedrueckt.has('KeyS') ? 1 : 0)]; };
  addEventListener('keydown', (e) => { if (z.spielt) return; if (/^(Arrow|Key[WASD])/.test(e.code)) { gedrueckt.add(e.code); richtung(); if (z.folgt) e.preventDefault(); } });
  addEventListener('keyup', (e) => { gedrueckt.delete(e.code); richtung(); });
  const blick = [0, 1]; // the game camera looks along court axis b
  let zuletzt = performance.now();
  const takt = (dt) => {
    if (z.spielt) return; // the match is on: the figures on the court are the game's
    schritt(z, dt, hain().baeume, welt);
    hain().zeige(z.ab, blick);
    if (welt && z.folgt) zeigeHaeuser(davor(z.ab, welt, blick, KAMERA.neigung));
    const drin = z.folgt && aufDemPlatz(z.ab);
    if (drin !== z.aufPlatz) { z.aufPlatz = drin; aufPlatz(drin); }
    if (z.faehrt || z.ziel) viewer.scene.requestRender(); // the scene draws on demand: a moving figure is a change
    // set the follow camera only when the figure has moved (or starts to be followed): setting it again every tick
    // counts as a camera change and would keep the on-demand scene drawing while the figure stands still
    const g = z.folgt ? zuGitter(z.ab) : null;
    if (g && (!z.kamera || g[0] !== z.kamera[0] || g[1] !== z.kamera[1])) {
      z.kamera = g;
      viewer.camera.lookAt(pos(g, 1), new Cesium.HeadingPitchRange(Cesium.Math.toRadians(KAMERA.richtung), Cesium.Math.toRadians(-(90 - KAMERA.neigung)), 22));
    }
  };
  viewer.scene.preUpdate.addEventListener(() => { const jetzt = performance.now(); takt(Math.min(0.1, (jetzt - zuletzt) / 1000)); zuletzt = jetzt; });
  return {
    zustand: z, takt,
    /** The match begins or ends: hide the roaming figure and ignore its keys meanwhile. */
    spielt(an) { z.spielt = an; figur.show = !an; z.tasten = [0, 0]; z.ziel = null; gedrueckt.clear(); },
    folge(an) { z.folgt = an; z.kamera = null; if (!an) { viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY); zeigeHaeuser(new Set()); z.aufPlatz = false; aufPlatz(false); } },
    tippe(bildpunkt) { if (!z.folgt) return false; const en = bodenpunkt(bildpunkt); if (!en) return false; const de = en[0] - frame.ursprung_utm32[0], dn = en[1] - frame.ursprung_utm32[1]; z.ziel = [de * frame.achse_a[0] + dn * frame.achse_a[1], de * frame.achse_b[0] + dn * frame.achse_b[1]]; return true; },
  };
}
