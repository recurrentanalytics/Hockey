import { PAL } from '../engine/palette.js';
import { drawText, drawTextOutlined } from '../engine/font.js';
import { MainMenuScene } from './mainMenu.js';

export class TitleScene {
  constructor(app) {
    this.app = app;
    this.t = 0;
    this.menuPad = true;
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
    this.app.backdrop.draw(0.25);
    const ctx = display.uctx, W = display.width, H = display.height;
    // Letters hop one after another.
    const word = (text, y, color, shadow) => {
      const scale = 4, adv = 6 * scale, w = text.length * adv - scale;
      let x = Math.round(W / 2 - w / 2);
      [...text].forEach((ch, i) => {
        const hop = Math.round(Math.max(0, Math.sin(this.t * 3 - i * 0.5)) * 3);
        drawTextOutlined(ctx, ch, x, y - hop, { color, scale, shadow, big: true });
        x += adv;
      });
    };
    word('BORSTEN', 30, PAL.white, PAL.slate);
    word('BOOM!', 70, PAL.red, PAL.redDark);
    // Taglines, including the Boni Borstentiere's own
    const lines = ['EIN INLINEHOCKEY-ABENTEUER', 'DER BONI BORSTENTIERE', 'WAS SIND WIR? EIN BORSTENTIER!', 'HAARE OPTIONAL', 'ZUSAMMEN SIND WIR STARK!', 'MIT BONNY AUS DER EILENRIEDE'];
    drawTextOutlined(ctx, lines[Math.floor(this.t / 3) % lines.length], W / 2, 112, { color: PAL.pink, align: 'center' });
    if (Math.floor(this.t * 2) % 2 === 0) {
      const prompt = input.lastKind === 'touch' || input.pointers.touchSeen ? 'TIPPEN ZUM STARTEN' : 'DRÜCK START';
      drawTextOutlined(ctx, prompt, W / 2, 146, { color: PAL.white, scale: 2, align: 'center', big: true });
    }
  }
}
