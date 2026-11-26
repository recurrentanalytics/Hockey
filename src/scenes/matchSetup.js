import { PAL } from '../engine/palette.js';
import { drawText, textWidth } from '../engine/font.js';
import { panel } from '../engine/draw.js';
import { choice, avoidSameTeam } from '../ui/menu.js';
import { MenuScene } from './menuScene.js';
import { RinkScene } from './rink.js';

export class MatchSetupScene extends MenuScene {
  constructor(app) {
    super(app, {
      title: 'PLAY VS AI',
      subtitle: 'MATCH SETUP',
      width: 210,
      items: [
        choice('YOUR TEAM', 'homeTeam', () => avoidSameTeam('awayTeam')),
        choice('OPPONENT', 'awayTeam', () => avoidSameTeam('homeTeam')),
        choice('VENUE', 'venue'),
        choice('RULES', 'ruleset'),
        choice('PERIOD LENGTH', 'periodLength'),
        choice('DIFFICULTY', 'difficulty'),
        { spacer: true },
        {
          label: 'START',
          color: PAL.yellow,
          onSelect: () => app.push(new RinkScene(app, {
            title: 'VS AI',
            mode: 'ai',
            humans: [{ controller: 'any', side: 'home' }],
          })),
        },
        { label: 'BACK', onSelect: () => app.pop() },
      ],
    });
  }

  drawExtra(ctx, W) {
    const note = '4 ON 4 WITH GOALIES UNDER THE CHOSEN RULESET';
    const nw = textWidth(note) + 10;
    panel(ctx, Math.round(W / 2 - nw / 2), 167, nw, 11, { fill: PAL.ink, border: null, alpha: 0.7 });
    drawText(ctx, note, W / 2, 170, { color: PAL.cloud, align: 'center' });
  }
}
