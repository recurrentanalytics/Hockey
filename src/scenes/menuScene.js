// Base for full-screen menus over the animated backdrop.
import { Menu } from '../ui/menu.js';
import { header, hintBar } from '../ui/hud.js';

export class MenuScene {
  constructor(app, { title, subtitle = null, items, width = 200, top = 56 }) {
    this.app = app;
    this.title = title;
    this.subtitle = subtitle;
    this.menu = new Menu(items, { width, top });
  }

  update(dt) {
    this.app.backdrop.update(dt);
    this.menu.update(this.app);
    if (this.app.input.menu.back) this.back();
  }

  back() {
    this.app.pop();
  }

  draw() {
    const { display, input } = this.app;
    this.app.backdrop.draw();
    const ctx = display.uctx;
    header(ctx, display.width, this.title, this.subtitle);
    this.menu.draw(ctx, display.width);
    this.drawExtra?.(ctx, display.width, display.height);
    hintBar(ctx, display.width, display.height, [[input.confirmLabel(), 'SELECT'], [input.backLabel(), 'BACK']]);
  }
}
