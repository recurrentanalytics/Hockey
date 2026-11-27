import { MenuScene } from './menuScene.js';
import { MatchSetupScene } from './matchSetup.js';
import { TwoPlayerScene } from './twoPlayer.js';
import { SettingsScene } from './settingsScene.js';
import { RinkScene } from './rink.js';
import { TournamentScene } from './tournamentScene.js';

export class MainMenuScene extends MenuScene {
  constructor(app) {
    super(app, {
      title: 'BORSTENBOOM!',
      subtitle: 'HAUPTMENÜ',
      top: 64,
      width: 150,
      items: [
        { label: 'GEGEN KI', onSelect: () => app.push(new MatchSetupScene(app)) },
        { label: 'TURNIER', onSelect: () => app.push(new TournamentScene(app)) },
        { label: '2 SPIELER', onSelect: () => app.push(new TwoPlayerScene(app)) },
        { label: 'TRAINING', onSelect: () => app.push(new RinkScene(app, { title: 'TRAINING', mode: 'practice', humans: [{ controller: 'any', side: 'home' }] })) },
        { label: 'EINSTELLUNGEN', onSelect: () => app.push(new SettingsScene(app)) },
      ],
    });
    this.isMainMenu = true;
  }
}
