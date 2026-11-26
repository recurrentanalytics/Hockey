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

export const RINK = {
  length: 60,
  width: 30,
  cornerRadius: 7.5,
  goalLineX: 26,        // goal lines at x = ±26
  boardHeight: 1.0,
  centerCircleRadius: 3,
  endCircle: { x: 19, y: 7, r: 3 },
  creaseRadius: 1.8,
};

export const GOAL = { width: 1.83, height: 1.22, depth: 1.0 };

export const SKATE = {
  radius: 0.4,
  accel: 15,
  maxSpeed: 7.5,
  sprintSpeed: 9.5,
  glideDrag: 0.5,
  brakeDrag: 2.6,
  boardBounce: 0.25,
};

export const SHOT = { minSpeed: 13, maxSpeed: 32, chargeTime: 0.9, minLift: 1.5, maxLift: 3.8 };

export const TIMING = { step: 1 / 60, maxFrame: 0.25 };

// Made-up teams; real clubs are deliberately not used.
export const TEAMS = {
  blazers: { name: 'BLAZERS', main: '#ff5e7a', shade: '#c93c62', trim: '#ffd35c', helmet: '#ff5e7a', helmetShade: '#c93c62', pants: '#4a2c5c', pantsShade: '#33203f', wheel: '#ffd35c' },
  waves:   { name: 'WAVES',   main: '#4f8dff', shade: '#3159bf', trim: '#fffaf4', helmet: '#9fdcff', helmetShade: '#5fa9e6', pants: '#2c3a6e', pantsShade: '#1e2850', wheel: '#9fdcff' },
  vipers:  { name: 'VIPERS',  main: '#5ad48b', shade: '#2f9663', trim: '#2a1f3d', helmet: '#5ad48b', helmetShade: '#2f9663', pants: '#2d4a3a', pantsShade: '#1f3529', wheel: '#ff9fc4' },
  storm:   { name: 'STORM',   main: '#a67cff', shade: '#7552cc', trim: '#ffd35c', helmet: '#ffd35c', helmetShade: '#d9a733', pants: '#3e2c66', pantsShade: '#2a1e47', wheel: '#ffd35c' },
};
export const PLAYER_COLORS = ['#ffd35c', '#9fdcff'];
