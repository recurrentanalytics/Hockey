// Device list → per-device binding editor.
import { PAL } from '../engine/palette.js';
import { drawText, fitText } from '../engine/font.js';
import { choice, Menu } from '../ui/menu.js';
import { MenuScene } from './menuScene.js';
import { BindingsScene } from './bindings.js';
import { KEYBOARD_PROFILES } from '../input/actions.js';

export class ControlsScene extends MenuScene {
  constructor(app) {
    super(app, { title: 'STEUERUNG', subtitle: 'GERÄT ZUM BELEGEN WÄHLEN', top: 52, width: 240, items: [] });
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
      value: () => (app.input.bindings[p.profileKey] ? 'EIGENE' : p.info?.mode || 'STANDARD'),
      onSelect: () => app.push(new BindingsScene(app, p.profileKey, `PAD ${i + 1}`, p.id)),
    }));
    items.push(choice('TASTEN-BESCHRIFTUNG', 'buttonLabels'));
    items.push(choice('VIBRATION', 'rumble'));
    items.push(choice('MENÜ BESTÄTIGEN', 'padConfirm'));
    items.push({ label: 'ZURÜCK', onSelect: () => app.pop() });
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
    const pads = this.app.input.padControllers();
    if (pads.some((p) => p.info?.family === '8bitdo' || p.info?.family === 'nintendo' || p.info?.family === 'xbox')) {
      drawText(ctx, '8BITDO SN30 PRO MODES: START+X WINDOWS, START+B ANDROID,', W / 2, H - 42, { color: PAL.mist, align: 'center', shadow: PAL.ink });
      drawText(ctx, 'START+A MACOS, START+Y SWITCH. VIBRATION BRAUCHT X-INPUT.', W / 2, H - 34, { color: PAL.mist, align: 'center', shadow: PAL.ink });
    }
    if (!pads.length) {
      // What the browser itself reports, independent of the game's own handling.
      let raw = 'DIESER BROWSER UNTERSTÜTZT KEINE GAMEPADS';
      try {
        if (navigator.getGamepads) {
          const list = [...navigator.getGamepads()].filter(Boolean);
          raw = list.length ? `BROWSER MELDET: ${list.map((g) => g.id).join(' | ')}` : 'BROWSER MELDET: KEIN GAMEPAD (DRÜCK EINE TASTE DARAUF)';
        }
      } catch (e) {
        raw = `GAMEPADS BLOCKIERT: ${e.message}`;
      }
      drawText(ctx, fitText(raw.toUpperCase(), W - 8), W / 2, H - 52, { color: PAL.yellow, align: 'center', shadow: PAL.ink });
      drawText(ctx, 'KEIN GAMEPAD GEFUNDEN. VERBINDE EINS (USB ODER', W / 2, H - 42, { color: PAL.mist, align: 'center', shadow: PAL.ink });
      drawText(ctx, 'BLUETOOTH) UND DRÜCK EINE TASTE DARAUF.', W / 2, H - 34, { color: PAL.mist, align: 'center', shadow: PAL.ink });
    }
  }
}
