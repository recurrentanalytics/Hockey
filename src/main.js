import { TIMING } from './config.js';
import { settings } from './settings.js';
import { PAL } from './engine/palette.js';
import { Display } from './engine/display.js';
import { drawText } from './engine/font.js';
import { panel } from './engine/draw.js';
import { InputManager } from './input/manager.js';
import { WorldView } from './world/view.js';
import { Toasts } from './ui/hud.js';
import { Backdrop } from './scenes/backdrop.js';
import { TitleScene } from './scenes/title.js';

const canvas = document.getElementById('screen');
const display = new Display(canvas, settings);
const input = new InputManager(display, canvas);

const app = {
  display,
  input,
  toasts: new Toasts(),
  world: new WorldView(),
  scenes: [],
  get top() { return this.scenes[this.scenes.length - 1]; },
  push(scene) { this.scenes.push(scene); },
  pop() {
    if (this.scenes.length > 1) this.scenes.pop();
    this.top.resume?.();
  },
  /** Pop until `match(scene)` is on top. */
  popTo(match) {
    while (this.scenes.length > 1 && !match(this.top)) this.scenes.pop();
    this.top.resume?.();
  },
};
app.backdrop = new Backdrop(app);
app.push(new TitleScene(app));

function drawPortraitHint() {
  if (!(display.portrait && input.pointers.touchSeen)) return;
  const ctx = display.uctx, W = display.width, H = display.height;
  panel(ctx, 20, H / 2 - 16, W - 40, 32, { fill: PAL.ink, border: PAL.yellow, alpha: 0.95 });
  drawText(ctx, 'ROTATE YOUR DEVICE', W / 2, H / 2 - 9, { color: PAL.yellow, align: 'center', scale: 2 });
  drawText(ctx, 'THE RINK PLAYS BEST IN LANDSCAPE', W / 2, H / 2 + 6, { color: PAL.white, align: 'center' });
}

let last = performance.now();
let acc = 0;
function frame(now) {
  acc += Math.min((now - last) / 1000, TIMING.maxFrame);
  last = now;
  let steps = 0;
  while (acc >= TIMING.step && steps < 10) {
    input.touch.enabled = !!app.top.wantsTouch?.();
    input.poll(TIMING.step);
    for (const n of input.notices) app.toasts.push(n);
    input.notices.length = 0;
    app.top.update(TIMING.step);
    app.toasts.update(TIMING.step);
    input.endStep();
    acc -= TIMING.step;
    steps++;
  }
  if (steps === 10) acc = 0;

  display.beginFrame();
  let base = app.scenes.length - 1;
  while (base > 0 && app.scenes[base].transparent) base--;
  for (let i = base; i < app.scenes.length; i++) {
    app.scenes[i].draw(i === app.scenes.length - 1);
  }
  app.toasts.draw(display.uctx, display.width, display.height);
  drawPortraitHint();
  display.present();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.app = app; // handy for debugging from the console
