// Smoke test of the 3D world view (welt.html). One shared page, run in order, because starting Cesium in
// software rendering is the expensive part:
//   1. initialisation, 2. geodata and art loaded, 3. camera presets, 4. weather and surface physics,
//   5. driving the player, 6. the hockey match inside the same scene, 7. no uncaught errors anywhere.
// CesiumJS comes from node_modules (pinned, same version as welt.js) instead of the CDN; every other
// request that leaves the test server (LGLN aerial service, Open-Meteo, Google) is blocked, so the run
// does not depend on the internet. The world has to cope with that, and does.
import { test as base, expect } from '@playwright/test';
import { watch, matchInfo, colours } from './fixtures.mjs';

const CESIUM = '/node_modules/cesium/Build/Cesium/';
const GEO = ['rahmen.json', 'gebaeude.geojson', 'nutzung.geojson', 'wege.geojson', 'baeume.geojson', 'einfriedungen.geojson', 'platz.geojson', 'ausstattung.geojson', 'flaechen.geojson'];
const test = base;
test.describe.configure({ mode: 'serial' });

let context, page, watched;
const loaded = new Set();
const heading = (deg) => ((deg % 360) + 360) % 360;
const wait = (fn, message, timeout = 120_000) => expect.poll(fn, { message, timeout, intervals: [250, 500, 1000] });

test.beforeAll(async ({ browser, baseURL }) => {
  test.setTimeout(300_000);
  context = await browser.newContext({ baseURL, viewport: { width: 960, height: 600 }, serviceWorkers: 'block' });
  page = await context.newPage();
  watched = await watch(page, new URL(baseURL).origin);
  page.on('response', (r) => { if (r.ok()) loaded.add(new URL(r.url()).pathname); });
  await page.goto(`/welt.html?cesiumBase=${encodeURIComponent(CESIUM)}&sicht=schraeg`);
  await expect(page.locator('#status')).toHaveText('bereit', { timeout: 240_000 });
  await page.waitForFunction(() => !!window.welt, null, { timeout: 30_000 });
});

test.afterEach(async ({}, info) => {
  if (info.status !== info.expectedStatus) await info.attach('page', { body: await page.screenshot(), contentType: 'image/png' });
});
test.afterAll(async () => { await context?.close(); });

test('initialises: Cesium viewer, court frame, panel and no error status', async () => {
  const facts = await page.evaluate(() => ({
    status: document.getElementById('status').textContent,
    crs: window.welt.frame.crs, origin: window.welt.frame.ursprung_utm32,
    canvas: !!document.querySelector('#cesium canvas'),
    layers: window.welt.LAYERS.map((l) => l.id),
    cesium: window.Cesium?.VERSION,
  }));
  // 'bereit', or the notice that the (blocked) live aerial service was given up for the own copy
  expect(facts.status).toMatch(/^(bereit|LGLN-Dienst antwortet nicht: es gilt die eigene Kopie des Luftbilds)$/);
  expect(facts.cesium, 'the pinned CesiumJS').toBe('1.147.0');
  expect(facts.canvas, 'Cesium canvas').toBe(true);
  expect(facts.crs).toBe('EPSG:25832');
  expect(facts.origin).toHaveLength(2);
  expect(facts.layers).toEqual(expect.arrayContaining(['luftbild', 'pixelboden', 'gebaeude', 'baeume', 'platz', 'bibliothek']));
  await expect(page.locator('#tafel h1')).toHaveText('Der Boni als Welt');
});

test('the panel folds to its button and back, and the layer list folds on its own', async () => {
  const knopf = page.locator('#tafelKnopf');
  if (await page.evaluate(() => document.body.classList.contains('tafelzu'))) await knopf.click(); // a small window starts folded
  await expect(page.locator('#tafelInhalt')).toBeVisible();
  await knopf.click();
  await expect(page.locator('body')).toHaveClass(/tafelzu/);
  await expect(page.locator('#tafelInhalt')).toBeHidden();
  await expect(knopf).toBeVisible();
  await knopf.click();
  await expect(page.locator('#tafelInhalt')).toBeVisible();
  await page.locator('#ebenenKlappe > summary').click();
  await expect(page.locator('#ebenen')).toBeVisible();
  await page.locator('#ebenenKlappe > summary').click();
  await expect(page.locator('#ebenen')).toBeHidden();
});

test('loads the essential geodata and art', async () => {
  for (const f of GEO) expect(loaded, `locations/boni/geo/${f}`).toContain(`/locations/boni/geo/${f}`);
  for (const f of ['/assets/manifest.json', '/assets/welt/boni_umgebung.jpg', '/assets/intro/boni_schatten_hoehen.png']) expect(loaded, f).toContain(f);
  await wait(() => loaded.has('/assets/intro/boni_platz.glb'), 'the court model (fence and goals) loads');
  await wait(() => loaded.has('/assets/characters/skater/stride.png'), 'the approved skater sprite loads');
  await wait(() => loaded.has('/assets/world/bonifatiusplatz/plane-tree.png'), 'tree art loads');

  const count = (id) => page.evaluate((i) => window.welt.sources[i].entities.values.length, id);
  expect(await count('gebaeude'), 'ALKIS building volumes').toBeGreaterThan(20);
  expect(await count('einfriedungen'), 'fences and walls').toBeGreaterThan(0);
  await wait(() => count('baeume'), 'the tree grove is placed (mapped and derived trees)').toBeGreaterThan(10);
  await expect(page.locator('#bibliothek')).toHaveText(/^\d+ Sprites aus der Art-Bibliothek/, { timeout: 120_000 });
  const n = Number((await page.locator('#bibliothek').textContent()).match(/^\d+/)[0]);
  expect(n, 'benches and trees from the art library').toBeGreaterThan(20);
  expect(await page.evaluate(() => window.welt.hain.baeume.length), 'trees in the grove').toBeGreaterThan(30);
  await expect(page.locator('#ebenen input[type=checkbox]').first()).toBeChecked();
  expect(watched.blocked.some((u) => /lgln\.niedersachsen|open-meteo/.test(u)), 'external services were asked for and blocked, nothing else').toBe(true);
});

test('the aerial service being unreachable is handled: the live layer switches itself off, the own copy stays', async () => {
  await wait(() => page.evaluate(() => window.welt.LAYERS.find((l) => l.id === 'luftbildlive').on), 'live layer off after repeated failures').toBe(false);
  await expect(page.locator('#ebenen input[type=checkbox]').nth(1)).not.toBeChecked();
  expect(await page.evaluate(() => window.welt.LAYERS.find((l) => l.id === 'luftbild').on), 'own aerial copy stays on').toBe(true);
});

test('camera presets: game camera at 118.2° and 60° from vertical, top view straight down', async () => {
  const read = () => page.evaluate(() => { const c = window.welt.viewer.camera, d = (r) => (r * 180) / Math.PI; return { heading: d(c.heading), pitch: d(c.pitch) }; });
  await page.evaluate(() => window.welt.view('spiel'));
  let cam = await read();
  expect(heading(cam.heading)).toBeCloseTo(118.2, 0);
  expect(cam.pitch).toBeCloseTo(-30, 0);
  await page.evaluate(() => window.welt.view('oben'));
  expect((await read()).pitch).toBeCloseTo(-90, 0);
  await page.evaluate(() => window.welt.view('schraeg'));
  cam = await read();
  expect(heading(cam.heading)).toBeCloseTo(25, 0);
  expect(cam.pitch).toBeCloseTo(-38, 0);
  await page.evaluate(() => window.welt.view('platz'));
  expect((await read()).pitch).toBeCloseTo(-90, 0);
});

test('environment: weather panel, surface physics and sun shadow follow the settings', async () => {
  await expect(page.locator('#wxBtn')).toBeVisible();
  await page.locator('#wxBtn').click();
  await expect(page.locator('#wx')).toBeVisible();
  await page.locator('#wxBtn').click();

  const set = (p) => page.evaluate(async (s) => { await window.welt.umwelt.set(s); const { SURF } = await import('/src/game/surface.js'); return { label: document.getElementById('surface').textContent, grip: SURF.grip, ballDrag: SURF.ballDrag, shadow: !!globalThis.BONI_3D.shadow, shadowLit: typeof globalThis.BONI_3D.shadow?.lit, state: window.welt.umwelt.state.look }; }, p);

  const dry = await set({ mode: 'pick', look: 'sun', season: 'sommer', hour: 14, temp: 20, wind: 2 });
  expect(dry).toMatchObject({ label: 'trockener Platz', state: 'sun', shadow: true, shadowLit: 'function' });
  expect(dry.grip).toBeGreaterThan(0.95);

  const rain = await set({ look: 'rain', season: 'herbst', hour: 16, temp: 8, wind: 3 });
  expect(rain.label).toMatch(/nass/);
  expect(rain.grip, 'wet court: less grip').toBeLessThan(0.6);
  expect(rain.ballDrag, 'wet court: the ball drags').toBeGreaterThan(1.3);

  const snow = await set({ look: 'snow', season: 'winter', hour: 11, temp: -2, wind: 2 });
  expect(snow.label).toMatch(/Schnee/);
  expect(snow.grip, 'snow: very little grip').toBeLessThan(0.45);

  const night = await set({ look: 'sun', season: 'sommer', hour: 2, temp: 14, wind: 1 });
  expect(night.shadow, 'no sun shadow at night').toBe(false);
});

test('the player drives: keys move the figure, the match button shows on the court', async () => {
  await page.evaluate(() => { window.welt.spieler.zustand.ab = [0, 0]; window.welt.view('fahren'); });
  await expect(page.locator('#spielstart')).toBeVisible({ timeout: 60_000 });
  const start = await page.evaluate(() => [...window.welt.spieler.zustand.ab]);
  await page.keyboard.down('ArrowUp');
  await wait(() => page.evaluate((s) => Math.hypot(window.welt.spieler.zustand.ab[0] - s[0], window.welt.spieler.zustand.ab[1] - s[1]), start), 'the figure moved').toBeGreaterThan(0.5);
  await page.keyboard.up('ArrowUp');
  await page.evaluate(() => { window.welt.spieler.zustand.ab = [0, 0]; });
  await expect(page.locator('#spielstart')).toBeVisible();
});

test('the hockey match starts inside the world, sleeps when leaving and resumes', async () => {
  await page.locator('#spielstart').click();
  await expect(page.locator('body')).toHaveClass(/imspiel/, { timeout: 120_000 });
  // straight to the face-off: no title, no menus (src/welt/welt.js neuesMatch)
  await wait(() => page.evaluate(() => window.app?.top?.constructor?.name), 'the match starts at once on the court').toBe('RinkScene');
  expect(await page.evaluate(() => window.welt.imSpiel)).toBe(true);
  expect(await page.evaluate(() => globalThis.BONI_3D.pausiert)).toBe(false);
  await expect(page.locator('#screen')).toBeVisible();
  await wait(() => colours(page), 'the game draws its players over the world').toBeGreaterThan(6);
  await wait(async () => (await matchInfo(page)).state, 'face-off becomes live play').toBe('play');
  expect(await page.evaluate(() => window.app.top.match.sides.home.team), 'the roaming figure\'s team plays at home').toBe('borstentiere');
  const info = await matchInfo(page);
  expect(info.rinkLength, 'the real court, not the arena').toBe(22.8);
  expect(info).toMatchObject({ rosterHome: 6, goalies: 2 });   // 3 per line; on ice 4 today: known bug, tests/lineup.test.mjs

  // leaving the court puts the match to sleep: its clock stands still
  await page.locator('#verlassen').click();
  await expect(page.locator('body')).not.toHaveClass(/imspiel/);
  expect(await page.evaluate(() => globalThis.BONI_3D.pausiert)).toBe(true);
  const clock = (await matchInfo(page)).clock;
  await page.waitForTimeout(1500);
  expect((await matchInfo(page)).clock, 'the match clock stands still while away').toBe(clock);
  await expect(page.locator('#spielstart')).toBeVisible();

  // and back on the court it carries on
  await page.locator('#spielstart').click();
  await expect(page.locator('body')).toHaveClass(/imspiel/, { timeout: 60_000 });
  // the page switches at once, the match wakes after the camera has been drawn twice (slow in software rendering)
  await wait(() => page.evaluate(() => globalThis.BONI_3D.pausiert), 'the match wakes up').toBe(false);
  await wait(async () => (await matchInfo(page)).clock, 'the clock runs again').toBeLessThan(clock);

  // "Spiel beenden" in the pause menu goes back into the neighbourhood, the next visit starts a new match
  const vorher = await page.evaluate(() => window.app.top.match.ref?.clock);
  await page.evaluate(() => globalThis.BONI_3D.zurWelt());
  await expect(page.locator('body')).not.toHaveClass(/imspiel/);
  await page.locator('#spielstart').click();
  await wait(async () => (await matchInfo(page)).clock, 'a fresh match starts with a full clock').toBeGreaterThan(vorher);
});

test('no uncaught errors, console errors or HTTP errors from our own server', async () => {
  expect(watched.problems).toEqual([]);
});
