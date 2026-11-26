// On-ice scene. Phase 1: free skating with single, shared or split cameras.
import { PAL } from '../engine/palette.js';
import { drawText } from '../engine/font.js';
import { PLAYER_COLORS } from '../config.js';
import { Skater } from '../world/skater.js';
import { Camera } from '../world/camera.js';
import { BAKE } from '../world/rink.js';
import { project } from '../world/projection.js';
import { hintBar } from '../ui/hud.js';
import { PauseScene } from './pause.js';

const SPLIT_ZOOM = 0.8;
const LOOKAHEAD = 0.35; // seconds of velocity the camera leads by

export class RinkScene {
  /**
   * players: [{ controller, team, tag }]
   * camera:  'single' | 'shared' | 'split'
   */
  constructor(app, { title, players, camera = 'single' }) {
    this.app = app;
    this.title = title;
    this.cameraMode = players.length > 1 ? camera : 'single';
    this.zoom = 1;
    const starts = players.length > 1 ? [{ x: -4, y: 0, f: 1 }, { x: 4, y: 0, f: -1 }] : [{ x: -2, y: 0, f: 1 }];
    this.players = players.map((p, i) => ({
      ...p,
      color: PLAYER_COLORS[i],
      skater: new Skater({ team: p.team, x: starts[i].x, y: starts[i].y, facing: starts[i].f, tag: p.tag, tagColor: PLAYER_COLORS[i] }),
      camera: new Camera(),
    }));
    this.shared = new Camera();
    this.snapCameras();
  }

  get usesTouch() {
    return this.players.some((p) => p.controller === 'touch' || p.controller === 'any');
  }

  viewSize() {
    const { width, height } = this.app.display;
    if (this.cameraMode === 'split') {
      const lw = Math.round(width / SPLIT_ZOOM), lh = Math.round(height / SPLIT_ZOOM);
      const h1 = Math.floor((lh - 2) / 2);
      return { w: lw, h: h1, lh, h1 };
    }
    return { w: Math.round(width / this.zoom), h: Math.round(height / this.zoom) };
  }

  target(p) {
    const s = p.skater;
    const pos = project(s.pos.x + s.vel.x * LOOKAHEAD, s.pos.y + s.vel.y * LOOKAHEAD);
    return { x: pos.x, y: pos.y - 12 };
  }

  snapCameras() {
    const v = this.viewSize();
    for (const p of this.players) { const t = this.target(p); p.camera.snap(t.x, t.y, v.w, v.h); }
    const m = this.midpoint();
    this.shared.snap(m.x, m.y, v.w, v.h);
  }

  midpoint() {
    const ts = this.players.map((p) => this.target(p));
    return { x: ts.reduce((a, t) => a + t.x, 0) / ts.length, y: ts.reduce((a, t) => a + t.y, 0) / ts.length };
  }

  pause() {
    this.app.push(new PauseScene(this.app, this));
  }

  wantsTouch() {
    return this.usesTouch && this.app.input.touchVisible;
  }

  update(dt) {
    const { input } = this.app;
    if (input.touch.pausePressed) return this.pause();

    for (const p of this.players) {
      const c = input.controller(p.controller);
      if (!c || c.connected === false) {
        this.app.toasts.push(`${p.tag} CONTROLLER LOST`);
        return this.pause();
      }
      if (c.pressed.pause) return this.pause();
      p.skater.update(dt, { move: c.move, sprint: c.down.sprint });
    }
    for (let i = 0; i < this.players.length; i++) {
      for (let j = i + 1; j < this.players.length; j++) Skater.collide(this.players[i].skater, this.players[j].skater);
    }
    this.updateCameras(dt);
  }

  updateCameras(dt) {
    const { width, height } = this.app.display;
    if (this.cameraMode === 'shared') {
      const ts = this.players.map((p) => this.target(p));
      const spanX = Math.abs(ts[0].x - ts[1].x) + 150, spanY = Math.abs(ts[0].y - ts[1].y) + 100;
      // Never zoom out further than the baked arena is tall.
      const minZoom = height / (BAKE.h - 8);
      const want = Math.max(minZoom, Math.min(1, width / spanX, height / spanY));
      this.zoom += (want - this.zoom) * (1 - Math.exp(-3 * dt));
      const v = this.viewSize();
      const m = this.midpoint();
      this.shared.follow(m.x, m.y, dt, v.w, v.h, 4);
    } else {
      this.zoom = this.cameraMode === 'split' ? SPLIT_ZOOM : 1;
      const v = this.viewSize();
      for (const p of this.players) { const t = this.target(p); p.camera.follow(t.x, t.y, dt, v.w, v.h, 5); }
    }
  }

  draw(isTop = true) {
    const { display, world, input } = this.app;
    display.setZoom(this.zoom);
    const ctx = display.wctx, W = display.width, H = display.height;
    const ents = this.players.map((p) => p.skater);

    if (this.cameraMode === 'split') {
      const v = this.viewSize();
      world.draw(ctx, { x: 0, y: 0, w: display.worldWidth, h: v.h1 }, this.players[0].camera, ents);
      world.draw(ctx, { x: 0, y: v.h1 + 2, w: display.worldWidth, h: display.worldHeight - v.h1 - 2 }, this.players[1].camera, ents);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(0, v.h1, display.worldWidth, 2);
    } else {
      const cam = this.cameraMode === 'shared' ? this.shared : this.players[0].camera;
      world.draw(ctx, { x: 0, y: 0, w: display.worldWidth, h: display.worldHeight }, cam, ents);
    }

    const ui = display.uctx;
    drawText(ui, this.title, 4, 4, { color: PAL.white, shadow: PAL.ink });
    drawText(ui, 'PHASE 1: SKATING + CAMERAS', 4, 11, { color: PAL.mist, shadow: PAL.ink });
    if (this.cameraMode === 'split') {
      const y2 = Math.round((this.viewSize().h1 + 2) * SPLIT_ZOOM) + 4;
      drawText(ui, 'P1', W - 4, 4, { color: this.players[0].color, align: 'right', shadow: PAL.ink });
      drawText(ui, 'P2', W - 4, y2, { color: this.players[1].color, align: 'right', shadow: PAL.ink });
    }

    if (!isTop) return;
    if (input.touch.enabled) {
      input.touch.draw(ui, W, H);
    } else if (this.players.length === 1) {
      const id = this.players[0].controller;
      hintBar(ui, W, H, [
        [input.moveLabel(id), 'SKATE'],
        [input.actionLabel('sprint', id), 'SPRINT'],
        [input.actionLabel('pause', id), 'PAUSE'],
      ]);
    }
  }
}
