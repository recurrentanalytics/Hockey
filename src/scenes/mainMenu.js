import { MenuScene } from './menuScene.js';
import { MatchSetupScene } from './matchSetup.js';
import { TwoPlayerScene } from './twoPlayer.js';
import { SettingsScene } from './settingsScene.js';
import { RinkScene } from './rink.js';
import { TournamentScene } from './tournamentScene.js';

export class MainMenuScene extends MenuScene {
  constructor(app) {
    super(app, {
      title: 'INLINE HOCKEY',
      subtitle: 'MAIN MENU',
      top: 64,
      width: 150,
      items: [
        { label: 'PLAY VS AI', onSelect: () => app.push(new MatchSetupScene(app)) },
        { label: 'TOURNAMENT', onSelect: () => app.push(new TournamentScene(app)) },
        { label: '2 PLAYERS', onSelect: () => app.push(new TwoPlayerScene(app)) },
        { label: 'PRACTICE', onSelect: () => app.push(new RinkScene(app, { title: 'PRACTICE', mode: 'practice', humans: [{ controller: 'any', side: 'home' }] })) },
        { label: 'SETTINGS', onSelect: () => app.push(new SettingsScene(app)) },
      ],
    });
    this.isMainMenu = true;
  }
}
