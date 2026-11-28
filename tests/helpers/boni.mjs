// Import this before ./headless.mjs: the game then runs with the real Boni court rules and sizes
// (globalThis.BONI_3D, as on welt.html and test.html) instead of the 60 × 30 m arena.
globalThis.BONI_3D ??= {};
