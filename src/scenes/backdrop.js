// Animated rink behind the menus: a few skaters doing laps, camera drifting after them.
import { Skater } from '../world/skater.js';
import { Camera } from '../world/camera.js';
import { project, fixedZoom } from '../world/projection.js';
import { RINK } from '../config.js';
import { dim } from '../engine/draw.js';

// lap waypoints for the 60 m arena, scaled to the rink in use
const K = RINK.length / 60, KY = RINK.width / 30;
const LAP = [{ x: -18, y: -8 }, { x: 18, y: -8 }, { x: 22, y: 6 }, { x: 0, y: 9 }, { x: -22, y: 6 }].map((p) => ({ x: p.x * K, y: p.y * KY }));

export class Backdrop {
  constructor(app) {
    this.app = app;
    this.skaters = [
      { s: new Skater({ team: 'blazers', x: -10 * K, y: -6 * KY }), wp: 1, off: 0 },
      { s: new Skater({ team: 'waves', x: -16 * K, y: -2 * KY }), wp: 1, off: 2.5 * KY },
      { s: new Skater({ team: 'vipers', x: 6 * K, y: 7 * KY }), wp: 4, off: -2 * KY },
    ];
    this.camera = new Camera(-120, -20);
  }

  update(dt) {
    for (const k of this.skaters) {
      const t = LAP[k.wp];
      const dx = t.x - k.s.pos.x, dy = t.y + k.off - k.s.pos.y;
      const d = Math.hypot(dx, dy);
      if (d < 2) k.wp = (k.wp + 1) % LAP.length;
      k.s.update(dt, { move: { x: (dx / d) * 0.7, y: (dy / d) * 0.7 } });
    }
    const lead = project(this.skaters[0].s.pos.x, this.skaters[0].s.pos.y);
    const { width, height } = this.app.display;
    this.camera.follow(lead.x, lead.y - 10, dt, width, height, 0.8);
  }

  draw(dimAmount = 0.38) {
    const { display, world } = this.app;
    display.setZoom(fixedZoom(1));
    world.cheer = false;
    world.draw(display.wctx, { x: 0, y: 0, w: display.worldWidth, h: display.worldHeight }, this.camera, this.skaters.map((k) => k.s));
    dim(display.uctx, display.width, display.height, dimAmount, '#2a1f3d');
  }
}
