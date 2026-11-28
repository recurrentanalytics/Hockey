// Global tuning. World units: metres and seconds.
// x runs along the rink (left → right on screen), y runs across it
// (far boards → near boards), z is height.

export const VIEW = {
  baseHeight: 216,   // internal pixel height of the UI layer
  minWidth: 288,     // internal width adapts to the screen's aspect ratio
  maxWidth: 480,
};

// Oblique "broadcast camera" projection, in pixels per metre.
export const PROJ = { x: 16, y: 8, z: 14 };
// The world layer is rendered at RES× its logical resolution: rink art keeps its size,
// while players, goalies, sticks and the ball are drawn with RES× the detail.
export const RES = 2;

// Played on the real Boni court (welt.html → "Spiel starten", or test.html): the photorealistic 3D view is the
// backdrop and the game is drawn on top. The intro sets globalThis.BONI_3D before loading the game.
export const BONI_3D = !!globalThis.BONI_3D;

const ARENA_RINK = {
  length: 60,
  width: 30,
  cornerRadius: 7.5,
  goalLineX: 26,        // goal lines at x = ±26
  boardHeight: 1.0,
  centerCircleRadius: 3,
  endCircle: { x: 19, y: 7, r: 3 },
  creaseRadius: 1.8,
};

// Real court inside the fence (25.2 m × 18 m): end walls at the fronts of the football-goal cages,
// street-hockey goals 9.2 m from the centre (tools/intro/court_glb.py).
const BONI_RINK = {
  length: 22.8,
  width: 17.2,
  cornerRadius: 1.0,
  goalLineX: 9.2,
  boardHeight: 1.0,
  centerCircleRadius: 3,
  endCircle: { x: 6.2, y: 4.2, r: 2 },
  creaseRadius: 1.2,
};
export const RINK = BONI_3D ? BONI_RINK : ARENA_RINK;

export const GOAL = BONI_3D ? { width: 1.37, height: 1.12, depth: 0.6 } : { width: 1.83, height: 1.22, depth: 1.0 };

// Skating feel. grip: how fast sideways drift dies when steering (no "soap"); brakeDrag: how fast
// a skater stops without input. On the small real court everything runs ~25 % slower so the
// game stays wild but readable.
const ARENA_SKATE = {
  radius: 0.4,
  accel: 15,
  maxSpeed: 7.5,
  sprintSpeed: 9.5,
  glideDrag: 0.5,
  brakeDrag: 3.2,
  grip: 4.5,
  boardBounce: 0.25,
};
const BONI_SKATE = { ...ARENA_SKATE, accel: 13, maxSpeed: 5.7, sprintSpeed: 7.2, glideDrag: 0.7, brakeDrag: 4.4, grip: 7.5, boardBounce: 0.2 };
export const SKATE = BONI_3D ? BONI_SKATE : ARENA_SKATE;

const ARENA_SHOT = { minSpeed: 13, maxSpeed: 32, chargeTime: 0.9, minLift: 1.5, maxLift: 3.8 };
// shots are a little slower on the small real court
export const SHOT = BONI_3D ? { ...ARENA_SHOT, minSpeed: ARENA_SHOT.minSpeed * 0.82, maxSpeed: ARENA_SHOT.maxSpeed * 0.8 } : ARENA_SHOT;

export const TIMING = { step: 1 / 60, maxFrame: 0.25 };

// Made-up teams; real clubs are deliberately not used.
export const TEAMS = {
  // The real club from Hannover-List: kids' section and the adults' "Balding Borstis".
  borstentiere: { name: 'BORSTENTIERE', full: 'BONI BORSTENTIERE', main: '#3f7d47', shade: '#2a5a33', trim: '#e88a4a', stripe: '#f7e9c0', helmet: '#2d4a2b', helmetShade: '#1e3a1c', pants: '#3d2817', pantsShade: '#2a1b10', wheel: '#e88a4a', animal: 'boar', numbers: [61, 7, 10, 8, 4, 3, 22, 33] },
  borstis:      { name: 'BORSTIS', full: 'BALDING BORSTIS', main: '#35553a', shade: '#223823', trim: '#f7e9c0', stripe: '#d97b3a', helmet: '#2d4a2b', helmetShade: '#1e3a1c', pants: '#6b4423', pantsShade: '#4a2e17', wheel: '#d97b3a', animal: 'boarGlasses', bald: true, numbers: [18, 40, 50, 99, 44, 66, 77, 55] },
  blazers: { name: 'BLAZERS', full: 'BLAZERS', main: '#ff5e7a', shade: '#c93c62', trim: '#ffd35c', helmet: '#ff5e7a', helmetShade: '#c93c62', pants: '#4a2c5c', pantsShade: '#33203f', wheel: '#ffd35c', animal: 'fox' },
  waves:   { name: 'WAVES',   full: 'WAVES',   main: '#4f8dff', shade: '#3159bf', trim: '#fffaf4', helmet: '#9fdcff', helmetShade: '#5fa9e6', pants: '#2c3a6e', pantsShade: '#1e2850', wheel: '#9fdcff', animal: 'seal' },
  vipers:  { name: 'VIPERS',  full: 'VIPERS',  main: '#5ad48b', shade: '#2f9663', trim: '#2a1f3d', helmet: '#5ad48b', helmetShade: '#2f9663', pants: '#2d4a3a', pantsShade: '#1f3529', wheel: '#ff9fc4', animal: 'snake' },
  storm:   { name: 'STORM',   full: 'STORM',   main: '#a67cff', shade: '#7552cc', trim: '#ffd35c', helmet: '#ffd35c', helmetShade: '#d9a733', pants: '#3e2c66', pantsShade: '#2a1e47', wheel: '#ffd35c', animal: 'owl' },
};
// Away kits for the two club teams (they share colours): cream with green and orange.
TEAMS.borstentiere_away = { ...TEAMS.borstentiere, main: '#f7e9c0', shade: '#dccb98', trim: '#3f7d47', stripe: '#e88a4a', hidden: true };
TEAMS.borstis_away = { ...TEAMS.borstis, main: '#f7e9c0', shade: '#dccb98', trim: '#35553a', stripe: '#d97b3a', hidden: true };
for (const [key, t] of Object.entries(TEAMS)) t.key = key;

/** Same club family (for the centre logo, the hymn and kit clashes). */
export const isBoarTeam = (key) => (TEAMS[key]?.animal ?? '').startsWith('boar');export const PLAYER_COLORS = ['#ffd35c', '#9fdcff'];
