// Art assets from assets/manifest.json (see docs/art/README.md).
// They load in the background: until an asset has arrived, and wherever none exists,
// the game keeps drawing its built-in code-drawn sprite.
//
// Only assets the project owner has approved (`approved` in the manifest) are used.
// Open the game with ?preview=art to see the ones still waiting for approval as well.

const loaded = new Map();

/** A loaded asset ({ ...manifest entry, img }) or null. */
export function asset(id) {
  return loaded.get(id) ?? null;
}

export async function loadAssets(base = 'assets/') {
  try {
    const res = await fetch(`${base}manifest.json`);
    if (!res.ok) return;
    const manifest = await res.json();
    const preview = new URLSearchParams(globalThis.location?.search ?? '').get('preview') === 'art';
    const usable = manifest.assets.filter((entry) => entry.approved || preview);
    await Promise.all(usable.map((entry) => new Promise((done) => {
      const img = new Image();
      img.onload = () => { loaded.set(entry.id, { ...entry, img }); done(); };
      img.onerror = done; // a missing file just leaves the built-in sprite in place
      img.src = base + entry.file;
    })));
  } catch {
    /* no asset library: built-in sprites only */
  }
}
