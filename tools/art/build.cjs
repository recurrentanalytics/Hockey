#!/usr/bin/env node
// Boni Ligne-claire art pipeline: renders every job in tools/art/jobs.json with the game's
// own vector renderer in headless Chromium, checks the result, retries with targeted fixes,
// writes PNG + WebP, sprite sheet data, a versioned manifest, a QA report and a gallery.
//
//   node tools/art/build.cjs            build everything
//   node tools/art/build.cjs bonny_side build selected jobs
//
// Needs only Node and Playwright with Chromium (preinstalled here; elsewhere:
// `npm i -D playwright && npx playwright install chromium`). No API keys, no network.
const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '../..');
const JOBS = JSON.parse(fs.readFileSync(path.join(__dirname, 'jobs.json'), 'utf8'));
const OUT = path.join(ROOT, 'assets/art');
const MAX_ATTEMPTS = 3;

// Thresholds for automatic quality control.
const QA = {
  maxPartialRatio: 0.22,       // anti-aliased pixels vs all visible pixels (halo detection)
  minOutlineDark: 0.85,        // silhouette edge must be ink-dark
  minPalette: 0.95,            // pixels on palette (or ink/colour blends)
  minPaletteScene: 0.88,
  minDetail: 0.02,             // edge density of a scene
  maxGroundSpread: 4,          // px: skates stay on the ground through the cycle
  minFrameIoU: 0.5,            // neighbouring frames must overlap (no popping)
  maxFrameIoU: 0.995,          // …but must differ (it really animates)
  heightTolerance: 0.15,       // views of one character: similar height
  minColorSimilarity: 0.75,    // views of one character: similar key colours
};
const KEY_COLORS = ['jersey', 'fur', 'helmet', 'cream', 'orange', 'snout', 'muzzle', 'wheel', 'pants'];

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.css': 'text/css' };
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const dataUrlBuf = (u) => Buffer.from(u.split(',')[1], 'base64');

function sourceHash() {
  const files = ['src/art/bible.js', 'src/art/scene.js', 'src/world/toon/ink.js', 'src/world/toon/bonny.js', 'tools/art/render.js', 'tools/art/jobs.json'];
  return sha(Buffer.concat(files.map((f) => fs.readFileSync(path.join(ROOT, f)))));
}

function cosine(a, b) {
  let ab = 0, aa = 0, bb = 0;
  for (const k of KEY_COLORS) { const x = a[k] ?? 0, y = b[k] ?? 0; ab += x * y; aa += x * x; bb += y * y; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

/** Evaluate one result; returns { pass, checks[], fix } where fix is a targeted retry hint. */
function evaluate(job, qa, refs) {
  const checks = [];
  const add = (name, pass, value, limit) => checks.push({ name, pass, value: typeof value === 'number' ? +value.toFixed(4) : value, limit });
  let fix = null;
  for (const c of job.checks) {
    if (c === 'transparency') {
      add('Nicht abgeschnitten (Rand frei)', qa.borderHits === 0, qa.borderHits, 0);
      add('Saubere Freistellung (wenig Halbtransparenz)', qa.partialRatio <= QA.maxPartialRatio, qa.partialRatio, QA.maxPartialRatio);
      add('Motiv vorhanden', qa.coverage > 0.02, qa.coverage, '> 0.02');
      if (qa.borderHits > 0) fix = 'shrink';
    } else if (c === 'outline') {
      add('Geschlossene Tuschekontur', qa.outlineDarkRatio >= QA.minOutlineDark, qa.outlineDarkRatio, QA.minOutlineDark);
    } else if (c === 'palette') {
      const min = job.type === 'scene' || job.type === 'composite' ? QA.minPaletteScene : QA.minPalette;
      add('Farben aus der Palette', qa.paletteConformity >= min, qa.paletteConformity, min);
    } else if (c === 'opaque') {
      add('Deckend (Hintergrund)', qa.coverage === 1, qa.coverage, 1);
    } else if (c === 'detail') {
      add('Detailreichtum', qa.edgeDensity >= QA.minDetail, qa.edgeDensity, QA.minDetail);
    } else if (c === 'animation') {
      const clipped = qa.frames.some((f) => f.borderHits > 0);
      add('Alle Frames vollständig', !clipped, clipped ? 'abgeschnitten' : 'ok', 'ok');
      add('Bodenkontakt stabil', qa.groundSpread <= QA.maxGroundSpread, qa.groundSpread, QA.maxGroundSpread);
      const lo = Math.min(...qa.iouNext), hi = Math.max(...qa.iouNext);
      add('Kein Springen zwischen Frames', lo >= QA.minFrameIoU, lo, QA.minFrameIoU);
      add('Echte Bewegung', hi <= QA.maxFrameIoU, hi, QA.maxFrameIoU);
      if (clipped) fix = 'shrink';
    } else if (c.startsWith('character:')) {
      const ch = c.split(':')[1];
      for (const k of ['jersey', 'fur', 'helmet']) add(`Pflichtfarbe ${k}`, (qa.hist[k] ?? 0) > 0.01, qa.hist[k] ?? 0, '> 0.01');
      const ref = refs[ch];
      if (ref && ref !== qa) {
        const sim = cosine(qa.hist, ref.hist);
        add('Farbkonsistenz zur Referenz', sim >= QA.minColorSimilarity, sim, QA.minColorSimilarity);
        if (['front', 'back', 'side'].includes(job.spec.view) && !job.spec.pose?.match(/skate|shot|cheer/)) {
          const dh = Math.abs(qa.bbox.h - ref.bbox.h) / ref.bbox.h;
          add('Gleiche Figurengröße wie Referenz', dh <= QA.heightTolerance, dh, QA.heightTolerance);
        }
      }
    }
  }
  return { pass: checks.every((x) => x.pass), checks, fix };
}

(async () => {
  const only = process.argv.slice(2);
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${base}/tools/art/render.html`);
  await page.waitForFunction(() => window.artReady, null, { timeout: 30000 });
  const style = await page.evaluate(() => window.ArtPipeline.style);
  const version = `v${style.version}`;
  const srcHash = sourceHash();

  const manifest = { pipeline: JOBS.pipeline, pipelineVersion: JOBS.version, style: style.name, styleVersion: style.version, sourceHash: srcHash, built: new Date().toISOString(), assets: [] };
  const report = { built: manifest.built, thresholds: QA, results: [], errors };
  const refs = {};
  // reference views first, so the others can be compared with them
  const jobs = [...JOBS.jobs].sort((a, b) => (b.reference ? 1 : 0) - (a.reference ? 1 : 0)).filter((j) => !only.length || only.includes(j.id));

  for (const job of jobs) {
    let spec = { ...job.spec }, result, ev, attempt = 0;
    const attempts = [];
    while (attempt < MAX_ATTEMPTS) {
      attempt++;
      result = await page.evaluate(([type, s]) => window.ArtPipeline[type](s), [job.type, spec]);
      if (job.reference) for (const c of job.checks.filter((x) => x.startsWith('character:'))) refs[c.split(':')[1]] = result.qa;
      ev = evaluate(job, result.qa, refs);
      attempts.push({ attempt, scale: spec.scale, pass: ev.pass, failed: ev.checks.filter((c) => !c.pass).map((c) => c.name) });
      if (ev.pass || !ev.fix) break;
      if (ev.fix === 'shrink') spec = { ...spec, scale: +(spec.scale * 0.9).toFixed(3) };   // targeted re-render
    }
    const dir = path.join(OUT, version, job.category);
    fs.mkdirSync(dir, { recursive: true });
    const png = dataUrlBuf(result.png), webp = dataUrlBuf(result.webp);
    const base = path.join(dir, job.id);
    fs.writeFileSync(`${base}.png`, png);
    fs.writeFileSync(`${base}.webp`, webp);
    const rel = (p) => path.relative(OUT, p).split(path.sep).join('/');
    const entry = {
      id: job.id, type: job.type, title: job.title, category: job.category,
      png: rel(`${base}.png`), webp: rel(`${base}.webp`),
      width: result.qa.width, height: result.qa.height, bytes: { png: png.length, webp: webp.length },
      sha256: sha(png), spec, qa: ev.pass ? 'bestanden' : 'nicht bestanden',
    };
    if (job.type === 'figure') entry.anchor = { x: spec.anchor[0], y: spec.anchor[1] };
    if (job.type === 'sheet') {
      entry.frames = result.qa.frames.map((f) => ({ x: f.x, y: f.y, w: f.w, h: f.h }));
      entry.anchor = { x: spec.anchor[0], y: spec.anchor[1] };
      entry.fps = spec.fps;
      fs.writeFileSync(`${base}.json`, JSON.stringify({ image: path.basename(`${base}.png`), frames: entry.frames, anchor: entry.anchor, fps: spec.fps }, null, 2));
      entry.sheet = rel(`${base}.json`);
    }
    manifest.assets.push(entry);
    report.results.push({ id: job.id, title: job.title, pass: ev.pass, attempts, checks: ev.checks });
    console.log(`${ev.pass ? 'OK  ' : 'FAIL'} ${job.id.padEnd(20)} ${attempts.length} Versuch(e)  ${(png.length / 1024).toFixed(0)} KB PNG / ${(webp.length / 1024).toFixed(0)} KB WebP`);
  }

  // keep the order of jobs.json in the outputs
  const order = JOBS.jobs.map((j) => j.id);
  manifest.assets.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  report.results.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  report.pass = report.results.every((r) => r.pass) && !errors.length;
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(OUT, 'qa-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(OUT, 'gallery.html'), gallery(manifest, report, style));
  console.log(report.pass ? '\nQualitätskontrolle bestanden.' : '\nQualitätskontrolle NICHT bestanden – siehe assets/art/qa-report.json');
  if (errors.length) console.log('Fehler im Renderer:', errors);
  await browser.close();
  server.close();
  process.exit(report.pass ? 0 : 1);
})();

// ------------------------------------------------------------------ gallery

function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

function gallery(manifest, report, style) {
  const res = Object.fromEntries(report.results.map((r) => [r.id, r]));
  const swatches = Object.entries(style.palette).filter(([, c]) => /^#/.test(c)).map(([n, c]) => `<div class="sw"><i style="background:${c}"></i><span>${esc(n)}</span></div>`).join('');
  const cards = manifest.assets.map((a) => {
    const r = res[a.id];
    const checks = r.checks.map((c) => `<li class="${c.pass ? 'ok' : 'bad'}">${c.pass ? '✔' : '✘'} ${esc(c.name)} <small>${esc(c.value)} (Grenze ${esc(c.limit)})</small></li>`).join('');
    const wide = a.type === 'scene' || a.type === 'composite';
    const media = a.type === 'sheet'
      ? `<div class="anim" data-sheet="${esc(a.png)}" data-w="${a.frames[0].w}" data-h="${a.frames[0].h}" data-n="${a.frames.length}" data-fps="${a.fps}"></div><img class="strip" src="${esc(a.png)}" alt="${esc(a.title)}">`
      : `<img src="${esc(a.png)}" alt="${esc(a.title)}">`;
    return `<article class="card ${wide ? 'wide' : ''} ${a.type === 'scene' || a.type === 'composite' ? '' : 'checker'}">
      <header><h3>${esc(a.title)}</h3><span class="badge ${r.pass ? 'ok' : 'bad'}">${r.pass ? 'QA bestanden' : 'QA nicht bestanden'}</span></header>
      <div class="media">${media}</div>
      <p class="meta">${a.width}×${a.height} px · PNG ${(a.bytes.png / 1024).toFixed(0)} KB · WebP ${(a.bytes.webp / 1024).toFixed(0)} KB · ${r.attempts.length} Versuch(e) · <code>${esc(a.png)}</code></p>
      <details><summary>Prüfergebnisse</summary><ul>${checks}</ul></details>
    </article>`;
  }).join('\n');
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Boni Art-Galerie</title>
<style>
  :root { --paper:#f4ecd8; --ink:#16110d; --green:#1f5a33; --orange:#d2642a; --ok:#2e7d32; --bad:#c62828; }
  body { margin:0; background:var(--paper); color:var(--ink); font:15px/1.5 system-ui, sans-serif; }
  header.top { padding:24px 16px 8px; max-width:1200px; margin:0 auto; }
  h1 { margin:0; color:var(--green); font-size:30px; letter-spacing:.5px; }
  .sub { color:#5a4a3a; }
  .summary { display:inline-block; margin-top:8px; padding:4px 12px; border-radius:20px; color:#fff; background:${report.pass ? 'var(--ok)' : 'var(--bad)'}; font-weight:700; }
  main { max-width:1200px; margin:0 auto; padding:8px 16px 40px; display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:16px; }
  .card { background:#fffaf0; border:2px solid var(--ink); border-radius:10px; padding:10px; display:flex; flex-direction:column; gap:8px; }
  .card.wide { grid-column:1/-1; }
  .card header { display:flex; justify-content:space-between; gap:8px; align-items:center; }
  .card h3 { margin:0; font-size:16px; }
  .badge { font-size:12px; padding:2px 8px; border-radius:12px; color:#fff; white-space:nowrap; }
  .badge.ok { background:var(--ok); } .badge.bad { background:var(--bad); }
  .media { display:flex; flex-direction:column; align-items:center; gap:6px; border-radius:6px; overflow:hidden; }
  .checker .media { background:repeating-conic-gradient(#e9e2cf 0% 25%, #fbf6ea 0% 50%) 0 0/20px 20px; }
  .media img { max-width:100%; height:auto; display:block; }
  .strip { border-top:1px dashed #b9ab8c; }
  .meta { margin:0; font-size:12px; color:#5a4a3a; word-break:break-all; }
  ul { margin:6px 0 0; padding-left:18px; font-size:13px; } li.ok { color:var(--ok); } li.bad { color:var(--bad); } small { color:#6b5d4d; }
  .palette { max-width:1200px; margin:0 auto; padding:0 16px 8px; display:flex; flex-wrap:wrap; gap:6px; }
  .sw { display:flex; align-items:center; gap:4px; font-size:11px; } .sw i { width:16px; height:16px; border:1px solid var(--ink); border-radius:3px; display:inline-block; }
  .anim { image-rendering:auto; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --paper:#1d1915; --ink:#efe6d2; } :root:not([data-theme="light"]) .card { background:#2a241e; } }
</style></head>
<body>
<header class="top">
  <h1>Boni Art-Galerie</h1>
  <div class="sub">${esc(style.name)} · Stil-Version ${style.version} · Pipeline ${esc(manifest.pipelineVersion)} · erzeugt ${esc(manifest.built)}</div>
  <div class="summary">${report.pass ? 'Qualitätskontrolle bestanden' : 'Qualitätskontrolle nicht bestanden'} · ${report.results.filter((r) => r.pass).length}/${report.results.length} Assets</div>
</header>
<section class="palette">${swatches}</section>
<main>
${cards}
</main>
<script>
  // sprite sheet player
  for (const el of document.querySelectorAll('.anim')) {
    const img = new Image(); img.src = el.dataset.sheet;
    const w = +el.dataset.w, h = +el.dataset.h, n = +el.dataset.n, fps = +el.dataset.fps;
    const c = document.createElement('canvas'); c.width = w; c.height = h; c.style.width = Math.min(w * 1.4, 320) + 'px';
    el.appendChild(c);
    const g = c.getContext('2d'); let i = 0;
    img.onload = () => setInterval(() => { g.clearRect(0, 0, w, h); g.drawImage(img, i * w, 0, w, h, 0, 0, w, h); i = (i + 1) % n; }, 1000 / fps);
  }
</script>
</body></html>`;
}
