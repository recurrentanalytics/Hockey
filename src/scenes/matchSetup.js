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
            players: [{ controller: 'any', team: 'blazers', tag: 'P1' }],
            camera: 'single',
          })),
        },
        { label: 'BACK', onSelect: () => app.pop() },
      ],
    });
  }

  drawExtra(ctx, W) {
    drawText(ctx, 'OPPONENTS, PUCK AND RULES ARRIVE IN PHASES 2-4.', W / 2, 136, { color: PAL.mist, align: 'center', shadow: PAL.ink });
    drawText(ctx, 'START OPENS THE RINK IN FREE SKATE FOR NOW.', W / 2, 144, { color: PAL.mist, align: 'center', shadow: PAL.ink });
  }
}
