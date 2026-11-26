// On-ice scene: runs a Match and draws it with single, shared or split cameras.
import { PAL } from '../engine/palette.js';
import { drawText, textWidth } from '../engine/font.js';
import { panel } from '../engine/draw.js';
import { PLAYER_COLORS, TEAMS, RINK, GOAL } from '../config.js';
import { settings } from '../settings.js';
import { Camera } from '../world/camera.js';
import { BAKE } from '../world/rink.js';
import { project } from '../world/projection.js';
import { Match } from '../game/match.js';
import { resolveRules } from '../game/rules.js';
import { hintBar } from '../ui/hud.js';
import { PauseScene } from './pause.js';

const SPLIT_ZOOM = 0.8;
const otherTeam = (t) => Object.keys(TEAMS).find((k) => k !== t);
const fmt = (sec) => { const s = Math.max(0, Math.ceil(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const LOOKAHEAD = 0.3;

/** Line-ups per mode. `ai` lists the sides the team AI plays for. */
const MODES = {
  practice: { home: { team: 'blazers', skaters: 2 }, away: { team: 'waves', skaters: 0 }, ai: [] },
  ai:       { home: { team: 'blazers', skaters: 4, lines: 2 }, away: { team: 'waves', skaters: 4, lines: 2 }, ai: ['home', 'away'] },
  versus:   { home: { team: 'blazers', skaters: 4, lines: 2 }, away: { team: 'waves', skaters: 4, lines: 2 }, ai: ['home', 'away'] },
  coop:     { home: { team: 'blazers', skaters: 4, lines: 2 }, away: { team: 'waves', skaters: 4, lines: 2 }, ai: ['home', 'away'] },
};
export class RinkScene {
  /**
   * mode:    'practice' | 'ai' | 'versus' | 'coop'
   * humans:  [{ controller, side }]
   * camera:  'single' | 'shared' | 'split'
   */
  constructor(app, { title, mode = 'practice', humans, camera = 'single', teams = null, onFinish = null }) {
    this.onFinish = onFinish;
    this.app = app;
    this.title = title;
    this.mode = mode;
    this.cameraMode = humans.length > 1 ? camera : 'single';
    this.zoom = 1;
    this.rules = mode === 'practice' ? null : resolveRules(settings.ruleset, settings.periodLength);
    const lineup = MODES[mode];
    this.match = new Match({
      ...lineup,
      home: { ...lineup.home, team: teams?.home ?? settings.homeTeam },
      away: { ...lineup.away, team: teams?.away ?? (mode === 'practice' ? otherTeam(settings.homeTeam) : settings.awayTeam) },
      rules: this.rules,
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
    const m = this.match;
    if (m.state === 'final') {
      const pressed = input.menu.confirm || input.taps.length || m.humans.some((h) => input.controller(h.controller)?.pressed.shoot);
      if (pressed && (this.finalT = (this.finalT ?? 0) + dt) > 0.8) {
        if (this.onFinish) this.onFinish({ score: { ...m.score }, how: m.ref?.result?.how ?? '', winner: m.ref?.result?.winner });
        else this.app.popTo((s) => s.isMainMenu);
        return;
      }
      else this.finalT = (this.finalT ?? 0) + dt;
    }
    m.update(dt, input);
    const name = (side) => TEAMS[m.sides[side].team].name;
    const sfx = this.app.audio;
    for (const e of m.events) {
      switch (e.type) {
        case 'shot': sfx.play('shot', 0.5 + (m.puck.shot?.charge ?? 0.5) * 0.5); break;
        case 'pass': case 'steal': sfx.play('stick', 0.8); break;
        case 'pickup': sfx.play('stick', 0.4); break;
        case 'boards': sfx.play('boards', e.speed / 15); break;
        case 'post': sfx.play('post', e.speed / 20); this.shake = Math.max(this.shake, 0.15); break;
        case 'save': sfx.play('save'); break;
        case 'hit': sfx.play('hit', e.approach / 8); if (e.approach > 5) this.shake = Math.max(this.shake, 0.2); break;
        case 'goal': sfx.play('horn'); this.shake = 0.5; this.cheerT = 3; this.lampSide = Math.sign(m.puck.pos.x); break;
        case 'whistle': sfx.play('whistle'); break;
        case 'break': case 'final': sfx.play('buzzer'); if (e.type === 'final') sfx.play('cheer'); break;
        case 'attempt': if (!e.scored) sfx.play('save', 0.6); break;
      }
      // Rumble on the pads of the players involved.
      const rumble = (h, strong, weak, ms) => h && this.app.input.rumble(h.controller, strong, weak, ms);
      switch (e.type) {
        case 'shot': rumble(e.by.human, 0.15, 0.4, 60); break;
        case 'hit': rumble(e.victim.human, 0.8, 0.5, 180); rumble(e.hitter.human, 0.4, 0.3, 100); break;
        case 'post': for (const h of m.humans) rumble(h, 0.2, 0.6, 90); break;
        case 'goal': for (const h of m.humans) rumble(h, h.side === e.side ? 0.6 : 1, 0.8, h.side === e.side ? 300 : 450); break;
        case 'steal': rumble(e.from.human, 0.3, 0.3, 80); break;
        case 'faceoffWon': sfx.play('stick', 0.9); break;
        case 'faceoffEarly': this.notice = { text: 'TOO EARLY - DRAW LOST', t: 1.5 }; break;
        case 'lineChange': if (m.humans.some((h) => h.side === e.side)) this.notice = { text: `LINE CHANGE - ${name(e.side)}`, t: 1.5 }; break;
        case 'timeoutRequested': this.notice = { text: `TIME-OUT REQUESTED - ${name(e.side)}`, t: 2 }; break;
      }
      if (e.type === 'goal') this.banner = { text: e.shootout ? 'SCORES!' : 'GOAL!', sub: e.shootout ? name(e.side) : this.goalText(e), t: 2.4 };
      if (e.type === 'save' && !this.banner) this.banner = { text: 'SAVE', t: 0.8, small: true };
      if (e.type === 'foul') this.notice = { text: `${e.name} - ${name(e.offender.sideKey)} #${e.offender.number}`, t: 2.5 };
      if (e.type === 'penalty') this.banner = { text: e.major ? 'MAJOR' : 'PENALTY', sub: `${name(e.side)} #${e.skater.number} - ${e.foul} - ${fmt(e.seconds)}`, t: 2.6, small2: true };
      if (e.type === 'penaltyShot') this.banner = { text: 'PENALTY SHOT', sub: `${e.name} ON #${e.shooter.number}`, t: 2.6, small2: true };
      if (e.type === 'attempt' && !e.scored) this.banner = { text: 'NO GOAL', t: 1.4, small: true };
      if (e.type === 'break') this.banner = { text: e.text, t: 3, small2: true };
      if (e.type === 'final') this.banner = { text: 'FINAL', sub: this.finalText(e), t: Infinity, final: true };
      if (e.type === 'release') this.notice = { text: `${name(e.side)} BACK TO FULL STRENGTH`, t: 2 };
    }
    this.shake = Math.max(0, (this.shake ?? 0) - dt);
    this.cheerT = Math.max(0, (this.cheerT ?? 0) - dt);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    if (this.notice && (this.notice.t -= dt) <= 0) this.notice = null;
    this.updateCameras(dt);
  }

  /** Goal light over the net and the crowd jumping up after a goal. */
  effects() {
    const out = [];
    const t = performance.now() / 1000;
    if (this.cheerT > 0) {
      out.push({
        sortY: -100,
        draw: (ctx, ox, oy) => {
          const colors = [PAL.yellow, PAL.white, PAL.red, PAL.sky, PAL.orange];
          for (let i = 0; i < 260; i++) {
            const x = ((i * 97) % 1000) - 500;
            const y = -140 - ((i * 53) % 70);
            if (((i * 7 + Math.floor(t * 8)) % 3) !== 0) continue;
            ctx.fillStyle = colors[i % colors.length];
            ctx.fillRect(Math.round(x + ox), Math.round(y + oy - (Math.floor(t * 8 + i) % 2)), 2, 1);
          }
        },
      });
    }
    if (this.cheerT > 0 && this.lampSide && Math.floor(t * 6) % 2 === 0) {
      const p = project(this.lampSide * (RINK.goalLineX + GOAL.depth), 0, 1.7);
      out.push({
        sortY: 0.01,
        draw: (ctx, ox, oy) => {
          ctx.fillStyle = PAL.ink;
          ctx.fillRect(Math.round(p.x + ox - 3), Math.round(p.y + oy - 3), 7, 5);
          ctx.fillStyle = PAL.red;
          ctx.fillRect(Math.round(p.x + ox - 2), Math.round(p.y + oy - 2), 5, 3);
          ctx.fillStyle = PAL.yellow;
          ctx.fillRect(Math.round(p.x + ox - 1), Math.round(p.y + oy - 2), 2, 1);
        },
      });
    }
    return out;
  }

  drawStats(ctx, W, y) {
    const m = this.match, st = m.stats;
    const a = TEAMS[m.sides.home.team].name, b = TEAMS[m.sides.away.team].name;
    const rows = [
      ['SHOTS ON GOAL', m.shots.home, m.shots.away],
      ['POWER PLAY', `${st.home.ppGoals}/${st.home.ppOpp}`, `${st.away.ppGoals}/${st.away.ppOpp}`],
      ['PENALTY TIME', fmt(st.home.pim), fmt(st.away.pim)],
      ['FACE-OFFS WON', st.home.faceoffs, st.away.faceoffs],
      ['HITS', st.home.hits, st.away.hits],
    ];
    const w = 200, x = Math.round(W / 2 - w / 2), h = 12 + rows.length * 8;
    panel(ctx, x, y, w, h, { fill: PAL.ink, border: PAL.slate, alpha: 0.85 });
    drawText(ctx, a, x + w - 64, y + 3, { color: PAL.cloud, align: 'right' });
    drawText(ctx, b, x + w - 6, y + 3, { color: PAL.cloud, align: 'right' });
    rows.forEach(([label, h1, a1], i) => {
      const ry = y + 11 + i * 8;
      drawText(ctx, label, x + 6, ry, { color: PAL.mist });
      drawText(ctx, String(h1), x + w - 64, ry, { color: PAL.white, align: 'right' });
      drawText(ctx, String(a1), x + w - 6, ry, { color: PAL.white, align: 'right' });
    });
  }

  finalText(e) {
    const m = this.match;
    const a = TEAMS[m.sides.home.team].name, b = TEAMS[m.sides.away.team].name;
    const score = `${m.score.home}-${m.score.away}`;
    if (!e.winner) return `DRAW ${score}`;
    return `${e.winner === 'home' ? a : b} WIN ${score}${e.how ? ' ' + e.how : ''}`;
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
    const ents = [...this.match.entities, ...this.effects()];

    if (this.cameraMode === 'split') {
      const v = this.viewSize();
      world.draw(ctx, { x: 0, y: 0, w: display.worldWidth, h: v.h1 }, this.cams[0], ents);
      world.draw(ctx, { x: 0, y: v.h1 + 2, w: display.worldWidth, h: display.worldHeight - v.h1 - 2 }, this.cams[1], ents);
      ctx.fillStyle = PAL.ink;
      ctx.fillRect(0, v.h1, display.worldWidth, 2);
    } else {
      const base = this.cameraMode === 'shared' ? this.shared : this.cams[0];
      const s = (this.shake ?? 0) * 8;
      const cam = s > 0 ? { x: base.x + (Math.random() - 0.5) * s, y: base.y + (Math.random() - 0.5) * s } : base;
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
    const m = this.match, ref = m.ref;
    let text;
    if (this.mode === 'practice') {
      text = `GOALS ${m.score.home}   SHOTS ${m.shots.home}`;
    } else {
      const a = TEAMS[m.sides.home.team], b = TEAMS[m.sides.away.team];
      text = `${a.name} ${m.score.home} - ${m.score.away} ${b.name}`;
      if (ref) text += `   ${ref.periodLabel} ${ref.clockText}`.trimEnd();
    }
    const w = textWidth(text) + 12, x = Math.round(W / 2 - w / 2);
    panel(ctx, x, 2, w, 11, { fill: PAL.ink, border: PAL.slate, alpha: 0.85 });
    drawText(ctx, text, W / 2, 5, { color: PAL.white, align: 'center' });

    const lines = [];
    if (ref && ref.phase !== 'final') {
      for (const side of ['home', 'away']) {
        const pens = ref.penaltiesOf(side);
        if (!pens.length) continue;
        const other = side === 'home' ? 'away' : 'home';
        lines.push({ text: `POWER PLAY ${TEAMS[m.sides[other].team].name} ${fmt(Math.min(...pens.map((p) => p.t)))}`, color: PAL.yellow });
      }
      if (ref.pending) lines.push({ text: 'DELAYED PENALTY', color: PAL.orange });
      if (ref.so) {
        const mark = (log) => log.map((g) => (g ? 'O' : 'X')).join(' ') || '-';
        lines.push({ text: `${TEAMS[m.sides.home.team].name} ${mark(ref.so.log.home)}  |  ${TEAMS[m.sides.away.team].name} ${mark(ref.so.log.away)}`, color: PAL.white });
      }
    }
    if (m.state === 'faceoff' && !ref?.attempt) {
      const humanCenter = m.draw && Object.values(m.draw.centers).some((c) => c?.human);
      const key = this.app.input.actionLabel('shoot', m.humans[0]?.controller);
      lines.push({ text: humanCenter ? `FACE-OFF - PRESS ${key ?? 'SHOOT'} ON THE DROP` : 'FACE-OFF', color: PAL.yellow });
    }
    if (this.notice) lines.push({ text: this.notice.text, color: PAL.cloud });
    lines.forEach((l, i) => drawText(ctx, l.text, W / 2, 17 + i * 7, { color: l.color, align: 'center', shadow: PAL.ink }));
  }

  drawBanner(ctx, W, H) {
    const b = this.banner;
    if (!b) return;
    if (b.small) {
      drawText(ctx, b.text, W / 2, 40, { color: PAL.white, scale: 2, align: 'center', shadow: PAL.ink });
      return;
    }
    const scale = b.small2 ? 3 : 4;
    const y = Math.round(H * 0.32);
    const h = scale * 5 + (b.sub ? 18 : 12) + (b.final ? 10 : 0);
    panel(ctx, 0, y - 6, W, h, { fill: PAL.ink, border: null, alpha: 0.65 });
    drawText(ctx, b.text, W / 2 + 2, y + 2, { color: PAL.ink, scale, align: 'center' });
    drawText(ctx, b.text, W / 2, y, { color: PAL.yellow, scale, align: 'center' });
    if (b.sub) drawText(ctx, b.sub, W / 2, y + scale * 5 + 4, { color: PAL.white, align: 'center' });
    if (b.final) {
      drawText(ctx, `${this.app.input.confirmLabel()} TO CONTINUE`, W / 2, y + scale * 5 + 14, { color: PAL.mist, align: 'center' });
      this.drawStats(ctx, W, y + h + 2);
    }
  }
}
