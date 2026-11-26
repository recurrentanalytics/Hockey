// Turns raw devices into "controllers" with a common shape:
//   controller.move            {x, y} in [-1, 1]
//   controller.down[action]    held this step
//   controller.pressed[action] went down this step
//   controller.released[action]
// Controllers: kb1, kb2 (two keyboard layouts), pad0..padN, touch, and `any`
// (everything merged, used for single-player and menus).
import { Keyboard } from './keyboard.js';
import { Pointers } from './pointers.js';
import { TouchController } from './touch.js';
import { MenuPad } from './menuPad.js';
import { ACTION_IDS, defaultProfile } from './actions.js';
import { identify, LAYOUTS, actionsFor, PRINTED, hatValue } from './pads.js';
import { keyLabel, padBindingLabel, detectPadStyle, padName } from './labels.js';
import { load, save } from '../engine/storage.js';
import { settings } from '../settings.js';

const DEADZONE = 0.22;
const DIRS = ['up', 'down', 'left', 'right'];
const REPEAT_DELAY = 0.38;
const REPEAT_RATE = 0.11;

const blank = () => Object.fromEntries(ACTION_IDS.map((a) => [a, false]));

class Controller {
  constructor(id, kind, name, profileKey) {
    this.id = id;
    this.kind = kind;
    this.name = name;
    this.profileKey = profileKey;
    this.connected = true;
    this.move = { x: 0, y: 0 };
    this.down = blank();
    this.pressed = blank();
    this.released = blank();
    this.buttons = [];
    this.axes = [];
    this.prevButtons = [];
    this.prevAxes = [];
  }

  apply(down, move) {
    for (const a of ACTION_IDS) {
      const now = !!down[a], was = this.down[a];
      this.pressed[a] = now && !was;
      this.released[a] = !now && was;
      this.down[a] = now;
    }
    this.move = move;
  }

  get anyPressed() {
    return ACTION_IDS.some((a) => this.pressed[a]);
  }

  buttonEdge(i) {
    return (this.buttons[i] ?? 0) > 0.5 && (this.prevButtons[i] ?? 0) <= 0.5;
  }
}

function axisValue(v) {
  v = Math.max(0, v);
  return v < DEADZONE ? 0 : Math.min(1, (v - DEADZONE) / (1 - DEADZONE));
}

function bindingValue(c, binding) {
  if (binding.startsWith('b:')) return c.buttons[+binding.slice(2)] ?? 0;
  if (binding.startsWith('h:')) return hatValue(c.axes, binding);
  const m = /^a:(\d+)([+-])$/.exec(binding);
  if (!m) return 0;
  const v = c.axes[+m[1]] ?? 0;
  return axisValue(m[2] === '+' ? v : -v);
}

function moveFrom(val) {
  let x = val('right') - val('left'), y = val('down') - val('up');
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y };
}

export class InputManager {
  constructor(display, canvas) {
    this.display = display;
    this.keyboard = new Keyboard();
    this.pointers = new Pointers(canvas, display);
    this.touch = new TouchController();
    this.padInfo = new Map(); // profile key → identify() result
    this.menuPad = new MenuPad();
    this.bindings = load('bindings', {});
    this.controllers = new Map([
      ['kb1', new Controller('kb1', 'keyboard', 'KEYBOARD 1', 'kb1')],
      ['kb2', new Controller('kb2', 'keyboard', 'KEYBOARD 2', 'kb2')],
      ['touch', new Controller('touch', 'touch', 'TOUCH', 'touch')],
      ['any', new Controller('any', 'any', 'ANY DEVICE', 'any')],
    ]);
    this.lastKind = 'keyboard';
    this.lastId = 'kb1';
    this.menu = { up: false, down: false, left: false, right: false, confirm: false, back: false };
    this.nav = Object.fromEntries(DIRS.map((d) => [d, { held: false, t: 0 }]));
    this.suppress = 0;
    this.capture = null;
    this.anyPressed = false;
    this.notices = [];
    window.addEventListener('gamepadconnected', (e) => this.notices.push(`${padName(e.gamepad.id)} CONNECTED`));
    window.addEventListener('gamepaddisconnected', (e) => this.notices.push(`${padName(e.gamepad.id)} DISCONNECTED`));
  }

  // ------------------------------------------------------------ bindings

  profile(key) {
    if (this.bindings[key]) return this.bindings[key];
    if (key.startsWith('pad')) {
      const info = this.padInfo.get(key) ?? { layout: 'standard' };
      // Older saves kept one shared profile for all standard pads.
      if (info.layout === 'standard' && this.bindings.pad) return this.bindings.pad;
      return actionsFor(LAYOUTS[info.layout] ?? LAYOUTS.standard);
    }
    return defaultProfile(key);
  }

  /** Replace a whole pad profile (used by the guided setup). */
  setProfile(key, prof) {
    this.bindings[key] = prof;
    save('bindings', this.bindings);
  }

  setBinding(key, action, binding) {
    const prof = structuredClone(this.profile(key));
    prof[action] = [binding];
    this.bindings[key] = prof;
    save('bindings', this.bindings);
  }

  resetProfile(key) {
    delete this.bindings[key];
    save('bindings', this.bindings);
  }

  controller(id) {
    return this.controllers.get(id);
  }

  padControllers() {
    return [...this.controllers.values()].filter((c) => c.kind === 'gamepad' && c.connected);
  }

  padStyle(c) {
    if (settings.buttonLabels !== 'auto') return settings.buttonLabels;
    if (!c) return 'xbox';
    return this.profile(c.profileKey).style ?? this.padInfo.get(c.profileKey)?.style ?? detectPadStyle(c.gpId);
  }

  /** Label for a binding of a given profile, using the look of a matching connected pad. */
  bindingLabel(profileKey, binding) {
    if (profileKey.startsWith('kb')) return keyLabel(binding);
    const prof = this.profile(profileKey);
    if (prof.names?.[binding]) return prof.names[binding];
    const pad = this.padControllers().find((c) => c.profileKey === profileKey);
    const style = this.padStyle(pad);
    const L = LAYOUTS[this.padInfo.get(profileKey)?.layout ?? 'standard'];
    // Printed name of the physical button, if this layout knows it.
    for (const [phys, b] of Object.entries(L)) {
      if (typeof b === 'string' && b === binding && PRINTED[style]?.[phys]) return PRINTED[style][phys];
    }
    for (const dir of ['up', 'down', 'left', 'right']) {
      if (binding.startsWith('h:') && L[dir].includes(binding)) return `D-${dir.toUpperCase()}`;
    }
    return padBindingLabel(binding, style, true);
  }

  /** Short rumble on a player's pad, where the browser and pad support it. */
  rumble(controllerId, strong = 0.5, weak = 0.5, ms = 120) {
    if (!settings.rumble) return;
    const c = this.promptController(controllerId);
    if (c?.kind !== 'gamepad') return;
    const gp = navigator.getGamepads?.()[c.index];
    try {
      gp?.vibrationActuator?.playEffect?.('dual-rumble', { duration: ms, strongMagnitude: strong, weakMagnitude: weak })?.catch?.(() => {});
    } catch {
      /* no rumble on this pad/browser */
    }
  }

  /** Controller whose labels should be shown for prompts. */
  promptController(id = 'any') {
    if (id !== 'any') return this.controller(id);
    if (this.lastKind === 'gamepad') {
      const pad = this.controller(this.lastId);
      if (pad?.connected) return pad;
    }
    if (this.lastKind === 'touch') return this.controller('touch');
    return this.controller(this.lastId?.startsWith('kb') ? this.lastId : 'kb1');
  }

  actionLabel(action, id = 'any') {
    const c = this.promptController(id);
    if (!c || c.kind === 'touch') return null;
    const b = this.profile(c.profileKey)[action]?.[0];
    return b ? this.bindingLabel(c.profileKey, b) : '-';
  }

  moveLabel(id = 'any') {
    const c = this.promptController(id);
    if (!c || c.kind === 'touch') return null;
    const p = this.profile(c.profileKey);
    const first = DIRS.map((d) => p[d]?.[0]);
    if (c.kind === 'keyboard') {
      if (first.join() === 'KeyW,KeyS,KeyA,KeyD') return 'WASD';
      if (first.join() === 'ArrowUp,ArrowDown,ArrowLeft,ArrowRight') return 'ARROWS';
      return first.map((b) => (b ? keyLabel(b) : '-')).join('/');
    }
    if (p.up?.some((b) => b === 'a:1-')) return 'STICK';
    if (p.up?.some((b) => b === 'b:12')) return 'D-PAD';
    return first.map((b) => (b ? this.bindingLabel(c.profileKey, b) : '-')).join('/');
  }

  confirmLabel() {
    if (this.lastKind === 'touch') return 'TAP';
    const c = this.promptController();
    if (c?.kind === 'gamepad') return PRINTED[this.padStyle(c)]?.[settings.confirmButton === 'east' ? 'east' : 'south'] ?? 'A';
    return 'ENTER';
  }

  backLabel() {
    if (this.lastKind === 'touch') return null;
    const c = this.promptController();
    if (c?.kind === 'gamepad') return PRINTED[this.padStyle(c)]?.[settings.confirmButton === 'east' ? 'south' : 'east'] ?? 'B';
    return 'ESC';
  }

  // ------------------------------------------------------------ remapping

  startCapture(profileKey, done, timeout = 8) {
    const rest = new Map();
    for (const c of this.padControllers()) rest.set(c.id, [...c.axes]);
    this.capture = { profileKey, done, timeout, rest };
  }

  get capturing() {
    return !!this.capture;
  }

  finishCapture(binding) {
    const { done } = this.capture;
    this.capture = null;
    this.suppress = 0.35;
    done(binding);
  }

  updateCapture(dt) {
    const cap = this.capture;
    cap.timeout -= dt;
    if (this.keyboard.hit('Escape') || cap.timeout <= 0) return this.finishCapture(null);
    if (cap.profileKey.startsWith('kb')) {
      for (const code of this.keyboard.hits) return this.finishCapture(code);
      return;
    }
    for (const c of this.padControllers()) {
      if (c.profileKey !== cap.profileKey) continue;
      for (let i = 0; i < c.buttons.length; i++) if (c.buttonEdge(i)) return this.finishCapture(`b:${i}`);
      const rest = cap.rest.get(c.id) || [];
      for (let i = 0; i < c.axes.length; i++) {
        // A hat switch rests outside [-1, 1] and jumps to one of 8 fixed values.
        if (Math.abs(rest[i] ?? 0) > 1.05) {
          const v = c.axes[i];
          if (Math.abs(v) <= 1.01 && Math.abs((c.prevAxes[i] ?? rest[i]) - v) > 0.05) return this.finishCapture(`h:${i}:${Number(v.toFixed(2))}`);
          continue;
        }
        const d = c.axes[i] - (rest[i] ?? 0);
        const pd = (c.prevAxes[i] ?? 0) - (rest[i] ?? 0);
        if (Math.abs(d) > 0.6 && Math.abs(pd) <= 0.6) return this.finishCapture(`a:${i}${d > 0 ? '+' : '-'}`);
      }
    }
  }

  // ------------------------------------------------------------ polling

  poll(dt) {
    this.pollGamepads();
    const kb = this.keyboard;

    for (const id of ['kb1', 'kb2']) {
      const c = this.controllers.get(id);
      const prof = this.profile(id);
      const val = (a) => (prof[a]?.some((code) => kb.isDown(code)) ? 1 : 0);
      const down = {};
      for (const a of ACTION_IDS) down[a] = !!val(a);
      c.apply(down, moveFrom(val));
    }

    for (const c of this.padControllers()) {
      const prof = this.profile(c.profileKey);
      const val = (a) => Math.max(0, ...(prof[a] || []).map((b) => bindingValue(c, b)));
      const down = {};
      for (const a of ACTION_IDS) down[a] = val(a) > 0.5;
      c.apply(down, moveFrom(val));
    }

    this.menuPad.poll(this.pointers, this.display);
    this.touch.poll(this.pointers, this.display);
    this.controllers.get('touch').apply(this.touch.down, this.touch.move);

    // Merged controller
    const any = this.controllers.get('any');
    const down = {};
    let move = { x: 0, y: 0 };
    for (const c of this.controllers.values()) {
      if (c === any || !c.connected) continue;
      for (const a of ACTION_IDS) down[a] ||= c.down[a];
      if (Math.hypot(c.move.x, c.move.y) > Math.hypot(move.x, move.y)) move = c.move;
    }
    any.apply(down, move);

    this.trackActivity();
    if (this.capture) this.updateCapture(dt);
    this.pollMenu(dt);
  }

  pollGamepads() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    const seen = new Set();
    for (const gp of list) {
      if (!gp || gp.connected === false) continue;
      const id = `pad${gp.index}`;
      seen.add(id);
      let c = this.controllers.get(id);
      if (!c || c.gpId !== gp.id) {
        const info = identify(gp);
        const key = `pad:${gp.id}`;
        this.padInfo.set(key, info);
        c = new Controller(id, 'gamepad', padName(gp.id), key);
        c.gpId = gp.id;
        c.index = gp.index;
        c.info = info;
        this.controllers.set(id, c);
      }
      c.connected = true;
      c.prevButtons = c.buttons;
      c.prevAxes = c.axes;
      c.buttons = Array.from(gp.buttons, (b) => (typeof b === 'number' ? b : b.pressed ? Math.max(1, b.value) : b.value));
      c.axes = Array.from(gp.axes);
    }
    for (const c of this.controllers.values()) {
      if (c.kind === 'gamepad' && c.connected && !seen.has(c.id)) {
        c.connected = false;
        c.apply({}, { x: 0, y: 0 });
        c.disconnectedAt = performance.now();
      }
    }
  }

  trackActivity() {
    let any = false;
    if (this.keyboard.anyHit) {
      any = true;
      this.lastKind = 'keyboard';
      if (this.controllers.get('kb2').anyPressed && !this.controllers.get('kb1').anyPressed) this.lastId = 'kb2';
      else if (this.controllers.get('kb1').anyPressed || !this.lastId.startsWith('kb')) this.lastId = 'kb1';
    }
    for (const c of this.padControllers()) {
      const btn = c.buttons.some((_, i) => c.buttonEdge(i));
      const stick = c.axes.some((v, i) => Math.abs(v) > 0.6 && Math.abs(c.prevAxes[i] ?? 0) <= 0.6 && i < 4);
      if (btn || stick) {
        any = any || btn;
        this.lastKind = 'gamepad';
        this.lastId = c.id;
      }
    }
    if (this.pointers.downs.length) {
      any = true;
      if (this.pointers.downs.some((p) => p.type === 'touch')) this.lastKind = 'touch';
    }
    this.anyPressed = any;
  }

  pollMenu(dt) {
    const kb = this.keyboard;
    const held = {
      up: kb.isDown('ArrowUp') || kb.isDown('KeyW'),
      down: kb.isDown('ArrowDown') || kb.isDown('KeyS'),
      left: kb.isDown('ArrowLeft') || kb.isDown('KeyA'),
      right: kb.isDown('ArrowRight') || kb.isDown('KeyD'),
    };
    let confirm = kb.hit('Enter') || kb.hit('Space') || kb.hit('NumpadEnter');
    let back = kb.hit('Escape') || kb.hit('Backspace');
    const mp = this.menuPad;
    for (const d of DIRS) held[d] ||= mp.held[d];
    confirm ||= mp.confirm;
    back ||= mp.back;
    const ci = settings.confirmButton === 'east' ? 1 : 0;
    const bi = 1 - ci;
    for (const c of this.padControllers()) {
      const prof = this.profile(c.profileKey);
      const L = LAYOUTS[c.info?.layout ?? 'standard'];
      const val = (d) => Math.max(0, ...(prof[d] || []).map((b) => bindingValue(c, b)));
      held.up ||= val('up') > 0.5;
      held.down ||= val('down') > 0.5;
      held.left ||= val('left') > 0.5;
      held.right ||= val('right') > 0.5;
      const menu = prof.menu ?? { south: L.south, east: L.east, start: L.start };
      const edge = (b) => b?.startsWith('b:') && c.buttonEdge(+b.slice(2));
      confirm ||= edge(ci === 0 ? menu.south : menu.east) || edge(menu.start);
      back ||= edge(bi === 0 ? menu.south : menu.east);
    }
    const m = this.menu;
    for (const d of DIRS) {
      const n = this.nav[d];
      m[d] = false;
      if (held[d]) {
        if (!n.held) { m[d] = true; n.t = REPEAT_DELAY; }
        else if ((n.t -= dt) <= 0) { m[d] = true; n.t = REPEAT_RATE; }
      }
      n.held = held[d];
    }
    m.confirm = confirm;
    m.back = back;
    if (this.suppress > 0 || this.capture) {
      this.suppress = Math.max(0, this.suppress - dt);
      for (const k of Object.keys(m)) m[k] = false;
    }
  }

  /** Taps not claimed by the touch controls this step (UI coords). */
  get taps() {
    return this.suppress > 0 || this.capture ? [] : this.pointers.taps;
  }

  get touchVisible() {
    if (settings.touchControls === 'on') return true;
    if (settings.touchControls === 'off') return false;
    return this.pointers.touchSeen;
  }

  endStep() {
    this.keyboard.endStep();
    this.pointers.endStep();
  }
}
