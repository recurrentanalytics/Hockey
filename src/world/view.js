// Draws the arena + entities into a viewport of the world layer.
import { PAL } from '../engine/palette.js';
import { bakeRink, bakeGoal } from './rink.js';

export class WorldView {
  constructor() {
    this.key = 'arena|puck';
    this.rink = bakeRink();
    this.goals = [bakeGoal(-1), bakeGoal(1)].map((g) => ({
      sortY: g.sortY,
      draw: (ctx, ox, oy) => ctx.drawImage(g.canvas, g.x + ox, g.y + oy),
    }));
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
    const cr = this.rink.crowd;
    const f = this.cheer ? 2 + (Math.floor(t * 7) % 2) : Math.floor(t * 1.4) % 2;
    ctx.drawImage(cr.frames[f], cr.x0 + ox, cr.y0 + oy);

    for (const e of entities) e.drawShadow?.(ctx, ox, oy);
    const sorted = [...entities, ...this.goals].sort((a, b) => a.sortY - b.sortY);
    for (const e of sorted) e.draw(ctx, ox, oy);

    ctx.drawImage(this.rink.foreground, this.rink.x0 + ox, this.rink.y0 + oy);
    ctx.restore();
  }
}
