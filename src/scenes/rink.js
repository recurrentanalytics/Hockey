// On-ice scene: runs a Match and draws it with single, shared or split cameras.
import { PAL } from '../engine/palette.js';
import { drawText, textWidth, drawTextOutlined } from '../engine/font.js';
import { panel } from '../engine/draw.js';
import { PLAYER_COLORS, TEAMS, RINK, GOAL, isBoarTeam } from '../config.js';
import { settings } from '../settings.js';
import { Camera } from '../world/camera.js';
import { BAKE } from '../world/rink.js';
import { project } from '../world/projection.js';
import { Match } from '../game/match.js';
import { Particles } from '../world/particles.js';
import { VideoWall } from '../ui/videoWall.js';
import { resolveRules } from '../game/rules.js';
import { hintBar } from '../ui/hud.js';
import { PauseScene } from './pause.js';
import { Recorder, Replay } from '../game/replay.js';

const SPLIT_ZOOM = 0.8;
const otherTeam = (t) => Object.keys(TEAMS).find((k) => k !== t && !TEAMS[k].hidden);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const m0 = (scene) => scene.match;
const BOAR_TEAMS = { has: (key) => isBoarTeam(key) };
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
    const homeKey = teams?.home ?? settings.homeTeam;
    let awayKey = teams?.away ?? (mode === 'practice' ? otherTeam(settings.homeTeam) : settings.awayTeam);
    // Kit clash (same colours): the away side wears its cream away kit.
    if (isBoarTeam(homeKey) && isBoarTeam(awayKey) && TEAMS[`${awayKey}_away`]) awayKey = `${awayKey}_away`;
    const lineup = MODES[mode];
    this.match = new Match({
      ...lineup,
      home: { ...lineup.home, team: homeKey },
      away: { ...lineup.away, team: awayKey },
      rules: this.rules,
      ball: settings.gameBall !== 'puck',
      difficulty: settings.difficulty,
      humans: humans.map((h, i) => ({ ...h, tag: `P${i + 1}`, color: PLAYER_COLORS[i] })),
    });
    for (const sk of this.match.roster) sk.sprites.warm();
    this.cams = this.match.humans.map(() => new Camera());
    this.shared = new Camera();
    this.banner = null;
    this.fx = new Particles();
    this.wall = new VideoWall();
    this.recorder = new Recorder(6);
    this.replay = null;
    this.replayCam = new Camera();
    const teamsInGame = [this.match.sides.home.team, this.match.sides.away.team];
    app.world.configure({ venue: settings.venue, logo: teamsInGame.some((t) => BOAR_TEAMS.has(t)) ? 'boar' : 'puck' });
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
        this.app.audio.stopSong();
        if (this.onFinish) this.onFinish({ score: { ...m.score }, how: m.ref?.result?.how ?? '', winner: m.ref?.result?.winner });
        else this.app.popTo((s) => s.isMainMenu);
        return;
      }
      else this.finalT = (this.finalT ?? 0) + dt;
    }
    if (this.replay) return this.updateReplay(dt, input);
    // Start the replay at the end of the goal celebration, before the next face-off.
    if (this.replayAt != null && m.state === 'goal' && m.timer <= dt * 1.5) return this.startReplay();
    if (m.state !== 'goal') this.replayAt = null;
    m.update(dt, input);
    if (m.state === 'play') this.playT = (this.playT ?? 0) + dt;
    // Replays start from play, never from the line-up before a face-off.
    if (m.state === 'faceoff') this.recorder.clear();
    else this.recorder.capture(m);
    const name = (side) => TEAMS[m.sides[side].team].name;
    const sfx = this.app.audio;
    for (const e of m.events) {
      switch (e.type) {
        case 'shot': sfx.play('shot', 0.5 + (m.puck.shot?.charge ?? 0.5) * 0.5); break;
        case 'pass': case 'steal': sfx.play('stick', 0.8); break;
        case 'pickup': sfx.play('stick', 0.4); break;
        case 'boards': sfx.play('boards', e.speed / 15); break;
        case 'post': sfx.play('post', e.speed / 20); sfx.play('ooh'); this.shake = Math.max(this.shake, 0.15); this.app.world.jiggle(Math.sign(m.puck.pos.x), 0.35); break;
        case 'save': sfx.play('save'); this.fx.puff(m.puck.pos.x, m.puck.pos.y); if (e.speed > 20 || e.dist < 5) sfx.play('ooh', 0.8); break;
        case 'hit': if (e.approach > 4.5 || e.victim.downT > 0) sfx.play('hit', e.approach / 8); if (e.approach > 5) { this.shake = Math.max(this.shake, 0.2); this.fx.stars(e.victim.pos.x, e.victim.pos.y); } if (e.victim.downT > 0) this.fx.puff(e.victim.pos.x, e.victim.pos.y, 0.1, 9); break;
        case 'goal': sfx.play('horn'); this.shake = 0.5; this.cheerT = 3; this.lampSide = Math.sign(m.puck.pos.x); this.app.world.jiggle(this.lampSide, 1); if (e.side === 'home') this.waveT = 3.5; this.fx.confetti(m.puck.pos.x - Math.sign(m.puck.pos.x) * 3, m.puck.pos.y); break;
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
        case 'faceoffWon': sfx.play('stick', 0.9); this.fx.stars(m.puck.pos.x, m.puck.pos.y, 0.3, 4); break;
        case 'faceoffEarly': this.notice = { text: 'TOO EARLY - DRAW LOST', t: 1.5 }; break;
        case 'lineChange': if (m.humans.some((h) => h.side === e.side)) this.notice = { text: `LINE CHANGE - ${name(e.side)}`, t: 1.5 }; break;
        case 'timeoutRequested': this.notice = { text: `TIME-OUT REQUESTED - ${name(e.side)}`, t: 2 }; break;
      }
      if (e.type === 'goal') {
        const boar = BOAR_TEAMS.has(m.sides[e.side].team);
        this.banner = { text: e.shootout ? 'SCORES!' : boar ? 'TOOORRR!!!' : 'GOAL!', sub: e.shootout ? name(e.side) : this.goalText(e), t: 2.4 };
        // The club hymn is the Borstentiere goal song.
        if (boar && !e.shootout) this.app.audio.song('audio/hymne.mp3', 10);
        if (!e.shootout) this.notice = { text: this.creditText(e), t: 3 };
        if (!e.shootout && settings.replays) this.replayAt = this.recorder.last;
        if (!e.shootout) this.wall.start('goal', { team: m.sides[e.side].team, look: e.by?.sideKey === e.side ? e.by.look : {}, text: boar ? 'TOOORRR!' : 'GOAL!' }, 2.6, 2.2);
      }
      if (e.type === 'save' && !this.banner) this.banner = { text: 'SAVE', t: 0.8, small: true };
      if (e.type === 'foul') this.notice = { text: `${e.name} - ${name(e.offender.sideKey)} #${e.offender.number}`, t: 2.5 };
      if (e.type === 'penalty') this.banner = { text: e.major ? 'MAJOR' : 'PENALTY', sub: `${name(e.side)} #${e.skater.number} - ${e.foul} - ${fmt(e.seconds)}`, t: 2.6, small2: true };
      if (e.type === 'penaltyShot') this.banner = { text: 'PENALTY SHOT', sub: `${e.name} ON #${e.shooter.number}`, t: 2.6, small2: true };
      if (e.type === 'attempt' && !e.scored) this.banner = { text: 'NO GOAL', t: 1.4, small: true };
      if (e.type === 'break') this.banner = { text: e.text, t: 3, small2: true };
      // Stoppages: sometimes the video wall shows a kiss cam, Bonny or a dancing fan.
      if ((e.type === 'whistle' || e.type === 'break' || e.type === 'timeout') && !this.wall.active && Math.random() < 0.5) {
        const boarGame = [m.sides.home.team, m.sides.away.team].some((t) => BOAR_TEAMS.has(t));
        const r = Math.random();
        const kind = boarGame && r < 0.4 ? 'bonny' : r < 0.75 ? 'kiss' : 'dance';
        this.wall.start(kind, { team: pick([m.sides.home.team, m.sides.away.team]) });
        if (kind === 'kiss') this.app.audio.play('cheer', 0.5);
      }
      if (e.type === 'final') {
        this.banner = { text: 'FINAL', sub: this.finalText(e), t: Infinity, final: true };
        if (e.winner && BOAR_TEAMS.has(m.sides[e.winner].team)) { this.banner.sub += ' - ZUSAMMEN SIND WIR STARK!'; this.app.audio.song('audio/hymne.mp3', 20); }
      }
      if (e.type === 'release') this.notice = { text: `${name(e.side)} BACK TO FULL STRENGTH`, t: 2 };
    }
    // Wheel sparkles on fast skaters, a glowing trail behind hard shots.
    for (const s of m.skaters) {
      if (s.speed > 6 && Math.random() < 0.3) this.fx.spray(s);
      // Hockey stops kick up a spray ahead of the skates.
      if (s.brakeT > 0 && s.speed > 3 && Math.random() < 0.7) this.fx.spray(s, true);
    }
    // La-Ola: after home goals, and now and then when the game is flowing.
    if (this.waveT > 0 && (this.waveT -= dt) <= 0) this.app.world.startWave(2);
    if (m.state === 'play' && Math.random() < dt / 70) this.app.world.startWave(1);
    if (m.puck.loose && m.puck.speed > 14) this.fx.trail(m.puck);
    this.fx.update(dt);
    this.wall.update(dt);
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

  // ------------------------------------------------------------------ replay

  startReplay() {
    const m = this.match;
    const goal = this.replayAt;
    this.replayAt = null;
    // From about three seconds before the goal to a moment after it.
    const frames = this.recorder.around(goal, 180, 45);
    const live = [...m.roster, ...m.goalies, m.puck];
    this.replay = new Replay(frames, live, { speed: 0.55 });
    this.banner = null;
    this.wall.show = null;
    this.cheerT = 0;
    this.fx.list.length = 0;
    const p = frames[0]?.ents.find((o) => o.e === m.puck);
    if (p) { const v = this.viewSize(); const t = project(p.x, p.y); this.replayCam.snap(t.x, t.y - 12, v.w, v.h); }
  }

  updateReplay(dt, input) {
    const r = this.replay, m = this.match, sfx = this.app.audio;
    const skip = input.menu.confirm || input.taps.length || m.humans.some((h) => input.controller(h.controller)?.pressed.shoot);
    for (const e of r.update(dt)) {
      if (e.type === 'goal') {
        const side = Math.sign(m.puck.pos.x);
        sfx.play('cheer');
        this.app.world.jiggle(side, 1);
        this.fx.confetti(m.puck.pos.x - side * 3, m.puck.pos.y, 50);
      }
      else if (e.type === 'hit') sfx.play('hit', e.level / 8);
      else if (e.type === 'boards') sfx.play('boards', e.level / 15);
      else if (e.type === 'post') sfx.play('post', e.level / 20);
      else if (e.type === 'pass') sfx.play('stick', 0.8);
      else sfx.play(e.type);
    }
    if (m.puck.speed > 14 && m.puck.z >= 0) this.fx.trail(m.puck);
    this.fx.update(dt * r.speed);
    const v = this.viewSize(), p = project(m.puck.pos.x, m.puck.pos.y);
    this.zoom = 1;
    this.replayCam.follow(p.x, p.y - 12, dt, v.w, v.h, 3);
    if (r.done || skip) {
      r.restore();
      this.replay = null;
      this.fx.list.length = 0;
    }
  }

  /** "GOAL #61  ASSISTS #7 #10" */
  creditText(e) {
    const who = (s) => (s.human ? `${s.human.tag} #${s.number}` : `#${s.number}`);
    if (!e.by || e.by.sideKey !== e.side) return 'OWN GOAL';
    const a = e.assists ?? [];
    return `GOAL ${who(e.by)}${a.length ? `  ASSIST${a.length > 1 ? 'S' : ''} ${a.map(who).join(' ')}` : '  UNASSISTED'}`;
  }

  /** Three stars of the game: points for goals, assists, shots, saves; a bonus for winning. */
  stars() {
    const m = this.match, win = m.ref?.result?.winner;
    const list = [];
    for (const s of m.roster) {
      const score = (s.g ?? 0) * 3 + (s.a ?? 0) * 2 + (s.sog ?? 0) * 0.4 + (s.sideKey === win ? 0.5 : 0);
      if (score > 0.6) list.push({ who: `#${s.number}${s.human ? ' ' + s.human.tag : ''}`, side: s.sideKey, line: `${s.g ?? 0}G ${s.a ?? 0}A ${s.sog ?? 0} SOG`, score, look: s.look });
    }
    for (const g of m.goalies) {
      const sv = g.saves ?? 0, ga = g.ga ?? 0;
      const score = sv * 0.35 - ga * 0.8 + (ga === 0 && sv > 0 ? 2 : 0) + (g.sideKey === win ? 0.5 : 0);
      if (sv > 0) list.push({ who: 'GOALIE', side: g.sideKey, line: `${sv} SAVES ${sv + ga ? Math.round((sv / (sv + ga)) * 1000) / 1000 : 0} SV%`.replace(' 0.', ' .'), score });
    }
    return list.sort((a, b) => b.score - a.score).slice(0, 3);
  }

  drawStars(ctx, W, y) {
    const m = this.match, top = this.stars();
    if (!top.length) return;
    const w = 200, x = Math.round(W / 2 - w / 2), h = 11 + top.length * 8;
    panel(ctx, x, y, w, h, { fill: PAL.ink, border: PAL.yellow, alpha: 0.85 });
    drawText(ctx, 'THREE STARS', W / 2, y + 3, { color: PAL.yellow, align: 'center' });
    top.forEach((st, i) => {
      const ry = y + 11 + i * 8;
      for (let k = 0; k <= 2 - i; k++) drawText(ctx, '*', x + 6 + k * 4, ry, { color: PAL.yellow });
      drawText(ctx, `${TEAMS[m.sides[st.side].team].name} ${st.who}`, x + 20, ry, { color: PAL.white });
      drawText(ctx, st.line, x + w - 6, ry, { color: PAL.mist, align: 'right' });
    });
  }

  /** The ball drawn once more, faintly, over everything: you can see it behind players. */
  ballGhost() {
    const p = this.match.puck;
    return {
      sortY: Infinity,
      draw: (ctx, ox, oy) => {
        ctx.save();
        ctx.globalAlpha = 0.5;
        p.draw(ctx, ox, oy, true);
        ctx.restore();
      },
    };
  }

  /** Arrow at the screen edge pointing to the ball when the camera can't see it. */
  drawBallArrow(ctx, cam, W, H) {
    const { display } = this.app;
    const p = this.match.puck;
    const wp = project(p.pos.x, p.pos.y, p.z);
    const k = W / display.worldWidth;
    const sx = (wp.x - cam.x) * k + W / 2, sy = (wp.y - cam.y) * k + H / 2;
    const m = 10;
    if (sx > m && sx < W - m && sy > 20 && sy < H - m) return;
    const cx = Math.max(m, Math.min(W - m, sx)), cy = Math.max(20, Math.min(H - m, sy));
    const a = Math.atan2(sy - cy || sy - H / 2, sx - cx || sx - W / 2);
    const blink = Math.floor(performance.now() / 250) % 2;
    ctx.fillStyle = PAL.ink;
    ctx.fillRect(Math.round(cx) - 3, Math.round(cy) - 3, 7, 7);
    ctx.fillStyle = blink ? '#ff2a2a' : PAL.white;
    ctx.fillRect(Math.round(cx) - 2, Math.round(cy) - 2, 5, 5);
    // a little pointer toward the ball
    ctx.fillStyle = PAL.ink;
    for (let i = 4; i <= 6; i++) ctx.fillRect(Math.round(cx + Math.cos(a) * i), Math.round(cy + Math.sin(a) * i), 1, 1);
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
    const key = this.match.sides[e.side].team;
    const team = TEAMS[key].name;
    // Club chants from the Boni Borstentiere website and comic
    if (e.by?.look?.kind === 'boar') return 'BONNY! BONNY! BONNY!';
    if (key.startsWith('borstentiere')) return pick(['WAS SIND WIR? EIN BORSTENTIER!', 'LOS BORSTENTIERE!', 'ZUSAMMEN SIND WIR STARK!']);
    if (key.startsWith('borstis')) return pick(['HAARE OPTIONAL!', 'WO BLADING AUF BALDING TRIFFT', 'ZU ALT FUER AUSREDEN!']);
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
    world.cheer = (this.cheerT ?? 0) > 0 || this.match.state === 'final';
    const ctx = display.wctx, W = display.width, H = display.height;
    if (this.replay) return this.drawReplay();
    const ents = [...this.match.entities, ...this.effects(), ...this.fx.entities(), this.ballGhost()];

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
    if (this.cameraMode !== 'split' && this.match.state === 'play') this.drawBallArrow(ui, this.cameraMode === 'shared' ? this.shared : this.cams[0], W, H);
    this.drawScoreboard(ui, W);
    if (this.cameraMode === 'split') {
      const y2 = Math.round((this.viewSize().h1 + 2) * SPLIT_ZOOM) + 4;
      drawText(ui, 'P1', 4, 4, { color: this.match.humans[0].color, shadow: PAL.ink });
      drawText(ui, 'P2', 4, y2, { color: this.match.humans[1].color, shadow: PAL.ink });
    } else {
      drawText(ui, this.title, 4, 4, { color: PAL.cloud, shadow: PAL.ink });
    }
    if (m0(this).state !== 'final') this.wall.draw(ui, W);
    this.drawBanner(ui, W, H);

    if (!isTop) return;
    if (input.touch.enabled) {
      input.touch.draw(ui, W, H);
    } else if (this.match.humans.length === 1 && this.match.state !== 'final') {
      const id = this.match.humans[0].controller;
      const pairs = [
        [input.moveLabel(id), 'SKATE'],
        [input.actionLabel('shoot', id), 'SHOOT'],
        [input.actionLabel('pass', id), 'PASS'],
        [input.actionLabel('check', id), 'POKE'],
      ];
      if (W >= 360) pairs.push([input.actionLabel('sprint', id), 'SPRINT'], [input.actionLabel('switch', id), 'SWAP']);
      // Fades out once you've played a while; comes back during stoppages.
      const a = Math.max(0, Math.min(1, 1 - ((this.playT ?? 0) - 25) / 2));
      const show = this.match.state !== 'play' ? 1 : a;
      if (show > 0.02) { ui.save(); ui.globalAlpha = show; hintBar(ui, W, H, pairs); ui.restore(); }
    }
  }

  drawReplay() {
    const { display, world } = this.app;
    display.setZoom(1);
    world.cheer = false;
    const ctx = display.wctx;
    const ents = [...this.replay.entities, ...this.fx.entities(), this.ballGhost()];
    world.draw(ctx, { x: 0, y: 0, w: display.worldWidth, h: display.worldHeight }, this.replayCam, ents);
    const ui = display.uctx, W = display.width, H = display.height;
    // TV look: letterbox bars, a blinking red dot, a progress bar
    ui.fillStyle = PAL.ink;
    ui.fillRect(0, 0, W, 14);
    ui.fillRect(0, H - 14, W, 14);
    if (Math.floor(performance.now() / 400) % 2 === 0) { ui.fillStyle = PAL.red; ui.fillRect(6, 4, 5, 5); }
    drawText(ui, 'REPLAY', 14, 4, { color: PAL.white, big: true });
    const m = this.match;
    const a = TEAMS[m.sides.home.team].name, b = TEAMS[m.sides.away.team].name;
    drawText(ui, `${a} ${m.score.home} - ${m.score.away} ${b}`, W - 30, 5, { color: PAL.cloud, align: 'right' });
    ui.fillStyle = PAL.slate;
    ui.fillRect(6, H - 9, W - 12, 2);
    ui.fillStyle = PAL.yellow;
    ui.fillRect(6, H - 9, Math.round((W - 12) * Math.min(1, this.replay.progress)), 2);
    drawText(ui, `${this.app.input.confirmLabel()} TO SKIP`, W - 6, H - 7, { color: PAL.mist, align: 'right' });
    if (this.notice) drawText(ui, this.notice.text, 6, H - 7, { color: PAL.white });
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
      drawTextOutlined(ctx, b.text, W / 2, 36, { color: PAL.white, scale: 2, align: 'center', big: true });
      return;
    }
    const scale = b.small2 ? 2 : 3;
    const y = Math.round(H * 0.3);
    const th = scale * 7;
    const h = th + (b.sub ? 22 : 14) + (b.final ? 10 : 0);
    const bw = Math.min(W - 16, Math.max(textWidth(b.text, scale, true), textWidth(b.sub ?? '', 1, true)) + 40);
    panel(ctx, W / 2 - bw / 2, y - 7, bw, h, { fill: PAL.ink, border: PAL.pink, alpha: 0.85 });
    drawTextOutlined(ctx, b.text, W / 2, y, { color: PAL.yellow, scale, align: 'center', shadow: PAL.redDark, big: true });
    if (b.sub) drawText(ctx, b.sub, W / 2, y + th + 5, { color: PAL.white, align: 'center', big: true });
    if (b.final) {
      drawText(ctx, `${this.app.input.confirmLabel()} TO CONTINUE`, W / 2, y + th + 15, { color: PAL.mist, align: 'center' });
      this.drawStats(ctx, W, y + h + 2);
      if (this.mode !== 'practice') this.drawStars(ctx, W, y + h + 2 + 12 + 5 * 8 + 3);
    }
  }
}
