// Local 2-player lobby: each player joins with their own device.
import { PAL, } from '../engine/palette.js';
import { drawText, fitText } from '../engine/font.js';
import { panel } from '../engine/draw.js';
import { choice, avoidSameTeam } from '../ui/menu.js';
import { settings } from '../settings.js';
import { PLAYER_COLORS } from '../config.js';
import { MenuScene } from './menuScene.js';
import { RinkScene } from './rink.js';

export class TwoPlayerScene extends MenuScene {
  constructor(app) {
    super(app, {
      title: '2 PLAYERS',
      subtitle: 'EACH PLAYER JOINS WITH THEIR OWN DEVICE',
      top: 104,
      width: 210,
      items: [
        choice('MODE', 'twoPlayerMode'),
        choice('HOME TEAM', 'homeTeam', () => avoidSameTeam('awayTeam')),
        choice('AWAY TEAM', 'awayTeam', () => avoidSameTeam('homeTeam')),
        choice('CAMERA', 'twoPlayerCamera'),
        { label: 'START', color: PAL.yellow, disabled: () => this.slots.some((s) => !s), onSelect: () => this.start() },
        { label: 'BACK', onSelect: () => app.pop() },
      ],
    });
    this.slots = [null, null];
  }

  joinable() {
    const { input } = this.app;
    return [input.controller('kb1'), input.controller('kb2'), ...input.padControllers()];
  }

  update(dt) {
    const { input } = this.app;
    let acted = false;
    for (const c of this.joinable()) {
      const slot = this.slots.indexOf(c.id);
      if (c.pressed.shoot && slot < 0) {
        const free = this.slots.indexOf(null);
        if (free >= 0) { this.slots[free] = c.id; acted = true; }
      } else if (c.pressed.check && slot >= 0) {
        this.slots[slot] = null;
        acted = true;
      }
      if (c.pressed.shoot || c.pressed.check) acted = true;
    }
    // On 8BitDo pads SHOOT is B, which is also "back" in menus: a join/leave press isn't a menu press.
    if (acted) { input.menu.back = false; input.menu.confirm = false; }
    // Drop players whose gamepad went away.
    this.slots = this.slots.map((id) => (id && input.controller(id)?.connected === false ? null : id));
    // Touch players join by tapping a slot.
    for (const t of input.taps) {
      const i = this.slotAt(t.x, t.y);
      if (i < 0 || t.type !== 'touch') continue;
      if (this.slots[i] === 'touch') this.slots[i] = null;
      else if (!this.slots.includes('touch') && !this.slots[i]) this.slots[i] = 'touch';
    }
    super.update(dt);
  }

  slotRects() {
    const W = this.app.display.width;
    const w = Math.min(130, Math.floor((W - 24) / 2));
    return [0, 1].map((i) => ({ x: Math.round(W / 2 - w - 4 + i * (w + 8)), y: 52, w, h: 44 }));
  }

  slotAt(x, y) {
    return this.slotRects().findIndex((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  }

  start() {
    const versus = settings.twoPlayerMode === 'versus';
    this.app.push(new RinkScene(this.app, {
      title: versus ? '2P VERSUS' : '2P CO-OP',
      mode: versus ? 'versus' : 'coop',
      camera: settings.twoPlayerCamera,
      humans: [
        { controller: this.slots[0], side: 'home' },
        { controller: this.slots[1], side: versus ? 'away' : 'home' },
      ],
    }));
  }

  drawExtra(ctx) {
    const { input } = this.app;
    this.slotRects().forEach((r, i) => {
      const id = this.slots[i];
      const color = PLAYER_COLORS[i];
      panel(ctx, r.x, r.y, r.w, r.h, { fill: PAL.ink, border: id ? color : PAL.steel, alpha: 0.85 });
      drawText(ctx, `P${i + 1}`, r.x + 6, r.y + 6, { color, scale: 2 });
      if (id) {
        const c = input.controller(id);
        drawText(ctx, fitText(c.name, r.w - 12), r.x + 6, r.y + 22, { color: PAL.white });
        drawText(ctx, 'READY', r.x + 6, r.y + 32, { color: PAL.green });
      } else {
        drawText(ctx, 'PRESS SHOOT', r.x + 6, r.y + 22, { color: PAL.cloud });
        drawText(ctx, 'TO JOIN', r.x + 6, r.y + 30, { color: PAL.cloud });
      }
    });
    const pad = input.padControllers()[0];
    const padShoot = pad ? input.bindingLabel(pad.profileKey, input.profile(pad.profileKey).shoot[0]) : 'X';
    const kb1 = input.bindingLabel('kb1', input.profile('kb1').shoot[0]);
    const kb2 = input.bindingLabel('kb2', input.profile('kb2').shoot[0]);
    const W = this.app.display.width;
    drawText(ctx, `SHOOT: ${kb1} / ${kb2} / PAD ${padShoot}  -  CHECK TO LEAVE`, W / 2, 98 - 0, { color: PAL.mist, align: 'center', shadow: PAL.ink });
    if (input.pointers.touchSeen) drawText(ctx, 'TOUCH: TAP A SLOT', W / 2, 174, { color: PAL.mist, align: 'center', shadow: PAL.ink });
  }
}
