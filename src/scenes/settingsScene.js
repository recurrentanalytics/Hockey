import { choice } from '../ui/menu.js';
import { MenuScene } from './menuScene.js';
import { ControlsScene } from './controls.js';
import { toggleFullscreen, isFullscreen, canFullscreen } from '../engine/fullscreen.js';
import { FIXED } from '../world/projection.js';

export class SettingsScene extends MenuScene {
  constructor(app) {
    super(app, {
      title: 'EINSTELLUNGEN',
      top: 46,
      width: 230,
      items: [
        { label: 'STEUERUNG', value: () => '>', onSelect: () => app.push(new ControlsScene(app)) },
        choice('TON', 'sound'),
        ...(FIXED ? [] : [choice('SPIELORT', 'venue')]),
        choice('REGELN', 'ruleset'),
        choice('BALL ODER PUCK', 'gameBall'),
        choice('SPIELZEIT', 'periodLength'),
        choice('SCHWIERIGKEIT', 'difficulty'),
        choice('TOR-WIEDERHOLUNG', 'replays'),
        choice('2P-KAMERA', 'twoPlayerCamera'),
        choice('TOUCH-STEUERUNG', 'touchControls'),
        choice('PIXELGENAU', 'pixelPerfect', () => app.display.resize()),
        { label: 'VOLLBILD', value: () => (!canFullscreen() ? '-' : isFullscreen() ? 'AN' : 'AUS'), disabled: () => !canFullscreen(), onSelect: toggleFullscreen, onLeft: toggleFullscreen, onRight: toggleFullscreen },
        choice('AUTO-VOLLBILD', 'autoFullscreen'),
        { label: 'ZURÜCK', onSelect: () => app.pop() },
      ],
    });
  }
}
