// Leistung der Weltansicht (welt.html?haeuser=neu): feste Kamerafahrt um den Platz, Bilddauer je Variante.
// Misst, welcher Teil der Welt wie viel kostet. Unter Software-Rendering (Headless ohne Grafikkarte) sagen
// die absoluten Zahlen wenig, die Verhältnisse zwischen den Varianten schon.
//
// Aufruf: node tools/test/welt-leistung.cjs [--json datei]
//   CESIUM_DIR=…/node_modules/cesium/Build/Cesium   CesiumJS lokal statt vom CDN (wie tools/intro/record.cjs)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');

const args = process.argv.slice(2);
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const VARIANTEN = [
  ['alles', {}],
  ['ohne Häuser', { haeuser: false }],
  ['ohne Bäume und Bibliothek', { baeume: false, bibliothek: false }],
  ['nur Boden', { haeuser: false, baeume: false, bibliothek: false, einfriedungen: false, platzmarken: false }],
];

(async () => {
  const port = 8800 + Math.floor(Math.random() * 300);
  const srv = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '../..'), stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: 'block' })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  if (process.env.CESIUM_DIR) {
    await page.route((u) => u.pathname.startsWith('/_cesium/'), (r) => r.fulfill({ path: path.join(process.env.CESIUM_DIR, decodeURIComponent(new URL(r.request().url()).pathname.replace(/^.*\/_cesium\//, ''))) }));
  }
  await page.goto(`http://127.0.0.1:${port}/welt.html?sicht=schraeg&haeuser=neu${process.env.CESIUM_DIR ? '&cesiumBase=/_cesium/' : ''}`);
  await page.waitForFunction(() => window.welt?.viewer && window.welt.haeuser?.primitive?.ready, null, { timeout: 300000 });
  await page.waitForTimeout(15000); // sprites, ground and trees load in the background

  const ergebnis = {};
  for (const [name, aus] of VARIANTEN) {
    ergebnis[name] = await page.evaluate(async (aus) => {
      const w = window.welt, { viewer, Cesium } = w, sc = viewer.scene;
      const zeigen = (id, an) => { if (id === 'haeuser') { if (w.haeuser?.primitive) w.haeuser.primitive.show = an; } else if (w.sources[id]) w.sources[id].show = an; };
      for (const id of ['haeuser', 'baeume', 'bibliothek', 'einfriedungen', 'platzmarken']) zeigen(id, !(id in aus));
      // a fixed orbit round the court: 6 s, one turn of 90°, every frame drawn
      const ziel = w.pos(w.frame.ursprung_utm32, 0), t = [];
      const off = sc.postRender.addEventListener(() => t.push(performance.now()));
      const start = performance.now();
      await new Promise((fertig) => {
        const schritt = () => {
          const k = (performance.now() - start) / 6000;
          viewer.camera.lookAt(ziel, new Cesium.HeadingPitchRange(Cesium.Math.toRadians(20 + 90 * k), Cesium.Math.toRadians(-35), 160));
          sc.requestRender();
          if (k < 1) requestAnimationFrame(schritt); else fertig();
        };
        schritt();
      });
      off();
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
      for (const id of ['haeuser', 'baeume', 'bibliothek', 'einfriedungen', 'platzmarken']) zeigen(id, true);
      const d = t.slice(1).map((x, i) => x - t[i]).sort((a, b) => a - b);
      const q = (p) => d[Math.min(d.length - 1, Math.floor(p * (d.length - 1)))];
      return { bilder: t.length, medianMs: Math.round(q(0.5)), p90Ms: Math.round(q(0.9)) };
    }, aus);
    console.log(name.padEnd(28), JSON.stringify(ergebnis[name]));
  }
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(ergebnis, null, 1));
  console.log('Seitenfehler:', errors.length ? errors.slice(0, 3).join(' | ') : 'keine');
  await browser.close(); srv.kill();
})();
