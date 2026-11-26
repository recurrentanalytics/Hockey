// Small world-space particles: wheel sparkles, puck trails, hit stars, confetti, puffs.
import { PAL } from '../engine/palette.js';
import { project } from './projection.js';

const CONFETTI = [PAL.red, PAL.yellow, PAL.sky, PAL.green, PAL.pink, PAL.purple, PAL.white];

export class Particles {
  constructor() {
    this.list = [];
  }

  add(p) {
    if (this.list.length < 600) this.list.push({ vx: 0, vy: 0, vz: 0, g: 0, drag: 0, size: 1, kind: 'dot', ...p, t: 0 });
  }

  /** Tiny sparkles kicked up behind fast skates. */
  spray(s, stop = false) {
    const back = (stop ? 1 : -1) * Math.sign(s.vel.x || s.facing);
    const k = stop ? 0.45 : -0.15;
    this.add({
      x: s.pos.x + back * 0.2 + (Math.random() - 0.5) * 0.3, y: s.pos.y + (Math.random() - 0.5) * 0.2, z: 0.05,
      vx: s.vel.x * k + (Math.random() - 0.5), vy: s.vel.y * k + (Math.random() - 0.5) * 0.5, vz: (stop ? 1.2 : 0.6) + Math.random(),
      g: 5, life: 0.3 + Math.random() * 0.2, color: Math.random() < 0.5 ? PAL.white : PAL.sky,
    });
  }

  trail(p) {
    this.add({ x: p.pos.x, y: p.pos.y, z: p.z, life: 0.22, color: Math.random() < 0.5 ? PAL.yellow : PAL.white, kind: 'trail' });
  }

  stars(x, y, z = 1.6, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.add({ x, y, z, vx: Math.cos(a) * 2.2, vy: Math.sin(a) * 1.2, vz: 1.5 + Math.random(), g: 6, life: 0.6, color: i % 2 ? PAL.yellow : PAL.white, kind: 'star' });
    }
  }

  puff(x, y, z = 0.3, n = 7) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      this.add({ x, y, z, vx: Math.cos(a) * 1.5, vy: Math.sin(a) * 0.8, vz: Math.random() * 1.5, g: 2, drag: 2, life: 0.4, color: PAL.cloud, size: 2 });
    }
  }

  confetti(x, y, n = 90) {
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6, z: 2 + Math.random() * 3,
        vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 4, vz: 2 + Math.random() * 4,
        g: 3.5, drag: 1.2, life: 2 + Math.random(), color: CONFETTI[i % CONFETTI.length], kind: 'confetti',
      });
    }
  }

  update(dt) {
    for (const p of this.list) {
      p.t += dt;
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k;
      p.vz -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.max(0, p.z + p.vz * dt);
      if (p.z === 0) { p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; }
    }
    this.list = this.list.filter((p) => p.t < p.life);
  }

  /** As world entities so they sort with skaters by depth. */
  entities() {
    return this.list.map((p) => ({
      sortY: p.y,
      draw: (ctx, ox, oy) => {
        const s = project(p.x, p.y, p.z);
        const x = Math.round(s.x + ox), y = Math.round(s.y + oy);
        const fade = 1 - p.t / p.life;
        ctx.save();
        ctx.globalAlpha = p.kind === 'confetti' ? 1 : Math.max(0.15, fade);
        ctx.fillStyle = p.color;
        if (p.kind === 'star') {
          ctx.fillRect(x - 1, y, 3, 1);
          ctx.fillRect(x, y - 1, 1, 3);
        } else if (p.kind === 'confetti') {
          const flip = Math.floor(p.t * 10 + p.x) % 2;
          ctx.fillRect(x, y, flip ? 2 : 1, flip ? 1 : 2);
        } else {
          ctx.fillRect(x, y, p.size, p.size);
        }
        ctx.restore();
      },
    }));
  }
}
