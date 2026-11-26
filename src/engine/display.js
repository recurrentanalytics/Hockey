// Two low-resolution layers scaled up to the screen with nearest-neighbour:
//  - world: zoomable (its resolution grows when zooming out, so pixel art stays sharp)
//  - ui:    fixed resolution, always on top
import { VIEW, RES } from '../config.js';
import { makeCanvas } from './raster.js';

export class Display {
  constructor(canvas, settings) {
    this.screen = canvas;
    this.sctx = canvas.getContext('2d');
    this.settings = settings;
    this.ui = makeCanvas(1, 1);
    this.world = makeCanvas(1, 1);
    this.zoom = 1;
    this.resize();
    const onResize = () => this.resize();
    window.addEventListener('resize', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cssW = window.innerWidth, cssH = window.innerHeight;
    this.dpr = dpr;
    this.cssW = cssW;
    this.cssH = cssH;
    this.screen.width = Math.round(cssW * dpr);
    this.screen.height = Math.round(cssH * dpr);

    this.height = VIEW.baseHeight;
    const w = Math.round((VIEW.baseHeight * cssW) / cssH);
    this.width = Math.max(VIEW.minWidth, Math.min(VIEW.maxWidth, w & ~1));

    let s = Math.min(this.screen.width / this.width, this.screen.height / this.height);
    if (this.settings.pixelPerfect && s >= 1) s = Math.floor(s);
    this.scale = s;
    this.ox = Math.floor((this.screen.width - this.width * s) / 2);
    this.oy = Math.floor((this.screen.height - this.height * s) / 2);

    this.ui.width = this.width;
    this.ui.height = this.height;
    this.uctx = this.ui.getContext('2d');
    this.uctx.imageSmoothingEnabled = false;
    this.setZoom(this.zoom, true);
  }

  get portrait() {
    return this.cssH > this.cssW;
  }

  /** Zoom < 1 shows more of the world by raising the world layer's resolution. */
  setZoom(z, force = false) {
    z = Math.max(0.4, Math.min(1.6, Math.round(z * 64) / 64));
    const w = Math.round(this.width / z), h = Math.round(this.height / z);
    if (!force && w * RES === this.world.width && h * RES === this.world.height) { this.zoom = z; return; }
    this.zoom = z;
    this.world.width = w * RES;
    this.world.height = h * RES;
    this.wctx = this.world.getContext('2d');
    this.wctx.imageSmoothingEnabled = false;
    // Everything draws in logical world pixels; detailed sprites undo this scale themselves.
    this.wctx.setTransform(RES, 0, 0, RES, 0, 0);
  }

  /** Logical size of the world layer (the canvas itself is RES× larger). */
  get worldWidth() { return this.world.width / RES; }
  get worldHeight() { return this.world.height / RES; }

  beginFrame() {
    this.uctx.clearRect(0, 0, this.width, this.height);
  }

  present() {
    const { sctx } = this;
    sctx.imageSmoothingEnabled = false;
    sctx.fillStyle = '#05060c';
    sctx.fillRect(0, 0, this.screen.width, this.screen.height);
    const dw = this.width * this.scale, dh = this.height * this.scale;
    sctx.drawImage(this.world, this.ox, this.oy, dw, dh);
    sctx.drawImage(this.ui, this.ox, this.oy, dw, dh);
  }

  /** Client (CSS px) → UI layer pixel coordinates. */
  toUI(clientX, clientY) {
    return {
      x: (clientX * this.dpr - this.ox) / this.scale,
      y: (clientY * this.dpr - this.oy) / this.scale,
    };
  }
}
