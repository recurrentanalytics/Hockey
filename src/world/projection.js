import { PROJ } from '../config.js';

// On the real Boni court (globalThis.BONI_3D) the photorealistic camera decides where things are:
// its projector maps metres to window CSS pixels, which are turned into world-layer pixels here.
const B = globalThis.BONI_3D;
/** True when the game runs on the 3D Boni backdrop: fixed camera, no baked arena. */
export const FIXED = !!B;

/** World metres → world-pixel space (before camera offset). */
export function project(x, y, z = 0) {
  if (B?.display) {
    const c = B.toCss(x, y, z), d = B.display;
    return { x: (c.x * d.dpr - d.ox) / d.scale / d.zoom, y: (c.y * d.dpr - d.oy) / d.scale / d.zoom };
  }
  return { x: x * PROJ.x, y: y * PROJ.y - z * PROJ.z };
}

/** Zoom that keeps sprites at their usual size in metres on the 3D court (PROJ.x px per metre). */
export function fixedZoom(fallback) {
  if (!B?.display) return fallback;
  if (B.zoomLock) return B.zoomLock;
  const a = B.toCss(-5, 0, 0), b = B.toCss(5, 0, 0), d = B.display;
  const uiPerMetre = (Math.hypot(b.x - a.x, b.y - a.y) * d.dpr) / d.scale / 10;
  return (B.zoom = uiPerMetre / PROJ.x);
}
