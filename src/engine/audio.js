// Sound effects synthesized with Web Audio: no sound files needed.
// Browsers only allow audio after a tap/click/key press, so unlock() is called from input events.
import { settings } from '../settings.js';

const MIN_GAP = { stick: 0.05, boards: 0.08, hit: 0.1, post: 0.15, menu: 0.03 };

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.last = {};
    this.ambient = null;
    this.noiseBuf = null;
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      // One second of white noise, reused by every noisy sound.
      const n = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, n, n);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
  }

  get ready() {
    return this.ctx && this.ctx.state === 'running' && settings.sound > 0;
  }

  tick() {
    if (this.master) this.master.gain.value = settings.sound;
  }

  // ------------------------------------------------------------------ building blocks

  noise(t, dur, { type = 'bandpass', freq = 1000, q = 1, gain = 0.5, attack = 0.002 } = {}) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
    return { f, g };
  }

  tone(t, dur, { type = 'sine', freq = 440, gain = 0.3, attack = 0.005, slide = null } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }

  // ------------------------------------------------------------------ effects

  play(name, level = 1) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (MIN_GAP[name] && now - (this.last[name] ?? -1) < MIN_GAP[name]) return;
    this.last[name] = now;
    const t = now + 0.005;
    const v = Math.max(0.05, Math.min(1, level));
    switch (name) {
      case 'stick':   // blade on puck: short woody click
        this.noise(t, 0.05, { freq: 2200, q: 3, gain: 0.35 * v });
        this.tone(t, 0.04, { type: 'triangle', freq: 520, gain: 0.12 * v });
        break;
      case 'shot':    // slap: sharp crack plus a whoosh
        this.noise(t, 0.09, { type: 'highpass', freq: 1500, gain: 0.7 * v });
        this.tone(t, 0.06, { type: 'triangle', freq: 300, gain: 0.3 * v, slide: 120 });
        this.noise(t + 0.02, 0.25, { freq: 900, q: 0.7, gain: 0.12 * v, attack: 0.05 });
        break;
      case 'post':    // ringing iron
        this.tone(t, 0.7, { freq: 1870, gain: 0.25 * v });
        this.tone(t, 0.5, { freq: 2630, gain: 0.12 * v });
        this.noise(t, 0.03, { type: 'highpass', freq: 3000, gain: 0.3 * v });
        break;
      case 'boards':  // dull thud into the boards
        this.noise(t, 0.16, { type: 'lowpass', freq: 380, gain: 0.8 * v });
        this.tone(t, 0.12, { freq: 95, gain: 0.35 * v, slide: 60 });
        break;
      case 'save':    // puck into pads
        this.noise(t, 0.12, { type: 'lowpass', freq: 700, gain: 0.6 * v });
        this.tone(t, 0.08, { freq: 160, gain: 0.25 * v, slide: 90 });
        break;
      case 'hit':     // bodies colliding
        this.tone(t, 0.18, { freq: 110, gain: 0.5 * v, slide: 55 });
        this.noise(t, 0.12, { type: 'lowpass', freq: 600, gain: 0.5 * v });
        break;
      case 'whistle': {
        const o = this.tone(t, 0.55, { freq: 2900, gain: 0.18, attack: 0.02 });
        const lfo = this.ctx.createOscillator();
        const lg = this.ctx.createGain();
        lfo.frequency.value = 28; lg.gain.value = 90;
        lfo.connect(lg).connect(o.frequency);
        lfo.start(t); lfo.stop(t + 0.6);
        this.tone(t, 0.55, { freq: 2950, gain: 0.08, attack: 0.02 });
        break;
      }
      case 'horn':    // goal horn: low brassy chord
        for (const f of [174, 220, 262]) this.tone(t, 1.6, { type: 'sawtooth', freq: f, gain: 0.09, attack: 0.04 });
        this.cheer(t, 2.6);
        break;
      case 'buzzer':  // end of period
        this.tone(t, 0.9, { type: 'square', freq: 140, gain: 0.12, attack: 0.01 });
        this.tone(t, 0.9, { type: 'square', freq: 147, gain: 0.08, attack: 0.01 });
        break;
      case 'cheer':
        this.cheer(t, 1.6 * v);
        break;
      case 'menu':
        this.tone(t, 0.05, { type: 'square', freq: 880, gain: 0.06 });
        break;
      case 'confirm':
        this.tone(t, 0.06, { type: 'square', freq: 990, gain: 0.07 });
        this.tone(t + 0.05, 0.08, { type: 'square', freq: 1480, gain: 0.07 });
        break;
      case 'back':
        this.tone(t, 0.08, { type: 'square', freq: 660, gain: 0.06, slide: 440 });
        break;
    }
  }

  cheer(t, dur) {
    const { f, g } = this.noise(t, dur, { freq: 900, q: 0.6, gain: 0.35, attack: 0.25 });
    f.frequency.linearRampToValueAtTime(1300, t + dur * 0.4);
    g.gain.setValueAtTime(0.35, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  }

  /**
   * Play part of a song file (e.g. the Borstentiere hymn as goal song), fading out after `seconds`.
   */
  song(src, seconds = 14, from = 0) {
    if (!settings.sound) return;
    try {
      this.stopSong();
      const a = new window.Audio(src);
      a.volume = Math.min(1, settings.sound * 0.9);
      a.currentTime = from;
      a.play().catch(() => {});
      this.songEl = a;
      const start = performance.now();
      this.songTimer = setInterval(() => {
        const t = (performance.now() - start) / 1000;
        if (t > seconds) a.volume = Math.max(0, a.volume - 0.05);
        if (a.volume <= 0.01 || a.ended) this.stopSong();
      }, 100);
    } catch {
      /* no audio element support */
    }
  }

  stopSong() {
    clearInterval(this.songTimer);
    if (this.songEl) { this.songEl.pause(); this.songEl = null; }
  }

  /** Low crowd murmur while a game is on. */
  setAmbient(on) {
    if (!this.ctx || !this.noiseBuf) return;
    if (on && !this.ambient) {
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.5;
      const g = c.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.05, c.currentTime + 1.5);
      src.connect(f).connect(g).connect(this.master);
      src.start();
      this.ambient = { src, g };
    } else if (!on && this.ambient) {
      const { src, g } = this.ambient;
      const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + 0.6);
      src.stop(t + 0.7);
      this.ambient = null;
    }
  }
}
