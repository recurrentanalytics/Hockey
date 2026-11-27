import { PAL } from '../engine/palette.js';
import { dim } from '../engine/draw.js';
import { Menu } from '../ui/menu.js';
import { header, hintBar } from '../ui/hud.js';
import { SettingsScene } from './settingsScene.js';
import { TEAMS } from '../config.js';
import { drawText } from '../engine/font.js';

export class PauseScene {
  constructor(app, under) {
    this.app = app;
    this.under = under;
    this.transparent = true;
    this.menuPad = true;
    const m = under.match;
    const ref = m?.ref;
    const items = [{ label: 'WEITER', onSelect: () => app.pop() }];
    // One time-out item per side with a human player. It is taken at the next stoppage.
    for (const side of [...new Set((m?.humans ?? []).map((h) => h.side))]) {
      if (!ref?.r.timeouts) break;
      const team = TEAMS[m.sides[side].team].name;
      items.push({
        label: `AUSZEIT ${team}`,
        value: () => (ref.timeoutRequest[side] ? 'BEANTRAGT' : `NOCH ${ref.timeoutsLeft[side]}`),
        disabled: () => !ref.timeoutAllowed(side) || ref.timeoutRequest[side],
        onSelect: () => { ref.requestTimeout(side); app.toasts.push('AUSZEIT BEI DER NÄCHSTEN UNTERBRECHUNG'); app.pop(); },
      });
    }
    items.push(
      { label: 'EINSTELLUNGEN', onSelect: () => app.push(new SettingsScene(app)) },
      { label: 'ZUM MENÜ', color: PAL.red, onSelect: () => { app.audio.stopSong(); app.popTo((s) => s.isTournament || s.isMainMenu); } },
    );
    this.menu = new Menu(items, { width: 190, top: 70 });
  }

  update() {
    const { input } = this.app;
    this.menu.update(this.app);
    const resume = input.menu.back || input.controller('any').pressed.pause;
    if (resume) this.app.pop();
  }

  draw() {
    const { display, input } = this.app;
    const ctx = display.uctx;
    dim(ctx, display.width, display.height, 0.6);
    header(ctx, display.width, 'PAUSE');
    this.menu.draw(ctx, display.width);
    const m = this.under.match;
    if (m?.ref) {
      const energy = (side) => {
        const team = m.roster.filter((s) => s.sideKey === side);
        return Math.round(100 * (1 - team.reduce((a, s) => a + (s.fatigue ?? 0), 0) / team.length));
      };
      const text = `KRAFT  ${TEAMS[m.sides.home.team].name} ${energy('home')}%   ${TEAMS[m.sides.away.team].name} ${energy('away')}%`;
      drawText(ctx, text, display.width / 2, 70 + this.menu.items.length * 11 + 8, { color: PAL.cloud, align: 'center', shadow: PAL.ink });
    }
    hintBar(ctx, display.width, display.height, [[input.confirmLabel(), 'AUSWÄHLEN'], [input.backLabel(), 'WEITER']]);
  }
}
