// Guided pad setup: press each button as the drawing lights it up.
// Works for any pad in any mode (8BitDo SN30 Pro in D-input, X-input, macOS or Switch mode,
// Xbox, PlayStation, ...), because it records what the browser actually reports.
import { PAL } from '../engine/palette.js';
import { drawText, fitText } from '../engine/font.js';
import { panel } from '../engine/draw.js';
import { Menu } from '../ui/menu.js';
import { header, hintBar } from '../ui/hud.js';
import { drawPad } from '../ui/padDiagram.js';
import { PRINTED, actionsFor } from '../input/pads.js';

const STEPS = [
  { key: 'south', where: 'BOTTOM FACE BUTTON' },
  { key: 'east', where: 'RIGHT FACE BUTTON' },
  { key: 'west', where: 'LEFT FACE BUTTON' },
  { key: 'north', where: 'TOP FACE BUTTON' },
  { key: 'up', name: 'D-PAD UP' },
  { key: 'down', name: 'D-PAD DOWN' },
  { key: 'left', name: 'D-PAD LEFT' },
  { key: 'right', name: 'D-PAD RIGHT' },
  { key: 'l', where: 'LEFT SHOULDER' },
  { key: 'r', where: 'RIGHT SHOULDER' },
  { key: 'zl', where: 'LEFT TRIGGER', optional: true },
  { key: 'zr', where: 'RIGHT TRIGGER', optional: true },
  { key: 'select', where: 'SMALL LEFT BUTTON', optional: true },
  { key: 'start', where: 'SMALL RIGHT BUTTON' },
  { key: 'stickUp', name: 'LEFT STICK UP', optional: true },
  { key: 'stickLeft', name: 'LEFT STICK LEFT', optional: true },
];
const OPTIONAL_WAIT = 6;

const flip = (b) => (b && /^a:\d+[+-]$/.test(b) ? b.slice(0, -1) + (b.endsWith('+') ? '-' : '+') : null);

export class PadSetupScene {
  constructor(app, pad) {
    this.app = app;
    this.pad = pad;
    this.menuPad = false;
    this.phase = 'style';
    this.map = {};
    this.step = 0;
    const styles = [
      { value: 'nintendo', label: 'B A Y X  (8BITDO, SWITCH)' },
      { value: 'xbox', label: 'A B X Y  (XBOX)' },
      { value: 'playstation', label: 'CROSS CIRCLE  (PLAYSTATION)' },
    ];
    const preferred = pad.info?.family === '8bitdo' || pad.info?.family === 'nintendo' ? 'nintendo' : pad.info?.style ?? 'xbox';
    this.styleMenu = new Menu(styles.map((s) => ({ label: s.label, onSelect: () => this.begin(s.value) })), { width: 230, top: 118 });
    this.styleMenu.index = Math.max(0, styles.findIndex((s) => s.value === preferred));
  }

  get printed() {
    return PRINTED[this.style] ?? PRINTED.nintendo;
  }

  stepName(st) {
    return st.name ?? `${this.printed[st.key]} (${st.where})`;
  }

  begin(style) {
    this.style = style;
    this.phase = 'steps';
    this.step = 0;
    this.capture();
  }

  capture() {
    const st = STEPS[this.step];
    this.waited = 0;
    this.app.input.startCapture(this.pad.profileKey, (b) => this.captured(b), st.optional ? OPTIONAL_WAIT + 0.5 : 60);
  }

  captured(binding) {
    const st = STEPS[this.step];
    if (!binding) {
      if (!st.optional || this.cancelled || this.app.input.keyboard.hit('Escape')) return this.cancel();
      return this.next(); // optional step skipped
    }
    if (Object.values(this.map).includes(binding)) {
      this.app.toasts.push('ALREADY USED - PRESS ANOTHER');
      return this.capture();
    }
    this.map[st.key] = binding;
    this.app.audio.play('menu');
    this.next();
  }

  next() {
    this.step += 1;
    if (this.step >= STEPS.length) return this.finish();
    this.capture();
  }

  cancel() {
    this.app.toasts.push('PAD SETUP CANCELLED');
    this.app.pop();
  }

  finish() {
    const P = this.map, names = {};
    for (const k of ['south', 'east', 'west', 'north', 'l', 'r', 'zl', 'zr', 'select', 'start']) if (P[k]) names[P[k]] = this.printed[k];
    for (const k of ['up', 'down', 'left', 'right']) if (P[k]) names[P[k]] = `D-${k.toUpperCase()}`;
    const stick = { up: P.stickUp, down: flip(P.stickUp), left: P.stickLeft, right: flip(P.stickLeft) };
    for (const [d, b] of Object.entries(stick)) if (b) names[b] = `STICK ${d.toUpperCase()}`;
    const list = (...b) => b.filter(Boolean);
    const base = actionsFor({ ...P, up: [], down: [], left: [], right: [] }, this.style);
    const clean = (a) => list(...a);
    this.profile = {
      up: list(P.up, stick.up), down: list(P.down, stick.down), left: list(P.left, stick.left), right: list(P.right, stick.right),
      shoot: clean(base.shoot), pass: clean(base.pass), check: clean(base.check), switch: clean(base.switch),
      sprint: clean(base.sprint), pause: clean(base.pause),
      menu: { south: P.south, east: P.east, start: P.start },
      style: this.style,
      names,
    };
    this.app.input.setProfile(this.pad.profileKey, this.profile);
    this.app.audio.play('confirm');
    this.phase = 'done';
  }

  update(dt) {
    this.app.backdrop.update(dt);
    const { input } = this.app;
    if (this.phase === 'style') {
      this.styleMenu.update(this.app);
      if (input.menu.back) this.app.pop();
      return;
    }
    if (this.phase === 'steps') {
      this.waited += dt;
      if (input.keyboard.hit('Escape') || input.pointers.taps.length) {
        this.cancelled = true;
        if (input.capturing) input.finishCapture(null);
      }
      return;
    }
    if (input.menu.confirm || input.menu.back || input.taps.length) this.app.pop();
  }

  draw() {
    const { display, input } = this.app;
    this.app.backdrop.draw(0.75);
    const ctx = display.uctx, W = display.width, H = display.height;
    header(ctx, W, 'PAD SETUP', fitText(this.pad.name, W - 20));
    const cx = Math.round(W / 2), cy = 82;
    const done = new Set(Object.keys(this.map));

    if (this.phase === 'style') {
      drawPad(ctx, cx, cy, { letters: PRINTED.nintendo });
      drawText(ctx, 'WHICH LETTERS ARE PRINTED ON YOUR PAD?', W / 2, 108, { color: PAL.white, align: 'center', shadow: PAL.ink });
      this.styleMenu.draw(ctx, W);
      const mode = this.pad.info?.mode ? `DETECTED: ${this.pad.info.mode} MODE` : '';
      drawText(ctx, mode, W / 2, 152, { color: PAL.mist, align: 'center', shadow: PAL.ink });
      hintBar(ctx, W, H, [[input.confirmLabel(), 'SELECT'], [input.backLabel(), 'BACK']]);
      return;
    }

    if (this.phase === 'steps') {
      const st = STEPS[this.step];
      drawPad(ctx, cx, cy, { letters: this.printed, highlight: st.key, done });
      const y = 116;
      panel(ctx, 20, y, W - 40, 34, { fill: PAL.ink, border: PAL.yellow, alpha: 0.9 });
      drawText(ctx, `STEP ${this.step + 1} OF ${STEPS.length}`, W / 2, y + 5, { color: PAL.mist, align: 'center' });
      drawText(ctx, fitText(`PRESS ${this.stepName(st)}`, W - 50), W / 2, y + 14, { color: PAL.yellow, align: 'center' });
      const left = Math.max(0, Math.ceil(OPTIONAL_WAIT - this.waited));
      drawText(ctx, st.optional ? `NOT ON YOUR PAD? WAIT ${left} S TO SKIP` : 'ESC OR TAP TO CANCEL', W / 2, y + 24, { color: PAL.cloud, align: 'center' });
      return;
    }

    // Done: show what each button does.
    drawPad(ctx, cx, cy, { letters: this.printed, done });
    const name = (bs) => bs.map((b) => this.profile.names[b]).filter(Boolean).join(' / ') || '-';
    const pr = this.profile;
    const lines = [
      `${name(pr.pass)} PASS    ${name(pr.shoot)} SHOOT    ${name(pr.check)} POKE CHECK`,
      `${name(pr.switch)} SWITCH    ${name(pr.sprint)} SPRINT    ${name(pr.pause)} PAUSE`,
      'MOVE WITH THE D-PAD OR LEFT STICK',
    ];
    lines.forEach((l, i) => drawText(ctx, fitText(l, W - 16), W / 2, 116 + i * 9, { color: i < 2 ? PAL.white : PAL.mist, align: 'center', shadow: PAL.ink }));
    drawText(ctx, 'SAVED. CHANGE SINGLE BUTTONS UNDER CONTROLS.', W / 2, 150, { color: PAL.green, align: 'center', shadow: PAL.ink });
    hintBar(ctx, W, H, [[input.confirmLabel(), 'DONE']]);
  }
}
