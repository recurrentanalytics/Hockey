import { MenuScene } from './menuScene.js';
import { MatchSetupScene } from './matchSetup.js';
import { TwoPlayerScene } from './twoPlayer.js';
import { SettingsScene } from './settingsScene.js';
import { RinkScene } from './rink.js';

export class MainMenuScene extends MenuScene {
  constructor(app) {
    super(app, {
      title: 'INLINE HOCKEY',
      subtitle: 'MAIN MENU',
      top: 64,
      width: 150,
      items: [
        { label: 'PLAY VS AI', onSelect: () => app.push(new MatchSetupScene(app)) },
        { label: '2 PLAYERS', onSelect: () => app.push(new TwoPlayerScene(app)) },
        { label: 'FREE SKATE', onSelect: () => app.push(new RinkScene(app, { title: 'FREE SKATE', players: [{ controller: 'any', team: 'blazers', tag: 'P1' }], camera: 'single' })) },
        { label: 'SETTINGS', onSelect: () => app.push(new SettingsScene(app)) },
      ],
    });
    this.isMainMenu = true;
  }
}
