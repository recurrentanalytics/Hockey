// Persisted user settings and the option lists the menus offer.
import { load, save } from './engine/storage.js';
import { TEAMS } from './config.js';

const TEAM_OPTIONS = Object.entries(TEAMS).filter(([, t]) => !t.hidden).map(([value, t]) => ({ value, label: t.name }));

const DEFAULTS = {
  ruleset: 'worldskate',
  periodLength: 'rulebook',
  difficulty: 'normal',
  twoPlayerMode: 'versus',
  twoPlayerCamera: 'shared',
  touchControls: 'auto',
  buttonLabels: 'auto',
  padConfirm: 'auto',
  pixelPerfect: false,
  autoFullscreen: true,
  sound: 0.75,
  venue: 'arena',
  rumble: true,
  homeTeam: 'borstentiere',
  awayTeam: 'blazers',
};

export const settings = { ...DEFAULTS, ...load('settings', {}) };

export function saveSettings() {
  save('settings', settings);
}

export const OPTIONS = {
  ruleset: [
    { value: 'worldskate', label: 'WORLD SKATE' },
    { value: 'usars', label: 'USARS / NARCH' },
    { value: 'ishd', label: 'ISHD GERMANY' },
  ],
  periodLength: [
    { value: 'rulebook', label: 'RULEBOOK' },
    { value: 3, label: '3 MIN' },
    { value: 5, label: '5 MIN' },
    { value: 10, label: '10 MIN' },
    { value: 15, label: '15 MIN' },
    { value: 20, label: '20 MIN' },
  ],
  difficulty: [
    { value: 'easy', label: 'EASY' },
    { value: 'normal', label: 'NORMAL' },
    { value: 'hard', label: 'HARD' },
  ],
  twoPlayerMode: [
    { value: 'versus', label: 'VERSUS' },
    { value: 'coop', label: 'CO-OP VS AI' },
  ],
  twoPlayerCamera: [
    { value: 'shared', label: 'SHARED' },
    { value: 'split', label: 'SPLIT SCREEN' },
  ],
  touchControls: [
    { value: 'auto', label: 'AUTO' },
    { value: 'on', label: 'ON' },
    { value: 'off', label: 'OFF' },
  ],
  buttonLabels: [
    { value: 'auto', label: 'AUTO' },
    { value: 'xbox', label: 'XBOX' },
    { value: 'nintendo', label: 'NINTENDO (A PASS)' },
    { value: 'playstation', label: 'PLAYSTATION' },
  ],
  padConfirm: [
    { value: 'auto', label: 'AUTO (A ON 8BITDO)' },
    { value: 'south', label: 'BOTTOM BUTTON' },
    { value: 'east', label: 'RIGHT BUTTON' },
  ],
  sound: [
    { value: 0, label: 'OFF' },
    { value: 0.25, label: '25%' },
    { value: 0.5, label: '50%' },
    { value: 0.75, label: '75%' },
    { value: 1, label: '100%' },
  ],
  rumble: [
    { value: true, label: 'ON' },
    { value: false, label: 'OFF' },
  ],
  venue: [
    { value: 'arena', label: 'HALLE' },
    { value: 'boni', label: 'BONIFATIUSPLATZ' },
  ],
  homeTeam: TEAM_OPTIONS,
  awayTeam: TEAM_OPTIONS,
  autoFullscreen: [
    { value: true, label: 'ON' },
    { value: false, label: 'OFF' },
  ],
  pixelPerfect: [
    { value: false, label: 'OFF' },
    { value: true, label: 'ON' },
  ],
};

export function optionLabel(key) {
  return OPTIONS[key].find((o) => o.value === settings[key])?.label ?? String(settings[key]);
}
