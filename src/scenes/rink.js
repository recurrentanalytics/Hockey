// On-ice scene: runs a Match and draws it with single, shared or split cameras.
import { PAL } from '../engine/palette.js';
import { drawText, textWidth } from '../engine/font.js';
import { panel } from '../engine/draw.js';
import { PLAYER_COLORS, TEAMS } from '../config.js';
import { settings } from '../settings.js';
import { Camera } from '../world/camera.js';
import { BAKE } from '../world/rink.js';
import { project } from '../world/projection.js';
import { Match } from '../game/match.js';
import { hintBar } from '../ui/hud.js';
import { PauseScene } from './pause.js';

const SPLIT_ZOOM = 0.8;
const LOOKAHEAD = 0.3;

/** Line-ups per mode. `ai` lists the sides the team AI plays for. */
const MODES = {
  practice: { home: { team: 'blazers', skaters: 2 }, away: { team: 'waves', skaters: 0 }, ai: [] },
  ai:       { home: { team: 'blazers', skaters: 4 }, away: { team: 'waves', skaters: 4 }, ai: ['home', 'away'] },
  versus:   { home: { team: 'blazers', skaters: 4 }, away: { team: 'waves', skaters: 4 }, ai: ['home', 'away'] },
  coop:     { home: { team: 'blazers', skaters: 4 }, away: { team: 'waves', skaters: 4 }, ai: ['home', 'away'] },
};

export class RinkScene {
  /**
   * mode:    'practice' | 'ai' | 'versus' | 'coop'
   * humans:  [{ controller, side }]
   * camera:  'single' | 'shared' | 'split'
   */
  constructor(app, { title, mode = 'practice', humans, camera = 'single' }) {
    this.app = app;
    this.title = title;
    this.mode = mode;
    this.cameraMode = humans.length > 1 ? camera : 'single';
    this.zoom = 1;
    this.match = new Match({
      ...MODES[mode],
      difficulty: settings.difficulty,
      humans: humans.map((h, i) => ({ ...h, tag: `P${i + 1}`, color: PLAYER_COLORS[i] })),
    });
    this.cams = this.match.humans.map(() => new Camera());
    this.shared = new Camera();
    this.banner = null;
    this.snapCameras();
  }

  get usesTouch() {
    return this.match.humans.some((h) => h.controller === 'touch' || h.controller === 'any');
  }

  wantsTouch() {
    return this.usesTouch && this.app.input.touchVisible;
  }

  viewSize() {
    const { width, height } = this.app.display;
    if (this.cameraMode === 'split') {
      const lw = Math.round(width / SPLIT_ZOOM), lh = Math.round(height / SPLIT_ZOOM);
      const h1 = Math.floor((lh - 2) / 2);
      return { w: lw, h: h1, h1 };
    }
    return { w: Math.round(width / this.zoom), h: Math.round(height / this.zoom) };
  }

  /** Camera target for one player: their skater, pulled a little toward the puck. */
  target(h) {
    const s = h.skater, p = this.match.puck;
    const sp = project(s.pos.x + s.vel.x * LOOKAHEAD, s.pos.y + s.vel.y * LOOKAHEAD);
    const pp = project(p.pos.x, p.pos.y);
    const k = this.cameraMode === 'split' ? 0.2 : 0.3;
    return { x: sp.x + (pp.x - sp.x) * k, y: sp.y + (pp.y - sp.y) * k - 12 };
  }

  snapCameras() {
    const v = this.viewSize();
    this.match.humans.forEach((h, i) => { const t = this.target(h); this.cams[i].snap(t.x, t.y, v.w, v.h); });
    const m = this.midpoint();
    this.shared.snap(m.x, m.y, v.w, v.h);
  }

  midpoint() {
    const ts = this.match.humans.map((h) => this.target(h));
    return { x: ts.reduce((a, t) => a + t.x, 0) / ts.length, y: ts.reduce((a, t) => a + t.y, 0) / ts.length };
  }

  pause() {
    this.app.push(new PauseScene(this.app, this));
  }

  update(dt) {
    const { input } = this.app;
    if (input.touch.pausePressed) return this.pause();
    for (const h of this.match.humans) {
      const c = input.controller(h.controller);
      if (!c || c.connected === false) {
        this.app.toasts.push(`${h.tag} CONTROLLER LOST`);
        return this.pause();
      }
      if (c.pressed.pause) return this.pause();
    }
    this.match.update(dt, input);
    for (const e of this.match.events) {
      if (e.type === 'goal') this.banner = { text: 'GOAL!', sub: this.goalText(e), t: 2.4, color: TEAMS[this.match.sides[e.side].team].main };
      if (e.type === 'save') this.banner = { text: 'SAVE', sub: null, t: 0.8, color: PAL.cloud, small: true };
    }
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    this.updateCameras(dt);
  }

  goalText(e) {
    const team = TEAMS[this.match.sides[e.side].team].name;
    const by = e.by?.human ? e.by.human.tag : e.by ? `#${e.by.number}` : '';
    return by && e.by.sideKey === e.side ? `${team} - ${by}` : `${team}`;
  }

  updateCameras(dt) {
    const { width, height } = this.app.display;
    if (this.cameraMode === 'shared') {
      const ts = this.match.humans.map((h) => this.target(h));
      const spanX = Math.abs(ts[0].x - ts[1].x) + 150, spanY = Math.abs(ts[0].y - ts[1].y) + 100;
      const minZoom = height / (BAKE.h - 8);
      const want = Math.max(minZoom, Math.min(1, width / spanX, height / spanY));
      this.zoom += (want - this.zoom) * (1 - Math.exp(-3 * dt));
      const v = this.viewSize();
      const m = this.midpoint();
      this.shared.follow(m.x, m.y, dt, v.w, v.h, 4);
    } else {
      this.zoom = this.cameraMode === 'split' ? SPLIT_ZOOM : 1;
      const v = this.viewSize();
      this.match.humans.forEach((h, i) => { const t = this.target(h); this.cams[i].follow(t.x, t.y, dt, v.w, v.h, 5); });
    }
  }

  draw(isTop = true) {
    const { display, world, input } = this.app;
    display.setZoom(this.zoom);
    const ctx = display.wctx, W = display.width, H = display.height;
    const ents = this.match.entities;

    if (this.cameraMode === 'split') {
      const v = this.viewSize();
      world.draw(ctx, { x: 0, y: 0, w: display.worldWidth, h: v.h1 }, this.cams[0], ents);
      world.draw(ctx, { x: 0, y: v.h1 + 2, w: display.worldWidth, h: display.worldHeight - v.h1 - 2 }, this.cams[1], ents);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(0, v.h1, display.worldWidth, 2);
    } else {
      const cam = this.cameraMode === 'shared' ? this.shared : this.cams[0];
      world.draw(ctx, { x: 0, y: 0, w: display.worldWidth, h: display.worldHeight }, cam, ents);
    }

    const ui = display.uctx;
    this.drawScoreboard(ui, W);
    if (this.cameraMode === 'split') {
      const y2 = Math.round((this.viewSize().h1 + 2) * SPLIT_ZOOM) + 4;
      drawText(ui, 'P1', 4, 4, { color: this.match.humans[0].color, shadow: PAL.ink });
      drawText(ui, 'P2', 4, y2, { color: this.match.humans[1].color, shadow: PAL.ink });
    } else {
      drawText(ui, this.title, 4, 4, { color: PAL.cloud, shadow: PAL.ink });
    }
    this.drawBanner(ui, W, H);

    if (!isTop) return;
    if (input.touch.enabled) {
      input.touch.draw(ui, W, H);
    } else if (this.match.humans.length === 1) {
      const id = this.match.humans[0].controller;
      const pairs = [
        [input.moveLabel(id), 'SKATE'],
        [input.actionLabel('shoot', id), 'SHOOT'],
        [input.actionLabel('pass', id), 'PASS'],
        [input.actionLabel('check', id), 'POKE'],
      ];
      if (W >= 360) pairs.push([input.actionLabel('sprint', id), 'SPRINT'], [input.actionLabel('switch', id), 'SWAP']);
      hintBar(ui, W, H, pairs);
    }
  }

  drawScoreboard(ctx, W) {
    const m = this.match;
    let text;
    if (this.mode === 'practice') {
      text = `GOALS ${m.score.home}   SHOTS ${m.shots.home}`;
    } else {
      const a = TEAMS[m.sides.home.team], b = TEAMS[m.sides.away.team];
      text = `${a.name} ${m.score.home} - ${m.score.away} ${b.name}`;
    }
    const w = textWidth(text) + 12, x = Math.round(W / 2 - w / 2);
    panel(ctx, x, 2, w, 11, { fill: PAL.ink, border: PAL.slate, alpha: 0.85 });
    drawText(ctx, text, W / 2, 5, { color: PAL.white, align: 'center' });
    if (m.state === 'faceoff') drawText(ctx, 'FACE-OFF', W / 2, 17, { color: PAL.yellow, align: 'center', shadow: PAL.ink });
  }

  drawBanner(ctx, W, H) {
    const b = this.banner;
    if (!b) return;
    if (b.small) {
      drawText(ctx, b.text, W / 2, 30, { color: b.color, scale: 2, align: 'center', shadow: PAL.ink });
      return;
    }
    const y = Math.round(H * 0.32);
    panel(ctx, 0, y - 6, W, b.sub ? 40 : 30, { fill: PAL.ink, border: null, alpha: 0.6 });
    drawText(ctx, b.text, W / 2 + 2, y + 2, { color: PAL.ink, scale: 4, align: 'center' });
    drawText(ctx, b.text, W / 2, y, { color: b.color === PAL.cloud ? PAL.white : PAL.yellow, scale: 4, align: 'center' });
    if (b.sub) drawText(ctx, b.sub, W / 2, y + 24, { color: PAL.white, align: 'center' });
  }
}
