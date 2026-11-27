// Automated play-through of the classic game (index.html?debug) on several screen sizes:
// menus, a match with steering input, forced goals (goal burst, Bonny, slow motion, replay) and
// the final whistle. Prints page errors; saves screenshots. Usage: node tools/test/playthrough.cjs <outDir>
const { chromium } = require('playwright'); const { spawn } = require('child_process'); const path = require('path');
const out = process.argv[2] || 'tmp-test';
const SIZES = [['tablet', 1280, 800], ['phone', 844, 390], ['phone-portrait', 390, 844]];
(async () => {
  require('fs').mkdirSync(out, { recursive: true });
  const port = 8300 + Math.floor(Math.random() * 90);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch();
  let errors = 0;
  for (const [name, w, h] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => { errors++; console.log(name, 'pageerror', e.message); });
    await p.goto(`http://127.0.0.1:${port}/index.html?debug`); await p.waitForTimeout(1500);
    for (const k of ['Enter', 'Enter', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Enter']) { await p.keyboard.press(k); await p.waitForTimeout(250); }
    await p.waitForTimeout(2500);
    // steer around and shoot for a few seconds (player 2 keys = arrows + numpad)
    for (const k of ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown']) { await p.keyboard.down(k); await p.waitForTimeout(700); await p.keyboard.press('Numpad1'); await p.keyboard.up(k); }
    await p.screenshot({ path: `${out}/${name}-1-play.png` });
    // force a home goal: put the ball into the goal the home team attacks
    const goal = async (lineX) => p.evaluate((gx) => {
      const m = window.__app.top.match, pk = m.puck, a = m.sides.home.attack;
      pk.holder = null; pk.pos.x = a * (gx - 0.4); pk.pos.y = 0; pk.z = 0.05; pk.vel.x = a * 9; pk.vel.y = 0; pk.vz = 0;
    }, lineX);
    await goal(26); await p.waitForTimeout(700);
    await p.screenshot({ path: `${out}/${name}-2-goal.png` });
    await p.waitForTimeout(7000);
    await p.screenshot({ path: `${out}/${name}-3-after.png` });
    // jump to the end of the last period
    await p.evaluate(() => { const r = window.__app.top.match.ref; r.period = r.r.periods; r.clock = 2; });
    await p.waitForTimeout(6000);
    await p.screenshot({ path: `${out}/${name}-4-final.png` });
    await ctx.close();
  }
  console.log('page errors', errors);
  await b.close(); srv.kill();
})();
