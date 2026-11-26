import { PAL } from '../engine/palette.js';
import { drawText } from '../engine/font.js';
import { MainMenuScene } from './mainMenu.js';

export class TitleScene {
  constructor(app) {
    this.app = app;
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    this.app.backdrop.update(dt);
    const { input } = this.app;
    if (this.t > 0.3 && (input.anyPressed || input.menu.confirm || input.taps.length)) {
      this.app.push(new MainMenuScene(this.app));
    }
  }

  resume() {
    this.t = 0;
  }

  draw() {
    const { display, input } = this.app;
    this.app.backdrop.draw(0.45);
    const ctx = display.uctx, W = display.width, H = display.height;
    const bob = Math.round(Math.sin(this.t * 2) * 1);
    drawText(ctx, 'INLINE', W / 2, 46 + bob, { color: PAL.white, scale: 5, align: 'center', shadow: PAL.ink });
    drawText(ctx, 'HOCKEY', W / 2 + 2, 80 + bob, { color: PAL.redDark, scale: 5, align: 'center' });
    drawText(ctx, 'HOCKEY', W / 2, 78 + bob, { color: PAL.yellow, scale: 5, align: 'center' });
    drawText(ctx, '4 ON 4 ROLLER HOCKEY', W / 2, 112, { color: PAL.cloud, align: 'center', shadow: PAL.ink });
    if (Math.floor(this.t * 2) % 2 === 0) {
      const prompt = input.lastKind === 'touch' || input.pointers.touchSeen ? 'TAP TO START' : 'PRESS START';
      drawText(ctx, prompt, W / 2, 150, { color: PAL.white, scale: 2, align: 'center', shadow: PAL.ink });
    }
    drawText(ctx, 'PHASE 1 PREVIEW', 4, H - 9, { color: PAL.steel });
  }
}
