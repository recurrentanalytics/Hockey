// Chooses the intro: photorealistic Google 3D (needs internet and the club's Cesium ion token)
// or the aerial-photo version built from LGLN open data (no token needed).
// The token is asked for once (or passed as ?token=…) and then remembered on this device.
const params = new URLSearchParams(location.search);
const KEY = 'boniCesiumToken';
// inside the Android app the token lives in the app (shared by the live and the bundled version)
const app = window.BoniAndroid;
const store = {
  get: () => { if (app?.token) return app.token() || null; try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (v) => { if (app?.saveToken) { app.saveToken(v || ''); return; } try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* storage blocked */ } },
};
if (params.get('token')) store.set(params.get('token'));

const $ = (id) => document.getElementById(id);
const say = (s) => { $('status').textContent = s; };

function aerial(message = '') {
  $('cesium').remove();
  $('gl').style.display = '';
  say(message);
  if (message) setTimeout(() => say(''), 4000);
  import('./aerial.js');
}

function photoreal(token) {
  import('./photoreal.js')
    // the copy inside the Android app carries CesiumJS itself (tools/android/build.sh)
    .then((m) => m.run({ token, cesiumBase: params.get('cesiumBase') || (location.host === 'appassets.androidplatform.net' ? 'vendor/cesium/' : null) }))
    .catch((e) => {
      console.error(e);
      // a rejected token is forgotten, so the next start asks again
      if (/token|401|403|invalid/i.test(String(e?.message))) store.set(null);
      aerial(navigator.onLine ? '3D-Ansicht nicht verfügbar' : 'Keine Internetverbindung – Luftbild-Version');
    });
}

function askToken() {
  const box = $('token'), input = $('tokenInput');
  box.style.display = 'block';
  input.focus();
  const ok = () => {
    const t = input.value.trim();
    if (!t) return;
    store.set(t);
    box.style.display = 'none';
    photoreal(t);
  };
  $('tokenOk').addEventListener('click', ok);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
  $('tokenSkip').addEventListener('click', () => { box.style.display = 'none'; aerial(); });
}

// ?proxy: development container, where the network proxy adds the token itself
const token = store.get();
if (params.has('proxy')) photoreal(null);
else if (!navigator.onLine) aerial('Keine Internetverbindung – Luftbild-Version');
else if (token) photoreal(token);
else askToken();
