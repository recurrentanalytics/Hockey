// Device list → per-device binding editor.
import { PAL } from '../engine/palette.js';
import { drawText } from '../engine/font.js';
import { choice, Menu } from '../ui/menu.js';
import { MenuScene } from './menuScene.js';
import { BindingsScene } from './bindings.js';
import { KEYBOARD_PROFILES } from '../input/actions.js';

export class ControlsScene extends MenuScene {
  constructor(app) {
    super(app, { title: 'CONTROLS', subtitle: 'PICK A DEVICE TO REMAP', top: 52, width: 240, items: [] });
    this.padKey = '';
    this.rebuild();
  }

  rebuild() {
    const { app } = this;
    const pads = app.input.padControllers();
    this.padKey = pads.map((p) => p.id + p.gpId).join('|');
    const items = KEYBOARD_PROFILES.map((k) => ({
      label: k.name,
      value: () => app.input.moveLabel(k.key),
      onSelect: () => app.push(new BindingsScene(app, k.key, k.name, k.key)),
    }));
    pads.forEach((p, i) => items.push({
      label: `PAD ${i + 1}: ${p.name}`,
      value: () => (p.profileKey === 'pad' ? 'STANDARD' : 'CUSTOM'),
      onSelect: () => app.push(new BindingsScene(app, p.profileKey, `PAD ${i + 1}`, p.id)),
    }));
    items.push(choice('BUTTON LABELS', 'buttonLabels'));
    items.push(choice('MENU CONFIRM', 'confirmButton'));
    items.push({ label: 'BACK', onSelect: () => app.pop() });
    const index = Math.min(this.menu.index, items.length - 1);
    this.menu = new Menu(items, { width: 240, top: 52 });
    this.menu.index = index;
  }

  update(dt) {
    const key = this.app.input.padControllers().map((p) => p.id + p.gpId).join('|');
    if (key !== this.padKey) this.rebuild();
    super.update(dt);
  }

  drawExtra(ctx, W, H) {
    if (!this.app.input.padControllers().length) {
      drawText(ctx, 'NO GAMEPAD FOUND. CONNECT ONE (USB OR', W / 2, H - 42, { color: PAL.mist, align: 'center', shadow: PAL.ink });
      drawText(ctx, 'BLUETOOTH) AND PRESS ANY BUTTON ON IT.', W / 2, H - 34, { color: PAL.mist, align: 'center', shadow: PAL.ink });
    }
  }
}
