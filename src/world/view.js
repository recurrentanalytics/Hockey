// Draws the arena + entities into a viewport of the world layer.
import { PAL } from '../engine/palette.js';
import { bakeRink, bakeGoal } from './rink.js';
import { project } from './projection.js';
import { asset } from '../engine/assets.js';

// World objects from the art library, standing on the concourse outside the boards (metres).
const SCENERY = [
  { id: 'world.bonifatiusplatz.plane-tree', x: -28.9, y: -13.3 },
  { id: 'world.bonifatiusplatz.plane-tree', x: 28.9, y: -13.3 },
];

export class WorldView {
  constructor() {
    this.rink = bakeRink();
    this.goals = [bakeGoal(-1), bakeGoal(1)].map((g) => ({
      sortY: g.sortY,
      draw: (ctx, ox, oy) => ctx.drawImage(g.canvas, g.x + ox, g.y + oy),
    }));
    this.props = null;
  }

  /** Scenery entities; empty until the art library has loaded. */
  scenery() {
    if (this.props) return this.props;
    const props = [];
    for (const s of SCENERY) {
      const a = asset(s.id);
      if (!a) return []; // not loaded yet: try again next frame
      const p = project(s.x, s.y);
      const d = a.density ?? 1; // an asset at density 2 covers half its pixel size in world pixels
      props.push({ sortY: s.y, draw: (ctx, ox, oy) => ctx.drawImage(a.img, p.x - a.anchor.x / d + ox, p.y - a.anchor.y / d + oy, a.img.width / d, a.img.height / d) });
    }
    this.props = props;
    return props;
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

    for (const e of entities) e.drawShadow?.(ctx, ox, oy);
    const sorted = [...entities, ...this.goals, ...this.scenery()].sort((a, b) => a.sortY - b.sortY);
    for (const e of sorted) e.draw(ctx, ox, oy);

    ctx.drawImage(this.rink.foreground, this.rink.x0 + ox, this.rink.y0 + oy);
    ctx.restore();
  }
}
