// Shared helpers for the browser smoke tests.
//  - watch(page): blocks every request that leaves the test server (weather, LGLN aerial service, CDN)
//    so runs are deterministic, and collects what must never happen: uncaught JavaScript errors,
//    console errors and HTTP errors from our own server.
//  - game helpers: reach a match through the real menus, force a goal, read the match state.
import { test as base, expect } from '@playwright/test';

export { expect };

/** Start collecting problems on a page. Returns { problems, blocked }. */
export async function watch(page, origin) {
  const problems = [], blocked = [];
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith(origin)) return route.continue();
    blocked.push(url);
    return route.abort('blockedbyclient');
  });
  page.on('pageerror', (e) => problems.push(`uncaught error: ${e.message}`));
  // failed loads of blocked external services show up as generic "Failed to load resource" lines
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) problems.push(`console.error: ${m.text()}`); });
  page.on('response', (r) => { if (r.url().startsWith(origin) && r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  return { problems, blocked };
}

/** `test` whose page is watched; the test fails afterwards if anything went wrong in the page. */
export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const w = await watch(page, new URL(baseURL).origin);
    page.watched = w;
    await use(page);
    expect(w.problems, 'problems in the page').toEqual([]);
  },
});

const scene = (page) => page.evaluate(() => window.app?.top?.constructor?.name ?? null);

const sleep = (page, ms) => page.waitForTimeout(ms);

/**
 * Press `key` until the scene on top is `next`. A scene ignores input for its first moments (the title
 * for 0.3 s) and frames can be slow (the 3D world), so the key is pressed once and given time to take
 * effect before it is pressed again.
 */
async function advance(page, key, next) {
  for (let attempt = 0; attempt < 10; attempt++) {
    if ((await scene(page)) === next) return;
    await page.keyboard.press(key);
    for (let waited = 0; waited < 8000; waited += 200) {
      if ((await scene(page)) === next) return;
      await sleep(page, 200);
    }
  }
  expect(await scene(page), `scene ${next}`).toBe(next);
}

/**
 * Move the menu cursor down by one row. After a scene change the game ignores menu input for a moment
 * (input.suppress, counted in game time, so longer in real time when frames are slow) and a key pressed
 * then is dropped, so the key is pressed again until the cursor has moved.
 */
async function menuDown(page) {
  const before = await page.evaluate(() => window.app.top.menu.index);
  for (let attempt = 0; attempt < 8; attempt++) {
    await page.keyboard.press('ArrowDown');
    for (let waited = 0; waited < 3000; waited += 150) {
      if ((await page.evaluate(() => window.app.top.menu.index)) !== before) return;
      await sleep(page, 150);
    }
  }
  expect(await page.evaluate(() => window.app.top.menu.index), 'menu cursor moved').not.toBe(before);
}
/** Title → main menu → "GEGEN KI" → "LOS GEHTS" through the real keyboard menus; returns once the match scene is on top. */
export async function startMatchThroughMenus(page) {
  await expect.poll(() => scene(page), { message: 'title scene' }).toBe('TitleScene');
  await advance(page, 'Enter', 'MainMenuScene');
  await advance(page, 'Enter', 'MatchSetupScene'); // first entry: GEGEN KI
  for (let rows = 0; rows < 12; rows++) {
    const label = await page.evaluate(() => { const m = window.app.top.menu; return m.items[m.index].label; });
    if (label === 'LOS GEHTS') break;
    await menuDown(page);
  }
  expect(await page.evaluate(() => { const m = window.app.top.menu; return m.items[m.index].label; }), 'cursor on LOS GEHTS').toBe('LOS GEHTS');
  await advance(page, 'Enter', 'RinkScene');
}
/** Facts about the running match, read from the page. */
export const matchInfo = (page) => page.evaluate(async () => {
  const m = window.app.top.match, { RINK } = await import('/src/config.js');
  const side = (k) => m.skaters.filter((s) => s.sideKey === k).length;
  return { state: m.state, home: side('home'), away: side('away'), rosterHome: m.roster.filter((s) => s.sideKey === 'home').length,
    goalies: m.goalies.length, score: { ...m.score }, rinkLength: RINK.length, clock: m.ref?.clock ?? null, ruleset: m.ref?.r.id ?? null };
});

/**
 * Make the home side score once, whatever else happens. Whenever play is live (not during a whistle, a
 * face-off or a break, where nothing counts) the ball is put into the net the home side attacks, with the
 * goalies held back for a moment; this repeats until the home score has gone up by one.
 */
export async function scoreHomeGoal(page) {
  const before = await page.evaluate(() => window.app.top.match.score.home);
  await expect.poll(() => page.evaluate(async (start) => {
    const m = window.app.top.match, p = m.puck, { RINK } = await import('/src/config.js');
    if (m.score.home > start) return m.score.home - start;
    if (m.state === 'play') {
      const a = m.sides.home.attack;
      for (const g of m.goalies) g.clearT = 5;
      for (const s of m.skaters) s.hasPuck = false;
      p.carrier = null; p.holder = null;
      p.pos.x = a * (RINK.goalLineX + 0.3); p.pos.y = 0; p.z = 0.05; p.vel.x = 0; p.vel.y = 0; p.vz = 0;
      p.mouth = { [a]: true };
    }
    return 0;
  }, before), { message: 'a home goal counts', timeout: 90_000, intervals: [250, 500] }).toBe(1);
}
/** Jump to the last seconds of the last period. */
export const nearFinalWhistle = (page) => page.evaluate(() => { const r = window.app.top.match.ref; r.period = r.r.periods; r.clock = 2; });

/**
 * How many distinct (coarse) colours a canvas shows, read back at 64×40. A picture has well over 6;
 * a blank or cleared canvas has 1. Use as `expect.poll(() => colours(page, sel)).toBeGreaterThan(6)`,
 * so a failure reports the number it saw.
 */
export const colours = (page, selector = '#screen') => page.evaluate((sel) => {
  const c = document.querySelector(sel);
  if (!c || !c.width || !c.height) return -1;
  const t = document.createElement('canvas'); t.width = 64; t.height = 40;
  const x = t.getContext('2d'); x.drawImage(c, 0, 0, 64, 40);
  const d = x.getImageData(0, 0, 64, 40).data, seen = new Set();
  for (let i = 0; i < d.length; i += 4) seen.add(`${d[i] >> 4},${d[i + 1] >> 4},${d[i + 2] >> 4},${d[i + 3] >> 6}`);
  return seen.size;
}, selector);
