import { PAL } from '../engine/palette.js';
import { drawText } from '../engine/font.js';
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
    drawText(ctx, '4 ON 4 WITH GOALIES UNDER THE CHOSEN RULESET', W / 2, 170, { color: PAL.mist, align: 'center', shadow: PAL.ink });
  }
}
