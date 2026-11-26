import { choice } from '../ui/menu.js';
import { MenuScene } from './menuScene.js';
import { ControlsScene } from './controls.js';
import { toggleFullscreen, isFullscreen, canFullscreen } from '../engine/fullscreen.js';

export class SettingsScene extends MenuScene {
  constructor(app) {
    super(app, {
      title: 'SETTINGS',
      top: 46,
      width: 230,
      items: [
        { label: 'CONTROLS', value: () => '>', onSelect: () => app.push(new ControlsScene(app)) },
        choice('SOUND', 'sound'),
        choice('RULES', 'ruleset'),
        choice('PERIOD LENGTH', 'periodLength'),
        choice('DIFFICULTY', 'difficulty'),
        choice('2P CAMERA', 'twoPlayerCamera'),
        choice('TOUCH CONTROLS', 'touchControls'),
        choice('PIXEL PERFECT', 'pixelPerfect', () => app.display.resize()),
        { label: 'FULLSCREEN', value: () => (!canFullscreen() ? 'N/A' : isFullscreen() ? 'ON' : 'OFF'), disabled: () => !canFullscreen(), onSelect: toggleFullscreen, onLeft: toggleFullscreen, onRight: toggleFullscreen },
        choice('AUTO FULLSCREEN', 'autoFullscreen'),
        { label: 'BACK', onSelect: () => app.pop() },
      ],
    });
  }
}
