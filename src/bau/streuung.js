// Stable pseudo-randomness from a name: the same house or tree gets the same choice on every run and in every tool.
/** Stable pseudo-random number in [0, 1) from a string (FNV-1a): same tree, same result, every run. */
export function streuung(text, salz = '') {
  let h = 0x811c9dc5;
  for (const ch of salz + text) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) / 4294967296;
}
