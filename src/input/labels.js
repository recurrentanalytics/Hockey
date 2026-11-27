// Human-readable names for keys and gamepad buttons.

const KEY_NAMES = {
  Space: 'LEERTASTE', Escape: 'ESC', Backspace: 'RÜCK', Enter: 'ENTER', NumpadEnter: 'NUM ENT', Tab: 'TAB',
  ShiftLeft: 'LSHIFT', ShiftRight: 'RSHIFT', ControlLeft: 'LCTRL', ControlRight: 'RCTRL',
  AltLeft: 'LALT', AltRight: 'RALT', MetaLeft: 'LMETA', MetaRight: 'RMETA', CapsLock: 'CAPS',
  ArrowUp: 'HOCH', ArrowDown: 'RUNTER', ArrowLeft: 'LINKS', ArrowRight: 'RECHTS',
  Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']',
  Minus: '-', Equal: '=', Backquote: 'GRAVE', Backslash: 'BSLASH', IntlBackslash: '<>',
  NumpadAdd: 'NUM+', NumpadSubtract: 'NUM-', NumpadMultiply: 'NUM*', NumpadDivide: 'NUM/', NumpadDecimal: 'NUM.',
};

export function keyLabel(code) {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'NUM' + code.slice(6).toUpperCase();
  return code.toUpperCase().slice(0, 8);
}

const PAD_NAMES = {
  xbox: ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'VIEW', 'MENU', 'LS', 'RS', 'D-HOCH', 'D-RUNTER', 'D-LINKS', 'D-RECHTS', 'HOME'],
  nintendo: ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '-', '+', 'LS', 'RS', 'D-HOCH', 'D-RUNTER', 'D-LINKS', 'D-RECHTS', 'HOME'],
  playstation: ['CROSS', 'CIRCLE', 'SQUARE', 'TRIANGLE', 'L1', 'R1', 'L2', 'R2', 'SHARE', 'OPTIONS', 'L3', 'R3', 'D-HOCH', 'D-RUNTER', 'D-LINKS', 'D-RECHTS', 'PS'],
};

/** Guess the face-button labelling from the browser's gamepad id string. */
export function detectPadStyle(id = '') {
  const s = id.toLowerCase();
  if (/054c|playstation|dualshock|dualsense|wireless controller/.test(s)) return 'playstation';
  if (/057e|nintendo|pro controller|joy-con|8bitdo|2dc8/.test(s)) return 'nintendo';
  return 'xbox';
}

export function padBindingLabel(binding, style = 'xbox', standard = true) {
  const b = /^b:(\d+)$/.exec(binding);
  if (b) {
    const i = +b[1];
    return standard && PAD_NAMES[style]?.[i] ? PAD_NAMES[style][i] : `BTN ${i}`;
  }
  const a = /^a:(\d+)([+-])$/.exec(binding);
  if (a) {
    const i = +a[1], plus = a[2] === '+';
    if (standard && i < 4) {
      const stick = i < 2 ? 'LS' : 'RS';
      const dir = i % 2 === 0 ? (plus ? 'RECHTS' : 'LINKS') : (plus ? 'RUNTER' : 'HOCH');
      return `${stick} ${dir}`;
    }
    return `AXIS ${i}${a[2]}`;
  }
  return binding;
}

/** Short name of a gamepad from its id string. */
export function padName(id = '') {
  let s = id.replace(/^[0-9a-f]{4}-[0-9a-f]{4}-/i, '');   // Firefox vendor-product prefix
  s = s.replace(/\(.*?\)/g, '').replace(/\s+/g, ' ').trim();  // Chrome "(STANDARD GAMEPAD Vendor ...)"
  return (s || 'GAMEPAD').toUpperCase().replace(/[^A-Z0-9 .\-+/]/g, '').slice(0, 24);
}
