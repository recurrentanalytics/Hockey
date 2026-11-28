// The start page: the bare address forwards to the world (welt.html); index.html asked for by name stays
// the hall, and so does the bare address when the device is offline (the world needs the network).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync('index.html', 'utf8').match(/<script id="startseite">([\s\S]*?)<\/script>/)?.[1];

function open(pathname, { search = '', hash = '', onLine = true } = {}) {
  let to = null;
  new Function('location', 'navigator', code)({ pathname, search, hash, replace: (u) => { to = u; } }, { onLine });
  return to;
}

test('start page: index.html carries the forwarding rule before the game loads', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  assert.ok(code, 'the rule is there');
  assert.ok(html.indexOf('id="startseite"') < html.indexOf('src/main.js'), 'and runs before the hall starts');
});

test('start page: the bare address opens the world and keeps its parameters', () => {
  assert.equal(open('/Hockey/'), 'welt.html');
  assert.equal(open('/'), 'welt.html');
  assert.equal(open('/Hockey/', { search: '?fps', hash: '#x' }), 'welt.html?fps#x');
});

test('start page: index.html by name is the hall, and so is the bare address offline', () => {
  assert.equal(open('/Hockey/index.html'), null);
  assert.equal(open('/index.html', { search: '?debug' }), null);
  assert.equal(open('/Hockey/', { onLine: false }), null);
});

test('start page: the world falls back to the hall by name, so the two never forward in a circle', () => {
  assert.match(fs.readFileSync('src/welt/welt.js', 'utf8'), /location\.replace\('index\.html'\)/);
});
