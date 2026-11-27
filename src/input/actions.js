// Game actions and their default bindings per device profile.
// Keyboard bindings are KeyboardEvent.code values.
// Gamepad bindings: 'b:N' = button N, 'a:N+' / 'a:N-' = axis N in that direction.

export const ACTIONS = [
  { id: 'up', label: 'HOCH' },
  { id: 'down', label: 'RUNTER' },
  { id: 'left', label: 'LINKS' },
  { id: 'right', label: 'RECHTS' },
  { id: 'shoot', label: 'SCHIESSEN' },
  { id: 'pass', label: 'PASSEN' },
  { id: 'check', label: 'CHECKEN' },
  { id: 'switch', label: 'SPIELER WECHSELN' },
  { id: 'sprint', label: 'SPRINT' },
  { id: 'pause', label: 'PAUSE' },
];

export const ACTION_IDS = ACTIONS.map((a) => a.id);

const DEFAULTS = {
  kb1: {
    up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
    shoot: ['KeyJ'], pass: ['KeyK'], check: ['KeyI'], switch: ['KeyL'],
    sprint: ['ShiftLeft', 'Space'], pause: ['Escape'],
  },
  kb2: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    shoot: ['Numpad1', 'Comma'], pass: ['Numpad2', 'Period'], check: ['Numpad5', 'Semicolon'], switch: ['Numpad3', 'Slash'],
    sprint: ['Numpad0', 'ShiftRight'], pause: ['Backspace'],
  },
  // Standard mapping: 0 south, 1 east, 2 west, 3 north, 4/5 bumpers, 6/7 triggers,
  // 8 select, 9 start, 12–15 d-pad. Positions, not letters, so it works for any brand.
  pad: {
    up: ['a:1-', 'b:12'], down: ['a:1+', 'b:13'], left: ['a:0-', 'b:14'], right: ['a:0+', 'b:15'],
    shoot: ['b:2', 'b:7'], pass: ['b:0'], check: ['b:1'], switch: ['b:4'],
    sprint: ['b:5', 'b:6'], pause: ['b:9'],
  },
};

export function defaultProfile(key) {
  const base = key.startsWith('pad') ? DEFAULTS.pad : DEFAULTS[key];
  return structuredClone(base);
}

export const KEYBOARD_PROFILES = [
  { key: 'kb1', name: 'TASTATUR 1' },
  { key: 'kb2', name: 'TASTATUR 2' },
];
