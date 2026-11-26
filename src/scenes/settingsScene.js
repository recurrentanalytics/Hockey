import { choice } from '../ui/menu.js';
import { MenuScene } from './menuScene.js';
import { ControlsScene } from './controls.js';

function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.({ navigationUI: 'hide' })?.catch(() => {});
  } catch {
    /* not supported (e.g. iPhone Safari) */
  }
}

export class SettingsScene extends MenuScene {
  constructor(app) {
    super(app, {
      title: 'SETTINGS',
      top: 50,
      width: 230,
      items: [
        { label: 'CONTROLS', value: () => '>', onSelect: () => app.push(new ControlsScene(app)) },
        choice('RULES', 'ruleset'),
        choice('PERIOD LENGTH', 'periodLength'),
        choice('DIFFICULTY', 'difficulty'),
        choice('2P CAMERA', 'twoPlayerCamera'),
        choice('TOUCH CONTROLS', 'touchControls'),
        choice('PIXEL PERFECT', 'pixelPerfect', () => app.display.resize()),
        { label: 'FULLSCREEN', value: () => (document.fullscreenElement ? 'ON' : 'OFF'), onSelect: toggleFullscreen, onLeft: toggleFullscreen, onRight: toggleFullscreen },
        { label: 'BACK', onSelect: () => app.pop() },
      ],
    });
  }
}
