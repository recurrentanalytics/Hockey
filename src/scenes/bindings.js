// Remap one device profile. Rows light up live while the matching input is held,
// so it doubles as a controller tester.
import { PAL } from '../engine/palette.js';
import { drawText, fitText } from '../engine/font.js';
import { panel } from '../engine/draw.js';
import { Menu } from '../ui/menu.js';
import { header, hintBar } from '../ui/hud.js';
import { BACK_BUTTON, hit, drawBackButton } from '../ui/corner.js';
import { ACTIONS } from '../input/actions.js';
import { PadSetupScene } from './padSetup.js';

export class BindingsScene {
  constructor(app, profileKey, title, controllerId) {
    this.app = app;
    this.menuPad = true;
    this.profileKey = profileKey;
    this.title = title;
    this.controllerId = controllerId;
    this.capturing = null;
    const input = app.input;
    const items = ACTIONS.map((a) => ({
      label: a.label,
      action: a.id,
      value: () => (this.capturing === a.id
        ? '...'
        : input.profile(profileKey)[a.id].map((b) => input.bindingLabel(profileKey, b)).join(' / ')),
      onSelect: () => this.capture(a),
    }));
    if (profileKey.startsWith('pad')) {
      items.unshift({
        label: 'GUIDED SETUP',
        value: () => 'RECOMMENDED',
        color: PAL.yellow,
        onSelect: () => { const pad = this.device(); if (pad?.connected) app.push(new PadSetupScene(app, pad)); else app.toasts.push('CONNECT THE PAD FIRST'); },
      });
    }
    items.push({ label: 'RESET TO DEFAULTS', onSelect: () => { input.resetProfile(profileKey); app.toasts.push('DEFAULTS RESTORED'); } });
    items.push({ label: 'BACK', onSelect: () => app.pop() });
    this.menu = new Menu(items, { width: 250, top: profileKey.startsWith('pad') ? 44 : 46 });
  }

  capture(action) {
    this.capturing = action.id;
    this.captureLabel = action.label;
    this.app.input.startCapture(this.profileKey, (binding) => {
      if (binding) {
        this.app.input.setBinding(this.profileKey, action.id, binding);
        this.app.toasts.push(`${action.label} = ${this.app.input.bindingLabel(this.profileKey, binding)}`);
      }
      this.capturing = null;
    });
  }

  device() {
    const { input } = this.app;
    const c = input.controller(this.controllerId);
    if (c?.connected) return c;
    return input.padControllers().find((p) => p.profileKey === this.profileKey) ?? c;
  }

  update(dt) {
    this.app.backdrop.update(dt);
    const { input } = this.app;
    if (input.capturing) {
      if (input.pointers.taps.length) input.finishCapture(null);
      return;
    }
    if (input.pointers.touchSeen && input.taps.some((t) => hit(BACK_BUTTON, t))) return this.app.pop();
    this.menu.update(this.app);
    if (input.menu.back) this.app.pop();
  }

  draw() {
    const { display, input } = this.app;
    this.app.backdrop.draw(0.7);
    const ctx = display.uctx, W = display.width, H = display.height;
    header(ctx, W, this.title, 'SELECT AN ACTION, THEN PRESS THE NEW INPUT');
    this.menu.draw(ctx, W);
    if (input.pointers.touchSeen) drawBackButton(ctx);

    // Live input test
    const dev = this.device();
    this.menu.items.forEach((it, i) => {
      if (!it.action || !dev?.down[it.action]) return;
      const r = this.menu.rect(i, W);
      ctx.fillStyle = PAL.green;
      ctx.fillRect(r.x - 5, r.y + 2, 3, 5);
    });
    if (dev?.kind === 'gamepad') {
      const pressed = dev.buttons.map((v, i) => (v > 0.5 ? `B${i}` : null)).filter(Boolean).join(' ') || '-';
      const axes = dev.axes.map((v, i) => (Math.abs(v) > 0.3 ? `A${i}${v > 0 ? '+' : '-'}` : null)).filter(Boolean).join(' ') || '-';
      drawText(ctx, fitText(`RAW: ${pressed}  AXES: ${axes}`, W - 8), W / 2, H - 22, { color: PAL.mist, align: 'center', shadow: PAL.ink });
    } else if (this.profileKey.startsWith('pad')) {
      drawText(ctx, 'PAD NOT CONNECTED', W / 2, H - 22, { color: PAL.red, align: 'center', shadow: PAL.ink });
    }

    if (input.capturing && this.capturing) {
      const isKb = this.profileKey.startsWith('kb');
      const w = 220, h = 40, x = Math.round(W / 2 - w / 2), y = Math.round(H / 2 - h / 2);
      panel(ctx, x, y, w, h, { fill: PAL.ink, border: PAL.yellow, alpha: 0.95 });
      drawText(ctx, `${this.captureLabel}`, W / 2, y + 8, { color: PAL.yellow, align: 'center' });
      drawText(ctx, isKb ? 'PRESS A KEY' : 'PRESS A BUTTON OR MOVE A STICK', W / 2, y + 18, { color: PAL.white, align: 'center' });
      drawText(ctx, 'ESC OR TAP TO CANCEL', W / 2, y + 28, { color: PAL.mist, align: 'center' });
    } else {
      hintBar(ctx, W, H, [[input.confirmLabel(), 'REMAP'], [input.backLabel(), 'BACK']]);
    }
  }
}
