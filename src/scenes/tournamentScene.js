// Tournament hub: standings, next game, champion.
import { PAL } from '../engine/palette.js';
import { drawText, fitText } from '../engine/font.js';
import { panel } from '../engine/draw.js';
import { TEAMS } from '../config.js';
import { settings } from '../settings.js';
import { Menu, choice } from '../ui/menu.js';
import { MenuScene } from './menuScene.js';
import { RinkScene } from './rink.js';
import { loadTournament, newTournament, clearTournament, standings, nextUserGame, simulateUpTo, record, advance, saveTournament } from '../game/tournament.js';

const name = (k) => TEAMS[k]?.name ?? k;

export class TournamentScene extends MenuScene {
  constructor(app) {
    super(app, { title: 'TURNIER', items: [], top: 112, width: 220 });
    this.isTournament = true;
    this.confirmAbandon = false;
    this.rebuild();
  }

  resume() {
    this.rebuild();
  }

  rebuild() {
    const { app } = this;
    this.t = loadTournament();
    const t = this.t;
    let items;
    if (!t) {
      this.subtitle = '4 TEAMS - ROUND ROBIN - FINAL';
      items = [
        choice('DEIN TEAM', 'homeTeam'),
        { label: 'TURNIER STARTEN', color: PAL.yellow, onSelect: () => { newTournament(settings.homeTeam); this.rebuild(); } },
        { label: 'ZURÜCK', onSelect: () => app.pop() },
      ];
    } else {
      advance(t);
      saveTournament(t);
      const next = nextUserGame(t);
      this.subtitle = t.champion ? `MEISTER: ${name(t.champion)}` : next ? (next.round === 'FINAL' ? 'DAS FINALE' : `RUNDE ${next.round} VON 3`) : 'WARTE AUF ERGEBNISSE';
      items = [];
      if (next) {
        const opp = next.home === t.user ? next.away : next.home;
        items.push({ label: `SPIELEN: ${name(t.user)} GEGEN ${name(opp)}`, color: PAL.yellow, onSelect: () => this.play(next) });
      }
      if (t.champion) items.push({ label: 'NEUES TURNIER', color: PAL.yellow, onSelect: () => { clearTournament(); this.rebuild(); } });
      items.push({
        label: 'TURNIER ABBRECHEN',
        value: () => (this.confirmAbandon ? 'NOCHMAL DRÜCKEN' : ''),
        color: PAL.red,
        onSelect: () => {
          if (!this.confirmAbandon) { this.confirmAbandon = true; return; }
          clearTournament();
          this.confirmAbandon = false;
          this.rebuild();
        },
      });
      items.push({ label: 'ZURÜCK', onSelect: () => app.pop() });
    }
    this.menu = new Menu(items, { width: 220, top: t ? 112 : 70 });
  }

  play(game) {
    const t = this.t;
    simulateUpTo(t, game);
    saveTournament(t);
    const userSide = game.home === t.user ? 'home' : 'away';
    this.app.push(new RinkScene(this.app, {
      title: game.round === 'FINAL' ? 'FINALE' : `RUNDE ${game.round}`,
      mode: 'ai',
      teams: { home: game.home, away: game.away },
      humans: [{ controller: 'any', side: userSide }],
      onFinish: (res) => {
        record(t, game, res.score, res.how);
        this.app.popTo((s) => s.isTournament);
      },
    }));
  }

  drawExtra(ctx, W) {
    const t = this.t;
    if (!t) return;
    const rows = standings(t);
    const w = Math.min(W - 16, 280), x = Math.round(W / 2 - w / 2), y = 50;
    panel(ctx, x, y, w, 12 + rows.length * 8, { fill: PAL.ink, border: PAL.slate, alpha: 0.85 });
    const cols = [['SP', 'gp'], ['S', 'w'], ['SV', 'otw'], ['NV', 'otl'], ['N', 'l'], ['TORE', null], ['PKT', 'pts']];
    const right = (i) => x + w - 6 - (cols.length - 1 - i) * Math.floor((w - 70) / cols.length);
    drawText(ctx, 'TEAM', x + 6, y + 3, { color: PAL.mist });
    cols.forEach(([h], i) => drawText(ctx, h, right(i), y + 3, { color: PAL.mist, align: 'right' }));
    rows.forEach((r, j) => {
      const ry = y + 11 + j * 8;
      const me = r.team === t.user;
      drawText(ctx, name(r.team), x + 6, ry, { color: me ? PAL.yellow : PAL.white });
      cols.forEach(([, k], i) => drawText(ctx, k ? String(r[k]) : `${r.gf}:${r.ga}`, right(i), ry, { color: me ? PAL.yellow : PAL.white, align: 'right' }));
    });
    // Latest results
    const done = [...t.games, t.final].filter((g) => g?.played).slice(-2);
    done.forEach((g, i) => {
      const txt = `${name(g.home)} ${g.score.home}-${g.score.away} ${name(g.away)}${g.how ? ' ' + g.how : ''}`;
      drawText(ctx, fitText(txt, W - 16), W / 2, 92 + i * 8, { color: PAL.cloud, align: 'center', shadow: PAL.ink });
    });
    if (t.champion) drawText(ctx, t.champion === t.user ? 'DU HAST DAS TURNIER GEWONNEN!' : `${name(t.champion)} GEWINNEN DAS TURNIER`, W / 2, 168, { color: PAL.yellow, scale: 1, align: 'center', shadow: PAL.ink });
  }
}
