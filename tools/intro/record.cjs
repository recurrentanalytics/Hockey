// Renders the intro flight frame by frame in headless Chromium and encodes a video preview.
// Usage: node tools/intro/record.cjs [outDir] [width] [height] [fps] [query]
//   query "proxy" renders the photorealistic version (token injected by the dev proxy);
//   CESIUM_DIR=…/node_modules/cesium/Build/Cesium serves CesiumJS locally.
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const path = require('path'), fs = require('fs');
const root = path.resolve(__dirname, '../..');
const out = path.resolve(process.argv[2] || path.join(root, 'tmp-intro'));
const W = +(process.argv[3] || 1280), H = +(process.argv[4] || 720), FPS = +(process.argv[5] || 30);
const QUERY = process.argv[6] ? `?record&${process.argv[6]}${process.env.CESIUM_DIR ? '&cesiumBase=/_cesium/' : ''}` : '';
(async () => {
  fs.mkdirSync(path.join(out, 'frames'), { recursive: true });
  const port = 8765 + Math.floor(Math.random() * 200);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('console', (m) => console.log('page:', m.text()));
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  if (process.env.CESIUM_DIR) {
    await page.route((u) => u.pathname.startsWith('/_cesium/'), (route) => {
      const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace(/^.*\/_cesium\//, ''));
      route.fulfill({ path: path.join(process.env.CESIUM_DIR, rel) });
    });
  }
  await page.goto(`http://127.0.0.1:${port}/intro.html${QUERY}`);
  await page.waitForFunction('window.introReady === true', null, { timeout: 180000 });
  const dur = await page.evaluate('introDebug.duration');
  const n = Math.ceil(dur * FPS) + FPS; // plus one second hold
  for (let i = 0; i < n; i++) {
    await page.evaluate((s) => introDebug.freeze(s), i / FPS);
    if (FPS <= 2) console.log('frame', i);
    if (i === 0) await page.evaluate(() => document.querySelectorAll('#title,#go').forEach((e) => (e.style.transition = 'none')));
    await page.screenshot({ path: path.join(out, 'frames', `f${String(i).padStart(4, '0')}.png`) });
  }
  await browser.close(); srv.kill();
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(out, 'frames', 'f%04d.png'),
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', path.join(out, 'intro.mp4')]);
  console.log('video', path.join(out, 'intro.mp4'), n, 'frames');
})();
