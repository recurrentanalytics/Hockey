import { PAL } from '../engine/palette.js';
import { drawText, textWidth } from '../engine/font.js';
import { panel } from '../engine/draw.js';
import { choice, avoidSameTeam } from '../ui/menu.js';
import { MenuScene } from './menuScene.js';
import { RinkScene } from './rink.js';
import { FIXED } from '../world/projection.js';

export class MatchSetupScene extends MenuScene {
  constructor(app) {
    super(app, {
      title: 'GEGEN KI',
      subtitle: 'SPIEL EINRICHTEN',
      width: 210,
      items: [
        choice('DEIN TEAM', 'homeTeam', () => avoidSameTeam('awayTeam')),
        choice('GEGNER', 'awayTeam', () => avoidSameTeam('homeTeam')),
        ...(FIXED ? [] : [choice('SPIELORT', 'venue')]), // the real Boni court has no other venue
        choice('REGELN', 'ruleset'),
        choice('SPIELZEIT', 'periodLength'),
        choice('SCHWIERIGKEIT', 'difficulty'),
        { spacer: true },
        {
          label: 'LOS GEHTS',
          color: PAL.yellow,
          onSelect: () => app.push(new RinkScene(app, {
            title: 'GEGEN KI',
            mode: 'ai',
            humans: [{ controller: 'any', side: 'home' }],
          })),
        },
        { label: 'ZURÜCK', onSelect: () => app.pop() },
      ],
    });
  }

  drawExtra(ctx, W) {
    const note = '4 GEGEN 4 MIT TORHÜTERN NACH DEN GEWÄHLTEN REGELN';
    const nw = textWidth(note) + 10;
    panel(ctx, Math.round(W / 2 - nw / 2), 167, nw, 11, { fill: PAL.ink, border: null, alpha: 0.7 });
    drawText(ctx, note, W / 2, 170, { color: PAL.cloud, align: 'center' });
  }
}
