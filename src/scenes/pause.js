import { PAL } from '../engine/palette.js';
import { dim } from '../engine/draw.js';
import { Menu } from '../ui/menu.js';
import { header, hintBar } from '../ui/hud.js';
import { SettingsScene } from './settingsScene.js';

export class PauseScene {
  constructor(app, under) {
    this.app = app;
    this.under = under;
    this.transparent = true;
    this.menuPad = true;
    this.menu = new Menu([
      { label: 'RESUME', onSelect: () => app.pop() },
      { label: 'SETTINGS', onSelect: () => app.push(new SettingsScene(app)) },
      { label: 'QUIT TO MENU', color: PAL.red, onSelect: () => app.popTo((s) => s.isMainMenu) },
    ], { width: 140, top: 80 });
  }

  update() {
    const { input } = this.app;
    this.menu.update(this.app);
    const resume = input.menu.back || input.controller('any').pressed.pause;
    if (resume) this.app.pop();
  }

  draw() {
    const { display, input } = this.app;
    const ctx = display.uctx;
    dim(ctx, display.width, display.height, 0.6);
    header(ctx, display.width, 'PAUSED');
    this.menu.draw(ctx, display.width);
    hintBar(ctx, display.width, display.height, [[input.confirmLabel(), 'SELECT'], [input.backLabel(), 'RESUME']]);
  }
}
