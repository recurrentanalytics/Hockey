// Chooses the intro: photorealistic Google 3D (needs the club's Cesium ion token) or, without a
// token or if loading fails, the aerial-photo version built from LGLN open data.
// The token can be passed once as ?token=… and is then remembered on this device.
const params = new URLSearchParams(location.search);
let token = params.get('token');
try {
  if (token) localStorage.setItem('boniCesiumToken', token);
  else token = localStorage.getItem('boniCesiumToken');
} catch { /* storage blocked: token only for this visit */ }

// ?proxy: development container, where the network proxy adds the token itself
if (token || params.has('proxy')) {
  import('./photoreal.js')
    .then((m) => m.run({ token, cesiumBase: params.get('cesiumBase') }))
    .catch((e) => {
      console.error(e);
      document.getElementById('cesium').remove();
      document.getElementById('gl').style.display = '';
      document.getElementById('status').textContent = '';
      import('./aerial.js');
    });
} else {
  import('./aerial.js');
}
