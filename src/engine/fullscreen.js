// Fullscreen helpers. Requests must run inside a real input event handler,
// so callers invoke these directly from pointerdown / keydown listeners.

export function canFullscreen() {
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export function enterFullscreen() {
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!req) return;
  try {
    const p = req.call(el, { navigationUI: 'hide' });
    const lock = () => screen.orientation?.lock?.('landscape')?.catch(() => {});
    if (p?.then) p.then(lock).catch(() => {});
    else lock();
  } catch {
    /* refused: the game still fills the browser window */
  }
}

export function exitFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen;
  try {
    exit?.call(document)?.catch?.(() => {});
  } catch {
    /* ignore */
  }
}

export function toggleFullscreen() {
  if (isFullscreen()) exitFullscreen();
  else enterFullscreen();
}
