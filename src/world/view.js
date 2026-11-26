// Draws the arena + entities into a viewport of the world layer.
import { PAL } from '../engine/palette.js';
import { bakeRink, bakeGoal } from './rink.js';

export class WorldView {
  constructor() {
    this.key = 'arena|puck';
    this.rink = bakeRink();
    this.shake = { '-1': 0, '1': 0 };
    this.goals = [-1, 1].map((side) => {
      const g = bakeGoal(side);
      return {
        sortY: g.sortY,
        draw: (ctx, ox, oy) => {
          // A puck in the twine (or off the iron) sets the whole cage wobbling.
          const a = this.shake[side];
          const t = performance.now() / 1000;
          const dx = a > 0 ? Math.round(Math.sin(t * 38) * a * 2.2) : 0;
          const dy = a > 0.4 ? Math.round(Math.sin(t * 29) * a) : 0;
          ctx.drawImage(g.canvas, g.x + ox + dx, g.y + oy + dy);
        },
      };
    });
    this.wave = null;
    this.lastT = performance.now() / 1000;
  }

  /** Net wobble: side -1 / +1, strength 0..1 (fades on its own). */
  jiggle(side, strength = 1) {
    const k = String(Math.sign(side) || 1);
    this.shake[k] = Math.max(this.shake[k], strength);
  }

  /** Start a La-Ola wave running round the stands. */
  startWave(laps = 2) {
    if (!this.wave) this.wave = { t: 0, laps };
  }

  /** The crowd, drawn in narrow columns so a wave can roll through it. */
  drawCrowd(ctx, vp, ox, oy, f, cheerFrame) {
    const cr = this.rink.crowd;
    const img = cr.frames[f];
    const x0 = cr.x0 + ox, y0 = cr.y0 + oy;
    if (!this.wave) { ctx.drawImage(img, x0, y0); return; }
    const W = img.width, H = img.height, COL = 6, span = 46;
    const lap = 4.2;
    const u = (this.wave.t % lap) / lap;
    // The crest runs across everything the camera can see, then a bit beyond.
    const from = vp.x - x0 - span, to = vp.x + vp.w - x0 + span;
    const crest = from + u * (to - from);
    const a = Math.max(0, Math.floor((vp.x - x0) / COL) * COL), b = Math.min(W, vp.x + vp.w - x0 + COL);
    for (let sx = a; sx < b; sx += COL) {
      const d = Math.abs(sx + COL / 2 - crest);
      const k = d < span ? 1 - d / span : 0;
      const src = k > 0.35 ? cr.frames[cheerFrame] : img;
      const lift = Math.round(Math.sin(k * Math.PI / 2) * 3);
      const w = Math.min(COL, W - sx);
      ctx.drawImage(src, sx, 0, w, H, x0 + sx, y0 - lift, w, H);
    }
  }

  /** Switch venue ('arena' | 'boni') and centre logo ('puck' | 'boar'); re-bakes only on change. */
  configure({ venue = 'arena', logo = 'puck' } = {}) {
    const key = `${venue}|${logo}`;
    if (key === this.key) return;
    this.key = key;
    this.rink = bakeRink({ venue, logo });
  }

  /**
   * @param ctx      world layer context
   * @param vp       {x, y, w, h} viewport in layer pixels
   * @param camera   camera centre in world pixels
   * @param entities objects with sortY, draw(ctx, ox, oy) and optional drawShadow
   */
  draw(ctx, vp, camera, entities = []) {
    const left = Math.round(camera.x - vp.w / 2);
    const top = Math.round(camera.y - vp.h / 2);
    const ox = vp.x - left, oy = vp.y - top;

    ctx.save();
    ctx.beginPath();
    ctx.rect(vp.x, vp.y, vp.w, vp.h);
    ctx.clip();
    ctx.fillStyle = PAL.night;
    ctx.fillRect(vp.x, vp.y, vp.w, vp.h);
    ctx.drawImage(this.rink.background, this.rink.x0 + ox, this.rink.y0 + oy);
    // Crowd: gentle bobbing, or jumping and waving while `cheer` is set.
    const t = performance.now() / 1000;
    const dt = Math.min(0.1, Math.max(0, t - this.lastT));
    this.lastT = t;
    for (const k in this.shake) this.shake[k] = Math.max(0, this.shake[k] - dt * 1.3);
    if (this.wave && (this.wave.t += dt) > 4.2 * this.wave.laps) this.wave = null;
    const f = this.cheer ? 2 + (Math.floor(t * 7) % 2) : Math.floor(t * 1.4) % 2;
    this.drawCrowd(ctx, vp, ox, oy, f, 2 + (Math.floor(t * 7) % 2));

    for (const e of entities) e.drawShadow?.(ctx, ox, oy);
    const sorted = [...entities, ...this.goals].sort((a, b) => a.sortY - b.sortY);
    for (const e of sorted) e.draw(ctx, ox, oy);

    ctx.drawImage(this.rink.foreground, this.rink.x0 + ox, this.rink.y0 + oy);
    ctx.restore();
  }
}
