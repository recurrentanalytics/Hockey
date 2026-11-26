// Animated rink behind the menus: a few skaters doing laps, camera drifting after them.
import { Skater } from '../world/skater.js';
import { Camera } from '../world/camera.js';
import { project } from '../world/projection.js';
import { dim } from '../engine/draw.js';

const LAP = [{ x: -18, y: -8 }, { x: 18, y: -8 }, { x: 22, y: 6 }, { x: 0, y: 9 }, { x: -22, y: 6 }];

export class Backdrop {
  constructor(app) {
    this.app = app;
    this.skaters = [
      { s: new Skater({ team: 'blazers', x: -10, y: -6 }), wp: 1, off: 0 },
      { s: new Skater({ team: 'waves', x: -16, y: -2 }), wp: 1, off: 2.5 },
      { s: new Skater({ team: 'vipers', x: 6, y: 7 }), wp: 4, off: -2 },
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

  draw(dimAmount = 0.55) {
    const { display, world } = this.app;
    display.setZoom(1);
    world.draw(display.wctx, { x: 0, y: 0, w: display.worldWidth, h: display.worldHeight }, this.camera, this.skaters.map((k) => k.s));
    dim(display.uctx, display.width, display.height, dimAmount);
  }
}
