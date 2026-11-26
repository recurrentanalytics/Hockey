// Vertical menu: keyboard/gamepad navigation plus tap/click support.
import { PAL } from '../engine/palette.js';
import { drawText, textWidth, fitText } from '../engine/font.js';
import { settings, saveSettings, OPTIONS } from '../settings.js';

const ROW_H = 10;

/** A menu row that cycles through one of the OPTIONS lists in settings. */
export function choice(label, key, onChange) {
  const opts = OPTIONS[key];
  const step = (d) => {
    const i = opts.findIndex((o) => o.value === settings[key]);
    settings[key] = opts[(i + d + opts.length) % opts.length].value;
    saveSettings();
    onChange?.(settings[key]);
  };
  return {
    label,
    value: () => opts.find((o) => o.value === settings[key])?.label ?? '',
    onLeft: () => step(-1),
    onRight: () => step(1),
    onSelect: () => step(1),
    isChoice: true,
  };
}

export class Menu {
  /**
   * items: { label, value?(): string, onSelect?, onLeft?, onRight?, disabled?(): bool, color? }
   */
  constructor(items, { width = 200, top = 70 } = {}) {
    this.items = items;
    this.width = width;
    this.top = top;
    this.index = 0;
    this.ensureEnabled(1);
  }

  enabled(i) {
    const it = this.items[i];
    return it && !it.disabled?.() && !it.spacer;
  }

  ensureEnabled(dir) {
    for (let n = 0; n < this.items.length && !this.enabled(this.index); n++) {
      this.index = (this.index + dir + this.items.length) % this.items.length;
    }
  }

  moveBy(dir) {
    for (let n = 0; n < this.items.length; n++) {
      this.index = (this.index + dir + this.items.length) % this.items.length;
      if (this.enabled(this.index)) return;
    }
  }

  rect(i, W) {
    const x = Math.round((W - this.width) / 2);
    return { x, y: this.top + i * ROW_H, w: this.width, h: ROW_H - 1 };
  }

  update(app) {
    const m = app.input.menu;
    if (m.up) this.moveBy(-1);
    if (m.down) this.moveBy(1);
    this.ensureEnabled(1);
    const it = this.items[this.index];
    if (it && this.enabled(this.index)) {
      if (m.left) it.onLeft?.();
      if (m.right) it.onRight?.();
      if (m.confirm) it.onSelect?.();
    }
    for (const t of app.input.taps) {
      for (let i = 0; i < this.items.length; i++) {
        const r = this.rect(i, app.display.width);
        if (t.x < r.x || t.x >= r.x + r.w || t.y < r.y || t.y >= r.y + r.h + 1 || !this.enabled(i)) continue;
        this.index = i;
        const item = this.items[i];
        if (item.isChoice) (t.x < r.x + r.w / 2 ? item.onLeft : item.onRight)?.();
        else item.onSelect?.();
      }
    }
  }

  draw(ctx, W) {
    this.items.forEach((it, i) => {
      if (it.spacer) return;
      const r = this.rect(i, W);
      const sel = i === this.index;
      const off = it.disabled?.();
      if (sel) {
        ctx.fillStyle = PAL.slate;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        ctx.fillStyle = PAL.yellow;
        ctx.fillRect(r.x, r.y, 2, r.h);
      }
      const color = off ? PAL.steel : sel ? PAL.yellow : it.color ?? PAL.white;
      const value = it.value?.();
      const labelMax = value ? r.w - 14 - textWidth(value) - 12 : r.w - 14;
      drawText(ctx, fitText(it.label, labelMax), r.x + 6, r.y + 2, { color, shadow: PAL.ink });
      if (value != null) {
        const vx = r.x + r.w - 6;
        const vcolor = off ? PAL.steel : sel ? PAL.white : PAL.cloud;
        if (sel && it.isChoice) {
          drawText(ctx, '>', vx, r.y + 2, { color: PAL.yellow, align: 'right' });
          const w = drawText(ctx, value, vx - 6, r.y + 2, { color: vcolor, align: 'right', shadow: PAL.ink });
          drawText(ctx, '<', vx - 10 - w, r.y + 2, { color: PAL.yellow, align: 'right' });
        } else {
          drawText(ctx, value, vx, r.y + 2, { color: vcolor, align: 'right', shadow: PAL.ink });
        }
      }
    });
  }
}
