// Runs the game logic under Node: canvas/DOM stand-ins (sprites are baked in constructors)
// and a seedable Math.random so every test run is reproducible.
const noop = () => {};
// The figure renderer reads its canvas back (crisp pixels, outline), so pixel reads return real buffers.
const pixels = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h) * 4) });
const calls = { getImageData: (x, y, w, h) => pixels(w, h), createImageData: (w, h) => pixels(w, h), measureText: () => ({ width: 0 }) };
const ctx = new Proxy({}, { get: (_, k) => calls[k] ?? noop, set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx }) };
globalThis.window ??= { addEventListener: noop };
globalThis.ImageData ??= class { constructor(w, h) { this.width = w; this.height = h; this.data = new Uint8ClampedArray(w * h * 4); } };
globalThis.localStorage ??= { getItem: () => null, setItem: noop };

let state = 1;
/** Reseed the random generator (mulberry32). */
export function seed(n) { state = n | 0; }
Math.random = () => {
  state = (state + 0x6D2B79F5) | 0;
  let t = Math.imul(state ^ (state >>> 15), 1 | state);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

export const { Match } = await import('../../src/game/match.js');
export const { resolveRules } = await import('../../src/game/rules.js');

export const DT = 1 / 60;
/** No human controllers. */
export const INPUT = { controller: () => null };

/** Step the match for `seconds`; `each(match)` runs after every step and may return true to stop. */
export function run(match, seconds, each) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    match.update(DT, INPUT);
    if (each?.(match)) return true;
  }
  return false;
}

/** Skip the opening face-off and put the match straight into open play. */
export function openPlay(match) {
  match.state = 'play';
  match.timer = 0;
  match.draw = null;
  return match;
}

/** True while the puck lies loose and motionless in live play. */
export const puckResting = (m) => m.state === 'play' && m.puck.loose && m.puck.speed < 0.05;
