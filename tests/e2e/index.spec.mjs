// Smoke test of the classic hall (index.html): the title screen, the real menus, a 4-on-4 match with
// goalies, a goal and the final whistle, without a single uncaught error.
import { test, expect, startMatchThroughMenus, matchInfo, scoreHomeGoal, nearFinalWhistle, colours } from './fixtures.mjs';

test('hall: title, menus, a match, a goal and the final whistle', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('#screen')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.app?.top?.constructor?.name)).toBe('TitleScene');
  await expect.poll(() => colours(page), { message: 'the title screen is drawn' }).toBeGreaterThan(6);
  expect(await page.evaluate(() => !!globalThis.BONI_3D), 'the hall runs without the 3D bridge').toBe(false);

  await startMatchThroughMenus(page);
  await expect.poll(async () => (await matchInfo(page)).state, { message: 'face-off becomes live play' }).toBe('play');
  const info = await matchInfo(page);
  expect(info).toMatchObject({ home: 4, away: 4, rosterHome: 8, goalies: 2, score: { home: 0, away: 0 } });
  expect(info.rinkLength, 'arena rink').toBe(60);
  expect(info.ruleset).toBeTruthy();
  await expect.poll(() => colours(page), { message: 'the match is drawn' }).toBeGreaterThan(6);

  // steer a little: the controlled skater must move
  const before = await page.evaluate(() => { const s = window.app.top.match.humans[0].skater; return [s.pos.x, s.pos.y]; });
  await page.keyboard.down('KeyD'); await page.waitForTimeout(900); await page.keyboard.up('KeyD');
  const after = await page.evaluate(() => { const s = window.app.top.match.humans[0].skater; return [s.pos.x, s.pos.y]; });
  expect(Math.hypot(after[0] - before[0], after[1] - before[1]), 'the skater moved').toBeGreaterThan(0.3);

  await scoreHomeGoal(page);

  await nearFinalWhistle(page);
  await expect.poll(async () => (await matchInfo(page)).state, { timeout: 90_000, message: 'final whistle' }).toBe('final');
  expect(await page.evaluate(() => window.app.top.match.ref.result), 'the match has a result').toBeTruthy();
});
