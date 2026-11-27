import { TIMING } from './config.js';
import { settings } from './settings.js';
import { PAL } from './engine/palette.js';
import { Display } from './engine/display.js';
import { drawText } from './engine/font.js';
import { panel } from './engine/draw.js';
import { canFullscreen, isFullscreen, enterFullscreen, toggleFullscreen } from './engine/fullscreen.js';
import { FS_BUTTON, hit, drawFullscreenButton } from './ui/corner.js';
import { InputManager } from './input/manager.js';
import { WorldView } from './world/view.js';
import { Toasts } from './ui/hud.js';
import { Backdrop } from './scenes/backdrop.js';
import { Audio } from './engine/audio.js';
import { TitleScene } from './scenes/title.js';
import { loadAssets } from './engine/assets.js';

const canvas = document.getElementById('screen');
canvas.focus({ preventScroll: true }); // works when allowed; otherwise the first click focuses it
const display = new Display(canvas, settings);
const input = new InputManager(display, canvas);

const app = {
  display,
  input,
  toasts: new Toasts(),
  audio: new Audio(),
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

// Fullscreen has to be requested inside the input event itself, so these run in the listeners.
let autoTried = false;
function autoFullscreen() {
  if (autoTried) return;
  autoTried = true;
  if (settings.autoFullscreen && canFullscreen() && !isFullscreen()) enterFullscreen();
}
input.pointers.onDown = (p) => {
  app.audio.unlock();
  if (canFullscreen() && hit(FS_BUTTON(display.width), p)) {
    autoTried = true;
    toggleFullscreen();
    return true;
  }
  autoFullscreen();
  return false;
};
input.keyboard.onKeyDown = (code) => {
  app.audio.unlock();
  if (input.capturing) return;
  const bound = ['kb1', 'kb2'].some((k) => Object.values(input.profile(k)).some((codes) => codes.includes(code)));
  if (code === 'KeyF' && !bound && canFullscreen()) { autoTried = true; toggleFullscreen(); return; }
  autoFullscreen();
};
app.push(new TitleScene(app));
loadAssets(); // art arrives in the background; built-in sprites show until then

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
    input.menuPad.enabled = input.pointers.touchSeen && !!app.top.menuPad;
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

  app.audio.tick();
  app.audio.setAmbient(!!app.top.match && app.top.match.state !== 'final' || !!app.top.under?.match);
  display.beginFrame();
  let base = app.scenes.length - 1;
  while (base > 0 && app.scenes[base].transparent) base--;
  for (let i = base; i < app.scenes.length; i++) {
    app.scenes[i].draw(i === app.scenes.length - 1);
  }
  if (input.menuPad.enabled) input.menuPad.draw(display.uctx, display.width, display.height);
  if (canFullscreen()) drawFullscreenButton(display.uctx, display.width, isFullscreen());
  app.toasts.draw(display.uctx, display.width, display.height);
  drawPortraitHint();
  display.present();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.app = app; // handy for debugging from the console
