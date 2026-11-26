import { PROJ } from '../config.js';

/** World metres → world-pixel space (before camera offset). */
export function project(x, y, z = 0) {
  return { x: x * PROJ.x, y: y * PROJ.y - z * PROJ.z };
}
