// Gamepad identification and per-layout defaults.
//
// 8BitDo SN30 Pro modes (hold while switching on):
//   START + X  Windows / X-input  → browser sees an Xbox pad ("standard" mapping, Xbox ids)
//   START + B  Android / D-input  → raw HID pad, vendor 2dc8, no standard mapping in browsers
//   START + A  macOS              → usually standard mapping
//   START + Y  Switch             → "Pro Controller" (vendor 057e), standard mapping
// Raw D-input indices follow SDL's mapping for the SN30 Pro:
//   B=0 A=1 Y=3 X=4 L=6 R=7 L2=8 R2=9 SELECT=10 START=11 L3=13 R3=14, d-pad on a hat axis.

/** What we can tell about a pad from the browser's id and mapping. */
export function identify(gp) {
  const id = (gp.id || '').toLowerCase();
  const standard = gp.mapping === 'standard';
  const eightBitDo = /8bitdo|2dc8/.test(id);
  const switchPro = /057e|pro controller|nintendo/.test(id);
  if (eightBitDo && !standard) return { layout: 'dinput8bitdo', family: '8bitdo', mode: 'D-INPUT', style: 'nintendo' };
  if (eightBitDo) return { layout: 'standard', family: '8bitdo', mode: 'MAC/STANDARD', style: 'nintendo' };
  if (switchPro) return { layout: 'standard', family: 'nintendo', mode: 'SWITCH', style: 'nintendo' };
  if (/xinput|xbox|045e/.test(id)) return { layout: standard ? 'standard' : 'raw', family: 'xbox', mode: 'X-INPUT', style: 'xbox' };
  if (/054c|playstation|dualshock|dualsense|wireless controller/.test(id)) return { layout: standard ? 'standard' : 'raw', family: 'playstation', mode: '', style: 'playstation' };
  return { layout: standard ? 'standard' : 'raw', family: 'generic', mode: '', style: 'xbox' };
}

// Physical buttons per layout. Bindings: 'b:N' button, 'a:N+/-' axis, 'h:N:V' hat axis at value V.
// Chrome reports a D-input hat on one axis (up = -1, right = -0.43, down = 0.14, left = 0.71,
// neutral ≈ 1.29); Firefox on Linux uses two axes (6/7). Both are listed.
export const LAYOUTS = {
  standard: {
    south: 'b:0', east: 'b:1', west: 'b:2', north: 'b:3', l: 'b:4', r: 'b:5', zl: 'b:6', zr: 'b:7',
    select: 'b:8', start: 'b:9',
    up: ['a:1-', 'b:12'], down: ['a:1+', 'b:13'], left: ['a:0-', 'b:14'], right: ['a:0+', 'b:15'],
  },
  dinput8bitdo: {
    south: 'b:0', east: 'b:1', west: 'b:3', north: 'b:4', l: 'b:6', r: 'b:7', zl: 'b:8', zr: 'b:9',
    select: 'b:10', start: 'b:11',
    up: ['a:1-', 'h:9:-1', 'h:9:1', 'h:9:-0.71', 'a:7-'],
    down: ['a:1+', 'h:9:0.14', 'h:9:-0.14', 'h:9:0.43', 'a:7+'],
    left: ['a:0-', 'h:9:0.71', 'h:9:0.43', 'h:9:1', 'a:6-'],
    right: ['a:0+', 'h:9:-0.43', 'h:9:-0.71', 'h:9:-0.14', 'a:6+'],
  },
  raw: {
    south: 'b:0', east: 'b:1', west: 'b:2', north: 'b:3', l: 'b:4', r: 'b:5', zl: 'b:6', zr: 'b:7',
    select: 'b:8', start: 'b:9',
    up: ['a:1-'], down: ['a:1+'], left: ['a:0-'], right: ['a:0+'],
  },
};

/**
 * Game actions on physical buttons.
 * Nintendo-lettered pads (8BitDo, Switch) are laid out by letter:
 *   A pass · B shoot (+ZR) · Y poke check · X / L switch · R sprint (+ZL) · START pause
 * Xbox/PlayStation-style pads by position: bottom pass, left shoot, right poke, LB switch.
 */
export function actionsFor(L, style = 'xbox') {
  const dirs = { up: [...L.up], down: [...L.down], left: [...L.left], right: [...L.right] };
  const menu = { south: L.south, east: L.east, start: L.start };
  if (style === 'nintendo') {
    return {
      ...dirs,
      pass: [L.east], shoot: [L.south, L.zr], check: [L.west], switch: [L.north, L.l],
      sprint: [L.r, L.zl], pause: [L.start], menu, style,
    };
  }
  return {
    ...dirs,
    shoot: [L.west, L.zr], pass: [L.south], check: [L.east], switch: [L.l],
    sprint: [L.r, L.zl], pause: [L.start], menu,
  };
}

/** Names printed on the buttons, per label style. */
export const PRINTED = {
  nintendo: { south: 'B', east: 'A', west: 'Y', north: 'X', l: 'L', r: 'R', zl: 'ZL', zr: 'ZR', select: 'SELECT', start: 'START' },
  xbox: { south: 'A', east: 'B', west: 'X', north: 'Y', l: 'LB', r: 'RB', zl: 'LT', zr: 'RT', select: 'VIEW', start: 'MENU' },
  playstation: { south: 'CROSS', east: 'CIRCLE', west: 'SQUARE', north: 'TRIANGLE', l: 'L1', r: 'R1', zl: 'L2', zr: 'R2', select: 'SHARE', start: 'OPTIONS' },
};

/** Value of a binding on a pad snapshot. Hat bindings match one of the hat's 8 positions. */
export function hatValue(axes, binding) {
  const m = /^h:(\d+):(-?[\d.]+)$/.exec(binding);
  if (!m) return null;
  const v = axes[+m[1]];
  if (v === undefined) return 0;
  return Math.abs(v - Number(m[2])) < 0.08 ? 1 : 0;
}
