// The approach: one continuous camera move from the whole planet down onto the Boni, told in the
// words of the game's intro, ending in the game camera above the court. It runs in the world's own
// scene, so what the flight lands on is the world one then skates through. Timing and text follow
// the former intro page (removed 2026-11-28); the curve itself is a pure function and tested under Node.

/** The story, as in the intro. Times in seconds. */
export const GESCHICHTE = [
  { at: 0.8, until: 6.6, text: 'Ganz weit draußen, im großen, dunklen Weltall … schwebt eine kleine blaue Kugel.' },
  { at: 7.0, until: 10.2, text: 'Auf dieser Kugel gibt es ein Land.' },
  { at: 10.6, until: 14.6, text: 'In diesem Land eine Stadt.' },
  { at: 15.4, until: 20.0, text: 'Und in dieser Stadt … einen kleinen Platz unter großen Bäumen.' },
  { at: 20.4, until: 25.9, text: 'Hier rollt eine noch viel kleinere Kugel. Ein roter Ball. Klein wie eine Kinderfaust …' },
  { at: 26.2, until: 30.2, text: '… und für uns das Größte auf der ganzen Welt.' },
];
export const ENDE = 30.6;
/** Distance of the camera from the court centre in metres, by time: straight lines between these in log space. */
const WEITE = [[0, 1.7e7], [6.6, 9.5e6], [10.2, 1.1e6], [13.8, 1.2e5], [19.2, 3100], [23.2, 210], [26.2, 62], [ENDE, 62]];
const DREHUNG = [13.8, 23.4], NEIGUNG = [20.0, 26.2];
const weich = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (t * 6 - 15) + 10));

/** Camera at time t: { weite (m), richtung (°, compass), neigung (°, 0 = straight down … 60 = the game camera) }. */
export function kamera(t, ziel = { richtung: 118.2, neigung: 60 }) {
  t = Math.max(0, Math.min(ENDE, t));
  let i = 0;
  while (i < WEITE.length - 2 && t > WEITE[i + 1][0]) i++;
  const [t0, w0] = WEITE[i], [t1, w1] = WEITE[i + 1], k = (t - t0) / (t1 - t0);
  return {
    weite: Math.exp(Math.log(w0) + (Math.log(w1) - Math.log(w0)) * k),
    richtung: ziel.richtung * weich((t - DREHUNG[0]) / (DREHUNG[1] - DREHUNG[0])),
    neigung: ziel.neigung * weich((t - NEIGUNG[0]) / (NEIGUNG[1] - NEIGUNG[0])),
  };
}

/** The line being told at time t, or null. */
export const zeile = (t) => GESCHICHTE.findIndex((z) => t >= z.at && t < z.until);

/**
 * Fly. `setze(kamera)` places the camera; `untertitel` is the caption element; `stimmen` the folder with
 * intro-0.mp3 … for the narration. Returns { ueberspringe(), setze(t) }; `amEnde()` fires once on landing.
 */
export function starteAnflug({ setze, untertitel, stimmen, amEnde, renderEreignis }) {
  let start = performance.now(), fest = null, fertig = false, gesagt = -1, ton = null;
  const jetzt = () => fest ?? (performance.now() - start) / 1000;
  const schritt = () => {
    if (fertig) return;
    const t = Math.min(ENDE, jetzt());
    setze(kamera(t));
    const z = zeile(t);
    untertitel.textContent = z >= 0 ? GESCHICHTE[z].text : '';
    untertitel.classList.toggle('an', z >= 0);
    if (z >= 0 && z !== gesagt) {
      gesagt = z;
      try { ton?.pause(); ton = new Audio(new URL(`intro-${z}.mp3`, stimmen).href); ton.play().catch(() => {}); } catch { /* no sound: the caption tells it */ }
    }
    if (t >= ENDE) { fertig = true; untertitel.classList.remove('an'); amEnde(); }
  };
  renderEreignis.addEventListener(schritt);
  return {
    ueberspringe() { if (!fertig) { try { ton?.pause(); } catch { /* nothing playing */ } fest = ENDE; schritt(); } },
    /** For tests and stills: hold the flight at second t. */
    setze(t) { fest = t; fertig = false; schritt(); },
    get fertig() { return fertig; },
  };
}
