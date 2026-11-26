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

export const SHOT = { minSpeed: 13, maxSpeed: 32, chargeTime: 0.9, minLift: 0.5, maxLift: 3.6 };

export const TIMING = { step: 1 / 60, maxFrame: 0.25 };

// Made-up teams; real clubs are deliberately not used.
export const TEAMS = {
  blazers: { name: 'BLAZERS', main: '#d23c3c', shade: '#8a1f2b', trim: '#f4c24f', helmet: '#26283c', helmetShade: '#14151f', pants: '#26283c', pantsShade: '#14151f' },
  waves:   { name: 'WAVES',   main: '#2f63d0', shade: '#1c3578', trim: '#f5f6fb', helmet: '#f5f6fb', helmetShade: '#c8cde3', pants: '#1c2340', pantsShade: '#10142a' },
  vipers:  { name: 'VIPERS',  main: '#3f9f4a', shade: '#22602c', trim: '#0e0f1a', helmet: '#0e0f1a', helmetShade: '#05060c', pants: '#0e0f1a', pantsShade: '#05060c' },
  storm:   { name: 'STORM',   main: '#8a4fc4', shade: '#4f2b78', trim: '#f4c24f', helmet: '#f4c24f', helmetShade: '#c08a2a', pants: '#2b1b45', pantsShade: '#180f28' },
};

export const PLAYER_COLORS = ['#f4c24f', '#7fe0ff'];
