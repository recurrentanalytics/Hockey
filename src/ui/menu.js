// Vertical menu: keyboard/gamepad navigation plus tap/click support.
import { PAL } from '../engine/palette.js';
import { drawText, textWidth, fitText } from '../engine/font.js';
import { panel } from '../engine/draw.js';
import { settings, saveSettings, OPTIONS } from '../settings.js';

const ROW_H = 11;

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

/** After changing one team, make sure the other side isn't the same team. */
export function avoidSameTeam(otherKey) {
  const key = otherKey === 'awayTeam' ? 'homeTeam' : 'awayTeam';
  if (settings[key] !== settings[otherKey]) return;
  const opts = OPTIONS[otherKey];
  const i = opts.findIndex((o) => o.value === settings[otherKey]);
  settings[otherKey] = opts[(i + 1) % opts.length].value;
  saveSettings();
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
    if (m.up) { this.moveBy(-1); app.audio?.play('menu'); }
    if (m.down) { this.moveBy(1); app.audio?.play('menu'); }
    this.ensureEnabled(1);
    const it = this.items[this.index];
    if (it && this.enabled(this.index)) {
      if (m.left && it.onLeft) { it.onLeft(); app.audio?.play('menu'); }
      if (m.right && it.onRight) { it.onRight(); app.audio?.play('menu'); }
      if (m.confirm && it.onSelect) { app.audio?.play('confirm'); it.onSelect(); }
    }
    for (const t of app.input.taps) {
      for (let i = 0; i < this.items.length; i++) {
        const r = this.rect(i, app.display.width);
        if (t.x < r.x || t.x >= r.x + r.w || t.y < r.y || t.y >= r.y + r.h + 1 || !this.enabled(i)) continue;
        this.index = i;
        const item = this.items[i];
        app.audio?.play('confirm');
        if (item.isChoice) (t.x < r.x + r.w / 2 ? item.onLeft : item.onRight)?.();
        else item.onSelect?.();
      }
    }
  }

  draw(ctx, W) {
    // A soft dark card behind the list keeps it readable over the moving rink.
    const shown = this.items.map((it, i) => (it.spacer ? null : this.rect(i, W))).filter(Boolean);
    if (shown.length) {
      const a = shown[0], z = shown[shown.length - 1];
      panel(ctx, a.x - 5, a.y - 5, a.w + 10, z.y + z.h - a.y + 10, { fill: PAL.ink, border: null, alpha: 0.55 });
    }
    this.items.forEach((it, i) => {
      if (it.spacer) return;
      const r = this.rect(i, W);
      const sel = i === this.index;
      const off = it.disabled?.();
      if (sel) {
        panel(ctx, r.x, r.y - 1, r.w, r.h + 2, { fill: PAL.slate, border: PAL.yellow, alpha: 0.95 });
        ctx.fillStyle = PAL.yellow;
        ctx.fillRect(r.x + 2, r.y + 2, 2, r.h - 4);
      }
      const color = off ? PAL.steel : sel ? PAL.yellow : it.color ?? PAL.white;
      const value = it.value?.();
      const big = { big: true };
      const labelMax = value ? r.w - 14 - textWidth(value, 1, true) - 14 : r.w - 14;
      drawText(ctx, fitText(it.label, labelMax, 1, true), r.x + 7, r.y + 2, { color, shadow: PAL.ink, ...big });
      if (value != null) {
        const vx = r.x + r.w - 6;
        const vcolor = off ? PAL.steel : sel ? PAL.white : PAL.cloud;
        if (sel && it.isChoice) {
          drawText(ctx, '>', vx, r.y + 2, { color: PAL.yellow, align: 'right', ...big });
          const w = drawText(ctx, value, vx - 8, r.y + 2, { color: vcolor, align: 'right', shadow: PAL.ink, ...big });
          drawText(ctx, '<', vx - 14 - w, r.y + 2, { color: PAL.yellow, align: 'right', ...big });
        } else {
          drawText(ctx, value, vx, r.y + 2, { color: vcolor, align: 'right', shadow: PAL.ink, ...big });
        }
      }
    });
  }
}
