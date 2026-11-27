// Inside the Android app (window.BoniAndroid) the gamepads are read natively by MainActivity and
// handed over here in the W3C "standard" layout. navigator.getGamepads() then returns them, so
// the game's input code works unchanged, whether or not the system WebView has the Gamepad API.
if (window.BoniAndroid) {
  const pads = [];
  const real = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];
  window.__nativePad = (index, id, buttons, axes) => {
    const fresh = !pads[index];
    pads[index] = {
      id, index, connected: true, mapping: 'standard', timestamp: performance.now(),
      buttons: buttons.map((v) => ({ pressed: v > 0.5, touched: v > 0, value: v })),
      axes,
    };
    if (fresh) window.dispatchEvent(Object.assign(new Event('gamepadconnected'), { gamepad: pads[index] }));
  };
  navigator.getGamepads = () => (pads.some(Boolean) ? pads : real());
}
