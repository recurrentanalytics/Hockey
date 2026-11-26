// Instant replay: records what is drawn each frame and plays the last few seconds back.
// Snapshots are written straight onto the live objects while the match is frozen, and the
// live state is put back afterwards.

const SKATER = ['anim', 'pushing', 'sprinting', 'hasPuck', 'charging', 'charge', 'pokeT', 'followT', 'releaseT',
  'releaseKind', 'releaseCharge', 'brakeT', 'crossT', 'downT', 'downMax', 'celebrateT', 'happyT', 'sadT',
  'stance', 'dribble', 'dir', 'facing', 't', 'fatigue', 'stamina'];
const GOALIE = ['holdT', 'saveT', 'saveKind', 'diving', 'diveKind', 't'];
const PUCK = ['z'];
const SOUNDS = new Set(['shot', 'pass', 'post', 'save', 'hit', 'goal', 'boards']);

function keysOf(e) {
  return e.saveKind !== undefined || e.gx !== undefined ? GOALIE : e.phys ? PUCK : SKATER;
}

function snap(e) {
  const o = { e, x: e.pos.x, y: e.pos.y, vx: e.vel.x, vy: e.vel.y };
  for (const k of keysOf(e)) o[k] = e[k];
  return o;
}

function apply(o) {
  const e = o.e;
  e.pos.x = o.x; e.pos.y = o.y; e.vel.x = o.vx; e.vel.y = o.vy;
  for (const k of keysOf(e)) e[k] = o[k];
}

export class Recorder {
  constructor(seconds = 6) {
    this.max = Math.round(seconds * 60);
    this.frames = [];
    this.count = 0;   // frames recorded ever (absolute index of the next one)
  }

  clear() {
    this.frames.length = 0;
    this.count = 0;
  }

  capture(match) {
    this.frames.push({
      ents: match.entities.map(snap),
      events: match.events.filter((e) => SOUNDS.has(e.type)).map((e) => ({ type: e.type, level: e.speed ?? e.approach ?? 1 })),
    });
    this.count++;
    if (this.frames.length > this.max) this.frames.shift();
  }

  /** Absolute index of the latest frame (for marking the goal). */
  get last() {
    return this.count - 1;
  }

  /** Frames from `before` frames ahead of absolute index `at` to `after` frames past it. */
  around(at, before, after) {
    const i = at - (this.count - this.frames.length);
    return this.frames.slice(Math.max(0, i - before), Math.max(0, i + after));
  }
}

export class Replay {
  /**
   * @param frames  recorded frames to play back
   * @param live    every object that may be touched (to put back afterwards)
   * @param speed   playback speed (slow motion < 1)
   */
  constructor(frames, live, { speed = 0.55 } = {}) {
    this.frames = frames;
    this.saved = live.map(snap);
    this.speed = speed;
    this.pos = 0;
    this.shown = -1;
    this.done = frames.length === 0;
  }

  /** Advance; returns the events of every frame passed, for sound effects. */
  update(dt) {
    const events = [];
    if (this.done) return events;
    this.pos += dt * 60 * this.speed;
    const i = Math.min(this.frames.length - 1, Math.floor(this.pos));
    while (this.shown < i) {
      this.shown++;
      events.push(...this.frames[this.shown].events);
    }
    for (const o of this.frames[i].ents) apply(o);
    if (this.pos >= this.frames.length - 1) this.done = true;
    return events;
  }

  get entities() {
    const f = this.frames[Math.max(0, this.shown)];
    return f ? f.ents.map((o) => o.e) : [];
  }

  get progress() {
    return this.frames.length ? this.pos / (this.frames.length - 1) : 1;
  }

  /** Put the live match back exactly as it was. */
  restore() {
    for (const o of this.saved) apply(o);
  }
}
