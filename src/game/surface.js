// The court surface and the air: how weather, temperature, autumn leaves and wind change skating
// and the ball. Everything is a factor on the normal values (1 = dry asphalt at about 15 °C).
// The 3D court (src/intro/photoreal.js) sets it from the live, picked or historical weather;
// the arena game and the flat test court keep the neutral values.

const NEUTRAL = {
  grip: 1,          // how quickly sideways drift dies when steering (less = slides through turns)
  accel: 1,         // push-off
  speed: 1,         // top speed
  glide: 1,         // rolling drag while skating
  brake: 1,         // how quickly a skater stops without input
  slip: 0,          // chance to lose the skates in a hard, fast turn
  tire: 1,          // fatigue
  ballDrag: 1,      // ball: drag while rolling
  ballFriction: 1,  // ball: rolling resistance
  ballBounce: 1,    // ball: bounce on the floor
  boardBounce: 1,   // ball: bounce off the fence
  wind: { x: 0, y: 0 }, // m/s² on the ball in the air (game coordinates), a third of it on the floor
  label: '',        // short German description for the player
};

export const SURF = { ...NEUTRAL, wind: { x: 0, y: 0 } };

const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Physics for a weather situation.
 * look: sun | partly | clouds | rain | snow | fog; temp: °C; wind: m/s (10 m height); windTo: unit
 * vector the wind blows towards, in game coordinates; leaves: 0…1 autumn leaves on the court;
 * amount: precipitation (mm/h).
 */
export function surfaceFor({ look = 'sun', temp = 15, wind = 0, windTo = { x: 0, y: 0 }, leaves = 0, amount = 0 }) {
  const s = { ...NEUTRAL };
  const notes = [];
  const wet = look === 'rain' ? clamp01(0.6 + amount * 0.2) : look === 'fog' ? 0.25 : 0;
  const snow = look === 'snow' ? clamp01(0.6 + amount * 0.3) : 0;
  // frost: below freezing a damp court turns to black ice; cold wheels and ball are harder
  const frost = clamp01((1 - temp) / 4) * (wet > 0 || look === 'fog' ? 1 : look === 'clouds' ? 0.6 : 0.35);
  const cold = clamp01((10 - temp) / 15);              // 10 °C … -5 °C
  const heat = clamp01((temp - 24) / 10);              // 24 °C … 34 °C

  // wet asphalt: wheels let go in turns and when braking, the ball drags through the water
  if (wet > 0 && !frost) {
    s.grip *= lerp(1, 0.42, wet); s.brake *= lerp(1, 0.5, wet); s.accel *= lerp(1, 0.85, wet);
    s.speed *= lerp(1, 0.93, wet); s.slip += 0.5 * wet;
    s.ballDrag *= lerp(1, 1.9, wet); s.ballFriction *= lerp(1, 1.8, wet); s.ballBounce *= lerp(1, 0.45, wet); s.boardBounce *= lerp(1, 0.85, wet);
    notes.push(look === 'fog' ? 'feuchter Platz' : 'nasser Platz – rutschig');
  }
  // snow: wheels sink in and slide sideways, everything is slow, the ball dies in the snow
  if (snow > 0) {
    s.grip *= lerp(1, 0.3, snow); s.accel *= lerp(1, 0.55, snow); s.speed *= lerp(1, 0.68, snow);
    s.glide *= lerp(1, 2.4, snow); s.brake *= lerp(1, 0.8, snow); s.slip += 0.8 * snow; s.tire *= lerp(1, 1.5, snow);
    s.ballDrag *= lerp(1, 3.2, snow); s.ballFriction *= lerp(1, 4, snow); s.ballBounce *= lerp(1, 0.15, snow); s.boardBounce *= lerp(1, 0.7, snow);
    notes.push('Schnee – zäh und glatt');
  }
  // black ice / frost
  if (frost > 0.05 && !snow) {
    s.grip *= lerp(1, 0.35, frost); s.brake *= lerp(1, 0.3, frost); s.slip += 0.9 * frost; s.glide *= lerp(1, 0.7, frost);
    s.ballFriction *= lerp(1, 0.6, frost);
    if (frost > 0.4) notes.push('Glätte! Vorsicht beim Bremsen');
  }
  // cold: hard wheels grip less, the hard plastic ball bounces more
  if (cold > 0) {
    s.grip *= lerp(1, 0.85, cold); s.ballBounce *= lerp(1, 1.3, cold); s.boardBounce *= lerp(1, 1.12, cold); s.ballFriction *= lerp(1, 0.9, cold);
    if (cold > 0.5 && !notes.length) notes.push('kalt – der Ball springt mehr');
  }
  // heat: soft wheels grip well but are slow, players tire quickly, the soft ball is lame
  if (heat > 0) {
    s.grip *= lerp(1, 1.15, heat); s.glide *= lerp(1, 1.3, heat); s.speed *= lerp(1, 0.95, heat); s.tire *= lerp(1, 1.8, heat);
    s.ballBounce *= lerp(1, 0.8, heat); s.ballFriction *= lerp(1, 1.15, heat);
    notes.push('Hitze – schnell müde');
  }
  // autumn leaves on the asphalt: slippery, even more so when wet
  if (leaves > 0.05) {
    const l = leaves * (wet > 0 ? 1.6 : 1);
    s.grip *= lerp(1, 0.75, clamp01(l)); s.slip += 0.25 * clamp01(l); s.ballFriction *= lerp(1, 1.25, clamp01(leaves));
    if (wet > 0 && notes[0]?.startsWith('nasser')) notes[0] = 'nasses Laub – sehr rutschig';
    else notes.push(wet > 0 ? 'nasses Laub – rutschig' : 'Laub auf dem Platz');
  }
  // wind on the light ball: a = ½ ρ c A v² / m ≈ 0.019 v²; the trees around the court shelter it a lot
  const a = Math.min(3, 0.019 * wind * wind * 0.35);
  s.wind = { x: windTo.x * a, y: windTo.y * a };
  if (wind > 6) notes.push(wind > 11 ? 'Sturm – der Ball fliegt mit' : 'Wind – lange Pässe driften');
  s.slip = Math.min(1, s.slip);
  s.label = notes.slice(0, 2).join(' · ') || 'trockener Platz';
  return s;
}

/** Change the surface for the running game. */
export function setSurface(s) {
  Object.assign(SURF, s, { wind: { ...s.wind } });
}
