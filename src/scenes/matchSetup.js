import { PAL } from '../engine/palette.js';
import { drawText } from '../engine/font.js';
import { choice } from '../ui/menu.js';
import { MenuScene } from './menuScene.js';
import { RinkScene } from './rink.js';

export class MatchSetupScene extends MenuScene {
  constructor(app) {
    super(app, {
      title: 'PLAY VS AI',
      subtitle: 'MATCH SETUP',
      width: 210,
      items: [
        choice('RULES', 'ruleset'),
        choice('PERIOD LENGTH', 'periodLength'),
        choice('DIFFICULTY', 'difficulty'),
        { spacer: true },
        {
          label: 'START',
          color: PAL.yellow,
          onSelect: () => app.push(new RinkScene(app, {
            title: 'VS AI PREVIEW',
            mode: 'ai',
            humans: [{ controller: 'any', side: 'home' }],
          })),
        },
        { label: 'BACK', onSelect: () => app.pop() },
      ],
    });
  }

  drawExtra(ctx, W) {
    drawText(ctx, 'AI OPPONENTS AND RULES ARRIVE IN PHASES 3-4.', W / 2, 136, { color: PAL.mist, align: 'center', shadow: PAL.ink });
    drawText(ctx, 'START OPENS SHOOTING PRACTICE FOR NOW.', W / 2, 144, { color: PAL.mist, align: 'center', shadow: PAL.ink });
  }
}
